import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { C } from '../lib/ui'

const COLOR_PUNTO = (p) => {
  if (p.en_mantencion > 0) return C.amarillo
  if (p.tipo === 'bodega') return C.navy
  if (p.tipo === 'taller') return C.amarillo
  if (p.vehiculos > 0 && p.banos === 0) return C.azul
  return C.verde
}

export const LEYENDA = [
  { l: 'Bodega', c: C.navy },
  { l: 'Baños en arriendo', c: C.verde },
  { l: 'Camiones', c: C.azul },
  { l: 'En mantención', c: C.amarillo },
]

/**
 * Mapa Leaflet con un círculo por punto de v_mapa_puntos.
 * `centrarEn` recibe un id de punto para volar hacia él.
 */
export default function Mapa({ puntos = [], alto = 320, zoom = 8, centrarEn = null }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const grupo = useRef(null)
  const marcas = useRef({})

  useEffect(() => {
    if (!caja.current || mapa.current) return
    const m = L.map(caja.current, { scrollWheelZoom: true }).setView([-35.55, -71.62], zoom)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(m)
    grupo.current = L.layerGroup().addTo(m)
    mapa.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(caja.current)
    setTimeout(() => m.invalidateSize(), 250)
    return () => { ro.disconnect(); m.remove(); mapa.current = null }
  }, [zoom])

  useEffect(() => {
    if (!grupo.current) return
    grupo.current.clearLayers()
    marcas.current = {}
    const conCoords = puntos.filter((p) => p.lat != null && p.lng != null)
    conCoords.forEach((p) => {
      const marca = L.circleMarker([p.lat, p.lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: COLOR_PUNTO(p), fillOpacity: 1,
      }).addTo(grupo.current)
      marca.bindPopup(
        `<b>${p.nombre}</b><br>${p.cliente || 'FOSAN'}<br>` +
        `${p.activos} activos · ${p.banos} baños · ${p.vehiculos} vehículos`
      )
      marcas.current[p.id] = marca
    })
    if (conCoords.length && mapa.current) {
      const bounds = L.latLngBounds(conCoords.map((p) => [p.lat, p.lng]))
      mapa.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }
  }, [puntos])

  useEffect(() => {
    if (!centrarEn || !mapa.current) return
    const p = puntos.find((x) => x.id === centrarEn)
    if (!p || p.lat == null) return
    mapa.current.flyTo([p.lat, p.lng], 13)
    setTimeout(() => { const m = marcas.current[centrarEn]; if (m) m.openPopup() }, 500)
  }, [centrarEn, puntos])

  return <div ref={caja} style={{ height: alto, width: '100%' }} />
}

export function Leyenda() {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 16, padding: '12px 18px',
      borderTop: `1px solid ${C.fila}`,
    }}>
      {LEYENDA.map((l) => (
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
