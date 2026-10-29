// Piezas comunes del diseño FOSAN (láminas). Las pantallas nuevas las usan en vez de estilos inline.
// Los estilos viven en src/index.css (.btn, .card, .campo, .tabs, .estado, .ayuda, .indicador).
import { C, Icon, I } from '../lib/ui'

// ── Botón ─────────────────────────────────────────────────────────────────
// tipo: 'principal' (azul) · 'secundario' (blanco) · 'peligro' (rojo, solo confirmaciones finales)
export function Boton({ tipo = 'secundario', icono, children, className = '', ...props }) {
  const clase = { principal: 'btn btn-azul', secundario: 'btn', peligro: 'btn btn-rojo' }[tipo] || 'btn'
  return (
    <button type="button" className={`${clase} ${className}`.trim()} {...props}>
      {icono && <Icon d={icono} size={16} />}
      {children}
    </button>
  )
}

// ── Tarjeta blanca ────────────────────────────────────────────────────────
// titulo y acciones van en el encabezado; bajada es una línea de ayuda bajo el título.
export function Tarjeta({ titulo, bajada, acciones, children, sinPadding = false, style }) {
  return (
    <section className="card" style={style}>
      {(titulo || acciones) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '14px 18px', borderBottom: `1px solid ${C.borde}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {titulo && <h6 style={{ margin: 0 }}>{titulo}</h6>}
            {bajada && <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{bajada}</div>}
          </div>
          {acciones && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{acciones}</div>}
        </div>
      )}
      <div style={{ padding: sinPadding ? 0 : 18 }}>{children}</div>
    </section>
  )
}

// ── Campo de formulario ───────────────────────────────────────────────────
// Envuelve un input/select/textarea: <Campo etiqueta="RUT" obligatorio ayuda="12.345.678-5"><input …/></Campo>
export function Campo({ etiqueta, obligatorio = false, ayuda, error, children, style }) {
  return (
    <label className={`campo${error ? ' error' : ''}`} style={style}>
      <span>{etiqueta}{obligatorio && <b className="obligatorio"> *</b>}</span>
      {children}
      {error ? <small style={{ color: C.rojo }}>{error}</small> : ayuda && <small>{ayuda}</small>}
    </label>
  )
}

// ── Tabla ─────────────────────────────────────────────────────────────────
// columnas: [{ k: 'rut', label: 'RUT', render?: (fila) => …, ancho?: 120, alinear?: 'right' }]
export function Tabla({ columnas, filas, vacio = 'Sin resultados.', alClic, clave = 'id' }) {
  return (
    <div className="scroller">
      <table>
        <thead>
          <tr>{columnas.map((c) => (
            <th key={c.k} style={{ width: c.ancho, textAlign: c.alinear || 'left' }}>{c.label}</th>
          ))}</tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr><td colSpan={columnas.length} style={{ color: C.gris, textAlign: 'center', padding: 24 }}>{vacio}</td></tr>
          )}
          {filas.map((f, i) => (
            <tr key={f[clave] ?? i} onClick={alClic ? () => alClic(f) : undefined} style={{ cursor: alClic ? 'pointer' : undefined }}>
              {columnas.map((c) => (
                <td key={c.k} style={{ textAlign: c.alinear || 'left' }}>{c.render ? c.render(f) : (f[c.k] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Pestañas ──────────────────────────────────────────────────────────────
// opciones: [{ v: 'resumen', l: 'Resumen' }]
export function Pestanas({ opciones, valor, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {opciones.map((o) => (
        <button key={o.v} type="button" role="tab" aria-selected={valor === o.v}
          className={valor === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>
      ))}
    </div>
  )
}

// ── Estado: punto de color + texto (nunca solo color) ─────────────────────
// tono: 'ok' verde · 'atencion' amarillo · 'error' rojo · 'info' azul · 'neutro' gris
const TONOS = { ok: C.verde, atencion: C.amarillo, error: C.rojo, info: C.azul, neutro: C.gris }
export function Estado({ tono = 'neutro', children }) {
  return <span className="estado" style={{ '--c': TONOS[tono] || C.gris }}>{children}</span>
}

// ── Recuadro de ayuda (ícono i) ───────────────────────────────────────────
export function Ayuda({ children, tono = 'info', style }) {
  const color = tono === 'error' ? C.rojo : tono === 'atencion' ? C.amarillo : C.azulClaro
  return (
    <div className="ayuda" style={style}>
      <Icon d={tono === 'info' ? I.info : I.alert} size={18} color={color} />
      <div>{children}</div>
    </div>
  )
}

// ── Indicador (número grande + rótulo) ────────────────────────────────────
export function Indicador({ valor, rotulo, icono, color = C.azul, alClic }) {
  return (
    <div className="indicador" onClick={alClic} style={{ cursor: alClic ? 'pointer' : undefined }}>
      {icono && <Icon d={icono} size={26} color={color} />}
      <div><span>{rotulo}</span><b>{valor}</b></div>
    </div>
  )
}
