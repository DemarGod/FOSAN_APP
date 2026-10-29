// Administración (láminas 8.1 a 8.8): Personal y usuarios · Roles y permisos · Catálogos · Historial de cambios.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import AdminPersonal from '../components/AdminPersonal'
import AdminRoles from '../components/AdminRoles'
import { Boton, Campo, Tabla, Pestanas, Estado, Ayuda } from '../components/Base'
import {
  catCategorias, catModelos, catUbicacionesInternas, catUnidades,
  guardarCategoria, guardarModelo, guardarUbicacionInterna, guardarUnidad, usoCatalogo, historialRango,
} from '../lib/api'
import { hoyISO } from '../lib/costos'
import { C, Icon, I, fechaHora } from '../lib/ui'

const PESTANAS = [
  { v: 'personal', l: 'Personal y usuarios' },
  { v: 'roles', l: 'Roles y permisos' },
  { v: 'catalogos', l: 'Catálogos' },
  { v: 'historial', l: 'Historial de cambios' },
]
const chico = { minHeight: 34, padding: '6px 12px' }

export default function Administracion() {
  const [params, setParams] = useSearchParams()
  const tab = PESTANAS.some((p) => p.v === params.get('tab')) ? params.get('tab') : 'personal'
  const irA = (v) => setParams({ tab: v }, { replace: true })
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, flex: 1 }}>Administración</h2>
        <span style={{ padding: '6px 12px', border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-sm)', background: C.blanco, font: '600 13px var(--font)' }}>
          Empresa FOSAN
        </span>
      </div>
      <section className="card">
        <Pestanas opciones={PESTANAS} valor={tab} onChange={irA} />
        <div style={{ padding: 18 }}>
          {tab === 'personal' && <AdminPersonal />}
          {tab === 'roles' && <AdminRoles />}
          {tab === 'catalogos' && <Catalogos />}
          {tab === 'historial' && <HistorialCambios />}
        </div>
      </section>
    </div>
  )
}

// ══ Catálogos (8.5 y 8.6) ═════════════════════════════════════════════════════
const SUB = [
  { v: 'categorias', l: 'Categorías y modelos' },
  { v: 'ubicaciones', l: 'Ubicaciones internas' },
  { v: 'unidades', l: 'Unidades de medida' },
]
const L_CLASE = { equipo: 'Equipos', insumo: 'Insumos', epp: 'EPP' }
const L_TIPO_INT = { bodega: 'Bodega', taller: 'Taller' }

function Catalogos() {
  const [sub, setSub] = useState('categorias')
  const [cat, setCat] = useState(null)
  const [mod, setMod] = useState([])
  const [ubi, setUbi] = useState([])
  const [uni, setUni] = useState([])
  const [elegida, setElegida] = useState(null)   // categoría cuyos modelos se muestran
  const [form, setForm] = useState(null)         // { tipo, fila }
  const [error, setError] = useState(null)

  const cargar = () => Promise.all([catCategorias(), catModelos(), catUbicacionesInternas(), catUnidades()])
    .then(([c, m, u, n]) => {
      setCat(c); setMod(m); setUbi(u); setUni(n)
      setElegida((e) => e || c.find((x) => x.nombre === 'Baño químico')?.id || c.find((x) => x.clase === 'equipo')?.id || null)
    }).catch(setError)
  useEffect(() => { cargar() }, [])
  const listo = () => { setForm(null); cargar() }

  const catEquipo = (cat || []).filter((c) => c.clase === 'equipo')
  const catElegida = (cat || []).find((c) => c.id === elegida)
  const estado = (x) => <Estado tono={(x.activo ?? x.activa) ? 'ok' : 'neutro'}>{(x.activo ?? x.activa) ? 'Activo' : 'Inactivo'}</Estado>
  const editar = (tipo) => (fila) => <Boton icono={I.lapiz} onClick={() => setForm({ tipo, fila })} style={chico}>Editar</Boton>

  if (error) return <Ayuda tono="error">{String(error.message || error)}</Ayuda>
  if (!cat) return <div style={{ color: C.gris }}>Cargando…</div>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <span className="text-muted">Categorías, modelos, ubicaciones internas y unidades de medida. Los usan todos los módulos.</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SUB.map((s) => (
          <button key={s.v} type="button" onClick={() => setSub(s.v)} style={{
            minHeight: 36, padding: '0 14px', borderRadius: 'var(--radio-sm)', cursor: 'pointer',
            border: `1px solid ${sub === s.v ? C.azul : C.borde}`, background: sub === s.v ? C.tinte : C.blanco,
            color: sub === s.v ? C.azul : C.tinta, font: '600 13px var(--font)',
          }}>{s.l}</button>
        ))}
      </div>

      {sub === 'categorias' && (
        <div className="cols2" style={{ gap: 16, alignItems: 'start' }}>
          <TarjetaCat titulo="Categorías" accion="Agregar categoría" onAgregar={() => setForm({ tipo: 'categoria', fila: {} })}>
            <Tabla filas={cat} alClic={(x) => x.clase === 'equipo' && setElegida(x.id)} columnas={[
              {
                k: 'nombre', label: 'Nombre', render: (x) => (
                  <span style={{ fontWeight: x.id === elegida ? 700 : 400, color: x.id === elegida ? C.azul : C.tinta }}>
                    {x.nombre}{x.clase !== 'equipo' && <span className="text-muted" style={{ fontSize: 12 }}> · {L_CLASE[x.clase]}</span>}
                  </span>
                ),
              },
              { k: 'estado', label: 'Estado', render: estado },
              { k: 'acciones', label: 'Acciones', alinear: 'right', render: editar('categoria') },
            ]} />
          </TarjetaCat>
          <TarjetaCat titulo={`Modelos de: ${catElegida?.nombre || '—'}`} accion="Agregar modelo"
            onAgregar={() => setForm({ tipo: 'modelo', fila: { categoria_id: elegida } })} deshabilitar={!catEquipo.length}>
            <Tabla filas={mod.filter((m) => m.categoria_id === elegida)} vacio="Esta categoría no tiene modelos." columnas={[
              { k: 'nombre', label: 'Nombre' },
              { k: 'estado', label: 'Estado', render: estado },
              { k: 'acciones', label: 'Acciones', alinear: 'right', render: editar('modelo') },
            ]} />
          </TarjetaCat>
          <div style={{ gridColumn: '1 / -1' }}><Ayuda>Haz clic en una categoría de equipos para ver sus modelos.</Ayuda></div>
        </div>
      )}

      {sub === 'ubicaciones' && (
        <TarjetaCat titulo="Ubicaciones internas" accion="Agregar ubicación interna" onAgregar={() => setForm({ tipo: 'ubicacion', fila: {} })}>
          <Tabla filas={ubi} vacio="Sin ubicaciones internas." columnas={[
            { k: 'nombre', label: 'Nombre' },
            { k: 'tipo', label: 'Tipo', render: (x) => L_TIPO_INT[x.tipo] || x.tipo },
            { k: 'descripcion', label: 'Descripción', render: (x) => x.descripcion || '—' },
            { k: 'estado', label: 'Estado', render: estado },
            { k: 'acciones', label: 'Acciones', alinear: 'right', render: editar('ubicacion') },
          ]} />
          <div style={{ padding: 14 }}><Ayuda>Solo bodegas y talleres de FOSAN. Las obras de los clientes se gestionan en Clientes.</Ayuda></div>
        </TarjetaCat>
      )}

      {sub === 'unidades' && (
        <TarjetaCat titulo="Unidades de medida" accion="Agregar unidad" onAgregar={() => setForm({ tipo: 'unidad', fila: {} })}>
          <Tabla filas={uni} vacio="Sin unidades de medida." columnas={[
            { k: 'nombre', label: 'Nombre' },
            { k: 'abreviatura', label: 'Abreviatura' },
            { k: 'estado', label: 'Estado', render: estado },
            { k: 'acciones', label: 'Acciones', alinear: 'right', render: editar('unidad') },
          ]} />
          <div style={{ padding: 14 }}><Ayuda>Ejemplos: unidad, litro, par. No se suman litros con unidades.</Ayuda></div>
        </TarjetaCat>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 14px', background: C.suave, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', font: '400 13px var(--font)' }}>
        <b style={{ marginRight: 6 }}>Reglas generales</b>
        <span>· Catálogos compartidos por todos los módulos.</span>
        <span>· Sin nombres duplicados.</span>
        <span>· Desactivar conserva referencias e historial.</span>
        <span>· No se eliminan elementos en uso.</span>
        <span>· Solo el dueño o un permiso autorizado.</span>
      </div>

      {form && <FormCatalogo {...form} categorias={catEquipo} todos={{ categoria: cat, modelo: mod, ubicacion: ubi, unidad: uni }}
        onCerrar={() => setForm(null)} onGuardado={listo} />}
    </div>
  )
}

function TarjetaCat({ titulo, accion, onAgregar, deshabilitar, children }) {
  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${C.borde}` }}>
        <h6 style={{ margin: 0, flex: 1 }}>{titulo}</h6>
        <Boton tipo="principal" icono={I.plus} onClick={onAgregar} disabled={deshabilitar} style={chico}>{accion}</Boton>
      </div>
      {children}
    </section>
  )
}

const TITULOS = {
  categoria: ['Nueva categoría', 'Editar categoría'],
  modelo: ['Nuevo modelo', 'Editar modelo'],
  ubicacion: ['Nueva ubicación interna', 'Editar ubicación interna'],
  unidad: ['Nueva unidad de medida', 'Editar unidad de medida'],
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function FormCatalogo({ tipo, fila, categorias, todos, onCerrar, onGuardado }) {
  const nuevo = !fila.id
  const activoInicial = fila.activo ?? fila.activa ?? true
  const [v, setV] = useState({
    nombre: fila.nombre || '', descripcion: fila.descripcion || '', activo: activoInicial,
    clase: fila.clase || 'equipo', categoria_id: fila.categoria_id || '', tipo: fila.tipo || 'bodega', abreviatura: fila.abreviatura || '',
  })
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState(null)       // uso al desactivar: segundo clic confirma
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k, val) => { setV((p) => ({ ...p, [k]: val })); setErrores({}); setAviso(null) }

  const guardar = async () => {
    const e = {}
    if (!v.nombre.trim()) e.nombre = 'El nombre es obligatorio.'
    if (tipo === 'modelo' && !v.categoria_id) e.categoria_id = 'Elige la categoría.'
    if (tipo === 'unidad' && !v.abreviatura.trim()) e.abreviatura = 'La abreviatura es obligatoria.'
    const otros = (todos[tipo] || []).filter((x) => x.id !== fila.id)
    if (v.nombre.trim() && otros.some((x) => norm(x.nombre) === norm(v.nombre))) e.nombre = 'Ya existe con ese nombre.'
    if (tipo === 'unidad' && v.abreviatura.trim() && otros.some((x) => norm(x.abreviatura) === norm(v.abreviatura))) e.abreviatura = 'Ya existe esa abreviatura.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true); setError(null)
    try {
      if (!nuevo && activoInicial && !v.activo && !aviso) {
        const n = await usoCatalogo(tipo, fila.id)
        if (n > 0) {
          if (tipo === 'ubicacion') throw new Error(`No se puede desactivar: hay ${n} equipo(s) en esta ubicación. Trasládalos primero.`)
          setAviso(n); setGuardando(false); return
        }
      }
      const base = { nombre: v.nombre.trim() }
      if (tipo === 'categoria') await guardarCategoria(fila.id, { ...base, descripcion: v.descripcion.trim() || null, clase: v.clase, activo: v.activo })
      if (tipo === 'modelo') await guardarModelo(fila.id, { ...base, descripcion: v.descripcion.trim() || null, categoria_id: v.categoria_id, activo: v.activo })
      if (tipo === 'ubicacion') await guardarUbicacionInterna(fila.id, { ...base, descripcion: v.descripcion.trim() || null, tipo: v.tipo, activa: v.activo })
      if (tipo === 'unidad') await guardarUnidad(fila.id, { ...base, abreviatura: v.abreviatura.trim(), activo: v.activo })
      onGuardado()
    } catch (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal titulo={TITULOS[tipo][nuevo ? 0 : 1]} ancho={480} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : aviso ? 'Desactivar igual' : 'Guardar'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        {tipo === 'modelo' && (
          <Campo etiqueta="Categoría" obligatorio error={errores.categoria_id}>
            <select value={v.categoria_id} onChange={(e) => set('categoria_id', e.target.value)}>
              <option value="">Seleccionar</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Nombre" obligatorio error={errores.nombre}>
          <input value={v.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={60} autoFocus
            placeholder={{ categoria: 'Baño químico', modelo: 'Estándar', ubicacion: 'Bodega principal', unidad: 'Litro' }[tipo]} />
        </Campo>
        {tipo === 'ubicacion' && (
          <Campo etiqueta="Tipo" obligatorio>
            <select value={v.tipo} onChange={(e) => set('tipo', e.target.value)}>
              <option value="bodega">Bodega</option>
              <option value="taller">Taller</option>
            </select>
          </Campo>
        )}
        {tipo === 'categoria' && (
          <Campo etiqueta="Uso" obligatorio ayuda="Equipos (baños y otros), insumos o EPP.">
            <select value={v.clase} onChange={(e) => set('clase', e.target.value)} disabled={!nuevo}>
              {Object.entries(L_CLASE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
        )}
        {tipo === 'unidad' && (
          <Campo etiqueta="Abreviatura" obligatorio error={errores.abreviatura}>
            <input value={v.abreviatura} onChange={(e) => set('abreviatura', e.target.value)} maxLength={10} placeholder="L" />
          </Campo>
        )}
        {tipo !== 'unidad' && (
          <Campo etiqueta="Descripción (opcional)">
            <textarea value={v.descripcion} onChange={(e) => set('descripcion', e.target.value)} maxLength={200} style={{ minHeight: 60 }} />
          </Campo>
        )}
        <div className="campo">
          <span>Estado</span>
          <div style={{ display: 'flex', gap: 18, font: '400 14px var(--font)' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={v.activo} onChange={() => set('activo', true)} /> Activo</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" checked={!v.activo} onChange={() => set('activo', false)} /> Inactivo</label>
          </div>
        </div>
        {aviso && (
          <Ayuda tono="atencion">
            Hay {aviso} registro(s) que lo usan. Al desactivarlo se conservan, pero ya no aparecerá para elegir en registros nuevos.
          </Ayuda>
        )}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ══ Historial de cambios (8.7 y 8.8) ═════════════════════════════════════════
const MODULO = {
  clientes: 'Clientes', cliente_contactos: 'Clientes', servicios_cliente: 'Clientes', ubicaciones: 'Ubicaciones',
  activos: 'Inventario', documentos_activo: 'Inventario', observaciones_activo: 'Inventario', modelos_bano: 'Administración',
  insumos: 'Inventario', compras: 'Inventario', compra_lineas: 'Inventario', proveedores: 'Inventario', receta_limpieza: 'Inventario',
  rutas: 'Operaciones', ruta_paradas: 'Operaciones', salidas: 'Operaciones', salida_paradas: 'Operaciones',
  despachos: 'Operaciones', despacho_banos: 'Operaciones', rutas_semana: 'Operaciones', rutas_semana_lineas: 'Operaciones',
  eventos: 'Operaciones', servicios: 'Operaciones', servicio_activos: 'Operaciones',
  vehiculos: 'Flota', mantenciones: 'Mantenimiento',
  perfiles: 'Administración', personal: 'Administración', permisos_rol: 'Administración', categorias: 'Administración',
  unidades_medida: 'Administración', rubros: 'Administración', parametros: 'Administración',
  ventas: 'Reportes', costos: 'Reportes',
}
const L_ACC = { crear: 'Registro creado', modificar: 'Dato modificado', eliminar: 'Registro eliminado' }
const SECRETOS = /clave|password|contrasen|token|hash/i
const OCULTOS = new Set(['id', 'qr_token', 'creado_en', 'actualizado_en', 'rut_norm'])
const txt = (x) => (x === null || x === undefined || x === '' ? '—' : x === true ? 'Sí' : x === false ? 'No' : typeof x === 'object' ? JSON.stringify(x) : String(x))
const campoL = (k) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ')
const modulo = (r) => MODULO[r.tabla] || 'Otros'

function HistorialCambios() {
  const hace7 = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 6); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }, [])
  const VACIO = { desde: hace7, hasta: hoyISO(), usuario: '', modulo: '', accion: '' }
  const [f, setF] = useState(VACIO)
  const [aplicado, setAplicado] = useState(VACIO)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [ver, setVer] = useState(null)

  useEffect(() => {
    setDatos(null)
    const desde = aplicado.desde ? new Date(aplicado.desde + 'T00:00:00').toISOString() : null
    const hasta = aplicado.hasta ? new Date(aplicado.hasta + 'T23:59:59').toISOString() : null
    historialRango(desde, hasta).then(setDatos).catch(setError)
  }, [aplicado.desde, aplicado.hasta])

  const usuarios = useMemo(() => [...new Set((datos || []).map((r) => r.usuario_nombre).filter(Boolean))].sort(), [datos])
  const filas = (datos || []).filter((r) => (!aplicado.usuario || r.usuario_nombre === aplicado.usuario)
    && (!aplicado.modulo || modulo(r) === aplicado.modulo) && (!aplicado.accion || r.accion === aplicado.accion))
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <span className="text-muted">Cambios realizados en el sistema. Solo consulta: no se edita ni se borra.</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Campo etiqueta="Desde" style={{ width: 160 }}><input type="date" value={f.desde} max={f.hasta || undefined} onChange={set('desde')} /></Campo>
        <Campo etiqueta="Hasta" style={{ width: 160 }}><input type="date" value={f.hasta} min={f.desde || undefined} onChange={set('hasta')} /></Campo>
        <Campo etiqueta="Usuario" style={{ width: 170 }}>
          <select value={f.usuario} onChange={set('usuario')}><option value="">Todos</option>{usuarios.map((u) => <option key={u}>{u}</option>)}</select>
        </Campo>
        <Campo etiqueta="Módulo" style={{ width: 170 }}>
          <select value={f.modulo} onChange={set('modulo')}>
            <option value="">Todos</option>
            {['Clientes', 'Ubicaciones', 'Inventario', 'Operaciones', 'Flota', 'Mantenimiento', 'Reportes', 'Administración', 'Otros'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Acción" style={{ width: 170 }}>
          <select value={f.accion} onChange={set('accion')}><option value="">Todas</option>{Object.entries(L_ACC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Campo>
        <Boton tipo="principal" onClick={() => setAplicado(f)}>Aplicar filtros</Boton>
        <Boton onClick={() => { setF(VACIO); setAplicado(VACIO) }}>Limpiar</Boton>
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {datos === null && !error ? <div style={{ color: C.gris }}>Cargando…</div> : (
        <div className="card">
          <Tabla filas={filas} vacio="Sin cambios para estos filtros." columnas={[
            { k: 'fecha', label: 'Fecha', render: (r) => fechaHora(r.fecha) },
            { k: 'usuario_nombre', label: 'Usuario', render: (r) => r.usuario_nombre || '—' },
            { k: 'modulo', label: 'Módulo', render: modulo },
            { k: 'accion', label: 'Acción', render: (r) => L_ACC[r.accion] || r.accion },
            { k: 'etiqueta', label: 'Registro', render: (r) => r.etiqueta || '—' },
            { k: 'ver', label: 'Ver detalle', alinear: 'right', render: (r) => <Boton onClick={() => setVer(r)} style={chico}>Ver detalle</Boton> },
          ]} />
        </div>
      )}
      {datos && datos.length >= 2000 && <Ayuda tono="atencion">Se muestran los 2.000 cambios más recientes del período. Acota las fechas para ver más.</Ayuda>}
      {ver && <DetalleCambio r={ver} onCerrar={() => setVer(null)} />}
    </div>
  )
}

function DetalleCambio({ r, onCerrar }) {
  const entradas = Object.entries(r.cambios || {}).filter(([k]) => !OCULTOS.has(k))
  const motivo = r.accion === 'modificar'
    ? (r.cambios?.motivo_desactivacion?.despues || r.cambios?.motivo?.despues)
    : (r.cambios?.motivo_desactivacion || r.cambios?.motivo)
  const fila = (l, v) => (
    <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10, padding: '4px 0', font: '400 14px var(--font)' }}>
      <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
  return (
    <Modal titulo="Detalle del cambio" ancho={620} onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div>
          {fila('Fecha', fechaHora(r.fecha))}
          {fila('Usuario', r.usuario_nombre || '—')}
          {fila('Módulo', modulo(r))}
          {fila('Registro', r.etiqueta || '—')}
          {fila('Acción', L_ACC[r.accion] || r.accion)}
          {motivo && fila('Motivo', String(motivo))}
        </div>
        <table>
          <thead><tr><th>Campo</th>{r.accion === 'modificar' && <th>Valor anterior</th>}<th>{r.accion === 'modificar' ? 'Valor nuevo' : 'Valor'}</th></tr></thead>
          <tbody>
            {entradas.map(([k, x]) => {
              const secreto = SECRETOS.test(k)
              return (
                <tr key={k}>
                  <td style={{ fontWeight: 600 }}>{campoL(k)}</td>
                  {r.accion === 'modificar' && <td>{secreto ? '••••' : txt(x?.antes)}</td>}
                  <td>{secreto ? '••••' : txt(r.accion === 'modificar' ? x?.despues : x)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#fef7e0', border: `1px solid ${C.amarillo}`, borderRadius: 'var(--radio-md)', font: '400 13px/1.45 var(--font)' }}>
          <Icon d={I.alert} size={18} color={C.amarillo} />
          <span><b>Importante.</b> Para contraseñas solo se registra quién la asignó y la fecha; nunca la clave ni su valor anterior.</span>
        </div>
      </div>
    </Modal>
  )
}
