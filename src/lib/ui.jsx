// Iconos, colores, etiquetas de los enum de la base y formateadores.

export const C = {
  navy: '#1f3a63',
  azul: '#4085f4',
  verde: '#34a853',
  amarillo: '#f9ab00',
  rojo: '#ea4335',
  borde: '#dbe3ee',
  tinte: '#e8f0fe',
  suave: '#f6f8fb',
  fila: '#eef1f5',
  gris: '#5f6368',
  tinta: '#201e1d',
}

export const I = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-6H10v6H4a1 1 0 0 1-1-1z',
  box: 'M12 3 3 7.5v9L12 21l9-4.5v-9zM3 7.5 12 12l9-4.5M12 12v9',
  drop: 'M12 2.7 6.9 8a7.2 7.2 0 1 0 10.2 0z',
  truck: 'M3 6h11v9H3zM14 9h4l3 3v3h-7zM7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  clip: 'M9 3h6v3H9zM6 4.5h2M16 4.5h2M6 4.5h12V21H6z',
  users: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a6 6 0 0 1 12 0M16 3.6a4 4 0 0 1 0 7.8M17 14.3a6 6 0 0 1 5 6.7',
  money: 'M12 2v20M17 6.3C17 4.5 14.8 3.4 12 3.4S7 4.5 7 6.3s2 3.2 5 4.2 5 2 5 4-2.2 3-5 3-5-1.1-5-3',
  wrench: 'M14.6 6.3a4.2 4.2 0 0 0 5.1 5.1l-8.6 8.6a2.9 2.9 0 0 1-4.1-4.1z',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  chart: 'M4 20V10M10 20V4M16 20v-8M2 20h20',
  alert: 'M12 3 1.8 20.5h20.4zM12 9.5v5M12 17.4v.1',
  check: 'M4 12.5 9.5 18 20 6.5',
  plus: 'M12 5v14M5 12h14',
  cabina: 'M6 2.5h12v19H6zM6 8h12M14.5 13.5v2.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.6v.1',
  gear: 'M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1',
  ojo: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z',
  lapiz: 'M4 20h4L20 8l-4-4L4 16v4zM14.5 5.5 18.5 9.5',
  descarga: 'M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16',
  doc: 'M6 2.5h8l4 4v15H6zM14 2.5v4h4',
  salir: 'M9 21H4.5V3H9M16 16.5l4.5-4.5L16 7.5M20.5 12H9',
  cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM19 19h2v2h-2z',
  busca: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
}

export function Icon({ d, size = 18, color = 'currentColor', w = 1.8, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={w} strokeLinecap="square" style={{ flex: 'none', ...style }}>
      <path d={d} />
    </svg>
  )
}

// ── Etiquetas de los enum de PostgreSQL ────────────────────────────────────
export const L_TIPO_ACTIVO = {
  bano_quimico: 'Baño químico', camion: 'Camión', camioneta: 'Camioneta',
  generador: 'Generador', lavamanos: 'Lavamanos', accesorio: 'Accesorio',
}
// Estados normalizados: se usan iguales en toda la app
export const L_ESTADO_ACTIVO = {
  disponible: 'Disponible', en_arriendo: 'Arrendado', en_limpieza: 'En limpieza', en_servicio: 'En servicio',
  mantencion: 'En mantención', fuera_de_servicio: 'Fuera de servicio', baja: 'Baja',
}
// Despachos: Planificado → Asignado → En ejecución → Finalizado; o Cancelado
export const estadoDespacho = (d, hoy = new Date().toISOString().slice(0, 10)) => {
  if (d.estado === 'hecho') return 'Finalizado'
  if (d.estado === 'cancelado') return 'Cancelado'
  const dia = d.fecha_salida || d.fecha_programada
  if ((d.vehiculo_id || d.salida_id) && dia === hoy) return 'En ejecución'
  return d.vehiculo_id || d.salida_id ? 'Asignado' : 'Planificado'
}
export const L_ESTADO_DESPACHO = { programado: 'Planificado', hecho: 'Finalizado', cancelado: 'Cancelado' }
export const L_ESTADO_MANT = {
  programada: 'Programada', proxima: 'Próxima', urgente: 'Urgente',
  completada: 'Completada', anulada: 'Anulada',
}
export const L_CLASE_MANT = { bano: 'Baño', camion: 'Camión', camioneta: 'Camioneta', equipo: 'Equipo' }
export const L_TIPO_SERVICIO = {
  arriendo_bano: 'Arriendo de baños', limpieza_bano: 'Limpieza de baños',
  limpieza_fosa: 'Limpieza de fosas sépticas', instalacion: 'Instalación',
  retiro: 'Retiro', traslado: 'Traslado', otro: 'Otro',
}
export const L_RUBRO = {
  construccion: 'Construcción', agricola: 'Agrícola', eventos: 'Eventos',
  mineria: 'Minería', publico: 'Público', otro: 'Otro',
}
export const L_TIPO_UBIC = {
  bodega: 'Bodega', faena: 'Faena', taller: 'Taller', transito: 'En tránsito', cliente: 'Cliente',
}
export const L_TIPO_EVENTO = {
  mantencion: 'Mantención', pago: 'Pago', servicio: 'Servicio', alerta: 'Alerta', reunion: 'Reunión',
}
export const L_VIGENCIA = { vigente: 'Activo', vencido: 'Vencido', indefinido: 'Indefinido' }
export const L_TIPO_DOC = {
  factura: 'Factura', certificado: 'Certificado', guia_despacho: 'Guía de despacho',
  revision_tecnica: 'Revisión técnica', seguro: 'Seguro', otro: 'Otro',
}
export const L_MOVIMIENTO = {
  instalacion: 'Instalado', traslado: 'Traslado', retiro: 'Retiro',
  limpieza: 'Limpieza', mantencion: 'Mantención', ingreso: 'Ingreso',
}

export const COLOR_EVENTO = {
  mantencion: C.amarillo, pago: C.verde, servicio: C.azul, alerta: C.rojo, reunion: C.navy,
}

// ── Badges ─────────────────────────────────────────────────────────────────
const FUERTE = { bg: '#1f3a63', fg: '#eef2f9' }
const SUAVE = { bg: '#eaf0f9', fg: '#1f3a63' }
const ALERTA = { bg: '#ffe0d9', fg: '#7c1405' }

export function tono(valor) {
  const v = String(valor || '').toLowerCase()
  if (/en_arriendo|en arriendo|en_servicio|en servicio|completad|vigente|activo|activa|hecho|cerrada/.test(v)) return FUERTE
  if (/disponible|programad|indefinido|planificada/.test(v)) return SUAVE
  return ALERTA
}

export function Badge({ children }) {
  const t = tono(children)
  return (
    <span style={{
      display: 'inline-block', font: '600 10px var(--font)', textTransform: 'uppercase',
      letterSpacing: '.06em', padding: '3px 8px', background: t.bg, color: t.fg,
    }}>{children}</span>
  )
}

// ── Formateadores ──────────────────────────────────────────────────────────
export const clp = (n) =>
  n === null || n === undefined || n === '' ? '—'
    : '$' + Number(n).toLocaleString('es-CL', { maximumFractionDigits: 0 })

export const millones = (n) => {
  const v = Number(n || 0)
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + 'M'
  if (Math.abs(v) >= 1e3) return '$' + Math.round(v / 1e3) + 'K'
  return '$' + v
}

// Las fechas sin hora ('2026-08-31') se leen como hora local para no correrse un día
const aFecha = (d) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00' : d)

export const fecha = (d) => {
  if (!d) return '—'
  const x = aFecha(d)
  if (isNaN(x)) return '—'
  return x.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const fechaHora = (d) => {
  if (!d) return '—'
  const x = new Date(d)
  if (isNaN(x)) return '—'
  return x.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' · ' + x.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export const mesLargo = (iso) => {
  if (!iso) return '—'
  const [y, m] = String(iso).split('-')
  return (MESES[Number(m) - 1] || '') + ' ' + y
}

// Cuadrícula determinista para dibujar el QR de una unidad.
export function qrCeldas(txt) {
  const n = 19, size = 8, off = 4, cells = []
  let h = 2166136261
  const s = String(txt || '')
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  const rnd = (i) => { const x = Math.imul(h ^ (i * 2654435761), 2246822519); return ((x >>> 8) & 1023) / 1023 }
  const finder = (cx, cy, x, y) => {
    const dx = x - cx, dy = y - cy
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) return null
    const r = Math.max(Math.abs(dx), Math.abs(dy))
    return r === 3 || r === 1 || r === 0
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let on = null
      ;[[3, 3], [n - 4, 3], [3, n - 4]].forEach((p) => {
        const f = finder(p[0], p[1], x, y); if (f !== null) on = f
      })
      if (on === null) on = rnd(y * n + x) > 0.5
      if (on) cells.push({ x: off + x * size, y: off + y * size })
    }
  }
  return cells
}
