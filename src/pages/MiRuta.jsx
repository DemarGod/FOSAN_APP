import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSesion, esOperador } from '../lib/sesion'
import { miRutaDeLaSemana, proximaRutaDe, lunesDe, diasDeRuta, operadores, DIAS_RUTA, SEMAFORO, fechaDia, diaCorto, etiquetaSemana } from '../lib/rutasSemana'
import { hoyISO, sumarDias } from '../lib/costos'
import { C } from '../lib/ui'
import { Cargando, Aviso } from '../components/Listado'
import DiaRuta, { Punto } from '../components/DiaRuta'

// Vista del operador: solo la ruta asignada para la semana en curso
export default function MiRuta() {
  const { usuario, perfil } = useSesion()
  const dueno = !!perfil && !esOperador(perfil)   // todo rol que no sea operador: "Ver como operador"
  const [ops, setOps] = useState([])
  const [verComo, setVerComo] = useState('')          // dueño: id del operador que se está mirando
  useEffect(() => { if (dueno) operadores().then(setOps).catch(() => {}) }, [dueno])
  const uid = (dueno && verComo) || perfil?.id || usuario?.id
  const hoy = hoyISO()
  const [semana, setSemana] = useState(null)
  const [rutaId, setRutaId] = useState(null)
  const [dias, setDias] = useState(null)
  const [dia, setDia] = useState(null)
  const [error, setError] = useState(null)
  const [salto, setSalto] = useState(0)              // 0 = esta semana, 1 = la siguiente…
  const [proxima, setProxima] = useState(null)       // lunes de la próxima semana con ruta

  useEffect(() => {
    setSemana(null); setRutaId(null); setDias(null)
    const ref = sumarDias(hoy, 7 * salto)
    miRutaDeLaSemana(uid, ref).then((s) => {
      setSemana(s)
      setRutaId(s.rutas[0]?.id || null)
      const n = new Date(hoy + 'T12:00:00').getDay()
      setDia(salto === 0 && n >= 1 && n <= 5 ? n : 1)
    }).catch(setError)
    if (uid) proximaRutaDe(uid, ref).then(setProxima).catch(() => setProxima(null))
  }, [uid, salto])
  useEffect(() => { setSalto(0) }, [uid])

  const cargar = () => (rutaId ? diasDeRuta(rutaId).then(setDias).catch(setError) : Promise.resolve())
  useEffect(() => { setDias(null); cargar() }, [rutaId])

  if (error) return <Aviso error={error} />

  // Aviso y selector para el dueño
  const panelDueno = dueno && (
    <div style={{ display: 'grid', gap: 10, padding: 14, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', background: '#fff' }}>
      <span style={{ font: '400 13px/1.5 var(--font)' }}>
        Recuerda: Mi ruta es la pantalla de cada operador. Para revisar y marcar <b>todas</b> las rutas usa{' '}
        <Link to="/operaciones?tab=rutas" style={{ color: C.azul, fontWeight: 600 }}>Operaciones → Rutas</Link>.
      </span>
      <label className="campo" style={{ maxWidth: 360 }}>
        <span>Ver como operador</span>
        <select value={verComo} onChange={(e) => setVerComo(e.target.value)}>
          <option value="">— Elegir operador —</option>
          {ops.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      </label>
      {verComo && <span style={{ font: '400 12px var(--font)', color: C.gris }}>Estás viendo exactamente lo que ve este operador. Lo que marques aquí queda registrado en su ruta real.</span>}
    </div>
  )
  if (!semana) return <div style={{ maxWidth: 760, display: 'grid', gap: 16 }}>{panelDueno}<Cargando /></div>

  const ruta = semana.rutas.find((r) => r.id === rutaId)
  const viajeDe = (n) => (dias || []).find((v) => v.fecha === fechaDia(semana.lunes, n))
  const viaje = viajeDe(dia)

  return (
    <div style={{ maxWidth: 760, display: 'grid', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, font: '800 24px/1.2 var(--font)', color: C.navy }}>Mi ruta</h1>
        <p style={{ margin: '4px 0 0', font: '400 13px var(--font)', color: C.gris }}>
          Semana del {etiquetaSemana(semana.lunes)}{ruta ? ` · ${ruta.nombre} · ${ruta.activos?.codigo || 'sin vehículo'}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button className="btn" onClick={() => setSalto((x) => x - 1)} disabled={salto <= -4}>← Semana anterior</button>
          {salto !== 0 && <button className="btn" onClick={() => setSalto(0)}>Esta semana</button>}
          <button className="btn" onClick={() => setSalto((x) => x + 1)} disabled={salto >= 8}>Semana siguiente →</button>
        </div>
      </div>
      {panelDueno}

      {semana.rutas.length === 0 && (
        <div style={{ padding: 18, border: `1px solid ${C.borde}`, background: '#fff', font: '400 14px/1.5 var(--font)', borderRadius: 'var(--radio-md)' }}>
          {dueno && verComo ? 'Este operador no tiene una ruta asignada esta semana.'
            : dueno && !perfil?.tieneRuta ? 'No tienes una ruta asignada esta semana. Para ver la de un operador, elígelo arriba en "Ver como operador".'
            : `No tienes una ruta asignada ${salto === 0 ? 'esta semana' : 'en esa semana'}. Cuando te asignen una, aparecerá aquí.`}
          {proxima && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-azul" onClick={() => setSalto(Math.round((new Date(proxima + 'T12:00:00') - new Date(lunesDe(hoy) + 'T12:00:00')) / 6048e5))}>
                Ver la próxima ruta: semana del {etiquetaSemana(proxima)}
              </button>
            </div>
          )}
        </div>
      )}

      {semana.rutas.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {semana.rutas.map((r) => (
            <button key={r.id} className={r.id === rutaId ? 'btn btn-azul' : 'btn'} onClick={() => setRutaId(r.id)}>{r.nombre}</button>
          ))}
        </div>
      )}

      {ruta?.notas && (
        <div style={{ padding: '10px 12px', background: C.suave, border: `1px solid ${C.borde}`, font: '400 13px/1.45 var(--font)', borderRadius: 'var(--radio-sm)' }}>{ruta.notas}</div>
      )}

      {ruta && !dias && <Cargando />}
      {ruta && dias && (
        <>
          {/* Días de la semana con su semáforo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 2, background: C.borde, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)' }}>
            {DIAS_RUTA.map((d) => {
              const v = viajeDe(d.v)
              const f = fechaDia(semana.lunes, d.v)
              const on = d.v === dia
              const c = (e) => (v ? v.paradas.filter((p) => p.estado === e).length : 0)
              return (
                <button key={d.v} onClick={() => setDia(d.v)} style={{
                  border: 0, cursor: 'pointer', padding: '8px 4px', minHeight: 64, display: 'grid', justifyItems: 'center', gap: 4,
                  background: on ? C.navy : '#fff', color: on ? '#fff' : C.navy,
                  borderBottom: f === hoy ? `3px solid ${C.verde}` : '3px solid transparent',
                }}>
                  <strong style={{ font: '700 14px var(--font)' }}>{d.l}</strong>
                  <span style={{ font: '400 11px var(--font)', opacity: 0.85 }}>{diaCorto(f)}</span>
                  {v ? (
                    <span style={{ display: 'flex', gap: 3 }}>
                      {['hecha', 'pendiente', 'no_realizada'].filter((e) => c(e)).map((e) => (
                        <span key={e} style={{ display: 'flex', alignItems: 'center', gap: 2, font: '700 10px var(--font)' }}><Punto color={SEMAFORO[e].c} />{c(e)}</span>
                      ))}
                    </span>
                  ) : <span style={{ font: '400 10px var(--font)', opacity: 0.6 }}>Libre</span>}
                </button>
              )
            })}
          </div>

          {viaje
            ? <DiaRuta key={viaje.id} viaje={viaje} editable={viaje.fecha <= hoy} onCambio={cargar} />
            : <div style={{ padding: 18, border: `1px solid ${C.borde}`, background: '#fff', font: '400 13px var(--font)', color: C.gris, borderRadius: 'var(--radio-md)' }}>Este día no tiene paradas.</div>}
        </>
      )}
    </div>
  )
}
