import { createContext, useContext } from 'react'

export const SesionCtx = createContext({ perfil: null, usuario: null })
export const useSesion = () => useContext(SesionCtx)

// Roles: dueno (todo) · secretaria (coordina la operación, sin finanzas) · lectura (solo consulta)
export const puedeEditar = (perfil) => perfil?.rol === 'dueno'
export const esSecretaria = (perfil) => perfil?.rol === 'secretaria'
export const puedeOperar = (perfil) => perfil?.rol === 'dueno' || perfil?.rol === 'secretaria'
export const verFinanzas = (perfil) => perfil?.rol === 'dueno' || perfil?.rol === 'lectura'
export const nombreRol = (rol) => ({ dueno: 'Dueño', secretaria: 'Secretaria', lectura: 'Solo lectura' }[rol] || 'Solo lectura')
