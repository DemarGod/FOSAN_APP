import { useEffect, useMemo, useState } from 'react'
import Listado from '../components/Listado'
import FormRuta from '../components/FormRuta'
import Salida from '../components/Salida'
import { rutasLista, salidas, parametros, generarSalidas } from '../lib/api'
import { costoSalida, mapaParametros, diasTexto, hoyISO, sumarDias } from '../lib/costos'
import { useSesion, puedeEditar, puedeOperar, verFinanzas } from '../lib/sesion'
import { C, I, clp, fecha } from '../lib/ui'

const SEGMENTOS = [
  { v: 'salidas', l: 'Salidas', d: I.cal },
  { v: 'rutas', l: 'Rutas', d: 'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6' },
]
const DIA_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function Rutas() {
  const { perfil } = useSesion()
  const editable = puedeOperar(perfil, 'rutas')
  const finanzas = verFinanzas(perfil)
  const [seg, setSeg] = useState('salidas')
  const [rutas, setRutas] = useState([])
  const [lista, setLista] = useState([])
  const [par, setPar] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(null)
  const [abierta, setAbierta] = useState(null)

  const hoy = hoyISO()
  const cargar = (silencioso) => {
    if (!silencioso) setCargando(true)
    return generarSalidas()
      .then(() => Promise.all([rutasLista(), salidas(sumarDias(hoy, -7), sumarDias(hoy, 14)), parametros()]))
      .then(([r, s, p]) => { setRutas(r); setLista(s); setPar(mapaParametros(p)) })
      .catch(setError).finally(() => setCargando(false))
  }
  useEffect(() => { cargar() }, [])

  const filasSalidas = useMemo(() => lista.map((s) => {
    const c = costoSalida(s, par)
    const d = new Date(s.fecha + 'T12:00:00')
    return {
      ...s, costo: c,
      fechaL: `${DIA_SEMANA[d.getDay()]} ${fecha(s.fecha)}`,
      vehiculoL: s.vehiculo || 'Sin asignar',
      paradasL: `${s.paradas_hechas}/${s.paradas}`,
      kmL: s.km == null ? '—' : `${Math.round(s.km)} km${s.km_real != null ? '' : ' (est.)'}`,
      cargaL: Math.round(c.pesoTotal).toLocaleString('es-CL') + ' kg',
      costoL: c.km ? clp(Math.round(c.total)) + (c.faltan.length > 1 ? ' *' : '') : '—',
      estadoL: s.estado === 'planificada' && s.fecha < hoy ? 'Sin cerrar' : s.estado === 'planificada' ? 'Planificada' : s.estado === 'cerrada' ? 'Cerrada' : 'Cancelada',
      cuando: s.fecha < hoy ? 'Pasadas' : s.fecha === hoy ? 'Hoy' : 'Próximas',
    }
  }), [lista, par, hoy])

  const semana = filasSalidas.filter((f) => f.fecha >= hoy && f.fecha <= sumarDias(hoy, 6) && f.estado !== 'cancelada')
  const costoSemana = semana.reduce((a, f) => a + f.costo.total, 0)
  const kmSemana = semana.reduce((a, f) => a + (f.costo.km || 0), 0)

  const filasRutas = useMemo(() => rutas.map((r) => ({
    ...r,
    diasL: diasTexto(r.dias),
    vehiculoL: r.activos?.codigo || 'Sin asignar',
    paradasL: (r.ruta_paradas || []).length,
    clientesL: (r.ruta_paradas || []).slice().sort((a, b) => a.orden - b.orden).map((p) => p.clientes?.nombre).filter(Boolean).join(' → ') || '—',
    estadoL: r.activa ? 'Activa' : 'Pausada',
  })), [rutas])

  const salidaAbierta = abierta && filasSalidas.find((f) => f.id === abierta)

  return (
    <>
      {seg === 'salidas' ? (
        <Listado
          titulo="Rutas y servicios"
          bajada="Salidas de cada ruta día a día: km estimados y reales, carga y costo del vehículo."
          accion={{ label: 'Nueva ruta', onClick: () => setForm('nueva'), disabled: !editable }}
          segmentos={{ opciones: SEGMENTOS, valor: seg, onChange: setSeg }}
          kpis={[
            { v: semana.length, l: 'Salidas próximos 7 días' },
            { v: Math.round(kmSemana).toLocaleString('es-CL') + ' km', l: 'Km estimados semana' },
            ...(finanzas ? [{ v: clp(Math.round(costoSemana)), l: 'Costo estimado semana' }] : []),
            { v: filasSalidas.filter((f) => f.estadoL === 'Sin cerrar').length, l: 'Sin cerrar' },
          ]}
          cargando={cargando}
          error={error}
          unidad="salidas"
          filtros={[{ k: 'cuando', label: 'Cuándo' }, { k: 'ruta', label: 'Ruta' }, { k: 'vehiculoL', label: 'Vehículo' }]}
          buscar={['ruta', 'vehiculoL']}
          cols={[
            { k: 'fechaL', label: 'Fecha' },
            { k: 'ruta', label: 'Ruta' },
            { k: 'vehiculoL', label: 'Vehículo' },
            { k: 'paradasL', label: 'Paradas hechas' },
            { k: 'kmL', label: 'Km' },
            { k: 'cargaL', label: 'Carga' },
            ...(finanzas ? [{ k: 'costoL', label: 'Costo' }] : []),
            { k: 'estadoL', label: 'Estado', badge: true },
          ]}
          datos={filasSalidas}
          onFila={(d) => setAbierta(d.id)}
          acciones={(d) => [{ t: 'Abrir salida', d: I.ojo, color: C.azul, onClick: () => setAbierta(d.id) }]}
          nota="(est.) = km estimado con el promedio real de la ruta · * faltan datos del vehículo o de Configuración para un costo exacto."
        />
      ) : (
        <Listado
          titulo="Rutas y servicios"
          bajada="Cada ruta tiene sus días, su vehículo y sus clientes en orden. Las salidas se crean solas."
          accion={{ label: 'Nueva ruta', onClick: () => setForm('nueva'), disabled: !editable }}
          segmentos={{ opciones: SEGMENTOS, valor: seg, onChange: setSeg }}
          kpis={[
            { v: filasRutas.length, l: 'Rutas' },
            { v: filasRutas.reduce((a, r) => a + r.paradasL, 0), l: 'Paradas por semana' },
          ]}
          cargando={cargando}
          error={error}
          unidad="rutas"
          buscar={['nombre', 'clientesL', 'vehiculoL']}
          cols={[
            { k: 'nombre', label: 'Ruta' },
            { k: 'diasL', label: 'Días' },
            { k: 'vehiculoL', label: 'Vehículo' },
            { k: 'paradasL', label: 'Paradas' },
            { k: 'clientesL', label: 'Recorrido', render: (d) => <span style={{ whiteSpace: 'normal', display: 'block', maxWidth: 420 }}>{d.clientesL}</span> },
            { k: 'estadoL', label: 'Estado', badge: true },
          ]}
          datos={filasRutas}
          onFila={(d) => editable && setForm(d)}
          acciones={(d) => [{ t: 'Editar ruta', d: I.lapiz, color: C.navy, disabled: !editable, onClick: () => setForm(d) }]}
        />
      )}

      {form && <FormRuta ruta={form === 'nueva' ? null : form} onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); cargar() }} />}
      {salidaAbierta && (
        <Salida key={salidaAbierta.id + salidaAbierta.estado} salida={salidaAbierta} par={par} editable={editable} verCostos={finanzas}
          onCerrar={() => setAbierta(null)} onCambio={() => cargar(true)} />
      )}
    </>
  )
}
