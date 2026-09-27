import { useEffect, useMemo, useState } from 'react'
import Listado from '../components/Listado'
import FormMantencion from '../components/FormMantencion'
import { mantenciones, mantencionesKpi } from '../lib/api'
import { exportarVista } from '../lib/excel'
import { useSesion, puedeEditar, puedeOperar, verFinanzas } from '../lib/sesion'
import { I, L_CLASE_MANT, L_ESTADO_MANT, clp, fecha } from '../lib/ui'

const SEGMENTOS = [
  { v: 'todos', l: 'Todos', d: I.clip },
  { v: 'bano', l: 'Baños', d: I.drop },
  { v: 'flota', l: 'Camiones y camionetas', d: I.truck },
]

export default function Mantenciones() {
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil)
  const finanzas = verFinanzas(perfil)

  const [datos, setDatos] = useState([])
  const [kpi, setKpi] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seg, setSeg] = useState('todos')
  const [form, setForm] = useState(false)

  const cargar = () => {
    setCargando(true)
    Promise.all([mantenciones(), mantencionesKpi()])
      .then(([m, k]) => { setDatos(m); setKpi(k || {}) })
      .catch(setError)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((m) => ({
    ...m,
    activoL: m.activos?.codigo || '—',
    claseL: L_CLASE_MANT[m.clase] || m.clase,
    estadoL: L_ESTADO_MANT[m.estado] || m.estado,
    fechaL: fecha(m.fecha_programada),
    responsableL: m.perfiles?.nombre || m.responsable_ext || '—',
    costoL: clp(m.costo),
  })), [datos])

  const visibles = useMemo(() => {
    if (seg === 'bano') return filas.filter((f) => f.clase === 'bano')
    if (seg === 'flota') return filas.filter((f) => f.clase === 'camion' || f.clase === 'camioneta')
    return filas
  }, [filas, seg])

  return (
    <>
      <Listado
        titulo="Mantenciones"
        bajada="Programadas y realizadas sobre baños, camiones y equipos."
        accion={{ label: 'Nueva mantención', onClick: () => setForm(true), disabled: !editable }}
        exportar={finanzas ? () => exportarVista('export_mantenciones', 'Mantenciones') : undefined}
        segmentos={{ opciones: SEGMENTOS, valor: seg, onChange: setSeg }}
        kpis={[
          { v: kpi.del_mes ?? 0, l: 'Del mes' },
          { v: kpi.proximas ?? 0, l: 'Próximas' },
          { v: kpi.urgentes ?? 0, l: 'Urgentes' },
          { v: kpi.realizadas ?? 0, l: 'Realizadas' },
          ...(finanzas ? [{ v: clp(kpi.costo_realizado), l: 'Costo realizado' }] : []),
        ]}
        cargando={cargando}
        error={error}
        unidad="mantenciones"
        filtros={[
          { k: 'claseL', label: 'Clase' },
          { k: 'estadoL', label: 'Estado' },
          { k: 'responsableL', label: 'Responsable' },
        ]}
        buscar={['activoL', 'tipo', 'responsableL', 'detalle']}
        cols={[
          { k: 'activoL', label: 'Activo' },
          { k: 'claseL', label: 'Clase' },
          { k: 'tipo', label: 'Tipo' },
          { k: 'fechaL', label: 'Fecha' },
          { k: 'responsableL', label: 'Responsable' },
          ...(finanzas ? [{ k: 'costoL', label: 'Costo' }] : []),
          { k: 'estadoL', label: 'Estado', badge: true },
        ]}
        datos={visibles}
      />

      {form && (
        <FormMantencion onCerrar={() => setForm(false)} onGuardado={() => { setForm(false); cargar() }} />
      )}
    </>
  )
}
