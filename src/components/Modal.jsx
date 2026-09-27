import { useEffect } from 'react'
import { C } from '../lib/ui'

export default function Modal({ titulo, ancho = 820, onCerrar, pie, children }) {
  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = previo; document.removeEventListener('keydown', esc) }
  }, [onCerrar])

  return (
    <div onClick={onCerrar} style={{
      position: 'fixed', inset: 0, background: 'rgba(32,30,29,.6)', zIndex: 1200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 20, overflowY: 'auto', overscrollBehavior: 'contain',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#fff', border: `2px solid ${C.navy}`, width: `min(${ancho}px, 100%)`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          background: C.tinte, borderBottom: `2px solid ${C.borde}`,
        }}>
          <h6 style={{ margin: 0, color: '#1a3c72', flex: 1 }}>{titulo}</h6>
          <button onClick={onCerrar} aria-label="Cerrar" style={{
            border: 0, background: 'transparent', cursor: 'pointer',
            color: C.gris, font: '700 18px var(--font)', padding: '4px 8px',
          }}>✕</button>
        </div>

        {children}

        {pie && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            padding: '14px 18px', borderTop: `2px solid ${C.borde}`,
          }}>{pie}</div>
        )}
      </div>
    </div>
  )
}
