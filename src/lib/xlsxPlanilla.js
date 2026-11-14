// Excel (.xlsx) con formato: negritas, bordes, celdas de color, celdas combinadas y hoja lista para imprimir.
// La librería "xlsx" que usa el resto de la app no escribe estilos; por eso este archivo arma el .xlsx directamente
// (un .xlsx es un ZIP con XML adentro). No necesita ninguna dependencia nueva.
//
// Uso:  descargarXlsx('Rutas_semana_2026-11-09.xlsx', [{ nombre, filas, anchos, combinar, filtro, altos }])
//   filas    → [[celda, celda, …], …]; cada celda es un valor o { v: valor, s: 'estilo' }
//   estilos  → ver ESTILOS (titulo, subtitulo, encabezado, texto, centro, marcado, total, totalTexto)

export const ESTILOS = { normal: 0, titulo: 1, subtitulo: 2, encabezado: 3, texto: 4, centro: 5, marcado: 6, total: 7, totalTexto: 8 }

const XML_ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFE699"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

// Texto seguro para XML (sin caracteres de control, que Excel rechaza)
const esc = (x) => String(x).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Columna 0 → A, 25 → Z, 26 → AA
export const letra = (i) => {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// Nombre de hoja válido para Excel: sin \ / ? * [ ] :, máximo 31 caracteres y sin repetir
export const nombresDeHoja = (nombres) => {
  const usados = new Set()
  return nombres.map((n, i) => {
    const base = (String(n || '').replace(/[\\/?*[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim() || `Hoja ${i + 1}`).slice(0, 31)
    let nombre = base
    for (let k = 2; usados.has(nombre.toLowerCase()); k++) nombre = `${base.slice(0, 31 - String(k).length - 1)} ${k}`
    usados.add(nombre.toLowerCase())
    return nombre
  })
}

function xmlHoja({ filas, anchos = [], combinar = [], filtro, altos = {} }) {
  const cuerpo = filas.map((fila, r) => {
    const celdas = fila.map((celda, c) => {
      const o = celda !== null && typeof celda === 'object' ? celda : { v: celda }
      const s = ESTILOS[o.s] || 0
      const ref = `${letra(c)}${r + 1}`
      if (o.v === null || o.v === undefined || o.v === '') return s ? `<c r="${ref}" s="${s}"/>` : ''
      if (typeof o.v === 'number' && Number.isFinite(o.v)) return `<c r="${ref}" s="${s}"><v>${o.v}</v></c>`
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(o.v)}</t></is></c>`
    }).join('')
    const alto = altos[r] ? ` ht="${altos[r]}" customHeight="1"` : ''
    return `<row r="${r + 1}"${alto}>${celdas}</row>`
  }).join('')
  const cols = anchos.length ? `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''
  const merges = combinar.length ? `<mergeCells count="${combinar.length}">${combinar.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
${cols}<sheetData>${cuerpo}</sheetData>${filtro ? `<autoFilter ref="${filtro}"/>` : ''}${merges}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup paperSize="1" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`
}

// ── ZIP sin compresión (método "stored"): válido para .xlsx ─────────────────
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (bytes) => {
  let c = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
function zip(archivos) {
  const cod = new TextEncoder()
  const partes = [], indice = []
  let pos = 0
  for (const [ruta, texto] of archivos) {
    const nombre = cod.encode(ruta), datos = cod.encode(texto), crc = crc32(datos)
    const cab = new DataView(new ArrayBuffer(30))
    cab.setUint32(0, 0x04034B50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true)   // UTF-8
    cab.setUint16(8, 0, true); cab.setUint16(10, 0, true); cab.setUint16(12, 0x21, true)              // sin compresión · 01/01/1980
    cab.setUint32(14, crc, true); cab.setUint32(18, datos.length, true); cab.setUint32(22, datos.length, true)
    cab.setUint16(26, nombre.length, true); cab.setUint16(28, 0, true)
    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014B50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true)
    cen.setUint16(10, 0, true); cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true)
    cen.setUint32(16, crc, true); cen.setUint32(20, datos.length, true); cen.setUint32(24, datos.length, true)
    cen.setUint16(28, nombre.length, true); cen.setUint32(42, pos, true)
    partes.push(new Uint8Array(cab.buffer), nombre, datos)
    indice.push(new Uint8Array(cen.buffer), nombre)
    pos += 30 + nombre.length + datos.length
  }
  const tamIndice = indice.reduce((s, p) => s + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054B50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamIndice, true); fin.setUint32(16, pos, true)
  const total = new Uint8Array(pos + tamIndice + 22)
  let o = 0
  for (const p of [...partes, ...indice, new Uint8Array(fin.buffer)]) { total.set(p, o); o += p.length }
  return total
}

/** Arma el .xlsx (Uint8Array) con una hoja por elemento de `hojas`. */
export function armarXlsx(hojas) {
  const nombres = nombresDeHoja(hojas.map((h) => h.nombre))
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  const P = 'http://schemas.openxmlformats.org'
  return zip([
    ['[Content_Types].xml', `${X}<Types xmlns="${P}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${X}<Relationships xmlns="${P}/package/2006/relationships"><Relationship Id="rId1" Type="${P}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${X}<workbook xmlns="${P}/spreadsheetml/2006/main" xmlns:r="${P}/officeDocument/2006/relationships"><sheets>${nombres.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${X}<Relationships xmlns="${P}/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${P}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length + 1}" Type="${P}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', XML_ESTILOS],
    ...hojas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, xmlHoja(h)]),
  ])
}

/** Arma el .xlsx y lo descarga en el navegador. */
export function descargarXlsx(archivo, hojas) {
  const blob = new Blob([armarXlsx(hojas)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = archivo; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
