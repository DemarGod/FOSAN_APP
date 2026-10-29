import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import SelectorBanos from './SelectorBanos'
import { Campo } from './FormCliente'
import { Chip } from './DiaRuta'
import { vehiculos, banosDisponibles } from '../lib/api'
import {
  operadores, clientesPlanilla, porProgramar, avanceSemana, guardarRutaSemana, despachosPorId, banosDeClienteRuta,
  DIAS_RUTA, lunesDe, etiquetaSemana, L_TAREA,
} from '../lib/rutasSemana'
import { C } from '../lib/ui'

let clave = 0
const nueva = (x) => ({ k: ++clave, tarea: 'limpieza', dias: [], banos: [], despacho_id: null, nota: '', ...x })
const diasLimpieza = (c) => (c?.dias_limpieza || []).filter((d) => d >= 1 && d <= 5).sort()

// Planilla semanal: una fila por cliente, con los días de lunes a viernes en que se visita
// enOtras: clientes que ya se limpian en otra ruta de la misma semana
export default function FormRutaSemana({ ruta, lunes, enOtras = new Set(), onCerrar, onGuardado }) {
  const r = ruta || {}
  const [nombre, setNombre] = useState(r.nombre || '')
  const [semana, setSemana] = useState(r.lunes || lunes)
  const [operador, setOperador] = useState(r.operador_id || '')
  const [vehiculo, setVehiculo] = useState(r.vehiculo_id || '')
  const [notas, setNotas] = useState(r.notas || '')
  const [lineas, setLineas] = useState(() =>
    [...(r.rutas_semana_lineas || [])].sort((a, b) => a.orden - b.orden).map((l) => nueva({ ...l, nota: l.nota || '' })))
  const [datos, setDatos] = useState(null)
  const [elegir, setElegir] = useState(null)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    const ids = (r.rutas_semana_lineas || []).map((l) => l.despacho_id).filter(Boolean)
    Promise.all([
      clientesPlanilla(), operadores(), vehiculos(), porProgramar(), despachosPorId(ids),
      r.id ? avanceSemana(r.lunes) : Promise.resolve([]), banosDisponibles(),
    ]).then(([clientes, ops, flota, pendientes, desp, avance, libres]) => {
      const iniciados = avance.filter((v) => v.ruta_semana_id === r.id && (v.iniciada_en || v.estado !== 'planificada'))
      setDatos({
        clientes, ops, flota, pendientes, libres,
        desp: Object.fromEntries(desp.map((d) => [d.id, d])),
        bloqueados: new Set(iniciados.map((v) => new Date(v.fecha + 'T12:00:00').getDay())),
      })
    }).catch(setError)
  }, [])

  const cliente = useMemo(() => Object.fromEntries((datos?.clientes || []).map((c) => [c.id, c])), [datos])
  const bloq = datos?.bloqueados || new Set()
  const cambiar = (k, cambios) => setLineas((ls) => ls.map((l) => (l.k === k ? { ...l, ...cambios } : l)))
  const quitar = (k) => setLineas((ls) => ls.filter((l) => l.k !== k))
  const mover = (i, d) => setLineas((ls) => {
    const n = [...ls]; const j = i + d
    if (j < 0 || j >= n.length) return ls
    ;[n[i], n[j]] = [n[j], n[i]]
    return n
  })

  const alternarDia = (l, d) => {
    if (bloq.has(d)) return
    if (l.tarea === 'limpieza') cambiar(l.k, { dias: l.dias.includes(d) ? l.dias.filter((x) => x !== d) : [...l.dias, d].sort() })
    else cambiar(l.k, { dias: [d] })                 // entrega o retiro: un solo día
  }
  const cambiarTarea = (l, tarea) => cambiar(l.k, {
    tarea, banos: [], dias: tarea === 'limpieza' ? diasLimpieza(cliente[l.cliente_id]) : l.dias.slice(0, 1),
  })

  // Agregar filas
  const agregarCliente = (id) => {
    if (!id) return
    setLineas((ls) => [...ls, nueva({ cliente_id: id, dias: diasLimpieza(cliente[id]) })])
  }
  const yaLimpia = new Set(lineas.filter((l) => l.tarea === 'limpieza').map((l) => l.cliente_id))
  const conLimpieza = (datos?.clientes || []).filter((c) => diasLimpieza(c).length && !yaLimpia.has(c.id) && !(semana === (r.lunes || lunes) && enOtras.has(c.id)))
  const agregarFrecuentes = () => setLineas((ls) => [...ls, ...conLimpieza.map((c) => nueva({ cliente_id: c.id, dias: diasLimpieza(c) }))])
  const enPlanilla = new Set(lineas.map((l) => l.despacho_id).filter(Boolean))
  const pendientes = (datos?.pendientes || []).filter((d) => !enPlanilla.has(d.id))
  const agregarDespacho = (d) => {
    const dia = d.fecha_programada && lunesDe(d.fecha_programada) === semana ? new Date(d.fecha_programada + 'T12:00:00').getDay() : null
    setDatos((x) => ({ ...x, desp: { ...x.desp, [d.id]: d } }))
    setLineas((ls) => [...ls, nueva({ cliente_id: d.cliente_id, tarea: d.tipo, despacho_id: d.id, dias: dia >= 1 && dia <= 5 ? [dia] : [] })])
  }

  // Baños elegidos en otras filas de entrega no se ofrecen de nuevo
  const abrirBanos = async (l) => {
    if (l.tarea === 'entrega') {
      const otros = new Set(lineas.filter((x) => x.k !== l.k && x.tarea === 'entrega').flatMap((x) => x.banos))
      setElegir({ l, banos: datos.libres.filter((b) => !otros.has(b.id)) })
    } else {
      setElegir({ l, banos: await banosDeClienteRuta(l.cliente_id) })
    }
  }

  const porDia = DIAS_RUTA.map((d) => lineas.filter((l) => l.dias.includes(d.v)).length)

  const guardar = async () => {
    const falta = []
    if (!nombre.trim()) falta.push('el nombre de la ruta')
    if (!operador) falta.push('el operador')
    if (!vehiculo) falta.push('el vehículo')
    if (falta.length) return setError(`Falta ${falta.join(', ')}.`)
    const sinDia = lineas.find((l) => !l.dias.length)
    if (sinDia) return setError(`${cliente[sinDia.cliente_id]?.nombre || 'Una fila'} no tiene ningún día marcado.`)
    const sinBanos = lineas.find((l) => l.tarea !== 'limpieza' && !l.despacho_id && !l.banos.length)
    if (sinBanos) return setError(`Elige los baños de la ${L_TAREA[sinBanos.tarea].toLowerCase()} de ${cliente[sinBanos.cliente_id]?.nombre}.`)
    setOcupado(true); setError(null)
    try {
      await guardarRutaSemana(r.id, {
        nombre: nombre.trim(), lunes: semana, operador_id: operador, vehiculo_id: vehiculo, notas: notas.trim() || null,
      }, lineas)
      onGuardado(semana)
    } catch (e) { setError(String(e.message || e)); setOcupado(false) }
  }

  const th = { padding: '8px 6px', font: '700 10px var(--font)', textTransform: 'uppercase', letterSpacing: '.05em', color: C.gris, textAlign: 'left', whiteSpace: 'nowrap', background: C.suave, borderBottom: `2px solid ${C.borde}` }
  const td = { padding: '6px', borderBottom: `1px solid ${C.fila}`, font: '400 12px var(--font)', verticalAlign: 'middle' }

  return (
    <Modal titulo={r.id ? `Planilla · ${r.nombre}` : 'Nueva ruta semanal'} ancho={1180} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={ocupado || !datos}>{ocupado ? 'Guardando…' : 'Guardar ruta'}</button>
      </>
    }>
      {!datos ? <div style={{ padding: 18, color: C.gris }}>{error ? String(error.message || error) : 'Cargando…'}</div> : (
        <>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Campo l="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Ruta norte" /></Campo>
            <Campo l={`Semana · ${etiquetaSemana(semana)}`}>
              <input type="date" value={semana} disabled={bloq.size > 0} onChange={(e) => e.target.value && setSemana(lunesDe(e.target.value))} />
            </Campo>
            <Campo l="Operador">
              <select value={operador} onChange={(e) => setOperador(e.target.value)}>
                <option value="">Elegir…</option>
                {datos.ops.map((o) => <option key={o.id} value={o.id}>{o.nombre}{o.rol !== 'operador' ? ` · ${o.rol}` : ''}</option>)}
              </select>
            </Campo>
            <Campo l="Vehículo">
              <select value={vehiculo} onChange={(e) => setVehiculo(e.target.value)}>
                <option value="">Elegir…</option>
                {datos.flota.map((f) => {
                  const taller = ['mantencion', 'fuera_de_servicio', 'baja'].includes(f.activos?.estado)
                  return <option key={f.activo_id} value={f.activo_id} disabled={taller}>{f.activos?.codigo}{taller ? ' · en mantención' : ''}</option>
                })}
              </select>
            </Campo>
            <Campo l="Notas para el operador"><input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={300} placeholder="Salir 7:30 desde bodega" /></Campo>
          </div>

          {/* Barra para agregar filas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 18px', borderTop: `2px solid ${C.borde}`, background: C.suave }}>
            <select value="" onChange={(e) => agregarCliente(e.target.value)} style={{ border: `2px solid ${C.borde}`, minHeight: 38, font: '600 12px var(--font)', padding: '0 8px', maxWidth: 260 }}>
              <option value="">+ Agregar cliente…</option>
              {datos.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button className="btn" onClick={agregarFrecuentes} disabled={!conLimpieza.length}>
              Agregar clientes con limpieza sin ruta esta semana ({conLimpieza.length})
            </button>
            {bloq.size > 0 && <span style={{ font: '400 12px var(--font)', color: C.gris }}>Los días ya iniciados no se pueden cambiar.</span>}
          </div>

          {pendientes.length > 0 && (
            <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.fila}`, display: 'grid', gap: 6 }}>
              <strong style={{ font: '700 12px var(--font)', color: C.navy }}>Entregas y retiros por programar</strong>
              {pendientes.map((d) => (
                <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, font: '400 12px var(--font)' }}>
                  <Chip tarea={d.tipo} /><strong>{d.cliente}</strong>
                  <span style={{ color: C.gris }}>#{d.folio} · {d.banos || 'sin baños'}{d.fecha_programada ? ` · para el ${d.fecha_programada.slice(8, 10)}/${d.fecha_programada.slice(5, 7)}` : ''}</span>
                  <button className="btn" style={{ minHeight: 30, padding: '0 10px' }} onClick={() => agregarDespacho(d)}>Agregar a la ruta</button>
                </div>
              ))}
            </div>
          )}

          {/* Planilla */}
          <div style={{ overflowX: 'auto', borderTop: `2px solid ${C.borde}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={th}>#</th><th style={th}>Cliente</th><th style={th}>Tarea</th><th style={th}>Arriendos</th><th style={th}>Frecuencia</th>
                  {DIAS_RUTA.map((d) => <th key={d.v} style={{ ...th, textAlign: 'center', color: bloq.has(d.v) ? C.borde : C.gris }}>{d.l}</th>)}
                  <th style={th}>Contacto</th><th style={th}>Teléfono</th><th style={th}>Baños</th><th style={th} />
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 && (
                  <tr><td colSpan={14} style={{ ...td, padding: 18, color: C.gris }}>Agrega clientes con la barra de arriba. Cada fila es un cliente y los días en que se visita.</td></tr>
                )}
                {lineas.map((l, i) => {
                  const c = cliente[l.cliente_id] || {}
                  const desp = l.despacho_id ? datos.desp[l.despacho_id] : null
                  const frec = diasLimpieza(c).length
                  const codigos = c.arriendos?.map((a) => a.codigo).join(', ')
                  const propios = c.banos_propios ? `Baño propio${c.banos_propios > 1 ? ' ×' + c.banos_propios : ''}` : ''
                  const fija = l.dias.some((d) => bloq.has(d))
                  return (
                    <tr key={l.k} style={{ background: l.tarea === 'limpieza' ? '#fff' : '#f6f8fc' }}>
                      <td style={{ ...td, color: C.gris, fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ ...td, fontWeight: 700, maxWidth: 200 }}>{c.nombre || '—'}</td>
                      <td style={td}>
                        {desp || fija ? <Chip tarea={l.tarea} /> : (
                          <select value={l.tarea} onChange={(e) => cambiarTarea(l, e.target.value)} style={{ border: `1px solid ${C.borde}`, font: '600 12px var(--font)', padding: 4 }}>
                            <option value="limpieza">Limpieza</option><option value="entrega">Entrega</option><option value="retiro">Retiro</option>
                          </select>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>{c.arriendos?.length ?? 0}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{frec ? `${frec} por semana` : '—'}</td>
                      {DIAS_RUTA.map((d) => {
                        const on = l.dias.includes(d.v)
                        const b = bloq.has(d.v)
                        return (
                          <td key={d.v} style={{ ...td, textAlign: 'center', padding: 2 }}>
                            <button type="button" onClick={() => alternarDia(l, d.v)} disabled={b} aria-label={`${d.largo} ${on ? 'marcado' : ''}`} style={{
                              width: 30, height: 30, cursor: b ? 'not-allowed' : 'pointer', font: '700 12px var(--font)',
                              border: `2px solid ${on ? C.navy : C.borde}`, background: on ? C.navy : '#fff', color: on ? '#fff' : C.borde,
                              borderRadius: l.tarea === 'limpieza' ? 0 : '50%', opacity: b ? 0.5 : 1,
                            }}>{on ? '✓' : ''}</button>
                          </td>
                        )
                      })}
                      <td style={td}>{c.contacto_nombre || '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{c.telefono || '—'}</td>
                      <td style={{ ...td, maxWidth: 220 }}>
                        {l.tarea === 'limpieza' ? ([codigos, propios].filter(Boolean).join(' · ') || <span style={{ color: C.rojo }}>Sin baños</span>)
                          : desp ? <span>#{desp.folio} · {desp.banos}</span>
                            : <button className="btn" style={{ minHeight: 30, padding: '0 10px', borderColor: l.banos.length ? C.borde : C.amarillo }} onClick={() => abrirBanos(l)}>
                              {l.banos.length ? `${l.banos.length} elegido(s)` : 'Elegir baños'}
                            </button>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <button onClick={() => mover(i, -1)} style={mini} aria-label="Subir">↑</button>
                        <button onClick={() => mover(i, 1)} style={mini} aria-label="Bajar">↓</button>
                        {!fija && <button onClick={() => quitar(l.k)} style={{ ...mini, color: C.rojo }} aria-label="Quitar">✕</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {lineas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ ...td, fontWeight: 700, textAlign: 'right', background: C.suave }}>Paradas por día</td>
                    {porDia.map((n, i) => <td key={i} style={{ ...td, textAlign: 'center', fontWeight: 700, background: C.suave }}>{n}</td>)}
                    <td colSpan={4} style={{ ...td, background: C.suave }} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div style={{ padding: '8px 18px', font: '400 11px/1.5 var(--font)', color: C.gris }}>
            Limpiezas: marca todos los días en que se visita. Entregas y retiros: un solo día (círculo). El orden de las filas es el orden de las paradas.
          </div>
          {error && <div style={{ margin: '0 18px 14px', padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 13px var(--font)', color: '#7c1405' }}>{error}</div>}
        </>
      )}

      {elegir && (
        <Modal titulo={`${L_TAREA[elegir.l.tarea]} · ${cliente[elegir.l.cliente_id]?.nombre || ''}`} ancho={520} onCerrar={() => setElegir(null)}
          pie={<button className="btn btn-verde" onClick={() => setElegir(null)}>Listo</button>}>
          <div style={{ padding: 18 }}>
            <SelectorBanos banos={elegir.banos} elegidos={lineas.find((x) => x.k === elegir.l.k)?.banos || []}
              onChange={(b) => cambiar(elegir.l.k, { banos: b })}
              vacio={elegir.l.tarea === 'entrega' ? 'No hay baños disponibles.' : 'Este cliente no tiene baños en arriendo.'} />
          </div>
        </Modal>
      )}
    </Modal>
  )
}

const mini = { border: `1px solid ${C.borde}`, background: '#fff', width: 26, height: 26, cursor: 'pointer', marginRight: 3, font: '700 12px var(--font)', color: C.navy }
