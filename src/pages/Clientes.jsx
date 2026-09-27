import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Listado from '../components/Listado'
import FormCliente from '../components/FormCliente'
import { clientesResumen } from '../lib/api'
import { exportarVista } from '../lib/excel'
import { useSesion, puedeEditar } from '../lib/sesion'
import { C, I, L_RUBRO, L_VIGENCIA, clp, fecha } from '../lib/ui'

export default function Clientes() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeEditar(perfil)

  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(false)

  const cargar = () => {
    setCargando(true)
    clientesResumen().then(setDatos).catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((c) => ({
    ...c,
    rubroL: L_RUBRO[c.rubro] || c.rubro,
    estadoL: L_VIGENCIA[c.vigencia] || c.vigencia,
    vigenciaL: c.fecha_fin_contrato ? 'Hasta ' + fecha(c.fecha_fin_contrato) : 'Indefinido',
    valorL: clp(c.valor_mensual),
    contactoL: c.contacto_nombre || '—',
    telefonoL: c.telefono || '—',
    comunaL: c.comuna || '—',
  })), [datos])

  const sinGeo = filas.filter((f) => !f.georreferenciado).length

  return (
    <>
      <Listado
        titulo="Clientes"
        bajada="Empresas con baños arrendados, su contrato y su facturación mensual."
        accion={{ label: 'Nuevo cliente', onClick: () => setForm(true), disabled: !editable }}
        exportar={() => exportarVista('export_clientes', 'Clientes')}
        kpis={[
          { v: filas.length, l: 'Clientes' },
          { v: filas.filter((f) => f.vigencia !== 'vencido').length, l: 'Activos' },
          { v: filas.filter((f) => f.vigencia === 'vencido').length, l: 'Vencidos' },
          { v: sinGeo, l: 'Sin georreferencia' },
        ]}
        cargando={cargando}
        error={error}
        unidad="clientes"
        filtros={[
          { k: 'rubroL', label: 'Rubro' },
          { k: 'estadoL', label: 'Estado' },
          { k: 'comunaL', label: 'Comuna' },
        ]}
        buscar={['nombre', 'contactoL', 'comunaL', 'telefonoL']}
        cols={[
          { k: 'nombre', label: 'Empresa' },
          { k: 'rubroL', label: 'Rubro' },
          { k: 'estadoL', label: 'Estado', badge: true },
          { k: 'vigenciaL', label: 'Vigencia' },
          { k: 'banos_activos', label: 'Baños' },
          { k: 'valorL', label: 'Valor mensual' },
          { k: 'contactoL', label: 'Contacto' },
          { k: 'telefonoL', label: 'Teléfono' },
          { k: 'comunaL', label: 'Comuna' },
        ]}
        datos={filas}
        acciones={(d) => [
          d.georreferenciado
            ? {
              t: 'Ver en el mapa', label: 'Ubicado', d: I.pin, color: C.navy,
              bg: C.tinte, borde: C.borde, onClick: () => navegar('/ubicaciones'),
            }
            : {
              t: 'Asignar ubicación', label: 'Ubicar', d: I.pin, color: '#b06000',
              bg: '#fef7e0', borde: C.amarillo, onClick: () => navegar('/ubicaciones'),
            },
        ]}
        nota={sinGeo
          ? `${sinGeo} cliente(s) sin georreferencia: se pueden ubicar cargando sus coordenadas.`
          : undefined}
      />

      {form && <FormCliente onCerrar={() => setForm(false)} onGuardado={() => { setForm(false); cargar() }} />}
    </>
  )
}
