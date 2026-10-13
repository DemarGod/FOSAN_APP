import { createContext, useContext } from 'react'

export const SesionCtx = createContext({ perfil: null, usuario: null })
export const useSesion = () => useContext(SesionCtx)

// Roles: dueno (todo) · secretaria y lectura (lo que los dueños definan en Configuración)
// perfil.permisos = { clientes: { ver, editar }, ... } cargado desde permisos_rol
export const esDueno = (perfil) => perfil?.rol === 'dueno'
export const puedeEditar = esDueno
export const esSecretaria = (perfil) => perfil?.rol === 'secretaria'
export const puedeVer = (perfil, sec) => esDueno(perfil) || !!perfil?.permisos?.[sec]?.ver
export const puedeOperar = (perfil, sec) => {
  if (esDueno(perfil)) return true
  if (!sec) return perfil?.rol === 'secretaria'
  const p = perfil?.permisos?.[sec]
  return !!(p?.ver && p?.editar)
}
export const verFinanzas = (perfil) => esDueno(perfil) || !!perfil?.permisos?.finanzas?.ver
export const nombreRol = (rol) => ({ dueno: 'Dueño', secretaria: 'Secretaria', lectura: 'Solo lectura' }[rol] || 'Solo lectura')

export const SECCIONES = [
  { s: 'inicio', l: 'Inicio' },
  { s: 'clientes', l: 'Clientes' },
  { s: 'banos', l: 'Baños químicos' },
  { s: 'transporte', l: 'Transporte' },
  { s: 'insumos', l: 'Insumos' },
  { s: 'despachos', l: 'Despachos y retiros' },
  { s: 'rutas', l: 'Rutas' },
  { s: 'mantenciones', l: 'Mantenciones' },
  { s: 'ubicaciones', l: 'Mapa' },
  { s: 'calendario', l: 'Calendario' },
  { s: 'utilidades', l: 'Utilidades y ventas', soloVer: true },
  { s: 'reportes', l: 'Reportes', soloVer: true },
  { s: 'analisis', l: 'Análisis', soloVer: true },
  { s: 'finanzas', l: 'Ver montos (valores, costos, ventas)', soloVer: true },
]
