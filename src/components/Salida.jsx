import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Campo } from './FormCliente'
import { paradasDe, despachosDeSalida, actualizarSalida, marcarParada, vehiculos } from '../lib/api'
import { costoSalida } from '../lib/costos'
import { C, Icon, I, clp, fecha } from '../lib/ui'

const kg = (n) => (n ? Math.round(n).toLocaleString('es-CL') + ' kg' : '0 kg')
const num = (x) => String(x ?? '').replace(/\D/g, '').slice(0, 8)

// Detalle de una salida: km estimado → real, paradas hechas y costo calculado.
export default function Salida({ salida, par, editable, verCostos = true, onCerrar, onCambio }) {
  const s = salida
  const [paradas, setParadas] = useState([])
  const [desp, setDesp] = useState([])
  const [flota, setFlota] = useState([])
  const [km, setKm] = useState(s.km_estimado ?? '')
  const [odoS, setOdoS] = useState(s.odometro_salida ?? s.kilometraje ?? '')
  const [odoL, setOdoL] = useState(s.odometro_llegada ?? '')
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    Promise.all([paradasDe(s.id), despachosDeSalida(s.id), vehiculos()])
      .then(([p, d, f]) => { setParadas(p); setDesp(d); setFlota(f) }).catch(setError)
  }, [s.id])

  const cerrada = s.estado !== 'planificada'
  const kmReal = odoS !== '' && odoL !== '' ? Number(odoL) - Number(odoS) : null
  const c = costoSalida({ ...s, km: kmReal ?? (km === '' ? null : Number(km)) }, par)

  const guardar = async (cambios, msg) => {
    setError(null)
    try { await actualizarSalida(s.id, cambios); setAviso(msg); onCambio() } catch (e) { setError(String(e.message || e)) }
  }
  const guardarKm = () => guardar({ km_estimado: km === '' ? null : Number(km) }, 'Km estimado guardado.')
  const cerrar = () => {
    if (odoS === '' || odoL === '') return setError('Ingresa el odómetro de salida y de llegada.')
    if (Number(odoL) <= Number(odoS)) return setError('El odómetro de llegada debe ser mayor que el de salida.')
    guardar({ odometro_salida: Number(odoS), odometro_llegada: Number(odoL), estado: 'cerrada' }, 'Salida cerrada con km reales.')
  }
  const alternar = async (p) => {
    try {
      await marcarParada(p.id, !p.hecha)
      setParadas((q) => q.map((x) => (x.id === p.id ? { ...x, hecha: !p.hecha } : x)))
      onCambio()
    } catch (e) { setError(String(e.message || e)) }
  }

  return (
    <Modal titulo={`${s.ruta} · ${fecha(s.fecha)}`} ancho={920} onCerrar={onCerrar} pie={
      <>
        {editable && !cerrada && <button className="btn" onClick={() => guardar({ estado: 'cancelada' }, 'Salida cancelada.')} style={{ color: C.rojo, marginRight: 'auto' }}>Cancelar salida</button>}
        <button className="btn" onClick={onCerrar}>Cerrar</button>
        {editable && <button className="btn btn-verde" onClick={cerrar}>{cerrada ? 'Actualizar km reales' : 'Cerrar salida con km reales'}</button>}
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Campo l="Vehículo">
            <select value={s.vehiculo_id || ''} disabled={!editable || cerrada}
              onChange={(e) => guardar({ vehiculo_id: e.target.value || null }, 'Vehículo actualizado.')}>
              <option value="">Sin asignar</option>
              {flota.map((f) => {
                const taller = ['mantencion', 'fuera_de_servicio', 'baja'].includes(f.activos?.estado)
                return <option key={f.activo_id} value={f.activo_id} disabled={taller}>{f.activos?.codigo}{taller ? ' · en mantención' : ''}</option>
              })}
            </select>
          </Campo>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
            <Campo l="Km estimado del día">
              <input value={km} onChange={(e) => setKm(num(e.target.value))} inputMode="numeric" disabled={!editable}
                placeholder={s.km_real ? '' : 'Sin historial: estima los km'} />
            </Campo>
            {editable && <button className="btn" onClick={guardarKm}>Guardar</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <Campo l="Odómetro al salir"><input value={odoS} onChange={(e) => setOdoS(num(e.target.value))} inputMode="numeric" disabled={!editable} /></Campo>
            <Campo l="Odómetro al volver"><input value={odoL} onChange={(e) => setOdoL(num(e.target.value))} inputMode="numeric" disabled={!editable} /></Campo>
          </div>
          <div style={{ font: '400 12px/1.45 var(--font)', color: C.gris }}>
            {kmReal !== null ? `Km reales: ${kmReal}. Reemplazan al estimado.` : 'Mientras no se cierre, el costo usa el km estimado (promedio real de esta ruta).'}
          </div>

          <div className="campo">
            <span>Paradas ({paradas.filter((p) => p.hecha).length}/{paradas.length} hechas)</span>
            <div style={{ border: `2px solid ${C.borde}` }}>
              {paradas.length === 0 && <div style={{ padding: 12, font: '400 12px var(--font)', color: C.gris }}>Sin paradas.</div>}
              {paradas.map((p) => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.fila}`, cursor: editable ? 'pointer' : 'default', background: p.hecha ? C.tinte : '#fff' }}>
                  <input type="checkbox" checked={p.hecha} disabled={!editable} onChange={() => alternar(p)} style={{ width: 18, height: 18, accentColor: C.navy }} />
                  <span style={{ font: '700 12px var(--font)', color: C.navy, width: 18 }}>{p.orden}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', font: '600 13px var(--font)' }}>{p.clientes?.nombre}</span>
                    <span style={{ display: 'block', font: '400 11px var(--font)', color: C.gris }}>
                      {[p.clientes?.direccion, p.clientes?.comuna].filter(Boolean).join(', ') || 'Sin dirección'}
                    </span>
                  </span>
                  <span style={{ font: '400 12px var(--font)', color: C.gris, whiteSpace: 'nowrap' }}>
                    {p.tarea === 'limpieza' ? `Limpieza · ${p.banos} baño(s)` : p.tarea === 'entrega' ? 'Entrega' : 'Retiro'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {verCostos && <div className="campo">
            <span>Costo {s.km_real || kmReal !== null ? 'real' : 'estimado'}</span>
            <div style={{ border: `2px solid ${C.borde}` }}>
              <Fila k={`Diésel · ${c.litrosDiesel.toFixed(1).replace('.', ',')} L a ${c.rend ? c.rend.toFixed(1).replace('.', ',') : '—'} km/L`} v={clp(Math.round(c.combustible))} />
              <Fila k="Desgaste y mantención" v={clp(Math.round(c.desgaste))} />
              <Fila k="Seguro, permiso y revisión" v={clp(Math.round(c.fijos))} />
              <Fila k={`Total · ${c.km} km`} v={clp(Math.round(c.total))} fuerte />
            </div>
          </div>}
          <div className="campo">
            <span>Carga</span>
            <div style={{ border: `2px solid ${C.borde}` }}>
              <Fila k={`Baños transportados (${s.banos_transportados})`} v={kg(c.pesoBanos)} />
              <Fila k={`Residuo de ${s.banos_limpieza} limpieza(s)${c.litrosResiduo != null ? ` · ${Math.round(c.litrosResiduo)} L` : ''}`} v={c.pesoResiduo == null ? '—' : kg(c.pesoResiduo)} />
              <Fila k={`Total${s.capacidad_kg ? ` · ${Math.round(c.factor * 100)}% de la capacidad` : ''}`} v={kg(c.pesoTotal)} fuerte />
            </div>
          </div>
          {(c.excedeCarga || c.excedeEstanque || c.excedeBanos) && (
            <Alerta color={C.rojo} tint="#fce8e6">
              {[c.excedeCarga && 'supera la carga máxima', c.excedeEstanque && 'supera el estanque de residuos', c.excedeBanos && 'lleva más baños de los que caben'].filter(Boolean).join(', ')}.
            </Alerta>
          )}
          {c.faltan.length > 0 && (
            <Alerta color={C.amarillo} tint="#fef7e0">Para un costo más exacto falta: {c.faltan.join(', ')}.</Alerta>
          )}
          <div className="campo">
            <span>Despachos en esta salida ({desp.length})</span>
            <div style={{ border: `2px solid ${C.borde}` }}>
              {desp.length === 0 && <div style={{ padding: 12, font: '400 12px var(--font)', color: C.gris }}>Ninguno. Se asignan desde Despachos.</div>}
              {desp.map((d) => <Fila key={d.id} k={`${d.folio} · ${d.tipo} · ${d.cliente}`} v={d.banos || '—'} />)}
            </div>
          </div>
          {aviso && !error && <div style={{ font: '600 12px var(--font)', color: C.verde }}>{aviso}</div>}
          {error && <Alerta color={C.rojo} tint="#fce8e6">{String(error?.message || error)}</Alerta>}
        </div>
      </div>
    </Modal>
  )
}

const Fila = ({ k, v, fuerte }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', borderBottom: `1px solid ${C.fila}`, background: fuerte ? C.suave : '#fff' }}>
    <span style={{ font: `${fuerte ? 700 : 400} 12px/1.4 var(--font)` }}>{k}</span>
    <span style={{ font: `${fuerte ? 800 : 600} 13px var(--font)`, whiteSpace: 'nowrap' }}>{v}</span>
  </div>
)
const Alerta = ({ color, tint, children }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: tint, border: `2px solid ${color}`, font: '400 12px/1.45 var(--font)', color: '#3c2a00' }}>
    <Icon d={I.alert} size={16} color={color} /><span>{children}</span>
  </div>
)
