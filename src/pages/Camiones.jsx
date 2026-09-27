import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Listado from '../components/Listado'
import FormActivo from '../components/FormActivo'
import FormMantencion from '../components/FormMantencion'
import { vehiculos } from '../lib/api'
import { useSesion, puedeEditar } from '../lib/sesion'
import { C, I, L_ESTADO_ACTIVO, fecha } from '../lib/ui'

export default function Camiones() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeEditar(perfil)

  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)

  const cargar = () => {
    setCargando(true)
    vehiculos().then(setDatos).catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((v) => ({
    id: v.activos?.id,
    qr_token: v.activos?.qr_token,
    codigo: v.activos?.codigo || v.patente,
    patente: v.patente,
    marca: v.marca || '—',
    capacidadL: v.capacidad_litros ? v.capacidad_litros.toLocaleString('es-CL') + ' L' : '—',
    estadoL: L_ESTADO_ACTIVO[v.activos?.estado] || '—',
    conductor: v.conductor || '—',
    ubicacionL: v.activos?.ubicaciones?.nombre || 'Sin ubicación',
    revisionL: fecha(v.revision_tecnica),
    permisoL: fecha(v.permiso_circulacion),
  })), [datos])

  const cuenta = (re) => filas.filter((f) => re.test(f.estadoL)).length

  return (
    <>
      <Listado
        titulo="Camiones"
        bajada="Flota de limpiafosas y camionetas, con patente y documentación al día."
        accion={{ label: 'Agregar camión', onClick: () => setForm('activo'), disabled: !editable }}
        kpis={[
          { v: filas.length, l: 'Total' },
          { v: cuenta(/En servicio|En arriendo/), l: 'En servicio' },
          { v: cuenta(/Mantención/), l: 'Mantención' },
          { v: cuenta(/Fuera de servicio/), l: 'Fuera de servicio' },
        ]}
        cargando={cargando}
        error={error}
        unidad="vehículos"
        filtros={[
          { k: 'estadoL', label: 'Estado' },
          { k: 'conductor', label: 'Conductor' },
          { k: 'ubicacionL', label: 'Ubicación' },
        ]}
        buscar={['codigo', 'patente', 'marca', 'conductor', 'ubicacionL']}
        cols={[
          { k: 'codigo', label: 'Código' },
          { k: 'patente', label: 'Patente' },
          { k: 'marca', label: 'Marca' },
          { k: 'capacidadL', label: 'Capacidad' },
          { k: 'estadoL', label: 'Estado', badge: true },
          { k: 'conductor', label: 'Conductor' },
          { k: 'ubicacionL', label: 'Ubicación' },
          { k: 'revisionL', label: 'Revisión técnica' },
          { k: 'permisoL', label: 'Permiso circulación' },
        ]}
        datos={filas}
        onFila={(d) => d.qr_token && navegar('/activo/' + d.qr_token)}
        acciones={(d) => [
          {
            t: 'Ver ficha', d: I.ojo, color: C.azul,
            onClick: () => d.qr_token && navegar('/activo/' + d.qr_token),
          },
          {
            t: 'Registrar mantención', d: I.wrench, color: C.amarillo, disabled: !editable,
            onClick: () => setForm({ tipo: 'mantencion', activo: d.id }),
          },
        ]}
      />

      {form === 'activo' && (
        <FormActivo onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />
      )}
      {form?.tipo === 'mantencion' && (
        <FormMantencion activoInicial={form.activo}
          onCerrar={() => setForm(null)} onGuardado={() => setForm(null)} />
      )}
    </>
  )
}
