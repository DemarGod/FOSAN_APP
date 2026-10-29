// Administración → Personal y usuarios (láminas 8.1, 8.2, 8.3 y 3.1).
// Una persona puede existir sin acceso (sirve como responsable) o con acceso al sistema.
// Se entra con el nombre de usuario o con el correo. Las claves las asigna el dueño y nunca se muestran.
import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { Boton, Campo, Tabla, Estado, Ayuda } from './Base'
import {
  personalLista, guardarPersona, usuarioOcupado, crearAcceso, actualizarAcceso, asignarClave, eliminarCuenta, normalizarRut,
} from '../lib/api'
import { formatoRut, rutValido, formatoTel, telValido, correoValido } from '../lib/validar'
import { useSesion, nombreRol, ROLES } from '../lib/sesion'
import { C, Icon, I } from '../lib/ui'

const FUNCIONES = ['Dueño', 'Administrador', 'Secretaria', 'Conductor', 'Ayudante', 'Operador', 'Mecánico']
const OJO_NO = 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1'
const chico = { minHeight: 34, padding: '6px 12px' }
const funcionL = (f) => (ROLES.some((r) => r.v === f) ? nombreRol(f) : f || '—')
const sugerirUsuario = (nombre) => {
  const p = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean)
  return p.length ? (p.length > 1 ? `${p[0]}.${p[p.length > 2 ? p.length - 2 : 1]}` : p[0]) : ''
}
const usuarioValido = (u) => /^[a-z0-9._-]{3,40}$/.test(u)
const acceso = (x) => (!x.perfiles ? 'sin' : x.perfiles.activo === false || x.activo === false ? 'inactivo' : 'activo')

export default function AdminPersonal() {
  const { usuario: yo } = useSesion()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState('')
  const [filtroAcceso, setFiltroAcceso] = useState('todos')
  const [form, setForm] = useState(null)        // {} nueva · persona a editar
  const [ver, setVer] = useState(null)
  const [gestionar, setGestionar] = useState(null)
  const cargar = () => personalLista().then(setLista).catch(setError)
  useEffect(() => { cargar() }, [])
  const listo = () => { setForm(null); setGestionar(null); cargar() }

  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase(), tr = normalizarRut(texto)
    return (lista || []).filter((x) => (filtroAcceso === 'todos' || acceso(x) === filtroAcceso)
      && (!t || x.nombre.toLowerCase().includes(t) || (x.perfiles?.usuario || '').includes(t)
        || (tr.length >= 3 && normalizarRut(x.rut).includes(tr))))
  }, [lista, texto, filtroAcceso])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <span className="text-muted">Lista de personas de la empresa y su estado de acceso al sistema.</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Campo etiqueta="Buscar por nombre o RUT" style={{ flex: '1 1 260px' }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o RUT…" />
        </Campo>
        <Campo etiqueta="Acceso" style={{ width: 170 }}>
          <select value={filtroAcceso} onChange={(e) => setFiltroAcceso(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="sin">Sin acceso</option>
          </select>
        </Campo>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})}>Agregar persona</Boton>
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {lista === null ? <div style={{ color: C.gris }}>Cargando…</div> : (
        <div className="card">
          <Tabla filas={filas} vacio="Sin personas para estos filtros." columnas={[
            { k: 'nombre', label: 'Nombre', render: (x) => <span style={{ fontWeight: 600 }}>{x.nombre}{x.perfiles?.id === yo?.id ? ' (tú)' : ''}</span> },
            { k: 'funcion', label: 'Función', render: (x) => funcionL(x.funcion) },
            { k: 'rol', label: 'Rol', render: (x) => (x.perfiles ? nombreRol(x.perfiles.rol) : 'Sin cuenta') },
            { k: 'usuario', label: 'Usuario', render: (x) => x.perfiles?.usuario || '—' },
            { k: 'correo', label: 'Correo', render: (x) => x.perfiles?.correo || '—' },
            {
              k: 'acceso', label: 'Acceso', render: (x) => {
                const a = acceso(x)
                return <Estado tono={a === 'activo' ? 'ok' : 'neutro'}>{a === 'activo' ? 'Activo' : a === 'inactivo' ? 'Inactivo' : 'Sin acceso'}</Estado>
              },
            },
            {
              k: 'acciones', label: 'Acciones', alinear: 'right', render: (x) => (
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <Boton onClick={() => setVer(x)} style={chico}>Ver</Boton>
                  <Boton onClick={() => setForm(x)} style={chico}>Editar</Boton>
                  <Boton onClick={() => setGestionar(x)} style={chico}>Gestionar acceso</Boton>
                </div>
              ),
            },
          ]} />
        </div>
      )}
      <Reglas />

      {form && <FormPersona persona={form} personas={lista || []} onCerrar={() => setForm(null)} onGuardado={listo} />}
      {ver && <VerPersona p={ver} onCerrar={() => setVer(null)} />}
      {gestionar && <GestionarAcceso persona={gestionar} esYo={gestionar.perfiles?.id === yo?.id} onCerrar={() => setGestionar(null)} onGuardado={listo} />}
    </div>
  )
}

export function Reglas() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 14px', background: C.suave, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', font: '400 13px var(--font)' }}>
      <b style={{ marginRight: 6 }}>Reglas generales</b>
      <span>· <b style={{ color: C.rojo }}>*</b> Obligatorio</span>
      <span>· Guardar valida campos y conserva lo escrito ante error</span>
      <span>· Usuario único</span>
      <span>· Contraseñas coincidentes</span>
      <span>· Desactivar conserva historial</span>
    </div>
  )
}

function Clave({ etiqueta, valor, onChange, error }) {
  const [ver, setVer] = useState(false)
  return (
    <Campo etiqueta={etiqueta} obligatorio error={error}>
      <div style={{ position: 'relative' }}>
        <input type={ver ? 'text' : 'password'} value={valor} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" style={{ paddingRight: 44 }} />
        <button type="button" onClick={() => setVer((x) => !x)} aria-label={ver ? 'Ocultar' : 'Mostrar'} title="Muestra solo lo que estás escribiendo"
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', color: C.gris, padding: 6 }}>
          <Icon d={ver ? OJO_NO : I.ojo} size={18} />
        </button>
      </div>
    </Campo>
  )
}

// Valida y devuelve errores de un bloque de acceso (usuario, correo, rol, clave)
async function validarAcceso(a, e) {
  if (!usuarioValido(a.usuario)) e.usuario = 'Entre 3 y 40: minúsculas, números, punto o guion. Ej. ana.perez'
  else if (await usuarioOcupado(a.usuario)) e.usuario = 'Ese nombre de usuario ya existe.'
  if (!correoValido(a.correo)) e.correo = 'Correo inválido.'
  if (!a.rol) e.rol = 'Elige el rol.'
  if (a.clave.length < 8) e.clave = 'Mínimo 8 caracteres.'
  if (a.clave !== a.clave2) e.clave2 = 'Las contraseñas no coinciden.'
}

function BloqueAcceso({ a, set, errores }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="cols2" style={{ gap: 12 }}>
        <Campo etiqueta="Usuario" obligatorio ayuda="Para entrar: ana.perez" error={errores.usuario}>
          <input value={a.usuario} onChange={(e) => set('usuario', e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))} maxLength={40} />
        </Campo>
        <Campo etiqueta="Rol" obligatorio error={errores.rol}>
          <select value={a.rol} onChange={(e) => set('rol', e.target.value)}>
            {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Correo" obligatorio ayuda="También sirve para entrar." error={errores.correo}>
        <input type="email" value={a.correo} onChange={(e) => set('correo', e.target.value)} maxLength={120} />
      </Campo>
      <Clave etiqueta="Contraseña asignada por el dueño" valor={a.clave} onChange={(x) => set('clave', x)} error={errores.clave} />
      <Clave etiqueta="Confirmar contraseña" valor={a.clave2} onChange={(x) => set('clave2', x)} error={errores.clave2} />
      <Ayuda>El dueño define la clave y se la comunica a la persona.</Ayuda>
    </div>
  )
}

// ── 8.2 Agregar o editar persona ──────────────────────────────────────────
function FormPersona({ persona, personas, onCerrar, onGuardado }) {
  const nueva = !persona.id
  const [v, setV] = useState({
    nombre: persona.nombre || '', rut: formatoRut(persona.rut || ''), funcion: funcionL(persona.funcion) === '—' ? '' : funcionL(persona.funcion),
    telefono: persona.telefono || '', activo: persona.activo !== false,
  })
  const [conAcceso, setConAcceso] = useState(false)
  const [a, setA] = useState({ usuario: '', correo: '', rol: 'secretaria', clave: '', clave2: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k, fmt) => (e) => { const val = e.target.type === 'checkbox' ? e.target.checked : fmt ? fmt(e.target.value) : e.target.value; setV((p) => ({ ...p, [k]: val })); setErrores({}) }
  const setAcc = (k, val) => { setA((p) => ({ ...p, [k]: val })); setErrores({}) }

  const guardar = async () => {
    const e = {}
    if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!v.rut) e.rut = 'El RUT es obligatorio.'
    else if (!rutValido(v.rut)) e.rut = 'RUT inválido: revisa el dígito verificador.'
    else if (personas.some((p) => p.id !== persona.id && normalizarRut(p.rut) === normalizarRut(v.rut))) e.rut = 'Ya hay una persona con ese RUT.'
    if (!v.funcion.trim()) e.funcion = 'La función es obligatoria.'
    if (v.telefono && !telValido(v.telefono)) e.telefono = 'Formato: +56 9 1234 5678'
    setGuardando(true); setError(null)
    try {
      if (conAcceso) await validarAcceso(a, e)
      setErrores(e)
      if (Object.keys(e).length) { setGuardando(false); return }
      const r = await guardarPersona(persona.id, {
        nombre: v.nombre.trim(), rut: formatoRut(v.rut), funcion: v.funcion.trim(), telefono: v.telefono || null, activo: v.activo,
      }, persona.perfiles?.id)
      if (conAcceso) await crearAcceso(r.id, { nombre: v.nombre.trim(), ...a })
      onGuardado()
    } catch (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal titulo={nueva ? 'Agregar persona' : `Editar ${persona.nombre}`} ancho={860} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
    </>}>
      <div className="cols2" style={{ gap: 18, padding: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <Campo etiqueta="Nombre completo" obligatorio error={errores.nombre}>
            <input value={v.nombre} onChange={set('nombre')} maxLength={80} autoFocus={nueva} />
          </Campo>
          <Campo etiqueta="RUT" obligatorio error={errores.rut}>
            <input value={v.rut} onChange={set('rut', formatoRut)} maxLength={12} placeholder="12.345.678-9" />
          </Campo>
          <Campo etiqueta="Función" obligatorio error={errores.funcion}>
            <input value={v.funcion} onChange={set('funcion')} list="funciones-fosan" maxLength={40} placeholder="Seleccionar o escribir" />
            <datalist id="funciones-fosan">{FUNCIONES.map((f) => <option key={f} value={f} />)}</datalist>
          </Campo>
          <Campo etiqueta="Teléfono (opcional)" error={errores.telefono}>
            <input value={v.telefono} onChange={set('telefono', formatoTel)} inputMode="tel" placeholder="+56 9 1234 5678" />
          </Campo>
          {!nueva && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)' }}>
              <input type="checkbox" checked={v.activo} onChange={set('activo')} /> Persona activa en la empresa
            </label>
          )}
        </div>
        <div style={{ display: 'grid', gap: 12, padding: 14, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)' }}>
          {persona.perfiles ? (
            <>
              <h6 style={{ margin: 0 }}>Acceso al sistema</h6>
              <span style={{ font: '400 14px/1.6 var(--font)' }}>
                {persona.perfiles.usuario || 'sin usuario'} · {persona.perfiles.correo} · {nombreRol(persona.perfiles.rol)}
              </span>
              <Ayuda>El rol, el estado y la contraseña se cambian en "Gestionar acceso".</Ayuda>
            </>
          ) : (
            <>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 14px var(--font)' }}>
                <input type="checkbox" checked={conAcceso} onChange={(e) => {
                  setConAcceso(e.target.checked); setErrores({})
                  if (e.target.checked && !a.usuario) setA((p) => ({ ...p, usuario: sugerirUsuario(v.nombre) }))
                }} /> Habilitar acceso al sistema
              </label>
              {conAcceso
                ? <BloqueAcceso a={a} set={setAcc} errores={errores} />
                : <Ayuda tono="atencion">Sin acceso: puede asignarse como responsable, sin iniciar sesión.</Ayuda>}
            </>
          )}
        </div>
      </div>
      {error && <div style={{ padding: '0 18px 18px' }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
    </Modal>
  )
}

function VerPersona({ p, onCerrar }) {
  const fila = (l, v) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10, padding: '5px 0', font: '400 14px var(--font)' }}>
      <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v || '—'}</span>
    </div>
  )
  const a = acceso(p)
  return (
    <Modal titulo={p.nombre} ancho={480} onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div style={{ padding: 18 }}>
        {fila('RUT', p.rut)}
        {fila('Función', funcionL(p.funcion))}
        {fila('Teléfono', p.telefono)}
        {fila('Acceso', a === 'activo' ? 'Activo' : a === 'inactivo' ? 'Inactivo' : 'Sin acceso')}
        {p.perfiles && fila('Usuario', p.perfiles.usuario)}
        {p.perfiles && fila('Correo', p.perfiles.correo)}
        {p.perfiles && fila('Rol', nombreRol(p.perfiles.rol))}
      </div>
    </Modal>
  )
}

// ── 8.3 Gestionar acceso (+ 3.1 Asignar nueva contraseña) ─────────────────
function GestionarAcceso({ persona, esYo, onCerrar, onGuardado }) {
  const perfil = persona.perfiles
  const [v, setV] = useState({ usuario: perfil?.usuario || '', rol: perfil?.rol || 'secretaria', activo: perfil?.activo !== false })
  const [a, setA] = useState({ usuario: sugerirUsuario(persona.nombre), correo: '', rol: 'secretaria', clave: '', clave2: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [clave, setClave] = useState(false)
  const [eliminar, setEliminar] = useState(0)   // 0 · 1 = ¿seguro? · 2 = escribir ELIMINAR

  const guardar = async () => {
    const e = {}
    setGuardando(true); setError(null)
    try {
      if (!perfil) {
        await validarAcceso(a, e)
        setErrores(e)
        if (Object.keys(e).length) { setGuardando(false); return }
        await crearAcceso(persona.id, { nombre: persona.nombre, ...a })
      } else {
        const u = v.usuario.trim()
        if (u && !usuarioValido(u)) e.usuario = 'Entre 3 y 40: minúsculas, números, punto o guion.'
        else if (u && u !== perfil.usuario && await usuarioOcupado(u, perfil.id)) e.usuario = 'Ese nombre de usuario ya existe.'
        setErrores(e)
        if (Object.keys(e).length) { setGuardando(false); return }
        await actualizarAcceso(perfil, esYo ? { usuario: u || null } : { usuario: u || null, rol: v.rol, activo: v.activo })
      }
      onGuardado()
    } catch (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal titulo="Gestionar acceso" ancho={620} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : perfil ? 'Guardar cambios' : 'Habilitar acceso'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <Campo etiqueta="Nombre"><input value={persona.nombre} readOnly /></Campo>
        {!perfil ? (
          <>
            <Ayuda tono="atencion">Esta persona no tiene cuenta. Completa los datos para habilitar su acceso.</Ayuda>
            <BloqueAcceso a={a} set={(k, val) => { setA((p) => ({ ...p, [k]: val })); setErrores({}) }} errores={errores} />
          </>
        ) : (
          <>
            <div className="cols2" style={{ gap: 12 }}>
              <Campo etiqueta="Usuario" error={errores.usuario} ayuda={!perfil.usuario ? 'Aún no tiene: asígnale uno (ej. ana.perez).' : undefined}>
                <input value={v.usuario} onChange={(e) => { setV((p) => ({ ...p, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })); setErrores({}) }} maxLength={40} />
              </Campo>
              <Campo etiqueta="Correo"><input value={perfil.correo || ''} readOnly /></Campo>
              <Campo etiqueta="Rol" obligatorio ayuda={esYo ? 'No puedes cambiar tu propio rol.' : undefined}>
                <select value={v.rol} onChange={(e) => setV((p) => ({ ...p, rol: e.target.value }))} disabled={esYo}>
                  {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Estado" obligatorio>
                <select value={v.activo ? 'activo' : 'inactivo'} onChange={(e) => setV((p) => ({ ...p, activo: e.target.value === 'activo' }))} disabled={esYo}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </Campo>
            </div>
            <div><Boton tipo="principal" icono={I.lapiz} onClick={() => setClave(true)}>Asignar nueva contraseña</Boton></div>
            {msg && <Ayuda>{msg}</Ayuda>}
            <Ayuda>Las claves no aparecen en listados, exportaciones ni historial. Inactivo: no puede entrar, pero su historial se conserva.</Ayuda>
            {!esYo && (
              <div style={{ border: `1px solid ${C.rojo}`, borderRadius: 'var(--radio-md)', padding: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220, font: '400 13px/1.45 var(--font)' }}>
                  <b style={{ color: C.rojo }}>Eliminar cuenta</b><br />
                  Borra la cuenta y ya no podrá entrar. Lo que registró se conserva y la persona queda "Sin acceso". No se puede deshacer; para dejarla sin entrar basta con Inactivo.
                </div>
                <Boton tipo="peligro" onClick={() => setEliminar(1)}>Eliminar cuenta</Boton>
              </div>
            )}
          </>
        )}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>

      {clave && <NuevaClave perfil={perfil} onCerrar={() => setClave(false)} onListo={() => { setClave(false); setMsg('Contraseña asignada. Comunícasela a la persona.') }} />}
      {eliminar > 0 && <EliminarCuenta persona={persona} paso={eliminar} setPaso={setEliminar} onListo={onGuardado} />}
    </Modal>
  )
}

function NuevaClave({ perfil, onCerrar, onListo }) {
  const [c1, setC1] = useState('')
  const [c2, setC2] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    const e = {}
    if (c1.length < 8) e.c1 = 'Mínimo 8 caracteres.'
    if (c1 !== c2) e.c2 = 'Las contraseñas no coinciden.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    try { await asignarClave(perfil.correo, c1); onListo() } catch (err) { setError(err); setGuardando(false) }
  }
  return (
    <Modal titulo="Asignar nueva contraseña" ancho={440} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar contraseña'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <Clave etiqueta="Nueva contraseña" valor={c1} onChange={(x) => { setC1(x); setErrores({}) }} error={errores.c1} />
        <Clave etiqueta="Confirmar contraseña" valor={c2} onChange={(x) => { setC2(x); setErrores({}) }} error={errores.c2} />
        <Ayuda>El dueño puede crear y reemplazar la clave. Mostrar revela solo lo que estás escribiendo; no recupera claves guardadas.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// Doble confirmación: ¿Seguro? Sí/No → escribir ELIMINAR (como en GitHub)
function EliminarCuenta({ persona, paso, setPaso, onListo }) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const confirmar = async () => {
    setBorrando(true)
    try { await eliminarCuenta(persona.perfiles.correo); onListo() } catch (e) { setError(e); setBorrando(false) }
  }
  if (paso === 1) {
    return (
      <Modal titulo="¿Seguro que quieres eliminar esta cuenta?" ancho={460} onCerrar={() => setPaso(0)} pie={<>
        <Boton onClick={() => setPaso(0)}>No</Boton>
        <Boton tipo="peligro" onClick={() => setPaso(2)}>Sí, continuar</Boton>
      </>}>
        <div style={{ padding: 18, font: '400 14px/1.5 var(--font)' }}>
          Se eliminará la cuenta de <b>{persona.nombre}</b> ({persona.perfiles.correo}). Ya no podrá entrar al sistema.
        </div>
      </Modal>
    )
  }
  return (
    <Modal titulo="Confirmar eliminación" ancho={460} onCerrar={() => setPaso(0)} pie={<>
      <Boton onClick={() => setPaso(0)}>Cancelar</Boton>
      <Boton tipo="peligro" onClick={confirmar} disabled={texto !== 'ELIMINAR' || borrando}>{borrando ? 'Eliminando…' : 'Eliminar cuenta'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12, font: '400 14px/1.5 var(--font)' }}>
        <span>Esta acción <b>no se puede deshacer</b>. Lo que registró {persona.nombre} se conserva y la persona queda "Sin acceso".</span>
        <Campo etiqueta="Para confirmar, escribe ELIMINAR">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus autoComplete="off" />
        </Campo>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}
