import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Mapa, { Leyenda } from '../components/Mapa'
import { Aviso } from '../components/Listado'
import { useSesion, esSecretaria, verFinanzas } from '../lib/sesion'
import {
  resumenInventario, estadoActivos, serviciosMes, mapaPuntos, banosKpi,
  utilidadMensual, actividadReciente, notificaciones,
} from '../lib/api'
import {
  C, Icon, I, millones, fechaHora, L_TIPO_SERVICIO, L_ESTADO_ACTIVO, L_MOVIMIENTO,
} from '../lib/ui'

const COLOR_ESTADO = {
  en_arriendo: C.verde, en_servicio: C.verde, disponible: C.azul,
  mantencion: C.amarillo, fuera_de_servicio: C.rojo,
}
const COLOR_SERVICIO = {
  arriendo_bano: C.verde, limpieza_bano: C.azul, limpieza_fosa: C.navy,
}
const ICONO_SERVICIO = {
  arriendo_bano: I.drop, limpieza_bano: I.clip, limpieza_fosa: I.truck,
}
const NIVEL = {
  alerta: { color: C.rojo, tint: '#fce8e6', d: I.alert },
  aviso: { color: C.amarillo, tint: '#fef7e0', d: I.wrench },
  info: { color: C.azul, tint: C.tinte, d: I.info },
}

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

function Donut({ datos, total }) {
  const r = 86
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 240 240" style={{ width: 'clamp(120px, 38%, 160px)', height: 'auto', flex: 'none' }}>
      <circle cx="120" cy="120" r={r} fill="none" stroke={C.fila} strokeWidth="34" />
      {datos.map((d) => {
        const largo = (Number(d.porcentaje) / 100) * circ
        const el = (
          <circle key={d.estado} cx="120" cy="120" r={r} fill="none"
            stroke={COLOR_ESTADO[d.estado] || C.gris} strokeWidth="34"
            strokeDasharray={`${largo} ${circ}`} strokeDashoffset={-offset}
            transform="rotate(-90 120 120)" />
        )
        offset += largo
        return el
      })}
      <text x="120" y="116" textAnchor="middle" fontFamily="Archivo" fontSize="46" fontWeight="800" fill={C.tinta}>
        {total}
      </text>
      <text x="120" y="140" textAnchor="middle" fontFamily="Archivo" fontSize="15" fill={C.gris}>Activos</text>
    </svg>
  )
}

export default function Inicio({ onCalendario }) {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const sec = !verFinanzas(perfil)
  const [d, setD] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      resumenInventario(), estadoActivos(), serviciosMes(), mapaPuntos(),
      utilidadMensual().catch(() => []), actividadReciente(6).catch(() => []), notificaciones().catch(() => []),
      banosKpi().catch(() => ({})),
    ]).then(([resumen, estados, servicios, puntos, utilidad, actividad, avisos, banos]) => {
      setD({ resumen, estados, servicios, puntos, utilidad, actividad, avisos, banos })
    }).catch(setError)
  }, [])

  const ultimoMes = useMemo(() => {
    const u = d.utilidad || []
    return u[u.length - 1] || {}
  }, [d.utilidad])

  const r = d.resumen || {}
  const totalActivos = r.total_activos ?? 0

  const kpis = [
    { v: totalActivos, l: 'Activos totales', color: C.azul, tint: C.tinte, d: I.box },
    { v: r.total_disponibles ?? 0, l: 'Disponibles', color: C.verde, tint: '#e6f4ea', d: I.drop },
    { v: r.total_mantencion ?? 0, l: 'En mantención', color: C.amarillo, tint: '#fef7e0', d: I.wrench },
    { v: (d.servicios || []).reduce((s, x) => s + Number(x.cantidad), 0), l: 'Servicios del mes', color: C.azul, tint: C.tinte, d: I.clip },
    { v: millones(ultimoMes.ventas), l: 'Ventas del último mes', color: C.navy, tint: '#e8edf5', d: I.money },
    { v: millones(ultimoMes.utilidad), l: 'Utilidad del último mes', color: C.verde, tint: '#e6f4ea', d: I.chart },
  ]

  const kpisVista = sec
    ? [
      { v: d.banos?.disponibles ?? 0, l: 'Baños disponibles', color: C.verde, tint: '#e6f4ea', d: I.drop },
      { v: d.banos?.mantencion ?? 0, l: 'En mantención', color: C.amarillo, tint: '#fef7e0', d: I.wrench },
      kpis[3],
    ]
    : kpis

  const accesos = [
    { label: 'Ver inventario', d: I.box, to: '/inventario' },
    { label: 'Registrar activo', d: I.plus, to: '/inventario' },
    { label: 'Ver baños', d: I.drop, to: '/banos' },
    { label: 'Transporte', d: I.truck, to: '/transporte' },
    { label: 'Utilidades', d: I.money, to: '/utilidades' },
    { label: 'Reportes', d: I.chart, to: '/reportes' },
  ]

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 20,
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>
            ¡Hola{perfil?.nombre ? ', ' + perfil.nombre.split(' ')[0] : ''}!
          </h2>
          <p className="text-muted" style={{ margin: 0 }}>Resumen de la operación de FOSAN.</p>
        </div>
        <button className="btn" onClick={onCalendario}>
          <Icon d={I.cal} size={16} color={C.azul} />
          <span>Abrir calendario</span>
        </button>
      </div>

      <Aviso error={error} />

      <div className="kpis">
        {kpisVista.map((k) => (
          <div key={k.l} style={{
            background: '#fff', border: `2px solid ${C.borde}`, borderTop: `4px solid ${k.color}`,
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{
              width: 38, height: 38, flex: 'none', background: k.tint, color: k.color,
              display: 'grid', placeItems: 'center',
            }}>
              <Icon d={k.d} size={20} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: '800 26px/1 var(--font)', letterSpacing: '-.03em' }}>{k.v}</div>
              <div style={{ font: '400 12px/1.3 var(--font)', color: C.gris, marginTop: 5 }}>{k.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cols2" style={{ marginTop: 20 }}>
        {!sec && (
        <Seccion titulo="Estado de activos">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: 18 }}>
            <Donut datos={d.estados || []} total={totalActivos} />
            <div style={{ flex: 1, minWidth: 130, display: 'grid', gap: 11, justifyItems: 'start' }}>
              {(d.estados || []).map((e) => (
                <div key={e.estado} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{
                    width: 14, height: 14, flex: 'none', borderRadius: '50%',
                    background: COLOR_ESTADO[e.estado] || C.gris,
                  }} />
                  <span style={{ font: '800 17px var(--font)', letterSpacing: '-.02em', minWidth: 42 }}>
                    {e.porcentaje}%
                  </span>
                  <span style={{ font: '400 13px var(--font)', color: '#3c4551' }}>
                    {L_ESTADO_ACTIVO[e.estado] || e.estado}
                  </span>
                </div>
              ))}
              {(d.estados || []).length === 0 && (
                <span className="text-muted">Sin activos registrados todavía.</span>
              )}
            </div>
          </div>
        </Seccion>
        )}

        <Seccion titulo="Servicios · resumen del mes">
          <div style={{ maxHeight: 288, overflowY: 'auto' }}>
            {(d.servicios || []).map((s) => (
              <div key={s.tipo} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderBottom: `1px solid ${C.fila}`,
              }}>
                <span style={{
                  width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center',
                  background: '#eef3fb', color: COLOR_SERVICIO[s.tipo] || C.navy,
                }}>
                  <Icon d={ICONO_SERVICIO[s.tipo] || I.clip} size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13px/1.35 var(--font)' }}>{L_TIPO_SERVICIO[s.tipo] || s.tipo}</div>
                  <div style={{ font: '400 11px var(--font)', color: C.gris }}>Realizados este mes</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    font: '800 20px/1 var(--font)', letterSpacing: '-.02em',
                    color: COLOR_SERVICIO[s.tipo] || C.navy,
                  }}>{s.cantidad}</div>
                  <div style={{ font: '400 11px var(--font)', color: C.gris }}>servicios</div>
                </div>
              </div>
            ))}
            {(d.servicios || []).length === 0 && (
              <div style={{ padding: 18 }} className="text-muted">Sin servicios registrados este mes.</div>
            )}
          </div>
        </Seccion>
      </div>

      <div className="cols2" style={{ marginTop: 20 }}>
        {!sec && (
        <Seccion titulo="Actividad reciente">
          <div style={{ maxHeight: 288, overflowY: 'auto' }}>
            {(d.actividad || []).map((a) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px',
                borderBottom: `1px solid ${C.fila}`,
              }}>
                <span style={{
                  width: 30, height: 30, flex: 'none', background: '#eef3fb', color: C.azul,
                  display: 'grid', placeItems: 'center',
                }}>
                  <Icon d={I.box} size={16} />
                </span>
                <div style={{ font: '700 12px var(--font)', color: C.navy, minWidth: 62, paddingTop: 3 }}>
                  {a.activos?.codigo || '—'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 13px/1.35 var(--font)' }}>{L_MOVIMIENTO[a.tipo] || a.tipo}</div>
                  {a.detalle && (
                    <div style={{ font: '400 12px/1.45 var(--font)', color: '#3c4551', marginTop: 2 }}>
                      {a.detalle}
                    </div>
                  )}
                  <div style={{ font: '400 11px var(--font)', color: C.gris, marginTop: 2 }}>
                    {fechaHora(a.fecha)}{a.clientes?.nombre ? ' · ' + a.clientes.nombre : ''}
                  </div>
                </div>
              </div>
            ))}
            {(d.actividad || []).length === 0 && (
              <div style={{ padding: 18 }} className="text-muted">Todavía no hay movimientos registrados.</div>
            )}
          </div>
        </Seccion>
        )}

        <Seccion titulo="Alertas">
          <div style={{ maxHeight: 288, overflowY: 'auto' }}>
            {(d.avisos || []).slice(0, 8).map((a) => {
              const n = NIVEL[a.nivel] || NIVEL.info
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                  borderBottom: `1px solid ${C.fila}`,
                }}>
                  <span style={{
                    width: 30, height: 30, flex: 'none', background: n.tint, color: n.color,
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Icon d={n.d} size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px/1.35 var(--font)' }}>{a.texto}</div>
                    <div style={{ font: '400 11px var(--font)', color: C.gris }}>{fechaHora(a.creado_en)}</div>
                  </div>
                </div>
              )
            })}
            {(d.avisos || []).length === 0 && (
              <div style={{ padding: 18 }} className="text-muted">Sin alertas pendientes.</div>
            )}
          </div>
        </Seccion>
      </div>

      <div style={{ marginTop: 20 }}>
        <Seccion titulo="Ubicación de activos" extra={
          <button className="btn btn-azul" onClick={() => navegar('/ubicaciones')}
            style={{ minHeight: 36, padding: '8px 14px', font: '600 12px var(--font)' }}>
            Ver mapa completo →
          </button>
        }>
          <Mapa puntos={d.puntos || []} alto={320} />
          <Leyenda />
        </Seccion>
      </div>

      {!sec && (
      <div style={{ marginTop: 20 }}>
        <Seccion titulo="Accesos rápidos">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '16px 18px' }}>
            {accesos.map((a) => (
              <button key={a.label} className="btn" onClick={() => navegar(a.to)}>
                <Icon d={a.d} size={17} color={C.azul} />
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </Seccion>
      </div>
      )}
    </div>
  )
}
