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

const hoy = () => { const d = new Date(); return [d.getDate(), d.getMonth() + 1, d.getFullYear()].map((n) => String(n).padStart(2, '0')).join('-') }

// Fechas ISO (2026-10-27 o con hora) → 27/10/2026; encabezados snake_case → "Fecha programada"
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/
const aFecha = (v) => {
  if (typeof v !== 'string') return v
  const m = v.match(RE_FECHA)
  if (!m) return v
  return `${m[3]}/${m[2]}/${m[1]}` + (m[4] && v.length > 10 && `${m[4]}:${m[5]}` !== '00:00' ? ` ${m[4]}:${m[5]}` : '')
}
const titulo = (k) => /^[a-z0-9_]+$/.test(k) ? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ') : k
const limpiar = (datos) => datos.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [titulo(k), aFecha(v)])))

function descargar(libro, nombre) {
  XLSX.writeFile(libro, nombre)
}

/** Libro completo: una pestaña por vista. */
export async function exportarLibro() {
  const libro = XLSX.utils.book_new()
  for (const p of PESTANAS) {
    let datos = []
    try { datos = await vistaExport(p.vista) } catch { datos = [] }
    const hoja = XLSX.utils.json_to_sheet(datos.length ? limpiar(datos) : [{ Aviso: 'Sin datos' }])
    XLSX.utils.book_append_sheet(libro, hoja, p.hoja.slice(0, 31))
  }
  descargar(libro, `FOSAN_reporte_${hoy()}.xlsx`)
}

/** Una sola pestaña. */
export async function exportarVista(vista, hoja) {
  const datos = await vistaExport(vista)
  const libro = XLSX.utils.book_new()
  const h = XLSX.utils.json_to_sheet(datos.length ? limpiar(datos) : [{ Aviso: 'Sin datos' }])
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
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(limpiar(datos)), nombre.slice(0, 31))
  descargar(libro, `FOSAN_${nombre.replace(/\s+/g, '_')}_${hoy()}.xlsx`)
}
