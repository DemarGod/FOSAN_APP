// Gráficos simples en SVG para el Inicio (sin librerías).
// Reglas: marcas finas con extremos redondeados, eje Y único, cuadrícula suave, leyenda siempre que hay ≥ 2 series,
// valores con color de texto (no del color de la serie), tooltip al pasar el mouse y opción "Ver tabla" en cada tarjeta.
// Colores categóricos para fondo oscuro (orden fijo): azul eléctrico, coral, verde, ámbar, rosa.
// Barras con degradado, cuadrícula discreta, tooltip oscuro con borde azul y animación suave al cargar.
import { useId, useState } from 'react'
import { C } from '../lib/ui'

export const SERIE = ['#078BFA', '#FF6B4A', '#00C98D', '#F59E0B', '#F472B6']
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
      background: 'rgba(5,11,22,.95)', color: '#F1F5FA', border: '1px solid rgba(24,184,255,.55)', boxShadow: '0 8px 24px rgba(0,0,0,.5), 0 0 12px rgba(7,139,250,.25)',
      padding: '7px 10px', borderRadius: 8, font: '600 12px/1.4 var(--font)', whiteSpace: 'pre', zIndex: 5 }}>{tip.texto}</div>
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
// Degradado vertical de una barra: del color de la serie (abajo) a una versión luminosa (arriba)
const luminoso = (c) => (c?.toUpperCase() === '#078BFA' ? '#18B8FF' : c)
function DefsDegradado({ id, series }) {
  return (
    <defs>
      {series.map((s, j) => (
        <linearGradient key={j} id={`${id}-${j}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={s.c} stopOpacity=".85" />
          <stop offset="1" stopColor={luminoso(s.c)} stopOpacity="1" />
        </linearGradient>
      ))}
    </defs>
  )
}

export function Barras({ etiquetas, series, alto = 210, fmt = n, onBarra }) {
  const { mostrar, ocultar, Tip } = useTip()
  const gid = 'gb' + useId().replace(/:/g, '')
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
        <DefsDegradado id={gid} series={series} />
        {pasos.map((p) => (
          <g key={p}>
            <line x1={izq} x2={ancho - 4} y1={y(p)} y2={y(p)} stroke="rgba(155,174,197,.12)" strokeWidth={1} strokeDasharray="3 4" />
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
                    {alt > 0 && <path className="g-barra" style={{ animationDelay: `${i * 40}ms` }}
                      d={`M${x},${arriba + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${arriba + h} Z`} fill={`url(#${gid}-${j})`} />}
                  </g>
                )
              })}
              <text x={izq + i * grupo + grupo / 2} y={alto - 8} textAnchor="middle" fontSize="14" fill={C.gris} style={{ fontFamily: "var(--font)" }}>{et}</text>
            </g>
          )
        })}
        <line x1={izq} x2={ancho - 4} y1={arriba + h} y2={arriba + h} stroke="rgba(155,174,197,.25)" strokeWidth={1} />
      </svg>
      <Tip />
    </div>
  )
}

// Líneas con área (estilo de las tarjetas KPI): líneas luminosas de 2,5 px, área con degradado transparente,
// guía vertical y puntos al pasar el mouse, tooltip con todas las series. series [{ l, c, datos: [] }]
const curva = (p) => {
  // Curva suave que pasa por todos los puntos sin "pasarse" por debajo de 0 (monótona por tramos)
  if (p.length < 2) return ''
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[i + 1], mx = (x0 + x1) / 2
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`
  }
  return d
}
export function Lineas({ etiquetas, series, alto = 210, fmt = n, onPunto }) {
  const [sel, setSel] = useState(null)
  const gid = 'gl' + useId().replace(/:/g, '')
  const ancho = 520, izq = 52, der = 14, abajo = 30, arriba = 14
  const max = Math.max(0, ...series.flatMap((s) => s.datos.map(Number)))
  const { tope, pasos } = escala(max)
  const h = alto - abajo - arriba, paso = (ancho - izq - der) / Math.max(1, etiquetas.length - 1)
  const X = (i) => izq + i * paso
  const Y = (v) => arriba + h - (Number(v) / tope) * h
  const pts = series.map((s) => etiquetas.map((_, i) => [X(i), Y(s.datos[i] || 0)]))
  const mover = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * ancho
    setSel(Math.max(0, Math.min(etiquetas.length - 1, Math.round((x - izq) / paso))))
  }
  return (
    <div style={{ position: 'relative' }}>
      {series.length > 1 && <Leyenda items={series} />}
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6, cursor: onPunto ? 'pointer' : 'crosshair' }}
        onMouseMove={mover} onMouseLeave={() => setSel(null)} onClick={onPunto && sel != null ? () => onPunto(sel) : undefined}>
        <defs>
          {series.map((s, j) => (
            <linearGradient key={j} id={`${gid}-${j}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.c} stopOpacity={j === 0 ? '.38' : '.22'} />
              <stop offset="1" stopColor={s.c} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {pasos.map((p) => (
          <g key={p}>
            <line x1={izq} x2={ancho - der} y1={Y(p)} y2={Y(p)} stroke="rgba(155,174,197,.12)" strokeWidth={1} strokeDasharray="3 4" />
            <text x={izq - 8} y={Y(p) + 4} textAnchor="end" fontSize="13" fill={C.gris} style={{ fontFamily: 'var(--font)' }}>{corto(p)}</text>
          </g>
        ))}
        {etiquetas.map((et, i) => (
          <text key={et + i} x={X(i)} y={alto - 8} textAnchor="middle" fontSize="14" fill={sel === i ? C.tinta : C.gris} style={{ fontFamily: 'var(--font)' }}>{et}</text>
        ))}
        {sel != null && <line x1={X(sel)} x2={X(sel)} y1={arriba} y2={arriba + h} stroke="rgba(24,184,255,.45)" strokeWidth={1} strokeDasharray="4 4" />}
        {/* Áreas primero (abajo) y luego las líneas */}
        {series.map((s, j) => (
          <path key={'a' + j} className="g-arco" d={`${curva(pts[j])} L${X(etiquetas.length - 1)},${arriba + h} L${X(0)},${arriba + h} Z`} fill={`url(#${gid}-${j})`} />
        ))}
        {series.map((s, j) => (
          <path key={'l' + j} className="g-linea" d={curva(pts[j])} fill="none" stroke={s.c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
            pathLength="1" style={{ filter: `drop-shadow(0 0 5px ${s.c}aa)`, animationDelay: `${j * 120}ms` }} />
        ))}
        {/* Último punto destacado y puntos del mes elegido */}
        {series.map((s, j) => {
          const [x, y] = pts[j][pts[j].length - 1]
          return <circle key={'u' + j} cx={x} cy={y} r="3.5" fill={s.c} style={{ filter: `drop-shadow(0 0 5px ${s.c})` }} />
        })}
        {sel != null && series.map((s, j) => (
          <circle key={'p' + j} cx={pts[j][sel][0]} cy={pts[j][sel][1]} r="5" fill="#050B16" stroke={s.c} strokeWidth="2.5" />
        ))}
      </svg>
      {sel != null && (
        <div style={{ position: 'absolute', left: `${(X(sel) / ancho) * 100}%`, top: 24, transform: `translateX(${sel > etiquetas.length / 2 ? 'calc(-100% - 12px)' : '12px'})`, pointerEvents: 'none',
          background: 'rgba(5,11,22,.95)', color: '#F1F5FA', border: '1px solid rgba(24,184,255,.55)', boxShadow: '0 8px 24px rgba(0,0,0,.5), 0 0 12px rgba(7,139,250,.25)',
          padding: '8px 11px', borderRadius: 8, font: '600 12px/1.5 var(--font)', whiteSpace: 'nowrap', zIndex: 5 }}>
          <div style={{ color: C.gris, fontWeight: 500 }}>{etiquetas[sel]}</div>
          {series.map((s) => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.c }} />{s.l}: {fmt(s.datos[sel] || 0)}
            </div>
          ))}
        </div>
      )}
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
          <span style={{ height: 10, background: 'rgba(155,174,197,.10)', borderRadius: 999, overflow: 'hidden' }}>
            <span className="g-barra-h" style={{ display: 'block', height: '100%', width: `${(Number(it.v) / max) * 100}%`, minWidth: Number(it.v) ? 6 : 0, borderRadius: 999,
              background: `linear-gradient(90deg, ${it.c || color}, ${luminoso(it.c || color)})`, boxShadow: `0 0 10px ${(it.c || color)}55` }} />
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
        <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke="rgba(155,174,197,.08)" strokeWidth={R - r} />
        {arcos.map((a, k) => (
          <path key={a.l} className="g-arco" d={a.d} fill={a.c} fillRule="evenodd" style={{ cursor: a.onClick ? 'pointer' : 'default', animationDelay: `${k * 80}ms`, filter: `drop-shadow(0 0 4px ${a.c}66)` }} onClick={a.onClick}
            onMouseMove={(e) => mostrar(e, `${a.l}: ${n(a.v)} (${Math.round((100 * a.v) / total)} %)`)} />
        ))}
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="24" fontWeight="700" fill={C.tinta} style={{ fontFamily: "var(--font)" }}>{centro ?? n(total)}</text>
        {sub && <text x={cx} y={cy + 18} textAnchor="middle" fontSize="13" fill={C.gris} style={{ fontFamily: "var(--font)" }}>{sub}</text>}
      </svg>
      <div style={{ display: 'grid', gap: 7, flex: '1 1 140px' }}>
        {partes.map((p) => (
          <button key={p.l} type="button" onClick={p.onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', padding: 0, cursor: p.onClick ? 'pointer' : 'default', font: '400 13px var(--font)', color: C.tinta, textAlign: 'left' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.c, flex: 'none', boxShadow: `0 0 6px ${p.c}88` }} />
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

// Mini tendencia (sparkline) para las tarjetas de indicadores. Solo se usa con datos históricos reales.
export function Sparkline({ datos = [], color = '#18B8FF', ancho = 96, alto = 34, titulo }) {
  const gid = 'sp' + useId().replace(/:/g, '')
  const v = datos.map(Number)
  if (v.length < 2 || v.every((x) => !x)) return null
  const max = Math.max(...v), min = Math.min(0, ...v), rango = max - min || 1
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (ancho - 4) + 2, alto - 3 - ((x - min) / rango) * (alto - 8)])
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-label={titulo} role="img" style={{ display: 'block' }}>
      {titulo && <title>{titulo}</title>}
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linea} L${pts[pts.length - 1][0]},${alto} L${pts[0][0]},${alto} Z`} fill={`url(#${gid})`} />
      <path d={linea} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill={color} />
    </svg>
  )
}
