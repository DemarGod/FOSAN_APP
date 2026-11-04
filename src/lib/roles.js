// Roles de la app con su nombre visible (tabla roles_app, script 38).
// Dueño y Operador son fijos; Secretaria, Ejecutivo de ventas y los que cree el dueño se configuran en Roles y permisos.
// Si la tabla aún no existe se usan los 3 roles básicos.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const ROLES_BASE = [
  { clave: 'dueno', nombre: 'Dueño', revisado: true },
  { clave: 'secretaria', nombre: 'Secretaria', revisado: true },
  { clave: 'operador', nombre: 'Operador', revisado: true },
]
const ORDEN = { dueno: 0, secretaria: 1, operador: 2 }
const EVENTO = 'fosan-roles'
let cache = null
export const rolesCacheados = () => cache || ROLES_BASE

export const leerRoles = async (forzar = false) => {
  if (cache && !forzar) return cache
  const { data, error } = await supabase.from('roles_app').select('clave, nombre, base, revisado')
  cache = error || !data?.length ? ROLES_BASE
    : [...data].sort((a, b) => (ORDEN[a.clave] ?? 9) - (ORDEN[b.clave] ?? 9) || a.nombre.localeCompare(b.nombre))
  return cache
}
const avisar = async () => { await leerRoles(true); window.dispatchEvent(new Event(EVENTO)) }

export function useRoles() {
  const [r, setR] = useState(rolesCacheados())
  useEffect(() => {
    let vivo = true
    const leer = () => leerRoles().then((x) => vivo && setR([...x])).catch(() => {})
    leer()
    window.addEventListener(EVENTO, leer)
    return () => { vivo = false; window.removeEventListener(EVENTO, leer) }
  }, [])
  return r
}

// Crear un rol nuevo copiando la plantilla de otro (por defecto, Ejecutivo de ventas)
export const crearRol = async (nombre, base = 'ventas') => {
  const { data: clave, error } = await supabase.rpc('crear_rol', { p_nombre: nombre, p_base: base })
  if (error) throw error
  if (base) {
    const { error: e2 } = await supabase.rpc('copiar_permisos_rol', { p_desde: base, p_hacia: clave })
    if (e2) throw e2
  }
  await avisar()
  return clave
}
export const renombrarRol = async (clave, nombre) => {
  const { error } = await supabase.from('roles_app').update({ nombre: nombre.trim() }).eq('clave', clave)
  if (error) throw error.code === '23505' ? new Error('Ya existe un rol con ese nombre.') : error
  await avisar()
}
export const marcarRolRevisado = async (clave) => {
  const { error } = await supabase.from('roles_app').update({ revisado: true }).eq('clave', clave)
  if (error) throw error
  await avisar()
}
