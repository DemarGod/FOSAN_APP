import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { C, Icon, I, clp, fecha } from '../lib/ui'

// Importación libre de reportes de Maxxa (Excel o CSV, cualquier formato).
// Se detectan las columnas por nombre y se pueden corregir a mano antes de importar.

const CAMPOS = [
  { k: 'fecha', l: 'Fecha', re: /fecha|emisi[oó]n|f\.?\s?doc/i, req: true },
  { k: 'folio', l: 'Folio / N° documento', re: /folio|n[°ºro.\s]*doc|n[úu]mero|^n[°º]$|documento/i },
  { k: 'cliente', l: 'Cliente', re: /cliente|raz[oó]n|nombre|receptor|se[ñn]or/i },
  { k: 'rut', l: 'RUT', re: /rut/i },
  { k: 'neto', l: 'Neto', re: /neto|afecto|sub\s?total/i },
  { k: 'iva', l: 'IVA', re: /iva|impuesto/i },
  { k: 'total', l: 'Total', re: /^total|monto\s?total|total\s?doc/i },
  { k: 'detalle', l: 'Detalle / glosa', re: /detalle|descrip|glosa|producto|servicio|item/i },
]

const normRut = (s) => String(s || '').replace(/[^0-9kK]/g, '').toUpperCase()
const normTxt = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const monto = (v) => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Math.round(v)
  const t = String(v).replace(/[$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(t)
  return isNaN(n) ? null : Math.round(n)
}
const aFecha = (v) => {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  return null
}
const tipoDe = (t) => {
  const x = normTxt(t)
  if (/fosa/.test(x)) return 'limpieza_fosa'
  if (/limpi|mantenc|servicio de aseo/.test(x)) return 'limpieza_bano'
  if (/arriendo|alquiler|renta/.test(x)) return 'arriendo_bano'
  if (/retiro/.test(x)) return 'retiro'
  if (/instal/.test(x)) return 'instalacion'
  if (/traslado|flete/.test(x)) return 'traslado'
  return x ? 'otro' : null
}

export default function ImportarMaxxa({ onCerrar, onImportado }) {
  const [libro, setLibro] = useState(null)
  const [archivo, setArchivo] = useState('')
  const [hoja, setHoja] = useState('')
  const [mapa, setMapa] = useState({})
  const [clientes, setClientes] = useState([])
  const [error, setError] = useState(null)
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    supabase.from('clientes').select('id, nombre, rut').then(({ data }) => setClientes(data || []))
  }, [])

  const leer = async (f) => {
    setError(null)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      setLibro(wb); setArchivo(f.name); setHoja(wb.SheetNames[0])
    } catch { setError('No se pudo leer el archivo. Usa Excel (.xlsx, .xls) o CSV.') }
  }

  // Filas de la hoja con la fila de encabezados detectada automáticamente
  const { cols, filas } = useMemo(() => {
    if (!libro || !hoja) return { cols: [], filas: [] }
    const matriz = XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: '', raw: true })
    const idx = matriz.findIndex((r) => r.filter((c) => String(c).trim() !== '').length >= 3)
    if (idx < 0) return { cols: [], filas: [] }
    const cabeza = matriz[idx].map((c, i) => String(c).trim() || `Columna ${i + 1}`)
    const cuerpo = matriz.slice(idx + 1).filter((r) => r.some((c) => String(c).trim() !== ''))
    return { cols: cabeza, filas: cuerpo.map((r) => Object.fromEntries(cabeza.map((c, i) => [c, r[i]]))) }
  }, [libro, hoja])

  useEffect(() => {
    const m = {}
    CAMPOS.forEach((c) => { const col = cols.find((x) => c.re.test(x) && !Object.values(m).includes(x)); m[c.k] = col || '' })
    setMapa(m)
  }, [cols])

  const porRut = useMemo(() => Object.fromEntries(clientes.filter((c) => c.rut).map((c) => [normRut(c.rut), c.id])), [clientes])
  const porNombre = useMemo(() => Object.fromEntries(clientes.map((c) => [normTxt(c.nombre), c.id])), [clientes])

  const convertidas = useMemo(() => filas.map((r) => {
    const g = (k) => (mapa[k] ? r[mapa[k]] : null)
    let neto = monto(g('neto')), iva = monto(g('iva')), total = monto(g('total'))
    if (neto == null && total != null) neto = Math.round(total / 1.19)
    if (iva == null && neto != null) iva = total != null ? total - neto : Math.round(neto * 0.19)
    if (total == null && neto != null) total = neto + (iva || 0)
    const rut = g('rut') ? String(g('rut')).trim() : null
    const nombre = g('cliente') ? String(g('cliente')).trim() : null
    const cliente_id = (rut && porRut[normRut(rut)]) || (nombre && porNombre[normTxt(nombre)]) || null
    return {
      fecha: aFecha(g('fecha')), folio_maxxa: g('folio') !== null && String(g('folio')).trim() !== '' ? String(g('folio')).trim() : null,
      cliente_id, cliente_texto: nombre, rut_texto: rut, neto: neto || 0, iva: iva || 0, total: total || 0,
      tipo_servicio: tipoDe(g('detalle')), origen: 'maxxa', datos: r,
    }
  }), [filas, mapa, porRut, porNombre])

  const validas = convertidas.filter((f) => f.fecha && (f.neto || f.total))
  const sinCliente = validas.filter((f) => !f.cliente_id).length
  const faltan = CAMPOS.filter((c) => c.req && !mapa[c.k]).length || (!mapa.neto && !mapa.total)

  const importar = async () => {
    setError(null); setEstado('Importando…')
    try {
      const { data: u } = await supabase.auth.getUser()
      const { data: imp, error: e1 } = await supabase.from('importaciones').insert({
        archivo, hoja, filas: validas.length, sin_cliente: sinCliente, columnas: mapa, creado_por: u?.user?.id || null,
      }).select('id').single()
      if (e1) throw e1
      const filasOk = validas.map((f) => ({ ...f, importacion_id: imp.id }))
      const conFolio = filasOk.filter((f) => f.folio_maxxa)
      const sinFolio = filasOk.filter((f) => !f.folio_maxxa)
      for (let i = 0; i < conFolio.length; i += 400) {
        const { error } = await supabase.from('ventas').upsert(conFolio.slice(i, i + 400), { onConflict: 'folio_maxxa' })
        if (error) throw error
      }
      for (let i = 0; i < sinFolio.length; i += 400) {
        const { error } = await supabase.from('ventas').insert(sinFolio.slice(i, i + 400))
        if (error) throw error
      }
      setEstado(null)
      onImportado(`${validas.length} registro(s) importados${sinCliente ? `, ${sinCliente} sin cliente reconocido` : ''}.`)
    } catch (e) { setEstado(null); setError(String(e.message || e)) }
  }

  return (
    <Modal titulo="Importar reporte de Maxxa" ancho={1000} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={importar} disabled={!validas.length || faltan || !!estado}>
          {estado || `Importar ${validas.length} registro(s)`}
        </button>
      </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, border: `2px dashed ${C.borde}`, background: C.suave, cursor: 'pointer' }}>
          <Icon d={I.doc} size={22} color={C.navy} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', font: '600 13px var(--font)' }}>{archivo || 'Elegir archivo exportado de Maxxa'}</span>
            <span style={{ font: '400 12px var(--font)', color: C.gris }}>Excel (.xlsx, .xls) o CSV, en cualquier formato. Las columnas se reconocen solas y puedes corregirlas.</span>
          </span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files[0] && leer(e.target.files[0])} style={{ display: 'none' }} />
          <span className="btn">Buscar archivo</span>
        </label>

        {libro && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {libro.SheetNames.length > 1 && (
                <label className="campo"><span>Hoja</span>
                  <select value={hoja} onChange={(e) => setHoja(e.target.value)}>{libro.SheetNames.map((s) => <option key={s}>{s}</option>)}</select>
                </label>
              )}
              {CAMPOS.map((c) => (
                <label key={c.k} className="campo"><span>{c.l}{c.req ? ' *' : ''}</span>
                  <select value={mapa[c.k] || ''} onChange={(e) => setMapa((p) => ({ ...p, [c.k]: e.target.value }))}
                    style={{ borderColor: mapa[c.k] ? C.verde : c.req ? C.rojo : undefined }}>
                    <option value="">(no usar)</option>
                    {cols.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', font: '600 12px var(--font)' }}>
              <span>{filas.length} filas leídas</span>
              <span style={{ color: C.verde }}>{validas.length} válidas</span>
              {filas.length - validas.length > 0 && <span style={{ color: '#b06000' }}>{filas.length - validas.length} sin fecha o monto (se omiten)</span>}
              {sinCliente > 0 && <span style={{ color: '#b06000' }}>{sinCliente} sin cliente reconocido (se guardan con el nombre del archivo)</span>}
            </div>

            <div className="scroller" style={{ border: `2px solid ${C.borde}`, maxHeight: 280, overflowY: 'auto' }}>
              <table style={{ minWidth: 760 }}>
                <thead><tr><th>Fecha</th><th>Folio</th><th>Cliente</th><th>Neto</th><th>IVA</th><th>Total</th><th>Tipo</th></tr></thead>
                <tbody>
                  {convertidas.slice(0, 30).map((f, i) => (
                    <tr key={i} style={{ opacity: f.fecha && (f.neto || f.total) ? 1 : 0.4 }}>
                      <td>{fecha(f.fecha)}</td><td>{f.folio_maxxa || '—'}</td>
                      <td style={{ color: f.cliente_id ? undefined : '#b06000' }}>{f.cliente_texto || f.rut_texto || '—'}{f.cliente_id ? '' : ' · no calza'}</td>
                      <td>{clp(f.neto)}</td><td>{clp(f.iva)}</td><td>{clp(f.total)}</td><td>{f.tipo_servicio || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ font: '400 12px/1.45 var(--font)', color: C.gris }}>
              Los clientes se reconocen por RUT o por nombre exacto. Si un folio ya existe, se actualiza en vez de duplicarse. Cada fila original queda guardada para revisarla después.
            </div>
          </>
        )}
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{error}</div>}
      </div>
    </Modal>
  )
}

export function Importaciones({ version, editable }) {
  const [lista, setLista] = useState([])
  const cargar = () => supabase.from('importaciones').select('*').order('creado_en', { ascending: false }).limit(20).then(({ data }) => setLista(data || []))
  useEffect(() => { cargar() }, [version])
  const borrar = async (imp) => {
    if (!window.confirm(`¿Borrar la importación "${imp.archivo}" y sus ${imp.filas} registros de ventas?`)) return
    await supabase.from('importaciones').delete().eq('id', imp.id)
    cargar()
  }
  if (!lista.length) return null
  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h6>Importaciones de Maxxa</h6>
      <div className="scroller">
        <table style={{ minWidth: 560 }}>
          <thead><tr><th>Archivo</th><th>Fecha</th><th>Registros</th><th>Sin cliente</th><th></th></tr></thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.id}>
                <td style={{ fontWeight: 600 }}>{i.archivo}{i.hoja ? ` · ${i.hoja}` : ''}</td>
                <td>{fecha(i.creado_en)}</td><td>{i.filas}</td>
                <td style={{ color: i.sin_cliente ? '#b06000' : undefined }}>{i.sin_cliente}</td>
                <td>{editable && <button className="btn" onClick={() => borrar(i)} style={{ minHeight: 32, padding: '4px 10px', color: C.rojo }}>Borrar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
