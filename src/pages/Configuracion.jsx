// Mi perfil: datos de la sesión de quien entró.
// Usuarios, roles y permisos se gestionan en Administración (solo el dueño).
import { useNavigate } from 'react-router-dom'
import { Boton, Ayuda } from '../components/Base'
import { useSesion, esDueno, nombreRol } from '../lib/sesion'
import { C } from '../lib/ui'

export default function Configuracion() {
  const { usuario, perfil } = useSesion()
  const navegar = useNavigate()
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <h2 style={{ margin: 0 }}>Mi perfil</h2>
      <section className="card">
        <h6>Tu sesión</h6>
        <div style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
          <Dato k="Nombre" v={perfil?.nombre || '—'} />
          <Dato k="Usuario" v={perfil?.usuario || '—'} />
          <Dato k="Correo" v={usuario?.email || '—'} />
          <Dato k="Rol" v={nombreRol(perfil?.rol)} />
        </div>
      </section>
      {esDueno(perfil)
        ? (
          <Ayuda>
            Las personas, usuarios, roles y permisos se gestionan en Administración.{' '}
            <Boton tipo="principal" onClick={() => navegar('/administracion')} style={{ minHeight: 32, padding: '4px 12px', marginLeft: 6 }}>Ir a Administración</Boton>
          </Ayuda>
        )
        : <Ayuda>Para cambiar tu contraseña, tu rol o tus datos, pídeselo al dueño.</Ayuda>}
    </div>
  )
}

function Dato({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ font: '400 13px var(--font)', color: C.gris }}>{k}</span>
      <span style={{ font: '600 14px var(--font)', textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</span>
    </div>
  )
}
