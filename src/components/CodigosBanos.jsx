import { useEffect, useMemo, useRef, useState } from 'react'
import { banosEstado } from '../lib/api'
import { C, Icon, I } from '../lib/ui'
import { limpiarCodigo } from '../lib/validar'

const ESTADO = {
  en_arriendo: 'ya está arrendado', en_servicio: 'ya está arrendado', mantencion: 'está en mantención',
  fuera_de_servicio: 'está fuera de servicio',
}

// Orden natural: 2, 11, 102, BQ-3, BQ-20…
const orden = (a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true, sensitivity: 'base' })

// Ingreso de códigos de baño uno por uno. La lista muestra solo baños disponibles, en orden.
export default function CodigosBanos({ cantidad = 0, elegidos = [], onChange }) {
  const [todos, setTodos] = useState([])
  const [texto, setTexto] = useState('')
  const [alerta, setAlerta] = useState(null)
  const [abierta, setAbierta] = useState(false)
  const [activo, setActivo] = useState(0)
  const caja = useRef(null)

  useEffect(() => { banosEstado().then(setTodos).catch(() => setTodos([])) }, [])
  useEffect(() => {
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierta(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const libres = useMemo(() => todos
    .filter((b) => b.estado === 'disponible' && !b.reservado && !elegidos.some((e) => e.id === b.id))
    .sort(orden), [todos, elegidos])
  const filtro = texto.trim().toUpperCase()
  const opciones = filtro ? libres.filter((b) => b.codigo.toUpperCase().startsWith(filtro)) : libres
  const lleno = cantidad > 0 && elegidos.length >= cantidad

  const sumar = (b) => {
    if (lleno) return setAlerta(`Ya ingresaste los ${cantidad} baños indicados. Aumenta la cantidad para agregar más.`)
    onChange([...elegidos, b])
    setTexto(''); setAlerta(null); setActivo(0)
  }

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
    sumar(b)
  }

  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierta(true); setActivo((i) => Math.min(i + 1, opciones.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Escape') setAbierta(false)
    else if (e.key === 'Enter') {
      e.preventDefault()
      const exacto = opciones.find((b) => b.codigo.toUpperCase() === filtro)
      if (abierta && opciones[activo] && !exacto) sumar(opciones[activo])
      else agregar()
    }
  }

  const bloqueado = cantidad < 1 || lleno

  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div ref={caja} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <input value={texto} onChange={(e) => { setTexto(limpiarCodigo(e.target.value)); setAlerta(null); setAbierta(true); setActivo(0) }}
            onFocus={() => setAbierta(true)} onKeyDown={teclas}
            placeholder={lleno ? 'Cantidad completa' : 'Código del baño (ej. BQ-037)'} disabled={bloqueado}
            role="combobox" aria-expanded={abierta} aria-autocomplete="list"
            style={{ width: '100%', boxSizing: 'border-box', border: `2px solid ${alerta ? C.rojo : C.borde}`, background: '#fff', font: '400 13px var(--font)', padding: '10px 12px', minHeight: 44, outline: 'none', textTransform: 'uppercase' }} />
          {abierta && !bloqueado && (
            <div role="listbox" style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 4px)', zIndex: 20, maxHeight: 280, overflowY: 'auto', background: '#fff', border: `2px solid ${C.borde}`, boxShadow: '0 8px 24px rgba(31,58,99,.16)' }}>
              <div style={{ position: 'sticky', top: 0, padding: '7px 12px', background: C.tinte, borderBottom: `2px solid ${C.borde}`, font: '600 10px var(--font)', letterSpacing: '.06em', textTransform: 'uppercase', color: '#1a3c72' }}>
                Disponibles en bodega · {opciones.length}
              </div>
              {opciones.length === 0 && (
                <div style={{ padding: '10px 12px', font: '400 12px var(--font)', color: C.gris }}>
                  {filtro ? `Ningún baño disponible empieza con ${filtro}.` : 'No hay baños disponibles.'}
                </div>
              )}
              {opciones.map((b, i) => (
                <button key={b.id} type="button" role="option" aria-selected={i === activo}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => sumar(b)} onMouseEnter={() => setActivo(i)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: 0, borderBottom: `1px solid ${C.fila}`, background: i === activo ? C.tinte : '#fff', padding: '9px 12px', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ font: '700 13px var(--font)', color: C.navy }}>{b.codigo}</span>
                  <span style={{ font: '400 12px var(--font)', color: C.gris }}>{b.modelos_bano?.nombre || 'Sin modelo'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn" onClick={agregar} disabled={bloqueado}>
          <Icon d={I.plus} size={15} /><span>Agregar</span>
        </button>
      </div>

      {alerta && (
        <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', background: '#fce8e6', border: `2px solid ${C.rojo}`, font: '400 12px/1.4 var(--font)', color: '#7c1405' }}>
          <Icon d={I.alert} size={15} color={C.rojo} /><span>{alerta}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[...elegidos].sort(orden).map((b) => (
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
