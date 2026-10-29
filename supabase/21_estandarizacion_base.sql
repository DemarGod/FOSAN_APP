-- 21 · ESTANDARIZACIÓN · ETAPA 1: base de datos y catálogos
-- Solo agrega tablas y columnas y copia los datos actuales a la nueva estructura.
-- No borra nada: la app actual sigue funcionando con "estado" mientras se migran las pantallas.
-- Correr completo en Supabase → SQL Editor. Se puede correr más de una vez.

-- ═══ 0. Revisión previa (opcional): RUT repetidos que impedirían el índice único ═══
-- select upper(regexp_replace(rut,'[^0-9kK]','','g')) r, count(*) from clientes where rut is not null group by 1 having count(*) > 1;

-- ═══ 1. Catálogos (Administración → Catálogos) ═══════════════════════════════
create table if not exists categorias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  clase       text not null default 'equipo' check (clase in ('equipo','insumo','epp')),
  descripcion text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
insert into categorias (nombre, clase) values
  ('Baño químico','equipo'), ('Otros equipos','equipo'), ('Insumo','insumo'), ('EPP','epp')
on conflict (nombre) do nothing;

create table if not exists unidades_medida (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  abreviatura text not null unique,
  activo      boolean not null default true
);
insert into unidades_medida (nombre, abreviatura) values
  ('Unidad','un'), ('Litro','L'), ('Par','par'), ('Rollo','rollo'), ('Kilo','kg'), ('Metro cúbico','m³')
on conflict do nothing;

alter table modelos_bano add column if not exists categoria_id uuid references categorias(id);
alter table modelos_bano add column if not exists activo boolean not null default true;
update modelos_bano set categoria_id = (select id from categorias where nombre = 'Baño químico') where categoria_id is null;

-- Ubicaciones internas = tipo bodega o taller. Las obras de clientes son tipo cliente.
alter table ubicaciones add column if not exists descripcion text;
alter table ubicaciones add column if not exists indicaciones text;          -- acceso a la obra
alter table ubicaciones add column if not exists contacto_id uuid;           -- contacto en terreno

-- ═══ 2. Clientes: tipo, RUT normalizado, contactos y ubicaciones ══════════════
alter table clientes add column if not exists tipo_cliente text not null default 'empresa' check (tipo_cliente in ('empresa','persona'));
alter table clientes add column if not exists nombre_comercial text;
alter table clientes add column if not exists observaciones text;
alter table clientes add column if not exists codigo text;
alter table clientes add column if not exists rut_norm text generated always as (upper(regexp_replace(coalesce(rut,''),'[^0-9kK]','','g'))) stored;
create unique index if not exists clientes_rut_norm_unico on clientes (rut_norm) where rut_norm <> '';
create sequence if not exists cliente_codigo_seq;
update clientes set codigo = 'CLI-' || lpad(nextval('cliente_codigo_seq')::text, 3, '0') where codigo is null;
alter table clientes alter column codigo set default ('CLI-' || lpad(nextval('cliente_codigo_seq')::text, 3, '0'));

create table if not exists cliente_contactos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete cascade,
  nombre      text not null,
  cargo       text,
  telefono    text,
  correo      text,
  principal   boolean not null default false,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);
create unique index if not exists un_contacto_principal on cliente_contactos (cliente_id) where principal and activo;
-- Migración: el contacto que hoy está en la ficha pasa a ser el principal
insert into cliente_contactos (cliente_id, nombre, telefono, correo, principal)
select c.id, coalesce(nullif(trim(c.contacto_nombre),''), 'Contacto principal'), c.telefono, c.correo, true
from clientes c
where (c.contacto_nombre is not null or c.telefono is not null or c.correo is not null)
  and not exists (select 1 from cliente_contactos k where k.cliente_id = c.id);

-- Migración: cada cliente con dirección tiene al menos una ubicación (obra)
insert into ubicaciones (nombre, tipo, cliente_id, direccion, comuna, lat, lng)
select coalesce(nullif(trim(c.direccion),''), 'Ubicación principal'), 'cliente', c.id, c.direccion, c.comuna, c.lat, c.lng
from clientes c
where not exists (select 1 from ubicaciones u where u.cliente_id = c.id and u.tipo = 'cliente')
  and (c.direccion is not null or c.lat is not null);

-- ═══ 3. Servicios del cliente (A arriendo con limpieza · B limpieza de baños del cliente · C fosas) ═══
create sequence if not exists servicio_cliente_seq;
create table if not exists servicios_cliente (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique default ('SER-' || lpad(nextval('servicio_cliente_seq')::text, 3, '0')),
  cliente_id       uuid not null references clientes(id) on delete cascade,
  ubicacion_id     uuid references ubicaciones(id) on delete set null,
  tipo             text not null check (tipo in ('arriendo_limpieza','limpieza_cliente','limpieza_fosas')),
  fecha_inicio     date not null default current_date,
  fecha_termino    date,
  contacto_id      uuid references cliente_contactos(id) on delete set null,
  observaciones    text,
  estado           text not null default 'vigente' check (estado in ('vigente','finalizado')),
  categoria_id     uuid references categorias(id),        -- A
  cantidad         integer check (cantidad is null or cantidad > 0),   -- A: baños solicitados · B: baños del cliente
  frecuencia       text check (frecuencia in ('semanal','quincenal','mensual')),
  limpiezas_semana integer check (limpiezas_semana is null or limpiezas_semana between 0 and 7),
  dias             integer[],
  modalidad        text check (modalidad in ('puntual','recurrente')),  -- C
  volumen_m3       numeric(8,2),                                        -- C
  valor_mensual    integer,
  creado_en        timestamptz not null default now(),
  check (fecha_termino is null or fecha_termino >= fecha_inicio)
);
create index if not exists servicios_cliente_cli on servicios_cliente (cliente_id);

-- Migración A: clientes con baños arrendados o valor mensual
insert into servicios_cliente (cliente_id, ubicacion_id, tipo, fecha_inicio, fecha_termino, categoria_id, cantidad, frecuencia, limpiezas_semana, dias, valor_mensual, estado)
select c.id,
       (select u.id from ubicaciones u where u.cliente_id = c.id and u.tipo = 'cliente' order by u.creado_en limit 1),
       'arriendo_limpieza', coalesce(c.fecha_inicio_contrato, current_date), c.fecha_fin_contrato,
       (select id from categorias where nombre = 'Baño químico'),
       nullif((select count(*) from activos a where a.cliente_id = c.id and a.estado = 'en_arriendo'), 0),
       case when coalesce(array_length(c.dias_limpieza,1),0) > 0 then 'semanal' end,
       coalesce(array_length(c.dias_limpieza,1),0), c.dias_limpieza, c.valor_mensual,
       case when c.fecha_fin_contrato < current_date then 'finalizado' else 'vigente' end
from clientes c
where (exists (select 1 from activos a where a.cliente_id = c.id and a.estado = 'en_arriendo') or coalesce(c.valor_mensual,0) > 0)
  and not exists (select 1 from servicios_cliente s where s.cliente_id = c.id and s.tipo = 'arriendo_limpieza');

-- Migración B: clientes con baños propios
insert into servicios_cliente (cliente_id, ubicacion_id, tipo, fecha_inicio, cantidad, frecuencia, limpiezas_semana, dias)
select c.id,
       (select u.id from ubicaciones u where u.cliente_id = c.id and u.tipo = 'cliente' order by u.creado_en limit 1),
       'limpieza_cliente', coalesce(c.fecha_inicio_contrato, current_date), c.banos_propios, 'semanal',
       coalesce(array_length(c.dias_limpieza,1),0), c.dias_limpieza
from clientes c
where coalesce(c.banos_propios,0) > 0
  and not exists (select 1 from servicios_cliente s where s.cliente_id = c.id and s.tipo = 'limpieza_cliente');

-- ═══ 4. Equipos: situación, condición, propiedad ══════════════════════════════
alter table activos add column if not exists situacion text;
alter table activos add column if not exists condicion text not null default 'operativo';
alter table activos add column if not exists propiedad text not null default 'empresa';
alter table activos add column if not exists propietario_id uuid references clientes(id) on delete set null;
alter table activos add column if not exists categoria_id uuid references categorias(id);
alter table activos add column if not exists marca text;
alter table activos add column if not exists color text;
alter table activos add column if not exists fecha_incorporacion date;
alter table activos add column if not exists servicio_id uuid references servicios_cliente(id) on delete set null;
do $$ begin
  alter table activos add constraint activos_situacion_chk check (situacion in ('disponible','reservado','asignado','en_traslado','en_mantenimiento','no_localizado','baja'));
  alter table activos add constraint activos_condicion_chk check (condicion in ('operativo','requiere_limpieza','requiere_reparacion','sin_evaluar'));
  alter table activos add constraint activos_propiedad_chk check (propiedad in ('empresa','cliente'));
exception when duplicate_object then null; end $$;

-- Equivalencia estado actual → situación + condición (se mantiene sola mientras la app use "estado")
create or replace function sincronizar_situacion() returns trigger as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado or new.situacion is null then
    new.situacion := case new.estado::text
      when 'en_arriendo' then 'asignado'
      when 'disponible' then 'disponible'
      when 'en_limpieza' then 'disponible'
      when 'mantencion' then 'en_mantenimiento'
      when 'fuera_de_servicio' then 'en_mantenimiento'
      when 'extraviado' then 'no_localizado'
      else 'baja' end;
    new.condicion := case new.estado::text
      when 'en_limpieza' then 'requiere_limpieza'
      when 'mantencion' then 'requiere_reparacion'
      when 'fuera_de_servicio' then 'requiere_reparacion'
      when 'extraviado' then 'sin_evaluar'
      else coalesce(new.condicion, 'operativo') end;
  end if;
  return new;
end $$ language plpgsql;
drop trigger if exists t_sincronizar_situacion on activos;
create trigger t_sincronizar_situacion before insert or update on activos for each row execute function sincronizar_situacion();

select set_config('fosan.silencio', '1', false);   -- no crear movimientos por esta migración
update activos set situacion = null;   -- dispara el trigger y llena situación/condición en todos
update activos set categoria_id = (select id from categorias where nombre = case when tipo = 'bano_quimico' then 'Baño químico' else 'Otros equipos' end)
 where categoria_id is null and tipo not in ('camion','camioneta');
update activos set fecha_incorporacion = coalesce(fecha_compra, creado_en::date) where fecha_incorporacion is null;
-- Baños asignados apuntan a la obra del cliente; disponibles sin ubicación, a la bodega principal
update activos a set ubicacion_id = (select u.id from ubicaciones u where u.cliente_id = a.cliente_id and u.tipo = 'cliente' order by u.creado_en limit 1)
 where a.situacion = 'asignado' and a.cliente_id is not null and a.ubicacion_id is null;
update activos a set ubicacion_id = (select id from ubicaciones where tipo = 'bodega' order by creado_en limit 1)
 where a.situacion = 'disponible' and a.ubicacion_id is null and a.tipo not in ('camion','camioneta');
update activos a set servicio_id = (select s.id from servicios_cliente s where s.cliente_id = a.cliente_id and s.tipo = 'arriendo_limpieza' limit 1)
 where a.situacion = 'asignado' and a.servicio_id is null;

select set_config('fosan.silencio', '', false);

-- ═══ 5. Insumos y EPP: código, categoría y unidad ════════════════════════════
alter table insumos add column if not exists codigo text;
alter table insumos add column if not exists categoria_id uuid references categorias(id);
alter table insumos add column if not exists unidad_id uuid references unidades_medida(id);
alter table insumos add column if not exists activo boolean not null default true;
update insumos set categoria_id = (select id from categorias where nombre = case when uso = 'fijo' then 'EPP' else 'Insumo' end) where categoria_id is null;
update insumos i set unidad_id = (select id from unidades_medida m where lower(m.abreviatura) = lower(trim(i.unidad)) or lower(m.nombre) = lower(trim(i.unidad)) limit 1) where unidad_id is null;
with n as (select id, row_number() over (order by nombre) r, uso from insumos where codigo is null)
update insumos i set codigo = (case when n.uso = 'fijo' then 'EPP-' else 'INS-' end) || lpad(n.r::text, 3, '0') from n where i.id = n.id;
create unique index if not exists insumos_codigo_unico on insumos (codigo);

-- ═══ 6. Personal (personas con o sin acceso al sistema) ═══════════════════════
create table if not exists personal (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  rut        text,
  funcion    text,
  telefono   text,
  perfil_id  uuid unique references perfiles(id) on delete set null,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
insert into personal (nombre, funcion, perfil_id, activo)
select p.nombre, p.rol::text, p.id, p.activo from perfiles p
where not exists (select 1 from personal x where x.perfil_id = p.id);

-- Permisos: se agrega "exportar" (Consultar / Registrar / Exportar)
alter table permisos_rol add column if not exists exportar boolean not null default false;
update permisos_rol set exportar = ver where exportar = false and ver;

-- ═══ 7. Seguridad de las tablas nuevas ════════════════════════════════════════
do $$ declare t text; sec text; begin
  foreach t in array array['categorias','unidades_medida','cliente_contactos','servicios_cliente','personal'] loop
    execute format('alter table %I enable row level security', t);
    sec := case t when 'cliente_contactos' then 'clientes' when 'servicios_cliente' then 'clientes' else 'configuracion' end;
    execute format('drop policy if exists %I on %I', t || '_ver', t);
    execute format('drop policy if exists %I on %I', t || '_editar', t);
    execute format('create policy %I on %I for select using (tiene_acceso())', t || '_ver', t);
    if sec = 'configuracion' then
      execute format('create policy %I on %I for all using (es_dueno()) with check (es_dueno())', t || '_editar', t);
    else
      execute format('create policy %I on %I for all using (tiene_permiso(%L,%L)) with check (tiene_permiso(%L,%L))', t || '_editar', t, sec, 'editar', sec, 'editar');
    end if;
  end loop;
end $$;

-- ═══ 8. Control: revisar que la migración cuadre ═════════════════════════════
select 'baños' que, count(*) total, count(*) filter (where situacion = 'asignado') asignados, count(*) filter (where situacion = 'disponible') disponibles,
       count(*) filter (where situacion = 'en_mantenimiento') mantenimiento, count(*) filter (where situacion in ('no_localizado','baja')) otros
from activos where tipo = 'bano_quimico'
union all select 'clientes', count(*), null, null, null, null from clientes
union all select 'contactos', count(*), null, null, null, null from cliente_contactos
union all select 'ubicaciones de clientes', count(*), null, null, null, null from ubicaciones where tipo = 'cliente'
union all select 'servicios', count(*), count(*) filter (where tipo = 'arriendo_limpieza'), count(*) filter (where tipo = 'limpieza_cliente'), null, null from servicios_cliente;
