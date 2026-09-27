import { NavLink } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'

export const NAV = [
  { to: '/', label: 'Inicio', d: I.home, fin: true },
  { to: '/inventario', label: 'Inventario', d: I.box },
  { to: '/banos', label: 'Baños químicos', d: I.drop },
  { to: '/camiones', label: 'Camiones', d: I.truck },
  { to: '/clientes', label: 'Clientes', d: I.users },
  { to: '/utilidades', label: 'Utilidades y ventas', d: I.money },
  { to: '/mantenciones', label: 'Mantenciones', d: I.wrench },
  { to: '/ubicaciones', label: 'Ubicaciones', d: I.pin },
  { to: '/reportes', label: 'Reportes', d: I.chart },
  { to: '/configuracion', label: 'Configuración', d: I.gear },
]

export default function Sidebar() {
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
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.fin} style={({ isActive }) => ({
            width: '100%', display: 'flex', alignItems: 'center', gap: 11,
            padding: '10px 18px', boxSizing: 'border-box',
            background: isActive ? C.tinte : 'transparent',
            color: isActive ? '#1a3c72' : '#3c4551',
            font: '400 14px/1.2 var(--font)', textDecoration: 'none',
            borderLeft: `3px solid ${isActive ? C.navy : 'transparent'}`,
          })}>
            <Icon d={n.d} size={17} w={1.7} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
