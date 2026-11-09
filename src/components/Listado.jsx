import { C, Icon, I } from '../lib/ui'

export function Cargando({ children = 'Cargando…' }) {
  return <div style={{ padding: 24, font: '400 13px var(--font)', color: C.gris }}>{children}</div>
}

export function Aviso({ error }) {
  if (!error) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      background: '#fce8e6', border: `1px solid ${C.rojo}`, margin: '0 0 16px',
      font: '400 12px/1.45 var(--font)', color: '#7c1405', borderRadius: 'var(--radio-md)' }}>
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
      background: C.borde, border: `1px solid ${C.borde}`, margin: '18px 0', borderRadius: 'var(--radio-md)' }}>
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

