// Flota (lámina 5): listado de vehículos por patente, agregar, cambiar disponibilidad, desactivar y exportar.
// "En ruta" no se marca a mano: se calcula cuando el día de la ruta se inicia con km y aún no se cierra.
// Los costos (rendimiento, costo por km) se conservan y solo los ve quien tiene "Ver montos".
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import FormVehiculo from '../components/FormVehiculo'
import { Boton, Campo, Tabla, Estado, Ayuda } from '../components/Base'
import { flota, vehiculos, parametros, cambiarDisponibilidadVehiculo, desactivarVehiculo } from '../lib/api'
import { TIPOS_VEHICULO, costoKmVehiculo, mapaParametros, hoyISO } from '../lib/costos'
import { exportarTabla } from '../lib/excel'
import { useSesion, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, Icon, I, clp } from '../lib/ui'

export const L_FLOTA = { disponible: 'Disponible', en_ruta: 'En ruta', mantenimiento: 'En mantenimiento', fuera_servicio: 'Fuera de servicio', baja: 'Desactivado' }
const TONO = { disponible: 'ok', en_ruta: 'info', mantenimiento: 'atencion', fuera_servicio: 'error', baja: 'neutro' }
const L_DISP = { disponible: 'Disponible', mantencion: 'En mantenimiento', fuera_de_servicio: 'Fuera de servicio' }
const miles = (n) => (n == null ? '—' : `${Number(n).toLocaleString('es-CL')} km`)
const PUNTOS = 'M12 5.5h.01M12 12h.01M12 18.5h.01'
const chico = { minHeight: 34, padding: '6px 12px' }
const PROHIBIDO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8'

export default function Flota() {
  const [params] = useSearchParams()
  // Enlaces antiguos: /transporte?tab=mantenciones → Mantenimiento
  if (params.get('tab') === 'mantenciones') return <Navigate to="/mantenimiento?tab=vehiculos" replace />
  return <Listado />
}

function Listado() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'transporte')
  const finanzas = verFinanzas(perfil)
  const VACIO = { texto: '', tipo: '', estado: '', marca: '', bajas: false }
  const [f, setF] = useState(VACIO)
  const [aplicado, setAplicado] = useState(VACIO)
  const [datos, setDatos] = useState(null)
  const [tecnicos, setTecnicos] = useState({})   // ficha técnica completa (para editar y costo por km)
  const [par, setPar] = useState({})
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [disp, setDisp] = useState(null)
  const [baja, setBaja] = useState(null)
  const [exportar, setExportar] = useState(false)

  const cargar = () => {
    setDatos(null); setError(null)
    Promise.all([flota(), vehiculos(true), finanzas ? parametros() : []])
      .then(([l, v, p]) => { setDatos(l); setTecnicos(Object.fromEntries(v.map((x) => [x.activo_id, x]))); setPar(mapaParametros(p)) })
      .catch(setError)
  }
  useEffect(cargar, [])

  const lista = datos || []
  const activos = lista.filter((v) => v.estado_flota !== 'baja')
  const marcas = [...new Set(lista.map((v) => v.marca).filter(Boolean))].sort()
  const filas = useMemo(() => lista.filter((v) => {
    const a = aplicado, t = a.texto.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!a.bajas && v.estado_flota === 'baja') return false
    if (t && !String(v.patente || '').includes(t) && !String(v.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').includes(t)) return false
    if (a.tipo && v.tipo_vehiculo !== a.tipo) return false
    if (a.estado && v.estado_flota !== a.estado) return false
    if (a.marca && v.marca !== a.marca) return false
    return true
  }).sort((x, y) => String(x.patente || x.codigo).localeCompare(String(y.patente || y.codigo))), [lista, aplicado])
  const cuenta = (e) => activos.filter((v) => v.estado_flota === e).length
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const filtrar = (c) => { const n = { ...VACIO, ...c }; setF(n); setAplicado(n) }
  const costoKm = (v) => { const k = tecnicos[v.id] ? costoKmVehiculo(tecnicos[v.id], par).total : 0; return k ? `${clp(Math.round(k))}/km` : '—' }
  const listo = () => { setForm(null); setDisp(null); setBaja(null); cargar() }

  const KPIS = [
    ['', 'Activos', C.blanco, activos.length],
    ['disponible', 'Disponibles', 'rgba(0,201,141,.14)', cuenta('disponible')],
    ['en_ruta', 'En ruta', 'rgba(7,139,250,.14)', cuenta('en_ruta')],
    ['mantenimiento', 'En mantenimiento', 'rgba(245,158,11,.14)', cuenta('mantenimiento')],
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>Flota</h2>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm('nuevo')} disabled={!editable}>Agregar vehículo</Boton>
        <Boton icono={I.descarga} onClick={() => setExportar(true)} disabled={!lista.length}>Exportar</Boton>
      </div>

      <div className="kpis">
        {KPIS.map(([k, l, bg, n]) => (
          <button key={l} type="button" className="indicador" onClick={() => filtrar({ estado: k })}
            style={{ display: 'block', textAlign: 'left', cursor: 'pointer', background: bg, ...(aplicado.estado === k && !aplicado.texto && !aplicado.tipo && !aplicado.marca ? { outline: `2px solid ${C.azul}`, outlineOffset: -2 } : {}) }}>
            <span>{l}</span><b>{datos ? n : '…'}</b>
          </button>
        ))}
      </div>

      <section className="card">
        <form onSubmit={(e) => { e.preventDefault(); setAplicado(f) }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: 16, borderBottom: `1px solid ${C.borde}`, alignItems: 'end' }}>
          <Campo etiqueta="Buscar por patente"><input value={f.texto} onChange={set('texto')} placeholder="Ej. ABCD12 o CAM-03" /></Campo>
          <Campo etiqueta="Tipo de vehículo">
            <select value={f.tipo} onChange={set('tipo')}><option value="">Todos</option>{Object.entries(TIPOS_VEHICULO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Estado">
            <select value={f.estado} onChange={set('estado')}><option value="">Todos</option>{Object.entries(L_FLOTA).filter(([k]) => k !== 'baja' || f.bajas).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Marca">
            <select value={f.marca} onChange={set('marca')}><option value="">Todas</option>{marcas.map((m) => <option key={m}>{m}</option>)}</select>
          </Campo>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '400 13px var(--font)', minHeight: 40 }}>
            <input type="checkbox" checked={f.bajas} onChange={set('bajas')} /> Ver desactivados
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton tipo="principal" type="submit">Aplicar</Boton>
            <Boton onClick={() => filtrar({})}>Limpiar</Boton>
          </div>
        </form>
        {error && <div style={{ padding: 16 }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
        {datos === null && !error ? <div style={{ padding: 24, color: C.gris }}>Cargando…</div> : (
          <Tabla filas={filas} vacio="Sin resultados para estos filtros." columnas={[
            { k: 'patente', label: 'Patente', render: (v) => <b>{v.patente || 'Sin patente'}</b> },
            { k: 'codigo', label: 'Código', render: (v) => v.codigo || '—' },
            { k: 'tipo', label: 'Tipo', render: (v) => TIPOS_VEHICULO[v.tipo_vehiculo] || '—' },
            { k: 'marca', label: 'Marca y modelo', render: (v) => [v.marca, v.modelo].filter(Boolean).join(' ') || '—' },
            { k: 'estado', label: 'Estado', render: (v) => <Estado tono={TONO[v.estado_flota]}>{L_FLOTA[v.estado_flota]}</Estado> },
            { k: 'km', label: 'Odómetro', alinear: 'right', render: (v) => miles(v.kilometraje) },
            ...(finanzas ? [{ k: 'costo', label: 'Costo por km', alinear: 'right', render: costoKm }] : []),
            {
              k: 'acc', label: 'Acción', alinear: 'right', render: (v) => (
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <Boton tipo="principal" onClick={() => v.qr_token && navegar('/activo/' + v.qr_token)} style={chico}>Ver ficha</Boton>
                  <Menu opciones={[
                    { l: 'Editar datos', d: I.lapiz, onClick: () => setForm(tecnicos[v.id] || v), disabled: !editable || v.estado_flota === 'baja' },
                    { l: 'Cambiar disponibilidad', d: I.check, onClick: () => setDisp(v), disabled: !editable || v.estado_flota === 'baja' },
                    { l: 'Dar de baja (vendido, siniestro…)', d: PROHIBIDO, color: C.rojo, onClick: () => setBaja(v), disabled: !editable || v.estado_flota === 'baja' },
                  ]} />
                </div>
              ),
            },
          ]} />
        )}
        <div style={{ padding: 14 }}>
          <Ayuda>Operaciones elige estos vehículos por patente. El odómetro es el último registrado (al cerrar el día de ruta o al editar). "En ruta" se activa solo al iniciar el día con kilometraje.</Ayuda>
        </div>
      </section>

      {form && <FormVehiculo vehiculo={form === 'nuevo' ? null : form} onCerrar={() => setForm(null)} onGuardado={listo} />}
      {disp && <CambiarDisponibilidad v={disp} onCerrar={() => setDisp(null)} onListo={listo} />}
      {baja && <Desactivar v={baja} onCerrar={() => setBaja(null)} onListo={listo} />}
      {exportar && <Exportar todas={lista} filtradas={filas} finanzas={finanzas} costoKm={costoKm} onCerrar={() => setExportar(false)} />}
    </div>
  )
}

// ── 5.3 Cambiar disponibilidad ────────────────────────────────────────────
export function CambiarDisponibilidad({ v, onCerrar, onListo }) {
  const actual = v.estado_activo === 'mantencion' || v.estado_activo === 'fuera_de_servicio' ? v.estado_activo : 'disponible'
  const [val, setVal] = useState({ estado: actual === 'disponible' ? 'mantencion' : 'disponible', fecha: hoyISO(), motivo: '' })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => { setVal((p) => ({ ...p, [k]: e.target.value })); setError(null) }
  const guardar = async () => {
    if (val.estado === actual) return setError({ message: 'Elige un estado distinto al actual.' })
    if (!val.fecha || val.fecha > hoyISO()) return setError({ message: 'La fecha no puede ser futura.' })
    if (val.motivo.trim().length < 3) return setError({ message: 'Indica el motivo.' })
    setGuardando(true)
    try { await cambiarDisponibilidadVehiculo(v.id, val.estado, val.fecha, val.motivo.trim()); onListo() } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo="Cambiar disponibilidad" ancho={500} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambio'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <Campo etiqueta="Patente"><input value={`${v.patente || 'Sin patente'} · ${v.codigo || ''}`} disabled /></Campo>
        <div className="cols2" style={{ gap: 12 }}>
          <Campo etiqueta="Estado" obligatorio>
            <select value={val.estado} onChange={set('estado')}>{Object.entries(L_DISP).map(([k, l]) => <option key={k} value={k}>{l}{k === actual ? ' (actual)' : ''}</option>)}</select>
          </Campo>
          <Campo etiqueta="Fecha" obligatorio><input type="date" value={val.fecha} max={hoyISO()} onChange={set('fecha')} /></Campo>
        </div>
        <Campo etiqueta="Motivo" obligatorio><textarea value={val.motivo} onChange={set('motivo')} maxLength={500} style={{ minHeight: 80 }} placeholder="Revisión programada de sistema hidráulico." /></Campo>
        <Ayuda>"En ruta" se actualiza al iniciar una ruta, no por selección manual. No se puede cambiar si el vehículo está en ruta hoy.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── Desactivar vehículo (no se borra) ─────────────────────────────────────
export function Desactivar({ v, onCerrar, onListo }) {
  const [motivo, setMotivo] = useState('')
  const [paso, setPaso] = useState(1)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const confirmar = async () => {
    if (motivo.trim().length < 3) return setError({ message: 'Indica el motivo.' })
    if (paso === 1) return setPaso(2)
    setGuardando(true)
    try { await desactivarVehiculo(v.id, motivo.trim()); onListo() } catch (x) { setError(x); setGuardando(false); setPaso(1) }
  }
  return (
    <Modal titulo="Dar de baja el vehículo" ancho={480} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Volver</Boton>
      <Boton tipo="peligro" onClick={confirmar} disabled={guardando}>{guardando ? 'Desactivando…' : paso === 1 ? 'Continuar' : 'Confirmar desactivación'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <span style={{ font: '600 14px var(--font)' }}>{v.patente || 'Sin patente'} · {v.codigo} · {TIPOS_VEHICULO[v.tipo_vehiculo] || ''}</span>
        <Campo etiqueta="Motivo" obligatorio><textarea value={motivo} onChange={(e) => { setMotivo(e.target.value); setError(null); setPaso(1) }} maxLength={300} autoFocus placeholder="Vendido, siniestro, fin de vida útil…" /></Campo>
        {paso === 2
          ? <Ayuda tono="atencion">¿Seguro? El vehículo deja de aparecer para elegir en rutas y operaciones. Su historial se conserva y no se borra.</Ayuda>
          : <Ayuda>Para un vehículo vendido, siniestrado o que ya no se usa. No se borra: sale de las listas y se conserva su historial (rutas, kilómetros y costos para los reportes). Se bloquea si tiene rutas esta semana o futuras, operaciones programadas o insumos a bordo.</Ayuda>}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 5.4 Exportar vehículos ────────────────────────────────────────────────
function Exportar({ todas, filtradas, finanzas, costoKm, onCerrar }) {
  const [fmt, setFmt] = useState('xlsx')
  const [solo, setSolo] = useState(true)
  const descargar = () => {
    const cols = ['patente', 'codigo', 'tipo', 'marca', 'modelo', 'anio', 'odometro_km', 'estado', 'fecha_registro', ...(finanzas ? ['costo_por_km'] : [])]
    const filas = (solo ? filtradas : todas).map((v) => [v.patente || '', v.codigo || '', TIPOS_VEHICULO[v.tipo_vehiculo] || '', v.marca || '', v.modelo || '', v.anio || '',
      v.kilometraje ?? '', L_FLOTA[v.estado_flota], v.fecha_registro || '', ...(finanzas ? [costoKm(v)] : [])])
    if (fmt === 'xlsx') exportarTabla(cols, filas, 'Flota')
    else {
      const esc = (x) => (/[";\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
      const url = URL.createObjectURL(new Blob(['﻿' + [cols, ...filas].map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `flota_${hoyISO()}.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    onCerrar()
  }
  return (
    <Modal titulo="Exportar vehículos" ancho={460} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" icono={I.descarga} onClick={descargar}>Exportar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 18, font: '400 14px var(--font)' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={fmt === 'csv'} onChange={() => setFmt('csv')} /> CSV (recomendado)</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={fmt === 'xlsx'} onChange={() => setFmt('xlsx')} /> XLSX (Excel)</label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)' }}>
          <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} /> Solo resultados filtrados ({filtradas.length} de {todas.length})
        </label>
      </div>
    </Modal>
  )
}

// ── Menú ⋮ (posición fija para que la tabla no lo recorte) ────────────────
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
        <div role="menu" style={{ position: 'fixed', right: abierto.right, top: abierto.top, zIndex: 1100, minWidth: 220, padding: 4, background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
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
