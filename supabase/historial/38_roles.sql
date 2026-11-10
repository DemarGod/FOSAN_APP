-- 38 · ESTANDARIZACIÓN · Paquete 17: roles con nombre propio (ej. "Ejecutivo de ventas")
-- Solo agrega. No cambia a nadie de rol ni borra permisos.
--   A. Rol nuevo "ventas" (Ejecutivo de ventas) con su plantilla de permisos.
--   B. Tabla roles_app: nombre visible de cada rol y si el dueño ya revisó sus permisos.
--   C. El dueño puede crear roles nuevos desde la app (copian la plantilla de otro rol) y renombrarlos.
-- Correr PASO POR PASO en Supabase → SQL Editor. El PASO 2 va SOLO.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Mándame captura. Esperado: perfiles_rol y permisos_rol con tipo rol_usuario o text.
select (select data_type || ' / ' || udt_name from information_schema.columns where table_name = 'perfiles' and column_name = 'rol')     as perfiles_rol,
       (select data_type || ' / ' || udt_name from information_schema.columns where table_name = 'permisos_rol' and column_name = 'rol') as permisos_rol,
       (select string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'rol_usuario') as roles_actuales,
       (select string_agg(pg_get_function_identity_arguments(oid), ' | ') from pg_proc where proname = 'crear_usuario') as crear_usuario;


-- ══ PASO 2 · Rol "ventas" (seleccionar SOLO esta línea y Run) ═══════════════════
alter type rol_usuario add value if not exists 'ventas';


-- ══ PASO 3 · Cambios (seleccionar hasta el PASO 4) ═════════════════════════════
create table if not exists roles_app (
  clave     text primary key,
  nombre    text not null unique,
  base      text,                                  -- de qué rol se copió la plantilla
  revisado  boolean not null default true,         -- false = el dueño aún no revisa sus permisos
  creado_en timestamptz not null default now()
);
alter table roles_app enable row level security;
drop policy if exists roles_app_ver on roles_app;
drop policy if exists roles_app_dueno on roles_app;
create policy roles_app_ver on roles_app for select using (tiene_acceso());
create policy roles_app_dueno on roles_app for all using (es_dueno()) with check (es_dueno());
drop trigger if exists auditoria_roles_app on roles_app;
create trigger auditoria_roles_app after insert or update or delete on roles_app for each row execute function registrar_auditoria();

insert into roles_app (clave, nombre, base, revisado) values
  ('dueno', 'Dueño', null, true),
  ('secretaria', 'Secretaria', null, true),
  ('operador', 'Operador', null, true),
  ('ventas', 'Ejecutivo de ventas', null, false)
on conflict (clave) do nothing;

-- Plantilla del Ejecutivo de ventas (el dueño debe revisarla)
insert into permisos_rol (rol, seccion, ver, editar, exportar)
select 'ventas', s.seccion, s.ver, s.editar, s.exportar
  from (values
    ('inicio',       true,  false, false),
    ('clientes',     true,  true,  true),
    ('rutas',        true,  true,  false),   -- Operaciones: ver y programar
    ('calendario',   true,  true,  false),
    ('banos',        true,  false, false),   -- Inventario: solo consultar disponibilidad
    ('insumos',      true,  false, false),
    ('ubicaciones',  true,  false, false),
    ('reportes',     true,  false, true),
    ('analisis',     false, false, false),   -- costos y rentabilidad: no
    ('transporte',   false, false, false),   -- Flota: no
    ('mantenciones', false, false, false),   -- Mantenimiento: no
    ('finanzas',     false, false, false)    -- Ver montos: lo decide el dueño
  ) as s(seccion, ver, editar, exportar)
on conflict (rol, seccion) do nothing;

-- Crear un rol nuevo con nombre propio. Devuelve su clave. Luego la app copia la plantilla (copiar_permisos_rol).
create or replace function crear_rol(p_nombre text, p_base text default 'ventas') returns text as $$
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
$$ language plpgsql security definer set search_path = public;

-- Copiar los permisos de un rol a otro (se llama después de crear_rol, en otra llamada)
create or replace function copiar_permisos_rol(p_desde text, p_hacia text) returns void as $$
begin
  if not es_dueno() then raise exception 'Solo el dueño puede cambiar permisos.'; end if;
  if p_hacia in ('dueno', 'operador') then raise exception 'Ese rol no se configura.'; end if;
  execute format($q$insert into permisos_rol (rol, seccion, ver, editar, exportar)
                    select %L, seccion, ver, editar, exportar from permisos_rol where rol::text = %L
                    on conflict (rol, seccion) do update set ver = excluded.ver, editar = excluded.editar, exportar = excluded.exportar$q$, p_hacia, p_desde);
end;
$$ language plpgsql security definer set search_path = public;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: 4 roles (Dueño, Ejecutivo de ventas sin revisar, Operador, Secretaria); permisos_ventas = 12; funciones = 2.
select clave, nombre, revisado,
       (select count(*) from permisos_rol where rol::text = 'ventas') as permisos_ventas,
       (select count(*) from pg_proc where proname in ('crear_rol', 'copiar_permisos_rol')) as funciones
  from roles_app order by nombre;
