-- 40 · ESTANDARIZACIÓN · Paquete 19: seguridad (parte 1).
--   Cierra el acceso "anónimo" (sin iniciar sesión) a tablas y vistas.
--   Supabase da por defecto permiso de lectura a "anon" en todo lo nuevo, y la clave anon está pública en la app.
--   Las tablas ya lo bloquean con sus reglas, pero las vistas antiguas (v_salidas, export_clientes, etc.) no.
--   El login no se afecta: usa la función correo_para_login, que mantiene su permiso.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión (solo lectura) · mandar captura de cada consulta ══════════

-- 1a · Qué puede leer hoy alguien SIN iniciar sesión
select c.relname as objeto, case c.relkind when 'v' then 'vista' else 'tabla' end as tipo,
       coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') as respeta_reglas
  from information_schema.role_table_grants g
  join pg_class c on c.relname = g.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where g.grantee = 'anon' and g.table_schema = 'public' and g.privilege_type = 'SELECT'
 order by 2 desc, 1;

-- 1b · Funciones que usa Mi ruta (para la parte 2: operador)
select p.proname as funcion, pg_get_function_identity_arguments(p.oid) as argumentos,
       case when p.prosecdef then 'definer' else 'invoker' end as seguridad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where p.proname in ('iniciar_dia', 'cerrar_dia', 'marcar_parada_ruta', 'marcar_parada_ruta2', 'generar_ruta_semana',
                     'correo_para_login', 'es_planificador', 'tiene_permiso', 've_finanzas')
 order by 1;

-- 1c · Columnas que unen al operador con sus datos (para la parte 2)
select table_name as tabla, string_agg(column_name, ', ' order by ordinal_position) as columnas
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('rutas_semana', 'rutas_semana_lineas', 'salidas', 'salida_paradas', 'despachos', 'operacion_respaldos')
 group by table_name order by table_name;

-- 1d · Reglas de escritura de las tablas que toca Mi ruta
select tablename as tabla, policyname as regla, cmd, coalesce(qual, '') as usando, coalesce(with_check, '') as con_chequeo
  from pg_policies
 where schemaname = 'public' and tablename in ('operacion_respaldos', 'salidas', 'salida_paradas', 'insumo_existencias', 'vehiculo_disponibilidad')
 order by 1, 2;


-- ══ PASO 2 · Cerrar acceso anónimo (seleccionar hasta el PASO 3) ═══════════════
revoke select, insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;


-- ══ PASO 3 · Control (solo lectura) ═════════════════════════════════════════════
-- Esperado: lectura_anonima = 0 y login_ok = true
select (select count(*) from information_schema.role_table_grants
         where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT') as lectura_anonima,
       has_function_privilege('anon', 'correo_para_login(text)', 'execute')                as login_ok;
