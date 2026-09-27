import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { notificaciones, marcarLeidas } from '../lib/api'
import { C, Icon, I, fechaHora } from '../lib/ui'

const NIVEL = {
  alerta: { color: C.rojo, tint: '#fce8e6', d: I.alert },
  aviso: { color: C.amarillo, tint: '#fef7e0', d: I.wrench },
  info: { color: C.azul, tint: C.tinte, d: I.info },
}

export default function Topbar({ perfil, onCalendario }) {
  const navegar = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [avisos, setAvisos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const caja = useRef(null)

  useEffect(() => {
    notificaciones().then(setAvisos).catch(() => setAvisos([]))
  }, [])

  useEffect(() => {
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const sinLeer = avisos.filter((a) => !a.leida).length

  const leerTodas = async () => {
    try { await marcarLeidas() } catch { /* solo lectura */ }
    setAvisos((v) => v.map((a) => ({ ...a, leida: true })))
    setAbierto(false)
  }

  const buscar = (e) => {
    e.preventDefault()
    const q = busqueda.trim()
    if (q) navegar('/inventario?q=' + encodeURIComponent(q))
  }

  const iniciales = (perfil?.nombre || 'FOSAN').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 64, padding: '0 16px',
      background: '#fff', borderBottom: `2px solid ${C.borde}`,
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      <div className="sbtab" style={{ font: '800 17px/1 var(--font)', letterSpacing: '-.02em', color: C.navy }}>
        FOSAN
      </div>

      <form onSubmit={buscar} className="desk-only" style={{
        flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8,
        border: `1px solid ${C.borde}`, padding: '7px 10px', background: '#fff',
      }}>
        <Icon d={I.busca} size={15} color={C.gris} />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar activos, clientes o direcciones"
          style={{ border: 0, outline: 'none', background: 'transparent', font: '400 13px var(--font)', width: '100%' }} />
      </form>

      <div style={{ flex: 1 }} />

      <button onClick={onCalendario} title="Calendario" style={{
        border: `2px solid ${C.borde}`, background: '#fff', color: C.navy,
        width: 40, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer',
      }}>
        <Icon d={I.cal} size={18} w={1.7} />
      </button>

      <div ref={caja} style={{ position: 'relative', display: 'flex' }}>
        <button onClick={() => setAbierto((v) => !v)} aria-label="Notificaciones" style={{
          position: 'relative', border: 0, background: 'transparent', padding: 4,
          color: C.navy, cursor: 'pointer', display: 'flex',
        }}>
          <Icon d="M18 16V10a6 6 0 1 0-12 0v6l-2 3h16zM10 21h4" size={22} w={1.7} />
          {sinLeer > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, padding: '0 3px',
              background: C.rojo, color: '#fff', borderRadius: 8,
              font: '700 10px/16px var(--font)', textAlign: 'center',
            }}>{sinLeer}</span>
          )}
        </button>

        {abierto && (
          <div style={{
            position: 'absolute', top: 38, right: 0, width: 'min(360px, 80vw)', background: '#fff',
            border: `2px solid ${C.borde}`, boxShadow: '0 10px 30px rgba(31,58,99,.18)', zIndex: 1100,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '12px 14px', borderBottom: `2px solid ${C.borde}`,
            }}>
              <span style={{ font: '700 14px var(--font)' }}>Notificaciones</span>
              {sinLeer > 0 && (
                <button onClick={leerTodas} style={{
                  border: 0, background: 'transparent', color: C.azul,
                  font: '600 12px var(--font)', cursor: 'pointer', padding: 0,
                }}>Marcar todas como leídas</button>
              )}
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {avisos.length === 0 && (
                <div style={{ padding: 16, font: '400 13px var(--font)', color: C.gris }}>
                  No hay notificaciones.
                </div>
              )}
              {avisos.map((a) => {
                const n = NIVEL[a.nivel] || NIVEL.info
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px',
                    borderBottom: `1px solid ${C.fila}`, opacity: a.leida ? .55 : 1,
                  }}>
                    <span style={{
                      width: 28, height: 28, flex: 'none', background: n.tint, color: n.color,
                      display: 'grid', placeItems: 'center',
                    }}>
                      <Icon d={n.d} size={15} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 13px/1.35 var(--font)' }}>{a.texto}</div>
                      <div style={{ font: '400 11px var(--font)', color: C.gris }}>{fechaHora(a.creado_en)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 32, height: 32, background: C.navy, color: '#eef2f9',
          display: 'grid', placeItems: 'center', font: '800 12px var(--font)',
        }}>{iniciales}</div>
        <div className="desk-only" style={{ lineHeight: 1.2 }}>
          <div style={{ font: '600 13px var(--font)' }}>{perfil?.nombre || 'Usuario'}</div>
          <div style={{ font: '400 11px var(--font)', color: C.gris }}>
            {perfil?.rol === 'dueno' ? 'Dueño' : 'Solo lectura'}
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()} title="Cerrar sesión" style={{
          border: 0, background: 'transparent', color: C.gris, cursor: 'pointer',
          padding: 4, display: 'flex',
        }}>
          <Icon d={I.salir} size={18} w={1.7} />
        </button>
      </div>
    </header>
  )
}
