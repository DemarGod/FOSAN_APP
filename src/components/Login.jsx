// Acceso privado FOSAN. La lógica de autenticación es la de siempre:
// usuario o correo → correo_para_login (si es usuario) → supabase.auth.signInWithPassword.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { C, Icon, I } from '../lib/ui'
import { MarcaFosan } from './Sidebar'

const CANDADO = 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11M12 15v2.5'
const ESCUDO = 'M12 2.5 4.5 5.5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10v-6zM9.5 11h5v5h-5zM10.5 11V9.5a1.5 1.5 0 0 1 3 0V11'
const PERSONA = 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0'
const OJO_NO = 'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.6A16.6 16.6 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4.6-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2'

export default function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [ver, setVer] = useState(false)
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
    <div className="login-fondo">
      <Ondas />
      <header className="login-cabecera">
        <MarcaFosan tam={34} tamTexto={26} />
        <span className="login-pastilla"><Icon d={CANDADO} size={14} w={2} color={C.azulClaro} /> Acceso privado</span>
      </header>

      <main className="login-cuerpo">
        <section className="login-hero">
          <h1>Gestión Inteligente.<br /><span>Operación bajo control.</span></h1>
          <p>Software de gestión para baños químicos, flota y operaciones.</p>
        </section>

        <form onSubmit={entrar} className="login-tarjeta">
          <div style={{ display: 'grid', justifyItems: 'center', gap: 8, textAlign: 'center' }}>
            <span className="login-escudo"><Icon d={ESCUDO} size={30} w={1.6} color={C.azulClaro} /></span>
            <h2 style={{ margin: 0, fontSize: 22, lineHeight: '28px' }}>Bienvenido a FOSAN</h2>
            <span style={{ font: '400 13px var(--font)', color: C.gris }}>Ingresa tus credenciales para acceder al sistema.</span>
          </div>

          <label className="campo">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon d={PERSONA} size={16} color={C.gris} /> Usuario o correo</span>
            <input type="text" required autoComplete="username" autoCapitalize="none" value={correo}
              onChange={(e) => setCorreo(e.target.value)} placeholder="ana.perez o nombre@fosan.cl" />
          </label>
          <label className="campo">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon d={CANDADO} size={16} color={C.gris} /> Contraseña</span>
            <div style={{ position: 'relative' }}>
              <input type={ver ? 'text' : 'password'} required autoComplete="current-password" value={clave}
                onChange={(e) => setClave(e.target.value)} placeholder="••••••••" style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setVer((x) => !x)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', color: C.gris, padding: 6, display: 'flex' }}>
                <Icon d={ver ? OJO_NO : I.ojo} size={18} />
              </button>
            </div>
          </label>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
              background: 'rgba(239,98,93,.12)', border: `1px solid rgba(239,98,93,.5)`,
              font: '400 13px/1.45 var(--font)', color: '#FCA5A5', borderRadius: 10 }}>
              <Icon d={I.alert} size={17} color={C.rojo} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-azul" disabled={cargando}
            style={{ justifyContent: 'center', width: '100%', minHeight: 48, fontSize: 15 }}>
            {cargando ? 'Entrando…' : <>Ingresar al sistema <span aria-hidden="true">→</span></>}
          </button>

          <p style={{ margin: 0, font: '400 12px/1.5 var(--font)', color: C.gris, textAlign: 'center', borderTop: `1px solid ${C.borde}`, paddingTop: 14 }}>
            Acceso exclusivo para personal autorizado de FOSAN. Si no puedes entrar,
            pídele a Anselmo o Gonzalo que revisen tu usuario.
          </p>
        </form>
      </main>

      <footer className="login-pie">FOSAN · Sistema de gestión empresarial</footer>
    </div>
  )
}

// Líneas abstractas azules y discretas del fondo (SVG, sin imágenes externas ni brillos)
function Ondas() {
  return (
    <svg className="login-ondas" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="onda-a" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3989E8" stopOpacity="0" />
          <stop offset=".5" stopColor="#58A9F5" stopOpacity=".55" />
          <stop offset="1" stopColor="#3989E8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: 9 }, (_, i) => (
        <path key={i} fill="none" stroke="url(#onda-a)" strokeWidth={i % 3 === 0 ? 1.4 : 0.8} opacity={0.25 + (i % 3) * 0.1}
          d={`M-50 ${560 + i * 22} C 300 ${420 + i * 18}, 620 ${760 - i * 10}, 980 ${560 + i * 12} S 1400 ${380 + i * 20}, 1500 ${470 + i * 16}`} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <path key={'b' + i} fill="none" stroke="url(#onda-a)" strokeWidth="0.8" opacity=".2"
          d={`M-50 ${180 + i * 26} C 400 ${120 + i * 30}, 900 ${300 - i * 12}, 1500 ${140 + i * 24}`} />
      ))}
    </svg>
  )
}
