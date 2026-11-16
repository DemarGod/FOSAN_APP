# Script de Google (respaldos en Drive)

`Codigo.gs` es el código del proyecto de **Google Apps Script** que guarda en Google Drive las firmas, fotos,
constancias y documentos que se suben desde la app. La app lo llama por la URL de `src/lib/drive.js`.

Esta copia está aquí para que el código quede documentado: el que funciona es el que está en
https://script.google.com (cuenta dueña de la carpeta de Drive). Si se cambia allá, copiarlo también aquí.

## Cómo se ordena Drive (versión 2, Paquete 30)

```
FIRMAS/2026-12/       20-12-2026 · D-00041 · AGRICOLA BP · Firma cliente Juan Pérez.png
                      20-12-2026 · D-00041 · AGRICOLA BP · Firma chofer Pedro Soto.png
FOTOS/2026-12/        20-12-2026 · D-00041 · AGRICOLA BP · Foto 1.jpg
ARCHIVOS/2026-12/     20-12-2026 · D-00041 · AGRICOLA BP · Archivo guia 123.pdf
CONSTANCIAS/2026-12/  20-12-2026 · D-00041 · AGRICOLA BP · Constancia.pdf
DOCUMENTOS CAM-02/    documentos de cada vehículo o equipo
```
Los respaldos anteriores a la versión 2 quedaron en una carpeta por folio (D-00041) y siguen funcionando.

## Publicar un cambio del script

En script.google.com → el proyecto → pegar el código → Guardar → **Implementar → Administrar implementaciones →
lápiz (Editar) → Versión: Nueva versión → Implementar**. Así la URL no cambia. (Si se usa "Nueva implementación",
la URL cambia y hay que actualizar `src/lib/drive.js`.)
