import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Campo } from './Base'
import { guardarVehiculo } from '../lib/api'
import { TIPOS_VEHICULO, hoyISO } from '../lib/costos'
import { useSesion, verFinanzas } from '../lib/sesion'
import { formatoPesos, numeroDe, decimalDe, limpiarCodigo, codigoValido } from '../lib/validar'
import { C } from '../lib/ui'

const ANIO_MAX = new Date().getFullYear() + 1
const num = (x) => String(x ?? '').replace(/\D/g, '').slice(0, 9)
const dec = (x) => String(x ?? '').replace(/[^0-9.,]/g, '').slice(0, 6)
const pesos = (x) => (x === null || x === undefined ? '' : formatoPesos(x))

// Ficha técnica del vehículo: solo lo necesario para estimar desgaste y costo por uso.
export default function FormVehiculo({ vehiculo, onCerrar, onGuardado }) {
  const e = vehiculo || {}
  const nuevo = !e.activo_id
  const { perfil } = useSesion()
  const finanzas = verFinanzas(perfil)     // costos y rendimientos: solo con "Ver montos"
  const [extra, setExtra] = useState({
    fecha_registro: e.fecha_registro || hoyISO(), observaciones: e.observaciones || '', estado: 'disponible',
  })
  const [v, setV] = useState({
    codigo: e.activos?.codigo || '', tipo_vehiculo: e.tipo_vehiculo || 'camion_limpiafosas',
    patente: e.patente || '', marca: e.marca || '', modelo: e.modelo || '', anio: e.anio ?? '',
    capacidad_kg: e.capacidad_kg ?? '', capacidad_banos: e.capacidad_banos ?? '', capacidad_litros: e.capacidad_litros ?? '',
    rend_vacio: e.rend_vacio ?? '', rend_cargado: e.rend_cargado ?? '', kilometraje: e.kilometraje ?? '',
    valor_compra: pesos(e.valor_compra), vida_util_km: e.vida_util_km ?? '', costo_mant_km: pesos(e.costo_mant_km),
    costo_fijo_anual: pesos(e.costo_fijo_anual), km_anual: e.km_anual ?? '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { setError(null) }, [v])

  const set = (k, f) => (ev) => setV((p) => ({ ...p, [k]: f ? f(ev.target.value) : ev.target.value }))
  const limpiafosas = v.tipo_vehiculo === 'camion_limpiafosas'

  const guardar = async () => {
    if (!codigoValido(v.codigo)) { setError('Código inválido: entre 2 y 10 letras o números, más guiones (ej. CAM-05).'); return }
    const pat = v.patente.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!/^[A-Z0-9]{5,8}$/.test(pat)) { setError('Indica la patente (5 a 8 letras o números, ej. ABCD12).'); return }
    if (nuevo && v.kilometraje === '') { setError('Indica el odómetro inicial (km).'); return }
    if (!extra.fecha_registro || extra.fecha_registro > hoyISO()) { setError('La fecha de registro no puede ser futura.'); return }
    const anio = numeroDe(v.anio)
    if (anio && (anio < 1980 || anio > ANIO_MAX)) { setError(`Año entre 1980 y ${ANIO_MAX}.`); return }
    const rv = decimalDe(v.rend_vacio), rc = decimalDe(v.rend_cargado)
    if (rv && rc && rc > rv) { setError('El rendimiento cargado no puede ser mayor que vacío.'); return }
    setGuardando(true)
    try {
      await guardarVehiculo(e.activo_id, {
        codigo: v.codigo.trim().toUpperCase(),
        tipo: v.tipo_vehiculo === 'camioneta' ? 'camioneta' : 'camion',
        detalle: TIPOS_VEHICULO[v.tipo_vehiculo],
        ...(nuevo ? { estado: extra.estado } : {}),
      }, {
        fecha_registro: extra.fecha_registro, observaciones: extra.observaciones.trim() || null,
        tipo_vehiculo: v.tipo_vehiculo,
        patente: pat,
        marca: v.marca.trim() || null, modelo: v.modelo.trim() || null, anio,
        capacidad_kg: numeroDe(v.capacidad_kg), capacidad_banos: numeroDe(v.capacidad_banos),
        capacidad_litros: limpiafosas ? numeroDe(v.capacidad_litros) : null,
        rend_vacio: rv, rend_cargado: rc, kilometraje: numeroDe(v.kilometraje),
        valor_compra: numeroDe(v.valor_compra), vida_util_km: numeroDe(v.vida_util_km),
        costo_mant_km: numeroDe(v.costo_mant_km), costo_fijo_anual: numeroDe(v.costo_fijo_anual),
        km_anual: numeroDe(v.km_anual),
      })
      onGuardado()
    } catch (x) {
      setError(x.code === '23505' ? 'Ya existe un vehículo con ese código o patente.' : String(x.message || x))
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={e.activo_id ? 'Editar vehículo' : 'Agregar vehículo'} ancho={900} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-azul" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar vehículo'}
        </button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Titulo>Vehículo</Titulo>
          <div style={par}>
            <Campo etiqueta="Código"><input value={v.codigo} onChange={set('codigo', limpiarCodigo)} placeholder="CAM-05" /></Campo>
            <Campo etiqueta="Patente *"><input value={v.patente} onChange={set('patente')} maxLength={10} placeholder="ABCD12" /></Campo>
          </div>
          <Campo etiqueta="Tipo">
            <select value={v.tipo_vehiculo} onChange={set('tipo_vehiculo')}>
              {Object.entries(TIPOS_VEHICULO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
          <div style={par}>
            <Campo etiqueta="Marca"><input value={v.marca} onChange={set('marca')} maxLength={40} placeholder="Hino" /></Campo>
            <Campo etiqueta="Modelo"><input value={v.modelo} onChange={set('modelo')} maxLength={40} placeholder="500 FC" /></Campo>
          </div>
          <div style={par}>
            <Campo etiqueta="Año"><input value={v.anio} onChange={set('anio', (x) => num(x).slice(0, 4))} inputMode="numeric" placeholder="2019" /></Campo>
            <Campo etiqueta={nuevo ? 'Odómetro inicial (km) *' : 'Odómetro (km)'}><input value={v.kilometraje} onChange={set('kilometraje', num)} inputMode="numeric" placeholder="184500" /></Campo>
          </div>
          <Titulo>Capacidad</Titulo>
          <div style={par}>
            <Campo etiqueta="Carga máxima (kg)"><input value={v.capacidad_kg} onChange={set('capacidad_kg', num)} inputMode="numeric" placeholder="3500" /></Campo>
            <Campo etiqueta="Baños que caben"><input value={v.capacidad_banos} onChange={set('capacidad_banos', (x) => num(x).slice(0, 3))} inputMode="numeric" placeholder="8" /></Campo>
          </div>
          {limpiafosas && (
            <Campo etiqueta="Estanque de residuos (L)"><input value={v.capacidad_litros} onChange={set('capacidad_litros', num)} inputMode="numeric" placeholder="4000" /></Campo>
          )}
          <Titulo>Registro</Titulo>
          <div style={par}>
            <Campo etiqueta="Fecha de registro *"><input type="date" value={extra.fecha_registro} max={hoyISO()} onChange={(ev) => setExtra((p) => ({ ...p, fecha_registro: ev.target.value }))} /></Campo>
            {nuevo && (
              <Campo etiqueta="Estado inicial *">
                <select value={extra.estado} onChange={(ev) => setExtra((p) => ({ ...p, estado: ev.target.value }))}>
                  <option value="disponible">Disponible</option>
                  <option value="mantencion">En mantenimiento</option>
                  <option value="fuera_de_servicio">Fuera de servicio</option>
                </select>
              </Campo>
            )}
          </div>
          <Campo etiqueta="Observaciones"><textarea value={extra.observaciones} onChange={(ev) => setExtra((p) => ({ ...p, observaciones: ev.target.value }))} maxLength={500} style={{ minHeight: 60 }} placeholder="Vehículo incorporado en buen estado." /></Campo>
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {finanzas ? <>
          <Titulo>Consumo</Titulo>
          <div style={par}>
            <Campo etiqueta="Rendimiento vacío (km/L)"><input value={v.rend_vacio} onChange={set('rend_vacio', dec)} inputMode="decimal" placeholder="7,5" /></Campo>
            <Campo etiqueta="Rendimiento cargado (km/L)"><input value={v.rend_cargado} onChange={set('rend_cargado', dec)} inputMode="decimal" placeholder="5,2" /></Campo>
          </div>
          <Titulo>Desgaste y costos</Titulo>
          <div style={par}>
            <Campo etiqueta="Valor de compra"><input value={v.valor_compra} onChange={set('valor_compra', formatoPesos)} inputMode="numeric" placeholder="$38.000.000" /></Campo>
            <Campo etiqueta="Vida útil (km)"><input value={v.vida_util_km} onChange={set('vida_util_km', num)} inputMode="numeric" placeholder="600000" /></Campo>
          </div>
          <Campo etiqueta="Mantención por km"><input value={v.costo_mant_km} onChange={set('costo_mant_km', formatoPesos)} inputMode="numeric" placeholder="$45" /></Campo>
          <div style={par}>
            <Campo etiqueta="Seguro + permiso + revisión (año)"><input value={v.costo_fijo_anual} onChange={set('costo_fijo_anual', formatoPesos)} inputMode="numeric" placeholder="$1.200.000" /></Campo>
            <Campo etiqueta="Km recorridos al año"><input value={v.km_anual} onChange={set('km_anual', num)} inputMode="numeric" placeholder="40000" /></Campo>
          </div>
          <div style={{
            padding: '11px 13px', background: C.suave, border: `1px solid ${C.borde}`,
            font: '400 12px/1.45 var(--font)', color: '#3c4551', borderRadius: 'var(--radio-md)' }}>
            Con estos datos cada ruta calcula su costo: diésel según los km y el peso que lleva,
            más desgaste y costos fijos por kilómetro. Los campos vacíos cuentan como cero.
          </div>
          </> : (
            <div style={{ padding: '11px 13px', background: C.suave, border: `1px solid ${C.borde}`, font: '400 12px/1.45 var(--font)', color: '#3c4551', borderRadius: 'var(--radio-md)' }}>
              Patente única: se guarda en mayúsculas y sin guiones ni espacios. Rendimiento y costos los completa quien tiene permiso "Ver montos".
            </div>
          )}
          {error && (
            <div style={{ padding: '11px 13px', background: '#fce8e6', border: `1px solid ${C.rojo}`, font: '400 12px/1.45 var(--font)', color: '#7c1405', borderRadius: 'var(--radio-md)' }}>
              {String(error?.message || error)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const par = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }
const Titulo = ({ children }) => (
  <div style={{ font: '700 12px var(--font)', color: '#1a3c72', borderBottom: `1px solid ${C.borde}`, paddingBottom: 6 }}>{children}</div>
)
