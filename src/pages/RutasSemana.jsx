import { useEffect, useState } from 'react'
import { useSesion, esDueno } from '../lib/sesion'
import {
  rutasDeSemana, avanceSemana, operadores, porProgramar, borrarRutaSemana, duplicarRutaSemana, diasDeRuta,
  DIAS_RUTA, SEMAFORO, lunesDe, fechaDia, diaCorto, etiquetaSemana,
} from '../lib/rutasSemana'
import { sumarDias, hoyISO } from '../lib/costos'
import { C, Icon, I } from '../lib/ui'
import { Cargando, Aviso, Kpis } from '../components/Listado'
import Modal from '../components/Modal'
import FormRutaSemana from '../components/FormRutaSemana'
import DiaRuta, { Punto, Chip } from '../components/DiaRuta'

const miles = (n) => Number(n || 0).toLocaleString('es-CL')

// Planificación: rutas de lunes a viernes, una por operador y vehículo
export default function RutasSemana() {
  const { perfil } = useSesion()
  const planifica = esDueno(perfil) || perfil?.rol === 'administrador'
  const hoy = hoyISO()
  const [lunes, setLunes] = useState(lunesDe(hoy))
  const [rutas, setRutas] = useState(null)
  const [avance, setAvance] = useState([])
  const [ops, setOps] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [form, setForm] = useState(null)
  const [ver, setVer] = useState(null)
  const [error, setError] = useState(null)

  const cargar = () => Promise.all([rutasDeSemana(lunes), avanceSemana(lunes), porProgramar()])
    .then(([r, a, p]) => { setRutas(r); setAvance(a); setPendientes(p) }).catch(setError)
  useEffect(() => { setRutas(null); cargar() }, [lunes])
  useEffect(() => { operadores().then(setOps).catch(() => {}) }, [])

  const nombreOp = (id) => ops.find((o) => o.id === id)?.nombre || 'Sin operador'
  const accion = async (fn, ok) => {
    try { setError(null); await fn(); if (ok) ok(); await cargar() } catch (e) { setError(e) }
  }
  const eliminar = (r) => window.confirm(`¿Eliminar la ruta ${r.nombre} de la semana del ${etiquetaSemana(r.lunes)}?`) && accion(() => borrarRutaSemana(r.id))
  const copiar = (r) => window.confirm(`Se crea ${r.nombre} para la semana del ${etiquetaSemana(sumarDias(r.lunes, 7))} con las mismas limpiezas. Las entregas y retiros no se copian.`)
    && accion(() => duplicarRutaSemana(r), () => setLunes(sumarDias(r.lunes, 7)))

  const total = avance.reduce((s, v) => s + v.total, 0)
  const hechas = avance.reduce((s, v) => s + v.hechas, 0)
  const fallidas = avance.reduce((s, v) => s + v.fallidas, 0)
  const km = avance.reduce((s, v) => s + Number(v.km_real || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: '1 1 260px' }}>
          <h1 style={{ margin: 0, font: '800 24px/1.2 var(--font)', color: C.navy }}>Rutas semanales</h1>
          <p style={{ margin: '4px 0 0', font: '400 13px var(--font)', color: C.gris }}>
            Planifica cada semana quién visita a qué cliente y qué día. Cada operador ve solo su ruta de la semana en curso.
          </p>
        </div>
        {planifica && (
          <button className="btn btn-verde" onClick={() => setForm({})} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon d={I.plus} size={16} />Nueva ruta
          </button>
        )}
      </div>

      {/* Semana */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">‹</button>
        <strong style={{ font: '700 15px var(--font)', color: C.navy, minWidth: 170, textAlign: 'center' }}>Semana {etiquetaSemana(lunes)}</strong>
        <button className="btn" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">›</button>
        {lunes !== lunesDe(hoy) && <button className="btn" onClick={() => setLunes(lunesDe(hoy))}>Esta semana</button>}
      </div>

      <Kpis items={[
        { l: 'Rutas', v: rutas?.length ?? '—' },
        { l: 'Paradas', v: total },
        { l: 'Realizadas', v: hechas },
        { l: 'No se pudo', v: fallidas },
        { l: 'Km recorridos', v: miles(km) },
      ]} />
      <Aviso error={error} />

      {pendientes.length > 0 && (
        <div style={{ border: `2px solid ${C.amarillo}`, background: '#fffaf0', padding: '12px 14px', marginBottom: 16, display: 'grid', gap: 6 }}>
          <strong style={{ font: '700 13px var(--font)', color: C.navy }}>{pendientes.length} entrega(s) o retiro(s) sin ruta</strong>
          {pendientes.slice(0, 6).map((d) => (
            <span key={d.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', font: '400 12px var(--font)' }}>
              <Chip tarea={d.tipo} /><strong>{d.cliente}</strong><span style={{ color: C.gris }}>#{d.folio} · {d.banos || 'sin baños'}</span>
            </span>
          ))}
          <span style={{ font: '400 12px var(--font)', color: C.gris }}>Ábrelos desde “Editar planilla” de una ruta para asignarles un día.</span>
        </div>
      )}

      {!rutas ? <Cargando /> : rutas.length === 0 ? (
        <div style={{ padding: 22, border: `2px solid ${C.borde}`, background: '#fff', font: '400 14px/1.5 var(--font)' }}>
          No hay rutas para esta semana.{planifica && ' Crea una nueva o copia la de la semana anterior.'}
          {planifica && <div style={{ marginTop: 12 }}><button className="btn" onClick={() => setLunes(sumarDias(lunes, -7))}>Ver semana anterior</button></div>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {rutas.map((r) => {
            const dias = avance.filter((v) => v.ruta_semana_id === r.id)
            const kmR = dias.reduce((s, v) => s + Number(v.km_real || 0), 0)
            const comenzada = dias.some((v) => v.iniciada_en || v.estado !== 'planificada')
            return (
              <div key={r.id} style={{ border: `2px solid ${C.borde}`, background: '#fff' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `2px solid ${C.borde}` }}>
                  <span style={{ flex: '1 1 220px' }}>
                    <strong style={{ display: 'block', font: '700 16px var(--font)', color: C.navy }}>{r.nombre}</strong>
                    <span style={{ font: '400 12px var(--font)', color: C.gris }}>
                      {nombreOp(r.operador_id)} · {r.activos?.codigo || 'sin vehículo'} · {r.rutas_semana_lineas?.length || 0} cliente(s){kmR ? ` · ${miles(kmR)} km` : ''}
                    </span>
                  </span>
                  <button className="btn" onClick={() => setVer(r)}><Icon d={I.ojo} size={15} /> Ver avance</button>
                  {planifica && <button className="btn" onClick={() => setForm(r)}><Icon d={I.lapiz} size={15} /> Editar planilla</button>}
                  {planifica && <button className="btn" onClick={() => copiar(r)}>Copiar a la semana siguiente</button>}
                  {planifica && !comenzada && <button className="btn" onClick={() => eliminar(r)} style={{ color: C.rojo }}>Eliminar</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 1, background: C.fila }}>
                  {DIAS_RUTA.map((d) => {
                    const f = fechaDia(r.lunes, d.v)
                    const v = dias.find((x) => x.fecha === f)
                    const pend = v ? v.total - v.hechas - v.fallidas : 0
                    const est = !v ? 'Libre' : v.estado === 'cerrada' ? `Cerrado · ${miles(v.km_real)} km` : v.iniciada_en ? 'En ruta' : 'Sin iniciar'
                    return (
                      <div key={d.v} style={{ background: f === hoy ? C.tinte : '#fff', padding: '8px 10px', display: 'grid', gap: 4, minWidth: 0 }}>
                        <span style={{ font: '700 12px var(--font)', color: C.navy }}>{d.l} {diaCorto(f)}</span>
                        {v && (
                          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', font: '700 11px var(--font)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Punto color={SEMAFORO.hecha.c} />{v.hechas}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Punto color={SEMAFORO.pendiente.c} />{pend}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Punto color={SEMAFORO.no_realizada.c} />{v.fallidas}</span>
                          </span>
                        )}
                        <span style={{ font: '400 11px var(--font)', color: C.gris, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{est}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {form && <FormRutaSemana ruta={form.id ? form : null} lunes={lunes}
        enOtras={new Set((rutas || []).filter((x) => x.id !== form.id).flatMap((x) => (x.rutas_semana_lineas || []).filter((l) => l.tarea === 'limpieza').map((l) => l.cliente_id)))} onCerrar={() => setForm(null)} onGuardado={(s) => { setForm(null); if (s !== lunes) setLunes(s); else cargar() }} />}
      {ver && <Avance ruta={ver} operador={nombreOp(ver.operador_id)} puedeMarcar={planifica} onCerrar={() => { setVer(null); cargar() }} />}
    </div>
  )
}

// Avance de una ruta: los mismos días que ve el operador
function Avance({ ruta, operador, puedeMarcar, onCerrar }) {
  const hoy = hoyISO()
  const [dias, setDias] = useState(null)
  const [dia, setDia] = useState(null)
  const [error, setError] = useState(null)
  const cargar = () => diasDeRuta(ruta.id).then((d) => {
    setDias(d)
    setDia((x) => x || (d.find((v) => v.fecha === hoy) || d[0])?.fecha || null)
  }).catch(setError)
  useEffect(() => { cargar() }, [])
  const viaje = dias?.find((v) => v.fecha === dia)
  return (
    <Modal titulo={`${ruta.nombre} · ${operador} · semana ${etiquetaSemana(ruta.lunes)}`} ancho={780} onCerrar={onCerrar}>
      <div style={{ padding: 18, display: 'grid', gap: 14, background: C.suave }}>
        <Aviso error={error} />
        {!dias ? <Cargando /> : dias.length === 0 ? <span style={{ color: C.gris }}>Esta ruta no tiene días con paradas.</span> : (
          <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {dias.map((v) => {
                const d = DIAS_RUTA.find((x) => x.v === new Date(v.fecha + 'T12:00:00').getDay())
                return <button key={v.id} className={v.fecha === dia ? 'btn btn-azul' : 'btn'} onClick={() => setDia(v.fecha)}>{d?.largo} {diaCorto(v.fecha)}</button>
              })}
            </div>
            {viaje && <DiaRuta key={viaje.id} viaje={viaje} editable={puedeMarcar && viaje.fecha <= hoy} onCambio={cargar} />}
          </>
        )}
      </div>
    </Modal>
  )
}
