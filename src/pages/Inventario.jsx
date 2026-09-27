import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Listado from '../components/Listado'
import FormActivo from '../components/FormActivo'
import FormMantencion from '../components/FormMantencion'
import { inventario, resumenInventario } from '../lib/api'
import { exportarVista } from '../lib/excel'
import { useSesion, puedeEditar } from '../lib/sesion'
import { C, I, L_TIPO_ACTIVO, L_ESTADO_ACTIVO, clp, fecha } from '../lib/ui'

const SEGMENTOS = [
  { v: 'todos', l: 'Todos', d: I.clip },
  { v: 'bodega', l: 'En bodega', d: I.box },
  { v: 'terreno', l: 'En terreno', d: I.pin },
  { v: 'mantencion', l: 'Mantención', d: I.gear },
]

export default function Inventario() {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const { perfil } = useSesion()
  const editable = puedeEditar(perfil)

  const [datos, setDatos] = useState([])
  const [resumen, setResumen] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seg, setSeg] = useState('todos')
  const [form, setForm] = useState(null)

  const cargar = () => {
    setCargando(true)
    Promise.all([inventario(), resumenInventario()])
      .then(([inv, res]) => { setDatos(inv); setResumen(res || {}) })
      .catch(setError)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((a) => ({
    ...a,
    tipoL: L_TIPO_ACTIVO[a.tipo] || a.tipo,
    estadoL: L_ESTADO_ACTIVO[a.estado] || a.estado,
    valorL: clp(a.valor_arriendo),
    movL: fecha(a.ultimo_movimiento),
    ubicacionL: a.ubicacion || 'Sin ubicación',
    clienteL: a.cliente || '—',
  })), [datos])

  const visibles = useMemo(() => {
    if (seg === 'bodega') return filas.filter((f) => f.en_bodega)
    if (seg === 'mantencion') return filas.filter((f) => f.estado === 'mantencion')
    if (seg === 'terreno') return filas.filter((f) => !f.en_bodega && f.estado !== 'mantencion')
    return filas
  }, [filas, seg])

  const kpis = seg === 'todos'
    ? [
      { v: resumen.total_activos ?? 0, l: 'Total' },
      { v: resumen.total_banos ?? 0, l: 'Baños' },
      { v: resumen.total_vehiculos ?? 0, l: 'Camiones' },
      { v: resumen.total_disponibles ?? 0, l: 'Disponibles' },
      { v: resumen.total_mantencion ?? 0, l: 'Mantención' },
    ]
    : [{ v: visibles.length, l: 'En esta vista' }]

  return (
    <>
      <Listado
        titulo="Inventario"
        bajada="Todos los activos de la empresa, con su estado y ubicación actual."
        accion={{ label: 'Agregar activo', onClick: () => setForm('activo'), disabled: !editable }}
        exportar={() => exportarVista('export_activos', 'Activos')}
        segmentos={{ opciones: SEGMENTOS, valor: seg, onChange: setSeg }}
        kpis={kpis}
        cargando={cargando}
        error={error}
        unidad="activos"
        busquedaInicial={params.get('q') || ''}
        filtros={[
          { k: 'tipoL', label: 'Tipo' },
          { k: 'estadoL', label: 'Estado' },
          { k: 'ubicacionL', label: 'Ubicación' },
        ]}
        buscar={['codigo', 'detalle', 'clienteL', 'ubicacionL']}
        cols={[
          { k: 'codigo', label: 'Código' },
          { k: 'tipoL', label: 'Tipo' },
          { k: 'detalle', label: 'Detalle', render: (d) => d.detalle || '—' },
          { k: 'estadoL', label: 'Estado', badge: true },
          { k: 'ubicacionL', label: 'Ubicación' },
          { k: 'clienteL', label: 'Cliente' },
          { k: 'valorL', label: 'Valor arriendo' },
          { k: 'movL', label: 'Último movimiento' },
        ]}
        datos={visibles}
        onFila={(d) => navegar('/activo/' + d.qr_token)}
        acciones={(d) => [
          { t: 'Ver ficha', d: I.ojo, color: C.azul, onClick: () => navegar('/activo/' + d.qr_token) },
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
