-- 22 · Limpieza de datos de prueba
-- Se mantiene: baños (número, modelo, marca, color, condición, fechas), vehículos, insumos, catálogos,
-- parámetros, usuarios, permisos, auditoría, movimientos, rutas semanales, salidas y despachos.
-- Se borra: clientes de prueba que NO están en ninguna ruta, salida o despacho, con sus contactos,
-- obras, servicios y eventos. Sus baños vuelven a Disponible en la bodega principal.

-- ══ PASO 1 · Vista previa: correr solo esto y revisar los números ══════════════
with usados as (
  select cliente_id from rutas_semana_lineas union select cliente_id from salida_paradas union select cliente_id from despachos
), borrar as (select id from clientes where id not in (select cliente_id from usados where cliente_id is not null))
select (select count(*) from clientes) clientes_hoy,
       (select count(*) from borrar) clientes_a_borrar,
       (select count(*) from clientes) - (select count(*) from borrar) clientes_que_quedan,
       (select count(*) from activos where cliente_id in (select id from borrar)) banos_que_vuelven_a_bodega;

-- ══ PASO 2 · Limpieza: correr todo este bloque junto (es una sola instrucción) ══
do $$
declare
  borrar uuid[]; ubic uuid[]; bodega uuid; r record; obligatoria boolean;
begin
  select coalesce(array_agg(id), '{}') into borrar from clientes where id not in (
    select cliente_id from rutas_semana_lineas where cliente_id is not null
    union select cliente_id from salida_paradas where cliente_id is not null
    union select cliente_id from despachos where cliente_id is not null);
  select coalesce(array_agg(id), '{}') into ubic from ubicaciones where tipo = 'cliente' and cliente_id = any(borrar);
  select id into bodega from ubicaciones where tipo = 'bodega' order by creado_en limit 1;

  perform set_config('fosan.silencio', '1', true);

  -- Baños de esos clientes → Disponible en bodega (se conserva todo lo demás del baño)
  update activos set estado = 'disponible', cliente_id = null, servicio_id = null, ubicacion_id = bodega
  where cliente_id = any(borrar) or ubicacion_id = any(ubic);

  -- Referencias en otras tablas: se sueltan (null); si la columna es obligatoria, se borra la fila
  for r in
    select c.conrelid::regclass::text tabla, a.attname col, c.confrelid::regclass::text ref, a.attnotnull nn
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.contype = 'f' and c.confrelid in ('clientes'::regclass, 'ubicaciones'::regclass)
      and c.conrelid not in ('clientes'::regclass, 'ubicaciones'::regclass, 'activos'::regclass)
  loop
    if r.nn then
      execute format('delete from %s where %I = any($1)', r.tabla, r.col) using case r.ref when 'clientes' then borrar else ubic end;
    else
      execute format('update %s set %I = null where %I = any($1)', r.tabla, r.col, r.col) using case r.ref when 'clientes' then borrar else ubic end;
    end if;
  end loop;

  delete from ubicaciones where id = any(ubic);
  delete from clientes where id = any(borrar);
  raise notice 'Clientes borrados: %, ubicaciones borradas: %', array_length(borrar, 1), array_length(ubic, 1);
end $$;

-- ══ PASO 3 · Control ══════════════════════════════════════════════════════════
select (select count(*) from clientes) clientes, (select count(*) from activos where tipo = 'bano_quimico') banos,
       (select count(*) from activos where tipo = 'bano_quimico' and situacion = 'asignado') asignados,
       (select count(*) from activos where tipo = 'bano_quimico' and situacion = 'disponible') disponibles,
       (select count(*) from rutas_semana_lineas) lineas_de_ruta, (select count(*) from despachos) despachos;
