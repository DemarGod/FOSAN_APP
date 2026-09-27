import { NavLink } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'

const DESPACHO = 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 4h5M8.5 1.5 11 4 8.5 6.5'
const RUTA = 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6'

export const NAV = [
  { to: '/', label: 'Inicio', d: I.home, fin: true },
  { to: '/clientes', label: 'Clientes', d: I.users },
  { grupo: 'Logística' },
  { to: '/banos', label: 'Baños químicos', d: I.drop },
  { to: '/transporte', label: 'Transporte', d: I.truck },
  { to: '/insumos', label: 'Insumos', d: I.box },
  { to: '/despachos', label: 'Despachos y retiros', d: DESPACHO },
  { to: '/rutas', label: 'Rutas', d: RUTA },
  { grupo: 'Gestión' },
  { to: '/mantenciones', label: 'Mantenciones', d: I.wrench },
  { to: '/ubicaciones', label: 'Mapa', d: I.pin },
  { calendario: true, label: 'Calendario', d: I.cal },
  { to: '/utilidades', label: 'Utilidades y ventas', d: I.money },
  { to: '/reportes', label: 'Reportes', d: I.chart },
  { to: '/configuracion', label: 'Configuración', d: I.gear },
]

const item = (activo) => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: 11,
  padding: '10px 18px', boxSizing: 'border-box', border: 0, cursor: 'pointer', textAlign: 'left',
  background: activo ? C.tinte : 'transparent',
  color: activo ? '#1a3c72' : '#3c4551',
  font: '400 14px/1.2 var(--font)', textDecoration: 'none',
  borderLeft: `3px solid ${activo ? C.navy : 'transparent'}`,
})

export default function Sidebar({ onCalendario }) {
  return (
    <aside className="sidebar" style={{
      background: '#fff', color: C.navy, borderRight: `2px solid ${C.borde}`,
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{
        height: 64, padding: '0 18px', borderBottom: `2px solid ${C.borde}`,
        display: 'flex', alignItems: 'center',
      }}>
        <span style={{ font: '800 32px/1 var(--font)', letterSpacing: '-.02em' }}>FOSAN</span>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {NAV.map((n, i) => {
          if (n.grupo) {
            return (
              <div key={n.grupo} style={{
                margin: i ? '10px 0 4px' : '0 0 4px', padding: '10px 18px 4px',
                borderTop: `2px solid ${C.borde}`, font: '700 10px var(--font)',
                textTransform: 'uppercase', letterSpacing: '.08em', color: C.gris,
              }}>{n.grupo}</div>
            )
          }
          if (n.calendario) {
            return (
              <button key="cal" onClick={onCalendario} style={item(false)}>
                <Icon d={n.d} size={17} w={1.7} /><span>{n.label}</span>
              </button>
            )
          }
          return (
            <NavLink key={n.to} to={n.to} end={n.fin} style={({ isActive }) => item(isActive)}>
              <Icon d={n.d} size={17} w={1.7} />
              <span>{n.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
