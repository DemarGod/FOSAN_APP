import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, Icon, I } from '../lib/ui'

// Dos modos: entrar con contraseña, o crear la contraseña la primera vez
// (solo funciona si el dueño autorizó ese correo en Configuración).
export default function Login() {
  const [modo, setModo] = useState('entrar')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)
  const nuevo = modo === 'crear'

  const cambiarModo = (m) => { setModo(m); setError(''); setAviso(''); setClave(''); setClave2('') }

  const entrar = async (e) => {
    e.preventDefault()
    setError(''); setAviso('')
    const mail = correo.trim().toLowerCase()
    if (nuevo) {
      if (clave.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
      if (clave !== clave2) return setError('Las contraseñas no coinciden.')
      setCargando(true)
      const { data: ok, error: e1 } = await supabase.rpc('correo_autorizado', { p_correo: mail })
      if (e1 || !ok) {
        setCargando(false)
        return setError('Este correo no está autorizado. Pide a Anselmo o Gonzalo que lo agreguen en Configuración → Usuarios.')
      }
      const { data, error: e2 } = await supabase.auth.signUp({ email: mail, password: clave })
      setCargando(false)
      if (e2) {
        return setError(/registered|already/i.test(e2.message)
          ? 'Este correo ya tiene cuenta. Usa "Entrar" con tu contraseña.'
          : 'No se pudo crear la cuenta: ' + e2.message)
      }
      if (!data.session) {
        cambiarModo('entrar')
        setAviso('Cuenta creada. Revisa tu correo y confirma el enlace para poder entrar.')
      }
      return
    }
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password: clave })
    setCargando(false)
    if (error) {
      setError(/invalid/i.test(error.message)
        ? 'Correo o contraseña incorrectos. Si es tu primera vez, usa "Primera vez: crear mi contraseña".'
        : /confirm/i.test(error.message)
          ? 'Falta confirmar tu correo: revisa el enlace que te llegó.'
          : 'No se pudo iniciar sesión: ' + error.message)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: C.suave, padding: 20,
    }}>
      <form onSubmit={entrar} style={{
        width: 'min(420px, 100%)', background: '#fff',
        border: `2px solid ${C.navy}`,
      }}>
        <div style={{
          padding: '22px 24px', background: C.tinte,
          borderBottom: `2px solid ${C.borde}`,
        }}>
          <div style={{ font: '800 32px/1 var(--font)', letterSpacing: '-.02em', color: C.navy }}>FOSAN</div>
          <div style={{ font: '400 13px var(--font)', color: '#3c4551', marginTop: 6 }}>
            {nuevo ? 'Primera vez: crea tu contraseña' : 'Gestión de baños químicos y flota'}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, padding: 24 }}>
          <label className="campo">
            <span>Correo</span>
            <input type="email" required autoComplete="email" value={correo}
              onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@fosan.cl" />
          </label>
          <label className="campo">
            <span>{nuevo ? 'Nueva contraseña (mínimo 8 caracteres)' : 'Contraseña'}</span>
            <input type="password" required autoComplete={nuevo ? 'new-password' : 'current-password'} value={clave}
              onChange={(e) => setClave(e.target.value)} placeholder="••••••••" />
          </label>
          {nuevo && (
            <label className="campo">
              <span>Repetir contraseña</span>
              <input type="password" required autoComplete="new-password" value={clave2}
                onChange={(e) => setClave2(e.target.value)} placeholder="••••••••" />
            </label>
          )}

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
              background: '#fce8e6', border: `2px solid ${C.rojo}`,
              font: '400 12px/1.45 var(--font)', color: '#7c1405',
            }}>
              <Icon d={I.alert} size={17} color={C.rojo} />
              <span>{error}</span>
            </div>
          )}
          {aviso && (
            <div style={{
              padding: '11px 13px', background: '#e6f4ea', border: `2px solid ${C.verde}`,
              font: '400 12px/1.45 var(--font)', color: '#1e6b34',
            }}>{aviso}</div>
          )}

          <button type="submit" className="btn btn-verde" disabled={cargando}
            style={{ justifyContent: 'center', width: '100%' }}>
            {cargando ? (nuevo ? 'Creando cuenta…' : 'Entrando…') : (nuevo ? 'Crear cuenta y entrar' : 'Entrar')}
          </button>

          <button type="button" className="btn" onClick={() => cambiarModo(nuevo ? 'entrar' : 'crear')}
            style={{ justifyContent: 'center', width: '100%' }}>
            {nuevo ? 'Ya tengo contraseña: entrar' : 'Primera vez: crear mi contraseña'}
          </button>

          <p style={{ margin: 0, font: '400 11px/1.5 var(--font)', color: C.gris }}>
            El acceso está limitado a los correos autorizados de FOSAN. Si no puedes entrar,
            pídele a Anselmo o Gonzalo que agreguen tu correo en Configuración → Usuarios.
          </p>
        </div>
      </form>
    </div>
  )
}
