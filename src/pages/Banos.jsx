import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Listado from '../components/Listado'
import FormActivo from '../components/FormActivo'
import FormMantencion from '../components/FormMantencion'
import Modal from '../components/Modal'
import { inventario, banosKpi, eliminarActivos } from '../lib/api'
import { exportarVista } from '../lib/excel'
import { useSesion, puedeEditar, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, I, L_ESTADO_ACTIVO, clp, fecha } from '../lib/ui'

export default function Banos() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeEditar(perfil)
  const operar = puedeOperar(perfil, 'banos')
  const finanzas = verFinanzas(perfil)

  const [datos, setDatos] = useState([])
  const [kpi, setKpi] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [sel, setSel] = useState([])
  const [borrar, setBorrar] = useState(null)

  const cargar = () => {
    setCargando(true)
    Promise.all([inventario(), banosKpi()])
      .then(([inv, k]) => { setDatos(inv.filter((a) => a.tipo === 'bano_quimico')); setKpi(k || {}); setSel([]) })
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
        exportar={finanzas ? () => exportarVista('export_activos', 'Activos') : undefined}
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
          ...(finanzas ? [{ k: 'valorL', label: 'Valor arriendo' }] : []),
          { k: 'movL', label: 'Último movimiento' },
        ]}
        datos={filas}
        seleccion={editable ? { ids: sel, onChange: setSel } : undefined}
        barraSeleccion={sel.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 10, background: '#fce8e6', border: `2px solid ${C.rojo}`, flexWrap: 'wrap' }}>
            <span style={{ font: '600 13px var(--font)', color: '#7c1405', flex: 1 }}>{sel.length} baño(s) seleccionado(s)</span>
            <button className="btn" onClick={() => setSel([])}>Quitar selección</button>
            <button className="btn" onClick={() => setBorrar(filas.filter((f) => sel.includes(f.id)))}
              style={{ background: C.rojo, color: '#fff', borderColor: C.rojo }}>Eliminar seleccionados</button>
          </div>
        )}
        onFila={(d) => navegar('/activo/' + d.qr_token)}
        acciones={(d) => [
          { t: 'Ver ficha', d: I.ojo, color: C.azul, onClick: () => navegar('/activo/' + d.qr_token) },
          { t: 'Editar baño', d: I.lapiz, color: C.navy, disabled: !editable, onClick: () => setForm({ tipo: 'editar', activo: d.id }) },
          {
            t: 'Registrar mantención', d: I.wrench, color: C.amarillo, disabled: !operar,
            onClick: () => setForm({ tipo: 'mantencion', activo: d.id }),
          },
          {
            t: d.estado === 'en_arriendo' ? 'En arriendo: primero registra su retiro' : 'Eliminar baño',
            d: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6', color: C.rojo,
            disabled: !editable || d.estado === 'en_arriendo', onClick: () => setBorrar([d]),
          },
        ]}
      />

      {form === 'activo' && (
        <FormActivo onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />
      )}
      {form?.tipo === 'editar' && (
        <FormActivo activoId={form.activo} onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />
      )}
      {borrar && <ConfirmarBorrado banos={borrar} onCerrar={() => setBorrar(null)} onBorrado={() => { setBorrar(null); cargar() }} />}
      {form?.tipo === 'mantencion' && (
        <FormMantencion activoInicial={form.activo}
          onCerrar={() => setForm(null)} onGuardado={() => setForm(null)} />
      )}
    </>
  )
}

function ConfirmarBorrado({ banos, onCerrar, onBorrado }) {
  const [error, setError] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const arrendados = banos.filter((b) => b.estado === 'en_arriendo')
  const confirmar = async () => {
    setBorrando(true)
    try { await eliminarActivos(banos.map((b) => b.id)); onBorrado() } catch (e) { setError(String(e.message || e)); setBorrando(false) }
  }
  return (
    <Modal titulo={banos.length > 1 ? `Eliminar ${banos.length} baños` : 'Eliminar baño'} ancho={500} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn" onClick={confirmar} disabled={borrando || arrendados.length > 0}
          style={{ background: C.rojo, color: '#fff', borderColor: C.rojo }}>{borrando ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
      </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 12, font: '400 13px/1.5 var(--font)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
          {banos.map((b) => (
            <span key={b.id} style={{ padding: '3px 8px', border: `2px solid ${b.estado === 'en_arriendo' ? C.rojo : C.borde}`, font: '600 12px var(--font)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.codigo}</span>
          ))}
        </div>
        {arrendados.length > 0
          ? <p style={{ margin: 0, color: '#7c1405' }}>{arrendados.length} de estos baños están en arriendo ({arrendados.map((b) => b.codigo).join(', ')}). Quítalos de la selección o registra primero su retiro.</p>
          : <p style={{ margin: 0 }}>Se borran junto con su historial, documentos y mantenciones. Esta acción no se puede deshacer.</p>}
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, color: '#7c1405' }}>{error}</div>}
      </div>
    </Modal>
  )
}
