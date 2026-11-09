// Documentos de un vehículo o equipo (revisión técnica, permiso de circulación, seguro, facturas…).
// Se guardan en Google Drive (carpeta "DOCUMENTOS <código>"). Con vencimiento: avisan en Inicio 30 días antes.
import { useEffect, useState } from 'react'
import Modal from './Modal'
import { Boton, Campo, Ayuda, Estado } from './Base'
import { documentosDe, subirDocumento, abrirDocumento, quitarDocumento, TIPOS_DOCUMENTO } from '../lib/api'
import { hoyISO } from '../lib/costos'
import { C, Icon, I, fecha } from '../lib/ui'

const CON_VENCIMIENTO = new Set(['revision_tecnica', 'permiso_circulacion', 'seguro', 'certificado'])
const diasA = (f) => Math.round((new Date(f + 'T12:00:00') - new Date(hoyISO() + 'T12:00:00')) / 864e5)
const estadoVence = (f) => {
  if (!f) return null
  const n = diasA(f)
  return n < 0 ? { tono: 'error', l: `Vencido (${fecha(f)})` } : n <= 30 ? { tono: 'atencion', l: `Vence ${fecha(f)}` } : { tono: 'ok', l: `Vigente hasta ${fecha(f)}` }
}

export default function Documentos({ activo, editable, quitar = false }) {
  const [docs, setDocs] = useState(null)
  const [subir, setSubir] = useState(false)
  const [error, setError] = useState(null)
  const cargar = () => documentosDe(activo.id).then((d) => setDocs(d.filter((x) => !x.anulado))).catch((x) => { setError(x); setDocs([]) })
  useEffect(() => { cargar() }, [activo.id])
  const abrir = (d) => abrirDocumento(d).catch(setError)
  const sacar = async (d) => {
    if (!window.confirm(`¿Quitar "${d.titulo}" de la lista? El archivo queda guardado en Drive.`)) return
    try { await quitarDocumento(d.id); cargar() } catch (x) { setError(x) }
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <b style={{ flex: 1, font: '700 14px var(--font)', color: C.navy }}>Documentos {docs ? `(${docs.length})` : ''}</b>
        {editable && <Boton icono={I.plus} onClick={() => setSubir(true)}>Subir documento</Boton>}
      </div>
      {docs === null ? <span className="text-muted">Cargando…</span>
        : !docs.length ? <span className="text-muted" style={{ fontSize: 13 }}>Sin documentos. {editable ? 'Sube la revisión técnica, el permiso de circulación o el seguro con su fecha de vencimiento para recibir el aviso.' : ''}</span>
          : docs.map((d) => {
            const v = estadoVence(d.fecha_vencimiento)
            return (
              <div key={d.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-sm)' }}>
                <Icon d={I.doc} size={16} color={C.azul} />
                <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <b>{d.titulo}</b>
                  <span className="text-muted" style={{ fontSize: 12 }}> · {TIPOS_DOCUMENTO[d.tipo] || d.tipo} · subido {fecha(d.creado_en)}</span>
                </span>
                {v && <Estado tono={v.tono}>{v.l}</Estado>}
                <Boton onClick={() => abrir(d)} style={{ minHeight: 30, padding: '4px 10px' }}>Ver</Boton>
                {quitar && <Boton onClick={() => sacar(d)} style={{ minHeight: 30, padding: '4px 10px', color: C.rojo }}>Quitar</Boton>}
              </div>
            )
          })}
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      {subir && <SubirDocumento activo={activo} onCerrar={() => setSubir(false)} onListo={() => { setSubir(false); cargar() }} />}
    </div>
  )
}

function SubirDocumento({ activo, onCerrar, onListo }) {
  const vehiculo = ['camion', 'camioneta'].includes(activo.tipo)
  const [v, setV] = useState({ tipo: vehiculo ? 'revision_tecnica' : 'certificado', titulo: '', vence: '' })
  const [archivo, setArchivo] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const set = (k) => (e) => { setV((p) => ({ ...p, [k]: e.target.value })); setErrores({}) }
  const pideVence = CON_VENCIMIENTO.has(v.tipo)
  const guardar = async () => {
    const e = {}
    const titulo = v.titulo.trim() || TIPOS_DOCUMENTO[v.tipo]
    if (!archivo) e.archivo = 'Elige el archivo (PDF o foto).'
    if (pideVence && !v.vence) e.vence = 'Indica la fecha de vencimiento (para avisarte antes).'
    setErrores(e)
    if (Object.keys(e).length) return
    setSubiendo(true); setError(null)
    try { await subirDocumento(activo, archivo, { tipo: v.tipo, titulo, vence: v.vence || null }); onListo() } catch (x) { setError(x); setSubiendo(false) }
  }
  return (
    <Modal titulo={`Subir documento · ${activo.codigo || ''}`} ancho={520} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={subiendo}>{subiendo ? 'Subiendo…' : 'Subir'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <Campo etiqueta="Tipo" obligatorio>
          <select value={v.tipo} onChange={set('tipo')}>
            {Object.entries(TIPOS_DOCUMENTO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Título" ayuda={`Si lo dejas vacío se usa "${TIPOS_DOCUMENTO[v.tipo]}".`}>
          <input value={v.titulo} onChange={set('titulo')} maxLength={80} placeholder={`${TIPOS_DOCUMENTO[v.tipo]} ${new Date().getFullYear()}`} />
        </Campo>
        <Campo etiqueta="Fecha de vencimiento" obligatorio={pideVence} error={errores.vence}
          ayuda="Te avisamos en Inicio 30 días antes y cuando venza.">
          <input type="date" value={v.vence} onChange={set('vence')} />
        </Campo>
        <Campo etiqueta="Archivo (PDF o foto, máx. 10 MB)" obligatorio error={errores.archivo}>
          <input type="file" accept="application/pdf,image/*" onChange={(e) => { setArchivo(e.target.files?.[0] || null); setErrores({}) }} />
        </Campo>
        <Ayuda>Se guarda en Google Drive, en la carpeta "DOCUMENTOS {activo.codigo}".</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}
