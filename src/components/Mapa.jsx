import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { C } from '../lib/ui'

export const COLORES = {
  arriendo: C.verde,
  mantencion: C.amarillo,
  limpieza1: '#7fb3ff',   // 1 limpieza por semana
  limpieza2: '#1a4fb4',   // 2 o más por semana
  bodega: C.tinta,
  otro: '#9aa3ad',
}

// Color por defecto (sin datos de limpieza)
export const colorPunto = (p) => {
  if (Number(p.en_mantencion) > 0 || p.tipo === 'taller') return COLORES.mantencion
  if (p.tipo === 'bodega') return COLORES.bodega
  if (Number(p.en_arriendo ?? p.banos) > 0) return COLORES.arriendo
  return COLORES.otro
}

export const LEYENDA = [
  { l: 'Arrendados', c: COLORES.arriendo },
  { l: 'En mantención', c: COLORES.mantencion },
  { l: 'Limpieza · 1 por semana', c: COLORES.limpieza1 },
  { l: 'Limpieza · 2 o más', c: COLORES.limpieza2 },
  { l: 'Bodega', c: COLORES.bodega },
]

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/**
 * Mapa Leaflet. Se puede navegar libremente; con `onClickMapa` un clic en
 * cualquier parte devuelve {lat, lng}. `pendiente` dibuja el punto elegido.
 */
export default function Mapa({
  puntos = [], alto = 320, zoom = 8, centrarEn = null,
  color = colorPunto, detalle, onClickMapa, pendiente = null,
}) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const grupo = useRef(null)
  const marcaPendiente = useRef(null)
  const marcas = useRef({})
  const encuadrado = useRef(false)
  const clic = useRef(onClickMapa)
  clic.current = onClickMapa

  useEffect(() => {
    if (!caja.current || mapa.current) return
    const m = L.map(caja.current, { scrollWheelZoom: true }).setView([-35.43, -71.66], zoom)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(m)
    grupo.current = L.layerGroup().addTo(m)
    m.on('click', (e) => clic.current && clic.current({ lat: e.latlng.lat, lng: e.latlng.lng }))
    mapa.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(caja.current)
    setTimeout(() => m.invalidateSize(), 250)
    return () => { ro.disconnect(); m.remove(); mapa.current = null }
  }, [zoom])

  useEffect(() => {
    if (caja.current) caja.current.style.cursor = onClickMapa ? 'crosshair' : ''
    const pane = caja.current?.querySelector('.leaflet-grab')
    if (pane) pane.style.cursor = onClickMapa ? 'crosshair' : ''
  }, [onClickMapa])

  useEffect(() => {
    if (!grupo.current) return
    grupo.current.clearLayers()
    marcas.current = {}
    const conCoords = puntos.filter((p) => p.lat != null && p.lng != null)
    conCoords.forEach((p) => {
      const marca = L.circleMarker([p.lat, p.lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: color(p), fillOpacity: 1,
      }).addTo(grupo.current)
      marca.bindPopup(
        `<b>${esc(p.nombre)}</b><br>${esc(p.cliente || p.direccion || 'FOSAN')}<br>` +
        `${p.banos} baño(s) · ${p.vehiculos} vehículo(s)` +
        (detalle ? `<br>${esc(detalle(p) || '')}` : '')
      )
      marca.on('click', (e) => L.DomEvent.stopPropagation(e))
      marcas.current[p.id] = marca
    })
    if (conCoords.length && mapa.current && !encuadrado.current) {
      mapa.current.fitBounds(L.latLngBounds(conCoords.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 12 })
      encuadrado.current = true
    }
  }, [puntos, color, detalle])

  useEffect(() => {
    if (!mapa.current) return
    if (marcaPendiente.current) { marcaPendiente.current.remove(); marcaPendiente.current = null }
    if (pendiente) {
      marcaPendiente.current = L.circleMarker([pendiente.lat, pendiente.lng], {
        radius: 11, color: C.rojo, weight: 3, fillColor: '#fff', fillOpacity: 1, dashArray: '3 3',
      }).addTo(mapa.current)
      if (pendiente.volar) mapa.current.flyTo([pendiente.lat, pendiente.lng], 16)
    }
  }, [pendiente])

  useEffect(() => {
    if (!centrarEn || !mapa.current) return
    const p = puntos.find((x) => x.id === centrarEn)
    if (!p || p.lat == null) return
    mapa.current.flyTo([p.lat, p.lng], 14)
    setTimeout(() => { const m = marcas.current[centrarEn]; if (m) m.openPopup() }, 500)
  }, [centrarEn])

  return <div ref={caja} style={{ height: alto, width: '100%' }} />
}

export function Leyenda({ items = LEYENDA }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 16, padding: '12px 18px',
      borderTop: `1px solid ${C.fila}`,
    }}>
      {items.map((l) => (
        <span key={l.l} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          font: '400 12px var(--font)', color: '#3c4551',
        }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: l.c }} />
          {l.l}
        </span>
      ))}
    </div>
  )
}
