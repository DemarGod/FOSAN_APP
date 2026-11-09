// Barra inferior para pantallas angostas (celular o ventana minimizada, menos de 900 px).
// 4 accesos directos + "Menú", que abre todos los módulos del menú lateral según permisos.
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'
import { useSesion } from '../lib/sesion'
import { useAjustes } from '../lib/ajustes'
import { NAV, itemVisible } from './Sidebar'

const RUTA = 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6'
const MENU = 'M4 6h16M4 12h16M4 18h16'
const TABS = [
  { to: '/', label: 'Inicio', d: I.home, fin: true, s: 'inicio' },
  { to: '/clientes', label: 'Clientes', d: I.users, s: 'clientes' },
  { to: '/operaciones', label: 'Operaciones', d: RUTA, s: 'rutas' },
  { to: '/mi-ruta', label: 'Mi ruta', d: I.truck, miRuta: true },
]

export default function Tabbar() {
  const { perfil } = useSesion()
  const ajustes = useAjustes()
  const permitido = (p, n) => itemVisible(p, ajustes, n)
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState(false)
  useEffect(() => { setAbierto(false) }, [pathname])
  const tabs = TABS.filter((t) => permitido(perfil, t))
  // Módulos del menú lateral según permisos
  const items = NAV.filter((n) => permitido(perfil, n))
  const estilo = (activo) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 58,
    textDecoration: 'none', border: 0, cursor: 'pointer', background: activo ? C.tinte : 'var(--lateral)',
    color: activo ? '#7CC4FF' : '#CBD7E6', font: '400 10px var(--font)',
  })
  return (
    <>
      {abierto && (
        <div className="tabbar" onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(2,6,14,.7)' }}>
          <nav onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute', left: 0, right: 0, bottom: 60, maxHeight: '75vh', overflowY: 'auto',
            background: '#112038', borderRadius: '12px 12px 0 0', padding: '8px 0 12px',
          }}>
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.fin} style={({ isActive }) => item(isActive)}>
                <Icon d={n.d} size={18} w={1.7} /><span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <nav className="tabbar" style={{
        gridTemplateColumns: `repeat(${tabs.length + 1}, 1fr)`, position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--lateral)', borderTop: `1px solid ${C.borde}`, zIndex: 31,
      }}>
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.fin} style={({ isActive }) => estilo(isActive && !abierto)}>
            <Icon d={t.d} size={19} w={1.7} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setAbierto((x) => !x)} style={estilo(abierto)} aria-expanded={abierto}>
          <Icon d={MENU} size={19} w={1.7} />
          <span>Menú</span>
        </button>
      </nav>
    </>
  )
}

const item = (activo) => ({
  width: 'calc(100% - 16px)', margin: '2px 8px', display: 'flex', alignItems: 'center', gap: 12,
  padding: '12px 14px', boxSizing: 'border-box', border: 0, cursor: 'pointer', textAlign: 'left',
  background: activo ? 'var(--degradado)' : 'transparent', color: activo ? '#fff' : '#CBD7E6',
  font: `${activo ? 600 : 400} 15px/1.2 var(--font)`, textDecoration: 'none', borderRadius: 10,
})
