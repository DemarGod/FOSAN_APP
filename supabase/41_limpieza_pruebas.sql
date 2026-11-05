-- 41 · ESTANDARIZACIÓN · Paquete 19: limpieza de datos de prueba (autorizado por el dueño).
--   A. Operaciones programadas con fecha pasada → canceladas (motivo: dato de prueba).
--   B. Mantenciones abiertas con fecha pasada → anuladas.
--   C. Días de ruta iniciados y sin cerrar con fecha pasada → cancelados (no se borran: no se pierde historial).
--   D. Odómetros de prueba: se borran los km de los días de ruta y el odómetro de cada vehículo queda vacío,
--      para que el dueño ingrese el real en Flota → Editar.
--   No borra clientes, equipos, vehículos ni rutas. Todo queda en Historial (auditoría).
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Vista previa (solo lectura) · mandar captura ═══════════════════════
-- Esperado: 15 · 13 · 5 · (días con km) · (vehículos con km)
select (select count(*) from despachos    where estado = 'programado' and fecha_programada < current_date)                    as operaciones_a_cancelar,
       (select count(*) from mantenciones where estado in ('programada','proxima','urgente') and fecha_programada < current_date) as mantenciones_a_anular,
       (select count(*) from salidas      where estado = 'planificada' and odometro_salida is not null and fecha < current_date) as dias_a_cancelar,
       (select count(*) from salidas      where odometro_salida is not null or odometro_llegada is not null)                    as dias_con_km,
       (select count(*) from vehiculos    where kilometraje is not null)                                                       as vehiculos_con_km;

-- Odómetro actual de cada vehículo (anota el real de cada uno para ingresarlo después)
select a.codigo, v.patente, v.kilometraje as odometro_actual
  from vehiculos v join activos a on a.id = v.activo_id
 order by a.codigo;


-- ══ PASO 2 · Limpieza (seleccionar hasta el PASO 3) ═════════════════════════════
begin;

update despachos
   set estado = 'cancelado', motivo_cancelacion = 'Dato de prueba (limpieza ' || to_char(current_date, 'DD/MM/YYYY') || ')', cancelado_en = now()
 where estado = 'programado' and fecha_programada < current_date;

update mantenciones
   set estado = 'anulada'
 where estado in ('programada','proxima','urgente') and fecha_programada < current_date;

update salidas
   set estado = 'cancelada'
 where estado = 'planificada' and odometro_salida is not null and fecha < current_date;

update salidas
   set odometro_salida = null, odometro_llegada = null
 where odometro_salida is not null or odometro_llegada is not null;

update vehiculos set kilometraje = null where kilometraje is not null;

commit;


-- ══ PASO 3 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: todo en 0. Después, en Flota → Editar, ingresa el odómetro real de cada vehículo.
select (select count(*) from despachos    where estado = 'programado' and fecha_programada < current_date)                    as operaciones_atrasadas,
       (select count(*) from mantenciones where estado in ('programada','proxima','urgente') and fecha_programada < current_date) as mantenciones_vencidas,
       (select count(*) from salidas      where estado = 'planificada' and odometro_salida is not null and fecha < current_date) as dias_sin_cerrar,
       (select count(*) from salidas      where odometro_salida is not null or odometro_llegada is not null)                    as dias_con_km,
       (select count(*) from vehiculos    where kilometraje is not null)                                                       as vehiculos_con_km;
