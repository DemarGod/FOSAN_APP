// Formato único del historial ("Ver registro") para toda la app:
// nombres de campo en español, Sí/No y Activo/Inactivo en vez de true/false, fechas DD/MM/AAAA,
// sin identificadores internos ni claves.

const NOMBRES = {
  activo: 'Estado', activa: 'Estado', habilitado: 'Habilitado', principal: 'Contacto principal',
  nombre: 'Nombre', rut: 'RUT', telefono: 'Teléfono', correo: 'Correo', email: 'Correo', direccion: 'Dirección', comuna: 'Comuna',
  rubro: 'Rubro', giro: 'Giro', cargo: 'Cargo', contacto_nombre: 'Contacto', contacto_telefono: 'Teléfono del contacto',
  fecha_inicio: 'Fecha de inicio', fecha_termino: 'Fecha de término', fecha_programada: 'Fecha programada', fecha_realizada: 'Fecha de realización',
  fecha_baja: 'Fecha de baja', fecha_registro: 'Fecha de registro', fecha_incorporacion: 'Fecha de incorporación', fecha_vencimiento: 'Vencimiento',
  fecha: 'Fecha', lunes: 'Semana', estado: 'Estado', situacion: 'Situación', condicion: 'Condición', tipo: 'Tipo', clase: 'Clase',
  cantidad: 'Cantidad', valor_mensual: 'Valor mensual', costo: 'Costo', frecuencia: 'Frecuencia', limpiezas_semana: 'Limpiezas por semana',
  dias: 'Días', modalidad: 'Modalidad', volumen_m3: 'Volumen (m³)', observaciones: 'Observaciones', notas: 'Notas', detalle: 'Detalle',
  motivo: 'Motivo', motivo_baja: 'Motivo de baja', motivo_cancelacion: 'Motivo de cancelación', motivo_desactivacion: 'Motivo de desactivación',
  codigo: 'Código', folio: 'Folio', patente: 'Patente', marca: 'Marca', modelo: 'Modelo', anio: 'Año', kilometraje: 'Odómetro (km)',
  propiedad: 'Propiedad', rol: 'Rol', funcion: 'Función', titulo: 'Título', trabajo_requerido: 'Trabajo requerido', trabajo_realizado: 'Trabajo realizado',
  resultado: 'Resultado', condicion_final: 'Condición final', responsable_ext: 'Responsable', bloquea: 'Deja no disponible',
  lat: 'Latitud', lng: 'Longitud', banos_propios: 'Baños propios', dias_limpieza: 'Días de limpieza', vigencia: 'Vigencia',
  cliente: 'Cliente', ubicacion: 'Ubicación', servicio: 'Servicio', vehiculo: 'Vehículo', responsable: 'Responsable', contacto: 'Contacto',
  categoria: 'Categoría', propietario: 'Propietario', operador: 'Operador', ruta: 'Ruta', salida: 'Día de ruta', despacho: 'Operación', perfil: 'Usuario',
  exceso_unidades: 'Unidades sobre el cupo', exceso_motivo: 'Motivo de la urgencia', origen: 'Origen', accion: 'Acción', orden: 'Orden', tarea: 'Tarea',
}
// Campos técnicos que no aportan a la persona
const OCULTOS = new Set(['id', 'qr_token', 'rut_norm', 'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por', 'desactivado_por',
  'cancelado_por', 'registrado_por', 'subido_por', 'token'])
const SECRETOS = /clave|password|contrasen|token|hash/i
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SI_NO_ESTADO = new Set(['activo', 'activa'])
const VALORES = {
  mantencion: 'Mantención', en_arriendo: 'En arriendo', fuera_de_servicio: 'Fuera de servicio', en_servicio: 'En servicio', en_limpieza: 'En limpieza',
  requiere_reparacion: 'Requiere reparación', requiere_limpieza: 'Requiere limpieza', operativo: 'Operativo', requiere_seguimiento: 'Requiere seguimiento',
  arriendo_limpieza: 'Arriendo de baños químicos', limpieza_cliente: 'Limpieza de baños del cliente', limpieza_fosas: 'Limpieza de fosas sépticas',
  programado: 'Programado', programada: 'Programada', hecho: 'Realizado', cancelado: 'Cancelado', anulada: 'Anulada', completada: 'Completada',
  vigente: 'Vigente', finalizado: 'Finalizado', planificada: 'Planificada', cerrada: 'Cerrada', cancelada: 'Cancelada',
  dueno: 'Dueño', secretaria: 'Secretaria', operador: 'Operador', ventas: 'Ejecutivo de ventas', empresa: 'Empresa', bano_quimico: 'Baño químico',
  revision_tecnica: 'Revisión técnica', permiso_circulacion: 'Permiso de circulación', no_realizada: 'No se pudo', hecha: 'Realizada',
}

export const campoL = (k) => NOMBRES[k] || (k.endsWith('_id') ? campoL(k.slice(0, -3)) : (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' '))

export const valorL = (k, x) => {
  if (SECRETOS.test(k)) return '••••'
  if (x === null || x === undefined || x === '') return '—'
  if (x === true) return SI_NO_ESTADO.has(k) ? 'Activo' : 'Sí'
  if (x === false) return SI_NO_ESTADO.has(k) ? 'Inactivo' : 'No'
  if (Array.isArray(x)) return k === 'dias' ? x.map((d) => DIAS[Number(d) % 7] || d).join(', ') : x.map((y) => valorL('', y)).join(', ')
  if (typeof x === 'object') return Object.entries(x).map(([a, b]) => `${campoL(a)}: ${valorL(a, b)}`).join(' · ')
  const s = String(x)
  if (UUID.test(s)) return 'Registro vinculado'
  if (VALORES[s]) return VALORES[s]
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (m) { const d = new Date(s); if (!isNaN(d)) return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  if (/^[a-z]+(_[a-z]+)+$/.test(s)) return (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, ' ')
  if (/^[a-z]+$/.test(s) && s.length > 2 && k !== 'correo' && k !== 'email') return s.charAt(0).toUpperCase() + s.slice(1)
  return s
}

// Filas visibles de un registro: en "modificar" { campo: { antes, despues } }; en crear/eliminar { campo: valor }
export const filasCambio = (accion, cambios) => {
  const mod = accion === 'modificar'
  return Object.entries(cambios && typeof cambios === 'object' ? cambios : {})
    .filter(([k, x]) => !OCULTOS.has(k) && (mod || !k.endsWith('_id')) && (mod || (x !== null && x !== '')))
    .map(([k, x]) => ({ k, campo: campoL(k), antes: mod ? valorL(k, x?.antes) : null, despues: valorL(k, mod ? x?.despues : x) }))
}

// Tabla estándar de "Ver registro"
export function TablaCambios({ accion, cambios }) {
  const mod = accion === 'modificar'
  const filas = filasCambio(accion, cambios)
  if (!filas.length) return <p className="text-muted" style={{ margin: 0 }}>Sin detalle.</p>
  return (
    <div className="scroller">
      <table style={{ minWidth: 420 }}>
        <thead>
          <tr><th>Campo</th>{mod ? <><th>Antes</th><th>Después</th></> : <th>{accion === 'eliminar' ? 'Valor eliminado' : 'Valor guardado'}</th>}</tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.k}>
              <td style={{ fontWeight: 600 }}>{f.campo}</td>
              {mod && <td>{f.antes}</td>}
              <td style={{ overflowWrap: 'anywhere' }}>{f.despues}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!mod && <p className="text-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>{accion === 'eliminar' ? 'Datos que tenía al eliminarse.' : 'Registro nuevo: se muestran los datos con que se creó (no hay "antes").'}</p>}
    </div>
  )
}
