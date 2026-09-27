import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Listado from '../components/Listado'
import FormActivo from '../components/FormActivo'
import FormMantencion from '../components/FormMantencion'
import { inventario, banosKpi } from '../lib/api'
import { exportarVista } from '../lib/excel'
import { useSesion, puedeEditar } from '../lib/sesion'
import { C, I, L_ESTADO_ACTIVO, clp, fecha } from '../lib/ui'

export default function Banos() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeEditar(perfil)

  const [datos, setDatos] = useState([])
  const [kpi, setKpi] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)

  const cargar = () => {
    setCargando(true)
    Promise.all([inventario(), banosKpi()])
      .then(([inv, k]) => { setDatos(inv.filter((a) => a.tipo === 'bano_quimico')); setKpi(k || {}) })
      .catch(setError)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((a) => ({
    ...a,
    modeloL: a.detalle || 'Sin modelo',
    estadoL: L_ESTADO_ACTIVO[a.estado] || a.estado,
    clienteL: a.cliente || '—',
    ubicacionL: a.ubicacion || 'Sin ubicación',
    valorL: clp(a.valor_arriendo),
    movL: fecha(a.ultimo_movimiento),
  })), [datos])

  return (
    <>
      <Listado
        titulo="Baños químicos"
        bajada="Trazabilidad por unidad: modelo, estado, cliente y ubicación."
        accion={{ label: 'Agregar baño', onClick: () => setForm('activo'), disabled: !editable }}
        exportar={() => exportarVista('export_activos', 'Activos')}
        kpis={[
          { v: kpi.total ?? 0, l: 'Total' },
          { v: kpi.en_arriendo ?? 0, l: 'En arriendo' },
          { v: kpi.disponibles ?? 0, l: 'Disponibles' },
          { v: kpi.mantencion ?? 0, l: 'Mantención' },
          { v: kpi.fuera_servicio ?? 0, l: 'Fuera de servicio' },
        ]}
        cargando={cargando}
        error={error}
        unidad="baños"
        filtros={[
          { k: 'estadoL', label: 'Estado' },
          { k: 'modeloL', label: 'Modelo' },
          { k: 'ubicacionL', label: 'Ubicación' },
          { k: 'clienteL', label: 'Cliente' },
        ]}
        buscar={['codigo', 'modeloL', 'clienteL', 'ubicacionL']}
        cols={[
          { k: 'codigo', label: 'ID' },
          { k: 'modeloL', label: 'Modelo' },
          { k: 'estadoL', label: 'Estado', badge: true },
          { k: 'clienteL', label: 'Cliente' },
          { k: 'ubicacionL', label: 'Ubicación' },
          { k: 'valorL', label: 'Valor arriendo' },
          { k: 'movL', label: 'Último movimiento' },
        ]}
        datos={filas}
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
