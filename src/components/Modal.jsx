import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { C } from '../lib/ui'

// Ventana base de toda la app.
// "Salir sin guardar" es igual en todos los formularios: si la persona escribió o cambió algo dentro de la ventana
// y la cierra (✕, Esc, clic afuera o un botón "Cancelar"), se pregunta antes de descartar.
// guardia={false}: el formulario ya hace su propia pregunta (no se pregunta dos veces).
// Los buscadores (input type="search" o con data-sin-guardia) no cuentan como cambios.
const MENSAJE = 'Hay cambios sin guardar. ¿Salir sin guardar?'
const ES_CANCELAR = /^(cancelar|descartar|volver)$/i
const PILA = []   // ventanas abiertas: Esc cierra solo la de más arriba

export default function Modal({ titulo, ancho = 820, onCerrar, pie, children, guardia = true }) {
  const sucio = useRef(false)
  const cerrar = () => {
    if (guardia && sucio.current && !window.confirm(MENSAJE)) return
    onCerrar()
  }
  const cerrarRef = useRef(cerrar)
  cerrarRef.current = cerrar

  useEffect(() => {
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const yo = {}
    PILA.push(yo)
    const esc = (e) => { if (e.key === 'Escape' && PILA[PILA.length - 1] === yo) cerrarRef.current() }
    document.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = previo; document.removeEventListener('keydown', esc)
      const i = PILA.indexOf(yo); if (i >= 0) PILA.splice(i, 1)
    }
  }, [])

  // Cualquier cambio hecho por la persona en un campo de la ventana la marca como "con cambios"
  const marcar = (e) => {
    const t = e.target
    if (!t || !('value' in t) || t.type === 'search' || t.closest?.('[data-sin-guardia]')) return
    if (e.isTrusted === false) return
    sucio.current = true
  }
  // Botón "Cancelar" del pie: pasa por la misma pregunta
  const alPie = (e) => {
    const b = e.target.closest?.('button')
    if (!b || !guardia || !sucio.current || !ES_CANCELAR.test((b.textContent || '').trim())) return
    if (!window.confirm(MENSAJE)) { e.preventDefault(); e.stopPropagation() } else sucio.current = false
  }
  // Al guardar con éxito la ventana se cierra desde afuera: no se pregunta
  useEffect(() => () => { sucio.current = false }, [])

  // Se dibuja directo en <body>: así queda siempre centrada en la pantalla, aunque la lista esté más abajo
  // o dentro de una tarjeta (los efectos de vidrio crean un nuevo marco para lo "fijo").
  return createPortal(
    <div onClick={cerrar} style={{
      position: 'fixed', inset: 0, background: 'rgba(2,6,14,.72)', backdropFilter: 'blur(4px)', zIndex: 1200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: 20, overflowY: 'auto', overscrollBehavior: 'contain',
    }}>
      <div onClick={(e) => e.stopPropagation()} onInput={marcar} onChange={marcar} style={{
        background: C.blanco, border: `1px solid ${C.borde}`, borderRadius: 'var(--radio-md)', overflow: 'hidden', margin: 'auto 0', width: `min(${ancho}px, 100%)`,
        boxShadow: '0 16px 40px rgba(4,12,26,.45)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
          background: C.blanco, borderBottom: `1px solid ${C.borde}`,
        }}>
          <h6 style={{ margin: 0, color: C.tinta, flex: 1 }}>{titulo}</h6>
          <button onClick={cerrar} aria-label="Cerrar" style={{
            border: 0, background: 'transparent', cursor: 'pointer',
            color: C.gris, font: '700 18px var(--font)', padding: '4px 8px',
          }}>✕</button>
        </div>

        {children}

        {pie && (
          <div onClickCapture={alPie} style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap',
            padding: '14px 18px', borderTop: `1px solid ${C.borde}`,
          }}>{pie}</div>
        )}
      </div>
    </div>
  , document.body)
}
