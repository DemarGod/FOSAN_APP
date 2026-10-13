-- ════════════════════════════════════════════════════════════════════════════
-- FOSAN SpA — historial de cambios (auditoría)
-- Cada vez que alguien crea, modifica o elimina un registro, la base de datos
-- guarda quién fue, con qué rol, cuándo, en qué sección y qué cambió.
-- El registro lo escribe un trigger, así que no depende de la app y nadie
-- puede borrarlo ni editarlo desde ella. Solo los dueños lo pueden leer.
-- Ejecutar después de 04_logistica.sql. Se puede ejecutar más de una vez.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists auditoria (
  id             bigserial primary key,
  fecha          timestamptz not null default now(),
  usuario_id     uuid,
  usuario_nombre text,
  usuario_rol    text,
  tabla          text not null,
  accion         text not null check (accion in ('crear', 'modificar', 'eliminar')),
  registro_id    text,
  etiqueta       text,                 -- lo que el usuario reconoce: BQ-444, una patente, un cliente
  cambios        jsonb                 -- modificar: {campo: {antes, despues}} · crear/eliminar: la fila
);
create index if not exists auditoria_fecha_idx on auditoria (fecha desc);
create index if not exists auditoria_tabla_idx on auditoria (tabla, registro_id);
create index if not exists auditoria_usuario_idx on auditoria (usuario_id);

create or replace function registrar_auditoria() returns trigger as $$
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
$$ language plpgsql security definer set search_path = public;

-- Tablas que se auditan. Los registros automáticos (movimientos, notificaciones)
-- ya son un historial y no se incluyen.
do $$
declare t text;
begin
  foreach t in array array[
    'perfiles','clientes','ubicaciones','modelos_bano','activos','vehiculos',
    'documentos_activo','observaciones_activo','servicios','servicio_activos',
    'mantenciones','ventas','costos','proveedores','insumos','compras','compra_lineas',
    'eventos','rubros','parametros','receta_limpieza','rutas','ruta_paradas',
    'salidas','salida_paradas','despachos','despacho_banos'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists auditoria_%1$s on %1$I', t);
      execute format('create trigger auditoria_%1$s after insert or update or delete on %1$I
                      for each row execute function registrar_auditoria()', t);
    end if;
  end loop;
end $$;

-- Solo lectura para los dueños. No hay políticas de escritura: desde la app
-- nadie puede crear, editar ni borrar filas del historial.
alter table auditoria enable row level security;
drop policy if exists auditoria_lectura on auditoria;
create policy auditoria_lectura on auditoria for select using (es_dueno());
