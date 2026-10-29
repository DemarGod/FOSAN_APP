// Ficha del cliente (láminas 2.4 a 2.7, y 2.8 / 2.10 en solo lectura).
// Pestañas: Resumen · Contactos · Ubicaciones · Servicios · Historial.
// Nada se borra: contactos y ubicaciones se desactivan; el historial es solo lectura.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import Mapa from '../components/Mapa'
import FormCliente from '../components/FormCliente'
import ServiciosCliente from '../components/ServiciosCliente'
import { Boton, Campo, Tabla, Pestanas, Estado, Ayuda } from '../components/Base'
import {
  clienteFicha, rubroNombre, contactosDe, guardarContacto, ubicacionesDe, guardarUbicacion,
  usoUbicacion, historialCliente,
} from '../lib/api'
import { formatoTel, telValido, correoValido, decimalDe } from '../lib/validar'
import { useSesion, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, Icon, I, fecha, fechaHora } from '../lib/ui'

const PESTANAS = [
  { v: 'resumen', l: 'Resumen' },
  { v: 'contactos', l: 'Contactos' },
  { v: 'ubicaciones', l: 'Ubicaciones' },
  { v: 'servicios', l: 'Servicios' },
  { v: 'historial', l: 'Historial' },
]
const COMUNAS_MAULE = [
  'Talca', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael',
  'Cauquenes', 'Chanco', 'Pelluhue', 'Curicó', 'Hualañé', 'Licantén', 'Molina', 'Rauco', 'Romeral', 'Sagrada Familia',
  'Teno', 'Vichuquén', 'Linares', 'Colbún', 'Longaví', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre', 'Yerbas Buenas',
]
const GEAR = I.gear
const FLECHA = 'M9 5l7 7-7 7'
const VOLVER = 'M19 12H5M11 6l-6 6 6 6'
const chico = { minHeight: 34, padding: '6px 12px' }
const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const confirmarSalida = (sucio) => !sucio || window.confirm('Hay cambios sin guardar. ¿Salir sin guardar?')

export default function FichaCliente() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = PESTANAS.some((p) => p.v === params.get('tab')) ? params.get('tab') : 'resumen'
  const irA = (v) => setParams(v === 'resumen' ? {} : { tab: v }, { replace: true })
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'clientes')

  const [c, setC] = useState(null)
  const [rubro, setRubro] = useState(null)
  const [error, setError] = useState(null)
  const [editar, setEditar] = useState(false)
  const [version, setVersion] = useState(0)     // recarga los contadores del encabezado

  useEffect(() => {
    clienteFicha(id).then((x) => {
      setC(x || false)
      if (x?.rubro) rubroNombre(x.rubro).then(setRubro).catch(() => setRubro(x.rubro))
    }).catch(setError)
  }, [id, version])
  const recargar = () => setVersion((n) => n + 1)

  if (error) return <Ayuda tono="error">{String(error.message || error)}</Ayuda>
  if (c === null) return <div style={{ padding: 24, color: C.gris }}>Cargando…</div>
  if (c === false) return <Ayuda tono="error">Este cliente no existe.</Ayuda>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <a href="/clientes" onClick={(e) => { e.preventDefault(); navegar('/clientes') }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 13px var(--font)' }}>
          <Icon d={VOLVER} size={16} /> Volver a Clientes
        </a>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ margin: '0 0 8px' }}>{c.nombre}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip fondo={c.activo ? '#e6f4ea' : C.fila}>
                <Estado tono={c.activo ? 'ok' : 'neutro'}>{c.activo ? 'Cliente activo' : 'Cliente inactivo'}</Estado>
              </Chip>
              <Chip>{c.codigo} · RUT {c.rut || '—'}</Chip>
            </div>
          </div>
          <Boton tipo="principal" icono={I.lapiz} onClick={() => setEditar(true)} disabled={!editable}>Editar datos</Boton>
        </div>
        {c.activo && c.ubicaciones_activas === 0 && (
          <Ayuda tono="atencion" style={{ marginTop: 12 }}>
            Este cliente no tiene ubicaciones activas. Agrega una en la pestaña <a href="#" onClick={(e) => { e.preventDefault(); irA('ubicaciones') }}>Ubicaciones</a>:
            los servicios y los baños que se le asignen quedan en una ubicación del cliente. No se copian coordenadas de otros registros.
          </Ayuda>
        )}
        {!c.activo && (
          <Ayuda tono="atencion" style={{ marginTop: 12 }}>
            Desactivado el {fecha(c.desactivado_en)}{c.motivo_desactivacion ? `: ${c.motivo_desactivacion}` : ''}. Se reactiva desde el listado de Clientes.
          </Ayuda>
        )}
      </div>

      <section className="card">
        <Pestanas opciones={PESTANAS} valor={tab} onChange={irA} />
        <div style={{ padding: 18 }}>
          {tab === 'resumen' && <Resumen c={c} rubro={rubro} irA={irA} />}
          {tab === 'contactos' && <Contactos cliente={c} editable={editable} />}
          {tab === 'ubicaciones' && <Ubicaciones cliente={c} editable={editable} onCambio={recargar} />}
          {tab === 'servicios' && <ServiciosCliente cliente={c} editable={editable} finanzas={verFinanzas(perfil)} onCambio={recargar} />}
          {tab === 'historial' && <Historial cliente={c} />}
        </div>
      </section>

      {editar && (
        <FormCliente clienteId={c.id} onCerrar={() => setEditar(false)}
          onGuardado={() => { setEditar(false); recargar() }}
          onAbrir={(otro) => { setEditar(false); navegar(`/clientes/${otro}`) }} />
      )}
    </div>
  )
}

function Chip({ children, fondo = C.fila }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 'var(--radio-sm)',
      background: fondo, font: '600 12px var(--font)', color: C.tinta,
    }}>{children}</span>
  )
}

// ── Resumen (2.4) ─────────────────────────────────────────────────────────
function Resumen({ c, rubro, irA }) {
  const fila = (l, v) => (
    <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 10, padding: '6px 0', font: '400 14px var(--font)' }}>
      <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v || '—'}</span>
    </div>
  )
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h6 style={{ margin: '0 0 8px' }}>Datos generales</h6>
        <div className="cols2" style={{ gap: '0 28px' }}>
          <div>
            {fila('Tipo', c.tipo_cliente === 'persona' ? 'Persona' : 'Empresa')}
            {fila('Nombre comercial', c.nombre_comercial)}
            {fila('Rubro', rubro)}
            {c.observaciones && fila('Observaciones', c.observaciones)}
          </div>
          <div>
            {fila('Dirección administrativa', c.direccion)}
            {fila('Comuna', c.comuna)}
            {fila('Correo', c.correo && <a href={`mailto:${c.correo}`}>{c.correo}</a>)}
            {fila('Teléfono', c.telefono)}
          </div>
        </div>
      </div>
      <div className="cols2" style={{ gap: 14 }}>
        <Acceso icono={I.pin} rotulo="Ubicaciones activas" valor={c.ubicaciones_activas} onClick={() => irA('ubicaciones')} />
        <Acceso icono={GEAR} rotulo="Servicios vigentes" valor={c.servicios_vigentes} onClick={() => irA('servicios')} />
      </div>
      <Ayuda>Los recuadros abren la pestaña correspondiente. Editar datos usa el mismo formulario del registro con los valores guardados.</Ayuda>
    </div>
  )
}

function Acceso({ icono, rotulo, valor, onClick }) {
  return (
    <button type="button" onClick={onClick} className="indicador" style={{ cursor: 'pointer', textAlign: 'left', width: '100%' }}>
      <Icon d={icono} size={26} color={C.azul} />
      <div style={{ flex: 1 }}><span style={{ color: C.azul, fontWeight: 600 }}>{rotulo}</span><b>{valor}</b></div>
      <Icon d={FLECHA} size={20} color={C.azul} />
    </button>
  )
}

// ── Contactos (2.5) ───────────────────────────────────────────────────────
function Contactos({ cliente, editable }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)   // {} nuevo · contacto a editar
  const cargar = () => contactosDe(cliente.id).then(setLista).catch(setError)
  useEffect(() => { cargar() }, [cliente.id])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="text-muted" style={{ flex: 1 }}>Un cliente puede tener varios contactos. Solo uno principal activo.</span>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})} disabled={!editable}>Agregar contacto</Boton>
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {lista === null ? <div style={{ color: C.gris }}>Cargando…</div> : (
        <div className="card">
          <Tabla filas={lista} vacio="Este cliente aún no tiene contactos." columnas={[
            { k: 'nombre', label: 'Nombre', render: (x) => <span style={{ fontWeight: 600 }}>{x.nombre}</span> },
            { k: 'cargo', label: 'Cargo', render: (x) => x.cargo || '—' },
            {
              k: 'contacto', label: 'Contacto', render: (x) => (
                <div style={{ display: 'grid' }}>
                  {x.telefono && <span>{x.telefono}</span>}
                  {x.correo && <a href={`mailto:${x.correo}`}>{x.correo}</a>}
                  {!x.telefono && !x.correo && '—'}
                </div>
              ),
            },
            { k: 'principal', label: 'Principal', render: (x) => (x.principal && x.activo ? 'Sí' : '—') },
            { k: 'activo', label: 'Estado', render: (x) => <Estado tono={x.activo ? 'ok' : 'neutro'}>{x.activo ? 'Activo' : 'Inactivo'}</Estado> },
            {
              k: 'acciones', label: 'Acciones', alinear: 'right',
              render: (x) => <Boton icono={I.lapiz} onClick={() => setForm(x)} disabled={!editable} style={chico}>Editar</Boton>,
            },
          ]} />
        </div>
      )}
      {form && <FormContacto cliente={cliente} contacto={form} hayPrincipal={(lista || []).some((x) => x.principal && x.activo && x.id !== form.id)}
        onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />}
    </div>
  )
}

function FormContacto({ cliente, contacto, hayPrincipal, onCerrar, onGuardado }) {
  const nuevo = !contacto.id
  const inicial = useMemo(() => ({
    nombre: contacto.nombre || '', cargo: contacto.cargo || '', telefono: contacto.telefono || '',
    correo: contacto.correo || '', principal: nuevo ? !hayPrincipal : !!contacto.principal, activo: contacto.activo !== false,
  }), [])
  const [v, setV] = useState(inicial)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const sucio = JSON.stringify(v) !== JSON.stringify(inicial)
  const set = (k, fmt) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : fmt ? fmt(e.target.value) : e.target.value
    setV((p) => ({ ...p, [k]: val })); setErrores({})
  }
  const cerrar = () => confirmarSalida(sucio) && onCerrar()

  const guardar = async () => {
    const e = {}
    if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!v.telefono && !v.correo.trim()) e.contacto = 'Indica teléfono o correo.'
    if (v.telefono && !telValido(v.telefono)) e.telefono = 'Formato: +56 9 1234 5678'
    if (v.correo && !correoValido(v.correo)) e.correo = 'Correo inválido.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    try {
      await guardarContacto(cliente.id, contacto.id, {
        nombre: v.nombre.trim(), cargo: v.cargo.trim() || null, telefono: v.telefono || null,
        correo: v.correo.trim() || null, principal: v.principal, activo: v.activo,
      })
      onGuardado()
    } catch (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal titulo={nuevo ? 'Agregar contacto' : 'Editar contacto'} ancho={620} onCerrar={cerrar} pie={<>
      <Boton onClick={cerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar contacto'}</Boton>
    </>}>
      <div className="cols2" style={{ gap: 14, padding: 18 }}>
        <Campo etiqueta="Nombre completo" obligatorio error={errores.nombre}>
          <input value={v.nombre} onChange={set('nombre')} maxLength={80} autoFocus />
        </Campo>
        <Campo etiqueta="Cargo"><input value={v.cargo} onChange={set('cargo')} maxLength={60} placeholder="Encargada de obra" /></Campo>
        <Campo etiqueta="Teléfono" error={errores.telefono}>
          <input value={v.telefono} onChange={set('telefono', formatoTel)} inputMode="tel" placeholder="+56 9 1234 5678" />
        </Campo>
        <Campo etiqueta="Correo" error={errores.correo}>
          <input type="email" value={v.correo} onChange={set('correo')} maxLength={120} />
        </Campo>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)' }}>
          <input type="checkbox" checked={v.principal} onChange={set('principal')} /> Contacto principal
        </label>
        {!nuevo && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)' }}>
            <input type="checkbox" checked={v.activo} onChange={set('activo')} /> Contacto activo
          </label>
        )}
      </div>
      <div style={{ padding: '0 18px 18px', display: 'grid', gap: 10 }}>
        <Ayuda tono={errores.contacto ? 'error' : 'info'}>
          {errores.contacto || (v.principal && hayPrincipal
            ? 'Indica teléfono o correo. Al guardar, este pasa a ser el contacto principal y el anterior deja de serlo.'
            : 'Indica teléfono o correo. Un contacto desactivado se conserva en el historial.')}
        </Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── Ubicaciones (2.6 y 2.7) ───────────────────────────────────────────────
function Ubicaciones({ cliente, editable, onCambio }) {
  const [lista, setLista] = useState(null)
  const [contactos, setContactos] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const cargar = () => {
    ubicacionesDe(cliente.id).then(setLista).catch(setError)
    contactosDe(cliente.id).then(setContactos).catch(() => {})
  }
  useEffect(() => { cargar() }, [cliente.id])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="text-muted" style={{ flex: 1 }}>Cada obra o punto de servicio es una ubicación del cliente. No crea un nuevo cliente.</span>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})} disabled={!editable || !cliente.activo}>Agregar ubicación</Boton>
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {lista === null ? <div style={{ color: C.gris }}>Cargando…</div> : (
        <div className="card">
          <Tabla filas={lista} vacio="Este cliente aún no tiene ubicaciones." columnas={[
            { k: 'nombre', label: 'Ubicación', render: (x) => <span style={{ fontWeight: 600 }}>{x.nombre}</span> },
            { k: 'comuna', label: 'Comuna', render: (x) => x.comuna || '—' },
            { k: 'direccion', label: 'Dirección', render: (x) => x.direccion || '—' },
            { k: 'mapa', label: 'En mapa', render: (x) => (x.lat != null && x.lng != null ? 'Sí' : <span style={{ color: C.gris }}>Sin punto</span>) },
            { k: 'activa', label: 'Estado', render: (x) => <Estado tono={x.activa ? 'ok' : 'neutro'}>{x.activa ? 'Activa' : 'Inactiva'}</Estado> },
            {
              k: 'acciones', label: 'Acciones', alinear: 'right',
              render: (x) => <Boton icono={I.ojo} onClick={() => setForm(x)} style={chico}>{editable ? 'Ver / Editar' : 'Ver'}</Boton>,
            },
          ]} />
        </div>
      )}
      <Ayuda>Nombre y dirección son obligatorios. Desactivar una ubicación conserva su historial; no se puede si tiene baños FOSAN o servicios vigentes.</Ayuda>
      {form && <FormUbicacion cliente={cliente} ubicacion={form} otras={(lista || []).filter((x) => x.id !== form.id)}
        contactos={contactos.filter((k) => k.activo || k.id === form.contacto_id)} editable={editable}
        onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar(); onCambio() }} />}
    </div>
  )
}

function FormUbicacion({ cliente, ubicacion, otras, contactos, editable, onCerrar, onGuardado }) {
  const nueva = !ubicacion.id
  const t = (x) => (x === null || x === undefined ? '' : String(x))
  const inicial = useMemo(() => ({
    nombre: t(ubicacion.nombre), direccion: t(ubicacion.direccion), comuna: t(ubicacion.comuna) || (nueva ? cliente.comuna || '' : ''),
    contacto_id: t(ubicacion.contacto_id), lat: t(ubicacion.lat), lng: t(ubicacion.lng),
    indicaciones: t(ubicacion.indicaciones), activa: ubicacion.activa !== false,
  }), [])
  const [v, setV] = useState(inicial)
  const [marcando, setMarcando] = useState(false)
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)     // ubicación parecida: segundo clic guarda igual
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const sucio = JSON.stringify(v) !== JSON.stringify(inicial)
  const soloVer = !editable
  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setV((p) => ({ ...p, [k]: val })); setErrores({}); setAviso(null)
  }
  const cerrar = () => confirmarSalida(sucio) && onCerrar()
  const lat = decimalDe(v.lat), lng = decimalDe(v.lng)
  // Memorizado: el mapa solo se mueve cuando cambian las coordenadas
  const punto = useMemo(() => (lat !== null && lng !== null && v.lat !== '' && v.lng !== ''
    ? { lat: -Math.abs(lat), lng: -Math.abs(lng), volar: true } : null), [v.lat, v.lng])
  const zoomInicial = useMemo(() => (inicial.lat !== '' ? 15 : 10), [])

  const marcar = ({ lat: la, lng: ln }) => {
    setV((p) => ({ ...p, lat: la.toFixed(6), lng: ln.toFixed(6) }))
    setMarcando(false)
  }

  const guardar = async () => {
    const e = {}
    if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!v.direccion.trim()) e.direccion = 'La dirección o referencia es obligatoria.'
    if (!v.comuna.trim()) e.comuna = 'La comuna es obligatoria.'
    if ((v.lat === '') !== (v.lng === '')) e.coords = 'Faltan latitud o longitud.'
    if (v.lat !== '' && (lat === null || Math.abs(lat) < 17 || Math.abs(lat) > 56)) e.coords = 'Latitud fuera de Chile.'
    if (v.lng !== '' && (lng === null || Math.abs(lng) < 66 || Math.abs(lng) > 76)) e.coords = 'Longitud fuera de Chile.'
    setErrores(e)
    if (Object.keys(e).length) return

    const parecida = otras.find((o) => normal(o.nombre) === normal(v.nombre) || (normal(o.direccion) && normal(o.direccion) === normal(v.direccion)))
    if (parecida && !aviso) { setAviso(parecida); return }

    setGuardando(true); setError(null)
    try {
      if (!nueva && inicial.activa && !v.activa) {
        const uso = await usoUbicacion(ubicacion.id)
        if (uso.banos || uso.servicios) {
          throw new Error(`No se puede desactivar: tiene ${uso.banos} baño(s) FOSAN y ${uso.servicios} servicio(s) vigente(s) en esta ubicación.`)
        }
      }
      await guardarUbicacion(cliente.id, ubicacion.id, {
        nombre: v.nombre.trim(), direccion: v.direccion.trim(), comuna: v.comuna.trim(),
        contacto_id: v.contacto_id || null, indicaciones: v.indicaciones.trim() || null, activa: v.activa,
        lat: v.lat !== '' ? -Math.abs(lat) : null, lng: v.lng !== '' ? -Math.abs(lng) : null,
      })
      onGuardado()
    } catch (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal titulo={nueva ? 'Agregar ubicación' : soloVer ? v.nombre : 'Editar ubicación'} ancho={860} onCerrar={cerrar} pie={soloVer
      ? <Boton onClick={onCerrar}>Cerrar</Boton>
      : <>
        <Boton onClick={cerrar}>Cancelar</Boton>
        <Boton tipo="principal" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : aviso ? 'Guardar igual' : 'Guardar ubicación'}
        </Boton>
      </>}>
      <fieldset disabled={soloVer} style={{ border: 0, margin: 0, padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Campo etiqueta="Cliente" style={{ flex: 1, minWidth: 220 }}><input value={cliente.nombre} readOnly /></Campo>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)', minHeight: 40 }}>
            <input type="checkbox" checked={v.activa} onChange={set('activa')} /> Ubicación activa
          </label>
        </div>
        <div className="cols2" style={{ gap: 14 }}>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <Campo etiqueta="Nombre de ubicación" obligatorio error={errores.nombre}>
              <input value={v.nombre} onChange={set('nombre')} maxLength={80} placeholder="OBRA CENTRO" autoFocus={nueva} />
            </Campo>
            <Campo etiqueta="Comuna" obligatorio error={errores.comuna}>
              <input value={v.comuna} onChange={set('comuna')} maxLength={60} list="comunas-maule-ub" placeholder="Seleccionar o escribir" />
              <datalist id="comunas-maule-ub">{COMUNAS_MAULE.map((x) => <option key={x} value={x} />)}</datalist>
            </Campo>
            <Campo etiqueta="Contacto en terreno">
              <select value={v.contacto_id} onChange={set('contacto_id')}>
                <option value="">Sin contacto</option>
                {contactos.map((k) => <option key={k.id} value={k.id}>{k.nombre}{k.cargo ? ` (${k.cargo})` : ''}</option>)}
              </select>
            </Campo>
          </div>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <Campo etiqueta="Dirección o referencia de acceso" obligatorio error={errores.direccion}>
              <input value={v.direccion} onChange={set('direccion')} maxLength={160} placeholder="AV. CENTRAL 120" />
            </Campo>
            <Campo etiqueta="Indicaciones de acceso">
              <textarea value={v.indicaciones} onChange={set('indicaciones')} maxLength={300} style={{ minHeight: 76 }}
                placeholder="Portón principal color gris. Oficina en contenedor." />
            </Campo>
          </div>
        </div>

        <div className="campo" style={{ gap: 8 }}>
          <span>Ubicación en mapa</span>
          <div style={{ border: `1px solid ${marcando ? C.azul : C.borde}`, borderRadius: 'var(--radio-md)', overflow: 'hidden' }}>
            <Mapa alto={220} zoom={zoomInicial} pendiente={punto} onClickMapa={marcando ? marcar : undefined} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {!soloVer && (
              <Boton tipo={marcando ? 'principal' : 'secundario'} icono={I.pin} onClick={() => setMarcando((x) => !x)}>
                {marcando ? 'Haz clic en el mapa…' : punto ? 'Mover punto' : 'Marcar en mapa'}
              </Boton>
            )}
            <Campo etiqueta="Latitud" style={{ width: 140 }}><input value={v.lat} onChange={set('lat')} inputMode="decimal" placeholder="-35.4263" /></Campo>
            <Campo etiqueta="Longitud" style={{ width: 140 }}><input value={v.lng} onChange={set('lng')} inputMode="decimal" placeholder="-71.6551" /></Campo>
            {punto && !soloVer && <Boton onClick={() => setV((p) => ({ ...p, lat: '', lng: '' }))}>Quitar punto</Boton>}
          </div>
          {errores.coords && <small style={{ color: C.rojo }}>{errores.coords}</small>}
        </div>

        <Ayuda>Las coordenadas sirven para mostrar el punto en el mapa; no son seguimiento GPS.</Ayuda>
        {aviso && (
          <Ayuda tono="atencion">
            Ya existe una ubicación parecida: <b>{aviso.nombre}</b> ({aviso.direccion || 'sin dirección'}{aviso.activa ? '' : ', inactiva'}).
            Si es otro punto, aprieta <b>Guardar igual</b>; si es la misma, cancela y edita esa.
          </Ayuda>
        )}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </fieldset>
    </Modal>
  )
}

// ── Historial (2.10) ──────────────────────────────────────────────────────
const L_TABLA = { clientes: 'Cliente', cliente_contactos: 'Contacto', servicios_cliente: 'Servicio', ubicaciones: 'Ubicación' }
const L_ACCION = { crear: 'creación', modificar: 'modificación', eliminar: 'eliminación' }
const OCULTOS = new Set(['id', 'cliente_id', 'rut_norm', 'creado_en', 'actualizado_en', 'desactivado_por'])
const valorTexto = (x) => (x === null || x === undefined || x === '' ? '—' : typeof x === 'object' ? JSON.stringify(x) : String(x))

function Historial({ cliente }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [ver, setVer] = useState(null)
  useEffect(() => { historialCliente(cliente.id).then(setLista).catch(setError) }, [cliente.id])
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {lista === null && !error ? <div style={{ color: C.gris }}>Cargando…</div> : lista && (
        <div className="card">
          <Tabla filas={lista} vacio="Sin cambios registrados." columnas={[
            { k: 'fecha', label: 'Fecha', render: (x) => fechaHora(x.fecha) },
            { k: 'registro', label: 'Registro', render: (x) => `${L_TABLA[x.tabla] || x.tabla} ${x.etiqueta || ''} · ${L_ACCION[x.accion] || x.accion}` },
            { k: 'usuario_nombre', label: 'Responsable', render: (x) => x.usuario_nombre || '—' },
            { k: 'accion', label: 'Acción', alinear: 'right', render: (x) => <a href="#" onClick={(e) => { e.preventDefault(); setVer(x) }}>Ver registro</a> },
          ]} />
        </div>
      )}
      <Ayuda>Solo lectura: el historial no se puede editar ni borrar.</Ayuda>
      {ver && (
        <Modal titulo={`${L_TABLA[ver.tabla] || ver.tabla} ${ver.etiqueta || ''}`} ancho={560} onCerrar={() => setVer(null)}
          pie={<Boton onClick={() => setVer(null)}>Cerrar</Boton>}>
          <div style={{ padding: 18, display: 'grid', gap: 10, font: '400 14px/1.5 var(--font)' }}>
            <span className="text-muted">{fechaHora(ver.fecha)} · {ver.usuario_nombre || '—'} · {L_ACCION[ver.accion] || ver.accion}</span>
            <table>
              <thead><tr><th>Campo</th>{ver.accion === 'modificar' ? <><th>Antes</th><th>Después</th></> : <th>Valor</th>}</tr></thead>
              <tbody>
                {Object.entries(ver.cambios || {}).filter(([k]) => !OCULTOS.has(k)).map(([k, x]) => (
                  <tr key={k}>
                    <td style={{ fontWeight: 600 }}>{k.replace(/_/g, ' ')}</td>
                    {ver.accion === 'modificar'
                      ? <><td>{valorTexto(x?.antes)}</td><td>{valorTexto(x?.despues)}</td></>
                      : <td>{valorTexto(x)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  )
}
