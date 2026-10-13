import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Mapa, { Leyenda } from '../components/Mapa'
import { Aviso } from '../components/Listado'
import { useSesion, verFinanzas } from '../lib/sesion'
import { tableroInicio, avisosCalculados, mapaPuntos } from '../lib/api'
import { cargarMes, calcular, mesActual } from '../lib/analisis'
import { C, Icon, I, millones, mesLargo } from '../lib/ui'

const NIVEL = {
  alerta: { color: C.rojo, tint: '#fce8e6', d: I.alert },
  aviso: { color: C.amarillo, tint: '#fef7e0', d: I.wrench },
  info: { color: C.azul, tint: C.tinte, d: I.info },
}
const ORDEN = { alerta: 0, aviso: 1, info: 2 }
const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%')

function Seccion({ titulo, extra, children }) {
  return (
    <section className="card">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        padding: '14px 18px', background: C.tinte, borderBottom: `2px solid ${C.borde}`,
      }}>
        <h6 style={{ margin: 0, color: '#1a3c72' }}>{titulo}</h6>
        {extra}
      </div>
      {children}
    </section>
  )
}

// Un grupo de indicadores: título + celdas iguales separadas por reglas
function Grupo({ titulo, nota, items, onClick }) {
  return (
    <section style={{ background: '#fff', border: `2px solid ${C.borde}` }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
        padding: '12px 18px', borderBottom: `2px solid ${C.borde}`, background: C.tinte,
      }}>
        <h6 style={{ margin: 0, color: '#1a3c72' }}>{titulo}</h6>
        {nota && <span style={{ font: '400 12px var(--font)', color: C.gris }}>{nota}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, background: C.borde }}>
        {items.map((k) => (
          <button key={k.l} type="button" onClick={k.a ? () => onClick(k.a) : undefined} style={{
            background: '#fff', border: 0, textAlign: 'left', padding: '16px 18px', cursor: k.a ? 'pointer' : 'default',
            borderTop: `4px solid ${k.color || 'transparent'}`, minHeight: 92,
          }}>
            <div style={{ font: '800 28px/1 var(--font)', letterSpacing: '-.03em', color: k.vColor || C.tinta }}>{k.v}</div>
            <div style={{ font: '600 12px/1.3 var(--font)', color: '#3c4551', marginTop: 8 }}>{k.l}</div>
            {k.s && <div style={{ font: '400 11px/1.3 var(--font)', color: C.gris, marginTop: 3 }}>{k.s}</div>}
          </button>
        ))}
      </div>
    </section>
  )
}

export default function Inicio({ onCalendario }) {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const finanzas = verFinanzas(perfil)
  const [t, setT] = useState(null)
  const [fin, setFin] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [puntos, setPuntos] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    tableroInicio().then(setT).catch(setError)
    avisosCalculados().then(setAvisos).catch(() => {})
    mapaPuntos().then(setPuntos).catch(() => {})
    if (finanzas) cargarMes(mesActual()).then(calcular).then(setFin).catch(() => setFin({ error: true }))
  }, [finanzas])

  const b = t?.banos || {}
  const sv = t?.servicio || {}
  const uso = b.total ? b.arrendados / b.total : null
  const r = fin?.resumen
  const utilidad = r ? r.ingreso - r.costo : null
  const margen = r?.ingreso ? utilidad / r.ingreso : null

  // Alertas: las calculadas + vehículos detenidos + clientes con margen bajo
  const alertas = [
    ...avisos,
    ...(t?.vehiculosDetenidos || []).map((v) => ({
      id: 'veh-' + v.id, origen: 'Transporte', a: '/transporte', nivel: v.estado === 'fuera_de_servicio' ? 'alerta' : 'aviso',
      texto: `${v.codigo} ${v.estado === 'fuera_de_servicio' ? 'fuera de servicio' : 'en mantención'}`,
    })),
    ...(finanzas && fin?.clientes ? fin.clientes.filter((c) => c.pct !== null && c.pct < 0.2).map((c) => ({
      id: 'mrg-' + c.id, origen: 'Análisis', a: '/analisis', nivel: c.pct < 0 ? 'alerta' : 'aviso',
      texto: `${c.nombre}: margen ${pct(c.pct)} este mes`,
    })) : []),
  ].sort((x, y) => ORDEN[x.nivel] - ORDEN[y.nivel])

  const v = (x) => (t ? x : '…')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>¡Hola{perfil?.nombre ? ', ' + perfil.nombre.split(' ')[0] : ''}!</h2>
          <p className="text-muted" style={{ margin: 0 }}>Estado de la operación de FOSAN · {mesLargo(mesActual())}.</p>
        </div>
        <button className="btn" onClick={onCalendario}>
          <Icon d={I.cal} size={16} color={C.azul} />
          <span>Abrir calendario</span>
        </button>
      </div>

      <Aviso error={error} />

      <div style={{ display: 'grid', gap: 20 }}>
        <Grupo titulo="Baños químicos" nota="Utilización = arrendados ÷ total" onClick={navegar} items={[
          { v: v(b.total), l: 'Total', a: '/banos', color: C.navy },
          { v: v(b.disponibles), l: 'Disponibles', a: '/banos', color: C.azul },
          { v: v(b.arrendados), l: 'Arrendados', a: '/banos', color: C.verde },
          { v: v(b.mantencion + b.fuera), l: 'Fuera de servicio', s: t ? `${b.mantencion} en mantención · ${b.fuera} dañados` : null, a: '/mantenciones', color: C.rojo },
          { v: v(pct(uso)), l: 'Utilización de baños', color: C.verde, vColor: uso != null && uso < 0.6 ? C.rojo : undefined },
        ]} />

        {finanzas && (
          <Grupo titulo="Finanzas del mes" nota={fin?.error ? 'No se pudo calcular' : 'Ventas de Maxxa o valor de contrato'} onClick={navegar} items={[
            { v: r ? millones(r.ingreso) : '…', l: 'Ventas', a: '/utilidades', color: C.navy },
            { v: r ? millones(r.costo) : '…', l: 'Costos operacionales', s: 'Rutas, insumos, mantenciones y despachos', a: '/analisis', color: C.amarillo },
            { v: r ? millones(utilidad) : '…', l: 'Utilidad', a: '/utilidades', color: C.verde, vColor: utilidad < 0 ? C.rojo : undefined },
            { v: r ? pct(margen) : '…', l: 'Margen operacional', a: '/analisis', color: C.verde, vColor: margen != null && margen < 0.2 ? C.rojo : undefined },
          ]} />
        )}

        <Grupo titulo="Servicio" nota="Despachos, retiros y limpiezas en ruta" onClick={navegar} items={[
          { v: v(sv.realizados), l: 'Servicios realizados', s: 'Este mes', a: '/rutas', color: C.verde },
          { v: v(sv.pendientes), l: 'Servicios pendientes', s: t ? (sv.atrasados ? `Próximos 7 días · ${sv.atrasados} atrasado(s)` : 'Próximos 7 días') : null, a: '/despachos', color: sv.atrasados ? C.rojo : C.azul },
          { v: v(pct(sv.cumplimiento)), l: 'Entregas a tiempo', s: t ? `De ${sv.despachosHechos} despacho(s) hechos este mes` : null, a: '/despachos', color: C.navy, vColor: sv.cumplimiento != null && sv.cumplimiento < 0.9 ? C.rojo : undefined },
        ]} />

        <div className="cols2" style={{ gap: 20 }}>
          <Seccion titulo="Alertas" extra={<span style={{ font: '400 12px var(--font)', color: C.gris }}>{alertas.length}</span>}>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {alertas.map((a) => {
                const n = NIVEL[a.nivel] || NIVEL.info
                return (
                  <button key={a.id} type="button" onClick={a.a ? () => navegar(a.a) : undefined} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', textAlign: 'left',
                    border: 0, borderBottom: `1px solid ${C.fila}`, background: '#fff', cursor: a.a ? 'pointer' : 'default',
                  }}>
                    <span style={{ width: 30, height: 30, flex: 'none', background: n.tint, color: n.color, display: 'grid', placeItems: 'center' }}>
                      <Icon d={n.d} size={16} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', font: '600 13px/1.35 var(--font)', color: C.tinta }}>{a.texto}</span>
                      <span style={{ display: 'block', font: '400 11px var(--font)', color: C.gris }}>{a.origen}</span>
                    </span>
                  </button>
                )
              })}
              {alertas.length === 0 && <div style={{ padding: 18 }} className="text-muted">Sin alertas pendientes.</div>}
            </div>
          </Seccion>

          <Seccion titulo="Ubicación de baños" extra={
            <button className="btn btn-azul" onClick={() => navegar('/ubicaciones')}
              style={{ minHeight: 36, padding: '8px 14px', font: '600 12px var(--font)' }}>
              Ver mapa completo →
            </button>
          }>
            <Mapa puntos={puntos} alto={300} />
            <Leyenda />
          </Seccion>
        </div>
      </div>
    </div>
  )
}
