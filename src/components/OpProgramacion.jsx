// Operaciones → Programación (láminas 4.1 Vista general, 4.2 Nueva operación, 4.3 Detalle, 4.4a Exportar, 4.4b Cancelar).
// Programar NO ejecuta: no mueve baños ni consume insumos. La ejecución se confirma en Mi ruta (o en la operación, paquete 8b).
// Cada operación es un despacho; las Rutas semanales la ven en "Por programar" para ubicarla en un día.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Modal from './Modal'
import BuscarCliente from './BuscarCliente'
import { RespaldoModal, ConfirmarEjecucion, L_SERV, L_ACCION, servicioYAccion } from './OpRespaldos'
import { Boton, Campo, Tabla, Estado, Ayuda } from './Base'
import {
  operaciones, banosDeOperacion, banosAsignados, banosConRetiroProgramado, banosDisponibles, crearDespacho, editarOperacion, cancelarOperacion,
  ubicacionesDe, serviciosDe, vehiculos, personalActivo, operacionPorFolio, cupoServicio, registrarExceso, operacionesDeServicios,
} from '../lib/api'
import { rutasDeSemana, lunesDe } from '../lib/rutasSemana'
import { exportarTabla, exportarCSV } from '../lib/excel'
import { useSesion, puedeOperar, esDueno } from '../lib/sesion'
import { hoyISO } from '../lib/costos'
import { C, Icon, I, fecha } from '../lib/ui'
import Menu from './Menu'

const L_ESTADO_OP = { programada: 'Programada', realizada: 'Realizada', pendiente: 'Atrasada', cancelada: 'Cancelada' }
const TONO_OP = { programada: 'info', realizada: 'ok', pendiente: 'atencion', cancelada: 'neutro' }

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
  const [confirmar, setConfirmar] = useState(null)
  const [respaldo, setRespaldo] = useState(null)
  const cargar = () => { setDatos(null); operaciones(aplicado.desde, aplicado.hasta).then(setDatos).catch(setError) }
  // Enlaces desde otras pantallas: ?nueva=1&cliente=&ubicacion=&servicio=&accion=&retirar=  ·  ?folio=D-00001
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const folio = params.get('folio'), nueva = params.get('nueva'), estado = params.get('estado')
    if (!folio && !nueva && !estado) return
    // Desde Inicio: ?estado=pendiente (atrasadas de cualquier fecha) o programada
    if (estado) { const n = { ...VACIO, desde: estado === 'pendiente' ? '' : VACIO.desde, hasta: estado === 'pendiente' ? '' : VACIO.hasta, estado }; setF(n); setAplicado(n) }
    if (nueva && editable) setForm({
      cliente_id: params.get('cliente') || '', ubicacion_id: params.get('ubicacion') || '', servicio_id: params.get('servicio') || '',
      tipo: params.get('accion') || undefined, _retirar: params.get('retirar') || null,
    })
    if (folio) operacionPorFolio(folio).then((o) => o ? setDetalle(o) : setError({ message: `No se encontró la operación ${folio}.` })).catch(setError)
    setParams({ tab: 'programacion' }, { replace: true })
  }, [])
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
  const listo = () => { setForm(null); setCancelar(null); setDetalle(null); setConfirmar(null); cargar() }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})} disabled={!editable}>Nueva operación</Boton>
        {exporta && <Boton icono={I.descarga} onClick={() => setExportar(true)} disabled={!lista.length}>Exportar</Boton>}
      </div>

      <div className="kpis">
        {[['programada', 'Programadas', C.blanco], ['realizada', 'Realizadas', '#e6f4ea'], ['pendiente', 'Atrasadas', '#fef7e0']].map(([k, l, bg]) => (
          <button key={k} type="button" className="indicador" onClick={() => filtrar({ estado: k })}
            style={{ display: 'block', textAlign: 'left', cursor: 'pointer', background: bg, ...(aplicado.estado === k ? { outline: `2px solid ${C.azul}`, outlineOffset: -2 } : {}) }}>
            <span>{l}</span><b>{datos ? cuenta(k) : '…'}</b>
          </button>
        ))}
        <div style={{ font: '400 12px/1.5 var(--font)', color: C.gris, alignSelf: 'center' }}>
          Según el período filtrado. Atrasada = programada para un día que ya pasó y aún no realizada.
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
      {detalle && <Detalle o={detalle} editable={editable} onCerrar={() => setDetalle(null)} onEditar={() => { setForm(detalle); setDetalle(null) }} onRuta={() => { setDetalle(null); irARutas() }}
        onConfirmar={() => { setConfirmar(detalle); setDetalle(null) }} onRespaldo={() => { setRespaldo(detalle); setDetalle(null) }} />}
      {confirmar && <ConfirmarEjecucion o={confirmar} onCerrar={() => setConfirmar(null)} onListo={listo} />}
      {respaldo && <RespaldoModal o={respaldo} onCerrar={() => { setRespaldo(null); cargar() }} />}
      {cancelar && <Cancelar o={cancelar} onCerrar={() => setCancelar(null)} onListo={listo} />}
      {exportar && <Exportar todas={lista} filtradas={filas} onCerrar={() => setExportar(false)} />}
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
  const [enRetiro, setEnRetiro] = useState({})        // baños que ya tienen un retiro programado (en otra operación)
  const [entregar, setEntregar] = useState([])
  const [retirar, setRetirar] = useState([])
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [cupo, setCupo] = useState(null)              // { solicitada, asignadas, reservadas } del servicio
  const [urgente, setUrgente] = useState(!!op.exceso_unidades)
  const [motivoUrg, setMotivoUrg] = useState(op.exceso_motivo || '')
  const [opsServ, setOpsServ] = useState([])          // operaciones de los servicios del cliente (fosa puntual)

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
    serviciosDe(v.cliente_id).then((s) => {
      const vig = s.filter((x) => x.estado === 'vigente')
      // Los arriendos finalizados se muestran solo para retirar sus baños
      setServs([...vig, ...s.filter((x) => x.estado !== 'vigente' && x.tipo === 'arriendo_limpieza')])
      operacionesDeServicios(vig.map((x) => x.id)).then(setOpsServ).catch(() => setOpsServ([]))
    }).catch(setError)
  }, [v.cliente_id])
  useEffect(() => {
    setAsignados([]); setEnRetiro({})
    if (v.cliente_id) {
      banosAsignados(v.cliente_id, v.ubicacion_id || null).then(setAsignados).catch(() => {})
      banosConRetiroProgramado(v.cliente_id).then(setEnRetiro).catch(() => setEnRetiro({}))
    }
  }, [v.cliente_id, v.ubicacion_id])
  useEffect(() => { rutasDeSemana(lunesDe(v.fecha || hoyISO())).then(setRutas).catch(() => setRutas([])) }, [v.fecha])

  const servicio = servs.find((s) => s.id === v.servicio_id)
  const tipoServ = servicio?.tipo
  const esArriendo = tipoServ === 'arriendo_limpieza'
  const accion = esArriendo ? v.accion : 'limpieza'
  const conEntrega = esArriendo && ['entrega', 'cambio'].includes(accion)
  const conRetiro = esArriendo && ['retiro', 'cambio'].includes(accion)
  const serviciosUbic = servs.filter((s) => !v.ubicacion_id || !s.ubicacion_id || s.ubicacion_id === v.ubicacion_id)
  // Fosa puntual: se hace una sola vez. Si ya tiene una operación (programada o realizada), no se vuelve a elegir.
  const fosaUsada = (s) => s.tipo === 'limpieza_fosas' && s.modalidad !== 'recurrente'
    && opsServ.find((o) => o.servicio_id === s.id && o.id !== op.id)
  // Cupo de unidades del servicio de arriendo
  useEffect(() => {
    setCupo(null)
    if (esArriendo && v.servicio_id) cupoServicio(v.servicio_id, nueva ? null : op.id).then(setCupo).catch(() => setCupo(null))
  }, [v.servicio_id, esArriendo])
  const conCupo = conEntrega && cupo?.solicitada != null
  const libresCupo = conCupo ? Math.max(0, cupo.solicitada - cupo.asignadas - cupo.reservadas + (accion === 'cambio' ? retirar.length : 0)) : Infinity
  const exceso = conCupo ? Math.max(0, entregar.length - libresCupo) : 0
  const servicioSel = servs.find((s) => s.id === v.servicio_id)
  // Para retirar: solo los que no tienen ya un retiro programado en otra operación
  const retirables = asignados.filter((a) => !enRetiro[a.id] || enRetiro[a.id].despacho_id === op.id)
  const yaEnRetiro = asignados.filter((a) => enRetiro[a.id] && enRetiro[a.id].despacho_id !== op.id)
  const finalizado = servicio?.estado && servicio.estado !== 'vigente'
  // Servicio finalizado: solo retiro
  useEffect(() => { if (nueva && finalizado && v.accion !== 'retiro') setV((p) => ({ ...p, accion: 'retiro' })) }, [finalizado])
  // Si en la ubicación hay un solo servicio posible, queda elegido (también al venir de "Solicitar retiro")
  useEffect(() => {
    if (!nueva || v.servicio_id || !v.ubicacion_id) return
    const posibles = serviciosUbic.filter((s) => !fosaUsada(s) && (s.estado === 'vigente' || op._retirar))
    const arr = op._retirar ? posibles.filter((s) => s.tipo === 'arriendo_limpieza') : posibles
    const unico = arr.length === 1 ? arr[0] : (op._retirar && arr.filter((s) => s.estado === 'vigente').length === 1 ? arr.find((s) => s.estado === 'vigente') : null)
    if (unico) setV((p) => ({ ...p, servicio_id: unico.id }))
  }, [servs, v.ubicacion_id])
  // Desde "Solicitar retiro" de la ficha del equipo: el baño queda elegido (y se repone si se cambió el servicio)
  useEffect(() => {
    if (!op._retirar || !conRetiro || retirar.length) return
    const pre = retirables.find((x) => x.id === op._retirar)
    if (pre) setRetirar([pre])
  }, [asignados, enRetiro, v.servicio_id, accion])
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
    else if (servicio && v.fecha && (nueva || v.fecha !== inicial.fecha || v.servicio_id !== inicial.servicio_id || v.accion !== inicial.accion)) {
      if (v.fecha < servicio.fecha_inicio) e.fecha = `El servicio ${servicio.codigo} empieza el ${fecha(servicio.fecha_inicio)}: programa desde esa fecha.`
      else if (accion !== 'retiro' && finalizado) e.servicio_id = `El servicio ${servicio.codigo} está finalizado: solo se programa el retiro.`
      else if (accion !== 'retiro' && servicio.fecha_termino && v.fecha > servicio.fecha_termino) e.fecha = `El servicio ${servicio.codigo} termina el ${fecha(servicio.fecha_termino)}: después solo se programa el retiro.`
    }
    if (conEntrega && !entregar.length) e.entregar = 'Elige las unidades a entregar.'
    else if (exceso > 0 && !urgente) e.entregar = `Supera lo solicitado por el servicio (${cupo.solicitada}). Edita la cantidad del servicio o marca la urgencia.`
    else if ((exceso > 0 || urgente) && motivoUrg.trim().length < 5) e.entregar = 'Escribe el motivo de la urgencia (obligatorio).'
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
      const id = nueva ? await crearDespacho({ ...datos, origen: 'operaciones' }, banos) : (await editarOperacion(op.id, datos, banos), op.id)
      // Urgencia: queda registrada en la operación y avisa en Notificaciones
      if (exceso > 0) await registrarExceso(id, exceso, motivoUrg.trim())
      else if (!nueva && op.exceso_unidades) await registrarExceso(id, 0, '')
      onGuardado()
    } catch (x) { setError(x); setGuardando(false) }
  }

  return (
    <Modal titulo={nueva ? 'Nueva operación' : `Editar programación ${op.folio}`} ancho={920} guardia={false} onCerrar={cerrar} pie={<>
      <Boton onClick={cerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar programación'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(240px, 1fr)', gap: 18 }} className="cols2">
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <Campo etiqueta="Fecha programada" obligatorio error={errores.fecha}><input type="date" value={v.fecha} min={nueva ? [hoyISO(), servicio?.fecha_inicio || ''].sort().pop() : undefined} onChange={set('fecha')} /></Campo>
          <Campo etiqueta="Cliente" obligatorio error={errores.cliente_id}>
            <BuscarCliente valor={v.cliente_id} onElegir={(c) => set('cliente_id')({ target: { value: c.id } })} disabled={!nueva} />
          </Campo>
          <Campo etiqueta="Ubicación" obligatorio error={errores.ubicacion_id} ayuda={v.cliente_id && !ubic.length ? 'El cliente no tiene ubicaciones activas: agrégala en su ficha.' : undefined}>
            <select value={v.ubicacion_id} onChange={set('ubicacion_id')} disabled={!ubic.length}>
              <option value="">Seleccionar</option>{ubic.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Servicio" obligatorio error={errores.servicio_id} ayuda={v.cliente_id && !serviciosUbic.length ? 'No hay servicios vigentes en esta ubicación: créalo en la ficha del cliente.'
            : servicio ? `Desde ${fecha(servicio.fecha_inicio)}${servicio.fecha_termino ? ' hasta ' + fecha(servicio.fecha_termino) : ' · sin término'}.` : undefined}>
            <select value={v.servicio_id} onChange={set('servicio_id')} disabled={!serviciosUbic.length}>
              <option value="">Seleccionar</option>{serviciosUbic.map((s) => {
                const usada = fosaUsada(s)
                return <option key={s.id} value={s.id} disabled={!!usada}>{s.codigo} · {L_SERV[s.tipo] || s.tipo}{usada ? ` · ya programada (${usada.folio})` : ''}{s.estado !== 'vigente' ? ' · finalizado: solo retiro' : ''}</option>
              })}
            </select>
          </Campo>
          {esArriendo && (
            <Campo etiqueta="Solo arriendo: acción" obligatorio>
              <select value={v.accion} onChange={set('accion')}>
                {finalizado ? <option value="retiro">Retiro</option>
                  : <><option value="entrega">Entrega</option><option value="retiro">Retiro</option><option value="cambio">Cambio (retirar unos y dejar otros)</option><option value="limpieza">Limpieza puntual</option></>}
              </select>
            </Campo>
          )}
          {conEntrega && <Unidades titulo={accion === 'cambio' ? 'Unidades a entregar' : 'Unidades'} disponibles={libres} elegidas={entregar} setElegidas={setEntregar} error={errores.entregar}
            tope={urgente ? Infinity : libresCupo}
            ayuda={conCupo
              ? `Servicio ${servicioSel?.codigo || ''}: solicita ${cupo.solicitada} · asignadas ${cupo.asignadas} · en otras entregas programadas ${Math.max(0, cupo.reservadas)} · disponibles para esta entrega ${libresCupo}.`
                + (entregar.length > 0 ? (entregar.length < libresCupo
                  ? ` Con esta entrega: ${entregar.length} de ${libresCupo}. Entrega parcial: quedarán ${libresCupo - entregar.length} por entregar en otra operación.`
                  : ` Con esta entrega se completa lo solicitado.`) : '')
              : 'Solo baños disponibles y no reservados por otra operación.'} />}
          {conCupo && (entregar.length >= libresCupo || urgente) && (
            <div style={{ display: 'grid', gap: 10, padding: 16, border: `3px solid ${C.amarillo}`, background: '#fef7e0', borderRadius: 'var(--radio-md)' }}>
              <strong style={{ font: '800 16px/1.3 var(--font)', color: '#7a4a00' }}>⚠ CUPO DEL SERVICIO COMPLETO</strong>
              <span style={{ font: '400 14px/1.5 var(--font)', color: '#5c3b00' }}>
                El servicio {servicioSel?.codigo} solicita <b>{cupo.solicitada}</b> unidad(es). Para entregar más, lo correcto es <b>editar la cantidad del servicio</b> en la ficha del cliente.
                Si es una urgencia, puedes seguir: quedará registrada en la operación y se avisará en Notificaciones, porque el servicio y el cobro quedan descuadrados hasta que se actualicen.
              </span>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', font: '700 14px var(--font)', color: '#5c3b00', cursor: 'pointer' }}>
                <input type="checkbox" checked={urgente} onChange={(e) => { setUrgente(e.target.checked); setErrores({}) }} style={{ width: 20, height: 20 }} />
                Es urgente: entregar más unidades de las solicitadas
              </label>
              {urgente && (
                <Campo etiqueta="Motivo de la urgencia" obligatorio error={errores.entregar && urgente && motivoUrg.trim().length < 5 ? 'Obligatorio' : undefined}>
                  <textarea value={motivoUrg} onChange={(e) => setMotivoUrg(e.target.value)} maxLength={300} style={{ minHeight: 60 }} placeholder="Ej.: evento del cliente hoy, se regulariza el servicio mañana." />
                </Campo>
              )}
              {exceso > 0 && <strong style={{ font: '700 14px var(--font)', color: C.rojo }}>Esta entrega supera lo solicitado en {exceso} unidad(es).</strong>}
            </div>
          )}
          {conRetiro && <Unidades titulo={accion === 'cambio' ? 'Unidades a retirar' : 'Unidades'} disponibles={retirables} elegidas={retirar} setElegidas={setRetirar} error={errores.retirar}
            ayuda={'Solo los asignados a este cliente en esta ubicación.' + (yaEnRetiro.length
              ? ` No aparecen porque ya tienen su retiro programado: ${yaEnRetiro.map((a) => `${a.codigo} (${enRetiro[a.id].folio})`).join(', ')}.` : '')} />}
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

function Unidades({ titulo, disponibles, elegidas, setElegidas, error, ayuda, tope = Infinity }) {
  const [texto, setTexto] = useState('')
  const lleno = elegidas.length >= tope
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
      {lleno
        ? <small style={{ color: '#7a4a00', fontWeight: 600 }}>Cupo del servicio completo: no se pueden agregar más unidades.</small>
        : <input value={texto} onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))} placeholder={`Buscar N.º de unidad (${disponibles.length - ids.size} disponibles)`} inputMode="numeric" />}
      {texto && !lleno && (
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
function Detalle({ o, editable, onCerrar, onEditar, onRuta, onConfirmar, onRespaldo }) {
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
      {o.estado === 'programado' && editable && !o.en_ruta && <Boton tipo="principal" icono={I.check} onClick={onConfirmar}>Confirmar ejecución</Boton>}
      {o.estado === 'hecho' && <Boton tipo="principal" icono={I.doc} onClick={onRespaldo}>Ver respaldo</Boton>}
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
        {o.estado === 'hecho' && (o.recibido_por || o.resultado) && <Ayuda>Recibió: {o.recibido_por || '—'}{o.resultado ? ` · ${o.resultado}` : ''}</Ayuda>}
        {o.exceso_unidades > 0 && (
          <div style={{ padding: 14, border: `3px solid ${C.amarillo}`, background: '#fef7e0', borderRadius: 'var(--radio-md)', font: '400 14px/1.5 var(--font)', color: '#5c3b00' }}>
            <b style={{ font: '800 15px var(--font)', color: '#7a4a00' }}>⚠ URGENCIA: entrega sobre lo solicitado (+{o.exceso_unidades})</b><br />
            Motivo: {o.exceso_motivo || '—'}. Actualiza la cantidad del servicio {o.servicio_codigo || ''} para que el cobro cuadre.
          </div>
        )}
        {o.estado === 'programado' && o.en_ruta && <Ayuda>Está en una ruta: se confirma desde Mi ruta, con la ejecución del día.</Ayuda>}
        <Ayuda>Realizadas: se consultan resultado, observaciones y respaldo (constancia, archivos y firma). Los movimientos confirmados no se reescriben.</Ayuda>
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
  const [fmt, setFmt] = useState('xlsx')
  const [solo, setSolo] = useState(true)
  const descargar = () => {
    const cols = ['folio', 'fecha', 'servicio_accion', 'cliente', 'ubicacion', 'unidades', 'patente', 'responsable', 'ruta', 'estado']
    const filas = (solo ? filtradas : todas).map((o) => [o.folio, o.fecha_programada, servicioYAccion(o), o.cliente, o.ubicacion || '', o.unidades || '', o.patente || '', o.responsable || '', o.ruta || '', L_ESTADO_OP[o.estado_op]])
    if (fmt === 'xlsx') exportarTabla(cols, filas, 'Operaciones')
    else exportarCSV(cols, filas, `operaciones_${hoyISO()}`)
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
