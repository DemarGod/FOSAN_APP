// Reportes (lámina 7): consulta, filtros y exportación sin volver a ingresar datos.
// 7.1 Pestañas con informes · 7.2 Configurar (filtros según el informe) · 7.3 Vista previa con totales · 7.4 Exportar PDF / XLSX / CSV.
// Pestaña Análisis: lo que antes era la página Análisis (costos y rentabilidad) + Ventas y utilidad.
// Existencias = situación actual (sin fechas históricas). Costos solo con "Ver montos".
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { guardarLibro, exportarCSV } from '../lib/excel'
import Modal from '../components/Modal'
import { Boton, Campo, Tabla, Ayuda, Pestanas } from '../components/Base'
import Analisis from './Analisis'
import ResumenFinanciero from '../components/ResumenFinanciero'
import { supabase } from '../lib/supabase'
import { equiposLista, insumosInventario, ubicacionesInsumo, operaciones, flota, personalActivo, parametros, mantenimiento, catCategorias } from '../lib/api'
import { costoKmVehiculo, mapaParametros, hoyISO } from '../lib/costos'
import { useSesion, puedeVer, verFinanzas } from '../lib/sesion'
import { C, Icon, I, fecha, fechaHora, clp } from '../lib/ui'

const rows = async (q) => { const { data, error } = await q; if (error) throw error; return data || [] }
const inicioMes = () => hoyISO().slice(0, 8) + '01'
const contiene = (a, b) => !b || String(a || '').toLowerCase().includes(String(b).toLowerCase().trim())
const L_SIT = { disponible: 'Disponible', reservado: 'Reservado', asignado: 'Asignado', en_traslado: 'En traslado', en_mantenimiento: 'En mantenimiento', no_localizado: 'No localizado', baja: 'Baja' }
const L_COND = { operativo: 'Operativo', requiere_limpieza: 'Requiere limpieza', requiere_reparacion: 'Requiere reparación', sin_evaluar: 'Sin evaluar' }
const L_SERV = { arriendo_limpieza: 'Arriendo de baños', limpieza_cliente: 'Limpieza de baños del cliente', limpieza_fosas: 'Limpieza de fosa' }
const L_ACC = { entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio', limpieza: 'Limpieza' }
const L_OP = { programada: 'Programada', realizada: 'Realizada', pendiente: 'Atrasada', cancelada: 'Cancelada' }
const L_RUTA = { programada: 'Programada', en_curso: 'En curso', finalizada: 'Finalizada', cancelada: 'Cancelada' }
const L_DISP = { disponible: 'Disponible', mantencion: 'En mantenimiento', fuera_de_servicio: 'Fuera de servicio', baja: 'Desactivado' }
const L_MANT = { programado: 'Programado', en_curso: 'En curso', completado: 'Completado', cancelado: 'Cancelado' }
const L_RES = { finalizado: 'Finalizado', requiere_seguimiento: 'Requiere seguimiento' }
const opts = (o) => Object.entries(o).map(([v, l]) => ({ v, l }))
const estadoRuta = (s) => (s.estado === 'cerrada' ? 'finalizada' : s.estado === 'cancelada' ? 'cancelada' : s.odometro_salida != null ? 'en_curso' : 'programada')
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—')

// ── Catálogo de informes ──────────────────────────────────────────────────
// filtros: { k, l, tipo: 'select' | 'texto', opciones: [{v,l}] | (listas) => [{v,l}] }
// cargar(f, ctx) → filas · columnas: { k, l, fmt?, num?, fin? } · totales(filas, ctx) → [[etiqueta, valor]]
const INFORMES = [
  {
    id: 'existencias_equipos', tab: 'inventario', icono: I.box, titulo: 'Existencias de equipos', desc: 'Situación y ubicación actuales.', fechas: false,
    filtros: [
      { k: 'categoria', l: 'Categoría', tipo: 'select', opciones: (L) => L.categorias },
      { k: 'situacion', l: 'Situación', tipo: 'select', opciones: opts(L_SIT) },
      { k: 'condicion', l: 'Condición', tipo: 'select', opciones: opts(L_COND) },
      { k: 'ubicacion', l: 'Ubicación', tipo: 'texto' },
      { k: 'cliente', l: 'Cliente', tipo: 'texto' },
    ],
    cargar: async (f) => (await equiposLista()).filter((e) => e.propiedad === 'empresa'
      && (f.situacion ? e.situacion === f.situacion : e.situacion !== 'baja')
      && (!f.categoria || e.categoria === f.categoria) && (!f.condicion || e.condicion === f.condicion)
      && contiene(e.ubicacion, f.ubicacion) && contiene(e.cliente, f.cliente))
      .map((e) => ({ numero_unidad: e.codigo, categoria: e.categoria || '', modelo: e.modelo || '', situacion: L_SIT[e.situacion] || e.situacion, condicion: L_COND[e.condicion] || e.condicion, ubicacion: e.ubicacion || '', cliente: e.cliente || '' })),
    columnas: [{ k: 'numero_unidad', l: 'N.º unidad' }, { k: 'categoria', l: 'Categoría' }, { k: 'modelo', l: 'Modelo' }, { k: 'situacion', l: 'Situación' }, { k: 'condicion', l: 'Condición' }, { k: 'ubicacion', l: 'Ubicación' }, { k: 'cliente', l: 'Cliente' }],
    totales: (r) => [['Unidades', r.length], ...Object.values(L_SIT).map((s) => [s, r.filter((x) => x.situacion === s).length]).filter(([, n]) => n)],
  },
  {
    id: 'movimientos_equipos', tab: 'inventario', icono: I.truck, titulo: 'Movimientos de equipos', desc: 'Entregas, retiros y traslados por fecha.', fechas: true,
    filtros: [{ k: 'unidad', l: 'N.º unidad', tipo: 'texto' }, { k: 'tipo', l: 'Tipo de movimiento', tipo: 'texto' }, { k: 'cliente', l: 'Cliente', tipo: 'texto' }],
    cargar: async (f) => (await rows(supabase.from('movimientos_activo')
      .select('id, fecha, tipo, detalle, activos(codigo, tipo), desde:desde_id(nombre), hacia:hacia_id(nombre), clientes(nombre), responsable:responsable_id(nombre)')
      .gte('fecha', f.desde).lte('fecha', f.hasta + 'T23:59:59').order('fecha', { ascending: false }).limit(5000)))
      .filter((m) => !['camion', 'camioneta'].includes(m.activos?.tipo) && contiene(m.activos?.codigo, f.unidad) && contiene(m.tipo, f.tipo) && contiene(m.clientes?.nombre, f.cliente))
      .map((m) => ({ fecha: m.fecha, numero_unidad: m.activos?.codigo || '', tipo: m.tipo || '', desde: m.desde?.nombre || '', hacia: m.hacia?.nombre || '', cliente: m.clientes?.nombre || '', responsable: m.responsable?.nombre || '', detalle: m.detalle || '' })),
    columnas: [{ k: 'fecha', l: 'Fecha y hora', fmt: fechaHora }, { k: 'numero_unidad', l: 'N.º unidad' }, { k: 'tipo', l: 'Tipo' }, { k: 'desde', l: 'Desde' }, { k: 'hacia', l: 'Hacia' }, { k: 'cliente', l: 'Cliente' }, { k: 'responsable', l: 'Responsable' }, { k: 'detalle', l: 'Detalle' }],
    totales: (r) => [['Movimientos', r.length], ['Unidades distintas', new Set(r.map((x) => x.numero_unidad)).size]],
  },
  {
    id: 'existencias_insumos', tab: 'inventario', icono: I.drop, titulo: 'Existencias de insumos', desc: 'Cantidades por artículo y ubicación.', fechas: false,
    filtros: [{ k: 'ubicacion', l: 'Ubicación', tipo: 'select', opciones: (L) => L.ubicaciones }, { k: 'articulo', l: 'Artículo', tipo: 'texto' }],
    cargar: async (f, ctx) => (await insumosInventario()).filter((i) => i.activo !== false && (contiene(i.nombre, f.articulo) || contiene(i.codigo, f.articulo)))
      .flatMap((i) => i.existencias.filter((e) => Number(e.cantidad) !== 0 && (!f.ubicacion || e.ubicacion_id === f.ubicacion)).map((e) => ({
        codigo: i.codigo || '', articulo: i.nombre, unidad: i.unidades_medida?.abreviatura || i.unidad || '', ubicacion: ctx.nombreUbic(e.ubicacion_id),
        lote: e.insumo_lotes?.codigo || '', vencimiento: e.insumo_lotes?.vencimiento || '', cantidad: Number(e.cantidad),
      }))),
    columnas: [{ k: 'codigo', l: 'Código' }, { k: 'articulo', l: 'Artículo' }, { k: 'ubicacion', l: 'Ubicación' }, { k: 'lote', l: 'Lote' }, { k: 'vencimiento', l: 'Vencimiento', fmt: (x) => (x ? fecha(x) : '') }, { k: 'cantidad', l: 'Cantidad', num: true }, { k: 'unidad', l: 'Unidad' }],
    totales: (r) => [['Registros', r.length], ['Artículos', new Set(r.map((x) => x.codigo)).size]],
    nota: 'El stock se informa por artículo y unidad: no se suman litros con unidades.',
  },
  {
    id: 'consumo_insumos', tab: 'inventario', icono: I.users, titulo: 'Consumo de insumos y EPP', desc: 'Salidas por servicio o persona.', fechas: true,
    filtros: [{ k: 'articulo', l: 'Artículo', tipo: 'texto' }, { k: 'destino', l: 'Servicio, cliente o persona', tipo: 'texto' }],
    cargar: async (f) => (await rows(supabase.from('movimientos_insumo')
      .select('id, fecha, tipo, cantidad, motivo, referencia, receptor, insumos(codigo, nombre, unidad), origen:origen_id(nombre), servicios_cliente(codigo, clientes(nombre)), perfiles:usuario_id(nombre)')
      .or('tipo.eq.consumo,and(tipo.is.null,cantidad.lt.0)').gte('fecha', f.desde).lte('fecha', f.hasta + 'T23:59:59').order('fecha', { ascending: false }).limit(5000)))
      .map((m) => ({ fecha: m.fecha, codigo: m.insumos?.codigo || '', articulo: m.insumos?.nombre || '', cantidad: Math.abs(Number(m.cantidad)), unidad: m.insumos?.unidad || '',
        origen: m.origen?.nombre || '', servicio: m.servicios_cliente ? `${m.servicios_cliente.codigo} · ${m.servicios_cliente.clientes?.nombre || ''}` : (m.tipo ? '' : 'Limpieza de ruta'),
        receptor: m.receptor || '', usuario: m.perfiles?.nombre || '', motivo: m.motivo || m.referencia || '' }))
      .filter((m) => (contiene(m.articulo, f.articulo) || contiene(m.codigo, f.articulo)) && (contiene(m.servicio, f.destino) || contiene(m.receptor, f.destino))),
    columnas: [{ k: 'fecha', l: 'Fecha', fmt: fechaHora }, { k: 'codigo', l: 'Código' }, { k: 'articulo', l: 'Artículo' }, { k: 'cantidad', l: 'Cantidad', num: true }, { k: 'unidad', l: 'Unidad' }, { k: 'origen', l: 'Origen' }, { k: 'servicio', l: 'Servicio / cliente' }, { k: 'receptor', l: 'Persona receptora' }, { k: 'usuario', l: 'Registró' }],
    totales: (r) => [['Consumos', r.length], ['Artículos', new Set(r.map((x) => x.codigo)).size]],
  },
  {
    id: 'cumplimiento_operaciones', tab: 'operaciones', icono: I.check, titulo: 'Cumplimiento de operaciones', desc: 'Programadas, realizadas, atrasadas y canceladas.', fechas: true,
    filtros: [
      { k: 'servicio', l: 'Servicio', tipo: 'select', opciones: opts(L_SERV) },
      { k: 'estado', l: 'Estado', tipo: 'select', opciones: opts(L_OP) },
      { k: 'patente', l: 'Patente', tipo: 'select', opciones: (L) => L.patentes },
      { k: 'responsable', l: 'Responsable', tipo: 'select', opciones: (L) => L.personas },
      { k: 'cliente', l: 'Cliente', tipo: 'texto' },
    ],
    cargar: async (f) => (await operaciones(f.desde, f.hasta)).filter((o) => (!f.servicio || o.servicio_tipo === f.servicio) && (!f.estado || o.estado_op === f.estado)
      && (!f.patente || o.patente === f.patente) && (!f.responsable || o.responsable === f.responsable) && contiene(o.cliente, f.cliente))
      .map((o) => ({ folio: o.folio, fecha: o.fecha_programada, servicio: `${L_SERV[o.servicio_tipo] || 'Sin servicio'} · ${L_ACC[o.tipo] || o.tipo}`, cliente: o.cliente, ubicacion: o.ubicacion || '',
        unidades: o.unidades || '', patente: o.patente || '', responsable: o.responsable || '', estado: L_OP[o.estado_op], realizada: o.fecha_realizada || '' }))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    columnas: [{ k: 'folio', l: 'Folio' }, { k: 'fecha', l: 'Fecha', fmt: fecha }, { k: 'servicio', l: 'Servicio y acción' }, { k: 'cliente', l: 'Cliente' }, { k: 'ubicacion', l: 'Ubicación' }, { k: 'unidades', l: 'Unidades' }, { k: 'patente', l: 'Patente' }, { k: 'responsable', l: 'Responsable' }, { k: 'estado', l: 'Estado' }, { k: 'realizada', l: 'Realizada', fmt: (x) => (x ? fecha(x) : '') }],
    totales: (r) => {
      const n = (e) => r.filter((x) => x.estado === e).length, vigentes = r.length - n('Cancelada')
      return [['Operaciones', r.length], ['Realizadas', n('Realizada')], ['Programadas', n('Programada')], ['Atrasadas', n('Atrasada')], ['Canceladas', n('Cancelada')], ['Cumplimiento', pct(n('Realizada'), vigentes)]]
    },
    nota: 'Cumplimiento = realizadas sobre operaciones no canceladas del período.',
  },
  {
    id: 'rutas_dia', tab: 'operaciones', icono: I.pin, titulo: 'Rutas por día', desc: 'Paradas programadas y realizadas por ruta.', fechas: true,
    filtros: [{ k: 'ruta', l: 'Ruta', tipo: 'texto' }, { k: 'patente', l: 'Patente', tipo: 'select', opciones: (L) => L.patentes }, { k: 'estado', l: 'Estado de ruta', tipo: 'select', opciones: opts(L_RUTA) }],
    cargar: async (f, ctx) => (await ctx.salidas(f)).filter((s) => contiene(s._ruta, f.ruta) && (!f.patente || s._patente === f.patente) && (!f.estado || s._estado === f.estado))
      .map((s) => ({ fecha: s.fecha, ruta: s._ruta, patente: s._patente, estado: L_RUTA[s._estado], paradas: Number(s.paradas || 0), realizadas: Number(s.paradas_hechas || 0), km: s.km_real != null ? Number(s.km_real) : '' })),
    columnas: [{ k: 'fecha', l: 'Fecha', fmt: fecha }, { k: 'ruta', l: 'Ruta' }, { k: 'patente', l: 'Patente' }, { k: 'estado', l: 'Estado' }, { k: 'paradas', l: 'Paradas', num: true }, { k: 'realizadas', l: 'Realizadas', num: true }, { k: 'km', l: 'Km', num: true }],
    totales: (r) => { const p = r.reduce((s, x) => s + x.paradas, 0), h = r.reduce((s, x) => s + x.realizadas, 0); return [['Días de ruta', r.length], ['Paradas', p], ['Realizadas', h], ['Cumplimiento', pct(h, p)]] },
  },
  {
    id: 'km_costo', tab: 'flota', icono: I.truck, titulo: 'Kilometraje y costo de recorridos', desc: 'Km confirmados y costo por ruta y patente.', fechas: true,
    filtros: [{ k: 'patente', l: 'Patente', tipo: 'select', opciones: (L) => L.patentes }, { k: 'estado', l: 'Estado de ruta', tipo: 'select', opciones: opts(L_RUTA) }],
    cargar: async (f, ctx) => (await ctx.salidas(f)).filter((s) => (!f.patente || s._patente === f.patente) && (!f.estado || s._estado === f.estado))
      .map((s) => {
        const km = s._estado === 'finalizada' && s.km_real != null ? Number(s.km_real) : null
        const ckm = Math.round(costoKmVehiculo(s, ctx.par).total || 0)
        return { fecha: s.fecha, ruta: s._ruta, patente: s._patente, estado: L_RUTA[s._estado], km_recorridos: km ?? 'Pendiente', costo_km: ckm || '', costo_recorrido: km != null && ckm ? Math.round(km * ckm) : 'Pendiente' }
      }),
    columnas: [{ k: 'fecha', l: 'Fecha', fmt: fecha }, { k: 'ruta', l: 'Ruta' }, { k: 'patente', l: 'Patente' }, { k: 'estado', l: 'Estado' }, { k: 'km_recorridos', l: 'Km recorridos', num: true },
      { k: 'costo_km', l: 'Costo por km aplicado', fin: true, fmt: (x) => (typeof x === 'number' ? clp(x) : x) }, { k: 'costo_recorrido', l: 'Costo del recorrido', fin: true, fmt: (x) => (typeof x === 'number' ? clp(x) : x) }],
    totales: (r, ctx) => {
      const ok = r.filter((x) => typeof x.km_recorridos === 'number')
      return [['Total km confirmados', ok.reduce((s, x) => s + x.km_recorridos, 0)],
        ...(ctx.finanzas ? [['Costo calculado confirmado', clp(ok.reduce((s, x) => s + (typeof x.costo_recorrido === 'number' ? x.costo_recorrido : 0), 0))]] : []),
        ['Rutas pendientes de cierre (no incluidas)', r.length - ok.length]]
    },
    nota: 'El costo usa el costo por km de cada vehículo. No asigna todo el costo a cada cliente ni suma varias veces una ruta.',
  },
  {
    id: 'disponibilidad_flota', tab: 'flota', icono: I.check, titulo: 'Disponibilidad de la flota', desc: 'Cambios de disponibilidad con motivo.', fechas: true,
    filtros: [{ k: 'patente', l: 'Patente', tipo: 'select', opciones: (L) => L.patentes }],
    cargar: async (f, ctx) => (await rows(supabase.from('vehiculo_disponibilidad').select('*').gte('fecha', f.desde).lte('fecha', f.hasta).order('fecha', { ascending: false })))
      .map((d) => ({ fecha: d.fecha, patente: ctx.patenteDe(d.activo_id), estado: L_DISP[d.estado] || d.estado, motivo: d.motivo || '', registrado: d.creado_en }))
      .filter((d) => !f.patente || d.patente === f.patente),
    columnas: [{ k: 'fecha', l: 'Fecha', fmt: fecha }, { k: 'patente', l: 'Patente' }, { k: 'estado', l: 'Estado' }, { k: 'motivo', l: 'Motivo' }, { k: 'registrado', l: 'Registrado', fmt: fechaHora }],
    totales: (r) => [['Cambios', r.length], ['Vehículos', new Set(r.map((x) => x.patente)).size]],
  },
  {
    id: 'mantenimientos', tab: 'mantenimiento', icono: I.wrench, titulo: 'Mantenimientos', desc: 'Trabajos pendientes y realizados por unidad o patente.', fechas: true,
    filtros: [
      { k: 'clase', l: 'Clase', tipo: 'select', opciones: [{ v: 'equipo', l: 'Equipos' }, { v: 'vehiculo', l: 'Vehículos' }] },
      { k: 'estado', l: 'Estado', tipo: 'select', opciones: [...opts(L_MANT), { v: 'vencido', l: 'Vencido' }] },
      { k: 'tipo', l: 'Tipo', tipo: 'texto' }, { k: 'identificacion', l: 'Unidad o patente', tipo: 'texto' }, { k: 'responsable', l: 'Responsable', tipo: 'texto' },
    ],
    cargar: async (f) => (await mantenimiento()).filter((m) => m.fecha_programada >= f.desde && m.fecha_programada <= f.hasta && (!f.clase || m.clase === f.clase)
      && (f.estado === 'vencido' ? m.vencido : !f.estado || m.estado_m === f.estado) && contiene(m.tipo, f.tipo) && contiene(m.identificacion, f.identificacion) && contiene(m.responsable, f.responsable))
      .map((m) => ({ folio: m.folio, identificacion: m.identificacion, clase: m.clase === 'vehiculo' ? 'Vehículo' : 'Equipo', tipo: m.tipo, fecha_programada: m.fecha_programada, fecha_realizacion: m.fecha_realizada || '',
        responsable: m.responsable || '', estado: L_MANT[m.estado_m] + (m.vencido ? ' (vencido)' : ''), resultado: m.estado_m === 'cancelado' ? `Cancelado: ${m.motivo_cancelacion || ''}` : L_RES[m.resultado] || '', costo: Number(m.costo || 0) }))
      .sort((a, b) => String(a.fecha_programada).localeCompare(String(b.fecha_programada))),
    columnas: [{ k: 'folio', l: 'Folio' }, { k: 'identificacion', l: 'Unidad / patente' }, { k: 'clase', l: 'Clase' }, { k: 'tipo', l: 'Tipo' }, { k: 'fecha_programada', l: 'Programada', fmt: fecha },
      { k: 'fecha_realizacion', l: 'Realizada', fmt: (x) => (x ? fecha(x) : '') }, { k: 'responsable', l: 'Responsable' }, { k: 'estado', l: 'Estado' }, { k: 'resultado', l: 'Resultado' }, { k: 'costo', l: 'Costo', num: true, fin: true, fmt: clp }],
    totales: (r, ctx) => [['Trabajos', r.length], ['Completados', r.filter((x) => x.estado.startsWith('Completado')).length],
      ['Pendientes', r.filter((x) => /^(Programado|En curso)/.test(x.estado)).length], ['Vencidos', r.filter((x) => x.estado.includes('vencido')).length],
      ['Cancelados', r.filter((x) => x.estado.startsWith('Cancelado')).length], ...(ctx.finanzas ? [['Costo total', clp(r.reduce((s, x) => s + x.costo, 0))]] : [])],
  },
]
const TABS = [
  { v: 'inventario', l: 'Inventario', nota: 'Otras pestañas: Operaciones → cumplimiento de servicios y rutas. Flota → kilometraje y costo de recorridos. Mantenimiento → trabajos pendientes y realizados.' },
  { v: 'operaciones', l: 'Operaciones' }, { v: 'flota', l: 'Flota' }, { v: 'mantenimiento', l: 'Mantenimiento' }, { v: 'analisis', l: 'Análisis' },
]

export default function Reportes() {
  const { perfil } = useSesion()
  const verRep = puedeVer(perfil, 'reportes'), verAna = puedeVer(perfil, 'analisis')
  const finanzas = verFinanzas(perfil)
  const [params, setParams] = useSearchParams()
  const tabs = TABS.filter((t) => (t.v === 'analisis' ? verAna : verRep))
  const tab = tabs.some((t) => t.v === params.get('tab')) ? params.get('tab') : tabs[0]?.v
  const [sel, setSel] = useState(null)
  useEffect(() => { setSel(null) }, [tab])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Reportes</h2>
      <Pestanas opciones={tabs} valor={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      {tab === 'analisis' ? <PestanaAnalisis /> : sel
        ? <Informe inf={sel} finanzas={finanzas} onVolver={() => setSel(null)} />
        : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {INFORMES.filter((x) => x.tab === tab).map((x) => (
                <section key={x.id} className="card" style={{ padding: 18, display: 'grid', gap: 10, justifyItems: 'start' }}>
                  <Icon d={x.icono} size={30} color={C.azul} />
                  <div><b style={{ font: '700 16px var(--font)' }}>{x.titulo}</b><div className="text-muted">{x.desc}</div></div>
                  <Boton tipo="principal" onClick={() => setSel(x)}>Seleccionar</Boton>
                </section>
              ))}
            </div>
            {TABS.find((t) => t.v === tab)?.nota && <Ayuda>{TABS.find((t) => t.v === tab).nota}</Ayuda>}
          </>
        )}
    </div>
  )
}

// ── Pestaña Análisis: lo que antes era la página Análisis + Ventas y utilidad ──
function PestanaAnalisis() {
  const [sub, setSub] = useState('costos')
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Boton tipo={sub === 'costos' ? 'principal' : 'secundario'} onClick={() => setSub('costos')}>Costos y rentabilidad</Boton>
        <Boton tipo={sub === 'ventas' ? 'principal' : 'secundario'} onClick={() => setSub('ventas')}>Ventas y utilidad</Boton>
      </div>
      {sub === 'costos' ? <Analisis /> : <ResumenFinanciero />}
    </div>
  )
}

// ── 7.2 Configurar · 7.3 Vista previa ────────────────────────────────────
function Informe({ inf, finanzas, onVolver }) {
  const VACIO = { desde: inicioMes(), hasta: hoyISO(), ...Object.fromEntries(inf.filtros.map((x) => [x.k, ''])) }
  const [f, setF] = useState(VACIO)
  const [listas, setListas] = useState({ categorias: [], ubicaciones: [], patentes: [], personas: [] })
  const [ctx, setCtx] = useState(null)
  const [filas, setFilas] = useState(null)        // null = configurando
  const [aplicado, setAplicado] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [exportar, setExportar] = useState(false)

  useEffect(() => {
    Promise.all([catCategorias().catch(() => []), ubicacionesInsumo().catch(() => []), flota().catch(() => []), personalActivo().catch(() => []), finanzas ? parametros().catch(() => []) : []])
      .then(([cat, ub, fl, pe, par]) => {
        setListas({
          categorias: [...new Set(cat.map((c) => c.nombre))].map((n) => ({ v: n, l: n })),
          ubicaciones: ub.filter((u) => u.activa).map((u) => ({ v: u.id, l: u.nombre })),
          patentes: fl.filter((v) => v.patente).map((v) => ({ v: v.patente, l: `${v.patente} · ${v.codigo}` })),
          personas: pe.map((p) => ({ v: p.nombre, l: p.nombre })),
        })
        const patPorId = Object.fromEntries(fl.map((v) => [v.id, v.patente || v.codigo]))
        const nomUb = Object.fromEntries(ub.map((u) => [u.id, u.nombre]))
        setCtx({
          finanzas, par: mapaParametros(par),
          patenteDe: (id) => patPorId[id] || '',
          nombreUbic: (id) => nomUb[id] || '',
          // Días de ruta del período (v_salidas) con patente, nombre de ruta y estado
          salidas: async (fl2) => {
            const s = await rows(supabase.from('v_salidas').select('*').gte('fecha', fl2.desde).lte('fecha', fl2.hasta).order('fecha'))
            const ids = [...new Set(s.map((x) => x.ruta_semana_id).filter(Boolean))]
            const rs = ids.length ? await rows(supabase.from('rutas_semana').select('id, nombre').in('id', ids)).catch(() => []) : []
            const nom = Object.fromEntries(rs.map((r) => [r.id, r.nombre]))
            return s.map((x) => ({ ...x, _ruta: nom[x.ruta_semana_id] || x.ruta || '', _patente: patPorId[x.vehiculo_id] || x.vehiculo || '', _estado: estadoRuta(x) }))
          },
        })
      })
  }, [])

  const set = (k) => (e) => { setF((p) => ({ ...p, [k]: e.target.value })); setError(null) }
  const columnas = inf.columnas.filter((c) => !c.fin || finanzas)
  const generar = async () => {
    if (inf.fechas) {
      if (!f.desde || !f.hasta) return setError({ message: 'Indica Fecha desde y Fecha hasta.' })
      if (f.desde > f.hasta) return setError({ message: '"Desde" no puede ser posterior a "Hasta".' })
    }
    if (!ctx) return
    setCargando(true); setError(null)
    try { setFilas(await inf.cargar(f, ctx)); setAplicado(f) } catch (x) { setError(x) }
    setCargando(false)
  }
  const descFiltros = (fa) => [
    ...(inf.fechas ? [['Período', `${fecha(fa.desde)} – ${fecha(fa.hasta)}`]] : [['Corte', `Situación actual al ${fecha(hoyISO())}`]]),
    ...inf.filtros.filter((x) => fa[x.k]).map((x) => {
      const op = (typeof x.opciones === 'function' ? x.opciones(listas) : x.opciones || []).find((o) => o.v === fa[x.k])
      return [x.l, op ? op.l : fa[x.k]]
    }),
  ]

  if (filas !== null) {
    const tot = inf.totales ? inf.totales(filas, ctx) : []
    return (
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 16, borderBottom: `1px solid ${C.borde}` }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0 }}>Vista previa · {inf.titulo}</h3>
            <small className="text-muted">{descFiltros(aplicado).map(([a, b]) => `${a}: ${b}`).join(' · ')}</small>
          </div>
          <Boton onClick={() => setFilas(null)}>Volver a filtros</Boton>
          <Boton tipo="principal" icono={I.descarga} onClick={() => setExportar(true)} disabled={!filas.length}>Exportar</Boton>
        </div>
        {filas.length === 0 ? (
          <div style={{ padding: 30, display: 'grid', justifyItems: 'center', gap: 10, color: C.gris }}>
            Sin resultados para estos filtros.<Boton onClick={() => setFilas(null)}>Cambiar filtros</Boton>
          </div>
        ) : <>
          <Tabla filas={filas.slice(0, 300).map((r, i) => ({ ...r, _i: i }))} clave="_i" columnas={columnas.map((c) => ({
            k: c.k, label: c.l, alinear: c.num ? 'right' : undefined, render: (r) => (c.fmt ? c.fmt(r[c.k]) : typeof r[c.k] === 'number' ? r[c.k].toLocaleString('es-CL') : r[c.k]) || '—',
          }))} />
          {filas.length > 300 && <div style={{ padding: '8px 16px' }}><small className="text-muted">Vista previa de 300 de {filas.length} filas. La exportación incluye todas.</small></div>}
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: 16, borderTop: `1px solid ${C.borde}`, font: '400 14px var(--font)' }}>
            {tot.map(([l, v]) => <span key={l}>{l}: <b>{typeof v === 'number' ? v.toLocaleString('es-CL') : v}</b></span>)}
          </div>
        </>}
        {inf.nota && <div style={{ padding: '0 16px 16px' }}><Ayuda>{inf.nota}</Ayuda></div>}
        {exportar && <Exportar inf={inf} columnas={columnas} filas={filas} totales={tot} filtros={descFiltros(aplicado)} onCerrar={() => setExportar(false)} />}
      </section>
    )
  }

  return (
    <section className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ margin: 0, flex: 1 }}>Configurar reporte</h3>
        <Boton onClick={onVolver}>← Informes</Boton>
      </div>
      <Campo etiqueta="Informe seleccionado"><input value={inf.titulo} disabled /></Campo>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {inf.fechas && <>
          <Campo etiqueta="Fecha desde" obligatorio><input type="date" value={f.desde} max={f.hasta || undefined} onChange={set('desde')} /></Campo>
          <Campo etiqueta="Fecha hasta" obligatorio><input type="date" value={f.hasta} min={f.desde || undefined} onChange={set('hasta')} /></Campo>
        </>}
        {inf.filtros.map((x) => (
          <Campo key={x.k} etiqueta={x.l}>
            {x.tipo === 'select'
              ? <select value={f[x.k]} onChange={set(x.k)}><option value="">Todos</option>{(typeof x.opciones === 'function' ? x.opciones(listas) : x.opciones).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
              : <input value={f[x.k]} onChange={set(x.k)} placeholder="Todos" />}
          </Campo>
        ))}
      </div>
      <Ayuda>{inf.fechas ? 'Los filtros cambian según el informe seleccionado. "Desde" no puede ser posterior a "Hasta".' : 'Existencias: muestra la situación actual; no ofrece fechas históricas.'}</Ayuda>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton onClick={() => { setF(VACIO); setError(null) }}>Limpiar filtros</Boton>
        <Boton tipo="principal" onClick={generar} disabled={cargando || !ctx}>{cargando ? 'Generando…' : 'Generar reporte'}</Boton>
      </div>
    </section>
  )
}

// ── 7.4 Exportar reporte (PDF, XLSX o CSV: el usuario elige) ──────────────
function Exportar({ inf, columnas, filas, totales, filtros, onCerrar }) {
  const [fmt, setFmt] = useState('pdf')
  const [nombre, setNombre] = useState(`${inf.id}_${hoyISO()}`)
  const [incluir, setIncluir] = useState(true)
  const [error, setError] = useState(null)
  const limpio = nombre.trim().replace(/[^\w.-]+/g, '_') || inf.id
  const valorTexto = (c, v) => (c.fmt ? c.fmt(v) : typeof v === 'number' ? v.toLocaleString('es-CL') : v) || ''

  const descargar = () => {
    if (fmt === 'csv') {
      // CSV: solo datos (sin títulos ni totales), separador ";", fechas AAAA-MM-DD
      const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 16).replace('T', ' ') : v)
      exportarCSV(columnas.map((c) => c.k), filas.map((r) => columnas.map((c) => iso(r[c.k]) ?? '')), limpio)
    } else if (fmt === 'xlsx') {
      const libro = XLSX.utils.book_new()
      const hoja = XLSX.utils.json_to_sheet(filas.map((r) => Object.fromEntries(columnas.map((c) => [c.l, typeof r[c.k] === 'number' ? r[c.k] : (c.fmt ? c.fmt(r[c.k]) : r[c.k]) ?? '']))))
      XLSX.utils.book_append_sheet(libro, hoja, inf.titulo.slice(0, 31))
      if (incluir) XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Reporte', inf.titulo], ...filtros, [], ['Totales', ''], ...totales, [], ['Generado', new Date().toLocaleString('es-CL')]]), 'Filtros y totales')
      guardarLibro(libro, `${limpio}.xlsx`)
    } else {
      const w = window.open('', '_blank', 'width=1000,height=900')
      if (!w) return setError('El navegador bloqueó la ventana. Permite ventanas emergentes para generar el PDF.')
      const e = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
      w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${e(limpio)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet">
<style>body{font-family:Archivo,system-ui,sans-serif;color:#201e1d;margin:28px}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #13294b;padding-bottom:8px;margin-bottom:12px}
h1{margin:0;font-size:24px;color:#13294b}h2{margin:0;font-size:15px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#eaf0f9;text-align:left;padding:6px;border-bottom:1px solid #dbe3ee}
td{padding:5px 6px;border-bottom:1px solid #eef1f5}td.n{text-align:right}.f{font-size:12px;color:#5f6368;margin:0 0 10px}.t{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;margin-top:10px}
@media print{button{display:none}@page{size:landscape;margin:12mm}}</style></head><body>
<header><div><h1>FOSAN</h1><small>${e(inf.titulo)}</small></div><div style="text-align:right"><h2>${e(limpio)}</h2><small>Generado el ${e(new Date().toLocaleString('es-CL'))}</small></div></header>
${incluir ? `<p class="f">${filtros.map(([a, b]) => `<b>${e(a)}:</b> ${e(b)}`).join(' · ')}</p>` : ''}
<table><thead><tr>${columnas.map((c) => `<th>${e(c.l)}</th>`).join('')}</tr></thead><tbody>
${filas.map((r) => `<tr>${columnas.map((c) => `<td class="${c.num ? 'n' : ''}">${e(valorTexto(c, r[c.k]))}</td>`).join('')}</tr>`).join('')}
</tbody></table><div class="t">${totales.map(([l, v]) => `<span>${e(l)}: <b>${e(typeof v === 'number' ? v.toLocaleString('es-CL') : v)}</b></span>`).join('')}</div>
<button onclick="window.print()">Imprimir / Guardar como PDF</button><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`)
      w.document.close()
    }
    onCerrar()
  }

  return (
    <Modal titulo="Exportar reporte" ancho={500} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" icono={I.descarga} onClick={descargar}>Descargar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div className="campo">
          <span>Formato <b className="obligatorio">*</b></span>
          {[['pdf', 'PDF · Para lectura'], ['xlsx', 'XLSX · Para análisis'], ['csv', 'CSV · Para intercambio']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', font: '400 14px var(--font)' }}>
              <input type="radio" checked={fmt === k} onChange={() => setFmt(k)} /> {l}
            </label>
          ))}
        </div>
        <Campo etiqueta="Nombre del archivo" obligatorio><input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} /></Campo>
        {fmt !== 'csv' && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '400 14px var(--font)' }}>
            <input type="checkbox" checked={incluir} onChange={(e) => setIncluir(e.target.checked)} /> Incluir filtros y período en {fmt.toUpperCase()}
          </label>
        )}
        <Ayuda>PDF conserva la presentación (se abre lista para imprimir o "Guardar como PDF"). XLSX trae los datos y una hoja con filtros y totales. CSV mantiene solo columnas de datos. Exportar descarga; no modifica información.</Ayuda>
        {error && <Ayuda tono="error">{error}</Ayuda>}
      </div>
    </Modal>
  )
}
