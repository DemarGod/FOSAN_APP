# Conectar FOSAN a Supabase, GitHub y Netlify

Todo el modelo de datos vive en esta carpeta. Se ejecuta una sola vez, en orden.

## 1. Base de datos en Supabase

1. Crear el proyecto en [supabase.com](https://supabase.com) (región South America · São Paulo).
2. Abrir **SQL Editor** y ejecutar, en este orden:
   - `01_schema.sql` — tablas, vistas, triggers.
   - `02_rls.sql` — permisos por rol y bucket de archivos.
   - `03_seed.sql` — catálogos y datos de ejemplo.
3. En **Authentication → Users → Add user**, crear los cuatro accesos con los correos que están en la tabla `accesos_autorizados` de `03_seed.sql`. El perfil y el rol se crean solos:
   - `anselmo@fosan.cl` y `gonzalo@fosan.cl` quedan como `dueno` (control total).
   - `usuario3@fosan.cl` y `usuario4@fosan.cl` quedan como `lectura` (consultan y exportan, no modifican).
   Para cambiar los correos o agregar a alguien, edita `accesos_autorizados`; un correo que no esté en esa tabla no obtiene acceso.
4. En **Project Settings → API**, copiar `Project URL` y `anon public key`.

## 2. Qué guarda cada tabla

| Tabla | Para qué |
| --- | --- |
| `perfiles` | Los cuatro accesos y su rol |
| `clientes` | Empresa, contacto, comuna, contrato y coordenadas |
| `ubicaciones` | Bodega, taller y faenas, con lat/lng para el mapa |
| `modelos_bano` | Básico, Premium, Accesible y su valor de referencia |
| `activos` | Una fila por unidad: baños, camiones, generadores, accesorios, con `qr_token` |
| `vehiculos` | Patente, marca, capacidad, conductor, revisión técnica y permiso |
| `movimientos_activo` | Trazabilidad: cada traslado y cambio de estado |
| `documentos_activo` | Facturas, certificados y guías de cada unidad |
| `observaciones_activo` | Notas de terreno por unidad |
| `servicios` / `servicio_activos` | Arriendo, limpieza de baños y de fosas, con costo de transporte aparte |
| `mantenciones` | Baños, camiones y camionetas en una sola tabla, con clase y costo |
| `ventas` / `costos` | Facturación de Maxxa y costos, base de utilidades y márgenes |
| `proveedores` / `insumos` / `compras` | Abastecimiento (SAYPOR concentra cerca del 90%) |
| `eventos` | Calendario: mantenciones, pagos, servicios, alertas, reuniones |
| `notificaciones` | Avisos de la campana |

## 3. Vistas que consume la app

- Inicio: `v_resumen_inventario`, `v_estado_activos`, `v_servicios_mes`, `v_mapa_puntos`
- Baños e inventario: `v_banos_kpi`, `v_inventario`
- Clientes: `v_clientes_resumen`
- Mantenciones: `v_mantenciones_kpi`
- Utilidades y ventas: `v_ventas_mensual`, `v_utilidad_mensual`, `v_utilidad_por_servicio`, `v_top_clientes`
- Exportación a Excel (una vista por pestaña del libro): `export_ingresos_costos`, `export_ventas_utilidad`, `export_servicios`, `export_activos`, `export_mantenciones`, `export_clientes`

## 4. Códigos QR

Cada activo nace con un `qr_token` único. El QR apunta a la ficha de esa unidad:

```
https://<tu-dominio>/activo/<qr_token>
```

Nunca se repite entre unidades y sobrevive a cambios de código interno.

## 5. Variables de entorno

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Nunca subir el archivo `.env` al repositorio: agregarlo a `.gitignore` antes del primer commit. Si ya se subió, rotar la clave en Supabase.

## 6. GitHub

```bash
git init
echo ".env" >> .gitignore
git add .
git commit -m "FOSAN: app y esquema de base de datos"
git branch -M main
git remote add origin https://github.com/<usuario>/fosan.git
git push -u origin main
```

## 7. Netlify

1. **Add new site → Import an existing project** y elegir el repositorio.
2. La configuración ya viene en `netlify.toml`.
3. En **Site settings → Environment variables**, agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. En Supabase, **Authentication → URL Configuration**, agregar el dominio de Netlify a *Redirect URLs*.

Cada push a `main` publica una nueva versión.
