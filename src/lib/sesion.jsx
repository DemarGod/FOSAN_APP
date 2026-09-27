import { createContext, useContext } from 'react'

export const SesionCtx = createContext({ perfil: null, usuario: null })
export const useSesion = () => useContext(SesionCtx)
export const puedeEditar = (perfil) => perfil?.rol === 'dueno'
