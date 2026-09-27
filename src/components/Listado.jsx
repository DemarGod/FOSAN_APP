import { useMemo, useState } from 'react'
import { C, Icon, I, Badge } from '../lib/ui'

export function Cargando({ children = 'Cargando…' }) {
  return <div style={{ padding: 24, font: '400 13px var(--font)', color: C.gris }}>{children}</div>
}

export function Aviso({ error }) {
  if (!error) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      background: '#fce8e6', border: `2px solid ${C.rojo}`, margin: '0 0 16px',
      font: '400 12px/1.45 var(--font)', color: '#7c1405',
    }}>
      <Icon d={I.alert} size={17} color={C.rojo} />
      <span>{String(error.message || error)}</span>
    </div>
  )
}

function iconoKpi(l) {
  const x = (l || '').toLowerCase()
  if (/fuera de servicio|baja|urgente/.test(x)) return { d: I.alert, color: C.rojo }
  if (/manten/.test(x)) return { d: I.gear, color: C.amarillo }
  if (/disponible|operativ|realizad|complet/.test(x)) return { d: I.check, color: C.verde }
  if (/arriendo|en servicio|activ|próxim|proxim/.test(x)) return { d: I.clip, color: C.azul }
  if (/limpieza|servicio/.test(x)) return { d: I.drop, color: C.azul }
  if (/total/.test(x)) return { d: I.cabina, color: C.navy }
  return { d: '', color: C.gris }
}

export function Kpis({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="kpis" style={{
      gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`, gap: 2,
      background: C.borde, border: `2px solid ${C.borde}`, margin: '18px 0',
    }}>
      {items.map((k) => {
        const ic = iconoKpi(k.l)
        return (
          <div key={k.l} style={{ background: '#fff', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ font: '800 19px/1 var(--font)', letterSpacing: '-.03em' }}>{k.v}</div>
              {ic.d && <Icon d={ic.d} size={18} color={ic.color} />}
            </div>
            <div style={{
              font: '400 10px/1.3 var(--font)', color: C.gris, marginTop: 5,
              textTransform: 'uppercase', letterSpacing: '.05em',
            }}>{k.l}</div>
          </div>
        )
      })}
    </div>
  )
}

const PAGINA = 25

export default function Listado({
  titulo, bajada, accion, exportar, segmentos, kpis = [], cols = [], datos = [],
  filtros = [], buscar = [], onFila, acciones, cargando, error, nota, unidad = 'registros',
  busquedaInicial = '',
}) {
  const [f, setF] = useState({})
  const [q, setQ] = useState(busquedaInicial)
  const [pag, setPag] = useState(0)

  const opciones = useMemo(() => {
    const o = {}
    filtros.forEach((ft) => {
      o[ft.k] = [...new Set(datos.map((d) => d[ft.k]).filter((v) => v !== null && v !== undefined && v !== ''))].sort()
    })
    return o
  }, [datos, filtros])

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase()
    return datos.filter((d) => {
      for (const k of Object.keys(f)) {
        if (f[k] && String(d[k]) !== f[k]) return false
      }
      if (!texto) return true
      const campos = buscar.length ? buscar : cols.map((c) => c.k)
      return campos.some((k) => String(d[k] ?? '').toLowerCase().includes(texto))
    })
  }, [datos, f, q, buscar, cols])

  const paginas = Math.max(1, Math.ceil(visibles.length / PAGINA))
  const pagina = Math.min(pag, paginas - 1)
  const trozo = visibles.slice(pagina * PAGINA, pagina * PAGINA + PAGINA)

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 6,
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{titulo}</h2>
          {bajada && <p className="text-muted" style={{ margin: 0 }}>{bajada}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {exportar && (
            <button className="btn" onClick={exportar}>
              <Icon d={I.descarga} size={16} />
              <span>Exportar a Excel</span>
            </button>
          )}
          {accion && (
            <button className="btn btn-verde" onClick={accion.onClick} disabled={accion.disabled}
              title={accion.disabled ? 'Tu usuario es de solo lectura' : ''}>
              {accion.label}
            </button>
          )}
        </div>
      </div>

      {segmentos && (
        <div style={{
          display: 'flex', gap: 2, marginTop: 16, border: `2px solid ${C.borde}`,
          width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap',
        }}>
          {segmentos.opciones.map((s) => {
            const on = segmentos.valor === s.v
            return (
              <button key={s.v} onClick={() => { segmentos.onChange(s.v); setPag(0) }} style={{
                border: 0, background: on ? C.tinte : '#fff', color: on ? '#1a3c72' : '#3c4551',
                font: '600 13px var(--font)', padding: '10px 16px', minHeight: 42,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {s.d && <Icon d={s.d} size={16} />}
                <span>{s.l}</span>
              </button>
            )
          })}
        </div>
      )}

      <Kpis items={kpis} />
      <Aviso error={error} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {filtros.map((ft) => (
          <select key={ft.k} value={f[ft.k] || ''}
            onChange={(e) => { setF((p) => ({ ...p, [ft.k]: e.target.value })); setPag(0) }}
            style={{
              border: `2px solid ${C.borde}`, background: '#fff', color: C.navy,
              font: '600 13px var(--font)', padding: '9px 12px', minHeight: 42,
              cursor: 'pointer', outline: 'none',
            }}>
            <option value="">{ft.label}: todos</option>
            {(opciones[ft.k] || []).map((o) => (
              <option key={o} value={o}>{ft.etiqueta ? ft.etiqueta(o) : o}</option>
            ))}
          </select>
        ))}
        <div style={{
          flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 9,
          border: `2px solid ${C.borde}`, background: '#fff', padding: '0 12px', minHeight: 42,
        }}>
          <Icon d={I.busca} size={16} color={C.gris} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPag(0) }}
            placeholder="Buscar en esta tabla"
            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: '400 13px var(--font)' }} />
        </div>
      </div>

      <div className="scroller" style={{ border: `2px solid ${C.borde}`, background: '#fff' }}>
        <table style={{ minWidth: 640 }}>
          <thead>
            <tr>
              {cols.map((c) => <th key={c.k}>{c.label}</th>)}
              {acciones && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={cols.length + (acciones ? 1 : 0)} style={{ color: C.gris }}>Cargando…</td></tr>
            )}
            {!cargando && trozo.length === 0 && (
              <tr><td colSpan={cols.length + (acciones ? 1 : 0)} style={{ color: C.gris }}>
                No hay {unidad} que coincidan con este filtro.
              </td></tr>
            )}
            {trozo.map((d, i) => (
              <tr key={d.id || i} onClick={() => onFila && onFila(d)}
                style={{ cursor: onFila ? 'pointer' : 'default' }}>
                {cols.map((c, ci) => (
                  <td key={c.k} style={{ whiteSpace: 'nowrap', fontWeight: ci === 0 ? 600 : 400 }}>
                    {c.badge
                      ? <Badge>{c.render ? c.render(d) : d[c.k]}</Badge>
                      : (c.render ? c.render(d) : (d[c.k] ?? '—'))}
                  </td>
                ))}
                {acciones && (
                  <td style={{ whiteSpace: 'nowrap', padding: '8px 14px' }}>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {acciones(d).map((a, k) => (
                        <button key={k} title={a.t} disabled={a.disabled}
                          onClick={(e) => { e.stopPropagation(); a.onClick() }}
                          style={{
                            height: 34, minWidth: 34, padding: a.label ? '0 10px' : 0,
                            border: `2px solid ${a.borde || C.borde}`, background: a.bg || '#fff',
                            color: a.color || C.navy, cursor: a.disabled ? 'not-allowed' : 'pointer',
                            opacity: a.disabled ? .45 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            font: '600 11px var(--font)', whiteSpace: 'nowrap',
                          }}>
                          <Icon d={a.d} size={16} />
                          {a.label && <span>{a.label}</span>}
                        </button>
                      ))}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 2px', font: '400 12px var(--font)', color: C.gris, gap: 12, flexWrap: 'wrap',
      }}>
        <span>
          {nota || `Mostrando ${trozo.length} de ${visibles.length} ${unidad}`}
        </span>
        {paginas > 1 && (
          <span style={{ display: 'flex', gap: 2 }}>
            {Array.from({ length: paginas }, (_, i) => (
              <button key={i} onClick={() => setPag(i)} style={{
                padding: '5px 10px', cursor: 'pointer',
                border: i === pagina ? 0 : `1px solid ${C.borde}`,
                background: i === pagina ? C.navy : '#fff',
                color: i === pagina ? '#eef2f9' : C.tinta,
                fontWeight: i === pagina ? 600 : 400, font: '400 12px var(--font)',
              }}>{i + 1}</button>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}
