// Coordenadas "como en Google Maps": un solo texto «-35.426400, -71.655400».
// leerCoordenadas() entiende lo que la oficina copia o recibe por WhatsApp:
//   · coordenadas copiadas de Google Maps:        -35.4264, -71.6554   (también con coma decimal o con ° ' ")
//   · ubicación enviada por WhatsApp:              https://maps.google.com/?q=-35.4264,-71.6554
//   · enlace largo de Google Maps:                 https://www.google.com/maps/place/…/@-35.42,-71.65,17z/…!3d-35.4264!4d-71.6554
//   · enlace de Waze:                              https://waze.com/ul?ll=-35.4264,-71.6554   ·   https://waze.com/ul/h66jc…
// Los enlaces cortos de Google (maps.app.goo.gl/…) no traen las coordenadas escritas: los abre
// ubicacionDesdeTexto() con la función de Netlify "resolver-ubicacion".

const N = '(-?\\d{1,3}\\.\\d+)'                         // decimal con punto
const par = (a, b) => {
  const lat = Number(a), lng = Number(b)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

// Geohash (enlaces cortos de Waze: waze.com/ul/h<geohash>)
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
function deGeohash(h) {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180, esLng = true
  for (const ch of h.toLowerCase()) {
    const v = BASE32.indexOf(ch)
    if (v < 0) return null
    for (let bit = 4; bit >= 0; bit--) {
      const uno = (v >> bit) & 1
      if (esLng) { const m = (lngMin + lngMax) / 2; if (uno) lngMin = m; else lngMax = m }
      else { const m = (latMin + latMax) / 2; if (uno) latMin = m; else latMax = m }
      esLng = !esLng
    }
  }
  return par((latMin + latMax) / 2, (lngMin + lngMax) / 2)
}

// Grados, minutos y segundos: 35°25'35.0"S 71°39'19.4"W (O = oeste)
function deGrados(t) {
  const G = '(\\d{1,3})\\s*°\\s*(?:(\\d{1,2})\\s*[\'′’]\\s*)?(?:(\\d{1,2}(?:[.,]\\d+)?)\\s*(?:"|″|”|\'\')\\s*)?([NSEWO])'
  const m = t.toUpperCase().match(new RegExp(`${G}[\\s,;]+${G}`))
  if (!m) return null
  const v = (g, mi, s, h) => (Number(g) + Number(mi || 0) / 60 + Number(String(s || 0).replace(',', '.')) / 3600) * ('SWO'.includes(h) ? -1 : 1)
  const a = { h: m[4], x: v(m[1], m[2], m[3], m[4]) }, b = { h: m[8], x: v(m[5], m[6], m[7], m[8]) }
  const lat = 'NS'.includes(a.h) ? a : 'NS'.includes(b.h) ? b : null
  const lng = lat === a ? b : a
  return lat && !'NS'.includes(lng.h) ? par(lat.x, lng.x) : null
}

function deEnlace(url) {
  let u = url
  try { u = decodeURIComponent(url) } catch { /* se usa tal cual */ }
  const waze = u.match(/waze\.com\/(?:[a-z-]+\/)?ul\/h([0-9a-z]{6,12})(?![0-9a-z])/i)
  if (waze) return deGeohash(waze[1])
  const patrones = [
    new RegExp(`!3d${N}!4d${N}`),                                                           // el pin exacto de Google Maps
    new RegExp(`[?&#](?:q|query|ll|sll|daddr|destination|center|latlng|loc|to)=(?:loc:|ll\\.)?${N}\\s*,\\s*${N}`, 'i'),
    new RegExp(`geo:${N},${N}`, 'i'),
    new RegExp(`/@${N},${N}`),                                                              // centro de la vista
  ]
  for (const p of patrones) { const m = u.match(p); if (m) { const r = par(m[1], m[2]); if (r) return r } }
  return null
}

// ¿Es un enlace corto de Google Maps? (hay que abrirlo para saber a dónde apunta)
export const esEnlaceCorto = (t) => /(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(String(t || ''))

/** Lee coordenadas de un texto pegado. Devuelve { lat, lng } o null si no las encuentra. */
export function leerCoordenadas(texto) {
  const t = String(texto ?? '').trim()
  if (!t) return null
  for (const url of t.match(/(?:https?:\/\/|geo:)[^\s<>"]+/gi) || []) { const r = deEnlace(url); if (r) return r }
  if (/waze\.com|google\.[a-z.]+\/maps|maps\.google/i.test(t)) { const r = deEnlace(t); if (r) return r }
  const g = deGrados(t)
  if (g) return g
  // 35.4264° S, 71.6554° W
  const h = t.toUpperCase().match(/(\d{1,3}[.,]\d+)\s*°?\s*([NS])[\s,;]+(\d{1,3}[.,]\d+)\s*°?\s*([EWO])/)
  if (h) return par(Number(h[1].replace(',', '.')) * (h[2] === 'S' ? -1 : 1), Number(h[3].replace(',', '.')) * (h[4] === 'E' ? 1 : -1))
  // -35.4264, -71.6554   ·   -35.4264 -71.6554   ·   (-35.4264; -71.6554)
  const p = t.match(new RegExp(`${N}\\s*[,;\\s]\\s*${N}`))
  if (p) return par(p[1], p[2])
  // con coma decimal: -35,4264, -71,6554   ·   -35,4264; -71,6554
  const c = t.match(/(-?\d{1,3},\d+)\s*(?:;|,\s|\s)\s*(-?\d{1,3},\d+)/)
  if (c) return par(c[1].replace(',', '.'), c[2].replace(',', '.'))
  return null
}

/** «-35.426400, -71.655400»: el mismo formato que entrega Google Maps al copiar las coordenadas. */
export const formatoCoordenadas = (lat, lng) =>
  (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '' ? '' : `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`)

export const enlaceGoogleMaps = (lat, lng) => `https://www.google.com/maps?q=${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`

// Chile continental e insular cercano: sirve para avisar de un punto pegado por error (otro país, lat/lng invertidas)
export const enChile = ({ lat, lng }) => lat <= -17 && lat >= -56.5 && lng <= -66 && lng >= -76

export const MENSAJE_SIN_COORDENADAS = 'No reconozco esas coordenadas. Pega las de Google Maps (ej. -35.4264, -71.6554) o el enlace de Google Maps o Waze.'

/**
 * Igual que leerCoordenadas, pero además abre los enlaces cortos de Google Maps (maps.app.goo.gl/…).
 * Devuelve { lat, lng } o lanza un Error con un mensaje para mostrar.
 */
export async function ubicacionDesdeTexto(texto) {
  const directo = leerCoordenadas(texto)
  if (directo) return directo
  const corto = String(texto || '').match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\/[^\s<>"]+/i)
  if (!corto) throw new Error(MENSAJE_SIN_COORDENADAS)
  const fallo = 'No pude abrir ese enlace corto. Ábrelo en Google Maps, mantén presionado (o clic derecho) sobre el punto, copia las coordenadas y pégalas aquí.'
  let datos
  try {
    const r = await fetch(`/.netlify/functions/resolver-ubicacion?u=${encodeURIComponent(corto[0])}`)
    datos = await r.json()
  } catch { throw new Error(fallo) }
  const r = (datos?.lat != null && datos?.lng != null && par(datos.lat, datos.lng)) || leerCoordenadas(datos?.url || '')
  if (!r) throw new Error(fallo)
  return r
}
