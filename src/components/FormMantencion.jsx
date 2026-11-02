import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import { activosLista, crearMantencion, tiposMantencion } from '../lib/api'
import { C, Icon, I, L_CLASE_MANT, L_ESTADO_MANT } from '../lib/ui'
import { useSesion, esSecretaria } from '../lib/sesion'

const ESTADOS = ['programada', 'proxima', 'urgente', 'completada']
const TIPOS_EQUIPO = ['Mantención preventiva', 'Mantención correctiva', 'Reparación de puerta', 'Cambio de estanque', 'Revisión de bomba']
const TIPOS_FLOTA = ['Mantención preventiva', 'Mantención correctiva', 'Cambio de aceite', 'Revisión técnica', 'Cambio de neumáticos']

// La clase de la mantención sale del tipo del activo: ya no se elige a mano.
export const esFlota = (tipo) => tipo === 'camion' || tipo === 'camioneta'
export const claseDe = (tipo) => (tipo === 'bano_quimico' ? 'bano' : esFlota(tipo) ? tipo : 'equipo')

// ambito: 'equipos' (Inventario) · 'flota' (Transporte) · sin ambito = se deduce del activo inicial
export default function FormMantencion({ activoInicial = '', ambito, onCerrar, onGuardado }) {
  const [v, setV] = useState({
    activo_id: activoInicial, tipo: 'Mantención preventiva',
    fecha_programada: new Date().toISOString().slice(0, 10),
    responsable_ext: '', costo: '', estado: 'programada', detalle: '',
  })
  const [todos, setTodos] = useState([])
  const { perfil } = useSesion()
  const sec = esSecretaria(perfil)
  const [extra, setExtra] = useState([])
  const [otro, setOtro] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    activosLista().then(setTodos).catch(setError)
  }, [])
  const inicial = todos.find((a) => a.id === activoInicial)
  const flota = ambito ? ambito === 'flota' : esFlota(inicial?.tipo)
  useEffect(() => {
    tiposMantencion(flota ? ['camion', 'camioneta'] : ['bano', 'equipo']).then(setExtra).catch(() => {})
  }, [flota])
  const activos = useMemo(() => todos.filter((a) => esFlota(a.tipo) === flota), [todos, flota])
  const elegido = todos.find((a) => a.id === v.activo_id)
  const base = flota ? TIPOS_FLOTA : TIPOS_EQUIPO
  const [propios, setPropios] = useState([])
  const tipos = useMemo(() => [...new Set([...base, ...extra.filter((t) => !base.includes(t)).sort(), ...propios])], [base, extra, propios])
  const agregarTipo = () => {
    const t = (otro || '').trim()
    if (!t) return
    const nombre = t.charAt(0).toUpperCase() + t.slice(1)
    setPropios((p) => (p.includes(nombre) ? p : [...p, nombre]))
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
        clase: claseDe(elegido?.tipo),
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
    <Modal titulo={flota ? 'Nueva mantención de vehículo' : 'Nueva mantención de equipo'} onCerrar={onCerrar} pie={      <>
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
            <BuscarActivo activos={activos} valor={v.activo_id}
              onElegir={(id) => setV((p) => ({ ...p, activo_id: id }))} />
          </label>
          {elegido && (
            <div style={{ marginTop: -8, font: '400 12px var(--font)', color: C.gris }}>
              Clase: <b>{L_CLASE_MANT[claseDe(elegido.tipo)]}</b> (según el activo)
            </div>
          )}

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



// Buscador de activo por teclado: escribe parte del código, ↑ ↓ para moverte, Enter para elegir.
function BuscarActivo({ activos, valor, onElegir }) {
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [marca, setMarca] = useState(0)
  const ref = useRef(null)
  const elegido = activos.find((a) => a.id === valor)
  const res = useMemo(() => {
    const t = texto.trim().toLowerCase()
    return activos.filter((a) => !t || a.codigo.toLowerCase().includes(t)).slice(0, 30)
  }, [activos, texto])
  useEffect(() => { setMarca(0) }, [texto])
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const elegir = (a) => { onElegir(a.id); setTexto(''); setAbierto(false) }
  const tecla = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setMarca((m) => Math.min(m + 1, res.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarca((m) => Math.max(m - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (res[marca]) elegir(res[marca]) }
    else if (e.key === 'Escape' && abierto) { e.stopPropagation(); setAbierto(false) }
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input value={abierto ? texto : elegido ? elegido.codigo : texto}
        onFocus={() => { setAbierto(true); setTexto('') }}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
        onKeyDown={tecla} placeholder="Escribe el código, ej. BQ-03 o CAM-0" autoComplete="off" />
      {abierto && (
        <div role="listbox" style={{
          position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 5, maxHeight: 240, overflowY: 'auto',
          background: '#fff', border: `2px solid ${C.borde}`, borderTop: 0,
        }}>
          {res.length === 0 && <div style={{ padding: '10px 12px', color: C.gris, font: '400 13px var(--font)' }}>Sin coincidencias.</div>}
          {res.map((a, i) => (
            <div key={a.id} role="option" aria-selected={i === marca}
              onMouseDown={(e) => { e.preventDefault(); elegir(a) }} onMouseEnter={() => setMarca(i)}
              style={{
                padding: '9px 12px', cursor: 'pointer', font: '400 13px var(--font)',
                background: i === marca ? C.tinte : '#fff', fontWeight: a.id === valor ? 700 : 400,
              }}>{a.codigo}</div>
          ))}
        </div>
      )}
    </div>
  )
}