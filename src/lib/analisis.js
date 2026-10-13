// Cálculos de la pestaña Análisis. Todo se calcula en el navegador a partir de
// los registros del mes; cada resultado dice si es real o estimado.
import { supabase } from './supabase'
import { costoSalida, mapaParametros, hoyISO, sumarDias } from './costos'

const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || [] }
const opc = (p) => q(p).catch(() => [])
const n = (v) => Number(v || 0)

export const rangoMes = (mes) => {
  const [y, m] = mes.split('-').map(Number)
  const ini = `${mes}-01`
  const fin = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { ini, fin, dias: new Date(Date.UTC(y, m, 0)).getUTCDate() }
}
export const mesActual = () => hoyISO().slice(0, 7)

export async function cargarMes(mes) {
  const { ini, fin } = rangoMes(mes)
  const hoy = hoyISO()
  const [ventas, clientes, banos, salidas, despachos, mant, insumos, receta, pars, movIns, ocup, futuras] = await Promise.all([
    opc(supabase.from('ventas').select('id, fecha, folio_maxxa, cliente_id, cliente_texto, neto, tipo_servicio').gte('fecha', ini).lte('fecha', fin)),
    q(supabase.from('clientes').select('id, nombre, valor_mensual, fecha_inicio_contrato, fecha_fin_contrato')),
    q(supabase.from('activos').select('id, codigo, estado, cliente_id, valor_arriendo, modelos_bano(nombre)').eq('tipo', 'bano_quimico').neq('estado', 'baja')),
    opc(supabase.from('v_salidas').select('*').gte('fecha', ini).lte('fecha', fin).neq('estado', 'cancelada')),
    opc(supabase.from('despachos').select('id, folio, tipo, estado, cliente_id, salida_id, fecha_programada').gte('fecha_programada', ini).lte('fecha_programada', fin).neq('estado', 'cancelado')),
    opc(supabase.from('mantenciones').select('id, tipo, costo, estado, fecha_programada, fecha_realizada, activo_id, activos(codigo, cliente_id, tipo)').gte('fecha_programada', ini).lte('fecha_programada', fin).neq('estado', 'anulada')),
    opc(supabase.from('insumos').select('*')),
    opc(supabase.from('receta_limpieza').select('*')),
    opc(supabase.from('parametros').select('*')),
    opc(supabase.from('movimientos_insumo').select('insumo_id, cantidad, fecha').gte('fecha', sumarDias(hoy, -30))),
    opc(supabase.from('ocupacion_diaria').select('fecha, activo_id, estado, cliente_id').gte('fecha', ini).lte('fecha', fin)),
    opc(supabase.from('v_salidas').select('id, fecha, estado').gte('fecha', hoy).lte('fecha', sumarDias(hoy, 14)).eq('estado', 'planificada')),
  ])
  const ids = [...new Set([...salidas.map((s) => s.id), ...futuras.map((s) => s.id)])]
  const paradas = ids.length
    ? await opc(supabase.from('salida_paradas').select('salida_id, cliente_id, tarea, banos, hecha').in('salida_id', ids))
    : []
  return { mes, ini, fin, ventas, clientes, banos, salidas, despachos, mant, insumos, receta, par: mapaParametros(pars), movIns, ocup, futuras, paradas }
}

export function calcular(d) {
  const { dias } = rangoMes(d.mes)
  const cli = Object.fromEntries(d.clientes.map((c) => [c.id, c]))
  const costoIns = Object.fromEntries(d.insumos.map((i) => [i.id, n(i.costo_unitario)]))
  const costoLimpiezaBano = d.receta.reduce((s, r) => s + n(r.cantidad) * (costoIns[r.insumo_id] || 0), 0)
  const recetaSinCosto = d.receta.some((r) => !costoIns[r.insumo_id])

  // ── Costo de cada salida repartido por parada y despacho ────────────────
  const porCliente = {}      // cliente_id → { rutas, insumos, mant, despachos, visitas, estimado, registros[] }
  const acc = (id) => (porCliente[id] ||= { rutas: 0, insumos: 0, mant: 0, despachos: 0, visitas: 0, estimado: false, registros: [] })
  const porRuta = {}
  const idsMes = new Set(d.salidas.map((s) => s.id))
  d.salidas.forEach((s) => {
    const c = costoSalida(s, d.par)
    const est = s.km_real == null || c.faltan.length > 0
    const par = d.paradas.filter((p) => p.salida_id === s.id && (s.estado === 'cerrada' ? p.hecha : true))
    const des = d.despachos.filter((x) => x.salida_id === s.id)
    const paradasTot = par.length + des.length
    const porParada = paradasTot ? c.total / paradasTot : 0
    const r = (porRuta[s.ruta_id] ||= { ruta: s.ruta, salidas: 0, km: 0, costo: 0, visitas: 0, estimado: false, clientes: {}, registros: [] })
    r.salidas++; r.km += n(c.km); r.costo += c.total; r.visitas += par.length; r.estimado ||= est
    r.registros.push({ fecha: s.fecha, detalle: `${s.vehiculo || 'Sin vehículo'} · ${Math.round(c.km)} km${s.km_real == null ? ' (est.)' : ''} · ${par.length} visita(s)`, monto: c.total })
    par.forEach((p) => {
      const a = acc(p.cliente_id)
      a.rutas += porParada; a.visitas++; a.estimado ||= est
      r.clientes[p.cliente_id] = (r.clientes[p.cliente_id] || 0) + 1
      a.registros.push({ fecha: s.fecha, detalle: `Visita ${p.tarea} · ${s.ruta}`, monto: porParada })
      if (p.tarea === 'limpieza') {
        const ci = n(p.banos) * costoLimpiezaBano
        a.insumos += ci
        if (ci) a.registros.push({ fecha: s.fecha, detalle: `Insumos de ${p.banos} limpieza(s)`, monto: ci })
      }
    })
    des.forEach((x) => {
      const a = acc(x.cliente_id)
      a.despachos += porParada; a.estimado ||= est
      a.registros.push({ fecha: s.fecha, detalle: `Despacho ${x.folio} (${x.tipo}) en ruta ${s.ruta}`, monto: porParada })
    })
  })
  const despachosSinCosto = d.despachos.filter((x) => !x.salida_id || !idsMes.has(x.salida_id))
  despachosSinCosto.forEach((x) => { const a = acc(x.cliente_id); a.estimado = true; a.registros.push({ fecha: x.fecha_programada, detalle: `Despacho ${x.folio} viaje aparte (sin costear)`, monto: 0 }) })

  const banoCli = Object.fromEntries(d.banos.map((b) => [b.id, b.cliente_id]))
  const mantPorBano = {}
  d.mant.forEach((m) => {
    const cid = m.activos?.cliente_id || banoCli[m.activo_id]
    mantPorBano[m.activo_id] = (mantPorBano[m.activo_id] || 0) + n(m.costo)
    if (cid && m.activos?.tipo === 'bano_quimico') {
      const a = acc(cid); a.mant += n(m.costo); if (m.estado !== 'completada') a.estimado = true
      a.registros.push({ fecha: m.fecha_realizada || m.fecha_programada, detalle: `Mantención ${m.tipo} · ${m.activos?.codigo}${m.estado !== 'completada' ? ' (programada)' : ''}`, monto: n(m.costo) })
    }
  })

  // ── Ingresos por cliente: ventas de Maxxa o, si no hay, valor del contrato ─
  const ventasCli = {}
  d.ventas.forEach((v) => { if (v.cliente_id) (ventasCli[v.cliente_id] ||= []).push(v) })
  const vigenteEnMes = (c) => (!c.fecha_inicio_contrato || c.fecha_inicio_contrato <= d.fin) && (!c.fecha_fin_contrato || c.fecha_fin_contrato >= d.ini)
  const ingreso = {}
  d.clientes.forEach((c) => {
    const vs = ventasCli[c.id] || []
    if (vs.length) ingreso[c.id] = { monto: vs.reduce((s, v) => s + n(v.neto), 0), fuente: 'Maxxa', registros: vs }
    else if (vigenteEnMes(c) && n(c.valor_mensual)) ingreso[c.id] = { monto: n(c.valor_mensual), fuente: 'Contrato', registros: [] }
    else ingreso[c.id] = { monto: 0, fuente: '—', registros: [] }
  })

  const clientesTabla = d.clientes.map((c) => {
    const a = porCliente[c.id] || { rutas: 0, insumos: 0, mant: 0, despachos: 0, visitas: 0, estimado: false, registros: [] }
    const ing = ingreso[c.id]
    const costo = a.rutas + a.insumos + a.mant + a.despachos
    const margen = ing.monto - costo
    return {
      id: c.id, nombre: c.nombre, ingreso: ing.monto, fuente: ing.fuente, rutas: a.rutas, insumos: a.insumos, mant: a.mant, despachos: a.despachos,
      costo, margen, pct: ing.monto ? margen / ing.monto : null, visitas: a.visitas,
      estimado: a.estimado || ing.fuente === 'Contrato' || (a.insumos > 0 && recetaSinCosto),
      registros: [
        ...ing.registros.map((v) => ({ fecha: v.fecha, detalle: `Venta ${v.folio_maxxa || ''} (Maxxa)`, monto: n(v.neto), ingreso: true })),
        ...(ing.fuente === 'Contrato' ? [{ fecha: d.ini, detalle: 'Valor mensual del contrato (sin ventas importadas)', monto: ing.monto, ingreso: true }] : []),
        ...a.registros,
      ].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))),
    }
  }).filter((r) => r.ingreso || r.costo || r.visitas)
    .sort((a, b) => (a.pct ?? -9) - (b.pct ?? -9))

  const ingresoCliente = Object.fromEntries(clientesTabla.map((c) => [c.id, c.ingreso]))
  const visitasCliente = Object.fromEntries(clientesTabla.map((c) => [c.id, c.visitas]))
  const rutasTabla = Object.entries(porRuta).map(([id, r]) => {
    const ingresoAtendido = Object.entries(r.clientes).reduce((s, [cid, v]) => s + (ingresoCliente[cid] || 0) * (v / (visitasCliente[cid] || v)), 0)
    return {
      id, ...r, ingresoAtendido, margen: ingresoAtendido - r.costo,
      pct: ingresoAtendido ? (ingresoAtendido - r.costo) / ingresoAtendido : null,
      costoVisita: r.visitas ? r.costo / r.visitas : null, costoKm: r.km ? r.costo / r.km : null,
    }
  }).sort((a, b) => b.costo - a.costo)

  // ── Ocupación ───────────────────────────────────────────────────────────
  const noAptos = ['mantencion', 'fuera_de_servicio']
  let ocupacion
  const diasFoto = [...new Set(d.ocup.map((o) => o.fecha))]
  if (diasFoto.length) {
    const arr = d.ocup.filter((o) => o.estado === 'en_arriendo').length
    const aptos = d.ocup.filter((o) => !noAptos.includes(o.estado)).length
    ocupacion = { pct: aptos ? arr / aptos : null, dias: diasFoto.length, fuente: `${diasFoto.length} día(s) registrados en el mes`, estimado: diasFoto.length < dias }
  } else {
    const arr = d.banos.filter((b) => b.estado === 'en_arriendo').length
    const aptos = d.banos.filter((b) => !noAptos.includes(b.estado)).length
    ocupacion = { pct: aptos ? arr / aptos : null, dias: 0, fuente: 'Estado de hoy (aún no hay historial del mes)', estimado: true }
  }
  const cuenta = (e) => d.banos.filter((b) => b.estado === e).length
  ocupacion.hoy = { total: d.banos.length, arriendo: cuenta('en_arriendo'), disponibles: cuenta('disponible'), mantencion: cuenta('mantencion') + cuenta('fuera_de_servicio') }
  const modelos = {}
  d.banos.forEach((b) => {
    const k = b.modelos_bano?.nombre || 'Sin modelo'
    const m = (modelos[k] ||= { modelo: k, total: 0, arriendo: 0, aptos: 0 })
    m.total++; if (b.estado === 'en_arriendo') m.arriendo++; if (!noAptos.includes(b.estado)) m.aptos++
  })
  ocupacion.porModelo = Object.values(modelos).map((m) => ({ ...m, pct: m.aptos ? m.arriendo / m.aptos : null }))

  // ── Rentabilidad por baño ───────────────────────────────────────────────
  const banosDeCli = {}
  d.banos.forEach((b) => { if (b.cliente_id && b.estado === 'en_arriendo') (banosDeCli[b.cliente_id] ||= []).push(b.id) })
  const diasArr = {}
  d.ocup.forEach((o) => { if (o.estado === 'en_arriendo') diasArr[o.activo_id] = (diasArr[o.activo_id] || 0) + 1 })
  const banosTabla = d.banos.map((b) => {
    const cid = b.cliente_id
    const nB = cid ? (banosDeCli[cid] || []).length || 1 : 1
    const a = cid ? porCliente[cid] : null
    const ing = b.estado === 'en_arriendo' && cid ? (n(b.valor_arriendo) || (ingresoCliente[cid] || 0) / nB) : 0
    const operacion = a ? (a.rutas + a.insumos + a.despachos) / nB : 0
    const mant = mantPorBano[b.id] || 0
    return {
      id: b.id, codigo: b.codigo, modelo: b.modelos_bano?.nombre || 'Sin modelo', estado: b.estado,
      cliente: cid ? cli[cid]?.nombre : '—', ingreso: ing, operacion, mant, costo: operacion + mant,
      margen: ing - operacion - mant, diasArriendo: diasFoto.length ? diasArr[b.id] || 0 : null,
      estimado: !n(b.valor_arriendo) || (a?.estimado ?? false),
    }
  }).sort((a, b) => a.margen - b.margen)

  // ── Insumos: consumo, cobertura y reposición ────────────────────────────
  const futurasIds = new Set(d.futuras.map((s) => s.id))
  const banosFuturos = d.paradas.filter((p) => futurasIds.has(p.salida_id) && p.tarea === 'limpieza').reduce((s, p) => s + n(p.banos), 0)
  const insumosTabla = d.insumos.map((i) => {
    const consumo30 = -d.movIns.filter((m) => m.insumo_id === i.id && n(m.cantidad) < 0).reduce((s, m) => s + n(m.cantidad), 0)
    const r = d.receta.find((x) => x.insumo_id === i.id)
    const proyectado14 = r ? n(r.cantidad) * banosFuturos : 0
    const diario = Math.max(consumo30 / 30, proyectado14 / 14)
    const stock = n(i.stock_actual)
    const cobertura = diario ? stock / diario : null
    const punto = diario * 7 + n(i.stock_minimo)
    return {
      id: i.id, nombre: i.nombre, unidad: i.unidad, stock, minimo: n(i.stock_minimo), consumo30, proyectado14, diario, cobertura, punto,
      comprar: stock <= punto && diario > 0 ? Math.ceil(diario * 30 + n(i.stock_minimo) - stock) : 0,
      costoMes: diario * 30 * n(i.costo_unitario),
      estimado: consumo30 === 0 && proyectado14 > 0,
    }
  }).sort((a, b) => (a.cobertura ?? 1e9) - (b.cobertura ?? 1e9))

  const tot = (arr, k) => arr.reduce((s, x) => s + n(x[k]), 0)
  return {
    clientes: clientesTabla, rutas: rutasTabla, ocupacion, banos: banosTabla, insumos: insumosTabla,
    resumen: {
      ingreso: tot(clientesTabla, 'ingreso'), costo: tot(clientesTabla, 'costo'),
      ventasSinCliente: d.ventas.filter((v) => !v.cliente_id).reduce((s, v) => s + n(v.neto), 0),
      ventasSinClienteN: d.ventas.filter((v) => !v.cliente_id).length,
      despachosSinCosto: despachosSinCosto.length, recetaSinCosto,
      bajo20: clientesTabla.filter((c) => c.pct !== null && c.pct < 0.2).length,
    },
  }
}

// ── Tendencia de 12 meses ─────────────────────────────────────────────────
export async function tendencia(mes) {
  const [y, m] = mes.split('-').map(Number)
  const meses = Array.from({ length: 12 }, (_, i) => { const dt = new Date(Date.UTC(y, m - 12 + i, 1)); return dt.toISOString().slice(0, 7) })
  const ini = meses[0] + '-01', fin = rangoMes(mes).fin
  const [ventas, costos, salidas, mant, movIns, insumos, pars] = await Promise.all([
    opc(supabase.from('ventas').select('fecha, neto').gte('fecha', ini).lte('fecha', fin)),
    opc(supabase.from('costos').select('fecha, monto').gte('fecha', ini).lte('fecha', fin)),
    opc(supabase.from('v_salidas').select('*').gte('fecha', ini).lte('fecha', fin).neq('estado', 'cancelada')),
    opc(supabase.from('mantenciones').select('fecha_programada, fecha_realizada, costo, estado').gte('fecha_programada', ini).lte('fecha_programada', fin).eq('estado', 'completada')),
    opc(supabase.from('movimientos_insumo').select('insumo_id, cantidad, fecha').gte('fecha', ini)),
    opc(supabase.from('insumos').select('id, costo_unitario')),
    opc(supabase.from('parametros').select('*')),
  ])
  const par = mapaParametros(pars)
  const cu = Object.fromEntries(insumos.map((i) => [i.id, n(i.costo_unitario)]))
  const fila = Object.fromEntries(meses.map((k) => [k, { mes: k, ventas: 0, otros: 0, rutas: 0, mant: 0, insumos: 0, estimado: false }]))
  const en = (f) => fila[String(f).slice(0, 7)]
  ventas.forEach((v) => { const r = en(v.fecha); if (r) r.ventas += n(v.neto) })
  costos.forEach((c) => { const r = en(c.fecha); if (r) r.otros += n(c.monto) })
  salidas.forEach((s) => { const r = en(s.fecha); if (r) { const c = costoSalida(s, par); r.rutas += c.total; if (s.km_real == null || c.faltan.length) r.estimado = true } })
  mant.forEach((x) => { const r = en(x.fecha_realizada || x.fecha_programada); if (r) r.mant += n(x.costo) })
  movIns.forEach((x) => { const r = en(x.fecha); if (r && n(x.cantidad) < 0) r.insumos += -n(x.cantidad) * (cu[x.insumo_id] || 0) })
  return meses.map((k) => {
    const r = fila[k]
    const costo = r.otros + r.rutas + r.mant + r.insumos
    return { ...r, costo, margen: r.ventas - costo, pct: r.ventas ? (r.ventas - costo) / r.ventas : null }
  })
}
