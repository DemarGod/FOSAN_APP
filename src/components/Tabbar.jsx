import { NavLink } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'

const TABS = [
  { to: '/', label: 'Inicio', d: I.home, fin: true },
  { to: '/clientes', label: 'Clientes', d: I.users },
  { to: '/despachos', label: 'Despachos', d: I.truck },
  { to: '/rutas', label: 'Rutas', d: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6' },
  { to: '/banos', label: 'Baños', d: I.drop },
]

export default function Tabbar() {
  return (
    <nav className="tabbar" style={{
      gridTemplateColumns: 'repeat(5, 1fr)', position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: `2px solid ${C.borde}`, zIndex: 20,
    }}>
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.fin} style={({ isActive }) => ({
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 4, minHeight: 58, textDecoration: 'none',
          background: isActive ? C.tinte : '#fff',
          color: isActive ? '#1a3c72' : '#3c4551',
          font: '400 10px var(--font)',
        })}>
          <Icon d={t.d} size={19} w={1.7} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
