import { useState } from 'react'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import { supabase } from '../lib/supabase'

import { hoyISO } from '../lib/costos'
import { C, Icon, I } from '../lib/ui'

const ESTADOS = { 0: 'en_arriendo', 1: 'disponible', 2: 'extraviado', 3: 'vendido', 4: 'donacion', 5: 'fuera_de_servicio' }
const SITUACION = { en_arriendo: 'Asignado', disponible: 'Disponible', extraviado: 'No localizado', vendido: 'Baja (vendido)', donacion: 'Baja (donación)', fuera_de_servicio: 'En mantenimiento' }

const texto = (s) => String(s ?? '').trim()
// Normaliza para comparar: sin tildes, sin puntos/comas, minúsculas, espacios simples
const norm = (s) => texto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const cap = (s) => { const t = texto(s); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : null }
const q = async (p) => { const { data, error } = await p; if (error) throw error; return data || [] }
const mapa = (l) => Object.fromEntries(l.map((x) => [norm(x.nombre), x.id]))
const nuevosDe = (nombres, mp) => [...new Map(nombres.filter(Boolean).filter((n) => !mp[norm(n)]).map((n) => [norm(n), n])).values()]

const clave = (clienteId, nombre) => clienteId + '|' + norm(nombre)
// Ubicaciones (obras) del cliente que aún no existen: [{ cliente, nombre }]
const obrasNuevas = (arrendados, clientes, obras) => [...new Map(arrendados.filter((f) => f.cliente && f.ubicacion)
  .filter((f) => !obras[clave(clientes[norm(f.cliente)], f.ubicacion)])
  .map((f) => [norm(f.cliente) + '|' + norm(f.ubicacion), { cliente: f.cliente, nombre: f.ubicacion }])).values()]

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
        .map((r, i) => ({ n: i + 1, codigo: texto(r[0]).toUpperCase(), modelo: texto(r[1]).toUpperCase(), color: cap(r[2]), cod: r[3], cliente: texto(r[4]).toUpperCase(), ubicacion: texto(r[5]).toUpperCase() }))
        .filter((r) => r.codigo && norm(r.codigo) !== 'codigo')
        .map((r) => {
          const num = texto(r.cod) === '' ? NaN : Number(r.cod)
          const est = ESTADOS[num]
          const codigo = /^[0-9]+$/.test(r.codigo) ? String(Number(r.codigo)) : r.codigo   // "007" → "7", igual que "Agregar equipo"
          let problema = null, aviso = null
          if (!est) problema = 'ESTADO (4.ª columna) debe ser un número de 0 a 5'
          else if (!/^[0-9]+$/.test(r.codigo) || codigo === '0') problema = 'CÓDIGO debe ser un número de unidad (1, 2, 3…)'
          else if (vistos.has(codigo)) problema = 'Código repetido en el archivo'
          else if (est === 'en_arriendo' && !r.cliente) aviso = 'Arrendado sin cliente'
          else if (est !== 'en_arriendo' && r.cliente) aviso = 'No está arrendado: el texto de CLIENTE queda en Notas'
          vistos.add(codigo)
          // Si no está arrendado, cliente y ubicación del Excel no se crean: quedan como nota del equipo
          const nota = est && est !== 'en_arriendo' && (r.cliente || r.ubicacion) ? 'Excel: ' + [r.cliente, r.ubicacion].filter(Boolean).join(' · ') : null
          return { ...r, codigo, estado: est, nota, problema, aviso }
        })
      const [mo, cl, ub, ex, ca] = await Promise.all([
        q(supabase.from('modelos_bano').select('id, nombre')),
        q(supabase.from('clientes').select('id, nombre')),
        q(supabase.from('ubicaciones').select('id, nombre, tipo, cliente_id, activa')),
        q(supabase.from('activos').select('codigo')),
        q(supabase.from('categorias').select('id, nombre')),
      ])
      const bano = ca.find((c) => norm(c.nombre) === 'bano quimico')
      const bodega = ub.find((u) => u.tipo === 'bodega' && u.activa)
      if (!bano) throw new Error('No existe la categoría "Baño químico" (Administración → Catálogos).')
      if (!bodega) throw new Error('No hay una bodega activa donde dejar los baños disponibles (Administración → Catálogos).')
      const obras = Object.fromEntries(ub.filter((u) => u.cliente_id).map((u) => [clave(u.cliente_id, u.nombre), u.id]))
      setCat({ modelos: mapa(mo), clientes: mapa(cl), obras, bano: bano.id, bodega: bodega.id, existentes: new Set(ex.map((x) => x.codigo.toUpperCase())) })
      setFilas(lista); setArchivo(f.name)
    } catch (e) { setError(e?.message ? String(e.message) : 'No se pudo leer el archivo. Usa Excel (.xlsx, .xls) o CSV.') }
  }

  const ok = filas.filter((f) => !f.problema)
  const arrendados = ok.filter((f) => f.estado === 'en_arriendo')
  const malas = filas.filter((f) => f.problema)
  const conAviso = ok.filter((f) => f.aviso)
  const porEstado = ok.reduce((a, f) => ({ ...a, [f.estado]: (a[f.estado] || 0) + 1 }), {})
  const crearan = cat ? {
    modelos: nuevosDe(ok.map((f) => f.modelo), cat.modelos),
    clientes: nuevosDe(arrendados.map((f) => f.cliente), cat.clientes),
    ubicaciones: obrasNuevas(arrendados, cat.clientes, cat.obras).map((o) => `${o.nombre} (${o.cliente})`),
  } : null
  const actualizan = cat ? ok.filter((f) => cat.existentes.has(f.codigo)).length : 0

  const importar = async () => {
    setError(null); setEstado('Importando…')
    try {
  const modelos = { ...cat.modelos }, clientes = { ...cat.clientes }, obras = { ...cat.obras }
      const crear = async (tabla, mp, nombres, fila) => {
        const nuevos = nuevosDe(nombres, mp)
        if (!nuevos.length) return
        const { data, error } = await supabase.from(tabla).insert(nuevos.map(fila)).select('id, nombre')
        if (error) throw error
        data.forEach((x) => { mp[norm(x.nombre)] = x.id })
      }
      await crear('modelos_bano', modelos, ok.map((f) => f.modelo), (n) => ({ nombre: n, tipo: n, categoria_id: cat.bano }))
      await crear('clientes', clientes, arrendados.map((f) => f.cliente), (n) => ({ nombre: n }))
      // Obras: cada ubicación queda a nombre de su cliente (se ve en la ficha del cliente)
      const nuevas = obrasNuevas(arrendados, clientes, obras)
      if (nuevas.length) {
        const { data, error } = await supabase.from('ubicaciones')
          .insert(nuevas.map((o) => ({ nombre: o.nombre, tipo: 'faena', cliente_id: clientes[norm(o.cliente)] })))
          .select('id, nombre, cliente_id')
        if (error) throw error
        data.forEach((x) => { obras[clave(x.cliente_id, x.nombre)] = x.id })
      }

      // Arrendado → en la obra del cliente · Disponible o fuera de servicio → bodega · Extraviado, vendido o donado → sin ubicación
      const filasDb = ok.map((f) => {
        const clienteId = f.estado === 'en_arriendo' ? clientes[norm(f.cliente)] || null : null
        return {
          codigo: f.codigo, tipo: 'bano_quimico', propiedad: 'empresa', categoria_id: cat.bano,
          estado: f.estado, color: f.color, modelo_id: modelos[norm(f.modelo)] || null,
          cliente_id: clienteId,
          ubicacion_id: clienteId ? (f.ubicacion ? obras[clave(clienteId, f.ubicacion)] : null)
            : ['disponible', 'fuera_de_servicio'].includes(f.estado) ? cat.bodega : null,
          fecha_incorporacion: hoyISO(), notas: f.nota,
        }
      })

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
        ? <button className="btn btn-azul" onClick={onImportado}>Listo</button>
        : <>
          <button className="btn" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-azul" onClick={importar} disabled={!ok.length || !!estado}>
            {estado || `Importar ${ok.length} baño(s)`}
          </button>
        </>
    }>
      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        {resultado ? (
          <div style={{ display: 'grid', gap: 8, padding: 16, background: 'rgba(84,201,154,.2)', border: `1px solid ${C.verde}`, font: '400 13px/1.6 var(--font)', color: '#6EE7B7', borderRadius: 'var(--radio-md)' }}>
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
                  Columnas en este orden (sin tildes): CODIGO, MODELO, COLOR, ESTADO, CLIENTE, UBICACION. La primera fila puede ser el encabezado. ESTADO es un número: 0 = arrendado · 1 = disponible en bodega · 2 = extraviado · 3 = vendido · 4 = donado · 5 = fuera de servicio. Las tildes del archivo no importan.
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
                  {Object.entries(porEstado).map(([k, n]) => <span key={k}>{SITUACION[k]}: {n}</span>)}
                  {malas.length > 0 && <span style={{ color: C.rojo }}>{malas.length} con problema (se omiten)</span>}
                  {conAviso.length > 0 && <span style={{ color: '#FBBF24' }}>{conAviso.length} para revisar (se importan igual)</span>}
                </div>

                {crearan && (crearan.modelos.length + crearan.clientes.length + crearan.ubicaciones.length) > 0 && (
                  <div style={{ display: 'grid', gap: 6, padding: '10px 12px', background: C.suave, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)' }}>
                    <div style={{ font: '600 12px var(--font)' }}>Se crearán automáticamente. Revisa que no haya nombres repetidos escritos distinto:</div>
                    <Lista t="Modelos" l={crearan.modelos} />
                    <Lista t="Clientes" l={crearan.clientes} />
                    <Lista t="Ubicaciones" l={crearan.ubicaciones} />
                  </div>
                )}

                <div className="scroller" style={{ border: `1px solid ${C.borde}`, maxHeight: 300, overflowY: 'auto', borderRadius: 'var(--radio-md)' }}>
                  <table style={{ minWidth: 760 }}>
                    <thead><tr><th>Fila</th><th>Código</th><th>Modelo</th><th>Color</th><th>Estado</th><th>Cliente</th><th>Ubicación</th><th>Observación</th></tr></thead>
                    <tbody>
                      {[...malas, ...conAviso, ...ok.filter((f) => !f.aviso)].slice(0, 60).map((f) => (
                        <tr key={f.n} style={{ background: f.problema ? 'rgba(239,98,93,.2)' : f.aviso ? 'rgba(235,170,66,.2)' : undefined }}>
                          <td>{f.n}</td><td>{f.codigo}</td><td>{f.modelo || '—'}</td><td>{f.color || '—'}</td>
                          <td>{f.estado ? SITUACION[f.estado] : '—'}</td><td>{f.cliente || '—'}</td><td>{f.ubicacion || '—'}</td>
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
        {error && <div style={{ padding: '10px 12px', background: 'rgba(239,98,93,.2)', border: `1px solid ${C.rojo}`, font: '400 12px var(--font)', color: '#FCA5A5', borderRadius: 'var(--radio-sm)' }}>{error}</div>}
      </div>
    </Modal>
  )
}
