-- ════════════════════════════════════════════════════════════════════════════
-- FOSAN SpA — datos iniciales
-- Ejecutar después de 01_schema.sql y 02_rls.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Accesos ────────────────────────────────────────────────────────────────
-- Los usuarios NO se crean por SQL: se crean en Authentication → Users.
-- Este bloque sí se ejecuta y hace que el perfil se cree solo, con el rol
-- correcto, en el momento en que das de alta cada usuario en Auth.
-- Los cuatro correos autorizados van en esta lista:
create table if not exists accesos_autorizados (
  correo text primary key,
  nombre text not null,
  rol    rol_usuario not null
);

insert into accesos_autorizados (correo, nombre, rol) values
  ('cataabarrazam@gmail.com',             'Catalina', 'dueno'),
  ('doraliza.contreras@alumnos.ucm.cl',   'Doraliza', 'dueno'),
  ('usuario3@fosan.cl',                   'Usuario 3', 'lectura'),
  ('usuario4@fosan.cl',                   'Usuario 4', 'lectura')
on conflict (correo) do update
  set nombre = excluded.nombre, rol = excluded.rol;

-- Al crear el usuario en Auth, su perfil queda listo automáticamente.
create or replace function crear_perfil_desde_auth() returns trigger as $$
declare a accesos_autorizados;
begin
  select * into a from accesos_autorizados where correo = lower(new.email);
  if a.correo is null then
    return new;   -- correo no autorizado: no se crea perfil, no tendrá acceso
  end if;
  insert into perfiles (id, nombre, correo, rol)
  values (new.id, a.nombre, a.correo, a.rol)
  on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_perfil_auth on auth.users;
create trigger trg_perfil_auth after insert on auth.users
for each row execute function crear_perfil_desde_auth();

-- Si los usuarios ya existían en Auth antes de correr esto, esta línea
-- les crea el perfil de una vez:
insert into perfiles (id, nombre, correo, rol)
select u.id, a.nombre, a.correo, a.rol
from auth.users u join accesos_autorizados a on a.correo = lower(u.email)
on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol;

-- 2) Modelos de baño ───────────────────────────────────────────────────────
insert into modelos_bano (nombre, tipo, valor_arriendo_ref, descripcion) values
  ('Básico',    'estándar',          45000, 'Baño químico estándar'),
  ('Premium',   'con lavamanos',     62000, 'Con lavamanos y dispensador'),
  ('Accesible', 'discapacitados',    78000, 'Cabina ampliada con acceso universal');

-- 3) Ubicaciones ───────────────────────────────────────────────────────────
insert into ubicaciones (nombre, tipo, comuna, lat, lng) values
  ('Bodega central Talca', 'bodega', 'Talca',        -35.426400, -71.655400),
  ('Taller Maule',         'taller', 'Maule',        -35.533300, -71.716700),
  ('Faena San Clemente',   'faena',  'San Clemente', -35.533300, -71.483300),
  ('Villa Alegre',         'faena',  'Villa Alegre', -35.668600, -71.746100),
  ('Linares',              'faena',  'Linares',      -35.846700, -71.593100),
  ('Constitución',         'faena',  'Constitución', -35.333200, -72.416700);

-- 4) Clientes ──────────────────────────────────────────────────────────────
insert into clientes (nombre, rubro, contacto_nombre, telefono, comuna, lat, lng, fecha_fin_contrato, valor_mensual) values
  ('Constructora Andes',  'construccion', 'María Torres',   '+56 9 1234 5678', 'San Clemente', -35.533300, -71.483300, '2026-12-31', 540000),
  ('Minera Sur',          'mineria',      'Pedro González', '+56 9 2345 6789', 'Talca',        -35.426400, -71.655400, null,         360000),
  ('Eventos del Valle',   'eventos',      'Ana Ríos',       '+56 9 3456 7890', 'Constitución', -35.333200, -72.416700, '2026-11-15', 225000),
  ('Municipalidad Talca', 'publico',      'Jorge Mena',     '+56 9 4567 8901', 'Talca',        null,       null,       '2027-06-30', 405000),
  ('Agroindustrial SPA',  'agricola',     'Luis Ramírez',   '+56 9 5678 9012', 'Villa Alegre', null,       null,       '2026-08-31', 180000),
  ('Constructora Norte',  'construccion', 'Carla Díaz',     '+56 9 6789 0123', 'Linares',      -35.846700, -71.593100, '2027-02-28', 945000);

-- 5) Proveedores e insumos ─────────────────────────────────────────────────
insert into proveedores (nombre, contacto, telefono) values
  ('SAYPOR', 'Ventas', '+56 2 2345 6789'),
  ('Distribuidora Maule', 'Mostrador', '+56 71 221 3344');

insert into insumos (nombre, unidad, stock_actual, stock_minimo, costo_unitario) values
  ('Químico desodorizante', 'litro', 240, 80, 4200),
  ('Papel higiénico',       'caja',   65, 20, 18900),
  ('Jabón líquido',         'litro',  48, 15,  3100);

-- 6) Activos de ejemplo ────────────────────────────────────────────────────
-- Baños: se asignan modelo, ubicación y cliente por nombre.
insert into activos (codigo, tipo, modelo_id, estado, cliente_id, ubicacion_id, valor_arriendo, fecha_compra)
select v.codigo, 'bano_quimico', m.id, v.estado::estado_activo, c.id, u.id, m.valor_arriendo_ref, v.compra::date
from (values
  ('BQ-037','Básico','en_arriendo','Constructora Andes','Faena San Clemente','2019-03-14'),
  ('BQ-038','Básico','disponible',  null,               'Bodega central Talca','2019-03-14'),
  ('BQ-039','Premium','mantencion', null,               'Taller Maule','2020-07-02'),
  ('BQ-040','Básico','en_arriendo','Minera Sur',        'Linares','2021-01-20'),
  ('BQ-041','Básico','disponible',  null,               'Bodega central Talca','2021-01-20'),
  ('BQ-042','Accesible','en_arriendo','Eventos del Valle','Constitución','2022-05-11'),
  ('BQ-043','Básico','disponible',  null,               'Bodega central Talca','2022-05-11'),
  ('BQ-044','Premium','en_arriendo','Constructora Norte','Linares','2023-09-08')
) as v(codigo, modelo, estado, cliente, ubicacion, compra)
join modelos_bano m on m.nombre = v.modelo
join ubicaciones u  on u.nombre = v.ubicacion
left join clientes c on c.nombre = v.cliente;

-- Camiones y camionetas
insert into activos (codigo, tipo, detalle, estado, ubicacion_id, fecha_compra)
select v.codigo, v.tipo::tipo_activo, v.detalle, v.estado::estado_activo, u.id, v.compra::date
from (values
  ('CAM-01','camion','Aljibe 10.000 L','en_servicio','Faena San Clemente','2018-04-02'),
  ('CAM-02','camion','Aljibe 15.000 L','mantencion', 'Taller Maule','2019-11-15'),
  ('CAM-03','camion','Aljibe 8.000 L', 'en_servicio','Bodega central Talca','2020-06-30'),
  ('CAM-04','camioneta','Reparto',     'disponible', 'Bodega central Talca','2021-08-19'),
  ('CAM-05','camion','Aljibe 12.000 L','en_servicio','Linares','2022-02-07')
) as v(codigo, tipo, detalle, estado, ubicacion, compra)
join ubicaciones u on u.nombre = v.ubicacion;

-- Patentes y documentación de la flota
insert into vehiculos (activo_id, patente, marca, modelo, anio, capacidad_litros, conductor, revision_tecnica, permiso_circulacion)
select a.id, v.patente, v.marca, v.modelo, v.anio, v.litros, v.conductor, v.rt::date, v.pc::date
from (values
  ('CAM-01','JKLM-12','Hino','500',        2018, 10000,'J. Torres',   '2027-03-31','2027-03-31'),
  ('CAM-02','NOPQ-34','Mercedes','Atego',  2019, 15000,'L. Rojas',    '2027-01-31','2027-03-31'),
  ('CAM-03','RSTU-56','Hino','300',        2020,  8000,'M. Pérez',    '2027-05-31','2027-03-31'),
  ('CAM-04','VWXY-78','Volkswagen','Amarok',2021, 5000,'—',           '2027-07-31','2027-03-31'),
  ('CAM-05','ZABC-90','Iveco','Tector',    2022, 12000,'A. Fuentes',  '2027-09-30','2027-03-31')
) as v(codigo, patente, marca, modelo, anio, litros, conductor, rt, pc)
join activos a on a.codigo = v.codigo;

-- Otros activos
insert into activos (codigo, tipo, detalle, estado, ubicacion_id)
select v.codigo, v.tipo::tipo_activo, v.detalle, 'disponible', u.id
from (values
  ('GEN-01','generador','5 KVA','Bodega central Talca'),
  ('LAV-01','lavamanos','Portátil','Bodega central Talca'),
  ('AC-01','accesorio','Estanque de repuesto','Bodega central Talca')
) as v(codigo, tipo, detalle, ubicacion)
join ubicaciones u on u.nombre = v.ubicacion;

-- 7) Mantenciones ──────────────────────────────────────────────────────────
insert into mantenciones (activo_id, clase, tipo, fecha_programada, responsable_ext, costo, estado)
select a.id, v.clase::clase_mantencion, v.tipo, v.fecha::date, v.resp, v.costo, v.estado::estado_mantencion
from (values
  ('CAM-02','camion','Cambio de aceite',      '2026-09-25','L. Rojas',   320000,'proxima'),
  ('BQ-041','bano','Mantención puntual',      '2026-09-23','M. López',    38000,'urgente'),
  ('CAM-01','camion','Revisión técnica',      '2026-09-30','J. Torres',  180000,'programada'),
  ('CAM-04','camioneta','Cambio de neumáticos','2026-10-02','A. Fuentes',410000,'programada'),
  ('BQ-039','bano','Reparación de puerta',    '2026-09-19','M. López',    26000,'completada')
) as v(codigo, clase, tipo, fecha, resp, costo, estado)
join activos a on a.codigo = v.codigo;

-- 8) Ventas y costos del mes (se reemplazan al importar Maxxa) ─────────────
insert into ventas (folio_maxxa, fecha, cliente_id, tipo_servicio, neto, iva, total, pagada)
select v.folio, v.fecha::date, c.id, v.tipo::tipo_servicio, v.neto, round(v.neto * 0.19), round(v.neto * 1.19), v.pagada
from (values
  ('M-10231','2026-09-05','Constructora Andes','arriendo_bano', 15700000, true),
  ('M-10232','2026-09-10','Minera Sur','limpieza_bano',          6400000, true),
  ('M-10233','2026-09-15','Eventos del Valle','limpieza_fosa',   4900000, false),
  ('M-10234','2026-09-20','Constructora Norte','arriendo_bano',  1500000, false)
) as v(folio, fecha, cliente, tipo, neto, pagada)
join clientes c on c.nombre = v.cliente;

insert into costos (fecha, categoria, monto, detalle) values
  ('2026-09-05','transporte',    3100000,'Combustible y peajes'),
  ('2026-09-08','insumos',       2400000,'Compra SAYPOR'),
  ('2026-09-12','mano_obra',     7200000,'Remuneraciones operativas'),
  ('2026-09-20','mantencion',     964000,'Mantenciones del mes'),
  ('2026-09-28','administracion',2536000,'Gastos generales');

-- 9) Calendario ────────────────────────────────────────────────────────────
insert into eventos (fecha, tipo, titulo) values
  ('2026-09-23','mantencion','BQ-041 · mantención puntual'),
  ('2026-09-25','pago','Pago proveedor de químicos'),
  ('2026-09-30','servicio','Retiro de baños · Faena Maule');
