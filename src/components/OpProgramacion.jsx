// Operaciones → Programación (láminas 4.1 Vista general, 4.2 Nueva operación, 4.3 Detalle, 4.4a Exportar, 4.4b Cancelar).
// Programar NO ejecuta: no mueve baños ni consume insumos. La ejecución se confirma en Mi ruta (o en la operación, paquete 8b).
// Cada operación es un despacho; las Rutas semanales la ven en "Por programar" para ubicarla en un día.
import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import BuscarCliente from './BuscarCliente'
import { Boton, Campo, Tabla, Estado, Ayuda } from './Base'
import {
  operaciones, banosDeOperacion, banosAsignados, banosDisponibles, crearDespacho, editarOperacion, cancelarOperacion,
  ubicacionesDe, serviciosDe, vehiculos, personalActivo,
} from '../lib/api'
import { rutasDeSemana, lunesDe } from '../lib/rutasSemana'
import { exportarTabla } from '../lib/excel'
import { useSesion, puedeOperar, esDueno } from '../lib/sesion'
import { hoyISO, sumarDias } from '../lib/costos'
import { C, Icon, I, fecha } from '../lib/ui'

export const L_ESTADO_OP = { programada: 'Programada', realizada: 'Realizada', pendiente: 'Pendiente', cancelada: 'Cancelada' }
export const TONO_OP = { programada: 'info', realizada: 'ok', pendiente: 'atencion', cancelada: 'neutro' }
const L_SERV = { arriendo_limpieza: 'Arriendo de baños químicos', limpieza_cliente: 'Limpieza de baños', limpieza_fosas: 'Limpieza de fosa' }
const L_ACCION = { entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio', limpieza: 'Limpieza' }
export const servicioYAccion = (o) => {
  const s = L_SERV[o.servicio_tipo]
  if (!s) return L_ACCION[o.tipo] || o.tipo
  return o.servicio_tipo === 'arriendo_limpieza' ? `${s} · ${L_ACCION[o.tipo] || o.tipo}` : s
}
const chico = { minHeight: 34, padding: '6px 12px' }
const PUNTOS = 'M6 9l6 6 6-6'
const PROHIBIDO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8'
const inicioMes = () => hoyISO().slice(0, 8) + '01'
const finMes = () => { const d = new Date(hoyISO().slice(0, 8) + '01T12:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10) }

export default function OpProgramacion({ irARutas }) {
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'rutas')
  const exporta = esDueno(perfil) || !!perfil?.permisos?.rutas?.exportar
  const VACIO = { desde: inicioMes(), hasta: finMes(), servicio: '', estado: '', patente: '', responsable: '', cliente: '' }
  const [f, setF] = useState(VACIO)
  const [aplicado, setAplicado] = useState(VACIO)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)       // {} nueva · operación a editar
  const [detalle, setDetalle] = useState(null)
  const [cancelar, setCancelar] = useState(null)
  const [exportar, setExportar] = useState(false)
  const cargar = () => { setDatos(null); operaciones(aplicado.desde, aplicado.hasta).then(setDatos).catch(setError) }
  useEffect(() => { cargar() }, [aplicado.desde, aplicado.hasta])

  const lista = datos || []
  const opciones = (k) => [...new Set(lista.map((o) => o[k]).filter(Boolean))].sort()
  const filas = useMemo(() => lista.filter((o) => {
    const a = aplicado, t = a.cliente.trim().toLowerCase()
    if (a.servicio && (o.servicio_tipo || 'sin') !== a.servicio) return false
    if (a.estado ? o.estado_op !== a.estado : o.estado_op === 'cancelada') return false
    if (a.patente && o.patente !== a.patente) return false
    if (a.responsable && o.responsable !== a.responsable) return false
    if (t && !o.cliente.toLowerCase().includes(t) && !String(o.rut || '').replace(/\D/g, '').includes(t.replace(/\D/g, '') || '@')) return false
    return true
  }), [lista, aplicado])
  const cuenta = (e) => lista.filter((o) => o.estado_op === e).length
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const filtrar = (c) => { const n = { ...aplicado, servicio: '', estado: '', patente: '', responsable: '', cliente: '', ...c }; setF(n); setAplicado(n) }
  const listo = () => { setForm(null); setCancelar(null); setDetalle(null); cargar() }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})} disabled={!editable}>Nueva operación</Boton>
        {exporta && <Boton icono={I.descarga} onClick={() => setExportar(true)} disabled={!lista.length}>Exportar</Boton>}
      </div>

      <div className="kpis">
        {[['programada', 'Programadas', C.blanco], ['realizada', 'Realizadas', '#e6f4ea'], ['pendiente', 'Pendientes', '#fef7e0']].map(([k, l, bg]) => (
          <button key={k} type="button" className="indicador" onClick={() => filtrar({ estado: k })}
            style={{ display: 'block', textAlign: 'left', cursor: 'pointer', background: bg, ...(aplicado.estado === k ? { outline: `2px solid ${C.azul}`, outlineOffset: -2 } : {}) }}>
            <span>{l}</span><b>{datos ? cuenta(k) : '…'}</b>
          </button>
        ))}
        <div style={{ font: '400 12px/1.5 var(--font)', color: C.gris, alignSelf: 'center' }}>
          Según el período filtrado. Pendiente = programada para un día que ya pasó y aún no realizada.
        </div>
      </div>

      <section className="card">
        <form onSubmit={(e) => { e.preventDefault(); setAplicado(f) }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: 16, borderBottom: `1px solid ${C.borde}`, alignItems: 'end' }}>
          <Campo etiqueta="Desde"><input type="date" value={f.desde} max={f.hasta || undefined} onChange={set('desde')} /></Campo>
          <Campo etiqueta="Hasta"><input type="date" value={f.hasta} min={f.desde || undefined} onChange={set('hasta')} /></Campo>
          <Campo etiqueta="Servicio">
            <select value={f.servicio} onChange={set('servicio')}><option value="">Todos</option>{Object.entries(L_SERV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="sin">Sin servicio asociado</option></select>
          </Campo>
          <Campo etiqueta="Estado">
            <select value={f.estado} onChange={set('estado')}><option value="">Todos (sin canceladas)</option>{Object.entries(L_ESTADO_OP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Patente">
            <select value={f.patente} onChange={set('patente')}><option value="">Todas</option>{opciones('patente').map((x) => <option key={x}>{x}</option>)}</select>
          </Campo>
          <Campo etiqueta="Responsable">
            <select value={f.responsable} onChange={set('responsable')}><option value="">Todos</option>{opciones('responsable').map((x) => <option key={x}>{x}</option>)}</select>
          </Campo>
          <Campo etiqueta="Cliente"><input value={f.cliente} onChange={set('cliente')} placeholder="Buscar por RUT o nombre…" /></Campo>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton tipo="principal" type="submit">Aplicar</Boton>
            <Boton onClick={() => { setF(VACIO); setAplicado(VACIO) }}>Limpiar</Boton>
          </div>
        </form>
        {error && <div style={{ padding: 16 }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
        {datos === null && !error ? <div style={{ padding: 24, color: C.gris }}>Cargando…</div> : (
          <Tabla filas={filas} vacio="Sin operaciones para estos filtros." columnas={[
            { k: 'fecha', label: 'Fecha', render: (o) => fecha(o.fecha_programada) },
            { k: 'serv', label: 'Servicio y acción', render: servicioYAccion },
            { k: 'cli', label: 'Cliente y ubicación', render: (o) => <div><div style={{ fontWeight: 600 }}>{o.cliente}</div><div className="text-muted" style={{ fontSize: 12 }}>{o.ubicacion || '—'}</div></div> },
            { k: 'patente', label: 'Patente', render: (o) => o.patente || '—' },
            { k: 'estado', label: 'Estado', render: (o) => <Estado tono={TONO_OP[o.estado_op]}>{L_ESTADO_OP[o.estado_op]}</Estado> },
            {
              k: 'acc', label: 'Acción', alinear: 'right', render: (o) => (
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <Boton onClick={() => setDetalle(o)} style={chico}>Ver</Boton>
                  <Menu opciones={[
                    { l: 'Ver detalle', d: I.ojo, onClick: () => setDetalle(o) },
                    { l: 'Editar programación', d: I.lapiz, onClick: () => setForm(o), disabled: !editable || o.estado !== 'programado' },
                    { l: 'Asignar a ruta', d: I.pin, onClick: () => irARutas(), disabled: !editable || o.estado !== 'programado' },
                    { l: 'Cancelar', d: PROHIBIDO, color: C.rojo, onClick: () => setCancelar(o), disabled: !editable || o.estado !== 'programado' },
                  ]} />
                </div>
              ),
            },
          ]} />
        )}
        <div style={{ padding: 14 }}><Ayuda>Aplicar filtra; Limpiar restablece. Cancelar un formulario no guarda; los errores conservan lo escrito.</Ayuda></div>
      </section>

      {form && <FormOperacion op={form} onCerrar={() => setForm(null)} onGuardado={listo} />}
      {detalle && <Detalle o={detalle} editable={editable} onCerrar={() => setDetalle(null)} onEditar={() => { setForm(detalle); setDetalle(null) }} onRuta={() => { setDetalle(null); irARutas() }} />}
      {cancelar && <Cancelar o={cancelar} onCerrar={() => setCancelar(null)} onListo={listo} />}
      {exportar && <Exportar todas={lista} filtradas={filas} onCerrar={() => setExportar(false)} />}
    </div>
  )
}

// ── Menú ▾ (posición fija para que la tabla no lo recorte) ────────────────
function Menu({ opciones }) {
  const [abierto, setAbierto] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(null) }
    const cerrar = () => setAbierto(null)
    document.addEventListener('mousedown', fuera); window.addEventListener('scroll', cerrar, true); window.addEventListener('resize', cerrar)
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar) }
  }, [abierto])
  const alternar = (e) => {
    if (abierto) { setAbierto(null); return }
    const r = e.currentTarget.getBoundingClientRect(), alto = opciones.length * 40 + 10
    setAbierto({ top: r.bottom + 4 + alto > window.innerHeight ? r.top - 4 - alto : r.bottom + 4, right: window.innerWidth - r.right })
  }
  return (
    <div ref={ref}>
      <button type="button" className="btn" aria-label="Más acciones" onClick={alternar} style={{ minHeight: 34, padding: '6px 8px' }}><Icon d={PUNTOS} size={16} /></button>
      {abierto && (
        <div role="menu" style={{ position: 'fixed', right: abierto.right, top: abierto.top, zIndex: 1100, minWidth: 200, padding: 4, background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', boxShadow: '0 8px 24px rgba(19,41,75,.14)' }}>
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

// ── 4.2 Nueva operación / Editar programación ─────────────────────────────
function FormOperacion({ op, onCerrar, onGuardado }) {
  const nueva = !op.id
  const inicial = useMemo(() => ({
    fecha: op.fecha_programada || hoyISO(), cliente_id: op.cliente_id || '', ubicacion_id: op.ubicacion_id || '', servicio_id: op.servicio_id || '',
    accion: op.tipo || 'entrega', vehiculo_id: op.vehiculo_id || '', responsable_id: op.responsable_id || '', ruta: '', observaciones: op.observaciones || '',
  }), [])
  const [v, setV] = useState(inicial)
  const [ubic, setUbic] = useState([])
  const [servs, setServs] = useState([])
  const [flota, setFlota] = useState([])
  const [personas, setPersonas] = useState([])
  const [rutas, setRutas] = useState([])
  const [libres, setLibres] = useState([])
  const [asignados, setAsignados] = useState([])
  const [entregar, setEntregar] = useState([])
  const [retirar, setRetirar] = useState([])
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([vehiculos(), personalActivo(), banosDisponibles()]).then(([f, p, b]) => { setFlota(f); setPersonas(p); setLibres(b) }).catch(setError)
    if (!nueva) banosDeOperacion(op.id).then((bs) => {
      setEntregar(bs.filter((x) => x.accion === 'entrega').map((x) => x.activos))
      setRetirar(bs.filter((x) => x.accion === 'retiro').map((x) => x.activos))
      // Al editar, los baños ya reservados por esta operación también se pueden elegir
      setLibres((l) => [...l, ...bs.filter((x) => x.accion === 'entrega').map((x) => x.activos).filter((a) => !l.some((y) => y.id === a.id))])
    }).catch(setError)
  }, [])
  useEffect(() => {
    setUbic([]); setServs([])
    if (!v.cliente_id) return
    ubicacionesDe(v.cliente_id).then((u) => {
      const act = u.filter((x) => x.activa)
      setUbic(act)
      if (!v.ubicacion_id && act.length === 1) setV((p) => ({ ...p, ubicacion_id: act[0].id }))
    }).catch(setError)
    serviciosDe(v.cliente_id).then((s) => setServs(s.filter((x) => x.estado === 'vigente'))).catch(setError)
  }, [v.cliente_id])
  useEffect(() => {
    setAsignados([])
    if (v.cliente_id) banosAsignados(v.cliente_id, v.ubicacion_id || null).then(setAsignados).catch(() => {})
  }, [v.cliente_id, v.ubicacion_id])
  useEffect(() => { rutasDeSemana(lunesDe(v.fecha || hoyISO())).then(setRutas).catch(() => setRutas([])) }, [v.fecha])

  const servicio = servs.find((s) => s.id === v.servicio_id)
  const tipoServ = servicio?.tipo
  const esArriendo = tipoServ === 'arriendo_limpieza'
  const accion = esArriendo ? v.accion : 'limpieza'
  const conEntrega = esArriendo && ['entrega', 'cambio'].includes(accion)
  const conRetiro = esArriendo && ['retiro', 'cambio'].includes(accion)
  const serviciosUbic = servs.filter((s) => !v.ubicacion_id || !s.ubicacion_id || s.ubicacion_id === v.ubicacion_id)
  const set = (k) => (e) => {
    const val = e.target.value
    setV((p) => ({ ...p, [k]: val, ...(k === 'cliente_id' ? { ubicacion_id: '', servicio_id: '' } : {}), ...(k === 'ubicacion_id' ? { servicio_id: '' } : {}) }))
    if (['cliente_id', 'ubicacion_id', 'servicio_id', 'accion'].includes(k)) { setEntregar([]); setRetirar([]) }
    setErrores({})
  }
  const elegirRuta = (e) => {
    const r = rutas.find((x) => x.id === e.target.value)
    const p = r && personas.find((x) => x.perfil_id === r.operador_id)
    setV((x) => ({ ...x, ruta: e.target.value, ...(r?.vehiculo_id ? { vehiculo_id: r.vehiculo_id } : {}), ...(p ? { responsable_id: p.id } : {}) }))
    setErrores({})
  }
  const sucio = JSON.stringify(v) !== JSON.stringify(inicial) || entregar.length || retirar.length
  const cerrar = () => (!sucio || window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) && onCerrar()

  const guardar = async () => {
    const e = {}
    if (!v.fecha) e.fecha = 'Indica la fecha programada.'
    else if (nueva && v.fecha < hoyISO()) e.fecha = 'No se programan operaciones en días pasados.'
    if (!v.cliente_id) e.cliente_id = 'Elige el cliente.'
    if (!v.ubicacion_id) e.ubicacion_id = 'Elige la ubicación.'
    if (!v.servicio_id) e.servicio_id = 'Elige el servicio.'
    if (conEntrega && !entregar.length) e.entregar = 'Elige las unidades a entregar.'
    if (conRetiro && !retirar.length) e.retirar = 'Elige las unidades a retirar.'
    if (!v.vehiculo_id) e.vehiculo_id = 'Elige la patente.'
    if (!v.responsable_id) e.responsable_id = 'Elige el responsable.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true); setError(null)
    const u = ubic.find((x) => x.id === v.ubicacion_id)
    const datos = {
      tipo: accion, cliente_id: v.cliente_id, ubicacion_id: v.ubicacion_id, servicio_id: v.servicio_id, direccion: u?.direccion || null,
      fecha_programada: v.fecha, vehiculo_id: v.vehiculo_id, responsable_id: v.responsable_id, observaciones: v.observaciones.trim() || null,
    }
    const banos = [
      ...(conEntrega ? entregar.map((b) => ({ id: b.id, accion: 'entrega' })) : []),
      ...(conRetiro ? retirar.map((b) => ({ id: b.id, accion: 'retiro' })) : []),
    ]
    try {
      if (nueva) await crearDespacho({ ...datos, origen: 'operaciones' }, banos)
      else await editarOperacion(op.id, datos, banos)
      onGuardado()
    } catch (x) { setError(x); setGuardando(false) }
  }

  return (
    <Modal titulo={nueva ? 'Nueva operación' : `Editar programación ${op.folio}`} ancho={920} onCerrar={cerrar} pie={<>
      <Boton onClick={cerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar programación'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(240px, 1fr)', gap: 18 }} className="cols2">
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Campo etiqueta="Fecha programada" obligatorio error={errores.fecha}><input type="date" value={v.fecha} min={nueva ? hoyISO() : undefined} onChange={set('fecha')} /></Campo>
          <Campo etiqueta="Cliente" obligatorio error={errores.cliente_id}>
            <BuscarCliente valor={v.cliente_id} onElegir={(c) => set('cliente_id')({ target: { value: c.id } })} disabled={!nueva} />
          </Campo>
          <Campo etiqueta="Ubicación" obligatorio error={errores.ubicacion_id} ayuda={v.cliente_id && !ubic.length ? 'El cliente no tiene ubicaciones activas: agrégala en su ficha.' : undefined}>
            <select value={v.ubicacion_id} onChange={set('ubicacion_id')} disabled={!ubic.length}>
              <option value="">Seleccionar</option>{ubic.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Servicio" obligatorio error={errores.servicio_id} ayuda={v.cliente_id && !serviciosUbic.length ? 'No hay servicios vigentes en esta ubicación: créalo en la ficha del cliente.' : undefined}>
            <select value={v.servicio_id} onChange={set('servicio_id')} disabled={!serviciosUbic.length}>
              <option value="">Seleccionar</option>{serviciosUbic.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {L_SERV[s.tipo] || s.tipo}</option>)}
            </select>
          </Campo>
          {esArriendo && (
            <Campo etiqueta="Solo arriendo: acción" obligatorio>
              <select value={v.accion} onChange={set('accion')}>
                <option value="entrega">Entrega</option><option value="retiro">Retiro</option><option value="cambio">Cambio (retirar unos y dejar otros)</option><option value="limpieza">Limpieza puntual</option>
              </select>
            </Campo>
          )}
          {conEntrega && <Unidades titulo={accion === 'cambio' ? 'Unidades a entregar' : 'Unidades'} disponibles={libres} elegidas={entregar} setElegidas={setEntregar} error={errores.entregar}
            ayuda="Solo baños disponibles y no reservados por otra operación." />}
          {conRetiro && <Unidades titulo={accion === 'cambio' ? 'Unidades a retirar' : 'Unidades'} disponibles={asignados} elegidas={retirar} setElegidas={setRetirar} error={errores.retirar}
            ayuda="Solo los asignados a este cliente en esta ubicación." />}
          {tipoServ && !esArriendo && <Ayuda>{tipoServ === 'limpieza_fosas' ? 'Fosa: no se eligen baños.' : 'Limpieza de baños del cliente: se atienden sus equipos externos.'}</Ayuda>}
        </div>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Campo etiqueta="Ruta (opcional)" ayuda="Si eliges ruta, hereda patente y responsable. Luego se ubica en el día desde la pestaña Rutas.">
            <select value={v.ruta} onChange={elegirRuta}>
              <option value="">Sin ruta</option>{rutas.map((r) => <option key={r.id} value={r.id}>{r.nombre}{r.activos?.codigo ? ` · ${r.activos.codigo}` : ''}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Patente" obligatorio error={errores.vehiculo_id}>
            <select value={v.vehiculo_id} onChange={set('vehiculo_id')}>
              <option value="">Seleccionar</option>
              {flota.map((f) => {
                const taller = ['mantencion', 'fuera_de_servicio', 'baja'].includes(f.activos?.estado)
                return <option key={f.activo_id} value={f.activo_id} disabled={taller}>{f.patente}{f.activos?.codigo ? ` · ${f.activos.codigo}` : ''}{taller ? ' · no disponible' : ''}</option>
              })}
            </select>
          </Campo>
          <Campo etiqueta="Responsable" obligatorio error={errores.responsable_id}>
            <select value={v.responsable_id} onChange={set('responsable_id')}><option value="">Seleccionar</option>{personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          </Campo>
          <Campo etiqueta="Observaciones (opcional)"><textarea value={v.observaciones} onChange={set('observaciones')} maxLength={400} style={{ minHeight: 90 }} placeholder="Acceso por portón principal. Coordinar con encargado en obra." /></Campo>
        </div>
      </div>
      <div style={{ padding: '0 18px 18px', display: 'grid', gap: 10 }}>
        <Ayuda>Guardar programa no registra ejecución ni consume insumos. Las entregas y retiros mueven los baños solo cuando se confirman como realizados.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

function Unidades({ titulo, disponibles, elegidas, setElegidas, error, ayuda }) {
  const [texto, setTexto] = useState('')
  const ids = new Set(elegidas.map((b) => b.id))
  const res = disponibles.filter((b) => !ids.has(b.id) && (!texto || String(b.codigo).includes(texto.trim()))).slice(0, 30)
  return (
    <div className="campo">
      <span>{titulo} <b className="obligatorio">*</b></span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {elegidas.map((b) => (
          <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 'var(--radio-sm)', background: C.tinte, font: '600 13px var(--font)' }}>
            {b.codigo}<button type="button" aria-label={`Quitar ${b.codigo}`} onClick={() => setElegidas((p) => p.filter((x) => x.id !== b.id))} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.gris }}>✕</button>
          </span>
        ))}
      </div>
      <input value={texto} onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))} placeholder={`Buscar N.º de unidad (${disponibles.length - ids.size} disponibles)`} inputMode="numeric" />
      {texto && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {res.length === 0 && <small>Sin coincidencias.</small>}
          {res.map((b) => <Boton key={b.id} onClick={() => { setElegidas((p) => [...p, b]); setTexto('') }} style={{ minHeight: 30, padding: '4px 10px' }}>+ {b.codigo}</Boton>)}
        </div>
      )}
      {error ? <small style={{ color: C.rojo }}>{error}</small> : <small>{ayuda}</small>}
    </div>
  )
}

// ── 4.3 Detalle de operación ──────────────────────────────────────────────
function Detalle({ o, editable, onCerrar, onEditar, onRuta }) {
  const fila = (l, v) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10, padding: '4px 0', font: '400 14px var(--font)' }}>
      <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v || '—'}</span>
    </div>
  )
  return (
    <Modal titulo={`${o.folio} · ${servicioYAccion(o)}`} ancho={760} onCerrar={onCerrar} pie={<>
      {o.estado === 'programado' && editable && <Boton icono={I.lapiz} onClick={onEditar}>Editar programación</Boton>}
      <Boton icono={I.pin} onClick={onRuta}>Ver ruta</Boton>
      <Boton onClick={onCerrar}>Cerrar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div><Estado tono={TONO_OP[o.estado_op]}>{L_ESTADO_OP[o.estado_op]}</Estado></div>
        <div className="cols2" style={{ gap: '0 24px' }}>
          <div>
            {fila('Fecha programada', fecha(o.fecha_programada))}
            {fila('Cliente', o.cliente)}
            {fila('Ubicación', o.ubicacion)}
            {fila('Servicio', o.servicio_codigo ? `${o.servicio_codigo} · ${L_SERV[o.servicio_tipo] || ''}` : null)}
            {fila('Acción', L_ACCION[o.tipo] || o.tipo)}
            {fila('Unidades', o.unidades)}
          </div>
          <div>
            {fila('Patente', o.patente)}
            {fila('Responsable', o.responsable)}
            {fila('Ruta', o.ruta ? `${o.ruta}${o.fecha_salida ? ` · ${fecha(o.fecha_salida)}` : ''}` : null)}
            {fila('Observaciones', o.observaciones)}
            {o.estado === 'hecho' && fila('Realizada', o.fecha_realizada ? fecha(o.fecha_realizada) : null)}
            {o.estado === 'cancelado' && fila('Cancelada', `${o.cancelado_en ? fecha(o.cancelado_en) : ''} · ${o.motivo_cancelacion || ''}`)}
          </div>
        </div>
        <Ayuda>Realizadas: se consultan resultado, insumos, observaciones y respaldo (paquete 8b). Los movimientos confirmados no se reescriben.</Ayuda>
      </div>
    </Modal>
  )
}

// ── 4.4b Cancelar operación ───────────────────────────────────────────────
function Cancelar({ o, onCerrar, onListo }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const confirmar = async () => {
    if (motivo.trim().length < 3) { setError({ message: 'Indica el motivo.' }); return }
    setGuardando(true)
    try { await cancelarOperacion(o.id, motivo.trim()); onListo() } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo="Cancelar operación" ancho={480} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Volver</Boton>
      <Boton tipo="peligro" onClick={confirmar} disabled={guardando}>{guardando ? 'Cancelando…' : 'Confirmar cancelación'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <span style={{ font: '600 14px var(--font)' }}>{o.folio} · {o.cliente} · {fecha(o.fecha_programada)}</span>
        <Campo etiqueta="Motivo" obligatorio><textarea value={motivo} onChange={(e) => { setMotivo(e.target.value); setError(null) }} maxLength={300} autoFocus placeholder="Cliente solicitó reprogramación." /></Campo>
        <Ayuda>Cancelar una operación sin ejecutar libera su reserva. Si ya tiene movimientos, se corrige con un registro vinculado.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 4.4a Exportar ─────────────────────────────────────────────────────────
function Exportar({ todas, filtradas, onCerrar }) {
  const [fmt, setFmt] = useState('csv')
  const [solo, setSolo] = useState(true)
  const descargar = () => {
    const cols = ['folio', 'fecha', 'servicio_accion', 'cliente', 'ubicacion', 'unidades', 'patente', 'responsable', 'ruta', 'estado']
    const filas = (solo ? filtradas : todas).map((o) => [o.folio, o.fecha_programada, servicioYAccion(o), o.cliente, o.ubicacion || '', o.unidades || '', o.patente || '', o.responsable || '', o.ruta || '', L_ESTADO_OP[o.estado_op]])
    if (fmt === 'xlsx') exportarTabla(cols, filas, 'Operaciones')
    else {
      const esc = (x) => (/[";\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
      const url = URL.createObjectURL(new Blob(['﻿' + [cols, ...filas].map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `operaciones_${hoyISO()}.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    onCerrar()
  }
  return (
    <Modal titulo="Exportar operaciones" ancho={460} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" icono={I.descarga} onClick={descargar}>Exportar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 18, font: '400 14px var(--font)' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={fmt === 'csv'} onChange={() => setFmt('csv')} /> CSV</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={fmt === 'xlsx'} onChange={() => setFmt('xlsx')} /> XLSX</label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)' }}>
          <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} /> Incluir solo resultados filtrados ({filtradas.length} de {todas.length})
        </label>
      </div>
    </Modal>
  )
}
