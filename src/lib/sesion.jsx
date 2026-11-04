import { createContext, useContext } from 'react'

export const SesionCtx = createContext({ perfil: null, usuario: null })
export const useSesion = () => useContext(SesionCtx)

// Roles: dueno (todo) · secretaria y lectura (lo que los dueños definan en Configuración)
// perfil.permisos = { clientes: { ver, editar }, ... } cargado desde permisos_rol
export const esDueno = (perfil) => perfil?.rol === 'dueno'
export const puedeEditar = esDueno
// El operador solo usa Mi ruta y Mi perfil (no ve el resto de la app)
export const esOperador = (perfil) => perfil?.rol === 'operador'
// Mi ruta: los operadores siempre. Dueño y secretaria solo si el dueño lo activa en Administración → Roles y permisos.
export const verMiRuta = (perfil, ajustes = {}) => esOperador(perfil)
  || (esDueno(perfil) && ajustes.menu_mi_ruta_dueno === '1')
  || (perfil?.rol === 'secretaria' && ajustes.menu_mi_ruta_secretaria === '1')
// Administración: el dueño ve todo; la secretaria solo la pestaña Mi perfil. El resto ve "Mi perfil" suelto en el menú.
export const verAdministracion = (perfil) => esDueno(perfil) || perfil?.rol === 'secretaria'
export const esSecretaria = (perfil) => perfil?.rol === 'secretaria'
export const puedeVer = (perfil, sec) => esDueno(perfil) || !!perfil?.permisos?.[sec]?.ver
export const puedeOperar = (perfil, sec) => {
  if (esDueno(perfil)) return true
  if (!sec) return perfil?.rol === 'secretaria'
  const p = perfil?.permisos?.[sec]
  return !!(p?.ver && p?.editar)
}
export const verFinanzas = (perfil) => esDueno(perfil) || !!perfil?.permisos?.finanzas?.ver
// Roles de la app: solo Dueño, Secretaria y Operador. (Los antiguos se siguen mostrando con su nombre.)
export const ROLES = [
  { v: 'dueno', l: 'Dueño', d: 'Acceso total' },
  { v: 'secretaria', l: 'Secretaria', d: 'Según sus permisos' },
  { v: 'operador', l: 'Operador', d: 'Solo Mi ruta y Mi perfil' },
]
const ROLES_ANTIGUOS = { administrador: 'Administrador operacional', lectura: 'Solo lectura' }
export const nombreRol = (rol) => ROLES.find((r) => r.v === rol)?.l || ROLES_ANTIGUOS[rol] || 'Solo lectura'

export const SECCIONES = [
  { s: 'inicio', l: 'Inicio' },
  { s: 'clientes', l: 'Clientes' },
  { s: 'banos', l: 'Baños químicos' },
  { s: 'transporte', l: 'Transporte' },
  { s: 'insumos', l: 'Insumos' },
  { s: 'rutas', l: 'Rutas semanales' },
  { s: 'mantenciones', l: 'Mantenciones' },
  { s: 'ubicaciones', l: 'Mapa' },
  { s: 'calendario', l: 'Calendario' },
  { s: 'reportes', l: 'Reportes', soloVer: true },
  { s: 'analisis', l: 'Análisis', soloVer: true },
  { s: 'finanzas', l: 'Ver montos (valores, costos, ventas)', soloVer: true },
]
