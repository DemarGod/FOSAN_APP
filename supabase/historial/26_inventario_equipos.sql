-- 26 · ESTANDARIZACIÓN · ETAPA 3 · Paquete 7a: Inventario → Equipos
-- Solo agrega y ajusta. No borra equipos, ubicaciones ni movimientos.
--   A. Se desactiva la bodega "BODEGA" (está vacía); queda "Bodega central Talca".
--   B. N.º de unidad de los baños FOSAN: entero positivo, único (102 = 0102) y no se cambia.
--   C. Siguiente número sugerido: el mayor + 1 (los dados de baja no se reutilizan).
--   D. Al crear un equipo queda su registro inicial de trazabilidad ("ingreso") en Movimientos.
--   E. Vista v_equipos para el listado (respeta los permisos de cada usuario).
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Esperado: numeros_repetidos = 0, bodega_vacia = 0. Anota disponibles_sin_ubicacion.
select (select count(*) from activos where tipo not in ('camion','camioneta'))                          as equipos,
       (select count(*) from (select ltrim(codigo, '0') from activos
          where tipo = 'bano_quimico' and propiedad = 'empresa' group by 1 having count(*) > 1) d)      as numeros_repetidos,
       (select count(*) from activos a join ubicaciones u on u.id = a.ubicacion_id
          where u.nombre = 'BODEGA' and u.tipo = 'bodega')                                              as bodega_vacia,
       (select count(*) from activos where tipo = 'bano_quimico' and propiedad = 'empresa'
          and estado = 'disponible' and ubicacion_id is null)                                           as disponibles_sin_ubicacion,
       (select string_agg(distinct tipo::text, ', ') from activos where tipo not in ('camion','camioneta')) as tipos;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
-- A. Desactivar "BODEGA" solo si no tiene equipos
update ubicaciones u set activa = false
 where u.nombre = 'BODEGA' and u.tipo = 'bodega' and u.activa
   and not exists (select 1 from activos a where a.ubicacion_id = u.id);

-- B. N.º de unidad: entero positivo y único para los baños FOSAN
do $$ begin
  alter table activos add constraint activos_numero_unidad_chk
    check (tipo <> 'bano_quimico' or propiedad <> 'empresa' or codigo ~ '^[0-9]*[1-9][0-9]*$');
exception when duplicate_object then null; end $$;
create unique index if not exists activos_numero_unidad_unico on activos (ltrim(codigo, '0'))
  where tipo = 'bano_quimico' and propiedad = 'empresa';

-- …y no se cambia una vez creado (se mantiene en órdenes, retiros, mantenimiento y reportes)
create or replace function bloquear_cambio_numero() returns trigger as $$
begin
  if old.propiedad = 'empresa' and old.tipo = 'bano_quimico' and new.codigo is distinct from old.codigo then
    raise exception 'El N.º de unidad % no se puede cambiar.', old.codigo;
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists t_bloquear_cambio_numero on activos;
create trigger t_bloquear_cambio_numero before update on activos
for each row execute function bloquear_cambio_numero();

-- C. Siguiente número sugerido (no reutiliza números de equipos dados de baja)
create or replace function siguiente_numero_unidad() returns bigint as $$
  select coalesce(max(codigo::bigint), 0) + 1 from activos
   where tipo = 'bano_quimico' and propiedad = 'empresa' and codigo ~ '^[0-9]+$';
$$ language sql stable security definer set search_path = public;

-- D. Registro inicial de trazabilidad al crear un equipo
create or replace function registrar_ingreso_activo() returns trigger as $$
begin
  if coalesce(current_setting('fosan.silencio', true), '') = '1' then return null; end if;
  if new.tipo in ('camion', 'camioneta') then return null; end if;
  insert into movimientos_activo (activo_id, tipo, hacia_id, cliente_id, responsable_id, detalle)
  values (new.id, 'ingreso', new.ubicacion_id, coalesce(new.cliente_id, new.propietario_id), auth.uid(),
          case when new.propiedad = 'cliente' then 'Alta de equipo externo' else 'Alta de equipo' end);
  return null;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists t_registrar_ingreso on activos;
create trigger t_registrar_ingreso after insert on activos
for each row execute function registrar_ingreso_activo();

-- E. Vista del listado de equipos (sin vehículos; los vehículos van en Flota)
create or replace view v_equipos with (security_invoker = on) as
select a.id, a.codigo,
       case when a.codigo ~ '^[0-9]+$' then a.codigo::bigint end as numero,
       a.tipo, a.estado, a.situacion, a.condicion, a.propiedad, a.habilitado, a.qr_token,
       a.marca, a.color, a.fecha_incorporacion, a.notas, a.codigo_cliente,
       a.categoria_id, cat.nombre as categoria,
       a.modelo_id, m.nombre as modelo,
       a.ubicacion_id, u.nombre as ubicacion, u.tipo::text as ubicacion_tipo,
       a.cliente_id, c.nombre as cliente,
       a.propietario_id, p.nombre as propietario,
       a.servicio_id
  from activos a
  left join categorias cat on cat.id = a.categoria_id
  left join modelos_bano m on m.id = a.modelo_id
  left join ubicaciones u on u.id = a.ubicacion_id
  left join clientes c on c.id = a.cliente_id
  left join clientes p on p.id = a.propietario_id
 where a.tipo not in ('camion', 'camioneta');
grant select on v_equipos to authenticated;


-- ══ PASO 3 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: bodegas_activas = 1, regla_numero = 1, triggers = 2, siguiente = (el mayor número + 1),
-- equipos_vista = la cifra "equipos" del PASO 1.
select (select count(*) from ubicaciones where tipo = 'bodega' and activa)                          as bodegas_activas,
       (select count(*) from pg_constraint where conname = 'activos_numero_unidad_chk')              as regla_numero,
       (select count(*) from pg_trigger where tgname in ('t_bloquear_cambio_numero','t_registrar_ingreso')) as triggers,
       siguiente_numero_unidad()                                                                     as siguiente,
       (select count(*) from v_equipos)                                                              as equipos_vista;
