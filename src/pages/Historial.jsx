import { useEffect, useMemo, useState } from 'react'
import Listado from '../components/Listado'
import Modal from '../components/Modal'
import { historial } from '../lib/api'
import { nombreRol } from '../lib/sesion'
import { C, fechaHora } from '../lib/ui'

// Sección de la app a la que pertenece cada tabla auditada
const SECCION = {
  perfiles: 'Usuarios', clientes: 'Clientes', ubicaciones: 'Mapa', modelos_bano: 'Modelos de baño',
  activos: 'Inventario', vehiculos: 'Transporte', documentos_activo: 'Inventario', observaciones_activo: 'Inventario',
  servicios: 'Servicios', servicio_activos: 'Servicios', mantenciones: 'Mantenciones',
  ventas: 'Ventas (Maxxa)', costos: 'Costos', proveedores: 'Insumos', insumos: 'Insumos',
  compras: 'Insumos', compra_lineas: 'Insumos', receta_limpieza: 'Insumos', eventos: 'Calendario',
  rubros: 'Configuración', parametros: 'Configuración', rutas: 'Rutas', ruta_paradas: 'Rutas',
  salidas: 'Rutas', salida_paradas: 'Rutas', despachos: 'Despachos y retiros', despacho_banos: 'Despachos y retiros',
}
const ACCION = { crear: 'Creó', modificar: 'Modificó', eliminar: 'Eliminó' }
const OCULTOS = ['id', 'qr_token']

const PERIODOS = [
  { v: '1', l: 'Hoy' },
  { v: '7', l: 'Últimos 7 días' },
  { v: '30', l: 'Últimos 30 días' },
  { v: '0', l: 'Todo' },
]

const campo = (k) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ')
const valor = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function resumen(r) {
  if (r.accion !== 'modificar') return `${ACCION[r.accion]} el registro`
  return Object.entries(r.cambios || {})
    .map(([k, c]) => `${campo(k)}: ${valor(c.antes)} → ${valor(c.despues)}`)
    .join(' · ')
}

export default function Historial() {
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [periodo, setPeriodo] = useState('7')
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    setCargando(true)
    const dias = Number(periodo)
    const desde = dias ? new Date(Date.now() - (dias - 1) * 864e5) : null
    if (desde) desde.setHours(0, 0, 0, 0)
    historial(desde ? desde.toISOString() : null)
      .then(setDatos)
      .catch(setError)
      .finally(() => setCargando(false))
  }, [periodo])

  const filas = useMemo(() => datos.map((r) => {
    const texto = resumen(r)
    return {
      ...r,
      fechaL: fechaHora(r.fecha),
      usuarioL: r.usuario_nombre || '—',
      rolL: r.usuario_rol ? nombreRol(r.usuario_rol) : '—',
      accionL: ACCION[r.accion] || r.accion,
      seccionL: SECCION[r.tabla] || r.tabla,
      registroL: r.etiqueta || '—',
      resumen: texto,
      resumenL: texto.length > 70 ? texto.slice(0, 70) + '…' : texto,
    }
  }), [datos])

  const hoy = new Date().toDateString()
  const usuarios = new Set(filas.map((f) => f.usuarioL)).size

  return (
    <>
      <Listado
        titulo="Historial de cambios"
        bajada="Quién creó, modificó o eliminó cada registro, cuándo y qué cambió. Solo lo ven los dueños."
        segmentos={{ opciones: PERIODOS, valor: periodo, onChange: setPeriodo }}
        kpis={[
          { v: filas.length, l: 'Cambios en el período' },
          { v: filas.filter((f) => new Date(f.fecha).toDateString() === hoy).length, l: 'Cambios de hoy' },
          { v: filas.filter((f) => f.accion === 'eliminar').length, l: 'Eliminaciones' },
          { v: usuarios, l: 'Usuarios' },
        ]}
        cargando={cargando}
        error={error}
        unidad="cambios"
        nota={datos.length >= 1000 ? 'Se muestran los 1.000 cambios más recientes del período.' : undefined}
        filtros={[
          { k: 'usuarioL', label: 'Usuario' },
          { k: 'rolL', label: 'Rol' },
          { k: 'seccionL', label: 'Sección' },
          { k: 'accionL', label: 'Acción' },
        ]}
        buscar={['registroL', 'usuarioL', 'seccionL', 'resumen']}
        cols={[
          { k: 'fechaL', label: 'Fecha' },
          { k: 'usuarioL', label: 'Usuario' },
          { k: 'rolL', label: 'Rol' },
          { k: 'accionL', label: 'Acción' },
          { k: 'seccionL', label: 'Sección' },
          { k: 'registroL', label: 'Registro' },
          { k: 'resumenL', label: 'Detalle' },
        ]}
        datos={filas}
        onFila={setAbierto}
      />

      {abierto && <Detalle r={abierto} onCerrar={() => setAbierto(null)} />}
    </>
  )
}

function Detalle({ r, onCerrar }) {
  const modifico = r.accion === 'modificar'
  const filas = Object.entries(r.cambios || {}).filter(([k]) => modifico || !OCULTOS.includes(k))
  return (
    <Modal titulo={`${r.accionL} · ${r.seccionL} · ${r.registroL}`} ancho={680} onCerrar={onCerrar}>
      <div style={{ padding: '14px 18px', font: '400 13px/1.5 var(--font)', color: C.gris }}>
        {r.usuarioL} ({r.rolL}) · {r.fechaL}
      </div>
      <div className="scroller">
        <table style={{ minWidth: 480 }}>
          <thead>
            {modifico
              ? <tr><th>Campo</th><th>Antes</th><th>Después</th></tr>
              : <tr><th>Campo</th><th>{r.accion === 'crear' ? 'Valor guardado' : 'Valor eliminado'}</th></tr>}
          </thead>
          <tbody>
            {filas.map(([k, c]) => (
              <tr key={k}>
                <td style={{ fontWeight: 600 }}>{campo(k)}</td>
                {modifico
                  ? <><td>{valor(c.antes)}</td><td>{valor(c.despues)}</td></>
                  : <td>{valor(c)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
