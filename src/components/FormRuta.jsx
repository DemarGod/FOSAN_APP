import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Campo } from './FormCliente'
import { clientesLista, vehiculos, guardarRuta, borrarRuta } from '../lib/api'
import { DIAS } from '../lib/costos'
import { C, Icon, I } from '../lib/ui'

const TAREAS = { limpieza: 'Limpieza', entrega: 'Entrega', retiro: 'Retiro' }

export default function FormRuta({ ruta, onCerrar, onGuardado }) {
  const e = ruta || {}
  const [nombre, setNombre] = useState(e.nombre || '')
  const [dias, setDias] = useState(e.dias || [])
  const [vehiculo, setVehiculo] = useState(e.vehiculo_id || '')
  const [notas, setNotas] = useState(e.notas || '')
  const [paradas, setParadas] = useState(
    (e.ruta_paradas || []).slice().sort((a, b) => a.orden - b.orden).map((p) => ({ cliente_id: p.cliente_id, tarea: p.tarea }))
  )
  const [clientes, setClientes] = useState([])
  const [flota, setFlota] = useState([])
  const [agregar, setAgregar] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([clientesLista(), vehiculos()]).then(([c, f]) => { setClientes(c); setFlota(f) }).catch(setError)
  }, [])

  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre || '…'
  const alternarDia = (d) => setDias((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()))
  const mover = (i, dir) => setParadas((p) => {
    const j = i + dir
    if (j < 0 || j >= p.length) return p
    const c = p.slice(); [c[i], c[j]] = [c[j], c[i]]; return c
  })

  const guardar = async () => {
    setError(null)
    if (!nombre.trim()) return setError('Ponle un nombre a la ruta.')
    if (!dias.length) return setError('Elige al menos un día.')
    setGuardando(true)
    try {
      await guardarRuta(e.id, { nombre: nombre.trim(), dias, vehiculo_id: vehiculo || null, notas: notas.trim() || null }, paradas)
      onGuardado()
    } catch (x) { setError(String(x.message || x)); setGuardando(false) }
  }
  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar la ruta "${e.nombre}" y sus salidas?`)) return
    try { await borrarRuta(e.id); onGuardado() } catch (x) { setError(String(x.message || x)) }
  }

  return (
    <Modal titulo={e.id ? 'Editar ruta' : 'Nueva ruta'} ancho={880} onCerrar={onCerrar} pie={
      <>
        {e.id && <button className="btn" onClick={eliminar} style={{ color: C.rojo, marginRight: 'auto' }}>Eliminar ruta</button>}
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar ruta'}</button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Campo l="Nombre"><input value={nombre} onChange={(x) => setNombre(x.target.value)} maxLength={60} placeholder="Ruta A · Talca norte" /></Campo>
          <div className="campo">
            <span>Días que se repite</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 2, background: C.borde, border: `2px solid ${C.borde}` }}>
              {DIAS.map((d) => {
                const on = dias.includes(d.v)
                return (
                  <button key={d.v} type="button" onClick={() => alternarDia(d.v)} style={{
                    border: 0, minHeight: 44, cursor: 'pointer', font: '600 12px var(--font)',
                    background: on ? C.navy : '#fff', color: on ? '#fff' : C.navy,
                  }}>{d.l}</button>
                )
              })}
            </div>
          </div>
          <Campo l="Vehículo">
            <select value={vehiculo} onChange={(x) => setVehiculo(x.target.value)}>
              <option value="">Sin asignar</option>
              {flota.map((f) => {
                const taller = ['mantencion', 'fuera_de_servicio', 'baja'].includes(f.activos?.estado)
                return <option key={f.activo_id} value={f.activo_id} disabled={taller}>{f.activos?.codigo}{taller ? ' · en mantención' : ''}</option>
              })}
            </select>
          </Campo>
          <Campo l="Notas"><textarea rows={3} value={notas} onChange={(x) => setNotas(x.target.value)} maxLength={300} /></Campo>
          <div style={{ padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`, font: '400 12px/1.45 var(--font)', color: '#3c4551' }}>
            La app crea sola las salidas de los próximos 14 días. Si cambias la ruta, las salidas futuras sin cerrar se rehacen.
          </div>
        </div>

        <div className="campo" style={{ alignContent: 'start' }}>
          <span>Clientes en orden ({paradas.length})</span>
          <div style={{ border: `2px solid ${C.borde}` }}>
            {paradas.length === 0 && <div style={{ padding: 12, font: '400 12px var(--font)', color: C.gris }}>Agrega los clientes que visita esta ruta.</div>}
            {paradas.map((p, i) => (
              <div key={p.cliente_id + i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: `1px solid ${C.fila}` }}>
                <span style={{ font: '700 12px var(--font)', color: C.navy, width: 20 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, font: '600 13px var(--font)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreCliente(p.cliente_id)}</span>
                <select value={p.tarea} onChange={(x) => setParadas((q) => q.map((y, k) => (k === i ? { ...y, tarea: x.target.value } : y)))}
                  style={{ border: `2px solid ${C.borde}`, font: '400 12px var(--font)', padding: '4px 6px', minHeight: 34 }}>
                  {Object.entries(TAREAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <Mini onClick={() => mover(i, -1)} d="M6 15l6-6 6 6" t="Subir" />
                <Mini onClick={() => mover(i, 1)} d="M6 9l6 6 6-6" t="Bajar" />
                <Mini onClick={() => setParadas((q) => q.filter((_, k) => k !== i))} d="M6 6l12 12M18 6 6 18" t="Quitar" color={C.rojo} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, padding: 8, background: C.suave }}>
              <select value={agregar} onChange={(x) => setAgregar(x.target.value)}
                style={{ flex: 1, minWidth: 0, border: `2px solid ${C.borde}`, font: '400 13px var(--font)', padding: '8px 10px', minHeight: 40 }}>
                <option value="">Agregar cliente…</option>
                {clientes.filter((c) => !paradas.some((p) => p.cliente_id === c.id)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button type="button" className="btn" disabled={!agregar} style={{ minHeight: 40 }}
                onClick={() => { setParadas((p) => [...p, { cliente_id: agregar, tarea: 'limpieza' }]); setAgregar('') }}>
                <Icon d={I.plus} size={15} /><span>Agregar</span>
              </button>
            </div>
          </div>
          {error && <div style={{ marginTop: 12, padding: '11px 13px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px/1.45 var(--font)', color: '#7c1405' }}>{String(error?.message || error)}</div>}
        </div>
      </div>
    </Modal>
  )
}

const Mini = ({ onClick, d, t, color = C.navy }) => (
  <button type="button" title={t} onClick={onClick} style={{
    width: 30, height: 30, border: `2px solid ${C.borde}`, background: '#fff', color, cursor: 'pointer',
    display: 'grid', placeItems: 'center', padding: 0,
  }}><Icon d={d} size={14} /></button>
)
