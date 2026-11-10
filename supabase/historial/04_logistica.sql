-- ════════════════════════════════════════════════════════════════════════════
-- FOSAN — 04 · Clientes mejorados + Logística (transporte, insumos, despachos,
--            rutas, costos). Ejecutar UNA vez en SQL Editor, después de 01-03.
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────── 1. Rubros editables (antes era una lista fija) ──────────────
create table if not exists rubros (
  clave     text primary key,
  nombre    text not null unique,
  creado_en timestamptz not null default now()
);
insert into rubros (clave, nombre) values
  ('construccion','Construcción'), ('agricola','Agrícola'), ('eventos','Eventos'),
  ('mineria','Minería'), ('publico','Público'), ('otro','Otro')
on conflict do nothing;

drop view if exists export_clientes;
drop view if exists v_clientes_resumen;
alter table clientes alter column rubro drop default;
alter table clientes alter column rubro type text using rubro::text;
alter table clientes alter column rubro set default 'construccion';
alter table clientes drop constraint if exists clientes_rubro_fkey;
alter table clientes add constraint clientes_rubro_fkey
  foreign key (rubro) references rubros(clave) on update cascade;

-- Borrar un cliente no debe quedar bloqueado por su historial
alter table movimientos_activo drop constraint if exists movimientos_activo_cliente_id_fkey;
alter table movimientos_activo add constraint movimientos_activo_cliente_id_fkey
  foreign key (cliente_id) references clientes(id) on delete set null;

-- ───────────── 2. Transporte: ficha técnica y costos del vehículo ──────────
alter table vehiculos alter column patente drop not null;
alter table vehiculos add column if not exists tipo_vehiculo   text default 'camion_limpiafosas';
alter table vehiculos add column if not exists capacidad_kg    integer;
alter table vehiculos add column if not exists capacidad_banos integer;
alter table vehiculos add column if not exists rend_vacio      numeric(6,2);   -- km/L
alter table vehiculos add column if not exists rend_cargado    numeric(6,2);   -- km/L
alter table vehiculos add column if not exists valor_compra    integer;
alter table vehiculos add column if not exists vida_util_km    integer;
alter table vehiculos add column if not exists costo_mant_km   integer;
alter table vehiculos add column if not exists costo_fijo_anual integer;       -- seguro + permiso + revisión
alter table vehiculos add column if not exists km_anual        integer;        -- para prorratear los fijos
-- capacidad_litros se usa como estanque de residuos

alter table modelos_bano add column if not exists peso_kg numeric(7,1);        -- peso vacío

-- ───────────── 3. Parámetros de costo e insumos ────────────────────────────
create table if not exists parametros (
  clave    text primary key,
  valor    numeric,
  etiqueta text not null,
  unidad   text
);
insert into parametros (clave, valor, etiqueta, unidad) values
  ('diesel_litro', 1374, 'Precio del diésel', '$/L'),
  ('litros_limpieza', null, 'Residuo promedio por baño limpiado', 'L'),
  ('densidad_residuo', null, 'Peso del residuo', 'kg/L')
on conflict (clave) do nothing;

create table if not exists receta_limpieza (          -- lo que gasta 1 baño limpiado
  insumo_id uuid primary key references insumos(id) on delete cascade,
  cantidad  numeric(12,3) not null
);

create table if not exists movimientos_insumo (
  id        bigserial primary key,
  insumo_id uuid not null references insumos(id) on delete cascade,
  fecha     timestamptz not null default now(),
  cantidad  numeric(12,3) not null,                   -- + ingreso / − consumo
  motivo    text
);

-- ───────────── 4. Rutas y salidas ──────────────────────────────────────────
create table if not exists rutas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  dias        smallint[] not null default '{}',       -- 1=lunes … 7=domingo
  vehiculo_id uuid references activos(id) on delete set null,
  activa      boolean not null default true,
  notas       text,
  creado_en   timestamptz not null default now()
);

create table if not exists ruta_paradas (
  id         bigserial primary key,
  ruta_id    uuid not null references rutas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  orden      integer not null default 1,
  tarea      text not null default 'limpieza' check (tarea in ('limpieza','entrega','retiro'))
);

create table if not exists salidas (                  -- una ruta hecha en un día
  id               uuid primary key default gen_random_uuid(),
  ruta_id          uuid not null references rutas(id) on delete cascade,
  fecha            date not null,
  vehiculo_id      uuid references activos(id) on delete set null,
  estado           text not null default 'planificada' check (estado in ('planificada','cerrada','cancelada')),
  km_estimado      numeric(8,1),
  odometro_salida  integer,
  odometro_llegada integer,
  km_real          numeric(8,1) generated always as (
                     case when odometro_llegada is not null and odometro_salida is not null
                          then odometro_llegada - odometro_salida end) stored,
  creado_en        timestamptz not null default now(),
  unique (ruta_id, fecha)
);

create table if not exists salida_paradas (
  id         bigserial primary key,
  salida_id  uuid not null references salidas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  orden      integer not null default 1,
  tarea      text not null default 'limpieza',
  banos      integer not null default 0,
  hecha      boolean not null default false,
  hecha_en   timestamptz
);

-- ───────────── 5. Despachos y retiros ──────────────────────────────────────
create sequence if not exists folio_despacho_seq start 1;

create table if not exists despachos (
  id               uuid primary key default gen_random_uuid(),
  folio            text not null unique default ('D-' || lpad(nextval('folio_despacho_seq')::text, 5, '0')),
  tipo             text not null check (tipo in ('entrega','retiro','cambio')),
  cliente_id       uuid not null references clientes(id) on delete cascade,
  direccion        text,
  vehiculo_id      uuid references activos(id) on delete set null,
  salida_id        uuid references salidas(id) on delete set null,
  fecha_programada date not null default current_date,
  fecha_realizada  timestamptz,
  estado           text not null default 'programado' check (estado in ('programado','hecho','cancelado')),
  origen           text not null default 'manual',     -- manual | vencimiento | nuevo_cliente
  observaciones    text,
  creado_en        timestamptz not null default now()
);
create index if not exists despachos_fecha on despachos (fecha_programada);

create table if not exists despacho_banos (
  despacho_id uuid not null references despachos(id) on delete cascade,
  activo_id   uuid not null references activos(id) on delete cascade,
  accion      text not null default 'entrega' check (accion in ('entrega','retiro')),
  primary key (despacho_id, activo_id)
);

-- ───────────── 6. Vistas ───────────────────────────────────────────────────
create view v_clientes_resumen as
select c.id, c.nombre, c.rut, c.rubro, coalesce(r.nombre, c.rubro) as rubro_nombre,
       c.contacto_nombre, c.telefono, c.correo, c.direccion, c.comuna,
       c.fecha_inicio_contrato, c.fecha_fin_contrato,
       case
         when c.fecha_fin_contrato is null then 'indefinido'
         when c.fecha_fin_contrato >= current_date then 'vigente'
         else 'vencido'
       end                                                  as vigencia,
       (c.lat is not null and c.lng is not null)            as georreferenciado,
       count(a.id)                                          as banos_activos,
       coalesce(c.valor_mensual, sum(a.valor_arriendo), 0)  as valor_mensual,
       exists (select 1 from despachos d where d.cliente_id = c.id
               and d.tipo = 'retiro' and d.estado = 'programado') as retiro_pendiente
from clientes c
left join rubros r  on r.clave = c.rubro
left join activos a on a.cliente_id = c.id and a.estado = 'en_arriendo'
group by c.id, r.nombre;

create view export_clientes as
select nombre, rut, rubro_nombre as rubro, contacto_nombre, telefono, correo, comuna,
       vigencia, fecha_fin_contrato, banos_activos, valor_mensual, georreferenciado
from v_clientes_resumen order by nombre;

create or replace view v_despachos as
select d.id, d.folio, d.tipo, d.estado, d.origen, d.fecha_programada, d.fecha_realizada,
       d.cliente_id, c.nombre as cliente, coalesce(d.direccion, c.direccion) as direccion,
       d.vehiculo_id, va.codigo as vehiculo, d.salida_id, r.nombre as ruta, s.fecha as fecha_salida,
       d.observaciones,
       (select string_agg(a.codigo || case when db.accion = 'retiro' then ' (retiro)' else '' end, ', ' order by a.codigo)
          from despacho_banos db join activos a on a.id = db.activo_id where db.despacho_id = d.id) as banos,
       (select count(*) from despacho_banos db where db.despacho_id = d.id) as cantidad
from despachos d
join clientes c       on c.id = d.cliente_id
left join activos va  on va.id = d.vehiculo_id
left join salidas s   on s.id = d.salida_id
left join rutas r     on r.id = s.ruta_id;

create or replace view v_salidas as
select s.id, s.ruta_id, r.nombre as ruta, s.fecha, s.estado, s.vehiculo_id, a.codigo as vehiculo,
       a.estado as vehiculo_estado,
       s.km_estimado, s.odometro_salida, s.odometro_llegada, s.km_real,
       coalesce(s.km_real, s.km_estimado) as km,
       v.tipo_vehiculo, v.capacidad_kg, v.capacidad_banos, v.capacidad_litros, v.rend_vacio, v.rend_cargado,
       v.valor_compra, v.vida_util_km, v.costo_mant_km, v.costo_fijo_anual, v.km_anual, v.kilometraje,
       (select count(*) from salida_paradas p where p.salida_id = s.id)                      as paradas,
       (select count(*) from salida_paradas p where p.salida_id = s.id and p.hecha)          as paradas_hechas,
       (select coalesce(sum(p.banos), 0) from salida_paradas p where p.salida_id = s.id and p.tarea = 'limpieza') as banos_limpieza,
       (select count(*) from despachos d where d.salida_id = s.id and d.estado <> 'cancelado') as despachos,
       (select coalesce(sum(mb.peso_kg), 0) from despachos d
          join despacho_banos db on db.despacho_id = d.id
          join activos b on b.id = db.activo_id
          left join modelos_bano mb on mb.id = b.modelo_id
         where d.salida_id = s.id and d.estado <> 'cancelado')                                as peso_banos,
       (select count(*) from despachos d
          join despacho_banos db on db.despacho_id = d.id
          join activos b on b.id = db.activo_id
          left join modelos_bano mb on mb.id = b.modelo_id
         where d.salida_id = s.id and d.estado <> 'cancelado' and mb.peso_kg is null)       as banos_sin_peso,
       (select count(*) from despachos d
          join despacho_banos db on db.despacho_id = d.id
         where d.salida_id = s.id and d.estado <> 'cancelado')                                as banos_transportados
from salidas s
join rutas r          on r.id = s.ruta_id
left join activos a   on a.id = s.vehiculo_id
left join vehiculos v on v.activo_id = s.vehiculo_id;

-- ───────────── 7. Reglas automáticas entre módulos ─────────────────────────
-- Los cambios hechos por un despacho dejan su propio movimiento (sin duplicar)
create or replace function registrar_movimiento_activo() returns trigger as $$
begin
  if coalesce(current_setting('fosan.silencio', true), '') = '1' then return new; end if;
  if (new.ubicacion_id is distinct from old.ubicacion_id)
     or (new.estado is distinct from old.estado)
     or (new.cliente_id is distinct from old.cliente_id) then
    insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
    values (new.id,
            case when new.ubicacion_id is distinct from old.ubicacion_id then 'traslado' else 'cambio_estado' end,
            old.ubicacion_id, new.ubicacion_id, new.cliente_id,
            'estado: ' || old.estado || ' → ' || new.estado);
  end if;
  return new;
end;
$$ language plpgsql;

-- Baño en mantención (o fuera de servicio) no se puede despachar
create or replace function validar_bano_despacho() returns trigger as $$
declare a activos;
begin
  select * into a from activos where id = new.activo_id;
  if a.tipo <> 'bano_quimico' then
    raise exception '% no es un baño químico', a.codigo;
  end if;
  if new.accion = 'entrega' and a.estado in ('mantencion','fuera_de_servicio','baja') then
    raise exception 'El baño % está en %, no se puede despachar', a.codigo, replace(a.estado::text, '_', ' ');
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_validar_bano_despacho on despacho_banos;
create trigger trg_validar_bano_despacho before insert on despacho_banos
for each row execute function validar_bano_despacho();

-- Vehículo en mantención no se puede asignar a rutas ni despachos
create or replace function validar_vehiculo() returns trigger as $$
declare a activos;
begin
  if new.vehiculo_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.vehiculo_id is not distinct from old.vehiculo_id then return new; end if;
  select * into a from activos where id = new.vehiculo_id;
  if a.estado in ('mantencion','fuera_de_servicio','baja') then
    raise exception 'El vehículo % está en %, no se puede asignar', a.codigo, replace(a.estado::text, '_', ' ');
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists trg_vehiculo_despacho on despachos;
create trigger trg_vehiculo_despacho before insert or update on despachos
for each row execute function validar_vehiculo();
drop trigger if exists trg_vehiculo_salida on salidas;
create trigger trg_vehiculo_salida before insert or update on salidas
for each row execute function validar_vehiculo();
drop trigger if exists trg_vehiculo_ruta on rutas;
create trigger trg_vehiculo_ruta before insert or update on rutas
for each row execute function validar_vehiculo();

-- Despacho hecho → entrega: baño "En arriendo" en el cliente · retiro: "Disponible" en bodega
create or replace function cerrar_despacho() returns trigger as $$
declare u uuid; b uuid; vc text; r record;
begin
  if not (new.estado = 'hecho' and old.estado <> 'hecho') then return new; end if;
  perform set_config('fosan.silencio', '1', true);

  select id into u from ubicaciones where cliente_id = new.cliente_id and tipo = 'cliente' order by creado_en limit 1;
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
      update activos set estado = 'en_arriendo', cliente_id = new.cliente_id, ubicacion_id = u where id = r.activo_id;
      insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
      values (r.activo_id, 'instalacion', r.desde, u, new.cliente_id,
              'Despacho ' || new.folio || coalesce(' · vehículo ' || vc, ''));
    else
      update activos set estado = 'disponible', cliente_id = null, ubicacion_id = coalesce(b, ubicacion_id) where id = r.activo_id;
      insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
      values (r.activo_id, 'retiro', r.desde, b, new.cliente_id,
              'Retiro ' || new.folio || coalesce(' · vehículo ' || vc, ''));
    end if;
  end loop;

  perform set_config('fosan.silencio', '0', true);
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_cerrar_despacho on despachos;
create trigger trg_cerrar_despacho after update on despachos
for each row execute function cerrar_despacho();

-- Parada de limpieza hecha → descuenta la receta de insumos y deja rastro en cada baño
create or replace function parada_hecha() returns trigger as $$
declare signo int; r record; ruta text;
begin
  if new.hecha is not distinct from old.hecha or new.tarea <> 'limpieza' then return new; end if;
  signo := case when new.hecha then -1 else 1 end;
  select rt.nombre into ruta from salidas s join rutas rt on rt.id = s.ruta_id where s.id = new.salida_id;

  for r in select insumo_id, cantidad from receta_limpieza loop
    update insumos set stock_actual = stock_actual + signo * r.cantidad * new.banos where id = r.insumo_id;
    insert into movimientos_insumo (insumo_id, cantidad, motivo)
    values (r.insumo_id, signo * r.cantidad * new.banos,
            case when new.hecha then 'Limpieza' else 'Limpieza desmarcada' end || ' · ' || coalesce(ruta, 'ruta'));
  end loop;

  if new.hecha then
    insert into movimientos_activo (activo_id, tipo, cliente_id, hacia_id, detalle)
    select a.id, 'limpieza', new.cliente_id, a.ubicacion_id, 'Limpieza · ' || coalesce(ruta, 'ruta')
      from activos a where a.cliente_id = new.cliente_id and a.estado = 'en_arriendo';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_parada_hecha on salida_paradas;
create trigger trg_parada_hecha after update on salida_paradas
for each row execute function parada_hecha();

-- Salida cerrada con odómetro → actualiza el kilometraje del vehículo
create or replace function cerrar_salida() returns trigger as $$
begin
  if new.odometro_llegada is not null and new.vehiculo_id is not null
     and new.odometro_llegada is distinct from old.odometro_llegada then
    update vehiculos set kilometraje = greatest(coalesce(kilometraje, 0), new.odometro_llegada)
     where activo_id = new.vehiculo_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists trg_cerrar_salida on salidas;
create trigger trg_cerrar_salida after update on salidas
for each row execute function cerrar_salida();

-- ───────────── 8. Funciones que llama la app ───────────────────────────────
-- Contrato vencido → retiro pendiente de sus baños + aviso
create or replace function procesar_vencidos() returns integer as $$
declare c record; d uuid; n integer := 0;
begin
  for c in select cl.id, cl.nombre, cl.direccion from clientes cl
            where cl.fecha_fin_contrato < current_date
              and exists (select 1 from activos a where a.cliente_id = cl.id and a.estado = 'en_arriendo')
              and not exists (select 1 from despachos x where x.cliente_id = cl.id
                              and x.tipo = 'retiro' and x.estado = 'programado') loop
    insert into despachos (tipo, cliente_id, direccion, fecha_programada, origen, observaciones)
    values ('retiro', c.id, c.direccion, current_date, 'vencimiento', 'Contrato vencido')
    returning id into d;
    insert into despacho_banos (despacho_id, activo_id, accion)
    select d, a.id, 'retiro' from activos a where a.cliente_id = c.id and a.estado = 'en_arriendo';
    insert into notificaciones (texto, nivel)
    values ('Contrato vencido: ' || c.nombre || '. Se programó el retiro de sus baños.', 'aviso');
    n := n + 1;
  end loop;
  return n;
end;
$$ language plpgsql security definer set search_path = public;

-- Crea las salidas de los próximos días según los días de cada ruta
create or replace function generar_salidas(dias integer default 14) returns integer as $$
declare r record; f date; s uuid; km numeric; v uuid; n integer := 0;
begin
  for r in select * from rutas where activa loop
    for f in select generate_series(current_date, current_date + dias, interval '1 day')::date loop
      if extract(isodow from f)::smallint = any (r.dias)
         and not exists (select 1 from salidas where ruta_id = r.id and fecha = f) then
        select round(avg(km_real), 1) into km from salidas where ruta_id = r.id and km_real is not null;
        select case when estado in ('mantencion','fuera_de_servicio','baja') then null else id end
          into v from activos where id = r.vehiculo_id;
        insert into salidas (ruta_id, fecha, vehiculo_id, km_estimado) values (r.id, f, v, km)
        returning id into s;
        insert into salida_paradas (salida_id, cliente_id, orden, tarea, banos)
        select s, p.cliente_id, p.orden, p.tarea,
               (select count(*) from activos a where a.cliente_id = p.cliente_id and a.estado = 'en_arriendo')
          from ruta_paradas p join clientes c on c.id = p.cliente_id
         where p.ruta_id = r.id and (c.fecha_fin_contrato is null or c.fecha_fin_contrato >= f);
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end;
$$ language plpgsql security definer set search_path = public;

-- Eliminar cliente: bloqueado si todavía tiene baños
create or replace function eliminar_cliente(p_id uuid) returns void as $$
declare n integer;
begin
  if not es_dueno() then raise exception 'Solo los dueños pueden eliminar clientes'; end if;
  select count(*) into n from activos where cliente_id = p_id and estado = 'en_arriendo';
  if n > 0 then
    raise exception 'Este cliente tiene % baño(s) asignado(s). Primero registra y completa su retiro en Despachos.', n;
  end if;
  update ubicaciones set activa = false, cliente_id = null where cliente_id = p_id;
  delete from servicios where cliente_id = p_id;
  delete from clientes where id = p_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ───────────── 9. Permisos (mismo esquema: todos leen, dueños escriben) ────
do $$
declare t text;
begin
  foreach t in array array[
    'rubros','parametros','receta_limpieza','movimientos_insumo','rutas','ruta_paradas',
    'salidas','salida_paradas','despachos','despacho_banos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_lectura', t);
    execute format('drop policy if exists %I on %I', t || '_escritura', t);
    execute format('create policy %I on %I for select using (tiene_acceso())', t || '_lectura', t);
    execute format('create policy %I on %I for all using (es_dueno()) with check (es_dueno())', t || '_escritura', t);
  end loop;
end $$;
