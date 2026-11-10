-- 42 · ESTANDARIZACIÓN · Paquete 19: seguridad (parte 2) · el operador solo lee lo de SU ruta.
--     · Ve sus rutas semanales, sus días de ruta, sus paradas, sus clientes, sus equipos y su vehículo.
--     · No ve costos, ventas, compras, inventario, mantenciones, personal, notificaciones ni otros clientes.
--   Dueño, secretaria, ventas y demás roles quedan EXACTAMENTE igual.


-- ══ PASO 1 · Cambios (seleccionar hasta el PASO 3) ══════════════════════════════
begin;

-- A. ¿Quién es operador y qué es "lo suyo"?
create or replace function es_operador() returns boolean as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol::text = 'operador' and activo)
$$ language sql stable security definer set search_path = public;

create or replace function op_rutas() returns setof uuid as $$
  select id from rutas_semana where operador_id = auth.uid()
$$ language sql stable security definer set search_path = public;

create or replace function op_salidas() returns setof uuid as $$
  select s.id from v_salidas s where s.ruta_semana_id in (select op_rutas())
$$ language sql stable security definer set search_path = public;

create or replace function op_clientes() returns setof uuid as $$
  select cliente_id from salida_paradas where salida_id in (select op_salidas()) and cliente_id is not null
  union
  select cliente_id from rutas_semana_lineas where ruta_id in (select op_rutas()) and cliente_id is not null
$$ language sql stable security definer set search_path = public;

create or replace function op_activos() returns setof uuid as $$
  select vehiculo_id from salidas where id in (select op_salidas()) and vehiculo_id is not null
  union
  select id from activos where cliente_id in (select op_clientes())
$$ language sql stable security definer set search_path = public;

-- B. Límites del operador (restrictivos: se suman a las reglas que ya existen)
do $$
declare t text; cond text;
begin
  for t, cond in values
    -- lo suyo
    ('rutas_semana',        'operador_id = auth.uid()'),
    ('rutas_semana_lineas', 'ruta_id in (select op_rutas())'),
    ('salidas',             'id in (select op_salidas())'),
    ('salida_paradas',      'salida_id in (select op_salidas())'),
    ('rutas',               'id in (select ruta_id from salidas where id in (select op_salidas()))'),
    ('despachos',           'salida_id in (select op_salidas()) or cliente_id in (select op_clientes())'),
    ('clientes',            'id in (select op_clientes())'),
    ('servicios_cliente',   'cliente_id in (select op_clientes())'),
    ('activos',             'id in (select op_activos())'),
    ('vehiculos',           'activo_id in (select op_activos())'),
    ('operacion_respaldos', 'creado_por = auth.uid()'),
    -- nada
    ('cliente_contactos', 'false'), ('compra_lineas', 'false'), ('compras', 'false'), ('costos', 'false'),
    ('documentos_activo', 'false'), ('eventos', 'false'), ('importaciones', 'false'), ('insumo_existencias', 'false'),
    ('insumo_lotes', 'false'), ('insumos', 'false'), ('mantenciones', 'false'), ('movimientos_activo', 'false'),
    ('movimientos_insumo', 'false'), ('notificaciones', 'false'), ('observaciones_activo', 'false'),
    ('ocupacion_diaria', 'false'), ('parametros', 'false'), ('personal', 'false'), ('proveedores', 'false'),
    ('receta_limpieza', 'false'), ('ruta_paradas', 'false'), ('servicio_activos', 'false'), ('servicios', 'false'),
    ('ubicaciones', 'false'), ('vehiculo_disponibilidad', 'false'), ('ventas', 'false')
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists op_limite on %I', t);
      execute format('create policy op_limite on %I as restrictive for select to authenticated using (not es_operador() or (%s))', t, cond);
    end if;
  end loop;
end $$;

-- C. Vistas: pasan a respetar las reglas solo si TODAS sus tablas son de lectura abierta (tiene_acceso()).
--    Así dueño, secretaria y ventas ven lo mismo que antes. Las que usan perfiles o finanzas no se tocan.
create table if not exists _vistas_42 (vista text primary key);   -- para poder deshacer
alter table _vistas_42 enable row level security;
do $$
declare v text;
begin
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
     where c.relkind = 'v'
       and coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') not in ('on', 'true')
       and not exists (
         select 1 from information_schema.view_table_usage u
           join pg_class t on t.relname = u.table_name and t.relnamespace = n.oid and t.relkind = 'r'
          where u.view_schema = 'public' and u.view_name = c.relname
            and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = u.table_name
                              and p.cmd in ('SELECT', 'ALL') and p.permissive = 'PERMISSIVE' and p.qual = 'tiene_acceso()'))
  loop
    execute format('alter view %I set (security_invoker = on)', v);
    insert into _vistas_42 values (v) on conflict do nothing;
  end loop;
end $$;

commit;


-- ══ PASO 2 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: limites ≈ 37, funciones = 5. La lista muestra qué vistas cambiaron y cuáles quedaron igual.
select (select count(*) from pg_policies where schemaname = 'public' and policyname = 'op_limite') as limites,
       (select count(*) from pg_proc where proname in ('es_operador','op_rutas','op_salidas','op_clientes','op_activos')) as funciones;

select c.relname as vista,
       case when exists (select 1 from _vistas_42 x where x.vista = c.relname) then 'ahora respeta reglas'
            when coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') in ('on','true') then 'ya respetaba'
            else 'sin cambio (usa perfiles o finanzas)' end as estado
  from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where c.relkind = 'v' order by 2, 1;

