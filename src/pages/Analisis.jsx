import { useEffect, useMemo, useState } from 'react'
import { Kpis, Aviso, Cargando } from '../components/Listado'
import Modal from '../components/Modal'
import ParametrosCosto from '../components/ParametrosCosto'
import { supabase } from '../lib/supabase'
import { cargarMes, calcular, tendencia, mesActual } from '../lib/analisis'
import { useSesion, puedeEditar, puedeVer, esDueno } from '../lib/sesion'
import { C, clp, fecha, mesLargo, L_ESTADO_ACTIVO } from '../lib/ui'

const VISTAS = [
  { v: 'clientes', l: 'Margen por cliente' },
  { v: 'rutas', l: 'Costo por ruta' },
  { v: 'ocupacion', l: 'Ocupación de baños' },
  { v: 'banos', l: 'Rentabilidad por baño' },
  { v: 'insumos', l: 'Insumos' },
  { v: 'tendencia', l: 'Tendencia mensual' },
]
const pct = (x) => (x === null || x === undefined || isNaN(x) ? '—' : Math.round(x * 100) + '%')
const $ = (x) => clp(Math.round(x || 0))
const num = (x, d = 0) => (x === null || x === undefined ? '—' : Number(x).toLocaleString('es-CL', { maximumFractionDigits: d }))
const L_ESTADO = L_ESTADO_ACTIVO

export default function Analisis() {
  const { perfil } = useSesion()
  const [mes, setMes] = useState(mesActual())
  const [vista, setVista] = useState('clientes')
  const [datos, setDatos] = useState(null)
  const [tend, setTend] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [params, setParams] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => { supabase.rpc('foto_ocupacion').then(() => {}, () => {}) }, [])
  useEffect(() => {
    setCargando(true); setError(null)
    Promise.all([cargarMes(mes).then(calcular), tendencia(mes)])
      .then(([d, t]) => { setDatos(d); setTend(t) }).catch(setError).finally(() => setCargando(false))
  }, [mes, recarga])

  if (!puedeVer(perfil, 'analisis')) return <p className="text-muted">Tu usuario no tiene acceso a Análisis.</p>
  const r = datos?.resumen

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Análisis</h2>
          <p className="text-muted" style={{ margin: 0 }}>Cruza ventas, rutas, insumos y mantenciones para ver qué deja margen y qué no.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 12px var(--font)', color: C.gris }}>
          Mes
          <input type="month" value={mes} max={mesActual()} onChange={(e) => e.target.value && setMes(e.target.value)}
            style={{ border: `2px solid ${C.borde}`, font: '600 13px var(--font)', color: C.navy, padding: '9px 12px', minHeight: 42 }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 2, marginTop: 16, border: `2px solid ${C.borde}`, width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap' }}>
        {VISTAS.map((x) => (
          <button key={x.v} onClick={() => setVista(x.v)} style={{
            border: 0, background: vista === x.v ? C.tinte : '#fff', color: vista === x.v ? '#1a3c72' : '#3c4551',
            font: '600 13px var(--font)', padding: '10px 16px', minHeight: 42, cursor: 'pointer',
          }}>{x.l}</button>
        ))}
      </div>

      <Aviso error={error} />
      {cargando && <Cargando>Calculando {mesLargo(mes)}…</Cargando>}

      {!cargando && datos && (
        <>
          <Calidad r={r} />
          {vista === 'clientes' && <Clientes d={datos} r={r} onDetalle={setDetalle} />}
          {vista === 'rutas' && <Rutas d={datos} onDetalle={setDetalle} onParametros={() => setParams(true)} />}
          {vista === 'ocupacion' && <Ocupacion o={datos.ocupacion} />}
          {vista === 'banos' && <Banos d={datos} />}
          {vista === 'insumos' && <Insumos d={datos} />}
          {vista === 'tendencia' && <Tendencia t={tend} onDetalle={setDetalle} />}
        </>
      )}

      {params && <ParametrosCosto editable={esDueno(perfil)} onCerrar={() => { setParams(false); setRecarga((n) => n + 1) }} />}

      {detalle && (
        <Modal titulo={detalle.titulo} ancho={760} onCerrar={() => setDetalle(null)}>
          <div style={{ padding: 18, display: 'grid', gap: 12 }}>
            {detalle.resumen && <div style={{ font: '400 13px/1.5 var(--font)' }}>{detalle.resumen}</div>}
            <Tabla cols={[
              { k: 'fecha', l: 'Fecha', f: (x) => fecha(x.fecha) },
              { k: 'detalle', l: 'Detalle' },
              { k: 'monto', l: 'Monto', f: (x) => <span style={{ color: x.ingreso ? '#1e6b34' : undefined, fontWeight: 600 }}>{x.ingreso ? '+' : '−'}{$(x.monto)}</span> },
            ]} filas={detalle.registros} vacio="Sin registros en este mes." />
          </div>
        </Modal>
      )}
    </div>
  )
}

function Calidad({ r }) {
  const avisos = [
    r.ventasSinClienteN > 0 && `${r.ventasSinClienteN} venta(s) de Maxxa por ${$(r.ventasSinCliente)} no se asociaron a ningún cliente (revisa RUT o nombre).`,
    r.despachosSinCosto > 0 && `${r.despachosSinCosto} despacho(s) en viaje aparte todavía no tienen costo.`,
    r.recetaSinCosto && 'Hay insumos de la receta de limpieza sin costo unitario.',
  ].filter(Boolean)
  if (!avisos.length) return null
  return (
    <div style={{ margin: '16px 0 0', padding: '10px 14px', background: '#fef7e0', border: `2px solid ${C.amarillo}`, font: '400 12px/1.5 var(--font)', color: '#5c4400' }}>
      <strong>Calidad de los datos:</strong> {avisos.join(' ')}
    </div>
  )
}

const Est = ({ on }) => (on ? <span title="Incluye costos estimados o ingreso tomado del contrato" style={{ marginLeft: 6, padding: '1px 5px', font: '700 9px var(--font)', letterSpacing: '.06em', textTransform: 'uppercase', background: '#fef7e0', color: '#8a5a00', border: `1px solid ${C.amarillo}` }}>est.</span> : null)
const Margen = ({ p }) => <span style={{ fontWeight: 700, color: p === null ? C.gris : p < 0.2 ? '#b3261e' : '#1e6b34', background: p !== null && p < 0.2 ? '#fce8e6' : undefined, padding: p !== null && p < 0.2 ? '2px 6px' : 0 }}>{pct(p)}</span>

function Tabla({ cols, filas, onFila, vacio = 'Sin datos para este mes.', min = 640 }) {
  return (
    <div className="scroller" style={{ border: `2px solid ${C.borde}`, background: '#fff' }}>
      <table style={{ minWidth: min }}>
        <thead><tr>{cols.map((c) => <th key={c.k} style={{ textAlign: c.der ? 'right' : 'left' }}>{c.l}</th>)}</tr></thead>
        <tbody>
          {filas.length === 0 && <tr><td colSpan={cols.length} style={{ color: C.gris }}>{vacio}</td></tr>}
          {filas.map((x, i) => (
            <tr key={x.id || i} onClick={() => onFila && onFila(x)} style={{ cursor: onFila ? 'pointer' : 'default' }}>
              {cols.map((c, ci) => <td key={c.k} style={{ whiteSpace: 'nowrap', textAlign: c.der ? 'right' : 'left', fontWeight: ci === 0 ? 600 : 400 }}>{c.f ? c.f(x) : x[c.k] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Nota = ({ children }) => <p style={{ margin: '10px 2px 0', font: '400 12px/1.5 var(--font)', color: C.gris }}>{children}</p>

function Clientes({ d, r, onDetalle }) {
  return (
    <>
      <Kpis items={[
        { v: $(r.ingreso), l: 'Ingresos del mes' },
        { v: $(r.costo), l: 'Costos atribuidos' },
        { v: pct(r.ingreso ? (r.ingreso - r.costo) / r.ingreso : null), l: 'Margen de contribución' },
        { v: r.bajo20, l: 'Clientes bajo 20% de margen' },
      ]} />
      <Tabla onFila={(x) => onDetalle({ titulo: x.nombre, resumen: `Ingreso ${$(x.ingreso)} (${x.fuente}) − costos ${$(x.costo)} = margen ${$(x.margen)} (${pct(x.pct)}).`, registros: x.registros })}
        filas={d.clientes} min={900} cols={[
          { k: 'nombre', l: 'Cliente', f: (x) => <>{x.nombre}<Est on={x.estimado} /></> },
          { k: 'ingreso', l: 'Ingreso', der: true, f: (x) => $(x.ingreso) },
          { k: 'fuente', l: 'Fuente' },
          { k: 'visitas', l: 'Visitas', der: true },
          { k: 'rutas', l: 'Rutas', der: true, f: (x) => $(x.rutas) },
          { k: 'insumos', l: 'Insumos', der: true, f: (x) => $(x.insumos) },
          { k: 'mant', l: 'Mantenciones', der: true, f: (x) => $(x.mant) },
          { k: 'despachos', l: 'Despachos', der: true, f: (x) => $(x.despachos) },
          { k: 'margen', l: 'Margen', der: true, f: (x) => $(x.margen) },
          { k: 'pct', l: '%', der: true, f: (x) => <Margen p={x.pct} /> },
        ]} />
      <Nota>Margen de contribución = ingreso − costos variables del cliente. Ingreso: ventas importadas de Maxxa; si el mes no tiene ventas, se usa el valor mensual del contrato. El costo de cada salida se reparte en partes iguales entre sus paradas. En rojo, margen bajo 20%. Clic en un cliente para ver el detalle.</Nota>
    </>
  )
}

function Rutas({ d, onDetalle, onParametros }) {
  const t = d.rutas.reduce((a, x) => ({ costo: a.costo + x.costo, visitas: a.visitas + x.visitas, km: a.km + x.km }), { costo: 0, visitas: 0, km: 0 })
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn" onClick={onParametros} style={{ minHeight: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
          <span>Parámetros de costo</span>
        </button>
      </div>
      <Kpis items={[
        { v: $(t.costo), l: 'Costo de rutas del mes' },
        { v: num(t.km) + ' km', l: 'Kilómetros' },
        { v: t.visitas, l: 'Visitas' },
        { v: $(t.visitas ? t.costo / t.visitas : 0), l: 'Costo promedio por visita' },
      ]} />
      <Tabla onFila={(x) => onDetalle({ titulo: x.ruta, resumen: `${x.salidas} salida(s), ${num(x.km)} km, ${x.visitas} visita(s). Costo ${$(x.costo)}.`, registros: x.registros })}
        filas={d.rutas} min={860} cols={[
          { k: 'ruta', l: 'Ruta', f: (x) => <>{x.ruta}<Est on={x.estimado} /></> },
          { k: 'salidas', l: 'Salidas', der: true },
          { k: 'km', l: 'Km', der: true, f: (x) => num(x.km) },
          { k: 'visitas', l: 'Visitas', der: true },
          { k: 'costo', l: 'Costo', der: true, f: (x) => $(x.costo) },
          { k: 'costoVisita', l: 'Por visita', der: true, f: (x) => (x.costoVisita == null ? '—' : $(x.costoVisita)) },
          { k: 'costoKm', l: 'Por km', der: true, f: (x) => (x.costoKm == null ? '—' : $(x.costoKm)) },
          { k: 'ingresoAtendido', l: 'Ingreso atendido', der: true, f: (x) => $(x.ingresoAtendido) },
          { k: 'pct', l: 'Margen', der: true, f: (x) => <Margen p={x.pct} /> },
        ]} vacio="No hay salidas de rutas en este mes." />
      <Nota>Ingreso atendido = parte del ingreso de cada cliente según cuántas de sus visitas hizo esta ruta. "est." = alguna salida sin odómetro o con datos del vehículo incompletos.</Nota>
    </>
  )
}

function Ocupacion({ o }) {
  return (
    <>
      <Kpis items={[
        { v: pct(o.pct), l: 'Ocupación del mes' },
        { v: o.hoy.arriendo, l: 'En arriendo hoy' },
        { v: o.hoy.disponibles, l: 'Disponibles hoy' },
        { v: o.hoy.mantencion, l: 'En mantención hoy' },
      ]} />
      <div style={{ padding: '14px 16px', border: `2px solid ${C.borde}`, background: C.suave, font: '400 13px/1.55 var(--font)', marginBottom: 16 }}>
        <strong>Cómo se lee:</strong> de los baños que se pueden arrendar (se descuentan los que están en mantención o fuera de servicio), qué porcentaje estuvo arrendado.
        Ejemplo: 40 baños, 4 en mantención y 27 arrendados → 27 ÷ 36 = 75%. Si la ocupación se mantiene sobre 85%, conviene comprar más baños. Si baja de 60%, sobran unidades o hay que mejorar la rotación.
        <div style={{ marginTop: 6, color: C.gris, font: '400 12px var(--font)' }}>Fuente: {o.fuente}. La app guarda una foto diaria del estado de cada baño, así que el historial se completa con el uso.</div>
      </div>
      <Tabla filas={o.porModelo} min={520} cols={[
        { k: 'modelo', l: 'Modelo' },
        { k: 'total', l: 'Total', der: true },
        { k: 'aptos', l: 'Aptos para arrendar', der: true },
        { k: 'arriendo', l: 'En arriendo', der: true },
        { k: 'pct', l: 'Ocupación hoy', der: true, f: (x) => pct(x.pct) },
      ]} />
    </>
  )
}

function Banos({ d }) {
  const [filtro, setFiltro] = useState('')
  const filas = useMemo(() => (filtro ? d.banos.filter((b) => b.estado === filtro) : d.banos), [d.banos, filtro])
  return (
    <>
      <Kpis items={[
        { v: d.banos.length, l: 'Baños' },
        { v: d.banos.filter((b) => b.margen < 0).length, l: 'Con margen negativo' },
        { v: $(d.banos.reduce((s, b) => s + b.mant, 0)), l: 'Mantenciones del mes' },
      ]} />
      <div style={{ marginBottom: 12 }}>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ border: `2px solid ${C.borde}`, font: '600 13px var(--font)', color: C.navy, padding: '9px 12px', minHeight: 42 }}>
          <option value="">Estado: todos</option>
          {Object.entries(L_ESTADO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <Tabla filas={filas} min={860} cols={[
        { k: 'codigo', l: 'Baño', f: (x) => <span style={{ display: 'inline-block', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{x.codigo}<Est on={x.estimado} /></span> },
        { k: 'modelo', l: 'Modelo' },
        { k: 'estado', l: 'Estado', f: (x) => L_ESTADO[x.estado] || x.estado },
        { k: 'cliente', l: 'Cliente' },
        { k: 'diasArriendo', l: 'Días arrendado', der: true, f: (x) => x.diasArriendo ?? '—' },
        { k: 'ingreso', l: 'Ingreso', der: true, f: (x) => $(x.ingreso) },
        { k: 'operacion', l: 'Rutas e insumos', der: true, f: (x) => $(x.operacion) },
        { k: 'mant', l: 'Mantención', der: true, f: (x) => $(x.mant) },
        { k: 'margen', l: 'Margen', der: true, f: (x) => <span style={{ fontWeight: 700, color: x.margen < 0 ? '#b3261e' : '#1e6b34' }}>{$(x.margen)}</span> },
      ]} />
      <Nota>Ingreso del baño = su valor de arriendo; si no tiene, el ingreso del cliente dividido por sus baños. Los costos de rutas e insumos del cliente también se dividen por sus baños. Un baño con margen negativo varios meses seguidos conviene repararlo, reasignarlo o reemplazarlo.</Nota>
    </>
  )
}

function Insumos({ d }) {
  return (
    <>
      <Kpis items={[
        { v: d.insumos.filter((i) => i.comprar > 0).length, l: 'Para reponer' },
        { v: d.insumos.filter((i) => i.cobertura !== null && i.cobertura < 7).length, l: 'Cobertura menor a 7 días' },
        { v: $(d.insumos.reduce((s, i) => s + i.costoMes, 0)), l: 'Gasto mensual estimado' },
      ]} />
      <Tabla filas={d.insumos} min={900} cols={[
        { k: 'nombre', l: 'Insumo', f: (x) => <>{x.nombre}<Est on={x.estimado} /></> },
        { k: 'stock', l: 'Stock', der: true, f: (x) => `${num(x.stock, 1)} ${x.unidad}` },
        { k: 'consumo30', l: 'Consumo 30 días', der: true, f: (x) => num(x.consumo30, 1) },
        { k: 'proyectado14', l: 'Próx. 14 días (rutas)', der: true, f: (x) => num(x.proyectado14, 1) },
        { k: 'diario', l: 'Por día', der: true, f: (x) => num(x.diario, 2) },
        { k: 'cobertura', l: 'Alcanza para', der: true, f: (x) => (x.cobertura == null ? '—' : <span style={{ fontWeight: 700, color: x.cobertura < 7 ? '#b3261e' : undefined }}>{num(x.cobertura)} días</span>) },
        { k: 'punto', l: 'Punto de reposición', der: true, f: (x) => num(x.punto, 1) },
        { k: 'comprar', l: 'Comprar', der: true, f: (x) => (x.comprar ? <strong>{num(x.comprar)} {x.unidad}</strong> : '—') },
      ]} />
      <Nota>Consumo por día = el mayor entre el promedio real de los últimos 30 días y lo que van a gastar las limpiezas planificadas en los próximos 14 días. Punto de reposición = 7 días de consumo + stock mínimo. La compra sugerida cubre 30 días.</Nota>
    </>
  )
}

function Tendencia({ t, onDetalle }) {
  const max = Math.max(1, ...t.map((x) => Math.max(x.ventas, x.costo)))
  return (
    <>
      <div style={{ border: `2px solid ${C.borde}`, background: '#fff', padding: '18px 16px 10px', margin: '18px 0 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.length}, minmax(0,1fr))`, gap: 8, alignItems: 'end', height: 180 }}>
          {t.map((x) => (
            <div key={x.mes} title={`${mesLargo(x.mes)}: ventas ${$(x.ventas)} · costos ${$(x.costo)}`} style={{ display: 'flex', gap: 2, alignItems: 'end', height: '100%' }}>
              <div style={{ flex: 1, height: `${(x.ventas / max) * 100}%`, background: C.navy, minHeight: x.ventas ? 2 : 0 }} />
              <div style={{ flex: 1, height: `${(x.costo / max) * 100}%`, background: C.amarillo, minHeight: x.costo ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.length}, minmax(0,1fr))`, gap: 8, marginTop: 6 }}>
          {t.map((x) => <div key={x.mes} style={{ font: '400 10px var(--font)', color: C.gris, textAlign: 'center' }}>{mesLargo(x.mes).slice(0, 3)}</div>)}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, font: '400 12px var(--font)', color: '#3c4551' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, background: C.navy }} />Ventas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, background: C.amarillo }} />Costos</span>
        </div>
      </div>
      <Tabla filas={[...t].reverse()} min={820} onFila={(x) => onDetalle({ titulo: mesLargo(x.mes), resumen: `Ventas ${$(x.ventas)} − costos ${$(x.costo)} = ${$(x.margen)} (${pct(x.pct)}).`, registros: [
        { fecha: x.mes + '-01', detalle: 'Ventas importadas de Maxxa', monto: x.ventas, ingreso: true },
        { fecha: x.mes + '-01', detalle: 'Costo de rutas (diésel, desgaste y fijos)', monto: x.rutas },
        { fecha: x.mes + '-01', detalle: 'Mantenciones completadas', monto: x.mant },
        { fecha: x.mes + '-01', detalle: 'Insumos consumidos', monto: x.insumos },
        { fecha: x.mes + '-01', detalle: 'Otros costos registrados', monto: x.otros },
      ] })} cols={[
        { k: 'mes', l: 'Mes', f: (x) => <>{mesLargo(x.mes)}<Est on={x.estimado} /></> },
        { k: 'ventas', l: 'Ventas', der: true, f: (x) => $(x.ventas) },
        { k: 'rutas', l: 'Rutas', der: true, f: (x) => $(x.rutas) },
        { k: 'mant', l: 'Mantenciones', der: true, f: (x) => $(x.mant) },
        { k: 'insumos', l: 'Insumos', der: true, f: (x) => $(x.insumos) },
        { k: 'otros', l: 'Otros', der: true, f: (x) => $(x.otros) },
        { k: 'margen', l: 'Margen', der: true, f: (x) => $(x.margen) },
        { k: 'pct', l: '%', der: true, f: (x) => <Margen p={x.pct} /> },
      ]} />
      <Nota>Margen operativo estimado: no reemplaza la utilidad contable. Los meses sin ventas importadas muestran solo costos.</Nota>
    </>
  )
}
