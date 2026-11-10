-- 02 · Funciones (reglas de negocio, permisos y acciones de la app)
-- Foto de la base de producción de FOSAN tomada el 10/11/2026 (generado desde la base real, no a mano).
-- La app llama a estas funciones con supabase.rpc(...). Las "security definer" corren con permisos del dueño de la base
-- y validan por dentro quién puede usarlas (es_dueno(), permiso_seccion(), es_operador()...).
-- Orden para montar una base nueva: 00 → 01 → 02 → 03 → 04 → 05 → 06 (ver supabase/README.md).

set check_function_bodies = off;   -- algunas funciones usan vistas que se crean en 03

-- ═══ Funciones (93) ═══

CREATE OR REPLACE FUNCTION public.asegurar_orden_mantencion(p_activo uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.bloquear_cambio_numero()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.propiedad = 'empresa' and old.tipo = 'bano_quimico' and new.codigo is distinct from old.codigo then
    raise exception 'El N.º de unidad % no se puede cambiar.', old.codigo;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.borrar_ruta_semana(p_ruta uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not es_planificador() then raise exception 'Tu usuario no puede planificar rutas.'; end if;
  if exists (select 1 from salidas where ruta_semana_id = p_ruta and (iniciada_en is not null or estado <> 'planificada')) then
    raise exception 'La ruta ya tiene días iniciados. No se puede borrar.';
  end if;
  update despachos set salida_id = null
   where estado = 'programado' and salida_id in (select id from salidas where ruta_semana_id = p_ruta);
  delete from rutas_semana where id = p_ruta;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cambiar_clave_usuario(p_correo text, p_clave text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
begin
  if not es_dueno() then raise exception 'Solo un dueño puede cambiar contraseñas'; end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf')), updated_at = now()
   where lower(email) = lower(trim(p_correo));
  if not found then raise exception 'Ese correo no tiene cuenta'; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cambiar_disponibilidad_vehiculo(p_id uuid, p_estado text, p_fecha date, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.cancelar_mantencion(p_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.cancelar_operacion(p_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.cerrar_despacho()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.cerrar_dia(p_salida uuid, p_km integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s salidas;
begin
  if not puede_operar_viaje(p_salida) then raise exception 'Esta ruta no está asignada a tu usuario.'; end if;
  select * into s from salidas where id = p_salida;
  if s.iniciada_en is null then raise exception 'Primero inicia el día con el kilometraje.'; end if;
  if s.estado <> 'planificada' then raise exception 'El día ya está cerrado.'; end if;
  if p_km is null or p_km <= coalesce(s.odometro_salida, 0) then
    raise exception 'El kilometraje final debe ser mayor que el inicial (% km).', s.odometro_salida;
  end if;
  update salida_paradas set estado = 'no_realizada', observacion = coalesce(observacion, 'Quedó pendiente al cerrar el día')
   where salida_id = p_salida and estado = 'pendiente';
  update salidas set odometro_llegada = p_km, estado = 'cerrada', cerrada_en = now() where id = p_salida;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cerrar_mantencion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.estado = 'completada' and old.estado <> 'completada' then
    -- Solo si no le quedan otras mantenciones abiertas
    if not exists (select 1 from mantenciones m where m.activo_id = new.activo_id and m.id <> new.id
                    and m.estado in ('programada', 'proxima', 'urgente')) then
      update activos set
        estado = case
          when estado not in ('mantencion', 'fuera_de_servicio') then estado
          when tipo::text in ('camion', 'camioneta') then 'en_servicio'::estado_activo
          when cliente_id is not null then 'en_arriendo'::estado_activo
          else 'disponible'::estado_activo end,
        condicion = 'operativo'
       where id = new.activo_id
         and (estado in ('mantencion', 'fuera_de_servicio') or condicion = 'requiere_reparacion');
    end if;
  elsif new.estado in ('programada','proxima','urgente') and old.estado = 'completada' then
    update activos set estado = 'mantencion' where id = new.activo_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cerrar_salida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.odometro_llegada is not null and new.vehiculo_id is not null
     and new.odometro_llegada is distinct from old.odometro_llegada then
    update vehiculos set kilometraje = greatest(coalesce(kilometraje, 0), new.odometro_llegada)
     where activo_id = new.vehiculo_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cliente_georreferenciado(c clientes)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select c.lat is not null and c.lng is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.cliente_mayusculas()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.nombre := upper(trim(new.nombre));
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.confirmar_operacion(p_id uuid, p_fecha timestamp with time zone, p_recibido_por text DEFAULT NULL::text, p_resultado text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.copiar_permisos_rol(p_desde text, p_hacia text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not es_dueno() then raise exception 'Solo el dueño puede cambiar permisos.'; end if;
  if p_hacia in ('dueno', 'operador') then raise exception 'Ese rol no se configura.'; end if;
  execute format($q$insert into permisos_rol (rol, seccion, ver, editar, exportar)
                    select %L, seccion, ver, editar, exportar from permisos_rol where rol::text = %L
                    on conflict (rol, seccion) do update set ver = excluded.ver, editar = excluded.editar, exportar = excluded.exportar$q$, p_hacia, p_desde);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.correo_autorizado(p_correo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from accesos_autorizados where lower(trim(correo)) = lower(trim(p_correo)));
$function$
;

CREATE OR REPLACE FUNCTION public.correo_para_login(p_usuario text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select correo from perfiles
   where usuario is not null and lower(usuario) = lower(trim(p_usuario)) and activo
   limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.crear_perfil_desde_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare a accesos_autorizados;
begin
  select * into a from accesos_autorizados where lower(trim(correo)) = lower(trim(new.email));
  if a.correo is null then
    return new;   -- correo no autorizado: no se crea perfil, no tendrá acceso
  end if;
  insert into perfiles (id, nombre, correo, rol)
  values (new.id, a.nombre, lower(trim(a.correo)), a.rol)
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crear_rol(p_nombre text, p_base text DEFAULT 'ventas'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_clave text; n int := 1;
begin
  if not es_dueno() then raise exception 'Solo el dueño puede crear roles.'; end if;
  if coalesce(length(trim(p_nombre)), 0) < 3 then raise exception 'Escribe el nombre del rol.'; end if;
  if exists (select 1 from roles_app where lower(nombre) = lower(trim(p_nombre))) then raise exception 'Ya existe un rol con ese nombre.'; end if;
  v_clave := trim(both '_' from regexp_replace(translate(lower(trim(p_nombre)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '_', 'g'));
  v_clave := left(coalesce(nullif(v_clave, ''), 'rol'), 30);
  while exists (select 1 from roles_app where clave = v_clave)
     or exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'rol_usuario' and e.enumlabel = v_clave) loop
    n := n + 1; v_clave := left(v_clave, 27) || '_' || n;
  end loop;
  if exists (select 1 from pg_type where typname = 'rol_usuario') then
    execute format('alter type rol_usuario add value if not exists %L', v_clave);
  end if;
  insert into roles_app (clave, nombre, base, revisado) values (v_clave, trim(p_nombre), p_base, false);
  return v_clave;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crear_usuario(p_correo text, p_nombre text, p_rol rol_usuario, p_clave text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'auth'
AS $function$
declare
  v_correo text := lower(trim(p_correo));
  v_id uuid := gen_random_uuid();
begin
  if not es_dueno() then raise exception 'Solo un dueño puede crear usuarios'; end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Correo inválido'; end if;
  if length(coalesce(p_clave, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres'; end if;
  if exists (select 1 from auth.users where lower(email) = v_correo) then
    raise exception 'Ese correo ya tiene cuenta. Usa "Cambiar clave" si la olvidó.';
  end if;

  insert into accesos_autorizados (correo, nombre, rol)
  values (v_correo, coalesce(nullif(trim(p_nombre), ''), v_correo), p_rol)
  on conflict (correo) do update set nombre = excluded.nombre, rol = excluded.rol;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
    extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true),
          'email', now(), now(), now());

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cupo_servicio(p_servicio uuid, p_excluir uuid DEFAULT NULL::uuid)
 RETURNS TABLE(solicitada integer, asignadas integer, reservadas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.cantidad,
         (select count(*)::int from activos a where a.servicio_id = s.id and a.estado = 'en_arriendo'),
         (select count(*)::int from despacho_banos db join despachos d on d.id = db.despacho_id
           where d.servicio_id = s.id and d.estado = 'programado' and db.accion = 'entrega'
             and d.id is distinct from p_excluir)
       - (select count(*)::int from despacho_banos db join despachos d on d.id = db.despacho_id
           where d.servicio_id = s.id and d.estado = 'programado' and db.accion = 'retiro'
             and d.id is distinct from p_excluir)
    from servicios_cliente s where s.id = p_servicio
$function$
;

CREATE OR REPLACE FUNCTION public.dar_de_baja(p_activo uuid, p_fecha date, p_motivo text, p_observaciones text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.desactivar_cliente(p_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  if not permiso_seccion('clientes', 'editar') then
    raise exception 'No tienes permiso para desactivar clientes.';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Indica el motivo de la desactivación.';
  end if;
  select count(*) into n from activos
   where cliente_id = p_id and estado = 'en_arriendo' and propiedad = 'empresa';
  if n > 0 then
    raise exception 'Este cliente tiene % baño(s) FOSAN asignado(s). Primero programa y completa su retiro.', n;
  end if;
  select count(*) into n from servicios_cliente where cliente_id = p_id and estado = 'vigente';
  if n > 0 then
    raise exception 'Este cliente tiene % servicio(s) vigente(s). Finalízalos antes de desactivar.', n;
  end if;
  update clientes
     set activo = false, motivo_desactivacion = trim(p_motivo), desactivado_en = now(), desactivado_por = auth.uid()
   where id = p_id and activo;
  if not found then raise exception 'El cliente no existe o ya está desactivado.'; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.desactivar_vehiculo(p_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.despacho_hecho(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (puede_operar('rutas') or puede_operar('despachos')) then
    raise exception 'Tu usuario no puede marcar despachos.';
  end if;
  update despachos set estado = 'hecho', fecha_realizada = now() where id = p_id and estado = 'programado';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.editar_mantencion(p_id uuid, p_tipo text, p_fecha date, p_responsable text, p_trabajo text, p_obs text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.eliminar_activos(p_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare bloq text; n integer;
begin
  if not es_dueno() then raise exception 'Solo los dueños pueden eliminar'; end if;

  select string_agg(codigo, ', ' order by codigo) into bloq
    from activos where id = any (p_ids) and estado = 'en_arriendo';
  if bloq is not null then
    raise exception 'No se pueden eliminar baños en arriendo: %. Primero registra su retiro.', bloq;
  end if;

  select string_agg(distinct a.codigo, ', ') into bloq
    from despacho_banos db join despachos d on d.id = db.despacho_id join activos a on a.id = db.activo_id
   where db.activo_id = any (p_ids) and d.estado = 'programado';
  if bloq is not null then
    raise exception 'Estos baños están en un despacho programado: %. Cancélalo primero.', bloq;
  end if;

  delete from servicio_activos where activo_id = any (p_ids);
  delete from activos where id = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eliminar_cliente(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  raise exception 'Los clientes ya no se eliminan: se desactivan con motivo y conservan su historial.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eliminar_usuario(p_correo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_correo text := lower(trim(p_correo));
  v_id uuid;
  r record;
begin
  if not es_dueno() then raise exception 'Solo un dueño puede eliminar usuarios'; end if;

  select id into v_id from auth.users where lower(email) = v_correo;

  if v_id = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta'; end if;
  if exists (select 1 from perfiles where id = v_id and rol = 'dueno')
     and (select count(*) from perfiles where rol = 'dueno' and coalesce(activo, true)) <= 1 then
    raise exception 'No se puede eliminar al último dueño';
  end if;

  if v_id is not null then
    -- Desvincular al usuario de los registros que lo mencionan (quedan como "sin usuario")
    for r in
      select c.conrelid::regclass as tabla, a.attname as col, a.attnotnull as obligatorio
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
       where c.contype = 'f'
         and c.confrelid in ('public.perfiles'::regclass, 'auth.users'::regclass)
         and c.connamespace = 'public'::regnamespace
         and c.conrelid <> 'public.perfiles'::regclass
    loop
      if r.obligatorio then
        raise exception 'No se puede eliminar: la tabla % exige un usuario en %. Desactívalo en vez de eliminarlo.', r.tabla, r.col;
      else
        execute format('update %s set %I = null where %I = $1', r.tabla, r.col, r.col) using v_id;
      end if;
    end loop;

    delete from perfiles where id = v_id;
    delete from auth.users where id = v_id;   -- borra también sesiones e identidades
  end if;

  delete from accesos_autorizados where lower(trim(correo)) = v_correo;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.es_dueno()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'dueno' and activo
  );
$function$
;

CREATE OR REPLACE FUNCTION public.es_operador()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from perfiles where id = auth.uid() and rol::text = 'operador' and activo)
$function$
;

CREATE OR REPLACE FUNCTION public.es_operativo()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select tiene_permiso('ubicaciones','editar');
$function$
;

CREATE OR REPLACE FUNCTION public.es_planificador()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select es_dueno()
      or permiso_seccion('rutas', 'editar')                                                      -- Operaciones → Registrar
      or exists (select 1 from perfiles where id = auth.uid() and activo and rol::text = 'administrador');   -- rol antiguo
$function$
;

CREATE OR REPLACE FUNCTION public.foto_ocupacion()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  insert into ocupacion_diaria (fecha, activo_id, estado, cliente_id)
  select current_date, id, estado::text, cliente_id
    from activos where tipo = 'bano_quimico' and estado <> 'baja'
  on conflict (fecha, activo_id) do update set estado = excluded.estado, cliente_id = excluded.cliente_id;
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generar_ruta_semana(p_ruta uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r rutas_semana; d int; f date; s uuid; l record; des uuid; n int;
begin
  if not es_planificador() then raise exception 'Tu usuario no puede planificar rutas.'; end if;
  select * into r from rutas_semana where id = p_ruta;
  if r.id is null then raise exception 'La ruta no existe.'; end if;

  -- Entregas y retiros: cada línea tiene su despacho (se crea la primera vez)
  for l in select * from rutas_semana_lineas where ruta_id = p_ruta and tarea <> 'limpieza' and despacho_id is null loop
    if coalesce(array_length(l.banos, 1), 0) = 0 then continue; end if;
    insert into despachos (tipo, cliente_id, direccion, fecha_programada, origen, observaciones)
    select l.tarea, l.cliente_id, c.direccion, r.lunes + coalesce(l.dias[1], 1) - 1, 'manual', l.nota
      from clientes c where c.id = l.cliente_id
    returning id into des;
    insert into despacho_banos (despacho_id, activo_id, accion)
    select des, b, case when l.tarea = 'entrega' then 'entrega' else 'retiro' end from unnest(l.banos) b;
    update rutas_semana_lineas set despacho_id = des where id = l.id;
  end loop;

  for d in 1..5 loop
    f := r.lunes + d - 1;
    select id into s from salidas where ruta_semana_id = p_ruta and fecha = f;
    if s is not null and exists (select 1 from salidas where id = s and (iniciada_en is not null or estado <> 'planificada')) then
      continue;                                             -- día ya comenzado: no se cambia
    end if;
    select count(*) into n from rutas_semana_lineas where ruta_id = p_ruta and d = any (dias);
    if n = 0 then
      if s is not null then
        update despachos set salida_id = null where salida_id = s and estado = 'programado';
        delete from salidas where id = s;
      end if;
      continue;
    end if;
    if s is null then
      insert into salidas (ruta_semana_id, fecha, vehiculo_id) values (p_ruta, f, r.vehiculo_id) returning id into s;
    else
      update salidas set vehiculo_id = r.vehiculo_id where id = s and vehiculo_id is distinct from r.vehiculo_id;
      update despachos set salida_id = null where salida_id = s and estado = 'programado';
      delete from salida_paradas where salida_id = s;
    end if;
    insert into salida_paradas (salida_id, cliente_id, orden, tarea, banos, linea_id, despacho_id)
    select s, l2.cliente_id, row_number() over (order by l2.orden, l2.id), l2.tarea,
           case when l2.tarea = 'limpieza'
                then (select count(*) from activos a where a.cliente_id = l2.cliente_id and a.estado = 'en_arriendo')
                     + coalesce((select c.banos_propios from clientes c where c.id = l2.cliente_id), 0)
                when l2.despacho_id is not null
                then (select count(*) from despacho_banos db where db.despacho_id = l2.despacho_id)
                else coalesce(array_length(l2.banos, 1), 0) end,
           l2.id, l2.despacho_id
      from rutas_semana_lineas l2
     where l2.ruta_id = p_ruta and d = any (l2.dias);
    update despachos x set salida_id = s, vehiculo_id = r.vehiculo_id, fecha_programada = f
      from rutas_semana_lineas l3
     where l3.ruta_id = p_ruta and l3.despacho_id = x.id and d = any (l3.dias) and x.estado = 'programado';
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generar_salidas(dias integer DEFAULT 14)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
               + coalesce(c.banos_propios, 0)
          from ruta_paradas p join clientes c on c.id = p.cliente_id
         where p.ruta_id = r.id and (c.fecha_fin_contrato is null or c.fecha_fin_contrato >= f);
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.historial_cliente(p_id uuid)
 RETURNS SETOF auditoria
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not permiso_seccion('clientes', 'ver') then
    raise exception 'No tienes permiso para ver el historial de clientes.';
  end if;
  return query
  select a.* from auditoria a
   where (a.tabla = 'clientes' and a.registro_id = p_id::text)
      or (a.tabla = 'cliente_contactos' and a.registro_id in (select id::text from cliente_contactos where cliente_id = p_id))
      or (a.tabla = 'servicios_cliente' and a.registro_id in (select id::text from servicios_cliente where cliente_id = p_id))
      or (a.tabla = 'ubicaciones'       and a.registro_id in (select id::text from ubicaciones where cliente_id = p_id))
   order by a.fecha desc
   limit 500;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.iniciar_dia(p_salida uuid, p_km integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s salidas;
begin
  if not puede_operar_viaje(p_salida) then raise exception 'Esta ruta no está asignada a tu usuario.'; end if;
  select * into s from salidas where id = p_salida;
  if s.fecha > current_date then raise exception 'Este día todavía no llega.'; end if;
  if s.iniciada_en is not null then raise exception 'El día ya fue iniciado.'; end if;
  if p_km is null or p_km <= 0 then raise exception 'Ingresa el kilometraje del vehículo.'; end if;
  update salidas set odometro_salida = p_km, iniciada_en = now() where id = p_salida;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.iniciar_mantencion(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.limites_secretaria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if mi_rol() is distinct from 'secretaria' then return new; end if;

  if tg_table_name = 'clientes' then
    if tg_op = 'INSERT' and new.valor_mensual is not null then new.valor_mensual := null; end if;
    if tg_op = 'UPDATE' and new.valor_mensual is distinct from old.valor_mensual then
      raise exception 'Solo un dueño puede cambiar el valor mensual del contrato';
    end if;
  elsif tg_table_name = 'mantenciones' then
    if new.estado = 'completada' and (tg_op = 'INSERT' or old.estado <> 'completada') then
      raise exception 'El cierre de la mantención lo hace quien la ejecutó o un dueño';
    end if;
    if tg_op = 'UPDATE' and old.estado = 'completada' then
      raise exception 'Una mantención cerrada solo la corrige un dueño';
    end if;
    if tg_op = 'UPDATE' and new.costo is distinct from old.costo then
      raise exception 'Solo un dueño puede cambiar el costo de una mantención';
    end if;
  elsif tg_table_name = 'despachos' then
    if tg_op = 'UPDATE' and old.estado <> 'programado' and new.estado is distinct from old.estado then
      raise exception 'Un despacho ya cerrado solo lo corrige un dueño';
    end if;
  elsif tg_table_name = 'salidas' then
    if tg_op = 'UPDATE' and old.estado = 'cerrada' then
      raise exception 'Una salida cerrada solo la corrige un dueño';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mantencion_clase_desde_activo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare t text;
begin
  select tipo::text into t from activos where id = new.activo_id;
  new.clase := case
    when t = 'bano_quimico' then 'bano'
    when t in ('camion', 'camioneta') then t
    else 'equipo' end::clase_mantencion;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_parada(p_id bigint, p_hecha boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not puede_operar('rutas') then raise exception 'Tu usuario no puede marcar paradas.'; end if;
  update salida_paradas set hecha = p_hecha, hecha_en = case when p_hecha then now() end where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_parada_ruta(p_parada bigint, p_estado text, p_obs text DEFAULT NULL::text, p_banos uuid[] DEFAULT '{}'::uuid[], p_tipo text DEFAULT NULL::text, p_retirado boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p salida_paradas; s salidas; c text; b record; bod uuid; codigos text; retira boolean;
begin
  select * into p from salida_paradas where id = p_parada;
  if p.id is null then raise exception 'La parada no existe.'; end if;
  if not puede_operar_viaje(p.salida_id) then raise exception 'Esta ruta no está asignada a tu usuario.'; end if;
  select * into s from salidas where id = p.salida_id;
  if s.iniciada_en is null then raise exception 'Primero inicia el día con el kilometraje.'; end if;
  if s.estado <> 'planificada' then raise exception 'El día ya está cerrado.'; end if;
  if p_estado not in ('hecha', 'no_realizada', 'pendiente') then raise exception 'Estado no válido.'; end if;
  if p_estado = 'no_realizada' and coalesce(trim(p_obs), '') = '' then raise exception 'Escribe por qué no se pudo.'; end if;
  if p.despacho_id is not null and p.estado = 'hecha' then raise exception 'Una entrega o retiro hecho no se puede deshacer.'; end if;
  if p.requiere_mantencion and p_estado = 'pendiente' then raise exception 'Esta parada ya reportó una mantención; revísala en Mantenciones.'; end if;
  if coalesce(array_length(p_banos, 1), 0) > 0 and coalesce(trim(p_tipo), '') = '' then raise exception 'Indica el tipo de mantención.'; end if;

  -- Un retiro hecho siempre trae el baño a bodega
  retira := coalesce(p_retirado, false) or (p.tarea in ('retiro', 'cambio') and p_estado = 'hecha');
  select string_agg(codigo, ', ' order by codigo) into codigos from activos where id = any (coalesce(p_banos, '{}'));

  if p.despacho_id is not null and p_estado = 'hecha' then
    update despachos set estado = 'hecho', fecha_realizada = now(),
           observaciones = concat_ws(' · ', nullif(observaciones, ''), nullif(trim(p_obs), ''))
     where id = p.despacho_id and estado = 'programado';    -- el trigger mueve los baños
  end if;


  -- Primero los baños con falla: así la limpieza no los registra como limpiados
  if codigos is not null and p_estado <> 'pendiente' then
    select nombre into c from clientes where id = p.cliente_id;
    select id into bod from ubicaciones where tipo = 'bodega' and activa
     order by (nombre ilike '%central%') desc, creado_en limit 1;
    for b in select id, codigo, ubicacion_id, cliente_id from activos where id = any (p_banos) loop
      if retira then
        update activos set estado = 'mantencion', cliente_id = null, ubicacion_id = coalesce(bod, ubicacion_id) where id = b.id;
        if b.cliente_id is not null then                   -- no venía de un despacho: se registra el retiro
          insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
          values (b.id, 'retiro', b.ubicacion_id, bod, b.cliente_id, 'Retirado en ruta por mantención');
        end if;
      else
        update activos set estado = 'mantencion' where id = b.id;   -- sigue en el cliente
      end if;
      insert into mantenciones (activo_id, clase, tipo, fecha_programada, estado, detalle)
      values (b.id, 'bano', trim(p_tipo), current_date, 'programada',
              concat_ws(' · ', 'Reportado en ruta en ' || coalesce(c, 'cliente'),
                        case when retira then 'retirado a bodega' else 'quedó en el cliente' end,
                        nullif(trim(p_obs), '')));
    end loop;
    insert into notificaciones (texto, nivel)
    values ('Mantención (' || trim(p_tipo) || ') de ' || codigos || ' en ' || coalesce(c, 'cliente')
            || case when retira then ', retirado a bodega' else ', quedó en el cliente' end
            || coalesce(': ' || nullif(trim(p_obs), ''), ''), 'aviso');
  end if;

  update salida_paradas set estado = p_estado, hecha = (p_estado = 'hecha'),
         hecha_en = case when p_estado = 'hecha' then now() end,
         -- limpieza: el baño que se llevó a bodega no se limpió (no descuenta insumos)
         banos = case when p.tarea = 'limpieza' and retira and codigos is not null
                      then greatest(p.banos - coalesce(array_length(p_banos, 1), 0), 0) else p.banos end,
         observacion = nullif(trim(p_obs), ''),
         requiere_mantencion = codigos is not null,
         mant_tipo = case when codigos is not null then trim(p_tipo) end,
         mant_banos = codigos,
         mant_retirado = case when codigos is not null then retira end
   where id = p_parada;                                     -- limpieza hecha: el trigger descuenta insumos

end;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_parada_ruta2(p_parada bigint, p_estado text, p_obs text DEFAULT NULL::text, p_mant jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p salida_paradas; s salidas; c text; b record; bod uuid; codigos text; tipos text;
        retira_tarea boolean; n_retirados int := 0; algun_retiro boolean := false;
begin
  select * into p from salida_paradas where id = p_parada;
  if p.id is null then raise exception 'La parada no existe.'; end if;
  if not puede_operar_viaje(p.salida_id) then raise exception 'Esta ruta no está asignada a tu usuario.'; end if;
  select * into s from salidas where id = p.salida_id;
  if s.iniciada_en is null then raise exception 'Primero inicia el día con el kilometraje.'; end if;
  if s.estado <> 'planificada' then raise exception 'El día ya está cerrado.'; end if;
  if p_estado not in ('hecha', 'no_realizada', 'pendiente') then raise exception 'Estado no válido.'; end if;
  if p_estado = 'no_realizada' and coalesce(trim(p_obs), '') = '' then raise exception 'Escribe por qué no se pudo.'; end if;
  if p.despacho_id is not null and p.estado = 'hecha' then raise exception 'Una entrega o retiro hecho no se puede deshacer.'; end if;
  if p.requiere_mantencion and p_estado = 'pendiente' then raise exception 'Esta parada ya reportó una mantención; revísala en Mantenciones.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_mant, '[]')) x where coalesce(trim(x->>'tipo'), '') = '') then
    raise exception 'Indica el tipo de mantención de cada baño.';
  end if;

  retira_tarea := p.tarea in ('retiro', 'cambio') and p_estado = 'hecha';

  if p.despacho_id is not null and p_estado = 'hecha' then
    update despachos set estado = 'hecho', fecha_realizada = now(),
           observaciones = concat_ws(' · ', nullif(observaciones, ''), nullif(trim(p_obs), ''))
     where id = p.despacho_id and estado = 'programado';    -- el trigger mueve los baños
  end if;

  if jsonb_array_length(coalesce(p_mant, '[]')) > 0 and p_estado <> 'pendiente' then
    select nombre into c from clientes where id = p.cliente_id;
    select id into bod from ubicaciones where tipo = 'bodega' and activa
     order by (nombre ilike '%central%') desc, creado_en limit 1;
    for b in
      select a.id, a.codigo, a.ubicacion_id, a.cliente_id, trim(x->>'tipo') as tipo,
             (retira_tarea or coalesce((x->>'retirado')::boolean, false)) as retira
        from jsonb_array_elements(p_mant) x
        join activos a on a.id = (x->>'id')::uuid
    loop
      if b.retira then
        n_retirados := n_retirados + 1; algun_retiro := true;
        update activos set estado = 'mantencion', cliente_id = null, ubicacion_id = coalesce(bod, ubicacion_id) where id = b.id;
        if b.cliente_id is not null then
          insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
          values (b.id, 'retiro', b.ubicacion_id, bod, b.cliente_id, 'Retirado en ruta por mantención');
        end if;
      else
        update activos set estado = 'mantencion' where id = b.id;   -- sigue en el cliente
      end if;
      insert into mantenciones (activo_id, clase, tipo, fecha_programada, estado, detalle)
      values (b.id, 'bano', b.tipo, current_date, 'programada',
              concat_ws(' · ', 'Reportado en ruta en ' || coalesce(c, 'cliente'),
                        case when b.retira then 'retirado a bodega' else 'quedó en el cliente' end,
                        nullif(trim(p_obs), '')));
      codigos := concat_ws(', ', codigos, b.codigo);
      tipos := concat_ws(' · ', tipos, b.codigo || ': ' || b.tipo || case when b.retira then ' (retirado)' else '' end);
    end loop;
    insert into notificaciones (texto, nivel)
    values ('Mantención en ' || coalesce(c, 'cliente') || ': ' || tipos
            || coalesce(' · ' || nullif(trim(p_obs), ''), ''), 'aviso');
  end if;

  update salida_paradas set estado = p_estado, hecha = (p_estado = 'hecha'),
         hecha_en = case when p_estado = 'hecha' then now() end,
         -- limpieza: los baños llevados a bodega no se limpiaron (no descuentan insumos)
         banos = case when p.tarea = 'limpieza' and n_retirados > 0
                      then greatest(p.banos - n_retirados, 0) else p.banos end,
         observacion = nullif(trim(p_obs), ''),
         requiere_mantencion = codigos is not null,
         mant_tipo = tipos,
         mant_banos = codigos,
         mant_retirado = case when codigos is not null then algun_retiro end
   where id = p_parada;                                     -- limpieza hecha: el trigger descuenta insumos
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mi_rol()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select rol::text from perfiles where id = auth.uid() and activo;
$function$
;

CREATE OR REPLACE FUNCTION public.mover_equipo(p_activo uuid, p_tipo text, p_destino uuid, p_fecha timestamp with time zone, p_responsable uuid DEFAULT NULL::uuid, p_responsable_nombre text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.nombre_mayusculas()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.nombre is not null then new.nombre := upper(trim(new.nombre)); end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalizar_patente(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g')), '')
$function$
;

CREATE OR REPLACE FUNCTION public.op_activos()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select vehiculo_id from salidas where id in (select op_salidas()) and vehiculo_id is not null
  union
  select id from activos where cliente_id in (select op_clientes())
$function$
;

CREATE OR REPLACE FUNCTION public.op_clientes()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select cliente_id from salida_paradas where salida_id in (select op_salidas()) and cliente_id is not null
  union
  select cliente_id from rutas_semana_lineas where ruta_id in (select op_rutas()) and cliente_id is not null
$function$
;

CREATE OR REPLACE FUNCTION public.op_rutas()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from rutas_semana where operador_id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.op_salidas()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id from v_salidas s where s.ruta_semana_id in (select op_rutas())
$function$
;

CREATE OR REPLACE FUNCTION public.parada_hecha()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.permiso_seccion(p_seccion text, p_accion text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select es_dueno() or exists (
    select 1 from permisos_rol pr join perfiles p on p.rol::text = pr.rol::text
    where p.id = auth.uid() and p.activo and pr.seccion::text = p_seccion
      and case p_accion when 'ver' then pr.ver when 'editar' then pr.editar when 'exportar' then pr.exportar else false end
  );
$function$
;

CREATE OR REPLACE FUNCTION public.preparar_equipo_externo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare n integer;
begin
  if tg_op = 'UPDATE' and new.codigo is distinct from old.codigo
     and (old.propiedad = 'cliente' or new.propiedad = 'cliente') then
    raise exception 'El código de un equipo externo no se puede cambiar.';
  end if;
  if new.propiedad = 'cliente' then
    if tg_op = 'INSERT' and coalesce(trim(new.codigo), '') = '' then
      perform pg_advisory_xact_lock(hashtext('equipo_externo'));
      select coalesce(max(substring(codigo from 5)::integer), 0) + 1 into n
        from activos where codigo ~ '^EXT-[0-9]+$';
      new.codigo := 'EXT-' || lpad(n::text, 3, '0');
    end if;
    new.habilitado := false;
    if new.estado::text in ('disponible', 'en_arriendo') then new.estado := 'en_servicio'; end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preparar_vehiculo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.patente := normalizar_patente(new.patente);
  if new.kilometraje is not null and new.kilometraje < 0 then raise exception 'El odómetro no puede ser negativo.'; end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.procesar_vencidos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.programar_mantencion(p_activo uuid, p_tipo text, p_fecha date, p_responsable text, p_trabajo text, p_obs text DEFAULT NULL::text, p_bloquea boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.proteger_perfiles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.id = auth.uid() and (new.rol is distinct from old.rol or new.activo is distinct from old.activo) then
    raise exception 'No puedes cambiar tu propio rol ni desactivarte';
  end if;
  if old.rol = 'dueno' and old.activo and (new.rol <> 'dueno' or not new.activo)
     and (select count(*) from perfiles where rol = 'dueno' and activo and id <> old.id) = 0 then
    raise exception 'Debe quedar al menos un dueño activo';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.puede_mantener()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select es_dueno() or permiso_seccion('mantenciones', 'editar')
$function$
;

CREATE OR REPLACE FUNCTION public.puede_operar(p_seccion text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select es_dueno() or exists (
    select 1 from perfiles pf
      join permisos_rol pr on pr.rol::text = pf.rol::text
     where pf.id = auth.uid() and pf.activo
       and pr.seccion = p_seccion and pr.ver and pr.editar
  );
$function$
;

CREATE OR REPLACE FUNCTION public.puede_operar_viaje(p_salida uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select es_planificador() or exists (
    select 1 from salidas s join rutas_semana r on r.id = s.ruta_semana_id
     where s.id = p_salida and r.operador_id = auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.quitar_documento(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not es_dueno() then raise exception 'Solo el dueño puede quitar documentos.'; end if;
  update documentos_activo set anulado = true where id = p_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reactivar_cliente(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not permiso_seccion('clientes', 'editar') then
    raise exception 'No tienes permiso para reactivar clientes.';
  end if;
  update clientes
     set activo = true, motivo_desactivacion = null, desactivado_en = null, desactivado_por = null
   where id = p_id and not activo;
  if not found then raise exception 'El cliente no existe o ya está activo.'; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recalcular_cliente_servicios(p_cliente uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_cliente is null then return; end if;
  update clientes c set
    -- días de limpieza: unión de los días de los servicios A y B vigentes (1 = lunes … 7 = domingo)
    dias_limpieza = (
      select array_agg(distinct d order by d)
        from servicios_cliente s, unnest(s.dias) d
       where s.cliente_id = p_cliente and s.estado = 'vigente'
         and s.tipo in ('arriendo_limpieza', 'limpieza_cliente') and d between 1 and 7),
    -- baños propios: por cada servicio B vigente, los equipos externos registrados o la cantidad anotada
    banos_propios = coalesce((
      select sum(greatest(coalesce(s.cantidad, 0),
                          (select count(*) from activos a where a.servicio_id = s.id and a.propiedad = 'cliente')))
        from servicios_cliente s
       where s.cliente_id = p_cliente and s.estado = 'vigente' and s.tipo = 'limpieza_cliente'), 0),
    -- valor mensual: suma de los servicios vigentes (lo usa Análisis como ingreso)
    valor_mensual = (
      select sum(s.valor_mensual) from servicios_cliente s
       where s.cliente_id = p_cliente and s.estado = 'vigente')
  where c.id = p_cliente;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_auditoria()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  nuevo    jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  viejo    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  fila     jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  ignorar  text[] := array['creado_en', 'actualizado_en'];
  dif      jsonb;
  v_nombre text;
  v_rol    text;
  v_etiq   text;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_object('antes', viejo -> k, 'despues', nuevo -> k))
      into dif
      from jsonb_object_keys(nuevo) as k
     where k <> all (ignorar) and (nuevo -> k) is distinct from (viejo -> k);
    if dif is null then return null; end if;   -- se guardó sin cambiar nada
  else
    select jsonb_object_agg(k, fila -> k)
      into dif
      from jsonb_object_keys(fila) as k
     where k <> all (ignorar) and fila -> k <> 'null'::jsonb;
  end if;

  select p.nombre, p.rol::text into v_nombre, v_rol from perfiles p where p.id = auth.uid();

  -- Nombre legible del registro; si no tiene, el del baño, cliente, insumo o ruta al que pertenece
  v_etiq := coalesce(fila ->> 'codigo', fila ->> 'patente', fila ->> 'folio', fila ->> 'folio_maxxa',
                     fila ->> 'titulo', fila ->> 'nombre', fila ->> 'etiqueta', fila ->> 'documento');
  if v_etiq is null and fila ? 'activo_id' and fila ->> 'activo_id' is not null then
    select codigo into v_etiq from activos where id = (fila ->> 'activo_id')::uuid;
  end if;
  if v_etiq is null and fila ? 'cliente_id' and fila ->> 'cliente_id' is not null then
    select nombre into v_etiq from clientes where id = (fila ->> 'cliente_id')::uuid;
  end if;
  if v_etiq is null and fila ? 'insumo_id' and fila ->> 'insumo_id' is not null then
    select nombre into v_etiq from insumos where id = (fila ->> 'insumo_id')::uuid;
  end if;
  if v_etiq is null and fila ? 'ruta_id' and fila ->> 'ruta_id' is not null then
    select nombre into v_etiq from rutas where id = (fila ->> 'ruta_id')::uuid;
  end if;

  insert into auditoria (usuario_id, usuario_nombre, usuario_rol, tabla, accion, registro_id, etiqueta, cambios)
  values (
    auth.uid(),
    coalesce(v_nombre, case when auth.uid() is null then 'Sistema' else 'Usuario sin perfil' end),
    v_rol,
    tg_table_name,
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'modificar' else 'eliminar' end,
    coalesce(fila ->> 'id', fila ->> 'activo_id', fila ->> 'clave', fila ->> 'insumo_id'),
    v_etiq,
    dif
  );
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_documento(p_activo uuid, p_tipo text, p_titulo text, p_url text, p_vence date DEFAULT NULL::date, p_kb integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_exceso_unidades(p_despacho uuid, p_exceso integer, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare x record;
begin
  if not (es_dueno() or permiso_seccion('rutas', 'editar')) then raise exception 'No tienes permiso.'; end if;
  if coalesce(p_exceso, 0) <= 0 then
    update despachos set exceso_unidades = null, exceso_motivo = null where id = p_despacho;
    return;
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Explica el motivo de la urgencia.'; end if;
  select d.folio, c.nombre as cliente, s.codigo as servicio, s.cantidad into x
    from despachos d join clientes c on c.id = d.cliente_id left join servicios_cliente s on s.id = d.servicio_id
   where d.id = p_despacho;
  update despachos set exceso_unidades = p_exceso, exceso_motivo = trim(p_motivo) where id = p_despacho;
  insert into notificaciones (texto, nivel)
  values ('URGENCIA: ' || x.folio || ' entrega ' || p_exceso || ' unidad(es) sobre lo solicitado en ' || coalesce(x.servicio, 'el servicio')
          || ' (' || x.cliente || ', solicitado: ' || coalesce(x.cantidad::text, '?') || '). Revisar y actualizar el servicio. Motivo: ' || trim(p_motivo), 'alerta');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_ingreso_activo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(current_setting('fosan.silencio', true), '') = '1' then return null; end if;
  if new.tipo in ('camion', 'camioneta') then return null; end if;
  insert into movimientos_activo (activo_id, tipo, hacia_id, cliente_id, responsable_id, detalle)
  values (new.id, 'ingreso', new.ubicacion_id, coalesce(new.cliente_id, new.propietario_id), auth.uid(),
          case when new.propiedad = 'cliente' then 'Alta de equipo externo' else 'Alta de equipo' end);
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_activo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_movimiento_insumo(p_insumo uuid, p_tipo text, p_cantidad numeric, p_fecha timestamp with time zone, p_origen uuid DEFAULT NULL::uuid, p_destino uuid DEFAULT NULL::uuid, p_lote uuid DEFAULT NULL::uuid, p_lote_codigo text DEFAULT NULL::text, p_vencimiento date DEFAULT NULL::date, p_motivo text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_servicio uuid DEFAULT NULL::uuid, p_receptor text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_resultado_mantencion(p_id uuid, p_fecha date, p_resultado text, p_trabajo text, p_condicion text, p_obs text DEFAULT NULL::text, p_costo integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_actualizado_en()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.actualizado_en = now(); return new; end;
$function$
;

CREATE OR REPLACE FUNCTION public.siguiente_codigo_insumo(p_prefijo text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_prefijo || '-' || lpad((coalesce(max(substring(codigo from length(p_prefijo) + 2)::int), 0) + 1)::text, 3, '0')
    from insumos where codigo ~ ('^' || p_prefijo || '-[0-9]+$');
$function$
;

CREATE OR REPLACE FUNCTION public.siguiente_numero_unidad()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(max(codigo::bigint), 0) + 1 from activos
   where tipo = 'bano_quimico' and propiedad = 'empresa' and codigo ~ '^[0-9]+$';
$function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_situacion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.propiedad = 'cliente' then
    if new.situacion is null or new.situacion = 'disponible' then new.situacion := 'asignado'; end if;
    return new;
  end if;
  if tg_op = 'INSERT' or new.estado is distinct from old.estado or new.situacion is null then
    new.situacion := case new.estado::text
      when 'en_arriendo' then 'asignado'
      when 'disponible' then 'disponible'
      when 'en_limpieza' then 'disponible'
      when 'mantencion' then 'en_mantenimiento'
      when 'fuera_de_servicio' then 'en_mantenimiento'
      when 'extraviado' then 'no_localizado'
      else 'baja' end;
    new.condicion := case new.estado::text
      when 'en_limpieza' then 'requiere_limpieza'
      when 'mantencion' then 'requiere_reparacion'
      when 'fuera_de_servicio' then 'requiere_reparacion'
      when 'extraviado' then 'sin_evaluar'
      else coalesce(new.condicion, 'operativo') end;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.sincronizar_ubicacion_vehiculo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.sumar_existencia(p_insumo uuid, p_ubicacion uuid, p_lote uuid, p_delta numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into insumo_existencias (insumo_id, ubicacion_id, lote_id, cantidad)
  values (p_insumo, p_ubicacion, p_lote, p_delta)
  on conflict (insumo_id, ubicacion_id, coalesce(lote_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set cantidad = insumo_existencias.cantidad + excluded.cantidad, actualizado_en = now();
  update insumos set stock_actual = coalesce((select sum(cantidad) from insumo_existencias where insumo_id = p_insumo), 0)
   where id = p_insumo;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.t_asegurar_orden()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform asegurar_orden_mantencion(new.id);
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.t_movimiento_insumo_legado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.t_recalcular_desde_externo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c1 uuid; c2 uuid;
begin
  if (tg_op = 'INSERT' and new.propiedad = 'cliente' and new.servicio_id is not null)
     or (tg_op = 'UPDATE' and (new.propiedad = 'cliente' or old.propiedad = 'cliente')
         and new.servicio_id is distinct from old.servicio_id) then
    if tg_op = 'UPDATE' then select cliente_id into c1 from servicios_cliente where id = old.servicio_id; end if;
    select cliente_id into c2 from servicios_cliente where id = new.servicio_id;
    perform recalcular_cliente_servicios(c1);
    if c2 is distinct from c1 then perform recalcular_cliente_servicios(c2); end if;
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.t_recalcular_desde_servicio()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op <> 'INSERT' then perform recalcular_cliente_servicios(old.cliente_id); end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id) then
    perform recalcular_cliente_servicios(new.cliente_id);
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.terminar_salida(p_id uuid, p_odo_salida integer DEFAULT NULL::integer, p_odo_llegada integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not puede_operar('rutas') then raise exception 'Tu usuario no puede terminar salidas.'; end if;
  update salidas set estado = 'cerrada',
         odometro_salida  = coalesce(p_odo_salida, odometro_salida),
         odometro_llegada = coalesce(p_odo_llegada, odometro_llegada)
   where id = p_id and estado <> 'cancelada';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tiene_acceso()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from perfiles where id = auth.uid() and activo
  );
$function$
;

CREATE OR REPLACE FUNCTION public.tiene_permiso(p_seccion text, p_accion text DEFAULT 'ver'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when mi_rol() = 'dueno' then true
    when mi_rol() is null then false
    else coalesce((
      select case when p_accion = 'editar' then ver and editar else ver end
        from permisos_rol where rol = mi_rol() and seccion = p_seccion
    ), false)
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.ubicar_cliente(p_cliente uuid, p_lat numeric, p_lng numeric, p_direccion text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not es_operativo() then raise exception 'Tu usuario no puede ubicar clientes'; end if;
  update clientes set lat = p_lat, lng = p_lng, direccion = coalesce(nullif(p_direccion, ''), direccion)
   where id = p_cliente;
  update ubicaciones set lat = p_lat, lng = p_lng, activa = true,
         direccion = coalesce(nullif(p_direccion, ''), direccion)
   where cliente_id = p_cliente and tipo = 'cliente';
  if not found then
    insert into ubicaciones (nombre, tipo, cliente_id, direccion, comuna, lat, lng)
    select nombre, 'cliente', id, coalesce(nullif(p_direccion, ''), direccion), comuna, p_lat, p_lng
      from clientes where id = p_cliente;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_bano_despacho()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare a activos;
begin
  select * into a from activos where id = new.activo_id;
  if a.tipo <> 'bano_quimico' then
    raise exception '% no es un baño químico', a.codigo;
  end if;
  if new.accion = 'entrega' and a.estado in ('mantencion','fuera_de_servicio','baja','extraviado','vendido','donacion') then
    raise exception 'El baño % está en %, no se puede despachar', a.codigo, replace(a.estado::text, '_', ' ');
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_bano_unico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare otra record; cod text;
begin
  select d.folio, d.tipo into otra
    from despacho_banos db join despachos d on d.id = db.despacho_id
   where db.activo_id = new.activo_id and db.accion = new.accion and d.estado = 'programado' and db.despacho_id <> new.despacho_id
   limit 1;
  if otra.folio is not null then
    select codigo into cod from activos where id = new.activo_id;
    raise exception 'El baño % ya está en la operación % (programada) con % pendiente. Edita o cancela esa operación.',
      cod, otra.folio, case when new.accion = 'retiro' then 'su retiro' else 'su entrega' end;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_fecha_operacion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validar_max_paradas()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (select count(*) from ruta_paradas where ruta_id = new.ruta_id) >= 45 then
    raise exception 'Una ruta lleva máximo 45 clientes';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validar_vehiculo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.ve_finanzas()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select tiene_permiso('finanzas') or tiene_permiso('utilidades') or tiene_permiso('reportes') or tiene_permiso('analisis');
$function$
;

CREATE OR REPLACE FUNCTION public.vehiculo_en_ruta(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from salidas s where s.vehiculo_id = p_id and s.fecha = current_date
                  and s.odometro_salida is not null and s.estado = 'planificada')
$function$
;

