-- 28 · ESTANDARIZACIÓN · ETAPA 3 · Paquete 7c: Inventario → Insumos y EPP
-- Solo agrega. No borra insumos, movimientos ni la receta de limpieza (Análisis los sigue leyendo).
--   A. Artículo: control por lote, requiere vencimiento, ubicación del mínimo, observaciones.
--   B. Lotes (código + vencimiento) y existencias por ubicación (y lote).
--   C. movimientos_insumo gana tipo, origen, destino, lote, usuario y referencia.
--      La cantidad sigue con signo (+ entra / − sale) como hasta ahora: el traslado no cuenta como consumo.
--   D. registrar_movimiento_insumo(): Entrada · Traslado · Consumo · Ajuste con todas las validaciones.
--      insumos.stock_actual queda siempre = suma de existencias.
--   E. Los descuentos automáticos que ya existen (limpiezas de las rutas) se aplican a la bodega principal.
--   F. El stock actual de cada insumo pasa como existencia inicial en "Bodega central Talca".
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
select (select count(*) from insumos)                                          as insumos,
       (select count(*) from insumos where stock_actual <> 0)                  as con_stock,
       (select coalesce(sum(stock_actual), 0) from insumos)                    as stock_total,
       (select count(*) from movimientos_insumo)                               as movimientos,
       (select count(*) from insumos where categoria_id is null or unidad_id is null) as sin_categoria_o_unidad,
       (select nombre from ubicaciones where tipo = 'bodega' and activa order by creado_en limit 1) as bodega_principal;


-- ══ PASO 2 · Estructura (seleccionar hasta el PASO 3) ══════════════════════════
-- A. Artículo
alter table insumos add column if not exists control_lote boolean not null default false;
alter table insumos add column if not exists requiere_vencimiento boolean not null default false;
alter table insumos add column if not exists ubicacion_minimo_id uuid references ubicaciones(id);
alter table insumos add column if not exists observaciones text;
do $$ begin
  alter table insumos add constraint insumos_venc_lote_chk check (not requiere_vencimiento or control_lote);
exception when duplicate_object then null; end $$;

-- B. Lotes y existencias
create table if not exists insumo_lotes (
  id          uuid primary key default gen_random_uuid(),
  insumo_id   uuid not null references insumos(id),
  codigo      text not null,
  vencimiento date,
  bloqueado   boolean not null default false,
  creado_en   timestamptz not null default now(),
  unique (insumo_id, codigo)
);
create table if not exists insumo_existencias (
  id           uuid primary key default gen_random_uuid(),
  insumo_id    uuid not null references insumos(id),
  ubicacion_id uuid not null references ubicaciones(id),
  lote_id      uuid references insumo_lotes(id),
  cantidad     numeric(12,3) not null default 0,
  actualizado_en timestamptz not null default now()
);
create unique index if not exists insumo_existencias_unica
  on insumo_existencias (insumo_id, ubicacion_id, coalesce(lote_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- C. Movimientos
alter table movimientos_insumo add column if not exists tipo text;
alter table movimientos_insumo add column if not exists origen_id uuid references ubicaciones(id);
alter table movimientos_insumo add column if not exists destino_id uuid references ubicaciones(id);
alter table movimientos_insumo add column if not exists lote_id uuid references insumo_lotes(id);
alter table movimientos_insumo add column if not exists usuario_id uuid references perfiles(id);
alter table movimientos_insumo add column if not exists referencia text;
alter table movimientos_insumo add column if not exists servicio_id uuid references servicios_cliente(id);
alter table movimientos_insumo add column if not exists receptor text;
create index if not exists movimientos_insumo_insumo on movimientos_insumo (insumo_id, fecha desc);

-- Seguridad: todos leen; registrar solo con permiso en Insumos (y siempre por la función)
do $$ declare t text; begin
  foreach t in array array['insumo_lotes', 'insumo_existencias'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_ver', t);
    execute format('create policy %I on %I for select using (tiene_acceso())', t || '_ver', t);
    execute format('drop trigger if exists auditoria_%1$s on %1$I', t);
    execute format('create trigger auditoria_%1$s after insert or update or delete on %1$I for each row execute function registrar_auditoria()', t);
  end loop;
end $$;

-- Suma una variación a la existencia (insumo, ubicación, lote) y recalcula el total del insumo
create or replace function sumar_existencia(p_insumo uuid, p_ubicacion uuid, p_lote uuid, p_delta numeric) returns void as $$
begin
  insert into insumo_existencias (insumo_id, ubicacion_id, lote_id, cantidad)
  values (p_insumo, p_ubicacion, p_lote, p_delta)
  on conflict (insumo_id, ubicacion_id, coalesce(lote_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set cantidad = insumo_existencias.cantidad + excluded.cantidad, actualizado_en = now();
  update insumos set stock_actual = coalesce((select sum(cantidad) from insumo_existencias where insumo_id = p_insumo), 0)
   where id = p_insumo;
end;
$$ language plpgsql security definer set search_path = public;


-- ══ PASO 3 · Funciones y migración (seleccionar hasta el PASO 4) ═══════════════
-- D. Registrar un movimiento. p_tipo: entrada | traslado | consumo | ajuste
create or replace function registrar_movimiento_insumo(
  p_insumo uuid, p_tipo text, p_cantidad numeric, p_fecha timestamptz,
  p_origen uuid default null, p_destino uuid default null,
  p_lote uuid default null, p_lote_codigo text default null, p_vencimiento date default null,
  p_motivo text default null, p_referencia text default null, p_servicio uuid default null, p_receptor text default null
) returns bigint as $$
declare i record; u text; cat text; lote uuid := p_lote; l record; disp numeric; v_id bigint; signo numeric;
begin
  if not permiso_seccion('insumos', 'editar') then raise exception 'No tienes permiso para registrar movimientos de insumos.'; end if;
  select * into i from insumos where id = p_insumo;
  if i is null or not i.activo then raise exception 'El artículo no existe o está inactivo.'; end if;
  select lower(abreviatura) into u from unidades_medida where id = i.unidad_id;
  select clase into cat from categorias where id = i.categoria_id;
  if p_tipo not in ('entrada', 'traslado', 'consumo', 'ajuste') then raise exception 'Tipo de movimiento inválido.'; end if;
  if coalesce(p_cantidad, 0) = 0 then raise exception 'La cantidad no puede ser cero.'; end if;
  if p_tipo <> 'ajuste' and p_cantidad < 0 then raise exception 'La cantidad debe ser positiva.'; end if;
  -- Unidades y pares enteros; litros, kilos y m³ permiten decimales
  if coalesce(u, i.unidad) not in ('l', 'litro', 'kg', 'kilo', 'm³', 'm3') and p_cantidad <> trunc(p_cantidad) then
    raise exception 'Este artículo se mide en %: la cantidad debe ser entera.', coalesce(u, i.unidad);
  end if;
  if p_fecha > now() + interval '5 minutes' then raise exception 'La fecha no puede ser futura.'; end if;

  -- Ubicaciones según tipo
  if p_tipo = 'entrada' and p_destino is null then raise exception 'Indica el destino.'; end if;
  if p_tipo in ('traslado', 'consumo') and p_origen is null then raise exception 'Indica el origen.'; end if;
  if p_tipo = 'traslado' and p_destino is null then raise exception 'Indica el destino.'; end if;
  if p_tipo = 'traslado' and p_origen = p_destino then raise exception 'Origen y destino no pueden ser iguales.'; end if;
  if p_tipo = 'ajuste' and coalesce(p_origen, p_destino) is null then raise exception 'Indica la ubicación.'; end if;
  if p_tipo = 'ajuste' and not es_dueno() then raise exception 'El ajuste requiere permiso del dueño.'; end if;
  if p_tipo = 'ajuste' and coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'El ajuste requiere motivo.'; end if;
  if p_tipo = 'consumo' and cat = 'epp' and coalesce(length(trim(p_receptor)), 0) < 3 then raise exception 'Indica la persona receptora del EPP.'; end if;
  if p_tipo = 'consumo' and coalesce(cat, '') <> 'epp' and p_servicio is null and coalesce(length(trim(p_referencia)), 0) < 2 then
    raise exception 'Indica el servicio u orden de trabajo del consumo.';
  end if;

  -- Lote
  if i.control_lote then
    if p_tipo = 'entrada' and lote is null then
      if coalesce(trim(p_lote_codigo), '') = '' then raise exception 'Indica el lote.'; end if;
      if i.requiere_vencimiento and p_vencimiento is null then raise exception 'Indica el vencimiento del lote.'; end if;
      insert into insumo_lotes (insumo_id, codigo, vencimiento) values (p_insumo, upper(trim(p_lote_codigo)), p_vencimiento)
      on conflict (insumo_id, codigo) do update set vencimiento = coalesce(insumo_lotes.vencimiento, excluded.vencimiento)
      returning id into lote;
    end if;
    if lote is null then raise exception 'Indica el lote.'; end if;
    select * into l from insumo_lotes where id = lote and insumo_id = p_insumo;
    if l is null then raise exception 'El lote no corresponde al artículo.'; end if;
    if p_tipo in ('traslado', 'consumo') and (l.bloqueado or (l.vencimiento is not null and l.vencimiento < current_date)) then
      raise exception 'El lote % está vencido o bloqueado: no se puede usar.', l.codigo;
    end if;
  else
    lote := null;
  end if;

  -- Stock suficiente en el origen (nunca queda negativo)
  if p_tipo in ('traslado', 'consumo') or (p_tipo = 'ajuste' and p_cantidad < 0) then
    select coalesce(sum(cantidad), 0) into disp from insumo_existencias
     where insumo_id = p_insumo and ubicacion_id = coalesce(p_origen, p_destino)
       and coalesce(lote_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(lote, '00000000-0000-0000-0000-000000000000'::uuid);
    if disp < abs(p_cantidad) then raise exception 'Stock insuficiente: hay % disponible(s).', disp; end if;
  end if;

  -- Existencias
  if p_tipo = 'entrada' then perform sumar_existencia(p_insumo, p_destino, lote, p_cantidad); end if;
  if p_tipo = 'traslado' then
    perform sumar_existencia(p_insumo, p_origen, lote, -p_cantidad);
    perform sumar_existencia(p_insumo, p_destino, lote, p_cantidad);
  end if;
  if p_tipo = 'consumo' then perform sumar_existencia(p_insumo, p_origen, lote, -p_cantidad); end if;
  if p_tipo = 'ajuste' then perform sumar_existencia(p_insumo, coalesce(p_origen, p_destino), lote, p_cantidad); end if;

  -- Registro (cantidad con signo: entra +, sale −; el traslado se anota en positivo y no cuenta como consumo)
  signo := case p_tipo when 'consumo' then -1 else 1 end;
  insert into movimientos_insumo (insumo_id, fecha, cantidad, motivo, tipo, origen_id, destino_id, lote_id, usuario_id, referencia, servicio_id, receptor)
  values (p_insumo, p_fecha, signo * abs(p_cantidad) * case when p_tipo = 'ajuste' then sign(p_cantidad) else 1 end,
          nullif(trim(p_motivo), ''), p_tipo,
          case when p_tipo in ('traslado', 'consumo') then p_origen when p_tipo = 'ajuste' then coalesce(p_origen, p_destino) end,
          case when p_tipo in ('entrada', 'traslado') then p_destino end,
          lote, auth.uid(), nullif(trim(p_referencia), ''), p_servicio, nullif(trim(p_receptor), ''))
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

-- E. Descuentos automáticos que ya existen (limpiezas de rutas, sin tipo): se aplican a la bodega principal
create or replace function t_movimiento_insumo_legado() returns trigger as $$
declare b uuid;
begin
  if new.tipo is not null then return new; end if;
  select id into b from ubicaciones where tipo = 'bodega' and activa order by creado_en limit 1;
  new.tipo := case when new.cantidad < 0 then 'consumo' else 'entrada' end;
  if new.cantidad < 0 then new.origen_id := b; else new.destino_id := b; end if;
  if b is not null then
    insert into insumo_existencias (insumo_id, ubicacion_id, lote_id, cantidad) values (new.insumo_id, b, null, new.cantidad)
    on conflict (insumo_id, ubicacion_id, coalesce(lote_id, '00000000-0000-0000-0000-000000000000'::uuid))
    do update set cantidad = insumo_existencias.cantidad + excluded.cantidad, actualizado_en = now();
    update insumos set stock_actual = coalesce((select sum(cantidad) from insumo_existencias where insumo_id = new.insumo_id), 0)
     where id = new.insumo_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists t_movimiento_insumo_legado on movimientos_insumo;
create trigger t_movimiento_insumo_legado before insert on movimientos_insumo
for each row execute function t_movimiento_insumo_legado();

-- F. Migración: stock actual → existencia inicial en la bodega principal (una sola vez)
insert into insumo_existencias (insumo_id, ubicacion_id, lote_id, cantidad)
select i.id, (select id from ubicaciones where tipo = 'bodega' and activa order by creado_en limit 1), null, i.stock_actual
  from insumos i
 where i.stock_actual <> 0
   and not exists (select 1 from insumo_existencias e where e.insumo_id = i.id)
   and exists (select 1 from ubicaciones where tipo = 'bodega' and activa);
update movimientos_insumo set tipo = case when cantidad < 0 then 'consumo' else 'entrada' end where tipo is null;
update insumos i set ubicacion_minimo_id = (select id from ubicaciones where tipo = 'bodega' and activa order by creado_en limit 1)
 where ubicacion_minimo_id is null;

-- Código siguiente sugerido (INS-### o EPP-###)
create or replace function siguiente_codigo_insumo(p_prefijo text) returns text as $$
  select p_prefijo || '-' || lpad((coalesce(max(substring(codigo from length(p_prefijo) + 2)::int), 0) + 1)::text, 3, '0')
    from insumos where codigo ~ ('^' || p_prefijo || '-[0-9]+$');
$$ language sql stable security definer set search_path = public;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: diferencia = 0 (el stock de cada insumo = suma de sus existencias), funciones = 4, triggers = 1.
select (select count(*) from insumo_existencias)                                            as existencias,
       (select count(*) from insumos i where i.stock_actual <>
          coalesce((select sum(cantidad) from insumo_existencias e where e.insumo_id = i.id), 0)) as diferencia,
       (select count(distinct proname) from pg_proc where proname in
          ('sumar_existencia','registrar_movimiento_insumo','t_movimiento_insumo_legado','siguiente_codigo_insumo')) as funciones,
       (select count(*) from pg_trigger where tgname = 't_movimiento_insumo_legado')           as triggers,
       siguiente_codigo_insumo('INS')                                                          as siguiente_ins;
