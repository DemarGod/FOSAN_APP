import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Mapa, { Leyenda } from '../components/Mapa'
import { Aviso } from '../components/Listado'
import { useSesion } from '../lib/sesion'
import { tableroInicio, avisosCalculados, mapaPuntos } from '../lib/api'
import { mesActual } from '../lib/analisis'
import { C, Icon, I, mesLargo } from '../lib/ui'

const NIVEL = {
  alerta: { color: C.rojo, tint: '#fce8e6', d: I.alert },
  aviso: { color: C.amarillo, tint: '#fef7e0', d: I.wrench },
  info: { color: C.azul, tint: C.tinte, d: I.info },
}
const ORDEN = { alerta: 0, aviso: 1, info: 2 }

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
  const [t, setT] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [puntos, setPuntos] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    tableroInicio().then(setT).catch(setError)
    avisosCalculados().then(setAvisos).catch(() => {})
    mapaPuntos().then(setPuntos).catch(() => {})
  }, [])

  const op = t?.operacion || {}
  const b = t?.banos || {}
  const tr = t?.transporte || {}

  // Alertas: calculadas + baños dañados + vehículos detenidos
  const alertas = [
    ...avisos,
    ...(t?.banosFuera || []).map((x) => ({ id: 'bf-' + x.id, origen: 'Baños químicos', a: '/banos', nivel: 'aviso', texto: `Baño ${x.codigo} fuera de servicio` })),
    ...(t?.vehiculosDetenidos || []).map((v) => ({
      id: 'veh-' + v.id, origen: 'Transporte', a: '/transporte', nivel: v.estado === 'fuera_de_servicio' ? 'alerta' : 'aviso',
      texto: `${v.codigo} ${v.estado === 'fuera_de_servicio' ? 'fuera de servicio' : 'en mantención'}`,
    })),
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
        <Grupo titulo="Operación diaria" onClick={navegar} items={[
          { v: v(op.hoy), l: 'Servicios programados hoy', s: 'Despachos y limpiezas en ruta', a: '/rutas', color: C.azul },
          { v: v(op.atrasados), l: 'Servicios atrasados', a: '/despachos', color: C.rojo, vColor: op.atrasados ? C.rojo : undefined },
          { v: v(op.retiros), l: 'Retiros pendientes', a: '/despachos', color: C.amarillo },
          { v: v(op.mantenciones), l: 'Mantenciones próximas', s: 'Próximos 7 días', a: '/mantenciones', color: C.navy },
        ]} />

        <Grupo titulo="Baños químicos" onClick={navegar} items={[
          { v: v(b.total), l: 'Total', a: '/banos', color: C.navy },
          { v: v(b.disponibles), l: 'Disponibles', a: '/banos', color: C.azul },
          { v: v(b.arrendados), l: 'Arrendados', a: '/banos', color: C.verde },
          { v: v(b.fuera), l: 'Fuera de servicio', s: 'En mantención o dañados', a: '/mantenciones', color: C.rojo },
        ]} />

        <Grupo titulo="Transporte" onClick={navegar} items={[
          { v: v(tr.disponibles), l: 'Vehículos disponibles', a: '/transporte', color: C.azul },
          { v: v(tr.operando), l: 'Vehículos en operación', s: 'Con ruta o despacho hoy', a: '/rutas', color: C.verde },
          { v: v(tr.mantPendientes), l: 'Mantenciones pendientes', s: t && tr.taller ? `${tr.taller} vehículo(s) en taller` : null, a: '/mantenciones', color: C.amarillo },
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
