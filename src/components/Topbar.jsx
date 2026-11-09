import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { notificaciones, marcarLeidas, avisosCalculados, buscarGlobal } from '../lib/api'
import { NAV, MarcaFosan } from './Sidebar'
import { C, Icon, I, fechaHora } from '../lib/ui'
import { nombreRol, esOperador } from '../lib/sesion'

const NIVEL = {
  alerta: { color: C.rojo, tint: 'rgba(239,68,68,.2)', d: I.alert },
  aviso: { color: C.amarillo, tint: 'rgba(245,158,11,.2)', d: I.wrench },
  info: { color: C.azul, tint: C.tinte, d: I.info },
}

const CLAVE = 'fosan_avisos_leidos'
const leidosLocal = () => { try { return new Set(JSON.parse(localStorage.getItem(CLAVE) || '[]')) } catch { return new Set() } }
const orden = { alerta: 0, aviso: 1, info: 2 }
const sinTilde = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
// Palabras que la gente escribe y la página donde está eso
const SINONIMOS = {
  '/clientes': 'cliente clientes empresa arriendo contrato contratos rut',
  '/flota': 'camion camiones camioneta vehiculo vehiculos flota patente transporte odometro',
  '/mantenimiento': 'mantencion mantenciones mantenimiento taller reparacion preventiva correctiva',
  '/inventario': 'inventario equipo equipos insumo insumos stock bodega bano banos quimico arriendo arriendos activo activos unidad codigo',
  '/reportes': 'reporte reportes excel informe pdf csv analisis costos rentabilidad margen utilidad ventas',
  '/configuracion': 'configuracion parametros diesel usuarios',
}

export default function Topbar({ perfil, onCalendario, version = 0 }) {
  const navegar = useNavigate()
  const operador = esOperador(perfil)   // el operador no ve buscador, calendario ni alertas
  const [abierto, setAbierto] = useState(false)
  const [avisos, setAvisos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [res, setRes] = useState(null)
  const caja = useRef(null)
  const cajaBusca = useRef(null)

  useEffect(() => {
    const q = busqueda.trim()
    if (q.length < 2) { setRes(null); return }
    const t = sinTilde(q).replace(/^\/+/, '')   // "/banos" también busca la sección
    const paginas = NAV.filter((n) => n.to && n.to !== '/' && (sinTilde(n.label).includes(t) || (SINONIMOS[n.to] || '').split(' ').some((w) => w.startsWith(t))))
    setRes((r) => ({ paginas, activos: r?.activos || [], clientes: r?.clientes || [] }))
    const id = setTimeout(() => buscarGlobal(q).then((x) => setRes({ paginas, ...x })).catch(() => {}), 250)
    return () => clearTimeout(id)
  }, [busqueda])

  useEffect(() => {
    const fuera = (e) => { if (cajaBusca.current && !cajaBusca.current.contains(e.target)) setRes(null) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const ir = (a) => { navegar(a); setBusqueda(''); setRes(null) }

  const cargar = () => (operador ? Promise.resolve([[], []]) : Promise.all([notificaciones().catch(() => []), avisosCalculados().catch(() => [])]))
    .then(([db, calc]) => {
      const leidos = leidosLocal()
      const calculados = calc.map((a) => ({ ...a, leida: leidos.has(a.id) }))
        .sort((a, b) => orden[a.nivel] - orden[b.nivel] || String(a.fecha).localeCompare(String(b.fecha)))
      setAvisos([...calculados, ...db.map((n) => ({ ...n, origen: 'Sistema' }))])
    })
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 120000)
    return () => clearInterval(t)
  }, [version])

  useEffect(() => {
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const sinLeer = avisos.filter((a) => !a.leida).length

  const leerTodas = async () => {
    try { await marcarLeidas() } catch { /* solo lectura */ }
    const leidos = leidosLocal()
    avisos.forEach((a) => { if (typeof a.id === 'string' && /^(ev|cto|man|ins|des|doc)-/.test(a.id)) leidos.add(a.id) })
    localStorage.setItem(CLAVE, JSON.stringify([...leidos].slice(-300)))
    setAvisos((v) => v.map((a) => ({ ...a, leida: true })))
    setAbierto(false)
  }

  const buscar = (e) => {
    e.preventDefault()
    if (!res) return
    // Enter: si escribió una palabra (sin números) y calza con una sección, va a la sección; si no, al primer equipo o cliente
    const palabra = !/\d/.test(busqueda)
    const primero = palabra && res.paginas[0] ? res.paginas[0].to
      : res.activos[0] ? '/activo/' + res.activos[0].qr_token
      : res.clientes[0] ? '/clientes?q=' + encodeURIComponent(res.clientes[0].nombre)
      : res.paginas[0]?.to
    if (primero) ir(primero)
  }
  const hayRes = res && (res.paginas.length || res.activos.length || res.clientes.length)

  const iniciales = (perfil?.nombre || 'FOSAN').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 72, padding: '0 22px',
      background: 'rgba(12,24,41,.78)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.borde}`,
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      <div className="sbtab"><MarcaFosan tam={22} tamTexto={17} /></div>

      {!operador && <div ref={cajaBusca} className="desk-only" style={{ flex: 1, maxWidth: 460, position: 'relative' }}>
        <form onSubmit={buscar} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          border: `1px solid ${C.borde}`, padding: '10px 14px', background: 'rgba(21,38,63,.85)', borderRadius: 12 }}>
          <Icon d={I.busca} size={15} color={C.gris} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar baños, clientes o secciones"
            style={{ border: 0, outline: 'none', background: 'transparent', font: '400 14px var(--font)', width: '100%', color: C.tinta }} />
        </form>
        {res && (
          <div style={{
            position: 'absolute', top: 40, left: 0, right: 0, background: 'var(--panel)', zIndex: 1100,
            border: `1px solid ${C.borde}`, boxShadow: '0 10px 30px rgba(0,0,0,.5)', maxHeight: 420, overflowY: 'auto', borderRadius: 'var(--radio-md)' }}>
            {!hayRes && <div style={{ padding: 14, font: '400 13px var(--font)', color: C.gris }}>Sin resultados para "{busqueda.trim()}".</div>}
            {res.paginas.length > 0 && <Grupo t="Secciones" />}
            {res.paginas.map((p) => <Resultado key={p.to} d={p.d} t={p.label} onClick={() => ir(p.to)} />)}
            {res.activos.length > 0 && <Grupo t="Baños y vehículos" />}
            {res.activos.map((a) => <Resultado key={a.id} d={a.tipo === 'bano_quimico' ? I.drop : I.truck} t={a.codigo} sub={a.clientes?.nombre || a.estado?.replace(/_/g, ' ')} onClick={() => ir('/activo/' + a.qr_token)} />)}
            {res.clientes.length > 0 && <Grupo t="Clientes" />}
            {res.clientes.map((c) => <Resultado key={c.id} d={I.users} t={c.nombre} sub={[c.direccion, c.comuna].filter(Boolean).join(', ')} onClick={() => ir('/clientes?q=' + encodeURIComponent(c.nombre))} />)}
          </div>
        )}
      </div>}

      <div style={{ flex: 1 }} />

      {!operador && <>
      <button onClick={onCalendario} title="Calendario" style={{
        border: `1px solid ${C.borde}`, background: 'rgba(21,38,63,.85)', color: C.navy,
        width: 42, height: 42, display: 'grid', placeItems: 'center', cursor: 'pointer', borderRadius: 12 }}>
        <Icon d={I.cal} size={18} w={1.7} />
      </button>

      <div ref={caja} style={{ position: 'relative', display: 'flex' }}>
        <button onClick={() => setAbierto((v) => !v)} aria-label="Notificaciones" style={{
          position: 'relative', border: 0, background: 'transparent', padding: 4,
          color: C.navy, cursor: 'pointer', display: 'flex',
        }}>
          <Icon d="M18 16V10a6 6 0 1 0-12 0v6l-2 3h16zM10 21h4" size={22} w={1.7} />
          {sinLeer > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, padding: '0 3px',
              background: C.rojo, color: '#fff', borderRadius: 8, boxShadow: '0 0 10px rgba(239,68,68,.6)',
              font: '700 10px/16px var(--font)', textAlign: 'center',
            }}>{sinLeer}</span>
          )}
        </button>

        {abierto && (
          <div style={{
            position: 'absolute', top: 38, right: 0, width: 'min(360px, 80vw)', background: 'var(--panel)',
            border: `1px solid ${C.borde}`, boxShadow: '0 10px 30px rgba(0,0,0,.5)', zIndex: 1100, borderRadius: 'var(--radio-md)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 14px', borderBottom: `1px solid ${C.borde}`,
            }}>
              <span style={{ font: '700 14px var(--font)' }}>Notificaciones</span>
              {sinLeer > 0 && (
                <button onClick={leerTodas} style={{
                  border: 0, background: 'transparent', color: C.azul,
                  font: '600 12px var(--font)', cursor: 'pointer', padding: 0,
                }}>Marcar todas como leídas</button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {avisos.length === 0 && (
                <div style={{ padding: 16, font: '400 13px var(--font)', color: C.gris }}>
                  No hay notificaciones.
                </div>
              )}
              {avisos.map((a) => {
                const n = NIVEL[a.nivel] || NIVEL.info
                return (
                  <div key={a.id} onClick={() => { if (a.a) { navegar(a.a); setAbierto(false) } else if (a.origen === 'Calendario') { onCalendario(); setAbierto(false) } }} style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px',
                    borderBottom: `1px solid ${C.fila}`, opacity: a.leida ? .55 : 1,
                    cursor: a.a || a.origen === 'Calendario' ? 'pointer' : 'default',
                  }}>
                    <span style={{
                      width: 28, height: 28, flex: 'none', background: n.tint, color: n.color,
                      display: 'grid', placeItems: 'center',
                    }}>
                      <Icon d={n.d} size={15} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 13px/1.35 var(--font)' }}>{a.texto}</div>
                      <div style={{ font: '400 11px var(--font)', color: C.gris }}>{a.origen}{a.creado_en ? ' · ' + fechaHora(a.creado_en) : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      </>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 38, height: 38, background: 'var(--degradado)', color: '#fff', borderRadius: 10,
          boxShadow: '0 4px 14px rgba(7,139,250,.35)', display: 'grid', placeItems: 'center', font: '700 13px var(--font)',
        }}>{iniciales}</div>
        <div className="desk-only" style={{ lineHeight: 1.2 }}>
          <div style={{ font: '600 13px var(--font)' }}>{perfil?.nombre || 'Usuario'}</div>
          <div style={{ font: '400 11px var(--font)', color: C.gris }}>
            {nombreRol(perfil?.rol)}
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} title="Cerrar sesión" style={{
          border: 0, background: 'transparent', color: C.gris, cursor: 'pointer',
          padding: 4, display: 'flex',
        }}>
          <Icon d={I.salir} size={18} w={1.7} />
        </button>
      </div>
    </header>
  )
}

const Grupo = ({ t }) => (
  <div style={{ padding: '8px 12px 4px', font: '700 10px var(--font)', textTransform: 'uppercase', letterSpacing: '.08em', color: C.gris, borderTop: `1px solid ${C.fila}` }}>{t}</div>
)
const Resultado = ({ d, t, sub, onClick }) => (
  <button type="button" onClick={onClick} style={{
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: 0,
    background: 'var(--panel)', cursor: 'pointer', textAlign: 'left', minHeight: 44,
  }}>
    <Icon d={d} size={16} color={C.navy} />
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ display: 'block', font: '600 13px var(--font)', color: '#F1F5FA' }}>{t}</span>
      {sub && <span style={{ display: 'block', font: '400 11px var(--font)', color: C.gris, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
    </span>
  </button>
)
