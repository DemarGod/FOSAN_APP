import { useCallback, useEffect, useMemo, useState } from 'react'
import Mapa, { Leyenda, COLORES, colorPunto } from '../components/Mapa'
import { Kpis, Aviso } from '../components/Listado'
import { Campo } from '../components/FormCliente'
import {
  mapaPuntos, clientesResumen, limpiezasCliente, ubicarClienteEnMapa, crearUbicacion,
} from '../lib/api'
import { useSesion, puedeEditar, puedeOperar } from '../lib/sesion'
import { DIAS } from '../lib/costos'
import { C, Icon, I, L_TIPO_UBIC } from '../lib/ui'

const FILTROS = ['Todos', 'Arriendo', 'Limpieza', 'Mantención', 'Bodega']
const hoyDow = () => { const d = new Date().getDay(); return d === 0 ? 7 : d }
const coord = (n) => Number(n).toFixed(6)

export default function Ubicaciones() {
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil)
  const [puntos, setPuntos] = useState([])
  const [clientes, setClientes] = useState([])
  const [limp, setLimp] = useState({})
  const [filtro, setFiltro] = useState('Todos')
  const [dia, setDia] = useState(hoyDow())
  const [sel, setSel] = useState(null)
  const [pendiente, setPendiente] = useState(null)
  const [error, setError] = useState(null)

  const cargar = () => Promise.all([mapaPuntos(), clientesResumen(), limpiezasCliente().catch(() => [])])
    .then(([p, c, l]) => {
      setPuntos(p); setClientes(c)
      setLimp(Object.fromEntries(l.map((x) => [x.cliente_id, { veces: Number(x.veces_semana), dias: x.dias || [] }])))
    }).catch(setError)
  useEffect(() => { cargar() }, [])

  const limpiaHoy = useCallback((p) => {
    const l = p.cliente_id && limp[p.cliente_id]
    return l && l.dias.includes(dia) ? l : null
  }, [limp, dia])

  const color = useCallback((p) => {
    if (Number(p.en_mantencion) > 0 || p.tipo === 'taller') return COLORES.mantencion
    const l = limpiaHoy(p)
    if (l) return l.veces >= 2 ? COLORES.limpieza2 : COLORES.limpieza1
    return colorPunto(p)
  }, [limpiaHoy])

  const detalle = useCallback((p) => {
    const l = p.cliente_id && limp[p.cliente_id]
    if (!l) return ''
    return `Limpieza ${l.veces} vez/semana: ${DIAS.filter((d) => l.dias.includes(d.v)).map((d) => d.l).join(', ')}`
  }, [limp])

  const visibles = useMemo(() => {
    if (filtro === 'Bodega') return puntos.filter((p) => p.tipo === 'bodega')
    if (filtro === 'Mantención') return puntos.filter((p) => Number(p.en_mantencion) > 0 || p.tipo === 'taller')
    if (filtro === 'Arriendo') return puntos.filter((p) => Number(p.en_arriendo) > 0)
    if (filtro === 'Limpieza') return puntos.filter((p) => limpiaHoy(p))
    return puntos
  }, [puntos, filtro, limpiaHoy])

  const sinGeo = clientes.filter((c) => !c.georreferenciado)
  const suma = (k, f = () => true) => puntos.filter(f).reduce((s, p) => s + Number(p[k] || 0), 0)

  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>Mapa</h2>
      <p className="text-muted" style={{ margin: '0 0 16px' }}>
        {editable ? 'Navega libremente. Haz clic en cualquier parte del mapa para ubicar un cliente o crear un punto nuevo.' : 'Dónde está cada baño y qué necesita cada día.'}
      </p>

      <Kpis items={[
        { v: suma('en_arriendo'), l: 'Baños en arriendo' },
        { v: puntos.filter((p) => limpiaHoy(p)).length, l: `Limpiezas el ${DIAS.find((d) => d.v === dia)?.l}` },
        { v: suma('en_mantencion'), l: 'En mantención' },
        { v: sinGeo.length, l: 'Clientes sin ubicar' },
      ]} />
      <Aviso error={error} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2, border: `2px solid ${C.borde}`, flexWrap: 'wrap' }}>
          {FILTROS.map((f) => {
            const on = filtro === f
            return (
              <button key={f} onClick={() => setFiltro(f)} style={{
                border: 0, background: on ? C.tinte : '#fff', color: on ? '#1a3c72' : '#3c4551',
                font: '600 13px var(--font)', padding: '10px 16px', minHeight: 42, cursor: 'pointer',
              }}>{f}</button>
            )
          })}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 12px var(--font)', color: C.gris }}>
          Limpiezas del día
          <select value={dia} onChange={(e) => setDia(Number(e.target.value))} style={{
            border: `2px solid ${C.borde}`, background: '#fff', color: C.navy, font: '600 13px var(--font)',
            padding: '9px 12px', minHeight: 42,
          }}>
            {DIAS.map((d) => <option key={d.v} value={d.v}>{d.l}{d.v === hoyDow() ? ' (hoy)' : ''}</option>)}
          </select>
        </label>
        {editable && <Buscador onElegir={(r) => setPendiente({ ...r, volar: true })} />}
      </div>

      <div className="cols2" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
        <section className="card">
          <h6>Mapa de la operación</h6>
          <Mapa puntos={visibles} alto={520} zoom={9} centrarEn={sel} color={color} detalle={detalle}
            pendiente={pendiente}
            onClickMapa={editable ? (ll) => setPendiente({ ...ll, direccion: '' }) : undefined} />
          <Leyenda />
        </section>

        {pendiente
          ? <NuevoPunto punto={pendiente} clientes={clientes}
            onCancelar={() => setPendiente(null)}
            onGuardado={() => { setPendiente(null); cargar() }} />
          : <Lista visibles={visibles} sel={sel} setSel={setSel} color={color} limpiaHoy={limpiaHoy}
            sinGeo={sinGeo} editable={editable} />}
      </div>
    </div>
  )
}

function Lista({ visibles, sel, setSel, color, limpiaHoy, sinGeo, editable }) {
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 18px', background: C.tinte, borderBottom: `2px solid ${C.borde}` }}>
        <div style={{ font: '800 24px/1 var(--font)', color: '#1a3c72' }}>{visibles.length}</div>
        <div style={{ font: '400 11px var(--font)', color: '#3c4551', marginTop: 4 }}>
          puntos en esta vista · toca uno para centrarlo
        </div>
      </div>
      <div style={{ maxHeight: 470, overflowY: 'auto' }}>
        {visibles.map((p) => {
          const l = limpiaHoy(p)
          return (
            <button key={p.id} onClick={() => setSel(p.id)} style={{
              width: '100%', textAlign: 'left', border: 0, borderBottom: `1px solid ${C.fila}`,
              background: sel === p.id ? C.tinte : '#fff', padding: '12px 18px', cursor: 'pointer',
              display: 'flex', gap: 11, alignItems: 'flex-start',
            }}>
              <span style={{ width: 11, height: 11, flex: 'none', marginTop: 5, borderRadius: '50%', background: color(p) }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ font: '600 13px var(--font)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</span>
                  <span style={{ font: '700 12px var(--font)', color: C.navy, whiteSpace: 'nowrap' }}>{p.banos} baños</span>
                </span>
                <span style={{ display: 'block', font: '400 11px/1.45 var(--font)', color: C.gris, marginTop: 3 }}>
                  {p.direccion || L_TIPO_UBIC[p.tipo] || p.tipo}
                  {Number(p.en_mantencion) > 0 ? ` · ${p.en_mantencion} en mantención` : ''}
                  {l ? ` · limpieza (${l.veces}/sem)` : ''}
                </span>
              </span>
            </button>
          )
        })}
        {visibles.length === 0 && <div style={{ padding: 18 }} className="text-muted">No hay puntos en esta vista.</div>}
      </div>
      {sinGeo.length > 0 && (
        <div style={{ padding: '12px 18px', borderTop: `2px solid ${C.borde}`, font: '400 11px/1.5 var(--font)', color: C.gris }}>
          Sin ubicar: {sinGeo.slice(0, 6).map((c) => c.nombre).join(', ')}{sinGeo.length > 6 ? '…' : ''}.
          {editable ? ' Haz clic en el mapa o busca su dirección para ubicarlos.' : ''}
        </div>
      )}
    </section>
  )
}

function NuevoPunto({ punto, clientes, onCancelar, onGuardado }) {
  const [modo, setModo] = useState('cliente')
  const [clienteId, setClienteId] = useState('')
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('faena')
  const [direccion, setDireccion] = useState(punto.direccion || '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setDireccion(punto.direccion || '')
    if (punto.direccion) return
    const ctl = new AbortController()
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${punto.lat}&lon=${punto.lng}`, { signal: ctl.signal, headers: { 'Accept-Language': 'es' } })
      .then((r) => r.json())
      .then((j) => { const a = j.address || {}; setDireccion([a.road && `${a.road}${a.house_number ? ' ' + a.house_number : ''}`, a.city || a.town || a.village || a.county].filter(Boolean).join(', ') || j.display_name || '') })
      .catch(() => {})
    return () => ctl.abort()
  }, [punto.lat, punto.lng])

  const ordenados = [...clientes].sort((a, b) => Number(a.georreferenciado) - Number(b.georreferenciado) || a.nombre.localeCompare(b.nombre))

  const guardar = async () => {
    setError(null)
    setGuardando(true)
    try {
      if (modo === 'cliente') {
        if (!clienteId) throw new Error('Elige el cliente.')
        await ubicarClienteEnMapa(clienteId, Number(coord(punto.lat)), Number(coord(punto.lng)), direccion.trim())
      } else {
        if (!nombre.trim()) throw new Error('Ponle un nombre al punto.')
        await crearUbicacion(nombre.trim(), tipo, { lat: Number(coord(punto.lat)), lng: Number(coord(punto.lng)), direccion: direccion.trim() || null })
      }
      onGuardado()
    } catch (e) { setError(String(e.message || e)); setGuardando(false) }
  }

  return (
    <section className="card" style={{ alignSelf: 'start' }}>
      <h6>Punto elegido en el mapa</h6>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ font: '400 12px var(--font)', color: C.gris }}>
          {coord(punto.lat)}, {coord(punto.lng)} · puedes hacer clic en otro lugar para moverlo
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: C.borde, border: `2px solid ${C.borde}` }}>
          {[['cliente', 'Cliente existente'], ['nuevo', 'Nueva ubicación']].map(([v, l]) => (
            <button key={v} onClick={() => setModo(v)} style={{
              border: 0, minHeight: 42, cursor: 'pointer', font: '600 13px var(--font)', textAlign: 'left', padding: '0 12px',
              background: modo === v ? C.navy : '#fff', color: modo === v ? '#fff' : C.navy,
            }}>{l}</button>
          ))}
        </div>
        {modo === 'cliente' ? (
          <Campo l="Cliente">
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Elegir cliente…</option>
              {ordenados.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.georreferenciado ? ' · mover ubicación' : ' · sin ubicar'}</option>)}
            </select>
          </Campo>
        ) : (
          <>
            <Campo l="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Faena Ruta 5 km 250" /></Campo>
            <Campo l="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {['faena', 'bodega', 'taller'].map((t) => <option key={t} value={t}>{L_TIPO_UBIC[t]}</option>)}
              </select>
            </Campo>
          </>
        )}
        <Campo l="Dirección"><input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={160} placeholder="Se completa sola al hacer clic" /></Campo>
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancelar}>Cancelar</button>
          <button className="btn btn-verde" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar ubicación'}</button>
        </div>
      </div>
    </section>
  )
}

function Buscador({ onElegir }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [buscando, setBuscando] = useState(false)
  const buscar = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    setBuscando(true)
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cl&limit=5&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } })
      setRes(await r.json())
    } catch { setRes([]) }
    setBuscando(false)
  }
  return (
    <form onSubmit={buscar} style={{ position: 'relative', flex: 1, minWidth: 240 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, border: `2px solid ${C.borde}`, background: '#fff', padding: '0 12px', minHeight: 42 }}>
        <Icon d={I.busca} size={16} color={C.gris} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setRes([]) }} placeholder="Buscar dirección (ej. 1 Sur 1200, Talca)"
          style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: '400 13px var(--font)' }} />
        <button type="submit" style={{ border: 0, background: 'transparent', color: C.azul, font: '600 12px var(--font)', cursor: 'pointer' }}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>
      {res.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: `2px solid ${C.borde}`, borderTop: 0 }}>
          {res.map((r) => (
            <button key={r.place_id} type="button" onClick={() => { onElegir({ lat: Number(r.lat), lng: Number(r.lon), direccion: r.display_name.split(',').slice(0, 3).join(',') }); setRes([]) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: `1px solid ${C.fila}`, background: '#fff', padding: '10px 12px', font: '400 12px/1.4 var(--font)', cursor: 'pointer' }}>
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}
