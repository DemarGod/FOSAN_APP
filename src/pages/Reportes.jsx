import { useEffect, useState } from 'react'
import { Aviso } from '../components/Listado'
import ImportarMaxxa, { Importaciones } from '../components/ImportarMaxxa'
import { useSesion, puedeEditar } from '../lib/sesion'
import { topClientes } from '../lib/api'
import { exportarLibro, exportarVista, PESTANAS } from '../lib/excel'
import { C, Icon, I, clp } from '../lib/ui'

export default function Reportes() {
  const [top, setTop] = useState([])
  const [error, setError] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [importar, setImportar] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [version, setVersion] = useState(0)
  const { perfil } = useSesion()
  const editable = puedeEditar(perfil)

  useEffect(() => { topClientes().then(setTop).catch(setError) }, [])

  const max = Math.max(1, ...top.map((t) => Number(t.ingresos || 0)))

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

      <div className="cols2" style={{ gap: 24 }}>
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
                  <span style={{ fontWeight: 600 }}>{clp(c.ingresos)}</span>
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
          <h6 style={{ margin: 0, color: '#1a3c72' }}>Estructura del archivo Excel</h6>
          <span style={{ font: '400 12px var(--font)', color: C.gris }}>
            Una pestaña por bloque, en columnas y filas para análisis
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {PESTANAS.map((p) => (
            <div key={p.vista} style={{
              padding: '13px 18px', borderBottom: `1px solid ${C.fila}`, borderRight: `1px solid ${C.fila}`,
            }}>
              <div style={{ font: '600 13px var(--font)' }}>{p.hoja}</div>
              <div style={{ font: '400 11px/1.5 var(--font)', color: C.gris }}>{p.cols}</div>
            </div>
          ))}
        </div>
      </section>
      <Importaciones version={version} editable={editable} />
    </div>
  )
}
