import { useEffect, useMemo, useState } from 'react'
import Listado from '../components/Listado'
import Modal from '../components/Modal'
import FormDespacho from '../components/FormDespacho'
import { despachos, estadoDespacho as actualizarEstadoDespacho, procesarVencidos } from '../lib/api'
import { useSesion, puedeEditar, puedeOperar } from '../lib/sesion'
import { C, I, fecha, L_ESTADO_DESPACHO, estadoDespacho } from '../lib/ui'
import { hoyISO } from '../lib/costos'

const L_TIPO = { entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio' }
const L_ESTADO = L_ESTADO_DESPACHO
const L_ORIGEN = { manual: 'Manual', vencimiento: 'Contrato vencido', nuevo_cliente: 'Cliente nuevo' }
const SEGMENTOS = [
  { v: 'programado', l: 'Por ejecutar', d: I.cal },
  { v: 'hecho', l: 'Finalizados', d: I.check },
  { v: 'todos', l: 'Todos', d: I.clip },
]

export default function Despachos() {
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'despachos')
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seg, setSeg] = useState('programado')
  const [form, setForm] = useState(false)
  const [confirmar, setConfirmar] = useState(null)

  const cargar = () => {
    setCargando(true)
    procesarVencidos().then(despachos).then(setDatos).catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const hoy = hoyISO()
  const filas = useMemo(() => datos.map((d) => ({
    ...d,
    tipoL: L_TIPO[d.tipo],
    estadoL: estadoDespacho(d, hoy),
    fechaL: fecha(d.fecha_programada) + (d.estado === 'programado' && d.fecha_programada < hoy ? ' · atrasado' : ''),
    origenL: L_ORIGEN[d.origen] || d.origen,
    vehiculoL: d.vehiculo || 'Sin asignar',
    rutaL: d.ruta ? `${d.ruta}` : 'Viaje aparte',
  })), [datos, hoy])

  const visibles = seg === 'todos' ? filas : filas.filter((f) => f.estado === seg)
  const prog = filas.filter((f) => f.estado === 'programado')

  const cambiar = async () => {
    try { await actualizarEstadoDespacho(confirmar.d.id, confirmar.estado); setConfirmar(null); cargar() }
    catch (e) { setConfirmar((c) => ({ ...c, error: String(e.message || e) })) }
  }

  return (
    <>
      <Listado
        titulo="Despachos y retiros"
        bajada="Qué baño se entrega o retira, cuándo y en qué vehículo."
        accion={{ label: 'Nuevo despacho', onClick: () => setForm(true), disabled: !editable }}
        segmentos={{ opciones: SEGMENTOS, valor: seg, onChange: setSeg }}
        kpis={[
          { v: prog.length, l: 'Programados' },
          { v: prog.filter((f) => f.fecha_programada === hoy).length, l: 'Para hoy' },
          { v: prog.filter((f) => f.fecha_programada < hoy).length, l: 'Atrasados' },
          { v: prog.filter((f) => f.origen === 'vencimiento').length, l: 'Retiros por vencimiento' },
        ]}
        cargando={cargando}
        error={error}
        unidad="despachos"
        filtros={[{ k: 'tipoL', label: 'Tipo' }, { k: 'vehiculoL', label: 'Vehículo' }, { k: 'origenL', label: 'Origen' }]}
        buscar={['folio', 'cliente', 'banos', 'direccion']}
        cols={[
          { k: 'folio', label: 'Folio' },
          { k: 'fechaL', label: 'Fecha' },
          { k: 'tipoL', label: 'Tipo' },
          { k: 'cliente', label: 'Cliente' },
          { k: 'direccion', label: 'Dirección', render: (d) => d.direccion || '—' },
          { k: 'banos', label: 'Baños', render: (d) => d.banos || '—' },
          { k: 'vehiculoL', label: 'Vehículo' },
          { k: 'rutaL', label: 'Ruta' },
          { k: 'estadoL', label: 'Estado', badge: true },
        ]}
        datos={visibles}
        acciones={(d) => d.estado === 'programado' ? [
          { t: 'Marcar como finalizado', label: 'Finalizar', d: I.check, color: '#fff', bg: C.verde, borde: C.verde, disabled: !editable, onClick: () => setConfirmar({ d, estado: 'hecho' }) },
          { t: 'Cancelar despacho', d: 'M6 6l12 12M18 6 6 18', color: C.rojo, disabled: !editable, onClick: () => setConfirmar({ d, estado: 'cancelado' }) },
        ] : []}
      />

      {form && <FormDespacho onCerrar={() => setForm(false)} onGuardado={() => { setForm(false); cargar() }} />}
      {confirmar && (
        <Modal titulo={confirmar.estado === 'hecho' ? 'Confirmar despacho hecho' : 'Cancelar despacho'} ancho={480}
          onCerrar={() => setConfirmar(null)} pie={
            <>
              <button className="btn" onClick={() => setConfirmar(null)}>Volver</button>
              <button className={confirmar.estado === 'hecho' ? 'btn btn-verde' : 'btn'} onClick={cambiar}
                style={confirmar.estado === 'hecho' ? undefined : { background: C.rojo, color: '#fff', borderColor: C.rojo }}>
                {confirmar.estado === 'hecho' ? 'Confirmar' : 'Cancelar despacho'}
              </button>
            </>
          }>
          <div style={{ padding: 18, display: 'grid', gap: 12, font: '400 13px/1.5 var(--font)' }}>
            <p style={{ margin: 0 }}>
              <strong>{confirmar.d.folio}</strong> · {confirmar.d.tipoL} en {confirmar.d.cliente}: {confirmar.d.banos}.
            </p>
            {confirmar.estado === 'hecho' && (
              <p style={{ margin: 0, color: C.gris }}>
                Los baños cambian de estado y ubicación automáticamente, y queda el movimiento en su ficha.
              </p>
            )}
            {confirmar.error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, color: '#7c1405' }}>{confirmar.error}</div>}
          </div>
        </Modal>
      )}
    </>
  )
}
