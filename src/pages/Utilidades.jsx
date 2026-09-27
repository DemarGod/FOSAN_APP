import { useEffect, useMemo, useState } from 'react'
import Listado, { Kpis, Aviso } from '../components/Listado'
import { utilidadMensual, utilidadPorServicio } from '../lib/api'
import { exportarVista } from '../lib/excel'
import { C, L_TIPO_SERVICIO, clp, millones, mesLargo } from '../lib/ui'

export default function Utilidades() {
  const [mensual, setMensual] = useState([])
  const [porServicio, setPorServicio] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([utilidadMensual(), utilidadPorServicio()])
      .then(([m, s]) => { setMensual(m); setPorServicio(s) })
      .catch(setError)
      .finally(() => setCargando(false))
  }, [])

  const ultimo = mensual[mensual.length - 1] || {}
  const maxVenta = Math.max(1, ...mensual.map((m) => Number(m.ventas || 0)))

  const filas = useMemo(() => porServicio.map((s, i) => ({
    id: i,
    mesL: mesLargo(s.mes),
    servicioL: L_TIPO_SERVICIO[s.tipo_servicio] || s.tipo_servicio,
    ventasL: clp(s.ventas),
    transporteL: clp(s.costo_transporte),
    documentos: s.documentos,
  })), [porServicio])

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 6,
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Utilidades y ventas</h2>
          <p className="text-muted" style={{ margin: 0 }}>
            Ventas, costos y margen por mes y por servicio. El costo de transporte se registra aparte
            porque el ERP no lo separa.
          </p>
        </div>
        <button className="btn" onClick={() => exportarVista('export_ingresos_costos', 'Ingresos y costos')}>
          Exportar a Excel
        </button>
      </div>

      <Kpis items={[
        { v: millones(ultimo.ventas), l: 'Ventas del último mes' },
        { v: millones(ultimo.costos), l: 'Costos' },
        { v: millones(ultimo.utilidad), l: 'Utilidad' },
        { v: (ultimo.margen ?? 0) + '%', l: 'Margen' },
      ]} />

      <Aviso error={error} />

      <section className="card" style={{ marginBottom: 20 }}>
        <h6>Ventas y utilidad por mes</h6>
        <div style={{ padding: '16px 18px' }}>
          {cargando && <span className="text-muted">Cargando…</span>}
          {!cargando && mensual.length === 0 && (
            <span className="text-muted">Todavía no hay ventas ni costos cargados.</span>
          )}
          {mensual.map((m) => (
            <div key={m.mes} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                font: '400 13px var(--font)', marginBottom: 5, flexWrap: 'wrap',
              }}>
                <span style={{ fontWeight: 600 }}>{mesLargo(m.mes)}</span>
                <span style={{ color: C.gris }}>
                  Ventas {clp(m.ventas)} · Costos {clp(m.costos)} ·
                  <span style={{ color: C.verde, fontWeight: 600 }}> Utilidad {clp(m.utilidad)}</span>
                  {' '}· Margen {m.margen ?? 0}%
                </span>
              </div>
              <div style={{ height: 12, background: C.fila, position: 'relative' }}>
                <div style={{
                  height: 12, background: C.navy,
                  width: (Number(m.ventas || 0) / maxVenta * 100) + '%',
                }} />
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: 12, background: C.verde,
                  width: (Math.max(0, Number(m.utilidad || 0)) / maxVenta * 100) + '%',
                }} />
              </div>
            </div>
          ))}
          {mensual.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '400 12px var(--font)', color: '#3c4551' }}>
                <span style={{ width: 11, height: 11, background: C.navy }} />Ventas
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '400 12px var(--font)', color: '#3c4551' }}>
                <span style={{ width: 11, height: 11, background: C.verde }} />Utilidad
              </span>
            </div>
          )}
        </div>
      </section>

      <Listado
        titulo="Detalle por servicio"
        bajada="Cada mes, desglosado por tipo de servicio."
        cargando={cargando}
        unidad="líneas"
        filtros={[{ k: 'mesL', label: 'Mes' }, { k: 'servicioL', label: 'Servicio' }]}
        buscar={['mesL', 'servicioL']}
        cols={[
          { k: 'mesL', label: 'Mes' },
          { k: 'servicioL', label: 'Servicio' },
          { k: 'ventasL', label: 'Ventas' },
          { k: 'transporteL', label: 'Costo transporte' },
          { k: 'documentos', label: 'Documentos' },
        ]}
        datos={filas}
      />
    </div>
  )
}
