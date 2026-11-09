// Inicio (lámina 1): estado operativo del día, trabajos, actividad reciente y alertas.
// 1.1 Vista principal · 1.3 Selector de fecha · 1.4 Actividad reciente · 1.5 Detalle del trabajo.
// (1.2 Notificaciones y 1.6 Perfil están en la barra superior.)
// Los indicadores abren listados filtrados. Las existencias muestran la situación actual.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../components/Modal'
import { Boton, Campo, Tabla, Estado, Ayuda, Pestanas } from '../components/Base'
import { TarjetaGrafico, Barras, BarrasH, Dona, SERIE, Sparkline } from '../components/Graficos'
import Mapa, { Leyenda as LeyendaMapa } from '../components/Mapa'
import { useSesion, puedeOperar, puedeVer, esDueno, verFinanzas } from '../lib/sesion'
import { inicioDatos, actividadPeriodo, avisosCalculados, inicioGraficos, mapaPuntos } from '../lib/api'
import { hoyISO } from '../lib/costos'
import { C, Icon, I, fecha, fechaHora, clp } from '../lib/ui'
import { TablaCambios } from '../lib/auditoria'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const PROHIBIDO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8'

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
  const [verAlertas, setVerAlertas] = useState('alerta')   // filtro de la tarjeta: alerta (críticas) · aviso · todas
  const tarjetaAlertas = useRef(null)
  const [error, setError] = useState(null)
  const [trabajo, setTrabajo] = useState(null)
  const [registro, setRegistro] = useState(null)
  const veActividad = esDueno(perfil)
  const finanzas = verFinanzas(perfil)
  const [g, setG] = useState(null)
  // Mapa de ubicaciones de los baños (ocupa 2 columnas en pantallas anchas)
  const [puntos, setPuntos] = useState(null)
  const [ancho, setAncho] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => { mapaPuntos().then(setPuntos).catch(() => setPuntos([])) }, [])
  useEffect(() => { const f = () => setAncho(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  useEffect(() => { inicioGraficos(finanzas).then(setG).catch(() => setG({ ops: [], equipos: [], mant: [], flota: [], fin: [], clientesActivos: null })) }, [])

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

  // Alertas: atrasados + avisos calculados (insumos, mantenciones, contratos, eventos, documentos).
  // Se agrupan para que la lista no se llene de repetidos: las operaciones atrasadas van en una línea
  // (ya están en "trabajos atrasados") y los mantenimientos atrasados también.
  const mantAtrasadas = avisos.filter((a) => a.origen === 'Mantenciones' && a.nivel === 'alerta')
  const alertas = [
    ...(d?.atrasados ? [{ id: 'atr', nivel: 'alerta', texto: `${d.atrasados} operación(es) atrasada(s)`, origen: 'Operaciones', a: '/operaciones?tab=programacion&estado=pendiente' }] : []),
    ...(mantAtrasadas.length ? [{ id: 'mant-atr', nivel: 'alerta', texto: `${mantAtrasadas.length} mantenimiento(s) atrasado(s)`, origen: 'Mantenimiento', a: '/mantenimiento' }] : []),
    ...avisos.filter((a) => a.origen !== 'Despachos' && !(a.origen === 'Mantenciones' && a.nivel === 'alerta'))
      .map((a) => ({ ...a, a: corregirRuta(a.a) })),
  ].sort((x, y) => ({ alerta: 0, aviso: 1, info: 2 }[x.nivel] - { alerta: 0, aviso: 1, info: 2 }[y.nivel]) || String(x.fecha || '').localeCompare(String(y.fecha || '')))
  const cuentaNivel = (n) => alertas.filter((a) => a.nivel === n).length
  const alertasVista = verAlertas === 'todas' ? alertas : alertas.filter((a) => (verAlertas === 'aviso' ? a.nivel !== 'alerta' : a.nivel === 'alerta'))
  const irAlertas = () => { setVerAlertas('alerta'); tarjetaAlertas.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }

  // ── Datos de los gráficos ──
  const graf = armarGraficos(g)
  const TILES = [
    { l: 'Clientes activos', n: g?.clientesActivos, d: I.users, color: C.azul, fondo: C.tinte, ir: '/clientes' },
    { l: 'Equipos disponibles', n: d?.disponibles, s: g ? `de ${g.equipos.length} propios` : null, d: I.box, color: C.verde, fondo: 'rgba(0,201,141,.14)', ir: '/inventario' },
    { l: unDia && rango.desde === hoy ? 'Trabajos del día' : 'Trabajos del período', n: trabajos?.length, d: I.cal, color: C.azul, fondo: C.tinte, ir: '/operaciones?tab=programacion',
      spark: graf.prog, sparkT: 'Operaciones programadas por mes (últimos 6 meses)' },
    { l: 'Atrasados', n: d?.atrasados, rojo: !!d?.atrasados, s: 'Operaciones sin realizar', d: I.alert, color: C.rojo, fondo: 'rgba(239,68,68,.14)', ir: '/operaciones?tab=programacion&estado=pendiente' },
    ...(puedeVer(perfil, 'mantenciones') ? [{ l: 'Mantenimientos pendientes', n: d?.mant, d: I.wrench, color: C.amarillo, fondo: 'rgba(245,158,11,.14)', ir: '/mantenimiento' }] : []),
    { l: 'Alertas críticas', n: d ? alertas.filter((a) => a.nivel === 'alerta').length : null, rojo: alertas.some((a) => a.nivel === 'alerta'), d: PROHIBIDO, color: C.rojo, fondo: 'rgba(239,68,68,.14)', ir: irAlertas },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: 28, lineHeight: '34px' }}>{saludo()}{perfil?.nombre ? <>, <span style={{ background: 'var(--degradado)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{perfil.nombre.split(' ')[0]}</span></> : ''}</h2>
          <span className="text-muted">Centro de control de FOSAN · {fecha(hoy)}</span>
        </div>
        <Boton icono={I.cal} onClick={() => setElegirFecha(true)}>{titRango}</Boton>
        {puedeOperar(perfil, 'rutas') && <Boton tipo="principal" icono={I.plus} onClick={() => navegar('/operaciones?tab=programacion&nueva=1')}>Nueva orden</Boton>}
      </div>

      {/* Indicadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {TILES.map((k) => (
          <button key={k.l} type="button" onClick={() => (typeof k.ir === 'function' ? k.ir() : navegar(k.ir))} className="card kpi"
            style={{ display: 'grid', gap: 6, padding: 16, textAlign: 'left', cursor: 'pointer', position: 'relative', '--kpi': k.color }}>
            <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: k.fondo,
                border: `1px solid ${k.color}55`, boxShadow: `0 0 18px ${k.color}22` }}><Icon d={k.d} size={20} color={k.color} /></span>
              {k.spark && <Sparkline datos={k.spark} color={C.azulClaro} titulo={k.sparkT} />}
            </span>
            <b style={{ font: '700 30px/1 var(--font)', color: k.rojo ? C.rojo : C.tinta, marginTop: 4, textShadow: k.rojo ? '0 0 18px rgba(239,68,68,.35)' : 'none' }}>{k.n ?? '…'}</b>
            <span style={{ font: '600 13px var(--font)', color: C.tinta }}>{k.l}</span>
            {k.s && <small className="text-muted" style={{ marginTop: -4 }}>{k.s}</small>}
          </button>
        ))}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <TarjetaGrafico titulo="Operaciones por mes" sub="Programadas vs realizadas · últimos 6 meses"
          tabla={{ columnas: ['Mes', 'Programadas', 'Realizadas'], filas: graf.meses.map((m, i) => [m, graf.prog[i], graf.real[i]]) }}>
          <Barras etiquetas={graf.meses} series={[{ l: 'Programadas', c: SERIE[0], datos: graf.prog }, { l: 'Realizadas', c: '#5CD6FF', datos: graf.real }]}
            onBarra={() => navegar('/operaciones?tab=programacion')} />
        </TarjetaGrafico>

        <TarjetaGrafico titulo="Situación de los equipos" sub="Equipos propios · situación actual"
          tabla={{ columnas: ['Situación', 'Equipos'], filas: graf.situacion.map((p) => [p.l, p.v]) }}>
          <Dona partes={graf.situacion.map((p) => ({ ...p, onClick: () => navegar('/inventario') }))} sub="equipos" />
        </TarjetaGrafico>

        {puedeVer(perfil, 'mantenciones') && (
          <TarjetaGrafico titulo="Estado del mantenimiento" sub="Equipos y vehículos"
            tabla={{ columnas: ['Estado', 'Mantenimientos'], filas: graf.mant.map((p) => [p.l, p.v]) }}>
            <BarrasH items={graf.mant.map((p) => ({ ...p, onClick: () => navegar('/mantenimiento') }))} />
          </TarjetaGrafico>
        )}

        <TarjetaGrafico titulo="Clientes con más baños" sub="Top 5 por unidades asignadas"
          tabla={{ columnas: ['Cliente', 'Baños'], filas: graf.top.map((p) => [p.l, p.v]) }}>
          <BarrasH items={graf.top.map((p) => ({ ...p, onClick: () => navegar('/clientes?q=' + encodeURIComponent(p.l)) }))} vacio="Sin baños asignados." />
        </TarjetaGrafico>

        {finanzas && graf.fin.etiquetas.length > 0 ? (
          <TarjetaGrafico titulo="Ventas vs costos" sub="Últimos 6 meses · desde Análisis"
            tabla={{ columnas: ['Mes', 'Ventas', 'Costos'], filas: graf.fin.etiquetas.map((m, i) => [m, clp(graf.fin.ventas[i]), clp(graf.fin.costos[i])]) }}>
            <Barras etiquetas={graf.fin.etiquetas} fmt={clp} series={[{ l: 'Ventas', c: SERIE[0], datos: graf.fin.ventas }, { l: 'Costos', c: SERIE[1], datos: graf.fin.costos }]}
              onBarra={() => navegar('/reportes?tab=analisis')} />
          </TarjetaGrafico>
        ) : (
          <TarjetaGrafico titulo="Estado de la flota" sub="Vehículos activos"
            tabla={{ columnas: ['Estado', 'Vehículos'], filas: graf.flota.map((p) => [p.l, p.v]) }}>
            <BarrasH items={graf.flota.map((p) => ({ ...p, onClick: () => navegar('/flota') }))} vacio="Sin vehículos." />
          </TarjetaGrafico>
        )}

        <div ref={tarjetaAlertas} style={{ display: 'grid', minWidth: 0 }}>
        <TarjetaGrafico titulo="Alertas y acciones pendientes" sub={`${cuentaNivel('alerta')} crítica(s) · ${alertas.length - cuentaNivel('alerta')} aviso(s)`}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['alerta', `Críticas (${cuentaNivel('alerta')})`], ['aviso', `Avisos (${alertas.length - cuentaNivel('alerta')})`], ['todas', `Todas (${alertas.length})`]].map(([k, l]) => (
              <button key={k} type="button" className={verAlertas === k ? 'btn btn-azul' : 'btn'} onClick={() => setVerAlertas(k)}
                style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'grid', maxHeight: 250, overflowY: 'auto' }}>
            {alertasVista.length === 0 && <div className="text-muted" style={{ padding: '12px 0' }}>{verAlertas === 'alerta' ? 'Sin alertas críticas.' : 'Sin avisos pendientes.'}</div>}
            {alertasVista.map((a) => {
              const nv = NIVEL[a.nivel] || NIVEL.info
              return (
                <button key={a.id} type="button" onClick={a.a ? () => navegar(a.a) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', border: 0, borderBottom: `1px solid ${C.fila}`, background: 'transparent', textAlign: 'left', cursor: a.a ? 'pointer' : 'default' }}>
                  <Icon d={nv.d} size={18} color={nv.color} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: 'block', font: '600 13px/1.35 var(--font)', color: C.tinta }}>{a.texto}</b>
                    {a.origen && <small className="text-muted">{a.origen}</small>}
                  </span>
                  {a.a && <span style={{ color: C.gris, font: '400 18px var(--font)' }}>›</span>}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Boton icono={I.pin} onClick={() => navegar('/inventario?tab=mapa')} style={{ flex: 1 }}>Ver mapa</Boton>
            <Boton icono={I.cal} onClick={onCalendario} style={{ flex: 1 }}>Ver calendario</Boton>
          </div>
        </TarjetaGrafico>
        </div>

        {puedeVer(perfil, 'ubicaciones') && (
          <div style={{ gridColumn: ancho >= 1100 ? 'span 2' : 'auto', minWidth: 0, display: 'grid' }}>
            <TarjetaGrafico titulo="Ubicación de los baños" sub={puntos ? `${puntos.length} ubicación(es) con equipos` : 'Cargando…'}
              accion={<button type="button" onClick={() => navegar('/inventario?tab=mapa')} style={{ border: 0, background: 'transparent', color: C.azul, cursor: 'pointer', font: '600 12px var(--font)', whiteSpace: 'nowrap' }}>Ver mapa completo</button>}>
              <div style={{ borderRadius: 'var(--radio-md)', overflow: 'hidden', border: `1px solid ${C.borde}` }}>
                <Mapa puntos={puntos || []} alto={300} />
              </div>
              <LeyendaMapa />
            </TarjetaGrafico>
          </div>
        )}
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}

      <div>
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
  return (
    <Modal titulo={`${L_TABLA[a.tabla] || a.tabla} ${L_ACCION[a.accion] || a.accion}`} ancho={640} onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div style={{ padding: 18, display: 'grid', gap: 10 }}>
        <span style={{ font: '400 14px var(--font)' }}><b>{a.etiqueta || '—'}</b> · {fechaHora(a.fecha)} · {a.usuario_nombre || '—'}</span>
        <TablaCambios accion={a.accion} cambios={a.cambios} />
      </div>
    </Modal>
  )
}

function saludo() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

// Prepara los datos de los gráficos a partir de inicioGraficos()
function armarGraficos(g) {
  const hoy = new Date()
  const claves = Array.from({ length: 6 }, (_, i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1); return d.toISOString().slice(0, 7) })
  const meses = claves.map((k) => MESES[Number(k.slice(5, 7)) - 1])
  const ops = g?.ops || []
  const prog = claves.map((k) => ops.filter((o) => o.estado !== 'cancelado' && String(o.fecha_programada).startsWith(k)).length)
  const real = claves.map((k) => ops.filter((o) => o.estado === 'hecho' && String(o.fecha_realizada || o.fecha_programada).startsWith(k)).length)
  const eq = g?.equipos || []
  const cuenta = (f) => eq.filter(f).length
  const situacion = [
    { l: 'Asignados', v: cuenta((e) => e.situacion === 'asignado'), c: SERIE[0] },
    { l: 'Reservados', v: cuenta((e) => e.situacion === 'reservado'), c: SERIE[1] },
    { l: 'Disponibles', v: cuenta((e) => e.situacion === 'disponible'), c: SERIE[2] },
    { l: 'En mantenimiento', v: cuenta((e) => e.situacion === 'en_mantenimiento'), c: SERIE[3] },
    { l: 'Otros', v: cuenta((e) => !['asignado', 'reservado', 'disponible', 'en_mantenimiento'].includes(e.situacion)), c: SERIE[4] },
  ].filter((p) => p.v > 0 || p.l !== 'Otros')
  const m = g?.mant || []
  const mant = [
    { l: 'Programados', v: m.filter((x) => x.estado_m === 'programado' && !x.vencido).length, c: C.azul },
    { l: 'En curso', v: m.filter((x) => x.estado_m === 'en_curso' && !x.vencido).length, c: C.amarillo },
    { l: 'Vencidos', v: m.filter((x) => x.vencido).length, c: C.rojo },
    { l: 'Completados', v: m.filter((x) => x.estado_m === 'completado').length, c: C.verde },
  ]
  const porCliente = {}
  eq.filter((e) => e.situacion === 'asignado' && e.cliente).forEach((e) => { porCliente[e.cliente] = (porCliente[e.cliente] || 0) + 1 })
  const top = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, v]) => ({ l, v }))
  const fl = g?.flota || []
  const flota = [
    { l: 'Disponibles', v: fl.filter((x) => x.estado_flota === 'disponible').length, c: C.verde },
    { l: 'En ruta', v: fl.filter((x) => x.estado_flota === 'en_ruta').length, c: C.azul },
    { l: 'En mantenimiento', v: fl.filter((x) => x.estado_flota === 'mantenimiento').length, c: C.amarillo },
    { l: 'Fuera de servicio', v: fl.filter((x) => x.estado_flota === 'fuera_servicio').length, c: C.rojo },
  ]
  const fin = (g?.fin || []).filter((x) => x.mes).sort((a, b) => String(a.mes).localeCompare(String(b.mes))).slice(-6)
  return {
    meses, prog, real, situacion, mant, top, flota,
    fin: { etiquetas: fin.map((x) => MESES[Number(String(x.mes).slice(5, 7)) - 1] || String(x.mes)), ventas: fin.map((x) => Number(x.ventas || 0)), costos: fin.map((x) => Number(x.costos || 0)) },
  }
}
