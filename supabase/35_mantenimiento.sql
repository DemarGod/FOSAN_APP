-- 35 · ESTANDARIZACIÓN · ETAPA 5 · Paquete 10: Mantenimiento (lámina 6)
-- Solo agrega. No cambia las funciones de Cata (cerrar_mantencion, limites_secretaria, mantención desde la ruta).
--   A. Folio MANT-### y datos del trabajo: trabajo requerido, observaciones, "no disponible desde ahora".
--   B. "En curso" = mantención abierta con trabajo iniciado (iniciada_en). No se agrega un estado nuevo:
--      así cerrar_mantencion y la mantención reportada en ruta siguen funcionando igual.
--   C. Resultado: Finalizado (completa) o Requiere seguimiento (sigue En curso); condición al finalizar.
--   D. Cancelar con motivo (estado anulada). Si no le quedan otras abiertas, el activo vuelve a su estado de trabajo.
--   E. Vista v_mantenimiento para Pendientes e Historial.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
select (select count(*) from mantenciones)                                               as mantenciones,
       (select count(*) from mantenciones where estado in ('programada','proxima','urgente')) as abiertas,
       (select count(*) from mantenciones where estado = 'completada')                    as completadas,
       (select count(*) from mantenciones where estado = 'anulada')                       as anuladas;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
-- A. Folio y datos del trabajo
create sequence if not exists mantencion_folio_seq;
alter table mantenciones add column if not exists folio text;
with o as (select id, row_number() over (order by creado_en, id) n from mantenciones where folio is null)
update mantenciones m set folio = 'MANT-' || lpad(o.n::text, 3, '0') from o where o.id = m.id;
select setval('mantencion_folio_seq', greatest((select count(*) from mantenciones), 1));
alter table mantenciones alter column folio set default ('MANT-' || lpad(nextval('mantencion_folio_seq')::text, 3, '0'));
create unique index if not exists mantenciones_folio on mantenciones (folio);

alter table mantenciones add column if not exists trabajo_requerido  text;
alter table mantenciones add column if not exists observaciones      text;
alter table mantenciones add column if not exists bloquea            boolean not null default false;
-- B y C. Trabajo y resultado
alter table mantenciones add column if not exists iniciada_en        timestamptz;
alter table mantenciones add column if not exists resultado          text;
alter table mantenciones add column if not exists trabajo_realizado  text;
alter table mantenciones add column if not exists condicion_final    text;
alter table mantenciones add column if not exists registrado_por     uuid;
-- D. Cancelación
alter table mantenciones add column if not exists motivo_cancelacion text;
alter table mantenciones add column if not exists cancelado_en       timestamptz;
alter table mantenciones add column if not exists cancelado_por      uuid;

-- Permiso común
create or replace function puede_mantener() returns boolean as $$
  select es_dueno() or permiso_seccion('mantenciones', 'editar')
$$ language sql stable security definer set search_path = public;

-- Programar (6.2). Programar no completa el trabajo.
create or replace function programar_mantencion(p_activo uuid, p_tipo text, p_fecha date, p_responsable text,
  p_trabajo text, p_obs text default null, p_bloquea boolean default false) returns uuid as $$
declare a record; nid uuid;
begin
  if not puede_mantener() then raise exception 'No tienes permiso para programar mantenimientos.'; end if;
  select * into a from activos where id = p_activo;
  if a.id is null then raise exception 'El equipo o vehículo no existe.'; end if;
  if a.estado = 'baja' then raise exception 'Está dado de baja.'; end if;
  if coalesce(trim(p_tipo), '') = '' then raise exception 'Indica el tipo.'; end if;
  if p_fecha is null then raise exception 'Indica la fecha programada.'; end if;
  if coalesce(trim(p_responsable), '') = '' then raise exception 'Indica el responsable o taller.'; end if;
  if coalesce(length(trim(p_trabajo)), 0) < 3 then raise exception 'Describe el trabajo requerido.'; end if;
  if p_bloquea and a.tipo in ('camion', 'camioneta') and vehiculo_en_ruta(a.id) then
    raise exception 'El vehículo está en ruta hoy: no se puede dejar no disponible ahora.'; end if;
  insert into mantenciones (activo_id, tipo, fecha_programada, responsable_ext, trabajo_requerido, observaciones, bloquea, estado, detalle)
  values (p_activo, trim(p_tipo), p_fecha, trim(p_responsable), trim(p_trabajo), nullif(trim(p_obs), ''), coalesce(p_bloquea, false),
          'programada', trim(p_trabajo))
  returning id into nid;
  if p_bloquea and a.estado not in ('mantencion', 'fuera_de_servicio') then
    update activos set estado = 'mantencion' where id = p_activo;
  end if;
  return nid;
end;
$$ language plpgsql security definer set search_path = public;

-- Editar programación: solo mientras esté Programado (sin iniciar)
create or replace function editar_mantencion(p_id uuid, p_tipo text, p_fecha date, p_responsable text, p_trabajo text, p_obs text)
returns void as $$
declare m record;
begin
  if not puede_mantener() then raise exception 'No tienes permiso.'; end if;
  select * into m from mantenciones where id = p_id for update;
  if m.id is null then raise exception 'El mantenimiento no existe.'; end if;
  if m.estado not in ('programada', 'proxima', 'urgente') or m.iniciada_en is not null then
    raise exception 'Solo se edita la programación mientras está Programado.'; end if;
  if coalesce(trim(p_tipo), '') = '' or p_fecha is null or coalesce(trim(p_responsable), '') = '' or coalesce(length(trim(p_trabajo)), 0) < 3 then
    raise exception 'Completa tipo, fecha, responsable y trabajo requerido.'; end if;
  update mantenciones set tipo = trim(p_tipo), fecha_programada = p_fecha, responsable_ext = trim(p_responsable),
         trabajo_requerido = trim(p_trabajo), detalle = trim(p_trabajo), observaciones = nullif(trim(p_obs), '')
   where id = p_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Iniciar trabajo (6.3): solo si está Programado. El activo queda no disponible mientras dura.
create or replace function iniciar_mantencion(p_id uuid) returns void as $$
declare m record; a record;
begin
  if not puede_mantener() then raise exception 'No tienes permiso.'; end if;
  select * into m from mantenciones where id = p_id for update;
  if m.id is null then raise exception 'El mantenimiento no existe.'; end if;
  if m.estado not in ('programada', 'proxima', 'urgente') or m.iniciada_en is not null then
    raise exception 'Solo se inicia un mantenimiento Programado.'; end if;
  select * into a from activos where id = m.activo_id;
  if a.tipo in ('camion', 'camioneta') and vehiculo_en_ruta(a.id) then
    raise exception 'El vehículo está en ruta hoy: inicia el trabajo cuando cierre el día.'; end if;
  update mantenciones set iniciada_en = now() where id = p_id;
  if a.estado not in ('mantencion', 'fuera_de_servicio', 'baja') then
    update activos set estado = 'mantencion' where id = a.id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Registrar resultado (6.4). Finalizado → Completada (cerrar_mantencion de Cata devuelve el activo).
-- Requiere seguimiento → sigue En curso. Condición distinta de Operativo → el activo queda no disponible.
create or replace function registrar_resultado_mantencion(p_id uuid, p_fecha date, p_resultado text, p_trabajo text,
  p_condicion text, p_obs text default null, p_costo integer default null) returns void as $$
declare m record;
begin
  if not puede_mantener() then raise exception 'No tienes permiso.'; end if;
  select * into m from mantenciones where id = p_id for update;
  if m.id is null then raise exception 'El mantenimiento no existe.'; end if;
  if m.estado not in ('programada', 'proxima', 'urgente') then raise exception 'Este mantenimiento ya está cerrado.'; end if;
  if p_fecha is null or p_fecha > current_date then raise exception 'La fecha de realización no puede ser futura.'; end if;
  if p_resultado not in ('finalizado', 'requiere_seguimiento') then raise exception 'Indica el resultado.'; end if;
  if coalesce(length(trim(p_trabajo)), 0) < 3 then raise exception 'Describe el trabajo realizado.'; end if;
  if p_condicion not in ('operativo', 'requiere_limpieza', 'requiere_reparacion') then raise exception 'Indica la condición al finalizar.'; end if;

  update mantenciones set
         iniciada_en = coalesce(iniciada_en, now()),
         resultado = p_resultado,
         trabajo_realizado = trim(p_trabajo),
         condicion_final = p_condicion,
         observaciones = coalesce(nullif(trim(p_obs), ''), observaciones),
         registrado_por = auth.uid(),
         costo = coalesce(p_costo, costo)
   where id = p_id;

  if p_resultado = 'finalizado' then
    update mantenciones set estado = 'completada', fecha_realizada = p_fecha where id = p_id;   -- dispara cerrar_mantencion
    -- (al cambiar a "mantencion", la base marca la condición "requiere_reparacion")
    if p_condicion = 'requiere_reparacion' then
      update activos set estado = 'mantencion' where id = m.activo_id and estado <> 'baja';
    elsif p_condicion = 'requiere_limpieza' then
      update activos set condicion = 'requiere_limpieza' where id = m.activo_id;
    end if;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Cancelar con motivo (no se borra)
create or replace function cancelar_mantencion(p_id uuid, p_motivo text) returns void as $$
declare m record;
begin
  if not puede_mantener() then raise exception 'No tienes permiso.'; end if;
  select * into m from mantenciones where id = p_id for update;
  if m.id is null then raise exception 'El mantenimiento no existe.'; end if;
  if m.estado not in ('programada', 'proxima', 'urgente') then raise exception 'Este mantenimiento ya está cerrado.'; end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then raise exception 'Indica el motivo.'; end if;
  update mantenciones set estado = 'anulada', motivo_cancelacion = trim(p_motivo), cancelado_en = now(), cancelado_por = auth.uid()
   where id = p_id;
  -- Si no le quedan otras abiertas, el activo vuelve a su estado de trabajo (igual que al completar)
  if not exists (select 1 from mantenciones x where x.activo_id = m.activo_id and x.id <> p_id
                  and x.estado in ('programada', 'proxima', 'urgente')) then
    update activos set estado = case
             when tipo::text in ('camion', 'camioneta') then 'en_servicio'::estado_activo
             when cliente_id is not null then 'en_arriendo'::estado_activo
             else 'disponible'::estado_activo end
                 , condicion = 'operativo'
     where id = m.activo_id and estado = 'mantencion';
  end if;
end;
$$ language plpgsql security definer set search_path = public;


-- ══ PASO 3 · Vista (seleccionar hasta el PASO 4) ═════════════════════════════════
create or replace view v_mantenimiento with (security_invoker = on) as
select m.id, m.folio, m.activo_id, a.codigo, a.tipo::text as activo_tipo, a.qr_token,
       case when a.tipo in ('camion', 'camioneta') then 'vehiculo' else 'equipo' end as clase,
       v.patente,
       case when a.tipo in ('camion', 'camioneta') then coalesce(v.patente, a.codigo) else 'Unidad ' || a.codigo end as identificacion,
       m.tipo, m.fecha_programada, m.fecha_realizada, m.iniciada_en,
       coalesce(p.nombre, m.responsable_ext) as responsable,
       coalesce(m.trabajo_requerido, m.detalle) as trabajo_requerido, m.observaciones, m.bloquea,
       m.resultado, m.trabajo_realizado, m.condicion_final, m.costo,
       m.motivo_cancelacion, m.cancelado_en,
       case when m.estado = 'anulada' then 'cancelado'
            when m.estado = 'completada' then 'completado'
            when m.iniciada_en is not null then 'en_curso'
            else 'programado' end as estado_m,
       (m.estado in ('programada', 'proxima', 'urgente') and m.fecha_programada < current_date) as vencido,
       m.creado_en
  from mantenciones m
  join activos a on a.id = m.activo_id
  left join vehiculos v on v.activo_id = a.id
  left join perfiles p on p.id = m.responsable_id;
grant select on v_mantenimiento to authenticated;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: en_vista = mantenciones del PASO 1; sin_folio = 0; funciones = 6.
select (select count(*) from v_mantenimiento)                       as en_vista,
       (select count(*) from mantenciones where folio is null)       as sin_folio,
       (select count(*) from pg_proc where proname in ('puede_mantener', 'programar_mantencion', 'editar_mantencion',
          'iniciar_mantencion', 'registrar_resultado_mantencion', 'cancelar_mantencion')) as funciones;
