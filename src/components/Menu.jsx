// Menú de acciones de una fila (posición fija para que la tabla con scroll no lo recorte)
import { useEffect, useRef, useState } from 'react'
import { C, Icon } from '../lib/ui'

export default function Menu({ opciones, icono = 'M6 9l6 6 6-6', tam = 16, grosor, ancho = 200, altoFila = 40, resaltar = false }) {
  const [abierto, setAbierto] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(null) }
    const cerrar = () => setAbierto(null)
    document.addEventListener('mousedown', fuera); window.addEventListener('scroll', cerrar, true); window.addEventListener('resize', cerrar)
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('scroll', cerrar, true); window.removeEventListener('resize', cerrar) }
  }, [abierto])
  const alternar = (e) => {
    if (abierto) { setAbierto(null); return }
    const r = e.currentTarget.getBoundingClientRect(), alto = opciones.length * altoFila + 10
    setAbierto({ top: r.bottom + 4 + alto > window.innerHeight ? r.top - 4 - alto : r.bottom + 4, right: window.innerWidth - r.right })
  }
  const hover = resaltar ? {
    onMouseEnter: (e) => { e.currentTarget.style.background = C.suave },
    onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent' },
  } : {}
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn" aria-label="Más acciones" onClick={alternar} style={{ minHeight: 34, padding: '6px 8px' }}>
        <Icon d={icono} size={tam} w={grosor} />
      </button>
      {abierto && (
        <div role="menu" style={{ position: 'fixed', right: abierto.right, top: abierto.top, zIndex: 1100, minWidth: ancho, padding: 4, background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', boxShadow: '0 8px 24px rgba(19,41,75,.14)' }}>
          {opciones.map((o) => (
            <button key={o.l} type="button" role="menuitem" disabled={o.disabled} title={o.nota} onClick={() => { setAbierto(null); o.onClick() }} {...hover}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 0, background: 'transparent', padding: '9px 10px', borderRadius: 'var(--radio-sm)', font: '400 14px var(--font)', textAlign: 'left', color: o.color || C.tinta, cursor: o.disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.45 : 1 }}>
              <Icon d={o.d} size={16} color={o.color || C.gris} />
              <span style={{ flex: 1 }}>{o.l}{o.nota && <small style={{ display: 'block', color: C.gris }}>{o.nota}</small>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}