import { supabase } from './supabase'

const rows = async (q) => {
  const { data, error } = await q
  if (error) throw error
  return data || []
}
const one = async (q) => {
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  return data
}

// ── Inicio ────────────────────────────────────────────────────────────────
export const resumenInventario = () => one(supabase.from('v_resumen_inventario').select('*'))
export const estadoActivos = () => rows(supabase.from('v_estado_activos').select('*'))
export const serviciosMes = () => rows(supabase.from('v_servicios_mes').select('*'))
export const mapaPuntos = () => rows(supabase.from('v_mapa_puntos').select('*').order('activos', { ascending: false }))
export const utilidadMensual = () => rows(supabase.from('v_utilidad_mensual').select('*'))
export const utilidadPorServicio = () => rows(supabase.from('v_utilidad_por_servicio').select('*').order('mes', { ascending: false }))
export const topClientes = () => rows(supabase.from('v_top_clientes').select('*').limit(5))

export const actividadReciente = (n = 8) => rows(
  supabase.from('movimientos_activo')
    .select('id, fecha, tipo, detalle, activos(codigo), clientes(nombre)')
    .order('fecha', { ascending: false }).limit(n)
)

// ── Notificaciones ────────────────────────────────────────────────────────
export const notificaciones = () => rows(
  supabase.from('notificaciones').select('*').order('creado_en', { ascending: false }).limit(20)
)
export const marcarLeidas = async () => {
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
  if (error) throw error
}

// ── Inventario y activos ──────────────────────────────────────────────────
export const inventario = () => rows(supabase.from('v_inventario').select('*').order('codigo'))
export const banosKpi = () => one(supabase.from('v_banos_kpi').select('*'))

export const vehiculos = () => rows(
  supabase.from('vehiculos')
    .select('patente, marca, modelo, capacidad_litros, conductor, revision_tecnica, permiso_circulacion, activos(id, codigo, estado, qr_token, ubicaciones(nombre))')
    .order('patente')
)

export const activoPorQr = (token) => one(
  supabase.from('activos')
    .select('*, modelos_bano(nombre, tipo), clientes(nombre), ubicaciones(nombre, lat, lng, tipo)')
    .eq('qr_token', token)
)
export const activoPorCodigo = (codigo) => one(
  supabase.from('activos')
    .select('*, modelos_bano(nombre, tipo), clientes(nombre), ubicaciones(nombre, lat, lng, tipo)')
    .eq('codigo', codigo)
)

export const movimientosDe = (activoId) => rows(
  supabase.from('movimientos_activo')
    .select('id, fecha, tipo, detalle, desde:desde_id(nombre), hacia:hacia_id(nombre)')
    .eq('activo_id', activoId).order('fecha', { ascending: false })
)
export const documentosDe = (activoId) => rows(
  supabase.from('documentos_activo').select('*').eq('activo_id', activoId).order('creado_en', { ascending: false })
)
export const observacionesDe = (activoId) => rows(
  supabase.from('observaciones_activo').select('*').eq('activo_id', activoId).order('creado_en', { ascending: false })
)
export const agregarObservacion = async (activoId, texto) => {
  const { error } = await supabase.from('observaciones_activo').insert({ activo_id: activoId, texto })
  if (error) throw error
}

export const crearActivo = async (datos) => {
  const { error } = await supabase.from('activos').insert(datos)
  if (error) throw error
}

// ── Catálogos para los formularios ────────────────────────────────────────
export const modelos = () => rows(supabase.from('modelos_bano').select('*').order('nombre'))
export const ubicaciones = () => rows(supabase.from('ubicaciones').select('id, nombre, tipo, lat, lng').eq('activa', true).order('nombre'))
export const clientesLista = () => rows(supabase.from('clientes').select('id, nombre').order('nombre'))
export const activosLista = () => rows(supabase.from('activos').select('id, codigo, tipo').neq('estado', 'baja').order('codigo'))

export const crearUbicacion = async (nombre, tipo = 'faena') => {
  const { data, error } = await supabase.from('ubicaciones').insert({ nombre, tipo }).select('id, nombre, tipo').single()
  if (error) throw error
  return data
}

// ── Clientes ──────────────────────────────────────────────────────────────
export const clientesResumen = () => rows(supabase.from('v_clientes_resumen').select('*').order('nombre'))
export const crearCliente = async (datos) => {
  const { error } = await supabase.from('clientes').insert(datos)
  if (error) throw error
}
export const ubicarCliente = async (id, lat, lng) => {
  const { error } = await supabase.from('clientes').update({ lat, lng }).eq('id', id)
  if (error) throw error
}

// ── Mantenciones ──────────────────────────────────────────────────────────
export const mantenciones = () => rows(
  supabase.from('mantenciones')
    .select('id, clase, tipo, fecha_programada, fecha_realizada, responsable_ext, costo, estado, detalle, activos(codigo), perfiles:responsable_id(nombre)')
    .order('fecha_programada', { ascending: false })
)
export const mantencionesKpi = () => one(supabase.from('v_mantenciones_kpi').select('*'))
export const crearMantencion = async (datos) => {
  const { error } = await supabase.from('mantenciones').insert(datos)
  if (error) throw error
}

// ── Calendario ────────────────────────────────────────────────────────────
export const eventosDelMes = (anio, mes) => {
  const ini = new Date(Date.UTC(anio, mes, 1)).toISOString().slice(0, 10)
  const fin = new Date(Date.UTC(anio, mes + 1, 0)).toISOString().slice(0, 10)
  return rows(supabase.from('eventos').select('*').gte('fecha', ini).lte('fecha', fin).order('fecha'))
}
export const crearEvento = async (datos) => {
  const { data, error } = await supabase.from('eventos').insert(datos).select('*').single()
  if (error) throw error
  return data
}
export const borrarEvento = async (id) => {
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) throw error
}

// ── Configuración ─────────────────────────────────────────────────────────
export const perfiles = () => rows(supabase.from('perfiles').select('*').order('nombre'))

// ── Exportación ───────────────────────────────────────────────────────────
export const vistaExport = (nombre) => rows(supabase.from(nombre).select('*'))
