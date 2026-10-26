import { useState } from 'react'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { C, Icon, I, L_ESTADO_ACTIVO } from '../lib/ui'

// TEMPORAL: carga única del inventario desde Excel.
// Cuando termines, borra este archivo y el botón en pages/Banos.jsx.
const ESTADOS = { 0: 'en_arriendo', 1: 'disponible', 2: 'extraviado', 3: 'vendido', 4: 'donacion', 5: 'fuera_de_servicio' }
const texto = (s) => String(s ?? '').trim()
// Normaliza para comparar: sin tildes, sin puntos/comas, minúsculas, espacios simples
const norm = (s) => texto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const cap = (s) => { const t = texto(s); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : null }
const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || [] }
const mapa = (l) => Object.fromEntries(l.map((x) => [norm(x.nombre), x.id]))
const nuevosDe = (nombres, mp) => [...new Map(nombres.filter(Boolean).filter((n) => !mp[norm(n)]).map((n) => [norm(n), n])).values()]

export default function ImportarInventario({ onCerrar, onImportado }) {
  const [archivo, setArchivo] = useState('')
  const [filas, setFilas] = useState([])
  const [cat, setCat] = useState(null)
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  const leer = async (f) => {
    setError(null); setResultado(null)
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: true })
      const vistos = new Set()
      const lista = m
        .map((r, i) => ({ n: i + 1, codigo: texto(r[0]).toUpperCase(), modelo: texto(r[1]).toUpperCase(), color: cap(r[2]), cod: r[3], cliente: texto(r[4]), ubicacion: texto(r[5]) }))
        .filter((r) => r.codigo && norm(r.codigo) !== 'codigo')
        .map((r) => {
          const num = texto(r.cod) === '' ? NaN : Number(r.cod)
          const est = ESTADOS[num]
          let problema = null, aviso = null
          if (!est) problema = 'DISPONIBLES debe ser un número de 0 a 5'
          else if (vistos.has(r.codigo)) problema = 'Código repetido en el archivo'
          else if (est === 'en_arriendo' && !r.cliente) aviso = 'Arrendado sin cliente'
          else if (est !== 'en_arriendo' && r.cliente) aviso = 'Tiene cliente pero no está arrendado'
          vistos.add(r.codigo)
          return { ...r, estado: est, problema, aviso }
        })
      const [mo, cl, ub, ex] = await Promise.all([
        q(supabase.from('modelos_bano').select('id, nombre')),
        q(supabase.from('clientes').select('id, nombre')),
        q(supabase.from('ubicaciones').select('id, nombre')),
        q(supabase.from('activos').select('codigo')),
      ])
      setCat({ modelos: mapa(mo), clientes: mapa(cl), ubic: mapa(ub), existentes: new Set(ex.map((x) => x.codigo.toUpperCase())) })
      setFilas(lista); setArchivo(f.name)
    } catch (e) { setError(e?.message ? String(e.message) : 'No se pudo leer el archivo. Usa Excel (.xlsx, .xls) o CSV.') }
  }

  const ok = filas.filter((f) => !f.problema)
  const malas = filas.filter((f) => f.problema)
  const conAviso = ok.filter((f) => f.aviso)
  const porEstado = ok.reduce((a, f) => ({ ...a, [f.estado]: (a[f.estado] || 0) + 1 }), {})
  const crearan = cat ? {
    modelos: nuevosDe(ok.map((f) => f.modelo), cat.modelos),
    clientes: nuevosDe(ok.map((f) => f.cliente), cat.clientes),
    ubicaciones: nuevosDe(ok.map((f) => f.ubicacion), cat.ubic),
  } : null
  const actualizan = cat ? ok.filter((f) => cat.existentes.has(f.codigo)).length : 0

  const importar = async () => {
    setError(null); setEstado('Importando…')
    try {
      const modelos = { ...cat.modelos }, clientes = { ...cat.clientes }, ubic = { ...cat.ubic }
      const crear = async (tabla, mp, nombres, fila) => {
        const nuevos = nuevosDe(nombres, mp)
        if (!nuevos.length) return
        const { data, error } = await supabase.from(tabla).insert(nuevos.map(fila)).select('id, nombre')
        if (error) throw error
        data.forEach((x) => { mp[norm(x.nombre)] = x.id })
      }
      await crear('modelos_bano', modelos, ok.map((f) => f.modelo), (n) => ({ nombre: n, tipo: n }))
      await crear('clientes', clientes, ok.map((f) => f.cliente), (n) => ({ nombre: n }))
      await crear('ubicaciones', ubic, ok.map((f) => f.ubicacion), (n) => ({ nombre: n, tipo: /bodega/i.test(n) ? 'bodega' : 'faena' }))

      const filasDb = ok.map((f) => ({
        codigo: f.codigo, tipo: 'bano_quimico', estado: f.estado, color: f.color,
        modelo_id: modelos[norm(f.modelo)] || null,
        cliente_id: clientes[norm(f.cliente)] || null,
        ubicacion_id: ubic[norm(f.ubicacion)] || null,
      }))
      for (let i = 0; i < filasDb.length; i += 200) {
        setEstado(`Importando ${Math.min(i + 200, filasDb.length)} de ${filasDb.length}…`)
        const { error } = await supabase.from('activos').upsert(filasDb.slice(i, i + 200), { onConflict: 'codigo' })
        if (error) throw error
      }
      setEstado(null)
      setResultado({ creados: ok.length - actualizan, actualizados: actualizan, omitidos: malas.length, ...Object.fromEntries(Object.entries(crearan).map(([k, v]) => [k, v.length])) })
    } catch (e) {
      setEstado(null)
      const msg = String(e.message || e)
      setError(/invalid input value for enum/i.test(msg) ? 'La base no tiene los estados Extraviado / Vendido / Donación. Ejecuta primero supabase/17_estados_inventario.sql.' : msg)
    }
  }

  const Lista = ({ t, l }) => l.length > 0 && (
    <div style={{ font: '400 12px/1.5 var(--font)' }}>
      <strong>{t} nuevos ({l.length}):</strong> {l.join(' · ')}
    </div>
  )

  return (
    <Modal titulo="Importar inventario desde Excel (temporal)" ancho={900} onCerrar={resultado ? onImportado : onCerrar} pie={
      resultado
        ? <button className="btn btn-verde" onClick={onImportado}>Listo</button>
        : <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-verde" onClick={importar} disabled={!ok.length || !!estado}>
            {estado || `Importar ${ok.length} baño(s)`}
          </button>
        </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        {resultado ? (
          <div style={{ display: 'grid', gap: 8, padding: 16, background: '#e6f4ea', border: `2px solid ${C.verde}`, font: '400 13px/1.6 var(--font)', color: '#1e6b34' }}>
            <strong style={{ font: '700 15px var(--font)' }}>Importación terminada</strong>
            <span>{resultado.creados} baño(s) nuevos · {resultado.actualizados} actualizados · {resultado.omitidos} omitidos por error</span>
            <span>Se crearon {resultado.modelos} modelo(s), {resultado.clientes} cliente(s) y {resultado.ubicaciones} ubicación(es).</span>
            {resultado.clientes > 0 && <span>Los clientes nuevos quedan solo con el nombre: completa RUT, contacto y contrato en Clientes.</span>}
          </div>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, border: `2px dashed ${C.borde}`, background: C.suave, cursor: 'pointer' }}>
              <Icon d={I.doc} size={22} color={C.navy} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', font: '600 13px var(--font)' }}>{archivo || 'Elegir el Excel del inventario'}</span>
                <span style={{ font: '400 12px var(--font)', color: C.gris }}>
                  Columnas en este orden: CÓDIGO, MODELO, COLOR, DISPONIBLES, CLIENTE, UBICACIÓN. DISPONIBLES: 0 arriendo · 1 disponible · 2 extraviado · 3 vendido · 4 donación · 5 fuera de servicio.
                </span>
              </span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files[0] && leer(e.target.files[0])} style={{ display: 'none' }} />
              <span className="btn">Buscar archivo</span>
            </label>

            {filas.length > 0 && (
              <>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', font: '600 12px var(--font)' }}>
                  <span style={{ color: C.verde }}>{ok.length} válidos</span>
                  <span>{ok.length - actualizan} nuevos · {actualizan} ya existen (se actualizan)</span>
                  {Object.entries(porEstado).map(([k, n]) => <span key={k}>{L_ESTADO_ACTIVO[k]}: {n}</span>)}
                  {malas.length > 0 && <span style={{ color: C.rojo }}>{malas.length} con problema (se omiten)</span>}
                  {conAviso.length > 0 && <span style={{ color: '#8a5a00' }}>{conAviso.length} para revisar (se importan igual)</span>}
                </div>

                {crearan && (crearan.modelos.length + crearan.clientes.length + crearan.ubicaciones.length) > 0 && (
                  <div style={{ display: 'grid', gap: 6, padding: '10px 12px', background: C.suave, border: `2px solid ${C.borde}` }}>
                    <div style={{ font: '600 12px var(--font)' }}>Se crearán automáticamente. Revisa que no haya nombres repetidos escritos distinto:</div>
                    <Lista t="Modelos" l={crearan.modelos} />
                    <Lista t="Clientes" l={crearan.clientes} />
                    <Lista t="Ubicaciones" l={crearan.ubicaciones} />
                  </div>
                )}

                <div className="scroller" style={{ border: `2px solid ${C.borde}`, maxHeight: 300, overflowY: 'auto' }}>
                  <table style={{ minWidth: 760 }}>
                    <thead><tr><th>Fila</th><th>Código</th><th>Modelo</th><th>Color</th><th>Estado</th><th>Cliente</th><th>Ubicación</th><th>Observación</th></tr></thead>
                    <tbody>
                      {[...malas, ...conAviso, ...ok.filter((f) => !f.aviso)].slice(0, 60).map((f) => (
                        <tr key={f.n} style={{ background: f.problema ? '#fce8e6' : f.aviso ? '#fff4d6' : undefined }}>
                          <td>{f.n}</td><td>{f.codigo}</td><td>{f.modelo || '—'}</td><td>{f.color || '—'}</td>
                          <td>{f.estado ? L_ESTADO_ACTIVO[f.estado] : '—'}</td><td>{f.cliente || '—'}</td><td>{f.ubicacion || '—'}</td>
                          <td>{f.problema || f.aviso || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ font: '400 12px var(--font)', color: C.gris }}>
                  Se muestran primero las filas con problema. Si un código ya existe, se actualiza con los datos del Excel.
                </div>
              </>
            )}
          </>
        )}
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{error}</div>}
      </div>
    </Modal>
  )
}
