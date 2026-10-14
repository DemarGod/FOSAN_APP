import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { parametros, guardarParametro, modelos, guardarPesoModelo } from '../lib/api'
import { supabase } from '../lib/supabase'
import { costoKmVehiculo, costoServicioBano, mapaParametros } from '../lib/costos'
import { decimalDe } from '../lib/validar'
import { C, clp } from '../lib/ui'

// Modelo de costo del camión: Costo/km = fijos/km + variables/km + personal/km
const SECCIONES = [
  { t: 'Combustible', claves: ['diesel_litro', 'rend_ref'], km: (k) => [['Combustible', k.combustible]],
    nota: 'Se usa el rendimiento del vehículo si lo tiene; si no, el de referencia.' },
  { t: 'Neumáticos', claves: ['neum_cantidad', 'neum_precio', 'neum_vida_km'], km: (k) => [['Neumáticos', k.neumaticos]] },
  { t: 'Aceite y filtros', claves: ['aceite_costo', 'aceite_cada_km'], km: (k) => [['Aceite', k.aceite]] },
  { t: 'Frenos', claves: ['frenos_costo', 'frenos_vida_km'], km: (k) => [['Frenos', k.frenos]] },
  { t: 'Amortiguadores', claves: ['amort_costo', 'amort_vida_km'], km: (k) => [['Suspensión', k.amortiguadores]] },
  { t: 'Mantención preventiva', claves: ['mant_prev_costo', 'mant_prev_cada_km'], km: (k) => [['Mantención', k.preventiva]],
    nota: 'Correas, batería, suspensión, rodamientos, bujes y revisión eléctrica.' },
  { t: 'Depreciación', claves: ['dep_valor_compra', 'dep_valor_residual', 'dep_vida_anos'], km: (k) => [['Depreciación', k.depreciacion]],
    nota: '(Valor compra − residual) ÷ vida útil ÷ km al año.' },
  { t: 'Fijos anuales', claves: ['km_anual', 'permiso_anual', 'seguro_anual', 'revision_anual'],
    km: (k) => [['Permiso', k.permiso], ['Seguro', k.seguro], ['Revisión', k.revision]] },
  { t: 'Conductor', claves: ['conductor_sueldo'], km: (k) => [['Conductor', k.conductor]], nota: 'Sueldo × 12 ÷ km al año.' },
  { t: 'Servicio de baños', claves: ['agua_bano', 'estanque_agua', 'estanque_grises', 'litros_limpieza', 'densidad_residuo', 'agua_litro', 'residuo_litro'] },
]
const USADAS = new Set(SECCIONES.flatMap((s) => s.claves))

const fmt = (v, d = 0) => (v ? v.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d }) : '0')
const kmL = (v) => '$' + fmt(v, v && v < 100 ? 2 : 1)

export default function ParametrosCosto({ editable, onCerrar }) {
  return (
    <Modal titulo="Parámetros de costo" ancho={760} onCerrar={onCerrar} pie={<button className="btn" onClick={onCerrar}>Cerrar</button>}>
      <Costos editable={editable} />
    </Modal>
  )
}

function Costos({ editable }) {
  const [pars, setPars] = useState([])
  const [mods, setMods] = useState([])
  const [limpieza, setLimpieza] = useState(0)
  const [msg, setMsg] = useState(null)
  const [sim, setSim] = useState({ km: '100', banos: '20' })
  useEffect(() => {
    parametros().then(setPars).catch(setMsg)
    modelos().then(setMods).catch(setMsg)
    Promise.all([supabase.from('receta_limpieza').select('*'), supabase.from('insumos').select('id, costo_unitario')])
      .then(([r, i]) => {
        const cu = Object.fromEntries((i.data || []).map((x) => [x.id, Number(x.costo_unitario) || 0]))
        setLimpieza((r.data || []).reduce((s, x) => s + Number(x.cantidad || 0) * (cu[x.insumo_id] || 0), 0))
      }).catch(() => {})
  }, [])

  const par = useMemo(() => mapaParametros(pars), [pars])
  const k = useMemo(() => costoKmVehiculo({}, par), [par])
  const serv = costoServicioBano(par)
  const porClave = Object.fromEntries(pars.map((p) => [p.clave, p]))
  const otros = pars.filter((p) => !USADAS.has(p.clave))

  const guardarPar = async (clave, texto) => {
    try {
      const valor = decimalDe(texto)
      await guardarParametro(clave, valor)
      setPars((ps) => ps.map((p) => (p.clave === clave ? { ...p, valor } : p)))
      setMsg('Guardado.')
    } catch (e) { setMsg(e) }
  }
  const guardarPeso = async (id, texto) => {
    try { await guardarPesoModelo(id, decimalDe(texto)); setMsg('Guardado.') } catch (e) { setMsg(e) }
  }

  const km = Number(String(sim.km).replace(',', '.')) || 0
  const banos = Number(String(sim.banos).replace(',', '.')) || 0
  const viajeVeh = k.total * km
  const viajeBanos = banos * (serv.total + limpieza)
  const viaje = viajeVeh + viajeBanos
  const porCarga = par.agua_bano ? Math.floor((par.estanque_agua ?? 200) / par.agua_bano) : null

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 0 }}>
      <div style={{ padding: '14px 18px', display: 'grid', gap: 12, alignContent: 'start', borderRight: `2px solid ${C.borde}` }}>
        {SECCIONES.map((s) => {
          const filas = s.claves.map((c) => porClave[c]).filter(Boolean)
          if (!filas.length) return null
          const sub = s.km ? s.km(k).reduce((t, [, v]) => t + v, 0) : null
          return (
            <div key={s.t} style={{ display: 'grid', gap: 8 }}>
              <Titulo derecha={sub !== null ? kmL(sub) + '/km' : null}>{s.t}</Titulo>
              {filas.map((p) => (
                <Numero key={p.clave} etiqueta={p.etiqueta} unidad={p.unidad} valor={p.valor} editable={editable}
                  onGuardar={(t) => guardarPar(p.clave, t)} />
              ))}
              {s.nota && <Nota>{s.nota}</Nota>}
              {s.t === 'Servicio de baños' && (
                <Nota>
                  Por baño: agua {clp(Math.round(serv.agua))} + residuo {clp(Math.round(serv.residuo))}
                  {limpieza ? ` + insumos ${clp(Math.round(limpieza))}` : ''}.
                  {porCarga ? ` Alcanza para ${porCarga} baños por carga de agua.` : ''}
                </Nota>
              )}
            </div>
          )
        })}
        {otros.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            <Titulo>Otros</Titulo>
            {otros.map((p) => (
              <Numero key={p.clave} etiqueta={p.etiqueta} unidad={p.unidad} valor={p.valor} editable={editable}
                onGuardar={(t) => guardarPar(p.clave, t)} />
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          <Titulo>Peso vacío por modelo de baño</Titulo>
          {mods.map((m) => (
            <Numero key={m.id} etiqueta={m.nombre} unidad="kg" valor={m.peso_kg} editable={editable}
              onGuardar={(t) => guardarPeso(m.id, t)} />
          ))}
        </div>
        <Nota>
          {editable ? 'Los cambios se guardan al salir de cada casilla. ' : 'Solo los dueños pueden cambiar estos valores. '}
          Vacíos cuentan como cero. Si un vehículo tiene en Transporte su propio rendimiento, mantención por km, valor de compra o costo fijo anual, esos valores reemplazan a los generales. El gasto de insumos por limpieza se define en Insumos.
        </Nota>
        {msg && <div style={{ font: '600 12px var(--font)', color: typeof msg === 'string' ? C.verde : C.rojo }}>
          {typeof msg === 'string' ? msg : String(msg.message || msg)}
        </div>}
      </div>

      <div style={{ padding: '14px 18px', display: 'grid', gap: 16, alignContent: 'start' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <Titulo>Costo por km del camión</Titulo>
          <div style={{ border: `2px solid ${C.borde}` }}>
            {SECCIONES.filter((s) => s.km).flatMap((s) => s.km(k)).map(([l, v]) => <Fila key={l} k={l} v={kmL(v)} />)}
            <Fila k="Total" v={kmL(k.total) + '/km'} fuerte />
          </div>
          <Nota>Fijos {kmL(k.fijos + k.depreciacion)}/km · variables {kmL(k.combustible + k.mantencion)}/km · personal {kmL(k.conductor)}/km.</Nota>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <Titulo>Simular un viaje</Titulo>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Mini etiqueta="Kilómetros" valor={sim.km} onCambio={(v) => setSim((s) => ({ ...s, km: v }))} />
            <Mini etiqueta="Baños atendidos" valor={sim.banos} onCambio={(v) => setSim((s) => ({ ...s, banos: v }))} />
          </div>
          <div style={{ border: `2px solid ${C.borde}` }}>
            <Fila k={`Camión · ${fmt(km)} km × ${kmL(k.total)}`} v={clp(Math.round(viajeVeh))} />
            <Fila k={`Baños · ${fmt(banos)} × ${clp(Math.round(serv.total + limpieza))}`} v={clp(Math.round(viajeBanos))} />
            <Fila k="Costo del viaje" v={clp(Math.round(viaje))} fuerte />
            <Fila k="Costo por baño" v={banos ? clp(Math.round(viaje / banos)) : '—'} fuerte />
          </div>
          <Nota>Estimación sin ajuste por peso; el costo real de cada salida usa el vehículo y la carga del día.</Nota>
        </div>
      </div>
    </section>
  )
}

const Titulo = ({ children, derecha }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: '700 11px var(--font)', textTransform: 'uppercase', letterSpacing: '.06em', color: C.gris, paddingTop: 8, borderTop: `2px solid ${C.borde}` }}>
    <span>{children}</span>{derecha && <span style={{ color: C.navy }}>{derecha}</span>}
  </div>
)
const Nota = ({ children }) => <div style={{ font: '400 12px/1.45 var(--font)', color: C.gris }}>{children}</div>
const Fila = ({ k, v, fuerte }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', borderTop: fuerte ? `2px solid ${C.borde}` : undefined, font: `${fuerte ? 700 : 400} 13px var(--font)` }}>
    <span>{k}</span><span style={{ whiteSpace: 'nowrap' }}>{v}</span>
  </div>
)

function Mini({ etiqueta, valor, onCambio }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ font: '400 12px var(--font)', color: C.gris }}>{etiqueta}</span>
      <input value={valor} inputMode="decimal" onChange={(e) => onCambio(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 7))}
        style={{ border: `2px solid ${C.borde}`, outline: 'none', padding: '8px', font: '600 13px var(--font)', textAlign: 'right', minWidth: 0 }} />
    </label>
  )
}

function Numero({ etiqueta, unidad, valor, editable, onGuardar }) {
  const original = valor === null || valor === undefined ? '' : String(valor).replace('.', ',')
  const [t, setT] = useState(original)
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 44px', gap: 8, alignItems: 'center' }}>
      <span style={{ font: '400 13px var(--font)' }}>{etiqueta}</span>
      <span style={{ display: 'flex', alignItems: 'center', border: `2px solid ${C.borde}`, background: '#fff' }}>
        <input value={t} disabled={!editable} inputMode="decimal" placeholder="—"
          onChange={(e) => setT(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 12))}
          onBlur={() => t !== original && onGuardar(t)}
          style={{ width: '100%', minWidth: 0, border: 0, outline: 'none', padding: '8px 8px', font: '600 13px var(--font)', textAlign: 'right' }} />
      </span>
      <span style={{ font: '400 12px var(--font)', color: C.gris }}>{unidad}</span>
    </label>
  )
}
