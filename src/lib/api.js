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
    .select('*, activos(id, codigo, tipo, estado, qr_token, ubicaciones(nombre))')
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
    .select('id, fecha, tipo, detalle, desde:desde_id(nombre), hacia:hacia_id(nombre), clientes(nombre), responsable:responsable_id(nombre)')
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

export const eliminarActivos = async (ids) => {
  const { data, error } = await supabase.rpc('eliminar_activos', { p_ids: ids })
  if (error) throw error
  return data
}
export const tiposMantencion = () => rows(supabase.from('mantenciones').select('tipo').limit(500))
  .then((r) => [...new Set(r.map((x) => x.tipo).filter(Boolean))])
export const crearActivo = async (datos) => {
  const { error } = await supabase.from('activos').insert(datos)
  if (error) throw error
}

// ── Catálogos para los formularios ────────────────────────────────────────
export const modelos = () => rows(supabase.from('modelos_bano').select('*').order('nombre'))
export const ubicaciones = () => rows(supabase.from('ubicaciones').select('id, nombre, tipo, lat, lng').eq('activa', true).order('nombre'))
export const clientesLista = () => rows(supabase.from('clientes').select('id, nombre, direccion').order('nombre'))
// Clientes para armar rutas: con días de limpieza, comuna y baños (arrendados + propios)
export const clientesParaRuta = async () => {
  const [c, a] = await Promise.all([
    rows(supabase.from('clientes').select('*').order('nombre')),
    rows(supabase.from('activos').select('cliente_id').eq('estado', 'en_arriendo').not('cliente_id', 'is', null)),
  ])
  const n = {}
  a.forEach((x) => { n[x.cliente_id] = (n[x.cliente_id] || 0) + 1 })
  return c.map((x) => ({ ...x, banos_arriendo: n[x.id] || 0, banos_propios: x.banos_propios || 0 }))
}

export const crearModelo = async (nombre) => {
  const { data, error } = await supabase.from('modelos_bano').insert({ nombre, tipo: nombre }).select('*').single()
  if (error) throw error.code === '23505' ? new Error('Ese modelo ya existe.') : error
  return data
}


export const buscarGlobal = async (q) => {
  const t = q.replace(/[%,()]/g, ' ').trim()
  const [activos, clientes] = await Promise.all([
    rows(supabase.from('activos').select('id, codigo, tipo, estado, qr_token, clientes(nombre)').neq('estado', 'baja').ilike('codigo', `%${t}%`).order('codigo').limit(6)),
    rows(supabase.from('clientes').select('id, nombre, direccion, comuna').or(`nombre.ilike.%${t}%,direccion.ilike.%${t}%,comuna.ilike.%${t}%`).order('nombre').limit(6)),
  ])
  return { activos, clientes }
}
export const activosLista = () => rows(supabase.from('activos').select('id, codigo, tipo').neq('estado', 'baja').order('codigo'))

export const crearUbicacion = async (nombre, tipo = 'faena', extra = {}) => {
  const { data, error } = await supabase.from('ubicaciones').insert({ nombre, tipo, ...extra }).select('id, nombre, tipo').single()
  if (error) throw error
  return data
}
export const limpiezasCliente = () => rows(supabase.from('v_limpiezas_cliente').select('*'))
export const ubicarClienteEnMapa = async (clienteId, lat, lng, direccion) => {
  const { error } = await supabase.rpc('ubicar_cliente', { p_cliente: clienteId, p_lat: lat, p_lng: lng, p_direccion: direccion || null })
  if (error) throw error
}
export const moverUbicacion = async (id, lat, lng) => {
  const { error } = await supabase.from('ubicaciones').update({ lat, lng }).eq('id', id)
  if (error) throw error
}

// ── Clientes ──────────────────────────────────────────────────────────────
export const clientesResumen = () => rows(supabase.from('v_clientes_resumen').select('*').order('nombre'))
export const crearCliente = async (datos) => {
  const { data, error } = await supabase.from('clientes').insert(datos).select('id').single()
  if (error) throw error
  return data
}
export const clientePorId = (id) => one(supabase.from('clientes').select('*').eq('id', id))
export const actualizarCliente = async (id, datos) => {
  const { error } = await supabase.from('clientes').update(datos).eq('id', id)
  if (error) throw error
  await supabase.from('ubicaciones').update({ nombre: datos.nombre, direccion: datos.direccion, lat: datos.lat, lng: datos.lng })
    .eq('cliente_id', id).eq('tipo', 'cliente')
  return { id }
}
export const eliminarCliente = async (id) => {
  const { error } = await supabase.rpc('eliminar_cliente', { p_id: id })
  if (error) throw error
}
export const procesarVencidos = () => supabase.rpc('procesar_vencidos').then(() => null, () => null)

export const rubros = () => rows(supabase.from('rubros').select('*').order('nombre'))
export const crearRubro = async (nombre) => {
  const clave = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const { data, error } = await supabase.from('rubros').insert({ clave, nombre }).select('*').single()
  if (error) throw error.code === '23505' ? new Error('Ese rubro ya existe.') : error
  return data
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

// ── Ficha del baño: mantenciones y reparaciones ──────────────────────────
export const mantencionesDe = (activoId) => rows(
  supabase.from('mantenciones').select('*').eq('activo_id', activoId).order('fecha_programada', { ascending: false })
)

// ── Clientes: última visita y próximo servicio (rutas + despachos) ─────────
export const clientesOperacion = async () => {
  const hoy = new Date().toISOString().slice(0, 10)
  const seguro = (p) => p.catch(() => [])
  const [par, des, cli] = await Promise.all([
    seguro(rows(supabase.from('salida_paradas').select('cliente_id, salidas!inner(fecha, estado)').in('salidas.estado', ['cerrada', 'planificada']))),
    seguro(rows(supabase.from('despachos').select('cliente_id, estado, fecha_programada, fecha_realizada').in('estado', ['hecho', 'programado']))),
    seguro(rows(supabase.from('clientes').select('id, dias_limpieza'))),
  ])
  const m = {}
  cli.forEach((c) => { m[c.id] = { ultima: null, proxima: null, dias: c.dias_limpieza || [] } })
  const ini = hoy.slice(0, 8) + '01'
  const reg = (id, f, hecho) => {
    if (!id || !f) return
    const x = (m[id] ||= { ultima: null, proxima: null, dias: [] })
    x.servicios ??= 0; x.despachos ??= 0; x.aTiempo ??= 0
    if (hecho && f >= ini) x.servicios++
    if (hecho) { if (!x.ultima || f > x.ultima) x.ultima = f }
    else if (f >= hoy && (!x.proxima || f < x.proxima)) x.proxima = f
  }
  par.forEach((p) => reg(p.cliente_id, p.salidas?.fecha, p.salidas?.estado === 'cerrada'))
  des.forEach((d) => {
    const f = d.estado === 'hecho' ? (d.fecha_realizada || '').slice(0, 10) : d.fecha_programada
    reg(d.cliente_id, f, d.estado === 'hecho')
    if (d.estado === 'hecho' && f >= ini && m[d.cliente_id]) { m[d.cliente_id].despachos++; if (f <= d.fecha_programada) m[d.cliente_id].aTiempo++ }
  })
  return m
}

// ── Tablero de Inicio: operación diaria, activos y transporte ───────────────
export const tableroInicio = async () => {
  const hoy = new Date().toISOString().slice(0, 10)
  const en7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
  const seguro = (p) => p.catch(() => [])
  const [act, des, salHoy, man] = await Promise.all([
    rows(supabase.from('activos').select('id, codigo, tipo, estado').neq('estado', 'baja')),
    seguro(rows(supabase.from('despachos').select('id, tipo, fecha_programada, vehiculo_id').eq('estado', 'programado'))),
    seguro(rows(supabase.from('salidas').select('id, vehiculo_id, salida_paradas(id)').eq('estado', 'planificada').eq('fecha', hoy).is('salida_paradas.despacho_id', null))),
    seguro(rows(supabase.from('mantenciones').select('id, fecha_programada, activos!inner(tipo)').in('estado', ['programada', 'proxima', 'urgente']))),
  ])
  const banos = act.filter((x) => x.tipo === 'bano_quimico')
  const flota = act.filter((x) => ['camion', 'camioneta'].includes(x.tipo))
  const n = (l, e) => l.filter((x) => e.includes(x.estado)).length
  const enRuta = new Set([...salHoy.map((s) => s.vehiculo_id), ...des.filter((d) => d.fecha_programada === hoy).map((d) => d.vehiculo_id)].filter(Boolean))
  const manVeh = man.filter((m) => ['camion', 'camioneta'].includes(m.activos?.tipo))
  return {
    operacion: {
      hoy: des.filter((d) => d.fecha_programada === hoy).length + salHoy.reduce((t, s) => t + (s.salida_paradas?.length || 0), 0),
      atrasados: des.filter((d) => d.fecha_programada < hoy).length,
      retiros: des.filter((d) => d.tipo === 'retiro').length,
      mantenciones: man.filter((m) => m.fecha_programada <= en7).length,
    },
    banos: {
      total: banos.length, disponibles: n(banos, ['disponible']), arrendados: n(banos, ['en_arriendo']),
      limpieza: n(banos, ['en_limpieza']), fuera: n(banos, ['mantencion', 'fuera_de_servicio']),
    },
    transporte: {
      total: flota.length,
      operando: flota.filter((v) => enRuta.has(v.id) || v.estado === 'en_servicio').length,
      disponibles: flota.filter((v) => !enRuta.has(v.id) && ['disponible', 'en_servicio'].includes(v.estado) && v.estado !== 'en_servicio').length,
      taller: n(flota, ['mantencion', 'fuera_de_servicio']),
      mantPendientes: manVeh.length,
    },
    banosFuera: banos.filter((b) => b.estado === 'fuera_de_servicio'),
    vehiculosDetenidos: flota.filter((v) => ['mantencion', 'fuera_de_servicio'].includes(v.estado)),
  }
}

// ── Avisos calculados (calendario, contratos, mantenciones, insumos, despachos) ──
export const avisosCalculados = async () => {
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const iso = (d) => d.toISOString().slice(0, 10)
  const en = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return iso(d) }
  const dias = (f) => Math.round((new Date(f + 'T12:00:00') - hoy) / 864e5)
  const cuando = (f) => { const n = dias(f); return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n < 0 ? `Hace ${-n} día(s)` : `En ${n} días` }
  const seguro = (p) => p.catch(() => [])
  const [ev, cli, man, ins, des] = await Promise.all([
    seguro(rows(supabase.from('eventos').select('id, fecha, tipo, titulo').gte('fecha', iso(hoy)).lte('fecha', en(7)).order('fecha'))),
    seguro(rows(supabase.from('clientes').select('id, nombre, fecha_fin_contrato').gte('fecha_fin_contrato', iso(hoy)).lte('fecha_fin_contrato', en(15)))),
    seguro(rows(supabase.from('mantenciones').select('id, tipo, fecha_programada, estado, activos(codigo)').in('estado', ['programada', 'proxima', 'urgente']).lte('fecha_programada', en(7)))),
    seguro(rows(supabase.from('insumos').select('id, nombre, stock_actual, stock_minimo, unidad'))),
    seguro(rows(supabase.from('despachos').select('id, folio, tipo, fecha_programada, clientes(nombre)').eq('estado', 'programado').lte('fecha_programada', iso(hoy)))),
  ])
  const lista = []
  ev.forEach((e) => lista.push({
    id: 'ev-' + e.id + '-' + e.fecha, fecha: e.fecha, origen: 'Calendario',
    nivel: e.tipo === 'alerta' ? 'alerta' : dias(e.fecha) <= 1 ? 'aviso' : 'info',
    texto: `${cuando(e.fecha)}: ${e.titulo}`,
  }))
  cli.forEach((c) => lista.push({
    id: 'cto-' + c.id + '-' + c.fecha_fin_contrato, fecha: c.fecha_fin_contrato, origen: 'Clientes', a: '/clientes',
    nivel: dias(c.fecha_fin_contrato) <= 3 ? 'alerta' : 'aviso',
    texto: `Contrato de ${c.nombre} vence ${cuando(c.fecha_fin_contrato).toLowerCase()}`,
  }))
  man.forEach((m) => lista.push({
    id: 'man-' + m.id + '-' + m.fecha_programada, fecha: m.fecha_programada, origen: 'Mantenciones', a: '/mantenciones',
    nivel: m.estado === 'urgente' || dias(m.fecha_programada) < 0 ? 'alerta' : 'aviso',
    texto: `${dias(m.fecha_programada) < 0 ? 'Atrasada' : cuando(m.fecha_programada)}: ${m.tipo} · ${m.activos?.codigo || ''}`,
  }))
  ins.filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo) && Number(i.stock_minimo) > 0).forEach((i) => lista.push({
    id: 'ins-' + i.id + '-' + i.stock_actual, fecha: iso(hoy), origen: 'Insumos', a: '/insumos', nivel: 'aviso',
    texto: `${i.nombre} bajo el mínimo: quedan ${Number(i.stock_actual).toLocaleString('es-CL')} ${i.unidad}`,
  }))
  des.forEach((d) => lista.push({
    id: 'des-' + d.id + '-' + d.fecha_programada, fecha: d.fecha_programada, origen: 'Despachos', a: '/despachos',
    nivel: dias(d.fecha_programada) < 0 ? 'alerta' : 'info',
    texto: `${dias(d.fecha_programada) < 0 ? 'Atrasado' : 'Hoy'}: ${d.tipo} ${d.folio} · ${d.clientes?.nombre || ''}`,
  }))
  return lista
}

// ── Configuración ─────────────────────────────────────────────────────────
export const perfiles = () => rows(supabase.from('perfiles').select('*').order('nombre'))
export const todosPermisos = () => rows(supabase.from('permisos_rol').select('*'))
export const guardarPermiso = (rol, seccion, ver, editar) => rows(
  supabase.from('permisos_rol').upsert({ rol, seccion, ver, editar }, { onConflict: 'rol,seccion' }).select()
)
export const guardarPerfil = async (u, cambios) => {
  await rows(supabase.from('perfiles').update(cambios).eq('id', u.id).select())
  if (cambios.rol && u.correo) await supabase.from('accesos_autorizados').update({ rol: cambios.rol }).eq('correo', u.correo.toLowerCase())
}
export const accesosAutorizados = () => rows(supabase.from('accesos_autorizados').select('*').order('nombre'))
export const autorizarCorreo = (a) => rows(supabase.from('accesos_autorizados').upsert({ ...a, correo: a.correo.trim().toLowerCase() }).select())
export const quitarAutorizacion = (correo) => rows(supabase.from('accesos_autorizados').delete().eq('correo', correo).select())

// ── Historial de cambios (solo dueños) ───────────────────────────────────
export const historial = (desde) => {
  let q = supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(1000)
  if (desde) q = q.gte('fecha', desde)
  return rows(q)
}

// ── Logística: baños disponibles para despachar ──────────────────────────
export const banosDisponibles = async () => {
  const [lista, ocupados] = await Promise.all([
    rows(supabase.from('activos').select('id, codigo, modelos_bano(nombre, tipo)')
      .eq('tipo', 'bano_quimico').eq('estado', 'disponible').order('codigo')),
    rows(supabase.from('despacho_banos').select('activo_id, despachos!inner(estado)')
      .eq('accion', 'entrega').eq('despachos.estado', 'programado')),
  ])
  const tomados = new Set(ocupados.map((o) => o.activo_id))
  return lista.filter((b) => !tomados.has(b.id))
}
// Todos los baños con su estado, cliente y si están reservados en un despacho pendiente
export const banosEstado = async () => {
  const [lista, reservas] = await Promise.all([
    rows(supabase.from('activos').select('id, codigo, estado, clientes(nombre), modelos_bano(nombre, tipo)')
      .eq('tipo', 'bano_quimico').neq('estado', 'baja').order('codigo')),
    rows(supabase.from('despacho_banos').select('activo_id, despachos!inner(folio, estado)')
      .eq('accion', 'entrega').eq('despachos.estado', 'programado')),
  ])
  const res = Object.fromEntries(reservas.map((r) => [r.activo_id, r.despachos?.folio]))
  return lista.map((b) => ({ ...b, reservado: res[b.id] || null }))
}
export const agregarParadaRuta = async (rutaId, clienteId) => {
  const { data } = await supabase.from('ruta_paradas').select('orden').eq('ruta_id', rutaId).order('orden', { ascending: false }).limit(1)
  const orden = (data?.[0]?.orden || 0) + 1
  const { error } = await supabase.from('ruta_paradas').insert({ ruta_id: rutaId, cliente_id: clienteId, tarea: 'limpieza', orden })
  if (error) throw error
  const hoy = new Date().toISOString().slice(0, 10)
  await supabase.from('salidas').delete().eq('ruta_id', rutaId).eq('estado', 'planificada').gte('fecha', hoy)
  await supabase.rpc('generar_salidas', { dias: 14 })
}
export const banosDeCliente = (clienteId) => rows(
  supabase.from('activos').select('id, codigo, modelos_bano(nombre, tipo)')
    .eq('cliente_id', clienteId).eq('estado', 'en_arriendo').order('codigo')
)

// ── Transporte ────────────────────────────────────────────────────────────
export const guardarVehiculo = async (activoId, activo, vehiculo) => {
  let id = activoId
  if (id) {
    const { error } = await supabase.from('activos').update(activo).eq('id', id)
    if (error) throw error
    const { error: e2 } = await supabase.from('vehiculos').upsert({ activo_id: id, ...vehiculo })
    if (e2) throw e2
  } else {
    const { data, error } = await supabase.from('activos').insert(activo).select('id').single()
    if (error) throw error
    id = data.id
    const { error: e2 } = await supabase.from('vehiculos').insert({ activo_id: id, ...vehiculo })
    if (e2) throw e2
  }
  return id
}

// ── Insumos ───────────────────────────────────────────────────────────────
export const insumosLista = () => rows(supabase.from('insumos').select('*, receta_limpieza(cantidad)').order('nombre'))
export const guardarInsumo = async (id, datos, receta) => {
  let iid = id
  if (iid) {
    const { error } = await supabase.from('insumos').update(datos).eq('id', iid)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('insumos').insert(datos).select('id').single()
    if (error) throw error
    iid = data.id
  }
  if (receta) {
    const { error } = await supabase.from('receta_limpieza').upsert({ insumo_id: iid, cantidad: receta })
    if (error) throw error
  } else {
    await supabase.from('receta_limpieza').delete().eq('insumo_id', iid)
  }
}
// Movimiento de insumo: suma o resta stock y deja registro (fecha, usuario, tipo, motivo)
export const TIPOS_MOV_INSUMO = {
  compra: { l: 'Compra', signo: 1 }, devolucion: { l: 'Devolución', signo: 1 },
  consumo: { l: 'Consumo', signo: -1 }, merma: { l: 'Merma', signo: -1 }, ajuste: { l: 'Ajuste', signo: 0 },
}
export const movimientoInsumo = async (insumo, tipo, cantidad, motivo) => {
  const { data } = await supabase.rpc('mover_insumo', { p_insumo: insumo.id, p_tipo: tipo, p_cantidad: cantidad, p_motivo: motivo || null })
    .then((r) => { if (r.error) throw r.error; return r })
  return data
}
export const movimientosInsumo = (insumoId) => rows(
  supabase.from('movimientos_insumo').select('id, fecha, tipo, cantidad, motivo, usuario:usuario_id(nombre)')
    .eq('insumo_id', insumoId).order('fecha', { ascending: false }).limit(200)
)
export const ingresoInsumo = async (insumo, cantidad, motivo) => {
  const { error } = await supabase.from('insumos')
    .update({ stock_actual: Number(insumo.stock_actual) + cantidad }).eq('id', insumo.id)
  if (error) throw error
  await supabase.from('movimientos_insumo').insert({ insumo_id: insumo.id, cantidad, motivo })
}


// ── Despachos ─────────────────────────────────────────────────────────────
export const despachos = () => rows(supabase.from('v_despachos').select('*').order('fecha_programada', { ascending: false }))
export const crearDespacho = async (datos, banos) => {
  const { data, error } = await supabase.from('despachos').insert(datos).select('id').single()
  if (error) throw error
  if (banos.length) {
    const { error: e2 } = await supabase.from('despacho_banos')
      .insert(banos.map((b) => ({ despacho_id: data.id, activo_id: b.id, accion: b.accion })))
    if (e2) { await supabase.from('despachos').delete().eq('id', data.id); throw e2 }
  }
  return data.id
}
export const estadoDespacho = async (id, estado) => {
  const cambios = { estado }
  if (estado === 'hecho') cambios.fecha_realizada = new Date().toISOString()
  const { error } = await supabase.from('despachos').update(cambios).eq('id', id)
  if (error) throw error
}

// ── Rutas y salidas ───────────────────────────────────────────────────────
export const rutasLista = () => rows(
  supabase.from('rutas').select('*, activos(codigo), ruta_paradas(id, cliente_id, orden, tarea, clientes(nombre))').order('nombre')
)
export const guardarRuta = async (id, datos, paradas) => {
  let rid = id
  if (rid) {
    const { error } = await supabase.from('rutas').update(datos).eq('id', rid)
    if (error) throw error
    await supabase.from('ruta_paradas').delete().eq('ruta_id', rid)
    const hoy = new Date().toISOString().slice(0, 10)
    await supabase.from('salidas').delete().eq('ruta_id', rid).eq('estado', 'planificada').gte('fecha', hoy)
  } else {
    const { data, error } = await supabase.from('rutas').insert(datos).select('id').single()
    if (error) throw error
    rid = data.id
  }
  if (paradas.length) {
    const { error } = await supabase.from('ruta_paradas')
      .insert(paradas.map((p, i) => ({ ruta_id: rid, cliente_id: p.cliente_id, tarea: p.tarea, orden: i + 1 })))
    if (error) throw error
  }
  await supabase.rpc('generar_salidas', { dias: 14 })
}
export const borrarRuta = async (id) => {
  const { error } = await supabase.from('rutas').delete().eq('id', id)
  if (error) throw error
}
export const generarSalidas = () => supabase.rpc('generar_salidas', { dias: 14 }).then(() => null, () => null)
export const salidas = (desde, hasta) => rows(
  supabase.from('v_salidas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha')
)
export const paradasDe = (salidaId) => rows(
  supabase.from('salida_paradas').select('*, clientes(nombre, direccion, comuna)').eq('salida_id', salidaId).order('orden')
)
export const despachosDeSalida = (salidaId) => rows(supabase.from('v_despachos').select('*').eq('salida_id', salidaId))
export const salidasDelDia = (fecha) => rows(supabase.from('v_salidas').select('id, ruta, fecha, vehiculo').eq('fecha', fecha))
export const actualizarSalida = async (id, cambios) => {
  const { error } = await supabase.from('salidas').update(cambios).eq('id', id)
  if (error) throw error
}
export const marcarParada = async (id, hecha) => {
  const { error } = await supabase.from('salida_paradas')
    .update({ hecha, hecha_en: hecha ? new Date().toISOString() : null }).eq('id', id)
  if (error) throw error
}

// ── Parámetros de costo ───────────────────────────────────────────────────
export const parametros = () => rows(supabase.from('parametros').select('*').order('clave'))
export const guardarParametro = async (clave, valor) => {
  const { error } = await supabase.from('parametros').update({ valor }).eq('clave', clave)
  if (error) throw error
}
export const guardarPesoModelo = async (id, peso_kg) => {
  const { error } = await supabase.from('modelos_bano').update({ peso_kg }).eq('id', id)
  if (error) throw error
}

// ── Exportación ───────────────────────────────────────────────────────────
export const vistaExport = (nombre) => rows(supabase.from(nombre).select('*'))
