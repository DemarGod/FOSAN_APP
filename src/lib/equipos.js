// Características especiales de un equipo: con arnés y VIP (script 47). Se marcan en la ficha del equipo
// y se muestran donde se eligen o listan unidades, para encontrarlas cuando un cliente las pide.
export const CARACTERISTICAS = [
  { k: 'con_arnes', l: 'Con arnés', corto: 'Arnés' },
  { k: 'vip', l: 'VIP', corto: 'VIP' },
]
// ['Arnés', 'VIP'] según lo que tenga marcado el equipo
export const marcasDe = (e) => CARACTERISTICAS.filter((c) => e?.[c.k]).map((c) => c.corto)
// Texto para pegar al número de unidad: ' · Arnés · VIP' (vacío si no tiene)
export const sufijoMarcas = (e) => marcasDe(e).map((m) => ` · ${m}`).join('')

// Casillas (Con arnés, VIP…) del mismo tamaño: los estilos de .campo input las agrandaban de forma dispareja
export const CASILLA = { width: 18, height: 18, minHeight: 0, minWidth: 18, padding: 0, margin: 0, flex: 'none' }
