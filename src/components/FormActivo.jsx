import { useEffect, useState } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { modelos, ubicaciones, clientesLista, crearUbicacion } from '../lib/api'
import { C, Icon, I, L_TIPO_ACTIVO, L_ESTADO_ACTIVO, COLORES_BANO } from '../lib/ui'
import { limpiarCodigo, codigoValido, formatoPesos, numeroDe } from '../lib/validar'

const TIPOS = Object.keys(L_TIPO_ACTIVO)
const ESTADOS = ['disponible', 'en_arriendo', 'en_servicio', 'mantencion', 'fuera_de_servicio']

export default function FormActivo({ activoId = null, onCerrar, onGuardado }) {
  const [v, setV] = useState({
    codigo: '', tipo: 'bano_quimico', modelo_id: '', detalle: '', serie: '',
    estado: 'disponible', ubicacion_id: '', cliente_id: '',
    fecha_compra: '', valor_arriendo: '', notas: '', color: '',
    patente: '', marca: '', capacidad_litros: '', conductor: '',
  })
  const [cat, setCat] = useState({ modelos: [], ubicaciones: [], clientes: [] })
  const [nuevaUbic, setNuevaUbic] = useState('')
  const [mostrarNueva, setMostrarNueva] = useState(false)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([modelos(), ubicaciones(), clientesLista()])
      .then(([m, u, c]) => setCat({ modelos: m, ubicaciones: u, clientes: c }))
      .catch(setError)
    if (activoId) {
      supabase.from('activos').select('*').eq('id', activoId).single().then(({ data, error }) => {
        if (error) return setError(error)
        const t = (x) => (x === null || x === undefined ? '' : String(x))
        setV((p) => ({
          ...p, codigo: t(data.codigo), tipo: data.tipo, modelo_id: t(data.modelo_id), detalle: t(data.detalle),
          serie: t(data.serie), estado: data.estado, ubicacion_id: t(data.ubicacion_id), cliente_id: t(data.cliente_id),
          fecha_compra: t(data.fecha_compra), valor_arriendo: data.valor_arriendo ? formatoPesos(data.valor_arriendo) : '', notas: t(data.notas), color: t(data.color),
        }))
      })
    }
  }, [activoId])

  const set = (k, f) => (e) => setV((p) => ({ ...p, [k]: f ? f(e.target.value) : e.target.value }))
  const esVehiculo = v.tipo === 'camion' || v.tipo === 'camioneta'
  const esBano = v.tipo === 'bano_quimico'

  const agregarUbicacion = async () => {
    const n = nuevaUbic.trim()
    if (!n) return
    try {
      const u = await crearUbicacion(n)
      setCat((p) => ({ ...p, ubicaciones: [...p.ubicaciones, u] }))
      setV((p) => ({ ...p, ubicacion_id: u.id }))
      setNuevaUbic('')
      setMostrarNueva(false)
    } catch (e) { setError(e) }
  }

  const guardar = async () => {
    if (!v.codigo.trim()) { setError({ message: 'El código de la unidad es obligatorio.' }); return }
    if (!codigoValido(v.codigo)) { setError({ message: 'Código inválido: entre 2 y 10 letras o números, más guiones si quieres (ej. BQ-063).' }); return }
    if (esBano && !v.modelo_id) { setError({ message: 'Elige el modelo del baño.' }); return }
    setGuardando(true)
    setError(null)
    try {
      const fila = {
        codigo: v.codigo.trim(),
        tipo: v.tipo,
        modelo_id: esBano && v.modelo_id ? v.modelo_id : null,
        detalle: v.detalle || null,
        serie: v.serie || null,
        estado: v.estado,
        ubicacion_id: v.ubicacion_id || null,
        cliente_id: v.cliente_id || null,
        fecha_compra: v.fecha_compra || null,
        valor_arriendo: numeroDe(v.valor_arriendo),
        notas: v.notas || null,
        color: esBano && v.color.trim() ? v.color.trim().charAt(0).toUpperCase() + v.color.trim().slice(1).toLowerCase() : null,
      }
      if (activoId) {
        const { error: e0 } = await supabase.from('activos').update(fila).eq('id', activoId)
        if (e0) throw e0.code === '23505' ? new Error('Ya existe otra unidad con ese código.') : e0
        onGuardado()
        return
      }
      const { data, error: e1 } = await supabase.from('activos').insert(fila).select('id').single()
      if (e1) throw e1.code === '23505' ? new Error('Ya existe una unidad con ese código.') : e1

      if (esVehiculo && v.patente.trim()) {
        const { error: e2 } = await supabase.from('vehiculos').insert({
          activo_id: data.id,
          patente: v.patente.trim().toUpperCase(),
          marca: v.marca || null,
          capacidad_litros: v.capacidad_litros ? Number(v.capacidad_litros) : null,
          conductor: v.conductor || null,
        })
        if (e2) throw e2
      }
      onGuardado()
    } catch (e) {
      setError(e)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={activoId ? `Editar ${v.codigo || 'unidad'}` : 'Agregar activo'} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : activoId ? 'Guardar cambios' : 'Guardar unidad'}
        </button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <label className="campo">
            <span>Código de la unidad</span>
            <input value={v.codigo} onChange={(e) => setV((p) => ({ ...p, codigo: limpiarCodigo(e.target.value) }))} placeholder="BQ-063" />
            <em style={{ font: '400 11px var(--font)', color: C.gris, fontStyle: 'normal' }}>Máximo 10 letras o números; el guion no cuenta.</em>
          </label>

          <label className="campo">
            <span>Tipo</span>
            <select value={v.tipo} onChange={set('tipo')}>
              {TIPOS.map((t) => <option key={t} value={t}>{L_TIPO_ACTIVO[t]}</option>)}
            </select>
          </label>

          {esBano && (
            <label className="campo">
              <span>Modelo</span>
              <select value={v.modelo_id} onChange={set('modelo_id')}>
                <option value="">Elegir modelo…</option>
                {cat.modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Color</span>
              <input value={v.color} onChange={set('color')} list="colores-bano" maxLength={20} placeholder="Azul, verde…" />
              <datalist id="colores-bano">{COLORES_BANO.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          )}

          {!esBano && (
            <label className="campo">
              <span>Detalle</span>
              <input value={v.detalle} onChange={set('detalle')} placeholder="Aljibe 10.000 L" />
            </label>
          )}

          <label className="campo">
            <span>Estado inicial</span>
            <select value={v.estado} onChange={set('estado')}>
              {(esBano ? ['disponible', 'en_arriendo', 'en_limpieza', 'mantencion', 'fuera_de_servicio'] : esVehiculo ? ['disponible', 'en_servicio', 'mantencion', 'fuera_de_servicio'] : ESTADOS)
                .map((e) => <option key={e} value={e}>{L_ESTADO_ACTIVO[e]}</option>)}
            </select>
          </label>

          <label className="campo">
            <span>Ubicación</span>
            <select value={v.ubicacion_id} onChange={(e) => {
              if (e.target.value === '__nueva') { setMostrarNueva(true); return }
              setV((p) => ({ ...p, ubicacion_id: e.target.value }))
            }}>
              <option value="">Sin ubicación</option>
              {cat.ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              <option value="__nueva">+ Agregar nueva ubicación…</option>
            </select>
          </label>

          {mostrarNueva && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={nuevaUbic} onChange={(e) => setNuevaUbic(e.target.value)}
                placeholder="Nombre de la nueva ubicación (comuna o faena)"
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
            <span>Cliente asignado</span>
            <select value={v.cliente_id} onChange={set('cliente_id')}>
              <option value="">Sin asignar</option>
              {cat.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {esVehiculo && (
            <>
              <label className="campo">
                <span>Patente</span>
                <input value={v.patente} onChange={set('patente')} placeholder="ABCD-12" />
              </label>
              <label className="campo">
                <span>Marca</span>
                <input value={v.marca} onChange={set('marca')} placeholder="Hino 500" />
              </label>
              <label className="campo">
                <span>Capacidad (litros)</span>
                <input type="number" value={v.capacidad_litros} onChange={set('capacidad_litros')} placeholder="10000" />
              </label>
              <label className="campo">
                <span>Conductor</span>
                <input value={v.conductor} onChange={set('conductor')} placeholder="J. Torres" />
              </label>
            </>
          )}

          <label className="campo">
            <span>Fecha de incorporación</span>
            <input type="date" value={v.fecha_compra} onChange={set('fecha_compra')} />
          </label>

          <label className="campo">
            <span>Valor de arriendo mensual (CLP)</span>
            <input value={v.valor_arriendo} onChange={set('valor_arriendo', formatoPesos)} inputMode="numeric" placeholder="$45.000" />
          </label>

          <label className="campo">
            <span>Observaciones</span>
            <textarea rows={4} value={v.notas} onChange={set('notas')}
              placeholder="Estado de la unidad, accesorios, detalles del traslado…" />
          </label>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, background: C.suave,
            border: `2px solid ${C.borde}`, padding: '11px 13px',
          }}>
            <Icon d={I.qr} size={18} color={C.azul} />
            <span style={{ font: '400 12px/1.45 var(--font)', color: '#3c4551' }}>
              Al guardar se genera el código QR de la unidad para pegarlo en la cabina.
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
