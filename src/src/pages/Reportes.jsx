import { useEffect, useState } from 'react'
import { Aviso } from '../components/Listado'
import ImportarMaxxa, { Importaciones } from '../components/ImportarMaxxa'
import { useSesion, puedeEditar } from '../lib/sesion'
import { topClientes, utilidadMensual } from '../lib/api'
import { exportarLibro, exportarVista, PESTANAS } from '../lib/excel'
import { C, Icon, I, clp, mesLargo } from '../lib/ui'

function GraficoUtilidad({ datos }) {
  if (!datos.length) return null
  const anchoBarra = 30, gapBarras = 8, gapGrupo = 40
  const grupoAncho = anchoBarra * 2 + gapBarras
  const alto = 170, margenSup = 10, margenInf = 26
  const max = Math.max(1, ...datos.flatMap((d) => [Number(d.ventas || 0), Number(d.costos || 0)]))
  const ancho = datos.length * grupoAncho + (datos.length + 1) * gapGrupo
  const svgAlto = alto + margenSup + margenInf
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={ancho} height={svgAlto} viewBox={`0 0 ${ancho} ${svgAlto}`} style={{ display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={ancho} y1={margenSup + alto * (1 - f)} y2={margenSup + alto * (1 - f)} stroke={C.fila} strokeWidth={1} />
        ))}
        {datos.map((d, i) => {
          const x = gapGrupo + i * (grupoAncho + gapGrupo)
          const hV = (Number(d.ventas || 0) / max) * alto
          const hC = (Number(d.costos || 0) / max) * alto
          return (
            <g key={d.mes}>
              <rect x={x} y={margenSup + alto - hV} width={anchoBarra} height={hV} fill={C.navy}><title>Ventas: {clp(d.ventas)}</title></rect>
              <rect x={x + anchoBarra + gapBarras} y={margenSup + alto - hC} width={anchoBarra} height={hC} fill={C.amarillo}><title>Costos: {clp(d.costos)}</title></rect>
              <text x={x + grupoAncho / 2} y={margenSup + alto + 18} textAnchor="middle" fontFamily="Archivo" fontSize="11" fill={C.gris}>
                {mesLargo(d.mes).split(' ')[0].slice(0, 3)}
              </text>
            </g>
          )
        })}
        <line x1={0} x2={ancho} y1={margenSup + alto} y2={margenSup + alto} stroke={C.borde} strokeWidth={2} />
      </svg>
      <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '400 12px var(--font)', color: C.gris }}>
          <span style={{ width: 10, height: 10, background: C.navy, display: 'inline-block' }} /> Ventas
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '400 12px var(--font)', color: C.gris }}>
          <span style={{ width: 10, height: 10, background: C.amarillo, display: 'inline-block' }} /> Costos
        </span>
      </div>
    </div>
  )
}

export default function Reportes() {
  const [top, setTop] = useState([])
  const [fin, setFin] = useState([])
  const [error, setError] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [importar, setImportar] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [version, setVersion] = useState(0)
  const { perfil } = useSesion()
  const editable = puedeEditar(perfil)

  useEffect(() => {
    topClientes().then(setTop).catch(setError)
    utilidadMensual().then(setFin).catch(() => {})
  }, [])

  const max = Math.max(1, ...top.map((t) => Number(t.ingresos || 0)))
  const ultimoMes = fin[fin.length - 1] || {}
  const seisMeses = fin.slice(-6)
  const kpis = [
    { v: clp(ultimoMes.ventas), l: `Ventas · ${mesLargo(ultimoMes.mes)}`, color: C.navy, tint: '#e8edf5', d: I.money },
    { v: clp(ultimoMes.costos), l: 'Costos del mes', color: C.amarillo, tint: '#fef7e0', d: I.wrench },
    { v: clp(ultimoMes.utilidad), l: 'Utilidad del mes', color: C.verde, tint: '#e6f4ea', d: I.chart },
    { v: ultimoMes.margen != null ? ultimoMes.margen + '%' : '—', l: 'Margen del mes', color: C.azul, tint: C.tinte, d: I.chart },
  ]

  const libro = async () => {
    setGenerando(true)
    try { await exportarLibro() } catch (e) { setError(e) }
    setGenerando(false)
  }

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Reportes</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Los indicadores que hoy salen a mano desde Excel, generados desde la base.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {editable && (
            <button className="btn" onClick={() => setImportar(true)}>
              <Icon d="M12 21V9M7.5 13.5 12 9l4.5 4.5M4 4h16" size={16} />
              <span>Importar reporte Maxxa</span>
            </button>
          )}
          <button className="btn btn-verde" onClick={libro} disabled={generando}>
            <Icon d={I.descarga} size={16} />
            <span>{generando ? 'Generando…' : 'Descargar libro completo'}</span>
          </button>
        </div>
      </div>
      {aviso && <div style={{ marginTop: 16, padding: '10px 14px', background: '#e6f4ea', border: `2px solid ${C.verde}`, font: '600 13px var(--font)', color: '#1e6b34' }}>{aviso} Ya se ven en Análisis.</div>}
      {importar && <ImportarMaxxa onCerrar={() => setImportar(false)} onImportado={(m) => { setImportar(false); setAviso(m); setVersion((n) => n + 1); topClientes().then(setTop).catch(() => {}) }} />}

      <div style={{ marginTop: 22 }}><Aviso error={error} /></div>

      <div className="kpis" style={{ marginTop: 4 }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ background: '#fff', border: `2px solid ${C.borde}`, borderTop: `4px solid ${k.color}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 38, height: 38, flex: 'none', background: k.tint, color: k.color, display: 'grid', placeItems: 'center' }}>
              <Icon d={k.d} size={20} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: '800 22px/1 var(--font)', letterSpacing: '-.03em' }}>{k.v}</div>
              <div style={{ font: '400 12px/1.3 var(--font)', color: C.gris, marginTop: 5 }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cols2" style={{ gap: 24, marginTop: 20 }}>
        <section className="card">
          <h6>Top 5 clientes por ingresos</h6>
          <div style={{ padding: '16px 18px' }}>
            {top.length === 0 && <span className="text-muted">Todavía no hay ventas cargadas.</span>}
            {top.map((c) => (
              <div key={c.nombre} style={{ marginBottom: 14 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                  font: '400 13px var(--font)', marginBottom: 5,
                }}>
                  <span>{c.nombre}</span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>{clp(c.ingresos)}</span>
                    <span style={{ font: '400 11px var(--font)', color: C.gris }}>{c.documentos} doc.</span>
                  </span>
                </div>
                <div style={{ height: 10, background: C.fila }}>
                  <div style={{
                    height: 10, background: C.navy,
                    width: (Number(c.ingresos || 0) / max * 100) + '%',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h6>Reportes disponibles</h6>
          {PESTANAS.map((p) => (
            <div key={p.vista} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 12, padding: '13px 18px', borderBottom: `1px solid ${C.fila}`,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 13px var(--font)' }}>{p.hoja}</div>
                <div style={{ font: '400 11px/1.5 var(--font)', color: C.gris }}>{p.cols}</div>
              </div>
              <button className="btn" onClick={() => exportarVista(p.vista, p.hoja)}
                style={{ minHeight: 36, padding: '8px 14px', font: '600 12px var(--font)' }}>
                Generar
              </button>
            </div>
          ))}
        </section>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          padding: '14px 18px', background: C.tinte, borderBottom: `2px solid ${C.borde}`,
        }}>
          <h6 style={{ margin: 0, color: '#1a3c72' }}>Evolución de utilidad</h6>
          <span style={{ font: '400 12px var(--font)', color: C.gris }}>Últimos {seisMeses.length} mes(es)</span>
        </div>
        <div style={{ padding: '18px 18px 8px' }}><GraficoUtilidad datos={seisMeses} /></div>
        <div className="scroller">
          <table style={{ minWidth: 520 }}>
            <thead><tr><th>Mes</th><th>Ventas</th><th>Costos</th><th>Utilidad</th><th>Margen</th></tr></thead>
            <tbody>
              {seisMeses.map((m) => (
                <tr key={m.mes}>
                  <td>{mesLargo(m.mes)}</td>
                  <td>{clp(m.ventas)}</td>
                  <td>{clp(m.costos)}</td>
                  <td style={{ fontWeight: 600, color: m.utilidad >= 0 ? C.verde : C.rojo }}>{clp(m.utilidad)}</td>
                  <td>{m.margen != null ? m.margen + '%' : '—'}</td>
                </tr>
              ))}
              {seisMeses.length === 0 && (
                <tr><td colSpan={5} className="text-muted" style={{ padding: 14 }}>Todavía no hay ventas ni costos cargados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Importaciones version={version} editable={editable} />
    </div>
  )
}
