import { useEffect, useState } from 'react'
import Modal from './Modal'
import CodigosBanos from './CodigosBanos'
import { crearCliente, rubros as cargarRubros, crearRubro, crearDespacho, rutasLista, agregarParadaRuta } from '../lib/api'
import { DIAS, diasTexto } from '../lib/costos'
import {
  formatoRut, rutValido, formatoTel, telValido, correoValido,
  formatoPesos, numeroDe, decimalDe, fechaValida, FECHA_MIN, FECHA_MAX,
} from '../lib/validar'
import { C } from '../lib/ui'

export default function FormCliente({ onCerrar, onGuardado }) {
  const [v, setV] = useState({
    nombre: '', rut: '', rubro: 'construccion', contacto_nombre: '', telefono: '',
    correo: '', direccion: '', comuna: 'Talca', lat: '', lng: '',
    fecha_inicio_contrato: '', fecha_fin_contrato: '', valor_mensual: '', fecha_entrega: '',
  })
  const [listaRubros, setListaRubros] = useState([])
  const [nuevoRubro, setNuevoRubro] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [elegidos, setElegidos] = useState([])
  const [limpiezas, setLimpiezas] = useState(0)
  const [dias, setDias] = useState([])
  const [rutas, setRutas] = useState([])
  const [rutaId, setRutaId] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarRubros().then(setListaRubros).catch(setError)
    rutasLista().then(setRutas).catch(() => setRutas([]))
  }, [])

  const set = (k, fmt) => (e) => {
    const val = fmt ? fmt(e.target.value) : e.target.value
    setV((p) => ({ ...p, [k]: val }))
    setErrores((p) => ({ ...p, [k]: undefined }))
  }

  const elegirRubro = (e) => {
    if (e.target.value === '__nuevo') { setNuevoRubro(''); return }
    set('rubro')(e)
  }
  const agregarRubro = async () => {
    const n = (nuevoRubro || '').trim()
    if (!n) return
    try {
      const r = await crearRubro(n)
      setListaRubros((p) => [...p, r].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setV((p) => ({ ...p, rubro: r.clave }))
      setNuevoRubro(null)
    } catch (e) { setError(e) }
  }

  const validar = () => {
    const e = {}
    if (v.rut && !rutValido(v.rut)) e.rut = 'RUT inválido: revisa el dígito verificador.'
    if (v.telefono && !telValido(v.telefono)) e.telefono = 'Formato: +56 9 1234 5678'
    if (v.correo && !correoValido(v.correo)) e.correo = 'Correo inválido.'
    const lat = decimalDe(v.lat), lng = decimalDe(v.lng)
    if (v.lat && (lat === null || Math.abs(lat) < 17 || Math.abs(lat) > 56)) e.lat = 'Latitud de Chile: entre -17 y -56.'
    if (v.lng && (lng === null || Math.abs(lng) < 66 || Math.abs(lng) > 76)) e.lng = 'Longitud de Chile: entre -66 y -76.'
    if (!fechaValida(v.fecha_inicio_contrato)) e.fecha_inicio_contrato = 'Año entre 2000 y 2100.'
    if (!fechaValida(v.fecha_fin_contrato)) e.fecha_fin_contrato = 'Año entre 2000 y 2100.'
    if (v.fecha_inicio_contrato && v.fecha_fin_contrato && v.fecha_fin_contrato <= v.fecha_inicio_contrato)
      e.fecha_fin_contrato = 'Debe ser posterior al inicio.'
    if (elegidos.length && !fechaValida(v.fecha_entrega)) e.fecha_entrega = 'Año entre 2000 y 2100.'
    const n = Number(cantidad || 0)
    if (n > 0 && elegidos.length !== n) e.banos = `Indicaste ${n} baño(s) y hay ${elegidos.length} código(s) ingresado(s).`
    if (dias.length !== limpiezas) e.dias = limpiezas ? `Elige ${limpiezas} día(s) de limpieza (llevas ${dias.length}).` : 'Quita los días o indica cuántas limpiezas.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    setError(null)
    try {
      const c = await crearCliente({
        nombre: v.nombre.trim() || 'Sin nombre',
        rut: v.rut || null,
        rubro: v.rubro,
        contacto_nombre: v.contacto_nombre.trim() || null,
        telefono: v.telefono || null,
        correo: v.correo.trim() || null,
        direccion: v.direccion.trim() || null,
        comuna: v.comuna.trim() || null,
        lat: v.lat ? -Math.abs(decimalDe(v.lat)) : null,
        lng: v.lng ? -Math.abs(decimalDe(v.lng)) : null,
        fecha_inicio_contrato: v.fecha_inicio_contrato || null,
        fecha_fin_contrato: v.fecha_fin_contrato || null,
        valor_mensual: numeroDe(v.valor_mensual),
        dias_limpieza: dias.length ? dias : null,
      })
      if (elegidos.length) {
        await crearDespacho({
          tipo: 'entrega', cliente_id: c.id, direccion: v.direccion.trim() || null, origen: 'nuevo_cliente',
          fecha_programada: v.fecha_entrega || v.fecha_inicio_contrato || new Date().toISOString().slice(0, 10),
        }, elegidos.map((b) => ({ id: b.id, accion: 'entrega' })))
      }
      if (rutaId) await agregarParadaRuta(rutaId, c.id)
      onGuardado()
    } catch (e) {
      setError(e.code === '23505' ? { message: 'Ya existe un cliente con ese RUT.' } : e)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nuevo cliente" ancho={900} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Campo l="Empresa" err={errores.nombre}>
            <input value={v.nombre} onChange={set('nombre')} maxLength={120} placeholder="Constructora Andes" />
          </Campo>
          <Campo l="RUT" err={errores.rut}>
            <input value={v.rut} onChange={set('rut', formatoRut)} maxLength={12} inputMode="text" placeholder="76.123.456-7" />
          </Campo>
          <Campo l="Rubro">
            <select value={v.rubro} onChange={elegirRubro}>
              {listaRubros.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
              <option value="__nuevo">+ Agregar nuevo rubro…</option>
            </select>
          </Campo>
          {nuevoRubro !== null && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={nuevoRubro} onChange={(e) => setNuevoRubro(e.target.value)} maxLength={40}
                onKeyDown={(e) => e.key === 'Enter' && agregarRubro()} placeholder="Nombre del rubro"
                style={{
                  flex: 1, minWidth: 0, border: `2px solid ${C.azul}`, background: '#fff',
                  font: '400 13px var(--font)', padding: '10px 12px', minHeight: 44, outline: 'none',
                }} />
              <button className="btn btn-verde" onClick={agregarRubro} style={{ padding: '0 14px' }}>Agregar</button>
              <button className="btn" onClick={() => setNuevoRubro(null)} style={{ padding: '0 12px' }}>✕</button>
            </div>
          )}
          <Campo l="Contacto">
            <input value={v.contacto_nombre} onChange={set('contacto_nombre')} maxLength={80} placeholder="María Torres" />
          </Campo>
          <Campo l="Teléfono" err={errores.telefono}>
            <input value={v.telefono} onChange={set('telefono', formatoTel)} inputMode="tel" placeholder="+56 9 1234 5678" />
          </Campo>
          <Campo l="Correo" err={errores.correo}>
            <input type="email" value={v.correo} onChange={set('correo')} maxLength={120} placeholder="contacto@empresa.cl" />
          </Campo>
          <Campo l="Valor mensual acordado (CLP)">
            <input value={v.valor_mensual} onChange={set('valor_mensual', formatoPesos)} inputMode="numeric" placeholder="$540.000" />
          </Campo>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Campo l="Dirección">
            <input value={v.direccion} onChange={set('direccion')} maxLength={160} placeholder="Camino a San Clemente km 8" />
          </Campo>
          <Campo l="Comuna">
            <input value={v.comuna} onChange={set('comuna')} maxLength={60} placeholder="Talca" />
          </Campo>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <Campo l="Latitud" err={errores.lat}>
              <input value={v.lat} onChange={set('lat', (x) => x.replace(/[^0-9.,-]/g, '').slice(0, 11))} inputMode="decimal" placeholder="-35.4264" />
            </Campo>
            <Campo l="Longitud" err={errores.lng}>
              <input value={v.lng} onChange={set('lng', (x) => x.replace(/[^0-9.,-]/g, '').slice(0, 11))} inputMode="decimal" placeholder="-71.6554" />
            </Campo>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <Campo l="Inicio contrato" err={errores.fecha_inicio_contrato}>
              <input type="date" min={FECHA_MIN} max={FECHA_MAX} value={v.fecha_inicio_contrato} onChange={set('fecha_inicio_contrato')} />
            </Campo>
            <Campo l="Fin contrato" err={errores.fecha_fin_contrato}>
              <input type="date" min={v.fecha_inicio_contrato || FECHA_MIN} max={FECHA_MAX} value={v.fecha_fin_contrato} onChange={set('fecha_fin_contrato')} />
            </Campo>
          </div>

          <div style={{
            padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`,
            font: '400 12px/1.45 var(--font)', color: '#3c4551',
          }}>
            {elegidos.length
              ? `Se crea un despacho de entrega con ${elegidos.length} baño(s). Quedan asignados al cliente cuando el despacho se marque como hecho.`
              : 'Sin fecha de fin el contrato queda como indefinido. Al vencer, el cliente pasa a Vencidos y se programa el retiro de sus baños.'}
          </div>

          {error && (
            <div style={{
              padding: '11px 13px', background: '#fce8e6', border: `2px solid ${C.rojo}`,
              font: '400 12px/1.45 var(--font)', color: '#7c1405',
            }}>{String(error.message || error)}</div>
          )}
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${C.borde}`, padding: 18 }}>
        <div style={{ font: '700 12px var(--font)', color: '#1a3c72', marginBottom: 14 }}>Baños arrendados y limpiezas</div>
        <div className="cols2" style={{ gap: 18 }}>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
            <Campo l="Cantidad de baños a arrendar">
              <input value={cantidad} inputMode="numeric" placeholder="0"
                onChange={(e) => { const n = e.target.value.replace(/\D/g, '').slice(0, 3); setCantidad(n); setElegidos((p) => p.slice(0, Number(n || 0))) }} />
            </Campo>
            <div className="campo" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
              <span>Códigos de cada baño</span>
              <CodigosBanos cantidad={Number(cantidad || 0)} elegidos={elegidos} onChange={setElegidos} />
              {errores.banos && <em style={{ font: '400 11px var(--font)', color: '#b3261e', fontStyle: 'normal' }}>{errores.banos}</em>}
            </div>
            {elegidos.length > 0 && (
              <Campo l="Fecha de entrega" err={errores.fecha_entrega}>
                <input type="date" min={FECHA_MIN} max={FECHA_MAX} value={v.fecha_entrega} onChange={set('fecha_entrega')} />
              </Campo>
            )}
          </div>
          <div style={{ display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
            <div className="campo">
              <span>Limpiezas por semana</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0,1fr))', gap: 2, background: C.borde, border: `2px solid ${C.borde}` }}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} type="button" onClick={() => { setLimpiezas(n); setDias((p) => p.slice(0, n)) }} style={{
                    border: 0, minHeight: 40, cursor: 'pointer', font: '600 13px var(--font)',
                    background: limpiezas === n ? C.navy : '#fff', color: limpiezas === n ? '#fff' : C.navy,
                  }}>{n}</button>
                ))}
              </div>
            </div>
            {limpiezas > 0 && (
              <div className="campo">
                <span>Días de limpieza ({dias.length} de {limpiezas})</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 2, background: C.borde, border: `2px solid ${C.borde}` }}>
                  {DIAS.map((d) => {
                    const on = dias.includes(d.v)
                    const bloqueado = !on && dias.length >= limpiezas
                    return (
                      <button key={d.v} type="button" disabled={bloqueado}
                        onClick={() => setDias((p) => (on ? p.filter((x) => x !== d.v) : [...p, d.v].sort()))} style={{
                          border: 0, minHeight: 40, cursor: bloqueado ? 'not-allowed' : 'pointer', font: '600 12px var(--font)',
                          background: on ? '#1a4fb4' : '#fff', color: on ? '#fff' : C.navy, opacity: bloqueado ? 0.45 : 1,
                        }}>{d.l}</button>
                    )
                  })}
                </div>
                {errores.dias && <em style={{ font: '400 11px var(--font)', color: '#b3261e', fontStyle: 'normal' }}>{errores.dias}</em>}
              </div>
            )}
            {limpiezas > 0 && (
              <Campo l="Agregar a una ruta (opcional)">
                <select value={rutaId} onChange={(e) => setRutaId(e.target.value)}>
                  <option value="">Sin ruta por ahora</option>
                  {rutas.map((r) => <option key={r.id} value={r.id}>{r.nombre} · {diasTexto(r.dias)}</option>)}
                </select>
              </Campo>
            )}
            <div style={{ padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`, font: '400 12px/1.45 var(--font)', color: '#3c4551' }}>
              {limpiezas
                ? `En el Mapa, el cliente se pinta de azul ${limpiezas >= 2 ? 'oscuro' : 'claro'} los días ${diasTexto(dias)}.${rutaId ? ' Queda como parada de limpieza en la ruta elegida.' : ''}`
                : 'Sin limpiezas, el cliente aparece en verde en el Mapa mientras tenga baños en arriendo.'}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function Campo({ l, err, children }) {
  return (
    <label className="campo">
      <span>{l}</span>
      {children}
      {err && <em style={{ font: '400 11px var(--font)', color: '#b3261e', fontStyle: 'normal' }}>{err}</em>}
    </label>
  )
}
