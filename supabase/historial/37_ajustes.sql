-- 37 · ESTANDARIZACIÓN · Paquete 16: ajustes generales de la app (por ahora: mostrar "Mi ruta" en el menú del dueño)
-- Solo agrega una tabla pequeña. La leen todos; solo el dueño la cambia.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Cambios (seleccionar hasta el PASO 2) ═════════════════════════════
create table if not exists ajustes (
  clave          text primary key,
  valor          text,
  actualizado_en timestamptz not null default now()
);
alter table ajustes enable row level security;
drop policy if exists ajustes_ver on ajustes;
drop policy if exists ajustes_dueno on ajustes;
create policy ajustes_ver on ajustes for select using (tiene_acceso());
create policy ajustes_dueno on ajustes for all using (es_dueno()) with check (es_dueno());
drop trigger if exists auditoria_ajustes on ajustes;
create trigger auditoria_ajustes after insert or update or delete on ajustes for each row execute function registrar_auditoria();
-- Por defecto, Mi ruta NO aparece en el menú del dueño (los operadores siempre la ven)
insert into ajustes (clave, valor) values ('menu_mi_ruta_dueno', '0') on conflict (clave) do nothing;


-- ══ PASO 2 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: 1 fila: menu_mi_ruta_dueno = 0
select clave, valor from ajustes order by clave;
