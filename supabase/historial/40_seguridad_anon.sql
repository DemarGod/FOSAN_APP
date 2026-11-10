-- 40 · ESTANDARIZACIÓN · Paquete 19: seguridad (parte 1).
--   Cierra el acceso "anónimo" (sin iniciar sesión) a tablas y vistas.
--   Supabase da por defecto permiso de lectura a "anon" en todo lo nuevo, y la clave anon está pública en la app.
--   Las tablas ya lo bloquean con sus reglas, pero las vistas antiguas (v_salidas, export_clientes, etc.) no.
--   El login no se afecta: usa la función correo_para_login, que mantiene su permiso.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Cerrar acceso anónimo (seleccionar hasta el PASO 3) ═══════════════
revoke select, insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;

