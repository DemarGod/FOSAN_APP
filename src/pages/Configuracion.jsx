// Mi perfil: datos de la sesión de quien entró.
// Dueño y secretaria lo ven como pestaña de Administración; el resto, como "Mi perfil" en el menú.
// El dueño además ve "Preferencias del menú" (ajustes generales).
import { useState } from 'react'
import { Ayuda } from '../components/Base'
import { useSesion, esDueno, nombreRol } from '../lib/sesion'
import { useAjustes, guardarAjuste } from '../lib/ajustes'
import { C } from '../lib/ui'

export default function Configuracion({ embebido = false }) {
  const { usuario, perfil } = useSesion()
  const ajustes = useAjustes()
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const miRuta = ajustes.menu_mi_ruta_dueno === '1'
  const cambiarMiRuta = async (on) => {
    setGuardando(true); setError(null)
    try { await guardarAjuste('menu_mi_ruta_dueno', on ? '1' : '0') } catch (x) { setError(x) }
    setGuardando(false)
  }
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
      {esDueno(perfil) ? (
        <section className="card">
          <h6>Preferencias del menú</h6>
          <div style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', font: '400 14px/1.45 var(--font)' }}>
              <input type="checkbox" checked={miRuta} disabled={guardando} onChange={(e) => cambiarMiRuta(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
              <span><b>Mostrar "Mi ruta" en mi menú</b><br /><span style={{ color: C.gris }}>Sirve para ver la ruta de un operador ("Ver como operador"). Los operadores siempre la ven. Por defecto está desactivado.</span></span>
            </label>
            {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
          </div>
        </section>
      ) : <Ayuda>Para cambiar tu contraseña, tu rol o tus datos, pídeselo al dueño.</Ayuda>}
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
