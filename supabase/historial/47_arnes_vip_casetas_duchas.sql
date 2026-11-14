-- 47 · Paquete 26: observaciones de la secretaria (Inventario).
--   A. Equipos "con arnés" y "VIP": dos casillas nuevas en el equipo. Se ven como etiqueta y se filtran en Inventario.
--   B. Categorías nuevas de equipo: Caseta y Ducha. Usan la MISMA numeración que los baños.
--   C. El "siguiente número de unidad" ahora mira todos los equipos propios (baños, casetas, duchas…), no solo los baños.
--   D. Deja marcados los baños con arnés y los VIP de la hoja que entregó la oficina (noviembre 2026).
-- Solo agrega. No borra ni cambia equipos, números ni situaciones.
-- Correr PASO POR PASO en Supabase → SQL Editor. Se puede ejecutar más de una vez.


-- ══ PASO 1 · Cambios (seleccionar hasta el PASO 2) ══════════════════════════════
begin;

-- A. Arnés y VIP
alter table activos add column if not exists con_arnes boolean not null default false;
alter table activos add column if not exists vip       boolean not null default false;
comment on column activos.con_arnes is 'El equipo tiene arnés (para izarlo). Se marca en la ficha del equipo.';
comment on column activos.vip       is 'Baño VIP. Se marca en la ficha del equipo.';

-- B. Casetas y duchas
insert into categorias (nombre, clase, descripcion) values
  ('Caseta', 'equipo', 'Caseta. Usa la misma numeración que los baños.'),
  ('Ducha',  'equipo', 'Ducha. Usa la misma numeración que los baños.')
on conflict (nombre) do update set activo = true;

-- C. Siguiente número libre: una sola numeración para todos los equipos propios (los vehículos no cuentan)
create or replace function siguiente_numero_unidad() returns bigint as $$
  select coalesce(max(codigo::bigint), 0) + 1 from activos
   where propiedad = 'empresa' and tipo::text not in ('camion', 'camioneta') and codigo ~ '^[0-9]+$';
$$ language sql stable security definer set search_path = public;

-- D. Baños con arnés y baños VIP (hoja de la oficina)
update activos set con_arnes = true
 where propiedad = 'empresa' and tipo = 'bano_quimico' and not con_arnes
   and ltrim(codigo, '0') in ('50', '58', '89', '96', '99', '181', '192', '208', '226', '248', '273', '282');
update activos set vip = true
 where propiedad = 'empresa' and tipo = 'bano_quimico' and not vip
   and ltrim(codigo, '0') in ('300', '306', '307');

commit;


-- ══ PASO 2 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: 15 filas, todas con "existe" = true; 12 con con_arnes = true y 3 con vip = true.
-- La columna "hoja" es lo que dice el papel: sirve para comparar la marca y el color con lo que tiene el sistema.
select x.numero, x.hoja, (a.id is not null) as existe, a.con_arnes, a.vip,
       coalesce(m.nombre, a.marca) as marca_sistema, a.color as color_sistema, a.situacion
  from (values
    ('50',  'Arnés · ARMAL · ROSADO'),  ('58',  'Arnés · ARMAL · VERDE OSCURO'), ('89',  'Arnés · ARMAL · AZUL'),
    ('96',  'Arnés · ARMAL · VERDE'),   ('99',  'Arnés · POLY · AZUL'),          ('181', 'Arnés · POLY · CELESTE'),
    ('192', 'Arnés · ARMAL · CELESTE'), ('208', 'Arnés · ARMAL · CELESTE'),      ('226', 'Arnés · POLY · CELESTE'),
    ('248', 'Arnés · ARMAL · CELESTE'), ('273', 'Arnés · ARMAL · CELESTE'),      ('282', 'Arnés · ARMAL · CELESTE'),
    ('300', 'VIP · ARMAL · CELESTE'),   ('306', 'VIP · ARMAL · CELESTE'),        ('307', 'VIP · ARMAL · CELESTE')
  ) as x(numero, hoja)
  left join activos a on ltrim(a.codigo, '0') = x.numero and a.propiedad = 'empresa' and a.tipo = 'bano_quimico'
  left join modelos_bano m on m.id = a.modelo_id
 order by x.numero::int;

-- Esperado: Caseta y Ducha activas, y el siguiente número libre de unidad.
select (select string_agg(nombre, ', ' order by nombre) from categorias where nombre in ('Caseta', 'Ducha') and activo) as categorias_nuevas,
       siguiente_numero_unidad() as siguiente_numero;
