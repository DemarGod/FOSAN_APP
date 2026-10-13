import { useEffect, useState } from 'react'
import { Aviso } from '../components/Listado'
import { perfiles, todosPermisos, guardarPermiso, guardarPerfil, accesosAutorizados, autorizarCorreo, quitarAutorizacion } from '../lib/api'
import { useSesion, esDueno, nombreRol, SECCIONES, ROLES } from '../lib/sesion'
import { Badge, C } from '../lib/ui'

const ROLES_EDITABLES = ROLES.filter((r) => r.v !== 'dueno')
const TODOS_ROLES = ROLES

export default function Configuracion() {
  const { usuario, perfil } = useSesion()
  const [lista, setLista] = useState([])
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [nuevo, setNuevo] = useState({ nombre: '', correo: '', rol: 'secretaria' })

  // Une perfiles (cuentas creadas) con correos autorizados, por correo
  const cargar = () => Promise.all([perfiles(), accesosAutorizados().catch(() => [])]).then(([p, a]) => {
    const m = {}
    a.forEach((x) => { const k = x.correo.toLowerCase(); m[k] = { correo: x.correo, nombre: x.nombre, rol: x.rol, autorizado: true } })
    p.forEach((x) => {
      const k = (x.correo || x.id).toLowerCase()
      m[k] = { ...(m[k] || {}), perfil: x, nombre: x.nombre || m[k]?.nombre, correo: x.correo || m[k]?.correo, rol: x.rol }
    })
    setLista(Object.values(m).sort((x, y) => String(x.nombre).localeCompare(String(y.nombre))))
  }).catch(setError)
  useEffect(() => { cargar() }, [])

  const hacer = async (fn, ok) => {
    setMsg(null)
    try { await fn(); await cargar(); setMsg(ok) } catch (e) { setMsg(e) }
  }
  const cambiarRol = (u, rol) => hacer(() => (u.perfil ? guardarPerfil(u.perfil, { rol }) : autorizarCorreo({ correo: u.correo, nombre: u.nombre, rol })), 'Rol actualizado.')
  const alternar = (u) => hacer(() => guardarPerfil(u.perfil, { activo: u.perfil.activo === false }), 'Usuario actualizado.')
  const quitar = (u) => {
    if (!window.confirm(`¿Quitar el acceso de ${u.nombre} (${u.correo})?`)) return
    hacer(async () => {
      if (u.autorizado) await quitarAutorizacion(u.correo)
      if (u.perfil && u.perfil.activo !== false) await guardarPerfil(u.perfil, { activo: false })
    }, 'Acceso quitado.')
  }
  const agregar = (e) => {
    e.preventDefault()
    if (!nuevo.nombre.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nuevo.correo.trim())) return setMsg(new Error('Escribe nombre y un correo válido.'))
    if (lista.some((u) => u.correo?.toLowerCase() === nuevo.correo.trim().toLowerCase())) return setMsg(new Error('Ese correo ya está en la lista.'))
    hacer(async () => { await autorizarCorreo({ ...nuevo, nombre: nuevo.nombre.trim() }); setNuevo({ nombre: '', correo: '', rol: 'secretaria' }) },
      'Correo autorizado. Ahora crea su cuenta en Supabase → Authentication → Add user, con ese mismo correo.')
  }

  if (!esDueno(perfil)) {
    return (
      <div>
        <h2 style={{ margin: '0 0 16px' }}>Mi perfil</h2>
        <section className="card" style={{ maxWidth: 520 }}>
          <h6>Tu sesión</h6>
          <div style={{ padding: '14px 18px', display: 'grid', gap: 8 }}>
            <Dato k="Nombre" v={perfil?.nombre || '—'} />
            <Dato k="Correo" v={usuario?.email || '—'} />
            <Dato k="Rol" v={nombreRol(perfil?.rol)} />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>Configuración</h2>
      <p className="text-muted" style={{ margin: '0 0 20px' }}>
        Los dueños tienen acceso total. Desde acá asignan el rol de cada usuario y deciden qué ve y qué edita cada rol.
      </p>

      <Aviso error={error} />
      <Mensaje m={msg} />

      <div className="cols2" style={{ gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1fr)', gap: 24 }}>
        <section className="card">
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 18px', background: C.tinte, borderBottom: `2px solid ${C.borde}`,
          }}>
            <h6 style={{ margin: 0, color: '#1a3c72' }}>Usuarios del sistema</h6>
            <span style={{ font: '400 12px var(--font)', color: C.gris }}>
              {lista.length} acceso{lista.length === 1 ? '' : 's'}
            </span>
          </div>
          <form onSubmit={agregar} style={{
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr) 150px auto', gap: 8,
            padding: '12px 18px', borderBottom: `2px solid ${C.borde}`,
          }}>
            <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre" maxLength={60} style={{ ...sel, minHeight: 40, minWidth: 0 }} />
            <input value={nuevo.correo} onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })} placeholder="correo@ejemplo.cl" type="email" maxLength={120} style={{ ...sel, minHeight: 40, minWidth: 0 }} />
            <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })} style={{ ...sel, minHeight: 40 }}>
              {TODOS_ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
            <button className="btn btn-verde" type="submit" style={{ minHeight: 40 }}>Agregar</button>
          </form>
          <div className="scroller">
            <table style={{ minWidth: 680 }}>
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const yo = u.perfil?.id === usuario?.id
                  return (
                    <tr key={u.correo || u.perfil?.id}>
                      <td style={{ fontWeight: 600 }}>{u.nombre || '—'}{yo ? ' (tú)' : ''}</td>
                      <td>{u.correo || '—'}</td>
                      <td>
                        {yo ? nombreRol(u.rol) : (
                          <select value={u.rol} onChange={(e) => cambiarRol(u, e.target.value)} style={sel}>
                            {TODOS_ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        {yo ? <Badge>Activo</Badge> : !u.perfil ? (
                          <span title="Falta crear su cuenta en Supabase → Authentication" style={{ font: '600 12px var(--font)', color: '#8a5a00' }}>Sin cuenta</span>
                        ) : (
                          <button className="btn" style={{ minHeight: 34, padding: '4px 10px' }} onClick={() => alternar(u)}>
                            {u.perfil.activo === false ? 'Inactivo · activar' : 'Activo · desactivar'}
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!yo && <button className="btn" onClick={() => quitar(u)} style={{ minHeight: 34, padding: '4px 10px', color: C.rojo }}>Quitar</button>}
                      </td>
                    </tr>
                  )
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={5} style={{ color: C.gris }}>Todavía no hay usuarios.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 18px', font: '400 12px/1.45 var(--font)', color: C.gris }}>
            "Sin cuenta": el correo está autorizado pero falta crearle el usuario en Supabase → Authentication → Add user.
          </div>
        </section>

        <section className="card" style={{ alignSelf: 'start' }}>
          <h6>Tu sesión</h6>
          <div style={{ padding: '14px 18px', display: 'grid', gap: 8 }}>
            <Dato k="Nombre" v={perfil?.nombre || '—'} />
            <Dato k="Correo" v={usuario?.email || '—'} />
            <Dato k="Rol" v={nombreRol(perfil?.rol)} />
          </div>
        </section>
      </div>

      <Permisos />
    </div>
  )
}

const sel = { border: `2px solid ${C.borde}`, font: '400 13px var(--font)', padding: '5px 8px', minHeight: 34, background: '#fff' }

function Mensaje({ m }) {
  if (!m) return null
  const ok = typeof m === 'string'
  return <div style={{ margin: '0 0 14px', font: '600 12px var(--font)', color: ok ? C.verde : C.rojo }}>{ok ? m : String(m.message || m)}</div>
}

// Qué ve y qué edita cada rol. Los dueños siempre tienen todo.
function Permisos() {
  const [p, setP] = useState({})
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    todosPermisos().then((rows) => {
      const m = {}
      rows.forEach((r) => { m[r.rol + ':' + r.seccion] = r })
      setP(m)
    }).catch(setMsg)
  }, [])

  const val = (rol, s) => p[rol + ':' + s] || { ver: false, editar: false }
  const cambiar = async (rol, s, campo, v) => {
    const actual = val(rol, s)
    let nuevo = { ...actual, [campo]: v }
    if (campo === 'ver' && !v) nuevo.editar = false
    if (campo === 'editar' && v) nuevo.ver = true
    setP((x) => ({ ...x, [rol + ':' + s]: { rol, seccion: s, ...nuevo } }))
    setMsg(null)
    try { await guardarPermiso(rol, s, nuevo.ver, nuevo.editar); setMsg('Guardado. El usuario lo verá al recargar la app.') }
    catch (e) { setMsg(e); setP((x) => ({ ...x, [rol + ':' + s]: { rol, seccion: s, ...actual } })) }
  }

  const th = { padding: '9px 12px', font: '700 11px var(--font)', textTransform: 'uppercase', letterSpacing: '.05em', color: '#1a3c72', textAlign: 'left', background: C.tinte, borderBottom: `2px solid ${C.borde}`, whiteSpace: 'nowrap' }
  const td = { padding: '8px 12px', font: '400 13px var(--font)', borderBottom: `1px solid ${C.fila}` }

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h6>Permisos por rol</h6>
      <div style={{ padding: '10px 18px 0', font: '400 12px/1.45 var(--font)', color: C.gris }}>
        Marca qué puede ver y editar cada rol. Editar incluye crear y modificar; eliminar queda solo para los dueños.
      </div>
      <div className="scroller" style={{ padding: '12px 18px 16px' }}>
        <table style={{ minWidth: 1100, width: '100%', borderCollapse: 'collapse', border: `2px solid ${C.borde}` }}>
          <thead>
            <tr>
              <th style={th} rowSpan={2}>Sección</th>
              <th style={{ ...th, textAlign: 'center' }}>Dueño</th>
              {ROLES_EDITABLES.map((r) => <th key={r.v} title={r.d} style={{ ...th, textAlign: 'center', borderLeft: `2px solid ${C.borde}` }} colSpan={2}>{r.l}<span style={{ display: 'block', font: '400 10px var(--font)', textTransform: 'none', letterSpacing: 0, color: C.gris }}>{r.d}</span></th>)}
            </tr>
            <tr>
              <th style={{ ...th, textAlign: 'center' }}>Todo</th>
              {ROLES_EDITABLES.map((r) => [
                <th key={r.v + 'v'} style={{ ...th, textAlign: 'center', borderLeft: `2px solid ${C.borde}` }}>Ver</th>,
                <th key={r.v + 'e'} style={{ ...th, textAlign: 'center' }}>Editar</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {SECCIONES.map((s) => (
              <tr key={s.s}>
                <td style={{ ...td, fontWeight: 600 }}>{s.l}</td>
                <td style={{ ...td, textAlign: 'center', color: C.gris }}>✓</td>
                {ROLES_EDITABLES.map((r) => {
                  const v = val(r.v, s.s)
                  return [
                    <td key={r.v + 'v'} style={{ ...td, textAlign: 'center', borderLeft: `2px solid ${C.borde}` }}>
                      <Check on={v.ver} onChange={(x) => cambiar(r.v, s.s, 'ver', x)} t={`${r.l} ve ${s.l}`} />
                    </td>,
                    <td key={r.v + 'e'} style={{ ...td, textAlign: 'center' }}>
                      {s.soloVer ? <span style={{ color: C.gris }}>—</span> : <Check on={v.editar} onChange={(x) => cambiar(r.v, s.s, 'editar', x)} t={`${r.l} edita ${s.l}`} />}
                    </td>,
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}><Mensaje m={msg} /></div>
      </div>
    </section>
  )
}

const Check = ({ on, onChange, t }) => (
  <input type="checkbox" checked={!!on} title={t} aria-label={t} onChange={(e) => onChange(e.target.checked)}
    style={{ width: 20, height: 20, accentColor: C.navy, cursor: 'pointer' }} />
)

function Dato({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{
        font: '400 11px var(--font)', color: C.gris,
        textTransform: 'uppercase', letterSpacing: '.06em',
      }}>{k}</span>
      <span style={{ font: '600 13px var(--font)', textAlign: 'right' }}>{v}</span>
    </div>
  )
}
