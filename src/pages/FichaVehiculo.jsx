// Flota → Ficha del vehículo (complementa la lámina 5): datos, disponibilidad, rutas, mantenimiento,
// insumos a bordo y documentos/observaciones. Se abre con "Ver ficha" en Flota (/activo/:token).
// Reemplaza la ficha antigua de vehículos; los costos solo los ve quien tiene "Ver montos".
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import FormVehiculo from '../components/FormVehiculo'
import { Boton, Tabla, Estado, Ayuda, Pestanas } from '../components/Base'
import { L_FLOTA, CambiarDisponibilidad, Desactivar } from './Flota'
import { supabase } from '../lib/supabase'
import { flota, vehiculos, parametros, mantenimiento, documentosDe, observacionesDe, agregarObservacion } from '../lib/api'
import { TIPOS_VEHICULO, costoKmVehiculo, mapaParametros } from '../lib/costos'
import { useSesion, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, Icon, I, qrCeldas, fecha, fechaHora, clp } from '../lib/ui'

const TONO = { disponible: 'ok', en_ruta: 'info', mantenimiento: 'atencion', fuera_servicio: 'error', baja: 'neutro' }
const L_DISP = { disponible: 'Disponible', mantencion: 'En mantenimiento', fuera_de_servicio: 'Fuera de servicio', baja: 'Desactivado' }
const L_MANT = { programado: 'Programado', en_curso: 'En curso', completado: 'Completado', cancelado: 'Cancelado' }
const TONO_MANT = { programado: 'info', en_curso: 'atencion', completado: 'ok', cancelado: 'neutro' }
const L_RUTA = { programada: 'Programada', en_curso: 'En curso', finalizada: 'Finalizada', cancelada: 'Cancelada' }
const estadoRuta = (s) => (s.estado === 'cerrada' ? 'finalizada' : s.estado === 'cancelada' ? 'cancelada' : s.odometro_salida != null ? 'en_curso' : 'programada')
const VOLVER = 'M19 12H5M11 6l-6 6 6 6'
const rows = async (q) => { const { data, error } = await q; if (error) throw error; return data || [] }
const miles = (n, u = 'km') => (n == null || n === '' ? '—' : `${Number(n).toLocaleString('es-CL')} ${u}`)
const PESTANAS = [
  { v: 'datos', l: 'Datos generales' }, { v: 'disponibilidad', l: 'Disponibilidad' }, { v: 'rutas', l: 'Rutas' },
  { v: 'mantenimiento', l: 'Mantenimiento' }, { v: 'insumos', l: 'Insumos a bordo' },
]

export default function FichaVehiculo({ token }) {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'transporte')
  const finanzas = verFinanzas(perfil)
  const [params, setParams] = useSearchParams()
  const tab = PESTANAS.some((p) => p.v === params.get('tab')) ? params.get('tab') : 'datos'
  const [v, setV] = useState(undefined)          // fila de v_flota
  const [tec, setTec] = useState(null)           // ficha técnica (tabla vehiculos)
  const [par, setPar] = useState({})
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)       // 'editar' | 'disp' | 'baja'
  const [version, setVersion] = useState(0)

  useEffect(() => {
    Promise.all([flota(), vehiculos(true), finanzas ? parametros() : []]).then(([l, t, p]) => {
      const x = l.find((y) => y.qr_token === token) || null
      setV(x); setTec(x ? t.find((y) => y.activo_id === x.id) || null : null); setPar(mapaParametros(p))
    }).catch((x) => { setError(x); setV(null) })
  }, [token, version])

  if (v === undefined) return <div style={{ padding: 24, color: C.gris }}>Cargando ficha…</div>
  if (!v) {
    return (
      <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
        <h2 style={{ margin: 0 }}>Vehículo no encontrado</h2>
        <div><Boton onClick={() => navegar('/flota')}>Ir a Flota</Boton></div>
      </div>
    )
  }
  const baja = v.estado_flota === 'baja'
  const listo = () => { setModal(null); setVersion((n) => n + 1) }
  const ckm = finanzas && tec ? Math.round(costoKmVehiculo(tec, par).total || 0) : 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <a href="/flota" onClick={(x) => { x.preventDefault(); navegar('/flota') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 13px var(--font)' }}>
          <Icon d={VOLVER} size={16} /> Volver a Flota
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <h2 style={{ margin: 0, flex: '1 1 260px' }}>{v.patente || 'Sin patente'} · {v.codigo}</h2>
          <Chip titulo="Tipo" fondo={C.fila}>{TIPOS_VEHICULO[v.tipo_vehiculo] || '—'}</Chip>
          <Chip titulo="Estado" fondo={C.tinte}><Estado tono={TONO[v.estado_flota]}>{L_FLOTA[v.estado_flota]}</Estado></Chip>
          <Chip titulo="Odómetro" fondo="#e6f4ea">{miles(v.kilometraje)}</Chip>
          <Boton tipo="principal" icono={I.lapiz} onClick={() => setModal('editar')} disabled={!editable || baja || !tec}>Editar datos</Boton>
          <Boton onClick={() => setModal('disp')} disabled={!editable || baja}>Cambiar disponibilidad</Boton>
          <button type="button" className="btn" onClick={() => setModal('baja')} disabled={!editable || baja} style={{ color: C.rojo, borderColor: C.rojo }}>Desactivar</button>
        </div>
        {baja && <Ayuda tono="atencion" style={{ marginTop: 12 }}>Desactivado{v.fecha_baja ? ` el ${fecha(v.fecha_baja)}` : ''}{v.motivo_baja ? ` · ${v.motivo_baja}` : ''}. Se conserva todo su historial.</Ayuda>}
      </div>

      <section className="card">
        <Pestanas opciones={PESTANAS} valor={tab} onChange={(x) => setParams(x === 'datos' ? {} : { tab: x }, { replace: true })} />
        <div style={{ padding: 18 }}>
          {tab === 'datos' && <Datos v={v} tec={tec} ckm={ckm} finanzas={finanzas} editable={editable} />}
          {tab === 'disponibilidad' && <Disponibilidad v={v} />}
          {tab === 'rutas' && <Rutas v={v} />}
          {tab === 'mantenimiento' && <Mantenciones v={v} finanzas={finanzas} onIr={() => navegar('/mantenimiento?tab=vehiculos')} />}
          {tab === 'insumos' && <Insumos v={v} onIr={() => navegar('/inventario?tab=insumos')} />}
        </div>
      </section>

      {modal === 'editar' && tec && <FormVehiculo vehiculo={tec} onCerrar={() => setModal(null)} onGuardado={listo} />}
      {modal === 'disp' && <CambiarDisponibilidad v={v} onCerrar={() => setModal(null)} onListo={listo} />}
      {modal === 'baja' && <Desactivar v={v} onCerrar={() => setModal(null)} onListo={listo} />}
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
  <div style={{ display: 'grid', gridTemplateColumns: '190px minmax(0,1fr)', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.fila}`, font: '400 14px var(--font)' }}>
    <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v ?? '—'}</span>
  </div>
)

// ── Datos generales + documentos y observaciones ──────────────────────────
function Datos({ v, tec, ckm, finanzas, editable }) {
  const [docs, setDocs] = useState([])
  const [obs, setObs] = useState([])
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState(null)
  useEffect(() => { documentosDe(v.id).then(setDocs).catch(() => {}); observacionesDe(v.id).then(setObs).catch(() => {}) }, [v.id])
  const guardarObs = async () => {
    if (!nueva.trim()) return
    try { await agregarObservacion(v.id, nueva.trim()); setObs(await observacionesDe(v.id)); setNueva('') } catch (x) { setError(x) }
  }
  const cap = [v.capacidad_kg ? miles(v.capacidad_kg, 'kg') : null, v.capacidad_banos ? `${v.capacidad_banos} baños` : null, v.capacidad_litros ? miles(v.capacidad_litros, 'L de estanque') : null].filter(Boolean).join(' · ')
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 24, alignItems: 'start' }}>
        <div>
          <Fila l="Patente" v={v.patente} />
          <Fila l="Código" v={v.codigo} />
          <Fila l="Tipo" v={TIPOS_VEHICULO[v.tipo_vehiculo]} />
          <Fila l="Marca y modelo" v={[v.marca, v.modelo].filter(Boolean).join(' ') || null} />
          <Fila l="Año" v={v.anio} />
          <Fila l="Odómetro" v={miles(v.kilometraje)} />
          <Fila l="Capacidades" v={cap || null} />
          <Fila l="Fecha de registro" v={v.fecha_registro ? fecha(v.fecha_registro) : null} />
          <Fila l="Observaciones" v={v.observaciones} />
          {finanzas && tec && <>
            <Fila l="Rendimiento vacío / cargado" v={tec.rend_vacio ? `${tec.rend_vacio} / ${tec.rend_cargado ?? tec.rend_vacio} km/L` : null} />
            <Fila l="Costo por km" v={ckm ? `${clp(ckm)}/km` : null} />
          </>}
        </div>
        {v.qr_token && (
          <div style={{ textAlign: 'center' }}>
            <svg width={160} height={160} viewBox="0 0 160 160" style={{ border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', background: '#fff' }}>
              {qrCeldas(v.qr_token).map((q, i) => <rect key={i} x={q.x} y={q.y} width={8} height={8} fill={C.tinta} />)}
            </svg>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>QR del vehículo</div>
          </div>
        )}
      </div>
      <details open={obs.length > 0 || docs.length > 0}>
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

// ── Historial de disponibilidad ───────────────────────────────────────────
function Disponibilidad({ v }) {
  const [l, setL] = useState(null)
  useEffect(() => { rows(supabase.from('vehiculo_disponibilidad').select('*').eq('activo_id', v.id).order('creado_en', { ascending: false })).then(setL).catch(() => setL([])) }, [v.id])
  if (l === null) return <span className="text-muted">Cargando…</span>
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Tabla filas={l} vacio="Sin cambios de disponibilidad registrados." columnas={[
        { k: 'fecha', label: 'Fecha', render: (x) => fecha(x.fecha) },
        { k: 'estado', label: 'Estado', render: (x) => L_DISP[x.estado] || x.estado },
        { k: 'motivo', label: 'Motivo' },
        { k: 'creado_en', label: 'Registrado', render: (x) => fechaHora(x.creado_en) },
      ]} />
      <Ayuda>"En ruta" no se registra a mano: se activa al iniciar el día de ruta con kilometraje. Historial solo lectura.</Ayuda>
    </div>
  )
}

// ── Rutas recorridas (días de ruta) ───────────────────────────────────────
function Rutas({ v }) {
  const [l, setL] = useState(null)
  useEffect(() => {
    rows(supabase.from('v_salidas').select('*').eq('vehiculo_id', v.id).order('fecha', { ascending: false }).limit(60)).then(async (s) => {
      const ids = [...new Set(s.map((x) => x.ruta_semana_id).filter(Boolean))]
      const rs = ids.length ? await rows(supabase.from('rutas_semana').select('id, nombre').in('id', ids)).catch(() => []) : []
      const nom = Object.fromEntries(rs.map((r) => [r.id, r.nombre]))
      setL(s.map((x) => ({ ...x, _ruta: nom[x.ruta_semana_id] || x.ruta || '—', _estado: estadoRuta(x) })))
    }).catch(() => setL([]))
  }, [v.id])
  if (l === null) return <span className="text-muted">Cargando…</span>
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Tabla filas={l} vacio="Este vehículo no tiene rutas registradas." columnas={[
        { k: 'fecha', label: 'Fecha', render: (x) => fecha(x.fecha) },
        { k: 'ruta', label: 'Ruta', render: (x) => x._ruta },
        { k: 'estado', label: 'Estado', render: (x) => L_RUTA[x._estado] },
        { k: 'paradas', label: 'Paradas', alinear: 'right', render: (x) => `${x.paradas_hechas ?? 0} / ${x.paradas ?? 0}` },
        { k: 'km', label: 'Km', alinear: 'right', render: (x) => (x.km_real != null ? miles(x.km_real) : 'Pendiente') },
      ]} />
      <Ayuda>Últimos 60 días de ruta. El informe completo está en Reportes → Flota.</Ayuda>
    </div>
  )
}

// ── Mantenimiento del vehículo ────────────────────────────────────────────
function Mantenciones({ v, finanzas, onIr }) {
  const [l, setL] = useState(null)
  useEffect(() => { mantenimiento().then((m) => setL(m.filter((x) => x.activo_id === v.id))).catch(() => setL([])) }, [v.id])
  if (l === null) return <span className="text-muted">Cargando…</span>
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div><Boton tipo="principal" icono={I.wrench} onClick={onIr}>Ir a Mantenimiento</Boton></div>
      <Tabla filas={l} vacio="Sin mantenimientos registrados." columnas={[
        { k: 'folio', label: 'Folio' },
        { k: 'tipo', label: 'Tipo' },
        { k: 'fp', label: 'Programada', render: (x) => fecha(x.fecha_programada) },
        { k: 'fr', label: 'Realizada', render: (x) => (x.fecha_realizada ? fecha(x.fecha_realizada) : '—') },
        { k: 'responsable', label: 'Responsable', render: (x) => x.responsable || '—' },
        { k: 'estado', label: 'Estado', render: (x) => <span style={{ display: 'inline-flex', gap: 6 }}><Estado tono={TONO_MANT[x.estado_m]}>{L_MANT[x.estado_m]}</Estado>{x.vencido && <Estado tono="error">Vencido</Estado>}</span> },
        ...(finanzas ? [{ k: 'costo', label: 'Costo', alinear: 'right', render: (x) => (x.costo ? clp(x.costo) : '—') }] : []),
      ]} />
      <Ayuda>Programar, iniciar y registrar el resultado se hace en el módulo Mantenimiento.</Ayuda>
    </div>
  )
}

// ── Insumos a bordo (el vehículo como ubicación) ──────────────────────────
function Insumos({ v, onIr }) {
  const [l, setL] = useState(null)
  useEffect(() => {
    if (!v.ubicacion_insumos_id) { setL([]); return }
    rows(supabase.from('insumo_existencias').select('id, cantidad, insumos(codigo, nombre, unidad), insumo_lotes(codigo, vencimiento)').eq('ubicacion_id', v.ubicacion_insumos_id).neq('cantidad', 0))
      .then(setL).catch(() => setL([]))
  }, [v.id])
  if (l === null) return <span className="text-muted">Cargando…</span>
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div><Boton icono={I.drop} onClick={onIr}>Registrar movimiento en Inventario</Boton></div>
      <Tabla filas={l} vacio="No lleva insumos a bordo." columnas={[
        { k: 'codigo', label: 'Código', render: (x) => x.insumos?.codigo || '—' },
        { k: 'articulo', label: 'Artículo', render: (x) => x.insumos?.nombre || '—' },
        { k: 'lote', label: 'Lote', render: (x) => x.insumo_lotes?.codigo || '—' },
        { k: 'venc', label: 'Vencimiento', render: (x) => (x.insumo_lotes?.vencimiento ? fecha(x.insumo_lotes.vencimiento) : '—') },
        { k: 'cantidad', label: 'Cantidad', alinear: 'right', render: (x) => `${Number(x.cantidad).toLocaleString('es-CL')} ${x.insumos?.unidad || ''}` },
      ]} />
      <Ayuda>Los insumos suben o bajan del vehículo con un Traslado en Inventario → Insumos y EPP. Para desactivar el vehículo, primero deben volver a bodega.</Ayuda>
    </div>
  )
}
