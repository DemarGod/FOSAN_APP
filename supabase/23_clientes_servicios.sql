-- 23 · ESTANDARIZACIÓN · ETAPA 2 · Paquete 1: base de Clientes y servicios
-- Solo agrega. No borra columnas ni datos: valor_mensual, dias_limpieza, banos_propios, lat y lng
-- de "clientes" se mantienen porque Análisis y Rutas semanales los siguen leyendo.
-- Hace cuatro cosas:
--   A. Clientes se DESACTIVAN con motivo (ya no se eliminan).
--   B. Equipos externos (baños del cliente) con su propia serie EXT-001, EXT-002…,
--      nunca con números de baños FOSAN, y con el identificador del cliente opcional.
--   C. Historial (auditoría) también para contactos, servicios, catálogos y personal.
--   D. Función historial_cliente() para la pestaña Historial de la ficha.
-- Correr en Supabase → SQL Editor, paso por paso. El PASO 2 se puede correr más de una vez.


-- ══ PASO 1 · Revisión previa (solo lectura): correr solo esto ═══════════════════
-- Esperado: codigos_ext_existentes = 0 y equipos_cliente_existentes = 0.
-- clientes_ya_inactivos: si es mayor que 0, avísame antes del paquete 3 (dejarán de salir para elegir).
select (select count(*) from clientes)                                   as clientes,
       (select count(*) from clientes where not activo)                  as clientes_ya_inactivos,
       (select count(*) from activos where codigo ilike 'EXT-%')         as codigos_ext_existentes,
       (select count(*) from activos where propiedad = 'cliente')        as equipos_cliente_existentes,
       (select count(*) from servicios_cliente where estado = 'vigente') as servicios_vigentes,
       to_regclass('public.rutas_semana_lineas') is not null             as existe_rutas_semana,
       to_regclass('public.auditoria') is not null                       as existe_auditoria;


-- ══ PASO 2 · Cambios: seleccionar desde aquí hasta el PASO 3 y correr junto ══════

-- ─── A. Clientes: desactivar con motivo ───────────────────────────────────────
alter table clientes add column if not exists motivo_desactivacion text;
alter table clientes add column if not exists desactivado_en timestamptz;
alter table clientes add column if not exists desactivado_por uuid;

-- ¿Puede la persona conectada hacer "accion" (ver / editar) en "seccion"?
create or replace function permiso_seccion(p_seccion text, p_accion text) returns boolean as $$
  select es_dueno() or exists (
    select 1 from permisos_rol pr join perfiles p on p.rol::text = pr.rol::text
    where p.id = auth.uid() and p.activo and pr.seccion::text = p_seccion
      and case p_accion when 'ver' then pr.ver when 'editar' then pr.editar when 'exportar' then pr.exportar else false end
  );
$$ language sql stable security definer set search_path = public;

create or replace function desactivar_cliente(p_id uuid, p_motivo text) returns void as $$
declare n integer;
begin
  if not permiso_seccion('clientes', 'editar') then
    raise exception 'No tienes permiso para desactivar clientes.';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 3 then
    raise exception 'Indica el motivo de la desactivación.';
  end if;
  select count(*) into n from activos
   where cliente_id = p_id and estado = 'en_arriendo' and propiedad = 'empresa';
  if n > 0 then
    raise exception 'Este cliente tiene % baño(s) FOSAN asignado(s). Primero programa y completa su retiro.', n;
  end if;
  select count(*) into n from servicios_cliente where cliente_id = p_id and estado = 'vigente';
  if n > 0 then
    raise exception 'Este cliente tiene % servicio(s) vigente(s). Finalízalos antes de desactivar.', n;
  end if;
  update clientes
     set activo = false, motivo_desactivacion = trim(p_motivo), desactivado_en = now(), desactivado_por = auth.uid()
   where id = p_id and activo;
  if not found then raise exception 'El cliente no existe o ya está desactivado.'; end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function reactivar_cliente(p_id uuid) returns void as $$
begin
  if not permiso_seccion('clientes', 'editar') then
    raise exception 'No tienes permiso para reactivar clientes.';
  end if;
  update clientes
     set activo = true, motivo_desactivacion = null, desactivado_en = null, desactivado_por = null
   where id = p_id and not activo;
  if not found then raise exception 'El cliente no existe o ya está activo.'; end if;
end;
$$ language plpgsql security definer set search_path = public;

-- Ya no se borran clientes. El botón de eliminar de la pantalla actual mostrará este mensaje.
create or replace function eliminar_cliente(p_id uuid) returns void as $$
begin
  raise exception 'Los clientes ya no se eliminan: se desactivan con motivo y conservan su historial.';
end;
$$ language plpgsql security definer set search_path = public;


-- ─── B. Equipos externos (baños del cliente) ──────────────────────────────────
-- Código propio EXT-###; el número o marca que usa el cliente va en codigo_cliente.
alter table activos add column if not exists codigo_cliente text;
create index if not exists activos_externos_idx on activos (propietario_id) where propiedad = 'cliente';
create unique index if not exists activos_codigo_cliente_unico
  on activos (propietario_id, lower(codigo_cliente)) where codigo_cliente is not null;

-- Regla: EXT- es solo para equipos del cliente, y todo equipo del cliente tiene dueño.
do $$ begin
  alter table activos add constraint activos_externo_chk check (
    (propiedad = 'cliente') = (codigo ilike 'EXT-%')
    and (propiedad <> 'cliente' or propietario_id is not null));
exception when duplicate_object then null; end $$;

-- Asigna EXT-### al crear, no permite cambiarlo y deja el equipo fuera del stock FOSAN.
create or replace function preparar_equipo_externo() returns trigger as $$
declare n integer;
begin
  if tg_op = 'UPDATE' and new.codigo is distinct from old.codigo
     and (old.propiedad = 'cliente' or new.propiedad = 'cliente') then
    raise exception 'El código de un equipo externo no se puede cambiar.';
  end if;
  if new.propiedad = 'cliente' then
    if tg_op = 'INSERT' and coalesce(trim(new.codigo), '') = '' then
      perform pg_advisory_xact_lock(hashtext('equipo_externo'));
      select coalesce(max(substring(codigo from 5)::integer), 0) + 1 into n
        from activos where codigo ~ '^EXT-[0-9]+$';
      new.codigo := 'EXT-' || lpad(n::text, 3, '0');
    end if;
    new.habilitado := false;   -- no se arrienda: no suma al inventario propio disponible
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists t_a_equipo_externo on activos;   -- "t_a…" corre antes que t_sincronizar_situacion
create trigger t_a_equipo_externo before insert or update on activos
for each row execute function preparar_equipo_externo();

-- Igual que en el script 21, más una regla: el equipo del cliente está en su obra (asignado).
create or replace function sincronizar_situacion() returns trigger as $$
begin
  if new.propiedad = 'cliente' then
    if new.situacion is null or new.situacion = 'disponible' then new.situacion := 'asignado'; end if;
    return new;
  end if;
  if tg_op = 'INSERT' or new.estado is distinct from old.estado or new.situacion is null then
    new.situacion := case new.estado::text
      when 'en_arriendo' then 'asignado'
      when 'disponible' then 'disponible'
      when 'en_limpieza' then 'disponible'
      when 'mantencion' then 'en_mantenimiento'
      when 'fuera_de_servicio' then 'en_mantenimiento'
      when 'extraviado' then 'no_localizado'
      else 'baja' end;
    new.condicion := case new.estado::text
      when 'en_limpieza' then 'requiere_limpieza'
      when 'mantencion' then 'requiere_reparacion'
      when 'fuera_de_servicio' then 'requiere_reparacion'
      when 'extraviado' then 'sin_evaluar'
      else coalesce(new.condicion, 'operativo') end;
  end if;
  return new;
end $$ language plpgsql;


-- ─── C. Historial para las tablas nuevas ──────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['cliente_contactos','servicios_cliente','categorias','unidades_medida','personal'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists auditoria_%1$s on %1$I', t);
      execute format('create trigger auditoria_%1$s after insert or update or delete on %1$I
                      for each row execute function registrar_auditoria()', t);
    end if;
  end loop;
end $$;


-- ─── D. Historial de un cliente (pestaña Historial de la ficha) ───────────────
-- Cliente, sus contactos, servicios y ubicaciones. Solo lectura; lo ve quien puede ver Clientes.
create or replace function historial_cliente(p_id uuid) returns setof auditoria as $$
begin
  if not permiso_seccion('clientes', 'ver') then
    raise exception 'No tienes permiso para ver el historial de clientes.';
  end if;
  return query
  select a.* from auditoria a
   where (a.tabla = 'clientes' and a.registro_id = p_id::text)
      or (a.tabla = 'cliente_contactos' and a.registro_id in (select id::text from cliente_contactos where cliente_id = p_id))
      or (a.tabla = 'servicios_cliente' and a.registro_id in (select id::text from servicios_cliente where cliente_id = p_id))
      or (a.tabla = 'ubicaciones'       and a.registro_id in (select id::text from ubicaciones where cliente_id = p_id))
   order by a.fecha desc
   limit 500;
end;
$$ language plpgsql stable security definer set search_path = public;


-- ══ PASO 3 · Control: correr solo esto ══════════════════════════════════════════
-- Esperado: columnas_nuevas = 4, funciones = 7, triggers_historial = 5, regla_ext = 1.
select (select count(*) from information_schema.columns
         where table_name = 'clientes' and column_name in ('motivo_desactivacion','desactivado_en','desactivado_por')
            or table_name = 'activos' and column_name = 'codigo_cliente')                      as columnas_nuevas,
       (select count(distinct proname) from pg_proc where proname in
         ('permiso_seccion','desactivar_cliente','reactivar_cliente','eliminar_cliente',
          'preparar_equipo_externo','sincronizar_situacion','historial_cliente'))              as funciones,
       (select count(*) from pg_trigger where tgname in
         ('auditoria_cliente_contactos','auditoria_servicios_cliente','auditoria_categorias',
          'auditoria_unidades_medida','auditoria_personal'))                                   as triggers_historial,
       (select count(*) from pg_constraint where conname = 'activos_externo_chk')               as regla_ext,
       (select count(*) from clientes where activo)                                             as clientes_activos,
       (select count(*) from activos where tipo = 'bano_quimico' and propiedad = 'empresa')     as banos_fosan;


-- ══ PASO 4 · Prueba de equipo externo (no guarda nada): correr solo esto ═════════
-- Crea un baño externo de prueba y lo deshace al tiro. Va a aparecer en ROJO como error;
-- eso es lo esperado. El mensaje debe decir: PRUEBA OK … código EXT-001 … situación asignado … habilitado false
do $$ declare r record; begin
  perform set_config('fosan.silencio', '1', true);
  insert into activos (codigo, tipo, propiedad, propietario_id, codigo_cliente)
  values (null, 'bano_quimico', 'cliente', (select id from clientes order by creado_en limit 1), 'PRUEBA')
  returning codigo, situacion, habilitado into r;
  raise exception 'PRUEBA OK (no se guardó): código %, situación %, habilitado %', r.codigo, r.situacion, r.habilitado;
end $$;
