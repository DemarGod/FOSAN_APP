-- 49 · Paquete 31: el Mapa (Inventario e Inicio) cuenta bien Arriendo y Limpieza.
--   La vista v_mapa_puntos no entregaba "en_arriendo" (baños arrendados en el punto) ni "cliente_id"
--   (para saber qué días se limpia), por eso los filtros Arriendo y Limpieza salían en 0 y los puntos sin color.
--   Se agregan esas 2 columnas al final y "en_mantencion" también cuenta la situación nueva.
--   No cambia ni borra datos: solo la vista. Se puede ejecutar más de una vez.
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Cambio (seleccionar hasta el PASO 2) ══════════════════════════════
create or replace view public.v_mapa_puntos with (security_invoker=on) as
 SELECT u.id,
    u.nombre,
    u.tipo,
    u.lat,
    u.lng,
    c.nombre AS cliente,
    count(a.id) AS activos,
    count(a.id) FILTER (WHERE a.tipo = 'bano_quimico'::tipo_activo) AS banos,
    count(a.id) FILTER (WHERE a.tipo = ANY (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo])) AS vehiculos,
    count(a.id) FILTER (WHERE a.estado = 'mantencion'::estado_activo OR a.situacion = 'en_mantenimiento') AS en_mantencion,
    u.cliente_id,
    count(a.id) FILTER (WHERE a.tipo <> ALL (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo])
                          AND (a.estado = 'en_arriendo'::estado_activo OR a.situacion = 'asignado')) AS en_arriendo
   FROM ubicaciones u
     LEFT JOIN clientes c ON c.id = u.cliente_id
     LEFT JOIN activos a ON a.ubicacion_id = u.id AND a.estado <> 'baja'::estado_activo AND a.propiedad = 'empresa'::text
  WHERE u.activa AND u.lat IS NOT NULL
  GROUP BY u.id, u.nombre, u.tipo, u.lat, u.lng, c.nombre, u.cliente_id;


-- ══ PASO 2 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: una fila con los totales del mapa (arrendados > 0 si hay baños en arriendo con ubicación en el mapa).
select count(*) as puntos,
       sum(en_arriendo) as banos_arrendados,
       count(*) filter (where cliente_id is not null) as puntos_de_clientes,
       sum(en_mantencion) as en_mantencion,
       count(*) filter (where tipo = 'bodega') as bodegas
  from v_mapa_puntos;
