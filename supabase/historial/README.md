# Historial de scripts de la base de datos

Scripts **originales**, en el orden en que se corrieron en Supabase. Sirven para entender por qué la base es como es.
**No se vuelven a correr**: la base actual está en `../esquema/` (ver `../README.md`).

## Etapa inicial (versión 1 de la app)

| Script | Qué hizo |
| --- | --- |
| `01_schema.sql` | Esquema inicial: inventario, baños, camiones, clientes, ubicaciones, mantenciones, ventas, QR por unidad, documentos, calendario y avisos. |
| `02_rls.sql` | Primeras reglas de acceso (dueños con control total, usuarios de solo lectura) y bucket de archivos. |
| `03_seed.sql` | Catálogos y datos de ejemplo iniciales. |
| `04_logistica.sql` | Clientes mejorados y logística: transporte, insumos, despachos, rutas y costos. |
| `05_historial.sql` | Auditoría: la base registra quién creó, modificó o eliminó cada registro. |

Entre `05` y `21` hubo cambios que se corrieron **solo desde el SQL Editor** y no quedaron en el repositorio
(creación y automatización de usuarios, acceso de la secretaria, rutas semanales, costo del camión, configuración, permisos por rol,
limpieza de clientes, importación desde Maxxa, entre otros). Su resultado **sí está** en `../esquema/`, que se sacó de la base real.

## Estandarización (noviembre 2026)

| Script | Paquete | Qué hizo |
| --- | --- | --- |
| `21_estandarizacion_base.sql` | Etapa 1 | Base de datos y catálogos estandarizados; copia los datos actuales a la nueva estructura. |
| `23_clientes_servicios.sql` | 1 | Clientes se desactivan con motivo (no se borran); equipos externos con serie `EXT-###`. |
| `24_servicios_cliente.sql` | 5 | Servicios del cliente: acceso/restricciones para fosas; la base recalcula lo contratado desde los servicios vigentes. |
| `25_personal_usuarios.sql` | 6b | Personal y usuarios: nombre de usuario (ej. `ana.perez`) además del correo para iniciar sesión. |
| `26_inventario_equipos.sql` | 7a | Inventario → Equipos: situación, condición, propiedad y ubicaciones internas. |
| `27_ficha_equipo.sql` | 7b | Ficha del equipo: datos de la baja (fecha, motivo, observaciones). |
| `28_insumos_epp.sql` | 7c | Insumos y EPP: control por lote, vencimientos y existencias. |
| `29_operaciones.sql` | 8a | Operaciones → Programación: una operación es un despacho (`D-00001`). |
| `31_respaldos.sql` | 8b | Respaldos de cada operación (fotos, guías) y ejecución confirmada. |
| `32_respaldos_ruta.sql` | 8d | Respaldos (firma y fotos) desde Mi ruta. |
| `33_flota.sql` | 9 | Flota: patente normalizada y única, disponibilidad de vehículos. |
| `34_correcciones_equipo.sql` | 9c | Correcciones: situación "Reservado" y ajustes de Operaciones, Inventario y Clientes. |
| `35_mantenimiento.sql` | 10 | Mantenimiento: folio `MANT-###`, datos del trabajo, cierre con condición final. |
| `37_ajustes.sql` | 16 | Ajustes generales de la app (ej. mostrar "Mi ruta" en el menú del dueño). |
| `38_roles.sql` | 17 | Roles con nombre propio (ej. "Ejecutivo de ventas") y plantillas de permisos. |
| `40_seguridad_anon.sql` | 19 | Seguridad 1: cierra el acceso anónimo (sin iniciar sesión) a tablas y vistas. |
| `42_seguridad_operador.sql` | 19 | Seguridad 2: el operador solo lee lo de su ruta (reglas `op_limite`). |
| `43_correcciones_revision.sql` | 20 | Revisiones del equipo: orden de mantenimiento obligatoria, fecha de operación dentro del servicio, MAYÚSCULAS, documentos con vencimiento. |
| `44_planificar_rutas.sql` | 21 | Quién planifica rutas semanales: dueño o rol con permiso de registrar en Operaciones. |
| `45_operaciones_duplicadas.sql` | 22 | Un baño no puede estar en dos entregas o dos retiros programados a la vez. |
| `46_foto_base_SOLO_LECTURA.sql` | 25 | Solo lectura: saca la "foto" de la base para regenerar `../esquema/`. |

Números que faltan (`22`, `30`, `36`, `39`, `41`): eran consultas de solo lectura o diagnósticos y se retiraron del repositorio.
