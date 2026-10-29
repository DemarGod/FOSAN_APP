// Clientes · Listado y registro (láminas 2.1 a 2.3).
// Un registro por cliente (RUT normalizado); sus obras y servicios se cuentan desde
// ubicaciones y servicios_cliente. Los clientes no se borran: se desactivan con motivo.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import FormCliente from '../components/FormCliente'
import { Boton, Campo, Tabla, Estado, Ayuda, Indicador } from '../components/Base'
import { clientesListado, desactivarCliente, reactivarCliente, procesarVencidos, normalizarRut } from '../lib/api'
import { exportarTabla } from '../lib/excel'
import { useSesion, puedeOperar, esDueno } from '../lib/sesion'
import { C, Icon, I, fecha } from '../lib/ui'

const POR_PAGINA = 20
const PUNTOS = 'M12 5.5v.1M12 12v.1M12 18.5v.1'
const PROHIBIDO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8'

export default function Clientes() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'clientes')
  const exporta = esDueno(perfil) || !!perfil?.permisos?.clientes?.exportar

  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [texto, setTexto] = useState(params.get('q') || '')
  const [estado, setEstado] = useState('activos')
  const [filtro, setFiltro] = useState({ texto: params.get('q') || '', estado: 'activos' })
  const [pagina, setPagina] = useState(1)
  const [form, setForm] = useState(false)          // true = nuevo · id = editar
  const [desactivar, setDesactivar] = useState(null)
  const [reactivar, setReactivar] = useState(null)

  const cargar = () => {
    setCargando(true)
    procesarVencidos()
      .then(clientesListado).then(setDatos).catch(setError).finally(() => setCargando(false))
  }
  useEffect(cargar, [])

  const activos = datos.filter((c) => c.activo)
  const visibles = useMemo(() => {
    const t = filtro.texto.trim().toLowerCase()
    const tr = normalizarRut(filtro.texto)
    return datos.filter((c) => {
      if (filtro.estado === 'activos' && !c.activo) return false
      if (filtro.estado === 'inactivos' && c.activo) return false
      if (!t) return true
      return (c.nombre || '').toLowerCase().includes(t) || (c.nombre_comercial || '').toLowerCase().includes(t)
        || (c.codigo || '').toLowerCase().includes(t) || (tr.length >= 3 && normalizarRut(c.rut).includes(tr))
    })
  }, [datos, filtro])
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas)
  const enPagina = visibles.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)

  const aplicar = (e) => { e?.preventDefault(); setFiltro({ texto, estado }); setPagina(1) }
  const limpiar = () => { setTexto(''); setEstado('activos'); setFiltro({ texto: '', estado: 'activos' }); setPagina(1) }
  const verInactivos = () => { setEstado('inactivos'); setFiltro({ texto: '', estado: 'inactivos' }); setTexto(''); setPagina(1) }

  const exportar = () => exportarTabla(
    ['Código', 'RUT', 'Nombre / razón social', 'Nombre comercial', 'Tipo', 'Comuna', 'Teléfono', 'Correo', 'Ubicaciones', 'Servicios vigentes', 'Estado'],
    visibles.map((c) => [c.codigo, c.rut, c.nombre, c.nombre_comercial, c.tipo_cliente === 'persona' ? 'Persona' : 'Empresa',
      c.comuna, c.telefono, c.correo, c.ubicaciones, c.servicios_vigentes, c.activo ? 'Activo' : 'Inactivo']),
    'Clientes',
  )

  const columnas = [
    { k: 'codigo', label: 'Código', ancho: 90 },
    { k: 'rut', label: 'RUT', render: (c) => c.rut || '—' },
    {
      k: 'nombre', label: 'Nombre / razón social', render: (c) => (
        <div>
          <div style={{ fontWeight: 600 }}>{c.nombre}</div>
          {c.nombre_comercial && <div className="text-muted" style={{ fontSize: 12 }}>{c.nombre_comercial}</div>}
        </div>
      ),
    },
    { k: 'comuna', label: 'Comuna', render: (c) => c.comuna || '—' },
    { k: 'ubicaciones', label: 'Ubicaciones', alinear: 'right' },
    { k: 'servicios_vigentes', label: 'Servicios vigentes', alinear: 'right' },
    {
      k: 'activo', label: 'Estado', render: (c) => c.activo
        ? <Estado tono="ok">Activo</Estado>
        : <span title={c.motivo_desactivacion || ''}><Estado tono="neutro">Inactivo</Estado></span>,
    },
    {
      k: 'acciones', label: 'Acciones', alinear: 'right', render: (c) => (
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <Boton onClick={() => navegar(`/clientes/${c.id}`)} style={{ minHeight: 34, padding: '6px 12px' }}>Ver ficha</Boton>
          <Menu opciones={[
            { l: 'Ver ficha', d: I.ojo, onClick: () => navegar(`/clientes/${c.id}`) },
            { l: 'Editar datos', d: I.lapiz, onClick: () => setForm(c.id), disabled: !editable },
            c.activo
              ? { l: 'Desactivar', d: PROHIBIDO, color: C.rojo, onClick: () => setDesactivar(c), disabled: !editable }
              : { l: 'Reactivar', d: I.check, onClick: () => setReactivar(c), disabled: !editable },
          ]} />
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0 }}>Clientes</h2>
          <div className="text-muted">Un registro por cliente (RUT). Cada cliente puede tener varias ubicaciones y servicios.</div>
        </div>
        {exporta && <Boton icono={I.descarga} onClick={exportar} disabled={!visibles.length}>Exportar</Boton>}
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm(true)} disabled={!editable}>Nuevo cliente</Boton>
      </div>

      <div className="kpis">
        <Indicador icono={I.users} color={C.verde} rotulo="Clientes activos" valor={cargando ? '…' : activos.length} />
        <Indicador icono={I.doc} color={C.azul} rotulo="Con servicios vigentes" valor={cargando ? '…' : activos.filter((c) => c.servicios_vigentes > 0).length} />
        <Indicador icono={PROHIBIDO} color={C.rojo} rotulo="Sin servicios vigentes" valor={cargando ? '…' : activos.filter((c) => !c.servicios_vigentes).length} />
      </div>

      <section className="card">
        <form onSubmit={aplicar} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: 16, borderBottom: `1px solid ${C.borde}` }}>
          <Campo etiqueta="Buscar" style={{ flex: '1 1 260px' }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por RUT, nombre o código" />
          </Campo>
          <Campo etiqueta="Estado" style={{ flex: '0 1 160px' }}>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </Campo>
          <Boton tipo="principal" type="submit">Aplicar</Boton>
          <Boton onClick={limpiar}>Limpiar filtros</Boton>
        </form>

        {error && <div style={{ padding: 16 }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
        {cargando
          ? <div style={{ padding: 24, color: C.gris }}>Cargando…</div>
          : <Tabla columnas={columnas} filas={enPagina} vacio={
            <span>Sin resultados para estos filtros. <a href="#" onClick={(e) => { e.preventDefault(); limpiar() }}>Limpiar filtros</a></span>
          } />}

        {!cargando && visibles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px' }}>
            <span className="text-muted" style={{ flex: 1 }}>
              {(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, visibles.length)} de {visibles.length}
            </span>
            {paginas > 1 && <>
              <Boton onClick={() => setPagina(pag - 1)} disabled={pag === 1} style={{ minHeight: 34, padding: '6px 12px' }}>‹ Anterior</Boton>
              {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
                <Boton key={n} tipo={n === pag ? 'principal' : 'secundario'} onClick={() => setPagina(n)} style={{ minHeight: 34, padding: '6px 12px' }}>{n}</Boton>
              ))}
              <Boton onClick={() => setPagina(pag + 1)} disabled={pag === paginas} style={{ minHeight: 34, padding: '6px 12px' }}>Siguiente ›</Boton>
            </>}
          </div>
        )}
      </section>

      <Ayuda>
        Desactivar conserva el historial: el cliente deja de aparecer para elegir en rutas y despachos nuevos, pero sigue en los que ya existen.
        {datos.some((c) => !c.activo) && filtro.estado === 'activos' && <> <a href="#" onClick={(e) => { e.preventDefault(); verInactivos() }}>Ver inactivos</a>.</>}
      </Ayuda>

      {form && (
        <FormCliente clienteId={form === true ? null : form}
          onCerrar={() => setForm(false)}
          onGuardado={() => { setForm(false); cargar() }}
          onAbrir={(id) => navegar(`/clientes/${id}`)} />
      )}
      {desactivar && <Desactivar cliente={desactivar} onCerrar={() => setDesactivar(null)} onListo={() => { setDesactivar(null); cargar() }} />}
      {reactivar && <Reactivar cliente={reactivar} onCerrar={() => setReactivar(null)} onListo={() => { setReactivar(null); cargar() }} />}
    </div>
  )
}

// ── Menú ⋮ de cada fila ────────────────────────────────────────────────────
function Menu({ opciones }) {
  // Posición fija para que la tabla (con scroll) no recorte el menú
  const [abierto, setAbierto] = useState(null)   // { top, right } o null
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(null) }
    const cerrar = () => setAbierto(null)
    document.addEventListener('mousedown', fuera)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', fuera)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto])
  const alternar = (e) => {
    if (abierto) { setAbierto(null); return }
    const r = e.currentTarget.getBoundingClientRect()
    const alto = opciones.length * 40 + 10
    const top = r.bottom + 4 + alto > window.innerHeight ? r.top - 4 - alto : r.bottom + 4
    setAbierto({ top, right: window.innerWidth - r.right })
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn" aria-label="Más acciones" onClick={alternar}
        style={{ minHeight: 34, padding: '6px 8px' }}><Icon d={PUNTOS} size={18} w={3} /></button>
      {abierto && (
        <div role="menu" style={{
          position: 'fixed', right: abierto.right, top: abierto.top, zIndex: 1100, minWidth: 180, padding: 4,
          background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', boxShadow: '0 8px 24px rgba(19,41,75,.14)',
        }}>
          {opciones.map((o) => (
            <button key={o.l} type="button" role="menuitem" disabled={o.disabled}
              onClick={() => { setAbierto(null); o.onClick() }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0, background: 'transparent',
                padding: '9px 10px', borderRadius: 'var(--radio-sm)', font: '400 14px var(--font)', textAlign: 'left',
                color: o.color || C.tinta, cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.45 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.suave }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              <Icon d={o.d} size={16} color={o.color || C.gris} />{o.l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Desactivar con motivo ─────────────────────────────────────────────────
function Desactivar({ cliente, onCerrar, onListo }) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const confirmar = async () => {
    if (motivo.trim().length < 3) { setError({ message: 'Indica el motivo de la desactivación.' }); return }
    setGuardando(true)
    try { await desactivarCliente(cliente.id, motivo.trim()); onListo() } catch (e) { setError(e); setGuardando(false) }
  }
  return (
    <Modal titulo={`Desactivar ${cliente.nombre}`} ancho={500} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="peligro" onClick={confirmar} disabled={guardando}>{guardando ? 'Desactivando…' : 'Desactivar'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <Ayuda>
          Se conserva todo su historial. No aparecerá para elegir en rutas ni despachos nuevos.
          Antes debe tener sus baños retirados y sus servicios finalizados.
          {cliente.servicios_vigentes > 0 && <> Hoy tiene <b>{cliente.servicios_vigentes} servicio(s) vigente(s)</b>.</>}
        </Ayuda>
        <Campo etiqueta="Motivo" obligatorio>
          <textarea value={motivo} onChange={(e) => { setMotivo(e.target.value); setError(null) }} maxLength={300}
            placeholder="Ej. Terminó la obra y no tiene servicios pendientes." autoFocus />
        </Campo>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

function Reactivar({ cliente, onCerrar, onListo }) {
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const confirmar = async () => {
    setGuardando(true)
    try { await reactivarCliente(cliente.id); onListo() } catch (e) { setError(e); setGuardando(false) }
  }
  return (
    <Modal titulo={`Reactivar ${cliente.nombre}`} ancho={460} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={confirmar} disabled={guardando}>{guardando ? 'Reactivando…' : 'Reactivar'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12, font: '400 14px/1.5 var(--font)' }}>
        <span>Volverá a aparecer para elegir en rutas y despachos.</span>
        {cliente.motivo_desactivacion && (
          <span className="text-muted">Se desactivó el {fecha(cliente.desactivado_en)}: {cliente.motivo_desactivacion}</span>
        )}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}
