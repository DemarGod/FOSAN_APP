import * as XLSX from 'xlsx'

const hoy = () => new Date().toISOString().slice(0, 10)

// Ancho de cada columna según su contenido (mín. 8, máx. 60 caracteres), para que los textos largos
// (motivos, observaciones) no se monten sobre las columnas vecinas al abrir en Excel.
function ajustarAnchos(hoja) {
  if (!hoja || !hoja['!ref']) return hoja
  const r = XLSX.utils.decode_range(hoja['!ref'])
  const cols = []
  for (let c = r.s.c; c <= r.e.c; c++) {
    let max = 8
    for (let f = r.s.r; f <= r.e.r; f++) {
      const celda = hoja[XLSX.utils.encode_cell({ r: f, c })]
      if (celda && celda.v != null) max = Math.max(max, ...String(celda.w ?? celda.v).split('\n').map((x) => x.length + 2))
    }
    cols.push({ wch: Math.min(max, 60) })
  }
  hoja['!cols'] = cols
  return hoja
}
export function guardarLibro(libro, nombre) {
  libro.SheetNames.forEach((n) => ajustarAnchos(libro.Sheets[n]))
  XLSX.writeFile(libro, nombre)
}

/** Lo que está en pantalla, tal cual se ve. */
export function exportarTabla(columnas, filas, nombre) {
  const datos = filas.map((f) => {
    const o = {}
    columnas.forEach((c, i) => { o[c] = f[i] })
    return o
  })
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(datos), nombre.slice(0, 31))
  guardarLibro(libro, `FOSAN_${nombre.replace(/\s+/g, '_')}_${hoy()}.xlsx`)
}

// CSV: separador ";", UTF-8 con BOM (abre bien en Excel)
export function exportarCSV(columnas, filas, nombre) {
  const esc = (x) => (/[";\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
  const texto = '﻿' + [columnas, ...filas].map((r) => r.map(esc).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `${nombre}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}