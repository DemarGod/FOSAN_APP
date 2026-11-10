-- 33 · ESTANDARIZACIÓN · ETAPA 5 · Paquete 9: Flota (lámina 5)
-- Solo agrega. No borra vehículos, rutas ni costos.
--   A. Patente normalizada (mayúsculas, sin guiones ni espacios) y única.
--   B. Datos de registro: fecha de registro y observaciones.
--   C. Cambiar disponibilidad con fecha y motivo (queda historial). "En ruta" se calcula: no se marca a mano.
--   D. Desactivar vehículo con motivo (no se borra). Se bloquea si tiene rutas, operaciones o insumos a bordo.
--   E. Cada vehículo es también una ubicación de insumos (ej. CAM-03), creada y mantenida automáticamente.
--   F. Vista v_flota para el listado.
-- Correr PASO POR PASO en Supabase → SQL Editor. El PASO 2 va SOLO.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Esperado: patentes_duplicadas = 0. Si no es 0, avísame antes de seguir.
select (select count(*) from vehiculos)                                                     as vehiculos,
       (select count(*) from vehiculos where coalesce(trim(patente), '') = '')               as sin_patente,
       (select count(*) from (select upper(regexp_replace(patente, '[^A-Za-z0-9]', '', 'g')) p from vehiculos
          where coalesce(trim(patente), '') <> '' group by 1 having count(*) > 1) x)         as patentes_duplicadas,
       (select string_agg(distinct a.estado::text, ', ') from vehiculos v join activos a on a.id = v.activo_id) as estados;


-- ══ PASO 2 · Nuevo tipo de ubicación (seleccionar SOLO esta línea y Run) ═════════
alter type tipo_ubicacion add value if not exists 'vehiculo';


-- ══ PASO 3 · Cambios (seleccionar hasta el PASO 4) ═════════════════════════════
-- A y B. Patente y datos de registro
alter table vehiculos add column if not exists fecha_registro date default current_date;
alter table vehiculos add column if not exists observaciones text;

create or replace function normalizar_patente(t text) returns text as $$
  select nullif(upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g')), '')
$$ language sql immutable;

create or replace function preparar_vehiculo() returns trigger as $$
begin
  new.patente := normalizar_patente(new.patente);
  if new.kilometraje is not null and new.kilometraje < 0 then raise exception 'El odómetro no puede ser negativo.'; end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists t_preparar_vehiculo on vehiculos;
create trigger t_preparar_vehiculo before insert or update on vehiculos for each row execute function preparar_vehiculo();
update vehiculos set patente = normalizar_patente(patente) where patente is distinct from normalizar_patente(patente);

-- C. Historial de disponibilidad
create table if not exists vehiculo_disponibilidad (
  id         bigserial primary key,
  activo_id  uuid not null references activos(id),
  estado     text not null,
  fecha      date not null,
  motivo     text not null,
  creado_por uuid default auth.uid(),
  creado_en  timestamptz not null default now()
);
create index if not exists vehiculo_disponibilidad_activo on vehiculo_disponibilidad (activo_id, creado_en desc);
alter table vehiculo_disponibilidad enable row level security;
drop policy if exists vehiculo_disponibilidad_ver on vehiculo_disponibilidad;
create policy vehiculo_disponibilidad_ver on vehiculo_disponibilidad for select using (tiene_acceso());
-- (sin políticas de escritura: solo se registra con las funciones de abajo)
drop trigger if exists auditoria_vehiculo_disponibilidad on vehiculo_disponibilidad;
create trigger auditoria_vehiculo_disponibilidad after insert or update or delete on vehiculo_disponibilidad
for each row execute function registrar_auditoria();

-- ¿Está en ruta ahora? (día iniciado con km y sin cerrar)
create or replace function vehiculo_en_ruta(p_id uuid) returns boolean as $$
  select exists (select 1 from salidas s where s.vehiculo_id = p_id and s.fecha = current_date
                  and s.odometro_salida is not null and s.estado = 'planificada')
$$ language sql stable security definer set search_path = public;

create or replace function cambiar_disponibilidad_vehiculo(p_id uuid, p_estado text, p_fecha date, p_motivo text)
returns void as $$
declare a record;
begin
  if not (es_dueno() or permiso_seccion('transporte', 'editar')) then raise exception 'No tienes permiso para cambiar la disponibilidad.'; end if;
  select * into a from activos where id = p_id and tipo in ('camion', 'camioneta') for update;
  if a.id is null then raise exception 'El vehículo no existe.'; end if;
  if a.estado = 'baja' then raise exception 'El vehículo está desactivado.'; end if;
  if p_estado not in ('disponible', 'mantencion', 'fuera_de_servicio') then raise exception 'Estado no válido.'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Indica el motivo.'; end if;
  if p_fecha is null or p_fecha > current_date then raise exception 'La fecha no puede ser futura.'; end if;
  if a.estado::text = p_estado then raise exception 'El vehículo ya está en ese estado.'; end if;
  if p_estado <> 'disponible' and vehiculo_en_ruta(p_id) then raise exception 'El vehículo está en ruta hoy: cierra el día antes de cambiarlo.'; end if;
  perform set_config('fosan.silencio', 'on', true);
  update activos set estado = p_estado::estado_activo where id = p_id;
  insert into vehiculo_disponibilidad (activo_id, estado, fecha, motivo) values (p_id, p_estado, p_fecha, trim(p_motivo));
end;
$$ language plpgsql security definer set search_path = public;

-- D. Desactivar (no se borra)
create or replace function desactivar_vehiculo(p_id uuid, p_motivo text) returns void as $$
declare a record; u uuid;
begin
  if not (es_dueno() or permiso_seccion('transporte', 'editar')) then raise exception 'No tienes permiso para desactivar vehículos.'; end if;
  select * into a from activos where id = p_id and tipo in ('camion', 'camioneta') for update;
  if a.id is null then raise exception 'El vehículo no existe.'; end if;
  if a.estado = 'baja' then raise exception 'El vehículo ya está desactivado.'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Indica el motivo.'; end if;
  if vehiculo_en_ruta(p_id) then raise exception 'El vehículo está en ruta hoy.'; end if;
  if exists (select 1 from rutas_semana where vehiculo_id = p_id and lunes >= date_trunc('week', current_date)::date) then
    raise exception 'Tiene rutas asignadas esta semana o en las próximas: cámbiales el vehículo primero.'; end if;
  if exists (select 1 from despachos where vehiculo_id = p_id and estado = 'programado') then
    raise exception 'Tiene operaciones programadas: cámbiales la patente primero.'; end if;
  select id into u from ubicaciones where vehiculo_id = p_id;
  if u is not null and exists (select 1 from insumo_existencias where ubicacion_id = u and cantidad > 0) then
    raise exception 'Tiene insumos a bordo: trasládalos a bodega primero.'; end if;
  perform set_config('fosan.silencio', 'on', true);
  update activos set estado = 'baja', fecha_baja = current_date, motivo_baja = trim(p_motivo) where id = p_id;
  insert into vehiculo_disponibilidad (activo_id, estado, fecha, motivo) values (p_id, 'baja', current_date, trim(p_motivo));
end;
$$ language plpgsql security definer set search_path = public;

-- E. Cada vehículo es una ubicación de insumos
alter table ubicaciones add column if not exists vehiculo_id uuid references activos(id);
create unique index if not exists ubicaciones_vehiculo on ubicaciones (vehiculo_id) where vehiculo_id is not null;

create or replace function sincronizar_ubicacion_vehiculo() returns trigger as $$
begin
  if new.tipo not in ('camion', 'camioneta') then return new; end if;
  if exists (select 1 from ubicaciones where vehiculo_id = new.id) then
    update ubicaciones set nombre = new.codigo, activa = (new.estado <> 'baja')
     where vehiculo_id = new.id and (nombre is distinct from new.codigo or activa is distinct from (new.estado <> 'baja'));
  else
    insert into ubicaciones (nombre, tipo, vehiculo_id, activa, descripcion)
    values (new.codigo, 'vehiculo', new.id, new.estado <> 'baja', 'Insumos a bordo del vehículo');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists t_ubicacion_vehiculo on activos;
create trigger t_ubicacion_vehiculo after insert or update of codigo, estado, tipo on activos
for each row execute function sincronizar_ubicacion_vehiculo();

insert into ubicaciones (nombre, tipo, vehiculo_id, activa, descripcion)
select a.codigo, 'vehiculo', a.id, a.estado <> 'baja', 'Insumos a bordo del vehículo'
  from activos a
 where a.tipo in ('camion', 'camioneta')
   and not exists (select 1 from ubicaciones u where u.vehiculo_id = a.id);


-- ══ PASO 4 · Vista del listado (seleccionar hasta el PASO 5) ═════════════════════
create or replace view v_flota with (security_invoker = on) as
select v.activo_id as id, a.codigo, v.patente, v.tipo_vehiculo, v.marca, v.modelo, v.anio, v.kilometraje,
       v.fecha_registro, v.observaciones, v.capacidad_kg, v.capacidad_banos, v.capacidad_litros,
       a.estado::text as estado_activo, a.qr_token, a.fecha_baja, a.motivo_baja,
       vehiculo_en_ruta(a.id) as en_ruta,
       case when a.estado = 'baja' then 'baja'
            when vehiculo_en_ruta(a.id) then 'en_ruta'
            when a.estado = 'mantencion' then 'mantenimiento'
            when a.estado = 'fuera_de_servicio' then 'fuera_servicio'
            else 'disponible' end as estado_flota,
       (select u.id from ubicaciones u where u.vehiculo_id = a.id) as ubicacion_insumos_id,
       (select d.motivo from vehiculo_disponibilidad d where d.activo_id = a.id order by d.creado_en desc limit 1) as ultimo_motivo
  from vehiculos v
  join activos a on a.id = v.activo_id;
grant select on v_flota to authenticated;


-- ══ PASO 5 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: vehiculos_en_vista = vehiculos del PASO 1; ubicaciones_vehiculo = ese mismo número;
--           funciones = 3; patentes_sin_normalizar = 0.
select (select count(*) from v_flota)                                                  as vehiculos_en_vista,
       (select count(*) from ubicaciones where tipo = 'vehiculo')                      as ubicaciones_vehiculo,
       (select count(*) from pg_proc where proname in ('cambiar_disponibilidad_vehiculo', 'desactivar_vehiculo', 'vehiculo_en_ruta')) as funciones,
       (select count(*) from vehiculos where patente is distinct from normalizar_patente(patente)) as patentes_sin_normalizar;
