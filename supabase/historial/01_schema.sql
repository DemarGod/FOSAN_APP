-- ════════════════════════════════════════════════════════════════════════════
-- FOSAN SpA — esquema completo (Supabase / PostgreSQL)
-- v2 · alineado con la app: inventario, baños químicos, camiones y patentes,
--      clientes, ubicaciones, mantenciones, ventas y utilidades, QR por unidad,
--      documentos, observaciones, calendario y notificaciones.
-- Fuera de alcance por decisión del proyecto: planificación de rutas.
-- Orden de ejecución: 01_schema.sql → 02_rls.sql → 03_seed.sql
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────  Enumeraciones  ─────────────────────────────
create type rol_usuario       as enum ('dueno','lectura');
create type tipo_activo       as enum ('bano_quimico','camion','camioneta','generador','lavamanos','accesorio');
create type estado_activo     as enum ('disponible','en_arriendo','en_servicio','mantencion','fuera_de_servicio','baja');
create type tipo_ubicacion    as enum ('bodega','faena','taller','transito','cliente');
create type tipo_servicio     as enum ('arriendo_bano','limpieza_bano','limpieza_fosa','instalacion','retiro','traslado','otro');
create type estado_servicio   as enum ('pendiente','en_proceso','completado','anulado');
create type clase_mantencion  as enum ('bano','camion','camioneta','equipo');
create type estado_mantencion as enum ('programada','proxima','urgente','completada','anulada');
create type rubro_cliente     as enum ('construccion','agricola','eventos','mineria','publico','otro');
create type tipo_documento    as enum ('factura','certificado','guia_despacho','revision_tecnica','seguro','otro');
create type tipo_evento       as enum ('mantencion','pago','servicio','alerta','reunion');
create type categoria_costo   as enum ('transporte','insumos','mano_obra','mantencion','administracion','otro');

-- ─────────────────────────────  Accesos  ───────────────────────────────────
-- Solo cuatro accesos: dos dueños con control total (Anselmo y Gonzalo) y dos
-- usuarios de solo lectura. El alta real se hace en Auth; acá va el perfil.
create table perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  correo     text not null unique,
  rol        rol_usuario not null default 'lectura',
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- ─────────────────────────────  Clientes  ──────────────────────────────────
create table clientes (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  rut                   text unique,
  rubro                 rubro_cliente not null default 'construccion',
  contacto_nombre       text,
  telefono              text,
  correo                text,
  direccion             text,
  comuna                text default 'Talca',
  lat                   numeric(9,6),
  lng                   numeric(9,6),
  fecha_inicio_contrato date,
  fecha_fin_contrato    date,            -- null = contrato indefinido
  valor_mensual         integer,         -- CLP acordado
  activo                boolean not null default true,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);
create index on clientes (nombre);
create index on clientes (comuna);

-- Georreferencia: true cuando el cliente ya fue ubicado en el mapa
create or replace function cliente_georreferenciado(c clientes) returns boolean as $$
  select c.lat is not null and c.lng is not null;
$$ language sql stable;

-- ─────────────────────────────  Ubicaciones  ───────────────────────────────
create table ubicaciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  tipo        tipo_ubicacion not null default 'faena',
  cliente_id  uuid references clientes(id) on delete set null,
  direccion   text,
  comuna      text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);
create index on ubicaciones (tipo);
create index on ubicaciones (cliente_id);

-- ─────────────────────────────  Catálogo de modelos de baño  ───────────────
create table modelos_bano (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null unique,   -- Básico, Premium, Accesible
  tipo               text not null,          -- estándar, con lavamanos, discapacitados, ducha
  valor_arriendo_ref integer,                -- CLP mensual de referencia
  descripcion        text
);

-- ─────────────────────────────  Activos (trazabilidad por unidad)  ─────────
create table activos (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique,        -- BQ-037, CAM-01, GEN-01
  tipo              tipo_activo not null,
  modelo_id         uuid references modelos_bano(id) on delete set null,
  detalle           text,                        -- "Aljibe 10.000 L", "5 KVA"
  serie             text,
  estado            estado_activo not null default 'disponible',
  habilitado        boolean not null default true,  -- apto para arrendar
  cliente_id        uuid references clientes(id) on delete set null,
  ubicacion_id      uuid references ubicaciones(id) on delete set null,
  valor_arriendo    integer,                     -- CLP mensual
  fecha_compra      date,
  costo_adquisicion integer,
  foto_url          text,
  qr_token          uuid not null unique default gen_random_uuid(),  -- identidad del QR
  notas             text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index on activos (tipo, estado);
create index on activos (cliente_id);
create index on activos (ubicacion_id);
create index on activos (qr_token);

-- Datos propios de camiones y camionetas (patente y documentación)
create table vehiculos (
  activo_id            uuid primary key references activos(id) on delete cascade,
  patente              text not null unique,
  marca                text,
  modelo               text,
  anio                 integer,
  capacidad_litros     integer,
  conductor            text,
  kilometraje          integer,
  revision_tecnica     date,
  permiso_circulacion  date,
  seguro_obligatorio   date
);
create index on vehiculos (patente);

-- Cada movimiento de un activo queda registrado (trazabilidad)
create table movimientos_activo (
  id             bigserial primary key,
  activo_id      uuid not null references activos(id) on delete cascade,
  fecha          timestamptz not null default now(),
  tipo           text not null,        -- instalacion | traslado | retiro | limpieza | mantencion | ingreso
  desde_id       uuid references ubicaciones(id),
  hacia_id       uuid references ubicaciones(id),
  cliente_id     uuid references clientes(id),
  responsable_id uuid references perfiles(id),
  detalle        text
);
create index on movimientos_activo (activo_id, fecha desc);

-- Documentos y observaciones por unidad (pestañas de la ficha)
create table documentos_activo (
  id         uuid primary key default gen_random_uuid(),
  activo_id  uuid not null references activos(id) on delete cascade,
  tipo       tipo_documento not null default 'otro',
  titulo     text not null,
  archivo_url text not null,           -- Supabase Storage
  tamano_kb  integer,
  subido_por uuid references perfiles(id),
  creado_en  timestamptz not null default now()
);
create index on documentos_activo (activo_id, creado_en desc);

create table observaciones_activo (
  id         uuid primary key default gen_random_uuid(),
  activo_id  uuid not null references activos(id) on delete cascade,
  texto      text not null,
  autor_id   uuid references perfiles(id),
  creado_en  timestamptz not null default now()
);
create index on observaciones_activo (activo_id, creado_en desc);

-- ─────────────────────────────  Servicios  ─────────────────────────────────
create sequence if not exists folio_servicio_seq start 1;

create table servicios (
  id               uuid primary key default gen_random_uuid(),
  folio            text not null unique default ('S-' || lpad(nextval('folio_servicio_seq')::text, 5, '0')),
  fecha            date not null default current_date,
  tipo             tipo_servicio not null,
  cliente_id       uuid not null references clientes(id) on delete restrict,
  ubicacion_id     uuid references ubicaciones(id) on delete set null,
  responsable_id   uuid references perfiles(id),
  valor            integer not null default 0,   -- CLP neto
  costo_transporte integer not null default 0,   -- Maxxa no lo registra: acá sí
  estado           estado_servicio not null default 'pendiente',
  observaciones    text,
  creado_en        timestamptz not null default now()
);
create index on servicios (fecha desc);
create index on servicios (cliente_id, estado);
create index on servicios (tipo, fecha desc);

create table servicio_activos (
  servicio_id uuid not null references servicios(id) on delete cascade,
  activo_id   uuid not null references activos(id) on delete restrict,
  primary key (servicio_id, activo_id)
);

-- ─────────────────────────────  Mantenciones (baños y flota)  ──────────────
create table mantenciones (
  id               uuid primary key default gen_random_uuid(),
  activo_id        uuid not null references activos(id) on delete cascade,
  clase            clase_mantencion not null default 'bano',
  tipo             text not null,             -- cambio de aceite, revisión técnica, reparación de puerta…
  fecha_programada date not null,
  fecha_realizada  date,
  responsable_id   uuid references perfiles(id),
  responsable_ext  text,                      -- taller externo
  costo            integer not null default 0,
  estado           estado_mantencion not null default 'programada',
  foto_url         text,
  detalle          text,
  creado_en        timestamptz not null default now()
);
create index on mantenciones (fecha_programada);
create index on mantenciones (activo_id, fecha_programada desc);
create index on mantenciones (clase, estado);

-- ─────────────────────────────  Ventas y utilidades  ───────────────────────
-- Cabecera de factura tal como llega del ERP Maxxa (importación por Excel).
create table ventas (
  id             uuid primary key default gen_random_uuid(),
  folio_maxxa    text unique,
  fecha          date not null,
  cliente_id     uuid references clientes(id) on delete set null,
  servicio_id    uuid references servicios(id) on delete set null,
  tipo_servicio  tipo_servicio,
  neto           integer not null default 0,
  iva            integer not null default 0,
  total          integer not null default 0,
  pagada         boolean not null default false,
  fecha_pago     date,
  origen         text not null default 'maxxa',  -- maxxa | manual
  creado_en      timestamptz not null default now()
);
create index on ventas (fecha desc);
create index on ventas (cliente_id);

create table costos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  categoria  categoria_costo not null,
  monto      integer not null default 0,
  servicio_id uuid references servicios(id) on delete set null,
  activo_id  uuid references activos(id) on delete set null,
  detalle    text,
  creado_en  timestamptz not null default now()
);
create index on costos (fecha desc);
create index on costos (categoria);

-- ─────────────────────────────  Compras e insumos  ─────────────────────────
create table proveedores (
  id       uuid primary key default gen_random_uuid(),
  nombre   text not null,                  -- SAYPOR concentra cerca del 90%
  rut      text unique,
  contacto text,
  telefono text,
  activo   boolean not null default true
);

create table insumos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  unidad         text not null default 'unidad',
  stock_actual   numeric(12,2) not null default 0,
  stock_minimo   numeric(12,2) not null default 0,
  costo_unitario integer
);

create table compras (
  id           uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores(id) on delete restrict,
  fecha        date not null default current_date,
  documento    text,
  total        integer not null default 0,
  creado_en    timestamptz not null default now()
);

create table compra_lineas (
  id             bigserial primary key,
  compra_id      uuid not null references compras(id) on delete cascade,
  insumo_id      uuid not null references insumos(id) on delete restrict,
  cantidad       numeric(12,2) not null,
  costo_unitario integer not null
);

-- ─────────────────────────────  Calendario y notificaciones  ───────────────
create table eventos (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  tipo       tipo_evento not null default 'mantencion',
  titulo     text not null,
  activo_id  uuid references activos(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  creado_por uuid references perfiles(id),
  creado_en  timestamptz not null default now()
);
create index on eventos (fecha);

create table notificaciones (
  id         uuid primary key default gen_random_uuid(),
  texto      text not null,
  nivel      text not null default 'info',   -- info | aviso | alerta
  activo_id  uuid references activos(id) on delete set null,
  leida      boolean not null default false,
  creado_en  timestamptz not null default now()
);
create index on notificaciones (leida, creado_en desc);

-- ─────────────────────────────  Vistas del dashboard  ──────────────────────
create or replace view v_resumen_inventario as
select
  count(*)                                                        as total_activos,
  count(*) filter (where tipo = 'bano_quimico')                   as total_banos,
  count(*) filter (where tipo in ('camion','camioneta'))          as total_vehiculos,
  count(*) filter (where estado = 'disponible')                   as total_disponibles,
  count(*) filter (where estado in ('en_arriendo','en_servicio')) as total_en_uso,
  count(*) filter (where estado = 'mantencion')                   as total_mantencion,
  count(*) filter (where estado = 'fuera_de_servicio')            as total_fuera_servicio
from activos where estado <> 'baja';

create or replace view v_estado_activos as
select estado, count(*) as total,
       round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as porcentaje
from activos where estado <> 'baja'
group by estado;

create or replace view v_banos_kpi as
select
  count(*)                                              as total,
  count(*) filter (where estado = 'en_arriendo')        as en_arriendo,
  count(*) filter (where estado = 'disponible')         as disponibles,
  count(*) filter (where estado = 'mantencion')         as mantencion,
  count(*) filter (where estado = 'fuera_de_servicio')  as fuera_servicio
from activos where tipo = 'bano_quimico' and estado <> 'baja';

-- Inventario con nombres resueltos (lo que consume la tabla de la app)
create or replace view v_inventario as
select a.id, a.codigo, a.tipo, coalesce(m.nombre, a.detalle) as detalle,
       a.estado, a.habilitado, c.nombre as cliente, u.nombre as ubicacion,
       (u.tipo = 'bodega') as en_bodega, a.valor_arriendo, a.qr_token,
       (select max(mv.fecha) from movimientos_activo mv where mv.activo_id = a.id) as ultimo_movimiento
from activos a
left join modelos_bano m on m.id = a.modelo_id
left join clientes c     on c.id = a.cliente_id
left join ubicaciones u  on u.id = a.ubicacion_id
where a.estado <> 'baja';

-- Puntos del mapa: un registro por ubicación, con desglose
create or replace view v_mapa_puntos as
select u.id, u.nombre, u.tipo, u.lat, u.lng,
       c.nombre as cliente,
       count(a.id)                                            as activos,
       count(a.id) filter (where a.tipo = 'bano_quimico')     as banos,
       count(a.id) filter (where a.tipo in ('camion','camioneta')) as vehiculos,
       count(a.id) filter (where a.estado = 'mantencion')     as en_mantencion
from ubicaciones u
left join clientes c on c.id = u.cliente_id
left join activos a  on a.ubicacion_id = u.id and a.estado <> 'baja'
where u.activa and u.lat is not null
group by u.id, u.nombre, u.tipo, u.lat, u.lng, c.nombre;

create or replace view v_clientes_resumen as
select c.id, c.nombre, c.rubro, c.contacto_nombre, c.telefono, c.comuna,
       c.fecha_fin_contrato,
       case
         when c.fecha_fin_contrato is null then 'indefinido'
         when c.fecha_fin_contrato >= current_date then 'vigente'
         else 'vencido'
       end                                             as vigencia,
       (c.lat is not null and c.lng is not null)        as georreferenciado,
       count(a.id)                                      as banos_activos,
       coalesce(sum(a.valor_arriendo), 0)               as valor_mensual
from clientes c
left join activos a on a.cliente_id = c.id and a.estado = 'en_arriendo'
group by c.id;

create or replace view v_mantenciones_kpi as
select
  count(*) filter (where date_trunc('month', fecha_programada) = date_trunc('month', current_date)) as del_mes,
  count(*) filter (where estado in ('programada','proxima'))  as proximas,
  count(*) filter (where estado = 'urgente')                  as urgentes,
  count(*) filter (where estado = 'completada')               as realizadas,
  coalesce(sum(costo) filter (where estado = 'completada'), 0) as costo_realizado
from mantenciones;

create or replace view v_ventas_mensual as
select date_trunc('month', v.fecha)::date as mes,
       sum(v.neto)                        as ventas,
       count(*)                           as documentos
from ventas v group by 1 order by 1;

create or replace view v_utilidad_mensual as
select m.mes,
       coalesce(v.ventas, 0)                                   as ventas,
       coalesce(c.costos, 0)                                   as costos,
       coalesce(v.ventas, 0) - coalesce(c.costos, 0)           as utilidad,
       round(100.0 * (coalesce(v.ventas, 0) - coalesce(c.costos, 0))
             / nullif(v.ventas, 0), 1)                         as margen
from (
  select date_trunc('month', fecha)::date as mes from ventas
  union
  select date_trunc('month', fecha)::date from costos
) m
left join (select date_trunc('month', fecha)::date as mes, sum(neto) as ventas from ventas group by 1) v using (mes)
left join (select date_trunc('month', fecha)::date as mes, sum(monto) as costos from costos group by 1) c using (mes)
order by m.mes;

create or replace view v_utilidad_por_servicio as
select date_trunc('month', v.fecha)::date as mes,
       v.tipo_servicio,
       sum(v.neto)                                        as ventas,
       coalesce(sum(s.costo_transporte), 0)               as costo_transporte,
       count(*)                                           as documentos
from ventas v
left join servicios s on s.id = v.servicio_id
group by 1, 2 order by 1, 2;

create or replace view v_top_clientes as
select c.nombre, sum(v.neto) as ingresos, count(*) as documentos
from ventas v join clientes c on c.id = v.cliente_id
group by c.nombre order by ingresos desc;

create or replace view v_servicios_mes as
select tipo, count(*) as cantidad
from servicios
where date_trunc('month', fecha) = date_trunc('month', current_date)
group by tipo;

-- ─────────────────────────────  Vistas de exportación a Excel  ─────────────
-- Una vista por pestaña del libro que genera la pestaña Reportes.
create or replace view export_ingresos_costos as
select mes, ventas, costos, utilidad, margen from v_utilidad_mensual;

create or replace view export_ventas_utilidad as
select v.fecha, c.nombre as cliente, v.tipo_servicio, v.neto, v.iva, v.total, v.pagada
from ventas v left join clientes c on c.id = v.cliente_id
order by v.fecha desc;

create or replace view export_servicios as
select s.folio, s.fecha, s.tipo, c.nombre as cliente, u.nombre as ubicacion,
       s.valor, s.costo_transporte, s.estado,
       (select count(*) from servicio_activos sa where sa.servicio_id = s.id) as activos
from servicios s
left join clientes c    on c.id = s.cliente_id
left join ubicaciones u on u.id = s.ubicacion_id
order by s.fecha desc;

create or replace view export_activos as
select codigo, tipo, detalle, estado, cliente, ubicacion, valor_arriendo, ultimo_movimiento
from v_inventario order by codigo;

create or replace view export_mantenciones as
select m.fecha_programada, m.fecha_realizada, a.codigo as activo, m.clase, m.tipo,
       coalesce(p.nombre, m.responsable_ext) as responsable, m.costo, m.estado, m.detalle
from mantenciones m
join activos a on a.id = m.activo_id
left join perfiles p on p.id = m.responsable_id
order by m.fecha_programada desc;

create or replace view export_clientes as
select nombre, rubro, contacto_nombre, telefono, comuna, vigencia,
       banos_activos, valor_mensual, georreferenciado
from v_clientes_resumen order by nombre;

-- ─────────────────────────────  Triggers  ──────────────────────────────────
create or replace function set_actualizado_en() returns trigger as $$
begin new.actualizado_en = now(); return new; end;
$$ language plpgsql;

create trigger trg_activos_upd before update on activos
for each row execute function set_actualizado_en();

create trigger trg_clientes_upd before update on clientes
for each row execute function set_actualizado_en();

-- Todo cambio de ubicación, estado o cliente de un activo deja rastro
create or replace function registrar_movimiento_activo() returns trigger as $$
begin
  if (new.ubicacion_id is distinct from old.ubicacion_id)
     or (new.estado is distinct from old.estado)
     or (new.cliente_id is distinct from old.cliente_id) then
    insert into movimientos_activo (activo_id, tipo, desde_id, hacia_id, cliente_id, detalle)
    values (new.id,
            case when new.ubicacion_id is distinct from old.ubicacion_id then 'traslado' else 'cambio_estado' end,
            old.ubicacion_id, new.ubicacion_id, new.cliente_id,
            'estado: ' || old.estado || ' → ' || new.estado);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_activos_movimiento after update on activos
for each row execute function registrar_movimiento_activo();

-- Una mantención completada devuelve el activo a estado disponible
create or replace function cerrar_mantencion() returns trigger as $$
begin
  if new.estado = 'completada' and old.estado <> 'completada' then
    update activos set estado = 'disponible' where id = new.activo_id and estado = 'mantencion';
  elsif new.estado in ('programada','proxima','urgente') and old.estado = 'completada' then
    update activos set estado = 'mantencion' where id = new.activo_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_mantencion_cierre after update on mantenciones
for each row execute function cerrar_mantencion();
