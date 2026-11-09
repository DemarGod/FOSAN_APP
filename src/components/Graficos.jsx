// Gráficos simples en SVG para el Inicio (sin librerías).
// Reglas: marcas finas con extremos redondeados, eje Y único, cuadrícula suave, leyenda siempre que hay ≥ 2 series,
// valores con color de texto (no del color de la serie), tooltip al pasar el mouse y opción "Ver tabla" en cada tarjeta.
// Colores categóricos validados (orden fijo): azul FOSAN, naranja, aqua, amarillo, magenta.
import { useState } from 'react'
import { C } from '../lib/ui'

export const SERIE = ['#2f6fdd', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
const n = (x) => Number(x || 0).toLocaleString('es-CL')

// Tarjeta de gráfico: título, subtítulo, acción "Ver tabla" y el contenido
export function TarjetaGrafico({ titulo, sub, tabla, children, accion }) {
  const [verTabla, setVerTabla] = useState(false)
  return (
    <section className="card" style={{ padding: 16, display: 'grid', gap: 10, alignContent: 'start', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ font: '700 15px var(--font)', color: C.tinta }}>{titulo}</b>
          {sub && <div style={{ font: '400 12px var(--font)', color: C.gris }}>{sub}</div>}
        </div>
        {accion}
        {tabla && (
          <button type="button" onClick={() => setVerTabla((x) => !x)}
            style={{ border: 0, background: 'transparent', color: C.azul, cursor: 'pointer', font: '600 12px var(--font)', whiteSpace: 'nowrap' }}>
            {verTabla ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        )}
      </div>
      {verTabla && tabla ? <TablaSimple {...tabla} /> : children}
    </section>
  )
}

function TablaSimple({ columnas, filas }) {
  return (
    <div className="scroller">
      <table style={{ fontSize: 13 }}>
        <thead><tr>{columnas.map((c, i) => <th key={c} style={{ textAlign: i ? 'right' : 'left' }}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((f, i) => <tr key={i}>{f.map((x, j) => <td key={j} style={{ textAlign: j ? 'right' : 'left' }}>{typeof x === 'number' ? n(x) : x}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function Leyenda({ items }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', font: '400 12px var(--font)', color: C.gris }}>
      {items.map((it) => (
        <span key={it.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: it.c, display: 'inline-block' }} />{it.l}
        </span>
      ))}
    </div>
  )
}

// Tooltip flotante dentro de la tarjeta
function useTip() {
  const [tip, setTip] = useState(null)
  const mostrar = (e, texto) => {
    const r = e.currentTarget.ownerSVGElement.getBoundingClientRect()
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, texto })
  }
  const Tip = () => (tip ? (
    <div style={{ position: 'absolute', left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)', pointerEvents: 'none',
      background: '#13294b', color: '#fff', padding: '6px 9px', borderRadius: 6, font: '600 12px/1.35 var(--font)', whiteSpace: 'pre', zIndex: 5 }}>{tip.texto}</div>
  ) : null)
  return { mostrar, ocultar: () => setTip(null), Tip }
}

const escala = (max) => {
  if (max <= 0) return { tope: 4, pasos: [0, 1, 2, 3, 4] }
  const p = Math.pow(10, Math.floor(Math.log10(max))), m = max / p
  const paso = (m <= 2 ? 0.5 : m <= 5 ? 1 : 2) * p
  const tope = Math.ceil(max / paso) * paso
  return { tope, pasos: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => +(i * paso).toFixed(6)) }
}
const corto = (v) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M` : v >= 1e3 ? `${(v / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 0 })} mil` : n(v))

// Barras verticales agrupadas: etiquetas (eje X) y series [{ l, c, datos: [] }]
export function Barras({ etiquetas, series, alto = 210, fmt = n, onBarra }) {
  const { mostrar, ocultar, Tip } = useTip()
  const ancho = 520, izq = 52, abajo = 30, arriba = 10
  const max = Math.max(0, ...series.flatMap((s) => s.datos.map(Number)))
  const { tope, pasos } = escala(max)
  const h = alto - abajo - arriba, grupo = (ancho - izq - 8) / etiquetas.length
  const bw = Math.min(26, (grupo * 0.7) / series.length)
  const y = (v) => arriba + h - (Number(v) / tope) * h
  return (
    <div style={{ position: 'relative' }}>
      {series.length > 1 && <Leyenda items={series} />}
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6 }} onMouseLeave={ocultar}>
        {pasos.map((p) => (
          <g key={p}>
            <line x1={izq} x2={ancho - 4} y1={y(p)} y2={y(p)} stroke={C.fila} strokeWidth={1} />
            <text x={izq - 6} y={y(p) + 4} textAnchor="end" fontSize="13" fill={C.gris} style={{ fontFamily: "var(--font)" }}>{corto(p)}</text>
          </g>
        ))}
        {etiquetas.map((et, i) => {
          const x0 = izq + i * grupo + (grupo - bw * series.length - 2 * (series.length - 1)) / 2
          return (
            <g key={et}>
              {series.map((s, j) => {
                const v = Number(s.datos[i] || 0), top = y(v), alt = Math.max(0, arriba + h - top)
                const x = x0 + j * (bw + 2), r = Math.min(4, bw / 2, alt)
                return (
                  <g key={s.l} style={{ cursor: onBarra ? 'pointer' : 'default' }} onClick={onBarra ? () => onBarra(i, j) : undefined}
                    onMouseMove={(e) => mostrar(e, `${et}\n${s.l}: ${fmt(v)}`)}>
                    <rect x={x - 3} y={arriba} width={bw + 6} height={h} fill="transparent" />
                    {alt > 0 && <path d={`M${x},${arriba + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${arriba + h} Z`} fill={s.c} />}
                  </g>
                )
              })}
              <text x={izq + i * grupo + grupo / 2} y={alto - 8} textAnchor="middle" fontSize="14" fill={C.gris} style={{ fontFamily: "var(--font)" }}>{et}</text>
            </g>
          )
        })}
        <line x1={izq} x2={ancho - 4} y1={arriba + h} y2={arriba + h} stroke={C.borde} strokeWidth={1} />
      </svg>
      <Tip />
    </div>
  )
}

// Barras horizontales con etiqueta y valor: items [{ l, v, c?, onClick? }]
export function BarrasH({ items, color = SERIE[0], fmt = n, vacio = 'Sin datos.' }) {
  const max = Math.max(1, ...items.map((i) => Number(i.v)))
  if (!items.length) return <div style={{ color: C.gris, padding: '18px 0', font: '400 13px var(--font)' }}>{vacio}</div>
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((it) => (
        <button key={it.l} type="button" onClick={it.onClick} title={`${it.l}: ${fmt(it.v)}`}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 38%) 1fr auto', alignItems: 'center', gap: 10, border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: it.onClick ? 'pointer' : 'default' }}>
          <span style={{ font: '400 13px var(--font)', color: C.tinta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.l}</span>
          <span style={{ height: 14, background: C.fila, borderRadius: 4, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(Number(it.v) / max) * 100}%`, minWidth: Number(it.v) ? 4 : 0, background: it.c || color, borderRadius: 4 }} />
          </span>
          <b style={{ font: '700 13px var(--font)', color: C.tinta, minWidth: 28, textAlign: 'right' }}>{fmt(it.v)}</b>
        </button>
      ))}
    </div>
  )
}

// Dona con total al centro y leyenda con valor y %: partes [{ l, v, c, onClick? }]
export function Dona({ partes, centro, sub }) {
  const { mostrar, ocultar, Tip } = useTip()
  const total = partes.reduce((s, p) => s + Number(p.v), 0)
  const R = 70, r = 46, cx = 80, cy = 80
  let ang = -Math.PI / 2
  const arcos = total ? partes.filter((p) => Number(p.v) > 0).map((p) => {
    const a = (Number(p.v) / total) * Math.PI * 2, a0 = ang, a1 = ang + a - (partes.length > 1 ? 0.02 : 0)
    ang += a
    const pt = (rad, t) => [cx + rad * Math.cos(t), cy + rad * Math.sin(t)]
    const grande = a1 - a0 > Math.PI ? 1 : 0
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0)
    const d = a >= Math.PI * 2 - 0.001
      ? `M${cx - R},${cy} a${R},${R} 0 1,0 ${2 * R},0 a${R},${R} 0 1,0 ${-2 * R},0 M${cx - r},${cy} a${r},${r} 0 1,1 ${2 * r},0 a${r},${r} 0 1,1 ${-2 * r},0`
      : `M${x0},${y0} A${R},${R} 0 ${grande},1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${grande},0 ${x3},${y3} Z`
    return { ...p, d }
  }) : []
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
      <svg viewBox="0 0 160 160" style={{ width: 150, height: 150, flex: 'none' }} onMouseLeave={ocultar}>
        {!total && <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={C.fila} strokeWidth={R - r} />}
        {arcos.map((a) => (
          <path key={a.l} d={a.d} fill={a.c} fillRule="evenodd" style={{ cursor: a.onClick ? 'pointer' : 'default' }} onClick={a.onClick}
            onMouseMove={(e) => mostrar(e, `${a.l}: ${n(a.v)} (${Math.round((100 * a.v) / total)} %)`)} />
        ))}
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="22" fontWeight="800" fill={C.tinta} style={{ fontFamily: "var(--font)" }}>{centro ?? n(total)}</text>
        {sub && <text x={cx} y={cy + 18} textAnchor="middle" fontSize="13" fill={C.gris} style={{ fontFamily: "var(--font)" }}>{sub}</text>}
      </svg>
      <div style={{ display: 'grid', gap: 7, flex: '1 1 140px' }}>
        {partes.map((p) => (
          <button key={p.l} type="button" onClick={p.onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', padding: 0, cursor: p.onClick ? 'pointer' : 'default', font: '400 13px var(--font)', color: C.tinta, textAlign: 'left' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.c, flex: 'none' }} />
            <span style={{ flex: 1 }}>{p.l}</span>
            <b>{n(p.v)}</b>
            <span style={{ color: C.gris, width: 38, textAlign: 'right' }}>{total ? `${Math.round((100 * p.v) / total)} %` : '—'}</span>
          </button>
        ))}
      </div>
      <Tip />
    </div>
  )
}
