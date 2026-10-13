import { useEffect, useState } from 'react'
import Modal from './Modal'
import { activosLista, crearMantencion, tiposMantencion } from '../lib/api'
import { C, Icon, I, L_CLASE_MANT, L_ESTADO_MANT } from '../lib/ui'
import { useSesion, esSecretaria } from '../lib/sesion'

const CLASES = Object.keys(L_CLASE_MANT)
const ESTADOS = ['programada', 'proxima', 'urgente', 'completada']
const TIPOS = [
  'Mantención preventiva', 'Mantención correctiva', 'Reparación de puerta',
  'Cambio de estanque', 'Cambio de aceite', 'Revisión técnica',
  'Revisión de bomba', 'Cambio de neumáticos',
]

export default function FormMantencion({ activoInicial = '', onCerrar, onGuardado }) {
  const [v, setV] = useState({
    activo_id: activoInicial, clase: 'bano', tipo: TIPOS[0],
    fecha_programada: new Date().toISOString().slice(0, 10),
    responsable_ext: '', costo: '', estado: 'programada', detalle: '',
  })
  const [activos, setActivos] = useState([])
  const { perfil } = useSesion()
  const sec = esSecretaria(perfil)
  const [tipos, setTipos] = useState(TIPOS)
  const [otro, setOtro] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    activosLista().then(setActivos).catch(setError)
    tiposMantencion().then((extra) => setTipos([...TIPOS, ...extra.filter((t) => !TIPOS.includes(t)).sort()])).catch(() => {})
  }, [])
  const agregarTipo = () => {
    const t = (otro || '').trim()
    if (!t) return
    const nombre = t.charAt(0).toUpperCase() + t.slice(1)
    setTipos((p) => (p.includes(nombre) ? p : [...p, nombre]))
    setV((p) => ({ ...p, tipo: nombre }))
    setOtro(null)
  }

  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))

  const guardar = async () => {
    if (!v.activo_id) { setError({ message: 'Elige el activo al que corresponde la mantención.' }); return }
    if (otro !== null) { setError({ message: 'Termina de agregar el tipo "Otro" o cancélalo.' }); return }
    setGuardando(true)
    setError(null)
    try {
      await crearMantencion({
        activo_id: v.activo_id,
        clase: v.clase,
        tipo: v.tipo,
        fecha_programada: v.fecha_programada,
        fecha_realizada: v.estado === 'completada' ? v.fecha_programada : null,
        responsable_ext: v.responsable_ext || null,
        costo: v.costo ? Number(String(v.costo).replace(/\D/g, '')) : 0,
        estado: v.estado,
        detalle: v.detalle || null,
      })
      onGuardado()
    } catch (e) { setError(e); setGuardando(false) }
  }

  return (
    <Modal titulo="Nueva mantención" onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar mantención'}
        </button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="campo">
            <span>Activo</span>
            <select value={v.activo_id} onChange={set('activo_id')}>
              <option value="">Elegir unidad…</option>
              {activos.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
            </select>
          </label>

          <label className="campo">
            <span>Clase</span>
            <select value={v.clase} onChange={set('clase')}>
              {CLASES.map((c) => <option key={c} value={c}>{L_CLASE_MANT[c]}</option>)}
            </select>
          </label>

          <label className="campo">
            <span>Tipo de mantención</span>
            <select value={otro !== null ? '__otro' : v.tipo} onChange={(e) => {
              if (e.target.value === '__otro') { setOtro(''); return }
              setOtro(null); set('tipo')(e)
            }}>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__otro">Otro… (detallar)</option>
            </select>
          </label>
          {otro !== null && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={otro} onChange={(e) => setOtro(e.target.value.slice(0, 60))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTipo() } }}
                placeholder="¿Qué mantención es? Ej. Cambio de bisagras"
                style={{ flex: 1, minWidth: 0, border: `2px solid ${C.azul}`, background: '#fff', font: '400 13px var(--font)', padding: '10px 12px', minHeight: 44, outline: 'none' }} />
              <button type="button" className="btn btn-verde" onClick={agregarTipo} style={{ padding: '0 14px' }}>Agregar</button>
              <button type="button" className="btn" onClick={() => setOtro(null)} style={{ padding: '0 12px' }}>✕</button>
            </div>
          )}

          <label className="campo">
            <span>Fecha programada</span>
            <input type="date" value={v.fecha_programada} onChange={set('fecha_programada')} />
          </label>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="campo">
            <span>Responsable</span>
            <input value={v.responsable_ext} onChange={set('responsable_ext')}
              placeholder="M. López o taller externo" />
          </label>

          {!sec && (
            <label className="campo">
              <span>Costo (CLP)</span>
              <input value={v.costo} onChange={set('costo')} placeholder="38000" />
            </label>
          )}

          <label className="campo">
            <span>Estado</span>
            <select value={v.estado} onChange={set('estado')}>
              {ESTADOS.filter((e) => !(sec && e === 'completada')).map((e) => <option key={e} value={e}>{L_ESTADO_MANT[e]}</option>)}
            </select>
          </label>

          <label className="campo">
            <span>Detalle</span>
            <textarea rows={3} value={v.detalle} onChange={set('detalle')}
              placeholder="Qué se hizo o qué hay que revisar…" />
          </label>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: C.suave,
            border: `2px solid ${C.borde}`, padding: '11px 13px',
          }}>
            <Icon d={I.wrench} size={18} color={C.azul} />
            <span style={{ font: '400 12px/1.45 var(--font)', color: '#3c4551' }}>
              La mantención queda en el historial del activo y descuenta su disponibilidad
              mientras esté en taller.
            </span>
          </div>

          {error && (
            <div style={{
              padding: '11px 13px', background: '#fce8e6', border: `2px solid ${C.rojo}`,
              font: '400 12px/1.45 var(--font)', color: '#7c1405',
            }}>{String(error.message || error)}</div>
          )}
        </div>
      </div>
    </Modal>
  )
}
