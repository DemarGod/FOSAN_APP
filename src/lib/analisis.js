// Cálculos de la pestaña Análisis. Todo se calcula en el navegador a partir de
// los registros del mes; cada resultado dice si es real o estimado.
import { supabase } from './supabase'
import { costoSalida, mapaParametros, hoyISO, sumarDias } from './costos'

const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || [] }
const opc = (p) => q(p).catch(() => [])
const n = (v) => Number(v || 0)

// Grupos de estado: deben sumar el total de baños (los de baja no se cuentan)
export const GRUPO_ESTADO = {
  en_arriendo: 'arriendo',
  disponible: 'disponible', en_limpieza: 'disponible',
  mantencion: 'mantencion', fuera_de_servicio: 'mantencion',
}
const grupo = (e) => GRUPO_ESTADO[e] || 'otros'

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
  const [ventas, clientes, banos, salidas, despachos, mant, insumos, receta, pars, movIns, ocup, futuras, instalaciones] = await Promise.all([
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
    // Última instalación de cada baño: de ahí salen los días arrendado (igual que en la ficha)
    opc(supabase.from('movimientos_activo').select('activo_id, fecha').eq('tipo', 'instalacion').order('fecha', { ascending: false })),
  ])
  const ids = [...new Set([...salidas.map((s) => s.id), ...futuras.map((s) => s.id)])]
  const paradas = ids.length
    ? await opc(supabase.from('salida_paradas').select('salida_id, cliente_id, tarea, banos, hecha, despacho_id').in('salida_id', ids))
    : []
  return { mes, ini, fin, ventas, clientes, banos, salidas, despachos, mant, insumos, receta, par: mapaParametros(pars), movIns, ocup, futuras, paradas, instalaciones }
}

export function calcular(d) {
  const { dias } = rangoMes(d.mes)
  const hoy = hoyISO()
  const cli = Object.fromEntries(d.clientes.map((c) => [c.id, c]))
  const costoIns = Object.fromEntries(d.insumos.map((i) => [i.id, n(i.costo_unitario)]))
  const costoLimpiezaBano = d.receta.reduce((s, r) => s + n(r.cantidad) * (costoIns[r.insumo_id] || 0), 0)
  const recetaSinCosto = d.receta.some((r) => !costoIns[r.insumo_id])

  // ── Costo de cada salida repartido por parada y despacho ────────────────
  const porCliente = {}
  const acc = (id) => (porCliente[id] ||= { rutas: 0, insumos: 0, mant: 0, despachos: 0, visitas: 0, estimado: false, registros: [] })
  const porRuta = {}
  const kmVeh = {}
  const idsMes = new Set(d.salidas.map((s) => s.id))
  let banosLimpiadosMes = 0
  d.salidas.forEach((s) => {
    const c = costoSalida(s, d.par)
    const est = s.km_real == null || c.faltan.length > 0
    // Las paradas de entrega/retiro ya se cuentan como despacho
    const par = d.paradas.filter((p) => p.salida_id === s.id && !p.despacho_id && (s.estado === 'cerrada' ? p.hecha : true))
    const des = d.despachos.filter((x) => x.salida_id === s.id)
    const peso = (p) => Math.max(1, n(p.banos))
    const pesoTot = par.reduce((t, p) => t + peso(p), 0) + des.length
    const cuota = (w) => (pesoTot ? (c.total * w) / pesoTot : 0)
    const r = (porRuta[s.ruta_id || s.ruta] ||= { ruta: s.ruta, salidas: 0, sinKm: 0, km: 0, costo: 0, visitas: 0, banos: 0, litros: 0, insumos: 0, estimado: false, clientes: {}, registros: [] })
    const banosSal = par.filter((p) => p.tarea === 'limpieza').reduce((t, p) => t + n(p.banos), 0)
    if (s.fecha <= hoy) banosLimpiadosMes += banosSal
    r.salidas++; if (s.km_real == null) r.sinKm++
    r.km += n(c.km); r.costo += c.total; r.visitas += par.length; r.estimado ||= est
    r.banos += banosSal; r.litros += c.litrosDiesel; r.insumos += banosSal * costoLimpiezaBano
    if (s.vehiculo_id) kmVeh[s.vehiculo_id] = n(s.km_anual) || n(d.par.km_anual)
    r.registros.push({ fecha: s.fecha, detalle: `${s.vehiculo || 'Sin vehículo'} · ${s.km_real == null ? 'sin odómetro' : Math.round(c.km) + ' km'} · ${par.length} visita(s)`, monto: c.total })
    par.forEach((p) => {
      const a = acc(p.cliente_id)
      a.rutas += cuota(peso(p)); a.visitas++; a.estimado ||= est
      r.clientes[p.cliente_id] = (r.clientes[p.cliente_id] || 0) + 1
      a.registros.push({ fecha: s.fecha, detalle: `Visita ${p.tarea} · ${s.ruta}${n(p.banos) ? ` · ${p.banos} baño(s)` : ''}`, monto: cuota(peso(p)) })
      if (p.tarea === 'limpieza') {
        const ci = n(p.banos) * costoLimpiezaBano
        a.insumos += ci
        if (ci) a.registros.push({ fecha: s.fecha, detalle: `Insumos de ${p.banos} limpieza(s)`, monto: ci })
      }
    })
    des.forEach((x) => {
      const a = acc(x.cliente_id)
      a.despachos += cuota(1); a.estimado ||= est
      a.registros.push({ fecha: s.fecha, detalle: `Despacho ${x.folio} (${x.tipo}) en ruta ${s.ruta}`, monto: cuota(1) })
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
    else ingreso[c.id] = { monto: 0, fuente: 'Sin ingreso', registros: [] }
  })

  // Baños arrendados por cliente (para mostrar y repartir)
  const banosDeCli = {}
  d.banos.forEach((b) => { if (b.cliente_id && b.estado === 'en_arriendo') (banosDeCli[b.cliente_id] ||= []).push(b.id) })

  const clientesTabla = d.clientes.map((c) => {
    const a = porCliente[c.id] || { rutas: 0, insumos: 0, mant: 0, despachos: 0, visitas: 0, estimado: false, registros: [] }
    const ing = ingreso[c.id]
    const costo = a.rutas + a.insumos + a.mant + a.despachos
    const sinIngreso = !ing.monto
    return {
      id: c.id, nombre: c.nombre, ingreso: ing.monto, fuente: ing.fuente, sinIngreso, banos: (banosDeCli[c.id] || []).length,
      rutas: a.rutas, insumos: a.insumos, mant: a.mant, despachos: a.despachos,
      costo, margen: sinIngreso ? null : ing.monto - costo, pct: sinIngreso ? null : (ing.monto - costo) / ing.monto, visitas: a.visitas,
      estimado: a.estimado || ing.fuente === 'Contrato' || (a.insumos > 0 && recetaSinCosto),
      registros: [
        ...ing.registros.map((v) => ({ fecha: v.fecha, detalle: `Venta ${v.folio_maxxa || ''} (Maxxa)`, monto: n(v.neto), ingreso: true })),
        ...(ing.fuente === 'Contrato' ? [{ fecha: d.ini, detalle: 'Valor mensual del contrato (sin ventas importadas)', monto: ing.monto, ingreso: true }] : []),
        ...a.registros,
      ].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))),
    }
  }).filter((r) => r.ingreso || r.costo || r.visitas || r.banos)
    // Primero los que tienen ingreso (peor margen arriba); al final los que no tienen ingreso cargado
    .sort((a, b) => (a.sinIngreso - b.sinIngreso) || (a.pct ?? 0) - (b.pct ?? 0) || b.costo - a.costo)

  const ingresoCliente = Object.fromEntries(clientesTabla.map((c) => [c.id, c.ingreso]))
  const visitasCliente = Object.fromEntries(clientesTabla.map((c) => [c.id, c.visitas]))
  const rutasTabla = Object.entries(porRuta).map(([id, r]) => {
    const ingresoAtendido = Object.entries(r.clientes).reduce((s, [cid, v]) => s + (ingresoCliente[cid] || 0) * (v / (visitasCliente[cid] || v)), 0)
    return {
      id, ...r, ingresoAtendido, margen: ingresoAtendido ? ingresoAtendido - r.costo : null,
      pct: ingresoAtendido ? (ingresoAtendido - r.costo) / ingresoAtendido : null,
      costoVisita: r.visitas ? r.costo / r.visitas : null, costoKm: r.km ? r.costo / r.km : null,
      costoBano: r.banos ? (r.costo + r.insumos) / r.banos : null,
      l100: r.km ? (r.litros / r.km) * 100 : null,
    }
  }).sort((a, b) => b.costo - a.costo)
  const kmDisponibles = Object.values(kmVeh).reduce((t, k) => t + k / 12, 0)

  // ── Ocupación: arrendados ÷ (arrendados + disponibles) ──────────────────
  // Mantención y "otros" (donados, vendidos, extraviados…) no se pueden arrendar, no cuentan.
  const vacio = () => ({ total: 0, arriendo: 0, disponible: 0, mantencion: 0, otros: 0 })
  const sumar = (o, e) => { o.total++; o[grupo(e)]++ }
  const pctOc = (o) => (o.arriendo + o.disponible ? o.arriendo / (o.arriendo + o.disponible) : null)
  const hoyG = vacio()
  const modelos = {}
  const otrosEstados = {}
  d.banos.forEach((b) => {
    sumar(hoyG, b.estado)
    const k = b.modelos_bano?.nombre || 'Sin modelo'
    sumar((modelos[k] ||= { modelo: k, ...vacio() }), b.estado)
    if (grupo(b.estado) === 'otros') otrosEstados[b.estado] = (otrosEstados[b.estado] || 0) + 1
  })
  const diasFoto = [...new Set(d.ocup.map((o) => o.fecha))]
  let pctMes, fuente
  if (diasFoto.length) {
    const g = vacio(); d.ocup.forEach((o) => { if (o.estado !== 'baja') sumar(g, o.estado) })
    pctMes = pctOc(g)
    fuente = `promedio de ${diasFoto.length} de ${dias} día(s) del mes con foto diaria`
  } else {
    pctMes = pctOc(hoyG)
    fuente = 'estado de hoy (aún no hay fotos diarias de este mes)'
  }
  const ocupacion = {
    pct: pctMes, pctHoy: pctOc(hoyG), dias: diasFoto.length, diasMes: dias, fuente, estimado: diasFoto.length < dias,
    hoy: hoyG, otrosEstados,
    porModelo: Object.values(modelos).map((m) => ({ ...m, pct: pctOc(m) })).sort((a, b) => b.total - a.total),
  }

  // ── Rentabilidad por baño ───────────────────────────────────────────────
  const ultimaInst = {}
  d.instalaciones.forEach((m) => { if (!ultimaInst[m.activo_id]) ultimaInst[m.activo_id] = m.fecha })
  const diasDesde = (f) => Math.max(0, Math.floor((Date.now() - new Date(/^\d{4}-\d{2}-\d{2}$/.test(f) ? f + 'T12:00:00' : f)) / 864e5))
  const banosTabla = d.banos.map((b) => {
    const cid = b.cliente_id
    const arr = b.estado === 'en_arriendo' && cid
    const nB = cid ? (banosDeCli[cid] || []).length || 1 : 1
    const a = cid ? porCliente[cid] : null
    const ing = arr ? (n(b.valor_arriendo) || (ingresoCliente[cid] || 0) / nB) : 0
    const fuenteIng = !arr ? '' : n(b.valor_arriendo) ? 'Valor del baño' : ingresoCliente[cid] ? 'Parte del cliente' : 'Sin ingreso'
    const operacion = a ? (a.rutas + a.insumos + a.despachos) / nB : 0
    const mant = mantPorBano[b.id] || 0
    const inst = ultimaInst[b.id]
    return {
      id: b.id, codigo: b.codigo, modelo: b.modelos_bano?.nombre || 'Sin modelo', estado: b.estado,
      cliente: cid ? cli[cid]?.nombre : '—', ingreso: ing, fuenteIng, sinIngreso: arr && !ing, operacion, mant, costo: operacion + mant,
      margen: arr && !ing ? null : ing - operacion - mant,
      diasArriendo: b.estado === 'en_arriendo' && inst ? diasDesde(inst) : null, desde: b.estado === 'en_arriendo' ? inst || null : null,
      estimado: arr && !n(b.valor_arriendo) && !!ing,
    }
  }).sort((a, b) => (a.margen ?? 1e12) - (b.margen ?? 1e12))

  // ── Insumos: consumo, cobertura y reposición ────────────────────────────
  const futurasIds = new Set(d.futuras.map((s) => s.id))
  const banosFuturos = d.paradas.filter((p) => futurasIds.has(p.salida_id) && p.tarea === 'limpieza').reduce((s, p) => s + n(p.banos), 0)
  const diasTranscurridos = d.mes === mesActual() ? Math.max(1, Number(hoy.slice(8, 10))) : dias
  const insumosTabla = d.insumos.map((i) => {
    const salidasIns = d.movIns.filter((m) => m.insumo_id === i.id && n(m.cantidad) < 0)
    const consumo30 = Math.max(0, -salidasIns.reduce((s, m) => s + n(m.cantidad), 0)) || 0
    const r = d.receta.find((x) => x.insumo_id === i.id)
    const porBano = r ? n(r.cantidad) : 0
    const usadoRutas = porBano * banosLimpiadosMes
    const proyectado14 = porBano * banosFuturos
    const diario = Math.max(consumo30 / 30, usadoRutas / diasTranscurridos, proyectado14 / 14)
    const stock = n(i.stock_actual)
    const cobertura = diario ? stock / diario : null
    const punto = diario * 7 + n(i.stock_minimo)
    const comprar = stock <= punto ? Math.ceil(Math.max(0, diario * 30 + n(i.stock_minimo) - stock)) : 0
    return {
      id: i.id, nombre: i.nombre, unidad: i.unidad, stock, minimo: n(i.stock_minimo), porBano, consumo30, usadoRutas, proyectado14, diario, cobertura, punto,
      comprar, bajoMinimo: stock <= n(i.stock_minimo),
      costoUnit: n(i.costo_unitario), costoMes: diario * 30 * n(i.costo_unitario),
      sinReceta: !r, sinCosto: !n(i.costo_unitario),
      estimado: consumo30 === 0 && (usadoRutas > 0 || proyectado14 > 0),
    }
  }).sort((a, b) => (a.cobertura ?? 1e9) - (b.cobertura ?? 1e9))

  const tot = (arr, k) => arr.reduce((s, x) => s + n(x[k]), 0)
  const conIngreso = clientesTabla.filter((c) => !c.sinIngreso)
  return {
    clientes: clientesTabla, rutas: rutasTabla, kmDisponibles, vehiculosMes: Object.keys(kmVeh).length, ocupacion, banos: banosTabla, insumos: insumosTabla, banosLimpiadosMes,
    resumen: {
      ingreso: tot(clientesTabla, 'ingreso'), costo: tot(clientesTabla, 'costo'),
      costoConIngreso: tot(conIngreso, 'costo'),
      clientesSinIngreso: clientesTabla.filter((c) => c.sinIngreso).length,
      costoSinIngreso: tot(clientesTabla.filter((c) => c.sinIngreso), 'costo'),
      ventasMes: d.ventas.length,
      ventasSinCliente: d.ventas.filter((v) => !v.cliente_id).reduce((s, v) => s + n(v.neto), 0),
      ventasSinClienteN: d.ventas.filter((v) => !v.cliente_id).length,
      despachosSinCosto: despachosSinCosto.length, recetaSinCosto, recetaVacia: d.receta.length === 0,
      salidas: d.salidas.length, salidasSinKm: d.salidas.filter((s) => s.km_real == null).length,
      banosSinIngreso: banosTabla.filter((b) => b.sinIngreso).length,
      banosSinInstalacion: banosTabla.filter((b) => b.estado === 'en_arriendo' && !b.desde).length,
      insumosSinCosto: insumosTabla.filter((i) => i.sinCosto).length,
      bajo20: conIngreso.filter((c) => c.pct !== null && c.pct < 0.2).length,
    },
  }
}

// ── Tendencia mensual (hasta 12 meses, desde el primer mes con datos) ─────
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
  const filas = meses.map((k) => {
    const r = fila[k]
    const costo = r.otros + r.rutas + r.mant + r.insumos
    return { ...r, costo, conDatos: r.ventas > 0 || costo > 0, margen: r.ventas ? r.ventas - costo : null, pct: r.ventas ? (r.ventas - costo) / r.ventas : null }
  })
  const primero = filas.findIndex((r) => r.conDatos)
  return primero === -1 ? filas.slice(-1) : filas.slice(primero)
}
