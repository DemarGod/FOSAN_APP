-- 43 · ESTANDARIZACIÓN · Paquete 20: correcciones de las revisiones del equipo (1 a 13b).
--   A. Mantenimiento: todo equipo "En mantenimiento" tiene SIEMPRE una orden abierta en Mantenimiento.
--      Si queda en mantenimiento sin orden (ej. "Finalizado · Requiere reparación"), la orden se crea sola.
--      Se regularizan los equipos que hoy están en mantenimiento sin orden.
--   B. Operaciones: la fecha debe estar dentro del servicio (desde su inicio; hasta su término salvo retiros).
--   C. MAYÚSCULAS en nombres propios: clientes (ya estaba), ubicaciones, contactos y rutas semanales.
--   D. Documentos de vehículos y equipos: fecha de vencimiento, subir y quitar desde la app.
-- No borra nada. Correr PASO POR PASO en Supabase → SQL Editor. El PASO 2 va SOLO.


-- ══ PASO 1 · Revisión previa (solo lectura) · mandar captura ═════════════════════
select (select count(*) from activos a where a.estado = 'mantencion'
          and not exists (select 1 from mantenciones m where m.activo_id = a.id and m.estado in ('programada','proxima','urgente'))) as en_mantencion_sin_orden,
       (select count(*) from despachos d join servicios_cliente s on s.id = d.servicio_id
         where d.estado = 'programado' and d.fecha_programada < s.fecha_inicio)                                    as operaciones_antes_del_servicio,
       (select count(*) from ubicaciones where nombre <> upper(trim(nombre)))                                       as ubicaciones_a_mayusculas,
       (select count(*) from cliente_contactos where nombre <> upper(trim(nombre)))                                 as contactos_a_mayusculas,
       (select count(*) from rutas_semana where nombre <> upper(trim(nombre)))                                      as rutas_a_mayusculas,
       (select count(*) from information_schema.columns where table_name = 'documentos_activo' and column_name = 'fecha_vencimiento') as ya_tiene_vencimiento;


-- ══ PASO 2 · Tipo de documento nuevo (seleccionar SOLO esta línea y Run) ══════════
alter type tipo_documento add value if not exists 'permiso_circulacion';


-- ══ PASO 3 · Cambios (seleccionar hasta el PASO 4) ══════════════════════════════
begin;

-- A. Mantenimiento: orden abierta obligatoria ------------------------------------
create or replace function asegurar_orden_mantencion(p_activo uuid) returns uuid as $$
declare a record; ult record; nid uuid;
begin
  select * into a from activos where id = p_activo;
  if a.id is null or a.estado::text <> 'mantencion' then return null; end if;
  if exists (select 1 from mantenciones where activo_id = a.id and estado in ('programada','proxima','urgente')) then return null; end if;
  -- ¿Viene de un mantenimiento cerrado con "Requiere reparación"?
  select folio, condicion_final into ult from mantenciones
   where activo_id = a.id and estado = 'completada' order by coalesce(fecha_realizada, fecha_programada) desc, creado_en desc limit 1;
  insert into mantenciones (activo_id, clase, tipo, fecha_programada, responsable_ext, trabajo_requerido, detalle, observaciones, bloquea, estado)
  values (a.id,
          case a.tipo::text when 'bano_quimico' then 'bano' when 'camion' then 'camion' when 'camioneta' then 'camioneta' else 'equipo' end::clase_mantencion,
          'Mantención correctiva', current_date, 'Por asignar',
          case when ult.condicion_final = 'requiere_reparacion' then 'Reparación pendiente (seguimiento de ' || ult.folio || ')'
               else 'Equipo en mantenimiento sin orden: revisar y registrar el trabajo' end,
          case when ult.condicion_final = 'requiere_reparacion' then 'Reparación pendiente (seguimiento de ' || ult.folio || ')'
               else 'Equipo en mantenimiento sin orden: revisar y registrar el trabajo' end,
          'Creada automáticamente: todo equipo en mantenimiento debe tener su orden.', true, 'programada')
  returning id into nid;
  return nid;
end;
$$ language plpgsql security definer set search_path = public;

-- Se revisa al FINAL de cada operación (deferred), así no duplica la orden que crea la misma operación.
create or replace function t_asegurar_orden() returns trigger as $$
begin
  perform asegurar_orden_mantencion(new.id);
  return null;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists t_activo_en_mantencion on activos;
create constraint trigger t_activo_en_mantencion after insert or update of estado on activos
  deferrable initially deferred for each row when (new.estado::text = 'mantencion')
  execute function t_asegurar_orden();

-- Regularizar los que hoy están en mantenimiento sin orden
select asegurar_orden_mantencion(a.id) from activos a
 where a.estado = 'mantencion'
   and not exists (select 1 from mantenciones m where m.activo_id = a.id and m.estado in ('programada','proxima','urgente'));

-- B. Fecha de la operación dentro del servicio -------------------------------------
create or replace function validar_fecha_operacion() returns trigger as $$
declare s record;
begin
  if new.servicio_id is null or new.estado <> 'programado' then return new; end if;
  if tg_op = 'UPDATE' and new.fecha_programada is not distinct from old.fecha_programada
     and new.servicio_id is not distinct from old.servicio_id and new.tipo is not distinct from old.tipo then return new; end if;
  select codigo, fecha_inicio, fecha_termino, estado into s from servicios_cliente where id = new.servicio_id;
  if s.codigo is null then return new; end if;
  if new.fecha_programada < s.fecha_inicio then
    raise exception 'El servicio % empieza el %: programa la operación desde esa fecha.', s.codigo, to_char(s.fecha_inicio, 'DD/MM/YYYY');
  end if;
  if new.tipo <> 'retiro' and s.estado = 'finalizado' then
    raise exception 'El servicio % está finalizado: solo se puede programar el retiro de sus baños.', s.codigo;
  end if;
  if new.tipo <> 'retiro' and s.fecha_termino is not null and new.fecha_programada > s.fecha_termino then
    raise exception 'El servicio % termina el %: después de esa fecha solo se programa el retiro.', s.codigo, to_char(s.fecha_termino, 'DD/MM/YYYY');
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists t_validar_fecha_operacion on despachos;
create trigger t_validar_fecha_operacion before insert or update on despachos for each row execute function validar_fecha_operacion();

-- C. MAYÚSCULAS en nombres propios -------------------------------------------------
create or replace function nombre_mayusculas() returns trigger as $$
begin
  if new.nombre is not null then new.nombre := upper(trim(new.nombre)); end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists t_ubicacion_mayusculas on ubicaciones;
create trigger t_ubicacion_mayusculas before insert or update of nombre on ubicaciones for each row execute function nombre_mayusculas();
drop trigger if exists t_contacto_mayusculas on cliente_contactos;
create trigger t_contacto_mayusculas before insert or update of nombre on cliente_contactos for each row execute function nombre_mayusculas();
drop trigger if exists t_ruta_semana_mayusculas on rutas_semana;
create trigger t_ruta_semana_mayusculas before insert or update of nombre on rutas_semana for each row execute function nombre_mayusculas();
update ubicaciones       set nombre = upper(trim(nombre)) where nombre <> upper(trim(nombre));
update cliente_contactos set nombre = upper(trim(nombre)) where nombre <> upper(trim(nombre));
update rutas_semana      set nombre = upper(trim(nombre)) where nombre <> upper(trim(nombre));

-- D. Documentos con vencimiento -----------------------------------------------------
alter table documentos_activo add column if not exists fecha_vencimiento date;
alter table documentos_activo add column if not exists anulado boolean not null default false;

create or replace function registrar_documento(p_activo uuid, p_tipo text, p_titulo text, p_url text,
  p_vence date default null, p_kb integer default null) returns uuid as $$
declare a record; nid uuid;
begin
  select * into a from activos where id = p_activo;
  if a.id is null then raise exception 'El equipo o vehículo no existe.'; end if;
  if not (es_dueno()
          or (a.tipo::text in ('camion', 'camioneta') and permiso_seccion('transporte', 'editar'))
          or (a.tipo::text not in ('camion', 'camioneta') and permiso_seccion('banos', 'editar'))) then
    raise exception 'No tienes permiso para subir documentos.'; end if;
  if coalesce(length(trim(p_titulo)), 0) < 3 then raise exception 'Escribe el título del documento.'; end if;
  if coalesce(p_url, '') = '' then raise exception 'Falta el archivo.'; end if;
  insert into documentos_activo (activo_id, tipo, titulo, archivo_url, tamano_kb, subido_por, fecha_vencimiento)
  values (p_activo, coalesce(nullif(p_tipo, ''), 'otro')::tipo_documento, trim(p_titulo), p_url, p_kb, auth.uid(), p_vence)
  returning id into nid;
  return nid;
end;
$$ language plpgsql security definer set search_path = public;

-- Quitar un documento (queda en el historial; el archivo sigue en Drive)
create or replace function quitar_documento(p_id uuid) returns void as $$
begin
  if not es_dueno() then raise exception 'Solo el dueño puede quitar documentos.'; end if;
  update documentos_activo set anulado = true where id = p_id;
end;
$$ language plpgsql security definer set search_path = public;

commit;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: en_mantencion_sin_orden = 0 · operaciones_antes_del_servicio = las mismas del PASO 1 (no se tocan)
--           mayúsculas = 0 · ya_tiene_vencimiento = 1 · funciones = 4 · ordenes_creadas = las del PASO 1
select (select count(*) from activos a where a.estado = 'mantencion'
          and not exists (select 1 from mantenciones m where m.activo_id = a.id and m.estado in ('programada','proxima','urgente'))) as en_mantencion_sin_orden,
       (select count(*) from despachos d join servicios_cliente s on s.id = d.servicio_id
         where d.estado = 'programado' and d.fecha_programada < s.fecha_inicio)                                    as operaciones_antes_del_servicio,
       (select count(*) from ubicaciones where nombre <> upper(trim(nombre)))
     + (select count(*) from cliente_contactos where nombre <> upper(trim(nombre)))
     + (select count(*) from rutas_semana where nombre <> upper(trim(nombre)))                                      as mayusculas_pendientes,
       (select count(*) from information_schema.columns where table_name = 'documentos_activo' and column_name = 'fecha_vencimiento') as ya_tiene_vencimiento,
       (select count(*) from pg_proc where proname in ('asegurar_orden_mantencion','validar_fecha_operacion','registrar_documento','quitar_documento')) as funciones,
       (select count(*) from mantenciones where observaciones like 'Creada automáticamente%')                       as ordenes_creadas;
