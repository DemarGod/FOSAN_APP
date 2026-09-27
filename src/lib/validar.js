// Formatos y validaciones de los formularios.

// RUT chileno: 12.345.678-9 con dígito verificador
export function formatoRut(s) {
  const t = String(s || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (!t) return ''
  const dv = t.slice(-1)
  const cuerpo = t.slice(0, -1).replace(/\D/g, '').slice(0, 8)
  if (!cuerpo) return dv
  return cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}
export function rutValido(s) {
  const t = String(s || '').replace(/[^0-9kK]/g, '').toUpperCase()
  if (!/^\d{7,8}[0-9K]$/.test(t)) return false
  const cuerpo = t.slice(0, -1), dv = t.slice(-1)
  let suma = 0, m = 2
  for (let i = cuerpo.length - 1; i >= 0; i--) { suma += Number(cuerpo[i]) * m; m = m === 7 ? 2 : m + 1 }
  const r = 11 - (suma % 11)
  return (r === 11 ? '0' : r === 10 ? 'K' : String(r)) === dv
}

// Teléfono: +56 9 1234 5678
export function formatoTel(s) {
  let d = String(s || '').replace(/\D/g, '')
  if (d.startsWith('56')) d = d.slice(2)
  d = d.slice(0, 9)
  if (!d) return ''
  let out = '+56 ' + d.slice(0, 1)
  if (d.length > 1) out += ' ' + d.slice(1, 5)
  if (d.length > 5) out += ' ' + d.slice(5, 9)
  return out
}
export const telValido = (s) => /^\+56 9 \d{4} \d{4}$/.test(s)

export const correoValido = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim())

// Montos en pesos: "$540.000"
export const soloDigitos = (s) => String(s ?? '').replace(/\D/g, '')
export function formatoPesos(s) {
  const d = soloDigitos(s).slice(0, 12)
  return d ? '$' + Number(d).toLocaleString('es-CL') : ''
}
export const numeroDe = (s) => {
  const d = soloDigitos(s)
  return d ? Number(d) : null
}
// Decimales con coma o punto: "7,5" → 7.5
export const decimalDe = (s) => {
  const t = String(s ?? '').replace(',', '.').replace(/[^0-9.]/g, '')
  return t === '' || isNaN(Number(t)) ? null : Number(t)
}

// Fechas: año de 4 dígitos entre 2000 y 2100
export const FECHA_MIN = '2000-01-01'
export const FECHA_MAX = '2100-12-31'
export const fechaValida = (s) => !s || (/^\d{4}-\d{2}-\d{2}$/.test(s) && s >= FECHA_MIN && s <= FECHA_MAX)

// Código de unidad: letras y números (máximo 10) más guiones, que no cuentan. Ej. BQ-063
export function limpiarCodigo(s) {
  const t = String(s || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-/, '')
  let n = 0, out = ''
  for (const ch of t) {
    if (ch === '-') { out += ch; continue }
    if (n >= 10) continue
    out += ch; n++
  }
  return out
}
export const codigoValido = (s) => {
  const t = String(s || '')
  const n = t.replace(/-/g, '').length
  return /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(t) && n >= 2 && n <= 10
}
