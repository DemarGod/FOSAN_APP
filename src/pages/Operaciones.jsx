// Operaciones (lámina 4): Programación · Rutas · Respaldos.
// Rutas son las Rutas semanales de siempre. Respaldos: constancia, archivos y firma.
// Fondo blanco en las tres pestañas (clases tema-claro / tema-oscuro de index.css).
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
    // Hoja blanca (Paquete 31). Programación: todo blanco · Rutas: tarjetas de ruta azules · Respaldos: tabla azul.
    <div className="tema-claro hoja-op" style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Operaciones</h2>
      <Pestanas opciones={PESTANAS} valor={tab} onChange={irA} />
      {tab === 'programacion' && <OpProgramacion irARutas={() => irA('rutas')} />}
      {tab === 'rutas' && <RutasSemana />}
      {tab === 'respaldos' && <OpRespaldos />}
    </div>
  )
}
