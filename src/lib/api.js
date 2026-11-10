import { supabase } from './supabase'
import { DRIVE_URL } from './drive'

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
export const mapaPuntos = () => rows(supabase.from('v_mapa_puntos').select('*').order('activos', { ascending: false }))

// ── Notificaciones ────────────────────────────────────────────────────────
export const notificaciones = () => rows(
  supabase.from('notificaciones').select('*').order('creado_en', { ascending: false }).limit(20)
)
export const marcarLeidas = async () => {
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
  if (error) throw error
}

// ── Inventario y activos ──────────────────────────────────────────────────

// Por defecto solo vehículos activos (los desactivados no se eligen en rutas ni operaciones)
export const vehiculos = (todos = false) => rows(
  supabase.from('vehiculos')
    .select('*, activos(id, codigo, tipo, estado, qr_token, ubicaciones!ubicacion_id(nombre))')
).then((l) => (todos ? l : l.filter((v) => v.activos?.estado !== 'baja')))

// ── Flota (lámina 5) ──────────────────────────────────────────────────────
export const flota = () => rows(supabase.from('v_flota').select('*'))
export const cambiarDisponibilidadVehiculo = async (id, estado, fecha, motivo) => {
  const { error } = await supabase.rpc('cambiar_disponibilidad_vehiculo', { p_id: id, p_estado: estado, p_fecha: fecha, p_motivo: motivo })
  if (error) throw error
}
export const desactivarVehiculo = async (id, motivo) => {
  const { error } = await supabase.rpc('desactivar_vehiculo', { p_id: id, p_motivo: motivo })
  if (error) throw error
}
// Ubicaciones donde se guardan insumos: bodegas, talleres y vehículos (insumos a bordo)
export const ubicacionesInsumo = () => rows(
  supabase.from('ubicaciones').select('id, nombre, tipo, descripcion, activa').in('tipo', ['bodega', 'taller', 'vehiculo']).order('tipo').order('nombre')
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


// clases: ['camion','camioneta'] para vehículos o ['bano','equipo'] para equipos (sin clases = todas)
export const tiposMantencion = (clases) => {
  let q = supabase.from('mantenciones').select('tipo').limit(500)
  if (clases) q = q.in('clase', clases)
  return rows(q).then((r) => [...new Set(r.map((x) => x.tipo).filter(Boolean))])
}

// ── Catálogos para los formularios ────────────────────────────────────────

// Solo clientes activos: los desactivados no se eligen en despachos ni equipos nuevos
export const clientesLista = () => rows(supabase.from('clientes').select('id, nombre, direccion').eq('activo', true).order('nombre'))


export const buscarGlobal = async (q) => {
  const t = q.replace(/[%,()]/g, ' ').trim()
  const [activos, clientes] = await Promise.all([
    // Equipos y vehículos: por código que EMPIEZA con lo escrito (ej. "10" → 10, 101…)
    rows(supabase.from('activos').select('id, codigo, tipo, estado, qr_token, clientes!cliente_id(nombre)').neq('estado', 'baja').ilike('codigo', `${t}%`).order('codigo').limit(6)),
    rows(supabase.from('clientes').select('id, nombre, direccion, comuna').or(`nombre.ilike.%${t}%,direccion.ilike.%${t}%,comuna.ilike.%${t}%`).order('nombre').limit(6)),
  ])
  return { activos, clientes }
}

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


// ── Clientes ──────────────────────────────────────────────────────────────
export const clientesResumen = () => rows(supabase.from('v_clientes_resumen').select('*').order('nombre'))

export const clientePorId = (id) => one(supabase.from('clientes').select('*').eq('id', id))

// ── Clientes (etapa 2): listado, datos generales y desactivación ─────────
export const normalizarRut = (rut) => String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase()
export const clientesListado = async () => {
  const [c, u, s] = await Promise.all([
    rows(supabase.from('clientes')
      .select('id, codigo, nombre, nombre_comercial, rut, tipo_cliente, comuna, telefono, correo, activo, motivo_desactivacion, desactivado_en')
      .order('nombre')),
    rows(supabase.from('ubicaciones').select('cliente_id').eq('tipo', 'cliente').eq('activa', true).not('cliente_id', 'is', null)),
    rows(supabase.from('servicios_cliente').select('cliente_id').eq('estado', 'vigente')),
  ])
  const cuenta = (lista) => lista.reduce((m, x) => { m[x.cliente_id] = (m[x.cliente_id] || 0) + 1; return m }, {})
  const nu = cuenta(u), ns = cuenta(s)
  return c.map((x) => ({ ...x, ubicaciones: nu[x.id] || 0, servicios_vigentes: ns[x.id] || 0 }))
}
// Otro cliente con el mismo RUT (comparado sin puntos ni guion)
export const clientePorRut = async (rut, excluirId = null) => {
  const norm = normalizarRut(rut)
  if (!norm) return null
  let q = supabase.from('clientes').select('id, codigo, nombre, activo').eq('rut_norm', norm)
  if (excluirId) q = q.neq('id', excluirId)
  const r = await rows(q.limit(1))
  return r[0] || null
}
// Solo datos generales: no toca ubicaciones, servicios ni los campos antiguos (valor, días, baños propios, lat/lng)
export const guardarDatosCliente = async (id, datos) => {
  if (id) {
    const { error } = await supabase.from('clientes').update(datos).eq('id', id)
    if (error) throw error
    return { id }
  }
  const { data, error } = await supabase.from('clientes').insert(datos).select('id, codigo').single()
  if (error) throw error
  return data
}
export const desactivarCliente = async (id, motivo) => {
  const { error } = await supabase.rpc('desactivar_cliente', { p_id: id, p_motivo: motivo })
  if (error) throw error
}
export const reactivarCliente = async (id) => {
  const { error } = await supabase.rpc('reactivar_cliente', { p_id: id })
  if (error) throw error
}
// ── Ficha del cliente: contactos, ubicaciones, servicios e historial ─────
export const clienteFicha = async (id) => {
  const [c, u, s] = await Promise.all([
    one(supabase.from('clientes').select('*').eq('id', id)),
    rows(supabase.from('ubicaciones').select('id').eq('cliente_id', id).eq('tipo', 'cliente').eq('activa', true)),
    rows(supabase.from('servicios_cliente').select('id').eq('cliente_id', id).eq('estado', 'vigente')),
  ])
  return c ? { ...c, ubicaciones_activas: u.length, servicios_vigentes: s.length } : null
}
export const rubroNombre = async (clave) => {
  if (!clave) return null
  const r = await rows(supabase.from('rubros').select('nombre').eq('clave', clave).limit(1))
  return r[0]?.nombre || clave
}

export const contactosDe = (clienteId) => rows(
  supabase.from('cliente_contactos').select('*').eq('cliente_id', clienteId)
    .order('activo', { ascending: false }).order('principal', { ascending: false }).order('nombre')
)
// Solo un principal activo por cliente: si este pasa a principal, los demás dejan de serlo
export const guardarContacto = async (clienteId, id, datos) => {
  if (datos.principal && datos.activo !== false) {
    let q = supabase.from('cliente_contactos').update({ principal: false }).eq('cliente_id', clienteId).eq('principal', true)
    if (id) q = q.neq('id', id)
    const { error } = await q
    if (error) throw error
  }
  const { error } = id
    ? await supabase.from('cliente_contactos').update(datos).eq('id', id)
    : await supabase.from('cliente_contactos').insert({ ...datos, cliente_id: clienteId })
  if (error) throw error
}

export const ubicacionesDe = (clienteId) => rows(
  supabase.from('ubicaciones')
    .select('id, nombre, direccion, comuna, lat, lng, activa, indicaciones, descripcion, contacto_id')
    .eq('cliente_id', clienteId).eq('tipo', 'cliente')
    .order('activa', { ascending: false }).order('nombre')
)
// Lo que impide desactivar una ubicación: baños FOSAN ahí o servicios vigentes
export const usoUbicacion = async (id) => {
  const [a, s] = await Promise.all([
    rows(supabase.from('activos').select('id').eq('ubicacion_id', id).eq('estado', 'en_arriendo')),
    rows(supabase.from('servicios_cliente').select('id').eq('ubicacion_id', id).eq('estado', 'vigente')),
  ])
  return { banos: a.length, servicios: s.length }
}
export const guardarUbicacion = async (clienteId, id, datos) => {
  const { error } = id
    ? await supabase.from('ubicaciones').update(datos).eq('id', id)
    : await supabase.from('ubicaciones').insert({ ...datos, tipo: 'cliente', cliente_id: clienteId })
  if (error) throw error
}

// Incluye los baños FOSAN que hoy están en arriendo con cada servicio (activos.servicio_id)
export const serviciosDe = (clienteId) => rows(
  supabase.from('servicios_cliente').select('*, ubicaciones(nombre), activos!servicio_id(codigo, qr_token, estado)').eq('cliente_id', clienteId)
    .eq('activos.estado', 'en_arriendo')
    .order('estado', { ascending: false }).order('fecha_inicio', { ascending: false })
)

// ── Servicios del cliente (A, B, C) y equipos externos ───────────────────
export const categoriasEquipo = () => rows(
  supabase.from('categorias').select('id, nombre').eq('clase', 'equipo').eq('activo', true).order('nombre')
)
export const externosDe = async (clienteId) => {
  const r = await rows(supabase.from('activos')
    .select('id, codigo, detalle, codigo_cliente, servicio_id, ubicacion_id, servicios_cliente(estado)')
    .eq('propiedad', 'cliente').eq('propietario_id', clienteId).neq('estado', 'baja').order('codigo'))
  return r.map((x) => ({ ...x, servicio_vigente: x.servicios_cliente?.estado === 'vigente' }))
}
// El código EXT-### lo pone la base; queda "En operación" y fuera del stock FOSAN
export const crearExterno = async (datos) => {
  const { data, error } = await supabase.from('activos')
    .insert({ ...datos, tipo: 'bano_quimico', propiedad: 'cliente' })
    .select('id, codigo, detalle, codigo_cliente, servicio_id, ubicacion_id').single()
  if (error) throw error
  return { ...data, servicio_vigente: false }
}
// Guarda el acuerdo y, en el tipo B, qué equipos externos atiende
export const guardarServicio = async (clienteId, id, datos, externos = [], externosAntes = []) => {
  let sid = id
  if (id) {
    const { error } = await supabase.from('servicios_cliente').update(datos).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('servicios_cliente').insert({ ...datos, cliente_id: clienteId }).select('id').single()
    if (error) throw error
    sid = data.id
  }
  const quitar = externosAntes.filter((x) => !externos.includes(x))
  if (quitar.length) {
    const { error } = await supabase.from('activos').update({ servicio_id: null }).in('id', quitar)
    if (error) throw error
  }
  const poner = externos.filter((x) => !externosAntes.includes(x))
  if (poner.length) {
    const { error } = await supabase.from('activos').update({ servicio_id: sid }).in('id', poner)
    if (error) throw error
  }
  return sid
}
export const finalizarServicio = async (id, fechaTermino) => {
  const { error } = await supabase.from('servicios_cliente').update({ estado: 'finalizado', fecha_termino: fechaTermino }).eq('id', id)
  if (error) throw error
}
export const historialCliente = async (clienteId) => {
  const { data, error } = await supabase.rpc('historial_cliente', { p_id: clienteId })
  if (error) throw error
  return data || []
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


// ── Mantenimiento (lámina 6) ──────────────────────────────────────────────
export const mantenimiento = () => rows(supabase.from('v_mantenimiento').select('*').order('fecha_programada', { ascending: false }).limit(3000))
const rpcM = async (fn, args) => { const { data, error } = await supabase.rpc(fn, args); if (error) throw error; return data }
export const programarMantencion = (d) => rpcM('programar_mantencion', {
  p_activo: d.activo_id, p_tipo: d.tipo, p_fecha: d.fecha, p_responsable: d.responsable, p_trabajo: d.trabajo, p_obs: d.observaciones || null, p_bloquea: !!d.bloquea,
})
export const editarMantencion = (id, d) => rpcM('editar_mantencion', {
  p_id: id, p_tipo: d.tipo, p_fecha: d.fecha, p_responsable: d.responsable, p_trabajo: d.trabajo, p_obs: d.observaciones || null,
})
export const iniciarMantencion = (id) => rpcM('iniciar_mantencion', { p_id: id })
export const registrarResultadoMantencion = (id, d) => rpcM('registrar_resultado_mantencion', {
  p_id: id, p_fecha: d.fecha, p_resultado: d.resultado, p_trabajo: d.trabajo, p_condicion: d.condicion, p_obs: d.observaciones || null, p_costo: d.costo ?? null,
})
export const cancelarMantencion = (id, motivo) => rpcM('cancelar_mantencion', { p_id: id, p_motivo: motivo })
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


// ── Avisos calculados (calendario, contratos, mantenciones, insumos, despachos) ──
export const avisosCalculados = async () => {
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const iso = (d) => d.toISOString().slice(0, 10)
  const en = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return iso(d) }
  const dias = (f) => Math.round((new Date(f + 'T12:00:00') - hoy) / 864e5)
  const cuando = (f) => { const n = dias(f); return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n < 0 ? `Hace ${-n} día(s)` : `En ${n} días` }
  const seguro = (p) => p.catch(() => [])
  const [ev, cli, man, ins, des, doc] = await Promise.all([
    seguro(rows(supabase.from('eventos').select('id, fecha, tipo, titulo').gte('fecha', iso(hoy)).lte('fecha', en(7)).order('fecha'))),
    seguro(rows(supabase.from('clientes').select('id, nombre, fecha_fin_contrato').gte('fecha_fin_contrato', iso(hoy)).lte('fecha_fin_contrato', en(15)))),
    seguro(rows(supabase.from('mantenciones').select('id, tipo, fecha_programada, estado, activos(codigo)').in('estado', ['programada', 'proxima', 'urgente']).lte('fecha_programada', en(7)))),
    seguro(rows(supabase.from('insumos').select('id, nombre, stock_actual, stock_minimo, unidad'))),
    seguro(rows(supabase.from('despachos').select('id, folio, tipo, fecha_programada, clientes(nombre)').eq('estado', 'programado').lte('fecha_programada', iso(hoy)))),
    seguro(rows(supabase.from('documentos_activo').select('id, titulo, tipo, fecha_vencimiento, activo_id, activos(codigo, tipo, qr_token)')
      .eq('anulado', false).not('fecha_vencimiento', 'is', null).lte('fecha_vencimiento', en(30)))),
  ])
  const lista = []
  // Documentos que vencen en 30 días o ya vencieron (revisión técnica, permiso, seguro…)
  doc.forEach((d) => lista.push({
    id: 'doc-' + d.id + '-' + d.fecha_vencimiento, fecha: d.fecha_vencimiento, origen: 'Documentos',
    a: d.activos?.qr_token ? `/activo/${d.activos.qr_token}` : null,
    nivel: dias(d.fecha_vencimiento) < 0 ? 'alerta' : 'aviso',
    texto: `${d.titulo} de ${d.activos?.codigo || 'un equipo'} ${dias(d.fecha_vencimiento) < 0 ? 'venció' : 'vence'} ${cuando(d.fecha_vencimiento).toLowerCase()}`,
  }))
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
    id: 'man-' + m.id + '-' + m.fecha_programada, fecha: m.fecha_programada, origen: 'Mantenciones',
    a: ['camion', 'camioneta'].includes(m.activos?.tipo) ? '/mantenimiento?tab=vehiculos' : '/mantenimiento?tab=equipos',
    nivel: m.estado === 'urgente' || dias(m.fecha_programada) < 0 ? 'alerta' : 'aviso',
    texto: `${dias(m.fecha_programada) < 0 ? 'Atrasada' : cuando(m.fecha_programada)}: ${m.tipo} · ${m.activos?.codigo || ''}`,
  }))
  ins.filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo) && Number(i.stock_minimo) > 0).forEach((i) => lista.push({
    id: 'ins-' + i.id + '-' + i.stock_actual, fecha: iso(hoy), origen: 'Insumos', a: '/inventario?tab=insumos', nivel: 'aviso',
    texto: `${i.nombre} bajo el mínimo: quedan ${Number(i.stock_actual).toLocaleString('es-CL')} ${i.unidad}`,
  }))
  des.forEach((d) => lista.push({
    id: 'des-' + d.id + '-' + d.fecha_programada, fecha: d.fecha_programada, origen: 'Despachos', a: `/operaciones?tab=programacion&folio=${d.folio}`,
    nivel: dias(d.fecha_programada) < 0 ? 'alerta' : 'info',
    texto: `${dias(d.fecha_programada) < 0 ? 'Atrasado' : 'Hoy'}: ${d.tipo} ${d.folio} · ${d.clientes?.nombre || ''}`,
  }))
  return lista
}

// ── Configuración ─────────────────────────────────────────────────────────
export const todosPermisos = () => rows(supabase.from('permisos_rol').select('*'))

// ── Administración → Personal y usuarios (láminas 8.1 a 8.3) ─────────────
// Persona = fila de "personal". Si tiene acceso, está unida a su cuenta en "perfiles".
// Las contraseñas nunca se guardan ni se muestran: las maneja Supabase Auth.
export const personalLista = () => rows(
  supabase.from('personal').select('*, perfiles(id, nombre, correo, usuario, rol, activo)').order('nombre')
)
export const guardarPersona = async (id, datos, perfilId = null) => {
  const { data, error } = id
    ? await supabase.from('personal').update(datos).eq('id', id).select('id').single()
    : await supabase.from('personal').insert(datos).select('id').single()
  if (error) throw error.code === '23505' ? new Error('Ya hay una persona registrada con ese RUT.') : error
  if (perfilId && datos.nombre) await supabase.from('perfiles').update({ nombre: datos.nombre }).eq('id', perfilId)
  return data
}
export const usuarioOcupado = async (usuario, excluirPerfil = null) => {
  let q = supabase.from('perfiles').select('id').ilike('usuario', usuario.trim())
  if (excluirPerfil) q = q.neq('id', excluirPerfil)
  return (await rows(q.limit(1))).length > 0
}
// Crea la cuenta (contraseña asignada por el dueño), le pone nombre de usuario y la une a la persona
export const crearAcceso = async (personaId, { nombre, correo, usuario, rol, clave }) => {
  const c = correo.trim().toLowerCase()
  const { error } = await supabase.rpc('crear_usuario', { p_correo: c, p_nombre: nombre, p_rol: rol, p_clave: clave })
  if (error) throw error
  const p = await rows(supabase.from('perfiles').select('id').ilike('correo', c).limit(1))
  if (!p[0]) throw new Error('La cuenta se creó, pero no se encontró su perfil. Recarga la página.')
  const { error: e1 } = await supabase.from('perfiles').update({ usuario: usuario.trim().toLowerCase() }).eq('id', p[0].id)
  if (e1) throw e1.code === '23505' ? new Error('Ese nombre de usuario ya existe.') : e1
  const { error: e2 } = await supabase.from('personal').update({ perfil_id: p[0].id }).eq('id', personaId)
  if (e2) throw e2
}
export const actualizarAcceso = async (perfil, cambios) => {
  const { error } = await supabase.from('perfiles').update(cambios).eq('id', perfil.id)
  if (error) throw error.code === '23505' ? new Error('Ese nombre de usuario ya existe.') : error
  if (cambios.rol && perfil.correo) await supabase.from('accesos_autorizados').update({ rol: cambios.rol }).eq('correo', perfil.correo.toLowerCase())
}
export const asignarClave = async (correo, clave) => {
  const { error } = await supabase.rpc('cambiar_clave_usuario', { p_correo: correo, p_clave: clave })
  if (error) throw error
}
// Mantenimientos abiertos (programados o en curso), uno por equipo: para mostrarlo en Inventario
export const mantencionesAbiertas = () => rows(supabase.from('mantenciones').select('activo_id, folio, fecha_programada, iniciada_en')
  .in('estado', ['programada', 'proxima', 'urgente']).order('fecha_programada'))
// Cada persona cambia su propia contraseña: se comprueba la actual y luego se guarda la nueva
export const cambiarMiClave = async (correo, actual, nueva) => {
  if (!correo) throw new Error('No se encontró tu correo de acceso.')
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: correo, password: actual })
  if (e1) throw new Error('La contraseña actual no es correcta.')
  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) throw error
}
// La persona deja de trabajar en FOSAN: se oculta de Personal y de las listas de responsables (no se borra)
export const darDeBajaPersona = async (id) => {
  const { error } = await supabase.from('personal').update({ activo: false }).eq('id', id)
  if (error) throw error
}
export const eliminarCuenta = async (correo) => {
  const { error } = await supabase.rpc('eliminar_usuario', { p_correo: correo })
  if (error) throw error
}

// ── Administración → Roles y permisos (lámina 8.4) ───────────────────────
// Cada módulo nuevo guarda Consultar / Registrar / Exportar en las secciones actuales que le corresponden.
export const guardarPermisosRol = async (rol, filas) => {
  const { error } = await supabase.from('permisos_rol').upsert(
    filas.map((f) => ({ rol, seccion: f.seccion, ver: f.ver, editar: f.editar, exportar: f.exportar })),
    { onConflict: 'rol,seccion' },
  )
  if (error) throw error
}

// ── Inicio (lámina 1): indicadores, trabajos del período y actividad reciente ──
export const inicioDatos = async (desde, hasta) => {
  const hoy = new Date().toISOString().slice(0, 10)
  const seguro = (p, v = []) => p.then((r) => r, () => v)
  const contar = (q) => q.then(({ count, error }) => (error ? null : count), () => null)
  const [disponibles, atrasados, mant, ops, paradas] = await Promise.all([
    contar(supabase.from('v_equipos').select('id', { count: 'exact', head: true }).eq('propiedad', 'empresa').eq('situacion', 'disponible').eq('condicion', 'operativo')),
    contar(supabase.from('despachos').select('id', { count: 'exact', head: true }).eq('estado', 'programado').lt('fecha_programada', hoy)),
    contar(supabase.from('v_mantenimiento').select('id', { count: 'exact', head: true }).in('estado_m', ['programado', 'en_curso'])),
    seguro(rows(supabase.from('v_operaciones').select('*').gte('fecha_programada', desde).lte('fecha_programada', hasta).neq('estado', 'cancelado').order('fecha_programada'))),
    // Limpiezas de ruta del período (las entregas/retiros de ruta ya vienen como operaciones)
    seguro(rows(supabase.from('salida_paradas')
      .select('id, tarea, estado, despacho_id, clientes(nombre, direccion), salidas!inner(fecha, ruta_semana_id)')
      .gte('salidas.fecha', desde).lte('salidas.fecha', hasta).is('despacho_id', null))),
  ])
  // Nombre de la ruta semanal de cada parada
  const ids = [...new Set(paradas.map((p) => p.salidas?.ruta_semana_id).filter(Boolean))]
  const rutas = ids.length ? await seguro(rows(supabase.from('rutas_semana').select('id, nombre').in('id', ids))) : []
  const nom = Object.fromEntries(rutas.map((r) => [r.id, r.nombre]))
  paradas.forEach((p) => { if (p.salidas) p.salidas.rutas_semana = { nombre: nom[p.salidas.ruta_semana_id] || null } })
  return { disponibles, atrasados, mant, ops, paradas }
}
// Gráficos del Inicio (situación actual + últimos 6 meses). Cada parte falla sola sin romper el resto.
export const inicioGraficos = async (finanzas) => {
  const seguro = (p) => p.then((r) => r, () => [])
  const hoy = new Date(); const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().slice(0, 10)
  const [ops, equipos, mant, flotaL, clientes, fin] = await Promise.all([
    seguro(rows(supabase.from('despachos').select('fecha_programada, fecha_realizada, estado').gte('fecha_programada', desde).limit(5000))),
    seguro(rows(supabase.from('v_equipos').select('situacion, cliente').eq('propiedad', 'empresa').neq('situacion', 'baja').limit(5000))),
    seguro(rows(supabase.from('v_mantenimiento').select('estado_m, vencido').limit(5000))),
    seguro(rows(supabase.from('v_flota').select('estado_flota'))),
    seguro(rows(supabase.from('clientes').select('id').eq('activo', true))),
    finanzas ? seguro(rows(supabase.from('v_utilidad_mensual').select('*'))) : Promise.resolve([]),
  ])
  return { ops, equipos, mant, flota: flotaL, clientesActivos: clientes.length, fin, desde }
}
export const actividadPeriodo = (desde, hasta) => rows(
  supabase.from('auditoria').select('*').gte('fecha', desde).lte('fecha', hasta + 'T23:59:59').order('fecha', { ascending: false }).limit(200)
)


// ── Administración: historial con rango de fechas ────────────────────────
export const historialRango = (desde, hasta) => {
  let q = supabase.from('auditoria').select('*').order('fecha', { ascending: false }).limit(2000)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  return rows(q)
}

// ── Administración → Catálogos (categorías, modelos, ubicaciones internas, unidades) ──
// Nada se borra: se desactiva. Los nombres no se repiten.
export const catCategorias = () => rows(supabase.from('categorias').select('*').order('nombre'))
export const catModelos = () => rows(supabase.from('modelos_bano').select('*').order('nombre'))
export const catUbicacionesInternas = () => rows(
  supabase.from('ubicaciones').select('id, nombre, tipo, descripcion, activa').in('tipo', ['bodega', 'taller']).order('nombre')
)
export const catUnidades = () => rows(supabase.from('unidades_medida').select('*').order('nombre'))
const duplicado = (e, txt) => (e.code === '23505' ? new Error(txt) : e)
export const guardarCategoria = async (id, datos) => {
  const { error } = id ? await supabase.from('categorias').update(datos).eq('id', id) : await supabase.from('categorias').insert(datos)
  if (error) throw duplicado(error, 'Ya existe una categoría con ese nombre.')
}
export const guardarModelo = async (id, datos) => {
  const fila = { ...datos, ...(id ? {} : { tipo: datos.nombre }) }
  const { error } = id ? await supabase.from('modelos_bano').update(fila).eq('id', id) : await supabase.from('modelos_bano').insert(fila)
  if (error) throw duplicado(error, 'Ya existe un modelo con ese nombre.')
}
export const guardarUbicacionInterna = async (id, datos) => {
  const { error } = id ? await supabase.from('ubicaciones').update(datos).eq('id', id) : await supabase.from('ubicaciones').insert(datos)
  if (error) throw duplicado(error, 'Ya existe una ubicación con ese nombre.')
}
export const guardarUnidad = async (id, datos) => {
  const { error } = id ? await supabase.from('unidades_medida').update(datos).eq('id', id) : await supabase.from('unidades_medida').insert(datos)
  if (error) throw duplicado(error, 'Ya existe una unidad con ese nombre o abreviatura.')
}
// Cuántos registros usan un elemento del catálogo (para avisar al desactivar)
export const usoCatalogo = async (tipo, id) => {
  const n = async (q) => (await rows(q)).length
  if (tipo === 'categoria') {
    return (await n(supabase.from('activos').select('id').eq('categoria_id', id).neq('estado', 'baja')))
      + (await n(supabase.from('modelos_bano').select('id').eq('categoria_id', id).eq('activo', true)))
      + (await n(supabase.from('insumos').select('id').eq('categoria_id', id).eq('activo', true)))
  }
  if (tipo === 'modelo') return n(supabase.from('activos').select('id').eq('modelo_id', id).neq('estado', 'baja'))
  if (tipo === 'ubicacion') return n(supabase.from('activos').select('id').eq('ubicacion_id', id).neq('estado', 'baja'))
  if (tipo === 'unidad') return n(supabase.from('insumos').select('id').eq('unidad_id', id).eq('activo', true))
  return 0
}

// ── Inventario → Equipos (láminas 3.1 a 3.4) ────────────────────────────
export const equiposLista = () => rows(supabase.from('v_equipos').select('*').order('numero', { ascending: true, nullsFirst: false }).limit(5000))
export const siguienteNumeroUnidad = async () => {
  const { data, error } = await supabase.rpc('siguiente_numero_unidad')
  if (error) throw error
  return data
}
// ¿Ya existe ese N.º de unidad? (102 = 0102). Devuelve el equipo o null
export const equipoPorNumero = async (numero) => {
  const n = String(numero).replace(/^0+/, '')
  const r = await rows(supabase.from('v_equipos').select('id, codigo, qr_token, situacion').eq('propiedad', 'empresa').eq('tipo', 'bano_quimico'))
  return r.find((x) => String(x.codigo).replace(/^0+/, '') === n) || null
}
// Alta de equipo. La base pone situación, deja el registro inicial en Movimientos y, si es del cliente, el código EXT-###
export const crearEquipo = async (datos) => {
  const { data, error } = await supabase.from('activos').insert(datos).select('id, codigo, qr_token').single()
  if (error) {
    if (error.code === '23505') throw new Error('Ese N.º de unidad ya existe.')
    throw error
  }
  return data
}

// ── Inventario → Ficha del equipo (láminas 3.5 a 3.8) ───────────────────
export const equipoPorQr = async (token) => {
  const [e, a] = await Promise.all([
    one(supabase.from('v_equipos').select('*').eq('qr_token', token)),
    one(supabase.from('activos').select('id, tipo, fecha_baja, motivo_baja, observacion_baja, foto_url, notas').eq('qr_token', token)),
  ])
  if (!a) return null
  if (!e) return { ...a, esVehiculo: true }
  const [u, s] = await Promise.all([
    e.ubicacion_id ? one(supabase.from('ubicaciones').select('direccion, comuna, lat, lng').eq('id', e.ubicacion_id)) : null,
    e.servicio_id ? one(supabase.from('servicios_cliente').select('codigo, cliente_id').eq('id', e.servicio_id)) : null,
  ])
  return { ...e, ...a, ubic: u, servicio: s }
}
// Última entrega confirmada del equipo (orden y fecha)
export const ultimaEntrega = async (activoId) => {
  const r = await rows(supabase.from('despacho_banos').select('accion, despachos(id, folio, estado, fecha_programada, fecha_realizada)')
    .eq('activo_id', activoId).eq('accion', 'entrega'))
  return r.map((x) => x.despachos).filter((d) => d && d.estado === 'hecho')
    .sort((x, y) => String(y.fecha_realizada || y.fecha_programada).localeCompare(String(x.fecha_realizada || x.fecha_programada)))[0] || null
}
// Órdenes (operaciones) de un equipo: la última y si tiene un retiro programado
export const ordenesEquipo = async (activoId) => {
  const r = await rows(supabase.from('despacho_banos').select('accion, despachos(id, folio, tipo, estado, fecha_programada, fecha_realizada)').eq('activo_id', activoId))
  const l = r.filter((x) => x.despachos && x.despachos.estado !== 'cancelado')
    .sort((x, y) => String(y.despachos.fecha_realizada || y.despachos.fecha_programada).localeCompare(String(x.despachos.fecha_realizada || x.despachos.fecha_programada)))
  return {
    ultima: l[0]?.despachos || null,
    retiro: l.find((x) => x.accion === 'retiro' && x.despachos.estado === 'programado')?.despachos || null,
  }
}
export const operacionPorFolio = (folio) => one(supabase.from('v_operaciones').select('*').eq('folio', folio))
export const mantencionesEquipo = (activoId) => rows(
  supabase.from('mantenciones').select('*, responsable:responsable_id(nombre)').eq('activo_id', activoId).order('fecha_programada', { ascending: false })
)
export const personalActivo = () => rows(supabase.from('personal').select('id, nombre, funcion, perfil_id').eq('activo', true).order('nombre'))
export const actualizarEquipo = async (id, datos) => {
  const { error } = await supabase.from('activos').update(datos).eq('id', id)
  if (error) throw error
}
export const moverEquipo = async ({ activo, tipo, destino, fecha, responsable, responsableNombre, motivo }) => {
  const { error } = await supabase.rpc('mover_equipo', {
    p_activo: activo, p_tipo: tipo, p_destino: destino, p_fecha: fecha,
    p_responsable: responsable || null, p_responsable_nombre: responsableNombre || null, p_motivo: motivo || null,
  })
  if (error) throw error
}
export const darDeBaja = async (activo, fecha, motivo, observaciones) => {
  const { error } = await supabase.rpc('dar_de_baja', { p_activo: activo, p_fecha: fecha, p_motivo: motivo, p_observaciones: observaciones || null })
  if (error) throw error
}

// ── Inventario → Insumos y EPP (láminas 3.9 a 3.12) ─────────────────────
export const insumosInventario = async () => {
  const [ins, ex] = await Promise.all([
    rows(supabase.from('insumos').select('*, categorias(nombre, clase), unidades_medida(nombre, abreviatura), receta_limpieza(cantidad)').order('codigo')),
    rows(supabase.from('insumo_existencias').select('id, insumo_id, ubicacion_id, lote_id, cantidad, insumo_lotes(codigo, vencimiento, bloqueado)')),
  ])
  return ins.map((i) => ({ ...i, existencias: ex.filter((e) => e.insumo_id === i.id) }))
}
export const movimientosInsumoDe = (insumoId) => rows(
  supabase.from('movimientos_insumo')
    .select('*, origen:origen_id(nombre), destino:destino_id(nombre), insumo_lotes(codigo), usuario:usuario_id(nombre), servicios_cliente(codigo)')
    .eq('insumo_id', insumoId).order('fecha', { ascending: false }).limit(1000)
)
export const siguienteCodigoInsumo = async (prefijo) => {
  const { data, error } = await supabase.rpc('siguiente_codigo_insumo', { p_prefijo: prefijo })
  if (error) throw error
  return data
}
export const serviciosVigentes = () => rows(
  supabase.from('servicios_cliente').select('id, codigo, clientes(nombre), ubicaciones(nombre)').eq('estado', 'vigente').order('codigo')
)
export const registrarMovInsumo = async (m) => {
  const { data, error } = await supabase.rpc('registrar_movimiento_insumo', {
    p_insumo: m.insumo, p_tipo: m.tipo, p_cantidad: m.cantidad, p_fecha: m.fecha,
    p_origen: m.origen || null, p_destino: m.destino || null, p_lote: m.lote || null,
    p_lote_codigo: m.loteCodigo || null, p_vencimiento: m.vencimiento || null, p_motivo: m.motivo || null,
    p_referencia: m.referencia || null, p_servicio: m.servicio || null, p_receptor: m.receptor || null,
  })
  if (error) throw error
  return data
}

// ── Operaciones → Programación (láminas 4.1 a 4.4b) ─────────────────────
// Una operación es un despacho: Rutas semanales y Mi ruta la ejecutan igual que siempre.
export const operaciones = (desde, hasta) => {
  let q = supabase.from('v_operaciones').select('*').order('fecha_programada', { ascending: false }).limit(3000)
  if (desde) q = q.gte('fecha_programada', desde)
  if (hasta) q = q.lte('fecha_programada', hasta)
  return rows(q)
}
export const banosDeOperacion = (id) => rows(supabase.from('despacho_banos').select('activo_id, accion, activos(id, codigo)').eq('despacho_id', id))
// Baños FOSAN asignados al cliente (y a la ubicación, si se indica): para retiros y cambios
export const banosAsignados = (clienteId, ubicacionId) => {
  let q = supabase.from('activos').select('id, codigo, ubicacion_id, modelos_bano(nombre)')
    .eq('cliente_id', clienteId).eq('estado', 'en_arriendo').eq('propiedad', 'empresa').order('codigo')
  if (ubicacionId) q = q.eq('ubicacion_id', ubicacionId)
  return rows(q)
}
// Baños que ya están en un retiro programado: { activo_id: { folio, despacho_id } } (no se repite el retiro)
export const banosConRetiroProgramado = async (clienteId) => {
  const r = await rows(supabase.from('despacho_banos').select('activo_id, despacho_id, despachos!inner(folio, estado, cliente_id)')
    .eq('accion', 'retiro').eq('despachos.estado', 'programado').eq('despachos.cliente_id', clienteId))
  return Object.fromEntries(r.map((x) => [x.activo_id, { folio: x.despachos.folio, despacho_id: x.despacho_id }]))
}
export const editarOperacion = async (id, datos, banos) => {
  const { error } = await supabase.from('despachos').update(datos).eq('id', id).eq('estado', 'programado')
  if (error) throw error
  const { error: e1 } = await supabase.from('despacho_banos').delete().eq('despacho_id', id)
  if (e1) throw e1
  if (banos.length) {
    const { error: e2 } = await supabase.from('despacho_banos').insert(banos.map((b) => ({ despacho_id: id, activo_id: b.id, accion: b.accion })))
    if (e2) throw e2
  }
}
// Cupo del servicio: unidades solicitadas, asignadas y en otras entregas programadas (paquete 9c)
export const cupoServicio = async (servicioId, excluir = null) => {
  const { data, error } = await supabase.rpc('cupo_servicio', { p_servicio: servicioId, p_excluir: excluir })
  if (error) throw error
  return (Array.isArray(data) ? data[0] : data) || null
}
export const registrarExceso = async (id, exceso, motivo) => {
  const { error } = await supabase.rpc('registrar_exceso_unidades', { p_despacho: id, p_exceso: exceso, p_motivo: motivo || '' })
  if (error) throw error
}
// Operaciones (no canceladas) de varios servicios: para no repetir una fosa puntual
export const operacionesDeServicios = (ids) => (ids.length
  ? rows(supabase.from('despachos').select('id, folio, servicio_id, estado').in('servicio_id', ids).neq('estado', 'cancelado'))
  : Promise.resolve([]))
export const cancelarOperacion = async (id, motivo) => {
  const { error } = await supabase.rpc('cancelar_operacion', { p_id: id, p_motivo: motivo })
  if (error) throw error
}

// ── Operaciones → Respaldos y ejecución confirmada (paquete 8b) ─────────
export const confirmarOperacion = async (id, fecha, recibidoPor, resultado) => {
  const { error } = await supabase.rpc('confirmar_operacion', { p_id: id, p_fecha: fecha, p_recibido_por: recibidoPor || null, p_resultado: resultado || null })
  if (error) throw error
}
// Sube un archivo o firma a respaldos/<operación>/ y deja su registro (no se borra)
// Respaldos de operaciones: los archivos y firmas se guardan en Google Drive (src/lib/drive.js).
// En Supabase solo queda el registro (ruta = 'drive:<id>'). Los antiguos del almacenamiento siguen visibles.
const aBase64 = (blob) => new Promise((ok, mal) => {
  const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => mal(r.error); r.readAsDataURL(blob)
})
const deBase64 = (b64, tipo) => {
  const bin = atob(b64); const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return new Blob([u], { type: tipo || 'application/octet-stream' })
}
// Fotos: se achican a máx. 1600 px y JPEG (≈200 KB). Si algo falla, se sube el original.
const comprimirImagen = async (archivo) => {
  if (!/^image\/(jpe?g|png|webp|heic|heif)$/i.test(archivo.type || '') || archivo.size < 300 * 1024) return archivo
  try {
    const img = await createImageBitmap(archivo)
    const k = Math.min(1, 1600 / Math.max(img.width, img.height))
    const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k)
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height)
    const b = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.75))
    if (!b || b.size >= archivo.size) return archivo
    return new File([b], String(archivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return archivo }
}
const llamarDrive = async (cuerpo) => {
  if (!DRIVE_URL) throw new Error('Falta configurar la carpeta de Drive (src/lib/drive.js).')
  const { data: { session } } = await supabase.auth.getSession()
  let res
  try {
    res = await fetch(DRIVE_URL, { method: 'POST', body: JSON.stringify({ ...cuerpo, token: session?.access_token }) })
  } catch { throw new Error('No se pudo conectar con Google Drive. Revisa internet e intenta de nuevo.') }
  const r = await res.json().catch(() => null)
  if (!r) throw new Error('Google Drive no respondió bien. Revisa la configuración del script.')
  if (!r.ok) throw new Error('Google Drive: ' + r.error)
  return r
}
export const subirRespaldo = async (despachoId, archivo, tipo, { nombre, firmante, folio, paradaId } = {}) => {
  const final = tipo === 'archivo' ? await comprimirImagen(archivo) : archivo
  const nom = String(nombre && tipo === 'firma' ? nombre : final.name || nombre || (tipo === 'firma' ? 'firma.png' : 'archivo'))
  const etiqueta = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}_${tipo === 'firma' ? 'firma_' : ''}${nom}`
  const r = await llamarDrive({ accion: 'subir', carpeta: folio || despachoId, nombre: etiqueta, tipo: final.type || 'application/octet-stream', base64: await aBase64(final) })
  const { data: u } = await supabase.auth.getUser()
  const { error: e2 } = await supabase.from('operacion_respaldos').insert({
    despacho_id: despachoId || null, parada_id: paradaId || null, tipo, ruta: 'drive:' + r.id, nombre: nom, firmante: firmante || null, creado_por: u?.user?.id,
  })
  if (e2) throw e2
}
export const esImagenRespaldo = (r) => r.tipo === 'firma' || /\.(png|jpe?g|webp|gif|heic)$/i.test(r.nombre || r.ruta || '')
const cacheDrive = {}
const traerDrive = async (ids) => {
  const faltan = ids.filter((id) => !cacheDrive[id])
  if (faltan.length) {
    const r = await llamarDrive({ accion: 'ver', ids: faltan })
    for (const a of r.archivos || []) if (a.base64) {
      cacheDrive[a.id] = { url: URL.createObjectURL(deBase64(a.base64, a.tipo)), dataUrl: `data:${a.tipo};base64,${a.base64}` }
    }
  }
  return ids.map((id) => cacheDrive[id] || null)
}
// id: el del despacho, o { parada: id } para una limpieza de ruta
export const respaldosDe = async (id) => {
  const q = supabase.from('operacion_respaldos').select('*')
  const r = await rows((id?.parada ? q.eq('parada_id', id.parada) : q.eq('despacho_id', id)).order('creado_en'))
  if (!r.length) return r
  const ids = [...new Set(r.map((x) => x.creado_por).filter(Boolean))]
  const enSupabase = r.filter((x) => !x.ruta.startsWith('drive:'))
  // De Drive se traen al abrir solo imágenes y firmas; los PDF se descargan al hacer clic.
  const driveIds = r.filter((x) => x.ruta.startsWith('drive:') && esImagenRespaldo(x)).map((x) => x.ruta.slice(6))
  const [firmadas, nombres, desdeDrive] = await Promise.all([
    enSupabase.length ? supabase.storage.from('fosan').createSignedUrls(enSupabase.map((x) => x.ruta), 3600).then((q) => q.data || []) : [],
    ids.length ? supabase.from('perfiles').select('id, nombre').in('id', ids).then((q) => q.data || []) : [],
    driveIds.length ? traerDrive(driveIds).catch(() => []) : [],
  ])
  const quien = Object.fromEntries(nombres.map((p) => [p.id, p.nombre]))
  const urlSb = Object.fromEntries(enSupabase.map((x, i) => [x.ruta, firmadas[i]?.signedUrl || null]))
  const urlDr = Object.fromEntries(driveIds.map((id, i) => [id, desdeDrive[i] || null]))
  return r.map((x) => {
    const dr = x.ruta.startsWith('drive:') ? urlDr[x.ruta.slice(6)] : null
    return { ...x, perfiles: { nombre: quien[x.creado_por] || null }, url: dr?.url || urlSb[x.ruta] || null, dataUrl: dr?.dataUrl || null }
  })
}


// Limpiezas de ruta realizadas (paradas sin despacho): se muestran en Respaldos junto a las operaciones
export const paradasRealizadas = async () => {
  const par = await rows(supabase.from('salida_paradas')
    .select('id, salida_id, tarea, banos, hecha_en, observacion, clientes(nombre, rut, direccion, comuna)')
    .eq('estado', 'hecha').is('despacho_id', null).order('hecha_en', { ascending: false }).limit(3000))
  if (!par.length) return []
  const sal = [...new Set(par.map((p) => p.salida_id))]
  const ids = par.map((p) => p.id)
  const [viajes, resp] = await Promise.all([
    rows(supabase.from('v_salidas').select('id, fecha, ruta, vehiculo').in('id', sal)),
    rows(supabase.from('operacion_respaldos').select('parada_id, tipo, firmante').in('parada_id', ids)),
  ])
  const v = Object.fromEntries(viajes.map((x) => [x.id, x]))
  return par.map((p) => {
    const r = resp.filter((x) => x.parada_id === p.id), s = v[p.salida_id] || {}
    const firmas = r.filter((x) => x.tipo === 'firma')
    return {
      id: 'parada-' + p.id, parada_id: p.id, estado: 'hecho', tipo: p.tarea, folio: `Ruta ${s.ruta || ''}`.trim(),
      cliente: p.clientes?.nombre || '—', rut: p.clientes?.rut, ubicacion: [p.clientes?.direccion, p.clientes?.comuna].filter(Boolean).join(', ') || null,
      fecha_programada: s.fecha, fecha_realizada: p.hecha_en, unidades: p.banos ? `${p.banos} baño(s)` : null, patente: s.vehiculo,
      observaciones: p.observacion, archivos: r.length - firmas.length, firmas: firmas.length, recibido_por: firmas[firmas.length - 1]?.firmante || null,
    }
  })
}


// Abre un respaldo de Drive (PDF u otro) en una pestaña nueva
export const abrirRespaldo = async (r) => {
  const w = window.open('', '_blank')
  try {
    const [a] = await traerDrive([r.ruta.slice(6)])
    if (!a) throw new Error('No se encontró el archivo en Google Drive.')
    if (w) w.location.href = a.url; else window.location.href = a.url
  } catch (x) { if (w) w.close(); throw x }
}

// ── Documentos de vehículos y equipos (se guardan en Google Drive) ─────────
export const TIPOS_DOCUMENTO = {
  revision_tecnica: 'Revisión técnica', permiso_circulacion: 'Permiso de circulación', seguro: 'Seguro / SOAP',
  certificado: 'Certificado', factura: 'Factura', guia_despacho: 'Guía de despacho', otro: 'Otro',
}
export const subirDocumento = async (activo, archivo, { tipo, titulo, vence }) => {
  if (archivo.size > 10 * 1024 * 1024) throw new Error('El archivo pesa más de 10 MB.')
  const final = /^image\//.test(archivo.type) ? await comprimirImagen(archivo) : archivo
  const nombre = `${new Date().toISOString().slice(0, 10)}_${(titulo || final.name || 'documento').replace(/[^A-Za-z0-9 ._-]/g, '_')}${/\.[a-z0-9]{2,4}$/i.test(final.name || '') ? (final.name.match(/\.[a-z0-9]{2,4}$/i)[0]) : ''}`
  const r = await llamarDrive({ accion: 'subir', carpeta: `DOCUMENTOS ${activo.codigo || activo.id}`, nombre, tipo: final.type || 'application/octet-stream', base64: await aBase64(final) })
  const { error } = await supabase.rpc('registrar_documento', {
    p_activo: activo.id, p_tipo: tipo, p_titulo: titulo, p_url: 'drive:' + r.id, p_vence: vence || null, p_kb: Math.round((final.size || 0) / 1024),
  })
  if (error) throw error
}
export const abrirDocumento = async (d) => {
  if (String(d.archivo_url).startsWith('drive:')) return abrirRespaldo({ ruta: d.archivo_url })
  if (/^https?:/.test(d.archivo_url)) return window.open(d.archivo_url, '_blank')
  const { data } = await supabase.storage.from('fosan').createSignedUrl(d.archivo_url, 3600)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}
export const quitarDocumento = async (id) => {
  const { error } = await supabase.rpc('quitar_documento', { p_id: id })
  if (error) throw error
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


// ── Despachos ─────────────────────────────────────────────────────────────
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