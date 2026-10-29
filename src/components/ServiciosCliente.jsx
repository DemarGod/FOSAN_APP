// Pestaña Servicios de la ficha del cliente (láminas 2.8 y 2.9).
// Formulario común + UNO de los apartados A, B o C según el tipo.
// Guardar registra el acuerdo: no reserva equipos, no crea entregas ni limpiezas.
// La base recalcula sola los días de limpieza, baños propios y valor mensual del cliente (script 24).
import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import { Boton, Campo, Tabla, Estado, Ayuda } from './Base'
import {
  serviciosDe, ubicacionesDe, contactosDe, categoriasEquipo, externosDe, crearExterno,
  guardarServicio, finalizarServicio,
} from '../lib/api'
import { formatoPesos, numeroDe, decimalDe, fechaValida, FECHA_MIN, FECHA_MAX } from '../lib/validar'
import { DIAS, hoyISO } from '../lib/costos'
import { C, Icon, I, fecha, clp } from '../lib/ui'

export const L_TIPO_SERV = {
  arriendo_limpieza: 'Arriendo de baños con limpieza',
  limpieza_cliente: 'Limpieza de baños del cliente',
  limpieza_fosas: 'Limpieza de fosas sépticas',
}
const L_FRECUENCIA = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }
const L_MODALIDAD = { puntual: 'Puntual', recurrente: 'Recurrente' }
const PROHIBIDO = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8'
const ABAJO = 'M6 9l6 6 6-6'
const chico = { minHeight: 34, padding: '6px 12px' }
const diasL = (arr) => DIAS.filter((d) => (arr || []).includes(d.v)).map((d) => d.l).join(' · ') || '—'

export default function ServiciosCliente({ cliente, editable, finanzas, onCambio }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)        // {} nuevo · servicio a editar
  const [detalle, setDetalle] = useState(null)
  const [finalizar, setFinalizar] = useState(null)
  const cargar = () => serviciosDe(cliente.id).then(setLista).catch(setError)
  useEffect(() => { cargar() }, [cliente.id])
  const listo = () => { setForm(null); setFinalizar(null); cargar(); onCambio() }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="text-muted" style={{ flex: 1 }}>Cada servicio es un acuerdo con el cliente en una de sus ubicaciones.</span>
        <Boton tipo="principal" icono={I.plus} onClick={() => setForm({})} disabled={!editable || !cliente.activo}>Agregar servicio</Boton>
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {lista === null ? <div style={{ color: C.gris }}>Cargando…</div> : (
        <div className="card">
          <Tabla filas={lista} vacio="Este cliente aún no tiene servicios." columnas={[
            { k: 'codigo', label: 'Código', ancho: 90 },
            { k: 'tipo', label: 'Tipo de servicio', render: (x) => L_TIPO_SERV[x.tipo] || x.tipo },
            { k: 'ubicacion', label: 'Ubicación', render: (x) => x.ubicaciones?.nombre || '—' },
            { k: 'inicio', label: 'Inicio', render: (x) => fecha(x.fecha_inicio) },
            { k: 'termino', label: 'Término', render: (x) => (x.fecha_termino ? fecha(x.fecha_termino) : 'Sin término') },
            { k: 'estado', label: 'Vigencia', render: (x) => <Estado tono={x.estado === 'vigente' ? 'ok' : 'neutro'}>{x.estado === 'vigente' ? 'Vigente' : 'Finalizado'}</Estado> },
            {
              k: 'acciones', label: 'Acciones', alinear: 'right', render: (x) => (
                <div style={{ display: 'inline-flex', gap: 6 }}>
                  <Boton onClick={() => (editable && x.estado === 'vigente' ? setForm(x) : setDetalle(x))} style={chico}>
                    {editable && x.estado === 'vigente' ? 'Ver / Editar' : 'Ver'}
                  </Boton>
                  <Menu opciones={[
                    { l: 'Ver detalle', d: I.ojo, onClick: () => setDetalle(x) },
                    { l: 'Editar acuerdo', d: I.lapiz, onClick: () => setForm(x), disabled: !editable || x.estado !== 'vigente' },
                    { l: 'Crear orden', d: I.doc, onClick: () => {}, disabled: true, nota: 'Llega con Operaciones' },
                    { l: 'Finalizar servicio', d: PROHIBIDO, color: C.rojo, onClick: () => setFinalizar(x), disabled: !editable || x.estado !== 'vigente' },
                  ]} />
                </div>
              ),
            },
          ]} />
        </div>
      )}
      <Ayuda>
        Finalizar un servicio no confirma el retiro de equipos. "Crear orden" (abrir Operaciones con cliente, ubicación y servicio cargados) llega con la etapa de Operaciones.
      </Ayuda>

      {form && <FormServicio cliente={cliente} servicio={form} finanzas={finanzas} onCerrar={() => setForm(null)} onGuardado={listo} />}
      {detalle && <DetalleServicio servicio={detalle} finanzas={finanzas} onCerrar={() => setDetalle(null)} />}
      {finalizar && <Finalizar servicio={finalizar} onCerrar={() => setFinalizar(null)} onListo={listo} />}
    </div>
  )
}

// ── Menú ▾ de cada fila (posición fija para que la tabla no lo recorte) ───
function Menu({ opciones }) {
  const [abierto, setAbierto] = useState(null)
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
    const alto = opciones.length * 44 + 10
    const top = r.bottom + 4 + alto > window.innerHeight ? r.top - 4 - alto : r.bottom + 4
    setAbierto({ top, right: window.innerWidth - r.right })
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn" aria-label="Más acciones" onClick={alternar} style={{ minHeight: 34, padding: '6px 8px' }}>
        <Icon d={ABAJO} size={16} />
      </button>
      {abierto && (
        <div role="menu" style={{
          position: 'fixed', right: abierto.right, top: abierto.top, zIndex: 1100, minWidth: 200, padding: 4,
          background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', boxShadow: '0 8px 24px rgba(19,41,75,.14)',
        }}>
          {opciones.map((o) => (
            <button key={o.l} type="button" role="menuitem" disabled={o.disabled} title={o.nota}
              onClick={() => { setAbierto(null); o.onClick() }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0, background: 'transparent',
                padding: '9px 10px', borderRadius: 'var(--radio-sm)', font: '400 14px var(--font)', textAlign: 'left',
                color: o.color || C.tinta, cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.45 : 1,
              }}>
              <Icon d={o.d} size={16} color={o.color || C.gris} />
              <span style={{ flex: 1 }}>{o.l}{o.nota && <small style={{ display: 'block', color: C.gris }}>{o.nota}</small>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Días preferidos (chips Lun … Dom) ─────────────────────────────────────
function Dias({ valor, onChange, max }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {DIAS.map((d) => {
        const on = valor.includes(d.v)
        const bloqueado = !on && max != null && valor.length >= max
        return (
          <button key={d.v} type="button" disabled={bloqueado}
            onClick={() => onChange(on ? valor.filter((x) => x !== d.v) : [...valor, d.v].sort((a, b) => a - b))}
            style={{
              minWidth: 48, minHeight: 34, padding: '0 10px', borderRadius: 'var(--radio-sm)', cursor: bloqueado ? 'not-allowed' : 'pointer',
              border: `1px solid ${on ? C.azul : C.borde}`, background: on ? C.tinte : C.blanco,
              color: on ? C.azul : C.tinta, font: '600 13px var(--font)', opacity: bloqueado ? 0.45 : 1,
            }}>{d.l}</button>
        )
      })}
    </div>
  )
}

// ── Formulario común: Agregar / Editar servicio (2.9) ─────────────────────
function FormServicio({ cliente, servicio, finanzas, onCerrar, onGuardado }) {
  const nuevo = !servicio.id
  const t = (x) => (x === null || x === undefined ? '' : String(x))
  const inicial = useMemo(() => ({
    tipo: servicio.tipo || '', ubicacion_id: t(servicio.ubicacion_id), fecha_inicio: servicio.fecha_inicio || hoyISO(),
    fecha_termino: t(servicio.fecha_termino), sin_termino: nuevo ? true : !servicio.fecha_termino,
    contacto_id: t(servicio.contacto_id), observaciones: t(servicio.observaciones),
    valor_mensual: servicio.valor_mensual ? formatoPesos(servicio.valor_mensual) : '',
    categoria_id: t(servicio.categoria_id), cantidad: t(servicio.cantidad),
    frecuencia: servicio.frecuencia || 'semanal', limpiezas_semana: t(servicio.limpiezas_semana ?? (nuevo ? '' : '')),
    dias: servicio.dias || [], modalidad: servicio.modalidad || 'puntual', volumen_m3: t(servicio.volumen_m3),
    acceso: t(servicio.acceso),
  }), [])
  const [v, setV] = useState(inicial)
  const [ubic, setUbic] = useState([])
  const [contactos, setContactos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [externos, setExternos] = useState([])
  const [elegidos, setElegidos] = useState([])          // ids de equipos externos de este servicio
  const elegidosIniciales = useRef([])
  const [nuevoExt, setNuevoExt] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    Promise.all([ubicacionesDe(cliente.id), contactosDe(cliente.id), categoriasEquipo(), externosDe(cliente.id)])
      .then(([u, k, cat, ext]) => {
        setUbic(u.filter((x) => x.activa || x.id === servicio.ubicacion_id))
        setContactos(k.filter((x) => x.activo || x.id === servicio.contacto_id))
        setCategorias(cat)
        setExternos(ext)
        const mios = servicio.id ? ext.filter((e) => e.servicio_id === servicio.id).map((e) => e.id) : []
        elegidosIniciales.current = mios
        setElegidos(mios)
        if (nuevo && u.filter((x) => x.activa).length === 1) setV((p) => ({ ...p, ubicacion_id: u.find((x) => x.activa).id }))
        if (nuevo) {
          const principal = k.find((x) => x.principal && x.activo)
          if (principal) setV((p) => ({ ...p, contacto_id: principal.id }))
          const bq = cat.find((c) => c.nombre === 'Baño químico')
          if (bq) setV((p) => ({ ...p, categoria_id: p.categoria_id || bq.id }))
        }
      }).catch(setError)
  }, [])

  const sucio = JSON.stringify(v) !== JSON.stringify(inicial) || JSON.stringify(elegidos) !== JSON.stringify(elegidosIniciales.current)
  const cerrar = () => (!sucio || window.confirm('Hay cambios sin guardar. ¿Salir sin guardar?')) && onCerrar()
  const set = (k, fmt) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : fmt ? fmt(e.target.value) : e.target.value
    setV((p) => ({ ...p, [k]: val })); setErrores({})
  }
  const entero = (x) => x.replace(/\D/g, '').slice(0, 3)
  const limp = Number(v.limpiezas_semana || 0)
  // Externos que se pueden elegir: los de este cliente que no atiende otro servicio vigente
  const disponiblesExt = externos.filter((e) => !e.servicio_id || e.servicio_id === servicio.id || !e.servicio_vigente)
  const ubicNombre = (id) => ubic.find((u) => u.id === id)?.nombre

  const validar = () => {
    const e = {}
    if (!v.tipo) e.tipo = 'Elige el tipo de servicio.'
    if (!v.ubicacion_id) e.ubicacion_id = 'Elige la ubicación del servicio.'
    if (!v.fecha_inicio || !fechaValida(v.fecha_inicio)) e.fecha_inicio = 'Fecha de inicio inválida.'
    if (!v.sin_termino) {
      if (!v.fecha_termino || !fechaValida(v.fecha_termino)) e.fecha_termino = 'Indica la fecha de término o marca "Sin fecha de término".'
      else if (v.fecha_termino < v.fecha_inicio) e.fecha_termino = 'Debe ser igual o posterior al inicio.'
    }
    if (v.tipo === 'arriendo_limpieza') {
      if (!v.categoria_id) e.categoria_id = 'Elige la categoría.'
      if (!(Number(v.cantidad) >= 1)) e.cantidad = 'Mínimo 1, solo números enteros.'
    }
    if (v.tipo === 'arriendo_limpieza' || v.tipo === 'limpieza_cliente') {
      if (!v.frecuencia) e.frecuencia = 'Elige la frecuencia.'
      if (v.limpiezas_semana === '' || limp > 7) e.limpiezas_semana = 'Entre 0 y 7.'
      if (v.dias.length > limp) e.dias = `Elegiste ${v.dias.length} día(s) y son ${limp} limpieza(s) por semana.`
    }
    if (v.tipo === 'limpieza_cliente' && !elegidos.length && (nuevo || !Number(servicio.cantidad))) {
      e.externos = 'Elige o registra al menos un equipo externo.'
    }
    if (v.tipo === 'limpieza_fosas') {
      if (!v.modalidad) e.modalidad = 'Elige la modalidad.'
      if (v.modalidad === 'recurrente' && !v.frecuencia) e.frecuencia = 'Elige la frecuencia.'
      if (v.volumen_m3 && decimalDe(v.volumen_m3) === null) e.volumen_m3 = 'Número con decimales, por ejemplo 2,5.'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async () => {
    if (!validar()) return
    setGuardando(true); setError(null)
    const A = v.tipo === 'arriendo_limpieza', B = v.tipo === 'limpieza_cliente', F = v.tipo === 'limpieza_fosas'
    const datos = {
      tipo: v.tipo,
      ubicacion_id: v.ubicacion_id,
      fecha_inicio: v.fecha_inicio,
      fecha_termino: v.sin_termino ? null : v.fecha_termino,
      contacto_id: v.contacto_id || null,
      observaciones: v.observaciones.trim() || null,
      ...(finanzas ? { valor_mensual: numeroDe(v.valor_mensual) } : {}),
      // Solo los campos del apartado elegido; los demás quedan vacíos
      categoria_id: A ? v.categoria_id : null,
      cantidad: A ? Number(v.cantidad) : B ? (elegidos.length || Number(servicio.cantidad) || null) : null,
      frecuencia: A || B ? v.frecuencia : F && v.modalidad === 'recurrente' ? v.frecuencia : null,
      limpiezas_semana: A || B ? limp : null,
      dias: A || B ? (v.dias.length ? v.dias : null) : null,
      modalidad: F ? v.modalidad : null,
      volumen_m3: F && v.volumen_m3 ? decimalDe(v.volumen_m3) : null,
      acceso: F ? v.acceso.trim() || null : null,
    }
    try {
      await guardarServicio(cliente.id, servicio.id, datos, B ? elegidos : [], elegidosIniciales.current)
      onGuardado()
    } catch (err) { setError(err); setGuardando(false) }
  }

  return (
    <Modal titulo={nuevo ? 'Agregar servicio' : `Editar acuerdo ${servicio.codigo}`} ancho={900} onCerrar={cerrar} pie={<>
      <Boton onClick={cerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar servicio'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Campo etiqueta="Cliente" style={{ flex: 1, minWidth: 220 }}><input value={cliente.nombre} readOnly /></Campo>
          <span className="text-muted" style={{ paddingBottom: 10 }}>RUT {cliente.rut || '—'}</span>
        </div>
        <div className="cols2" style={{ gap: 14 }}>
          <Campo etiqueta="Ubicación de servicio" obligatorio error={errores.ubicacion_id}
            ayuda={!ubic.length ? 'Primero agrega una ubicación en la pestaña Ubicaciones.' : undefined}>
            <select value={v.ubicacion_id} onChange={set('ubicacion_id')}>
              <option value="">Seleccionar</option>
              {ubic.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Tipo de servicio" obligatorio error={errores.tipo} ayuda={!nuevo ? 'El tipo no se cambia: si cambia el acuerdo, finaliza este y crea otro.' : undefined}>
            <select value={v.tipo} onChange={set('tipo')} disabled={!nuevo}>
              <option value="">Seleccionar</option>
              {Object.entries(L_TIPO_SERV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Campo>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <Campo etiqueta="Fecha de inicio" obligatorio error={errores.fecha_inicio}>
              <input type="date" min={FECHA_MIN} max={FECHA_MAX} value={v.fecha_inicio} onChange={set('fecha_inicio')} />
            </Campo>
            <Campo etiqueta="Fecha de término" error={errores.fecha_termino}>
              <input type="date" min={v.fecha_inicio || FECHA_MIN} max={FECHA_MAX} value={v.sin_termino ? '' : v.fecha_termino}
                onChange={set('fecha_termino')} disabled={v.sin_termino} />
            </Campo>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', font: '600 13px var(--font)', alignSelf: 'end', minHeight: 40 }}>
            <input type="checkbox" checked={v.sin_termino} onChange={set('sin_termino')} /> Sin fecha de término
          </label>
          <Campo etiqueta="Contacto responsable">
            <select value={v.contacto_id} onChange={set('contacto_id')}>
              <option value="">Sin contacto</option>
              {contactos.map((k) => <option key={k.id} value={k.id}>{k.nombre}{k.correo ? ` (${k.correo})` : ''}</option>)}
            </select>
          </Campo>
          {finanzas && (
            <Campo etiqueta="Valor mensual (CLP)" ayuda="Visible solo para quien ve montos. Lo usa Análisis como ingreso.">
              <input value={v.valor_mensual} onChange={set('valor_mensual', formatoPesos)} inputMode="numeric" placeholder="$540.000" />
            </Campo>
          )}
        </div>
        <Campo etiqueta="Observaciones del acuerdo">
          <textarea value={v.observaciones} onChange={set('observaciones')} maxLength={500} style={{ minHeight: 60 }} placeholder="Ingrese observaciones del acuerdo…" />
        </Campo>

        {/* ── A: Arriendo de baños con limpieza ── */}
        {v.tipo === 'arriendo_limpieza' && (
          <Apartado titulo="Arriendo de baños con limpieza" nota="La cantidad solicitada no reserva equipos. Los códigos se asignan en la orden de entrega de Operaciones.">
            <div className="cols2" style={{ gap: 14 }}>
              <Campo etiqueta="Categoría de equipo" obligatorio error={errores.categoria_id}>
                <select value={v.categoria_id} onChange={set('categoria_id')}>
                  <option value="">Seleccionar</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Cantidad solicitada" obligatorio ayuda="Mínimo 1, solo números enteros." error={errores.cantidad}>
                <input value={v.cantidad} onChange={set('cantidad', entero)} inputMode="numeric" placeholder="2" />
              </Campo>
              <Frecuencia v={v} set={set} entero={entero} errores={errores} />
            </div>
            <DiasCampo v={v} setV={setV} limp={limp} error={errores.dias} />
          </Apartado>
        )}

        {/* ── B: Limpieza de baños del cliente ── */}
        {v.tipo === 'limpieza_cliente' && (
          <Apartado titulo="Limpieza de baños del cliente" nota="Equipo del cliente: no aumenta el inventario propio disponible.">
            <div className="campo">
              <span>Equipos externos a atender <b className="obligatorio">*</b></span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {disponiblesExt.length === 0 && <span className="text-muted">Este cliente aún no tiene equipos externos registrados.</span>}
                {disponiblesExt.map((e) => {
                  const on = elegidos.includes(e.id)
                  return (
                    <button key={e.id} type="button" onClick={() => { setErrores({}); setElegidos((p) => (on ? p.filter((x) => x !== e.id) : [...p, e.id])) }}
                      style={{
                        minHeight: 34, padding: '0 10px', borderRadius: 'var(--radio-sm)', cursor: 'pointer',
                        border: `1px solid ${on ? C.azul : C.borde}`, background: on ? C.tinte : C.blanco,
                        color: on ? C.azul : C.tinta, font: '600 13px var(--font)',
                      }}>
                      {on ? '✓ ' : ''}{e.codigo} · {e.detalle || 'Baño del cliente'}{e.codigo_cliente ? ` (${e.codigo_cliente})` : ''}
                    </button>
                  )
                })}
                {nuevoExt === null && (
                  <a href="#" onClick={(ev) => { ev.preventDefault(); setNuevoExt({ categoria_id: categorias.find((c) => c.nombre === 'Baño químico')?.id || '', detalle: '', codigo_cliente: '', ubicacion_id: v.ubicacion_id }) }}
                    style={{ font: '600 13px var(--font)' }}>+ Registrar equipo externo</a>
                )}
              </div>
              {errores.externos && <small style={{ color: C.rojo }}>{errores.externos}</small>}
              {!nuevo && !elegidos.length && Number(servicio.cantidad) > 0 && (
                <small>Este servicio tenía {servicio.cantidad} baño(s) del cliente anotados sin registrar. Regístralos como equipos externos.</small>
              )}
            </div>
            {nuevoExt && (
              <EquipoExterno cliente={cliente} ubic={ubic} categorias={categorias} datos={nuevoExt} setDatos={setNuevoExt}
                onCreado={(e) => { setExternos((p) => [...p, e]); setElegidos((p) => [...p, e.id]); setNuevoExt(null) }} />
            )}
            <div className="cols2" style={{ gap: 14 }}><Frecuencia v={v} set={set} entero={entero} errores={errores} /></div>
            <DiasCampo v={v} setV={setV} limp={limp} error={errores.dias} />
          </Apartado>
        )}

        {/* ── C: Limpieza de fosas sépticas ── */}
        {v.tipo === 'limpieza_fosas' && (
          <Apartado titulo="Limpieza de fosas sépticas" nota="No requiere seleccionar baños. El vehículo, los operadores y el volumen realmente retirado se registran en Operaciones.">
            <div className="cols2" style={{ gap: 14 }}>
              <Campo etiqueta="Modalidad" obligatorio error={errores.modalidad}>
                <select value={v.modalidad} onChange={set('modalidad')}>
                  {Object.entries(L_MODALIDAD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Volumen estimado (m³)" ayuda="Opcional. Puede tener decimales." error={errores.volumen_m3}>
                <input value={v.volumen_m3} onChange={set('volumen_m3', (x) => x.replace(/[^0-9.,]/g, '').slice(0, 8))} inputMode="decimal" placeholder="2,5" />
              </Campo>
              {v.modalidad === 'recurrente' && (
                <Campo etiqueta="Frecuencia" obligatorio error={errores.frecuencia}>
                  <select value={v.frecuencia} onChange={set('frecuencia')}>
                    {Object.entries(L_FRECUENCIA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </Campo>
              )}
            </div>
            <Campo etiqueta="Acceso / restricciones">
              <textarea value={v.acceso} onChange={set('acceso')} maxLength={300} style={{ minHeight: 60 }} placeholder="Indique acceso, restricciones u otras consideraciones…" />
            </Campo>
          </Apartado>
        )}

        <Ayuda>
          {v.tipo
            ? 'Guardar registra el acuerdo; no confirma una entrega ni una limpieza.'
            : 'Al elegir el tipo aparece solo UNO de los apartados A, B o C.'}
          {v.tipo && v.tipo !== 'limpieza_fosas' && ubicNombre(v.ubicacion_id) ? ' Los días elegidos pasan a las rutas semanales como días de limpieza del cliente.' : ''}
        </Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

function Apartado({ titulo, nota, children }) {
  return (
    <section style={{ border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', padding: 16, display: 'grid', gap: 14 }}>
      <h6 style={{ margin: 0 }}>{titulo}</h6>
      {children}
      <Ayuda>{nota}</Ayuda>
    </section>
  )
}

function Frecuencia({ v, set, entero, errores }) {
  return (
    <>
      <Campo etiqueta="Frecuencia de limpieza" obligatorio error={errores.frecuencia}>
        <select value={v.frecuencia} onChange={set('frecuencia')}>
          {Object.entries(L_FRECUENCIA).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Limpiezas por semana" obligatorio error={errores.limpiezas_semana}>
        <input value={v.limpiezas_semana} onChange={set('limpiezas_semana', (x) => entero(x).slice(0, 1))} inputMode="numeric" placeholder="2" />
      </Campo>
    </>
  )
}

function DiasCampo({ v, setV, limp, error }) {
  return (
    <div className="campo">
      <span>Días preferidos {limp ? `(${v.dias.length} de ${limp})` : ''}</span>
      <Dias valor={v.dias} max={limp} onChange={(d) => setV((p) => ({ ...p, dias: d }))} />
      {error ? <small style={{ color: C.rojo }}>{error}</small> : <small>Opcional. Se eligen hasta tantos días como limpiezas por semana.</small>}
    </div>
  )
}

// ── Registrar equipo externo (dentro del apartado B) ──────────────────────
function EquipoExterno({ cliente, ubic, categorias, datos, setDatos, onCreado }) {
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => { setDatos((p) => ({ ...p, [k]: e.target.value })); setErrores({}) }
  const guardar = async () => {
    const e = {}
    if (!datos.categoria_id) e.categoria_id = 'Elige la categoría.'
    if (!datos.ubicacion_id) e.ubicacion_id = 'Elige la ubicación.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    try {
      const r = await crearExterno({
        propietario_id: cliente.id, categoria_id: datos.categoria_id, ubicacion_id: datos.ubicacion_id,
        detalle: datos.detalle.trim() || null, codigo_cliente: datos.codigo_cliente.trim() || null,
      })
      onCreado(r)
    } catch (err) {
      setError(err.code === '23505' ? { message: 'Ese identificador del cliente ya está registrado.' } : err)
      setGuardando(false)
    }
  }
  return (
    <div style={{ border: `1px solid ${C.azul}`, borderRadius: 'var(--radio-md)', padding: 14, display: 'grid', gap: 12, background: C.suave }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h6 style={{ margin: 0, flex: 1 }}>Equipo externo</h6>
        <button type="button" onClick={() => setDatos(null)} aria-label="Cerrar" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: C.gris, font: '700 16px var(--font)' }}>✕</button>
      </div>
      <div className="cols2" style={{ gap: 12 }}>
        <Campo etiqueta="Código externo" ayuda="Se genera automáticamente (EXT-###)."><input value="Automático" readOnly /></Campo>
        <Campo etiqueta="Categoría" obligatorio error={errores.categoria_id}>
          <select value={datos.categoria_id} onChange={set('categoria_id')}>
            <option value="">Seleccionar</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Descripción"><input value={datos.detalle} onChange={set('detalle')} maxLength={80} placeholder="Baño en obra" /></Campo>
        <Campo etiqueta="Identificador del cliente" ayuda="Opcional: el número o marca que usa el cliente.">
          <input value={datos.codigo_cliente} onChange={set('codigo_cliente')} maxLength={30} />
        </Campo>
        <Campo etiqueta="Propietario" ayuda="No editable."><input value={cliente.nombre} readOnly /></Campo>
        <Campo etiqueta="Ubicación" obligatorio error={errores.ubicacion_id}>
          <select value={datos.ubicacion_id} onChange={set('ubicacion_id')}>
            <option value="">Seleccionar</option>
            {ubic.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </Campo>
      </div>
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton onClick={() => setDatos(null)}>Cancelar</Boton>
        <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar equipo'}</Boton>
      </div>
    </div>
  )
}

// ── Ver detalle (solo lectura) ────────────────────────────────────────────
function DetalleServicio({ servicio: s, finanzas, onCerrar }) {
  const [ext, setExt] = useState([])
  useEffect(() => { if (s.tipo === 'limpieza_cliente') externosDe(s.cliente_id).then((e) => setExt(e.filter((x) => x.servicio_id === s.id))).catch(() => {}) }, [])
  const fila = (l, val) => (
    <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 10, padding: '5px 0', font: '400 14px var(--font)' }}>
      <span style={{ color: C.gris }}>{l}</span><span style={{ overflowWrap: 'anywhere' }}>{val ?? '—'}</span>
    </div>
  )
  return (
    <Modal titulo={`${s.codigo} · ${L_TIPO_SERV[s.tipo] || s.tipo}`} ancho={560} onCerrar={onCerrar} pie={<Boton onClick={onCerrar}>Cerrar</Boton>}>
      <div style={{ padding: 18 }}>
        {fila('Estado', <Estado tono={s.estado === 'vigente' ? 'ok' : 'neutro'}>{s.estado === 'vigente' ? 'Vigente' : 'Finalizado'}</Estado>)}
        {fila('Ubicación', s.ubicaciones?.nombre)}
        {fila('Vigencia', `${fecha(s.fecha_inicio)} → ${s.fecha_termino ? fecha(s.fecha_termino) : 'sin término'}`)}
        {s.tipo === 'arriendo_limpieza' && fila('Cantidad solicitada', s.cantidad)}
        {s.tipo === 'limpieza_cliente' && fila('Equipos externos', ext.length ? ext.map((e) => e.codigo).join(', ') : `${s.cantidad || 0} sin registrar`)}
        {s.tipo !== 'limpieza_fosas' && fila('Limpieza', `${L_FRECUENCIA[s.frecuencia] || '—'} · ${s.limpiezas_semana ?? 0} por semana · ${diasL(s.dias)}`)}
        {s.tipo === 'limpieza_fosas' && fila('Modalidad', `${L_MODALIDAD[s.modalidad] || '—'}${s.modalidad === 'recurrente' ? ` · ${L_FRECUENCIA[s.frecuencia] || ''}` : ''}`)}
        {s.tipo === 'limpieza_fosas' && fila('Volumen estimado', s.volumen_m3 != null ? `${String(s.volumen_m3).replace('.', ',')} m³` : '—')}
        {s.tipo === 'limpieza_fosas' && fila('Acceso / restricciones', s.acceso)}
        {finanzas && fila('Valor mensual', clp(s.valor_mensual))}
        {fila('Observaciones', s.observaciones)}
      </div>
    </Modal>
  )
}

// ── Finalizar servicio ────────────────────────────────────────────────────
function Finalizar({ servicio, onCerrar, onListo }) {
  const hoy = hoyISO()
  const [f, setF] = useState(servicio.fecha_termino && servicio.fecha_termino < hoy ? servicio.fecha_termino : (servicio.fecha_inicio > hoy ? servicio.fecha_inicio : hoy))
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const confirmar = async () => {
    if (!f || f < servicio.fecha_inicio) { setError({ message: 'La fecha de término no puede ser anterior al inicio.' }); return }
    setGuardando(true)
    try { await finalizarServicio(servicio.id, f); onListo() } catch (e) { setError(e); setGuardando(false) }
  }
  return (
    <Modal titulo={`Finalizar ${servicio.codigo}`} ancho={480} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="peligro" onClick={confirmar} disabled={guardando}>{guardando ? 'Finalizando…' : 'Finalizar servicio'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <Campo etiqueta="Fecha de término" obligatorio>
          <input type="date" min={servicio.fecha_inicio} max={FECHA_MAX} value={f} onChange={(e) => { setF(e.target.value); setError(null) }} />
        </Campo>
        <Ayuda tono="atencion">
          Finalizar no confirma el retiro de equipos: si hay baños FOSAN en la obra, programa su retiro en Operaciones.
          El servicio queda en el historial y deja de contar para los días de limpieza de las rutas.
        </Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}
