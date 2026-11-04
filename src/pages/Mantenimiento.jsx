// Mantenimiento (lámina 6): módulo propio en el menú, para equipos y vehículos.
// Por ahora reúne los paneles de mantenciones que hizo Cata (equipos y flota).
// El paquete 10 lo completa según la lámina (Pendientes/Historial, Iniciar trabajo, Registrar resultado).
import { useSearchParams } from 'react-router-dom'
import { Pestanas } from '../components/Base'
import PanelMantenciones from '../components/PanelMantenciones'

const PESTANAS = [
  { v: 'equipos', l: 'Equipos' },
  { v: 'vehiculos', l: 'Vehículos' },
]

export default function Mantenimiento() {
  const [params, setParams] = useSearchParams()
  const tab = PESTANAS.some((p) => p.v === params.get('tab')) ? params.get('tab') : 'equipos'
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Mantenimiento</h2>
      <Pestanas opciones={PESTANAS} valor={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      {tab === 'equipos' && <PanelMantenciones key="equipos" ambito="equipos" />}
      {tab === 'vehiculos' && <PanelMantenciones key="flota" ambito="flota" />}
    </div>
  )
}
