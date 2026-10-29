import { supabase } from './supabase'
import { sumarDias, hoyISO } from './costos'
import { C } from './ui'

// Datos de Rutas semanales y Mi ruta (supabase/rutas_semanales.sql)
const rows = async (q) => {
  const { data, error } = await q
  if (error) throw error
  return data || []
}
const rpc = async (fn, args) => {
  const { error } = await supabase.rpc(fn, args)
  if (error) throw error
}

// ── Semanas: siempre de lunes a viernes ───────────────────────────────────
export const DIAS_RUTA = [
  { v: 1, l: 'L', largo: 'Lunes' }, { v: 2, l: 'M', largo: 'Martes' }, { v: 3, l: 'X', largo: 'Miércoles' },
  { v: 4, l: 'J', largo: 'Jueves' }, { v: 5, l: 'V', largo: 'Viernes' },
]
export const lunesDe = (iso) => {
  const d = new Date(iso + 'T12:00:00')
  return sumarDias(iso, -((d.getDay() + 6) % 7))
}
export const fechaDia = (lunes, n) => sumarDias(lunes, n - 1)
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const diaCorto = (iso) => `${Number(iso.slice(8, 10))} ${MES[Number(iso.slice(5, 7)) - 1]}`
export const etiquetaSemana = (lunes) => `${diaCorto(lunes)} – ${diaCorto(sumarDias(lunes, 4))}`

// Semáforo de una parada y de un día
export const SEMAFORO = {
  hecha: { l: 'Realizada', c: C.verde },
  pendiente: { l: 'Pendiente', c: C.amarillo },
  no_realizada: { l: 'No se pudo', c: C.rojo },
}
export const L_TAREA = { limpieza: 'Limpieza', entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio' }

// ── Planificación ─────────────────────────────────────────────────────────
export const operadores = () => rows(supabase.from('v_operadores').select('*').order('nombre'))

// Clientes con lo que muestra la planilla: contacto, teléfono, baños arrendados y propios
export const clientesPlanilla = async () => {
  const [c, a] = await Promise.all([
    rows(supabase.from('clientes').select('*').order('nombre')),
    rows(supabase.from('activos').select('id, codigo, cliente_id').eq('estado', 'en_arriendo').not('cliente_id', 'is', null).order('codigo')),
  ])
  const porCliente = {}
  a.forEach((x) => { (porCliente[x.cliente_id] ||= []).push(x) })
  return c.map((x) => ({ ...x, arriendos: porCliente[x.id] || [], banos_propios: Number(x.banos_propios) || 0 }))
}

export const rutasDeSemana = (lunes) => rows(
  supabase.from('rutas_semana').select('*, activos(codigo), rutas_semana_lineas(*)').eq('lunes', lunes).order('nombre')
)
// Avance de cada día: viaje + estado de sus paradas
export const avanceSemana = async (lunes) => {
  const viajes = await rows(supabase.from('v_salidas')
    .select('id, ruta_semana_id, fecha, estado, vehiculo, iniciada_en, odometro_salida, odometro_llegada, km_real')
    .not('ruta_semana_id', 'is', null).gte('fecha', lunes).lte('fecha', sumarDias(lunes, 4)))
  const ids = viajes.map((v) => v.id)
  const par = ids.length ? await rows(supabase.from('salida_paradas').select('salida_id, estado').in('salida_id', ids)) : []
  return viajes.map((v) => {
    const p = par.filter((x) => x.salida_id === v.id)
    return { ...v, total: p.length, hechas: p.filter((x) => x.estado === 'hecha').length, fallidas: p.filter((x) => x.estado === 'no_realizada').length }
  })
}

// Guarda la ruta y su planilla, y arma los viajes de cada día
export const guardarRutaSemana = async (id, datos, lineas) => {
  let rid = id
  if (rid) {
    const { error } = await supabase.from('rutas_semana').update(datos).eq('id', rid)
    if (error) throw error
    const { error: e2 } = await supabase.from('rutas_semana_lineas').delete().eq('ruta_id', rid)
    if (e2) throw e2
  } else {
    const { data, error } = await supabase.from('rutas_semana').insert(datos).select('id').single()
    if (error) throw error
    rid = data.id
  }
  if (lineas.length) {
    const { error } = await supabase.from('rutas_semana_lineas').insert(lineas.map((l, i) => ({
      ruta_id: rid, cliente_id: l.cliente_id, tarea: l.tarea, dias: l.dias, orden: i + 1,
      banos: l.banos || [], despacho_id: l.despacho_id || null, nota: l.nota || null,
    })))
    if (error) throw error
  }
  await rpc('generar_ruta_semana', { p_ruta: rid })
  return rid
}
export const borrarRutaSemana = (id) => rpc('borrar_ruta_semana', { p_ruta: id })

// Copia la ruta a la semana siguiente (solo limpiezas: entregas y retiros son de una vez)
export const duplicarRutaSemana = async (r) => {
  const lineas = (r.rutas_semana_lineas || []).filter((l) => l.tarea === 'limpieza').sort((a, b) => a.orden - b.orden)
  return guardarRutaSemana(null, {
    nombre: r.nombre, lunes: sumarDias(r.lunes, 7), operador_id: r.operador_id, vehiculo_id: r.vehiculo_id, notas: r.notas,
  }, lineas)
}

// Entregas y retiros pendientes que no están en ninguna ruta (cliente nuevo, contrato vencido…)
export const porProgramar = () => rows(
  supabase.from('v_despachos').select('*').eq('estado', 'programado').is('salida_id', null).order('fecha_programada')
)
export const despachosPorId = (ids) => (ids.length
  ? rows(supabase.from('v_despachos').select('id, folio, tipo, estado, cliente_id, banos, cantidad').in('id', ids))
  : Promise.resolve([]))
export const banosDeClienteRuta = (clienteId) => rows(
  supabase.from('activos').select('id, codigo, modelos_bano(nombre, tipo)').eq('cliente_id', clienteId).eq('estado', 'en_arriendo').order('codigo')
)

// ── Calendario: un evento por cada día con ruta ───────────────────────────
export const rutasDelMes = async (ini, fin) => {
  const v = await rows(supabase.from('v_salidas').select('id, fecha, ruta, vehiculo, paradas, estado')
    .not('ruta_semana_id', 'is', null).gte('fecha', ini).lte('fecha', fin))
  return v.map((x) => ({
    id: 'ruta-' + x.id, fecha: x.fecha, tipo: 'servicio', soloLectura: true,
    titulo: `Ruta ${x.ruta}${x.vehiculo ? ' · ' + x.vehiculo : ''} · ${x.paradas} parada(s)${x.estado === 'cerrada' ? ' · cerrada' : ''}`,
  }))
}

// ── Mi ruta (operador) ────────────────────────────────────────────────────
// Solo la ruta de la semana en curso asignada al usuario
export const miRutaDeLaSemana = async (uid, hoy = hoyISO()) => {
  const lunes = lunesDe(hoy)
  const rutas = await rows(supabase.from('rutas_semana').select('*, activos(codigo)').eq('operador_id', uid).eq('lunes', lunes).order('nombre'))
  return { lunes, rutas }
}
export const diasDeRuta = async (rutaId) => {
  const viajes = await rows(supabase.from('v_salidas').select('*').eq('ruta_semana_id', rutaId).order('fecha'))
  const ids = viajes.map((v) => v.id)
  if (!ids.length) return []
  const [par, desp] = await Promise.all([
    rows(supabase.from('salida_paradas')
      .select('*, clientes(nombre, contacto_nombre, telefono, direccion, comuna, banos_propios)').in('salida_id', ids).order('orden')),
    rows(supabase.from('v_despachos').select('id, folio, banos').in('salida_id', ids)),
  ])
  const clientes = [...new Set(par.map((p) => p.cliente_id))]
  const arr = clientes.length ? await rows(supabase.from('activos').select('codigo, cliente_id').eq('estado', 'en_arriendo').in('cliente_id', clientes).order('codigo')) : []
  const cod = {}
  arr.forEach((a) => { (cod[a.cliente_id] ||= []).push(a.codigo) })
  const dsp = Object.fromEntries(desp.map((d) => [d.id, d]))
  return viajes.map((v) => ({
    ...v,
    paradas: par.filter((p) => p.salida_id === v.id).map((p) => ({ ...p, codigos: cod[p.cliente_id] || [], despacho: dsp[p.despacho_id] || null })),
  }))
}
export const iniciarDia = (salidaId, km) => rpc('iniciar_dia', { p_salida: salidaId, p_km: km })
export const marcarParadaRuta = (paradaId, estado, obs, mantencion) =>
  rpc('marcar_parada_ruta', { p_parada: paradaId, p_estado: estado, p_obs: obs || null, p_mantencion: !!mantencion })
export const cerrarDia = (salidaId, km) => rpc('cerrar_dia', { p_salida: salidaId, p_km: km })
