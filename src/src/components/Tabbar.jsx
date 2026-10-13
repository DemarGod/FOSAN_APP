import { NavLink } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'
import { useSesion, puedeVer } from '../lib/sesion'

const TABS = [
  { to: '/', label: 'Inicio', d: I.home, fin: true, s: 'inicio' },
  { to: '/clientes', label: 'Clientes', d: I.users, s: 'clientes' },
  { to: '/despachos', label: 'Despachos', d: I.truck, s: 'despachos' },
  { to: '/rutas', label: 'Rutas', d: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6', s: 'rutas' },
  { to: '/banos', label: 'Baños', d: I.drop, s: 'banos' },
]

export default function Tabbar() {
  const { perfil } = useSesion()
  const tabs = TABS.filter((t) => puedeVer(perfil, t.s))
  return (
    <nav className="tabbar" style={{
      gridTemplateColumns: `repeat(${tabs.length || 1}, 1fr)`, position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: `2px solid ${C.borde}`, zIndex: 20,
    }}>
      {tabs.map((t) => (
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
