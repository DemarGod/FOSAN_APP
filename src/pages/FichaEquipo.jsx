// Inventario → Ficha del equipo (láminas 3.5 Datos generales, 3.6 Asignación y ubicación, 3.7 Movimientos, 3.8 Mantenimiento).
// Número y propiedad no se modifican aquí; la ubicación cambia mediante movimientos; el historial es solo lectura.
// Los vehículos siguen usando la ficha anterior hasta la etapa de Flota.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import Mapa from '../components/Mapa'
import Ficha from './Ficha'
import { Boton, Campo, Tabla, Pestanas, Estado, Ayuda } from '../components/Base'
import { L_SITUACION, L_CONDICION, TONO_SITUACION, TONO_CONDICION } from '../components/InvEquipos'
import {
  equipoPorQr, ultimaEntrega, movimientosDe, mantencionesEquipo, personalActivo, actualizarEquipo, moverEquipo, darDeBaja,
  catModelos, catUbicacionesInternas, crearMantencion, documentosDe, observacionesDe, agregarObservacion,
} from '../lib/api'
import { useSesion, puedeOperar, esDueno } from '../lib/sesion'
import { hoyISO } from '../lib/costos'
import { C, Icon, I, qrCeldas, fecha, fechaHora, COLORES_BANO, L_ESTADO_MANT } from '../lib/ui'

const PESTANAS = [
  { v: 'datos', l: 'Datos generales' },
  { v: 'asignacion', l: 'Asignación y ubicación' },
  { v: 'movimientos', l: 'Movimientos' },
  { v: 'mantenimiento', l: 'Mantenimiento' },
]
const L_MOV = {
  ingreso: 'Alta', traslado: 'Traslado interno', envio_taller: 'Envío a taller', retorno_taller: 'Retorno de taller',
  ajuste: 'Ajuste autorizado', baja: 'Baja', cambio_estado: 'Cambio de estado', instalacion: 'Entrega', entrega: 'Entrega',
  retiro: 'Retiro', limpieza: 'Limpieza', mantencion: 'Mantención',
}
const L_MOTIVO_BAJA = { venta: 'Venta', donacion: 'Donación', perdida: 'Pérdida definitiva', otro: 'Otro' }
const VOLVER = 'M19 12H5M11 6l-6 6 6 6'
const chico = { minHeight: 34, padding: '6px 12px' }
const ahoraLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export default function FichaEquipo() {
  const { token } = useParams()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = PESTANAS.some((p) => p.v === params.get('tab')) ? params.get('tab') : 'datos'
  const irA = (v) => setParams(v === 'datos' ? {} : { tab: v }, { replace: true })
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'banos')

  const [e, setE] = useState(undefined)
  const [error, setError] = useState(null)
  const [editar, setEditar] = useState(false)
  const [baja, setBaja] = useState(false)
  const [version, setVersion] = useState(0)
  const recargar = () => setVersion((n) => n + 1)
  useEffect(() => { equipoPorQr(token).then(setE).catch((x) => { setError(x); setE(null) }) }, [token, version])

  if (e === undefined) return <div style={{ padding: 24, color: C.gris }}>Cargando ficha…</div>
  if (e?.esVehiculo) return <Ficha />
  if (!e) {
    return (
      <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
        <h2 style={{ margin: 0 }}>Unidad no encontrada</h2>
        <span className="text-muted">Este código no corresponde a ningún equipo registrado, o tu usuario no tiene permiso para verlo.</span>
        <div><Boton onClick={() => navegar('/inventario')}>Ir a Inventario</Boton></div>
      </div>
    )
  }
  const dadoDeBaja = e.situacion === 'baja'
  const externo = e.propiedad === 'cliente'

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <a href="/inventario" onClick={(x) => { x.preventDefault(); navegar('/inventario') }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 13px var(--font)' }}>
          <Icon d={VOLVER} size={16} /> Volver a Equipos
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <h2 style={{ margin: 0, flex: '1 1 260px' }}>{externo ? e.codigo : `Unidad ${e.codigo}`} · {e.categoria || 'Equipo'}</h2>
          <Chip titulo="Propiedad" fondo={C.fila}>{externo ? 'Cliente' : 'Empresa'}</Chip>
          <Chip titulo="Situación" fondo={C.tinte}><Estado tono={TONO_SITUACION[e.situacion]}>{L_SITUACION[e.situacion] || '—'}</Estado></Chip>
          <Chip titulo="Condición" fondo="#e6f4ea"><Estado tono={TONO_CONDICION[e.condicion]}>{L_CONDICION[e.condicion] || '—'}</Estado></Chip>
          <Boton tipo="principal" icono={I.lapiz} onClick={() => setEditar(true)} disabled={!editable || dadoDeBaja}>Editar datos</Boton>
          {!externo && (
            <button type="button" className="btn" onClick={() => setBaja(true)} disabled={!editable || dadoDeBaja}
              style={{ color: C.rojo, borderColor: C.rojo }}>Dar de baja</button>
          )}
        </div>
        {dadoDeBaja && (
          <Ayuda tono="atencion" style={{ marginTop: 12 }}>
            Dado de baja{e.fecha_baja ? ` el ${fecha(e.fecha_baja)}` : ''}{e.motivo_baja ? ` · ${L_MOTIVO_BAJA[e.motivo_baja] || e.motivo_baja}` : ''}
            {e.observacion_baja ? ` · ${e.observacion_baja}` : ''}. Se conserva todo su historial.
          </Ayuda>
        )}
      </div>

      <section className="card">
        <Pestanas opciones={PESTANAS} valor={tab} onChange={irA} />
        <div style={{ padding: 18 }}>
          {tab === 'datos' && <Datos e={e} editable={editable} />}
          {tab === 'asignacion' && <Asignacion e={e} />}
          {tab === 'movimientos' && <Movimientos e={e} editable={editable} dueno={esDueno(perfil)} onCambio={recargar} />}
          {tab === 'mantenimiento' && <Mantenimiento e={e} editable={editable} />}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: '#fef7e0', border: `1px solid ${C.amarillo}`, borderRadius: 'var(--radio-md)', font: '400 13px/1.5 var(--font)' }}>
        <Icon d={I.alert} size={18} color={C.amarillo} />
        <span><b>Dar de baja:</b> formulario con Fecha, Motivo (venta, donación, pérdida definitiva u otro) y Observaciones. Se confirma solo sin reservas, asignaciones u órdenes abiertas; conserva el historial. No localizado no equivale a baja definitiva.</span>
      </div>

      {editar && <EditarDatos e={e} onCerrar={() => setEditar(false)} onGuardado={() => { setEditar(false); recargar() }} />}
      {baja && <DarDeBaja e={e} onCerrar={() => setBaja(false)} onListo={() => { setBaja(false); recargar() }} />}
    </div>
  )
}

function Chip({ titulo, fondo, children }) {
  return (
    <span style={{ display: 'inline-grid', padding: '4px 12px', borderRadius: 'var(--radio-sm)', background: fondo, lineHeight: 1.2 }}>
      <small style={{ font: '400 11px var(--font)', color: C.gris }}>{titulo}</small>
      <span style={{ font: '600 13px var(--font)' }}>{children}</span>
    </span>
  )
}
const Fila = ({ l, v }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 10, padding: '6px 0', font: '400 14px var(--font)' }}>
    <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v || '—'}</span>
  </div>
)

// ── 3.5 Datos generales ───────────────────────────────────────────────────
function Datos({ e, editable }) {
  const [docs, setDocs] = useState([])
  const [obs, setObs] = useState([])
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState(null)
  useEffect(() => {
    documentosDe(e.id).then(setDocs).catch(() => {})
    observacionesDe(e.id).then(setObs).catch(() => {})
  }, [e.id])
  const guardarObs = async () => {
    if (!nueva.trim()) return
    try { await agregarObservacion(e.id, nueva.trim()); setObs(await observacionesDe(e.id)); setNueva('') } catch (x) { setError(x) }
  }
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24, alignItems: 'start' }}>
        <div>
          <Fila l="Número de unidad" v={e.codigo} />
          {e.codigo_cliente && <Fila l="Identificador del cliente" v={e.codigo_cliente} />}
          <Fila l="Categoría" v={e.categoria} />
          <Fila l="Marca" v={e.marca} />
          <Fila l="Modelo" v={e.modelo} />
          <Fila l="Color" v={e.color} />
          <Fila l="Fecha incorporación" v={e.fecha_incorporacion ? fecha(e.fecha_incorporacion) : null} />
          <Fila l="Observaciones" v={e.notas} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <svg width={160} height={160} viewBox="0 0 160 160" style={{ border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', background: '#fff' }}>
            {qrCeldas(e.qr_token).map((q, i) => <rect key={i} x={q.x} y={q.y} width={8} height={8} fill={C.tinta} />)}
          </svg>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>QR único de esta unidad</div>
        </div>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', font: '600 14px var(--font)' }}>Documentos ({docs.length}) y observaciones ({obs.length})</summary>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {docs.map((d) => (
            <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon d={I.doc} size={16} color={C.azul} /><span style={{ flex: 1 }}>{d.titulo} · {fecha(d.creado_en)}</span>
              <a href={d.archivo_url} target="_blank" rel="noreferrer">Descargar</a>
            </div>
          ))}
          {obs.map((o) => <div key={o.id} style={{ font: '400 13px/1.5 var(--font)' }}><span className="text-muted">{fechaHora(o.creado_en)} · </span>{o.texto}</div>)}
          {editable && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nueva} onChange={(x) => setNueva(x.target.value)} maxLength={300} placeholder="Agregar observación…"
                style={{ flex: 1, minWidth: 0, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-sm)', padding: '8px 12px', font: '400 14px var(--font)' }} />
              <Boton onClick={guardarObs} disabled={!nueva.trim()}>Agregar</Boton>
            </div>
          )}
          {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
        </div>
      </details>
    </div>
  )
}

function EditarDatos({ e, onCerrar, onGuardado }) {
  const inicial = useMemo(() => ({ marca: e.marca || '', modelo_id: e.modelo_id || '', color: e.color || '', notas: e.notas || '' }), [])
  const [v, setV] = useState(inicial)
  const [modelos, setModelos] = useState([])
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { catModelos().then((m) => setModelos(m.filter((x) => x.categoria_id === e.categoria_id && (x.activo || x.id === e.modelo_id)))).catch(setError) }, [])
  const set = (k) => (x) => { setV((p) => ({ ...p, [k]: x.target.value })); setErrores({}) }
  const sucio = JSON.stringify(v) !== JSON.stringify(inicial)
  const cerrar = () => (!sucio || window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) && onCerrar()
  const guardar = async () => {
    const er = {}
    if (!v.marca.trim()) er.marca = 'La marca es obligatoria.'
    if (modelos.length && !v.modelo_id) er.modelo_id = 'Elige el modelo.'
    setErrores(er)
    if (Object.keys(er).length) return
    setGuardando(true)
    try {
      await actualizarEquipo(e.id, { marca: v.marca.trim(), modelo_id: v.modelo_id || null, color: v.color || null, notas: v.notas.trim() || null })
      onGuardado()
    } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo="Editar datos" ancho={520} onCerrar={cerrar} pie={<>
      <Boton onClick={cerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <Campo etiqueta="Número de unidad"><input value={e.codigo} readOnly /></Campo>
        <Campo etiqueta="Marca" obligatorio error={errores.marca}><input value={v.marca} onChange={set('marca')} maxLength={40} /></Campo>
        <Campo etiqueta="Modelo" obligatorio={modelos.length > 0} error={errores.modelo_id}>
          <select value={v.modelo_id} onChange={set('modelo_id')} disabled={!modelos.length}>
            <option value="">Seleccionar</option>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Color">
          <select value={v.color} onChange={set('color')}>
            <option value="">Seleccionar</option>
            {[...new Set([...COLORES_BANO, ...(e.color && !COLORES_BANO.includes(e.color) ? [e.color] : [])])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Observaciones"><textarea value={v.notas} onChange={set('notas')} maxLength={500} style={{ minHeight: 60 }} /></Campo>
        <Ayuda>Número y propiedad no se modifican desde esta edición. La ubicación cambia mediante movimientos.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 3.6 Asignación y ubicación ────────────────────────────────────────────
function Asignacion({ e }) {
  const navegar = useNavigate()
  const [entrega, setEntrega] = useState(undefined)
  useEffect(() => { ultimaEntrega(e.id).then(setEntrega).catch(() => setEntrega(null)) }, [e.id])
  const clienteId = e.propiedad === 'cliente' ? e.propietario_id : e.cliente_id
  const clienteNombre = e.propiedad === 'cliente' ? e.propietario : e.cliente
  const fEntrega = entrega?.fecha_realizada || entrega?.fecha_programada
  const dias = fEntrega && e.situacion === 'asignado' ? Math.max(0, Math.round((new Date(hoyISO()) - new Date(fEntrega)) / 864e5)) : null
  const punto = e.ubic?.lat != null ? { lat: Number(e.ubic.lat), lng: Number(e.ubic.lng) } : null
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="cols2" style={{ gap: 20, alignItems: 'start' }}>
        <div>
          <Fila l={e.propiedad === 'cliente' ? 'Propietario' : 'Cliente'} v={clienteNombre} />
          <Fila l="Ubicación" v={e.ubicacion} />
          <Fila l="Dirección" v={[e.ubic?.direccion, e.ubic?.comuna].filter(Boolean).join(', ')} />
          <Fila l="Servicio" v={e.servicio?.codigo} />
          <Fila l="Orden de entrega" v={entrega === undefined ? '…' : entrega?.folio} />
          <Fila l="Fecha entrega" v={fEntrega ? fecha(fEntrega) : null} />
          <Fila l="Días desde entrega" v={dias != null ? String(dias) : null} />
        </div>
        <div style={{ border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', overflow: 'hidden' }}>
          {punto
            ? <Mapa alto={240} zoom={14} pendiente={{ ...punto, volar: true }} />
            : <div style={{ padding: 24, color: C.gris, textAlign: 'center' }}>La ubicación no tiene punto en el mapa.</div>}
          {punto && <div className="text-muted" style={{ fontSize: 12, padding: '6px 10px' }}>Última ubicación registrada</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Boton icono={I.users} onClick={() => navegar(`/clientes/${clienteId}`)} disabled={!clienteId}>Ver cliente</Boton>
        <Boton icono={I.doc} onClick={() => navegar(`/clientes/${e.servicio?.cliente_id}?tab=servicios`)} disabled={!e.servicio}>Ver servicio</Boton>
        <Boton icono={I.clip} disabled title="Llega con Operaciones (etapa 4)">Ver orden</Boton>
        <Boton icono={I.pin} onClick={() => window.open(`https://www.google.com/maps?q=${punto.lat},${punto.lng}`, '_blank', 'noopener')} disabled={!punto}>Abrir mapa</Boton>
        <Boton tipo="principal" disabled title="Llega con Operaciones (etapa 4)">Solicitar retiro</Boton>
      </div>
      <Ayuda>Solicitar retiro abre una orden en Operaciones (llega en la etapa 4). Solo su ejecución confirmada actualiza la ubicación; no es seguimiento GPS.</Ayuda>
    </div>
  )
}

// ── 3.7 Movimientos (+ movimiento interno) ────────────────────────────────
function Movimientos({ e, editable, dueno, onCambio }) {
  const [lista, setLista] = useState(null)
  const [form, setForm] = useState(false)
  const [error, setError] = useState(null)
  const cargar = () => movimientosDe(e.id).then(setLista).catch(setError)
  useEffect(() => { cargar() }, [e.id])
  const bloqueo = e.propiedad !== 'empresa' ? 'Los equipos del cliente no se mueven desde aquí.'
    : e.situacion === 'baja' ? 'El equipo está dado de baja.'
      : ['asignado', 'reservado'].includes(e.situacion) ? 'El equipo está con un cliente: los arriendos se cierran en Operaciones.' : null
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="text-muted" style={{ flex: 1 }}>Historial solo lectura; se corrige mediante un registro vinculado, sin borrar eventos.</span>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm(true)} disabled={!editable || !!bloqueo} title={bloqueo || undefined}>Movimiento interno</Boton>
      </div>
      {bloqueo && <Ayuda>{bloqueo}</Ayuda>}
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {lista === null ? <div style={{ color: C.gris }}>Cargando…</div> : (
        <div className="card">
          <Tabla filas={lista} vacio="Sin movimientos registrados." columnas={[
            { k: 'fecha', label: 'Fecha y hora', render: (m) => fechaHora(m.fecha) },
            { k: 'tipo', label: 'Tipo', render: (m) => L_MOV[m.tipo] || m.tipo },
            { k: 'od', label: 'Origen → destino', render: (m) => (m.desde?.nombre || m.hacia?.nombre ? `${m.desde?.nombre || '—'} → ${m.hacia?.nombre || '—'}` : m.clientes?.nombre || '—') },
            { k: 'resp', label: 'Responsable', render: (m) => m.responsable?.nombre || (m.detalle?.match(/Responsable: ([^·]+)/)?.[1]?.trim()) || '—' },
            { k: 'detalle', label: 'Detalle', render: (m) => <span className="text-muted" style={{ fontSize: 13 }}>{m.detalle || '—'}</span> },
          ]} />
        </div>
      )}
      {form && <MovimientoInterno e={e} dueno={dueno} onCerrar={() => setForm(false)} onListo={() => { setForm(false); cargar(); onCambio() }} />}
    </div>
  )
}

function MovimientoInterno({ e, dueno, onCerrar, onListo }) {
  const [ubi, setUbi] = useState([])
  const [personas, setPersonas] = useState([])
  const enTaller = e.ubicacion_tipo === 'taller'
  const [v, setV] = useState({ tipo: enTaller ? 'retorno_taller' : 'traslado', destino: '', fecha: ahoraLocal(), persona: '', motivo: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    Promise.all([catUbicacionesInternas(), personalActivo()]).then(([u, p]) => { setUbi(u.filter((x) => x.activa && x.id !== e.ubicacion_id)); setPersonas(p) }).catch(setError)
  }, [])
  const set = (k) => (x) => { setV((p) => ({ ...p, [k]: x.target.value, ...(k === 'tipo' ? { destino: '' } : {}) })); setErrores({}) }
  const tipoDestino = v.tipo === 'envio_taller' ? 'taller' : v.tipo === 'retorno_taller' ? 'bodega' : null
  const destinos = ubi.filter((u) => !tipoDestino || u.tipo === tipoDestino)
  const confirmar = async () => {
    const er = {}
    if (!v.destino) er.destino = 'Elige el destino.'
    if (!v.fecha) er.fecha = 'Indica fecha y hora.'
    else if (v.fecha > ahoraLocal()) er.fecha = 'No puede ser una fecha futura.'
    if (!v.persona) er.persona = 'Elige el responsable.'
    if (v.tipo === 'ajuste' && v.motivo.trim().length < 3) er.motivo = 'El ajuste requiere motivo.'
    setErrores(er)
    if (Object.keys(er).length) return
    const p = personas.find((x) => x.id === v.persona)
    setGuardando(true)
    try {
      await moverEquipo({ activo: e.id, tipo: v.tipo, destino: v.destino, fecha: new Date(v.fecha).toISOString(),
        responsable: p?.perfil_id, responsableNombre: p?.nombre, motivo: v.motivo.trim() })
      onListo()
    } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo={`Movimiento interno · Unidad ${e.codigo}`} ancho={680} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={confirmar} disabled={guardando}>{guardando ? 'Guardando…' : 'Confirmar movimiento'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div className="cols2" style={{ gap: 12 }}>
          <Campo etiqueta="Unidad"><input value={e.codigo} readOnly /></Campo>
          <Campo etiqueta="Origen"><input value={e.ubicacion || 'Sin ubicación'} readOnly /></Campo>
          <Campo etiqueta="Tipo" obligatorio>
            <select value={v.tipo} onChange={set('tipo')}>
              <option value="traslado">Traslado interno</option>
              <option value="envio_taller">Envío a taller</option>
              <option value="retorno_taller">Retorno de taller</option>
              {dueno && <option value="ajuste">Ajuste autorizado</option>}
            </select>
          </Campo>
          <Campo etiqueta="Destino" obligatorio error={errores.destino}
            ayuda={!destinos.length ? (tipoDestino === 'taller' ? 'No hay talleres: créalo en Administración → Catálogos → Ubicaciones internas.' : 'No hay destinos disponibles.') : undefined}>
            <select value={v.destino} onChange={set('destino')}>
              <option value="">Seleccionar</option>
              {destinos.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Fecha y hora" obligatorio error={errores.fecha}>
            <input type="datetime-local" value={v.fecha} max={ahoraLocal()} onChange={set('fecha')} />
          </Campo>
          <Campo etiqueta="Responsable" obligatorio error={errores.persona}>
            <select value={v.persona} onChange={set('persona')}>
              <option value="">Seleccionar</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Motivo" obligatorio={v.tipo === 'ajuste'} error={errores.motivo}>
          <textarea value={v.motivo} onChange={set('motivo')} maxLength={300} style={{ minHeight: 56 }} placeholder="Reorganización de bodega" />
        </Campo>
        <Ayuda>
          Opciones: traslado interno, envío a taller, retorno de taller y ajuste autorizado (solo dueño). No se cierran arriendos desde aquí.
          {v.tipo === 'envio_taller' && ' El equipo queda En mantenimiento.'}
          {v.tipo === 'retorno_taller' && ' El equipo vuelve Disponible y Operativo.'}
          {' '}Se registran usuario y fecha automáticamente.
        </Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 3.8 Mantenimiento ─────────────────────────────────────────────────────
const TIPOS_MANT = ['Preventivo', 'Correctivo', 'Inspección']
const TONO_MANT = { programada: 'info', proxima: 'atencion', urgente: 'error', completada: 'ok', anulada: 'neutro' }

function Mantenimiento({ e, editable }) {
  const [lista, setLista] = useState(null)
  const [form, setForm] = useState(false)
  const [ver, setVer] = useState(null)
  const [error, setError] = useState(null)
  const cargar = () => mantencionesEquipo(e.id).then(setLista).catch(setError)
  useEffect(() => { cargar() }, [e.id])
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="text-muted" style={{ flex: 1 }}>Consulta el mismo registro del módulo Mantenimiento. La limpieza de servicio se registra en Operaciones.</span>
        <Boton tipo="principal" onClick={() => setForm(true)} disabled={!editable || e.situacion === 'baja'}>Programar mantenimiento</Boton>
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {lista === null ? <div style={{ color: C.gris }}>Cargando…</div> : (
        <div className="card">
          <Tabla filas={lista} vacio="Sin mantenimientos registrados." columnas={[
            { k: 'tipo', label: 'Tipo' },
            { k: 'fecha', label: 'Fecha programada', render: (m) => fecha(m.fecha_programada) },
            { k: 'resp', label: 'Responsable', render: (m) => m.responsable?.nombre || m.responsable_ext || '—' },
            { k: 'estado', label: 'Estado', render: (m) => <Estado tono={TONO_MANT[m.estado]}>{L_ESTADO_MANT[m.estado] || m.estado}</Estado> },
            { k: 'accion', label: 'Acción', alinear: 'right', render: (m) => <Boton onClick={() => setVer(m)} style={chico}>Ver</Boton> },
          ]} />
        </div>
      )}
      {form && <ProgramarMant e={e} onCerrar={() => setForm(false)} onListo={() => { setForm(false); cargar() }} />}
      {ver && (
        <Modal titulo={`${ver.tipo} · ${fecha(ver.fecha_programada)}`} ancho={480} onCerrar={() => setVer(null)} pie={<Boton onClick={() => setVer(null)}>Cerrar</Boton>}>
          <div style={{ padding: 18 }}>
            <Fila l="Estado" v={L_ESTADO_MANT[ver.estado] || ver.estado} />
            <Fila l="Responsable" v={ver.responsable?.nombre || ver.responsable_ext} />
            <Fila l="Fecha realizada" v={ver.fecha_realizada ? fecha(ver.fecha_realizada) : null} />
            <Fila l="Trabajo" v={ver.detalle} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function ProgramarMant({ e, onCerrar, onListo }) {
  const [personas, setPersonas] = useState([])
  const [v, setV] = useState({ tipo: 'Preventivo', fecha: hoyISO(), persona: '', detalle: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { personalActivo().then(setPersonas).catch(setError) }, [])
  const set = (k) => (x) => { setV((p) => ({ ...p, [k]: x.target.value })); setErrores({}) }
  const guardar = async () => {
    const er = {}
    if (!v.fecha) er.fecha = 'Indica la fecha programada.'
    if (!v.persona) er.persona = 'Elige el responsable.'
    if (!v.detalle.trim()) er.detalle = 'Describe el trabajo requerido.'
    setErrores(er)
    if (Object.keys(er).length) return
    const p = personas.find((x) => x.id === v.persona)
    setGuardando(true)
    try {
      await crearMantencion({
        activo_id: e.id, clase: e.tipo === 'bano_quimico' ? 'bano' : 'equipo', tipo: v.tipo, fecha_programada: v.fecha,
        responsable_id: p?.perfil_id || null, responsable_ext: p?.perfil_id ? null : p?.nombre, detalle: v.detalle.trim(), estado: 'programada',
      })
      onListo()
    } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo={`Programar mantenimiento · Unidad ${e.codigo}`} ancho={620} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar programación'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div className="cols2" style={{ gap: 12 }}>
          <Campo etiqueta="Unidad"><input value={e.codigo} readOnly /></Campo>
          <Campo etiqueta="Responsable" obligatorio error={errores.persona}>
            <select value={v.persona} onChange={set('persona')}>
              <option value="">Seleccionar</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Tipo" obligatorio>
            <select value={v.tipo} onChange={set('tipo')}>{TIPOS_MANT.map((t) => <option key={t}>{t}</option>)}</select>
          </Campo>
          <Campo etiqueta="Fecha programada" obligatorio error={errores.fecha}>
            <input type="date" value={v.fecha} onChange={set('fecha')} />
          </Campo>
        </div>
        <Campo etiqueta="Trabajo requerido" obligatorio error={errores.detalle}>
          <textarea value={v.detalle} onChange={set('detalle')} maxLength={500} style={{ minHeight: 60 }} placeholder="Revisión de bisagras y cierre" />
        </Campo>
        <Ayuda>Programar no completa el trabajo ni cambia la situación del equipo.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── Dar de baja ───────────────────────────────────────────────────────────
function DarDeBaja({ e, onCerrar, onListo }) {
  const [v, setV] = useState({ fecha: hoyISO(), motivo: '', obs: '' })
  const [paso, setPaso] = useState(1)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (x) => { setV((p) => ({ ...p, [k]: x.target.value })); setErrores({}); setPaso(1) }
  const revisar = () => {
    const er = {}
    if (!v.fecha) er.fecha = 'Indica la fecha.'
    else if (v.fecha > hoyISO()) er.fecha = 'No puede ser una fecha futura.'
    if (!v.motivo) er.motivo = 'Elige el motivo.'
    if (v.motivo === 'otro' && v.obs.trim().length < 3) er.obs = 'Explica el motivo.'
    setErrores(er)
    if (!Object.keys(er).length) setPaso(2)
  }
  const confirmar = async () => {
    setGuardando(true)
    try { await darDeBaja(e.id, v.fecha, v.motivo, v.obs.trim()); onListo() } catch (x) { setError(x); setGuardando(false); setPaso(1) }
  }
  return (
    <Modal titulo={`Dar de baja · Unidad ${e.codigo}`} ancho={520} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      {paso === 1
        ? <Boton tipo="peligro" onClick={revisar}>Continuar</Boton>
        : <Boton tipo="peligro" onClick={confirmar} disabled={guardando}>{guardando ? 'Guardando…' : 'Confirmar baja'}</Boton>}
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div className="cols2" style={{ gap: 12 }}>
          <Campo etiqueta="Fecha" obligatorio error={errores.fecha}><input type="date" value={v.fecha} max={hoyISO()} onChange={set('fecha')} /></Campo>
          <Campo etiqueta="Motivo" obligatorio error={errores.motivo}>
            <select value={v.motivo} onChange={set('motivo')}>
              <option value="">Seleccionar</option>
              {Object.entries(L_MOTIVO_BAJA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Observaciones" obligatorio={v.motivo === 'otro'} error={errores.obs}>
          <textarea value={v.obs} onChange={set('obs')} maxLength={300} style={{ minHeight: 60 }} />
        </Campo>
        {paso === 2
          ? <Ayuda tono="error">¿Confirmas dar de baja la unidad {e.codigo} por {L_MOTIVO_BAJA[v.motivo].toLowerCase()} el {fecha(v.fecha)}? Su número no se reutiliza y el historial se conserva.</Ayuda>
          : <Ayuda tono="atencion">Solo se confirma sin reservas, asignaciones, despachos ni mantenciones abiertas. No localizado no equivale a baja definitiva.</Ayuda>}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}
