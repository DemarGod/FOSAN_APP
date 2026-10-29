// Cálculos de la pestaña Análisis. Sin ventas importadas: el ingreso de cada
// cliente es el valor mensual de su contrato. Los costos se asignan por
// actividad (costo por servicio): aseos, kilómetros, despachos y baños.
import { supabase } from './supabase'
import { costoKmVehiculo, costoServicioBano, costoSalida, mapaParametros, hoyISO, sumarDias } from './costos'

const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || [] }
const opc = (p) => q(p).catch(() => [])
const n = (v) => Number(v || 0)
const f$ = (x) => '$' + Math.round(x || 0).toLocaleString('es-CL')
const fn = (x, d = 0) => (Number(x) || 0).toLocaleString('es-CL', { maximumFractionDigits: d })
const fp = (x) => Math.round((x || 0) * 100) + '%'

// Supuestos cuando el parámetro no está cargado (editables en Parámetros de costo)
export const SUPUESTOS = {
  factor_recorrido: 1.3,      // la ruta real es ~30% más larga que la línea recta
  bano_valor_compra: 450000,  // supuesto: validar con cotización del proveedor
  bano_valor_residual: 45000, // 10% del valor de compra
  bano_vida_anos: 7,          // depreciación lineal
  conductores: 1,
}
const sup = (par, k) => (par[k] === null || par[k] === undefined ? SUPUESTOS[k] : n(par[k]))

export const GRUPO_ESTADO = {
  en_arriendo: 'arriendo',
  disponible: 'disponible', en_limpieza: 'disponible',
  mantencion: 'mantencion', fuera_de_servicio: 'mantencion',
}
const grupo = (e) => GRUPO_ESTADO[e] || 'otros'

export const rangoMes = (mes) => {
  const [y, m] = mes.split('-').map(Number)
  const fin = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { ini: `${mes}-01`, fin, dias: new Date(Date.UTC(y, m, 0)).getUTCDate() }
}
export const mesActual = () => hoyISO().slice(0, 7)

// ── Distancias ────────────────────────────────────────────────────────────
const coord = (x) => (x && Number(x.lat) && Number(x.lng) ? { lat: Number(x.lat), lng: Number(x.lng) } : null)
export const distKm = (a, b) => {
  if (!a || !b) return null
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
// Bodega → paradas en el orden de la ruta → bodega, en línea recta
const recorrido = (bodega, puntos) => {
  let km = 0, prev = bodega, faltan = 0
  puntos.forEach((p) => { if (!p) { faltan++; return } km += distKm(prev, p); prev = p })
  return { km: km + distKm(prev, bodega), faltan }
}

export async function cargarMes(mes) {
  const { ini, fin } = rangoMes(mes)
  const hoy = hoyISO()
  const [clientes, banos, salidas, despachos, mant, insumos, receta, pars, movIns, ocup, futuras, instalaciones, rutas, bodegas, flota] = await Promise.all([
    q(supabase.from('clientes').select('*')),
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
    opc(supabase.from('movimientos_activo').select('activo_id, fecha').eq('tipo', 'instalacion').order('fecha', { ascending: false })),
    opc(supabase.from('rutas').select('id, nombre, dias, ruta_paradas(cliente_id, orden, tarea)')),
    opc(supabase.from('ubicaciones').select('id, nombre, lat, lng').eq('tipo', 'bodega')),
    opc(supabase.from('activos').select('id, tipo, estado').in('tipo', ['camion', 'camioneta']).neq('estado', 'baja')),
  ])
  const ids = [...new Set([...salidas.map((s) => s.id), ...futuras.map((s) => s.id)])]
  const paradas = ids.length
    ? await opc(supabase.from('salida_paradas').select('salida_id, cliente_id, tarea, banos, hecha, despacho_id').in('salida_id', ids))
    : []
  return { mes, ini, fin, clientes, banos, salidas, despachos, mant, insumos, receta, par: mapaParametros(pars), movIns, ocup, futuras, paradas, instalaciones, rutas, bodegas, flota }
}

export function calcular(d) {
  const { dias } = rangoMes(d.mes)
  const SEM = dias / 7
  const hoy = hoyISO()
  const par = d.par
  const factor = sup(par, 'factor_recorrido')

<<<<<<< HEAD
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
=======
  // ── Tarifas unitarias ───────────────────────────────────────────────────
  const k = costoKmVehiculo({}, par)
  const kmVar = k.combustible + k.mantencion           // diésel + desgaste: sube con cada km
  const serv = costoServicioBano(par)
  const insPorId = Object.fromEntries(d.insumos.map((i) => [i.id, i]))
  const esFijo = (i) => i?.uso === 'fijo'
  const recetaAseo = d.receta.filter((r) => !esFijo(insPorId[r.insumo_id]))
  const detalleAseo = recetaAseo.map((r) => {
    const i = insPorId[r.insumo_id] || {}
    return { nombre: i.nombre || 'Insumo', cantidad: n(r.cantidad), unidad: i.unidad || '', unitario: n(i.costo_unitario), costo: n(r.cantidad) * n(i.costo_unitario) }
>>>>>>> ea0d2b747eb19e38dcaecf415e907e8d87880209
  })
  const insumosAseo = detalleAseo.reduce((s, x) => s + x.costo, 0)
  const recetaSinCosto = detalleAseo.some((x) => !x.unitario)
  const costoAseoVar = insumosAseo + serv.total
  const fijosIns = d.insumos.filter(esFijo).map((i) => {
    const mensual = n(i.duracion_meses) ? (n(i.en_uso) * n(i.costo_unitario)) / n(i.duracion_meses) : 0
    return { id: i.id, nombre: i.nombre, unidad: i.unidad, enUso: n(i.en_uso), duracion: n(i.duracion_meses), unitario: n(i.costo_unitario), mensual, sinDato: !mensual }
  })
  const eppMes = fijosIns.reduce((s, x) => s + x.mensual, 0)

  // Costos fijos del mes (existen aunque no se haga ningún aseo)
  const nVeh = Math.max(1, d.flota.length)
  const depCamionMes = n(par.dep_vida_anos) ? Math.max(0, n(par.dep_valor_compra) - n(par.dep_valor_residual)) / (n(par.dep_vida_anos) * 12) : 0
  const docsMes = (n(par.permiso_anual) + n(par.seguro_anual) + n(par.revision_anual)) / 12
  const conductorMes = sup(par, 'conductores') * n(par.conductor_sueldo)
  const fijoTransporte = nVeh * (docsMes + depCamionMes) + conductorMes
  const banoCompra = sup(par, 'bano_valor_compra'), banoResidual = sup(par, 'bano_valor_residual'), banoVida = sup(par, 'bano_vida_anos')
  const depBanoMes = banoVida ? Math.max(0, banoCompra - banoResidual) / (banoVida * 12) : 0

  // ── Base por cliente ────────────────────────────────────────────────────
  const bodega = d.bodegas.map(coord).find(Boolean) || null
  const cli = Object.fromEntries(d.clientes.map((c) => [c.id, c]))
  const ida = (cid) => (bodega && coord(cli[cid]) ? distKm(bodega, coord(cli[cid])) : null)
  const banosDeCli = {}
  d.banos.forEach((b) => { if (b.cliente_id && b.estado === 'en_arriendo') (banosDeCli[b.cliente_id] ||= []).push(b) })
  const vigente = (c) => (!c.fecha_inicio_contrato || c.fecha_inicio_contrato <= d.fin) && (!c.fecha_fin_contrato || c.fecha_fin_contrato >= d.ini)
  const base = {}
  d.clientes.forEach((c) => {
    const arr = (banosDeCli[c.id] || []).length
    const propios = n(c.banos_propios)
    const frec = (c.dias_limpieza || []).length
    base[c.id] = {
      arr, propios, frec, aseos: (arr + propios) * frec * SEM, aseosReal: 0,
      ingreso: vigente(c) && n(c.valor_mensual) ? n(c.valor_mensual) : null,
      kmRutas: 0, kmDesp: 0, rutas: [], despachos: [], mant: 0, mantN: 0, sinRuta: false, sinUbic: !coord(c), ida: ida(c.id),
    }
  })

  // Aseos realmente hechos (control contra lo programado)
  const salPorId = Object.fromEntries(d.salidas.map((s) => [s.id, s]))
  d.paradas.forEach((p) => {
    const s = salPorId[p.salida_id]
    if (!s || s.fecha > hoy || p.tarea !== 'limpieza' || (s.estado === 'cerrada' && !p.hecha)) return
    if (base[p.cliente_id]) base[p.cliente_id].aseosReal += n(p.banos)
  })

  // ── Rutas: km por salida (odómetro si hay; si no, línea recta × factor) ──
  const enRuta = new Set()
  const rutasTabla = d.rutas.map((r) => {
    const paradas = [...(r.ruta_paradas || [])].sort((a, b) => n(a.orden) - n(b.orden))
    const ids = [...new Set(paradas.map((p) => p.cliente_id).filter((x) => base[x]))]
    const rec = bodega && paradas.length ? recorrido(bodega, paradas.map((p) => coord(cli[p.cliente_id]))) : null
    const kmRecto = rec ? rec.km : null
    const kmEst = kmRecto != null ? kmRecto * factor : null
    const sal = d.salidas.filter((s) => s.ruta_id === r.id && s.km_real != null && n(s.km) > 0)
    const kmOdo = sal.length ? sal.reduce((t, s) => t + n(s.km), 0) / sal.length : null
    const kmSalida = kmOdo ?? kmEst
    const diasSem = (r.dias || []).length
    const salidasMes = diasSem * SEM
    const kmMes = kmSalida != null ? kmSalida * salidasMes : 0
    // Reparto entre clientes según lo que costaría ir solo a cada uno (distancia desde bodega)
    const pesos = ids.map((cid) => ({ cid, w: base[cid].ida ?? 0 }))
    const wTot = pesos.reduce((t, x) => t + x.w, 0)
    pesos.forEach(({ cid, w }) => {
      const share = wTot ? w / wTot : 1 / ids.length
      base[cid].kmRutas += kmMes * share
      base[cid].rutas.push({ ruta: r.nombre, km: kmMes * share, share })
      enRuta.add(cid)
    })
    const aseosMes = ids.reduce((t, cid) => t + (base[cid].arr + base[cid].propios), 0) * salidasMes
    return {
      id: r.id, ruta: r.nombre, paradas: ids.length, faltanUbic: rec ? rec.faltan : ids.length, diasSem,
      kmRecto, kmEst, kmOdo, salidasOdo: sal.length, kmSalida, fuenteKm: kmOdo != null ? 'Odómetro' : kmEst != null ? 'Estimado' : 'Sin datos',
      salidasMes, kmMes, costoSalida: kmSalida != null ? kmSalida * k.total : null, costoMes: kmMes * k.total,
      aseosMes, costoAseo: aseosMes ? (kmMes * k.total) / aseosMes : null,
    }
  }).sort((a, b) => b.costoMes - a.costoMes)

  // Clientes con aseos que no están en ninguna ruta: viaje propio ida y vuelta
  Object.entries(base).forEach(([cid, b]) => {
    if (b.frec && (b.arr + b.propios) && !enRuta.has(cid)) {
      b.sinRuta = true
      if (b.ida != null) b.kmRutas += b.frec * SEM * 2 * b.ida * factor
    }
  })

  // ── Despachos: cada uno es un viaje bodega → cliente → bodega ───────────
  const despachosTabla = d.despachos.map((x) => {
    const b = base[x.cliente_id]
    const km = b && b.ida != null ? 2 * b.ida * factor : null
    if (b && km) { b.kmDesp += km; b.despachos.push({ folio: x.folio, tipo: x.tipo, km }) }
    return {
      id: x.id, folio: x.folio, tipo: x.tipo, estado: x.estado, fecha: x.fecha_programada, cliente: cli[x.cliente_id]?.nombre || '—',
      enRuta: !!x.salida_id, km, costoVar: km ? km * kmVar : null, costo: km ? km * k.total : null,
    }
  })

  // ── Mantenciones de baños ───────────────────────────────────────────────
  const banoCli = Object.fromEntries(d.banos.map((b) => [b.id, b.cliente_id]))
  const mantPorBano = {}
  d.mant.forEach((m) => {
    if (m.activos?.tipo && m.activos.tipo !== 'bano_quimico') return
    mantPorBano[m.activo_id] = (mantPorBano[m.activo_id] || 0) + n(m.costo)
    const cid = m.activos?.cliente_id || banoCli[m.activo_id]
    if (cid && base[cid]) { base[cid].mant += n(m.costo); base[cid].mantN++ }
  })

  // ── Margen por cliente ──────────────────────────────────────────────────
  const kmTot = Object.values(base).reduce((t, b) => t + b.kmRutas + b.kmDesp, 0)
  const aseosTot = Object.values(base).reduce((t, b) => t + b.aseos, 0)
  const filas = d.clientes.map((c) => {
    const b = base[c.id]
    const km = b.kmRutas + b.kmDesp
    const insumos = b.aseos * insumosAseo
    const servicio = b.aseos * serv.total
    const transporte = b.kmRutas * kmVar
    const despachos = b.kmDesp * kmVar
    const fTrans = kmTot ? (fijoTransporte * km) / kmTot : 0
    const fEpp = aseosTot ? (eppMes * b.aseos) / aseosTot : 0
    const fDep = b.arr * depBanoMes
    const variable = insumos + servicio + transporte + despachos + b.mant
    const fijo = fTrans + fEpp + fDep
    const costo = variable + fijo
    const sinIngreso = b.ingreso == null
    const ing = b.ingreso || 0
    return {
      id: c.id, nombre: c.nombre, arr: b.arr, propios: b.propios, frec: b.frec, aseos: b.aseos, aseosReal: b.aseosReal, km,
      ingreso: b.ingreso, sinIngreso, insumos, servicio, transporte, despachos, mant: b.mant, variable, fTrans, fEpp, fDep, fijo, costo,
      contribucion: sinIngreso ? null : ing - variable, margen: sinIngreso ? null : ing - costo,
      pct: sinIngreso ? null : (ing - costo) / ing, pctContrib: sinIngreso ? null : (ing - variable) / ing,
      precioAseo: !sinIngreso && b.aseos ? ing / b.aseos : null, costoAseo: b.aseos ? (costo - fDep - b.mant) / b.aseos : null,
      margenAseo: !sinIngreso && b.aseos ? (ing - costo) / b.aseos : null,
      sinRuta: b.sinRuta, sinUbic: b.sinUbic, estimado: b.sinRuta || b.sinUbic || !bodega || recetaSinCosto,
      lineas: [
        { concepto: 'Ingreso mensual (contrato)', formula: sinIngreso ? 'Sin valor mensual o contrato no vigente en el mes' : 'Valor mensual acordado', monto: ing, ingreso: true },
        { concepto: 'Insumos de aseo', formula: `${fn(b.aseos, 1)} aseos × ${f$(insumosAseo)} por aseo`, monto: insumos },
        { concepto: 'Agua y residuos', formula: `${fn(b.aseos, 1)} aseos × ${f$(serv.total)} por aseo`, monto: servicio },
        { concepto: 'Transporte de aseos (diésel + desgaste)', formula: b.sinUbic ? 'Cliente sin ubicación: no se calculan km' : `${fn(b.kmRutas)} km × ${f$(kmVar)}/km${b.sinRuta ? ' · sin ruta: viaje propio' : b.rutas.length ? ` · ${b.rutas.map((r) => `${r.ruta} ${fp(r.share)}`).join(', ')}` : ''}`, monto: transporte },
        { concepto: 'Despachos (entregas y retiros)', formula: b.despachos.length ? `${b.despachos.length} viaje(s) · ${fn(b.kmDesp)} km × ${f$(kmVar)}/km` : 'Sin despachos en el mes', monto: despachos },
        { concepto: 'Mantenciones de sus baños', formula: `${b.mantN} registrada(s) en el mes`, monto: b.mant },
        { concepto: 'Camión y conductor (fijo asignado)', formula: kmTot ? `${fp(km / kmTot)} de los km del mes × ${f$(fijoTransporte)}` : 'Sin km en el mes', monto: fTrans },
        { concepto: 'Insumos fijos: EPP y otros (asignado)', formula: aseosTot ? `${fp(b.aseos / aseosTot)} de los aseos × ${f$(eppMes)}` : 'Sin aseos en el mes', monto: fEpp },
        { concepto: 'Depreciación de baños', formula: `${b.arr} baño(s) × ${f$(depBanoMes)} al mes`, monto: fDep },
      ],
    }
  }).filter((r) => r.ingreso || r.arr || (r.propios && r.frec) || r.costo > 0)
  const ingTot = filas.reduce((t, r) => t + (r.ingreso || 0), 0)
  const costoCli = filas.reduce((t, r) => t + r.costo, 0)
  filas.forEach((r) => { r.partIngreso = ingTot ? (r.ingreso || 0) / ingTot : null; r.partCosto = costoCli ? r.costo / costoCli : null; r.partAseos = aseosTot ? r.aseos / aseosTot : null })
  const clientesTabla = filas.sort((a, b) => (a.sinIngreso - b.sinIngreso) || (a.pct ?? 0) - (b.pct ?? 0) || b.costo - a.costo)

  // ── Punto de equilibrio ─────────────────────────────────────────────────
  const conIng = clientesTabla.filter((c) => !c.sinIngreso)
  const ingCon = conIng.reduce((t, c) => t + c.ingreso, 0)
  const varCon = conIng.reduce((t, c) => t + c.variable, 0)
  const aseosCon = conIng.reduce((t, c) => t + c.aseos, 0)
  const banosCon = conIng.reduce((t, c) => t + c.arr, 0)
  const ocioso = (d.banos.length - Object.values(base).reduce((t, b) => t + b.arr, 0)) * depBanoMes
  const cf = [
    { concepto: `Permiso, seguro y revisión técnica · ${nVeh} vehículo(s)`, monto: nVeh * docsMes },
    { concepto: `Depreciación de camión · ${nVeh} vehículo(s)`, monto: nVeh * depCamionMes },
    { concepto: `Sueldo de conductor · ${fn(sup(par, 'conductores'))} persona(s)`, monto: conductorMes },
    { concepto: `Depreciación de baños · ${d.banos.length} baños`, monto: d.banos.length * depBanoMes },
    { concepto: `Insumos fijos (EPP y otros) · ${fijosIns.length} ítem(s)`, monto: eppMes },
  ]
  const CF = cf.reduce((t, x) => t + x.monto, 0)
  const ratioMC = ingCon ? 1 - varCon / ingCon : null
  const pe$ = ratioMC > 0 ? CF / ratioMC : null
  const precioAseo = aseosCon ? ingCon / aseosCon : null
  const cvAseo = aseosCon ? varCon / aseosCon : null
  const mcAseo = precioAseo != null ? precioAseo - cvAseo : null
  const equilibrio = {
    CF, cf, ingreso: ingCon, variable: varCon, ratioMC, pe$, aseos: aseosCon, precioAseo, cvAseo, mcAseo,
    peAseos: mcAseo > 0 ? CF / mcAseo : null,
    ingresoBano: banosCon ? ingCon / banosCon : null, banos: banosCon,
    peBanos: pe$ != null && banosCon ? pe$ / (ingCon / banosCon) : null,
    seguridad: pe$ != null && ingCon ? (ingCon - pe$) / ingCon : null,
    resultado: ingCon - varCon - CF, ocioso,
  }

  // ── Rentabilidad por aseo (cada baño arrendado) ─────────────────────────
  const porCli = Object.fromEntries(clientesTabla.map((c) => [c.id, c]))
  const ultimaInst = {}
  d.instalaciones.forEach((m) => { if (!ultimaInst[m.activo_id]) ultimaInst[m.activo_id] = m.fecha })
  const diasDesde = (f) => Math.max(0, Math.floor((Date.now() - new Date(/^\d{4}-\d{2}-\d{2}$/.test(f) ? f + 'T12:00:00' : f)) / 864e5))
  const banosTabla = d.banos.map((b) => {
    const c = b.cliente_id ? porCli[b.cliente_id] : null
    const arr = b.estado === 'en_arriendo' && c
    const frec = arr ? c.frec : 0
    const aseos = frec * SEM
    const actividad = c ? c.costo - c.fDep - c.mant : 0   // costo de aseos, transporte y despachos del cliente
    let ingreso = null, costoAct = 0
    if (arr) {
      if (n(b.valor_arriendo)) ingreso = n(b.valor_arriendo)
      else if (!c.sinIngreso) ingreso = c.aseos ? c.ingreso * (aseos / c.aseos) : c.ingreso / Math.max(1, c.arr)
      costoAct = c.aseos ? actividad * (aseos / c.aseos) : actividad / Math.max(1, c.arr)
    }
    const mant = mantPorBano[b.id] || 0
    const costo = costoAct + depBanoMes + mant
    const margen = ingreso == null ? (arr ? null : -costo) : ingreso - costo
    const inst = ultimaInst[b.id]
    return {
      id: b.id, codigo: b.codigo, modelo: b.modelos_bano?.nombre || 'Sin modelo', estado: b.estado, cliente: c?.nombre || '—',
      frec, aseos, ingreso, sinIngreso: arr && ingreso == null, costoAct, dep: depBanoMes, mant, costo, margen,
      precioAseo: ingreso != null && aseos ? ingreso / aseos : null, costoAseo: aseos ? costo / aseos : null, margenAseo: margen != null && aseos ? margen / aseos : null,
      diasArriendo: b.estado === 'en_arriendo' && inst ? diasDesde(inst) : null, desde: b.estado === 'en_arriendo' ? inst || null : null,
      estimado: !!arr && !n(b.valor_arriendo) && ingreso != null,
    }
  }).sort((a, b) => (a.margenAseo ?? a.margen ?? 1e12) - (b.margenAseo ?? b.margen ?? 1e12))

  // ── Ocupación: arrendados ÷ (arrendados + disponibles) ──────────────────
  const vacio = () => ({ total: 0, arriendo: 0, disponible: 0, mantencion: 0, otros: 0 })
  const sumar = (o, e) => { o.total++; o[grupo(e)]++ }
  const pctOc = (o) => (o.arriendo + o.disponible ? o.arriendo / (o.arriendo + o.disponible) : null)
  const hoyG = vacio(), modelos = {}, otrosEstados = {}
  d.banos.forEach((b) => {
    sumar(hoyG, b.estado)
    const m = b.modelos_bano?.nombre || 'Sin modelo'
    sumar((modelos[m] ||= { modelo: m, ...vacio() }), b.estado)
    if (grupo(b.estado) === 'otros') otrosEstados[b.estado] = (otrosEstados[b.estado] || 0) + 1
  })
  const diasFoto = [...new Set(d.ocup.map((o) => o.fecha))]
  let pctMes, fuente
  if (diasFoto.length) {
    const g = vacio(); d.ocup.forEach((o) => { if (o.estado !== 'baja') sumar(g, o.estado) })
    pctMes = pctOc(g); fuente = `promedio de ${diasFoto.length} de ${dias} día(s) del mes con foto diaria`
  } else { pctMes = pctOc(hoyG); fuente = 'estado de hoy (aún no hay fotos diarias de este mes)' }
  const ocupacion = {
    pct: pctMes, pctHoy: pctOc(hoyG), dias: diasFoto.length, diasMes: dias, fuente, estimado: diasFoto.length < dias, hoy: hoyG, otrosEstados,
    porModelo: Object.values(modelos).map((m) => ({ ...m, pct: pctOc(m) })).sort((a, b) => b.total - a.total),
  }

  // ── Insumos: consumo, cobertura y reposición ────────────────────────────
  const futurasIds = new Set(d.futuras.map((s) => s.id))
  const banosFuturos = d.paradas.filter((p) => futurasIds.has(p.salida_id) && p.tarea === 'limpieza').reduce((s, p) => s + n(p.banos), 0)
  const banosLimpiadosMes = Object.values(base).reduce((t, b) => t + b.aseosReal, 0)
  const diasTranscurridos = d.mes === mesActual() ? Math.max(1, Number(hoy.slice(8, 10))) : dias
  const insumosTabla = d.insumos.map((i) => {
    const consumo30 = Math.max(0, -d.movIns.filter((m) => m.insumo_id === i.id && n(m.cantidad) < 0).reduce((s, m) => s + n(m.cantidad), 0))
    const r = esFijo(i) ? null : d.receta.find((x) => x.insumo_id === i.id)
    const porBano = r ? n(r.cantidad) : 0
    const usadoRutas = porBano * banosLimpiadosMes
    const proyectado14 = porBano * banosFuturos
    const diario = Math.max(consumo30 / 30, usadoRutas / diasTranscurridos, proyectado14 / 14)
    const stock = n(i.stock_actual)
    const punto = diario * 7 + n(i.stock_minimo)
    return {
      id: i.id, nombre: i.nombre, unidad: i.unidad, uso: esFijo(i) ? 'fijo' : 'aseo', stock, minimo: n(i.stock_minimo), porBano, consumo30, usadoRutas, proyectado14, diario,
      cobertura: diario ? stock / diario : null, punto, comprar: stock <= punto ? Math.ceil(Math.max(0, diario * 30 + n(i.stock_minimo) - stock)) : 0,
      bajoMinimo: stock <= n(i.stock_minimo), costoUnit: n(i.costo_unitario), costoMes: diario * 30 * n(i.costo_unitario),
      sinReceta: !r, sinCosto: !n(i.costo_unitario), estimado: consumo30 === 0 && (usadoRutas > 0 || proyectado14 > 0),
    }
  }).sort((a, b) => (a.cobertura ?? 1e9) - (b.cobertura ?? 1e9))

  const sinIng = clientesTabla.filter((c) => c.sinIngreso)
  return {
    clientes: clientesTabla, rutas: rutasTabla, despachos: despachosTabla, equilibrio, banos: banosTabla, ocupacion, insumos: insumosTabla, banosLimpiadosMes,
    tarifas: { k, kmVar, factor, serv, detalleAseo, insumosAseo, costoAseoVar, fijosIns, eppMes, depBanoMes, banoCompra, banoResidual, banoVida, fijoTransporte, nVeh, semanas: SEM, bodega: !!bodega },
    resumen: {
      ingreso: ingTot, costo: costoCli, variable: clientesTabla.reduce((t, c) => t + c.variable, 0), fijo: clientesTabla.reduce((t, c) => t + c.fijo, 0),
      ingresoCon: ingCon, costoCon: conIng.reduce((t, c) => t + c.costo, 0), aseos: aseosTot, km: kmTot,
      clientesSinIngreso: sinIng.length, costoSinIngreso: sinIng.reduce((t, c) => t + c.costo, 0),
      sinBodega: !bodega, clientesSinUbic: clientesTabla.filter((c) => c.sinUbic).length, clientesSinRuta: clientesTabla.filter((c) => c.sinRuta).length,
      recetaSinCosto, recetaVacia: recetaAseo.length === 0, fijosSinDato: fijosIns.filter((x) => x.sinDato).length, sinFijos: fijosIns.length === 0,
      despachosSinUbic: despachosTabla.filter((x) => x.km == null).length,
      rutasSinUbic: rutasTabla.filter((r) => r.faltanUbic > 0).length,
      banosSinIngreso: banosTabla.filter((b) => b.sinIngreso).length,
      insumosSinCosto: insumosTabla.filter((i) => i.sinCosto).length,
      bajo20: conIng.filter((c) => c.pct < 0.2).length,
      supuestoDep: par.bano_valor_compra == null,
    },
  }
}

// ── Tendencia mensual: contratos vigentes vs costos registrados ───────────
export async function tendencia(mes) {
  const [y, m] = mes.split('-').map(Number)
  const meses = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(y, m - 12 + i, 1)).toISOString().slice(0, 7))
  const ini = meses[0] + '-01', fin = rangoMes(mes).fin
  const [clientes, salidas, mant, movIns, insumos, pars] = await Promise.all([
    opc(supabase.from('clientes').select('valor_mensual, fecha_inicio_contrato, fecha_fin_contrato')),
    opc(supabase.from('v_salidas').select('*').gte('fecha', ini).lte('fecha', fin).neq('estado', 'cancelada')),
    opc(supabase.from('mantenciones').select('fecha_programada, fecha_realizada, costo, estado').gte('fecha_programada', ini).lte('fecha_programada', fin).eq('estado', 'completada')),
    opc(supabase.from('movimientos_insumo').select('insumo_id, cantidad, fecha').gte('fecha', ini)),
    opc(supabase.from('insumos').select('id, costo_unitario')),
    opc(supabase.from('parametros').select('*')),
  ])
  const par = mapaParametros(pars)
  const cu = Object.fromEntries(insumos.map((i) => [i.id, n(i.costo_unitario)]))
  const fila = Object.fromEntries(meses.map((k) => [k, { mes: k, ingreso: 0, rutas: 0, mant: 0, insumos: 0, estimado: true }]))
  const en = (f) => fila[String(f).slice(0, 7)]
  meses.forEach((k) => {
    const { ini: a, fin: b } = rangoMes(k)
    fila[k].ingreso = clientes.filter((c) => n(c.valor_mensual) && (!c.fecha_inicio_contrato || c.fecha_inicio_contrato <= b) && (!c.fecha_fin_contrato || c.fecha_fin_contrato >= a)).reduce((s, c) => s + n(c.valor_mensual), 0)
  })
  salidas.forEach((s) => { const r = en(s.fecha); if (r) r.rutas += costoSalida(s, par).total })
  mant.forEach((x) => { const r = en(x.fecha_realizada || x.fecha_programada); if (r) r.mant += n(x.costo) })
  movIns.forEach((x) => { const r = en(x.fecha); if (r && n(x.cantidad) < 0) r.insumos += -n(x.cantidad) * (cu[x.insumo_id] || 0) })
  const filas = meses.map((k) => {
    const r = fila[k]
    const costo = r.rutas + r.mant + r.insumos
    return { ...r, costo, conDatos: costo > 0, margen: r.ingreso ? r.ingreso - costo : null, pct: r.ingreso ? (r.ingreso - costo) / r.ingreso : null }
  })
  const primero = filas.findIndex((r) => r.conDatos)
  return primero === -1 ? filas.slice(-1) : filas.slice(primero)
}
