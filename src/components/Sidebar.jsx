import { NavLink } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'
import { useSesion, puedeVer, verMiRuta, verAdministracion } from '../lib/sesion'
import { useAjustes } from '../lib/ajustes'

const DESPACHO = 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM6 4h5M8.5 1.5 11 4 8.5 6.5'
const HISTORIAL = 'M12 21a9 9 0 1 0-9-9M3 4v5h5M12 7v5l3 2'
const RUTA = 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6'

// Orden del menú: Inicio · Clientes · Inventario · Operaciones · (Mi ruta) · Flota · Mantenimiento · Reportes · Administración.
// Sin títulos de grupo. El calendario se abre con el botón de la barra superior.
export const NAV = [
  { to: '/', label: 'Inicio', d: I.home, fin: true, s: 'inicio' },
  { to: '/clientes', label: 'Clientes', d: I.users, s: 'clientes' },
  // Inventario (lámina 3): Equipos · Insumos y EPP · Mapa
  { to: '/inventario', label: 'Inventario', d: I.box, s: ['banos', 'insumos', 'ubicaciones'] },
  // Operaciones (lámina 4): Programación · Rutas · Respaldos
  { to: '/operaciones', label: 'Operaciones', d: RUTA, s: 'rutas' },
  // Mi ruta: operadores siempre; el dueño solo si lo activa en Administración → Mi perfil
  { to: '/mi-ruta', label: 'Mi ruta', d: DESPACHO, miRuta: true },
  // Flota (lámina 5): vehículos por patente
  { to: '/flota', label: 'Flota', d: I.truck, s: 'transporte' },
  // Mantenimiento (lámina 6): equipos y vehículos
  { to: '/mantenimiento', label: 'Mantenimiento', d: I.wrench, s: 'mantenciones' },
  // Reportes (lámina 7): Inventario · Operaciones · Flota · Mantenimiento · Análisis
  { to: '/reportes', label: 'Reportes', d: I.chart, s: ['reportes', 'analisis'] },
  // Administración (lámina 8) + Mi perfil: dueño (todo) y secretaria (solo Mi perfil)
  { to: '/administracion', label: 'Administración', d: I.gear, admin: true },
  // Quien no ve Administración (operador, lectura…) tiene Mi perfil suelto
  { to: '/configuracion', label: 'Mi perfil', d: I.users, sinAdmin: true },
]

// ¿Este ítem del menú corresponde a este usuario?
export const itemVisible = (perfil, ajustes, n) => (!n.s || [].concat(n.s).some((x) => puedeVer(perfil, x)))
  && !(n.admin && !verAdministracion(perfil)) && !(n.sinAdmin && verAdministracion(perfil)) && !(n.miRuta && !verMiRuta(perfil, ajustes))

const item = (activo) => ({
  width: 'calc(100% - 16px)', margin: '2px 8px', display: 'flex', alignItems: 'center', gap: 11,
  padding: '10px 12px', boxSizing: 'border-box', border: 0, cursor: 'pointer', textAlign: 'left',
  background: activo ? '#2f6fdd' : 'transparent',
  color: activo ? '#fff' : '#c9d4e5',
  font: `${activo ? 600 : 400} 14px/1.2 var(--font)`, textDecoration: 'none', borderRadius: 4,
})

export default function Sidebar({ onCalendario }) {
  const { perfil } = useSesion()
  const ajustes = useAjustes()
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
        {NAV.filter((n) => itemVisible(perfil, ajustes, n)).map((n, i) => {
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
