import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { ubicaciones, crearUbicacion } from '../lib/api'
import { C, L_ESTADO_ACTIVO } from '../lib/ui'

const ESTADOS = ['disponible','fuera_de_servicio']

function formatearNumero(texto) {
  const soloNumeros = String(texto || '').replace(/\D/g, '')
  if (!soloNumeros) return ''
  return Number(soloNumeros).toLocaleString('es-CL')
}

// Patente chilena: letras y números, sin espacios ni guion, en mayúsculas.
function formatearPatente(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

function formatearCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

export default function FormCamion({ onCerrar, onGuardado }) {
  const [v, setV] = useState({
    codigo: '', tipoVehiculo: 'camion', estado: 'disponible', ubicacion_id: '',
    patente: '', marca: '', modelo: '', anio: '', capacidadTexto: '',
    conductor: '', kilometrajeTexto: '',
    revision_tecnica: '', permiso_circulacion: '', seguro_obligatorio: '',
  })
  const [ubicacionesCat, setUbicacionesCat] = useState([])
  const [nuevaUbic, setNuevaUbic] = useState('')
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    ubicaciones().then(setUbicacionesCat).catch(setError)
  }, [])

  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))

  const agregarUbicacion = async () => {
    const n = nuevaUbic.trim()
    if (!n) return
    try {
      const u = await crearUbicacion(n, 'taller')
      setUbicacionesCat((p) => [...p, u])
      setV((p) => ({ ...p, ubicacion_id: u.id }))
      setNuevaUbic('')
      setMostrarNueva(false)
    } catch (e) { setError(e) }
  }

  const guardar = async () => {
    if (!v.codigo.trim()) { setError({ message: 'El código de la unidad es obligatorio.' }); return }
    if (!v.patente.trim()) { setError({ message: 'La patente es obligatoria.' }); return }
    setGuardando(true)
    setError(null)
    try {
      const { data, error: e1 } = await supabase.from('activos').insert({
        codigo: v.codigo.trim(),
        tipo: v.tipoVehiculo,
        estado: v.estado,
        ubicacion_id: v.ubicacion_id || null,
        notas: null,
      }).select('id').single()
      if (e1) throw e1

      const { error: e2 } = await supabase.from('vehiculos').insert({
        activo_id: data.id,
        patente: v.patente.trim(),
        marca: v.marca || null,
        modelo: v.modelo || null,
        anio: v.anio ? Number(v.anio) : null,
        capacidad_litros: v.capacidadTexto ? Number(v.capacidadTexto.replace(/\D/g, '')) : null,
        conductor: v.conductor || null,
        kilometraje: v.kilometrajeTexto ? Number(v.kilometrajeTexto.replace(/\D/g, '')) : null,
        revision_tecnica: v.revision_tecnica || null,
        permiso_circulacion: v.permiso_circulacion || null,
        seguro_obligatorio: v.seguro_obligatorio || null,
      })
      if (e2) throw e2

      onGuardado()
    } catch (e) {
      setError(e)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Agregar camión" onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar camión'}
        </button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="campo">
            <span>Código de la unidad</span>
            <input value={v.codigo} onChange={(e) => setV((p) => ({ ...p, codigo: formatearCodigo(e.target.value) }))}
              placeholder="CAM-06" />
          </label>

          <label className="campo">
            <span>Tipo de vehículo</span>
            <select value={v.tipoVehiculo} onChange={set('tipoVehiculo')}>
              <option value="camion">Camión</option>
              <option value="camioneta">Camioneta</option>
            </select>
          </label>

          <label className="campo">
            <span>Patente</span>
            <input value={v.patente} onChange={(e) => setV((p) => ({ ...p, patente: formatearPatente(e.target.value) }))}
              placeholder="ABCD12" />
          </label>

          <label className="campo">
            <span>Marca</span>
            <input value={v.marca} onChange={set('marca')} placeholder="Hino" />
          </label>

          <label className="campo">
            <span>Modelo</span>
            <input value={v.modelo} onChange={set('modelo')} placeholder="500 Serie FC" />
          </label>

          <label className="campo">
            <span>Año</span>
            <input type="number" value={v.anio} onChange={set('anio')} placeholder="2020" />
          </label>

          <label className="campo">
            <span>Estado inicial</span>
            <select value={v.estado} onChange={set('estado')}>
              {ESTADOS.map((e) => <option key={e} value={e}>{L_ESTADO_ACTIVO[e]}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="campo">
            <span>Capacidad (litros)</span>
            <input
              value={v.capacidadTexto}
              onChange={(e) => setV((p) => ({ ...p, capacidadTexto: formatearNumero(e.target.value) }))}
              inputMode="numeric" placeholder="10.000"
            />
          </label>

          <label className="campo">
            <span>Kilometraje actual</span>
            <input
              value={v.kilometrajeTexto}
              onChange={(e) => setV((p) => ({ ...p, kilometrajeTexto: formatearNumero(e.target.value) }))}
              inputMode="numeric" placeholder="85.000"
            />
          </label>

          <label className="campo">
            <span>Conductor</span>
            <input value={v.conductor} onChange={set('conductor')} placeholder="J. Torres" />
          </label>

          <label className="campo">
            <span>Ubicación</span>
            <select value={v.ubicacion_id} onChange={(e) => {
              if (e.target.value === '__nueva') { setMostrarNueva(true); return }
              setV((p) => ({ ...p, ubicacion_id: e.target.value }))
            }}>
              <option value="">Sin ubicación</option>
              {ubicacionesCat.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              <option value="__nueva">+ Agregar nueva ubicación…</option>
            </select>
          </label>

          {mostrarNueva && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nuevaUbic} onChange={(e) => setNuevaUbic(e.target.value)}
                placeholder="Nombre de la nueva ubicación"
                style={{
                  flex: 1, minWidth: 0, border: `2px solid ${C.azul}`, background: '#fff',
                  font: '400 13px var(--font)', padding: '10px 12px', minHeight: 44, outline: 'none',
                }} />
              <button className="btn btn-verde" onClick={agregarUbicacion} style={{ padding: '0 14px' }}>
                Agregar
              </button>
            </div>
          )}

          <label className="campo">
            <span>Revisión técnica (vencimiento)</span>
            <input type="date" value={v.revision_tecnica} onChange={set('revision_tecnica')} />
          </label>

          <label className="campo">
            <span>Permiso de circulación (vencimiento)</span>
            <input type="date" value={v.permiso_circulacion} onChange={set('permiso_circulacion')} />
          </label>

          <label className="campo">
            <span>Seguro obligatorio (vencimiento)</span>
            <input type="date" value={v.seguro_obligatorio} onChange={set('seguro_obligatorio')} />
          </label>

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