import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, Icon, I } from '../lib/ui'

export default function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const entrar = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    // Se puede entrar con el correo o con el nombre de usuario (ej. ana.perez)
    let email = correo.trim()
    if (!email.includes('@')) {
      const { data } = await supabase.rpc('correo_para_login', { p_usuario: email })
      if (!data) { setCargando(false); setError('Usuario o contraseña incorrectos.'); return }
      email = data
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
    setCargando(false)
    if (error) {
      setError(/invalid/i.test(error.message)
        ? 'Usuario o contraseña incorrectos.'
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
            Gestión de baños químicos y flota
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, padding: 24 }}>
          <label className="campo">
            <span>Usuario o correo</span>
            <input type="text" required autoComplete="username" autoCapitalize="none" value={correo}
              onChange={(e) => setCorreo(e.target.value)} placeholder="ana.perez o nombre@fosan.cl" />
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input type="password" required autoComplete="current-password" value={clave}
              onChange={(e) => setClave(e.target.value)} placeholder="••••••••" />
          </label>

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

          <button type="submit" className="btn btn-verde" disabled={cargando}
            style={{ justifyContent: 'center', width: '100%' }}>
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>

          <p style={{ margin: 0, font: '400 11px/1.5 var(--font)', color: C.gris }}>
            El acceso está limitado a los correos autorizados de FOSAN. Si no puedes entrar,
            pídele a Anselmo o Gonzalo que revisen tu usuario.
          </p>
        </div>
      </form>
    </div>
  )
}
