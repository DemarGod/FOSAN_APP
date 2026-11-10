-- 04 · Triggers (reglas automáticas al guardar)
-- Foto de la base de producción de FOSAN tomada el 10/11/2026 (generado desde la base real, no a mano).
-- Se ejecutan solos al insertar/actualizar: folios, MAYÚSCULAS, validaciones de fechas, auditoría,
-- orden de mantenimiento obligatoria, creación del perfil al crear un usuario (auth.users), etc.
-- Orden para montar una base nueva: 00 → 01 → 02 → 03 → 04 → 05 → 06 (ver supabase/README.md).

-- ═══ Triggers (73) ═══

CREATE TRIGGER auditoria_activos AFTER INSERT OR DELETE OR UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_a_equipo_externo BEFORE INSERT OR UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION preparar_equipo_externo();
CREATE CONSTRAINT TRIGGER t_activo_en_mantencion AFTER INSERT OR UPDATE OF estado ON public.activos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (((new.estado)::text = 'mantencion'::text)) EXECUTE FUNCTION t_asegurar_orden();
CREATE TRIGGER t_bloquear_cambio_numero BEFORE UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION bloquear_cambio_numero();
CREATE TRIGGER t_externo_recalcular AFTER INSERT OR UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION t_recalcular_desde_externo();
CREATE TRIGGER t_registrar_ingreso AFTER INSERT ON public.activos FOR EACH ROW EXECUTE FUNCTION registrar_ingreso_activo();
CREATE TRIGGER t_sincronizar_situacion BEFORE INSERT OR UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION sincronizar_situacion();
CREATE TRIGGER t_ubicacion_vehiculo AFTER INSERT OR UPDATE OF codigo, estado, tipo ON public.activos FOR EACH ROW EXECUTE FUNCTION sincronizar_ubicacion_vehiculo();
CREATE TRIGGER trg_activos_movimiento AFTER UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION registrar_movimiento_activo();
CREATE TRIGGER trg_activos_upd BEFORE UPDATE ON public.activos FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER auditoria_ajustes AFTER INSERT OR DELETE OR UPDATE ON public.ajustes FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_categorias AFTER INSERT OR DELETE OR UPDATE ON public.categorias FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_cliente_contactos AFTER INSERT OR DELETE OR UPDATE ON public.cliente_contactos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_contacto_mayusculas BEFORE INSERT OR UPDATE OF nombre ON public.cliente_contactos FOR EACH ROW EXECUTE FUNCTION nombre_mayusculas();
CREATE TRIGGER auditoria_clientes AFTER INSERT OR DELETE OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_cliente_mayusculas BEFORE INSERT OR UPDATE OF nombre ON public.clientes FOR EACH ROW EXECUTE FUNCTION cliente_mayusculas();
CREATE TRIGGER trg_clientes_upd BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
CREATE TRIGGER trg_limites_secretaria BEFORE INSERT OR UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION limites_secretaria();
CREATE TRIGGER auditoria_compra_lineas AFTER INSERT OR DELETE OR UPDATE ON public.compra_lineas FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_compras AFTER INSERT OR DELETE OR UPDATE ON public.compras FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_costos AFTER INSERT OR DELETE OR UPDATE ON public.costos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_despacho_banos AFTER INSERT OR DELETE OR UPDATE ON public.despacho_banos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_bano_unico BEFORE INSERT OR UPDATE ON public.despacho_banos FOR EACH ROW EXECUTE FUNCTION validar_bano_unico();
CREATE TRIGGER trg_validar_bano_despacho BEFORE INSERT ON public.despacho_banos FOR EACH ROW EXECUTE FUNCTION validar_bano_despacho();
CREATE TRIGGER auditoria_despachos AFTER INSERT OR DELETE OR UPDATE ON public.despachos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_validar_fecha_operacion BEFORE INSERT OR UPDATE ON public.despachos FOR EACH ROW EXECUTE FUNCTION validar_fecha_operacion();
CREATE TRIGGER trg_cerrar_despacho AFTER UPDATE ON public.despachos FOR EACH ROW EXECUTE FUNCTION cerrar_despacho();
CREATE TRIGGER trg_limites_secretaria BEFORE INSERT OR UPDATE ON public.despachos FOR EACH ROW EXECUTE FUNCTION limites_secretaria();
CREATE TRIGGER trg_vehiculo_despacho BEFORE INSERT OR UPDATE ON public.despachos FOR EACH ROW EXECUTE FUNCTION validar_vehiculo();
CREATE TRIGGER auditoria_documentos_activo AFTER INSERT OR DELETE OR UPDATE ON public.documentos_activo FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_eventos AFTER INSERT OR DELETE OR UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_insumo_existencias AFTER INSERT OR DELETE OR UPDATE ON public.insumo_existencias FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_insumo_lotes AFTER INSERT OR DELETE OR UPDATE ON public.insumo_lotes FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_insumos AFTER INSERT OR DELETE OR UPDATE ON public.insumos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_mantenciones AFTER INSERT OR DELETE OR UPDATE ON public.mantenciones FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_limites_secretaria BEFORE INSERT OR UPDATE ON public.mantenciones FOR EACH ROW EXECUTE FUNCTION limites_secretaria();
CREATE TRIGGER trg_mantencion_cierre AFTER UPDATE ON public.mantenciones FOR EACH ROW EXECUTE FUNCTION cerrar_mantencion();
CREATE TRIGGER trg_mantencion_clase BEFORE INSERT OR UPDATE OF activo_id, clase ON public.mantenciones FOR EACH ROW EXECUTE FUNCTION mantencion_clase_desde_activo();
CREATE TRIGGER auditoria_modelos_bano AFTER INSERT OR DELETE OR UPDATE ON public.modelos_bano FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_movimiento_insumo_legado BEFORE INSERT ON public.movimientos_insumo FOR EACH ROW EXECUTE FUNCTION t_movimiento_insumo_legado();
CREATE TRIGGER auditoria_observaciones_activo AFTER INSERT OR DELETE OR UPDATE ON public.observaciones_activo FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_operacion_respaldos AFTER INSERT OR DELETE OR UPDATE ON public.operacion_respaldos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_parametros AFTER INSERT OR DELETE OR UPDATE ON public.parametros FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_perfiles AFTER INSERT OR DELETE OR UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_proteger_perfiles BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION proteger_perfiles();
CREATE TRIGGER auditoria_personal AFTER INSERT OR DELETE OR UPDATE ON public.personal FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_proveedores AFTER INSERT OR DELETE OR UPDATE ON public.proveedores FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_receta_limpieza AFTER INSERT OR DELETE OR UPDATE ON public.receta_limpieza FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_roles_app AFTER INSERT OR DELETE OR UPDATE ON public.roles_app FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_rubros AFTER INSERT OR DELETE OR UPDATE ON public.rubros FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_ruta_paradas AFTER INSERT OR DELETE OR UPDATE ON public.ruta_paradas FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_max_paradas BEFORE INSERT ON public.ruta_paradas FOR EACH ROW EXECUTE FUNCTION validar_max_paradas();
CREATE TRIGGER auditoria_rutas AFTER INSERT OR DELETE OR UPDATE ON public.rutas FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_vehiculo_ruta BEFORE INSERT OR UPDATE ON public.rutas FOR EACH ROW EXECUTE FUNCTION validar_vehiculo();
CREATE TRIGGER t_ruta_semana_mayusculas BEFORE INSERT OR UPDATE OF nombre ON public.rutas_semana FOR EACH ROW EXECUTE FUNCTION nombre_mayusculas();
CREATE TRIGGER auditoria_salida_paradas AFTER INSERT OR DELETE OR UPDATE ON public.salida_paradas FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_parada_hecha AFTER UPDATE ON public.salida_paradas FOR EACH ROW EXECUTE FUNCTION parada_hecha();
CREATE TRIGGER auditoria_salidas AFTER INSERT OR DELETE OR UPDATE ON public.salidas FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_cerrar_salida AFTER UPDATE ON public.salidas FOR EACH ROW EXECUTE FUNCTION cerrar_salida();
CREATE TRIGGER trg_limites_secretaria BEFORE INSERT OR UPDATE ON public.salidas FOR EACH ROW EXECUTE FUNCTION limites_secretaria();
CREATE TRIGGER trg_vehiculo_salida BEFORE INSERT OR UPDATE ON public.salidas FOR EACH ROW EXECUTE FUNCTION validar_vehiculo();
CREATE TRIGGER auditoria_servicio_activos AFTER INSERT OR DELETE OR UPDATE ON public.servicio_activos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_servicios AFTER INSERT OR DELETE OR UPDATE ON public.servicios FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_servicios_cliente AFTER INSERT OR DELETE OR UPDATE ON public.servicios_cliente FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_servicios_recalcular AFTER INSERT OR DELETE OR UPDATE ON public.servicios_cliente FOR EACH ROW EXECUTE FUNCTION t_recalcular_desde_servicio();
CREATE TRIGGER auditoria_ubicaciones AFTER INSERT OR DELETE OR UPDATE ON public.ubicaciones FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_ubicacion_mayusculas BEFORE INSERT OR UPDATE OF nombre ON public.ubicaciones FOR EACH ROW EXECUTE FUNCTION nombre_mayusculas();
CREATE TRIGGER auditoria_unidades_medida AFTER INSERT OR DELETE OR UPDATE ON public.unidades_medida FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER trg_perfil_auth AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION crear_perfil_desde_auth();
CREATE TRIGGER auditoria_vehiculo_disponibilidad AFTER INSERT OR DELETE OR UPDATE ON public.vehiculo_disponibilidad FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER auditoria_vehiculos AFTER INSERT OR DELETE OR UPDATE ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
CREATE TRIGGER t_preparar_vehiculo BEFORE INSERT OR UPDATE ON public.vehiculos FOR EACH ROW EXECUTE FUNCTION preparar_vehiculo();
CREATE TRIGGER auditoria_ventas AFTER INSERT OR DELETE OR UPDATE ON public.ventas FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

