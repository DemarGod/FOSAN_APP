-- 34 · ESTANDARIZACIÓN · Paquete 9c: correcciones del equipo (Operaciones, Inventario y Clientes)
-- Solo agrega o ajusta. No borra operaciones, equipos ni clientes.
--   A. Situación "Reservado": un baño disponible con una entrega programada se muestra Reservado (con su folio).
--   B. Cupo del servicio: cuántas unidades pidió el servicio, cuántas tiene asignadas y cuántas reservadas.
--   C. Entrega sobre lo solicitado (urgencia): queda registrada en la operación y avisa en Notificaciones.
--   D. Clientes: el nombre / razón social se guarda siempre en MAYÚSCULAS (el nombre comercial queda como se escribe).
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Esperado: columnas_v_operaciones = 35. Si es otro número, avísame antes de seguir.
select (select count(*) from information_schema.columns where table_name = 'v_operaciones')                as columnas_v_operaciones,
       (select count(*) from activos a where a.estado = 'disponible' and exists (select 1 from despacho_banos db join despachos d on d.id = db.despacho_id
          where db.activo_id = a.id and db.accion = 'entrega' and d.estado = 'programado'))                 as banos_que_quedaran_reservados,
       (select count(*) from clientes where nombre <> upper(nombre))                                       as clientes_con_minusculas;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
-- A. Vista de equipos con "Reservado"
create or replace view v_equipos with (security_invoker = on) as
select a.id, a.codigo,
       case when a.codigo ~ '^[0-9]+$' then a.codigo::bigint end as numero,
       a.tipo, a.estado,
       case when a.situacion = 'disponible' and r.folio is not null then 'reservado' else a.situacion end as situacion,
       a.condicion, a.propiedad, a.habilitado, a.qr_token,
       a.marca, a.color, a.fecha_incorporacion, a.notas, a.codigo_cliente,
       a.categoria_id, cat.nombre as categoria,
       a.modelo_id, m.nombre as modelo,
       a.ubicacion_id, u.nombre as ubicacion, u.tipo::text as ubicacion_tipo,
       a.cliente_id, c.nombre as cliente,
       a.propietario_id, p.nombre as propietario,
       a.servicio_id,
       r.folio as reserva_folio
  from activos a
  left join categorias cat on cat.id = a.categoria_id
  left join modelos_bano m on m.id = a.modelo_id
  left join ubicaciones u on u.id = a.ubicacion_id
  left join clientes c on c.id = a.cliente_id
  left join clientes p on p.id = a.propietario_id
  left join lateral (select d.folio from despacho_banos db join despachos d on d.id = db.despacho_id
                      where db.activo_id = a.id and db.accion = 'entrega' and d.estado = 'programado'
                      order by d.fecha_programada limit 1) r on true
 where a.tipo not in ('camion', 'camioneta');
grant select on v_equipos to authenticated;

-- B. Cupo del servicio (p_excluir: la operación que se está editando)
create or replace function cupo_servicio(p_servicio uuid, p_excluir uuid default null)
returns table (solicitada integer, asignadas integer, reservadas integer) as $$
  select s.cantidad,
         (select count(*)::int from activos a where a.servicio_id = s.id and a.estado = 'en_arriendo'),
         (select count(*)::int from despacho_banos db join despachos d on d.id = db.despacho_id
           where d.servicio_id = s.id and d.estado = 'programado' and db.accion = 'entrega'
             and d.id is distinct from p_excluir)
       - (select count(*)::int from despacho_banos db join despachos d on d.id = db.despacho_id
           where d.servicio_id = s.id and d.estado = 'programado' and db.accion = 'retiro'
             and d.id is distinct from p_excluir)
    from servicios_cliente s where s.id = p_servicio
$$ language sql stable security definer set search_path = public;

-- C. Entrega sobre lo solicitado (urgencia)
alter table despachos add column if not exists exceso_unidades integer;
alter table despachos add column if not exists exceso_motivo text;

create or replace function registrar_exceso_unidades(p_despacho uuid, p_exceso integer, p_motivo text) returns void as $$
declare x record;
begin
  if not (es_dueno() or permiso_seccion('rutas', 'editar')) then raise exception 'No tienes permiso.'; end if;
  if coalesce(p_exceso, 0) <= 0 then
    update despachos set exceso_unidades = null, exceso_motivo = null where id = p_despacho;
    return;
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then raise exception 'Explica el motivo de la urgencia.'; end if;
  select d.folio, c.nombre as cliente, s.codigo as servicio, s.cantidad into x
    from despachos d join clientes c on c.id = d.cliente_id left join servicios_cliente s on s.id = d.servicio_id
   where d.id = p_despacho;
  update despachos set exceso_unidades = p_exceso, exceso_motivo = trim(p_motivo) where id = p_despacho;
  insert into notificaciones (texto, nivel)
  values ('URGENCIA: ' || x.folio || ' entrega ' || p_exceso || ' unidad(es) sobre lo solicitado en ' || coalesce(x.servicio, 'el servicio')
          || ' (' || x.cliente || ', solicitado: ' || coalesce(x.cantidad::text, '?') || '). Revisar y actualizar el servicio. Motivo: ' || trim(p_motivo), 'alerta');
end;
$$ language plpgsql security definer set search_path = public;

-- D. Nombre / razón social en mayúsculas
create or replace function cliente_mayusculas() returns trigger as $$
begin
  new.nombre := upper(trim(new.nombre));
  return new;
end;
$$ language plpgsql;
drop trigger if exists t_cliente_mayusculas on clientes;
create trigger t_cliente_mayusculas before insert or update of nombre on clientes for each row execute function cliente_mayusculas();
update clientes set nombre = upper(trim(nombre)) where nombre <> upper(trim(nombre));


-- ══ PASO 3 · Vista de operaciones con el aviso de urgencia (seleccionar hasta el PASO 4) ══
create or replace view v_operaciones with (security_invoker = on) as
select d.id, d.folio, d.tipo, d.estado, d.origen, d.fecha_programada, d.fecha_realizada, d.observaciones,
       d.cliente_id, c.nombre as cliente, c.rut,
       d.ubicacion_id, coalesce(u.nombre, d.direccion) as ubicacion,
       d.servicio_id, s.codigo as servicio_codigo, s.tipo as servicio_tipo,
       d.vehiculo_id, coalesce(ve.patente, va.codigo) as patente,
       d.responsable_id, p.nombre as responsable,
       d.salida_id, sa.fecha as fecha_salida,
       coalesce(rs.nombre, (select rs2.nombre from rutas_semana_lineas l join rutas_semana rs2 on rs2.id = l.ruta_id
                             where l.despacho_id = d.id limit 1)) as ruta,
       d.motivo_cancelacion, d.cancelado_en,
       (select string_agg(a.codigo || case when db.accion = 'retiro' and d.tipo = 'cambio' then ' (retiro)' else '' end, ', ' order by a.codigo)
          from despacho_banos db join activos a on a.id = db.activo_id where db.despacho_id = d.id) as unidades,
       (select count(*) from despacho_banos db where db.despacho_id = d.id) as cantidad,
       case when d.estado = 'hecho' then 'realizada'
            when d.estado = 'cancelado' then 'cancelada'
            when d.fecha_programada < current_date then 'pendiente'
            else 'programada' end as estado_op,
       -- nuevas al final (la vista conserva las columnas anteriores)
       d.recibido_por, d.resultado, pe.nombre as ejecutado_por,
       (select count(*) from operacion_respaldos r where r.despacho_id = d.id and r.tipo = 'archivo') as archivos,
       (select count(*) from operacion_respaldos r where r.despacho_id = d.id and r.tipo = 'firma') as firmas,
       (d.salida_id is not null or exists (select 1 from rutas_semana_lineas l where l.despacho_id = d.id)) as en_ruta,
       c.direccion as direccion_cliente,
       -- paquete 9c: entrega sobre lo solicitado (urgencia)
       d.exceso_unidades, d.exceso_motivo
  from despachos d
  join clientes c on c.id = d.cliente_id
  left join ubicaciones u on u.id = d.ubicacion_id
  left join servicios_cliente s on s.id = d.servicio_id
  left join activos va on va.id = d.vehiculo_id
  left join vehiculos ve on ve.activo_id = d.vehiculo_id
  left join personal p on p.id = d.responsable_id
  left join perfiles pe on pe.id = d.ejecutado_por
  left join salidas sa on sa.id = d.salida_id
  left join rutas_semana rs on rs.id = sa.ruta_semana_id;
grant select on v_operaciones to authenticated;


-- ══ PASO 4 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: reservados = banos_que_quedaran_reservados del PASO 1; columnas_v_operaciones = 37;
--           funciones = 2; clientes_con_minusculas = 0.
select (select count(*) from v_equipos where situacion = 'reservado')                                as reservados,
       (select count(*) from information_schema.columns where table_name = 'v_operaciones')          as columnas_v_operaciones,
       (select count(*) from pg_proc where proname in ('cupo_servicio', 'registrar_exceso_unidades')) as funciones,
       (select count(*) from clientes where nombre <> upper(nombre))                                as clientes_con_minusculas;
