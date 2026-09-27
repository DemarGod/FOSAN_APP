# FOSAN · aplicación web

Gestión de baños químicos, flota, clientes, mantenciones y utilidades.
React + Vite, conectada a Supabase.

## 1. Configurar en local

```bash
npm install
cp .env.example .env     # y pega la anon key
npm run dev
```

El archivo `.env` debe quedar así:

```
VITE_SUPABASE_URL=https://vamgboklvsuzejbnxvip.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

`.env` está en `.gitignore`: nunca se sube al repositorio.

## 2. Base de datos

El esquema está en la carpeta `supabase/` del proyecto original y ya fue ejecutado
(`01_schema.sql` → `02_rls.sql` → `03_seed.sql`).

Los accesos se crean en **Supabase → Authentication → Users**, con los correos que
están en la tabla `accesos_autorizados`. El perfil y el rol se generan solos:
`dueno` puede crear y editar, `lectura` solo consulta y exporta.

## 3. Subir a GitHub

```bash
git init
git add .
git commit -m "FOSAN: aplicación web"
git branch -M main
git remote add origin https://github.com/<usuario>/fosan.git
git push -u origin main
```

## 4. Publicar en Netlify

1. **Add new site → Import an existing project** y elegir el repositorio.
2. La configuración de build ya viene en `netlify.toml` (`npm run build` → `dist`).
3. En **Site settings → Environment variables**, agregar `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY`.
4. En Supabase, **Authentication → URL Configuration**, agregar el dominio de
   Netlify a *Site URL* y *Redirect URLs*.

Cada push a `main` publica una versión nueva.

## 5. Qué hay en cada pantalla

| Ruta | Contenido | Datos |
| --- | --- | --- |
| `/` | Inicio: KPIs, estado de activos, servicios del mes, actividad, alertas, mapa | `v_resumen_inventario`, `v_estado_activos`, `v_servicios_mes`, `v_mapa_puntos`, `v_utilidad_mensual` |
| `/inventario` | Todos los activos, con segmentos bodega / terreno / mantención | `v_inventario` |
| `/banos` | Solo baños químicos | `v_inventario`, `v_banos_kpi` |
| `/camiones` | Flota con patente y documentación | `vehiculos` + `activos` |
| `/clientes` | Contratos, facturación y georreferencia | `v_clientes_resumen` |
| `/utilidades` | Ventas, costos, margen por mes y por servicio | `v_utilidad_mensual`, `v_utilidad_por_servicio` |
| `/mantenciones` | Programadas y realizadas | `mantenciones`, `v_mantenciones_kpi` |
| `/ubicaciones` | Mapa completo y listado de puntos | `v_mapa_puntos` |
| `/reportes` | Top clientes y exportación a Excel | `v_top_clientes`, vistas `export_*` |
| `/configuracion` | Usuarios y roles | `perfiles` |
| `/activo/:qr_token` | Ficha de la unidad: datos, QR, ubicación, historial, documentos, observaciones | `activos` y tablas relacionadas |

## 6. Códigos QR

Cada activo tiene un `qr_token` único. El QR debe apuntar a:

```
https://<tu-dominio-netlify>/activo/<qr_token>
```

El token no cambia aunque se modifique el código interno de la unidad.

## 7. Qué falta

- Cargar la facturación real desde el ERP Maxxa en las tablas `ventas` y `costos`.
- Subir fotografías y documentos al bucket de Supabase Storage (la ficha ya los muestra).
- Importar clientes y activos desde las planillas Excel actuales.
