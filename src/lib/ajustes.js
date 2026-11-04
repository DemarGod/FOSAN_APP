// Ajustes generales de la app (tabla "ajustes", script 37). Los lee todos; solo el dueño los cambia.
// Si la tabla aún no existe, todo queda con su valor por defecto.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const EVENTO = 'fosan-ajustes'
let cache = null
export const leerAjustes = async () => {
  if (cache) return cache
  const { data, error } = await supabase.from('ajustes').select('clave, valor')
  cache = error ? {} : Object.fromEntries((data || []).map((a) => [a.clave, a.valor]))
  return cache
}
export const guardarAjuste = async (clave, valor) => {
  const { error } = await supabase.from('ajustes').upsert({ clave, valor: String(valor), actualizado_en: new Date().toISOString() })
  if (error) throw error
  cache = { ...(cache || {}), [clave]: String(valor) }
  window.dispatchEvent(new Event(EVENTO))
}
export function useAjustes() {
  const [a, setA] = useState(cache || {})
  useEffect(() => {
    let vivo = true
    const leer = () => leerAjustes().then((x) => vivo && setA({ ...x })).catch(() => {})
    leer()
    window.addEventListener(EVENTO, leer)
    return () => { vivo = false; window.removeEventListener(EVENTO, leer) }
  }, [])
  return a
}
