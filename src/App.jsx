import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { SesionCtx } from './lib/sesion'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Tabbar from './components/Tabbar'
import Calendario from './components/Calendario'
import Inicio from './pages/Inicio'
import Inventario from './pages/Inventario'
import Banos from './pages/Banos'
import Transporte from './pages/Transporte'
import Insumos from './pages/Insumos'
import Despachos from './pages/Despachos'
import Rutas from './pages/Rutas'
import Analisis from './pages/Analisis'
import Clientes from './pages/Clientes'
import Utilidades from './pages/Utilidades'
import Mantenciones from './pages/Mantenciones'
import Ubicaciones from './pages/Ubicaciones'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import Ficha from './pages/Ficha'
import { C } from './lib/ui'
import { puedeOperar, esSecretaria } from './lib/sesion'

export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [cal, setCal] = useState(false)
  const [calVersion, setCalVersion] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user || null)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sesion) => {
      setUsuario(sesion?.user || null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!usuario) { setPerfil(null); return }
    supabase.from('perfiles').select('*').eq('id', usuario.id).maybeSingle()
      .then(({ data }) => setPerfil(data || { nombre: usuario.email, rol: 'lectura' }))
  }, [usuario])

  if (cargando) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: C.gris }}>
        Cargando…
      </div>
    )
  }

  if (!usuario) return <Login />

  return (
    <SesionCtx.Provider value={{ usuario, perfil }}>
      <div className="shell">
        <Sidebar onCalendario={() => setCal(true)} />
        <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Topbar perfil={perfil} onCalendario={() => setCal(true)} version={calVersion} />
          <div className="pad">
            <Routes>
              <Route path="/" element={<Inicio onCalendario={() => setCal(true)} />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/banos" element={<Banos />} />
              <Route path="/camiones" element={<Navigate to="/transporte" replace />} />
              <Route path="/transporte" element={<Transporte />} />
              <Route path="/insumos" element={<Insumos />} />
              <Route path="/despachos" element={<Despachos />} />
              <Route path="/rutas" element={<Rutas />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/utilidades" element={esSecretaria(perfil) ? <SinAcceso /> : <Utilidades />} />
              <Route path="/mantenciones" element={<Mantenciones />} />
              <Route path="/ubicaciones" element={<Ubicaciones />} />
              <Route path="/reportes" element={esSecretaria(perfil) ? <SinAcceso /> : <Reportes />} />
              <Route path="/analisis" element={<Analisis />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/activo/:token" element={<Ficha />} />
              <Route path="*" element={<p className="text-muted">Esta página no existe.</p>} />
            </Routes>
          </div>
          <Tabbar />
        </main>
      </div>
      {cal && <Calendario puedeEditar={puedeOperar(perfil)} onCerrar={() => { setCal(false); setCalVersion((n) => n + 1) }} />}
    </SesionCtx.Provider>
  )
}

function SinAcceso() {
  return <p className="text-muted">Tu usuario no tiene acceso a esta sección.</p>
}
