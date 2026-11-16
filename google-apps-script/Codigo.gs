// FOSAN · Respaldos en Google Drive (Apps Script) · versión 2 (Paquete 30)
// Recibe fotos, PDF y firmas desde la app FOSAN y los guarda en una carpeta de tu Drive.
// Solo acepta usuarios con sesión válida en FOSAN (se verifica con Supabase).
//
// Novedades de la versión 2:
//   · "ruta": carpetas dentro de carpetas, por ejemplo ['FIRMAS', '2026-12'] → FIRMAS/2026-12/
//     (si no viene "ruta", funciona igual que antes con "carpeta").
//   · acción "pdf": recibe la constancia en HTML (con las firmas) y la guarda como PDF.
//   · "ver" acepta archivos en cualquier nivel dentro de la carpeta raíz.

const CARPETA_ID    = '15mhCD-XCehsNHaR8GHFXHmaoYdx7znpi';
const SUPABASE_URL  = 'https://vamgboklvsuzejbnxvip.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbWdib2tsdnN1emVqYm54dmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMDA4OTYsImV4cCI6MjEwNTU3Njg5Nn0.M0rVnp3OXl319vx1G5YXBA5xnVxWdXOWpYumHru2BYY';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    verificar(d.token);
    const raiz = DriveApp.getFolderById(CARPETA_ID);

    if (d.accion === 'subir') {
      const carpeta = carpetaDestino(raiz, d);
      const blob = Utilities.newBlob(Utilities.base64Decode(d.base64), d.tipo || 'application/octet-stream', nombreArchivo(d.nombre, 'archivo'));
      const f = carpeta.createFile(blob);
      f.setDescription('Subido desde FOSAN');
      return json({ ok: true, id: f.getId() });
    }

    if (d.accion === 'pdf') {
      if (!d.html) throw new Error('Falta el contenido de la constancia.');
      const carpeta = carpetaDestino(raiz, d);
      const pdf = Utilities.newBlob(String(d.html), 'text/html', 'constancia.html').getAs('application/pdf');
      pdf.setName(nombreArchivo(d.nombre, 'Constancia.pdf'));
      const f = carpeta.createFile(pdf);
      f.setDescription('Constancia generada por FOSAN');
      return json({ ok: true, id: f.getId() });
    }

    if (d.accion === 'ver') {
      const ids = (d.ids || []).slice(0, 40);
      const out = ids.map(function (id) {
        try {
          const f = DriveApp.getFileById(id);
          if (!dentroDeRaiz(f)) return { id: id, error: 'fuera de la carpeta' };
          const b = f.getBlob();
          return { id: id, tipo: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
        } catch (x) { return { id: id, error: 'no encontrado' }; }
      });
      return json({ ok: true, archivos: out });
    }

    return json({ ok: false, error: 'Acción no válida.' });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) });
  }
}

function doGet() { return json({ ok: true, servicio: 'FOSAN respaldos', version: 2 }); }

// Carpeta donde se guarda: "ruta" (lista de carpetas, se crean si no existen) o, como antes, "carpeta"
function carpetaDestino(raiz, d) {
  const partes = Array.isArray(d.ruta) && d.ruta.length ? d.ruta.slice(0, 4) : [d.carpeta || 'sin-folio'];
  let actual = raiz;
  partes.forEach(function (p) {
    const nombre = String(p || '').replace(/[\/\\<>:"|?*\u0000-\u001F]/g, '_').trim().slice(0, 100) || 'sin-nombre';
    const it = actual.getFoldersByName(nombre);
    actual = it.hasNext() ? it.next() : actual.createFolder(nombre);
  });
  return actual;
}

// Nombre de archivo seguro para Drive (sin / ni caracteres de control)
function nombreArchivo(n, porDefecto) {
  return String(n || porDefecto).replace(/[\/\\\u0000-\u001F]/g, '_').trim().slice(0, 200) || porDefecto;
}

function verificar(token) {
  if (!token) throw new Error('Sesión no válida.');
  const h = { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + token };
  const u = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', { headers: h, muteHttpExceptions: true });
  if (u.getResponseCode() !== 200) throw new Error('Sesión no válida. Vuelve a entrar a FOSAN.');
  const a = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/tiene_acceso', {
    method: 'post', contentType: 'application/json', payload: '{}', headers: h, muteHttpExceptions: true });
  if (a.getResponseCode() !== 200 || a.getContentText().trim() !== 'true') throw new Error('No tienes permiso para hacer esto.');
}

// ¿El archivo está dentro de la carpeta raíz, en cualquier nivel? (hasta 6 niveles hacia arriba)
function dentroDeRaiz(f) {
  let nivel = [];
  const ps = f.getParents();
  while (ps.hasNext()) nivel.push(ps.next());
  for (let i = 0; i < 6 && nivel.length; i++) {
    const siguiente = [];
    for (let k = 0; k < nivel.length; k++) {
      if (nivel[k].getId() === CARPETA_ID) return true;
      const pp = nivel[k].getParents();
      while (pp.hasNext()) siguiente.push(pp.next());
    }
    nivel = siguiente;
  }
  return false;
}

function json(x) {
  return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
}
