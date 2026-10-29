import { useEffect, useMemo, useState } from 'react'
import Listado from '../components/Listado'
import Modal from '../components/Modal'
import { Campo } from '../components/FormCliente'
import { insumosLista, guardarInsumo, movimientoInsumo, movimientosInsumo, TIPOS_MOV_INSUMO } from '../lib/api'
import { formatoPesos, numeroDe, decimalDe } from '../lib/validar'
import { useSesion, puedeEditar, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, I, clp, fechaHora } from '../lib/ui'

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
  const [kardex, setKardex] = useState(null)

  const cargar = () => {
    setCargando(true)
    insumosLista().then(setDatos).catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((i) => {
    const receta = Array.isArray(i.receta_limpieza) ? i.receta_limpieza[0] : i.receta_limpieza
    const sin = Number(i.stock_actual) <= 0
    const bajo = Number(i.stock_actual) <= Number(i.stock_minimo)
    return {
      ...i,
      receta: receta?.cantidad ?? null,
      usoL: i.uso === 'fijo' ? 'Fijo mensual' : 'Por aseo',
      stockL: `${cant(i.stock_actual)} ${i.unidad}`,
      minimoL: `${cant(i.stock_minimo)} ${i.unidad}`,
      recetaL: i.uso === 'fijo' ? (i.en_uso && i.duracion_meses ? `${cant(i.en_uso)} en uso · dura ${cant(i.duracion_meses)} meses` : 'Falta uso y duración') : receta ? `${cant(receta.cantidad)} ${i.unidad}` : '—',
      costoL: clp(i.costo_unitario),
      valorL: clp(Math.round(Number(i.stock_actual) * Number(i.costo_unitario || 0))),
      estadoL: sin ? 'Sin stock' : bajo ? 'Bajo mínimo' : 'Disponible',
    }
  }), [datos])

  return (
    <>
      <Listado
        titulo="Insumos"
        bajada="Control de materiales: stock disponible, mínimo y cada entrada o salida con fecha, usuario y motivo. Cada limpieza descuenta la receta por baño."
        accion={{ label: 'Agregar insumo', onClick: () => setForm('nuevo'), disabled: !editable }}
        kpis={[
          { v: filas.length, l: 'Insumos' },
          { v: filas.filter((f) => f.estadoL !== 'Disponible').length, l: 'Stock bajo mínimo' },
          { v: filas.filter((f) => f.receta).length, l: 'En receta de limpieza' },
        ]}
        cargando={cargando}
        error={error}
        unidad="insumos"
        filtros={[{ k: 'estadoL', label: 'Estado' }, { k: 'usoL', label: 'Tipo de costo' }]}
        buscar={['nombre']}
        cols={[
          { k: 'nombre', label: 'Producto' },
          { k: 'stockL', label: 'Disponible' },
          { k: 'minimoL', label: 'Mínimo' },
          { k: 'estadoL', label: 'Estado', badge: true },
          { k: 'usoL', label: 'Tipo de costo' },
          { k: 'recetaL', label: 'Gasto' },
          ...(finanzas ? [{ k: 'costoL', label: 'Costo unitario' }, { k: 'valorL', label: 'Valor en stock' }] : []),
        ]}
        datos={filas}
        onFila={(d) => editable && setForm(d)}
        acciones={(d) => [
          { t: 'Registrar entrada o salida', label: 'Movimiento', d: I.plus, color: C.verde, borde: C.verde, disabled: !editable, onClick: () => setIngreso(d) },
          { t: 'Ver movimientos', label: 'Historial', d: I.clip, color: C.navy, onClick: () => setKardex(d) },
          { t: 'Editar', d: I.lapiz, color: C.navy, disabled: !editable, onClick: () => setForm(d) },
        ]}
        nota={filas.some((f) => f.estadoL !== 'Disponible') ? `Stock bajo mínimo: ${filas.filter((f) => f.estadoL !== 'Disponible').map((f) => f.nombre).join(', ')}.` : undefined}
      />
      {kardex && <Kardex insumo={kardex} onCerrar={() => setKardex(null)} />}
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
    uso: e.uso || 'aseo', en_uso: e.en_uso ?? '', duracion_meses: e.duracion_meses ?? '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k, f) => (ev) => setV((p) => ({ ...p, [k]: f ? f(ev.target.value) : ev.target.value }))
  const fijo = v.uso === 'fijo'

  const guardar = async () => {
    if (!v.nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    try {
      await guardarInsumo(e.id, {
        nombre: v.nombre.trim(), unidad: v.unidad.trim() || 'unidad',
        stock_actual: decimalDe(v.stock_actual) ?? 0, stock_minimo: decimalDe(v.stock_minimo) ?? 0,
        costo_unitario: numeroDe(v.costo_unitario),
        uso: v.uso, en_uso: fijo ? decimalDe(v.en_uso) : null, duracion_meses: fijo ? decimalDe(v.duracion_meses) : null,
      }, fijo ? null : decimalDe(v.receta) || null)
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
        <Campo l="Tipo de costo">
          <select value={v.uso} onChange={set('uso')}>
            <option value="aseo">Por aseo (variable): papel, químico, aromatizante…</option>
            <option value="fijo">Fijo mensual: zapatos, poleras, guantes, EPP…</option>
          </select>
        </Campo>
        <div style={par}>
          <Campo l="Costo unitario"><input value={v.costo_unitario} onChange={set('costo_unitario', formatoPesos)} inputMode="numeric" placeholder="$3.500" /></Campo>
          {!fijo && <Campo l="Gasto por aseo (por baño)"><input value={v.receta} onChange={set('receta', dec)} inputMode="decimal" placeholder="Vacío = no se usa" /></Campo>}
        </div>
        {fijo && (
          <div style={par}>
            <Campo l="Unidades en uso"><input value={v.en_uso} onChange={set('en_uso', dec)} inputMode="decimal" placeholder="3 (uno por trabajador)" /></Campo>
            <Campo l="Dura (meses)"><input value={v.duracion_meses} onChange={set('duracion_meses', dec)} inputMode="decimal" placeholder="6" /></Campo>
          </div>
        )}
        <div style={{ padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`, font: '400 12px/1.45 var(--font)', color: '#3c4551' }}>
          {fijo
            ? 'Costo mensual = unidades en uso × costo unitario ÷ meses que dura. En Análisis se reparte entre los clientes según sus aseos.'
            : 'Al marcar una limpieza como hecha en Rutas, se descuenta este gasto por cada baño del cliente. En Análisis es el costo de insumos de cada aseo.'}
        </div>
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{String(error?.message || error)}</div>}
      </div>
    </Modal>
  )
}

function FormIngreso({ insumo, onCerrar, onGuardado }) {
  const [tipo, setTipo] = useState('compra')
  const [cantidad, setCantidad] = useState('')
  const [sentido, setSentido] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)
  const t = TIPOS_MOV_INSUMO[tipo]
  const guardar = async () => {
    const n = decimalDe(cantidad)
    if (!n) { setError('Ingresa una cantidad mayor a cero.'); return }
    if (tipo !== 'compra' && !motivo.trim()) { setError('Escribe el motivo.'); return }
    const signo = t.signo || sentido
    if (signo < 0 && n > Number(insumo.stock_actual)) { setError(`No hay suficiente stock (quedan ${insumo.stockL}).`); return }
    try { await movimientoInsumo(insumo, tipo, signo * n, motivo.trim() || t.l); onGuardado() } catch (x) { setError(String(x.message || x)) }
  }
  return (
    <Modal titulo={`Movimiento · ${insumo.nombre}`} ancho={460} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar}>Registrar</button>
      </>
    }>
      <div style={{ display: 'grid', gap: 14, padding: 18 }}>
        <Campo l="Tipo de movimiento">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <optgroup label="Entrada">
              <option value="compra">Compra</option>
              <option value="devolucion">Devolución</option>
            </optgroup>
            <optgroup label="Salida">
              <option value="consumo">Consumo</option>
              <option value="merma">Merma (pérdida o daño)</option>
            </optgroup>
            <option value="ajuste">Ajuste de inventario</option>
          </select>
        </Campo>
        {tipo === 'ajuste' && (
          <Campo l="El ajuste">
            <select value={sentido} onChange={(e) => setSentido(Number(e.target.value))}>
              <option value={1}>Suma al stock</option>
              <option value={-1}>Resta del stock</option>
            </select>
          </Campo>
        )}
        <Campo l={`Cantidad (${insumo.unidad})`}><input autoFocus value={cantidad} onChange={(e) => setCantidad(dec(e.target.value))} inputMode="decimal" placeholder="50" /></Campo>
        <Campo l={tipo === 'compra' ? 'Motivo (opcional)' : 'Motivo'}><input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} placeholder={tipo === 'compra' ? 'Factura 1234 · SAYPOR' : 'Conteo físico, bidón roto…'} /></Campo>
        <div style={{ font: '400 12px var(--font)', color: C.gris }}>Stock actual: {insumo.stockL}</div>
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{String(error?.message || error)}</div>}
      </div>
    </Modal>
  )
}

// Historial de movimientos (kardex) de un insumo
function Kardex({ insumo, onCerrar }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { movimientosInsumo(insumo.id).then(setLista).catch(setError) }, [insumo.id])
  const tipoL = (m) => TIPOS_MOV_INSUMO[m.tipo]?.l || (Number(m.cantidad) >= 0 ? 'Entrada' : 'Salida')
  return (
    <Modal titulo={`Movimientos · ${insumo.nombre}`} ancho={820} onCerrar={onCerrar} pie={<button className="btn" onClick={onCerrar}>Cerrar</button>}>
      <div className="scroller">
        <table style={{ minWidth: 680 }}>
          <thead><tr><th>Fecha</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Entrada</th><th style={{ textAlign: 'right' }}>Salida</th><th>Usuario</th><th>Motivo</th></tr></thead>
          <tbody>
            {(lista || []).map((m) => {
              const q = Number(m.cantidad)
              return (
                <tr key={m.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fechaHora(m.fecha)}</td>
                  <td style={{ fontWeight: 600 }}>{tipoL(m)}</td>
                  <td style={{ textAlign: 'right', color: C.verde, fontWeight: 600 }}>{q > 0 ? cant(q) : ''}</td>
                  <td style={{ textAlign: 'right', color: C.rojo, fontWeight: 600 }}>{q < 0 ? cant(-q) : ''}</td>
                  <td>{m.usuario?.nombre || (m.tipo === 'consumo' || !m.tipo ? 'Automático' : '—')}</td>
                  <td>{m.motivo || '—'}</td>
                </tr>
              )
            })}
            {lista && lista.length === 0 && <tr><td colSpan={6} className="text-muted">Sin movimientos registrados.</td></tr>}
            {!lista && !error && <tr><td colSpan={6} className="text-muted">Cargando…</td></tr>}
            {error && <tr><td colSpan={6} style={{ color: C.rojo }}>{String(error.message || error)}</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

const par = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }
