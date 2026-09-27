import { useEffect, useState } from 'react'
import { banosEstado } from '../lib/api'
import { C, Icon, I } from '../lib/ui'

const ESTADO = {
  en_arriendo: 'ya está en arriendo', en_servicio: 'está en servicio', mantencion: 'está en mantención',
  fuera_de_servicio: 'está fuera de servicio',
}

// Ingreso de códigos de baño uno por uno, con alerta si no se puede arrendar.
export default function CodigosBanos({ cantidad = 0, elegidos = [], onChange }) {
  const [todos, setTodos] = useState([])
  const [texto, setTexto] = useState('')
  const [alerta, setAlerta] = useState(null)

  useEffect(() => { banosEstado().then(setTodos).catch(() => setTodos([])) }, [])

  const libres = todos.filter((b) => b.estado === 'disponible' && !b.reservado && !elegidos.some((e) => e.id === b.id))
  const lleno = cantidad > 0 && elegidos.length >= cantidad

  const agregar = () => {
    const cod = texto.trim().toUpperCase()
    if (!cod) return
    const b = todos.find((x) => x.codigo.toUpperCase() === cod)
    if (!b) return setAlerta(`No existe un baño con el código ${cod}.`)
    if (elegidos.some((e) => e.id === b.id)) return setAlerta(`${b.codigo} ya está en la lista.`)
    if (b.estado !== 'disponible') {
      return setAlerta(`${b.codigo} ${ESTADO[b.estado] || 'no está disponible'}${b.estado === 'en_arriendo' && b.clientes?.nombre ? ' con ' + b.clientes.nombre : ''}. No se puede agregar.`)
    }
    if (b.reservado) return setAlerta(`${b.codigo} ya está reservado en el despacho ${b.reservado}. No se puede agregar.`)
    if (lleno) return setAlerta(`Ya ingresaste los ${cantidad} baños indicados. Aumenta la cantidad para agregar más.`)
    onChange([...elegidos, b])
    setTexto('')
    setAlerta(null)
  }

  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input list="banos-libres" value={texto} onChange={(e) => { setTexto(e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 15)); setAlerta(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar() } }}
          placeholder={lleno ? 'Cantidad completa' : 'Código del baño (ej. BQ-037)'} disabled={cantidad < 1}
          style={{ flex: 1, minWidth: 0, border: `2px solid ${alerta ? C.rojo : C.borde}`, background: '#fff', font: '400 13px var(--font)', padding: '10px 12px', minHeight: 44, outline: 'none', textTransform: 'uppercase' }} />
        <datalist id="banos-libres">
          {libres.map((b) => <option key={b.id} value={b.codigo}>{b.modelos_bano?.nombre || 'Sin modelo'}</option>)}
        </datalist>
        <button type="button" className="btn" onClick={agregar} disabled={cantidad < 1}>
          <Icon d={I.plus} size={15} /><span>Agregar</span>
        </button>
      </div>

      {alerta && (
        <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px/1.4 var(--font)', color: '#7c1405' }}>
          <Icon d={I.alert} size={15} color={C.rojo} /><span>{alerta}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {elegidos.map((b) => (
          <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 6px 5px 10px', background: C.tinte, border: `2px solid ${C.borde}`, font: '600 12px var(--font)', color: C.navy }}>
            {b.codigo}
            <span style={{ font: '400 11px var(--font)', color: C.gris }}>{b.modelos_bano?.nombre || ''}</span>
            <button type="button" aria-label={`Quitar ${b.codigo}`} onClick={() => onChange(elegidos.filter((e) => e.id !== b.id))}
              style={{ border: 0, background: 'transparent', color: C.rojo, cursor: 'pointer', font: '700 13px var(--font)', padding: '0 4px' }}>✕</button>
          </span>
        ))}
        <span style={{ font: '600 12px var(--font)', color: cantidad && elegidos.length === cantidad ? C.verde : C.gris }}>
          {cantidad > 0 ? `${elegidos.length} de ${cantidad} ingresados` : 'Indica primero la cantidad'}
          {cantidad > 0 && ` · ${libres.length} disponibles en bodega`}
        </span>
      </div>
    </div>
  )
}
