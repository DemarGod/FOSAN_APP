-- 39 · ESTANDARIZACIÓN · Paquete 18: diagnóstico. SOLO LECTURA, no cambia nada.
--   A. Qué puede leer hoy un operador en la base (para reforzar su seguridad).
--   B. Datos de prueba pendientes (para decidir qué limpiar).
-- Correr cada consulta por separado y mandar captura (o descargar CSV).


-- ══ A1 · Tablas: RLS activo y sus reglas de lectura ═══════════════════════════════
select c.relname                                   as tabla,
       c.relrowsecurity                            as rls_activo,
       coalesce(string_agg(p.policyname || ' [' || p.cmd || '] ' || coalesce(p.qual, 'true'), '  |  ' order by p.policyname), '— sin reglas —') as reglas
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname and p.cmd in ('SELECT', 'ALL')
 where c.relkind = 'r'
 group by c.relname, c.relrowsecurity
 order by c.relname;


-- ══ A2 · Vistas (las vistas pueden saltarse las reglas de las tablas) ══════════════
select c.relname as vista,
       coalesce((select option_value from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), 'false') as respeta_reglas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where c.relkind = 'v'
 order by c.relname;


-- ══ B1 · Datos pendientes, uno por fila ══════════════════════════════════════════
select 'operación atrasada' as que, d.folio as folio, to_char(d.fecha_programada, 'DD/MM/YYYY') as fecha,
       c.nombre || ' · ' || d.tipo as detalle, d.estado::text as estado
  from despachos d join clientes c on c.id = d.cliente_id
 where d.estado = 'programado' and d.fecha_programada < current_date
union all
select 'mantención vencida', m.folio, to_char(m.fecha_programada, 'DD/MM/YYYY'),
       a.codigo || ' · ' || m.tipo || ' · ' || left(coalesce(m.trabajo_requerido, m.detalle, ''), 60), m.estado::text
  from mantenciones m join activos a on a.id = m.activo_id
 where m.estado in ('programada', 'proxima', 'urgente') and m.fecha_programada < current_date
union all
select 'día de ruta sin cerrar', coalesce(s.ruta, ''), to_char(s.fecha, 'DD/MM/YYYY'),
       'km salida ' || s.odometro_salida, s.estado::text
  from v_salidas s
 where s.estado = 'planificada' and s.odometro_salida is not null and s.fecha < current_date
order by 1, 3;


-- ══ B2 · Estados que acepta cada tabla (para cancelar o cerrar bien) ═══════════════
select t.typname as tipo, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as valores
  from pg_type t join pg_enum e on e.enumtypid = t.oid
 group by t.typname order by t.typname;
