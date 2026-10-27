import { useEffect, useMemo, useState } from 'react'
import { Kpis, Aviso, Cargando } from '../components/Listado'
import Modal from '../components/Modal'
import ParametrosCosto from '../components/ParametrosCosto'
import { supabase } from '../lib/supabase'
import { cargarMes, calcular, tendencia, mesActual } from '../lib/analisis'
import { useSesion, puedeVer, esDueno } from '../lib/sesion'
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
const $ = (x) => clp(Math.round(x || 0) || 0)
const num = (x, d = 0) => (x === null || x === undefined ? '—' : (Number(x) || 0).toLocaleString('es-CL', { maximumFractionDigits: d }))
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
          <Calidad r={r} vista={vista} />
          {vista === 'clientes' && <Clientes d={datos} r={r} onDetalle={setDetalle} />}
          {vista === 'rutas' && <Rutas d={datos} onDetalle={setDetalle} onParametros={() => setParams(true)} />}
          {vista === 'ocupacion' && <Ocupacion o={datos.ocupacion} />}
          {vista === 'banos' && <Banos d={datos} r={r} />}
          {vista === 'insumos' && <Insumos d={datos} r={r} />}
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

// Avisos de datos faltantes, solo los que afectan la vista abierta
function Calidad({ r, vista }) {
  const s = (k, uno, varios) => (k === 1 ? uno : varios)
  const por = {
    clientes: [
      r.ventasMes === 0 && 'No hay ventas de Maxxa importadas este mes. Importa el informe de ventas en Utilidades o carga el valor mensual de cada cliente en Clientes.',
      r.clientesSinIngreso > 0 && `${r.clientesSinIngreso} ${s(r.clientesSinIngreso, 'cliente tiene', 'clientes tienen')} costos pero ningún ingreso registrado (${$(r.costoSinIngreso)} en costos). No se calcula su margen hasta tener ventas o valor de contrato.`,
      r.ventasSinClienteN > 0 && `${r.ventasSinClienteN} venta(s) de Maxxa por ${$(r.ventasSinCliente)} no se asociaron a ningún cliente (revisa RUT o nombre).`,
      r.despachosSinCosto > 0 && `${r.despachosSinCosto} despacho(s) en viaje aparte todavía no tienen costo.`,
    ],
    rutas: [
      r.salidasSinKm > 0 && `${r.salidasSinKm} de ${r.salidas} salida(s) no tienen odómetro de inicio y término. Sin kilómetros, el diésel y el desgaste no se calculan y el costo queda solo con fijos y conductor.`,
      r.despachosSinCosto > 0 && `${r.despachosSinCosto} despacho(s) en viaje aparte todavía no tienen costo.`,
    ],
    ocupacion: [],
    banos: [
      r.banosSinIngreso > 0 && `${r.banosSinIngreso} baño(s) arrendados no tienen valor de arriendo ni ingreso del cliente: su margen no se puede calcular.`,
      r.banosSinInstalacion > 0 && `${r.banosSinInstalacion} baño(s) arrendados no tienen instalación registrada, por eso no muestran días arrendado.`,
    ],
    insumos: [
      r.recetaVacia && 'No hay receta de limpieza: define cuánto de cada insumo usa una limpieza de baño para calcular consumo y compras.',
      r.insumosSinCosto > 0 && `${r.insumosSinCosto} insumo(s) sin costo unitario: el gasto mensual sale en $0.`,
    ],
    tendencia: [r.ventasMes === 0 && 'Sin ventas importadas, la tendencia muestra solo costos.'],
  }
  const avisos = (por[vista] || []).filter(Boolean)
  if (!avisos.length) return null
  return (
    <div style={{ margin: '16px 0 0', padding: '10px 14px', background: '#fef7e0', border: `2px solid ${C.amarillo}`, font: '400 12px/1.5 var(--font)', color: '#5c4400', display: 'grid', gap: 4 }}>
      <strong>Datos que faltan para que esta vista sea exacta</strong>
      {avisos.map((a, i) => <span key={i}>· {a}</span>)}
    </div>
  )
}

const Est = ({ on }) => (on ? <span title="Incluye costos estimados o ingreso tomado del contrato" style={{ marginLeft: 6, padding: '1px 5px', font: '700 9px var(--font)', letterSpacing: '.06em', textTransform: 'uppercase', background: '#fef7e0', color: '#8a5a00', border: `1px solid ${C.amarillo}` }}>est.</span> : null)
const SinDato = ({ children = 'Sin ingreso' }) => <span style={{ font: '600 11px var(--font)', color: C.gris }}>{children}</span>
const Margen = ({ p }) => (p === null || p === undefined ? <SinDato>—</SinDato>
  : <span style={{ fontWeight: 700, color: p < 0.2 ? '#b3261e' : '#1e6b34', background: p < 0.2 ? '#fce8e6' : undefined, padding: p < 0.2 ? '2px 6px' : 0 }}>{pct(p)}</span>)
const Plata = ({ v }) => (v === null || v === undefined ? <SinDato>—</SinDato> : <span style={{ fontWeight: 700, color: v < 0 ? '#b3261e' : '#1e6b34' }}>{$(v)}</span>)

function Tabla({ cols, filas, onFila, vacio = 'Sin datos para este mes.', min = 640, pie }) {
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
          {pie && filas.length > 0 && (
            <tr style={{ background: C.suave }}>
              {cols.map((c, ci) => <td key={c.k} style={{ whiteSpace: 'nowrap', textAlign: c.der ? 'right' : 'left', fontWeight: 700, borderTop: `2px solid ${C.borde}` }}>{ci === 0 ? 'Total' : c.f ? c.f(pie) : pie[c.k] ?? ''}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const Nota = ({ children }) => <p style={{ margin: '10px 2px 0', font: '400 12px/1.5 var(--font)', color: C.gris }}>{children}</p>

function Clientes({ d, r, onDetalle }) {
  const margenTot = r.ingreso ? (r.ingreso - r.costoConIngreso) / r.ingreso : null
  return (
    <>
      <Kpis items={[
        { v: r.ingreso ? $(r.ingreso) : 'Sin datos', l: 'Ingresos del mes' },
        { v: $(r.costo), l: 'Costos atribuidos' },
        { v: pct(margenTot), l: 'Margen de clientes con ingreso' },
        { v: r.bajo20, l: 'Clientes bajo 20% de margen' },
        { v: r.clientesSinIngreso, l: 'Clientes sin ingreso cargado' },
      ]} />
      <Tabla onFila={(x) => onDetalle({ titulo: x.nombre, resumen: x.sinIngreso
        ? `Sin ingreso registrado este mes. Costos atribuidos: ${$(x.costo)}. Carga ventas de Maxxa o el valor mensual del contrato para calcular el margen.`
        : `Ingreso ${$(x.ingreso)} (${x.fuente}) − costos ${$(x.costo)} = margen ${$(x.margen)} (${pct(x.pct)}).`, registros: x.registros })}
        filas={d.clientes} min={980} cols={[
          { k: 'nombre', l: 'Cliente', f: (x) => <>{x.nombre}<Est on={x.estimado && !x.sinIngreso} /></> },
          { k: 'banos', l: 'Baños arrendados', der: true },
          { k: 'ingreso', l: 'Ingreso', der: true, f: (x) => (x.sinIngreso ? <SinDato /> : $(x.ingreso)) },
          { k: 'fuente', l: 'Fuente', f: (x) => (x.sinIngreso ? '—' : x.fuente) },
          { k: 'visitas', l: 'Visitas', der: true },
          { k: 'rutas', l: 'Rutas', der: true, f: (x) => $(x.rutas) },
          { k: 'insumos', l: 'Insumos', der: true, f: (x) => $(x.insumos) },
          { k: 'mant', l: 'Mantenciones', der: true, f: (x) => $(x.mant) },
          { k: 'despachos', l: 'Despachos', der: true, f: (x) => $(x.despachos) },
          { k: 'costo', l: 'Costo total', der: true, f: (x) => $(x.costo) },
          { k: 'margen', l: 'Margen', der: true, f: (x) => <Plata v={x.margen} /> },
          { k: 'pct', l: '%', der: true, f: (x) => <Margen p={x.pct} /> },
        ]} />
      <Nota>Margen de contribución = ingreso − costos variables del cliente. Ingreso: ventas importadas de Maxxa; si el mes no tiene ventas, se usa el valor mensual del contrato. Si no hay ninguno de los dos, el margen queda en "—" (no se informa como pérdida). El costo de cada salida se reparte según los baños atendidos en cada parada. En rojo, margen bajo 20%. Clic en un cliente para ver el detalle.</Nota>
    </>
  )
}

function Rutas({ d, onDetalle, onParametros }) {
  const t = d.rutas.reduce((a, x) => ({ costo: a.costo + x.costo, visitas: a.visitas + x.visitas, km: a.km + x.km, banos: a.banos + x.banos, litros: a.litros + x.litros, insumos: a.insumos + x.insumos, salidas: a.salidas + x.salidas, sinKm: a.sinKm + x.sinKm }), { costo: 0, visitas: 0, km: 0, banos: 0, litros: 0, insumos: 0, salidas: 0, sinKm: 0 })
  const dec = (v) => (v == null ? '—' : v.toFixed(1).replace('.', ','))
  const sinKm = 'Sin odómetro'
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
        { v: t.km ? num(t.km) + ' km' : sinKm, l: `Kilómetros · ${t.salidas - t.sinKm} de ${t.salidas} salidas con odómetro` },
        { v: t.visitas, l: 'Visitas' },
        { v: t.visitas ? $(t.costo / t.visitas) : '—', l: 'Costo promedio por visita' },
      ]} />
      <Kpis items={[
        { v: t.km ? $(t.costo / t.km) + '/km' : sinKm, l: 'Costo por km' },
        { v: t.banos ? $((t.costo + t.insumos) / t.banos) : '—', l: `Costo por baño limpiado · ${num(t.banos)} baños` },
        { v: t.km ? dec((t.litros / t.km) * 100) + ' L' : sinKm, l: 'Consumo cada 100 km' },
        { v: t.km && d.kmDisponibles ? pct(t.km / d.kmDisponibles) : sinKm, l: `Utilización de camiones · ${d.vehiculosMes} vehículo(s)` },
      ]} />
      <Tabla onFila={(x) => onDetalle({ titulo: x.ruta, resumen: `${x.salidas} salida(s), ${x.km ? num(x.km) + ' km' : 'sin odómetro'}, ${x.visitas} visita(s). Costo ${$(x.costo)}.`, registros: x.registros })}
        filas={d.rutas} min={1100} pie={{ ...t, costoVisita: t.visitas ? t.costo / t.visitas : null, costoKm: t.km ? t.costo / t.km : null, costoBano: t.banos ? (t.costo + t.insumos) / t.banos : null, l100: t.km ? (t.litros / t.km) * 100 : null, ingresoAtendido: d.rutas.reduce((s, x) => s + x.ingresoAtendido, 0), pct: null }}
        cols={[
          { k: 'ruta', l: 'Ruta', f: (x) => <>{x.ruta}<Est on={x.estimado} /></> },
          { k: 'salidas', l: 'Salidas', der: true },
          { k: 'km', l: 'Km', der: true, f: (x) => (x.km ? num(x.km) : <SinDato>{sinKm}</SinDato>) },
          { k: 'visitas', l: 'Visitas', der: true },
          { k: 'costo', l: 'Costo', der: true, f: (x) => $(x.costo) },
          { k: 'costoVisita', l: 'Por visita', der: true, f: (x) => (x.costoVisita == null ? '—' : $(x.costoVisita)) },
          { k: 'costoKm', l: 'Por km', der: true, f: (x) => (x.costoKm == null ? '—' : $(x.costoKm)) },
          { k: 'banos', l: 'Baños', der: true, f: (x) => num(x.banos) },
          { k: 'costoBano', l: 'Por baño', der: true, f: (x) => (x.costoBano == null ? '—' : $(x.costoBano)) },
          { k: 'l100', l: 'L/100 km', der: true, f: (x) => dec(x.l100) },
          { k: 'ingresoAtendido', l: 'Ingreso atendido', der: true, f: (x) => (x.ingresoAtendido ? $(x.ingresoAtendido) : <SinDato />) },
          { k: 'pct', l: 'Margen', der: true, f: (x) => <Margen p={x.pct} /> },
        ]} vacio="No hay salidas de rutas en este mes." />
      <Nota>Costo de ruta = diésel + desgaste (neumáticos, aceite, frenos, amortiguadores, preventiva, depreciación) + fijos (permiso, seguros, revisión) + conductor + agua y residuos. Diésel y desgaste dependen de los km: si la salida no tiene odómetro, esa parte queda fuera. Costo por baño = (costo de ruta + insumos de limpieza) ÷ baños limpiados. Utilización = km recorridos ÷ km esperados del mes. "est." = alguna salida sin odómetro o con datos del vehículo incompletos.</Nota>
    </>
  )
}

function Ocupacion({ o }) {
  const h = o.hoy
  const otros = Object.entries(o.otrosEstados).map(([k, v]) => `${v} ${(L_ESTADO[k] || k).toLowerCase()}`).join(', ')
  const pie = o.porModelo.reduce((a, m) => ({ total: a.total + m.total, arriendo: a.arriendo + m.arriendo, disponible: a.disponible + m.disponible, mantencion: a.mantencion + m.mantencion, otros: a.otros + m.otros }), { total: 0, arriendo: 0, disponible: 0, mantencion: 0, otros: 0 })
  pie.pct = o.pctHoy
  return (
    <>
      <Kpis items={[
        { v: h.total, l: 'Total de baños' },
        { v: h.arriendo, l: 'En arriendo hoy' },
        { v: h.disponible, l: 'Disponibles hoy' },
        { v: h.mantencion, l: 'En mantención hoy' },
        ...(h.otros ? [{ v: h.otros, l: 'Otros estados' }] : []),
      ]} />
      <Kpis items={[
        { v: pct(o.pctHoy), l: `Ocupación hoy · ${h.arriendo} de ${h.arriendo + h.disponible} arrendables` },
        { v: pct(o.pct), l: 'Ocupación promedio del mes' },
      ]} />
      <div style={{ padding: '14px 16px', border: `2px solid ${C.borde}`, background: C.suave, font: '400 13px/1.55 var(--font)', marginBottom: 16 }}>
        <strong>Cómo se lee:</strong> ocupación = baños en arriendo ÷ baños arrendables (en arriendo + disponibles). Los que están en mantención u otros estados no se cuentan porque no se pueden arrendar.
        Hoy: {h.arriendo} ÷ ({h.arriendo} + {h.disponible}) = {pct(o.pctHoy)}. Sobre 85% sostenido conviene comprar baños; bajo 60% sobran unidades o hay que mejorar la rotación.
        <div style={{ marginTop: 6, color: C.gris, font: '400 12px var(--font)' }}>
          {h.total} = {h.arriendo} en arriendo + {h.disponible} disponibles + {h.mantencion} en mantención{h.otros ? ` + ${h.otros} en otros estados (${otros})` : ''}.
          Promedio del mes: {o.fuente}.
        </div>
      </div>
      <Tabla filas={o.porModelo} min={760} pie={pie} cols={[
        { k: 'modelo', l: 'Modelo' },
        { k: 'total', l: 'Total', der: true },
        { k: 'arriendo', l: 'En arriendo', der: true },
        { k: 'disponible', l: 'Disponibles', der: true },
        { k: 'mantencion', l: 'En mantención', der: true },
        { k: 'otros', l: 'Otros estados', der: true },
        { k: 'pct', l: 'Ocupación hoy', der: true, f: (x) => pct(x.pct) },
      ]} />
    </>
  )
}

function Banos({ d, r }) {
  const [filtro, setFiltro] = useState('en_arriendo')
  const filas = useMemo(() => (filtro ? d.banos.filter((b) => b.estado === filtro) : d.banos), [d.banos, filtro])
  const arr = d.banos.filter((b) => b.estado === 'en_arriendo')
  const conMargen = arr.filter((b) => b.margen !== null)
  return (
    <>
      <Kpis items={[
        { v: arr.length, l: 'Baños en arriendo' },
        { v: conMargen.length, l: 'Con ingreso conocido' },
        { v: conMargen.filter((b) => b.margen < 0).length, l: 'Con margen negativo' },
        { v: r.banosSinIngreso, l: 'Sin valor de arriendo' },
        { v: $(d.banos.reduce((s, b) => s + b.mant, 0)), l: 'Mantenciones del mes' },
      ]} />
      <div style={{ marginBottom: 12 }}>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ border: `2px solid ${C.borde}`, font: '600 13px var(--font)', color: C.navy, padding: '9px 12px', minHeight: 42 }}>
          <option value="">Estado: todos ({d.banos.length})</option>
          {Object.entries(L_ESTADO).filter(([k]) => k !== 'baja').map(([k, l]) => {
            const c = d.banos.filter((b) => b.estado === k).length
            return c ? <option key={k} value={k}>{l} ({c})</option> : null
          })}
        </select>
      </div>
      <Tabla filas={filas} min={980} cols={[
        { k: 'codigo', l: 'Baño', f: (x) => <>{x.codigo}<Est on={x.estimado} /></> },
        { k: 'modelo', l: 'Modelo' },
        { k: 'estado', l: 'Estado', f: (x) => L_ESTADO[x.estado] || x.estado },
        { k: 'cliente', l: 'Cliente' },
        { k: 'diasArriendo', l: 'Días arrendado', der: true, f: (x) => (x.estado !== 'en_arriendo' ? '—' : x.diasArriendo == null ? <SinDato>Sin instalación</SinDato> : <span title={'Desde ' + fecha(x.desde)}>{x.diasArriendo}</span>) },
        { k: 'ingreso', l: 'Ingreso del mes', der: true, f: (x) => (x.sinIngreso ? <SinDato /> : x.estado === 'en_arriendo' ? $(x.ingreso) : '—') },
        { k: 'operacion', l: 'Rutas e insumos', der: true, f: (x) => $(x.operacion) },
        { k: 'mant', l: 'Mantención', der: true, f: (x) => $(x.mant) },
        { k: 'margen', l: 'Margen', der: true, f: (x) => <Plata v={x.margen} /> },
      ]} />
      <Nota>Días arrendado = días desde la última instalación registrada del baño (mismo cálculo que la ficha). Ingreso del baño = su valor de arriendo; si no tiene, el ingreso del cliente dividido por sus baños arrendados ("est."). Si el cliente tampoco tiene ingreso, el margen queda en "—". Los costos de rutas e insumos del cliente se dividen entre sus baños.</Nota>
    </>
  )
}

function Insumos({ d }) {
  return (
    <>
      <Kpis items={[
        { v: d.insumos.length, l: 'Insumos' },
        { v: d.insumos.filter((i) => i.comprar > 0).length, l: 'Para reponer' },
        { v: d.insumos.filter((i) => i.cobertura !== null && i.cobertura < 7).length, l: 'Alcanzan para menos de 7 días' },
        { v: $(d.insumos.reduce((s, i) => s + i.costoMes, 0)), l: 'Gasto mensual estimado' },
      ]} />
      <Tabla filas={d.insumos} min={1040} cols={[
        { k: 'nombre', l: 'Insumo', f: (x) => <>{x.nombre}<Est on={x.estimado} /></> },
        { k: 'stock', l: 'Stock', der: true, f: (x) => <span style={{ fontWeight: x.bajoMinimo ? 700 : 400, color: x.bajoMinimo ? '#b3261e' : undefined }}>{num(x.stock, 1)} {x.unidad}</span> },
        { k: 'porBano', l: 'Por limpieza', der: true, f: (x) => (x.sinReceta ? <SinDato>Sin receta</SinDato> : num(x.porBano, 2)) },
        { k: 'usadoRutas', l: `Limpiezas del mes (${num(d.banosLimpiadosMes)})`, der: true, f: (x) => (x.sinReceta ? '—' : num(x.usadoRutas, 1)) },
        { k: 'consumo30', l: 'Salidas de bodega 30 días', der: true, f: (x) => num(x.consumo30, 1) },
        { k: 'proyectado14', l: 'Próx. 14 días (rutas)', der: true, f: (x) => (x.sinReceta ? '—' : num(x.proyectado14, 1)) },
        { k: 'cobertura', l: 'Alcanza para', der: true, f: (x) => (x.cobertura == null ? <SinDato>Sin consumo</SinDato> : <span style={{ fontWeight: 700, color: x.cobertura < 7 ? '#b3261e' : undefined }}>{num(x.cobertura)} días</span>) },
        { k: 'punto', l: 'Reponer bajo', der: true, f: (x) => `${num(x.punto, 1)} ${x.unidad}` },
        { k: 'comprar', l: 'Comprar', der: true, f: (x) => (x.comprar ? <strong>{num(x.comprar)} {x.unidad}</strong> : '—') },
      ]} />
      <Nota>Consumo por día = el mayor entre: salidas de bodega de los últimos 30 días, lo usado en las limpiezas del mes según la receta, y lo que van a gastar las limpiezas planificadas en los próximos 14 días. Reponer bajo = 7 días de consumo + stock mínimo. La compra sugerida cubre 30 días. En rojo, stock bajo el mínimo.</Nota>
    </>
  )
}

function Tendencia({ t, onDetalle }) {
  const max = Math.max(1, ...t.map((x) => Math.max(x.ventas, x.costo)))
  const conVentas = t.some((x) => x.ventas > 0)
  return (
    <>
      <div style={{ border: `2px solid ${C.borde}`, background: '#fff', padding: '18px 16px 10px', margin: '18px 0 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.length}, minmax(0, 120px))`, gap: 12, alignItems: 'end', height: 180 }}>
          {t.map((x) => (
            <div key={x.mes} title={`${mesLargo(x.mes)}: ventas ${$(x.ventas)} · costos ${$(x.costo)}`} style={{ display: 'flex', gap: 2, alignItems: 'end', height: '100%' }}>
              <div style={{ flex: 1, height: `${(x.ventas / max) * 100}%`, background: C.navy, minHeight: x.ventas ? 2 : 0 }} />
              <div style={{ flex: 1, height: `${(x.costo / max) * 100}%`, background: C.amarillo, minHeight: x.costo ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.length}, minmax(0, 120px))`, gap: 12, marginTop: 6 }}>
          {t.map((x) => <div key={x.mes} style={{ font: '400 10px var(--font)', color: C.gris, textAlign: 'center' }}>{mesLargo(x.mes).slice(0, 3)} {x.mes.slice(2, 4)}</div>)}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, font: '400 12px var(--font)', color: '#3c4551' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, background: C.navy }} />Ventas</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, background: C.amarillo }} />Costos</span>
        </div>
      </div>
      <Tabla filas={[...t].reverse()} min={820} onFila={(x) => onDetalle({ titulo: mesLargo(x.mes), resumen: x.ventas ? `Ventas ${$(x.ventas)} − costos ${$(x.costo)} = ${$(x.margen)} (${pct(x.pct)}).` : `Sin ventas importadas. Costos registrados: ${$(x.costo)}.`, registros: [
        { fecha: x.mes + '-01', detalle: 'Ventas importadas de Maxxa', monto: x.ventas, ingreso: true },
        { fecha: x.mes + '-01', detalle: 'Costo de rutas (diésel, desgaste y fijos)', monto: x.rutas },
        { fecha: x.mes + '-01', detalle: 'Mantenciones completadas', monto: x.mant },
        { fecha: x.mes + '-01', detalle: 'Insumos consumidos', monto: x.insumos },
        { fecha: x.mes + '-01', detalle: 'Otros costos registrados', monto: x.otros },
      ] })} cols={[
        { k: 'mes', l: 'Mes', f: (x) => <>{mesLargo(x.mes)}<Est on={x.estimado} /></> },
        { k: 'ventas', l: 'Ventas', der: true, f: (x) => (x.ventas ? $(x.ventas) : <SinDato>Sin importar</SinDato>) },
        { k: 'rutas', l: 'Rutas', der: true, f: (x) => $(x.rutas) },
        { k: 'mant', l: 'Mantenciones', der: true, f: (x) => $(x.mant) },
        { k: 'insumos', l: 'Insumos', der: true, f: (x) => $(x.insumos) },
        { k: 'otros', l: 'Otros', der: true, f: (x) => $(x.otros) },
        { k: 'margen', l: 'Margen', der: true, f: (x) => <Plata v={x.margen} /> },
        { k: 'pct', l: '%', der: true, f: (x) => <Margen p={x.pct} /> },
      ]} />
      <Nota>Se muestran los meses desde el primero con registros (hasta 12). Margen operativo estimado: no reemplaza la utilidad contable.{!conVentas && ' Mientras no se importen ventas de Maxxa, el margen queda en "—".'}</Nota>
    </>
  )
}
