-- 30 · ESTANDARIZACIÓN · ETAPA 4: completar las operaciones antiguas
-- Solo agrega datos que faltan. No cambia estados, no mueve baños ni borra nada.
--   · Ubicación: la primera obra del cliente (donde la base ya dejaba los baños antes del script 29).
--   · Servicio: si el cliente tiene UN solo servicio de arriendo, ese servicio (solo entregas, retiros y cambios).
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Vista previa (solo lectura) ═══════════════════════════════════════
select (select count(*) from despachos where ubicacion_id is null)                                    as sin_ubicacion,
       (select count(*) from despachos d where d.ubicacion_id is null and exists
          (select 1 from ubicaciones u where u.cliente_id = d.cliente_id and u.tipo = 'cliente'))          as se_completan_ubicacion,
       (select count(*) from despachos where servicio_id is null)                                     as sin_servicio,
       (select count(*) from despachos d where d.servicio_id is null and d.tipo in ('entrega','retiro','cambio')
          and (select count(*) from servicios_cliente s where s.cliente_id = d.cliente_id and s.tipo = 'arriendo_limpieza') = 1) as se_completan_servicio;


-- ══ PASO 2 · Completar (seleccionar hasta el PASO 3) ═══════════════════════════
update despachos d
   set ubicacion_id = (select u.id from ubicaciones u where u.cliente_id = d.cliente_id and u.tipo = 'cliente' order by u.creado_en limit 1)
 where d.ubicacion_id is null
   and exists (select 1 from ubicaciones u where u.cliente_id = d.cliente_id and u.tipo = 'cliente');

update despachos d
   set servicio_id = (select s.id from servicios_cliente s where s.cliente_id = d.cliente_id and s.tipo = 'arriendo_limpieza')
 where d.servicio_id is null and d.tipo in ('entrega', 'retiro', 'cambio')
   and (select count(*) from servicios_cliente s where s.cliente_id = d.cliente_id and s.tipo = 'arriendo_limpieza') = 1;


-- ══ PASO 3 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: sin_ubicacion y sin_servicio bajan respecto del PASO 1 (los que quedan no tienen obra
-- o tienen más de un servicio de arriendo: se completan a mano al editar la operación).
select (select count(*) from despachos where ubicacion_id is null) as sin_ubicacion,
       (select count(*) from despachos where servicio_id is null)  as sin_servicio,
       (select count(*) from despachos)                             as despachos;
