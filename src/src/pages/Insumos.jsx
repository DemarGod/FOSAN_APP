import { useEffect, useMemo, useState } from 'react'
import Listado from '../components/Listado'
import Modal from '../components/Modal'
import { Campo } from '../components/FormCliente'
import { insumosLista, guardarInsumo, ingresoInsumo } from '../lib/api'
import { formatoPesos, numeroDe, decimalDe } from '../lib/validar'
import { useSesion, puedeEditar, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, I, clp } from '../lib/ui'

const cant = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 }))
const dec = (x) => String(x ?? '').replace(/[^0-9.,]/g, '').slice(0, 10)

export default function Insumos() {
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'insumos')
  const finanzas = verFinanzas(perfil)
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [ingreso, setIngreso] = useState(null)

  const cargar = () => {
    setCargando(true)
    insumosLista().then(setDatos).catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((i) => {
    const receta = Array.isArray(i.receta_limpieza) ? i.receta_limpieza[0] : i.receta_limpieza
    const bajo = Number(i.stock_actual) <= Number(i.stock_minimo)
    return {
      ...i,
      receta: receta?.cantidad ?? null,
      stockL: `${cant(i.stock_actual)} ${i.unidad}`,
      minimoL: `${cant(i.stock_minimo)} ${i.unidad}`,
      recetaL: receta ? `${cant(receta.cantidad)} ${i.unidad}` : '—',
      costoL: clp(i.costo_unitario),
      valorL: clp(Math.round(Number(i.stock_actual) * Number(i.costo_unitario || 0))),
      estadoL: bajo ? 'Bajo mínimo' : 'Disponible',
    }
  }), [datos])

  return (
    <>
      <Listado
        titulo="Insumos"
        bajada="Químico, papel, repuestos y existencias. Cada limpieza descuenta la receta por baño."
        accion={{ label: 'Agregar insumo', onClick: () => setForm('nuevo'), disabled: !editable }}
        kpis={[
          { v: filas.length, l: 'Insumos' },
          { v: filas.filter((f) => f.estadoL === 'Bajo mínimo').length, l: 'Bajo mínimo' },
          { v: filas.filter((f) => f.receta).length, l: 'En receta de limpieza' },
        ]}
        cargando={cargando}
        error={error}
        unidad="insumos"
        filtros={[{ k: 'estadoL', label: 'Estado' }]}
        buscar={['nombre']}
        cols={[
          { k: 'nombre', label: 'Insumo' },
          { k: 'stockL', label: 'Stock' },
          { k: 'minimoL', label: 'Mínimo' },
          { k: 'estadoL', label: 'Estado', badge: true },
          { k: 'recetaL', label: 'Usa 1 baño limpiado' },
          ...(finanzas ? [{ k: 'costoL', label: 'Costo unitario' }, { k: 'valorL', label: 'Valor en stock' }] : []),
        ]}
        datos={filas}
        onFila={(d) => editable && setForm(d)}
        acciones={(d) => [
          { t: 'Registrar ingreso (compra)', label: 'Ingreso', d: I.plus, color: C.verde, borde: C.verde, disabled: !editable, onClick: () => setIngreso(d) },
          { t: 'Editar', d: I.lapiz, color: C.navy, disabled: !editable, onClick: () => setForm(d) },
        ]}
      />
      {form && <FormInsumo insumo={form === 'nuevo' ? null : form} onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />}
      {ingreso && <FormIngreso insumo={ingreso} onCerrar={() => setIngreso(null)} onGuardado={() => { setIngreso(null); cargar() }} />}
    </>
  )
}

function FormInsumo({ insumo, onCerrar, onGuardado }) {
  const e = insumo || {}
  const [v, setV] = useState({
    nombre: e.nombre || '', unidad: e.unidad || 'unidad',
    stock_actual: e.stock_actual ?? '', stock_minimo: e.stock_minimo ?? '',
    costo_unitario: e.costo_unitario ? formatoPesos(e.costo_unitario) : '', receta: e.receta ?? '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k, f) => (ev) => setV((p) => ({ ...p, [k]: f ? f(ev.target.value) : ev.target.value }))

  const guardar = async () => {
    if (!v.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    try {
      await guardarInsumo(e.id, {
        nombre: v.nombre.trim(), unidad: v.unidad.trim() || 'unidad',
        stock_actual: decimalDe(v.stock_actual) ?? 0, stock_minimo: decimalDe(v.stock_minimo) ?? 0,
        costo_unitario: numeroDe(v.costo_unitario),
      }, decimalDe(v.receta) || null)
      onGuardado()
    } catch (x) { setError(String(x.message || x)); setGuardando(false) }
  }

  return (
    <Modal titulo={e.id ? 'Editar insumo' : 'Agregar insumo'} ancho={560} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar insumo'}</button>
      </>
    }>
      <div style={{ display: 'grid', gap: 14, padding: 18 }}>
        <div style={par}>
          <Campo l="Nombre"><input value={v.nombre} onChange={set('nombre')} maxLength={80} placeholder="Químico desodorizante" /></Campo>
          <Campo l="Unidad"><input value={v.unidad} onChange={set('unidad')} maxLength={20} placeholder="L, rollo, unidad" /></Campo>
        </div>
        <div style={par}>
          <Campo l="Stock actual"><input value={v.stock_actual} onChange={set('stock_actual', dec)} inputMode="decimal" placeholder="120" /></Campo>
          <Campo l="Stock mínimo (alerta)"><input value={v.stock_minimo} onChange={set('stock_minimo', dec)} inputMode="decimal" placeholder="20" /></Campo>
        </div>
        <div style={par}>
          <Campo l="Costo unitario"><input value={v.costo_unitario} onChange={set('costo_unitario', formatoPesos)} inputMode="numeric" placeholder="$3.500" /></Campo>
          <Campo l="Gasto por baño limpiado"><input value={v.receta} onChange={set('receta', dec)} inputMode="decimal" placeholder="Vacío = no se usa" /></Campo>
        </div>
        <div style={{ padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`, font: '400 12px/1.45 var(--font)', color: '#3c4551' }}>
          Al marcar una limpieza como hecha en Rutas, se descuenta este gasto por cada baño del cliente.
        </div>
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{String(error?.message || error)}</div>}
      </div>
    </Modal>
  )
}

function FormIngreso({ insumo, onCerrar, onGuardado }) {
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('Compra')
  const [error, setError] = useState(null)
  const guardar = async () => {
    const n = decimalDe(cantidad)
    if (!n) { setError('Ingresa una cantidad mayor a cero.'); return }
    try { await ingresoInsumo(insumo, n, motivo.trim() || 'Ingreso'); onGuardado() } catch (x) { setError(String(x.message || x)) }
  }
  return (
    <Modal titulo={`Ingreso · ${insumo.nombre}`} ancho={440} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar}>Sumar al stock</button>
      </>
    }>
      <div style={{ display: 'grid', gap: 14, padding: 18 }}>
        <Campo l={`Cantidad (${insumo.unidad})`}><input autoFocus value={cantidad} onChange={(e) => setCantidad(dec(e.target.value))} inputMode="decimal" placeholder="50" /></Campo>
        <Campo l="Motivo"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={80} /></Campo>
        <div style={{ font: '400 12px var(--font)', color: C.gris }}>Stock actual: {insumo.stockL}</div>
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{String(error?.message || error)}</div>}
      </div>
    </Modal>
  )
}

const par = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }
