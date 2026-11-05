-- 44 · ESTANDARIZACIÓN · Paquete 21: quién planifica rutas semanales.
--   Antes: solo dueño o el rol antiguo "administrador" (ya no existe desde el paquete 16b).
--   Ahora: dueño o cualquier rol con Operaciones → Registrar en Roles y permisos (ej. Secretaria).
--   Solo cambia es_planificador(). Las funciones de Cata (generar_ruta_semana, borrar_ruta_semana)
--   y las reglas de rutas_semana / rutas_semana_lineas la usan, así que quedan alineadas sin tocarlas.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión (solo lectura): quiénes planifican HOY ═══════════════════
select p.nombre, p.rol::text as rol
  from perfiles p
 where p.activo and p.rol::text in ('dueno', 'administrador')
 order by 2, 1;


-- ══ PASO 2 · Cambio (seleccionar hasta el PASO 3) ═══════════════════════════════
create or replace function es_planificador() returns boolean
language sql stable security definer set search_path = public as $$
  select es_dueno()
      or permiso_seccion('rutas', 'editar')                                                      -- Operaciones → Registrar
      or exists (select 1 from perfiles where id = auth.uid() and activo and rol::text = 'administrador');   -- rol antiguo
$$;


-- ══ PASO 3 · Control (solo lectura): quiénes planifican AHORA ═══════════════════
-- Esperado: dueño(s) + los roles con Operaciones → Registrar (ej. Secretaria).
select p.nombre, p.rol::text as rol
  from perfiles p
 where p.activo
   and (p.rol::text in ('dueno', 'administrador')
        or exists (select 1 from permisos_rol pr where pr.rol::text = p.rol::text and pr.seccion::text = 'rutas' and pr.ver and pr.editar))
 order by 2, 1;
