-- 00 · Extensiones, tipos (listas de valores) y secuencias
-- Foto de la base de producción de FOSAN tomada el 10/11/2026 (generado desde la base real, no a mano).
-- Los "tipos" son las listas cerradas de valores (estado de un equipo, rol, tipo de servicio...).
-- Las secuencias generan los folios y códigos correlativos (D-0001, M-0001, códigos de cliente...).
-- Orden para montar una base nueva: 00 → 01 → 02 → 03 → 04 → 05 → 06 (ver supabase/README.md).

-- ═══ Extensiones de Postgres (4) ═══

create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- ═══ Tipos (12) ═══

create type public.categoria_costo as enum ('transporte', 'insumos', 'mano_obra', 'mantencion', 'administracion', 'otro');
create type public.clase_mantencion as enum ('bano', 'camion', 'camioneta', 'equipo');
create type public.estado_activo as enum ('disponible', 'en_arriendo', 'en_servicio', 'mantencion', 'fuera_de_servicio', 'baja', 'en_limpieza', 'extraviado', 'vendido', 'donacion');
create type public.estado_mantencion as enum ('programada', 'proxima', 'urgente', 'completada', 'anulada');
create type public.estado_servicio as enum ('pendiente', 'en_proceso', 'completado', 'anulado');
create type public.rol_usuario as enum ('dueno', 'lectura', 'secretaria', 'administrador', 'operador', 'ventas', 'permisoanalisis_gmail_com', 'ventas_zona_sur', 'ej_cata', 'ventas_zona_norte_prueba_1');
create type public.rubro_cliente as enum ('construccion', 'agricola', 'eventos', 'mineria', 'publico', 'otro');
create type public.tipo_activo as enum ('bano_quimico', 'camion', 'camioneta', 'generador', 'lavamanos', 'accesorio');
create type public.tipo_documento as enum ('factura', 'certificado', 'guia_despacho', 'revision_tecnica', 'seguro', 'otro', 'permiso_circulacion');
create type public.tipo_evento as enum ('mantencion', 'pago', 'servicio', 'alerta', 'reunion');
create type public.tipo_servicio as enum ('arriendo_bano', 'limpieza_bano', 'limpieza_fosa', 'instalacion', 'retiro', 'traslado', 'otro');
create type public.tipo_ubicacion as enum ('bodega', 'faena', 'taller', 'transito', 'cliente', 'vehiculo');

-- ═══ Secuencias (13) ═══

create sequence if not exists public.auditoria_id_seq start 1;
create sequence if not exists public.cliente_codigo_seq start 1;
create sequence if not exists public.compra_lineas_id_seq start 1;
create sequence if not exists public.folio_despacho_seq start 1;
create sequence if not exists public.folio_servicio_seq start 1;
create sequence if not exists public.mantencion_folio_seq start 1;
create sequence if not exists public.movimientos_activo_id_seq start 1;
create sequence if not exists public.movimientos_insumo_id_seq start 1;
create sequence if not exists public.ruta_paradas_id_seq start 1;
create sequence if not exists public.rutas_semana_lineas_id_seq start 1;
create sequence if not exists public.salida_paradas_id_seq start 1;
create sequence if not exists public.servicio_cliente_seq start 1;
create sequence if not exists public.vehiculo_disponibilidad_id_seq start 1;

