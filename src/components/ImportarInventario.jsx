import { useState } from 'react'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { C, Icon, I, L_ESTADO_ACTIVO } from '../lib/ui'

// TEMPORAL: carga única del inventario desde Excel.
// Cuando termines, borra este archivo y el botón en pages/Banos.jsx.
const ESTADOS = { 0: 'en_arriendo', 1: 'disponible', 2: 'extraviado', 3: 'vendido', 4: 'donacion', 5: 'fuera_de_servicio' }
const texto = (s) => String(s ?? '').trim()
const norm = (s) => texto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')
const cap = (s) => { const t = texto(s); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : null }
const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || [] }

export default function ImportarInventario({ onCerrar, onImportado }) {
  const [archivo, setArchivo] = useState('')
  const [filas, setFilas] = useState([])
  const [estado, setEstado] = useState(null)
  const [error, setError] = useState(null)

  const leer = async (f) => {
    setError(null)
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
          let problema = null
          if (!est) problema = 'DISPONIBLES debe ser un número de 0 a 5'
          else if (vistos.has(r.codigo)) problema = 'Código repetido en el archivo'
          vistos.add(r.codigo)
          return { ...r, estado: est, problema }
        })
      setFilas(lista); setArchivo(f.name)
    } catch { setError('No se pudo leer el archivo. Usa Excel (.xlsx, .xls) o CSV.') }
  }

  const ok = filas.filter((f) => !f.problema)
  const malas = filas.filter((f) => f.problema)
  const porEstado = ok.reduce((a, f) => ({ ...a, [f.estado]: (a[f.estado] || 0) + 1 }), {})

  const importar = async () => {
    setError(null); setEstado('Importando…')
    try {
      const [mo, cl, ub] = await Promise.all([
        q(supabase.from('modelos_bano').select('id, nombre')),
        q(supabase.from('clientes').select('id, nombre')),
        q(supabase.from('ubicaciones').select('id, nombre')),
      ])
      const mapa = (l) => Object.fromEntries(l.map((x) => [norm(x.nombre), x.id]))
      const modelos = mapa(mo), clientes = mapa(cl), ubic = mapa(ub)

      const crear = async (tabla, mp, nombres, fila) => {
        const nuevos = [...new Map(nombres.filter(Boolean).filter((n) => !mp[norm(n)]).map((n) => [norm(n), n])).values()]
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
        const { error } = await supabase.from('activos').upsert(filasDb.slice(i, i + 200), { onConflict: 'codigo' })
        if (error) throw error
      }
      setEstado(null)
      onImportado()
    } catch (e) { setEstado(null); setError(String(e.message || e)) }
  }

  return (
    <Modal titulo="Importar inventario desde Excel (temporal)" ancho={900} onCerrar={onCerrar} pie={
      <>
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-verde" onClick={importar} disabled={!ok.length || !!estado}>
          {estado || `Importar ${ok.length} baño(s)`}
        </button>
      </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
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
              {Object.entries(porEstado).map(([k, n]) => <span key={k}>{L_ESTADO_ACTIVO[k]}: {n}</span>)}
              {malas.length > 0 && <span style={{ color: C.rojo }}>{malas.length} con problema (se omiten)</span>}
            </div>
            <div className="scroller" style={{ border: `2px solid ${C.borde}`, maxHeight: 300, overflowY: 'auto' }}>
              <table style={{ minWidth: 700 }}>
                <thead><tr><th>Fila</th><th>Código</th><th>Modelo</th><th>Color</th><th>Estado</th><th>Cliente</th><th>Ubicación</th></tr></thead>
                <tbody>
                  {filas.slice(0, 40).map((f) => (
                    <tr key={f.n} style={{ background: f.problema ? '#fce8e6' : undefined }}>
                      <td>{f.n}</td><td>{f.codigo}</td><td>{f.modelo || '—'}</td><td>{f.color || '—'}</td>
                      <td>{f.problema || L_ESTADO_ACTIVO[f.estado]}</td><td>{f.cliente || '—'}</td><td>{f.ubicacion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ font: '400 12px var(--font)', color: C.gris }}>
              Se crean solos los modelos, clientes y ubicaciones que no existan. Si un código ya existe, se actualiza.
            </div>
          </>
        )}
        {error && <div style={{ padding: '10px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#7c1405' }}>{error}</div>}
      </div>
    </Modal>
  )
}