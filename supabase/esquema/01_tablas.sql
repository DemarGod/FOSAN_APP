-- 01 · Tablas, claves, relaciones e índices
-- Foto de la base de producción de FOSAN tomada el 10/11/2026 (generado desde la base real, no a mano).
-- Primero se crean todas las tablas; después sus claves y validaciones; al final las relaciones entre tablas
-- (así el orden de creación no importa) y los índices de búsqueda.
-- Orden para montar una base nueva: 00 → 01 → 02 → 03 → 04 → 05 → 06 (ver supabase/README.md).

-- ═══ Tablas (49) ═══

create table public._vistas_42 (
  vista text not null
);

create table public.accesos_autorizados (
  correo text not null,
  nombre text not null,
  rol rol_usuario not null
);

create table public.activos (
  id uuid default gen_random_uuid() not null,
  codigo text not null,
  tipo tipo_activo not null,
  modelo_id uuid,
  detalle text,
  serie text,
  estado estado_activo default 'disponible'::estado_activo not null,
  habilitado boolean default true not null,
  cliente_id uuid,
  ubicacion_id uuid,
  valor_arriendo integer,
  fecha_compra date,
  costo_adquisicion integer,
  foto_url text,
  qr_token uuid default gen_random_uuid() not null,
  notas text,
  creado_en timestamp with time zone default now() not null,
  actualizado_en timestamp with time zone default now() not null,
  color text,
  situacion text,
  condicion text default 'operativo'::text not null,
  propiedad text default 'empresa'::text not null,
  propietario_id uuid,
  categoria_id uuid,
  marca text,
  fecha_incorporacion date,
  servicio_id uuid,
  codigo_cliente text,
  fecha_baja date,
  motivo_baja text,
  observacion_baja text
);

create table public.ajustes (
  clave text not null,
  valor text,
  actualizado_en timestamp with time zone default now() not null
);

create table public.auditoria (
  id bigint default nextval('auditoria_id_seq'::regclass) not null,
  fecha timestamp with time zone default now() not null,
  usuario_id uuid,
  usuario_nombre text,
  usuario_rol text,
  tabla text not null,
  accion text not null,
  registro_id text,
  etiqueta text,
  cambios jsonb
);

create table public.categorias (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  clase text default 'equipo'::text not null,
  descripcion text,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null
);

create table public.cliente_contactos (
  id uuid default gen_random_uuid() not null,
  cliente_id uuid not null,
  nombre text not null,
  cargo text,
  telefono text,
  correo text,
  principal boolean default false not null,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null
);

create table public.clientes (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  rut text,
  rubro text default 'construccion'::text not null,
  contacto_nombre text,
  telefono text,
  correo text,
  direccion text,
  comuna text default 'Talca'::text,
  lat numeric(9,6),
  lng numeric(9,6),
  fecha_inicio_contrato date,
  fecha_fin_contrato date,
  valor_mensual integer,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  actualizado_en timestamp with time zone default now() not null,
  dias_limpieza smallint[],
  banos_propios integer default 0 not null,
  tipo_cliente text default 'empresa'::text not null,
  nombre_comercial text,
  observaciones text,
  codigo text default ('CLI-'::text || lpad((nextval('cliente_codigo_seq'::regclass))::text, 3, '0'::text)),
  rut_norm text generated always as (upper(regexp_replace(COALESCE(rut, ''::text), '[^0-9kK]'::text, ''::text, 'g'::text))) stored,
  motivo_desactivacion text,
  desactivado_en timestamp with time zone,
  desactivado_por uuid
);

create table public.compra_lineas (
  id bigint default nextval('compra_lineas_id_seq'::regclass) not null,
  compra_id uuid not null,
  insumo_id uuid not null,
  cantidad numeric(12,2) not null,
  costo_unitario integer not null
);

create table public.compras (
  id uuid default gen_random_uuid() not null,
  proveedor_id uuid not null,
  fecha date default CURRENT_DATE not null,
  documento text,
  total integer default 0 not null,
  creado_en timestamp with time zone default now() not null
);

create table public.costos (
  id uuid default gen_random_uuid() not null,
  fecha date not null,
  categoria categoria_costo not null,
  monto integer default 0 not null,
  servicio_id uuid,
  activo_id uuid,
  detalle text,
  creado_en timestamp with time zone default now() not null
);

create table public.despacho_banos (
  despacho_id uuid not null,
  activo_id uuid not null,
  accion text default 'entrega'::text not null
);

create table public.despachos (
  id uuid default gen_random_uuid() not null,
  folio text default ('D-'::text || lpad((nextval('folio_despacho_seq'::regclass))::text, 5, '0'::text)) not null,
  tipo text not null,
  cliente_id uuid not null,
  direccion text,
  vehiculo_id uuid,
  salida_id uuid,
  fecha_programada date default CURRENT_DATE not null,
  fecha_realizada timestamp with time zone,
  estado text default 'programado'::text not null,
  origen text default 'manual'::text not null,
  observaciones text,
  creado_en timestamp with time zone default now() not null,
  servicio_id uuid,
  ubicacion_id uuid,
  responsable_id uuid,
  motivo_cancelacion text,
  cancelado_en timestamp with time zone,
  cancelado_por uuid,
  ejecutado_por uuid,
  recibido_por text,
  resultado text,
  exceso_unidades integer,
  exceso_motivo text
);

create table public.documentos_activo (
  id uuid default gen_random_uuid() not null,
  activo_id uuid not null,
  tipo tipo_documento default 'otro'::tipo_documento not null,
  titulo text not null,
  archivo_url text not null,
  tamano_kb integer,
  subido_por uuid,
  creado_en timestamp with time zone default now() not null,
  fecha_vencimiento date,
  anulado boolean default false not null
);

create table public.eventos (
  id uuid default gen_random_uuid() not null,
  fecha date not null,
  tipo tipo_evento default 'mantencion'::tipo_evento not null,
  titulo text not null,
  activo_id uuid,
  cliente_id uuid,
  creado_por uuid,
  creado_en timestamp with time zone default now() not null
);

create table public.importaciones (
  id uuid default gen_random_uuid() not null,
  archivo text not null,
  hoja text,
  filas integer default 0 not null,
  sin_cliente integer default 0 not null,
  columnas jsonb,
  creado_por uuid,
  creado_en timestamp with time zone default now() not null
);

create table public.insumo_existencias (
  id uuid default gen_random_uuid() not null,
  insumo_id uuid not null,
  ubicacion_id uuid not null,
  lote_id uuid,
  cantidad numeric(12,3) default 0 not null,
  actualizado_en timestamp with time zone default now() not null
);

create table public.insumo_lotes (
  id uuid default gen_random_uuid() not null,
  insumo_id uuid not null,
  codigo text not null,
  vencimiento date,
  bloqueado boolean default false not null,
  creado_en timestamp with time zone default now() not null
);

create table public.insumos (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  unidad text default 'unidad'::text not null,
  stock_actual numeric(12,2) default 0 not null,
  stock_minimo numeric(12,2) default 0 not null,
  costo_unitario integer,
  uso text default 'aseo'::text not null,
  en_uso numeric,
  duracion_meses numeric,
  codigo text,
  categoria_id uuid,
  unidad_id uuid,
  activo boolean default true not null,
  control_lote boolean default false not null,
  requiere_vencimiento boolean default false not null,
  ubicacion_minimo_id uuid,
  observaciones text
);

create table public.mantenciones (
  id uuid default gen_random_uuid() not null,
  activo_id uuid not null,
  clase clase_mantencion default 'bano'::clase_mantencion not null,
  tipo text not null,
  fecha_programada date not null,
  fecha_realizada date,
  responsable_id uuid,
  responsable_ext text,
  costo integer default 0 not null,
  estado estado_mantencion default 'programada'::estado_mantencion not null,
  foto_url text,
  detalle text,
  creado_en timestamp with time zone default now() not null,
  folio text default ('MANT-'::text || lpad((nextval('mantencion_folio_seq'::regclass))::text, 3, '0'::text)),
  trabajo_requerido text,
  observaciones text,
  bloquea boolean default false not null,
  iniciada_en timestamp with time zone,
  resultado text,
  trabajo_realizado text,
  condicion_final text,
  registrado_por uuid,
  motivo_cancelacion text,
  cancelado_en timestamp with time zone,
  cancelado_por uuid
);

create table public.modelos_bano (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  tipo text,
  valor_arriendo_ref integer,
  descripcion text,
  peso_kg numeric(7,1),
  categoria_id uuid,
  activo boolean default true not null
);

create table public.movimientos_activo (
  id bigint default nextval('movimientos_activo_id_seq'::regclass) not null,
  activo_id uuid not null,
  fecha timestamp with time zone default now() not null,
  tipo text not null,
  desde_id uuid,
  hacia_id uuid,
  cliente_id uuid,
  responsable_id uuid,
  detalle text
);

create table public.movimientos_insumo (
  id bigint default nextval('movimientos_insumo_id_seq'::regclass) not null,
  insumo_id uuid not null,
  fecha timestamp with time zone default now() not null,
  cantidad numeric(12,3) not null,
  motivo text,
  tipo text,
  origen_id uuid,
  destino_id uuid,
  lote_id uuid,
  usuario_id uuid,
  referencia text,
  servicio_id uuid,
  receptor text
);

create table public.notificaciones (
  id uuid default gen_random_uuid() not null,
  texto text not null,
  nivel text default 'info'::text not null,
  activo_id uuid,
  leida boolean default false not null,
  creado_en timestamp with time zone default now() not null
);

create table public.observaciones_activo (
  id uuid default gen_random_uuid() not null,
  activo_id uuid not null,
  texto text not null,
  autor_id uuid,
  creado_en timestamp with time zone default now() not null
);

create table public.ocupacion_diaria (
  fecha date not null,
  activo_id uuid not null,
  estado text not null,
  cliente_id uuid
);

create table public.operacion_respaldos (
  id uuid default gen_random_uuid() not null,
  despacho_id uuid,
  tipo text not null,
  ruta text not null,
  nombre text,
  firmante text,
  creado_por uuid default auth.uid(),
  creado_en timestamp with time zone default now() not null,
  parada_id bigint
);

create table public.parametros (
  clave text not null,
  valor numeric,
  etiqueta text not null,
  unidad text
);

create table public.perfiles (
  id uuid not null,
  nombre text not null,
  correo text not null,
  rol rol_usuario default 'lectura'::rol_usuario not null,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  usuario text
);

create table public.permisos_rol (
  rol text not null,
  seccion text not null,
  ver boolean default false not null,
  editar boolean default false not null,
  exportar boolean default false not null
);

create table public.personal (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  rut text,
  funcion text,
  telefono text,
  perfil_id uuid,
  activo boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  rut_norm text generated always as (upper(regexp_replace(COALESCE(rut, ''::text), '[^0-9kK]'::text, ''::text, 'g'::text))) stored
);

create table public.proveedores (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  rut text,
  contacto text,
  telefono text,
  activo boolean default true not null
);

create table public.receta_limpieza (
  insumo_id uuid not null,
  cantidad numeric(12,3) not null
);

create table public.roles_app (
  clave text not null,
  nombre text not null,
  base text,
  revisado boolean default true not null,
  creado_en timestamp with time zone default now() not null
);

create table public.rubros (
  clave text not null,
  nombre text not null,
  creado_en timestamp with time zone default now() not null
);

create table public.ruta_paradas (
  id bigint default nextval('ruta_paradas_id_seq'::regclass) not null,
  ruta_id uuid not null,
  cliente_id uuid not null,
  orden integer default 1 not null,
  tarea text default 'limpieza'::text not null
);

create table public.rutas (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  dias smallint[] default '{}'::smallint[] not null,
  vehiculo_id uuid,
  activa boolean default true not null,
  notas text,
  creado_en timestamp with time zone default now() not null
);

create table public.rutas_semana (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  lunes date not null,
  operador_id uuid,
  vehiculo_id uuid,
  notas text,
  creado_en timestamp with time zone default now() not null
);

create table public.rutas_semana_lineas (
  id bigint default nextval('rutas_semana_lineas_id_seq'::regclass) not null,
  ruta_id uuid not null,
  cliente_id uuid not null,
  tarea text default 'limpieza'::text not null,
  dias smallint[] default '{}'::smallint[] not null,
  orden integer default 1 not null,
  banos uuid[] default '{}'::uuid[] not null,
  despacho_id uuid,
  nota text
);

create table public.salida_paradas (
  id bigint default nextval('salida_paradas_id_seq'::regclass) not null,
  salida_id uuid not null,
  cliente_id uuid not null,
  orden integer default 1 not null,
  tarea text default 'limpieza'::text not null,
  banos integer default 0 not null,
  hecha boolean default false not null,
  hecha_en timestamp with time zone,
  estado text default 'pendiente'::text not null,
  observacion text,
  requiere_mantencion boolean default false not null,
  despacho_id uuid,
  linea_id bigint,
  mant_tipo text,
  mant_banos text,
  mant_retirado boolean
);

create table public.salidas (
  id uuid default gen_random_uuid() not null,
  ruta_id uuid,
  fecha date not null,
  vehiculo_id uuid,
  estado text default 'planificada'::text not null,
  km_estimado numeric(8,1),
  odometro_salida integer,
  odometro_llegada integer,
  km_real numeric(8,1) generated always as (
CASE
    WHEN ((odometro_llegada IS NOT NULL) AND (odometro_salida IS NOT NULL)) THEN (odometro_llegada - odometro_salida)
    ELSE NULL::integer
END) stored,
  creado_en timestamp with time zone default now() not null,
  ruta_semana_id uuid,
  iniciada_en timestamp with time zone,
  cerrada_en timestamp with time zone
);

create table public.servicio_activos (
  servicio_id uuid not null,
  activo_id uuid not null
);

create table public.servicios (
  id uuid default gen_random_uuid() not null,
  folio text default ('S-'::text || lpad((nextval('folio_servicio_seq'::regclass))::text, 5, '0'::text)) not null,
  fecha date default CURRENT_DATE not null,
  tipo tipo_servicio not null,
  cliente_id uuid not null,
  ubicacion_id uuid,
  responsable_id uuid,
  valor integer default 0 not null,
  costo_transporte integer default 0 not null,
  estado estado_servicio default 'pendiente'::estado_servicio not null,
  observaciones text,
  creado_en timestamp with time zone default now() not null
);

create table public.servicios_cliente (
  id uuid default gen_random_uuid() not null,
  codigo text default ('SER-'::text || lpad((nextval('servicio_cliente_seq'::regclass))::text, 3, '0'::text)) not null,
  cliente_id uuid not null,
  ubicacion_id uuid,
  tipo text not null,
  fecha_inicio date default CURRENT_DATE not null,
  fecha_termino date,
  contacto_id uuid,
  observaciones text,
  estado text default 'vigente'::text not null,
  categoria_id uuid,
  cantidad integer,
  frecuencia text,
  limpiezas_semana integer,
  dias integer[],
  modalidad text,
  volumen_m3 numeric(8,2),
  valor_mensual integer,
  creado_en timestamp with time zone default now() not null,
  acceso text
);

create table public.ubicaciones (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  tipo tipo_ubicacion default 'faena'::tipo_ubicacion not null,
  cliente_id uuid,
  direccion text,
  comuna text,
  lat numeric(9,6),
  lng numeric(9,6),
  activa boolean default true not null,
  creado_en timestamp with time zone default now() not null,
  descripcion text,
  indicaciones text,
  contacto_id uuid,
  vehiculo_id uuid
);

create table public.unidades_medida (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  abreviatura text not null,
  activo boolean default true not null
);

create table public.vehiculo_disponibilidad (
  id bigint default nextval('vehiculo_disponibilidad_id_seq'::regclass) not null,
  activo_id uuid not null,
  estado text not null,
  fecha date not null,
  motivo text not null,
  creado_por uuid default auth.uid(),
  creado_en timestamp with time zone default now() not null
);

create table public.vehiculos (
  activo_id uuid not null,
  patente text,
  marca text,
  modelo text,
  anio integer,
  capacidad_litros integer,
  conductor text,
  kilometraje integer,
  revision_tecnica date,
  permiso_circulacion date,
  seguro_obligatorio date,
  tipo_vehiculo text default 'camion_limpiafosas'::text,
  capacidad_kg integer,
  capacidad_banos integer,
  rend_vacio numeric(6,2),
  rend_cargado numeric(6,2),
  valor_compra integer,
  vida_util_km integer,
  costo_mant_km integer,
  costo_fijo_anual integer,
  km_anual integer,
  fecha_registro date default CURRENT_DATE,
  observaciones text
);

create table public.ventas (
  id uuid default gen_random_uuid() not null,
  folio_maxxa text,
  fecha date not null,
  cliente_id uuid,
  servicio_id uuid,
  tipo_servicio tipo_servicio,
  neto integer default 0 not null,
  iva integer default 0 not null,
  total integer default 0 not null,
  pagada boolean default false not null,
  fecha_pago date,
  origen text default 'maxxa'::text not null,
  creado_en timestamp with time zone default now() not null,
  cliente_texto text,
  rut_texto text,
  datos jsonb,
  importacion_id uuid
);

-- ═══ Claves primarias, únicas y validaciones (96) ═══

alter table public._vistas_42 add constraint _vistas_42_pkey PRIMARY KEY (vista);
alter table public.accesos_autorizados add constraint accesos_autorizados_pkey PRIMARY KEY (correo);
alter table public.activos add constraint activos_codigo_key UNIQUE (codigo);
alter table public.activos add constraint activos_condicion_chk CHECK ((condicion = ANY (ARRAY['operativo'::text, 'requiere_limpieza'::text, 'requiere_reparacion'::text, 'sin_evaluar'::text])));
alter table public.activos add constraint activos_externo_chk CHECK ((((propiedad = 'cliente'::text) = (codigo ~~* 'EXT-%'::text)) AND ((propiedad <> 'cliente'::text) OR (propietario_id IS NOT NULL))));
alter table public.activos add constraint activos_numero_unidad_chk CHECK (((tipo <> 'bano_quimico'::tipo_activo) OR (propiedad <> 'empresa'::text) OR (codigo ~ '^[0-9]*[1-9][0-9]*$'::text)));
alter table public.activos add constraint activos_pkey PRIMARY KEY (id);
alter table public.activos add constraint activos_propiedad_chk CHECK ((propiedad = ANY (ARRAY['empresa'::text, 'cliente'::text])));
alter table public.activos add constraint activos_qr_token_key UNIQUE (qr_token);
alter table public.activos add constraint activos_situacion_chk CHECK ((situacion = ANY (ARRAY['disponible'::text, 'reservado'::text, 'asignado'::text, 'en_traslado'::text, 'en_mantenimiento'::text, 'no_localizado'::text, 'baja'::text])));
alter table public.ajustes add constraint ajustes_pkey PRIMARY KEY (clave);
alter table public.auditoria add constraint auditoria_accion_check CHECK ((accion = ANY (ARRAY['crear'::text, 'modificar'::text, 'eliminar'::text])));
alter table public.auditoria add constraint auditoria_pkey PRIMARY KEY (id);
alter table public.categorias add constraint categorias_clase_check CHECK ((clase = ANY (ARRAY['equipo'::text, 'insumo'::text, 'epp'::text])));
alter table public.categorias add constraint categorias_nombre_key UNIQUE (nombre);
alter table public.categorias add constraint categorias_pkey PRIMARY KEY (id);
alter table public.cliente_contactos add constraint cliente_contactos_pkey PRIMARY KEY (id);
alter table public.clientes add constraint clientes_pkey PRIMARY KEY (id);
alter table public.clientes add constraint clientes_rut_key UNIQUE (rut);
alter table public.clientes add constraint clientes_tipo_cliente_check CHECK ((tipo_cliente = ANY (ARRAY['empresa'::text, 'persona'::text])));
alter table public.compra_lineas add constraint compra_lineas_pkey PRIMARY KEY (id);
alter table public.compras add constraint compras_pkey PRIMARY KEY (id);
alter table public.costos add constraint costos_pkey PRIMARY KEY (id);
alter table public.despacho_banos add constraint despacho_banos_accion_check CHECK ((accion = ANY (ARRAY['entrega'::text, 'retiro'::text])));
alter table public.despacho_banos add constraint despacho_banos_pkey PRIMARY KEY (despacho_id, activo_id);
alter table public.despachos add constraint despachos_estado_check CHECK ((estado = ANY (ARRAY['programado'::text, 'hecho'::text, 'cancelado'::text])));
alter table public.despachos add constraint despachos_folio_key UNIQUE (folio);
alter table public.despachos add constraint despachos_pkey PRIMARY KEY (id);
alter table public.despachos add constraint despachos_tipo_check CHECK ((tipo = ANY (ARRAY['entrega'::text, 'retiro'::text, 'cambio'::text, 'limpieza'::text])));
alter table public.documentos_activo add constraint documentos_activo_pkey PRIMARY KEY (id);
alter table public.eventos add constraint eventos_pkey PRIMARY KEY (id);
alter table public.importaciones add constraint importaciones_pkey PRIMARY KEY (id);
alter table public.insumo_existencias add constraint insumo_existencias_pkey PRIMARY KEY (id);
alter table public.insumo_lotes add constraint insumo_lotes_insumo_id_codigo_key UNIQUE (insumo_id, codigo);
alter table public.insumo_lotes add constraint insumo_lotes_pkey PRIMARY KEY (id);
alter table public.insumos add constraint insumos_pkey PRIMARY KEY (id);
alter table public.insumos add constraint insumos_uso_chk CHECK ((uso = ANY (ARRAY['aseo'::text, 'fijo'::text])));
alter table public.insumos add constraint insumos_venc_lote_chk CHECK (((NOT requiere_vencimiento) OR control_lote));
alter table public.mantenciones add constraint mantenciones_pkey PRIMARY KEY (id);
alter table public.modelos_bano add constraint modelos_bano_nombre_key UNIQUE (nombre);
alter table public.modelos_bano add constraint modelos_bano_pkey PRIMARY KEY (id);
alter table public.movimientos_activo add constraint movimientos_activo_pkey PRIMARY KEY (id);
alter table public.movimientos_insumo add constraint movimientos_insumo_pkey PRIMARY KEY (id);
alter table public.notificaciones add constraint notificaciones_pkey PRIMARY KEY (id);
alter table public.observaciones_activo add constraint observaciones_activo_pkey PRIMARY KEY (id);
alter table public.ocupacion_diaria add constraint ocupacion_diaria_pkey PRIMARY KEY (fecha, activo_id);
alter table public.operacion_respaldos add constraint operacion_respaldos_origen_chk CHECK (((despacho_id IS NOT NULL) OR (parada_id IS NOT NULL)));
alter table public.operacion_respaldos add constraint operacion_respaldos_pkey PRIMARY KEY (id);
alter table public.operacion_respaldos add constraint operacion_respaldos_tipo_check CHECK ((tipo = ANY (ARRAY['archivo'::text, 'firma'::text])));
alter table public.parametros add constraint parametros_pkey PRIMARY KEY (clave);
alter table public.perfiles add constraint perfiles_correo_key UNIQUE (correo);
alter table public.perfiles add constraint perfiles_pkey PRIMARY KEY (id);
alter table public.perfiles add constraint perfiles_usuario_formato CHECK (((usuario IS NULL) OR (usuario ~ '^[a-z0-9._-]{3,40}$'::text)));
alter table public.permisos_rol add constraint permisos_rol_pkey PRIMARY KEY (rol, seccion);
alter table public.personal add constraint personal_perfil_id_key UNIQUE (perfil_id);
alter table public.personal add constraint personal_pkey PRIMARY KEY (id);
alter table public.proveedores add constraint proveedores_pkey PRIMARY KEY (id);
alter table public.proveedores add constraint proveedores_rut_key UNIQUE (rut);
alter table public.receta_limpieza add constraint receta_limpieza_pkey PRIMARY KEY (insumo_id);
alter table public.roles_app add constraint roles_app_nombre_key UNIQUE (nombre);
alter table public.roles_app add constraint roles_app_pkey PRIMARY KEY (clave);
alter table public.rubros add constraint rubros_nombre_key UNIQUE (nombre);
alter table public.rubros add constraint rubros_pkey PRIMARY KEY (clave);
alter table public.ruta_paradas add constraint ruta_paradas_pkey PRIMARY KEY (id);
alter table public.ruta_paradas add constraint ruta_paradas_tarea_check CHECK ((tarea = ANY (ARRAY['limpieza'::text, 'entrega'::text, 'retiro'::text])));
alter table public.rutas add constraint rutas_pkey PRIMARY KEY (id);
alter table public.rutas_semana add constraint rutas_semana_lunes_check CHECK ((EXTRACT(isodow FROM lunes) = (1)::numeric));
alter table public.rutas_semana add constraint rutas_semana_pkey PRIMARY KEY (id);
alter table public.rutas_semana_lineas add constraint rutas_semana_lineas_pkey PRIMARY KEY (id);
alter table public.rutas_semana_lineas add constraint rutas_semana_lineas_tarea_check CHECK ((tarea = ANY (ARRAY['limpieza'::text, 'entrega'::text, 'retiro'::text, 'cambio'::text])));
alter table public.salida_paradas add constraint salida_paradas_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'hecha'::text, 'no_realizada'::text])));
alter table public.salida_paradas add constraint salida_paradas_pkey PRIMARY KEY (id);
alter table public.salidas add constraint salidas_estado_check CHECK ((estado = ANY (ARRAY['planificada'::text, 'cerrada'::text, 'cancelada'::text])));
alter table public.salidas add constraint salidas_pkey PRIMARY KEY (id);
alter table public.salidas add constraint salidas_ruta_id_fecha_key UNIQUE (ruta_id, fecha);
alter table public.servicio_activos add constraint servicio_activos_pkey PRIMARY KEY (servicio_id, activo_id);
alter table public.servicios add constraint servicios_folio_key UNIQUE (folio);
alter table public.servicios add constraint servicios_pkey PRIMARY KEY (id);
alter table public.servicios_cliente add constraint servicios_cliente_cantidad_check CHECK (((cantidad IS NULL) OR (cantidad > 0)));
alter table public.servicios_cliente add constraint servicios_cliente_check CHECK (((fecha_termino IS NULL) OR (fecha_termino >= fecha_inicio)));
alter table public.servicios_cliente add constraint servicios_cliente_codigo_key UNIQUE (codigo);
alter table public.servicios_cliente add constraint servicios_cliente_estado_check CHECK ((estado = ANY (ARRAY['vigente'::text, 'finalizado'::text])));
alter table public.servicios_cliente add constraint servicios_cliente_frecuencia_check CHECK ((frecuencia = ANY (ARRAY['semanal'::text, 'quincenal'::text, 'mensual'::text])));
alter table public.servicios_cliente add constraint servicios_cliente_limpiezas_semana_check CHECK (((limpiezas_semana IS NULL) OR ((limpiezas_semana >= 0) AND (limpiezas_semana <= 7))));
alter table public.servicios_cliente add constraint servicios_cliente_modalidad_check CHECK ((modalidad = ANY (ARRAY['puntual'::text, 'recurrente'::text])));
alter table public.servicios_cliente add constraint servicios_cliente_pkey PRIMARY KEY (id);
alter table public.servicios_cliente add constraint servicios_cliente_tipo_check CHECK ((tipo = ANY (ARRAY['arriendo_limpieza'::text, 'limpieza_cliente'::text, 'limpieza_fosas'::text])));
alter table public.ubicaciones add constraint ubicaciones_pkey PRIMARY KEY (id);
alter table public.unidades_medida add constraint unidades_medida_abreviatura_key UNIQUE (abreviatura);
alter table public.unidades_medida add constraint unidades_medida_nombre_key UNIQUE (nombre);
alter table public.unidades_medida add constraint unidades_medida_pkey PRIMARY KEY (id);
alter table public.vehiculo_disponibilidad add constraint vehiculo_disponibilidad_pkey PRIMARY KEY (id);
alter table public.vehiculos add constraint vehiculos_patente_key UNIQUE (patente);
alter table public.vehiculos add constraint vehiculos_pkey PRIMARY KEY (activo_id);
alter table public.ventas add constraint ventas_folio_maxxa_key UNIQUE (folio_maxxa);
alter table public.ventas add constraint ventas_pkey PRIMARY KEY (id);

-- ═══ Relaciones entre tablas (claves foráneas) (88) ═══

alter table public.activos add constraint activos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id);
alter table public.activos add constraint activos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.activos add constraint activos_modelo_id_fkey FOREIGN KEY (modelo_id) REFERENCES modelos_bano(id) ON DELETE SET NULL;
alter table public.activos add constraint activos_propietario_id_fkey FOREIGN KEY (propietario_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.activos add constraint activos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios_cliente(id) ON DELETE SET NULL;
alter table public.activos add constraint activos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id) ON DELETE SET NULL;
alter table public.cliente_contactos add constraint cliente_contactos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
alter table public.clientes add constraint clientes_rubro_fkey FOREIGN KEY (rubro) REFERENCES rubros(clave) ON UPDATE CASCADE;
alter table public.compra_lineas add constraint compra_lineas_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE;
alter table public.compra_lineas add constraint compra_lineas_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE RESTRICT;
alter table public.compras add constraint compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE RESTRICT;
alter table public.costos add constraint costos_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE SET NULL;
alter table public.costos add constraint costos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE SET NULL;
alter table public.despacho_banos add constraint despacho_banos_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.despacho_banos add constraint despacho_banos_despacho_id_fkey FOREIGN KEY (despacho_id) REFERENCES despachos(id) ON DELETE CASCADE;
alter table public.despachos add constraint despachos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
alter table public.despachos add constraint despachos_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES personal(id);
alter table public.despachos add constraint despachos_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES salidas(id) ON DELETE SET NULL;
alter table public.despachos add constraint despachos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios_cliente(id);
alter table public.despachos add constraint despachos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
alter table public.despachos add constraint despachos_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES activos(id) ON DELETE SET NULL;
alter table public.documentos_activo add constraint documentos_activo_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.documentos_activo add constraint documentos_activo_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES perfiles(id);
alter table public.eventos add constraint eventos_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE SET NULL;
alter table public.eventos add constraint eventos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.eventos add constraint eventos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES perfiles(id);
alter table public.importaciones add constraint importaciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES perfiles(id);
alter table public.insumo_existencias add constraint insumo_existencias_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id);
alter table public.insumo_existencias add constraint insumo_existencias_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES insumo_lotes(id);
alter table public.insumo_existencias add constraint insumo_existencias_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id);
alter table public.insumo_lotes add constraint insumo_lotes_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id);
alter table public.insumos add constraint insumos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id);
alter table public.insumos add constraint insumos_ubicacion_minimo_id_fkey FOREIGN KEY (ubicacion_minimo_id) REFERENCES ubicaciones(id);
alter table public.insumos add constraint insumos_unidad_id_fkey FOREIGN KEY (unidad_id) REFERENCES unidades_medida(id);
alter table public.mantenciones add constraint mantenciones_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.mantenciones add constraint mantenciones_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES perfiles(id);
alter table public.modelos_bano add constraint modelos_bano_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id);
alter table public.movimientos_activo add constraint movimientos_activo_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.movimientos_activo add constraint movimientos_activo_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.movimientos_activo add constraint movimientos_activo_desde_id_fkey FOREIGN KEY (desde_id) REFERENCES ubicaciones(id);
alter table public.movimientos_activo add constraint movimientos_activo_hacia_id_fkey FOREIGN KEY (hacia_id) REFERENCES ubicaciones(id);
alter table public.movimientos_activo add constraint movimientos_activo_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES perfiles(id);
alter table public.movimientos_insumo add constraint movimientos_insumo_destino_id_fkey FOREIGN KEY (destino_id) REFERENCES ubicaciones(id);
alter table public.movimientos_insumo add constraint movimientos_insumo_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE;
alter table public.movimientos_insumo add constraint movimientos_insumo_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES insumo_lotes(id);
alter table public.movimientos_insumo add constraint movimientos_insumo_origen_id_fkey FOREIGN KEY (origen_id) REFERENCES ubicaciones(id);
alter table public.movimientos_insumo add constraint movimientos_insumo_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios_cliente(id);
alter table public.movimientos_insumo add constraint movimientos_insumo_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES perfiles(id);
alter table public.notificaciones add constraint notificaciones_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE SET NULL;
alter table public.observaciones_activo add constraint observaciones_activo_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.observaciones_activo add constraint observaciones_activo_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES perfiles(id);
alter table public.ocupacion_diaria add constraint ocupacion_diaria_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.ocupacion_diaria add constraint ocupacion_diaria_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.operacion_respaldos add constraint operacion_respaldos_despacho_id_fkey FOREIGN KEY (despacho_id) REFERENCES despachos(id);
alter table public.perfiles add constraint perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.personal add constraint personal_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.receta_limpieza add constraint receta_limpieza_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE;
alter table public.ruta_paradas add constraint ruta_paradas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
alter table public.ruta_paradas add constraint ruta_paradas_ruta_id_fkey FOREIGN KEY (ruta_id) REFERENCES rutas(id) ON DELETE CASCADE;
alter table public.rutas add constraint rutas_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES activos(id) ON DELETE SET NULL;
alter table public.rutas_semana add constraint rutas_semana_operador_id_fkey FOREIGN KEY (operador_id) REFERENCES perfiles(id) ON DELETE SET NULL;
alter table public.rutas_semana add constraint rutas_semana_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES activos(id) ON DELETE SET NULL;
alter table public.rutas_semana_lineas add constraint rutas_semana_lineas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
alter table public.rutas_semana_lineas add constraint rutas_semana_lineas_despacho_id_fkey FOREIGN KEY (despacho_id) REFERENCES despachos(id) ON DELETE SET NULL;
alter table public.rutas_semana_lineas add constraint rutas_semana_lineas_ruta_id_fkey FOREIGN KEY (ruta_id) REFERENCES rutas_semana(id) ON DELETE CASCADE;
alter table public.salida_paradas add constraint salida_paradas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
alter table public.salida_paradas add constraint salida_paradas_despacho_id_fkey FOREIGN KEY (despacho_id) REFERENCES despachos(id) ON DELETE CASCADE;
alter table public.salida_paradas add constraint salida_paradas_linea_id_fkey FOREIGN KEY (linea_id) REFERENCES rutas_semana_lineas(id) ON DELETE SET NULL;
alter table public.salida_paradas add constraint salida_paradas_salida_id_fkey FOREIGN KEY (salida_id) REFERENCES salidas(id) ON DELETE CASCADE;
alter table public.salidas add constraint salidas_ruta_id_fkey FOREIGN KEY (ruta_id) REFERENCES rutas(id) ON DELETE CASCADE;
alter table public.salidas add constraint salidas_ruta_semana_id_fkey FOREIGN KEY (ruta_semana_id) REFERENCES rutas_semana(id) ON DELETE CASCADE;
alter table public.salidas add constraint salidas_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES activos(id) ON DELETE SET NULL;
alter table public.servicio_activos add constraint servicio_activos_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE RESTRICT;
alter table public.servicio_activos add constraint servicio_activos_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE CASCADE;
alter table public.servicios add constraint servicios_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT;
alter table public.servicios add constraint servicios_responsable_id_fkey FOREIGN KEY (responsable_id) REFERENCES perfiles(id);
alter table public.servicios add constraint servicios_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id) ON DELETE SET NULL;
alter table public.servicios_cliente add constraint servicios_cliente_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES categorias(id);
alter table public.servicios_cliente add constraint servicios_cliente_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
alter table public.servicios_cliente add constraint servicios_cliente_contacto_id_fkey FOREIGN KEY (contacto_id) REFERENCES cliente_contactos(id) ON DELETE SET NULL;
alter table public.servicios_cliente add constraint servicios_cliente_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id) ON DELETE SET NULL;
alter table public.ubicaciones add constraint ubicaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.ubicaciones add constraint ubicaciones_vehiculo_id_fkey FOREIGN KEY (vehiculo_id) REFERENCES activos(id);
alter table public.vehiculo_disponibilidad add constraint vehiculo_disponibilidad_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id);
alter table public.vehiculos add constraint vehiculos_activo_id_fkey FOREIGN KEY (activo_id) REFERENCES activos(id) ON DELETE CASCADE;
alter table public.ventas add constraint ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
alter table public.ventas add constraint ventas_importacion_fkey FOREIGN KEY (importacion_id) REFERENCES importaciones(id) ON DELETE CASCADE;
alter table public.ventas add constraint ventas_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES servicios(id) ON DELETE SET NULL;

-- ═══ Índices (49) ═══

CREATE INDEX activos_cliente_id_idx ON public.activos USING btree (cliente_id);
CREATE UNIQUE INDEX activos_codigo_cliente_unico ON public.activos USING btree (propietario_id, lower(codigo_cliente)) WHERE (codigo_cliente IS NOT NULL);
CREATE UNIQUE INDEX activos_codigo_unico ON public.activos USING btree (upper(TRIM(BOTH FROM codigo)));
CREATE INDEX activos_externos_idx ON public.activos USING btree (propietario_id) WHERE (propiedad = 'cliente'::text);
CREATE UNIQUE INDEX activos_numero_unidad_unico ON public.activos USING btree (ltrim(codigo, '0'::text)) WHERE ((tipo = 'bano_quimico'::tipo_activo) AND (propiedad = 'empresa'::text));
CREATE INDEX activos_qr_token_idx ON public.activos USING btree (qr_token);
CREATE INDEX activos_tipo_estado_idx ON public.activos USING btree (tipo, estado);
CREATE INDEX activos_ubicacion_id_idx ON public.activos USING btree (ubicacion_id);
CREATE INDEX auditoria_fecha_idx ON public.auditoria USING btree (fecha DESC);
CREATE INDEX auditoria_tabla_idx ON public.auditoria USING btree (tabla, registro_id);
CREATE INDEX auditoria_usuario_idx ON public.auditoria USING btree (usuario_id);
CREATE INDEX clientes_comuna_idx ON public.clientes USING btree (comuna);
CREATE INDEX clientes_nombre_idx ON public.clientes USING btree (nombre);
CREATE UNIQUE INDEX clientes_rut_norm_unico ON public.clientes USING btree (rut_norm) WHERE (rut_norm <> ''::text);
CREATE INDEX costos_categoria_idx ON public.costos USING btree (categoria);
CREATE INDEX costos_fecha_idx ON public.costos USING btree (fecha DESC);
CREATE INDEX despachos_fecha ON public.despachos USING btree (fecha_programada);
CREATE INDEX documentos_activo_activo_id_creado_en_idx ON public.documentos_activo USING btree (activo_id, creado_en DESC);
CREATE INDEX eventos_fecha_idx ON public.eventos USING btree (fecha);
CREATE UNIQUE INDEX insumo_existencias_unica ON public.insumo_existencias USING btree (insumo_id, ubicacion_id, COALESCE(lote_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE UNIQUE INDEX insumos_codigo_unico ON public.insumos USING btree (codigo);
CREATE INDEX mantenciones_activo_id_fecha_programada_idx ON public.mantenciones USING btree (activo_id, fecha_programada DESC);
CREATE INDEX mantenciones_clase_estado_idx ON public.mantenciones USING btree (clase, estado);
CREATE INDEX mantenciones_fecha_programada_idx ON public.mantenciones USING btree (fecha_programada);
CREATE UNIQUE INDEX mantenciones_folio ON public.mantenciones USING btree (folio);
CREATE INDEX movimientos_activo_activo_id_fecha_idx ON public.movimientos_activo USING btree (activo_id, fecha DESC);
CREATE INDEX movimientos_insumo_insumo ON public.movimientos_insumo USING btree (insumo_id, fecha DESC);
CREATE INDEX notificaciones_leida_creado_en_idx ON public.notificaciones USING btree (leida, creado_en DESC);
CREATE INDEX observaciones_activo_activo_id_creado_en_idx ON public.observaciones_activo USING btree (activo_id, creado_en DESC);
CREATE INDEX operacion_respaldos_desp ON public.operacion_respaldos USING btree (despacho_id);
CREATE INDEX operacion_respaldos_parada ON public.operacion_respaldos USING btree (parada_id);
CREATE UNIQUE INDEX perfiles_usuario_unico ON public.perfiles USING btree (lower(usuario)) WHERE (usuario IS NOT NULL);
CREATE UNIQUE INDEX personal_rut_unico ON public.personal USING btree (rut_norm) WHERE (rut_norm <> ''::text);
CREATE UNIQUE INDEX proveedores_rut_unico ON public.proveedores USING btree (upper(regexp_replace(rut, '[^0-9kK]'::text, ''::text, 'g'::text))) WHERE ((rut IS NOT NULL) AND (rut <> ''::text));
CREATE INDEX rutas_semana_lineas_ruta ON public.rutas_semana_lineas USING btree (ruta_id, orden);
CREATE INDEX rutas_semana_lunes ON public.rutas_semana USING btree (lunes);
CREATE UNIQUE INDEX salidas_semana_dia ON public.salidas USING btree (ruta_semana_id, fecha) WHERE (ruta_semana_id IS NOT NULL);
CREATE INDEX servicios_cliente_cli ON public.servicios_cliente USING btree (cliente_id);
CREATE INDEX servicios_cliente_id_estado_idx ON public.servicios USING btree (cliente_id, estado);
CREATE INDEX servicios_fecha_idx ON public.servicios USING btree (fecha DESC);
CREATE INDEX servicios_tipo_fecha_idx ON public.servicios USING btree (tipo, fecha DESC);
CREATE INDEX ubicaciones_cliente_id_idx ON public.ubicaciones USING btree (cliente_id);
CREATE INDEX ubicaciones_tipo_idx ON public.ubicaciones USING btree (tipo);
CREATE UNIQUE INDEX ubicaciones_vehiculo ON public.ubicaciones USING btree (vehiculo_id) WHERE (vehiculo_id IS NOT NULL);
CREATE UNIQUE INDEX un_contacto_principal ON public.cliente_contactos USING btree (cliente_id) WHERE (principal AND activo);
CREATE INDEX vehiculo_disponibilidad_activo ON public.vehiculo_disponibilidad USING btree (activo_id, creado_en DESC);
CREATE INDEX vehiculos_patente_idx ON public.vehiculos USING btree (patente);
CREATE INDEX ventas_cliente_id_idx ON public.ventas USING btree (cliente_id);
CREATE INDEX ventas_fecha_idx ON public.ventas USING btree (fecha DESC);

