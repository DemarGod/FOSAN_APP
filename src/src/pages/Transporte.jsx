import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Listado from '../components/Listado'
import FormVehiculo from '../components/FormVehiculo'
import FormMantencion from '../components/FormMantencion'
import { vehiculos, parametros } from '../lib/api'
import { TIPOS_VEHICULO, costoKmVehiculo, mapaParametros } from '../lib/costos'
import { useSesion, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, I, L_ESTADO_ACTIVO, clp } from '../lib/ui'

const miles = (n, u) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-CL') + (u ? ' ' + u : ''))

export default function Transporte() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'transporte')
  const operar = puedeOperar(perfil, 'transporte')
  const finanzas = verFinanzas(perfil)

  const [datos, setDatos] = useState([])
  const [par, setPar] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)

  const cargar = () => {
    setCargando(true)
    Promise.all([vehiculos(), parametros()])
      .then(([v, p]) => { setDatos(v); setPar(mapaParametros(p)) })
      .catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((v) => ({
    ...v,
    id: v.activo_id,
    qr_token: v.activos?.qr_token,
    codigo: v.activos?.codigo || v.patente || '—',
    tipoL: TIPOS_VEHICULO[v.tipo_vehiculo] || 'Sin tipo',
    marcaL: [v.marca, v.modelo].filter(Boolean).join(' ') || '—',
    anioL: v.anio || '—',
    cargaL: v.capacidad_kg ? miles(v.capacidad_kg, 'kg') + (v.capacidad_banos ? ` · ${v.capacidad_banos} baños` : '') : '—',
    estanqueL: v.capacidad_litros ? miles(v.capacidad_litros, 'L') : '—',
    rendL: v.rend_vacio ? `${String(v.rend_vacio).replace('.', ',')} / ${String(v.rend_cargado ?? v.rend_vacio).replace('.', ',')}` : '—',
    kmL: miles(v.kilometraje, 'km'),
    costoKmL: (() => { const k = costoKmVehiculo(v, par).total; return k ? clp(Math.round(k)) + '/km' : '—' })(),
    estadoL: L_ESTADO_ACTIVO[v.activos?.estado] || '—',
  })).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))), [datos, par])

  const cuenta = (re) => filas.filter((f) => re.test(f.estadoL)).length

  return (
    <>
      <Listado
        titulo="Transporte"
        bajada="Vehículos de la flota con su ficha técnica y el costo por kilómetro que usan las rutas."
        accion={{ label: 'Agregar vehículo', onClick: () => setForm('nuevo'), disabled: !editable }}
        kpis={[
          { v: filas.length, l: 'Total' },
          { v: filas.length - cuenta(/Mantención|Fuera de servicio/), l: 'Operativos' },
          { v: cuenta(/Mantención/), l: 'En mantención' },
          { v: cuenta(/Fuera de servicio/), l: 'Fuera de servicio' },
        ]}
        cargando={cargando}
        error={error}
        unidad="vehículos"
        filtros={[{ k: 'tipoL', label: 'Tipo' }, { k: 'estadoL', label: 'Estado' }]}
        buscar={['codigo', 'patente', 'marcaL', 'tipoL']}
        cols={[
          { k: 'codigo', label: 'Código' },
          { k: 'tipoL', label: 'Tipo' },
          { k: 'marcaL', label: 'Marca y modelo' },
          { k: 'anioL', label: 'Año' },
          { k: 'cargaL', label: 'Capacidad' },
          { k: 'estanqueL', label: 'Estanque' },
          { k: 'rendL', label: 'km/L vacío / cargado' },
          { k: 'kmL', label: 'Kilometraje' },
          ...(finanzas ? [{ k: 'costoKmL', label: 'Costo por km' }] : []),
          { k: 'estadoL', label: 'Estado', badge: true },
        ]}
        datos={filas}
        onFila={(d) => editable && setForm(d)}
        acciones={(d) => [
          { t: 'Editar ficha técnica', d: I.lapiz, color: C.navy, disabled: !editable, onClick: () => setForm(d) },
          { t: 'Ver historial', d: I.ojo, color: C.azul, onClick: () => d.qr_token && navegar('/activo/' + d.qr_token) },
          { t: 'Registrar mantención', d: I.wrench, color: C.amarillo, disabled: !operar, onClick: () => setForm({ mantencion: d.id }) },
        ]}
        nota={finanzas ? 'El costo por km incluye diésel sin carga, desgaste y costos fijos. En cada ruta se ajusta según el peso.' : undefined}
      />

      {form && !form.mantencion && (
        <FormVehiculo vehiculo={form === 'nuevo' ? null : form}
          onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />
      )}
      {form?.mantencion && (
        <FormMantencion activoInicial={form.mantencion}
          onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />
      )}
    </>
  )
}
