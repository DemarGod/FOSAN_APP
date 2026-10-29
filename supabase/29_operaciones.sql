-- 29 · ESTANDARIZACIÓN · ETAPA 4 · Paquete 8a: Operaciones → Programación
-- Una operación ES un despacho (D-00001…): así Rutas semanales y Mi ruta siguen igual.
-- Solo agrega. No borra despachos, rutas ni movimientos.
--   A. Datos nuevos de la operación: servicio, ubicación (obra), responsable y cancelación con motivo.
--   B. Tipo "limpieza" (limpieza puntual de baños o de fosa) además de entrega, retiro y cambio.
--   C. Al marcarse hecha, los baños quedan en la UBICACIÓN de la operación (no siempre en la primera obra)
--      y se asocian a su servicio. Programar sigue sin mover nada.
--   D. cancelar_operacion(): solo si no se ha ejecutado; libera la reserva y conserva el registro.
--   E. Vista v_operaciones para la Programación.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
select (select count(*) from despachos)                              as despachos,
       (select count(*) from despachos where estado = 'programado')  as programados,
       (select count(*) from despachos where estado = 'hecho')       as hechos,
       (select count(*) from despachos where estado = 'cancelado')   as cancelados,
       (select string_agg(distinct tipo, ', ') from despachos)       as tipos;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
-- A. Datos nuevos
alter table despachos add column if not exists servicio_id uuid references servicios_cliente(id);
alter table despachos add column if not exists ubicacion_id uuid references ubicaciones(id);
alter table despachos add column if not exists responsable_id uuid references personal(id);
alter table despachos add column if not exists motivo_cancelacion text;
alter table despachos add column if not exists cancelado_en timestamptz;
alter table despachos add column if not exists cancelado_por uuid;

-- B. Tipo limpieza (puntual de baños o fosa); las rutas ya conocen la tarea "limpieza"
alter table despachos drop constraint if exists despachos_tipo_check;
alter table despachos add constraint despachos_tipo_check check (tipo in ('entrega', 'retiro', 'cambio', 'limpieza'));

-- C. Ejecución confirmada: igual que antes, pero usa la ubicación y el servicio de la operación
create or replace function cerrar_despacho() returns trigger as $$
declare u uuid; b uuid; vc text; r record;
begin
  if not (new.estado = 'hecho' and old.estado <> 'hecho') then return new; end if;
  perform set_config('fosan.silencio', '1', true);

  u := new.ubicacion_id;
  if u is null then
    select id into u from ubicaciones where cliente_id = new.cliente_id and tipo = 'cliente' order by creado_en limit 1;
  end if;
  if u is null then
    insert into ubicaciones (nombre, tipo, cliente_id, direccion, comuna, lat, lng)
    select nombre, 'cliente', id, coalesce(new.direccion, direccion), comuna, lat, lng
      from clientes where id = new.cliente_id
    returning id into u;
  end if;
  select id into b from ubicaciones where tipo = 'bodega' and activa order by creado_en limit 1;
  select codigo into vc from activos where id = new.vehiculo_id;

  for r in select db.activo_id, db.accion, a.ubicacion_id as desde
             from despacho_banos db join activos a on a.id = db.activo_id
            where db.despacho_id = new.id loop
    if r.accion = 'entrega' then
      update activos set estado = 'en_arriendo', cliente_id = new.cliente_id, ubicacion_id = u,
             servicio_id = coalesce(new.servicio_id, servicio_id) where id = r.activo_id;
      insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
      values (r.activo_id, 'instalacion', r.desde, u, new.cliente_id,
              'Despacho ' || new.folio || coalesce(' · vehículo ' || vc, ''));
    else
      update activos set estado = 'disponible', cliente_id = null, servicio_id = null,
             ubicacion_id = coalesce(b, ubicacion_id) where id = r.activo_id;
      insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
      values (r.activo_id, 'retiro', r.desde, b, new.cliente_id,
              'Retiro ' || new.folio || coalesce(' · vehículo ' || vc, ''));
    end if;
  end loop;

  perform set_config('fosan.silencio', '0', true);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- D. Cancelar con motivo (solo programadas). El registro queda; la reserva de baños se libera sola.
create or replace function cancelar_operacion(p_id uuid, p_motivo text) returns void as $$
declare d record;
begin
  if not (es_dueno() or permiso_seccion('rutas', 'editar')) then raise exception 'No tienes permiso para cancelar operaciones.'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Indica el motivo de la cancelación.'; end if;
  select * into d from despachos where id = p_id for update;
  if d is null then raise exception 'La operación no existe.'; end if;
  if d.estado = 'hecho' then raise exception 'La operación ya se ejecutó: corrígela con un registro vinculado (por ejemplo, un retiro).'; end if;
  if d.estado = 'cancelado' then raise exception 'La operación ya estaba cancelada.'; end if;
  update despachos set estado = 'cancelado', motivo_cancelacion = trim(p_motivo), cancelado_en = now(), cancelado_por = auth.uid()
   where id = p_id;
end;
$$ language plpgsql security definer set search_path = public;


-- ══ PASO 3 · Vista de operaciones (seleccionar hasta el PASO 4) ════════════════
create or replace view v_operaciones with (security_invoker = on) as
select d.id, d.folio, d.tipo, d.estado, d.origen, d.fecha_programada, d.fecha_realizada, d.observaciones,
       d.cliente_id, c.nombre as cliente, c.rut,
       d.ubicacion_id, coalesce(u.nombre, d.direccion) as ubicacion,
       d.servicio_id, s.codigo as servicio_codigo, s.tipo as servicio_tipo,
       d.vehiculo_id, coalesce(ve.patente, va.codigo) as patente,
       d.responsable_id, p.nombre as responsable,
       d.salida_id, sa.fecha as fecha_salida,
       coalesce(rs.nombre, (select rs2.nombre from rutas_semana_lineas l join rutas_semana rs2 on rs2.id = l.ruta_id
                             where l.despacho_id = d.id limit 1)) as ruta,
       d.motivo_cancelacion, d.cancelado_en,
       (select string_agg(a.codigo || case when db.accion = 'retiro' and d.tipo = 'cambio' then ' (retiro)' else '' end, ', ' order by a.codigo)
          from despacho_banos db join activos a on a.id = db.activo_id where db.despacho_id = d.id) as unidades,
       (select count(*) from despacho_banos db where db.despacho_id = d.id) as cantidad,
       case when d.estado = 'hecho' then 'realizada'
            when d.estado = 'cancelado' then 'cancelada'
            when d.fecha_programada < current_date then 'pendiente'
            else 'programada' end as estado_op
  from despachos d
  join clientes c on c.id = d.cliente_id
  left join ubicaciones u on u.id = d.ubicacion_id
  left join servicios_cliente s on s.id = d.servicio_id
  left join activos va on va.id = d.vehiculo_id
  left join vehiculos ve on ve.activo_id = d.vehiculo_id
  left join personal p on p.id = d.responsable_id
  left join salidas sa on sa.id = d.salida_id
  left join rutas_semana rs on rs.id = sa.ruta_semana_id;
grant select on v_operaciones to authenticated;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: columnas_nuevas = 6, tipo_limpieza = 1, funciones = 2, operaciones_vista = despachos del PASO 1.
select (select count(*) from information_schema.columns where table_name = 'despachos'
          and column_name in ('servicio_id','ubicacion_id','responsable_id','motivo_cancelacion','cancelado_en','cancelado_por')) as columnas_nuevas,
       (select count(*) from pg_constraint where conname = 'despachos_tipo_check' and pg_get_constraintdef(oid) like '%limpieza%') as tipo_limpieza,
       (select count(distinct proname) from pg_proc where proname in ('cerrar_despacho','cancelar_operacion'))                as funciones,
       (select count(*) from v_operaciones)                                                                                  as operaciones_vista;
