// Inventario → Insumos y EPP (láminas 3.9 Lista, 3.10 Agregar artículo, 3.11 Ficha del artículo, 3.12 Registrar movimiento).
// Existencias por ubicación (y lote si aplica). Movimientos: Entrada · Traslado · Consumo · Ajuste, siempre con Revisar → Confirmar.
// No se suman litros con unidades. Disponible excluye lotes vencidos y bloqueados.
import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { Boton, Campo, Tabla, Pestanas, Estado, Ayuda } from './Base'
import {
  insumosInventario, movimientosInsumoDe, siguienteCodigoInsumo, serviciosVigentes, registrarMovInsumo, guardarInsumo,
  catCategorias, catUnidades, catUbicacionesInternas, personalActivo,
} from '../lib/api'
import { exportarTabla } from '../lib/excel'
import { useSesion, puedeOperar, esDueno, verFinanzas } from '../lib/sesion'
import { hoyISO, sumarDias } from '../lib/costos'
import { formatoPesos, numeroDe, decimalDe } from '../lib/validar'
import { C, Icon, I, fecha, fechaHora } from '../lib/ui'

const L_MOV = { entrada: 'Entrada', traslado: 'Traslado', consumo: 'Consumo', ajuste: 'Ajuste' }
const chico = { minHeight: 34, padding: '6px 12px' }
const DECIMALES = ['l', 'litro', 'kg', 'kilo', 'm³', 'm3']
const unidad = (i) => i?.unidades_medida?.abreviatura || i?.unidad || ''
const admiteDecimales = (i) => DECIMALES.includes(String(unidad(i)).toLowerCase())
const num = (x) => Number(x || 0).toLocaleString('es-CL', { maximumFractionDigits: 3 })
const vencido = (e) => e.insumo_lotes?.bloqueado || (e.insumo_lotes?.vencimiento && e.insumo_lotes.vencimiento < hoyISO())
// Disponible en una ubicación (o en todas), sin vencidos ni bloqueados
const disponible = (i, ubic) => i.existencias.filter((e) => (!ubic || e.ubicacion_id === ubic) && !vencido(e)).reduce((s, e) => s + Number(e.cantidad), 0)
const alerta = (i) => {
  if (!i.activo) return null
  const d = disponible(i, i.ubicacion_minimo_id)
  if (d <= 0 && Number(i.stock_minimo) > 0) return 'sin'
  if (Number(i.stock_minimo) > 0 && d <= Number(i.stock_minimo)) return 'bajo'
  return 'normal'
}
const lotesPorVencer = (lista) => lista.flatMap((i) => i.existencias.filter((e) => Number(e.cantidad) > 0 && e.insumo_lotes?.vencimiento
  && e.insumo_lotes.vencimiento >= hoyISO() && e.insumo_lotes.vencimiento <= sumarDias(hoyISO(), 30)).map((e) => ({ i, e })))
const ahoraLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export default function InvInsumos() {
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'insumos')
  const exporta = esDueno(perfil) || !!perfil?.permisos?.insumos?.exportar
  const [lista, setLista] = useState(null)
  const [ubic, setUbic] = useState([])
  const [error, setError] = useState(null)
  const VACIO = { texto: '', categoria: '', ubicacion: '', estado: 'activos', alerta: '' }
  const [f, setF] = useState(VACIO)
  const [aplicado, setAplicado] = useState(VACIO)
  const [form, setForm] = useState(null)       // {} nuevo · artículo a editar
  const [mov, setMov] = useState(null)         // { insumo? }
  const [ficha, setFicha] = useState(null)
  const cargar = () => insumosInventario().then((l) => { setLista(l); setFicha((x) => (x ? l.find((i) => i.id === x.id) : x)) }).catch(setError)
  useEffect(() => {
    cargar()
    catUbicacionesInternas().then((u) => {
      const act = u.filter((x) => x.activa)
      setUbic(act)
      const b = act.find((x) => x.tipo === 'bodega')
      if (b) { setF((p) => ({ ...p, ubicacion: b.id })); setAplicado((p) => ({ ...p, ubicacion: b.id })) }
    }).catch(() => {})
  }, [])

  const datos = lista || []
  const filas = useMemo(() => datos.filter((i) => {
    const a = aplicado, t = a.texto.trim().toLowerCase()
    if (a.estado === 'activos' && !i.activo) return false
    if (a.estado === 'inactivos' && i.activo) return false
    if (a.categoria && i.categoria_id !== a.categoria) return false
    if (t && !(i.nombre || '').toLowerCase().includes(t) && !(i.codigo || '').toLowerCase().includes(t)) return false
    if (a.alerta === 'bajo' && !['bajo', 'sin'].includes(alerta(i))) return false
    if (a.alerta === 'vence' && !lotesPorVencer([i]).length) return false
    return true
  }), [datos, aplicado])
  const categorias = [...new Map(datos.filter((i) => i.categorias).map((i) => [i.categoria_id, i.categorias.nombre])).entries()]
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const filtrar = (c) => { const n = { ...aplicado, ...VACIO, ubicacion: aplicado.ubicacion, ...c }; setF(n); setAplicado(n) }
  const nombreUbic = (id) => ubic.find((u) => u.id === id)?.nombre || 'Todas las ubicaciones'

  const exportar = () => exportarTabla(
    ['codigo', 'articulo', 'categoria', 'unidad', 'ubicacion', 'disponible', 'minimo', 'alerta'],
    filas.map((i) => [i.codigo, i.nombre, i.categorias?.nombre || '', unidad(i), nombreUbic(aplicado.ubicacion),
      disponible(i, aplicado.ubicacion || null), Number(i.stock_minimo), { sin: 'Sin stock', bajo: 'Bajo mínimo', normal: 'Normal' }[alerta(i)] || '']),
    'Insumos y EPP',
  )

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})} disabled={!editable}>Agregar artículo</Boton>
        <Boton onClick={() => setMov({})} disabled={!editable || !datos.length}>Registrar movimiento</Boton>
        {exporta && <Boton icono={I.descarga} onClick={exportar} disabled={!filas.length}>Exportar</Boton>}
      </div>

      <div className="kpis">
        <button type="button" className="indicador" onClick={() => filtrar({})} style={{ display: 'block', textAlign: 'left', cursor: 'pointer' }}>
          <span>Artículos activos</span><b>{lista ? datos.filter((i) => i.activo).length : '…'}</b>
        </button>
        <button type="button" className="indicador" onClick={() => filtrar({ alerta: 'bajo' })}
          style={{ display: 'block', textAlign: 'left', cursor: 'pointer', background: '#fef7e0', borderColor: '#f6dc8f' }}>
          <span>Bajo mínimo</span><b>{lista ? datos.filter((i) => ['bajo', 'sin'].includes(alerta(i))).length : '…'}</b>
        </button>
        <button type="button" className="indicador" onClick={() => filtrar({ alerta: 'vence' })}
          style={{ display: 'block', textAlign: 'left', cursor: 'pointer', background: '#fce8e6', borderColor: '#f5c2bc' }}>
          <span>Lotes próximos a vencer (30 días)</span><b>{lista ? lotesPorVencer(datos).length : '…'}</b>
        </button>
      </div>

      <section className="card">
        <form onSubmit={(e) => { e.preventDefault(); setAplicado(f) }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, padding: 16, borderBottom: `1px solid ${C.borde}`, alignItems: 'end' }}>
          <Campo etiqueta="Buscar por código o nombre"><input value={f.texto} onChange={set('texto')} placeholder="Buscar por código o nombre…" /></Campo>
          <Campo etiqueta="Categoría">
            <select value={f.categoria} onChange={set('categoria')}><option value="">Todas</option>{categorias.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          </Campo>
          <Campo etiqueta="Ubicación">
            <select value={f.ubicacion} onChange={set('ubicacion')}><option value="">Todas</option>{ubic.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
          </Campo>
          <Campo etiqueta="Estado">
            <select value={f.estado} onChange={set('estado')}><option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option></select>
          </Campo>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton tipo="principal" type="submit">Aplicar</Boton>
            <Boton onClick={() => filtrar({})}>Limpiar</Boton>
          </div>
        </form>
        {error && <div style={{ padding: 16 }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
        {lista === null && !error ? <div style={{ padding: 24, color: C.gris }}>Cargando…</div> : (
          <Tabla filas={filas} vacio="Sin artículos para estos filtros." columnas={[
            { k: 'codigo', label: 'Código', render: (i) => <b>{i.codigo || '—'}</b> },
            { k: 'nombre', label: 'Artículo' },
            { k: 'disp', label: 'Disponible', alinear: 'right', render: (i) => `${num(disponible(i, aplicado.ubicacion || null))} ${unidad(i)}` },
            { k: 'min', label: 'Mínimo', alinear: 'right', render: (i) => (Number(i.stock_minimo) ? `${num(i.stock_minimo)} ${unidad(i)}` : '—') },
            {
              k: 'alerta', label: 'Alerta', render: (i) => {
                const a = alerta(i)
                return a ? <Estado tono={a === 'normal' ? 'ok' : a === 'bajo' ? 'atencion' : 'error'}>{{ normal: 'Normal', bajo: 'Bajo mínimo', sin: 'Sin stock' }[a]}</Estado> : <Estado tono="neutro">Inactivo</Estado>
              },
            },
            { k: 'accion', label: 'Acción', alinear: 'right', render: (i) => <Boton onClick={() => setFicha(i)} style={chico}>Ver ficha</Boton> },
          ]} />
        )}
        <div style={{ padding: 14 }}>
          <Ayuda>No se suman litros con unidades. Existencias y mínimos corresponden a la ubicación seleccionada ({nombreUbic(aplicado.ubicacion)}); la alerta usa la ubicación del mínimo de cada artículo. Disponible excluye vencidos y bloqueados.</Ayuda>
        </div>
      </section>

      <Reglas />

      {form && <FormArticulo articulo={form} ubic={ubic} onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />}
      {mov && <FormMovimiento inicial={mov.insumo} articulos={datos.filter((i) => i.activo)} ubic={ubic} onCerrar={() => setMov(null)} onListo={() => { setMov(null); cargar() }} />}
      {ficha && <FichaArticulo i={ficha} ubic={ubic} editable={editable} exporta={exporta} onCerrar={() => setFicha(null)}
        onEditar={() => setForm(ficha)} onMover={() => setMov({ insumo: ficha })} />}
    </div>
  )
}

function Reglas() {
  const r = [
    'Traslado conserva el stock total. Consumo reduce el stock total.',
    'Los consumos confirmados desde Operaciones se registran una sola vez.',
    'Se bloquea con stock insuficiente, mismo origen y destino, o lotes vencidos.',
    'Unidades y pares enteros; litros y kilos permiten decimales.',
    'En Ajuste se usa la variación con signo en lugar de cantidad.',
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, padding: '12px 14px', background: C.suave, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', font: '400 13px/1.45 var(--font)' }}>
      {r.map((t, n) => (
        <span key={n} style={{ display: 'flex', gap: 8 }}>
          <b style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', background: C.azul, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12 }}>{n + 1}</b>{t}
        </span>
      ))}
    </div>
  )
}

// ── 3.10 Agregar / editar artículo ────────────────────────────────────────
function FormArticulo({ articulo, ubic, onCerrar, onGuardado }) {
  const { perfil } = useSesion()
  const finanzas = verFinanzas(perfil)
  const nuevo = !articulo.id
  const tieneStock = !nuevo && articulo.existencias.some((e) => Number(e.cantidad) !== 0)
  const receta = Array.isArray(articulo.receta_limpieza) ? articulo.receta_limpieza[0] : articulo.receta_limpieza
  const [cat, setCat] = useState([])
  const [uni, setUni] = useState([])
  const [conMov, setConMov] = useState(false)
  const inicial = useMemo(() => ({
    codigo: articulo.codigo || '', nombre: articulo.nombre || '', categoria_id: articulo.categoria_id || '', unidad_id: articulo.unidad_id || '',
    control_lote: !!articulo.control_lote, requiere_vencimiento: !!articulo.requiere_vencimiento,
    stock_minimo: articulo.stock_minimo != null ? String(articulo.stock_minimo) : '0', ubicacion_minimo_id: articulo.ubicacion_minimo_id || '',
    observaciones: articulo.observaciones || '', activo: articulo.activo !== false,
    costo_unitario: articulo.costo_unitario ? formatoPesos(articulo.costo_unitario) : '', uso: articulo.uso || '',
    receta: receta?.cantidad != null ? String(receta.cantidad) : '', en_uso: articulo.en_uso ?? '', duracion_meses: articulo.duracion_meses ?? '',
  }), [])
  const [v, setV] = useState(inicial)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    Promise.all([catCategorias(), catUnidades()]).then(([c, u]) => {
      setCat(c.filter((x) => (x.clase === 'insumo' || x.clase === 'epp') && (x.activo || x.id === articulo.categoria_id)))
      setUni(u.filter((x) => x.activo || x.id === articulo.unidad_id))
    }).catch(setError)
    if (!nuevo) movimientosInsumoDe(articulo.id).then((m) => setConMov(m.length > 0)).catch(() => {})
    if (nuevo) {
      const b = ubic.find((x) => x.tipo === 'bodega')
      if (b) setV((p) => ({ ...p, ubicacion_minimo_id: b.id }))
    }
  }, [])
  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setV((p) => ({ ...p, [k]: val, ...(k === 'requiere_vencimiento' && val ? { control_lote: true } : {}), ...(k === 'control_lote' && !val ? { requiere_vencimiento: false } : {}) }))
    setErrores({})
  }
  // Código sugerido según categoría: EPP-### o INS-###
  useEffect(() => {
    if (!nuevo || !v.categoria_id) return
    const c = cat.find((x) => x.id === v.categoria_id)
    siguienteCodigoInsumo(c?.clase === 'epp' ? 'EPP' : 'INS').then((cod) => setV((p) => ({ ...p, codigo: cod }))).catch(() => {})
  }, [v.categoria_id, cat])
  const sucio = JSON.stringify(v) !== JSON.stringify(inicial)
  const cerrar = () => (!sucio || window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) && onCerrar()
  const claseSel = cat.find((x) => x.id === v.categoria_id)?.clase
  const uso = v.uso || (claseSel === 'epp' ? 'fijo' : 'aseo')

  const guardar = async () => {
    const e = {}
    if (!/^[A-Z]{2,5}-\d{3,}$/.test(v.codigo.trim().toUpperCase())) e.codigo = 'Formato: INS-001 o EPP-001.'
    if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (!v.categoria_id) e.categoria_id = 'Elige la categoría.'
    if (!v.unidad_id) e.unidad_id = 'Elige la unidad base.'
    if (decimalDe(v.stock_minimo) === null) e.stock_minimo = 'Número mayor o igual a 0.'
    if (!v.ubicacion_minimo_id) e.ubicacion_minimo_id = 'Elige la ubicación del mínimo.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true); setError(null)
    const u = uni.find((x) => x.id === v.unidad_id)
    const datos = {
      codigo: v.codigo.trim().toUpperCase(), nombre: v.nombre.trim(), categoria_id: v.categoria_id, unidad_id: v.unidad_id, unidad: u?.abreviatura || 'un',
      control_lote: v.control_lote, requiere_vencimiento: v.requiere_vencimiento, stock_minimo: decimalDe(v.stock_minimo),
      ubicacion_minimo_id: v.ubicacion_minimo_id, observaciones: v.observaciones.trim() || null, activo: v.activo,
      ...(finanzas ? {
        costo_unitario: numeroDe(v.costo_unitario), uso,
        en_uso: uso === 'fijo' ? decimalDe(v.en_uso) : null, duracion_meses: uso === 'fijo' ? decimalDe(v.duracion_meses) : null,
      } : (nuevo ? { uso } : {})),
    }
    try {
      await guardarInsumo(articulo.id, datos, finanzas ? (uso === 'aseo' ? decimalDe(v.receta) || null : null) : (receta?.cantidad ?? null))
      onGuardado()
    } catch (x) {
      setError(x.code === '23505' ? { message: 'Ese código ya existe.' } : x); setGuardando(false)
    }
  }

  return (
    <Modal titulo={nuevo ? 'Agregar artículo' : `Editar ${articulo.codigo}`} ancho={820} onCerrar={cerrar} pie={<>
      <Boton onClick={cerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar artículo'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="cols2" style={{ gap: 14 }}>
          <Campo etiqueta="Código" obligatorio ayuda={nuevo ? 'Se sugiere según la categoría.' : undefined} error={errores.codigo}>
            <input value={v.codigo} onChange={set('codigo')} maxLength={12} readOnly={!nuevo} />
          </Campo>
          <div style={{ display: 'grid', gap: 6, alignContent: 'end', font: '600 13px var(--font)' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={v.control_lote} onChange={set('control_lote')} disabled={tieneStock} /> Control por lote</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={v.requiere_vencimiento} onChange={set('requiere_vencimiento')} disabled={tieneStock} /> Requiere vencimiento</label>
            {tieneStock && <small className="text-muted" style={{ fontWeight: 400 }}>No se cambia mientras tenga stock.</small>}
          </div>
          <Campo etiqueta="Nombre" obligatorio error={errores.nombre}><input value={v.nombre} onChange={set('nombre')} maxLength={80} /></Campo>
          <Campo etiqueta="Stock mínimo" obligatorio error={errores.stock_minimo}><input value={v.stock_minimo} onChange={set('stock_minimo')} inputMode="decimal" /></Campo>
          <Campo etiqueta="Categoría" obligatorio error={errores.categoria_id}>
            <select value={v.categoria_id} onChange={set('categoria_id')}><option value="">Seleccionar</option>{cat.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </Campo>
          <Campo etiqueta="Ubicación del mínimo" obligatorio error={errores.ubicacion_minimo_id}>
            <select value={v.ubicacion_minimo_id} onChange={set('ubicacion_minimo_id')}><option value="">Seleccionar</option>{ubic.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
          </Campo>
          <Campo etiqueta="Unidad base" obligatorio error={errores.unidad_id} ayuda={conMov ? 'Bloqueada: el artículo ya tiene movimientos.' : undefined}>
            <select value={v.unidad_id} onChange={set('unidad_id')} disabled={conMov}><option value="">Seleccionar</option>{uni.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>)}</select>
          </Campo>
          {!nuevo && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)', alignSelf: 'end', minHeight: 40 }}>
              <input type="checkbox" checked={v.activo} onChange={set('activo')} /> Artículo activo
            </label>
          )}
        </div>
        <Campo etiqueta="Observaciones"><textarea value={v.observaciones} onChange={set('observaciones')} maxLength={300} style={{ minHeight: 56 }} placeholder="Ingrese observaciones (opcional)…" /></Campo>

        {finanzas && (
          <details>
            <summary style={{ cursor: 'pointer', font: '600 14px var(--font)' }}>Datos de costo (los usa Análisis)</summary>
            <div className="cols2" style={{ gap: 12, marginTop: 10 }}>
              <Campo etiqueta="Costo unitario"><input value={v.costo_unitario} onChange={(e) => set('costo_unitario')({ target: { value: formatoPesos(e.target.value) } })} inputMode="numeric" placeholder="$3.500" /></Campo>
              <Campo etiqueta="Tipo de costo">
                <select value={uso} onChange={set('uso')}><option value="aseo">Por aseo</option><option value="fijo">Fijo mensual (EPP, herramientas)</option></select>
              </Campo>
              {uso === 'aseo'
                ? <Campo etiqueta="Gasto por aseo (por baño)" ayuda="Vacío = no se descuenta en las limpiezas de ruta."><input value={v.receta} onChange={set('receta')} inputMode="decimal" /></Campo>
                : <>
                  <Campo etiqueta="Unidades en uso"><input value={v.en_uso} onChange={set('en_uso')} inputMode="decimal" /></Campo>
                  <Campo etiqueta="Duración (meses)"><input value={v.duracion_meses} onChange={set('duracion_meses')} inputMode="decimal" /></Campo>
                </>}
            </div>
          </details>
        )}

        <Ayuda>Crear el artículo no agrega stock: registra la cantidad inicial como Entrada. El vencimiento exige control por lote. La unidad base se bloquea cuando hay movimientos.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 3.11 Ficha del artículo ───────────────────────────────────────────────
function FichaArticulo({ i, ubic, editable, exporta, onCerrar, onEditar, onMover }) {
  const [tab, setTab] = useState('existencias')
  const [movs, setMovs] = useState(null)
  const [tipo, setTipo] = useState('')
  const [fmt, setFmt] = useState('csv')
  const [soloFiltrados, setSoloFiltrados] = useState(true)
  useEffect(() => { movimientosInsumoDe(i.id).then(setMovs).catch(() => setMovs([])) }, [i.id, i.stock_actual])
  const nombreUbic = (id) => ubic.find((u) => u.id === id)?.nombre || '—'
  const exist = i.existencias.filter((e) => Number(e.cantidad) !== 0)
  const visibles = (movs || []).filter((m) => !tipo || m.tipo === tipo)
  const exportar = () => {
    const cols = ['fecha', 'tipo', 'cantidad', 'unidad', 'origen', 'destino', 'lote', 'usuario', 'referencia', 'motivo']
    const filas = (soloFiltrados ? visibles : movs || []).map((m) => [String(m.fecha).slice(0, 16).replace('T', ' '), L_MOV[m.tipo] || m.tipo, Number(m.cantidad), unidad(i),
      m.origen?.nombre || '', m.destino?.nombre || '', m.insumo_lotes?.codigo || '', m.usuario?.nombre || '', m.servicios_cliente?.codigo || m.referencia || m.receptor || '', m.motivo || ''])
    if (fmt === 'xlsx') exportarTabla(cols, filas, `Movimientos ${i.codigo}`)
    else {
      const esc = (x) => (/[";\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
      const url = URL.createObjectURL(new Blob(['﻿' + [cols, ...filas].map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `movimientos_${i.codigo}_${hoyISO()}.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
  return (
    <Modal titulo={`${i.codigo} · ${i.nombre}`} ancho={900} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cerrar</Boton>
      <Boton onClick={onEditar} disabled={!editable}>Editar artículo</Boton>
      <Boton tipo="principal" onClick={onMover} disabled={!editable || !i.activo}>Registrar movimiento</Boton>
    </>}>
      <Pestanas opciones={[{ v: 'datos', l: 'Datos generales' }, { v: 'existencias', l: 'Existencias' }, { v: 'movimientos', l: 'Movimientos' }]} valor={tab} onChange={setTab} />
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        {tab === 'datos' && (
          <div style={{ display: 'grid', gap: 4, font: '400 14px/1.7 var(--font)' }}>
            <span><b>Categoría:</b> {i.categorias?.nombre || '—'}</span>
            <span><b>Unidad base:</b> {i.unidades_medida?.nombre || i.unidad} ({unidad(i)})</span>
            <span><b>Control por lote:</b> {i.control_lote ? 'Sí' : 'No'} · <b>Requiere vencimiento:</b> {i.requiere_vencimiento ? 'Sí' : 'No'}</span>
            <span><b>Stock mínimo:</b> {num(i.stock_minimo)} {unidad(i)} en {nombreUbic(i.ubicacion_minimo_id)}</span>
            <span><b>Total en todas las ubicaciones:</b> {num(i.stock_actual)} {unidad(i)}</span>
            <span><b>Estado:</b> {i.activo ? 'Activo' : 'Inactivo'}</span>
            {i.observaciones && <span><b>Observaciones:</b> {i.observaciones}</span>}
          </div>
        )}
        {tab === 'existencias' && (
          <div className="card">
            <Tabla filas={exist} vacio="Sin existencias. Registra la cantidad inicial como Entrada." columnas={[
              { k: 'u', label: 'Ubicación', render: (e) => nombreUbic(e.ubicacion_id) },
              { k: 'l', label: 'Lote', render: (e) => e.insumo_lotes?.codigo || '—' },
              { k: 'v', label: 'Vencimiento', render: (e) => (e.insumo_lotes?.vencimiento ? <span style={{ color: vencido(e) ? C.rojo : C.tinta }}>{fecha(e.insumo_lotes.vencimiento)}{vencido(e) ? ' · vencido' : ''}</span> : '—') },
              { k: 'c', label: 'Disponible', alinear: 'right', render: (e) => `${num(e.cantidad)} ${unidad(i)}` },
            ]} />
          </div>
        )}
        {tab === 'movimientos' && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Campo etiqueta="Tipo" style={{ width: 170 }}>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{Object.entries(L_MOV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </Campo>
              {exporta && <>
                <Campo etiqueta="Formato" style={{ width: 110 }}>
                  <select value={fmt} onChange={(e) => setFmt(e.target.value)}><option value="csv">CSV</option><option value="xlsx">XLSX</option></select>
                </Campo>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', font: '600 13px var(--font)', minHeight: 40 }}>
                  <input type="checkbox" checked={soloFiltrados} onChange={(e) => setSoloFiltrados(e.target.checked)} /> Resultados filtrados
                </label>
                <Boton icono={I.descarga} onClick={exportar} disabled={!movs?.length}>Exportar</Boton>
              </>}
            </div>
            <div className="card">
              <Tabla filas={visibles} vacio={movs === null ? 'Cargando…' : 'Sin movimientos.'} columnas={[
                { k: 'f', label: 'Fecha', render: (m) => fechaHora(m.fecha) },
                { k: 't', label: 'Tipo', render: (m) => L_MOV[m.tipo] || m.tipo || '—' },
                { k: 'c', label: 'Cantidad', alinear: 'right', render: (m) => <span style={{ color: Number(m.cantidad) < 0 ? C.rojo : C.tinta }}>{Number(m.cantidad) > 0 ? '+' : ''}{num(m.cantidad)} {unidad(i)}</span> },
                { k: 'od', label: 'Origen → destino', render: (m) => (m.origen || m.destino ? `${m.origen?.nombre || '—'} → ${m.destino?.nombre || '—'}` : '—') },
                { k: 'l', label: 'Lote', render: (m) => m.insumo_lotes?.codigo || '—' },
                { k: 'u', label: 'Usuario', render: (m) => m.usuario?.nombre || '—' },
                { k: 'r', label: 'Referencia / motivo', render: (m) => [m.servicios_cliente?.codigo || m.referencia, m.receptor, m.motivo].filter(Boolean).join(' · ') || '—' },
              ]} />
            </div>
            <Ayuda>Movimientos: fecha, tipo, cantidad, origen, destino, usuario y referencia. Solo lectura.</Ayuda>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── 3.12 Registrar movimiento (Revisar → Confirmar) ───────────────────────
const CAMPOS_TIPO = {
  entrada: ['Destino *', 'Lote * y vencimiento * si aplican', 'Referencia (opcional)'],
  traslado: ['Origen *', 'Destino *', 'Lote * si aplica'],
  consumo: ['Origen *', 'Lote * si aplica', 'Servicio u orden de trabajo *', 'EPP: persona receptora *'],
  ajuste: ['Ubicación *', 'Lote si aplica', 'Variación con signo *', 'Motivo *', 'Requiere permiso del dueño'],
}

function FormMovimiento({ inicial, articulos, ubic, onCerrar, onListo }) {
  const { perfil } = useSesion()
  const dueno = esDueno(perfil)
  const [v, setV] = useState({
    insumo: inicial?.id || '', tipo: 'entrada', fecha: ahoraLocal(), cantidad: '', origen: '', destino: '',
    lote: '', loteCodigo: '', vencimiento: '', motivo: '', referencia: '', servicio: '', receptor: '',
  })
  const [servicios, setServicios] = useState([])
  const [personas, setPersonas] = useState([])
  const [revisar, setRevisar] = useState(false)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    serviciosVigentes().then(setServicios).catch(() => {})
    personalActivo().then(setPersonas).catch(() => {})
    const b = ubic.find((x) => x.tipo === 'bodega')
    if (b) setV((p) => ({ ...p, destino: b.id, origen: b.id }))
  }, [])
  const art = articulos.find((x) => x.id === v.insumo)
  const esEpp = art?.categorias?.clase === 'epp'
  const conLote = !!art?.control_lote
  const ubicMov = v.tipo === 'ajuste' ? v.origen : v.tipo === 'entrada' ? null : v.origen
  const lotesOrigen = (art?.existencias || []).filter((e) => e.lote_id && e.ubicacion_id === ubicMov && (v.tipo === 'ajuste' || Number(e.cantidad) > 0))
  const set = (k) => (e) => {
    const val = e.target.value
    setV((p) => ({ ...p, [k]: val, ...(k === 'insumo' || k === 'tipo' || k === 'origen' ? { lote: '' } : {}) }))
    setErrores({}); setRevisar(false); setError(null)
  }
  const nombreUbic = (id) => ubic.find((u) => u.id === id)?.nombre || '—'
  const cant = decimalDe(String(v.cantidad).replace('-', '')) * (v.tipo === 'ajuste' && String(v.cantidad).trim().startsWith('-') ? -1 : 1)

  const validar = () => {
    const e = {}
    if (!art) e.insumo = 'Elige el artículo.'
    if (!v.fecha) e.fecha = 'Indica fecha y hora.'
    else if (v.fecha > ahoraLocal()) e.fecha = 'No puede ser futura.'
    if (!cant) e.cantidad = v.tipo === 'ajuste' ? 'Variación con signo, distinta de 0 (ej. -2 o 3).' : 'Cantidad mayor que 0.'
    else if (art && !admiteDecimales(art) && cant !== Math.trunc(cant)) e.cantidad = `Se mide en ${unidad(art)}: debe ser entera.`
    if (v.tipo === 'entrada' && !v.destino) e.destino = 'Indica el destino.'
    if (['traslado', 'consumo', 'ajuste'].includes(v.tipo) && !v.origen) e.origen = v.tipo === 'ajuste' ? 'Indica la ubicación.' : 'Indica el origen.'
    if (v.tipo === 'traslado' && !v.destino) e.destino = 'Indica el destino.'
    if (v.tipo === 'traslado' && v.origen && v.origen === v.destino) e.destino = 'Origen y destino no pueden ser iguales.'
    if (conLote && v.tipo === 'entrada' && !v.loteCodigo.trim()) e.loteCodigo = 'Indica el lote.'
    if (conLote && v.tipo === 'entrada' && art?.requiere_vencimiento && !v.vencimiento) e.vencimiento = 'Indica el vencimiento.'
    if (conLote && v.tipo !== 'entrada' && !v.lote) e.lote = 'Elige el lote.'
    if (v.tipo === 'consumo' && esEpp && !v.receptor) e.receptor = 'Indica la persona receptora.'
    if (v.tipo === 'consumo' && !esEpp && !v.servicio && v.referencia.trim().length < 2) e.servicio = 'Elige el servicio o escribe la orden de trabajo.'
    if (v.tipo === 'ajuste' && v.motivo.trim().length < 3) e.motivo = 'El ajuste requiere motivo.'
    if (v.tipo === 'ajuste' && !dueno) e.tipo = 'El ajuste requiere permiso del dueño.'
    // Stock suficiente en el origen (la base lo vuelve a revisar al confirmar)
    if (art && ['traslado', 'consumo'].includes(v.tipo) && v.origen && cant > 0) {
      const d = art.existencias.filter((x) => x.ubicacion_id === v.origen && (!conLote || x.lote_id === v.lote) && (conLote || !x.lote_id) && !vencido(x)).reduce((s, x) => s + Number(x.cantidad), 0)
      if (cant > d) e.cantidad = `Stock insuficiente: hay ${num(d)} ${unidad(art)} disponible(s).`
    }
    setErrores(e)
    return !Object.keys(e).length
  }
  const resumen = () => {
    const lote = conLote ? (v.tipo === 'entrada' ? v.loteCodigo.toUpperCase() : art.existencias.find((x) => x.lote_id === v.lote)?.insumo_lotes?.codigo) : null
    const lugar = v.tipo === 'entrada' ? `→ ${nombreUbic(v.destino)}` : v.tipo === 'traslado' ? `${nombreUbic(v.origen)} → ${nombreUbic(v.destino)}`
      : v.tipo === 'consumo' ? `${nombreUbic(v.origen)} → ${esEpp ? v.receptor : servicios.find((s) => s.id === v.servicio)?.codigo || v.referencia}` : nombreUbic(v.origen)
    return [L_MOV[v.tipo], `${v.tipo === 'ajuste' && cant > 0 ? '+' : ''}${num(cant)} ${unidad(art)}`, art.nombre, lugar, lote].filter(Boolean).join(' · ')
  }
  const confirmar = async () => {
    setGuardando(true); setError(null)
    try {
      await registrarMovInsumo({
        insumo: v.insumo, tipo: v.tipo, cantidad: cant, fecha: new Date(v.fecha).toISOString(),
        origen: v.tipo === 'entrada' ? null : v.origen, destino: ['entrada', 'traslado'].includes(v.tipo) ? v.destino : null,
        lote: conLote && v.tipo !== 'entrada' ? v.lote : null, loteCodigo: conLote && v.tipo === 'entrada' ? v.loteCodigo.trim() : null,
        vencimiento: v.vencimiento || null, motivo: v.motivo.trim(), referencia: v.tipo === 'consumo' && !v.servicio ? v.referencia.trim() : v.tipo === 'entrada' ? v.referencia.trim() : null,
        servicio: v.tipo === 'consumo' && !esEpp ? v.servicio || null : null, receptor: v.tipo === 'consumo' && esEpp ? v.receptor : null,
      })
      onListo()
    } catch (x) { setError(x); setGuardando(false); setRevisar(false) }
  }
  const selUbic = (k, etq) => (
    <Campo etiqueta={etq} obligatorio error={errores[k]}>
      <select value={v[k]} onChange={set(k)}><option value="">Seleccionar</option>{ubic.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
    </Campo>
  )

  return (
    <Modal titulo="Registrar movimiento" ancho={900} onCerrar={onCerrar} pie={revisar
      ? <><Boton onClick={() => setRevisar(false)}>Volver</Boton><Boton tipo="principal" onClick={confirmar} disabled={guardando}>{guardando ? 'Registrando…' : 'Confirmar'}</Boton></>
      : <><Boton onClick={onCerrar}>Cancelar</Boton><Boton tipo="principal" onClick={() => validar() && setRevisar(true)}>Revisar</Boton></>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <Campo etiqueta="Artículo" obligatorio error={errores.insumo}>
            <select value={v.insumo} onChange={set('insumo')}><option value="">Seleccionar</option>{articulos.map((a) => <option key={a.id} value={a.id}>{a.codigo} · {a.nombre}</option>)}</select>
          </Campo>
          <Campo etiqueta="Tipo" obligatorio error={errores.tipo}>
            <select value={v.tipo} onChange={set('tipo')}>{Object.entries(L_MOV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Fecha y hora" obligatorio error={errores.fecha}><input type="datetime-local" value={v.fecha} max={ahoraLocal()} onChange={set('fecha')} /></Campo>
          <Campo etiqueta={v.tipo === 'ajuste' ? 'Variación (±)' : `Cantidad${art ? ` (${unidad(art)})` : ''}`} obligatorio error={errores.cantidad}>
            <input value={v.cantidad} onChange={set('cantidad')} inputMode="decimal" placeholder={v.tipo === 'ajuste' ? '-2 o 3' : '4'} />
          </Campo>
        </div>
        <Campo etiqueta="Responsable"><input value={perfil?.nombre || 'Usuario'} readOnly /></Campo>

        <div>
          <div style={{ font: '600 13px var(--font)', marginBottom: 8 }}>Campos según tipo</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
            {Object.entries(CAMPOS_TIPO).map(([k, campos]) => (
              <div key={k} style={{ padding: 10, borderRadius: 'var(--radio-md)', border: `1px solid ${v.tipo === k ? C.azul : C.borde}`, background: v.tipo === k ? C.tinte : C.blanco, font: '400 12px/1.5 var(--font)' }}>
                <b style={{ fontSize: 13 }}>{L_MOV[k]}</b>
                {campos.map((c) => <div key={c}>{c}</div>)}
              </div>
            ))}
          </div>
        </div>

        <div className="cols2" style={{ gap: 12 }}>
          {v.tipo === 'entrada' && selUbic('destino', 'Destino')}
          {['traslado', 'consumo'].includes(v.tipo) && selUbic('origen', 'Origen')}
          {v.tipo === 'traslado' && selUbic('destino', 'Destino')}
          {v.tipo === 'ajuste' && selUbic('origen', 'Ubicación')}
          {conLote && v.tipo === 'entrada' && <>
            <Campo etiqueta="Lote" obligatorio error={errores.loteCodigo}><input value={v.loteCodigo} onChange={set('loteCodigo')} maxLength={20} placeholder="L-025" /></Campo>
            {art.requiere_vencimiento && <Campo etiqueta="Vencimiento" obligatorio error={errores.vencimiento}><input type="date" value={v.vencimiento} min={hoyISO()} onChange={set('vencimiento')} /></Campo>}
          </>}
          {conLote && v.tipo !== 'entrada' && (
            <Campo etiqueta="Lote" obligatorio error={errores.lote} ayuda={!lotesOrigen.length ? 'No hay lotes con stock en esa ubicación.' : undefined}>
              <select value={v.lote} onChange={set('lote')}>
                <option value="">Seleccionar</option>
                {lotesOrigen.map((e) => <option key={e.lote_id} value={e.lote_id} disabled={v.tipo !== 'ajuste' && vencido(e)}>
                  {e.insumo_lotes?.codigo} · {num(e.cantidad)} {unidad(art)}{e.insumo_lotes?.vencimiento ? ` · vence ${fecha(e.insumo_lotes.vencimiento)}` : ''}{vencido(e) ? ' (vencido)' : ''}
                </option>)}
              </select>
            </Campo>
          )}
          {v.tipo === 'consumo' && (esEpp
            ? <Campo etiqueta="Persona receptora (EPP)" obligatorio error={errores.receptor}>
              <select value={v.receptor} onChange={set('receptor')}><option value="">Seleccionar</option>{personas.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}</select>
            </Campo>
            : <>
              <Campo etiqueta="Servicio" obligatorio error={errores.servicio} ayuda="O escribe la orden de trabajo.">
                <select value={v.servicio} onChange={set('servicio')}><option value="">Seleccionar</option>{servicios.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.clientes?.nombre}{s.ubicaciones?.nombre ? ` · ${s.ubicaciones.nombre}` : ''}</option>)}</select>
              </Campo>
              {!v.servicio && <Campo etiqueta="Orden de trabajo"><input value={v.referencia} onChange={set('referencia')} maxLength={40} placeholder="OT-024" /></Campo>}
            </>)}
          {v.tipo === 'entrada' && <Campo etiqueta="Referencia (opcional)"><input value={v.referencia} onChange={set('referencia')} maxLength={60} placeholder="Factura 1234" /></Campo>}
        </div>
        <Campo etiqueta={v.tipo === 'ajuste' ? 'Motivo' : 'Motivo (opcional)'} obligatorio={v.tipo === 'ajuste'} error={errores.motivo}>
          <input value={v.motivo} onChange={set('motivo')} maxLength={200} placeholder={v.tipo === 'ajuste' ? 'Conteo físico' : 'Ingrese motivo (opcional)…'} />
        </Campo>

        {revisar && art && (
          <div style={{ padding: 14, borderRadius: 'var(--radio-md)', background: '#e6f4ea', border: `1px solid ${C.verde}` }}>
            <b>Revisar</b>
            <div style={{ font: '600 15px var(--font)', margin: '4px 0' }}>{resumen()}</div>
            <small className="text-muted">Solo Confirmar registra el movimiento.</small>
          </div>
        )}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}
