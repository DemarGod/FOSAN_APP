-- 27 · ESTANDARIZACIÓN · ETAPA 3 · Paquete 7b: Ficha del equipo
-- Solo agrega. No borra equipos ni movimientos.
--   A. Datos de la baja en el equipo: fecha, motivo y observaciones.
--   B. mover_equipo(): movimiento interno (traslado, envío o retorno de taller, ajuste) con fecha,
--      responsable y motivo, que queda en Movimientos. No cierra arriendos.
--   C. dar_de_baja(): solo sin reservas, asignaciones ni órdenes abiertas; conserva el historial.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Esperado: talleres puede ser 0 (se crean en Administración → Catálogos → Ubicaciones internas).
select (select count(*) from ubicaciones where tipo = 'taller' and activa)  as talleres,
       (select count(*) from ubicaciones where tipo = 'bodega' and activa)  as bodegas,
       (select count(*) from personal where activo)                         as personas_activas,
       (select count(*) from activos where situacion = 'baja')              as dados_de_baja;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
alter table activos add column if not exists fecha_baja date;
alter table activos add column if not exists motivo_baja text;
alter table activos add column if not exists observacion_baja text;

-- B. Movimiento interno de un equipo de la empresa
--    p_tipo: traslado | envio_taller | retorno_taller | ajuste
create or replace function mover_equipo(
  p_activo uuid, p_tipo text, p_destino uuid, p_fecha timestamptz,
  p_responsable uuid default null, p_responsable_nombre text default null, p_motivo text default null
) returns void as $$
declare a record; d record; v_detalle text;
begin
  if not permiso_seccion('banos', 'editar') then raise exception 'No tienes permiso para mover equipos.'; end if;
  if p_tipo = 'ajuste' and not es_dueno() then raise exception 'El ajuste de ubicación solo lo autoriza el dueño.'; end if;
  select * into a from activos where id = p_activo for update;
  if a is null then raise exception 'El equipo no existe.'; end if;
  if a.propiedad <> 'empresa' then raise exception 'Los equipos del cliente no se mueven desde aquí.'; end if;
  if a.situacion = 'baja' then raise exception 'El equipo está dado de baja.'; end if;
  if a.situacion in ('asignado', 'reservado') then
    raise exception 'El equipo está % a un cliente: no se mueve desde aquí (los arriendos se cierran en Operaciones).',
      case a.situacion when 'asignado' then 'asignado' else 'reservado' end;
  end if;
  select * into d from ubicaciones where id = p_destino and activa;
  if d is null or d.tipo::text not in ('bodega', 'taller') then raise exception 'Elige una bodega o taller activo como destino.'; end if;
  if p_destino = a.ubicacion_id then raise exception 'El destino es igual al origen.'; end if;
  if p_tipo = 'envio_taller' and d.tipo::text <> 'taller' then raise exception 'El envío a taller debe tener un taller como destino.'; end if;
  if p_tipo = 'retorno_taller' and d.tipo::text <> 'bodega' then raise exception 'El retorno de taller debe ir a una bodega.'; end if;
  if p_fecha > now() + interval '5 minutes' then raise exception 'La fecha del movimiento no puede ser futura.'; end if;

  -- Sin registro automático: este movimiento deja uno solo, con fecha, tipo, responsable y motivo
  perform set_config('fosan.silencio', '1', true);
  update activos set
    ubicacion_id = p_destino,
    estado = case p_tipo when 'envio_taller' then 'mantencion'::estado_activo
                         when 'retorno_taller' then 'disponible'::estado_activo else estado end,
    condicion = case when p_tipo = 'retorno_taller' then 'operativo' else condicion end
  where id = p_activo;

  perform set_config('fosan.silencio', '', true);

  v_detalle := case p_tipo when 'traslado' then 'Traslado interno' when 'envio_taller' then 'Envío a taller'
                           when 'retorno_taller' then 'Retorno de taller' else 'Ajuste autorizado' end
            || coalesce(' · Responsable: ' || nullif(trim(p_responsable_nombre), ''), '')
            || coalesce(' · ' || nullif(trim(p_motivo), ''), '');
  insert into movimientos_activo (activo_id, fecha, tipo, desde_id, hacia_id, responsable_id, detalle)
  values (p_activo, p_fecha, p_tipo, a.ubicacion_id, p_destino, p_responsable, v_detalle);
end;
$$ language plpgsql security definer set search_path = public;

-- C. Dar de baja (venta, donación, pérdida definitiva u otro)
create or replace function dar_de_baja(p_activo uuid, p_fecha date, p_motivo text, p_observaciones text default null)
returns void as $$
declare a record; n integer;
begin
  if not permiso_seccion('banos', 'editar') then raise exception 'No tienes permiso para dar de baja equipos.'; end if;
  if p_motivo not in ('venta', 'donacion', 'perdida', 'otro') then raise exception 'Motivo inválido.'; end if;
  if p_fecha is null or p_fecha > current_date then raise exception 'La fecha no puede ser futura.'; end if;
  if p_motivo = 'otro' and coalesce(length(trim(p_observaciones)), 0) < 3 then raise exception 'Explica el motivo en Observaciones.'; end if;
  select * into a from activos where id = p_activo for update;
  if a is null then raise exception 'El equipo no existe.'; end if;
  if a.situacion = 'baja' then raise exception 'El equipo ya está dado de baja.'; end if;
  if a.situacion in ('asignado', 'reservado') then raise exception 'El equipo está %: primero debe volver a bodega.', a.situacion; end if;
  select count(*) into n from despacho_banos db join despachos d on d.id = db.despacho_id
   where db.activo_id = p_activo and d.estado = 'programado';
  if n > 0 then raise exception 'El equipo está en % despacho(s) programado(s): resuélvelos primero.', n; end if;
  select count(*) into n from mantenciones where activo_id = p_activo and estado in ('programada', 'proxima', 'urgente');
  if n > 0 then raise exception 'El equipo tiene % mantención(es) abierta(s): complétalas o anúlalas primero.', n; end if;

  perform set_config('fosan.silencio', '1', true);
  update activos set
    estado = case p_motivo when 'venta' then 'vendido'::estado_activo when 'donacion' then 'donacion'::estado_activo else 'baja'::estado_activo end,
    habilitado = false, fecha_baja = p_fecha, motivo_baja = p_motivo, observacion_baja = nullif(trim(p_observaciones), '')
  where id = p_activo;
  perform set_config('fosan.silencio', '', true);
  insert into movimientos_activo (activo_id, fecha, tipo, desde_id, responsable_id, detalle)
  values (p_activo, p_fecha::timestamptz, 'baja', a.ubicacion_id, auth.uid(),
          'Dado de baja: ' || case p_motivo when 'venta' then 'venta' when 'donacion' then 'donación'
                                            when 'perdida' then 'pérdida definitiva' else 'otro' end
          || coalesce(' · ' || nullif(trim(p_observaciones), ''), ''));
end;
$$ language plpgsql security definer set search_path = public;


-- ══ PASO 3 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: columnas_baja = 3, funciones = 2.
select (select count(*) from information_schema.columns where table_name = 'activos'
          and column_name in ('fecha_baja','motivo_baja','observacion_baja'))                       as columnas_baja,
       (select count(distinct proname) from pg_proc where proname in ('mover_equipo','dar_de_baja')) as funciones;
