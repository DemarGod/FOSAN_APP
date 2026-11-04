-- 36 · ESTANDARIZACIÓN · Paquete 13 (cierre): revisión de datos de prueba y pendientes. SOLO LECTURA.
-- No cambia nada. Sirve para ver qué quedó de las pruebas y limpiarlo desde la app (cancelar, cerrar, desactivar).
-- Correr cada consulta por separado y mandar captura.


-- ══ 1 · Resumen ═══════════════════════════════════════════════════════════════
select (select count(*) from despachos where estado = 'programado')                                    as operaciones_programadas,
       (select count(*) from despachos where estado = 'programado' and fecha_programada < current_date) as operaciones_atrasadas,
       (select count(*) from despachos where estado = 'programado' and exceso_unidades > 0)              as urgencias_sobre_cupo,
       (select count(*) from mantenciones where estado in ('programada','proxima','urgente'))            as mantenciones_abiertas,
       (select count(*) from mantenciones where estado in ('programada','proxima','urgente') and fecha_programada < current_date) as mantenciones_vencidas,
       (select count(*) from salidas where estado = 'planificada' and odometro_salida is not null and fecha < current_date) as dias_de_ruta_sin_cerrar,
       (select count(*) from ubicaciones u join insumo_existencias e on e.ubicacion_id = u.id where u.tipo = 'vehiculo' and e.cantidad > 0) as insumos_en_vehiculos;


-- ══ 2 · Posibles datos de prueba (nombres con "prueba", "test" o código PRU) ═════
select 'cliente' as que, nombre as detalle, case when activo then 'activo' else 'inactivo' end as estado
  from clientes where nombre ilike any (array['%prueba%', '%test%'])
union all
select 'vehiculo', coalesce(v.patente, '') || ' · ' || a.codigo, a.estado::text
  from vehiculos v join activos a on a.id = v.activo_id where a.codigo ilike 'PRU%' or v.patente ilike 'PRUE%'
union all
select 'ruta semanal', nombre || ' · semana ' || to_char(lunes, 'DD/MM/YYYY'), ''
  from rutas_semana where nombre ilike any (array['%prueba%', '%test%'])
union all
select 'operación', d.folio || ' · ' || c.nombre || ' · ' || to_char(d.fecha_programada, 'DD/MM/YYYY'), d.estado
  from despachos d join clientes c on c.id = d.cliente_id
 where d.estado = 'programado' and (c.nombre ilike any (array['%prueba%', '%test%']) or d.observaciones ilike '%prueba%' or d.exceso_unidades > 0)
union all
select 'mantención', m.folio || ' · ' || a.codigo || ' · ' || m.tipo, m.estado::text
  from mantenciones m join activos a on a.id = m.activo_id
 where m.estado in ('programada','proxima','urgente') and (coalesce(m.trabajo_requerido, m.detalle, '') ilike '%prueba%' or a.codigo ilike 'PRU%')
union all
select 'usuario', coalesce(usuario, nombre), case when activo then 'activo' else 'inactivo' end
  from perfiles where coalesce(usuario, '') ilike any (array['%prueba%', '%test%'])
order by 1, 2;


-- ══ 3 · Operaciones atrasadas (programadas para días que ya pasaron) ═══════════
select d.folio, to_char(d.fecha_programada, 'DD/MM/YYYY') as fecha, c.nombre as cliente, d.tipo, d.origen
  from despachos d join clientes c on c.id = d.cliente_id
 where d.estado = 'programado' and d.fecha_programada < current_date
 order by d.fecha_programada;
