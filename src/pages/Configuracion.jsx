// Mi perfil: datos de la sesión de quien entró.
// Dueño y secretaria lo ven como pestaña de Administración; el resto, como "Mi perfil" en el menú.
import { Ayuda } from '../components/Base'
import { useSesion, esDueno, nombreRol } from '../lib/sesion'
import { C } from '../lib/ui'

export default function Configuracion({ embebido = false }) {
  const { usuario, perfil } = useSesion()
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      {!embebido && <h2 style={{ margin: 0 }}>Mi perfil</h2>}
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
        ? <Ayuda>Personas, usuarios, roles y permisos (incluido mostrar "Mi ruta" en el menú) se gestionan en las otras pestañas de Administración.</Ayuda>
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
