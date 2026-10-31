// Operaciones (lámina 4): Programación · Rutas · Respaldos.
// Rutas son las Rutas semanales de siempre (sin cambios). Respaldos: constancia, archivos y firma.
import { useSearchParams } from 'react-router-dom'
import { Pestanas } from '../components/Base'
import OpRespaldos from '../components/OpRespaldos'
import OpProgramacion from '../components/OpProgramacion'
import RutasSemana from './RutasSemana'

const PESTANAS = [
  { v: 'programacion', l: 'Programación' },
  { v: 'rutas', l: 'Rutas' },
  { v: 'respaldos', l: 'Respaldos' },
]

export default function Operaciones() {
  const [params, setParams] = useSearchParams()
  const tab = PESTANAS.some((p) => p.v === params.get('tab')) ? params.get('tab') : 'programacion'
  const irA = (v) => setParams({ tab: v }, { replace: true })
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Operaciones</h2>
      <Pestanas opciones={PESTANAS} valor={tab} onChange={irA} />
      {tab === 'programacion' && <OpProgramacion irARutas={() => irA('rutas')} />}
      {tab === 'rutas' && <RutasSemana />}
      {tab === 'respaldos' && <OpRespaldos />}
    </div>
  )
}
