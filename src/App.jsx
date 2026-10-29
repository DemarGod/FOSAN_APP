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
import Banos from './pages/Banos'
import Inventario from './pages/Inventario'
import Transporte from './pages/Transporte'
import RutasSemana from './pages/RutasSemana'
import Operaciones from './pages/Operaciones'
import MiRuta from './pages/MiRuta'
import Analisis from './pages/Analisis'
import Clientes from './pages/Clientes'
import FichaCliente from './pages/FichaCliente'
import Mantenciones from './pages/Mantenciones'
import Ubicaciones from './pages/Ubicaciones'
import Reportes from './pages/Reportes'
import Configuracion from './pages/Configuracion'
import FichaEquipo from './pages/FichaEquipo'
import Historial from './pages/Historial'
import Administracion from './pages/Administracion'
import { C } from './lib/ui'
import { puedeOperar, puedeVer, esDueno } from './lib/sesion'

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
      .then(async ({ data }) => {
        const p = data || { nombre: usuario.email, rol: 'lectura' }
        const { data: per } = await supabase.from('permisos_rol').select('*').eq('rol', p.rol)
        setPerfil({ ...p, permisos: Object.fromEntries((per || []).map((x) => [x.seccion, x])) })
      })
  }, [usuario])

  if (cargando) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: C.gris }}>
        Cargando…
      </div>
    )
  }

  if (!usuario) return <Login />
  if (!perfil) {
    return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: C.gris }}>Cargando…</div>
  }

  return (
    <SesionCtx.Provider value={{ usuario, perfil }}>
      <div className="shell">
        <Sidebar onCalendario={() => setCal(true)} />
        <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Topbar perfil={perfil} onCalendario={() => setCal(true)} version={calVersion} />
          <div className="pad">
            <Routes>
              <Route path="/" element={puedeVer(perfil, 'inicio') ? <Inicio onCalendario={() => setCal(true)} /> : <Navigate to="/mi-ruta" replace />} />
              <Route path="/inventario" element={puedeVer(perfil, 'banos') || puedeVer(perfil, 'insumos') || puedeVer(perfil, 'ubicaciones') ? <Inventario /> : <SinAcceso />} />
              <Route path="/banos" element={puedeVer(perfil, 'banos') ? <Banos /> : <SinAcceso />} />
              <Route path="/camiones" element={<Navigate to="/transporte" replace />} />
              <Route path="/transporte" element={puedeVer(perfil, 'transporte') ? <Transporte /> : <SinAcceso />} />
              <Route path="/insumos" element={<Navigate to="/inventario?tab=insumos" replace />} />
              <Route path="/operaciones" element={puedeVer(perfil, 'rutas') ? <Operaciones /> : <SinAcceso />} />
              <Route path="/rutas-semanales" element={puedeVer(perfil, 'rutas') ? <RutasSemana /> : <SinAcceso />} />
              <Route path="/mi-ruta" element={<MiRuta />} />
              <Route path="/despachos" element={<Navigate to="/rutas-semanales" replace />} />
              <Route path="/rutas" element={<Navigate to="/rutas-semanales" replace />} />
              <Route path="/clientes" element={puedeVer(perfil, 'clientes') ? <Clientes /> : <SinAcceso />} />
              <Route path="/clientes/:id" element={puedeVer(perfil, 'clientes') ? <FichaCliente /> : <SinAcceso />} />
              <Route path="/utilidades" element={<Navigate to="/analisis" replace />} />
              <Route path="/mantenciones" element={puedeVer(perfil, 'mantenciones') ? <Mantenciones /> : <SinAcceso />} />
              <Route path="/ubicaciones" element={puedeVer(perfil, 'ubicaciones') ? <Ubicaciones /> : <SinAcceso />} />
              <Route path="/reportes" element={puedeVer(perfil, 'reportes') ? <Reportes /> : <SinAcceso />} />
              <Route path="/analisis" element={puedeVer(perfil, 'analisis') ? <Analisis /> : <SinAcceso />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/historial" element={esDueno(perfil) ? <Historial /> : <SinAcceso />} />
              <Route path="/administracion" element={esDueno(perfil) ? <Administracion /> : <SinAcceso />} />
              <Route path="/activo/:token" element={<FichaEquipo />} />
              <Route path="*" element={<p className="text-muted">Esta página no existe.</p>} />
            </Routes>
          </div>
          <Tabbar />
        </main>
      </div>
      {cal && <Calendario puedeEditar={puedeOperar(perfil, 'calendario')} onCerrar={() => { setCal(false); setCalVersion((n) => n + 1) }} />}
    </SesionCtx.Provider>
  )
}

function SinAcceso() {
  return <p className="text-muted">Tu usuario no tiene acceso a esta sección.</p>
}
