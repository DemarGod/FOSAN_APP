// Inicio (lámina 1): estado operativo del día, trabajos, actividad reciente y alertas.
// 1.1 Vista principal · 1.3 Selector de fecha · 1.4 Actividad reciente · 1.5 Detalle del trabajo.
// (1.2 Notificaciones y 1.6 Perfil están en la barra superior.)
// Los indicadores abren listados filtrados. Las existencias muestran la situación actual.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal'
import { Boton, Campo, Tabla, Estado, Ayuda, Pestanas } from '../components/Base'
import { useSesion, puedeOperar, puedeVer, esDueno } from '../lib/sesion'
import { inicioDatos, actividadPeriodo, avisosCalculados } from '../lib/api'
import { hoyISO } from '../lib/costos'
import { C, Icon, I, fecha, fechaHora } from '../lib/ui'

const L_SERV = { arriendo_limpieza: 'Arriendo', limpieza_cliente: 'Limpieza de baños', limpieza_fosas: 'Limpieza de fosa' }
const L_ACC = { entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio', limpieza: 'Limpieza' }
const L_OP = { programada: 'Programada', realizada: 'Realizada', pendiente: 'Atrasada', cancelada: 'Cancelada' }
const TONO_OP = { programada: 'info', realizada: 'ok', pendiente: 'error', cancelada: 'neutro' }
const L_PARADA = { pendiente: 'Programada', hecha: 'Realizada', no_realizada: 'No se pudo' }
const TONO_PARADA = { pendiente: 'info', hecha: 'ok', no_realizada: 'error' }
const L_TABLA = {
  clientes: 'Cliente', cliente_contactos: 'Contacto', ubicaciones: 'Ubicación', servicios_cliente: 'Servicio', activos: 'Equipo',
  despachos: 'Operación', despacho_banos: 'Unidades de operación', mantenciones: 'Mantenimiento', insumos: 'Insumo', movimientos_insumo: 'Movimiento de insumo',
  vehiculos: 'Vehículo', vehiculo_disponibilidad: 'Disponibilidad de vehículo', personal: 'Personal', perfiles: 'Usuario', salidas: 'Día de ruta',
  salida_paradas: 'Parada de ruta', rutas_semana: 'Ruta semanal', operacion_respaldos: 'Respaldo', categorias: 'Catálogo', modelos_bano: 'Modelo',
}
const L_ACCION = { crear: 'creado', modificar: 'modificado', eliminar: 'eliminado' }
const NIVEL = { alerta: { color: C.rojo, d: I.alert }, aviso: { color: C.amarillo, d: I.alert }, info: { color: C.azul, d: I.info } }
const chico = { minHeight: 32, padding: '5px 12px' }

export default function Inicio({ onCalendario }) {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const hoy = hoyISO()
  const [rango, setRango] = useState({ desde: hoy, hasta: hoy })
  const [elegirFecha, setElegirFecha] = useState(false)
  const [tab, setTab] = useState('trabajos')
  const [d, setD] = useState(null)
  const [actividad, setActividad] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [error, setError] = useState(null)
  const [trabajo, setTrabajo] = useState(null)
  const [registro, setRegistro] = useState(null)
  const veActividad = esDueno(perfil)

  useEffect(() => {
    setD(null); setActividad(null); setError(null)
    inicioDatos(rango.desde, rango.hasta).then(setD).catch(setError)
    if (veActividad) actividadPeriodo(rango.desde, rango.hasta).then(setActividad).catch(() => setActividad([]))
  }, [rango.desde, rango.hasta])
  useEffect(() => { avisosCalculados().then(setAvisos).catch(() => {}) }, [])

  // Trabajos del período: operaciones + limpiezas de ruta
  const trabajos = d ? [
    ...d.ops.map((o) => ({
      id: 'op-' + o.id, fecha: o.fecha_programada, folio: o.folio, trabajo: `${o.folio} · ${L_ACC[o.tipo] || o.tipo}${o.servicio_tipo === 'limpieza_fosas' ? ' de fosa' : ''}`,
      cliente: o.cliente, ubicacion: o.ubicacion, equipos: o.unidades, responsable: o.responsable, ruta: o.ruta,
      estado: L_OP[o.estado_op], tono: TONO_OP[o.estado_op], abrir: `/operaciones?tab=programacion&folio=${o.folio}`,
    })),
    ...d.paradas.map((p) => ({
      id: 'pa-' + p.id, fecha: p.salidas?.fecha, trabajo: `Limpieza en ruta${p.salidas?.rutas_semana?.nombre ? ` · ${p.salidas.rutas_semana.nombre}` : ''}`,
      cliente: p.clientes?.nombre, ubicacion: p.clientes?.direccion, equipos: null, responsable: null, ruta: p.salidas?.rutas_semana?.nombre,
      estado: L_PARADA[p.estado] || p.estado, tono: TONO_PARADA[p.estado] || 'neutro', abrir: '/operaciones?tab=rutas',
    })),
  ].sort((x, y) => String(x.fecha).localeCompare(String(y.fecha))) : null

  const unDia = rango.desde === rango.hasta
  const titRango = unDia ? (rango.desde === hoy ? `Hoy · ${fecha(hoy)}` : fecha(rango.desde)) : `${fecha(rango.desde)} – ${fecha(rango.hasta)}`
  const v = (x) => (d ? (x ?? '—') : '…')
  const KPIS = [
    { l: 'Disponibles', n: d?.disponibles, d: I.box, color: C.verde, ir: '/inventario', s: 'Equipos propios operativos' },
    { l: unDia && rango.desde === hoy ? 'Trabajos del día' : 'Trabajos del período', n: trabajos?.length, d: I.cal, color: C.azul, ir: '/operaciones?tab=programacion' },
    { l: 'Atrasados', n: d?.atrasados, d: I.alert, color: C.rojo, ir: '/operaciones?tab=programacion&estado=pendiente', s: 'Operaciones sin realizar' },
    { l: 'Mantenimientos pendientes', n: d?.mant, d: I.wrench, color: C.amarillo, ir: '/mantenimiento' },
  ].filter((k) => !(k.ir.startsWith('/mantenimiento') && !puedeVer(perfil, 'mantenciones')))

  // Alertas: atrasados + avisos calculados (insumos, mantenciones, contratos, eventos)
  const alertas = [
    ...(d?.atrasados ? [{ id: 'atr', nivel: 'alerta', texto: `${d.atrasados} trabajo(s) atrasado(s)`, a: '/operaciones?tab=programacion&estado=pendiente', boton: 'Revisar' }] : []),
    ...avisos.map((a) => ({ ...a, a: corregirRuta(a.a), boton: a.origen === 'Insumos' ? 'Ver insumo' : 'Revisar' })),
  ].sort((x, y) => ({ alerta: 0, aviso: 1, info: 2 }[x.nivel] - { alerta: 0, aviso: 1, info: 2 }[y.nivel]))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>Inicio</h2>
        <Boton icono={I.cal} onClick={() => setElegirFecha(true)}>{titRango}</Boton>
        {puedeOperar(perfil, 'rutas') && <Boton tipo="principal" icono={I.plus} onClick={() => navegar('/operaciones?tab=programacion&nueva=1')}>Nueva orden</Boton>}
      </div>

      <div className="kpis">
        {KPIS.map((k) => (
          <button key={k.l} type="button" className="indicador" onClick={() => navegar(k.ir)} style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}>
            <Icon d={k.d} size={26} color={k.color} />
            <div><span>{k.l}</span><b style={k.l === 'Atrasados' && d?.atrasados ? { color: C.rojo } : undefined}>{v(k.n)}</b>{k.s && <small className="text-muted" style={{ display: 'block' }}>{k.s}</small>}</div>
          </button>
        ))}
      </div>
      <small className="text-muted" style={{ marginTop: -8 }}>Existencias actuales · Agenda del período seleccionado ({titRango}).</small>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(260px, 1fr)', gap: 16, alignItems: 'start' }} className="cols2">
        <section className="card">
          <div style={{ padding: '12px 16px 0' }}>
            <Pestanas opciones={[{ v: 'trabajos', l: unDia && rango.desde === hoy ? 'Trabajos del día' : 'Trabajos del período' }, ...(veActividad ? [{ v: 'actividad', l: 'Actividad reciente' }] : [])]} valor={tab} onChange={setTab} />
          </div>
          {tab === 'trabajos' ? (
            trabajos === null ? <div style={{ padding: 20, color: C.gris }}>Cargando…</div> : (
              <Tabla filas={trabajos} vacio="Sin trabajos en este período." columnas={[
                ...(unDia ? [] : [{ k: 'fecha', label: 'Fecha', render: (t) => fecha(t.fecha) }]),
                { k: 'trabajo', label: 'Trabajo', render: (t) => <b>{t.trabajo}</b> },
                { k: 'cliente', label: 'Cliente', render: (t) => t.cliente || '—' },
                { k: 'estado', label: 'Estado', render: (t) => <Estado tono={t.tono}>{t.estado}</Estado> },
                { k: 'acc', label: 'Acción', alinear: 'right', render: (t) => <Boton onClick={() => setTrabajo(t)} style={chico}>Ver detalle</Boton> },
              ]} />
            )
          ) : (
            actividad === null ? <div style={{ padding: 20, color: C.gris }}>Cargando…</div> : (
              <Tabla filas={actividad.slice(0, 50)} vacio="Sin actividad registrada en este período." columnas={[
                { k: 'hora', label: unDia ? 'Hora' : 'Fecha', render: (a) => (unDia ? new Date(a.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : fechaHora(a.fecha)) },
                { k: 'evento', label: 'Evento', render: (a) => `${a.etiqueta ? a.etiqueta + ' · ' : ''}${L_TABLA[a.tabla] || a.tabla} ${L_ACCION[a.accion] || a.accion}` },
                { k: 'resp', label: 'Responsable', render: (a) => a.usuario_nombre || '—' },
                { k: 'acc', label: 'Acción', alinear: 'right', render: (a) => <Boton onClick={() => setRegistro(a)} style={chico}>Ver registro</Boton> },
              ]} />
            )
          )}
          <div style={{ padding: 14 }}>
            <Ayuda>{tab === 'trabajos' ? 'Ver detalle es una consulta rápida; Abrir orden lleva al registro completo en Operaciones.' : 'Eventos registrados con fecha y responsable. Ver registro muestra el detalle; no se edita ni se borra.'}</Ayuda>
          </div>
        </section>

        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: `1px solid ${C.borde}` }}>
            <Icon d={I.alert} size={18} color={C.rojo} /><h6 style={{ margin: 0, flex: 1 }}>Alertas</h6>
            <small className="text-muted">{alertas.length}</small>
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {alertas.length === 0 && <div style={{ padding: 16 }} className="text-muted">Sin alertas pendientes.</div>}
            {alertas.map((a) => {
              const n = NIVEL[a.nivel] || NIVEL.info
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${C.fila}` }}>
                  <Icon d={n.d} size={16} color={n.color} />
                  <span style={{ flex: 1, minWidth: 0, font: '400 13px/1.4 var(--font)' }}>{a.texto}{a.origen && <small className="text-muted" style={{ display: 'block' }}>{a.origen}</small>}</span>
                  {a.a && <button type="button" onClick={() => navegar(a.a)} style={{ border: 0, background: 'transparent', color: C.azul, cursor: 'pointer', font: '600 13px var(--font)' }}>{a.boton}</button>}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 14, flexWrap: 'wrap' }}>
            <Boton icono={I.pin} onClick={() => navegar('/inventario?tab=mapa')} style={{ flex: 1 }}>Ver mapa</Boton>
            <Boton icono={I.cal} onClick={onCalendario} style={{ flex: 1 }}>Ver calendario</Boton>
          </div>
        </section>
      </div>
      <small className="text-muted">Los indicadores abren listados filtrados. Revisar una alerta abre el registro relacionado. Solo se muestran acciones autorizadas.</small>

      {elegirFecha && <SelectorFecha rango={rango} onCerrar={() => setElegirFecha(false)} onAplicar={(r) => { setRango(r); setElegirFecha(false) }} />}
      {trabajo && <DetalleTrabajo t={trabajo} onCerrar={() => setTrabajo(null)} onAbrir={() => navegar(trabajo.abrir)} />}
      {registro && <DetalleRegistro a={registro} onCerrar={() => setRegistro(null)} />}
    </div>
  )
}

// Rutas antiguas en los avisos → módulos actuales
function corregirRuta(a) {
  if (!a) return a
  return a.replace(/^\/banos/, '/inventario').replace(/^\/transporte(\?tab=mantenciones)?/, (m, t) => (t ? '/mantenimiento?tab=vehiculos' : '/flota'))
    .replace(/^\/insumos/, '/inventario?tab=insumos').replace(/^\/(despachos|rutas)$/, '/operaciones')
}

// ── 1.3 Selector de fecha ─────────────────────────────────────────────────
function SelectorFecha({ rango, onCerrar, onAplicar }) {
  const [r, setR] = useState(rango)
  const [error, setError] = useState(null)
  const aplicar = () => {
    if (!r.desde || !r.hasta) return setError('Indica ambas fechas.')
    if (r.desde > r.hasta) return setError('"Desde" no puede ser posterior a "Hasta".')
    onAplicar(r)
  }
  return (
    <Modal titulo="Seleccionar fecha" ancho={440} onCerrar={onCerrar} pie={<>
      <Boton onClick={() => onAplicar({ desde: hoyISO(), hasta: hoyISO() })}>Hoy</Boton>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={aplicar}>Aplicar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div className="cols2" style={{ gap: 12 }}>
          <Campo etiqueta="Desde"><input type="date" value={r.desde} onChange={(e) => { setR((p) => ({ ...p, desde: e.target.value })); setError(null) }} /></Campo>
          <Campo etiqueta="Hasta"><input type="date" value={r.hasta} onChange={(e) => { setR((p) => ({ ...p, hasta: e.target.value })); setError(null) }} /></Campo>
        </div>
        <Ayuda>Filtra trabajos y actividad. Las existencias (Disponibles) muestran la situación actual.</Ayuda>
        {error && <Ayuda tono="error">{error}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 1.5 Detalle del trabajo ───────────────────────────────────────────────
function DetalleTrabajo({ t, onCerrar, onAbrir }) {
  const fila = (l, v) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10, padding: '5px 0', font: '400 14px var(--font)' }}>
      <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v || '—'}</span>
    </div>
  )
  return (
    <Modal titulo={t.trabajo} ancho={520} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cerrar</Boton>
      <Boton tipo="principal" onClick={onAbrir}>{t.folio ? 'Abrir orden' : 'Abrir ruta'}</Boton>
    </>}>
      <div style={{ padding: 18 }}>
        {fila('Fecha', fecha(t.fecha))}
        {fila('Cliente', t.cliente)}
        {fila('Ubicación', t.ubicacion)}
        {fila('Equipos', t.equipos)}
        {fila('Responsable', t.responsable)}
        {fila('Ruta', t.ruta)}
        {fila('Estado', <Estado tono={t.tono}>{t.estado}</Estado>)}
        <div style={{ marginTop: 12 }}><Ayuda>Consulta rápida sin modificar datos.</Ayuda></div>
      </div>
    </Modal>
  )
}

// ── 1.4 Ver registro (actividad) ──────────────────────────────────────────
function DetalleRegistro({ a, onCerrar }) {
  const cambios = a.cambios && typeof a.cambios === 'object' ? Object.entries(a.cambios) : []
  const txt = (x) => (x === null || x === undefined ? '—' : typeof x === 'object' ? JSON.stringify(x) : String(x))
  const ocultar = /clave|password|contrasena|token/i
  return (
    <Modal titulo={`${L_TABLA[a.tabla] || a.tabla} ${L_ACCION[a.accion] || a.accion}`} ancho={640} onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div style={{ padding: 18, display: 'grid', gap: 10 }}>
        <span style={{ font: '400 14px var(--font)' }}><b>{a.etiqueta || '—'}</b> · {fechaHora(a.fecha)} · {a.usuario_nombre || '—'}</span>
        <Tabla filas={cambios.filter(([k]) => !ocultar.test(k) && k !== 'id').map(([k, val]) => ({ id: k, k, val }))} vacio="Sin detalle." columnas={[
          { k: 'k', label: 'Campo' },
          ...(a.accion === 'modificar'
            ? [{ k: 'a', label: 'Antes', render: (r) => txt(r.val?.antes) }, { k: 'd', label: 'Después', render: (r) => txt(r.val?.despues) }]
            : [{ k: 'v', label: 'Valor', render: (r) => txt(r.val) }]),
        ]} />
      </div>
    </Modal>
  )
}
