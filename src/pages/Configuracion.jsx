import { useEffect, useState } from 'react'
import { Aviso } from '../components/Listado'
import { perfiles, parametros, guardarParametro, modelos, guardarPesoModelo } from '../lib/api'
import { useSesion, puedeEditar, esSecretaria, nombreRol } from '../lib/sesion'
import { decimalDe } from '../lib/validar'
import { Badge, C } from '../lib/ui'

const ROLES = [
  { n: 'Dueño', d: 'Acceso total: crear, editar y eliminar en todos los módulos. Anselmo y Gonzalo.' },
  { n: 'Secretaria', d: 'Coordina la operación: clientes, despachos, rutas, calendario y mantenciones. No ve ventas, utilidades ni costos, y no cambia parámetros ni usuarios.' },
  { n: 'Solo lectura', d: 'Consulta y descarga de reportes. No puede crear, editar ni eliminar nada.' },
]

export default function Configuracion() {
  const { usuario, perfil } = useSesion()
  const [lista, setLista] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { perfiles().then(setLista).catch(setError) }, [])

  if (esSecretaria(perfil)) {
    return (
      <div>
        <h2 style={{ margin: '0 0 16px' }}>Mi perfil</h2>
        <section className="card" style={{ maxWidth: 520 }}>
          <h6>Tu sesión</h6>
          <div style={{ padding: '14px 18px', display: 'grid', gap: 8 }}>
            <Dato k="Nombre" v={perfil?.nombre || '—'} />
            <Dato k="Correo" v={usuario?.email || '—'} />
            <Dato k="Rol" v={nombreRol(perfil?.rol)} />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 4px' }}>Configuración</h2>
      <p className="text-muted" style={{ margin: '0 0 20px' }}>
        Cuatro accesos: dos dueños con control total y dos usuarios de solo lectura.
      </p>

      <Aviso error={error} />

      <div className="cols2" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24 }}>
        <section className="card">
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 18px', background: C.tinte, borderBottom: `2px solid ${C.borde}`,
          }}>
            <h6 style={{ margin: 0, color: '#1a3c72' }}>Usuarios del sistema</h6>
            <span style={{ font: '400 12px var(--font)', color: C.gris }}>
              {lista.length} acceso{lista.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="scroller">
            <table style={{ minWidth: 520 }}>
              <thead>
                <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      {u.nombre}{u.id === usuario?.id ? ' (tú)' : ''}
                    </td>
                    <td>{u.correo || '—'}</td>
                    <td>{nombreRol(u.rol)}</td>
                    <td><Badge>{u.activo === false ? 'Inactivo' : 'Activo'}</Badge></td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={4} style={{ color: C.gris }}>
                    Todavía no hay perfiles. Se crean solos al dar de alta el usuario en Supabase.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 24, alignContent: 'start' }}>
          <section className="card">
            <h6>Roles y permisos</h6>
            {ROLES.map((r) => (
              <div key={r.n} style={{ padding: '12px 18px', borderBottom: `1px solid ${C.fila}` }}>
                <div style={{ font: '600 13px var(--font)' }}>{r.n}</div>
                <div style={{ font: '400 12px/1.4 var(--font)', color: C.gris }}>{r.d}</div>
              </div>
            ))}
          </section>

          <Costos editable={puedeEditar(perfil)} />

          <section className="card">
            <h6>Tu sesión</h6>
            <div style={{ padding: '14px 18px', display: 'grid', gap: 8 }}>
              <Dato k="Nombre" v={perfil?.nombre || '—'} />
              <Dato k="Correo" v={usuario?.email || '—'} />
              <Dato k="Rol" v={nombreRol(perfil?.rol)} />
            </div>
          </section>
        </div>
      </div>
    </div>
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
    <section className="card">
      <h6>Parámetros de costo</h6>
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
          Vacíos cuentan como cero. El gasto de insumos por limpieza se define en Insumos.
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

function Dato({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{
        font: '400 11px var(--font)', color: C.gris,
        textTransform: 'uppercase', letterSpacing: '.06em',
      }}>{k}</span>
      <span style={{ font: '600 13px var(--font)', textAlign: 'right' }}>{v}</span>
    </div>
  )
}
