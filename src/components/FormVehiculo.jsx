import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Campo } from './FormCliente'
import { guardarVehiculo } from '../lib/api'
import { TIPOS_VEHICULO } from '../lib/costos'
import { formatoPesos, numeroDe, decimalDe } from '../lib/validar'
import { C } from '../lib/ui'

const ANIO_MAX = new Date().getFullYear() + 1
const num = (x) => String(x ?? '').replace(/\D/g, '').slice(0, 9)
const dec = (x) => String(x ?? '').replace(/[^0-9.,]/g, '').slice(0, 6)
const pesos = (x) => (x === null || x === undefined ? '' : formatoPesos(x))

// Ficha técnica del vehículo: solo lo necesario para estimar desgaste y costo por uso.
export default function FormVehiculo({ vehiculo, onCerrar, onGuardado }) {
  const e = vehiculo || {}
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
    if (!v.codigo.trim()) { setError('El código es obligatorio (ej. CAM-05).'); return }
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
      }, {
        tipo_vehiculo: v.tipo_vehiculo,
        patente: v.patente.trim().toUpperCase() || null,
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
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar vehículo'}
        </button>
      </>
    }>
      <div className="cols2" style={{ gap: 18, padding: 18 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Titulo>Vehículo</Titulo>
          <div style={par}>
            <Campo l="Código"><input value={v.codigo} onChange={set('codigo')} maxLength={12} placeholder="CAM-05" /></Campo>
            <Campo l="Patente (opcional)"><input value={v.patente} onChange={set('patente')} maxLength={8} placeholder="ABCD12" /></Campo>
          </div>
          <Campo l="Tipo">
            <select value={v.tipo_vehiculo} onChange={set('tipo_vehiculo')}>
              {Object.entries(TIPOS_VEHICULO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
          <div style={par}>
            <Campo l="Marca"><input value={v.marca} onChange={set('marca')} maxLength={40} placeholder="Hino" /></Campo>
            <Campo l="Modelo"><input value={v.modelo} onChange={set('modelo')} maxLength={40} placeholder="500 FC" /></Campo>
          </div>
          <div style={par}>
            <Campo l="Año"><input value={v.anio} onChange={set('anio', (x) => num(x).slice(0, 4))} inputMode="numeric" placeholder="2019" /></Campo>
            <Campo l="Kilometraje actual"><input value={v.kilometraje} onChange={set('kilometraje', num)} inputMode="numeric" placeholder="184500" /></Campo>
          </div>
          <Titulo>Capacidad</Titulo>
          <div style={par}>
            <Campo l="Carga máxima (kg)"><input value={v.capacidad_kg} onChange={set('capacidad_kg', num)} inputMode="numeric" placeholder="3500" /></Campo>
            <Campo l="Baños que caben"><input value={v.capacidad_banos} onChange={set('capacidad_banos', (x) => num(x).slice(0, 3))} inputMode="numeric" placeholder="8" /></Campo>
          </div>
          {limpiafosas && (
            <Campo l="Estanque de residuos (L)"><input value={v.capacidad_litros} onChange={set('capacidad_litros', num)} inputMode="numeric" placeholder="4000" /></Campo>
          )}
        </div>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Titulo>Consumo</Titulo>
          <div style={par}>
            <Campo l="Rendimiento vacío (km/L)"><input value={v.rend_vacio} onChange={set('rend_vacio', dec)} inputMode="decimal" placeholder="7,5" /></Campo>
            <Campo l="Rendimiento cargado (km/L)"><input value={v.rend_cargado} onChange={set('rend_cargado', dec)} inputMode="decimal" placeholder="5,2" /></Campo>
          </div>
          <Titulo>Desgaste y costos</Titulo>
          <div style={par}>
            <Campo l="Valor de compra"><input value={v.valor_compra} onChange={set('valor_compra', formatoPesos)} inputMode="numeric" placeholder="$38.000.000" /></Campo>
            <Campo l="Vida útil (km)"><input value={v.vida_util_km} onChange={set('vida_util_km', num)} inputMode="numeric" placeholder="600000" /></Campo>
          </div>
          <Campo l="Mantención por km"><input value={v.costo_mant_km} onChange={set('costo_mant_km', formatoPesos)} inputMode="numeric" placeholder="$45" /></Campo>
          <div style={par}>
            <Campo l="Seguro + permiso + revisión (año)"><input value={v.costo_fijo_anual} onChange={set('costo_fijo_anual', formatoPesos)} inputMode="numeric" placeholder="$1.200.000" /></Campo>
            <Campo l="Km recorridos al año"><input value={v.km_anual} onChange={set('km_anual', num)} inputMode="numeric" placeholder="40000" /></Campo>
          </div>
          <div style={{
            padding: '11px 13px', background: C.suave, border: `2px solid ${C.borde}`,
            font: '400 12px/1.45 var(--font)', color: '#3c4551',
          }}>
            Con estos datos cada ruta calcula su costo: diésel según los km y el peso que lleva,
            más desgaste y costos fijos por kilómetro. Los campos vacíos cuentan como cero.
          </div>
          {error && (
            <div style={{ padding: '11px 13px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px/1.45 var(--font)', color: '#7c1405' }}>
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
  <div style={{ font: '700 12px var(--font)', color: '#1a3c72', borderBottom: `2px solid ${C.borde}`, paddingBottom: 6 }}>{children}</div>
)
