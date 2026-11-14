// Función de Netlify: abre un enlace corto de Google Maps (maps.app.goo.gl/…, goo.gl/maps/…) y devuelve a dónde apunta.
// Hace falta porque esos enlaces no traen las coordenadas escritas y el navegador no puede seguirlos por sí solo.
// La usa src/lib/coordenadas.js → ubicacionDesdeTexto().   Se llama así:  /.netlify/functions/resolver-ubicacion?u=<enlace>
// Solo acepta enlaces cortos de Google Maps y solo sigue redirecciones dentro de Google (no sirve para abrir otras páginas).

const CORTOS = [/^maps\.app\.goo\.gl$/i, /^goo\.gl$/i, /^g\.co$/i]
const DE_GOOGLE = /(^|\.)google\.[a-z.]{2,6}$|(^|\.)goo\.gl$|^g\.co$/i
const NAVEGADOR = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'es-CL,es;q=0.9' }
const N = '(-?\\d{1,3}\\.\\d+)'
const PATRONES = [
  new RegExp(`!3d${N}!4d${N}`),
  new RegExp(`[?&](?:q|query|ll|sll|daddr|destination|center)=${N}(?:,|%2C)${N}`, 'i'),
  new RegExp(`/@${N},${N}`),
]
const coordenadasDe = (texto) => {
  for (const p of PATRONES) { const m = texto.match(p); if (m) return { lat: Number(m[1]), lng: Number(m[2]) } }
  return null
}
const responder = (codigo, cuerpo) => ({
  statusCode: codigo,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  body: JSON.stringify(cuerpo),
})

export const handler = async (evento) => {
  let url
  try { url = new URL(evento.queryStringParameters?.u || '') } catch { return responder(400, { error: 'Falta el enlace.' }) }
  if (url.protocol !== 'https:' || !CORTOS.some((h) => h.test(url.hostname))) return responder(400, { error: 'Solo enlaces cortos de Google Maps.' })

  try {
    // Seguir las redirecciones una por una, sin salir de Google
    let actual = url.toString()
    for (let i = 0; i < 6; i++) {
      const r = await fetch(actual, { redirect: 'manual', headers: NAVEGADOR })
      const destino = r.headers.get('location')
      if (!(r.status >= 300 && r.status < 400) || !destino) break
      const sig = new URL(destino, actual)
      if (sig.protocol !== 'https:' || !DE_GOOGLE.test(sig.hostname)) break
      actual = sig.toString()
      if (coordenadasDe(decodeURIComponent(actual))) break
    }
    let c = coordenadasDe(decodeURIComponent(actual))
    // Enlace a un lugar sin coordenadas en la dirección: buscarlas en la página (vista previa del mapa)
    if (!c && DE_GOOGLE.test(new URL(actual).hostname)) {
      const html = await (await fetch(actual, { headers: NAVEGADOR })).text()
      c = coordenadasDe(html.slice(0, 400000).replace(/\\u0026/g, '&').replace(/&amp;/g, '&'))
    }
    return responder(200, { url: actual, lat: c?.lat ?? null, lng: c?.lng ?? null })
  } catch (e) {
    return responder(502, { error: 'No se pudo abrir el enlace.' })
  }
}
