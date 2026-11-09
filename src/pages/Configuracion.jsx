// Mi perfil: datos de la sesión de quien entró y cambio de la propia contraseña.
// Dueño y secretaria lo ven como pestaña de Administración; el resto, como "Mi perfil" en el menú.
import { useState } from 'react'
import { Ayuda, Boton } from '../components/Base'
import Modal from '../components/Modal'
import { Clave } from '../components/AdminPersonal'
import { useSesion, esDueno, nombreRol } from '../lib/sesion'
import { cambiarMiClave } from '../lib/api'
import { C, I } from '../lib/ui'

export default function Configuracion({ embebido = false }) {
  const { usuario, perfil } = useSesion()
  const [clave, setClave] = useState(false)
  const [listo, setListo] = useState(false)
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
        <div style={{ padding: '0 18px 16px', display: 'grid', gap: 10 }}>
          <div><Boton icono={I.lapiz} onClick={() => { setListo(false); setClave(true) }}>Cambiar mi contraseña</Boton></div>
          {listo && <Ayuda>Contraseña cambiada. La próxima vez entra con la nueva.</Ayuda>}
        </div>
      </section>
      {clave && <CambiarClave correo={usuario?.email} onCerrar={() => setClave(false)} onListo={() => { setClave(false); setListo(true) }} />}
      {esDueno(perfil)
        ? <Ayuda>Personas, usuarios, roles y permisos (incluido mostrar "Mi ruta" en el menú) se gestionan en las otras pestañas de Administración. Si alguien olvidó su contraseña, asígnale una nueva en Personal → Gestionar acceso.</Ayuda>
        : <Ayuda>Para cambiar tu rol o tus datos, pídeselo al dueño. Si olvidaste tu contraseña, el dueño te puede asignar una nueva.</Ayuda>}
    </div>
  )
}

// Cambiar la propia contraseña (pide la actual)
function CambiarClave({ correo, onCerrar, onListo }) {
  const [v, setV] = useState({ actual: '', nueva: '', repetir: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (x) => { setV((p) => ({ ...p, [k]: x })); setErrores({}); setError(null) }
  const guardar = async () => {
    const e = {}
    if (!v.actual) e.actual = 'Escribe tu contraseña actual.'
    if (v.nueva.length < 8) e.nueva = 'Mínimo 8 caracteres.'
    else if (v.nueva === v.actual) e.nueva = 'Debe ser distinta de la actual.'
    if (v.nueva !== v.repetir) e.repetir = 'Las contraseñas no coinciden.'
    setErrores(e)
    if (Object.keys(e).length) return
    setGuardando(true)
    try { await cambiarMiClave(correo, v.actual, v.nueva); onListo() } catch (x) { setError(x); setGuardando(false) }
  }
  return (
    <Modal titulo="Cambiar mi contraseña" ancho={460} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Cambiar contraseña'}</Boton>
    </>}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <Clave etiqueta="Contraseña actual" valor={v.actual} onChange={set('actual')} error={errores.actual} />
        <Clave etiqueta="Nueva contraseña (mínimo 8 caracteres)" valor={v.nueva} onChange={set('nueva')} error={errores.nueva} />
        <Clave etiqueta="Repetir nueva contraseña" valor={v.repetir} onChange={set('repetir')} error={errores.repetir} />
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
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
