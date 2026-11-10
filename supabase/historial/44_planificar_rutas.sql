-- 44 · ESTANDARIZACIÓN · Paquete 21: quién planifica rutas semanales.
--   Ahora: dueño o cualquier rol con Operaciones → Registrar en Roles y permisos (ej. Secretaria).
--   Solo cambia es_planificador(). Las funciones de Cata (generar_ruta_semana, borrar_ruta_semana)
--   y las reglas de rutas_semana / rutas_semana_lineas la usan, así que quedan alineadas sin tocarlas.


-- ══ PASO 1 · Cambio (seleccionar hasta el PASO 3) ═══════════════════════════════
create or replace function es_planificador() returns boolean
language sql stable security definer set search_path = public as $$
  select es_dueno()
      or permiso_seccion('rutas', 'editar')                                                      -- Operaciones → Registrar
      or exists (select 1 from perfiles where id = auth.uid() and activo and rol::text = 'administrador');   -- rol antiguo
$$;

