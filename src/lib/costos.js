// Costo estimado de una salida (ruta de un día) a partir de v_salidas y los parámetros.
//  combustible = km ÷ rendimiento ajustado por peso × precio diésel
//  desgaste    = km × (mantención por km + valor compra ÷ vida útil en km)
//  fijos       = km × (seguro + permiso + revisión al año ÷ km al año)

export const TIPOS_VEHICULO = {
  camion_limpiafosas: 'Camión limpiafosas',
  camion_plano: 'Camión plano',
  camioneta: 'Camioneta',
}

export const mapaParametros = (lista) =>
  Object.fromEntries((lista || []).map((p) => [p.clave, p.valor === null ? null : Number(p.valor)]))

const n = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v))

export function costoKmVehiculo(v, par = {}) {
  const desgaste = n(v.costo_mant_km) + (n(v.valor_compra) && n(v.vida_util_km) ? n(v.valor_compra) / n(v.vida_util_km) : 0)
  const fijos = n(v.costo_fijo_anual) && n(v.km_anual) ? n(v.costo_fijo_anual) / n(v.km_anual) : 0
  const combustible = n(v.rend_vacio) && par.diesel_litro ? par.diesel_litro / n(v.rend_vacio) : 0
  return { desgaste, fijos, combustible, total: desgaste + fijos + combustible }
}

export function costoSalida(s, par = {}) {
  const faltan = []
  const km = n(s.km)
  if (!km) faltan.push('kilómetros')
  const banosLimp = n(s.banos_limpieza)
  const litrosResiduo = banosLimp && par.litros_limpieza != null ? banosLimp * par.litros_limpieza : null
  const pesoResiduo = litrosResiduo != null && par.densidad_residuo != null ? litrosResiduo * par.densidad_residuo : null
  if (banosLimp && pesoResiduo == null) faltan.push('residuo por baño (Configuración)')
  if (n(s.banos_sin_peso)) faltan.push(`peso de ${s.banos_sin_peso} baño(s) (Configuración)`)
  const pesoBanos = n(s.peso_banos)
  const pesoTotal = pesoBanos + (pesoResiduo || 0)
  const cap = n(s.capacidad_kg)
  if (!s.vehiculo_id) faltan.push('vehículo')
  else if (!cap) faltan.push('capacidad de carga del vehículo')
  const factor = cap ? Math.min(1, pesoTotal / cap) : 0
  const rv = n(s.rend_vacio)
  const rc = n(s.rend_cargado) || rv
  if (s.vehiculo_id && !rv) faltan.push('rendimiento km/L del vehículo')
  if (!par.diesel_litro) faltan.push('precio del diésel')
  const rend = rv ? rv - (rv - rc) * factor : 0
  const litrosDiesel = rend ? km / rend : 0
  const combustible = litrosDiesel * n(par.diesel_litro)
  const k = costoKmVehiculo(s, par)
  const desgaste = km * k.desgaste
  const fijos = km * k.fijos
  return {
    km, pesoBanos, pesoResiduo, pesoTotal, litrosResiduo, factor, rend, litrosDiesel,
    combustible, desgaste, fijos, total: combustible + desgaste + fijos, faltan,
    excedeCarga: cap > 0 && pesoTotal > cap,
    excedeEstanque: n(s.capacidad_litros) > 0 && litrosResiduo > n(s.capacidad_litros),
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
