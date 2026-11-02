// Mantenciones dentro de cada módulo (reemplaza la página /mantenciones).
// ambito="equipos" → Inventario (baños y otros equipos) · ambito="flota" → Transporte (camiones y camionetas).
// Lo que separa una mantención de otra es el TIPO DEL ACTIVO, no la clase guardada.
import { useEffect, useMemo, useState } from 'react'
import Listado from './Listado'
import Modal from './Modal'
import FormMantencion, { esFlota } from './FormMantencion'
import { mantenciones, completarMantencion, anularMantencion } from '../lib/api'
import { useSesion, puedeOperar, verFinanzas, esSecretaria } from '../lib/sesion'
import { C, I, L_CLASE_MANT, L_ESTADO_MANT, L_TIPO_ACTIVO, clp, fecha } from '../lib/ui'

const ABIERTAS = ['programada', 'proxima', 'urgente']

const CONFIG = {
  equipos: {
    titulo: 'Mantenciones de equipos',
    bajada: 'Programadas y realizadas sobre baños y otros equipos del inventario.',
    segmentos: [
      { v: 'todos', l: 'Todos', d: I.clip },
      { v: 'bano_quimico', l: 'Baños', d: I.drop },
      { v: 'otros', l: 'Otros equipos', d: I.box },
    ],
  },
  flota: {
    titulo: 'Mantenciones de vehículos',
    bajada: 'Programadas y realizadas sobre camiones y camionetas.',
    segmentos: [
      { v: 'todos', l: 'Todos', d: I.clip },
      { v: 'camion', l: 'Camiones', d: I.truck },
      { v: 'camioneta', l: 'Camionetas', d: I.truck },
    ],
  },
}

export default function PanelMantenciones({ ambito = 'equipos' }) {
  const cfg = CONFIG[ambito]
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'mantenciones')
  const finanzas = verFinanzas(perfil)
  const sec = esSecretaria(perfil)

  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seg, setSeg] = useState('todos')
  const [form, setForm] = useState(false)
  const [completar, setCompletar] = useState(null)

  const cargar = () => {
    setCargando(true)
    mantenciones()
      .then((m) => setDatos(m.filter((x) => esFlota(x.activos?.tipo) === (ambito === 'flota'))))
      .catch(setError)
      .finally(() => setCargando(false))
  }
  useEffect(cargar, [ambito])

  const filas = useMemo(() => datos.map((m) => ({
    ...m,
    activoL: m.activos?.codigo || '—',
    claseL: L_TIPO_ACTIVO[m.activos?.tipo] || L_CLASE_MANT[m.clase] || m.clase,
    estadoL: L_ESTADO_MANT[m.estado] || m.estado,
    fechaL: fecha(m.fecha_programada),
    realizadaL: m.fecha_realizada ? fecha(m.fecha_realizada) : '—',
    responsableL: m.perfiles?.nombre || m.responsable_ext || '—',
    costoL: clp(m.costo),
  })), [datos])

  const visibles = useMemo(() => {
    if (seg === 'todos') return filas
    if (seg === 'otros') return filas.filter((f) => f.activos?.tipo !== 'bano_quimico')
    return filas.filter((f) => f.activos?.tipo === seg)
  }, [filas, seg])

  // KPI del módulo (la vista v_mantenciones_kpi suma todo junto, por eso se calculan aquí)
  const kpi = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7)
    const hechas = filas.filter((f) => f.estado === 'completada')
    return {
      del_mes: filas.filter((f) => (f.fecha_programada || '').startsWith(mes)).length,
      proximas: filas.filter((f) => ['programada', 'proxima'].includes(f.estado)).length,
      urgentes: filas.filter((f) => f.estado === 'urgente').length,
      realizadas: hechas.length,
      costo: hechas.reduce((t, f) => t + Number(f.costo || 0), 0),
    }
  }, [filas])

  const anular = async (m) => {
    if (!window.confirm(`¿Anular la mantención "${m.tipo}" de ${m.activoL}?`)) return
    try { await anularMantencion(m.id); cargar() } catch (e) { setError(e) }
  }

  return (
    <>
      <Listado
        titulo={cfg.titulo}
        bajada={cfg.bajada}
        accion={{ label: 'Nueva mantención', onClick: () => setForm(true), disabled: !editable }}
        segmentos={{ opciones: cfg.segmentos, valor: seg, onChange: setSeg }}
        kpis={[
          { v: kpi.del_mes, l: 'Del mes' },
          { v: kpi.proximas, l: 'Próximas' },
          { v: kpi.urgentes, l: 'Urgentes' },
          { v: kpi.realizadas, l: 'Realizadas' },
          ...(finanzas ? [{ v: clp(kpi.costo), l: 'Costo realizado' }] : []),
        ]}
        cargando={cargando}
        error={error}
        unidad="mantenciones"
        filtros={[
          { k: 'claseL', label: 'Tipo de activo' },
          { k: 'estadoL', label: 'Estado' },
          { k: 'responsableL', label: 'Responsable' },
        ]}
        buscar={['activoL', 'tipo', 'responsableL', 'detalle']}
        cols={[
          { k: 'activoL', label: 'Activo' },
          { k: 'claseL', label: 'Tipo de activo' },
          { k: 'tipo', label: 'Mantención' },
          { k: 'fechaL', label: 'Programada' },
          { k: 'realizadaL', label: 'Realizada' },
          { k: 'responsableL', label: 'Responsable' },
          ...(finanzas ? [{ k: 'costoL', label: 'Costo' }] : []),
          { k: 'estadoL', label: 'Estado', badge: true },
        ]}
        datos={visibles}
        acciones={(d) => {
          const abierta = ABIERTAS.includes(d.estado)
          return [
            { t: 'Completar mantención', label: 'Completar', d: I.check, color: C.verde,
              disabled: !editable || sec || !abierta, onClick: () => setCompletar(d) },
            { t: 'Anular mantención', d: I.alert, color: C.rojo,
              disabled: !editable || !abierta, onClick: () => anular(d) },
          ]
        }}
      />

      {form && (
        <FormMantencion ambito={ambito} onCerrar={() => setForm(false)} onGuardado={() => { setForm(false); cargar() }} />
      )}
      {completar && (
        <CompletarMantencion mantencion={completar} finanzas={finanzas}
          onCerrar={() => setCompletar(null)} onGuardado={() => { setCompletar(null); cargar() }} />
      )}
    </>
  )
}

// Cierra una mantención abierta: fecha en que se hizo, costo real y qué se hizo.
// Al quedar "Completada", el trigger cerrar_mantencion devuelve el activo a su estado de trabajo.
function CompletarMantencion({ mantencion: m, finanzas, onCerrar, onGuardado }) {
  const [v, setV] = useState({
    fecha_realizada: new Date().toISOString().slice(0, 10),
    costo: m.costo ? String(m.costo) : '',
    responsable_ext: m.responsable_ext || '',
    detalle: m.detalle || '',
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))

  const guardar = async () => {
    if (!v.fecha_realizada) { setError('Indica la fecha en que se realizó.'); return }
    setGuardando(true)
    setError(null)
    try {
      await completarMantencion(m.id, {
        fecha_realizada: v.fecha_realizada,
        responsable_ext: v.responsable_ext.trim() || null,
        detalle: v.detalle.trim() || null,
        ...(finanzas ? { costo: v.costo ? Number(String(v.costo).replace(/\D/g, '')) : 0 } : {}),
      })
      onGuardado()
    } catch (e) { setError(String(e.message || e)); setGuardando(false) }
  }

  return (
    <Modal titulo={`Completar mantención · ${m.activoL}`} ancho={560} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Marcar como completada'}
        </button>
      </>
    }>
      <div style={{ display: 'grid', gap: 14, padding: 18 }}>
        <div style={{ font: '400 13px/1.45 var(--font)', color: '#3c4551' }}>
          <b>{m.tipo}</b> · programada para el {m.fechaL}
        </div>
        <label className="campo">
          <span>Fecha realizada</span>
          <input type="date" value={v.fecha_realizada} onChange={set('fecha_realizada')} />
        </label>
        <label className="campo">
          <span>Responsable</span>
          <input value={v.responsable_ext} onChange={set('responsable_ext')} placeholder="M. López o taller externo" />
        </label>
        {finanzas && (
          <label className="campo">
            <span>Costo final (CLP)</span>
            <input value={v.costo} onChange={set('costo')} inputMode="numeric" placeholder="38000" />
          </label>
        )}
        <label className="campo">
          <span>Qué se hizo</span>
          <textarea rows={3} value={v.detalle} onChange={set('detalle')} placeholder="Trabajo realizado, repuestos…" />
        </label>
        {error && (
          <div style={{
            padding: '11px 13px', background: '#fce8e6', border: `2px solid ${C.rojo}`,
            font: '400 12px/1.45 var(--font)', color: '#7c1405',
          }}>{error}</div>
        )}
      </div>
    </Modal>
  )
}
