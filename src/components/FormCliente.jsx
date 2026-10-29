// Formulario Nuevo cliente / Editar datos (láminas 2.2, 2.3 y 2.4).
// Solo datos generales. Contactos, ubicaciones y servicios van en la ficha del cliente.
// Los campos antiguos (valor mensual, días de limpieza, baños propios, lat/lng, contrato)
// no se muestran ni se modifican: siguen en la base para Análisis y Rutas semanales.
import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Boton, Campo as CampoBase, Ayuda } from './Base'
import { clientePorId, clientePorRut, guardarDatosCliente, rubros as cargarRubros, crearRubro } from '../lib/api'
import { formatoRut, rutValido, formatoTel, telValido, correoValido } from '../lib/validar'
import { C, Icon, I } from '../lib/ui'

const COMUNAS_MAULE = [
  'Talca', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael',
  'Cauquenes', 'Chanco', 'Pelluhue', 'Curicó', 'Hualañé', 'Licantén', 'Molina', 'Rauco', 'Romeral', 'Sagrada Familia',
  'Teno', 'Vichuquén', 'Linares', 'Colbún', 'Longaví', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre', 'Yerbas Buenas',
]

const VACIO = {
  tipo_cliente: 'empresa', rut: '', nombre: '', nombre_comercial: '', rubro: '',
  telefono: '', correo: '', direccion: '', comuna: '', observaciones: '',
}

// onAbrir(id): abre el cliente existente (RUT ya registrado o recién creado)
export default function FormCliente({ clienteId = null, onCerrar, onGuardado, onAbrir }) {
  const [v, setV] = useState(VACIO)
  const [listaRubros, setListaRubros] = useState([])
  const [nuevoRubro, setNuevoRubro] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [duplicado, setDuplicado] = useState(null)   // cliente que ya tiene ese RUT
  const [creado, setCreado] = useState(null)         // { id, codigo } al terminar

  useEffect(() => {
    cargarRubros().then((r) => {
      setListaRubros(r)
      if (!clienteId && r.length) setV((p) => (p.rubro ? p : { ...p, rubro: r.find((x) => x.clave === 'construccion')?.clave || r[0].clave }))
    }).catch(setError)
    if (clienteId) {
      clientePorId(clienteId).then((c) => {
        if (!c) return
        const t = (x) => (x === null || x === undefined ? '' : String(x))
        setV({
          tipo_cliente: c.tipo_cliente || 'empresa', rut: formatoRut(c.rut), nombre: t(c.nombre),
          nombre_comercial: t(c.nombre_comercial), rubro: t(c.rubro), telefono: t(c.telefono), correo: t(c.correo),
          direccion: t(c.direccion), comuna: t(c.comuna), observaciones: t(c.observaciones),
        })
      }).catch(setError)
    }
  }, [])

  const set = (k, fmt) => (e) => {
    const val = fmt ? fmt(e.target.value) : e.target.value
    setV((p) => ({ ...p, [k]: val }))
    setErrores((p) => ({ ...p, [k]: undefined, contacto: undefined }))
  }

  const elegirRubro = (e) => {
    if (e.target.value === '__nuevo') { setNuevoRubro(''); return }
    set('rubro')(e)
  }
  const agregarRubro = async () => {
    const n = (nuevoRubro || '').trim()
    if (!n) return
    try {
      const r = await crearRubro(n)
      setListaRubros((p) => [...p, r].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setV((p) => ({ ...p, rubro: r.clave }))
      setNuevoRubro(null)
    } catch (e) { setError(e) }
  }

  const validar = () => {
    const e = {}
    if (!v.tipo_cliente) e.tipo_cliente = 'Elige el tipo de cliente.'
    if (!v.rut) e.rut = 'El RUT es obligatorio.'
    else if (!rutValido(v.rut)) e.rut = 'RUT inválido: revisa el dígito verificador.'
    if (!v.nombre.trim()) e.nombre = 'El nombre o razón social es obligatorio.'
    if (!v.telefono && !v.correo.trim()) e.contacto = 'Registra al menos un medio de contacto: teléfono o correo.'
    if (v.telefono && !telValido(v.telefono)) e.telefono = 'Formato: +56 9 1234 5678'
    if (v.correo && !correoValido(v.correo)) e.correo = 'Correo inválido.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true)
    setError(null)
    try {
      const otro = await clientePorRut(v.rut, clienteId)
      if (otro) { setDuplicado(otro); setGuardando(false); return }
      const datos = {
        tipo_cliente: v.tipo_cliente,
        rut: formatoRut(v.rut),
        nombre: v.nombre.trim(),
        nombre_comercial: v.nombre_comercial.trim() || null,
        ...(v.rubro ? { rubro: v.rubro } : {}),
        telefono: v.telefono || null,
        correo: v.correo.trim() || null,
        direccion: v.direccion.trim() || null,
        comuna: v.comuna.trim() || null,
        observaciones: v.observaciones.trim() || null,
      }
      const r = await guardarDatosCliente(clienteId, datos)
      if (clienteId) { onGuardado(r.id); return }
      setCreado(r)
      setGuardando(false)
    } catch (e) {
      setError(e.code === '23505' ? { message: 'Ya existe un cliente con ese RUT.' } : e)
      setGuardando(false)
    }
  }

  // ── Estado de validación: RUT ya registrado (lámina 2.2 · 3) ──
  if (duplicado) {
    return (
      <Modal titulo="RUT ya registrado" ancho={480} onCerrar={onCerrar} pie={<>
        <Boton onClick={() => setDuplicado(null)}>Volver</Boton>
        {onAbrir && <Boton tipo="principal" onClick={() => onAbrir(duplicado.id)}>Abrir ficha</Boton>}
      </>}>
        <div style={{ padding: 18 }}>
          <Ayuda tono="error">
            Este RUT pertenece a <b>{duplicado.nombre}</b> ({duplicado.codigo}){duplicado.activo ? '' : ', que está desactivado'}.
            Abre su ficha para agregar ubicaciones o servicios; no crees otro cliente por cada obra.
          </Ayuda>
        </div>
      </Modal>
    )
  }

  // ── Estado de éxito (lámina 2.2 · 4) ──
  if (creado) {
    return (
      <Modal titulo="Cliente creado" ancho={440} onCerrar={() => onGuardado(creado.id)} pie={<>
        <Boton onClick={() => onGuardado(creado.id)}>Cerrar</Boton>
        {onAbrir && <Boton tipo="principal" onClick={() => onAbrir(creado.id)}>Abrir ficha</Boton>}
      </>}>
        <div style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', font: '400 14px/1.5 var(--font)' }}>
          <Icon d={I.check} size={26} color={C.verde} w={2.4} />
          <span><b>{v.nombre}</b> se registró correctamente con el código <b>{creado.codigo}</b>.</span>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titulo={clienteId ? 'Editar datos del cliente' : 'Nuevo cliente'} ancho={760} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : clienteId ? 'Guardar cambios' : 'Guardar cliente'}
      </Boton>
    </>}>
      <div className="cols2" style={{ gap: 16, padding: 18 }}>
        <CampoBase etiqueta="Tipo de cliente" obligatorio error={errores.tipo_cliente}>
          <select value={v.tipo_cliente} onChange={set('tipo_cliente')}>
            <option value="empresa">Empresa</option>
            <option value="persona">Persona</option>
          </select>
        </CampoBase>
        <CampoBase etiqueta="RUT" obligatorio ayuda="Formato referencial: 12.345.678-5" error={errores.rut}>
          <input value={v.rut} onChange={set('rut', formatoRut)} maxLength={12} placeholder="12.345.678-5" />
        </CampoBase>

        <CampoBase etiqueta={v.tipo_cliente === 'persona' ? 'Nombre completo' : 'Nombre / razón social'} obligatorio error={errores.nombre}>
          <input value={v.nombre} onChange={set('nombre')} maxLength={120} placeholder="CONSTRUCTORA NORTE" />
        </CampoBase>
        <CampoBase etiqueta="Nombre comercial">
          <input value={v.nombre_comercial} onChange={set('nombre_comercial')} maxLength={80} placeholder="NORTE" />
        </CampoBase>

        <div style={{ display: 'grid', gap: 8 }}>
          <CampoBase etiqueta="Rubro">
            <select value={v.rubro} onChange={elegirRubro}>
              {!v.rubro && <option value="">Seleccionar</option>}
              {listaRubros.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
              <option value="__nuevo">+ Agregar nuevo rubro…</option>
            </select>
          </CampoBase>
          {nuevoRubro !== null && (
            <div className="campo" style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={nuevoRubro} onChange={(e) => setNuevoRubro(e.target.value)} maxLength={40}
                onKeyDown={(e) => e.key === 'Enter' && agregarRubro()} placeholder="Nombre del rubro" style={{ flex: 1, minWidth: 0 }} />
              <Boton tipo="principal" onClick={agregarRubro}>Agregar</Boton>
              <Boton onClick={() => setNuevoRubro(null)} aria-label="Cancelar rubro">✕</Boton>
            </div>
          )}
        </div>
        <CampoBase etiqueta="Teléfono principal" error={errores.telefono}>
          <input value={v.telefono} onChange={set('telefono', formatoTel)} inputMode="tel" placeholder="+56 9 1234 5678" />
        </CampoBase>

        <CampoBase etiqueta="Correo principal" error={errores.correo}>
          <input type="email" value={v.correo} onChange={set('correo')} maxLength={120} placeholder="contacto@ejemplo.cl" />
        </CampoBase>
        <CampoBase etiqueta="Dirección administrativa">
          <input value={v.direccion} onChange={set('direccion')} maxLength={160} placeholder="AV. CENTRAL 100" />
        </CampoBase>

        <CampoBase etiqueta="Comuna">
          <input value={v.comuna} onChange={set('comuna')} maxLength={60} list="comunas-maule" placeholder="Seleccionar o escribir" />
          <datalist id="comunas-maule">{COMUNAS_MAULE.map((c) => <option key={c} value={c} />)}</datalist>
        </CampoBase>
        <CampoBase etiqueta="Observaciones">
          <textarea value={v.observaciones} onChange={set('observaciones')} maxLength={500} style={{ minHeight: 44 }} />
        </CampoBase>
      </div>

      <div style={{ padding: '0 18px 18px', display: 'grid', gap: 10 }}>
        <Ayuda tono={errores.contacto ? 'error' : 'info'}>
          {errores.contacto || 'Registra al menos un medio de contacto: teléfono o correo. Las obras y servicios se agregan después en la ficha del cliente.'}
        </Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// Se mantiene: lo usan FormDespacho, FormVehiculo, FormRutaSemana, Salida, Insumos y Ubicaciones.
export function Campo({ l, err, children }) {
  return (
    <label className="campo">
      <span>{l}</span>
      {children}
      {err && <em style={{ font: '400 11px var(--font)', color: '#b3261e', fontStyle: 'normal' }}>{err}</em>}
    </label>
  )
}
