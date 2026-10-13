import { useEffect, useState } from 'react'
import { Aviso } from '../components/Listado'
import { perfiles, parametros, guardarParametro, modelos, guardarPesoModelo, todosPermisos, guardarPermiso, guardarPerfil, accesosAutorizados, autorizarCorreo, quitarAutorizacion } from '../lib/api'
import { useSesion, puedeEditar, esDueno, nombreRol, SECCIONES } from '../lib/sesion'
import { decimalDe } from '../lib/validar'
import { Badge, C } from '../lib/ui'

const ROLES_EDITABLES = [{ v: 'secretaria', l: 'Secretaria' }, { v: 'lectura', l: 'Solo lectura' }]
const TODOS_ROLES = [{ v: 'dueno', l: 'Dueño' }, ...ROLES_EDITABLES]

export default function Configuracion() {
  const { usuario, perfil } = useSesion()
  const [lista, setLista] = useState([])
  const [error, setError] = useState(null)

  const [msg, setMsg] = useState(null)
  const cargar = () => perfiles().then(setLista).catch(setError)
  useEffect(() => { cargar() }, [])

  const cambiar = async (u, cambios) => {
    setMsg(null)
    try { await guardarPerfil(u, cambios); await cargar(); setMsg('Usuario actualizado.') } catch (e) { setMsg(e) }
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

      <div className="cols2" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24 }}>
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
          <div className="scroller">
            <table style={{ minWidth: 560 }}>
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const yo = u.id === usuario?.id
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.nombre}{yo ? ' (tú)' : ''}</td>
                      <td>{u.correo || '—'}</td>
                      <td>
                        {yo ? nombreRol(u.rol) : (
                          <select value={u.rol} onChange={(e) => cambiar(u, { rol: e.target.value })} style={sel}>
                            {TODOS_ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        {yo ? <Badge>Activo</Badge> : (
                          <button className="btn" style={{ minHeight: 34, padding: '4px 10px' }}
                            onClick={() => cambiar(u, { activo: u.activo === false })}>
                            {u.activo === false ? 'Inactivo · activar' : 'Activo · desactivar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {lista.length === 0 && (
                  <tr><td colSpan={4} style={{ color: C.gris }}>
                    Todavía no hay perfiles. Se crean solos al dar de alta el usuario en Supabase.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
          <Autorizados />
          <Costos editable={puedeEditar(perfil)} />

          <section className="card">
            <h6>Tu sesión</h6>
            <div style={{ padding: '14px 18px', display: 'grid', gap: 8 }}>
              <Dato k="Nombre" v={perfil?.nombre || '—'} />
              <Dato k="Correo" v={usuario?.email || '—'} />
              <Dato k="Rol" v={nombreRol(perfil?.rol)} />
            </div>
          </section>
        </div>
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
        <table style={{ minWidth: 620, width: '100%', borderCollapse: 'collapse', border: `2px solid ${C.borde}` }}>
          <thead>
            <tr>
              <th style={th} rowSpan={2}>Sección</th>
              <th style={{ ...th, textAlign: 'center' }}>Dueño</th>
              {ROLES_EDITABLES.map((r) => <th key={r.v} style={{ ...th, textAlign: 'center', borderLeft: `2px solid ${C.borde}` }} colSpan={2}>{r.l}</th>)}
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

// Correos que pueden entrar. El usuario se crea después en Supabase → Authentication.
function Autorizados() {
  const [lista, setLista] = useState([])
  const [v, setV] = useState({ nombre: '', correo: '', rol: 'secretaria' })
  const [msg, setMsg] = useState(null)
  const cargar = () => accesosAutorizados().then(setLista).catch(setMsg)
  useEffect(() => { cargar() }, [])

  const agregar = async (e) => {
    e.preventDefault(); setMsg(null)
    if (!v.nombre.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.correo.trim())) return setMsg(new Error('Escribe nombre y un correo válido.'))
    try { await autorizarCorreo({ ...v, nombre: v.nombre.trim() }); setV({ nombre: '', correo: '', rol: 'secretaria' }); await cargar(); setMsg('Correo autorizado. Ahora crea el usuario en Supabase → Authentication → Add user.') }
    catch (x) { setMsg(x) }
  }
  const quitar = async (c) => {
    if (!window.confirm(`¿Quitar la autorización de ${c}? Si ya tiene usuario, desactívalo en la tabla de usuarios.`)) return
    try { await quitarAutorizacion(c); await cargar() } catch (x) { setMsg(x) }
  }

  return (
    <section className="card">
      <h6>Correos autorizados</h6>
      <form onSubmit={agregar} style={{ padding: '14px 18px', display: 'grid', gap: 8, borderBottom: `2px solid ${C.borde}` }}>
        <input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} placeholder="Nombre" maxLength={60} style={{ ...sel, minHeight: 40 }} />
        <input value={v.correo} onChange={(e) => setV({ ...v, correo: e.target.value })} placeholder="correo@ejemplo.cl" type="email" maxLength={120} style={{ ...sel, minHeight: 40 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={v.rol} onChange={(e) => setV({ ...v, rol: e.target.value })} style={{ ...sel, minHeight: 40, flex: 1 }}>
            {TODOS_ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
          <button className="btn btn-verde" type="submit" style={{ minHeight: 40 }}>Autorizar</button>
        </div>
        <Mensaje m={msg} />
      </form>
      {lista.map((a) => (
        <div key={a.correo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', borderBottom: `1px solid ${C.fila}` }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: '600 13px var(--font)' }}>{a.nombre} · {nombreRol(a.rol)}</div>
            <div style={{ font: '400 12px var(--font)', color: C.gris, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.correo}</div>
          </div>
          <button className="btn" onClick={() => quitar(a.correo)} style={{ minHeight: 34, padding: '4px 10px', color: C.rojo }}>Quitar</button>
        </div>
      ))}
    </section>
  )
}

// Parámetros que usan las rutas para calcular el costo de cada salida
function Costos({ editable }) {
  const [pars, setPars] = useState([])
  const [mods, setMods] = useState([])
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    parametros().then(setPars).catch(setMsg)
    modelos().then(setMods).catch(setMsg)
  }, [])

  const guardar = async (fn, id, texto) => {
    try { await fn(id, decimalDe(texto)); setMsg('Guardado.') } catch (e) { setMsg(e) }
  }

  return (
    <section className="card">
      <h6>Parámetros de costo</h6>
      <div style={{ padding: '14px 18px', display: 'grid', gap: 12 }}>
        {pars.map((p) => (
          <Numero key={p.clave} etiqueta={p.etiqueta} unidad={p.unidad} valor={p.valor} editable={editable}
            onGuardar={(t) => guardar(guardarParametro, p.clave, t)} />
        ))}
        <div style={{ font: '700 11px var(--font)', textTransform: 'uppercase', letterSpacing: '.06em', color: C.gris, paddingTop: 6, borderTop: `2px solid ${C.borde}` }}>
          Peso vacío por modelo de baño
        </div>
        {mods.map((m) => (
          <Numero key={m.id} etiqueta={m.nombre} unidad="kg" valor={m.peso_kg} editable={editable}
            onGuardar={(t) => guardar(guardarPesoModelo, m.id, t)} />
        ))}
        <div style={{ font: '400 12px/1.45 var(--font)', color: C.gris }}>
          Vacíos cuentan como cero. El gasto de insumos por limpieza se define en Insumos.
        </div>
        {msg && <div style={{ font: '600 12px var(--font)', color: typeof msg === 'string' ? C.verde : C.rojo }}>
          {typeof msg === 'string' ? msg : String(msg.message || msg)}
        </div>}
      </div>
    </section>
  )
}

function Numero({ etiqueta, unidad, valor, editable, onGuardar }) {
  const [t, setT] = useState(valor === null || valor === undefined ? '' : String(valor).replace('.', ','))
  const original = valor === null || valor === undefined ? '' : String(valor).replace('.', ',')
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px auto', gap: 8, alignItems: 'center' }}>
      <span style={{ font: '400 13px var(--font)' }}>{etiqueta}</span>
      <span style={{ display: 'flex', alignItems: 'center', border: `2px solid ${C.borde}`, background: '#fff' }}>
        <input value={t} disabled={!editable} inputMode="decimal" placeholder="—"
          onChange={(e) => setT(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))}
          onBlur={() => t !== original && onGuardar(t)}
          style={{ width: '100%', minWidth: 0, border: 0, outline: 'none', padding: '8px 8px', font: '600 13px var(--font)', textAlign: 'right' }} />
      </span>
      <span style={{ font: '400 12px var(--font)', color: C.gris, minWidth: 34 }}>{unidad}</span>
    </label>
  )
}

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
