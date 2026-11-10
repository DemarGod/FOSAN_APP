-- 03 · Vistas (consultas guardadas que usan las pantallas y los reportes)
-- Foto de la base de producción de FOSAN tomada el 10/11/2026 (generado desde la base real, no a mano).
-- Ordenadas por dependencia: una vista que usa otra va después.
-- security_invoker=on: la vista respeta las reglas de seguridad de quien consulta (ver script historial 42).
-- Orden para montar una base nueva: 00 → 01 → 02 → 03 → 04 → 05 → 06 (ver supabase/README.md).

-- ═══ Vistas (19) ═══

create or replace view public.v_banos_kpi with (security_invoker=on) as
 SELECT count(*) AS total,
    count(*) FILTER (WHERE estado = 'en_arriendo'::estado_activo) AS en_arriendo,
    count(*) FILTER (WHERE estado = 'disponible'::estado_activo) AS disponibles,
    count(*) FILTER (WHERE estado = 'mantencion'::estado_activo) AS mantencion,
    count(*) FILTER (WHERE estado = 'fuera_de_servicio'::estado_activo) AS fuera_servicio,
    count(*) FILTER (WHERE estado = 'extraviado'::estado_activo) AS extraviados,
    count(*) FILTER (WHERE estado = 'vendido'::estado_activo) AS vendidos,
    count(*) FILTER (WHERE estado = 'donacion'::estado_activo) AS donados
   FROM activos
  WHERE tipo = 'bano_quimico'::tipo_activo AND estado <> 'baja'::estado_activo AND propiedad = 'empresa'::text;

create or replace view public.v_clientes_resumen with (security_invoker=on) as
 SELECT c.id,
    c.nombre,
    c.rut,
    c.rubro,
    COALESCE(r.nombre, c.rubro) AS rubro_nombre,
    c.contacto_nombre,
    c.telefono,
    c.correo,
    c.direccion,
    c.comuna,
    c.fecha_inicio_contrato,
    c.fecha_fin_contrato,
        CASE
            WHEN c.fecha_fin_contrato IS NULL THEN 'indefinido'::text
            WHEN c.fecha_fin_contrato >= CURRENT_DATE THEN 'vigente'::text
            ELSE 'vencido'::text
        END AS vigencia,
    c.lat IS NOT NULL AND c.lng IS NOT NULL AS georreferenciado,
    count(a.id) AS banos_activos,
    COALESCE(c.valor_mensual::bigint, sum(a.valor_arriendo), 0::bigint) AS valor_mensual,
    (EXISTS ( SELECT 1
           FROM despachos d
          WHERE d.cliente_id = c.id AND d.tipo = 'retiro'::text AND d.estado = 'programado'::text)) AS retiro_pendiente
   FROM clientes c
     LEFT JOIN rubros r ON r.clave = c.rubro
     LEFT JOIN activos a ON a.cliente_id = c.id AND a.estado = 'en_arriendo'::estado_activo
  GROUP BY c.id, r.nombre;

create or replace view public.v_despachos with (security_invoker=on) as
 SELECT d.id,
    d.folio,
    d.tipo,
    d.estado,
    d.origen,
    d.fecha_programada,
    d.fecha_realizada,
    d.cliente_id,
    c.nombre AS cliente,
    COALESCE(d.direccion, c.direccion) AS direccion,
    d.vehiculo_id,
    va.codigo AS vehiculo,
    d.salida_id,
    r.nombre AS ruta,
    s.fecha AS fecha_salida,
    d.observaciones,
    ( SELECT string_agg(a.codigo ||
                CASE
                    WHEN db.accion = 'retiro'::text THEN ' (retiro)'::text
                    ELSE ''::text
                END, ', '::text ORDER BY a.codigo) AS string_agg
           FROM despacho_banos db
             JOIN activos a ON a.id = db.activo_id
          WHERE db.despacho_id = d.id) AS banos,
    ( SELECT count(*) AS count
           FROM despacho_banos db
          WHERE db.despacho_id = d.id) AS cantidad
   FROM despachos d
     JOIN clientes c ON c.id = d.cliente_id
     LEFT JOIN activos va ON va.id = d.vehiculo_id
     LEFT JOIN salidas s ON s.id = d.salida_id
     LEFT JOIN rutas r ON r.id = s.ruta_id;

create or replace view public.v_equipos with (security_invoker=on) as
 SELECT a.id,
    a.codigo,
        CASE
            WHEN a.codigo ~ '^[0-9]+$'::text THEN a.codigo::bigint
            ELSE NULL::bigint
        END AS numero,
    a.tipo,
    a.estado,
        CASE
            WHEN a.situacion = 'disponible'::text AND r.folio IS NOT NULL THEN 'reservado'::text
            ELSE a.situacion
        END AS situacion,
    a.condicion,
    a.propiedad,
    a.habilitado,
    a.qr_token,
    a.marca,
    a.color,
    a.fecha_incorporacion,
    a.notas,
    a.codigo_cliente,
    a.categoria_id,
    cat.nombre AS categoria,
    a.modelo_id,
    m.nombre AS modelo,
    a.ubicacion_id,
    u.nombre AS ubicacion,
    u.tipo::text AS ubicacion_tipo,
    a.cliente_id,
    c.nombre AS cliente,
    a.propietario_id,
    p.nombre AS propietario,
    a.servicio_id,
    r.folio AS reserva_folio
   FROM activos a
     LEFT JOIN categorias cat ON cat.id = a.categoria_id
     LEFT JOIN modelos_bano m ON m.id = a.modelo_id
     LEFT JOIN ubicaciones u ON u.id = a.ubicacion_id
     LEFT JOIN clientes c ON c.id = a.cliente_id
     LEFT JOIN clientes p ON p.id = a.propietario_id
     LEFT JOIN LATERAL ( SELECT d.folio
           FROM despacho_banos db
             JOIN despachos d ON d.id = db.despacho_id
          WHERE db.activo_id = a.id AND db.accion = 'entrega'::text AND d.estado = 'programado'::text
          ORDER BY d.fecha_programada
         LIMIT 1) r ON true
  WHERE a.tipo <> ALL (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo]);

create or replace view public.v_estado_activos with (security_invoker=on) as
 SELECT estado,
    count(*) AS total,
    round(100.0 * count(*)::numeric / NULLIF(sum(count(*)) OVER (), 0::numeric), 1) AS porcentaje
   FROM activos
  WHERE estado <> 'baja'::estado_activo AND propiedad = 'empresa'::text
  GROUP BY estado;

create or replace view public.v_flota with (security_invoker=on) as
 SELECT v.activo_id AS id,
    a.codigo,
    v.patente,
    v.tipo_vehiculo,
    v.marca,
    v.modelo,
    v.anio,
    v.kilometraje,
    v.fecha_registro,
    v.observaciones,
    v.capacidad_kg,
    v.capacidad_banos,
    v.capacidad_litros,
    a.estado::text AS estado_activo,
    a.qr_token,
    a.fecha_baja,
    a.motivo_baja,
    vehiculo_en_ruta(a.id) AS en_ruta,
        CASE
            WHEN a.estado = 'baja'::estado_activo THEN 'baja'::text
            WHEN vehiculo_en_ruta(a.id) THEN 'en_ruta'::text
            WHEN a.estado = 'mantencion'::estado_activo THEN 'mantenimiento'::text
            WHEN a.estado = 'fuera_de_servicio'::estado_activo THEN 'fuera_servicio'::text
            ELSE 'disponible'::text
        END AS estado_flota,
    ( SELECT u.id
           FROM ubicaciones u
          WHERE u.vehiculo_id = a.id) AS ubicacion_insumos_id,
    ( SELECT d.motivo
           FROM vehiculo_disponibilidad d
          WHERE d.activo_id = a.id
          ORDER BY d.creado_en DESC
         LIMIT 1) AS ultimo_motivo
   FROM vehiculos v
     JOIN activos a ON a.id = v.activo_id;

create or replace view public.v_inventario with (security_invoker=on) as
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
  WHERE a.estado <> 'baja'::estado_activo AND a.propiedad = 'empresa'::text;

create or replace view public.v_limpiezas_cliente with (security_invoker=on) as
 WITH x AS (
         SELECT p.cliente_id,
            d.d
           FROM ruta_paradas p
             JOIN rutas r ON r.id = p.ruta_id AND r.activa
             CROSS JOIN LATERAL unnest(r.dias) d(d)
          WHERE p.tarea = 'limpieza'::text
        UNION
         SELECT c.id,
            d.d
           FROM clientes c
             CROSS JOIN LATERAL unnest(c.dias_limpieza) d(d)
          WHERE c.dias_limpieza IS NOT NULL
        )
 SELECT cliente_id,
    count(*) AS veces_semana,
    array_agg(d ORDER BY d) AS dias
   FROM x
  GROUP BY cliente_id;

create or replace view public.v_mantenciones_kpi with (security_invoker=on) as
 SELECT count(*) FILTER (WHERE date_trunc('month'::text, fecha_programada::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)) AS del_mes,
    count(*) FILTER (WHERE estado = ANY (ARRAY['programada'::estado_mantencion, 'proxima'::estado_mantencion])) AS proximas,
    count(*) FILTER (WHERE estado = 'urgente'::estado_mantencion) AS urgentes,
    count(*) FILTER (WHERE estado = 'completada'::estado_mantencion) AS realizadas,
    COALESCE(sum(costo) FILTER (WHERE estado = 'completada'::estado_mantencion), 0::bigint) AS costo_realizado
   FROM mantenciones;

create or replace view public.v_mantenimiento with (security_invoker=on) as
 SELECT m.id,
    m.folio,
    m.activo_id,
    a.codigo,
    a.tipo::text AS activo_tipo,
    a.qr_token,
        CASE
            WHEN a.tipo = ANY (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo]) THEN 'vehiculo'::text
            ELSE 'equipo'::text
        END AS clase,
    v.patente,
        CASE
            WHEN a.tipo = ANY (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo]) THEN COALESCE(v.patente, a.codigo)
            ELSE 'Unidad '::text || a.codigo
        END AS identificacion,
    m.tipo,
    m.fecha_programada,
    m.fecha_realizada,
    m.iniciada_en,
    COALESCE(p.nombre, m.responsable_ext) AS responsable,
    COALESCE(m.trabajo_requerido, m.detalle) AS trabajo_requerido,
    m.observaciones,
    m.bloquea,
    m.resultado,
    m.trabajo_realizado,
    m.condicion_final,
    m.costo,
    m.motivo_cancelacion,
    m.cancelado_en,
        CASE
            WHEN m.estado = 'anulada'::estado_mantencion THEN 'cancelado'::text
            WHEN m.estado = 'completada'::estado_mantencion THEN 'completado'::text
            WHEN m.iniciada_en IS NOT NULL THEN 'en_curso'::text
            ELSE 'programado'::text
        END AS estado_m,
    (m.estado = ANY (ARRAY['programada'::estado_mantencion, 'proxima'::estado_mantencion, 'urgente'::estado_mantencion])) AND m.fecha_programada < CURRENT_DATE AS vencido,
    m.creado_en
   FROM mantenciones m
     JOIN activos a ON a.id = m.activo_id
     LEFT JOIN vehiculos v ON v.activo_id = a.id
     LEFT JOIN perfiles p ON p.id = m.responsable_id;

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
    count(a.id) FILTER (WHERE a.estado = 'mantencion'::estado_activo) AS en_mantencion
   FROM ubicaciones u
     LEFT JOIN clientes c ON c.id = u.cliente_id
     LEFT JOIN activos a ON a.ubicacion_id = u.id AND a.estado <> 'baja'::estado_activo AND a.propiedad = 'empresa'::text
  WHERE u.activa AND u.lat IS NOT NULL
  GROUP BY u.id, u.nombre, u.tipo, u.lat, u.lng, c.nombre;

create or replace view public.v_operaciones with (security_invoker=on) as
 SELECT d.id,
    d.folio,
    d.tipo,
    d.estado,
    d.origen,
    d.fecha_programada,
    d.fecha_realizada,
    d.observaciones,
    d.cliente_id,
    c.nombre AS cliente,
    c.rut,
    d.ubicacion_id,
    COALESCE(u.nombre, d.direccion) AS ubicacion,
    d.servicio_id,
    s.codigo AS servicio_codigo,
    s.tipo AS servicio_tipo,
    d.vehiculo_id,
    COALESCE(ve.patente, va.codigo) AS patente,
    d.responsable_id,
    p.nombre AS responsable,
    d.salida_id,
    sa.fecha AS fecha_salida,
    COALESCE(rs.nombre, ( SELECT rs2.nombre
           FROM rutas_semana_lineas l
             JOIN rutas_semana rs2 ON rs2.id = l.ruta_id
          WHERE l.despacho_id = d.id
         LIMIT 1)) AS ruta,
    d.motivo_cancelacion,
    d.cancelado_en,
    ( SELECT string_agg(a.codigo ||
                CASE
                    WHEN db.accion = 'retiro'::text AND d.tipo = 'cambio'::text THEN ' (retiro)'::text
                    ELSE ''::text
                END, ', '::text ORDER BY a.codigo) AS string_agg
           FROM despacho_banos db
             JOIN activos a ON a.id = db.activo_id
          WHERE db.despacho_id = d.id) AS unidades,
    ( SELECT count(*) AS count
           FROM despacho_banos db
          WHERE db.despacho_id = d.id) AS cantidad,
        CASE
            WHEN d.estado = 'hecho'::text THEN 'realizada'::text
            WHEN d.estado = 'cancelado'::text THEN 'cancelada'::text
            WHEN d.fecha_programada < CURRENT_DATE THEN 'pendiente'::text
            ELSE 'programada'::text
        END AS estado_op,
    d.recibido_por,
    d.resultado,
    pe.nombre AS ejecutado_por,
    ( SELECT count(*) AS count
           FROM operacion_respaldos r
          WHERE r.despacho_id = d.id AND r.tipo = 'archivo'::text) AS archivos,
    ( SELECT count(*) AS count
           FROM operacion_respaldos r
          WHERE r.despacho_id = d.id AND r.tipo = 'firma'::text) AS firmas,
    d.salida_id IS NOT NULL OR (EXISTS ( SELECT 1
           FROM rutas_semana_lineas l
          WHERE l.despacho_id = d.id)) AS en_ruta,
    c.direccion AS direccion_cliente,
    d.exceso_unidades,
    d.exceso_motivo
   FROM despachos d
     JOIN clientes c ON c.id = d.cliente_id
     LEFT JOIN ubicaciones u ON u.id = d.ubicacion_id
     LEFT JOIN servicios_cliente s ON s.id = d.servicio_id
     LEFT JOIN activos va ON va.id = d.vehiculo_id
     LEFT JOIN vehiculos ve ON ve.activo_id = d.vehiculo_id
     LEFT JOIN personal p ON p.id = d.responsable_id
     LEFT JOIN perfiles pe ON pe.id = d.ejecutado_por
     LEFT JOIN salidas sa ON sa.id = d.salida_id
     LEFT JOIN rutas_semana rs ON rs.id = sa.ruta_semana_id;

create or replace view public.v_operadores as
 SELECT id,
    nombre,
    rol::text AS rol
   FROM perfiles
  WHERE activo;

create or replace view public.v_resumen_inventario with (security_invoker=on) as
 SELECT count(*) AS total_activos,
    count(*) FILTER (WHERE tipo = 'bano_quimico'::tipo_activo) AS total_banos,
    count(*) FILTER (WHERE tipo = ANY (ARRAY['camion'::tipo_activo, 'camioneta'::tipo_activo])) AS total_vehiculos,
    count(*) FILTER (WHERE estado = 'disponible'::estado_activo) AS total_disponibles,
    count(*) FILTER (WHERE estado = ANY (ARRAY['en_arriendo'::estado_activo, 'en_servicio'::estado_activo])) AS total_en_uso,
    count(*) FILTER (WHERE estado = 'mantencion'::estado_activo) AS total_mantencion,
    count(*) FILTER (WHERE estado = 'fuera_de_servicio'::estado_activo) AS total_fuera_servicio
   FROM activos
  WHERE estado <> 'baja'::estado_activo AND propiedad = 'empresa'::text;

create or replace view public.v_salidas with (security_invoker=on) as
 SELECT s.id,
    s.ruta_id,
    COALESCE(r.nombre, rs.nombre, 'Viaje'::text) AS ruta,
    s.fecha,
    s.estado,
    s.vehiculo_id,
    a.codigo AS vehiculo,
    a.estado AS vehiculo_estado,
    s.km_estimado,
    s.odometro_salida,
    s.odometro_llegada,
    s.km_real,
    COALESCE(s.km_real, s.km_estimado) AS km,
    v.tipo_vehiculo,
    v.capacidad_kg,
    v.capacidad_banos,
    v.capacidad_litros,
    v.rend_vacio,
    v.rend_cargado,
    v.valor_compra,
    v.vida_util_km,
    v.costo_mant_km,
    v.costo_fijo_anual,
    v.km_anual,
    v.kilometraje,
    ( SELECT count(*) AS count
           FROM salida_paradas p
          WHERE p.salida_id = s.id) AS paradas,
    ( SELECT count(*) AS count
           FROM salida_paradas p
          WHERE p.salida_id = s.id AND p.hecha) AS paradas_hechas,
    ( SELECT COALESCE(sum(p.banos), 0::bigint) AS "coalesce"
           FROM salida_paradas p
          WHERE p.salida_id = s.id AND p.tarea = 'limpieza'::text) AS banos_limpieza,
    ( SELECT count(*) AS count
           FROM despachos d
          WHERE d.salida_id = s.id AND d.estado <> 'cancelado'::text) AS despachos,
    ( SELECT COALESCE(sum(mb.peso_kg), 0::numeric) AS "coalesce"
           FROM despachos d
             JOIN despacho_banos db ON db.despacho_id = d.id
             JOIN activos b ON b.id = db.activo_id
             LEFT JOIN modelos_bano mb ON mb.id = b.modelo_id
          WHERE d.salida_id = s.id AND d.estado <> 'cancelado'::text) AS peso_banos,
    ( SELECT count(*) AS count
           FROM despachos d
             JOIN despacho_banos db ON db.despacho_id = d.id
             JOIN activos b ON b.id = db.activo_id
             LEFT JOIN modelos_bano mb ON mb.id = b.modelo_id
          WHERE d.salida_id = s.id AND d.estado <> 'cancelado'::text AND mb.peso_kg IS NULL) AS banos_sin_peso,
    ( SELECT count(*) AS count
           FROM despachos d
             JOIN despacho_banos db ON db.despacho_id = d.id
          WHERE d.salida_id = s.id AND d.estado <> 'cancelado'::text) AS banos_transportados,
    s.ruta_semana_id,
    rs.operador_id,
    s.iniciada_en,
    s.cerrada_en
   FROM salidas s
     LEFT JOIN rutas r ON r.id = s.ruta_id
     LEFT JOIN rutas_semana rs ON rs.id = s.ruta_semana_id
     LEFT JOIN activos a ON a.id = s.vehiculo_id
     LEFT JOIN vehiculos v ON v.activo_id = s.vehiculo_id;

create or replace view public.v_servicios_mes with (security_invoker=on) as
 SELECT tipo,
    count(*) AS cantidad
   FROM servicios
  WHERE date_trunc('month'::text, fecha::timestamp with time zone) = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)
  GROUP BY tipo;

create or replace view public.v_utilidad_mensual with (security_invoker=on) as
 SELECT m.mes,
    COALESCE(v.ventas, 0::bigint) AS ventas,
    COALESCE(c.costos, 0::bigint) AS costos,
    COALESCE(v.ventas, 0::bigint) - COALESCE(c.costos, 0::bigint) AS utilidad,
    round(100.0 * (COALESCE(v.ventas, 0::bigint) - COALESCE(c.costos, 0::bigint))::numeric / NULLIF(v.ventas, 0)::numeric, 1) AS margen
   FROM ( SELECT date_trunc('month'::text, ventas.fecha::timestamp with time zone)::date AS mes
           FROM ventas
        UNION
         SELECT date_trunc('month'::text, costos.fecha::timestamp with time zone)::date AS date_trunc
           FROM costos) m
     LEFT JOIN ( SELECT date_trunc('month'::text, ventas.fecha::timestamp with time zone)::date AS mes,
            sum(ventas.neto) AS ventas
           FROM ventas
          GROUP BY (date_trunc('month'::text, ventas.fecha::timestamp with time zone)::date)) v USING (mes)
     LEFT JOIN ( SELECT date_trunc('month'::text, costos.fecha::timestamp with time zone)::date AS mes,
            sum(costos.monto) AS costos
           FROM costos
          GROUP BY (date_trunc('month'::text, costos.fecha::timestamp with time zone)::date)) c USING (mes)
  ORDER BY m.mes;

create or replace view public.v_utilidad_por_servicio with (security_invoker=on) as
 SELECT date_trunc('month'::text, v.fecha::timestamp with time zone)::date AS mes,
    v.tipo_servicio,
    sum(v.neto) AS ventas,
    COALESCE(sum(s.costo_transporte), 0::bigint) AS costo_transporte,
    count(*) AS documentos
   FROM ventas v
     LEFT JOIN servicios s ON s.id = v.servicio_id
  GROUP BY (date_trunc('month'::text, v.fecha::timestamp with time zone)::date), v.tipo_servicio
  ORDER BY (date_trunc('month'::text, v.fecha::timestamp with time zone)::date), v.tipo_servicio;

create or replace view public.v_ventas_mensual with (security_invoker=on) as
 SELECT date_trunc('month'::text, fecha::timestamp with time zone)::date AS mes,
    sum(neto) AS ventas,
    count(*) AS documentos
   FROM ventas v
  GROUP BY (date_trunc('month'::text, fecha::timestamp with time zone)::date)
  ORDER BY (date_trunc('month'::text, fecha::timestamp with time zone)::date);

