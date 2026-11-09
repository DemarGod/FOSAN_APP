import { useState } from 'react'
import Modal from './Modal'
import { iniciarDia, marcarParadaRuta, marcarParadaRutaVarios, cerrarDia, SEMAFORO, L_TAREA, DIAS_RUTA } from '../lib/rutasSemana'
import { hoyISO } from '../lib/costos'
import { C, Icon, I } from '../lib/ui'
import { subirRespaldo } from '../lib/api'
import { Lienzo, aBlob } from './OpRespaldos'

const num = (x) => String(x ?? '').replace(/\D/g, '').slice(0, 8)
const miles = (n) => Number(n).toLocaleString('es-CL')
const TIPOS_MANT = ['Mantención correctiva', 'Mantención preventiva', 'Reparación de puerta', 'Cambio de estanque', 'Revisión de bomba', 'Otro']
const mapa = (dir) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`

// Un día de una ruta: iniciar con km, marcar paradas con semáforo y cerrar con km
export default function DiaRuta({ viaje, editable, onCambio }) {
  const v = viaje
  const hoy = hoyISO()
  const [km, setKm] = useState('')
  const [marcar, setMarcar] = useState(null)
  const [cerrar, setCerrar] = useState(false)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const iniciado = !!v.iniciada_en
  const cerrado = v.estado === 'cerrada'
  const futuro = v.fecha > hoy
  const activo = editable && iniciado && !cerrado
  const cuenta = (e) => v.paradas.filter((p) => p.estado === e).length
  const nombreDia = DIAS_RUTA.find((d) => d.v === new Date(v.fecha + 'T12:00:00').getDay())?.largo || ''

  const correr = async (fn) => {
    setError(null); setOcupado(true)
    try { await fn(); await onCambio() } catch (e) { setError(String(e.message || e)) }
    setOcupado(false)
  }
  const iniciar = () => {
    if (!km) return setError('Ingresa el kilometraje que marca el vehículo antes de salir.')
    if (v.kilometraje && Number(km) < Number(v.kilometraje) &&
      !window.confirm(`El último kilometraje registrado de ${v.vehiculo} es ${miles(v.kilometraje)} km y escribiste ${miles(km)}. ¿Está bien?`)) return
    correr(() => iniciarDia(v.id, Number(km)))
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Estado del día y kilometraje */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1px solid ${C.borde}`, background: 'var(--panel)', borderRadius: 'var(--radio-md)' }}>
        <span style={{ flex: '1 1 180px' }}>
          <strong style={{ display: 'block', font: '700 15px var(--font)', color: C.navy }}>{nombreDia} {v.fecha.slice(8, 10)}/{v.fecha.slice(5, 7)}</strong>
          <span style={{ font: '400 12px var(--font)', color: C.gris }}>
            {v.vehiculo || 'Sin vehículo'} · {cerrado ? `Cerrado · ${miles(v.km_real ?? 0)} km recorridos` : iniciado ? `En ruta desde ${miles(v.odometro_salida)} km` : futuro ? 'Aún no comienza' : 'Sin iniciar'}
          </span>
        </span>
        {Object.entries(SEMAFORO).map(([k, s]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 12px var(--font)', color: '#9BAEC5' }}>
            <Punto color={s.c} />{s.l}: {cuenta(k)}
          </span>
        ))}
      </div>

      {editable && !iniciado && !futuro && (
        <div style={{ display: 'grid', gap: 10, padding: 14, border: `1px solid ${C.azul}`, background: C.tinte, borderRadius: 'var(--radio-md)' }}>
          <strong style={{ font: '700 14px var(--font)', color: C.navy }}>Antes de salir, ingresa el kilometraje del vehículo</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={km} onChange={(e) => setKm(num(e.target.value))} inputMode="numeric" placeholder={v.kilometraje ? `Último: ${miles(v.kilometraje)} km` : 'Km del odómetro'}
              style={{ flex: '1 1 160px', border: `1px solid ${C.borde}`, font: '600 15px var(--font)', padding: '10px 12px', minHeight: 46, borderRadius: 'var(--radio-sm)' }} />
            <button className="btn btn-azul" onClick={iniciar} disabled={ocupado} style={{ minHeight: 46 }}>Iniciar ruta del día</button>
          </div>
          <span style={{ font: '400 12px/1.4 var(--font)', color: C.gris }}>Al iniciar el día aparecen en cada parada los botones <b>Realizada</b> y <b>No se pudo</b> para marcarla (con fotos, firma y aviso de baño con falla).</span>
        </div>
      )}

      {error && <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,.14)', border: `1px solid ${C.rojo}`, font: '400 13px/1.45 var(--font)', color: '#FCA5A5', borderRadius: 'var(--radio-sm)' }}>{error}</div>}

      {/* Paradas */}
      <div style={{ border: `1px solid ${C.borde}`, background: 'var(--panel)', borderRadius: 'var(--radio-md)' }}>
        {v.paradas.length === 0 && <div style={{ padding: 14, font: '400 13px var(--font)', color: C.gris }}>No hay paradas este día.</div>}
        {v.paradas.map((p, i) => {
          const s = SEMAFORO[p.estado] || SEMAFORO.pendiente
          const c = p.clientes || {}
          const dir = [c.direccion, c.comuna].filter(Boolean).join(', ')
          const servicio = p.despacho?.servicio_tipo
          const banos = servicio === 'limpieza_fosas' ? 'Fosa' : p.despacho ? p.despacho.banos
          : [p.codigos.join(', '), c.banos_propios ? `Baño propio${c.banos_propios > 1 ? ' ×' + c.banos_propios : ''}` : ''].filter(Boolean).join(' · ')
          const fijo = p.despacho_id && p.estado === 'hecha'
          return (
            <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderBottom: `1px solid ${C.fila}`, borderLeft: `5px solid ${s.c}` }}>
              <span style={{ flex: 'none', display: 'grid', justifyItems: 'center', gap: 4, paddingTop: 2 }}>
                <Punto color={s.c} grande />
                <span style={{ font: '700 11px var(--font)', color: C.gris }}>{i + 1}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <strong style={{ font: '700 14px/1.3 var(--font)' }}>{c.nombre}</strong>
                  <Chip tarea={p.tarea} servicio={servicio} />
                  <span style={{ font: '600 11px var(--font)', color: s.c }}>{s.l}</span>
                </span>
                {banos && <span style={{ font: '400 12px var(--font)', color: '#9BAEC5' }}>{servicio === 'limpieza_fosas' ? 'Fosa' : `Baños: ${banos}`}</span>}
                {(c.contacto_nombre || c.telefono) && (
                  <span style={{ font: '400 12px var(--font)', color: '#9BAEC5' }}>
                    {c.contacto_nombre}{c.contacto_nombre && c.telefono ? ' · ' : ''}
                    {c.telefono && <a href={`tel:${c.telefono.replace(/\s/g, '')}`} style={{ color: C.azul }}>{c.telefono}</a>}
                  </span>
                )}
                {dir && (
                  <a href={mapa(dir)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '400 12px var(--font)', color: C.azul, width: 'fit-content' }}>
                    <Icon d={I.pin} size={13} />{dir}
                  </a>
                )}
                {p.observacion && <span style={{ font: '400 12px/1.4 var(--font)', color: C.tinta, background: C.suave, padding: '6px 8px' }}>“{p.observacion}”</span>}
                {p.requiere_mantencion && <span style={{ font: '700 11px var(--font)', color: C.rojo }}>
                  ⚠ Requiere mantención{p.mant_tipo?.includes(': ') ? ` · ${p.mant_tipo}` : <>{p.mant_tipo ? ` · ${p.mant_tipo}` : ''}{p.mant_banos ? ` · ${p.mant_banos}` : ''}{p.mant_retirado ? ' · retirado a bodega' : p.mant_banos ? ' · quedó en el cliente' : ''}</>}
                </span>}
              </span>
              {activo && !fijo && (
                <span style={{ flex: 'none', display: 'grid', gap: 6 }}>
                  {p.estado === 'pendiente' ? (
                    <>
                      <button className="btn btn-verde" style={{ minHeight: 42, minWidth: 116 }} onClick={() => setMarcar({ p, estado: 'hecha' })}>Realizada</button>
                      <button className="btn" style={{ minHeight: 38, color: C.rojo, borderColor: C.rojo }} onClick={() => setMarcar({ p, estado: 'no_realizada' })}>No se pudo</button>
                      {p.codigos?.length > 0 && servicio !== 'limpieza_fosas' && servicio !== 'limpieza_cliente' && <button className="btn" style={{ minHeight: 34, fontSize: 12 }} onClick={() => setMarcar({ p, estado: 'hecha', mantInicial: true })}
                        title="Marca la parada como realizada e informa el baño con falla">⚠ Realizada · baño con falla</button>}
                    </>
                  ) : (
                    <button className="btn" style={{ minHeight: 38 }} onClick={() => correr(() => marcarParadaRuta(p.id, 'pendiente'))} disabled={ocupado}>Deshacer</button>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {activo && (
        <button className="btn btn-azul" style={{ minHeight: 46, justifySelf: 'start' }} onClick={() => setCerrar(true)}>Cerrar ruta del día</button>
      )}

      {marcar && <Marcar {...marcar} fecha={v.fecha} onCerrar={() => setMarcar(null)} onListo={() => { setMarcar(null); onCambio() }} />}
      {cerrar && <Cerrar viaje={v} pendientes={cuenta('pendiente')} onCerrar={() => setCerrar(false)} onListo={() => { setCerrar(false); onCambio() }} />}
    </div>
  )
}

// Confirmar una parada, con observación y aviso de mantención
function Marcar({ p, estado, fecha, onCerrar, onListo, mantInicial = false }) {
  const [obs, setObs] = useState('')
  // Respaldo opcional (se guarda en Google Drive): firma de quien recibe y fotos
  const [firma, setFirma] = useState(null)
  const [firmante, setFirmante] = useState('')
  const [fotos, setFotos] = useState([])
  const [mant, setMant] = useState(mantInicial)
  // Baños con falla: { [id]: { tipo, otro, retirado } } — cada baño con su propia mantención
  const [malos, setMalos] = useState({})
  const elegidos = Object.keys(malos)
  const alternarMalo = (id) => setMalos((m) => {
    if (m[id]) { const n = { ...m }; delete n[id]; return n }
    return { ...m, [id]: { tipo: TIPOS_MANT[0], otro: '', retirado: false } }
  })
  const cambiarMalo = (id, c) => setMalos((m) => ({ ...m, [id]: { ...m[id], ...c } }))
  const unidades = p.unidades || []
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const ok = estado === 'hecha'
  const retiro = p.tarea === 'retiro' || p.tarea === 'cambio'
    // Solo se reportan mantenciones de baños FOSAN: no en fosas ni en limpieza de baños propios del cliente
  const servicio = p.despacho?.servicio_tipo
  const puedeMant = unidades.length > 0 && servicio !== 'limpieza_fosas' && servicio !== 'limpieza_cliente'
  const guardar = async () => {
    if (!ok && !obs.trim()) return setError('Escribe por qué no se pudo.')
      if (puedeMant && mant && !elegidos.length) return setError(unidades.length ? 'Marca cuál o cuáles baños requieren mantención.' : 'Este clienteno tiene baños FOSAN en arriendo para reportar.')
    const items = mant && puedeMant ? elegidos.map((id) => ({
      id, tipo: malos[id].tipo === 'Otro' ? malos[id].otro.trim() : malos[id].tipo, retirado: retiro && ok ? true : malos[id].retirado,
    })) : []
    const sinTipo = items.find((x) => !x.tipo)
    if (sinTipo) return setError(`Escribe el tipo de mantención de ${unidades.find((u) => u.id === sinTipo.id)?.codigo || 'un baño'}.`)



    if (ok && firma && firmante.trim().length < 3) return setError('Escribe el nombre de quien firma.')
    if (fotos.some((f) => f.size > 10 * 1024 * 1024)) return setError('Máximo 10 MB por foto.')
    setOcupado(true); setError(null)
    try { await marcarParadaRutaVarios(p.id, estado, obs, items) } catch (e) { setError(String(e.message || e)); setOcupado(false); return }    // La parada ya quedó marcada; si falla el respaldo, se avisa pero no se deshace
    const destino = { paradaId: p.id, folio: p.despacho?.folio || `Ruta ${fecha} ${p.clientes?.nombre || ''}`.trim() }
    try {
      if (ok && firma) await subirRespaldo(p.despacho_id, await aBlob(firma), 'firma', { ...destino, nombre: 'firma.png', firmante: firmante.trim() })
      for (const f of fotos) await subirRespaldo(p.despacho_id, f, 'archivo', destino)
    } catch (e) {
      window.alert(`La parada quedó marcada, pero no se pudo guardar el respaldo (${e.message || e}). Avisa a administración.`)
    }
    onListo()
  }
  return (
    <Modal titulo={`${ok ? 'Realizada' : 'No se pudo'} · ${p.clientes?.nombre || ''}`} ancho={480} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Volver</button>
        <button className={ok ? 'btn btn-verde' : 'btn'} onClick={guardar} disabled={ocupado}
          style={ok ? undefined : { background: C.rojo, borderColor: C.rojo, color: '#fff' }}>{ocupado ? 'Guardando…' : 'Confirmar'}</button>
      </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 12, font: '400 13px/1.5 var(--font)' }}>
        {ok && p.tarea === 'entrega' && <p style={{ margin: 0 }}>Los baños quedan <strong>En arriendo</strong> en el cliente.</p>}
        {ok && retiro && <p style={{ margin: 0 }}>Los baños retirados vuelven a bodega como <strong>Disponibles</strong>, salvo que marques que requieren mantención.</p>}
        <label className="campo">
          <span>Observación{ok ? ' (opcional)' : ''}</span>
          <textarea rows={3} maxLength={300} value={obs} onChange={(e) => setObs(e.target.value)} autoFocus
            placeholder={ok ? 'Ej.: el encargado pidió cambiar la hora de limpieza' : 'Ej.: portón cerrado, no había nadie'} />
        </label>
        {puedeMant &&(ok || !retiro) && (
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: `1px solid ${mant ? C.rojo : C.borde}`, cursor: 'pointer', borderRadius: 'var(--radio-sm)' }}>
            <input type="checkbox" checked={mant} onChange={(e) => setMant(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.rojo, marginTop: 1 }} />
            <span>
              <strong>Requiere mantención</strong>
              <span style={{ display: 'block', font: '400 12px var(--font)', color: C.gris }}>
                {retiro && ok ? 'El baño queda En mantención (no disponible) y se agenda su revisión.' : 'Se agenda la mantención del baño y se avisa a administración.'}
              </span>
            </span>
          </label>
        )}
        {puedeMant && mant && (ok || !retiro) && (
          <div style={{ display: 'grid', gap: 10, padding: '10px 12px', border: `1px solid ${C.rojo}`, background: 'var(--panel)', borderRadius: 'var(--radio-md)' }}>
            <span><strong>¿Cuáles baños?</strong>{!unidades.length && <span style={{ color: C.gris }}> · el cliente no tiene baños FOSAN en arriendo</span>}</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {unidades.map((u) => {
                const sel = !!malos[u.id]
                return (
                  <button key={u.id} type="button" className="btn" onClick={() => alternarMalo(u.id)}
                    style={{ minHeight: 36, background: sel ? C.rojo : 'var(--panel)', color: sel ? '#fff' : C.tinta, borderColor: sel ? C.rojo : C.borde }}>
                    {sel ? '✓ ' : ''}{u.codigo}
                  </button>
                )
              })}
            </div>
            {/* Una ficha por baño elegido: cada uno puede tener una mantención distinta */}
            {unidades.filter((u) => malos[u.id]).map((u) => {
              const m = malos[u.id]
              return (
                <div key={u.id} style={{ display: 'grid', gap: 8, padding: '8px 10px', borderLeft: `4px solid ${C.rojo}`, background: 'rgba(239,68,68,.10)' }}>
                  <strong>{u.codigo}</strong>
                  <select value={m.tipo} onChange={(e) => cambiarMalo(u.id, { tipo: e.target.value })} aria-label={`Tipo de mantención de ${u.codigo}`}>
                    {TIPOS_MANT.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {m.tipo === 'Otro' && <input value={m.otro} onChange={(e) => cambiarMalo(u.id, { otro: e.target.value })} maxLength={60} placeholder="Ej.: Cambio de lavamanos" />}
                  {!(retiro && ok) && (
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={m.retirado} onChange={(e) => cambiarMalo(u.id, { retirado: e.target.checked })} style={{ width: 18, height: 18 }} />
                      Lo retiré y lo llevo a bodega
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {ok && (
          <div style={{ display: 'grid', gap: 8 }}>
            <strong>Firma de quien recibe (opcional)</strong>
            <input value={firmante} onChange={(e) => setFirmante(e.target.value)} maxLength={80} placeholder="Nombre del encargado" />
            <Lienzo onCambio={setFirma} />
          </div>
        )}
        <label className="campo">
          <span>Fotos (opcional){fotos.length ? ` · ${fotos.length} elegida(s)` : ''}</span>
          <input type="file" accept="image/*,application/pdf" multiple onChange={(e) => setFotos([...e.target.files])} />
        </label>
        {error && <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,.14)', border: `1px solid ${C.rojo}`, color: '#FCA5A5', borderRadius: 'var(--radio-sm)' }}>{error}</div>}
      </div>
    </Modal>
  )
}

// Cerrar el día con el km final
function Cerrar({ viaje, pendientes, onCerrar, onListo }) {
  const [km, setKm] = useState('')
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const recorridos = km ? Number(km) - Number(viaje.odometro_salida) : null
  const guardar = async () => {
    if (!km) return setError('Ingresa el kilometraje del vehículo al llegar.')
    if (recorridos <= 0) return setError(`Debe ser mayor que el inicial (${miles(viaje.odometro_salida)} km).`)
    setOcupado(true); setError(null)
    try { await cerrarDia(viaje.id, Number(km)); onListo() } catch (e) { setError(String(e.message || e)); setOcupado(false) }
  }
  return (
    <Modal titulo="Cerrar ruta del día" ancho={440} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Volver</button>
        <button className="btn btn-azul" onClick={guardar} disabled={ocupado}>{ocupado ? 'Cerrando…' : 'Cerrar día'}</button>
      </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 12, font: '400 13px/1.5 var(--font)' }}>
        <label className="campo">
          <span>Kilometraje al llegar</span>
          <input value={km} onChange={(e) => setKm(num(e.target.value))} inputMode="numeric" autoFocus placeholder={`Salió con ${miles(viaje.odometro_salida)} km`}
            style={{ font: '600 15px var(--font)', minHeight: 46 }} />
        </label>
        {recorridos > 0 && <p style={{ margin: 0 }}>Recorrido del día: <strong>{miles(recorridos)} km</strong></p>}
        {pendientes > 0 && (
          <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,.14)', border: `1px solid ${C.amarillo}`, borderRadius: 'var(--radio-sm)' }}>
            Quedan {pendientes} parada(s) pendientes. Al cerrar quedarán como <strong>No se pudo</strong>.
          </div>
        )}
        {error && <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,.14)', border: `1px solid ${C.rojo}`, color: '#FCA5A5', borderRadius: 'var(--radio-sm)' }}>{error}</div>}
      </div>
    </Modal>
  )
}

export const Punto = ({ color, grande }) => (
  <span style={{ display: 'inline-block', width: grande ? 14 : 10, height: grande ? 14 : 10, borderRadius: '50%', background: color, flex: 'none' }} />
)

export const Chip = ({ tarea }) => (
  <span style={{
    font: '600 10px var(--font)', textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 7px',
    background: tarea === 'limpieza' ? C.tinte : C.azul, color: tarea === 'limpieza' ? C.navy : '#fff',
  }}>{L_TAREA[tarea] || tarea}</span>
)
