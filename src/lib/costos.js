// Costo estimado de una salida (ruta de un día) a partir de v_salidas y los parámetros.
//  combustible = km ÷ rendimiento ajustado por peso × precio diésel
//  desgaste    = km × (neumáticos + aceite + frenos + amortiguadores + preventiva + depreciación) por km
//  fijos       = km × (permiso + seguros + revisión al año ÷ km al año)
//  conductor   = km × (sueldo × 12 ÷ km al año)
//  servicio    = agua limpia × $/L + residuo × $/L de disposición
// Si el vehículo tiene valores propios (Transporte) reemplazan a los generales.

export const TIPOS_VEHICULO = {
  camion_limpiafosas: 'Camión limpiafosas',
  camion_plano: 'Camión plano',
  camioneta: 'Camioneta',
}

export const mapaParametros = (lista) =>
  Object.fromEntries((lista || []).map((p) => [p.clave, p.valor === null ? null : Number(p.valor)]))

const n = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v))

const div = (a, b) => (n(a) && n(b) ? n(a) / n(b) : 0)

export function costoKmVehiculo(v = {}, par = {}) {
  const kmAnual = n(v.km_anual) || n(par.km_anual)
  const neumaticos = div(n(par.neum_cantidad) * n(par.neum_precio), par.neum_vida_km)
  const aceite = div(par.aceite_costo, par.aceite_cada_km)
  const frenos = div(par.frenos_costo, par.frenos_vida_km)
  const amortiguadores = div(par.amort_costo, par.amort_vida_km)
  const preventiva = div(par.mant_prev_costo, par.mant_prev_cada_km)
  const mantPropia = n(v.costo_mant_km) > 0
  const mantencion = mantPropia ? n(v.costo_mant_km) : neumaticos + aceite + frenos + amortiguadores + preventiva
  const depreciacion = n(v.valor_compra) && n(v.vida_util_km)
    ? n(v.valor_compra) / n(v.vida_util_km)
    : div(n(par.dep_valor_compra) - n(par.dep_valor_residual), n(par.dep_vida_anos) * kmAnual)
  const permiso = div(par.permiso_anual, kmAnual)
  const seguro = div(par.seguro_anual, kmAnual)
  const revision = div(par.revision_anual, kmAnual)
  const fijoPropio = n(v.costo_fijo_anual) > 0
  const fijos = fijoPropio ? div(v.costo_fijo_anual, kmAnual) : permiso + seguro + revision
  const conductor = div(n(par.conductor_sueldo) * 12, kmAnual)
  const rend = n(v.rend_vacio) || n(par.rend_ref)
  const combustible = div(par.diesel_litro, rend)
  const desgaste = mantencion + depreciacion
  return {
    kmAnual, rend, neumaticos, aceite, frenos, amortiguadores, preventiva, mantencion, mantPropia, depreciacion,
    permiso, seguro, revision, fijos, fijoPropio, conductor, combustible, desgaste,
    total: combustible + desgaste + fijos + conductor,
  }
}

// Costo de agua + residuos de un baño limpiado
export const costoServicioBano = (par = {}) => ({
  agua: n(par.agua_bano ?? 12) * n(par.agua_litro),
  residuo: n(par.litros_limpieza) * n(par.residuo_litro),
  get total() { return this.agua + this.residuo },
})

export function costoSalida(s, par = {}) {
  const faltan = []
  const km = n(s.km)
  if (!km) faltan.push('kilómetros')
  const banosLimp = n(s.banos_limpieza)
  const litrosResiduo = banosLimp && par.litros_limpieza != null ? banosLimp * par.litros_limpieza : null
  const pesoResiduo = litrosResiduo != null ? litrosResiduo * (par.densidad_residuo ?? 1) : null
  // Agua limpia: se sale con el estanque lleno (1 L ≈ 1 kg) y se gastan 8–15 L por baño
  const estanqueAgua = par.estanque_agua ?? 200
  const aguaLimpia = banosLimp * (par.agua_bano ?? 12)
  const pesoAgua = banosLimp ? estanqueAgua : 0
  const recargasAgua = aguaLimpia > estanqueAgua ? Math.ceil(aguaLimpia / estanqueAgua) - 1 : 0
  const estanqueGrises = n(s.capacidad_litros) || (par.estanque_grises ?? 800)
  if (banosLimp && pesoResiduo == null) faltan.push('residuo por baño (Configuración)')
  if (n(s.banos_sin_peso)) faltan.push(`peso de ${s.banos_sin_peso} baño(s) (Configuración)`)
  const pesoBanos = n(s.peso_banos)
  const pesoTotal = pesoBanos + (pesoResiduo || 0) + pesoAgua
  const cap = n(s.capacidad_kg)
  if (!s.vehiculo_id) faltan.push('vehículo')
  else if (!cap) faltan.push('capacidad de carga del vehículo')
  const factor = cap ? Math.min(1, pesoTotal / cap) : 0
  const rv = n(s.rend_vacio) || n(par.rend_ref)
  const rc = n(s.rend_cargado) || rv
  if (s.vehiculo_id && !rv) faltan.push('rendimiento km/L del vehículo')
  if (!par.diesel_litro) faltan.push('precio del diésel')
  const rend = rv ? rv - (rv - rc) * factor : 0
  const litrosDiesel = rend ? km / rend : 0
  const combustible = litrosDiesel * n(par.diesel_litro)
  const k = costoKmVehiculo(s, par)
  const desgaste = km * k.desgaste
  const fijos = km * k.fijos
  const conductor = km * k.conductor
  const agua = aguaLimpia * n(par.agua_litro)
  const residuo = n(litrosResiduo) * n(par.residuo_litro)
  const servicio = agua + residuo
  return {
    km, pesoBanos, pesoResiduo, pesoAgua, aguaLimpia, recargasAgua, estanqueAgua, estanqueGrises, pesoTotal, litrosResiduo, factor, rend, litrosDiesel,
    combustible, desgaste, fijos, conductor, agua, residuo, servicio, banosLimp,
    total: combustible + desgaste + fijos + conductor + servicio, faltan,
    excedeCarga: cap > 0 && pesoTotal > cap,
    excedeEstanque: litrosResiduo > estanqueGrises,
    excedeBanos: n(s.capacidad_banos) > 0 && n(s.banos_transportados) > n(s.capacidad_banos),
  }
}

export const DIAS = [
  { v: 1, l: 'Lun' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Mié' }, { v: 4, l: 'Jue' },
  { v: 5, l: 'Vie' }, { v: 6, l: 'Sáb' }, { v: 7, l: 'Dom' },
]
export const diasTexto = (arr) => DIAS.filter((d) => (arr || []).includes(d.v)).map((d) => d.l).join(' · ') || '—'

export const hoyISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const sumarDias = (iso, dias) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}
