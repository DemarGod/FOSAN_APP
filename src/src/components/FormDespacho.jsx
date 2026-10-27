import { useEffect, useState } from 'react'
import Modal from './Modal'
import SelectorBanos from './SelectorBanos'
import { Campo } from './FormCliente'
import {
  clientesLista, banosDisponibles, banosDeCliente, vehiculos, salidasDelDia, crearDespacho,
} from '../lib/api'
import { fechaValida, FECHA_MIN, FECHA_MAX } from '../lib/validar'
import { hoyISO } from '../lib/costos'
import { C, fecha } from '../lib/ui'

const TIPOS = [
  { v: 'entrega', l: 'Entrega', d: 'Llevar baños desde bodega al cliente' },
  { v: 'retiro', l: 'Retiro', d: 'Traer baños del cliente a bodega' },
  { v: 'cambio', l: 'Cambio', d: 'Retirar unos y dejar otros' },
]

export default function FormDespacho({ inicial = {}, onCerrar, onGuardado }) {
  const [v, setV] = useState({
    tipo: inicial.tipo || 'entrega', cliente_id: inicial.cliente_id || '', fecha_programada: hoyISO(),
    vehiculo_id: '', salida_id: '', observaciones: '',
  })
  const [clientes, setClientes] = useState([])
  const [flota, setFlota] = useState([])
  const [libres, setLibres] = useState([])
  const [delCliente, setDelCliente] = useState([])
  const [salidasDia, setSalidasDia] = useState([])
  const [entregar, setEntregar] = useState([])
  const [retirar, setRetirar] = useState([])
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([clientesLista(), vehiculos(), banosDisponibles()])
      .then(([c, f, b]) => { setClientes(c); setFlota(f); setLibres(b) }).catch(setError)
  }, [])
  useEffect(() => {
    setRetirar([])
    if (v.cliente_id) banosDeCliente(v.cliente_id).then(setDelCliente).catch(setError)
    else setDelCliente([])
  }, [v.cliente_id])
  useEffect(() => {
    if (fechaValida(v.fecha_programada) && v.fecha_programada) salidasDelDia(v.fecha_programada).then(setSalidasDia).catch(() => setSalidasDia([]))
  }, [v.fecha_programada])

  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))
  const conEntrega = v.tipo !== 'retiro'
  const conRetiro = v.tipo !== 'entrega'

  const guardar = async () => {
    setError(null)
    if (!v.cliente_id) return setError('Elige el cliente.')
    if (!v.fecha_programada || !fechaValida(v.fecha_programada)) return setError('Fecha inválida (año entre 2000 y 2100).')
    const lista = [
      ...(conEntrega ? entregar.map((id) => ({ id, accion: 'entrega' })) : []),
      ...(conRetiro ? retirar.map((id) => ({ id, accion: 'retiro' })) : []),
    ]
    if (!lista.length) return setError('Elige al menos un baño.')
    const veh = flota.find((f) => f.activo_id === v.vehiculo_id)
    if (veh?.capacidad_banos && lista.length > veh.capacidad_banos)
      return setError(`${veh.activos?.codigo} lleva máximo ${veh.capacidad_banos} baños.`)
    setGuardando(true)
    try {
      const c = clientes.find((x) => x.id === v.cliente_id)
      await crearDespacho({
        tipo: v.tipo, cliente_id: v.cliente_id, direccion: c?.direccion || null,
        fecha_programada: v.fecha_programada, vehiculo_id: v.vehiculo_id || null,
        salida_id: v.salida_id || null, observaciones: v.observaciones.trim() || null,
      }, lista)
      onGuardado()
    } catch (e) { setError(String(e.message || e)); setGuardando(false) }
  }

  return (
    <Modal titulo="Nuevo despacho o retiro" ancho={900} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Programar'}</button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
          <div className="campo">
            <span>Tipo</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 2, background: C.borde, border: `2px solid ${C.borde}` }}>
              {TIPOS.map((t) => (
                <button key={t.v} type="button" onClick={() => setV((p) => ({ ...p, tipo: t.v }))} title={t.d} style={{
                  border: 0, padding: '10px 8px', minHeight: 44, cursor: 'pointer', textAlign: 'left',
                  background: v.tipo === t.v ? C.navy : '#fff', color: v.tipo === t.v ? '#fff' : C.navy,
                  font: '600 13px var(--font)',
                }}>{t.l}</button>
              ))}
            </div>
          </div>
          <Campo l="Cliente">
            <select value={v.cliente_id} onChange={set('cliente_id')}>
              <option value="">Elegir cliente…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.rut ? ' · ' + c.rut : ''}</option>)}
            </select>
            {(() => { const c = clientes.find((x) => x.id === v.cliente_id); return c ? <em style={{ font: '400 11px var(--font)', color: C.gris, fontStyle: 'normal' }}>RUT {c.rut || 'sin registrar'}{c.direccion ? ' · ' + c.direccion : ''}</em> : null })()}
          </Campo>
          <Campo l="Fecha programada">
            <input type="date" min={FECHA_MIN} max={FECHA_MAX} value={v.fecha_programada} onChange={set('fecha_programada')} />
          </Campo>
          <Campo l="Vehículo">
            <select value={v.vehiculo_id} onChange={set('vehiculo_id')}>
              <option value="">Sin asignar</option>
              {flota.map((f) => {
                const taller = ['mantencion', 'fuera_de_servicio', 'baja'].includes(f.activos?.estado)
                return (
                  <option key={f.activo_id} value={f.activo_id} disabled={taller}>
                    {f.activos?.codigo}{f.capacidad_banos ? ` · ${f.capacidad_banos} baños` : ''}{taller ? ' · en mantención' : ''}
                  </option>
                )
              })}
            </select>
          </Campo>
          <Campo l="Va en la ruta del día (opcional)">
            <select value={v.salida_id} onChange={set('salida_id')}>
              <option value="">{salidasDia.length ? 'Viaje aparte' : 'Viaje aparte · no hay rutas ese día'}</option>
              {salidasDia.map((s) => <option key={s.id} value={s.id}>{s.ruta} · {fecha(s.fecha)}{s.vehiculo ? ' · ' + s.vehiculo : ''}</option>)}
            </select>
          </Campo>
          <Campo l="Observaciones">
            <textarea rows={3} value={v.observaciones} onChange={set('observaciones')} maxLength={300} placeholder="Acceso por portón norte, llamar al llegar…" />
          </Campo>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14, alignContent: 'start', minWidth: 0 }}>
          {conRetiro && (
            <div className="campo">
              <span>Baños a retirar (solo los instalados en este cliente)</span>
              <SelectorBanos banos={delCliente} elegidos={retirar} onChange={setRetirar}
                vacio={v.cliente_id ? 'Este cliente no tiene baños instalados.' : 'Elige primero el cliente.'} />
            </div>
          )}
          {conEntrega && (
            <div className="campo">
              <span>Baños a entregar (solo disponibles para arriendo)</span>
              <SelectorBanos banos={libres} elegidos={entregar} onChange={setEntregar}
                vacio="No hay baños disponibles. Los que están en mantención no se pueden despachar." />
            </div>
          )}
          <div style={{ padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`, font: '400 12px/1.45 var(--font)', color: '#3c4551' }}>
            Al marcar el despacho como hecho, los baños entregados pasan a "En arriendo" en el cliente y los retirados vuelven a "Disponible" en bodega. Queda registrado en la ficha de cada baño.
          </div>
          {error && <div style={{ padding: '11px 13px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px/1.45 var(--font)', color: '#7c1405' }}>{String(error?.message || error)}</div>}
        </div>
      </div>
    </Modal>
  )
}
