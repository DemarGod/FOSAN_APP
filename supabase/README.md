# Base de datos de FOSAN (Supabase / PostgreSQL)

Esta carpeta tiene todo lo necesario para entender, revisar o volver a montar la base de datos de la app.

```
supabase/
├── README.md        ← este archivo
├── esquema/         ← CÓMO ESTÁ LA BASE HOY (fuente de verdad)
│   ├── 00_extensiones_tipos.sql
│   ├── 01_tablas.sql
│   ├── 02_funciones.sql
│   ├── 03_vistas.sql
│   ├── 04_triggers.sql
│   ├── 05_seguridad.sql
│   └── 06_storage.sql
├── historial/       ← CÓMO SE LLEGÓ A ESO (scripts originales, en orden)
│   └── README.md    ← índice: qué hizo cada script
└── herramientas/
    └── armar_esquema.py  ← regenera esquema/ desde la foto de la base
```

- **`esquema/`** se generó directamente desde la base de producción (no se escribió a mano), así que refleja exactamente lo que existe.
  Si hay dudas entre `esquema/` e `historial/`, manda `esquema/`.
- **`historial/`** sirve para entender *por qué* algo es como es (cada script explica el cambio en su encabezado).
  **No** hay que volver a correrlo: varios scripts se corrigieron con otros posteriores.

Foto tomada el **10/11/2026**: 49 tablas, 93 funciones, 19 vistas, 73 triggers, 161 reglas de seguridad.

## Montar una base nueva (por ejemplo, para pruebas)

1. Crear un proyecto en Supabase.
2. En **SQL Editor**, correr los archivos de `esquema/` **en orden**: `00` → `01` → `02` → `03` → `04` → `05` → `06`.
   (Si el editor avisa "creates a table without enabling RLS", elegir *Run without RLS*: la seguridad se activa en `05`.)
3. Cargar los catálogos y datos (la foto trae la estructura, no los datos).
4. Crear el primer usuario en **Authentication → Users** con un correo que esté en la tabla `accesos_autorizados`;
   el trigger `trg_perfil_auth` le crea su perfil solo.

Se probó montando los 7 archivos en un Postgres limpio: se crean sin errores y con la misma cantidad de tablas, funciones, vistas, triggers y reglas que producción.

## Cómo está organizada

### Módulos y tablas principales

| Módulo de la app | Tablas |
| --- | --- |
| Usuarios, roles y permisos | `perfiles`, `roles_app`, `permisos_rol`, `accesos_autorizados`, `personal` |
| Clientes | `clientes`, `cliente_contactos`, `servicios_cliente`, `rubros` |
| Inventario (baños y equipos) | `activos`, `modelos_bano`, `categorias`, `movimientos_activo`, `observaciones_activo`, `documentos_activo` |
| Insumos y EPP | `insumos`, `insumo_lotes`, `insumo_existencias`, `movimientos_insumo`, `unidades_medida`, `receta_limpieza` |
| Operaciones (entregas, retiros, limpiezas) | `despachos`, `despacho_banos`, `operacion_respaldos` |
| Rutas | `rutas_semana`, `rutas_semana_lineas`, `salidas`, `salida_paradas`, `rutas`, `ruta_paradas` |
| Flota | `vehiculos` (+ `activos` tipo camión/camioneta), `vehiculo_disponibilidad` |
| Mantenimiento | `mantenciones` |
| Finanzas y abastecimiento | `ventas`, `costos`, `compras`, `compra_lineas`, `proveedores`, `servicios`, `servicio_activos` |
| Mapa | `ubicaciones` |
| Calendario y avisos | `eventos`, `notificaciones` |
| Sistema | `ajustes`, `parametros`, `auditoria` (historial de cambios), `importaciones`, `ocupacion_diaria`, `_vistas_42` (registro técnico del script 42) |

### Reglas importantes (las aplica la base, no solo la app)

- **Nada se borra**: clientes, equipos y vehículos se *desactivan* o se *dan de baja* con fecha y motivo; el historial se conserva.
- **Folios correlativos**: operaciones `D-00001`, mantenciones `MANT-###`, servicios, códigos de cliente (secuencias en `00`).
- **Equipos externos** (del cliente) usan su propia serie `EXT-###`; nunca un número de unidad FOSAN.
- **Nombres propios en MAYÚSCULAS**: clientes, ubicaciones, contactos y rutas (triggers en `04`).
- **Un equipo "En mantenimiento" siempre tiene una orden abierta** (`asegurar_orden_mantencion`).
- **Un baño no puede estar en dos entregas o dos retiros programados a la vez** (`validar_bano_unico`).
- **La fecha de una operación debe estar dentro del servicio** del cliente (`validar_fecha_operacion`).
- **Auditoría**: cada alta, cambio o eliminación queda en `auditoria` con quién, cuándo y qué cambió (`registrar_auditoria`).

### Seguridad

- Todas las tablas tienen **RLS** (seguridad por filas) activada.
- Permisos por **rol** y **sección**: `permisos_rol` define qué puede ver/editar cada rol en cada sección;
  las funciones `es_dueno()`, `tiene_acceso()`, `permiso_seccion(seccion, nivel)`, `ve_finanzas()` y `es_planificador()` lo consultan.
- El **operador** solo lee lo de su ruta: reglas restrictivas `op_limite` (ver `historial/42_seguridad_operador.sql`).
- El acceso **anónimo** (sin iniciar sesión) a tablas y vistas está cerrado; el login usa la función `correo_para_login`.
- Las acciones de la app (dar de baja, confirmar operación, cerrar mantención, crear usuario...) son **funciones `security definer`**
  que validan permisos por dentro; la app las llama con `supabase.rpc('nombre', {...})`.

### Archivos

Bucket `fosan` en Storage: respaldos de operaciones (fotos y firmas). Los documentos de vehículos y equipos se guardan como enlace (Drive).

## Cómo hacer cambios de aquí en adelante

1. Escribir el cambio en un script nuevo: `historial/NN_descripcion.sql` (siguiente número libre), con un encabezado que explique qué hace y por qué.
2. Correrlo en Supabase → SQL Editor.
3. Volver a sacar la foto (`historial/46_foto_base_SOLO_LECTURA.sql` → Export → CSV) y regenerar `esquema/` con
   `python supabase/herramientas/armar_esquema.py foto_base.csv supabase/esquema`, para que siga reflejando la base real.
4. Subir todo a GitHub en el mismo commit que el cambio de la app.

No guardar scripts sueltos solo en el SQL Editor de Supabase: lo que no está en este repositorio, no existe para el próximo programador.
