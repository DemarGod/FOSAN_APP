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
export const ROLES = [
  { v: 'dueno', l: 'Dueño', d: 'Acceso total' },
  { v: 'administrador', l: 'Administrador operacional', d: 'Gestión diaria' },
  { v: 'secretaria', l: 'Secretaria', d: 'Información administrativa' },
  { v: 'operador', l: 'Operador', d: 'Solo tareas asignadas' },
  { v: 'lectura', l: 'Solo lectura', d: 'Consulta' },
]
export const nombreRol = (rol) => ROLES.find((r) => r.v === rol)?.l || 'Solo lectura'

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
