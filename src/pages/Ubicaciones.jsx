import { useEffect, useMemo, useState } from 'react'
import Mapa, { Leyenda } from '../components/Mapa'
import { Kpis, Aviso } from '../components/Listado'
import { mapaPuntos, clientesResumen } from '../lib/api'
import { C, L_TIPO_UBIC } from '../lib/ui'

const FILTROS = ['Todos', 'En arriendo', 'Mantención', 'Bodega']

export default function Ubicaciones() {
  const [puntos, setPuntos] = useState([])
  const [sinGeo, setSinGeo] = useState(0)
  const [filtro, setFiltro] = useState('Todos')
  const [sel, setSel] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([mapaPuntos(), clientesResumen()])
      .then(([p, c]) => { setPuntos(p); setSinGeo(c.filter((x) => !x.georreferenciado).length) })
      .catch(setError)
  }, [])

  const visibles = useMemo(() => {
    if (filtro === 'Bodega') return puntos.filter((p) => p.tipo === 'bodega')
    if (filtro === 'Mantención') return puntos.filter((p) => p.en_mantencion > 0 || p.tipo === 'taller')
    if (filtro === 'En arriendo') return puntos.filter((p) => p.tipo === 'faena' || p.tipo === 'cliente')
    return puntos
  }, [puntos, filtro])

  const total = puntos.reduce((s, p) => s + Number(p.activos || 0), 0)
  const enMantencion = puntos.reduce((s, p) => s + Number(p.en_mantencion || 0), 0)
  const enFaena = puntos.filter((p) => p.tipo === 'faena' || p.tipo === 'cliente')
    .reduce((s, p) => s + Number(p.activos || 0), 0)

  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>Ubicaciones</h2>
      <p className="text-muted" style={{ margin: '0 0 16px' }}>
        Dónde está cada activo, agrupado por punto y cliente.
      </p>

      <Kpis items={[
        { v: total, l: 'Activos ubicados' },
        { v: enFaena, l: 'En arriendo' },
        { v: enMantencion, l: 'En mantención' },
        { v: sinGeo, l: 'Clientes sin georreferencia' },
      ]} />

      <Aviso error={error} />

      <div style={{
        display: 'flex', gap: 2, marginBottom: 16, border: `2px solid ${C.borde}`,
        width: 'fit-content', maxWidth: '100%', flexWrap: 'wrap',
      }}>
        {FILTROS.map((f) => {
          const on = filtro === f
          return (
            <button key={f} onClick={() => setFiltro(f)} style={{
              border: 0, background: on ? C.tinte : '#fff', color: on ? '#1a3c72' : '#3c4551',
              font: '600 13px var(--font)', padding: '10px 16px', minHeight: 42, cursor: 'pointer',
            }}>{f}</button>
          )
        })}
      </div>

      <div className="cols2" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
        <section className="card">
          <h6>Mapa de la operación</h6>
          <Mapa puntos={visibles} alto={470} zoom={9} centrarEn={sel} />
          <Leyenda />
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', background: C.tinte, borderBottom: `2px solid ${C.borde}` }}>
            <div style={{ font: '800 24px/1 var(--font)', color: '#1a3c72' }}>{visibles.length}</div>
            <div style={{ font: '400 11px var(--font)', color: '#3c4551', marginTop: 4 }}>
              puntos en esta vista · toca uno para centrarlo en el mapa
            </div>
          </div>

          <div style={{ maxHeight: 470, overflowY: 'auto' }}>
            {visibles.map((p) => (
              <button key={p.id} onClick={() => setSel(p.id)} style={{
                width: '100%', textAlign: 'left', border: 0,
                borderBottom: `1px solid ${C.fila}`,
                background: sel === p.id ? C.tinte : '#fff',
                padding: '12px 18px', cursor: 'pointer', display: 'flex', gap: 11, alignItems: 'flex-start',
              }}>
                <span style={{
                  width: 11, height: 11, flex: 'none', marginTop: 5, borderRadius: '50%',
                  background: p.en_mantencion > 0 ? C.amarillo : (p.tipo === 'bodega' ? C.navy : C.verde),
                }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ font: '600 13px var(--font)' }}>{p.nombre}</span>
                    <span style={{ font: '700 12px var(--font)', color: C.navy, whiteSpace: 'nowrap' }}>
                      {p.activos} activos
                    </span>
                  </span>
                  <span style={{
                    display: 'block', font: '400 11px/1.45 var(--font)', color: C.gris, marginTop: 3,
                  }}>
                    {p.cliente || L_TIPO_UBIC[p.tipo]} · {p.banos} baños · {p.vehiculos} vehículos
                  </span>
                </span>
              </button>
            ))}
            {visibles.length === 0 && (
              <div style={{ padding: 18 }} className="text-muted">
                No hay puntos que coincidan con este filtro.
              </div>
            )}
          </div>

          {sinGeo > 0 && (
            <div style={{
              padding: '12px 18px', borderTop: `2px solid ${C.borde}`,
              font: '400 11px/1.5 var(--font)', color: C.gris,
            }}>
              {sinGeo} cliente(s) sin georreferencia: se ubican cargando latitud y longitud
              desde la pestaña Clientes.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
