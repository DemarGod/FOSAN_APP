import { useEffect, useState } from 'react'
import Modal from './Modal'
import { parametros, guardarParametro, modelos, guardarPesoModelo } from '../lib/api'
import { decimalDe } from '../lib/validar'
import { C } from '../lib/ui'

export default function ParametrosCosto({ editable, onCerrar }) {
  return (
    <Modal titulo="Parámetros de costo" ancho={560} onCerrar={onCerrar} pie={<button className="btn" onClick={onCerrar}>Cerrar</button>}>
      <Costos editable={editable} />
    </Modal>
  )
}

// Parámetros que usan las rutas para calcular el costo de cada salida
function Costos({ editable }) {
  const [pars, setPars] = useState([])
  const [mods, setMods] = useState([])
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    parametros().then(setPars).catch(setMsg)
    modelos().then(setMods).catch(setMsg)
  }, [])

  const guardar = async (fn, id, texto) => {
    try { await fn(id, decimalDe(texto)); setMsg('Guardado.') } catch (e) { setMsg(e) }
  }

  return (
    <section>
      <div style={{ padding: '14px 18px', display: 'grid', gap: 12 }}>
        {pars.map((p) => (
          <Numero key={p.clave} etiqueta={p.etiqueta} unidad={p.unidad} valor={p.valor} editable={editable}
            onGuardar={(t) => guardar(guardarParametro, p.clave, t)} />
        ))}
        <div style={{ font: '700 11px var(--font)', textTransform: 'uppercase', letterSpacing: '.06em', color: C.gris, paddingTop: 6, borderTop: `2px solid ${C.borde}` }}>
          Peso vacío por modelo de baño
        </div>
        {mods.map((m) => (
          <Numero key={m.id} etiqueta={m.nombre} unidad="kg" valor={m.peso_kg} editable={editable}
            onGuardar={(t) => guardar(guardarPesoModelo, m.id, t)} />
        ))}
        <div style={{ font: '400 12px/1.45 var(--font)', color: C.gris }}>
          {editable ? 'Los cambios se guardan al salir de cada casilla. ' : 'Solo los dueños pueden cambiar estos valores. '}Vacíos cuentan como cero. El gasto de insumos por limpieza se define en Insumos.
        </div>
        {msg && <div style={{ font: '600 12px var(--font)', color: typeof msg === 'string' ? C.verde : C.rojo }}>
          {typeof msg === 'string' ? msg : String(msg.message || msg)}
        </div>}
      </div>
    </section>
  )
}

function Numero({ etiqueta, unidad, valor, editable, onGuardar }) {
  const [t, setT] = useState(valor === null || valor === undefined ? '' : String(valor).replace('.', ','))
  const original = valor === null || valor === undefined ? '' : String(valor).replace('.', ',')
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px auto', gap: 8, alignItems: 'center' }}>
      <span style={{ font: '400 13px var(--font)' }}>{etiqueta}</span>
      <span style={{ display: 'flex', alignItems: 'center', border: `2px solid ${C.borde}`, background: '#fff' }}>
        <input value={t} disabled={!editable} inputMode="decimal" placeholder="—"
          onChange={(e) => setT(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10))}
          onBlur={() => t !== original && onGuardar(t)}
          style={{ width: '100%', minWidth: 0, border: 0, outline: 'none', padding: '8px 8px', font: '600 13px var(--font)', textAlign: 'right' }} />
      </span>
      <span style={{ font: '400 12px var(--font)', color: C.gris, minWidth: 34 }}>{unidad}</span>
    </label>
  )
}

