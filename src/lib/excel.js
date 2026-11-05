import * as XLSX from 'xlsx'
import { vistaExport } from './api'

// Una pestaña del libro por vista de exportación definida en el esquema.
export const PESTANAS = [
  { vista: 'export_ingresos_costos', hoja: 'Ingresos y costos', cols: 'Mes · Ventas · Costos · Utilidad · Margen' },
  { vista: 'export_ventas_utilidad', hoja: 'Ventas y utilidad', cols: 'Fecha · Cliente · Servicio · Neto · IVA · Total · Pagada' },
  { vista: 'export_servicios', hoja: 'Servicios', cols: 'Folio · Fecha · Tipo · Cliente · Ubicación · Valor · Transporte · Estado' },
  { vista: 'export_activos', hoja: 'Activos', cols: 'Código · Tipo · Detalle · Estado · Cliente · Ubicación · Valor · Último movimiento' },
  { vista: 'export_mantenciones', hoja: 'Mantenciones', cols: 'Fecha · Activo · Clase · Tipo · Responsable · Costo · Estado' },
  { vista: 'export_clientes', hoja: 'Clientes', cols: 'Cliente · Rubro · Contacto · Teléfono · Comuna · Vigencia · Baños · Valor mensual' },
]

const hoy = () => new Date().toISOString().slice(0, 10)

// Ancho de cada columna según su contenido (mín. 8, máx. 60 caracteres), para que los textos largos
// (motivos, observaciones) no se monten sobre las columnas vecinas al abrir en Excel.
export function ajustarAnchos(hoja) {
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
function descargar(libro, nombre) { guardarLibro(libro, nombre) }

/** Libro completo: una pestaña por vista. */
export async function exportarLibro() {
  const libro = XLSX.utils.book_new()
  for (const p of PESTANAS) {
    let datos = []
    try { datos = await vistaExport(p.vista) } catch { datos = [] }
    const hoja = XLSX.utils.json_to_sheet(datos.length ? datos : [{ aviso: 'Sin datos' }])
    XLSX.utils.book_append_sheet(libro, hoja, p.hoja.slice(0, 31))
  }
  descargar(libro, `FOSAN_reporte_${hoy()}.xlsx`)
}

/** Una sola pestaña. */
export async function exportarVista(vista, hoja) {
  const datos = await vistaExport(vista)
  const libro = XLSX.utils.book_new()
  const h = XLSX.utils.json_to_sheet(datos.length ? datos : [{ aviso: 'Sin datos' }])
  XLSX.utils.book_append_sheet(libro, h, hoja.slice(0, 31))
  descargar(libro, `FOSAN_${hoja.replace(/\s+/g, '_')}_${hoy()}.xlsx`)
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
  descargar(libro, `FOSAN_${nombre.replace(/\s+/g, '_')}_${hoy()}.xlsx`)
}
