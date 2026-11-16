// Respaldos de operaciones en Google Drive (Paquete 30): carpetas por tipo y mes, nombres que se entienden
// sin abrir el archivo, y la constancia de la operación (HTML para imprimir o para guardar como PDF).
//
//   FIRMAS/2026-12/       20-12-2026 · D-00041 · AGRICOLA BP · Firma cliente Juan Pérez.png
//                         20-12-2026 · D-00041 · AGRICOLA BP · Firma chofer Pedro Soto.png
//   FOTOS/2026-12/        20-12-2026 · D-00041 · AGRICOLA BP · Foto 1.jpg
//   ARCHIVOS/2026-12/     20-12-2026 · D-00041 · AGRICOLA BP · Archivo guia 123.pdf   (PDF u otros que no son fotos)
//   CONSTANCIAS/2026-12/  20-12-2026 · D-00041 · AGRICOLA BP · Constancia.pdf
// Las carpetas las crea el script de Google (apps_script/Codigo.gs, versión 2). Los respaldos antiguos no se mueven.
import { fecha, fechaHora } from './ui'

export const L_TIPO_RESPALDO = { firma: 'Firma del cliente', firma_chofer: 'Firma del chofer', archivo: 'Archivo', constancia: 'Constancia' }
const CARPETA = { firma: 'FIRMAS', firma_chofer: 'FIRMAS', foto: 'FOTOS', archivo: 'ARCHIVOS', constancia: 'CONSTANCIAS' }

const esImagen = (tipoMime, nombre) => /^image\//i.test(tipoMime || '') || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(nombre || '')
const extension = (nombre, tipoMime) => (String(nombre || '').match(/\.[a-z0-9]{2,5}$/i)?.[0]
  || ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'application/pdf': '.pdf' }[tipoMime] || '')).toLowerCase()
const limpio = (s) => String(s ?? '').replace(/[\\/\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim()

// Fecha local 'YYYY-MM-DD' de una fecha ('2026-12-20'), fecha-hora local ('2026-12-20T10:30') o ISO con zona
export const fechaLocal = (x) => {
  const s = String(x || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = s ? new Date(s) : new Date()
  const v = isNaN(d) ? new Date() : d
  return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
}

/**
 * Carpeta y nombre en Drive de un respaldo.
 *   tipo: 'firma' (cliente) | 'firma_chofer' | 'archivo' | 'constancia'
 *   fechaOp: fecha de la operación · folio: D-00041 (o "Limpieza") · cliente · firmante · original: nombre del archivo subido · indice: N.º de foto
 */
export function destinoRespaldo({ tipo, fechaOp, folio, cliente, firmante, original, tipoMime, indice }) {
  const f = fechaLocal(fechaOp)
  const foto = tipo === 'archivo' && esImagen(tipoMime, original)
  const clase = tipo === 'archivo' ? (foto ? 'foto' : 'archivo') : tipo
  const detalle = {
    firma: `Firma cliente ${limpio(firmante) || 'sin nombre'}`,
    firma_chofer: `Firma chofer ${limpio(firmante) || 'sin nombre'}`,
    foto: `Foto ${indice || 1}`,
    archivo: `Archivo ${limpio(String(original || '').replace(/\.[a-z0-9]{2,5}$/i, '')) || indice || 1}`,
    constancia: 'Constancia',
  }[clase]
  const ext = clase === 'constancia' ? '.pdf' : clase.startsWith('firma') ? '.png' : extension(original, tipoMime)
  const nombre = [`${f.slice(8, 10)}-${f.slice(5, 7)}-${f.slice(0, 4)}`, limpio(folio) || 'Sin folio', limpio(cliente) || 'Sin cliente', detalle]
    .join(' · ').slice(0, 190) + ext
  return { ruta: [CARPETA[clase], f.slice(0, 7)], nombre }
}

// Imagen (firma) → "data:image/png;base64,…" para ponerla dentro de la constancia
export const aDataUrl = (blob) => new Promise((ok, mal) => {
  if (!blob) { ok(null); return }
  const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => mal(r.error); r.readAsDataURL(blob)
})

const esc = (s) => String(s ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/**
 * Constancia de una operación en HTML.
 *   o: operación (folio, cliente, rut, ubicacion, servicio, tipo, unidades, patente, responsable, fechas, observaciones…)
 *   accion: texto "Servicio · acción" ya armado
 *   cliente / chofer: { imagen: dataUrl o url, nombre } (pueden faltar)
 *   imprimir: true agrega el botón y abre el diálogo de impresión; false = para guardar como PDF en Drive
 */
export function htmlConstancia(o, { accion, servicio, cliente, chofer, imprimir = false } = {}) {
  const fila = (l, v) => `<tr><th>${esc(l)}</th><td>${esc(v === '' ? null : v)}</td></tr>`
  const bloque = (f, rotulo) => `<div class="f">${f?.imagen ? `<img src="${esc(f.imagen)}" alt="Firma">` : '<div class="vacio"></div>'}<div class="l">${esc(rotulo)}${f?.nombre ? ` · ${esc(f.nombre)}` : ''}</div></div>`
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Constancia ${esc(o.folio)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#201e1d;margin:28px;font-size:13px}
  .cab{border-bottom:3px solid #13294b;padding-bottom:8px;margin-bottom:16px;overflow:hidden}
  .cab .izq{float:left} .cab .der{float:right;text-align:right}
  h1{margin:0;font-size:26px;color:#13294b} h2{margin:0;font-size:16px} small{color:#5f6368}
  table{width:100%;border-collapse:collapse} th{text-align:left;width:180px;color:#5f6368;font-weight:bold;padding:6px 8px;border-bottom:1px solid #dbe3ee;vertical-align:top}
  td{padding:6px 8px;border-bottom:1px solid #dbe3ee}
  .firmas{margin-top:26px;width:100%;overflow:hidden} .f{float:left;width:46%;margin-right:4%;text-align:center}
  .f img{max-height:100px;max-width:100%;display:block;margin:0 auto 4px} .vacio{height:100px}
  .l{border-top:1px solid #201e1d;padding-top:6px;font-size:12px}
  .pie{clear:both;padding-top:18px} @media print{button{display:none}}
</style></head><body>
<div class="cab"><div class="izq"><h1>FOSAN</h1><small>Constancia de operación</small></div><div class="der"><h2>${esc(o.folio)}</h2><small>${esc(accion)}</small></div></div>
<table>
${fila('Cliente', o.cliente)}${fila('RUT', o.rut)}${fila('Ubicación', o.ubicacion)}${fila('Servicio', servicio)}
${fila('Unidades', o.unidades)}${fila('Patente', o.patente)}${fila('Chofer / responsable', chofer?.nombre || o.responsable)}
${fila('Fecha programada', o.fecha_programada ? fecha(o.fecha_programada) : null)}${fila('Fecha de ejecución', o.fecha_realizada ? fechaHora(o.fecha_realizada) : null)}
${fila('Recibió en terreno', cliente?.nombre || o.recibido_por)}${fila('Observaciones', [o.observaciones, o.resultado].filter(Boolean).join(' · ') || null)}
</table>
<div class="firmas">${bloque(cliente, 'Firma de recepción (cliente)')}${bloque(chofer, 'Firma del chofer (FOSAN)')}</div>
<p class="pie"><small>Emitida el ${esc(fechaHora(new Date().toISOString()))}. Documento generado por el sistema de gestión FOSAN.</small></p>
${imprimir ? '<button onclick="window.print()">Imprimir</button><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>' : ''}
</body></html>`
}
