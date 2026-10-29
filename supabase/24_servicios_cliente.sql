-- 24 · ESTANDARIZACIÓN · ETAPA 2 · Paquete 5: servicios del cliente
-- Solo agrega y ajusta. No borra columnas ni datos.
--   A. Campo "Acceso / restricciones" para fosas (servicios_cliente.acceso).
--   B. La base recalcula sola, desde los servicios VIGENTES del cliente, lo que leen
--      Rutas semanales y Análisis: clientes.dias_limpieza, banos_propios y valor_mensual.
--   C. Equipos externos (EXT-###) quedan "En operación" y nunca como disponibles.
--   D. Las 5 vistas que cuentan o listan baños consideran solo equipos de la empresa.
-- Correr PASO POR PASO en Supabase → SQL Editor: seleccionar cada bloque y apretar Run.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Esperado: externos = 0. Anota servicios_vigentes y los tipos de columna.
select (select count(*) from servicios_cliente where estado = 'vigente')       as servicios_vigentes,
       (select count(*) from activos where propiedad = 'cliente')               as externos,
       (select data_type || '/' || coalesce(udt_name, '') from information_schema.columns
         where table_name = 'clientes' and column_name = 'dias_limpieza')        as tipo_dias,
       (select data_type from information_schema.columns
         where table_name = 'clientes' and column_name = 'banos_propios')        as tipo_banos_propios,
       (select string_agg(relname || ':' || coalesce(array_to_string(reloptions, ','), '-'), ' · ')
          from pg_class where relname in ('v_banos_kpi','v_resumen_inventario','v_estado_activos','v_mapa_puntos','v_inventario')) as opciones_vistas;


-- ══ PASO 2 · Servicios: campo nuevo y recálculo (seleccionar hasta el PASO 3) ═══
alter table servicios_cliente add column if not exists acceso text;

-- Recalcula los campos antiguos del cliente desde sus servicios vigentes
create or replace function recalcular_cliente_servicios(p_cliente uuid) returns void as $$
begin
  if p_cliente is null then return; end if;
  update clientes c set
    -- días de limpieza: unión de los días de los servicios A y B vigentes (1 = lunes … 7 = domingo)
    dias_limpieza = (
      select array_agg(distinct d order by d)
        from servicios_cliente s, unnest(s.dias) d
       where s.cliente_id = p_cliente and s.estado = 'vigente'
         and s.tipo in ('arriendo_limpieza', 'limpieza_cliente') and d between 1 and 7),
    -- baños propios: por cada servicio B vigente, los equipos externos registrados o la cantidad anotada
    banos_propios = coalesce((
      select sum(greatest(coalesce(s.cantidad, 0),
                          (select count(*) from activos a where a.servicio_id = s.id and a.propiedad = 'cliente')))
        from servicios_cliente s
       where s.cliente_id = p_cliente and s.estado = 'vigente' and s.tipo = 'limpieza_cliente'), 0),
    -- valor mensual: suma de los servicios vigentes (lo usa Análisis como ingreso)
    valor_mensual = (
      select sum(s.valor_mensual) from servicios_cliente s
       where s.cliente_id = p_cliente and s.estado = 'vigente')
  where c.id = p_cliente;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function t_recalcular_desde_servicio() returns trigger as $$
begin
  if tg_op <> 'INSERT' then perform recalcular_cliente_servicios(old.cliente_id); end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.cliente_id is distinct from old.cliente_id) then
    perform recalcular_cliente_servicios(new.cliente_id);
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists t_servicios_recalcular on servicios_cliente;
create trigger t_servicios_recalcular after insert or update or delete on servicios_cliente
for each row execute function t_recalcular_desde_servicio();

-- Si un equipo externo entra o sale de un servicio, también se recalcula
create or replace function t_recalcular_desde_externo() returns trigger as $$
declare c1 uuid; c2 uuid;
begin
  if (tg_op = 'INSERT' and new.propiedad = 'cliente' and new.servicio_id is not null)
     or (tg_op = 'UPDATE' and (new.propiedad = 'cliente' or old.propiedad = 'cliente')
         and new.servicio_id is distinct from old.servicio_id) then
    if tg_op = 'UPDATE' then select cliente_id into c1 from servicios_cliente where id = old.servicio_id; end if;
    select cliente_id into c2 from servicios_cliente where id = new.servicio_id;
    perform recalcular_cliente_servicios(c1);
    if c2 is distinct from c1 then perform recalcular_cliente_servicios(c2); end if;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists t_externo_recalcular on activos;
create trigger t_externo_recalcular after insert or update on activos
for each row execute function t_recalcular_desde_externo();

-- Equipos externos: estado "En operación" (nunca disponibles para entregar)
create or replace function preparar_equipo_externo() returns trigger as $$
declare n integer;
begin
  if tg_op = 'UPDATE' and new.codigo is distinct from old.codigo
     and (old.propiedad = 'cliente' or new.propiedad = 'cliente') then
    raise exception 'El código de un equipo externo no se puede cambiar.';
  end if;
  if new.propiedad = 'cliente' then
    if tg_op = 'INSERT' and coalesce(trim(new.codigo), '') = '' then
      perform pg_advisory_xact_lock(hashtext('equipo_externo'));
      select coalesce(max(substring(codigo from 5)::integer), 0) + 1 into n
        from activos where codigo ~ '^EXT-[0-9]+$';
      new.codigo := 'EXT-' || lpad(n::text, 3, '0');
    end if;
    new.habilitado := false;
    if new.estado::text in ('disponible', 'en_arriendo') then new.estado := 'en_servicio'; end if;
  end if;
  return new;
end;
$$ language plpgsql;


-- ══ PASO 3 · Vistas: solo equipos de la empresa (seleccionar hasta el PASO 4) ════
-- Mismas columnas que hoy; solo se agrega "propiedad = empresa". Conserva las opciones de cada vista.
do $vistas$
declare r record; opciones jsonb := '{}';
begin
  for r in select relname, reloptions from pg_class
            where relname in ('v_banos_kpi','v_resumen_inventario','v_estado_activos','v_mapa_puntos','v_inventario')
              and reloptions is not null loop
    opciones := opciones || jsonb_build_object(r.relname, array_to_string(r.reloptions, ', '));
  end loop;

  execute $v$
  create or replace view v_banos_kpi as
  SELECT count(*) AS total,
    count(*) FILTER (WHERE estado = 'en_arriendo'::estado_activo) AS en_arriendo,
    count(*) FILTER (WHERE estado = 'disponible'::estado_activo) AS disponibles,
    count(*) FILTER (WHERE estado = 'mantencion'::estado_activo) AS mantencion,
    count(*) FILTER (WHERE estado = 'fuera_de_servicio'::estado_activo) AS fuera_servicio,
    count(*) FILTER (WHERE estado = 'extraviado'::estado_activo) AS extraviados,
    count(*) FILTER (WHERE estado = 'vendido'::estado_activo) AS vendidos,
    count(*) FILTER (WHERE estado = 'donacion'::estado_activo) AS donados
   FROM activos
  WHERE tipo = 'bano_quimico'::tipo_activo AND estado <> 'baja'::estado_activo AND propiedad = 'empresa'
  $v$;

  execute $v$
  create or replace view v_resumen_inventario as
  SELECT count(*) AS total_activos,
    count(*) FILTER (WHERE tipo = 'bano_quimico'::tipo_activo) AS total_banos,
    count(*) FILTER (WHERE tipo = ANY (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo])) AS total_vehiculos,
    count(*) FILTER (WHERE estado = 'disponible'::estado_activo) AS total_disponibles,
    count(*) FILTER (WHERE estado = ANY (ARRAY['en_arriendo'::estado_activo, 'en_servicio'::estado_activo])) AS total_en_uso,
    count(*) FILTER (WHERE estado = 'mantencion'::estado_activo) AS total_mantencion,
    count(*) FILTER (WHERE estado = 'fuera_de_servicio'::estado_activo) AS total_fuera_servicio
   FROM activos
  WHERE estado <> 'baja'::estado_activo AND propiedad = 'empresa'
  $v$;

  execute $v$
  create or replace view v_estado_activos as
  SELECT estado,
    count(*) AS total,
    round(100.0 * count(*)::numeric / NULLIF(sum(count(*)) OVER (), 0::numeric), 1) AS porcentaje
   FROM activos
  WHERE estado <> 'baja'::estado_activo AND propiedad = 'empresa'
  GROUP BY estado
  $v$;

  execute $v$
  create or replace view v_mapa_puntos as
  SELECT u.id,
    u.nombre,
    u.tipo,
    u.lat,
    u.lng,
    c.nombre AS cliente,
    count(a.id) AS activos,
    count(a.id) FILTER (WHERE a.tipo = 'bano_quimico'::tipo_activo) AS banos,
    count(a.id) FILTER (WHERE a.tipo = ANY (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo])) AS vehiculos,
    count(a.id) FILTER (WHERE a.estado = 'mantencion'::estado_activo) AS en_mantencion
   FROM ubicaciones u
     LEFT JOIN clientes c ON c.id = u.cliente_id
     LEFT JOIN activos a ON a.ubicacion_id = u.id AND a.estado <> 'baja'::estado_activo AND a.propiedad = 'empresa'
  WHERE u.activa AND u.lat IS NOT NULL
  GROUP BY u.id, u.nombre, u.tipo, u.lat, u.lng, c.nombre
  $v$;

  execute $v$
  create or replace view v_inventario as
  SELECT a.id,
    a.codigo,
    a.tipo,
    COALESCE(m.nombre, a.detalle) AS detalle,
    a.estado,
    a.habilitado,
    c.nombre AS cliente,
    u.nombre AS ubicacion,
    u.tipo = 'bodega'::tipo_ubicacion AS en_bodega,
    a.valor_arriendo,
    a.qr_token,
    ( SELECT max(mv.fecha) AS max
           FROM movimientos_activo mv
          WHERE mv.activo_id = a.id) AS ultimo_movimiento,
    a.color,
    ( SELECT mv.tipo
           FROM movimientos_activo mv
          WHERE mv.activo_id = a.id
          ORDER BY mv.fecha DESC
         LIMIT 1) AS ultimo_movimiento_tipo
   FROM activos a
     LEFT JOIN modelos_bano m ON m.id = a.modelo_id
     LEFT JOIN clientes c ON c.id = a.cliente_id
     LEFT JOIN ubicaciones u ON u.id = a.ubicacion_id
  WHERE a.estado <> 'baja'::estado_activo AND a.propiedad = 'empresa'
  $v$;

  -- Vuelve a poner las opciones que tenía cada vista (por ejemplo security_invoker)
  for r in select key, value from jsonb_each_text(opciones) loop
    execute format('alter view %I set (%s)', r.key, r.value);
  end loop;
end $vistas$;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: campo_acceso = 1, triggers = 2, total_banos_kpi = 327 (o lo que mostraba Baños antes),
-- y vistas_ok = 5. opciones_vistas debe ser igual que en el PASO 1.
select (select count(*) from information_schema.columns where table_name = 'servicios_cliente' and column_name = 'acceso') as campo_acceso,
       (select count(*) from pg_trigger where tgname in ('t_servicios_recalcular','t_externo_recalcular'))                    as triggers,
       (select total from v_banos_kpi)                                                                                     as total_banos_kpi,
       (select count(*) from pg_views where viewname in ('v_banos_kpi','v_resumen_inventario','v_estado_activos','v_mapa_puntos','v_inventario')
          and definition ilike '%propiedad%')                                                                              as vistas_ok,
       (select string_agg(relname || ':' || coalesce(array_to_string(reloptions, ','), '-'), ' · ')
          from pg_class where relname in ('v_banos_kpi','v_resumen_inventario','v_estado_activos','v_mapa_puntos','v_inventario')) as opciones_vistas;
