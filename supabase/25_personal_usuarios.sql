-- 25 · ESTANDARIZACIÓN · ETAPA 2 · Paquete 6b: Personal y usuarios
-- Solo agrega. No borra cuentas, personas ni permisos.
--   A. Nombre de usuario (ej. ana.perez) además del correo: se puede entrar con cualquiera de los dos.
--   B. Cada cuenta del sistema tiene su persona en "personal" (las que falten se crean).
--   C. RUT de personal sin repetir.
-- Correr PASO POR PASO en Supabase → SQL Editor: seleccionar cada bloque y apretar Run.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Esperado: funciones_actuales = 3 (crear_usuario, cambiar_clave_usuario, eliminar_usuario).
select (select count(*) from perfiles)                                                        as cuentas,
       (select count(*) from personal)                                                        as personas,
       (select count(*) from perfiles p where not exists (select 1 from personal x where x.perfil_id = p.id)) as cuentas_sin_persona,
       (select count(distinct proname) from pg_proc
         where proname in ('crear_usuario','cambiar_clave_usuario','eliminar_usuario'))       as funciones_actuales,
       (select count(*) from (select upper(regexp_replace(rut,'[^0-9kK]','','g')) r from personal
          where coalesce(rut,'') <> '' group by 1 having count(*) > 1) d)                     as ruts_repetidos;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
-- A. Nombre de usuario: minúsculas, números, punto, guion o guion bajo; único
alter table perfiles add column if not exists usuario text;
do $$ begin
  alter table perfiles add constraint perfiles_usuario_formato check (usuario is null or usuario ~ '^[a-z0-9._-]{3,40}$');
exception when duplicate_object then null; end $$;
create unique index if not exists perfiles_usuario_unico on perfiles (lower(usuario)) where usuario is not null;

-- Para entrar con el nombre de usuario: devuelve el correo de esa cuenta activa (solo eso)
create or replace function correo_para_login(p_usuario text) returns text as $$
  select correo from perfiles
   where usuario is not null and lower(usuario) = lower(trim(p_usuario)) and activo
   limit 1;
$$ language sql stable security definer set search_path = public;
grant execute on function correo_para_login(text) to anon, authenticated;

-- B. Cuentas sin persona en "personal"
insert into personal (nombre, funcion, perfil_id, activo)
select p.nombre, p.rol::text, p.id, p.activo from perfiles p
where not exists (select 1 from personal x where x.perfil_id = p.id);

-- C. RUT de personal sin repetir (comparado sin puntos ni guion)
alter table personal add column if not exists rut_norm text
  generated always as (upper(regexp_replace(coalesce(rut, ''), '[^0-9kK]', '', 'g'))) stored;
create unique index if not exists personal_rut_unico on personal (rut_norm) where rut_norm <> '';


-- ══ PASO 3 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: columna_usuario = 1, funcion_login = 1, cuentas_sin_persona = 0.
select (select count(*) from information_schema.columns where table_name = 'perfiles' and column_name = 'usuario') as columna_usuario,
       (select count(*) from pg_proc where proname = 'correo_para_login')                                          as funcion_login,
       (select count(*) from perfiles p where not exists (select 1 from personal x where x.perfil_id = p.id))      as cuentas_sin_persona,
       (select count(*) from personal)                                                                             as personas;
