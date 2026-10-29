// Administración → Roles y permisos (lámina 8.4).
// Se elige un rol y se marca Consultar / Registrar / Exportar por módulo.
// Mientras llegan las etapas 3 a 6, cada módulo nuevo guarda el permiso en las pantallas actuales que le corresponden.
import { useEffect, useMemo, useState } from 'react'
import { Boton, Campo, Ayuda } from './Base'
import { todosPermisos, guardarPermisosRol } from '../lib/api'
import { ROLES } from '../lib/sesion'
import { C, Icon, I } from '../lib/ui'
import { Reglas } from './AdminPersonal'

// Módulo de la lámina → secciones actuales (permisos_rol.seccion)
const MODULOS = [
  { m: 'Clientes', s: ['clientes'] },
  { m: 'Inventario', s: ['banos', 'insumos', 'ubicaciones'], nota: 'Baños, Insumos y Mapa' },
  { m: 'Operaciones', s: ['rutas', 'calendario'], op: '(solo sus rutas y trabajos)', nota: 'Rutas semanales y Calendario' },
  { m: 'Flota', s: ['transporte'] },
  { m: 'Mantenimiento', s: ['mantenciones'] },
  { m: 'Reportes', s: ['reportes', 'analisis'], op: '(solo sus registros)', soloConsulta: true, nota: 'Reportes y Análisis' },
  { m: 'Administración', s: [], soloDueno: true },
]
const ACC = [
  { k: 'ver', l: 'Consultar' },
  { k: 'editar', l: 'Registrar' },
  { k: 'exportar', l: 'Exportar' },
]
const EDITABLES = ROLES.filter((r) => r.v !== 'dueno')

export default function AdminRoles() {
  const [rol, setRol] = useState(EDITABLES.find((r) => r.v === 'operador')?.v || EDITABLES[0].v)
  const [base, setBase] = useState(null)     // filas guardadas: { 'rol:seccion': fila }
  const [v, setV] = useState({})             // { modulo: { ver, editar, exportar } } en edición
  const [montos, setMontos] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = () => todosPermisos().then((rows) => {
    const m = {}
    rows.forEach((r) => { m[r.rol + ':' + r.seccion] = r })
    setBase(m)
  }).catch(setError)
  useEffect(() => { cargar() }, [])

  // Un módulo está marcado si TODAS sus pantallas lo tienen marcado
  const desdeBase = useMemo(() => {
    if (!base) return {}
    const o = {}
    MODULOS.filter((x) => !x.soloDueno).forEach((x) => {
      o[x.m] = {}
      ACC.forEach(({ k }) => { o[x.m][k] = x.s.every((s) => !!base[rol + ':' + s]?.[k]) })
      o[x.m].mixto = ACC.some(({ k }) => { const vals = x.s.map((s) => !!base[rol + ':' + s]?.[k]); return vals.some(Boolean) && !vals.every(Boolean) })
    })
    return o
  }, [base, rol])
  useEffect(() => { setV(desdeBase); setMontos(!!base?.[rol + ':finanzas']?.ver); setMsg(null) }, [desdeBase])

  const cambiar = (m, k, on) => {
    setMsg(null)
    setV((p) => {
      const x = { ...p[m], [k]: on }
      if (k === 'ver' && !on) { x.editar = false; x.exportar = false }
      if ((k === 'editar' || k === 'exportar') && on) x.ver = true
      return { ...p, [m]: x }
    })
  }
  const sucio = JSON.stringify(v) !== JSON.stringify(desdeBase) || montos !== !!base?.[rol + ':finanzas']?.ver

  const guardar = async () => {
    setGuardando(true); setError(null)
    const filas = []
    MODULOS.filter((x) => !x.soloDueno).forEach((x) => x.s.forEach((s) => filas.push({
      seccion: s, ver: !!v[x.m]?.ver, editar: x.soloConsulta ? false : !!v[x.m]?.editar, exportar: !!v[x.m]?.exportar,
    })))
    filas.push({ seccion: 'finanzas', ver: montos, editar: false, exportar: false })
    try { await guardarPermisosRol(rol, filas); await cargar(); setMsg('Permisos guardados. Cada persona los verá al recargar la app.') } catch (e) { setError(e) }
    setGuardando(false)
  }

  const resumen = useMemo(() => {
    const con = MODULOS.filter((x) => !x.soloDueno && v[x.m]?.ver)
    const sin = MODULOS.filter((x) => !x.soloDueno && !v[x.m]?.ver).map((x) => x.m)
    return { con, sin }
  }, [v])
  const rolL = ROLES.find((r) => r.v === rol)?.l

  if (error && !base) return <Ayuda tono="error">{String(error.message || error)}</Ayuda>
  if (!base) return <div style={{ color: C.gris }}>Cargando…</div>

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <span className="text-muted">Define los permisos de cada rol en los diferentes módulos.</span>
      <Campo etiqueta="Seleccionar rol" style={{ maxWidth: 280 }}>
        <select value={rol} onChange={(e) => { if (!sucio || window.confirm('Hay cambios sin guardar. ¿Cambiar de rol sin guardar?')) setRol(e.target.value) }}>
          {EDITABLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
      </Campo>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: 16, alignItems: 'start' }} className="cols2">
        <div className="card">
          <div className="scroller">
            <table>
              <thead><tr><th>Módulo</th>{ACC.map((a) => <th key={a.k} style={{ textAlign: 'center' }}>{a.l}</th>)}</tr></thead>
              <tbody>
                {MODULOS.map((x) => (
                  <tr key={x.m}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{x.m}</span>{rol === 'operador' && x.op ? <span className="text-muted"> {x.op}</span> : null}
                      {x.nota && <div className="text-muted" style={{ fontSize: 12 }}>Hoy: {x.nota}</div>}
                      {v[x.m]?.mixto && <div style={{ fontSize: 12, color: '#b06000' }}>Antes tenía permisos distintos por pantalla; al guardar se igualan.</div>}
                    </td>
                    {ACC.map((a) => (
                      <td key={a.k} style={{ textAlign: 'center' }}>
                        {x.soloDueno ? <span className="text-muted" title="Solo el dueño">—</span>
                          : x.soloConsulta && a.k === 'editar' ? <span className="text-muted">—</span>
                            : <input type="checkbox" checked={!!v[x.m]?.[a.k]} onChange={(e) => cambiar(x.m, a.k, e.target.checked)}
                              aria-label={`${rolL}: ${a.l} ${x.m}`} style={{ width: 18, height: 18, accentColor: C.azul, cursor: 'pointer' }} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 14px', borderTop: `1px solid ${C.borde}`, font: '600 13px var(--font)' }}>
            <input type="checkbox" checked={montos} onChange={(e) => { setMontos(e.target.checked); setMsg(null) }} style={{ width: 18, height: 18, accentColor: C.azul }} />
            Ver montos (valores mensuales y costos)
          </label>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: 14, background: C.tinte, borderRadius: 'var(--radio-md)', font: '400 13px/1.5 var(--font)' }}>
            <b>Permisos del rol {rolL} en esta configuración:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {resumen.con.length
                ? <li>Puede consultar {resumen.con.map((x) => x.m + (rol === 'operador' && x.op ? ' ' + x.op : '')).join(', ')}.</li>
                : <li>No puede consultar ningún módulo.</li>}
              {resumen.sin.length > 0 && <li>No tiene acceso a {resumen.sin.join(', ')}{montos ? '' : ', ni a los montos'}.</li>}
              <li>No tiene acceso al módulo de Administración.</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: 14, background: '#fef7e0', border: `1px solid ${C.amarillo}`, borderRadius: 'var(--radio-md)', font: '400 13px/1.5 var(--font)' }}>
            <Icon d={I.info} size={18} color={C.amarillo} />
            <span>El Dueño tiene acceso a todos los módulos y a la gestión de cuentas. Si conduce, también accede a Mi ruta.</span>
          </div>
        </div>
      </div>

      {msg && <Ayuda>{msg}</Ayuda>}
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton onClick={() => { setV(desdeBase); setMontos(!!base?.[rol + ':finanzas']?.ver); setMsg(null) }} disabled={!sucio}>Cancelar</Boton>
        <Boton tipo="principal" onClick={guardar} disabled={!sucio || guardando}>{guardando ? 'Guardando…' : 'Guardar permisos'}</Boton>
      </div>
      <Reglas />
    </div>
  )
}
