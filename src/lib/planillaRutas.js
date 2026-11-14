// Planilla semanal de rutas en Excel: una hoja por ruta, con el mismo formato que usa la oficina para imprimir
// y entregar a los operadores (Orden · Cliente · Tarea · Arriendos · Frecuencia · Lu…Vi · Contacto · Teléfono · Baños).
// Este archivo solo arma las filas; no consulta la base (así se puede probar solo). Lo usa lib/exportarRutas.js.
import { letra } from './xlsxPlanilla'

const DIAS = [{ v: 1, l: 'Lu' }, { v: 2, l: 'Ma' }, { v: 3, l: 'Mi' }, { v: 4, l: 'Ju' }, { v: 5, l: 'Vi' }]
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const TAREA = { limpieza: 'Limpieza', entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio' }
const ANCHOS = [7, 34, 12, 11, 12, 10, 10, 10, 10, 10, 22, 16, 46]

// 'YYYY-MM-DD' + n días, sin depender de la zona horaria
const masDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const corto = (iso) => `${Number(iso.slice(8, 10))} ${MES[Number(iso.slice(5, 7)) - 1]}`
const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const tituloSemana = (lunes) => {
  const viernes = masDias(lunes, 4)
  return `Semana ${corto(lunes)} – ${corto(viernes)} ${viernes.slice(0, 4)}`
}

/**
 * Hoja de una ruta.
 *   ruta      → fila de rutas_semana con rutas_semana_lineas y activos(codigo)
 *   clientes  → { [id]: cliente de clientesPlanilla() } (arriendos, banos_propios, dias_limpieza, contacto…)
 *   despachos → { [id]: despacho } de las entregas y retiros de la ruta (folio, banos, cantidad, servicio_tipo)
 *   operador  → nombre del operador
 */
export function hojaDeRuta(ruta, clientes, despachos, operador) {
  const lineas = [...(ruta.rutas_semana_lineas || [])].sort((a, b) => a.orden - b.orden || a.id - b.id)
  const n = ANCHOS.length, ultima = letra(n - 1)
  const vacia = (s) => Array.from({ length: n }, () => (s ? { v: '', s } : ''))
  const filas = []

  filas.push([{ v: `${ruta.nombre} · ${tituloSemana(ruta.lunes)}`, s: 'titulo' }])
  filas.push([{ v: `Operador: ${operador || 'Sin operador'}    Vehículo: ${ruta.activos?.codigo || 'Sin vehículo'}`, s: 'subtitulo' }])
  filas.push([])
  filas.push(['Orden', 'Cliente', 'Tarea', 'Arriendos', 'Frecuencia', ...DIAS.map((d) => `${d.l} ${diaMes(masDias(ruta.lunes, d.v - 1))}`), 'Contacto', 'Teléfono', 'Baños']
    .map((v) => ({ v, s: 'encabezado' })))

  const porDia = DIAS.map(() => 0)
  lineas.forEach((l, i) => {
    const c = clientes[l.cliente_id] || {}
    const d = l.despacho_id ? despachos[l.despacho_id] : null
    const fosa = d?.servicio_tipo === 'limpieza_fosas'
    const arriendos = c.arriendos?.length || 0
    const propios = Number(c.banos_propios) || 0
    const codigos = (c.arriendos || []).map((a) => a.codigo).join(', ')
    const dias = (l.dias || []).filter((x) => x >= 1 && x <= 5)
    // Frecuencia: limpiezas por semana acordadas con el cliente; si no hay, los días marcados en esta planilla
    const frecuencia = l.tarea === 'limpieza' ? ((c.dias_limpieza || []).filter((x) => x >= 1 && x <= 5).length || dias.length) : ''
    // Lo que va en la celda del día: cuántos baños se atienden en esa parada
    const cantidad = fosa ? 'X' : l.tarea === 'limpieza' ? arriendos + propios
      : d ? Number(d.cantidad ?? 0) : (l.banos || []).length
    const banos = fosa ? 'Fosa'
      : l.tarea === 'limpieza' ? [codigos, propios ? `Baño propio${propios > 1 ? ` ×${propios}` : ''}` : ''].filter(Boolean).join(' · ')
        : d ? [`#${d.folio}`, d.banos].filter(Boolean).join(' · ')
          : (l.banos || []).length ? `${l.banos.length} baño(s) elegido(s)` : ''
    dias.forEach((x) => { porDia[x - 1] += 1 })
    filas.push([
      { v: i + 1, s: 'centro' },
      { v: c.nombre || '—', s: 'texto' },
      { v: fosa ? 'Fosa' : TAREA[l.tarea] || l.tarea, s: 'centro' },
      { v: arriendos, s: 'centro' },
      { v: frecuencia, s: 'centro' },
      ...DIAS.map((x) => (dias.includes(x.v) ? { v: cantidad, s: 'marcado' } : { v: '', s: 'centro' })),
      { v: c.contacto_nombre || '', s: 'texto' },
      { v: c.telefono || '', s: 'texto' },
      { v: [banos, l.nota].filter(Boolean).join(' · '), s: 'texto' },
    ])
  })
  if (!lineas.length) {
    const f = vacia('texto'); f[1] = { v: 'Esta ruta no tiene clientes.', s: 'texto' }; filas.push(f)
  }
  const total = vacia('total')
  total[1] = { v: 'Paradas por día', s: 'totalTexto' }
  porDia.forEach((x, k) => { total[5 + k] = { v: x, s: 'total' } })
  filas.push(total)
  if (ruta.notas) { filas.push([]); filas.push([`Notas: ${ruta.notas}`]) }

  const primeraFila = 4, ultimaFila = 4 + Math.max(lineas.length, 1)
  return {
    nombre: ruta.nombre,
    filas,
    anchos: ANCHOS,
    altos: { 0: 26, 3: 32 },
    combinar: [`A1:${ultima}1`, `A2:${ultima}2`],
    filtro: lineas.length ? `A${primeraFila}:${ultima}${ultimaFila}` : null,
  }
}

/** Todas las rutas de la semana: una hoja por ruta. */
export const hojasDeSemana = (rutas, clientes, despachos, nombreOperador) =>
  rutas.map((r) => hojaDeRuta(r, clientes, despachos, nombreOperador(r.operador_id)))
