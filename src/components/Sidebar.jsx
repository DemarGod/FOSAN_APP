import { NavLink } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'
import { useSesion, puedeVer } from '../lib/sesion'

const DESPACHO = 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 4h5M8.5 1.5 11 4 8.5 6.5'
const HISTORIAL = 'M12 21a9 9 0 1 0-9-9M3 4v5h5M12 7v5l3 2'
const RUTA = 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6'

export const NAV = [
  { to: '/', label: 'Inicio', d: I.home, fin: true, s: 'inicio' },
  { to: '/clientes', label: 'Clientes', d: I.users, s: 'clientes' },
  { grupo: 'Logística' },
  { to: '/banos', label: 'Baños químicos', d: I.drop, s: 'banos' },
  { to: '/transporte', label: 'Transporte', d: I.truck, s: 'transporte' },
  { to: '/insumos', label: 'Insumos', d: I.box, s: 'insumos' },
  { to: '/rutas-semanales', label: 'Rutas semanales', d: RUTA, s: 'rutas' },
  { to: '/mi-ruta', label: 'Mi ruta', d: DESPACHO },
  { grupo: 'Gestión' },
  { to: '/mantenciones', label: 'Mantenciones', d: I.wrench, s: 'mantenciones' },
  { to: '/ubicaciones', label: 'Mapa', d: I.pin, s: 'ubicaciones' },
  { calendario: true, label: 'Calendario', d: I.cal, s: 'calendario' },
  { to: '/reportes', label: 'Reportes', d: I.chart, s: 'reportes' },
  { to: '/analisis', label: 'Análisis', d: 'M3 3v18h18M7 15l4-4 3 3 5-6', s: 'analisis' },
  { to: '/historial', label: 'Historial de cambios', d: HISTORIAL, s: 'historial' },
  { to: '/configuracion', label: 'Configuración', d: I.gear },
]

const item = (activo) => ({
  width: 'calc(100% - 16px)', margin: '2px 8px', display: 'flex', alignItems: 'center', gap: 11,
  padding: '10px 12px', boxSizing: 'border-box', border: 0, cursor: 'pointer', textAlign: 'left',
  background: activo ? '#2f6fdd' : 'transparent',
  color: activo ? '#fff' : '#c9d4e5',
  font: `${activo ? 600 : 400} 14px/1.2 var(--font)`, textDecoration: 'none', borderRadius: 4,
})

export default function Sidebar({ onCalendario }) {
  const { perfil } = useSesion()
  return (
    <aside className="sidebar" style={{
      background: '#13294b', color: '#fff', borderRight: 0,
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{
        height: 64, padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,.12)',
        display: 'flex', alignItems: 'center',
      }}>
        <span style={{ font: '800 32px/1 var(--font)', letterSpacing: '-.02em' }}>FOSAN</span>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {NAV.filter((n) => !n.s || puedeVer(perfil, n.s)).map((n, i) => {
          if (n.grupo) {
            return (
              <div key={n.grupo} style={{
                margin: i ? '10px 0 4px' : '0 0 4px', padding: '10px 18px 4px',
                borderTop: '1px solid rgba(255,255,255,.12)', font: '700 10px var(--font)',
                textTransform: 'uppercase', letterSpacing: '.08em', color: '#8fa3c2',
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
