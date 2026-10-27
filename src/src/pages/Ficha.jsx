import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Mapa from '../components/Mapa'
import FormMantencion from '../components/FormMantencion'
import { Aviso } from '../components/Listado'
import {
  activoPorQr, movimientosDe, documentosDe, observacionesDe, agregarObservacion, mantencionesDe,
} from '../lib/api'
import { useSesion, puedeEditar, puedeOperar, verFinanzas } from '../lib/sesion'
import {
  C, Icon, I, Badge, qrCeldas, clp, fecha, fechaHora,
  L_TIPO_ACTIVO, L_ESTADO_ACTIVO, L_MOVIMIENTO, L_TIPO_DOC,
} from '../lib/ui'

const TABS = [
  { k: 'historial', l: 'Movimientos' },
  { k: 'clientes', l: 'Clientes anteriores' },
  { k: 'mantenciones', l: 'Mantenciones y reparaciones' },
  { k: 'documentos', l: 'Documentos' },
  { k: 'observaciones', l: 'Observaciones' },
]

export default function Ficha() {
  const { token } = useParams()
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'banos')
  const finanzas = verFinanzas(perfil)

  const [activo, setActivo] = useState(null)
  const [hist, setHist] = useState([])
  const [docs, setDocs] = useState([])
  const [obs, setObs] = useState([])
  const [mants, setMants] = useState([])
  const [tab, setTab] = useState('historial')
  const [nuevaObs, setNuevaObs] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState(false)

  useEffect(() => {
    setCargando(true)
    activoPorQr(token)
      .then(async (a) => {
        setActivo(a)
        if (!a) return
        const [m, d, o] = await Promise.all([movimientosDe(a.id), documentosDe(a.id), observacionesDe(a.id)])
        setHist(m); setDocs(d); setObs(o)
        mantencionesDe(a.id).then(setMants).catch(() => {})
      })
      .catch(setError)
      .finally(() => setCargando(false))
  }, [token])

  const guardarObs = async () => {
    const t = nuevaObs.trim()
    if (!t || !activo) return
    try {
      await agregarObservacion(activo.id, t)
      setObs(await observacionesDe(activo.id))
      setNuevaObs('')
    } catch (e) { setError(e) }
  }

  if (cargando) return <p className="text-muted">Cargando ficha…</p>
  if (!activo) {
    return (
      <div>
        <Aviso error={error} />
        <h2 style={{ margin: '0 0 8px' }}>Unidad no encontrada</h2>
        <p className="text-muted">
          Este código QR no corresponde a ninguna unidad registrada, o tu usuario no tiene permiso
          para verla.
        </p>
        <button className="btn" onClick={() => navegar('/inventario')} style={{ marginTop: 12 }}>
          ← Ir al inventario
        </button>
      </div>
    )
  }

  const u = activo.ubicaciones
  const esVehiculo = activo.tipo === 'camion' || activo.tipo === 'camioneta'
  const tabs = esVehiculo ? TABS.filter((t) => t.k !== 'clientes') : TABS
  // Días arrendado: desde la última instalación registrada
  const inst = activo.estado === 'en_arriendo' ? hist.find((h) => h.tipo === 'instalacion') : null
  const diasArriendo = inst ? Math.max(0, Math.floor((Date.now() - new Date(/^\d{4}-\d{2}-\d{2}$/.test(inst.fecha) ? inst.fecha + 'T12:00:00' : inst.fecha)) / 864e5)) : null
  const punto = u?.lat != null ? [{
    id: activo.id, nombre: u.nombre, tipo: u.tipo, lat: u.lat, lng: u.lng,
    cliente: activo.clientes?.nombre, activos: 1, banos: activo.tipo === 'bano_quimico' ? 1 : 0,
    vehiculos: 0, en_mantencion: activo.estado === 'mantencion' ? 1 : 0,
  }] : []

  const datos = [
    { k: 'Código', v: activo.codigo },
    { k: 'Tipo', v: L_TIPO_ACTIVO[activo.tipo] || activo.tipo },
    { k: 'Modelo', v: activo.modelos_bano?.nombre || activo.detalle || '—' },
    { k: 'Serie', v: activo.serie || '—' },
    { k: 'Estado', v: L_ESTADO_ACTIVO[activo.estado] || activo.estado },
    ...(esVehiculo ? [] : [{ k: 'Cliente actual', v: activo.clientes?.nombre || 'Sin asignar' }]),
    ...(activo.estado === 'en_arriendo' && !esVehiculo ? [{ k: 'Días arrendado', v: diasArriendo === null ? 'Sin fecha de instalación' : `${diasArriendo} día(s) · desde ${fecha(inst.fecha)}` }] : []),
    { k: 'Ubicación', v: u?.nombre || 'Sin ubicación' },
    { k: 'Fecha de incorporación', v: fecha(activo.fecha_compra) },
    ...(finanzas && !esVehiculo ? [{ k: 'Valor arriendo', v: activo.valor_arriendo ? clp(activo.valor_arriendo) + ' / mes' : '—' }] : []),
  ]

  return (
    <div>
      <button className="btn" onClick={() => navegar(-1)} style={{ marginBottom: 12, minHeight: 40 }}>
        ← Volver
      </button>

      <Aviso error={error} />

      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{activo.codigo}</h2>
            <Badge>{L_ESTADO_ACTIVO[activo.estado] || activo.estado}</Badge>
          </div>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            {L_TIPO_ACTIVO[activo.tipo]}
            {activo.modelos_bano?.nombre ? ' · ' + activo.modelos_bano.nombre : ''}
            {activo.serie ? ' · Serie ' + activo.serie : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-verde" onClick={() => setForm(true)} disabled={!editable}>
            Registrar mantención
          </button>
        </div>
      </div>

      <div className="cols2" style={{ marginTop: 20 }}>
        <section className="card">
          <h6>Fotografía e identificación</h6>
          <div style={{ padding: '16px 18px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              flex: 1, minWidth: 190, height: 200, border: `2px solid ${C.borde}`,
              background: C.suave, display: 'grid', placeItems: 'center',
              backgroundImage: activo.foto_url ? `url(${activo.foto_url})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center',
            }}>
              {!activo.foto_url && (
                <span style={{ font: '400 12px var(--font)', color: C.gris, textAlign: 'center', padding: 12 }}>
                  Sin fotografía cargada
                </span>
              )}
            </div>
            <div style={{ width: 150, display: 'grid', gap: 8, justifyItems: 'center' }}>
              <svg viewBox="0 0 168 168" style={{
                width: 140, height: 140, background: '#fff',
                border: `2px solid ${C.borde}`, padding: 8, boxSizing: 'border-box',
              }}>
                {qrCeldas(activo.qr_token).map((q, i) => (
                  <rect key={i} x={q.x} y={q.y} width="8" height="8" fill={C.tinta} />
                ))}
              </svg>
              <span style={{ font: '700 12px var(--font)', color: C.navy }}>{activo.codigo}</span>
              <span style={{
                font: '400 11px/1.4 var(--font)', color: C.gris, textAlign: 'center',
              }}>
                QR único de esta unidad · pegar en la cabina
              </span>
            </div>
          </div>
        </section>

        <section className="card">
          <h6>Datos del activo</h6>
          {datos.map((d) => (
            <div key={d.k} style={{
              display: 'flex', justifyContent: 'space-between', gap: 16,
              padding: '9px 18px', borderBottom: `1px solid ${C.fila}`,
            }}>
              <span style={{
                font: '400 11px var(--font)', color: C.gris,
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>{d.k}</span>
              <span style={{ font: '600 13px var(--font)', textAlign: 'right' }}>{d.v}</span>
            </div>
          ))}
        </section>
      </div>

      {punto.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            padding: '14px 18px', background: C.tinte, borderBottom: `2px solid ${C.borde}`,
          }}>
            <h6 style={{ margin: 0, color: '#1a3c72' }}>Ubicación actual</h6>
            <span style={{ font: '400 12px var(--font)', color: '#3c4551' }}>{u.nombre}</span>
          </div>
          <Mapa puntos={punto} alto={300} zoom={12} />
        </section>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 2, background: C.borde, borderBottom: `2px solid ${C.borde}` }}>
          {tabs.map((t) => {
            const on = tab === t.k
            return (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                flex: 1, border: 0, borderBottom: `3px solid ${on ? C.azul : 'transparent'}`,
                background: on ? C.tinte : '#fff', color: on ? '#1a3c72' : '#3c4551',
                font: '600 13px var(--font)', padding: '13px 10px', minHeight: 46, cursor: 'pointer',
              }}>{t.l}</button>
            )
          })}
        </div>

        {tab === 'historial' && (
          <div>
            {hist.map((h) => (
              <div key={h.id} style={{
                display: 'flex', gap: 14, padding: '12px 18px', borderBottom: `1px solid ${C.fila}`,
              }}>
                <span style={{
                  width: 10, height: 10, flex: 'none', marginTop: 5, borderRadius: '50%',
                  background: C.verde,
                }} />
                <div style={{ font: '600 12px var(--font)', minWidth: 96, color: C.gris }}>
                  {fecha(h.fecha)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13px var(--font)' }}>{L_MOVIMIENTO[h.tipo] || h.tipo}</div>
                  <div style={{ font: '400 12px/1.45 var(--font)', color: C.gris }}>
                    {h.detalle || [h.desde?.nombre, h.hacia?.nombre].filter(Boolean).join(' → ') || '—'}
                    {h.clientes?.nombre ? ' · ' + h.clientes.nombre : ''}{h.responsable?.nombre ? ' · por ' + h.responsable.nombre : ''}
                  </div>
                </div>
              </div>
            ))}
            {hist.length === 0 && (
              <div style={{ padding: 18 }} className="text-muted">Sin movimientos registrados.</div>
            )}
          </div>
        )}

        {tab === 'clientes' && (() => {
          // Clientes por los que pasó el baño, según sus movimientos
          const m = {}
          ;[...hist].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))).forEach((h) => {
            const n = h.clientes?.nombre
            if (!n) return
            const x = (m[n] ||= { nombre: n, desde: h.fecha, hasta: h.fecha, veces: 0 })
            x.hasta = h.fecha; x.veces++
          })
          const lista = Object.values(m).sort((a, b) => String(b.hasta).localeCompare(String(a.hasta)))
          return (
            <div className="scroller">
              <table style={{ minWidth: 480 }}>
                <thead><tr><th>Cliente</th><th>Primer movimiento</th><th>Último movimiento</th><th>Movimientos</th></tr></thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.nombre}>
                      <td style={{ fontWeight: 600 }}>{c.nombre}{c.nombre === activo.clientes?.nombre ? ' (actual)' : ''}</td>
                      <td>{fecha(c.desde)}</td><td>{fecha(c.hasta)}</td><td>{c.veces}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && <tr><td colSpan={4} className="text-muted">Este baño todavía no ha pasado por clientes.</td></tr>}
                </tbody>
              </table>
            </div>
          )
        })()}

        {tab === 'mantenciones' && (
          <div className="scroller">
            <table style={{ minWidth: 620 }}>
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Clase</th><th>Responsable</th>{finanzas && <th style={{ textAlign: 'right' }}>Costo</th>}<th>Estado</th></tr></thead>
              <tbody>
                {mants.map((m) => (
                  <tr key={m.id}>
                    <td>{fecha(m.fecha_realizada || m.fecha_programada)}</td>
                    <td style={{ fontWeight: 600 }}>{m.tipo}</td>
                    <td>{m.naturaleza === 'correctiva' ? 'Correctiva' : m.naturaleza === 'preventiva' ? 'Preventiva' : '—'}</td>
                    <td>{m.perfiles?.nombre || m.responsable_ext || '—'}</td>
                    {finanzas && <td style={{ textAlign: 'right' }}>{m.costo ? clp(m.costo) : '—'}</td>}
                    <td>{({ programada: 'Programada', proxima: 'Próxima', urgente: 'Urgente', completada: 'Completada', anulada: 'Anulada' })[m.estado] || m.estado}</td>
                  </tr>
                ))}
                {mants.length === 0 && <tr><td colSpan={finanzas ? 6 : 5} className="text-muted">Sin mantenciones registradas.</td></tr>}
              </tbody>
            </table>
            {finanzas && mants.some((m) => m.estado === 'completada' && m.costo) && (
              <div style={{ padding: '10px 18px', font: '600 12px var(--font)', color: '#3c4551', borderTop: `2px solid ${C.borde}` }}>
                Costo acumulado en mantenciones: {clp(mants.filter((m) => m.estado === 'completada').reduce((t, m) => t + Number(m.costo || 0), 0))}
              </div>
            )}
          </div>
        )}

        {tab === 'documentos' && (
          <div>
            {docs.map((d) => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                borderBottom: `1px solid ${C.fila}`,
              }}>
                <Icon d={I.doc} size={18} color={C.azul} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13px var(--font)' }}>{d.titulo}</div>
                  <div style={{ font: '400 11px var(--font)', color: C.gris }}>
                    {L_TIPO_DOC[d.tipo] || d.tipo} · {fecha(d.creado_en)}
                    {d.tamano_kb ? ` · ${d.tamano_kb} KB` : ''}
                  </div>
                </div>
                <a href={d.archivo_url} target="_blank" rel="noreferrer"
                  style={{ font: '600 12px var(--font)' }}>Descargar</a>
              </div>
            ))}
            {docs.length === 0 && (
              <div style={{ padding: 18 }} className="text-muted">
                Sin documentos cargados para esta unidad.
              </div>
            )}
          </div>
        )}

        {tab === 'observaciones' && (
          <div style={{ padding: '16px 18px' }}>
            {obs.map((o) => (
              <div key={o.id} style={{ padding: '11px 0', borderBottom: `1px solid ${C.fila}` }}>
                <div style={{ font: '400 13px/1.5 var(--font)' }}>{o.texto}</div>
                <div style={{ font: '400 11px var(--font)', color: C.gris, marginTop: 3 }}>
                  {fechaHora(o.creado_en)}
                </div>
              </div>
            ))}
            {obs.length === 0 && <div className="text-muted">Sin observaciones todavía.</div>}

            {editable && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <input value={nuevaObs} onChange={(e) => setNuevaObs(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') guardarObs() }}
                  placeholder="Escribir una observación"
                  style={{
                    flex: 1, minWidth: 220, border: `2px solid ${C.borde}`,
                    padding: '10px 12px', font: '400 13px var(--font)', outline: 'none',
                  }} />
                <button className="btn btn-verde" onClick={guardarObs}>Agregar</button>
              </div>
            )}
          </div>
        )}
      </section>

      {form && (
        <FormMantencion activoInicial={activo.id}
          onCerrar={() => setForm(false)} onGuardado={() => { setForm(false); mantencionesDe(activo.id).then(setMants).catch(() => {}) }} />
      )}
    </div>
  )
}
