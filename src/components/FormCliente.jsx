import { useState } from 'react'
import Modal from './Modal'
import { crearCliente } from '../lib/api'
import { C, L_RUBRO } from '../lib/ui'

const RUBROS = Object.keys(L_RUBRO)

export default function FormCliente({ onCerrar, onGuardado }) {
  const [v, setV] = useState({
    nombre: '', rut: '', rubro: 'construccion', contacto_nombre: '', telefono: '',
    correo: '', direccion: '', comuna: 'Talca', lat: '', lng: '',
    fecha_inicio_contrato: '', fecha_fin_contrato: '', valor_mensual: '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))

  const guardar = async () => {
    if (!v.nombre.trim()) { setError({ message: 'El nombre de la empresa es obligatorio.' }); return }
    setGuardando(true)
    setError(null)
    try {
      await crearCliente({
        nombre: v.nombre.trim(),
        rut: v.rut || null,
        rubro: v.rubro,
        contacto_nombre: v.contacto_nombre || null,
        telefono: v.telefono || null,
        correo: v.correo || null,
        direccion: v.direccion || null,
        comuna: v.comuna || null,
        lat: v.lat ? Number(v.lat) : null,
        lng: v.lng ? Number(v.lng) : null,
        fecha_inicio_contrato: v.fecha_inicio_contrato || null,
        fecha_fin_contrato: v.fecha_fin_contrato || null,
        valor_mensual: v.valor_mensual ? Number(String(v.valor_mensual).replace(/\D/g, '')) : null,
      })
      onGuardado()
    } catch (e) { setError(e); setGuardando(false) }
  }

  return (
    <Modal titulo="Nuevo cliente" onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cliente'}
        </button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="campo">
            <span>Empresa</span>
            <input value={v.nombre} onChange={set('nombre')} placeholder="Constructora Andes" />
          </label>
          <label className="campo">
            <span>RUT</span>
            <input value={v.rut} onChange={set('rut')} placeholder="76.123.456-7" />
          </label>
          <label className="campo">
            <span>Rubro</span>
            <select value={v.rubro} onChange={set('rubro')}>
              {RUBROS.map((r) => <option key={r} value={r}>{L_RUBRO[r]}</option>)}
            </select>
          </label>
          <label className="campo">
            <span>Contacto</span>
            <input value={v.contacto_nombre} onChange={set('contacto_nombre')} placeholder="María Torres" />
          </label>
          <label className="campo">
            <span>Teléfono</span>
            <input value={v.telefono} onChange={set('telefono')} placeholder="+56 9 1234 5678" />
          </label>
          <label className="campo">
            <span>Correo</span>
            <input type="email" value={v.correo} onChange={set('correo')} placeholder="contacto@empresa.cl" />
          </label>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="campo">
            <span>Dirección</span>
            <input value={v.direccion} onChange={set('direccion')} placeholder="Camino a San Clemente km 8" />
          </label>
          <label className="campo">
            <span>Comuna</span>
            <input value={v.comuna} onChange={set('comuna')} placeholder="Talca" />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="campo">
              <span>Latitud</span>
              <input value={v.lat} onChange={set('lat')} placeholder="-35.4264" />
            </label>
            <label className="campo">
              <span>Longitud</span>
              <input value={v.lng} onChange={set('lng')} placeholder="-71.6554" />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="campo">
              <span>Inicio contrato</span>
              <input type="date" value={v.fecha_inicio_contrato} onChange={set('fecha_inicio_contrato')} />
            </label>
            <label className="campo">
              <span>Fin contrato</span>
              <input type="date" value={v.fecha_fin_contrato} onChange={set('fecha_fin_contrato')} />
            </label>
          </div>

          <label className="campo">
            <span>Valor mensual acordado (CLP)</span>
            <input value={v.valor_mensual} onChange={set('valor_mensual')} placeholder="540000" />
          </label>

          <div style={{
            padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`,
            font: '400 12px/1.45 var(--font)', color: '#3c4551',
          }}>
            Sin fecha de fin el contrato queda como indefinido. Las coordenadas son opcionales:
            sin ellas el cliente aparece como “sin georreferencia” en el mapa.
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
