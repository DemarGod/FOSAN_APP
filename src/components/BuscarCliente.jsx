// Búsqueda rápida de cliente (lámina 2.3 · 6): por RUT o nombre, solo clientes activos.
// Muestra cuántas ubicaciones y servicios tiene cada uno. Se usa en Nueva operación y donde haga falta elegir cliente.
import { useEffect, useMemo, useRef, useState } from 'react'
import { clientesListado, normalizarRut } from '../lib/api'
import { C, Icon, I } from '../lib/ui'

export default function BuscarCliente({ valor, onElegir, disabled = false, autoFocus = false }) {
  const [lista, setLista] = useState([])
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useEffect(() => { clientesListado().then((l) => setLista(l.filter((c) => c.activo))).catch(() => {}) }, [])
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])
  const elegido = lista.find((c) => c.id === valor)
  const res = useMemo(() => {
    const t = texto.trim().toLowerCase(), r = normalizarRut(texto)
    return lista.filter((c) => !t || c.nombre.toLowerCase().includes(t) || (c.nombre_comercial || '').toLowerCase().includes(t)
      || (r.length >= 3 && normalizarRut(c.rut).includes(r))).slice(0, 12)
  }, [lista, texto])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Icon d={I.busca} size={16} color={C.gris} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={abierto ? texto : elegido ? `${elegido.rut || ''} · ${elegido.nombre}` : texto} disabled={disabled} autoFocus={autoFocus}
          onFocus={() => { setAbierto(true); setTexto('') }} onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
          placeholder="Buscar por RUT o nombre del cliente" style={{ paddingLeft: 36 }} />
      </div>
      {abierto && (
        <div role="listbox" style={{
          position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 30, maxHeight: 300, overflowY: 'auto',
          background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', boxShadow: '0 8px 24px rgba(19,41,75,.14)',
        }}>
          {res.length === 0 && <div style={{ padding: 12, color: C.gris }}>Sin clientes activos con ese RUT o nombre.</div>}
          {res.map((c) => (
            <button key={c.id} type="button" role="option" aria-selected={c.id === valor}
              onClick={() => { onElegir(c); setAbierto(false); setTexto('') }}
              style={{
                display: 'flex', gap: 12, width: '100%', border: 0, borderBottom: `1px solid ${C.fila}`, padding: '10px 12px',
                background: c.id === valor ? C.tinte : 'transparent', cursor: 'pointer', textAlign: 'left', font: '400 14px var(--font)',
              }}>
              <span style={{ width: 110, color: C.gris, flex: 'none' }}>{c.rut || '—'}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{c.nombre}</span>
              <span className="text-muted" style={{ fontSize: 12 }}>{c.ubicaciones} ubicación(es) · {c.servicios_vigentes} servicio(s)</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
