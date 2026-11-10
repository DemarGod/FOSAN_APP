-- 31 · ESTANDARIZACIÓN · ETAPA 4 · Paquete 8b: Operaciones → Respaldos y ejecución confirmada
-- Solo agrega. No borra operaciones, archivos ni movimientos.
--   A. Respaldos de cada operación: archivos subidos (fotos, guías) y firma de recepción. No se borran.
--   B. Datos de la ejecución: quién la confirmó, quién recibió en terreno y observaciones.
--   C. confirmar_operacion(): confirma una operación que NO está en una ruta (las de ruta se confirman en Mi ruta).
--      Al confirmarse, la base mueve los baños como siempre (cerrar_despacho).
--   D. Subir respaldos al almacenamiento: cualquier usuario con acceso, solo en la carpeta respaldos/, sin borrar.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
select (select count(*) from storage.buckets where id = 'fosan')                       as bucket_fosan,
       (select count(*) from despachos where estado = 'hecho')                         as realizadas,
       (select count(*) from pg_policies where tablename = 'objects' and policyname like 'fosan%') as politicas_storage;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
create table if not exists operacion_respaldos (
  id          uuid primary key default gen_random_uuid(),
  despacho_id uuid not null references despachos(id),
  tipo        text not null check (tipo in ('archivo', 'firma')),
  ruta        text not null,              -- ruta en el almacenamiento (bucket fosan, carpeta respaldos/)
  nombre      text,                       -- nombre del archivo
  firmante    text,                       -- firma: nombre de quien recibe
  creado_por  uuid default auth.uid(),
  creado_en   timestamptz not null default now()
);
create index if not exists operacion_respaldos_desp on operacion_respaldos (despacho_id);
alter table operacion_respaldos enable row level security;
drop policy if exists operacion_respaldos_ver on operacion_respaldos;
drop policy if exists operacion_respaldos_subir on operacion_respaldos;
create policy operacion_respaldos_ver on operacion_respaldos for select using (tiene_acceso());
create policy operacion_respaldos_subir on operacion_respaldos for insert with check (tiene_acceso() and creado_por = auth.uid());
-- (sin políticas de modificar ni borrar: los respaldos no se editan ni se eliminan)
drop trigger if exists auditoria_operacion_respaldos on operacion_respaldos;
create trigger auditoria_operacion_respaldos after insert or update or delete on operacion_respaldos
for each row execute function registrar_auditoria();

alter table despachos add column if not exists ejecutado_por uuid;
alter table despachos add column if not exists recibido_por text;
alter table despachos add column if not exists resultado text;

-- Almacenamiento: subir respaldos (no borrar)
drop policy if exists fosan_respaldos_subir on storage.objects;
create policy fosan_respaldos_subir on storage.objects for insert
  with check (bucket_id = 'fosan' and name like 'respaldos/%' and tiene_acceso());

-- C. Confirmar ejecución de una operación sin ruta
create or replace function confirmar_operacion(p_id uuid, p_fecha timestamptz, p_recibido_por text default null, p_resultado text default null)
returns void as $$
declare d record; n integer;
begin
  if not (es_dueno() or permiso_seccion('rutas', 'editar')) then raise exception 'No tienes permiso para confirmar operaciones.'; end if;
  select * into d from despachos where id = p_id for update;
  if d is null then raise exception 'La operación no existe.'; end if;
  if d.estado <> 'programado' then raise exception 'Solo se confirman operaciones programadas.'; end if;
  if d.salida_id is not null or exists (select 1 from rutas_semana_lineas where despacho_id = p_id) then
    raise exception 'Esta operación está en una ruta: se confirma desde Mi ruta.';
  end if;
  if p_fecha > now() + interval '5 minutes' then raise exception 'La fecha de ejecución no puede ser futura.'; end if;
  if p_fecha::date < d.fecha_programada - 30 then raise exception 'La fecha de ejecución es muy anterior a la programada.'; end if;
  update despachos set estado = 'hecho', fecha_realizada = p_fecha, ejecutado_por = auth.uid(),
         recibido_por = nullif(trim(p_recibido_por), ''), resultado = nullif(trim(p_resultado), '')
   where id = p_id;   -- cerrar_despacho mueve los baños
end;
$$ language plpgsql security definer set search_path = public;


-- ══ PASO 3 · Vista de operaciones con respaldos (seleccionar hasta el PASO 4) ══
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
            else 'programada' end as estado_op,
       -- nuevas al final (la vista conserva las columnas anteriores)
       d.recibido_por, d.resultado, pe.nombre as ejecutado_por,
       (select count(*) from operacion_respaldos r where r.despacho_id = d.id and r.tipo = 'archivo') as archivos,
       (select count(*) from operacion_respaldos r where r.despacho_id = d.id and r.tipo = 'firma') as firmas,
       (d.salida_id is not null or exists (select 1 from rutas_semana_lineas l where l.despacho_id = d.id)) as en_ruta,
       c.direccion as direccion_cliente
  from despachos d
  join clientes c on c.id = d.cliente_id
  left join ubicaciones u on u.id = d.ubicacion_id
  left join servicios_cliente s on s.id = d.servicio_id
  left join activos va on va.id = d.vehiculo_id
  left join vehiculos ve on ve.activo_id = d.vehiculo_id
  left join personal p on p.id = d.responsable_id
  left join perfiles pe on pe.id = d.ejecutado_por
  left join salidas sa on sa.id = d.salida_id
  left join rutas_semana rs on rs.id = sa.ruta_semana_id;
grant select on v_operaciones to authenticated;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: tabla_respaldos = 1, politica_subir = 1, funcion = 1, columnas_vista = 35.
select (select count(*) from information_schema.tables where table_name = 'operacion_respaldos') as tabla_respaldos,
       (select count(*) from pg_policies where policyname = 'fosan_respaldos_subir')             as politica_subir,
       (select count(*) from pg_proc where proname = 'confirmar_operacion')                      as funcion,
       (select count(*) from information_schema.columns where table_name = 'v_operaciones')      as columnas_vista;
