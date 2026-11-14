// Botón "Exportar" de Rutas semanales: descarga el Excel de la semana que se está viendo (una hoja por ruta),
// listo para imprimir y entregar a los operadores.
import { clientesPlanilla, despachosPorId } from './rutasSemana'
import { hojasDeSemana } from './planillaRutas'
import { descargarXlsx } from './xlsxPlanilla'

export async function exportarRutasSemana(lunes, rutas, nombreOperador) {
  const ids = [...new Set(rutas.flatMap((r) => (r.rutas_semana_lineas || []).map((l) => l.despacho_id).filter(Boolean)))]
  const [clientes, despachos] = await Promise.all([clientesPlanilla(), despachosPorId(ids)])
  const hojas = hojasDeSemana(
    rutas,
    Object.fromEntries(clientes.map((c) => [c.id, c])),
    Object.fromEntries(despachos.map((d) => [d.id, d])),
    nombreOperador,
  )
  descargarXlsx(`Rutas_semana_${lunes}.xlsx`, hojas)
}
