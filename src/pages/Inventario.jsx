// Inventario (lámina 3): Equipos · Insumos y EPP · Mapa.
// Paquete 7a: Equipos (3.1 a 3.4). Insumos y EPP se rehace en el 7c; el Mapa es el de siempre.
import { useSearchParams } from 'react-router-dom'
import { Pestanas } from '../components/Base'
import InvEquipos from '../components/InvEquipos'
import Insumos from './Insumos'
import Ubicaciones from './Ubicaciones'
import { useSesion, puedeVer } from '../lib/sesion'

const TODAS = [
  { v: 'equipos', l: 'Equipos', s: 'banos' },
  { v: 'insumos', l: 'Insumos y EPP', s: 'insumos' },
  { v: 'mapa', l: 'Mapa', s: 'ubicaciones' },
]

export default function Inventario() {
  const { perfil } = useSesion()
  const [params, setParams] = useSearchParams()
  const pestanas = TODAS.filter((p) => puedeVer(perfil, p.s))
  const tab = pestanas.some((p) => p.v === params.get('tab')) ? params.get('tab') : pestanas[0]?.v
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Inventario</h2>
      <Pestanas opciones={pestanas} valor={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      {tab === 'equipos' && <InvEquipos />}
      {tab === 'insumos' && <Insumos />}
      {tab === 'mapa' && <Ubicaciones />}
    </div>
  )
}
