import { useEffect, useId, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { C, Icon, I } from '../lib/ui'
import { useSesion, puedeVer, verMiRuta, verAdministracion, esOperador } from '../lib/sesion'
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
export const itemVisible = (perfil, ajustes, n) => (esOperador(perfil) ? !!(n.miRuta || n.sinAdmin) : true) && (!n.s || [].concat(n.s).some((x) => puedeVer(perfil, x)))
  && !(n.admin && !verAdministracion(perfil)) && !(n.sinAdmin && verAdministracion(perfil)) && !(n.miRuta && !verMiRuta(perfil, ajustes))

const item = (activo) => ({
  width: 'calc(100% - 20px)', margin: '3px 10px', display: 'flex', alignItems: 'center', gap: 12,
  padding: '11px 14px', boxSizing: 'border-box', border: 0, cursor: 'pointer', textAlign: 'left',
  background: activo ? 'var(--degradado)' : 'transparent',
  boxShadow: activo ? '0 6px 20px rgba(7,139,250,.35), inset 0 0 0 1px rgba(255,255,255,.12)' : 'none',
  color: activo ? '#fff' : '#9BAEC5',
  font: `${activo ? 600 : 500} 14px/1.2 var(--font)`, textDecoration: 'none', borderRadius: 10,
  transition: 'background .2s, color .2s',
})

// Marca FOSAN: "F" en degradado azul (también la usa el login)
export function MarcaFosan({ tam = 30, texto = true, tamTexto = 22 }) {
  const gid = 'fosan-f' + useId().replace(/:/g, '')   // id único: el menú lateral oculto no debe "robar" el degradado
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={tam} height={tam} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#18B8FF" /><stop offset="1" stopColor="#078BFA" />
          </linearGradient>
        </defs>
        <path d="M9 4h17l-3 6H14.5l-1.2 4H22l-3 6h-7.6L9 28H3z" fill={`url(#${gid})`} />
      </svg>
      {texto && <span style={{ font: `700 ${tamTexto}px/1 var(--font)`, letterSpacing: '.02em', color: '#F1F5FA' }}>FOSAN</span>}
    </span>
  )
}

export default function Sidebar({ onCalendario }) {
  const { perfil } = useSesion()
  const ajustes = useAjustes()
  const [enLinea, setEnLinea] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setEnLinea(true), off = () => setEnLinea(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return (
    <aside className="sidebar" style={{
      background: 'linear-gradient(180deg, #081426 0%, #06101F 100%)', color: '#fff', borderRight: '1px solid #12243B',
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
    }}>
      <div style={{ height: 72, padding: '0 20px', display: 'flex', alignItems: 'center' }}>
        <MarcaFosan />
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV.filter((n) => itemVisible(perfil, ajustes, n)).map((n, i) => {
          if (n.grupo) {
            return (
              <div key={n.grupo} style={{
                margin: i ? '10px 0 4px' : '0 0 4px', padding: '10px 20px 4px',
                font: '700 10px var(--font)', textTransform: 'uppercase', letterSpacing: '.08em', color: '#6B7F99',
              }}>{n.grupo}</div>
            )
          }
          if (n.calendario) {
            return (
              <button key="cal" onClick={onCalendario} style={item(false)}>
                <Icon d={n.d} size={18} w={1.7} /><span>{n.label}</span>
              </button>
            )
          }
          return (
            <NavLink key={n.to} to={n.to} end={n.fin} style={({ isActive }) => item(isActive)} className="nav-lateral">
              <Icon d={n.d} size={18} w={1.7} />
              <span>{n.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Estado de la conexión de este equipo (real: navigator.onLine) */}
      <div style={{ padding: '14px 20px 18px', borderTop: '1px solid #12243B', display: 'grid', gap: 4, font: '500 12px var(--font)', color: '#9BAEC5' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: enLinea ? '#00C98D' : '#EF4444', boxShadow: `0 0 8px ${enLinea ? '#00C98D' : '#EF4444'}` }} />
          {enLinea ? 'En línea' : 'Sin conexión'}
        </span>
        <span style={{ color: '#6B7F99' }}>FOSAN · gestión de operaciones</span>
      </div>
    </aside>
  )
}
