import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { Campo } from './FormCliente'
import { clientesParaRuta, vehiculos, guardarRuta, borrarRuta, rutasLista, parametros } from '../lib/api'
import { DIAS, diasTexto, mapaParametros } from '../lib/costos'
import { C, Icon, I } from '../lib/ui'

const TAREAS = { limpieza: 'Limpieza', entrega: 'Entrega', retiro: 'Retiro' }
export const MAX_PARADAS = 45

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
  const [otras, setOtras] = useState({})
  const [flota, setFlota] = useState([])
  const [par, setPar] = useState({})
  const [agregar, setAgregar] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([clientesParaRuta(), vehiculos(), rutasLista(), parametros().catch(() => [])])
      .then(([c, f, r, p]) => {
        setClientes(c); setFlota(f); setPar(mapaParametros(p))
        const o = {}
        r.filter((x) => x.id !== e.id).forEach((x) => (x.ruta_paradas || []).forEach((p) => { (o[p.cliente_id] ||= []).push(x.nombre) }))
        setOtras(o)
      }).catch(setError)
  }, [])

  const porId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes])
  const enRuta = new Set(paradas.map((p) => p.cliente_id))
  const lleno = paradas.length >= MAX_PARADAS
  // Clientes que limpian alguno de los días de la ruta y todavía no están en ella
  const sugeridos = clientes.filter((c) => !enRuta.has(c.id) && (c.dias_limpieza || []).some((d) => dias.includes(d)))

  const alternarDia = (d) => setDias((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()))
  const mover = (i, dir) => setParadas((p) => {
    const j = i + dir
    if (j < 0 || j >= p.length) return p
    const c = p.slice(); [c[i], c[j]] = [c[j], c[i]]; return c
  })
  const sumar = (ids) => setParadas((p) => [...p, ...ids.slice(0, MAX_PARADAS - p.length).map((id) => ({ cliente_id: id, tarea: 'limpieza' }))])

  const banosDe = (c) => (c ? c.banos_arriendo + c.banos_propios : 0)
  const limpiezas = paradas.filter((p) => p.tarea === 'limpieza')
  const totalBanos = limpiezas.reduce((a, p) => a + banosDe(porId[p.cliente_id]), 0)
  const aguaBano = par.agua_bano ?? 12
  const estanqueAgua = par.estanque_agua ?? 200
  const agua = totalBanos * aguaBano
  const recargas = agua > estanqueAgua ? Math.ceil(agua / estanqueAgua) - 1 : 0

  const guardar = async () => {
    setError(null)
    if (!nombre.trim()) return setError('Ponle un nombre a la ruta.')
    if (!dias.length) return setError('Elige al menos un día.')
    if (paradas.length > MAX_PARADAS) return setError(`Una ruta lleva máximo ${MAX_PARADAS} clientes.`)
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

  const th = { padding: '9px 10px', font: '700 11px var(--font)', textTransform: 'uppercase', letterSpacing: '.05em', color: '#1a3c72', textAlign: 'left', background: C.tinte, borderBottom: `2px solid ${C.borde}`, whiteSpace: 'nowrap' }
  const td = { padding: '7px 10px', font: '400 13px var(--font)', borderBottom: `1px solid ${C.fila}`, verticalAlign: 'middle' }

  return (
    <Modal titulo={e.id ? 'Editar ruta' : 'Nueva ruta'} ancho={1180} onCerrar={onCerrar} pie={
      <>
        {e.id && <button className="btn" onClick={eliminar} style={{ color: C.rojo, marginRight: 'auto' }}>Eliminar ruta</button>}
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar ruta'}</button>
      </>
    }>
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, alignItems: 'start' }}>
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
        <Campo l="Notas"><input value={notas} onChange={(x) => setNotas(x.target.value)} maxLength={300} placeholder="Salir 7:30 desde bodega" /></Campo>
      </div>

      <div style={{ borderTop: `2px solid ${C.borde}`, padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ font: '700 13px var(--font)', color: '#1a3c72', marginRight: 'auto' }}>
            Clientes de la ruta ({paradas.length}/{MAX_PARADAS})
          </span>
          {sugeridos.length > 0 && (
            <button type="button" className="btn" disabled={lleno} onClick={() => sumar(sugeridos.map((c) => c.id))} style={{ minHeight: 40 }}>
              <Icon d={I.plus} size={15} /><span>Agregar los {sugeridos.length} que limpian {diasTexto(dias)}</span>
            </button>
          )}
          <select value={agregar} onChange={(x) => setAgregar(x.target.value)} disabled={lleno}
            style={{ minWidth: 220, border: `2px solid ${C.borde}`, font: '400 13px var(--font)', padding: '8px 10px', minHeight: 40, background: '#fff' }}>
            <option value="">{lleno ? `Máximo ${MAX_PARADAS} clientes` : 'Elegir cliente…'}</option>
            {clientes.filter((c) => !enRuta.has(c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}{otras[c.id] ? ` · ya en ${otras[c.id].join(', ')}` : ''}</option>
            ))}
          </select>
          <button type="button" className="btn btn-verde" disabled={!agregar || lleno} style={{ minHeight: 40 }}
            onClick={() => { sumar([agregar]); setAgregar('') }}>
            <Icon d={I.plus} size={15} /><span>Agregar</span>
          </button>
        </div>

        <div style={{ border: `2px solid ${C.borde}`, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>#</th>
                <th style={th}>Cliente</th>
                <th style={th}>Dirección</th>
                <th style={th}>Baños</th>
                <th style={th}>Limpia</th>
                <th style={th}>Tarea</th>
                <th style={{ ...th, width: 110 }}>Orden</th>
              </tr>
            </thead>
            <tbody>
              {paradas.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, color: C.gris, padding: 14 }}>
                  Elige un cliente arriba{sugeridos.length ? ' o agrega de una vez los que limpian estos días' : ''}. Los clientes se crean en Clientes; acá solo se eligen.
                </td></tr>
              )}
              {paradas.map((p, i) => {
                const c = porId[p.cliente_id]
                const dc = c?.dias_limpieza || []
                const desfase = p.tarea === 'limpieza' && dc.length > 0 && !dc.some((d) => dias.includes(d))
                return (
                  <tr key={p.cliente_id + i}>
                    <td style={{ ...td, font: '700 12px var(--font)', color: C.navy }}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {c?.nombre || '…'}
                      {otras[p.cliente_id] && <span style={{ display: 'block', font: '400 11px var(--font)', color: C.gris }}>También en {otras[p.cliente_id].join(', ')}</span>}
                    </td>
                    <td style={{ ...td, color: '#3c4551' }}>{[c?.direccion, c?.comuna].filter(Boolean).join(', ') || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {c ? `${banosDe(c)}` : '—'}
                      {c?.banos_propios > 0 && <span style={{ font: '400 11px var(--font)', color: C.gris }}> ({c.banos_propios} propios)</span>}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', color: desfase ? C.rojo : '#3c4551' }} title={desfase ? 'El cliente limpia otros días que la ruta' : ''}>
                      {dc.length ? diasTexto(dc) : '—'}
                    </td>
                    <td style={td}>
                      <select value={p.tarea} onChange={(x) => setParadas((q) => q.map((y, k) => (k === i ? { ...y, tarea: x.target.value } : y)))}
                        style={{ border: `2px solid ${C.borde}`, font: '400 12px var(--font)', padding: '4px 6px', minHeight: 34, background: '#fff' }}>
                        {Object.entries(TAREAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Mini onClick={() => mover(i, -1)} d="M6 15l6-6 6 6" t="Subir" />
                        <Mini onClick={() => mover(i, 1)} d="M6 9l6 6 6-6" t="Bajar" />
                        <Mini onClick={() => setParadas((q) => q.filter((_, k) => k !== i))} d="M6 6l12 12M18 6 6 18" t="Quitar" color={C.rojo} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {limpiezas.length > 0 && (
          <div style={{
            padding: '11px 13px', border: `2px solid ${recargas ? C.amarillo : C.borde}`, background: recargas ? '#fef7e0' : C.suave,
            font: '400 12px/1.45 var(--font)', color: '#3c4551',
          }}>
            {totalBanos} baño(s) a limpiar · {agua.toLocaleString('es-CL')} L de agua limpia ({aguaBano} L por baño).
            {recargas ? ` El estanque es de ${estanqueAgua} L: hay que recargar ${recargas} vez/veces durante la ruta.` : ` Alcanza con el estanque de ${estanqueAgua} L.`}
          </div>
        )}
        <div style={{ font: '400 12px/1.45 var(--font)', color: C.gris }}>
          La app crea sola las salidas de los próximos 14 días. Si cambias la ruta, las salidas futuras sin cerrar se rehacen.
        </div>
        {error && <div style={{ padding: '11px 13px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px/1.45 var(--font)', color: '#7c1405' }}>{String(error?.message || error)}</div>}
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
