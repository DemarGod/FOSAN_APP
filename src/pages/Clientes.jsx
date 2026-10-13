import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Listado from '../components/Listado'
import Modal from '../components/Modal'
import FormCliente from '../components/FormCliente'
import { clientesResumen, eliminarCliente, procesarVencidos } from '../lib/api'
import { exportarVista } from '../lib/excel'
import { useSesion, puedeEditar, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, I, L_VIGENCIA, clp, fecha } from '../lib/ui'

const BASURA = 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6'
const SEGMENTOS = [
  { v: 'vigentes', l: 'Vigentes', d: I.check },
  { v: 'vencidos', l: 'Vencidos', d: I.alert },
  { v: 'todos', l: 'Todos', d: I.users },
]

export default function Clientes() {
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const qInicial = params.get('q') || ''
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'clientes')
  const dueno = puedeEditar(perfil)
  const finanzas = verFinanzas(perfil)

  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(false)
  const [seg, setSeg] = useState('vigentes')
  const [borrar, setBorrar] = useState(null)

  const cargar = () => {
    setCargando(true)
    procesarVencidos()
      .then(clientesResumen).then(setDatos).catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const filas = useMemo(() => datos.map((c) => ({
    ...c,
    rubroL: c.rubro_nombre || c.rubro,
    estadoL: L_VIGENCIA[c.vigencia] || c.vigencia,
    vigenciaL: !c.fecha_fin_contrato ? 'Indefinido'
      : c.vigencia === 'vencido'
        ? 'Venció el ' + fecha(c.fecha_fin_contrato) + (c.retiro_pendiente ? ' · retiro pendiente' : '')
        : 'Hasta ' + fecha(c.fecha_fin_contrato),
    valorL: clp(c.valor_mensual),
    contactoL: c.contacto_nombre || '—',
    telefonoL: c.telefono || '—',
    comunaL: c.comuna || '—',
  })), [datos])

  const visibles = seg === 'todos' ? filas
    : seg === 'vencidos' ? filas.filter((f) => f.vigencia === 'vencido')
      : filas.filter((f) => f.vigencia !== 'vencido')
  const sinGeo = visibles.filter((f) => !f.georreferenciado).length

  return (
    <>
      <Listado
        key={qInicial}
        busquedaInicial={qInicial}
        titulo="Clientes"
        bajada="Empresas con baños arrendados, su contrato y su facturación mensual."
        accion={{ label: 'Nuevo cliente', onClick: () => setForm(true), disabled: !editable }}
        exportar={finanzas ? () => exportarVista('export_clientes', 'Clientes') : undefined}
        segmentos={{ opciones: SEGMENTOS, valor: seg, onChange: setSeg }}
        kpis={[
          { v: filas.length, l: 'Clientes' },
          { v: filas.filter((f) => f.vigencia !== 'vencido').length, l: 'Activos' },
          { v: filas.filter((f) => f.vigencia === 'vencido').length, l: 'Vencidos' },
          { v: filas.filter((f) => f.retiro_pendiente).length, l: 'Retiros pendientes' },
        ]}
        cargando={cargando}
        error={error}
        unidad="clientes"
        filtros={[
          { k: 'rubroL', label: 'Rubro' },
          { k: 'estadoL', label: 'Estado' },
          { k: 'comunaL', label: 'Comuna' },
        ]}
        buscar={['nombre', 'rut', 'contactoL', 'comunaL', 'telefonoL']}
        cols={[
          { k: 'nombre', label: 'Empresa' },
          { k: 'rut', label: 'RUT', render: (d) => d.rut || '—' },
          { k: 'rubroL', label: 'Rubro' },
          { k: 'estadoL', label: 'Estado', badge: true },
          { k: 'vigenciaL', label: 'Vigencia' },
          { k: 'banos_activos', label: 'Baños' },
          ...(finanzas ? [{ k: 'valorL', label: 'Valor mensual' }] : []),
          { k: 'contactoL', label: 'Contacto' },
          { k: 'telefonoL', label: 'Teléfono' },
          { k: 'comunaL', label: 'Comuna' },
        ]}
        datos={visibles}
        onFila={(d) => editable && setForm(d.id)}
        acciones={(d) => [
          d.georreferenciado
            ? { t: 'Ver en el mapa', label: 'Ubicado', d: I.pin, color: C.navy, bg: C.tinte, borde: C.borde, onClick: () => navegar('/ubicaciones') }
            : { t: 'Asignar ubicación', label: 'Ubicar', d: I.pin, color: '#b06000', bg: '#fef7e0', borde: C.amarillo, onClick: () => navegar('/ubicaciones') },
          { t: 'Editar cliente', d: I.lapiz, color: C.navy, disabled: !editable, onClick: () => setForm(d.id) },
          { t: 'Eliminar cliente', d: BASURA, color: C.rojo, disabled: !dueno, onClick: () => setBorrar(d) },
        ]}
        nota={sinGeo ? `${sinGeo} cliente(s) sin georreferencia: se pueden ubicar cargando sus coordenadas.` : undefined}
      />

      {form && <FormCliente clienteId={form === true ? null : form} onCerrar={() => setForm(false)} onGuardado={() => { setForm(false); cargar() }} />}
      {borrar && (
        <ConfirmarBorrado cliente={borrar} onCerrar={() => setBorrar(null)}
          onDespachos={() => navegar('/despachos')}
          onBorrado={() => { setBorrar(null); cargar() }} />
      )}
    </>
  )
}

function ConfirmarBorrado({ cliente, onCerrar, onBorrado, onDespachos }) {
  const [error, setError] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const bloqueado = Number(cliente.banos_activos) > 0

  const confirmar = async () => {
    setBorrando(true)
    try { await eliminarCliente(cliente.id); onBorrado() } catch (e) { setError(e); setBorrando(false) }
  }

  return (
    <Modal titulo={bloqueado ? 'No se puede eliminar' : 'Eliminar cliente'} ancho={480} onCerrar={onCerrar} pie={
      bloqueado
        ? <>
          <button className="btn" onClick={onCerrar}>Cerrar</button>
          <button className="btn btn-azul" onClick={onDespachos}>Ir a Despachos</button>
        </>
        : <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn" onClick={confirmar} disabled={borrando}
            style={{ background: C.rojo, color: '#fff', borderColor: C.rojo }}>
            {borrando ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 12, font: '400 13px/1.5 var(--font)' }}>
        {bloqueado
          ? <p style={{ margin: 0 }}>
            <strong>{cliente.nombre}</strong> todavía tiene {cliente.banos_activos} baño(s) asignado(s).
            Primero registra su retiro en Despachos y márcalo como hecho; después podrás eliminarlo.
          </p>
          : <p style={{ margin: 0 }}>
            Se eliminará <strong>{cliente.nombre}</strong> junto con su historial de servicios y despachos.
            Esta acción no se puede deshacer.
          </p>}
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, color: '#7c1405' }}>
          {String(error.message || error)}
        </div>}
      </div>
    </Modal>
  )
}
