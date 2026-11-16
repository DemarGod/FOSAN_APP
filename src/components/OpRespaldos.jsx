// Operaciones → Respaldos (lámina 4.1) y ejecución confirmada.
// Cada operación realizada tiene: constancia (imprimible y en PDF en Drive), archivos subidos (fotos, guías),
// firma de recepción del cliente y firma del chofer. En Drive se ordenan por tipo y mes (lib/respaldosDrive.js).
// Los respaldos no se editan ni se borran. Las operaciones de una ruta se confirman en Mi ruta.
import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import { Boton, Campo, Tabla, Estado, Ayuda } from './Base'
import { operaciones, paradasRealizadas, respaldosDe, subirRespaldo, guardarConstancia, confirmarOperacion, abrirRespaldo, esImagenRespaldo } from '../lib/api'
import { htmlConstancia, aDataUrl } from '../lib/respaldosDrive'
import { useSesion } from '../lib/sesion'
import { hoyISO, sumarDias, ahoraLocal } from '../lib/costos'
import { C, I, fecha, fechaHora } from '../lib/ui'

export const L_SERV = { arriendo_limpieza: 'Arriendo de baños químicos', limpieza_cliente: 'Limpieza de baños', limpieza_fosas: 'Limpieza de fosa' }
export const L_ACCION = { entrega: 'Entrega', retiro: 'Retiro', cambio: 'Cambio', limpieza: 'Limpieza' }
export const servicioYAccion = (o) => (L_SERV[o.servicio_tipo] ? (o.servicio_tipo === 'arriendo_limpieza' ? `${L_SERV[o.servicio_tipo]} · ${L_ACCION[o.tipo] || o.tipo}` : L_SERV[o.servicio_tipo]) : L_ACCION[o.tipo] || o.tipo)
const chico = { minHeight: 34, padding: '6px 12px' }
const MAX_MB = 10

export default function OpRespaldos() {
  const [f, setF] = useState({ desde: sumarDias(hoyISO(), -30), hasta: hoyISO(), texto: '' })
  const [aplicado, setAplicado] = useState(f)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [ver, setVer] = useState(null)
  // Operaciones hechas + limpiezas de ruta realizadas (estas no tienen folio de operación)
  const cargar = () => {
    setDatos(null)
    Promise.all([operaciones(null, null), paradasRealizadas().catch(() => [])])
      .then(([l, p]) => setDatos([...l.filter((o) => o.estado === 'hecho'), ...p])).catch(setError)
  }
  useEffect(() => { cargar() }, [])
  const filas = useMemo(() => (datos || []).filter((o) => {
    const d = String(o.fecha_realizada || o.fecha_programada).slice(0, 10), t = aplicado.texto.trim().toLowerCase()
    if (aplicado.desde && d < aplicado.desde) return false
    if (aplicado.hasta && d > aplicado.hasta) return false
    if (t && !String(o.cliente || '').toLowerCase().includes(t) && !String(o.folio || '').toLowerCase().includes(t)) return false
    return true
  }).sort((a, b) => String(b.fecha_realizada).localeCompare(String(a.fecha_realizada))), [datos, aplicado])
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section className="card">
        <form onSubmit={(e) => { e.preventDefault(); setAplicado(f) }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, padding: 16, borderBottom: `1px solid ${C.borde}`, alignItems: 'end' }}>
          <Campo etiqueta="Realizadas desde"><input type="date" value={f.desde} onChange={set('desde')} /></Campo>
          <Campo etiqueta="Hasta"><input type="date" value={f.hasta} onChange={set('hasta')} /></Campo>
          <Campo etiqueta="Cliente o folio"><input value={f.texto} onChange={set('texto')} placeholder="Buscar…" /></Campo>
          <div style={{ display: 'flex', gap: 8 }}>
            <Boton tipo="principal" type="submit">Aplicar</Boton>
            <Boton onClick={() => { const n = { desde: sumarDias(hoyISO(), -30), hasta: hoyISO(), texto: '' }; setF(n); setAplicado(n) }}>Limpiar</Boton>
          </div>
        </form>
        {error && <div style={{ padding: 16 }}><Ayuda tono="error">{String(error.message || error)}</Ayuda></div>}
        {datos === null && !error ? <div style={{ padding: 24, color: C.gris }}>Cargando…</div> : (
          <Tabla filas={filas} vacio="Sin operaciones realizadas en este período." columnas={[
            { k: 'f', label: 'Realizada', render: (o) => (o.fecha_realizada ? fechaHora(o.fecha_realizada) : fecha(o.fecha_programada)) },
            { k: 'folio', label: 'Folio', render: (o) => <b>{o.folio}</b> },
            { k: 's', label: 'Servicio y acción', render: servicioYAccion },
            { k: 'c', label: 'Cliente y ubicación', render: (o) => <div><div style={{ fontWeight: 600 }}>{o.cliente}</div><div className="text-muted" style={{ fontSize: 12 }}>{o.ubicacion || '—'}</div></div> },
            {
              k: 'r', label: 'Respaldos', render: (o) => (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', font: '400 13px var(--font)' }}>
                  <Estado tono="ok">Constancia</Estado>
                  <Estado tono={o.archivos ? 'ok' : 'neutro'}>{o.archivos} archivo(s)</Estado>
                  <Estado tono={o.firmas ? 'ok' : 'neutro'}>{o.firmas ? 'Firmada' : 'Sin firma'}</Estado>
                </div>
              ),
            },
            { k: 'a', label: 'Acción', alinear: 'right', render: (o) => <Boton onClick={() => setVer(o)} style={chico}>Ver respaldo</Boton> },
          ]} />
        )}
      </section>
      <Ayuda>Los respaldos no se editan ni se borran: si algo quedó mal, se agrega un archivo o una firma nueva. Las operaciones de una ruta se confirman en Mi ruta.</Ayuda>
      {ver && <RespaldoModal o={ver} onCerrar={() => { setVer(null); cargar() }} />}
    </div>
  )
}

// ── Respaldo de una operación ─────────────────────────────────────────────
export function RespaldoModal({ o, onCerrar }) {
  const { perfil } = useSesion()
  const puede = !!perfil
  const [lista, setLista] = useState(null)
  const [firmar, setFirmar] = useState(null)     // 'firma' (cliente) | 'firma_chofer'
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardandoPdf, setGuardandoPdf] = useState(false)
  const input = useRef(null)
  const cargar = () => respaldosDe(o.parada_id ? { parada: o.parada_id } : o.id).then(setLista).catch(setError)  
  useEffect(() => { cargar() }, [o.id])
  const archivos = (lista || []).filter((r) => r.tipo === 'archivo')
  const firmas = (lista || []).filter((r) => r.tipo === 'firma')
  const firmasChofer = (lista || []).filter((r) => r.tipo === 'firma_chofer')
  const constancias = (lista || []).filter((r) => r.tipo === 'constancia')
  const destino = { folio: o.folio, paradaId: o.parada_id, cliente: o.cliente, fechaOp: o.fecha_realizada || o.fecha_programada }
  const ultima = (l) => { const f = l[l.length - 1]; return f ? { imagen: f.dataUrl || f.url, nombre: f.firmante } : null }
  // Guarda en Drive (CONSTANCIAS/<mes>/) la constancia con las firmas que tiene ahora
  const guardarPdf = async () => {
    setGuardandoPdf(true); setError(null); setAviso(null)
    try {
      const html = htmlConstancia(o, { accion: servicioYAccion(o), servicio: servicioTexto(o), cliente: ultima(firmas), chofer: ultima(firmasChofer) })
      await guardarConstancia(o.parada_id ? null : o.id, html, destino)
      setAviso('Constancia guardada en Drive (carpeta CONSTANCIAS).'); await cargar()
    } catch (x) { setError(x) }
    setGuardandoPdf(false)
  }

  const subir = async (files) => {
    setError(null)
    const grandes = [...files].filter((x) => x.size > MAX_MB * 1024 * 1024)
    if (grandes.length) { setError({ message: `Máximo ${MAX_MB} MB por archivo.` }); return }
    setSubiendo(true)
    try { let i = archivos.length; for (const x of files) await subirRespaldo(o.parada_id ? null : o.id, x, 'archivo', { ...destino, indice: ++i }); await cargar() } catch (x) { setError(x) }
    setSubiendo(false)
  }

  return (
    <Modal titulo={`Respaldo · ${o.folio}`} ancho={760} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cerrar</Boton>
      <Boton icono={I.doc} onClick={() => imprimirConstancia(o, ultima(firmas), ultima(firmasChofer))} disabled={lista === null}>Constancia imprimible</Boton>
      <Boton tipo="principal" icono={I.descarga} onClick={guardarPdf} disabled={lista === null || guardandoPdf || !puede}>{guardandoPdf ? 'Guardando…' : constancias.length ? 'Guardar constancia actualizada en Drive' : 'Guardar constancia en Drive'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ font: '400 14px/1.7 var(--font)' }}>
          <b>{servicioYAccion(o)}</b> · {o.cliente} · {o.ubicacion || '—'}<br />
          Realizada: {o.fecha_realizada ? fechaHora(o.fecha_realizada) : '—'} · Unidades: {o.unidades || '—'} · Patente: {o.patente || '—'}<br />
          Responsable: {o.responsable || '—'} · Recibió: {o.recibido_por || '—'}{o.resultado ? ` · ${o.resultado}` : ''}
        </div>

        <section style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h6 style={{ margin: 0, flex: 1 }}>Archivos subidos ({archivos.length})</h6>
            <input ref={input} type="file" multiple accept="image/*,application/pdf" hidden onChange={(e) => { subir(e.target.files); e.target.value = '' }} />
            <Boton icono={I.plus} onClick={() => input.current?.click()} disabled={!puede || subiendo} style={chico}>{subiendo ? 'Subiendo…' : 'Subir archivo'}</Boton>
          </div>
          {lista === null ? <span className="text-muted">Cargando…</span> : archivos.length === 0 ? <span className="text-muted">Sin archivos. Puedes subir fotos o la guía de despacho escaneada (imagen o PDF).</span> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {archivos.map((r) => (
                <a key={r.id} href={r.url || '#'} target="_blank" rel="noreferrer"
                  onClick={(e) => { if (!r.url && r.ruta.startsWith('drive:')) { e.preventDefault(); abrirRespaldo(r).catch(setError) } }} style={{ display: 'grid', gap: 4, padding: 8, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', textDecoration: 'none', color: C.tinta }}>
                  {esImagenRespaldo(r) && r.url
                    ? <img src={r.url} alt={r.nombre} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 'var(--radio-sm)' }} />
                    : <div style={{ height: 90, display: 'grid', placeItems: 'center', background: C.suave, borderRadius: 'var(--radio-sm)', font: '600 13px var(--font)' }}>{esImagenRespaldo(r) ? 'Imagen' : 'PDF'}</div>}
                  <small style={{ overflowWrap: 'anywhere' }}>{r.nombre}</small>
                  <small className="text-muted">{fechaHora(r.creado_en)} · {r.perfiles?.nombre || '—'}</small>
                </a>
              ))}
            </div>
          )}
        </section>

        {[['firma', 'Firma del cliente (recepción)', firmas, 'Agregar firma del cliente'], ['firma_chofer', 'Firma del chofer', firmasChofer, 'Agregar firma del chofer']].map(([tipo, titulo, l, boton]) => (
          <section key={tipo} style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h6 style={{ margin: 0, flex: 1 }}>{titulo}</h6>
              <Boton icono={I.lapiz} onClick={() => setFirmar(tipo)} disabled={!puede} style={chico}>{l.length ? 'Agregar otra' : boton}</Boton>
            </div>
            {lista !== null && l.length === 0 && <span className="text-muted">Sin firma.</span>}
            {l.map((r) => (
              <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {r.url && <img src={r.url} alt="Firma" style={{ height: 80, background: '#fff', border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-sm)' }} />}
                <span style={{ font: '400 13px/1.5 var(--font)' }}><b>{r.firmante || '—'}</b><br />{fechaHora(r.creado_en)}</span>
              </div>
            ))}
          </section>
        ))}

        <section style={{ display: 'grid', gap: 8 }}>
          <h6 style={{ margin: 0 }}>Constancias guardadas en Drive ({constancias.length})</h6>
          {lista !== null && constancias.length === 0 && <span className="text-muted">Aún no hay. Se guarda sola al confirmar la operación, o con el botón "Guardar constancia en Drive".</span>}
          {constancias.map((r) => (
            <a key={r.id} href="#" onClick={(e) => { e.preventDefault(); abrirRespaldo(r).catch(setError) }} style={{ font: '400 13px var(--font)' }}>
              {r.nombre} <span className="text-muted">· {fechaHora(r.creado_en)}</span>
            </a>
          ))}
        </section>
        {aviso && <Ayuda>{aviso}</Ayuda>}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
      {firmar && <FirmaModal chofer={firmar === 'firma_chofer'} nombreInicial={firmar === 'firma_chofer' ? o.responsable || '' : o.recibido_por || ''} onCerrar={() => setFirmar(null)}
        onFirmar={async (blob, firmante) => { await subirRespaldo(o.parada_id ? null : o.id, blob, firmar, { ...destino, firmante }); setFirmar(null); cargar() }} />}    </Modal>
  )
}

// ── Firma en pantalla (dedo o mouse) ──────────────────────────────────────
export function Lienzo({ onCambio }) {
  const ref = useRef(null)
  const dibujando = useRef(false)
  const vacio = useRef(true)
  useEffect(() => {
    const c = ref.current, r = window.devicePixelRatio || 1
    c.width = c.offsetWidth * r; c.height = c.offsetHeight * r
    const x = c.getContext('2d'); x.scale(r, r); x.lineWidth = 2.2; x.lineCap = 'round'; x.strokeStyle = '#13294b'
  }, [])
  const pos = (e) => { const b = ref.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top] }
  const abajo = (e) => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); dibujando.current = true; const x = ref.current.getContext('2d'); x.beginPath(); x.moveTo(...pos(e)) }
  const mover = (e) => { if (!dibujando.current) return; const x = ref.current.getContext('2d'); x.lineTo(...pos(e)); x.stroke(); if (vacio.current) { vacio.current = false; onCambio(ref.current) } }
  const arriba = () => { dibujando.current = false }
  const limpiar = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); vacio.current = true; onCambio(null) }
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <canvas ref={ref} onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerLeave={arriba}
        style={{ width: '100%', height: 180, background: '#fff', border: `1px dashed ${C.gris}`, borderRadius: 'var(--radio-md)', touchAction: 'none', cursor: 'crosshair' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <small className="text-muted">Firme dentro del recuadro.</small>
        <Boton onClick={limpiar} style={{ minHeight: 30, padding: '4px 10px' }}>Limpiar</Boton>
      </div>
    </div>
  )
}
export const aBlob = (canvas) => new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'))

function FirmaModal({ nombreInicial, chofer = false, onCerrar, onFirmar }) {
  const [lienzo, setLienzo] = useState(null)
  const [nombre, setNombre] = useState(nombreInicial)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    if (!lienzo) { setError({ message: 'Falta la firma.' }); return }
    if (nombre.trim().length < 3) { setError({ message: 'Indica el nombre de quien firma.' }); return }
    setGuardando(true)
    try { await onFirmar(await aBlob(lienzo), nombre.trim()) } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo={chofer ? 'Firma del chofer' : 'Firma del cliente (recepción)'} ancho={520} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar firma'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <Campo etiqueta={chofer ? 'Nombre del chofer' : 'Nombre de quien recibe'} obligatorio><input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} /></Campo>
        <Lienzo onCambio={setLienzo} />
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// ── Confirmar ejecución (operaciones fuera de ruta) ───────────────────────
export function ConfirmarEjecucion({ o, onCerrar, onListo }) {
  const [v, setV] = useState({ fecha: ahoraLocal(), recibido: '', resultado: '', chofer: o.responsable || '' })
  const [lienzo, setLienzo] = useState(null)
  const [lienzoChofer, setLienzoChofer] = useState(null)
  const [archivos, setArchivos] = useState([])
  const [paso, setPaso] = useState(1)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => { setV((p) => ({ ...p, [k]: e.target.value })); setError(null); setPaso(1) }
  const revisar = () => {
    if (!v.fecha) return setError({ message: 'Indica fecha y hora de ejecución.' })
    if (v.fecha > ahoraLocal()) return setError({ message: 'La fecha no puede ser futura.' })
    if (lienzo && v.recibido.trim().length < 3) return setError({ message: 'Indica el nombre de quien firma.' })
    if (lienzoChofer && v.chofer.trim().length < 3) return setError({ message: 'Indica el nombre del chofer que firma.' })
    if (archivos.some((x) => x.size > MAX_MB * 1024 * 1024)) return setError({ message: `Máximo ${MAX_MB} MB por archivo.` })
    setPaso(2)
  }
  const confirmar = async () => {
    setGuardando(true); setError(null)
    try {
      await confirmarOperacion(o.id, new Date(v.fecha).toISOString(), v.recibido.trim(), v.resultado.trim())
    } catch (x) { setError(x); setGuardando(false); setPaso(1); return }
    // Respaldos en Drive: firmas, fotos y la constancia en PDF. Si algo falla, la operación ya quedó confirmada.
    const realizada = new Date(v.fecha).toISOString()
    const destino = { folio: o.folio, cliente: o.cliente, fechaOp: v.fecha }
    try {
      const bCliente = lienzo ? await aBlob(lienzo) : null, bChofer = lienzoChofer ? await aBlob(lienzoChofer) : null
      if (bCliente) await subirRespaldo(o.id, bCliente, 'firma', { ...destino, firmante: v.recibido.trim() })
      if (bChofer) await subirRespaldo(o.id, bChofer, 'firma_chofer', { ...destino, firmante: v.chofer.trim() })
      let i = 0
      for (const x of archivos) await subirRespaldo(o.id, x, 'archivo', { ...destino, indice: ++i })
      const html = htmlConstancia({ ...o, fecha_realizada: realizada, recibido_por: v.recibido.trim() || o.recibido_por, resultado: v.resultado.trim() || o.resultado }, {
        accion: servicioYAccion(o), servicio: servicioTexto(o),
        cliente: bCliente ? { imagen: await aDataUrl(bCliente), nombre: v.recibido.trim() } : null,
        chofer: bChofer ? { imagen: await aDataUrl(bChofer), nombre: v.chofer.trim() } : (v.chofer.trim() ? { nombre: v.chofer.trim() } : null),
      })
      await guardarConstancia(o.id, html, destino)
    } catch (x) {
      window.alert(`La operación quedó confirmada, pero no se pudo guardar todo el respaldo en Drive (${x.message || x}). Complétalo desde la pestaña Respaldos.`)
    }
    onListo()
  }
  const efecto = o.tipo === 'entrega' ? 'Los baños quedarán Asignados al cliente en esta ubicación.'
    : o.tipo === 'retiro' ? 'Los baños volverán Disponibles a la bodega.'
      : o.tipo === 'cambio' ? 'Se retiran unos baños y quedan asignados los otros.' : 'No mueve baños.'
  return (
    <Modal titulo={`Confirmar ejecución · ${o.folio}`} ancho={640} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      {paso === 1 ? <Boton tipo="principal" onClick={revisar}>Revisar</Boton> : <Boton tipo="principal" onClick={confirmar} disabled={guardando}>{guardando ? 'Confirmando…' : 'Confirmar ejecución'}</Boton>}
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <span style={{ font: '600 14px var(--font)' }}>{servicioYAccion(o)} · {o.cliente} · {o.ubicacion || '—'}{o.unidades ? ` · ${o.unidades}` : ''}</span>
        <div className="cols2" style={{ gap: 12 }}>
          <Campo etiqueta="Fecha y hora de ejecución" obligatorio><input type="datetime-local" value={v.fecha} max={ahoraLocal()} onChange={set('fecha')} /></Campo>
          <Campo etiqueta="Recibió en terreno"><input value={v.recibido} onChange={set('recibido')} maxLength={80} placeholder="Nombre del encargado" /></Campo>
        </div>
        <Campo etiqueta="Observaciones del resultado"><textarea value={v.resultado} onChange={set('resultado')} maxLength={400} style={{ minHeight: 56 }} /></Campo>
        <div className="campo"><span>Firma del cliente · recepción (opcional)</span><Lienzo onCambio={setLienzo} /></div>
        <Campo etiqueta="Chofer / responsable"><input value={v.chofer} onChange={set('chofer')} maxLength={80} placeholder="Nombre del chofer" /></Campo>
        <div className="campo"><span>Firma del chofer (opcional)</span><Lienzo onCambio={setLienzoChofer} /></div>
        <Campo etiqueta="Archivos (opcional)" ayuda="Fotos o guía de despacho escaneada (imagen o PDF).">
          <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setArchivos([...e.target.files])} />
        </Campo>
        {paso === 2
          ? <Ayuda tono="atencion">¿Confirmas que se ejecutó? {efecto} Esta acción no se deshace: una corrección se hace con otra operación.</Ayuda>
          : <Ayuda>Solo la ejecución confirmada actualiza el inventario. {efecto} Al confirmar, la constancia con las firmas se guarda en Drive.</Ayuda>}
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

// Servicio de la operación para la constancia: "SER-012 · Arriendo de baños químicos"
const servicioTexto = (o) => (o.servicio_codigo ? `${o.servicio_codigo} · ${L_SERV[o.servicio_tipo] || ''}` : L_SERV[o.servicio_tipo] || null)

// ── Constancia imprimible (se abre en una ventana y se imprime o guarda como PDF) ──
// Mismo formato que la constancia que se guarda en Drive (lib/respaldosDrive.js)
function imprimirConstancia(o, cliente, chofer) {
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) { window.alert('El navegador bloqueó la ventana. Permite ventanas emergentes para imprimir la constancia.'); return }
  w.document.write(htmlConstancia(o, { accion: servicioYAccion(o), servicio: servicioTexto(o), cliente, chofer: chofer || (o.responsable ? { nombre: o.responsable } : null), imprimir: true }))
  w.document.close()
}
