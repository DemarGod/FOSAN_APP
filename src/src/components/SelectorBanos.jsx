import { useMemo, useState } from 'react'
import { C, Icon, I } from '../lib/ui'

// Lista de baños con filtro por modelo y casillas para elegir unidades.
export default function SelectorBanos({ banos = [], elegidos = [], onChange, vacio = 'No hay baños disponibles.' }) {
  const [tipo, setTipo] = useState('')
  const tipos = useMemo(() => [...new Set(banos.map(etiqueta))].sort(), [banos])
  const visibles = tipo ? banos.filter((b) => etiqueta(b) === tipo) : banos
  const set = new Set(elegidos)
  const alternar = (id) => onChange(set.has(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id])

  return (
    <div style={{ border: `2px solid ${C.borde}`, background: '#fff', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px',
        borderBottom: `2px solid ${C.borde}`, background: C.suave, flexWrap: 'wrap',
      }}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{
          border: `2px solid ${C.borde}`, background: '#fff', font: '600 12px var(--font)',
          padding: '6px 8px', minHeight: 34, color: C.navy, maxWidth: '100%', minWidth: 0,
        }}>
          <option value="">Todos los modelos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ font: '600 12px var(--font)', color: C.navy }}>{elegidos.length} elegido(s)</span>
      </div>
      <div style={{ maxHeight: 190, overflowY: 'auto' }}>
        {visibles.length === 0 && (
          <div style={{ padding: 12, font: '400 12px var(--font)', color: C.gris }}>{vacio}</div>
        )}
        {visibles.map((b) => {
          const on = set.has(b.id)
          return (
            <label key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
              borderBottom: `1px solid ${C.fila}`, background: on ? C.tinte : '#fff',
            }}>
              <input type="checkbox" checked={on} onChange={() => alternar(b.id)}
                style={{ width: 18, height: 18, accentColor: C.navy }} />
              <Icon d={I.cabina} size={15} color={C.navy} />
              <span style={{ font: '600 13px var(--font)', minWidth: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.codigo}>{b.codigo}</span>
              <span style={{ font: '400 12px var(--font)', color: b.modelos_bano ? C.gris : '#b06000', flex: 1, minWidth: 0 }}>{etiqueta(b)}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

const etiqueta = (b) => {
  const m = b.modelos_bano
  if (!m) return 'Sin modelo'
  return m.tipo && m.tipo !== m.nombre ? `${m.nombre} · ${m.tipo}` : m.nombre
}
