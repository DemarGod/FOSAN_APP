// Inventario → Equipos (láminas 3.1 Vista principal, 3.2 Agregar equipo, 3.3 Exportar, 3.4 Validaciones).
// Situación = uso operativo · Condición = estado físico · Ubicación = dónde está.
// El N.º de unidad es entero, único y no se cambia ni se reutiliza. Los vehículos están en Flota.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import ImportarInventario from './ImportarInventario'
import { Boton, Campo, Tabla, Estado, Ayuda, Indicador } from './Base'
import {
  equiposLista, siguienteNumeroUnidad, equipoPorNumero, crearEquipo,
  catCategorias, catModelos, catUbicacionesInternas, clientesLista, ubicacionesDe,
} from '../lib/api'
import { exportarTabla } from '../lib/excel'
import { useSesion, puedeOperar, esDueno } from '../lib/sesion'
import { hoyISO } from '../lib/costos'
import { C, I, COLORES_BANO } from '../lib/ui'

export const L_SITUACION = {
  disponible: 'Disponible', reservado: 'Reservado', asignado: 'Asignado', en_traslado: 'En traslado',
  en_mantenimiento: 'En mantenimiento', no_localizado: 'No localizado', baja: 'Baja',
}
export const L_CONDICION = {
  operativo: 'Operativo', requiere_limpieza: 'Requiere limpieza', requiere_reparacion: 'Requiere reparación', sin_evaluar: 'Sin evaluar',
}
export const TONO_SITUACION = {
  disponible: 'ok', reservado: 'info', asignado: 'info', en_traslado: 'info', en_mantenimiento: 'atencion', no_localizado: 'error', baja: 'neutro',
}
export const TONO_CONDICION = { operativo: 'ok', requiere_limpieza: 'atencion', requiere_reparacion: 'error', sin_evaluar: 'neutro' }
// Condición inicial → estado que leen hoy las rutas (la base traduce a situación)
const ESTADO_INICIAL = { operativo: 'disponible', requiere_limpieza: 'en_limpieza', requiere_reparacion: 'mantencion', sin_evaluar: 'disponible' }
const POR_PAGINA = 20
const chico = { minHeight: 34, padding: '6px 12px' }
const atencion = (e) => e.propiedad === 'empresa' && e.situacion !== 'baja'
  && (e.condicion !== 'operativo' || ['en_mantenimiento', 'no_localizado'].includes(e.situacion))
const FILTRO_VACIO = { numero: '', categoria: '', situacion: '', condicion: '', ubicacion: '', propiedad: 'empresa' }

export default function InvEquipos() {
  const navegar = useNavigate()
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'banos')
  const exporta = esDueno(perfil) || !!perfil?.permisos?.banos?.exportar
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [f, setF] = useState(FILTRO_VACIO)
  const [aplicado, setAplicado] = useState(FILTRO_VACIO)
  const [pagina, setPagina] = useState(1)
  const [form, setForm] = useState(false)
  const [exportar, setExportar] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [importar, setImportar] = useState(false)
  const cargar = () => equiposLista().then(setDatos).catch(setError)
  useEffect(() => { cargar() }, [])

  const lista = datos || []
  const propios = lista.filter((e) => e.propiedad === 'empresa' && e.situacion !== 'baja')
  const opciones = (k) => [...new Set(lista.map((e) => e[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const filas = useMemo(() => lista.filter((e) => {
    const a = aplicado
    if (a.numero && !String(e.codigo).replace(/^0+/, '').startsWith(a.numero.replace(/^0+/, '')) && !String(e.codigo).toLowerCase().includes(a.numero.toLowerCase())) return false
    if (a.categoria && e.categoria !== a.categoria) return false
    if (a.situacion ? e.situacion !== a.situacion : e.situacion === 'baja') return false
    if (a.condicion && e.condicion !== a.condicion) return false
    if (a.ubicacion && e.ubicacion !== a.ubicacion) return false
    if (a.propiedad && e.propiedad !== a.propiedad) return false
    return true
  }), [lista, aplicado])
  const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const aplicar = (e) => { e?.preventDefault(); setAplicado(f); setPagina(1) }
  const limpiar = () => { setF(FILTRO_VACIO); setAplicado(FILTRO_VACIO); setPagina(1) }
  const verFicha = (e) => navegar(`/activo/${e.qr_token}`)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm(true)} disabled={!editable}>Agregar equipo</Boton>
        {editable && <Boton onClick={() => setImportar(true)}>Importar inventario (Excel)</Boton>}
        {exporta && <Boton icono={I.descarga} onClick={() => setExportar(true)} disabled={!lista.length}>Exportar</Boton>}
      </div>

      <div className="kpis">
        <Indicador rotulo="Unidades propias activas" valor={datos ? propios.length : '…'} />
        <Indicador rotulo="Disponibles" valor={datos ? propios.filter((e) => e.situacion === 'disponible' && e.condicion === 'operativo').length : '…'} />
        <Indicador rotulo="Asignadas" valor={datos ? propios.filter((e) => e.situacion === 'asignado').length : '…'} />
        <div className="indicador" style={{ background: '#fce8e6', borderColor: '#f5c2bc', display: 'block' }}>
          <span>Requieren atención</span><b>{datos ? lista.filter(atencion).length : '…'}</b>
          <small style={{ display: 'block', font: '400 12px/1.4 var(--font)', color: C.tinta, marginTop: 4 }}>
            Es una alerta; puede coincidir con otras situaciones.
          </small>
        </div>
      </div>

      <section className="card">
        <form onSubmit={aplicar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, padding: 16, borderBottom: `1px solid ${C.borde}`, alignItems: 'end' }}>
          <Campo etiqueta="Buscar por número de unidad">
            <input value={f.numero} onChange={set('numero')} placeholder="Buscar por número de unidad" inputMode="numeric" />
          </Campo>
          <Campo etiqueta="Categoría">
            <select value={f.categoria} onChange={set('categoria')}><option value="">Todas</option>{opciones('categoria').map((x) => <option key={x}>{x}</option>)}</select>
          </Campo>
          <Campo etiqueta="Situación">
            <select value={f.situacion} onChange={set('situacion')}><option value="">Todas (sin bajas)</option>{Object.entries(L_SITUACION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Condición">
            <select value={f.condicion} onChange={set('condicion')}><option value="">Todas</option>{Object.entries(L_CONDICION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Campo>
          <Campo etiqueta="Ubicación">
            <select value={f.ubicacion} onChange={set('ubicacion')}><option value="">Todas</option>{opciones('ubicacion').map((x) => <option key={x}>{x}</option>)}</select>
          </Campo>
          <Campo etiqueta="Propiedad">
            <select value={f.propiedad} onChange={set('propiedad')}><option value="">Todas</option><option value="empresa">Empresa</option><option value="cliente">Cliente</option></select>
          </Campo>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton tipo="principal" type="submit">Aplicar</Boton>
            <Boton onClick={limpiar}>Limpiar</Boton>
          </div>
        </form>

        {error && <div style={{ padding: 16 }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
        {aviso && <div style={{ padding: '16px 16px 0' }}><Ayuda>{aviso}</Ayuda></div>}
        {datos === null && !error ? <div style={{ padding: 24, color: C.gris }}>Cargando…</div> : (
          <Tabla filas={filas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)} vacio={
            <span>Sin resultados para estos filtros. <a href="#" onClick={(e) => { e.preventDefault(); limpiar() }}>Limpiar filtros</a></span>
          } columnas={[
            { k: 'codigo', label: 'N.º unidad', render: (e) => <b>{e.codigo}</b> },
            { k: 'cat', label: 'Categoría / modelo', render: (e) => [e.categoria, e.modelo].filter(Boolean).join(' · ') || '—' },
            { k: 'situacion', label: 'Situación', render: (e) => <Estado tono={TONO_SITUACION[e.situacion]}>{L_SITUACION[e.situacion] || e.situacion || '—'}</Estado> },
            { k: 'condicion', label: 'Condición', render: (e) => <Estado tono={TONO_CONDICION[e.condicion]}>{L_CONDICION[e.condicion] || e.condicion || '—'}</Estado> },
            {
              k: 'ubicacion', label: 'Ubicación', render: (e) => (
                <div>
                  <div>{e.ubicacion || <span style={{ color: '#b06000' }}>Sin ubicación</span>}</div>
                  {e.propiedad === 'cliente' && <div className="text-muted" style={{ fontSize: 12 }}>De {e.propietario}</div>}
                  {e.propiedad === 'empresa' && e.cliente && <div className="text-muted" style={{ fontSize: 12 }}>{e.cliente}</div>}
                </div>
              ),
            },
            { k: 'accion', label: 'Acción', alinear: 'right', render: (e) => <Boton onClick={() => verFicha(e)} style={chico}>Ver ficha</Boton> },
          ]} />
        )}
        {datos && filas.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 16px' }}>
            <span className="text-muted" style={{ flex: 1 }}>{(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, filas.length)} de {filas.length}</span>
            {paginas > 1 && <>
              <Boton onClick={() => setPagina(pag - 1)} disabled={pag === 1} style={chico}>‹</Boton>
              {Array.from({ length: paginas }, (_, i) => i + 1).filter((n) => n === 1 || n === paginas || Math.abs(n - pag) <= 2).map((n, i, arr) => (
                <span key={n} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  {i > 0 && n - arr[i - 1] > 1 && <span className="text-muted">…</span>}
                  <Boton tipo={n === pag ? 'principal' : 'secundario'} onClick={() => setPagina(n)} style={chico}>{n}</Boton>
                </span>
              ))}
              <Boton onClick={() => setPagina(pag + 1)} disabled={pag === paginas} style={chico}>›</Boton>
            </>}
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, padding: '12px 14px', background: C.suave, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', font: '400 13px/1.5 var(--font)' }}>
        <span><b>Situación</b> = uso operativo: {Object.values(L_SITUACION).join(' · ')}.</span>
        <span><b>Condición</b> = estado físico: {Object.values(L_CONDICION).join(' · ')}.</span>
        <span><b>Ubicación</b> = dónde está. Disponible exige empresa, condición operativa, ubicación habilitada y sin reserva.</span>
      </div>

      {form && <FormEquipo onCerrar={() => setForm(false)} onAbrir={verFicha}
        onGuardado={(r) => { setForm(false); setAviso(`Equipo ${r.codigo} creado. Quedó su registro inicial en Movimientos.`); cargar() }} />}
      {importar && <ImportarInventario onCerrar={() => setImportar(false)} onImportado={() => { setImportar(false); cargar() }} />}
      {exportar && <Exportar todos={lista} filtrados={filas} onCerrar={() => setExportar(false)} />}
    </div>
  )
}

// ── 3.2 Agregar equipo (con validaciones de 3.4) ──────────────────────────
function FormEquipo({ onCerrar, onGuardado, onAbrir }) {
  const inicial = useMemo(() => ({
    numero: '', categoria_id: '', marca: '', modelo_id: '', color: '', fecha_incorporacion: hoyISO(),
    propiedad: 'empresa', ubicacion_id: '', condicion: 'operativo', notas: '', propietario_id: '', ubic_cliente: '',
  }), [])
  const [v, setV] = useState(inicial)
  const [cat, setCat] = useState([])
  const [mod, setMod] = useState([])
  const [ubi, setUbi] = useState([])
  const [clientes, setClientes] = useState([])
  const [obras, setObras] = useState([])
  const [existe, setExiste] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([catCategorias(), catModelos(), catUbicacionesInternas(), siguienteNumeroUnidad().catch(() => null), clientesLista()])
      .then(([c, m, u, n, cl]) => {
        const eq = c.filter((x) => x.clase === 'equipo' && x.activo)
        setCat(eq); setMod(m.filter((x) => x.activo)); setUbi(u.filter((x) => x.activa)); setClientes(cl)
        const bq = eq.find((x) => x.nombre === 'Baño químico')
        const bodega = u.find((x) => x.activa && x.tipo === 'bodega')
        setV((p) => ({ ...p, numero: String(n || ''), categoria_id: bq?.id || '', ubicacion_id: bodega?.id || '' }))
      }).catch(setError)
  }, [])
  useEffect(() => {
    setObras([])
    if (v.propietario_id) ubicacionesDe(v.propietario_id).then((u) => setObras(u.filter((x) => x.activa))).catch(() => {})
  }, [v.propietario_id])

  const set = (k) => (e) => { setV((p) => ({ ...p, [k]: e.target.value, ...(k === 'categoria_id' ? { modelo_id: '' } : {}), ...(k === 'propietario_id' ? { ubic_cliente: '' } : {}) })); setErrores({}); setExiste(null) }
  const sucio = JSON.stringify({ ...v, numero: '', categoria_id: '', ubicacion_id: '' }) !== JSON.stringify({ ...inicial, numero: '', categoria_id: '', ubicacion_id: '' })
  const cerrar = () => (!sucio || window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) && onCerrar()
  const esCliente = v.propiedad === 'cliente'
  const catSel = cat.find((c) => c.id === v.categoria_id)
  const modelos = mod.filter((m) => m.categoria_id === v.categoria_id)

  const guardar = async () => {
    const e = {}
    if (!esCliente) {
      if (!/^\d+$/.test(v.numero) || Number(v.numero) < 1) e.numero = 'Número entero positivo.'
      if (!v.ubicacion_id) e.ubicacion_id = 'Elige la ubicación inicial.'
    } else {
      if (!v.propietario_id) e.propietario_id = 'Elige el cliente propietario.'
      if (!v.ubic_cliente) e.ubic_cliente = 'Elige la ubicación del cliente.'
    }
    if (!v.categoria_id) e.categoria_id = 'Elige la categoría.'
    if (modelos.length && !v.modelo_id) e.modelo_id = 'Elige el modelo.'
    if (!v.fecha_incorporacion) e.fecha_incorporacion = 'Indica la fecha de incorporación.'
    else if (v.fecha_incorporacion > hoyISO()) e.fecha_incorporacion = 'No puede ser una fecha futura.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true); setError(null)
    try {
      if (!esCliente) {
        const otro = await equipoPorNumero(v.numero)
        if (otro) { setExiste(otro); setErrores({ numero: `El número ${String(v.numero).replace(/^0+/, '')} ya existe.` }); setGuardando(false); return }
      }
      const tipo = catSel?.nombre === 'Baño químico' ? 'bano_quimico' : 'accesorio'
      const comun = {
        tipo, categoria_id: v.categoria_id, modelo_id: v.modelo_id || null, marca: v.marca.trim() || null,
        color: v.color || null, fecha_incorporacion: v.fecha_incorporacion, notas: v.notas.trim() || null,
      }
      const r = await crearEquipo(esCliente
        ? { ...comun, propiedad: 'cliente', propietario_id: v.propietario_id, ubicacion_id: v.ubic_cliente, condicion: v.condicion }
        : { ...comun, codigo: String(Number(v.numero)), propiedad: 'empresa', ubicacion_id: v.ubicacion_id,
          condicion: v.condicion, estado: ESTADO_INICIAL[v.condicion] })
      onGuardado(r)
    } catch (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal titulo="Agregar equipo" ancho={820} onCerrar={cerrar} pie={<>
      <Boton onClick={cerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar equipo'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="cols2" style={{ gap: 14 }}>
          {esCliente
            ? <Campo etiqueta="Número de unidad" ayuda="Equipo del cliente: recibe un código EXT-### automático."><input value="EXT automático" readOnly /></Campo>
            : <Campo etiqueta="Número de unidad" obligatorio ayuda="Sugerido: el siguiente libre. No se cambia ni se reutiliza." error={errores.numero}>
              <input value={v.numero} onChange={(e) => set('numero')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 7) } })} inputMode="numeric" />
            </Campo>}
          <Campo etiqueta="Categoría" obligatorio error={errores.categoria_id}>
            <select value={v.categoria_id} onChange={set('categoria_id')}>
              <option value="">Seleccionar</option>
              {cat.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Marca"><input value={v.marca} onChange={set('marca')} maxLength={40} placeholder="Ej. Rotoplas" /></Campo>
          <Campo etiqueta="Modelo" obligatorio={modelos.length > 0} error={errores.modelo_id}
            ayuda={!modelos.length && v.categoria_id ? 'Esta categoría no tiene modelos (se agregan en Administración → Catálogos).' : undefined}>
            <select value={v.modelo_id} onChange={set('modelo_id')} disabled={!modelos.length}>
              <option value="">Seleccionar</option>
              {modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Color">
            <select value={v.color} onChange={set('color')}>
              <option value="">Seleccionar</option>
              {COLORES_BANO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Fecha de incorporación" obligatorio error={errores.fecha_incorporacion}>
            <input type="date" value={v.fecha_incorporacion} max={hoyISO()} onChange={set('fecha_incorporacion')} />
          </Campo>
          <div className="campo">
            <span>Propiedad <b className="obligatorio">*</b></span>
            <div style={{ display: 'flex', gap: 18, font: '400 14px var(--font)', minHeight: 40, alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={!esCliente} onChange={() => set('propiedad')({ target: { value: 'empresa' } })} /> Empresa</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={esCliente} onChange={() => set('propiedad')({ target: { value: 'cliente' } })} /> Cliente</label>
            </div>
          </div>
          {!esCliente && (
            <Campo etiqueta="Ubicación inicial" obligatorio error={errores.ubicacion_id}>
              <select value={v.ubicacion_id} onChange={set('ubicacion_id')}>
                <option value="">Seleccionar</option>
                {ubi.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Campo>
          )}
          <Campo etiqueta="Condición inicial" obligatorio>
            <select value={v.condicion} onChange={set('condicion')}>
              {Object.entries(L_CONDICION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Observaciones">
          <textarea value={v.notas} onChange={set('notas')} maxLength={500} style={{ minHeight: 60 }} placeholder="Ej. Observaciones adicionales sobre el equipo…" />
        </Campo>

        {esCliente && (
          <section style={{ border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', padding: 14, display: 'grid', gap: 12, background: C.suave }}>
            <h6 style={{ margin: 0 }}>Solo si propiedad = Cliente</h6>
            <div className="cols2" style={{ gap: 12 }}>
              <Campo etiqueta="Cliente propietario" obligatorio error={errores.propietario_id}>
                <select value={v.propietario_id} onChange={set('propietario_id')}>
                  <option value="">Seleccione un cliente</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Ubicación del cliente" obligatorio error={errores.ubic_cliente}
                ayuda={v.propietario_id && !obras.length ? 'Este cliente no tiene ubicaciones activas: agrégala en su ficha.' : undefined}>
                <select value={v.ubic_cliente} onChange={set('ubic_cliente')} disabled={!obras.length}>
                  <option value="">Seleccione una ubicación</option>
                  {obras.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </Campo>
            </div>
            <small className="text-muted">No cuenta como inventario propio disponible.</small>
          </section>
        )}

        {existe && (
          <Ayuda tono="error">
            El número {existe.codigo} ya existe. <Boton onClick={() => onAbrir(existe)} style={{ minHeight: 30, padding: '4px 10px', marginLeft: 6 }}>Abrir ficha</Boton>
          </Ayuda>
        )}
        <Ayuda>La situación inicial se calcula según ubicación, condición y reservas. Guardar crea el registro inicial de trazabilidad.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── 3.3 Exportar ──────────────────────────────────────────────────────────
const COLUMNAS = ['numero_unidad', 'categoria', 'modelo', 'situacion', 'condicion', 'ubicacion', 'propiedad', 'propietario', 'fecha_incorporacion']
const fila = (e) => [e.codigo, e.categoria || '', e.modelo || '', L_SITUACION[e.situacion] || e.situacion || '', L_CONDICION[e.condicion] || e.condicion || '',
  e.ubicacion || '', e.propiedad === 'cliente' ? 'Cliente' : 'Empresa', e.propietario || '', e.fecha_incorporacion || '']

function Exportar({ todos, filtrados, onCerrar }) {
  const [formato, setFormato] = useState('csv')
  const [soloFiltrados, setSoloFiltrados] = useState(true)
  const lista = soloFiltrados ? filtrados : todos
  const descargar = () => {
    const nombre = `equipos_${hoyISO()}`
    if (formato === 'xlsx') exportarTabla(COLUMNAS, lista.map(fila), 'Equipos')
    else {
      // CSV: separador ";", UTF-8 con BOM (abre bien en Excel), fechas AAAA-MM-DD
      const esc = (x) => (/[";\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
      const texto = '﻿' + [COLUMNAS, ...lista.map(fila)].map((r) => r.map(esc).join(';')).join('\r\n')
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = nombre + '.csv'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    onCerrar()
  }
  return (
    <Modal titulo="Exportar equipos" ancho={560} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" icono={I.descarga} onClick={descargar} disabled={!lista.length}>Exportar</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="campo">
          <span>Formato <b className="obligatorio">*</b></span>
          <div style={{ display: 'flex', gap: 18, font: '400 14px var(--font)' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={formato === 'csv'} onChange={() => setFormato('csv')} /> CSV</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={formato === 'xlsx'} onChange={() => setFormato('xlsx')} /> XLSX</label>
          </div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)' }}>
          <input type="checkbox" checked={soloFiltrados} onChange={(e) => setSoloFiltrados(e.target.checked)} /> Solo resultados filtrados ({filtrados.length} de {todos.length})
        </label>
        <Campo etiqueta="Vista previa de columnas (en orden del archivo)">
          <input value={COLUMNAS.join(', ')} readOnly />
        </Campo>
        <Ayuda>Descarga datos autorizados; no modifica registros.</Ayuda>
      </div>
    </Modal>
  )
}
