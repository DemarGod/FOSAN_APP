// Mantenimiento (lámina 6): programación, registro e historial de equipos y vehículos.
// 6.1 Pendientes / Historial · 6.2 Programar · 6.3 Detalle MANT-### · 6.4 Registrar resultado · Exportar.
// "En curso" = trabajo iniciado. Programar no completa el trabajo. Nada se borra: se cancela con motivo.
// La mantención reportada desde Mi ruta (función de Cata) aparece aquí como Programada.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { Boton, Campo, Tabla, Estado, Ayuda, Pestanas } from '../components/Base'
import {
  mantenimiento, programarMantencion, editarMantencion, iniciarMantencion, registrarResultadoMantencion, cancelarMantencion,
  equiposLista, flota, personalActivo, tiposMantencion,
} from '../lib/api'
import { exportarTabla } from '../lib/excel'
import { hoyISO } from '../lib/costos'
import { useSesion, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, Icon, I, fecha, clp } from '../lib/ui'

const L_EST = { programado: 'Programado', en_curso: 'En curso', completado: 'Completado', cancelado: 'Cancelado' }
const TONO = { programado: 'info', en_curso: 'atencion', completado: 'ok', cancelado: 'neutro' }
const L_RES = { finalizado: 'Finalizado', requiere_seguimiento: 'Requiere seguimiento' }
const L_COND = { operativo: 'Operativo', requiere_limpieza: 'Requiere limpieza', requiere_reparacion: 'Requiere reparación' }
const TIPOS_EQUIPO = ['Mantención preventiva', 'Mantención correctiva', 'Inspección', 'Reparación de puerta', 'Cambio de estanque', 'Revisión de bomba']
const TIPOS_FLOTA = ['Mantención preventiva', 'Mantención correctiva', 'Inspección', 'Cambio de aceite', 'Revisión técnica', 'Cambio de neumáticos']
const MOTIVOS_CANCELAR = ['Se reprograma por disponibilidad', 'Ya no es necesario', 'Se registró por error', 'Otro']
const PUNTOS = 'M6 9l6 6 6-6'
const chico = { minHeight: 34, padding: '6px 12px' }
const abierto = (m) => m.estado_m === 'programado' || m.estado_m === 'en_curso'

export default function Mantenimiento() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'mantenciones')
  const finanzas = verFinanzas(perfil)
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'historial' ? 'historial' : 'pendientes'
  // ?tab=equipos|vehiculos (enlaces antiguos) → filtro de clase
  const claseInicial = params.get('tab') === 'vehiculos' ? 'vehiculo' : params.get('tab') === 'equipos' ? 'equipo' : ''
  const VACIO = { desde: '', hasta: '', clase: claseInicial, tipo: '', responsable: '', texto: '', estado: '' }
  const [f, setF] = useState(VACIO)
  const [aplicado, setAplicado] = useState(VACIO)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)        // {} programar · registro a editar
  const [detalle, setDetalle] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [exportar, setExportar] = useState(false)

  const cargar = () => {
    setError(null)
    return mantenimiento().then((l) => { setDatos(l); setDetalle((d) => (d ? l.find((x) => x.id === d.id) || null : d)) }).catch(setError)
  }
  useEffect(() => { cargar() }, [])

  const lista = datos || []
  const deVista = lista.filter((m) => (vista === 'pendientes' ? abierto(m) : !abierto(m)))
  const opciones = (k) => [...new Set(lista.map((m) => m[k]).filter(Boolean))].sort()
  const filas = useMemo(() => deVista.filter((m) => {
    const a = aplicado, t = a.texto.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const d = vista === 'historial' ? (m.fecha_realizada || String(m.cancelado_en || '').slice(0, 10) || m.fecha_programada) : m.fecha_programada
    if (a.desde && d < a.desde) return false
    if (a.hasta && d > a.hasta) return false
    if (a.clase && m.clase !== a.clase) return false
    if (a.tipo && m.tipo !== a.tipo) return false
    if (a.responsable && m.responsable !== a.responsable) return false
    if (a.estado === 'vencido' ? !m.vencido : a.estado && m.estado_m !== a.estado) return false
    if (t && !String(m.codigo || '').toUpperCase().includes(t) && !String(m.patente || '').includes(t) && !String(m.folio || '').replace('-', '').includes(t)) return false
    return true
  }).sort((x, y) => (vista === 'pendientes'
    ? String(x.fecha_programada).localeCompare(String(y.fecha_programada))
    : String(y.fecha_realizada || y.cancelado_en || '').localeCompare(String(x.fecha_realizada || x.cancelado_en || '')))), [deVista, aplicado, vista])
  const pend = lista.filter(abierto)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const filtrar = (c) => { const n = { ...VACIO, clase: '', ...c }; setF(n); setAplicado(n) }
  const irVista = (v) => { setParams(v === 'historial' ? { vista: v } : {}, { replace: true }); filtrar({}) }
  const listo = () => { setForm(null); setResultado(null); cargar() }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>Mantenimiento</h2>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})} disabled={!editable}>Programar mantenimiento</Boton>
        <Boton icono={I.descarga} onClick={() => setExportar(true)} disabled={!lista.length}>Exportar</Boton>
      </div>
      <Pestanas opciones={[{ v: 'pendientes', l: 'Pendientes' }, { v: 'historial', l: 'Historial' }]} valor={vista} onChange={irVista} />

      {vista === 'pendientes' && (
        <div className="kpis">
          {[['programado', 'Programados', '#e8f0fe', pend.filter((m) => m.estado_m === 'programado').length],
            ['en_curso', 'En curso', '#fef7e0', pend.filter((m) => m.estado_m === 'en_curso').length],
            ['vencido', 'Vencidos', '#fce8e6', pend.filter((m) => m.vencido).length]].map(([k, l, bg, n]) => (
            <button key={k} type="button" className="indicador" onClick={() => filtrar({ estado: aplicado.estado === k ? '' : k })}
              style={{ display: 'block', textAlign: 'left', cursor: 'pointer', background: bg, ...(aplicado.estado === k ? { outline: `2px solid ${C.azul}`, outlineOffset: -2 } : {}) }}>
              <span>{l}</span><b>{datos ? n : '…'}</b>
            </button>
          ))}
          <div style={{ font: '400 12px/1.5 var(--font)', color: C.gris, alignSelf: 'center' }}>Vencidos puede coincidir con programados o en curso: es una alerta de fecha.</div>
        </div>
      )}

      <section className="card">
        <form onSubmit={(e) => { e.preventDefault(); setAplicado(f) }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: 16, borderBottom: `1px solid ${C.borde}`, alignItems: 'end' }}>
          <Campo etiqueta="Fecha desde"><input type="date" value={f.desde} max={f.hasta || undefined} onChange={set('desde')} /></Campo>
          <Campo etiqueta="Fecha hasta"><input type="date" value={f.hasta} min={f.desde || undefined} onChange={set('hasta')} /></Campo>
          <Campo etiqueta="Clase">
            <select value={f.clase} onChange={set('clase')}><option value="">Todos</option><option value="equipo">Equipos</option><option value="vehiculo">Vehículos</option></select>
          </Campo>
          <Campo etiqueta="Tipo">
            <select value={f.tipo} onChange={set('tipo')}><option value="">Todos</option>{opciones('tipo').map((x) => <option key={x}>{x}</option>)}</select>
          </Campo>
          <Campo etiqueta="Responsable">
            <select value={f.responsable} onChange={set('responsable')}><option value="">Todos</option>{opciones('responsable').map((x) => <option key={x}>{x}</option>)}</select>
          </Campo>
          <Campo etiqueta="Buscar unidad o patente"><input value={f.texto} onChange={set('texto')} placeholder="Ej. 104 o ABCD12" /></Campo>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton tipo="principal" type="submit">Aplicar</Boton>
            <Boton onClick={() => filtrar({})}>Limpiar</Boton>
          </div>
        </form>
        {error && <div style={{ padding: 16 }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
        {datos === null && !error ? <div style={{ padding: 24, color: C.gris }}>Cargando…</div> : (
          <Tabla filas={filas} vacio="Sin resultados para estos filtros." columnas={[
            { k: 'folio', label: 'Folio', ancho: 90 },
            { k: 'id2', label: 'Identificación', render: (m) => <b>{m.identificacion}</b> },
            { k: 'tipo', label: 'Tipo' },
            vista === 'pendientes'
              ? { k: 'fp', label: 'Fecha programada', render: (m) => fecha(m.fecha_programada) }
              : { k: 'fr', label: 'Fecha', render: (m) => fecha(m.fecha_realizada || m.cancelado_en || m.fecha_programada) },
            { k: 'responsable', label: 'Responsable', render: (m) => m.responsable || '—' },
            {
              k: 'estado', label: 'Estado', render: (m) => (
                <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                  <Estado tono={TONO[m.estado_m]}>{L_EST[m.estado_m]}</Estado>
                  {m.vencido && <Estado tono="error">Vencido</Estado>}
                </span>
              ),
            },
            ...(vista === 'historial' ? [{ k: 'res', label: 'Resultado', render: (m) => (m.estado_m === 'cancelado' ? m.motivo_cancelacion : L_RES[m.resultado]) || '—' }] : []),
            {
              k: 'acc', label: 'Acción', alinear: 'right', render: (m) => (
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <Boton onClick={() => setDetalle(m)} style={chico}>Ver</Boton>
                  {abierto(m) && <Menu opciones={[
                    { l: 'Ver detalle', d: I.ojo, onClick: () => setDetalle(m) },
                    { l: 'Editar programación', d: I.lapiz, onClick: () => setForm(m), disabled: !editable || m.estado_m !== 'programado' },
                    { l: 'Cancelar', d: I.alert, color: C.rojo, onClick: () => setDetalle({ ...m, _cancelar: true }), disabled: !editable },
                  ]} />}
                </div>
              ),
            },
          ]} />
        )}
        <div style={{ padding: 14 }}>
          <Ayuda>Pendientes reúne programados y en curso. Historial incluye completados y cancelados; no se eliminan registros. La limpieza habitual del servicio se registra en Operaciones; reparar o revisar el activo se registra aquí.</Ayuda>
        </div>
      </section>

      {form && <Programar m={form.id ? form : null} onCerrar={() => setForm(null)} onListo={listo} />}
      {detalle && <Detalle m={detalle} editable={editable} finanzas={finanzas} onCerrar={() => setDetalle(null)} onCambio={cargar}
        onEditar={() => { setForm(detalle); setDetalle(null) }} onResultado={() => setResultado(detalle)}
        onFicha={() => detalle.qr_token && navegar('/activo/' + detalle.qr_token)} />}
      {resultado && <RegistrarResultado m={resultado} finanzas={finanzas} onCerrar={() => setResultado(null)} onListo={() => { setResultado(null); cargar() }} />}
      {exportar && <Exportar todas={lista} filtradas={filas} finanzas={finanzas} onCerrar={() => setExportar(false)} />}
    </div>
  )
}

// ── 6.2 Programar mantenimiento / Editar programación ─────────────────────
function Programar({ m, onCerrar, onListo }) {
  const nuevo = !m
  const [v, setV] = useState({
    clase: m?.clase || 'equipo', activo_id: m?.activo_id || '', texto: m ? m.identificacion : '', tipo: m?.tipo || 'Mantención correctiva',
    fecha: m?.fecha_programada || hoyISO(), responsable: m?.responsable || '', trabajo: m?.trabajo_requerido || '', observaciones: m?.observaciones || '', bloquea: false,
  })
  const [equipos, setEquipos] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [personas, setPersonas] = useState([])
  const [extra, setExtra] = useState([])
  const [otro, setOtro] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    Promise.all([equiposLista(), flota(), personalActivo()]).then(([e, f, p]) => {
      setEquipos(e.filter((x) => x.propiedad === 'empresa' && x.situacion !== 'baja'))
      setVehiculos(f.filter((x) => x.estado_flota !== 'baja')); setPersonas(p)
    }).catch(setError)
  }, [])
  useEffect(() => { tiposMantencion(v.clase === 'vehiculo' ? ['camion', 'camioneta'] : ['bano', 'equipo']).then(setExtra).catch(() => {}) }, [v.clase])
  const base = v.clase === 'vehiculo' ? TIPOS_FLOTA : TIPOS_EQUIPO
  const tipos = [...new Set([...base, ...extra.filter((t) => !base.includes(t)).sort(), ...(v.tipo && v.tipo !== '__otro' ? [v.tipo] : [])])]
  const candidatos = (v.clase === 'vehiculo'
    ? vehiculos.map((x) => ({ id: x.id, l: `${x.patente || 'Sin patente'} · ${x.codigo}`, b: `${x.patente || ''} ${x.codigo}` }))
    : equipos.map((x) => ({ id: x.id, l: `Unidad ${x.codigo} · ${x.categoria || ''}${x.ubicacion ? ` · ${x.ubicacion}` : ''}`, b: String(x.codigo) })))
  const t = v.texto.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const res = !v.activo_id && t ? candidatos.filter((c) => c.b.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/ /g, '').includes(t) || c.b.toUpperCase().includes(t)).slice(0, 12) : []
  const set = (k) => (e) => { const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setV((p) => ({ ...p, [k]: val })); setErrores({}) }

  const guardar = async () => {
    const e = {}
    const tipo = v.tipo === '__otro' ? otro.trim() : v.tipo
    if (!v.activo_id) e.activo = 'Elige el equipo o vehículo.'
    if (!tipo) e.tipo = 'Indica el tipo.'
    if (!v.fecha) e.fecha = 'Indica la fecha programada.'
    if (!v.responsable.trim()) e.responsable = 'Indica el responsable o taller.'
    if (v.trabajo.trim().length < 3) e.trabajo = 'Describe el trabajo requerido.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true); setError(null)
    const d = { activo_id: v.activo_id, tipo, fecha: v.fecha, responsable: v.responsable.trim(), trabajo: v.trabajo.trim(), observaciones: v.observaciones.trim(), bloquea: v.bloquea }
    try { if (nuevo) await programarMantencion(d); else await editarMantencion(m.id, d); onListo() } catch (x) { setError(x); setGuardando(false) }
  }

  return (
    <Modal titulo={nuevo ? 'Programar mantenimiento' : `Editar programación ${m.folio}`} ancho={820} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar programación'}</Boton>
    </>}>
      <div className="cols2" style={{ padding: 18, gap: 18 }}>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div className="campo">
            <span>Clase de activo <b className="obligatorio">*</b></span>
            <div style={{ display: 'flex', gap: 18, font: '400 14px var(--font)' }}>
              {[['equipo', 'Equipo'], ['vehiculo', 'Vehículo']].map(([k, l]) => (
                <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" checked={v.clase === k} disabled={!nuevo} onChange={() => setV((p) => ({ ...p, clase: k, activo_id: '', texto: '', tipo: 'Mantención correctiva' }))} /> {l}
                </label>
              ))}
            </div>
          </div>
          <Campo etiqueta={v.clase === 'vehiculo' ? 'Patente' : 'N.º unidad'} obligatorio error={errores.activo}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={v.texto} disabled={!nuevo || !!v.activo_id} onChange={(e) => setV((p) => ({ ...p, texto: e.target.value }))}
                placeholder={v.clase === 'vehiculo' ? 'Buscar patente o código…' : 'Buscar N.º de unidad…'} style={{ flex: 1 }} />
              {nuevo && v.activo_id && <Boton onClick={() => setV((p) => ({ ...p, activo_id: '', texto: '' }))} style={chico}>Cambiar</Boton>}
            </div>
          </Campo>
          {res.length > 0 && (
            <div style={{ display: 'grid', gap: 2, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', padding: 4, marginTop: -6, maxHeight: 220, overflowY: 'auto' }}>
              {res.map((c) => (
                <button key={c.id} type="button" onClick={() => setV((p) => ({ ...p, activo_id: c.id, texto: c.l }))}
                  style={{ textAlign: 'left', border: 0, background: 'transparent', padding: '8px 10px', cursor: 'pointer', font: '400 14px var(--font)', borderRadius: 'var(--radio-sm)' }}>{c.l}</button>
              ))}
            </div>
          )}
          <Campo etiqueta="Tipo" obligatorio error={errores.tipo}>
            <select value={v.tipo} onChange={set('tipo')}>{tipos.map((x) => <option key={x} value={x}>{x}</option>)}<option value="__otro">Otro…</option></select>
          </Campo>
          {v.tipo === '__otro' && <input value={otro} onChange={(e) => setOtro(e.target.value.slice(0, 60))} placeholder="¿Qué mantenimiento es? Ej. Cambio de bisagras" />}
          <Campo etiqueta="Fecha programada" obligatorio error={errores.fecha}><input type="date" value={v.fecha} onChange={set('fecha')} /></Campo>
          <Campo etiqueta="Responsable o taller" obligatorio error={errores.responsable}>
            <input value={v.responsable} onChange={set('responsable')} list="personal-mant" placeholder="Pedro Rojas o Taller externo" />
            <datalist id="personal-mant">{personas.map((p) => <option key={p.id} value={p.nombre} />)}</datalist>
          </Campo>
        </div>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Campo etiqueta="Trabajo requerido" obligatorio error={errores.trabajo}><textarea value={v.trabajo} onChange={set('trabajo')} maxLength={500} style={{ minHeight: 80 }} placeholder="Reparar cierre de puerta" /></Campo>
          <Campo etiqueta="Observaciones"><textarea value={v.observaciones} onChange={set('observaciones')} maxLength={500} style={{ minHeight: 70 }} placeholder="Ej. Detalles adicionales (opcional)" /></Campo>
          {nuevo && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', font: '400 14px var(--font)', cursor: 'pointer' }}>
              <input type="checkbox" checked={v.bloquea} onChange={set('bloquea')} style={{ width: 18, height: 18, marginTop: 2 }} />
              Equipo o vehículo no disponible desde ahora
            </label>
          )}
          <Ayuda>Marcar solo si la intervención requiere retirarlo de operación; una cita futura no lo bloquea automáticamente. Si está asignado a un cliente, coordinar acceso o traslado: no cambia su ubicación sin movimiento.</Ayuda>
          {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
        </div>
      </div>
    </Modal>
  )
}

// ── 6.3 Detalle MANT-### (con Cancelar) ───────────────────────────────────
function Detalle({ m, editable, finanzas, onCerrar, onCambio, onEditar, onResultado, onFicha }) {
  const [tab, setTab] = useState('datos')
  const [cancelar, setCancelar] = useState(!!m._cancelar)
  const [motivo, setMotivo] = useState(MOTIVOS_CANCELAR[0])
  const [otroMotivo, setOtroMotivo] = useState('')
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const correr = async (fn) => { setOcupado(true); setError(null); try { await fn(); await onCambio() } catch (x) { setError(x) } setOcupado(false) }
  const fila = (l, v) => (
    <div style={{ display: 'grid', gridTemplateColumns: '150px minmax(0,1fr)', gap: 10, padding: '5px 0', font: '400 14px var(--font)', borderBottom: `1px solid ${C.fila}` }}>
      <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v || '—'}</span>
    </div>
  )
  const confirmarCancelacion = () => {
    const mot = motivo === 'Otro' ? otroMotivo.trim() : motivo
    if (mot.length < 3) return setError({ message: 'Indica el motivo.' })
    correr(async () => { await cancelarMantencion(m.id, mot); onCerrar() })
  }
  return (
    <Modal titulo={`${m.folio} · ${m.identificacion}`} ancho={820} onCerrar={onCerrar} pie={<>
      {editable && m.estado_m === 'programado' && <Boton icono={I.lapiz} onClick={onEditar}>Editar programación</Boton>}
      {editable && m.estado_m === 'programado' && <Boton tipo="principal" onClick={() => correr(() => iniciarMantencion(m.id))} disabled={ocupado}>Iniciar trabajo</Boton>}
      {editable && abierto(m) && <Boton tipo="principal" icono={I.check} onClick={onResultado}>Registrar resultado</Boton>}
      <Boton onClick={onCerrar}>Cerrar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <Pestanas opciones={[{ v: 'datos', l: 'Datos del trabajo' }, { v: 'resultado', l: 'Resultado' }]} valor={tab} onChange={setTab} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(200px,1fr)', gap: 18 }} className="cols2">
          <div>
            {tab === 'datos' ? <>
              {fila('Identificación', m.identificacion)}
              {fila('Tipo', m.tipo)}
              {fila('Fecha programada', fecha(m.fecha_programada))}
              {fila('Responsable', m.responsable)}
              {fila('Estado', <span style={{ display: 'inline-flex', gap: 8 }}><Estado tono={TONO[m.estado_m]}>{L_EST[m.estado_m]}</Estado>{m.vencido && <Estado tono="error">Vencido</Estado>}</span>)}
              {fila('Trabajo requerido', m.trabajo_requerido)}
              {fila('Observaciones', m.observaciones)}
              {m.iniciada_en && fila('Trabajo iniciado', fecha(m.iniciada_en))}
              {m.bloquea && fila('Disponibilidad', 'No disponible desde la programación')}
            </> : <>
              {fila('Resultado', L_RES[m.resultado])}
              {fila('Fecha de realización', m.fecha_realizada ? fecha(m.fecha_realizada) : null)}
              {fila('Trabajo realizado', m.trabajo_realizado)}
              {fila('Condición al finalizar', L_COND[m.condicion_final])}
              {finanzas && fila('Costo', m.costo ? clp(m.costo) : null)}
              {m.estado_m === 'cancelado' && fila('Cancelado', `${m.cancelado_en ? fecha(m.cancelado_en) : ''} · ${m.motivo_cancelacion || ''}`)}
            </>}
          </div>
          <div style={{ display: 'grid', gap: 8, alignContent: 'start', padding: 14, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', background: C.suave }}>
            <Icon d={I.wrench} size={26} color={C.navy} />
            <b style={{ font: '800 18px var(--font)', color: C.navy }}>{m.folio}</b>
            <button type="button" onClick={onFicha} style={{ border: 0, background: 'transparent', color: C.azul, textAlign: 'left', padding: 0, cursor: 'pointer', font: '600 14px var(--font)' }}>
              Ver ficha del {m.clase === 'vehiculo' ? 'vehículo' : 'equipo'} ↗
            </button>
          </div>
        </div>
        <Ayuda>Iniciar trabajo solo se habilita si está Programado. Registrar resultado si está Programado o En curso; permite trabajo iniciado y finalizado el mismo día. Editar programación solo mientras está Programado.</Ayuda>

        {editable && abierto(m) && (cancelar ? (
          <div style={{ display: 'grid', gap: 10, padding: 14, border: `1px solid ${C.rojo}`, borderRadius: 'var(--radio-md)', background: '#fdf3f2' }}>
            <b style={{ color: C.rojo }}>Cancelar mantenimiento</b>
            <Campo etiqueta="Motivo" obligatorio>
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS_CANCELAR.map((x) => <option key={x}>{x}</option>)}</select>
            </Campo>
            {motivo === 'Otro' && <input value={otroMotivo} onChange={(e) => setOtroMotivo(e.target.value)} maxLength={200} placeholder="Escribe el motivo" />}
            <small className="text-muted">No borra el trabajo: queda en Historial como Cancelado. Revisa la disponibilidad si estaba bloqueado.</small>
            <div style={{ display: 'flex', gap: 8 }}>
              <Boton onClick={() => setCancelar(false)}>Volver</Boton>
              <Boton tipo="peligro" onClick={confirmarCancelacion} disabled={ocupado}>Confirmar cancelación</Boton>
            </div>
          </div>
        ) : <div><Boton onClick={() => setCancelar(true)} style={{ color: C.rojo, borderColor: C.rojo }}>Cancelar mantenimiento</Boton></div>)}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 6.4 Registrar resultado ───────────────────────────────────────────────
function RegistrarResultado({ m, finanzas, onCerrar, onListo }) {
  const [v, setV] = useState({ fecha: hoyISO(), resultado: 'finalizado', trabajo: m.trabajo_realizado || '', condicion: 'operativo', observaciones: '', costo: m.costo ? String(m.costo) : '' })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => { setV((p) => ({ ...p, [k]: e.target.value })); setError(null) }
  const guardar = async () => {
    if (!v.fecha || v.fecha > hoyISO()) return setError({ message: 'La fecha de realización no puede ser futura.' })
    if (v.trabajo.trim().length < 3) return setError({ message: 'Describe el trabajo realizado.' })
    setGuardando(true)
    try {
      await registrarResultadoMantencion(m.id, { ...v, trabajo: v.trabajo.trim(), costo: finanzas && v.costo !== '' ? Number(String(v.costo).replace(/\D/g, '')) : null })
      onListo()
    } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo={`Registrar resultado · ${m.folio}`} ancho={720} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar resultado'}</Boton>
    </>}>
      <div className="cols2" style={{ padding: 18, gap: 18 }}>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Campo etiqueta="Identificación"><input value={m.identificacion} disabled /></Campo>
          <Campo etiqueta="Fecha de realización" obligatorio><input type="date" value={v.fecha} max={hoyISO()} onChange={set('fecha')} /></Campo>
          <Campo etiqueta="Resultado" obligatorio>
            <select value={v.resultado} onChange={set('resultado')}>{Object.entries(L_RES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Trabajo realizado" obligatorio><textarea value={v.trabajo} onChange={set('trabajo')} maxLength={500} style={{ minHeight: 70 }} placeholder="Cierre reparado y probado" /></Campo>
          <Campo etiqueta="Condición al finalizar" obligatorio>
            <select value={v.condicion} onChange={set('condicion')}>{Object.entries(L_COND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Observaciones"><textarea value={v.observaciones} onChange={set('observaciones')} maxLength={500} style={{ minHeight: 60 }} placeholder="Ej. Observaciones adicionales (opcional)" /></Campo>
          {finanzas && <Campo etiqueta="Costo (CLP)"><input value={v.costo} onChange={set('costo')} inputMode="numeric" placeholder="38000" /></Campo>}
        </div>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Ayuda>Finalizado guarda Completado. Requiere seguimiento conserva En curso. La fecha real puede ser anterior a la prevista si se ejecutó antes; no se acepta fecha futura.</Ayuda>
          <Ayuda tono="atencion">Completar con condición distinta de Operativo deja el activo no disponible (Requiere reparación) o marcado para limpieza. Revisa asignaciones, reservas y otros bloqueos: la ubicación no cambia desde este formulario.</Ayuda>
          {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
        </div>
      </div>
    </Modal>
  )
}

// ── Exportar ──────────────────────────────────────────────────────────────
function Exportar({ todas, filtradas, finanzas, onCerrar }) {
  const [fmt, setFmt] = useState('xlsx')   // XLSX: columnas con ancho; el CSV no guarda formato
  const [solo, setSolo] = useState(true)
  const descargar = () => {
    const cols = ['folio', 'clase', 'identificacion', 'tipo', 'fecha_programada', 'responsable', 'estado', 'vencido', 'fecha_realizacion', 'resultado', 'trabajo_requerido', 'trabajo_realizado', 'condicion_final', 'motivo_cancelacion', ...(finanzas ? ['costo'] : [])]
    const filas = (solo ? filtradas : todas).map((m) => [m.folio, m.clase === 'vehiculo' ? 'Vehículo' : 'Equipo', m.identificacion, m.tipo, m.fecha_programada, m.responsable || '', L_EST[m.estado_m], m.vencido ? 'Sí' : 'No',
      m.fecha_realizada || '', L_RES[m.resultado] || '', m.trabajo_requerido || '', m.trabajo_realizado || '', L_COND[m.condicion_final] || '', m.motivo_cancelacion || '', ...(finanzas ? [m.costo || 0] : [])])
    if (fmt === 'xlsx') exportarTabla(cols, filas, 'Mantenimiento')
    else {
      const esc = (x) => (/[";\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
      const url = URL.createObjectURL(new Blob(['﻿' + [cols, ...filas].map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `mantenimiento_${hoyISO()}.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    onCerrar()
  }
  return (
    <Modal titulo="Exportar mantenimiento" ancho={460} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" icono={I.descarga} onClick={descargar}>Exportar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 18, font: '400 14px var(--font)' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={fmt === 'csv'} onChange={() => setFmt('csv')} /> CSV</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={fmt === 'xlsx'} onChange={() => setFmt('xlsx')} /> XLSX</label>
        </div>
        <span className="text-muted" style={{ fontSize: 12 }}>XLSX: para leer en Excel (columnas con su ancho). CSV: texto plano para otros sistemas; Excel no ajusta sus columnas.</span>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)' }}>
          <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} /> Solo resultados filtrados ({filtradas.length} de {todas.length})
        </label>
      </div>
    </Modal>
  )
}

// ── Menú ▾ (posición fija para que la tabla no lo recorte) ────────────────
function Menu({ opciones }) {
  const [abiertoM, setAbierto] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!abiertoM) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(null) }
    const cerrar = () => setAbierto(null)
    document.addEventListener('mousedown', fuera); window.addEventListener('scroll', cerrar, true); window.addEventListener('resize', cerrar)
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar) }
  }, [abiertoM])
  const alternar = (e) => {
    if (abiertoM) { setAbierto(null); return }
    const r = e.currentTarget.getBoundingClientRect(), alto = opciones.length * 40 + 10
    setAbierto({ top: r.bottom + 4 + alto > window.innerHeight ? r.top - 4 - alto : r.bottom + 4, right: window.innerWidth - r.right })
  }
  return (
    <div ref={ref}>
      <button type="button" className="btn" aria-label="Más acciones" onClick={alternar} style={{ minHeight: 34, padding: '6px 8px' }}><Icon d={PUNTOS} size={16} /></button>
      {abiertoM && (
        <div role="menu" style={{ position: 'fixed', right: abiertoM.right, top: abiertoM.top, zIndex: 1100, minWidth: 210, padding: 4, background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', boxShadow: '0 8px 24px rgba(19,41,75,.14)' }}>
          {opciones.map((o) => (
            <button key={o.l} type="button" role="menuitem" disabled={o.disabled} onClick={() => { setAbierto(null); o.onClick() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0, background: 'transparent', padding: '9px 10px', borderRadius: 'var(--radio-sm)', font: '400 14px var(--font)', textAlign: 'left', color: o.color || C.tinta, cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.45 : 1 }}>
              <Icon d={o.d} size={16} color={o.color || C.gris} />{o.l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
