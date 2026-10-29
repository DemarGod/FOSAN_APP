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
  { v: 'aseo', l: 'Rentabilidad por aseo' },
  { v: 'equilibrio', l: 'Punto de equilibrio' },
  { v: 'km', l: 'Costo por km' },
  { v: 'ocupacion', l: 'Ocupación de baños' },
  { v: 'insumos', l: 'Insumos' },
  { v: 'tendencia', l: 'Tendencia mensual' },
]
const pct = (x) => (x === null || x === undefined || isNaN(x) ? '—' : Math.round(x * 100) + '%')
const $ = (x) => clp(Math.round(x || 0) || 0)
const num = (x, d = 0) => (x === null || x === undefined ? '—' : (Number(x) || 0).toLocaleString('es-CL', { maximumFractionDigits: d }))
const L_ESTADO = L_ESTADO_ACTIVO
const L_DESP = { entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio' }

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
          <p className="text-muted" style={{ margin: 0 }}>Cuánto deja cada cliente y cada aseo, con el valor de los contratos y el costo de atender a cada uno.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setParams(true)} style={{ minHeight: 42, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
            <span>Parámetros y supuestos</span>
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 12px var(--font)', color: C.gris }}>
            Mes
            <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)}
              style={{ border: `2px solid ${C.borde}`, font: '600 13px var(--font)', color: C.navy, padding: '9px 12px', minHeight: 42 }} />
          </label>
        </div>
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
          {vista === 'aseo' && <Aseo d={datos} r={r} />}
          {vista === 'equilibrio' && <Equilibrio d={datos} />}
          {vista === 'km' && <Km d={datos} />}
          {vista === 'ocupacion' && <Ocupacion o={datos.ocupacion} />}
          {vista === 'insumos' && <Insumos d={datos} />}
          {vista === 'tendencia' && <Tendencia t={tend} />}
        </>
      )}

      {params && <ParametrosCosto editable={esDueno(perfil)} onCerrar={() => { setParams(false); setRecarga((n) => n + 1) }} />}

      {detalle && (
        <Modal titulo={detalle.titulo} ancho={820} onCerrar={() => setDetalle(null)}>
          <div style={{ padding: 18, display: 'grid', gap: 12 }}>
            {detalle.resumen && <div style={{ font: '400 13px/1.5 var(--font)' }}>{detalle.resumen}</div>}
            <Tabla min={620} filas={detalle.lineas} cols={[
              { k: 'concepto', l: 'Concepto' },
              { k: 'formula', l: 'Cálculo', f: (x) => <span style={{ whiteSpace: 'normal', color: '#3c4551' }}>{x.formula}</span> },
              { k: 'monto', l: 'Monto', der: true, f: (x) => <span style={{ color: x.ingreso ? '#1e6b34' : undefined, fontWeight: 600 }}>{x.ingreso ? '+' : '−'}{$(x.monto)}</span> },
            ]} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function Calidad({ r, vista }) {
  const s = (k, uno, varios) => (k === 1 ? uno : varios)
  const ubic = [
    r.sinBodega && 'Falta la ubicación de la bodega en el Mapa (tipo Bodega con coordenadas). Sin ella no se calculan kilómetros.',
    r.clientesSinUbic > 0 && `${r.clientesSinUbic} ${s(r.clientesSinUbic, 'cliente no tiene', 'clientes no tienen')} latitud y longitud: su transporte queda en $0.`,
  ]
  const por = {
    clientes: [
      ...ubic,
      r.clientesSinIngreso > 0 && `${r.clientesSinIngreso} ${s(r.clientesSinIngreso, 'cliente no tiene', 'clientes no tienen')} valor mensual de contrato (${$(r.costoSinIngreso)} en costos). Se muestra lo que cuesta atenderlos, sin margen.`,
      r.clientesSinRuta > 0 && `${r.clientesSinRuta} ${s(r.clientesSinRuta, 'cliente tiene', 'clientes tienen')} aseos pero no está en ninguna ruta: se costea como viaje propio ida y vuelta.`,
      r.recetaVacia && 'No hay receta de aseo en Insumos: el costo de insumos por aseo sale en $0.',
      r.sinFijos && 'No hay insumos fijos (zapatos, poleras, guantes). Márcalos en Insumos como "Fijo mensual".',
    ],
    aseo: [r.recetaVacia && 'No hay receta de aseo en Insumos: el costo de insumos por aseo sale en $0.', r.banosSinIngreso > 0 && `${r.banosSinIngreso} baño(s) arrendados son de clientes sin valor de contrato.`],
    equilibrio: [r.clientesSinIngreso > 0 && `${r.clientesSinIngreso} cliente(s) sin valor de contrato no entran al cálculo.`, r.supuestoDep && 'La depreciación de baños usa el supuesto por defecto: revísalo en Parámetros y supuestos.'],
    km: [...ubic, r.rutasSinUbic > 0 && `${r.rutasSinUbic} ruta(s) tienen paradas sin ubicación: sus km quedan cortos.`, r.despachosSinUbic > 0 && `${r.despachosSinUbic} despacho(s) de clientes sin ubicación no tienen costo.`],
    ocupacion: [],
    insumos: [r.recetaVacia && 'No hay receta de aseo: define cuánto de cada insumo usa un aseo.', r.insumosSinCosto > 0 && `${r.insumosSinCosto} insumo(s) sin costo unitario.`, r.fijosSinDato > 0 && `${r.fijosSinDato} insumo(s) fijos sin unidades en uso o duración.`],
    tendencia: [],
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

const Est = ({ on }) => (on ? <span title="Incluye kilómetros o datos estimados" style={{ marginLeft: 6, padding: '1px 5px', font: '700 9px var(--font)', letterSpacing: '.06em', textTransform: 'uppercase', background: '#fef7e0', color: '#8a5a00', border: `1px solid ${C.amarillo}` }}>est.</span> : null)
const SinDato = ({ children = 'Sin contrato' }) => <span style={{ font: '600 11px var(--font)', color: C.gris }}>{children}</span>
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
const Caja = ({ titulo, children }) => (
  <div style={{ padding: '14px 16px', border: `2px solid ${C.borde}`, background: C.suave, font: '400 13px/1.55 var(--font)', margin: '16px 0' }}>
    {titulo && <strong style={{ display: 'block', marginBottom: 4 }}>{titulo}</strong>}
    {children}
  </div>
)
const Sub = ({ children }) => <h6 style={{ margin: '22px 0 8px', font: '700 12px var(--font)', textTransform: 'uppercase', letterSpacing: '.06em', color: C.gris }}>{children}</h6>

function Clientes({ d, r, onDetalle }) {
  const margenTot = r.ingresoCon ? (r.ingresoCon - r.costoCon) / r.ingresoCon : null
  const pie = d.clientes.reduce((a, x) => ({ arr: a.arr + x.arr, propios: a.propios + x.propios, aseos: a.aseos + x.aseos, ingreso: a.ingreso + (x.ingreso || 0), variable: a.variable + x.variable, fijo: a.fijo + x.fijo, costo: a.costo + x.costo, km: a.km + x.km }), { arr: 0, propios: 0, aseos: 0, ingreso: 0, variable: 0, fijo: 0, costo: 0, km: 0 })
  pie.margen = r.ingresoCon - r.costoCon; pie.pct = margenTot; pie.partIngreso = 1; pie.partCosto = 1
  return (
    <>
      <Kpis items={[
        { v: r.ingreso ? $(r.ingreso) : 'Sin datos', l: 'Ingreso mensual por contratos' },
        { v: $(r.costo), l: 'Costo de atender a los clientes' },
        { v: pct(margenTot), l: 'Margen de clientes con contrato' },
        { v: r.bajo20, l: 'Clientes bajo 20% de margen' },
        { v: num(r.aseos), l: 'Aseos programados en el mes' },
      ]} />
      <Caja titulo="Cómo se calcula (costo por servicio)">
        Ingreso = valor mensual del contrato. A cada cliente se le cargan los costos que genera: <strong>variables</strong> (insumos por aseo, agua y residuos, diésel y desgaste de los km que se recorren por él, despachos y mantenciones de sus baños) y <strong>fijos asignados</strong> (camión y conductor según su parte de los km, EPP según su parte de los aseos, depreciación de los baños que tiene arrendados). Contribución = ingreso − variables. Margen = ingreso − variables − fijos asignados. Clic en un cliente para ver cada cálculo.
      </Caja>
      <Tabla onFila={(x) => onDetalle({ titulo: x.nombre, resumen: x.sinIngreso
        ? `Sin valor mensual de contrato. Atenderlo cuesta ${$(x.costo)} al mes (${pct(x.partCosto)} del costo total).`
        : `Ingreso ${$(x.ingreso)} − variables ${$(x.variable)} = contribución ${$(x.contribucion)} (${pct(x.pctContrib)}). Menos fijos asignados ${$(x.fijo)} = margen ${$(x.margen)} (${pct(x.pct)}).`, lineas: x.lineas })}
        filas={d.clientes} min={1180} pie={pie} cols={[
          { k: 'nombre', l: 'Cliente', f: (x) => <>{x.nombre}<Est on={x.estimado} /></> },
          { k: 'arr', l: 'Baños arr.', der: true },
          { k: 'propios', l: 'Propios', der: true },
          { k: 'frec', l: 'Aseos/sem', der: true, f: (x) => (x.frec == null ? '' : x.frec) },
          { k: 'aseos', l: 'Aseos/mes', der: true, f: (x) => num(x.aseos) },
          { k: 'ingreso', l: 'Ingreso', der: true, f: (x) => (x.sinIngreso ? <SinDato /> : $(x.ingreso)) },
          { k: 'variable', l: 'Variables', der: true, f: (x) => $(x.variable) },
          { k: 'contribucion', l: 'Contribución', der: true, f: (x) => <Plata v={x.contribucion} /> },
          { k: 'fijo', l: 'Fijos asig.', der: true, f: (x) => $(x.fijo) },
          { k: 'margen', l: 'Margen', der: true, f: (x) => <Plata v={x.margen} /> },
          { k: 'pct', l: '%', der: true, f: (x) => <Margen p={x.pct} /> },
          { k: 'partIngreso', l: '% ingresos', der: true, f: (x) => pct(x.partIngreso) },
          { k: 'partCosto', l: '% costos', der: true, f: (x) => pct(x.partCosto) },
        ]} />
      <Nota>Aseos/mes = (baños arrendados + propios) × aseos por semana × {num(d.tarifas.semanas, 2)} semanas del mes. "% ingresos" y "% costos" muestran lo que el cliente representa en la empresa. En rojo, margen bajo 20%. "est." = km estimados (sin ruta asignada, sin ubicación o sin odómetro).</Nota>
    </>
  )
}

function Aseo({ d }) {
  const t = d.tarifas
  const e = d.equilibrio
  const [filtro, setFiltro] = useState('en_arriendo')
  const banos = useMemo(() => (filtro ? d.banos.filter((b) => b.estado === filtro) : d.banos), [d.banos, filtro])
  const cli = d.clientes.filter((c) => c.aseos > 0)
  return (
    <>
      <Kpis items={[
        { v: e.precioAseo != null ? $(e.precioAseo) : '—', l: 'Precio promedio por aseo' },
        { v: $(t.costoAseoVar), l: 'Costo directo de un aseo (insumos + agua + residuo)' },
        { v: e.cvAseo != null ? $(e.cvAseo) : '—', l: 'Costo variable por aseo con transporte' },
        { v: e.mcAseo != null ? $(e.mcAseo) : '—', l: 'Contribución por aseo' },
      ]} />
      <Sub>Qué lleva un aseo</Sub>
      <Tabla min={560} filas={[
        ...t.detalleAseo.map((x) => ({ concepto: x.nombre, detalle: `${num(x.cantidad, 2)} ${x.unidad} × ${$(x.unitario)}`, monto: x.costo })),
        { concepto: 'Agua limpia', detalle: 'Litros por baño × $/L', monto: t.serv.agua },
        { concepto: 'Disposición de residuos', detalle: 'Litros por baño × $/L', monto: t.serv.residuo },
      ]} pie={{ detalle: '', monto: t.costoAseoVar }} cols={[
        { k: 'concepto', l: 'Insumo' }, { k: 'detalle', l: 'Cantidad por aseo' }, { k: 'monto', l: 'Costo', der: true, f: (x) => $(x.monto) },
      ]} vacio="Sin receta de aseo." />
      <Sub>Por cliente</Sub>
      <Tabla min={860} filas={cli} cols={[
        { k: 'nombre', l: 'Cliente', f: (x) => <>{x.nombre}<Est on={x.estimado} /></> },
        { k: 'frec', l: 'Aseos/sem por baño', der: true },
        { k: 'aseos', l: 'Aseos/mes', der: true, f: (x) => num(x.aseos) },
        { k: 'precioAseo', l: 'Precio por aseo', der: true, f: (x) => (x.precioAseo == null ? <SinDato /> : $(x.precioAseo)) },
        { k: 'costoAseo', l: 'Costo por aseo', der: true, f: (x) => $(x.costoAseo) },
        { k: 'margenAseo', l: 'Margen por aseo', der: true, f: (x) => <Plata v={x.margenAseo} /> },
        { k: 'aseosReal', l: 'Hechos en rutas', der: true, f: (x) => num(x.aseosReal) },
      ]} vacio="Ningún cliente tiene aseos por semana configurados." />
      <Sub>Por baño</Sub>
      <div style={{ marginBottom: 12 }}>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ border: `2px solid ${C.borde}`, font: '600 13px var(--font)', color: C.navy, padding: '9px 12px', minHeight: 42 }}>
          <option value="">Estado: todos ({d.banos.length})</option>
          {Object.entries(L_ESTADO).filter(([k]) => k !== 'baja').map(([k, l]) => {
            const c = d.banos.filter((b) => b.estado === k).length
            return c ? <option key={k} value={k}>{l} ({c})</option> : null
          })}
        </select>
      </div>
      <Tabla filas={banos} min={1100} cols={[
        { k: 'codigo', l: 'Baño', f: (x) => <>{x.codigo}<Est on={x.estimado} /></> },
        { k: 'cliente', l: 'Cliente' },
        { k: 'frec', l: 'Aseos/sem', der: true },
        { k: 'aseos', l: 'Aseos/mes', der: true, f: (x) => num(x.aseos, 1) },
        { k: 'diasArriendo', l: 'Días arrendado', der: true, f: (x) => (x.estado !== 'en_arriendo' ? '—' : x.diasArriendo == null ? <SinDato>Sin instalación</SinDato> : <span title={'Desde ' + fecha(x.desde)}>{x.diasArriendo}</span>) },
        { k: 'ingreso', l: 'Ingreso mes', der: true, f: (x) => (x.sinIngreso ? <SinDato /> : x.ingreso == null ? '—' : $(x.ingreso)) },
        { k: 'costo', l: 'Costo mes', der: true, f: (x) => $(x.costo) },
        { k: 'precioAseo', l: 'Precio/aseo', der: true, f: (x) => (x.precioAseo == null ? '—' : $(x.precioAseo)) },
        { k: 'costoAseo', l: 'Costo/aseo', der: true, f: (x) => (x.costoAseo == null ? '—' : $(x.costoAseo)) },
        { k: 'margenAseo', l: 'Margen/aseo', der: true, f: (x) => (x.margenAseo == null ? <Plata v={x.margen} /> : <Plata v={x.margenAseo} />) },
      ]} />
      <Nota>Precio por aseo = ingreso del cliente ÷ sus aseos del mes. Costo por aseo = insumos + agua y residuos + transporte + parte de los fijos. Por baño se suma su depreciación ({$(t.depBanoMes)} al mes) y sus mantenciones. Un baño con más aseos por semana reparte su arriendo y depreciación en más aseos. Baños sin aseos (solo arriendo) muestran el margen del mes. Los baños en bodega solo tienen depreciación (capacidad ociosa).</Nota>
    </>
  )
}

function GraficoEquilibrio({ e }) {
  const porAseo = e.peAseos != null
  const actual = porAseo ? e.aseos : e.ingreso
  const pe = porAseo ? e.peAseos : e.pe$
  if (!pe || !actual) return null
  const W = 680, H = 300, L = 70, R = 20, T = 16, B = 40
  const xMax = Math.max(actual, pe) * 1.35
  const ing = (x) => (porAseo ? x * e.precioAseo : x)
  const cost = (x) => (porAseo ? e.CF + x * e.cvAseo : e.CF + x * (1 - e.ratioMC))
  const yMax = Math.max(ing(xMax), cost(xMax)) * 1.05
  const X = (x) => L + (x / xMax) * (W - L - R)
  const Y = (y) => T + (1 - y / yMax) * (H - T - B)
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const etq = (v) => (porAseo ? num(v) : '$' + num(v / 1e6, 1) + 'M')
  return (
    <div style={{ border: `2px solid ${C.borde}`, background: '#fff', padding: '14px 12px 10px', margin: '16px 0' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
        {ticks.map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={Y(yMax * f)} y2={Y(yMax * f)} stroke={C.fila} />
            <text x={L - 8} y={Y(yMax * f) + 4} textAnchor="end" fontFamily="Archivo" fontSize="11" fill={C.gris}>${num((yMax * f) / 1e6, 1)}M</text>
            <text x={X(xMax * f)} y={H - B + 18} textAnchor="middle" fontFamily="Archivo" fontSize="11" fill={C.gris}>{etq(xMax * f)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke={C.borde} strokeWidth="2" />
        <line x1={X(0)} x2={X(xMax)} y1={Y(e.CF)} y2={Y(e.CF)} stroke={C.gris} strokeDasharray="4 4" />
        <line x1={X(0)} x2={X(xMax)} y1={Y(cost(0))} y2={Y(cost(xMax))} stroke={C.amarillo} strokeWidth="3" />
        <line x1={X(0)} x2={X(xMax)} y1={Y(ing(0))} y2={Y(ing(xMax))} stroke={C.navy} strokeWidth="3" />
        <line x1={X(pe)} x2={X(pe)} y1={Y(0)} y2={Y(ing(pe))} stroke={C.rojo} strokeWidth="2" />
        <circle cx={X(pe)} cy={Y(ing(pe))} r="6" fill={C.rojo} />
        <text x={X(pe) + 8} y={Y(ing(pe)) - 8} fontFamily="Archivo" fontSize="12" fontWeight="700" fill={C.rojo}>Equilibrio · {etq(pe)}</text>
        <line x1={X(actual)} x2={X(actual)} y1={Y(0)} y2={T} stroke={C.verde} strokeWidth="2" strokeDasharray="6 4" />
        <text x={X(actual) + 6} y={T + 12} fontFamily="Archivo" fontSize="12" fontWeight="700" fill={C.verde}>Hoy · {etq(actual)}</text>
        <text x={W - R} y={H - 4} textAnchor="end" fontFamily="Archivo" fontSize="11" fill={C.gris}>{porAseo ? 'Aseos al mes' : 'Ingreso al mes'}</text>
      </svg>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, font: '400 12px var(--font)', color: '#3c4551' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: C.navy }} />Ingresos</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: C.amarillo }} />Costo total (fijos + variables)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${C.gris}` }} />Costos fijos</span>
      </div>
    </div>
  )
}

function Equilibrio({ d }) {
  const e = d.equilibrio
  return (
    <>
      <Kpis items={[
        { v: $(e.CF), l: 'Costos fijos del mes' },
        { v: pct(e.ratioMC), l: 'Margen de contribución' },
        { v: e.pe$ != null ? $(e.pe$) : '—', l: 'Ingreso mínimo para no perder' },
        { v: e.peAseos != null ? num(Math.ceil(e.peAseos)) : '—', l: `Aseos mínimos al mes · hoy ${num(e.aseos)}` },
        { v: e.peBanos != null ? num(Math.ceil(e.peBanos)) : '—', l: `Baños arrendados mínimos · hoy ${e.banos}` },
        { v: pct(e.seguridad), l: 'Margen de seguridad' },
      ]} />
      <GraficoEquilibrio e={e} />
      <Caja titulo="Cómo se lee">
        El punto de equilibrio es el nivel de actividad en que los ingresos cubren justo los costos fijos y variables. Cada aseo aporta su precio ({e.precioAseo != null ? $(e.precioAseo) : '—'}) menos su costo variable ({e.cvAseo != null ? $(e.cvAseo) : '—'}) = {e.mcAseo != null ? $(e.mcAseo) : '—'} para pagar los fijos.
        Equilibrio = costos fijos ÷ contribución por aseo = {$(e.CF)} ÷ {e.mcAseo != null ? $(e.mcAseo) : '—'} = {e.peAseos != null ? num(Math.ceil(e.peAseos)) : '—'} aseos al mes.
        En pesos: costos fijos ÷ margen de contribución = {$(e.CF)} ÷ {pct(e.ratioMC)} = {e.pe$ != null ? $(e.pe$) : '—'}.
        Margen de seguridad = cuánto pueden caer los ingresos antes de perder plata. Resultado del mes con los datos actuales: <strong style={{ color: e.resultado < 0 ? '#b3261e' : '#1e6b34' }}>{$(e.resultado)}</strong>.
      </Caja>
      <Sub>Costos fijos del mes</Sub>
      <Tabla min={520} filas={e.cf} pie={{ monto: e.CF }} cols={[
        { k: 'concepto', l: 'Concepto' }, { k: 'monto', l: 'Monto mensual', der: true, f: (x) => $(x.monto) },
      ]} />
      <Nota>Solo entran clientes con valor mensual de contrato. La depreciación de baños considera todos los baños (también los de bodega): {e.ocioso ? `${$(e.ocioso)} al mes corresponden a baños sin arrendar.` : ''} Sin gastos de administración, peajes ni tiempo del conductor, según lo definido.</Nota>
    </>
  )
}

function Km({ d }) {
  const t = d.tarifas
  const k = t.k
  const pieR = d.rutas.reduce((a, x) => ({ kmMes: a.kmMes + x.kmMes, costoMes: a.costoMes + x.costoMes, aseosMes: a.aseosMes + x.aseosMes, salidasMes: a.salidasMes + x.salidasMes }), { kmMes: 0, costoMes: 0, aseosMes: 0, salidasMes: 0 })
  pieR.costoAseo = pieR.aseosMes ? pieR.costoMes / pieR.aseosMes : null
  const kmL = (v) => '$' + num(v, v < 100 ? 1 : 0)
  return (
    <>
      <Kpis items={[
        { v: kmL(k.total) + '/km', l: 'Costo completo por km' },
        { v: kmL(t.kmVar) + '/km', l: 'Variable (diésel + desgaste)' },
        { v: kmL(k.fijos + k.depreciacion + k.conductor) + '/km', l: 'Fijo (documentos, depreciación, conductor)' },
        { v: '× ' + num(t.factor, 2), l: 'Factor de recorrido real' },
      ]} />
      <Caja titulo="Por qué km y no costo por ruta">
        Las rutas no siempre siguen el camino más corto, así que el km de cada ruta se toma del odómetro cuando existe. Si no hay odómetro, se mide la distancia en línea recta bodega → paradas en orden → bodega y se multiplica por el factor de recorrido ({num(t.factor, 2)}), que representa los desvíos reales. El costo de cada ruta se reparte entre sus clientes según lo lejos que está cada uno de la bodega.
      </Caja>
      <Sub>Costo por km del camión</Sub>
      <Tabla min={480} filas={[
        { c: 'Diésel', v: k.combustible, t: 'Variable' }, { c: 'Neumáticos, aceite, frenos, suspensión, preventiva', v: k.mantencion, t: 'Variable' },
        { c: 'Depreciación del camión', v: k.depreciacion, t: 'Fijo' }, { c: 'Permiso, seguro y revisión', v: k.fijos, t: 'Fijo' }, { c: 'Conductor', v: k.conductor, t: 'Fijo' },
      ]} pie={{ t: '', v: k.total }} cols={[{ k: 'c', l: 'Concepto' }, { k: 't', l: 'Tipo' }, { k: 'v', l: '$/km', der: true, f: (x) => kmL(x.v) }]} />
      <Sub>Rutas semanales del mes</Sub>
      <Tabla filas={d.rutas} min={1060} pie={pieR} cols={[
        { k: 'ruta', l: 'Ruta', f: (x) => <>{x.ruta}<Est on={x.fuenteKm !== 'Odómetro'} /></> },
        { k: 'paradas', l: 'Clientes', der: true },
        { k: 'diasSem', l: 'Días con viaje', der: true },
        { k: 'kmRecto', l: 'Km línea recta', der: true, f: (x) => (x.kmRecto == null ? '—' : num(x.kmRecto, 1)) },
        { k: 'kmEst', l: `Km estimados (×${num(t.factor, 2)})`, der: true, f: (x) => (x.kmEst == null ? '—' : num(x.kmEst, 1)) },
        { k: 'kmOdo', l: 'Km odómetro', der: true, f: (x) => (x.kmOdo == null ? <SinDato>Sin odómetro</SinDato> : `${num(x.kmOdo, 1)} (${x.salidasOdo} día/s)`) },
        { k: 'costoSalida', l: 'Costo/día', der: true, f: (x) => (x.costoSalida == null ? '—' : $(x.costoSalida)) },
        { k: 'kmMes', l: 'Km/mes', der: true, f: (x) => num(x.kmMes) },
        { k: 'costoMes', l: 'Costo/mes', der: true, f: (x) => $(x.costoMes) },
        { k: 'costoAseo', l: 'Transporte/aseo', der: true, f: (x) => (x.costoAseo == null ? '—' : $(x.costoAseo)) },
      ]} vacio="No hay rutas semanales en este mes." />
      <Sub>Despachos del mes (viaje bodega → cliente → bodega)</Sub>
      <Tabla filas={d.despachos} min={760} cols={[
        { k: 'folio', l: 'Folio' },
        { k: 'fecha', l: 'Fecha', f: (x) => fecha(x.fecha) },
        { k: 'tipo', l: 'Tipo', f: (x) => L_DESP[x.tipo] || x.tipo },
        { k: 'cliente', l: 'Cliente' },
        { k: 'km', l: 'Km ida y vuelta', der: true, f: (x) => (x.enRuta ? <SinDato>Incluido en ruta</SinDato> : x.km == null ? <SinDato>Sin ubicación</SinDato> : num(x.km, 1)) },
        { k: 'costoVar', l: 'Variable', der: true, f: (x) => (x.enRuta || x.costoVar == null ? '—' : $(x.costoVar)) },
        { k: 'costo', l: 'Costo completo', der: true, f: (x) => (x.enRuta || x.costo == null ? '—' : $(x.costo)) },
      ]} vacio="Sin despachos en este mes." />
      <Nota>Despacho fuera de ruta = 2 × distancia bodega–cliente × factor de recorrido × costo por km, cargado al cliente que lo recibe. Si el despacho va como parada de una ruta semanal, sus km ya están en el costo de ese día. Cada ruta suma solo los días (lunes a viernes) que caen dentro del mes elegido.</Nota>
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
      <Caja titulo="Cómo se lee">
        Ocupación = baños en arriendo ÷ baños arrendables (en arriendo + disponibles). Los que están en mantención u otros estados no se cuentan porque no se pueden arrendar.
        Hoy: {h.arriendo} ÷ ({h.arriendo} + {h.disponible}) = {pct(o.pctHoy)}.
        <div style={{ marginTop: 6, color: C.gris, font: '400 12px var(--font)' }}>
          {h.total} = {h.arriendo} en arriendo + {h.disponible} disponibles + {h.mantencion} en mantención{h.otros ? ` + ${h.otros} en otros estados (${otros})` : ''}. Promedio del mes: {o.fuente}.
        </div>
      </Caja>
      <Tabla filas={o.porModelo} min={760} pie={pie} cols={[
        { k: 'modelo', l: 'Modelo' }, { k: 'total', l: 'Total', der: true }, { k: 'arriendo', l: 'En arriendo', der: true },
        { k: 'disponible', l: 'Disponibles', der: true }, { k: 'mantencion', l: 'En mantención', der: true }, { k: 'otros', l: 'Otros estados', der: true },
        { k: 'pct', l: 'Ocupación hoy', der: true, f: (x) => pct(x.pct) },
      ]} />
    </>
  )
}

function Insumos({ d }) {
  const t = d.tarifas
  const aseo = d.insumos.filter((i) => i.uso === 'aseo')
  return (
    <>
      <Kpis items={[
        { v: $(t.insumosAseo), l: 'Insumos por aseo (variable)' },
        { v: $(t.eppMes), l: 'Insumos fijos al mes (EPP y otros)' },
        { v: aseo.filter((i) => i.comprar > 0).length, l: 'Para reponer' },
        { v: aseo.filter((i) => i.cobertura !== null && i.cobertura < 7).length, l: 'Alcanzan para menos de 7 días' },
      ]} />
      <Sub>Variables: se gastan en cada aseo</Sub>
      <Tabla filas={aseo} min={1040} cols={[
        { k: 'nombre', l: 'Insumo', f: (x) => <>{x.nombre}<Est on={x.estimado} /></> },
        { k: 'stock', l: 'Stock', der: true, f: (x) => <span style={{ fontWeight: x.bajoMinimo ? 700 : 400, color: x.bajoMinimo ? '#b3261e' : undefined }}>{num(x.stock, 1)} {x.unidad}</span> },
        { k: 'porBano', l: 'Por aseo', der: true, f: (x) => (x.sinReceta ? <SinDato>Sin receta</SinDato> : num(x.porBano, 2)) },
        { k: 'usadoRutas', l: `Aseos hechos (${num(d.banosLimpiadosMes)})`, der: true, f: (x) => (x.sinReceta ? '—' : num(x.usadoRutas, 1)) },
        { k: 'consumo30', l: 'Salidas bodega 30 días', der: true, f: (x) => num(x.consumo30, 1) },
        { k: 'proyectado14', l: 'Próx. 14 días', der: true, f: (x) => (x.sinReceta ? '—' : num(x.proyectado14, 1)) },
        { k: 'cobertura', l: 'Alcanza para', der: true, f: (x) => (x.cobertura == null ? <SinDato>Sin consumo</SinDato> : <span style={{ fontWeight: 700, color: x.cobertura < 7 ? '#b3261e' : undefined }}>{num(x.cobertura)} días</span>) },
        { k: 'punto', l: 'Reponer bajo', der: true, f: (x) => `${num(x.punto, 1)} ${x.unidad}` },
        { k: 'comprar', l: 'Comprar', der: true, f: (x) => (x.comprar ? <strong>{num(x.comprar)} {x.unidad}</strong> : '—') },
      ]} />
      <Sub>Fijos: se reponen cada cierto tiempo (zapatos, poleras, guantes…)</Sub>
      <Tabla filas={t.fijosIns} min={720} pie={{ mensual: t.eppMes }} cols={[
        { k: 'nombre', l: 'Insumo' },
        { k: 'enUso', l: 'Unidades en uso', der: true, f: (x) => (x.enUso ? num(x.enUso) : '—') },
        { k: 'unitario', l: 'Costo unitario', der: true, f: (x) => (x.unitario ? $(x.unitario) : '—') },
        { k: 'duracion', l: 'Dura (meses)', der: true, f: (x) => (x.duracion ? num(x.duracion, 1) : '—') },
        { k: 'mensual', l: 'Costo mensual', der: true, f: (x) => (x.sinDato ? <SinDato>Falta dato</SinDato> : $(x.mensual)) },
      ]} vacio='Ningún insumo marcado como "Fijo mensual" en Insumos.' />
      <Nota>Variable: costo por aseo = cantidad de la receta × costo unitario. Fijo: costo mensual = unidades en uso × costo unitario ÷ meses que dura; se reparte entre clientes según sus aseos. Consumo por día = el mayor entre salidas de bodega de 30 días, lo gastado en aseos del mes y lo planificado a 14 días.</Nota>
    </>
  )
}

function Tendencia({ t }) {
  const max = Math.max(1, ...t.map((x) => Math.max(x.ingreso, x.costo)))
  return (
    <>
      <div style={{ border: `2px solid ${C.borde}`, background: '#fff', padding: '18px 16px 10px', margin: '18px 0 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.length}, minmax(0, 120px))`, gap: 12, alignItems: 'end', height: 180 }}>
          {t.map((x) => (
            <div key={x.mes} title={`${mesLargo(x.mes)}: contratos ${$(x.ingreso)} · costos ${$(x.costo)}`} style={{ display: 'flex', gap: 2, alignItems: 'end', height: '100%' }}>
              <div style={{ flex: 1, height: `${(x.ingreso / max) * 100}%`, background: C.navy, minHeight: x.ingreso ? 2 : 0 }} />
              <div style={{ flex: 1, height: `${(x.costo / max) * 100}%`, background: C.amarillo, minHeight: x.costo ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${t.length}, minmax(0, 120px))`, gap: 12, marginTop: 6 }}>
          {t.map((x) => <div key={x.mes} style={{ font: '400 10px var(--font)', color: C.gris, textAlign: 'center' }}>{mesLargo(x.mes).slice(0, 3)} {x.mes.slice(2, 4)}</div>)}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, font: '400 12px var(--font)', color: '#3c4551' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, background: C.navy }} />Contratos vigentes</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 11, background: C.amarillo }} />Costos registrados</span>
        </div>
      </div>
      <Tabla filas={[...t].reverse()} min={760} cols={[
        { k: 'mes', l: 'Mes', f: (x) => mesLargo(x.mes) },
        { k: 'ingreso', l: 'Contratos vigentes', der: true, f: (x) => (x.ingreso ? $(x.ingreso) : <SinDato />) },
        { k: 'rutas', l: 'Rutas', der: true, f: (x) => $(x.rutas) },
        { k: 'mant', l: 'Mantenciones', der: true, f: (x) => $(x.mant) },
        { k: 'insumos', l: 'Insumos', der: true, f: (x) => $(x.insumos) },
        { k: 'margen', l: 'Diferencia', der: true, f: (x) => <Plata v={x.margen} /> },
        { k: 'pct', l: '%', der: true, f: (x) => <Margen p={x.pct} /> },
      ]} />
      <Nota>Aún no hay historial: la tabla parte en el primer mes con costos registrados y se irá llenando mes a mes. Ingreso = suma del valor mensual de los contratos vigentes en cada mes. Costos = rutas, mantenciones completadas e insumos que salieron de bodega.</Nota>
    </>
  )
}
