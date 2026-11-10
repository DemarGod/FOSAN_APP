-- ════════════════════════════════════════════════════════════════════════════
-- FOSAN SpA — políticas de acceso (RLS)
-- Cuatro accesos: dos dueños (Anselmo y Gonzalo) con control total y dos
-- usuarios de solo lectura, que consultan y exportan pero no modifican nada.
-- Ejecutar después de 01_schema.sql
-- ════════════════════════════════════════════════════════════════════════════

create or replace function es_dueno() returns boolean as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'dueno' and activo
  );
$$ language sql stable security definer;

create or replace function tiene_acceso() returns boolean as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and activo
  );
$$ language sql stable security definer;

-- Activar RLS en todas las tablas de datos
do $$
declare t text;
begin
  foreach t in array array[
    'perfiles','clientes','ubicaciones','modelos_bano','activos','vehiculos',
    'movimientos_activo','documentos_activo','observaciones_activo',
    'servicios','servicio_activos','mantenciones','ventas','costos',
    'proveedores','insumos','compras','compra_lineas','eventos','notificaciones'
  ]
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Perfiles: cada usuario ve su perfil; los dueños ven y administran todos
create policy perfil_propio on perfiles for select using (id = auth.uid() or es_dueno());
create policy perfil_admin  on perfiles for all    using (es_dueno()) with check (es_dueno());

-- Resto de tablas: lectura para cualquier usuario activo, escritura solo dueños
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','ubicaciones','modelos_bano','activos','vehiculos',
    'movimientos_activo','documentos_activo','observaciones_activo',
    'servicios','servicio_activos','mantenciones','ventas','costos',
    'proveedores','insumos','compras','compra_lineas','eventos','notificaciones'
  ]
  loop
    execute format('create policy %I on %I for select using (tiene_acceso())', t || '_lectura', t);
    execute format('create policy %I on %I for all using (es_dueno()) with check (es_dueno())', t || '_escritura', t);
  end loop;
end $$;

-- Las vistas heredan las políticas de sus tablas base.
-- Storage: un bucket privado para fotos, documentos y códigos QR.
insert into storage.buckets (id, name, public)
values ('fosan', 'fosan', false)
on conflict (id) do nothing;

create policy "fosan_lectura" on storage.objects for select
  using (bucket_id = 'fosan' and tiene_acceso());
create policy "fosan_escritura" on storage.objects for all
  using (bucket_id = 'fosan' and es_dueno())
  with check (bucket_id = 'fosan' and es_dueno());
