import { useEffect, useState } from 'react'
import { Aviso } from '../components/Listado'
import { perfiles } from '../lib/api'
import { useSesion } from '../lib/sesion'
import { Badge, C } from '../lib/ui'

const ROLES = [
  { n: 'Dueño', d: 'Acceso total: crear, editar y eliminar en todos los módulos. Anselmo y Gonzalo.' },
  { n: 'Solo lectura', d: 'Consulta y descarga de reportes. No puede crear, editar ni eliminar nada.' },
]

export default function Configuracion() {
  const { usuario, perfil } = useSesion()
  const [lista, setLista] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => { perfiles().then(setLista).catch(setError) }, [])

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
                    <td>{u.rol === 'dueno' ? 'Dueño' : 'Solo lectura'}</td>
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

          <section className="card">
            <h6>Tu sesión</h6>
            <div style={{ padding: '14px 18px', display: 'grid', gap: 8 }}>
              <Dato k="Nombre" v={perfil?.nombre || '—'} />
              <Dato k="Correo" v={usuario?.email || '—'} />
              <Dato k="Rol" v={perfil?.rol === 'dueno' ? 'Dueño' : 'Solo lectura'} />
            </div>
          </section>
        </div>
      </div>
    </div>
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
