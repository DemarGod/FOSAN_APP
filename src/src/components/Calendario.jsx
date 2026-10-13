import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { eventosDelMes, crearEvento, borrarEvento } from '../lib/api'
import { C, MESES, L_TIPO_EVENTO, COLOR_EVENTO } from '../lib/ui'

const TIPOS = Object.keys(L_TIPO_EVENTO)
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const pad = (n) => (n < 10 ? '0' + n : '' + n)
const hoyIso = () => new Date().toISOString().slice(0, 10)

export default function Calendario({ puedeEditar, onCerrar }) {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [sel, setSel] = useState(hoyIso())
  const [eventos, setEventos] = useState([])
  const [tipo, setTipo] = useState('mantencion')
  const [titulo, setTitulo] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    eventosDelMes(anio, mes).then(setEventos).catch(setError)
  }, [anio, mes])

  const porDia = useMemo(() => {
    const m = {}
    eventos.forEach((e) => { (m[e.fecha] = m[e.fecha] || []).push(e) })
    return m
  }, [eventos])

  const celdas = useMemo(() => {
    const primero = new Date(anio, mes, 1)
    const offset = (primero.getDay() + 6) % 7
    const total = new Date(anio, mes + 1, 0).getDate()
    return Array.from({ length: 42 }, (_, i) => {
      const n = i - offset + 1
      if (n < 1 || n > total) return null
      return { n, iso: `${anio}-${pad(mes + 1)}-${pad(n)}` }
    })
  }, [anio, mes])

  const irMes = (delta) => {
    const m = mes + delta
    if (m < 0) { setAnio(anio - 1); setMes(11) }
    else if (m > 11) { setAnio(anio + 1); setMes(0) }
    else setMes(m)
  }

  const guardar = async () => {
    const t = titulo.trim()
    if (!t) return
    try {
      const nuevo = await crearEvento({ fecha: sel, tipo, titulo: t })
      setEventos((v) => [...v, nuevo])
      setTitulo('')
      setError(null)
    } catch (e) { setError(e) }
  }

  const borrar = async (id) => {
    try {
      await borrarEvento(id)
      setEventos((v) => v.filter((e) => e.id !== id))
    } catch (e) { setError(e) }
  }

  const delDia = porDia[sel] || []
  const [y, m, d] = sel.split('-')

  return (
    <Modal ancho={760} onCerrar={onCerrar}
      titulo={`Calendario · ${MESES[mes]} ${anio}`}>
      <div style={{
        display: 'flex', gap: 8, padding: '10px 18px', borderBottom: `2px solid ${C.borde}`,
      }}>
        <button onClick={() => irMes(-1)} style={btnNav}>‹</button>
        <button onClick={() => irMes(1)} style={btnNav}>›</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setAnio(hoy.getFullYear()); setMes(hoy.getMonth()); setSel(hoyIso()) }}
          style={{ ...btnNav, width: 'auto', padding: '0 14px', font: '600 12px var(--font)' }}>Hoy</button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        background: C.borde, gap: 1, padding: 1,
      }}>
        {DIAS.map((d2) => (
          <div key={d2} style={{
            background: C.suave, textAlign: 'center', font: '600 11px/1 var(--font)',
            color: C.gris, padding: '9px 0', textTransform: 'uppercase', letterSpacing: '.06em',
          }}>{d2}</div>
        ))}
        {celdas.map((c, i) => {
          if (!c) return <div key={i} style={{ background: '#fafbfc', minHeight: 58 }} />
          const on = c.iso === sel
          const evs = porDia[c.iso] || []
          return (
            <button key={i} onClick={() => setSel(c.iso)} style={{
              background: on ? C.tinte : '#fff', border: 0,
              borderBottom: `3px solid ${on ? C.azul : 'transparent'}`,
              minHeight: 58, padding: 6, textAlign: 'left', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <span style={{ font: '600 13px var(--font)', color: on ? '#1a3c72' : C.tinta }}>{c.n}</span>
              <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {evs.map((e) => (
                  <span key={e.id} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: COLOR_EVENTO[e.tipo] || C.navy,
                  }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ padding: '16px 18px', borderTop: `2px solid ${C.borde}` }}>
        <div style={{ font: '700 14px var(--font)', marginBottom: 10 }}>
          Eventos del {Number(d)} de {MESES[Number(m) - 1].toLowerCase()} {y}
        </div>

        {delDia.length === 0 && (
          <div style={{ font: '400 13px var(--font)', color: C.gris }}>Sin eventos este día.</div>
        )}
        {delDia.map((e) => (
          <div key={e.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
            borderBottom: `1px solid ${C.fila}`,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', flex: 'none',
              background: COLOR_EVENTO[e.tipo] || C.navy,
            }} />
            <span style={{ font: '600 12px var(--font)', color: COLOR_EVENTO[e.tipo], minWidth: 96 }}>
              {L_TIPO_EVENTO[e.tipo]}
            </span>
            <span style={{ flex: 1, minWidth: 0, font: '400 13px var(--font)' }}>{e.titulo}</span>
            {puedeEditar && (
              <button onClick={() => borrar(e.id)} style={{
                border: 0, background: 'transparent', color: C.gris,
                cursor: 'pointer', font: '400 12px var(--font)',
              }}>Eliminar</button>
            )}
          </div>
        ))}

        {error && (
          <div style={{ marginTop: 12, font: '400 12px var(--font)', color: '#7c1405' }}>
            {String(error.message || error)}
          </div>
        )}

        {puedeEditar && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {TIPOS.map((t) => {
                const on = tipo === t
                const col = COLOR_EVENTO[t]
                return (
                  <button key={t} onClick={() => setTipo(t)} style={{
                    border: `2px solid ${col}`, background: on ? col : '#fff',
                    color: on ? '#fff' : col, font: '600 12px var(--font)',
                    padding: '8px 12px', minHeight: 38, cursor: 'pointer',
                  }}>{L_TIPO_EVENTO[t]}</button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') guardar() }}
                placeholder="Descripción del evento"
                style={{
                  flex: 1, minWidth: 220, border: `2px solid ${C.borde}`,
                  padding: '10px 12px', font: '400 13px var(--font)', outline: 'none',
                }} />
              <button className="btn btn-verde" onClick={guardar}>Guardar</button>
            </div>
          </>
        )}

        <div style={{ font: '400 11px/1.5 var(--font)', color: C.gris, marginTop: 10 }}>
          Agenda mantenciones, pagos, servicios, alertas y reuniones. Los eventos quedan guardados
          en la base y los ven los cuatro usuarios.
        </div>
      </div>
    </Modal>
  )
}

const btnNav = {
  border: `2px solid ${C.borde}`, background: '#fff', width: 36, height: 36,
  cursor: 'pointer', color: C.navy, font: '700 15px var(--font)',
}
