// Administración → Roles y permisos (lámina 8.4).
// Se elige un rol y se marca Consultar / Registrar / Exportar por módulo.
// Mientras llegan las etapas 3 a 6, cada módulo nuevo guarda el permiso en las pantallas actuales que le corresponden.
// Paquete 17: roles con nombre propio (Ejecutivo de ventas u otros que cree el dueño), con aviso de "sin revisar".
import { useEffect, useMemo, useState } from 'react'
import { Boton, Campo, Ayuda } from './Base'
import { todosPermisos, guardarPermisosRol } from '../lib/api'
import { useRoles, crearRol, renombrarRol, marcarRolRevisado } from '../lib/roles'
import Modal from './Modal'
import { useAjustes, guardarAjuste } from '../lib/ajustes'
import { C, Icon, I } from '../lib/ui'
import { Reglas } from './AdminPersonal'

// Módulo de la lámina → secciones actuales (permisos_rol.seccion)
const MODULOS = [
  { m: 'Clientes', s: ['clientes'] },
  { m: 'Inventario', s: ['banos', 'insumos', 'ubicaciones'], nota: 'Baños, Insumos y Mapa' },
  { m: 'Operaciones', s: ['rutas', 'calendario'], op: '(solo sus rutas y trabajos)', nota: 'Rutas semanales y Calendario' },
  { m: 'Flota', s: ['transporte'] },
  { m: 'Mantenimiento', s: ['mantenciones'] },
  { m: 'Reportes', s: ['reportes'], op: '(solo sus registros)', soloConsulta: true },
  { m: 'Análisis', s: ['analisis'], soloConsulta: true, nota: 'Costos y rentabilidad (pestaña de Reportes)' },
  { m: 'Administración', s: [], soloDueno: true },
]
const ACC = [
  { k: 'ver', l: 'Consultar' },
  { k: 'editar', l: 'Registrar' },
  { k: 'exportar', l: 'Exportar' },
]
// Dueño: acceso total (solo se elige si ve Mi ruta). Operador: fijo, solo Mi ruta y Mi perfil.
// Secretaria, Ejecutivo de ventas y los roles nuevos: configurables.
const claveMiRuta = (rol) => 'menu_mi_ruta_' + rol
const esFijo = (rol) => rol === 'dueno' || rol === 'operador'

export default function AdminRoles() {
  const roles = useRoles()
  const [rol, setRol] = useState('secretaria')
  const [nuevo, setNuevo] = useState(false)
  const [renombrar, setRenombrar] = useState(false)
  const ajustes = useAjustes()
  const [miRuta, setMiRuta] = useState(false)
  const miRutaBase = rol === 'operador' ? true : ajustes[claveMiRuta(rol)] === '1'
  useEffect(() => { setMiRuta(miRutaBase) }, [rol, miRutaBase])
  const fijo = esFijo(rol)    // sus módulos no se configuran
  const rolInfo = roles.find((r) => r.clave === rol)
  const sinRevisar = rolInfo && rolInfo.revisado === false
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
  const sucio = rol === 'operador' ? false
    : rol === 'dueno' ? miRuta !== miRutaBase
      : JSON.stringify(v) !== JSON.stringify(desdeBase) || montos !== !!base?.[rol + ':finanzas']?.ver || miRuta !== miRutaBase

  const guardar = async () => {
    setGuardando(true); setError(null)
    try { if (rol !== 'operador' && miRuta !== miRutaBase) await guardarAjuste(claveMiRuta(rol), miRuta ? '1' : '0') } catch (e) { setError(e); setGuardando(false); return }
    if (rol === 'dueno') { setMsg('Guardado. El menú se actualiza de inmediato.'); setGuardando(false); return }
    const filas = []
    MODULOS.filter((x) => !x.soloDueno).forEach((x) => x.s.forEach((s) => filas.push({
      seccion: s, ver: !!v[x.m]?.ver, editar: x.soloConsulta ? false : !!v[x.m]?.editar, exportar: !!v[x.m]?.exportar,
    })))
    filas.push({ seccion: 'finanzas', ver: montos, editar: false, exportar: false })
    try {
      await guardarPermisosRol(rol, filas)
      if (sinRevisar) await marcarRolRevisado(rol)   // guardar = el dueño ya lo revisó
      await cargar(); setMsg('Permisos guardados. Cada persona los verá al recargar la app.')
    } catch (e) { setError(e) }
    setGuardando(false)
  }

  const resumen = useMemo(() => {
    const con = MODULOS.filter((x) => !x.soloDueno && v[x.m]?.ver)
    const sin = MODULOS.filter((x) => !x.soloDueno && !v[x.m]?.ver).map((x) => x.m)
    return { con, sin }
  }, [v])
  const rolL = rolInfo?.nombre || rol
  const elegirRol = (c) => { if (!sucio || window.confirm('Hay cambios sin guardar. ¿Cambiar de rol sin guardar?')) setRol(c) }
  const revisar = async () => {
    setError(null)
    try { await marcarRolRevisado(rol); setMsg('Rol marcado como revisado.') } catch (e) { setError(e) }
  }

  if (error && !base) return <Ayuda tono="error">{String(error.message || error)}</Ayuda>
  if (!base) return <div style={{ color: C.gris }}>Cargando…</div>

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <span className="text-muted">Define los permisos de cada rol en los diferentes módulos.</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Campo etiqueta="Seleccionar rol" style={{ width: 280 }}>
          <select value={rol} onChange={(e) => elegirRol(e.target.value)}>
            {roles.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}{r.revisado === false ? ' (sin revisar)' : ''}</option>)}
          </select>
        </Campo>
        {!fijo && <Boton onClick={() => setRenombrar(true)}>Renombrar</Boton>}
        <Boton icono={I.plus} onClick={() => { if (!sucio || window.confirm('Hay cambios sin guardar. ¿Continuar sin guardar?')) setNuevo(true) }}>Nuevo rol</Boton>
      </div>

      {sinRevisar && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: 14, background: 'rgba(245,158,11,.14)', border: `1px solid ${C.amarillo}`, borderRadius: 'var(--radio-md)', font: '400 13px/1.5 var(--font)' }}>
          <Icon d={I.alert} size={18} color={C.amarillo} />
          <span style={{ flex: 1, minWidth: 220 }}>
            <b>Dueño: revisa este rol.</b> <b>{rolL}</b> trae permisos predeterminados (plantilla). Revisa qué puede consultar, registrar y exportar,
            y si ve los montos, antes de entregarle la clave a sus usuarios. Al guardar, el rol queda revisado.
          </span>
          {!sucio && <Boton onClick={revisar}>Marcar como revisado</Boton>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: 16, alignItems: 'start' }} className="cols2">
        <div className="card">
          <div className="scroller">
            <table>
              <thead><tr><th>Módulo</th>{ACC.map((a) => <th key={a.k} style={{ textAlign: 'center' }}>{a.l}</th>)}</tr></thead>
              <tbody>
                {MODULOS.map((x) => (
                  <tr key={x.m} style={fijo ? { opacity: 0.55 } : undefined}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{x.m}</span>{rol === 'operador' && x.op ? <span className="text-muted"> {x.op}</span> : null}
                      {x.nota && <div className="text-muted" style={{ fontSize: 12 }}>Hoy: {x.nota}</div>}
                      {v[x.m]?.mixto && <div style={{ fontSize: 12, color: '#FBBF24' }}>Antes tenía permisos distintos por pantalla; al guardar se igualan.</div>}
                    </td>
                    {ACC.map((a) => (
                      <td key={a.k} style={{ textAlign: 'center' }}>
                        {fijo ? <input type="checkbox" checked={rol === 'dueno'} disabled style={{ width: 18, height: 18 }} />
                          : x.soloDueno ? <span className="text-muted" title="Solo el dueño">—</span>
                          : x.soloConsulta && a.k === 'editar' ? <span className="text-muted">—</span>
                            : <input type="checkbox" checked={!!v[x.m]?.[a.k]} onChange={(e) => cambiar(x.m, a.k, e.target.checked)}
                              aria-label={`${rolL}: ${a.l} ${x.m}`} style={{ width: 18, height: 18, accentColor: C.azul, cursor: 'pointer' }} />}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td>
                    <span style={{ fontWeight: 600 }}>Mi ruta</span> <span className="text-muted">(ver la ruta de los operadores)</span>
                    <div className="text-muted" style={{ fontSize: 12 }}>{rol === 'operador' ? 'El operador siempre ve su ruta.' : 'Muestra "Mi ruta" en el menú de este rol, con "Ver como operador".'}</div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={miRuta} disabled={rol === 'operador'} onChange={(e) => { setMiRuta(e.target.checked); setMsg(null) }}
                      aria-label={`${rolL}: Mi ruta`} style={{ width: 18, height: 18, accentColor: C.azul, cursor: 'pointer' }} />
                  </td>
                  <td style={{ textAlign: 'center' }}><span className="text-muted">—</span></td>
                  <td style={{ textAlign: 'center' }}><span className="text-muted">—</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 14px', borderTop: `1px solid ${C.borde}`, font: '600 13px var(--font)' }}>
            <input type="checkbox" checked={fijo ? rol === 'dueno' : montos} disabled={fijo} onChange={(e) => { setMontos(e.target.checked); setMsg(null) }} style={{ width: 18, height: 18, accentColor: C.azul }} />
            Ver montos (valores mensuales y costos)
          </label>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: 14, background: C.tinte, borderRadius: 'var(--radio-md)', font: '400 13px/1.5 var(--font)' }}>
            <b>Permisos del rol {rolL} en esta configuración:</b>
            {rol === 'dueno' ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}><li>Acceso total a todos los módulos, montos y Administración.</li><li>{miRuta ? 'Ve' : 'No ve'} "Mi ruta" en su menú.</li></ul>
              : rol === 'operador' ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}><li>Solo ve <b>Mi ruta</b> y <b>Mi perfil</b>.</li><li>No ve el resto de la app, las alertas, el buscador ni el calendario.</li></ul>
                : <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {resumen.con.length
                ? <li>Puede consultar {resumen.con.map((x) => x.m + (rol === 'operador' && x.op ? ' ' + x.op : '')).join(', ')}.</li>
                : <li>No puede consultar ningún módulo.</li>}
              {resumen.sin.length > 0 && <li>No tiene acceso a {resumen.sin.join(', ')}{montos ? '' : ', ni a los montos'}.</li>}
              <li>{miRuta ? 'Ve' : 'No ve'} "Mi ruta" en su menú.</li>
              <li>{rol === 'secretaria' ? 'En Administración solo ve la pestaña Mi perfil.' : 'No ve Administración; tiene "Mi perfil" en el menú.'}</li>
            </ul>}
          </div>
          <div style={{ display: 'flex', gap: 10, padding: 14, background: 'rgba(245,158,11,.14)', border: `1px solid ${C.amarillo}`, borderRadius: 'var(--radio-md)', font: '400 13px/1.5 var(--font)' }}>
            <Icon d={I.info} size={18} color={C.amarillo} />
            <span><b>Dueño</b>: acceso total. <b>Operador</b>: solo Mi ruta y Mi perfil. Los demás roles (Secretaria, Ejecutivo de ventas y los que crees) usan estos permisos. La función de cada persona define su rol.</span>
          </div>
        </div>
      </div>

      {msg && <Ayuda>{msg}</Ayuda>}
      {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Boton onClick={() => { setV(desdeBase); setMontos(!!base?.[rol + ':finanzas']?.ver); setMiRuta(miRutaBase); setMsg(null) }} disabled={!sucio}>Cancelar</Boton>
        <Boton tipo="principal" onClick={guardar} disabled={!sucio || guardando}>{guardando ? 'Guardando…' : 'Guardar permisos'}</Boton>
      </div>
      <Reglas />
      {nuevo && <NuevoRol roles={roles} onCerrar={() => setNuevo(false)} onCreado={(c) => { setNuevo(false); setRol(c); cargar(); setMsg('Rol creado con la plantilla. Revisa sus permisos y guarda.') }} />}
      {renombrar && <RenombrarRol rol={rolInfo} onCerrar={() => setRenombrar(false)} onListo={() => { setRenombrar(false); setMsg('Nombre del rol actualizado.') }} />}
    </div>
  )
}

// Crear un rol con nombre propio: copia los permisos de una plantilla (por defecto, Ejecutivo de ventas)
function NuevoRol({ roles, onCerrar, onCreado }) {
  const plantillas = roles.filter((r) => !esFijo(r.clave))
  const [nombre, setNombre] = useState('')
  const [base, setBase] = useState(plantillas.some((r) => r.clave === 'ventas') ? 'ventas' : plantillas[0]?.clave || '')
  const [error, setError] = useState(null)
  const [creando, setCreando] = useState(false)
  const crear = async () => {
    setError(null)
    if (nombre.trim().length < 3) { setError('Escribe el nombre del rol.'); return }
    if (roles.some((r) => r.nombre.toLowerCase() === nombre.trim().toLowerCase())) { setError('Ya existe un rol con ese nombre.'); return }
    setCreando(true)
    try { onCreado(await crearRol(nombre.trim(), base || null)) } catch (e) { setError(e); setCreando(false) }
  }
  return (
    <Modal titulo="Nuevo rol" ancho={480} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={crear} disabled={creando}>{creando ? 'Creando…' : 'Crear rol'}</Boton>
    </>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Campo etiqueta="Nombre del rol" obligatorio>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Ejecutivo de ventas zona sur" autoFocus />
        </Campo>
        <Campo etiqueta="Partir con los permisos de" ayuda="Se copian como punto de partida. Después los ajustas.">
          <select value={base} onChange={(e) => setBase(e.target.value)}>
            {plantillas.map((r) => <option key={r.clave} value={r.clave}>{r.nombre}</option>)}
          </select>
        </Campo>
        <Ayuda tono="atencion">El rol nuevo queda <b>sin revisar</b> hasta que guardes sus permisos o lo marques como revisado.</Ayuda>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}

function RenombrarRol({ rol, onCerrar, onListo }) {
  const [nombre, setNombre] = useState(rol?.nombre || '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const guardar = async () => {
    setError(null)
    if (nombre.trim().length < 3) { setError('Escribe el nombre del rol.'); return }
    setGuardando(true)
    try { await renombrarRol(rol.clave, nombre); onListo() } catch (e) { setError(e); setGuardando(false) }
  }
  return (
    <Modal titulo="Renombrar rol" ancho={420} onCerrar={onCerrar} pie={<>
      <Boton onClick={onCerrar}>Cancelar</Boton>
      <Boton tipo="principal" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton>
    </>}>
      <div style={{ display: 'grid', gap: 12 }}>
        <Campo etiqueta="Nombre visible"><input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></Campo>
        <span className="text-muted" style={{ fontSize: 12 }}>Solo cambia el nombre que se muestra. Las personas con este rol mantienen sus permisos.</span>
        {error && <Ayuda tono="error">{String(error.message || error)}</Ayuda>}
      </div>
    </Modal>
  )
}
