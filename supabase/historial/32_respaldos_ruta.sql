-- 32 · ESTANDARIZACIÓN · ETAPA 4 · Paquete 8d: respaldos (firma y fotos) desde Mi ruta
-- Solo agrega. No cambia las rutas, las paradas ni cómo se confirman.
--   · Un respaldo puede ser de una operación (despacho) o de una parada de ruta (limpiezas sin despacho).
--   · Si la parada es una entrega/retiro/cambio, el respaldo queda también en la operación (pestaña Respaldos).
-- Correr PASO POR PASO en Supabase → SQL Editor.


-- ══ PASO 1 · Revisión previa (solo lectura) ═════════════════════════════════════
-- Esperado: respaldos = los que subiste en las pruebas; sin_despacho = 0.
select (select count(*) from operacion_respaldos)                          as respaldos,
       (select count(*) from operacion_respaldos where despacho_id is null) as sin_despacho,
       (select count(*) from salida_paradas)                                as paradas;


-- ══ PASO 2 · Cambios (seleccionar hasta el PASO 3) ═════════════════════════════
alter table operacion_respaldos add column if not exists parada_id bigint;   -- sin FK: las rutas de Cata no se ven afectadas
alter table operacion_respaldos alter column despacho_id drop not null;
alter table operacion_respaldos drop constraint if exists operacion_respaldos_origen_chk;
alter table operacion_respaldos add constraint operacion_respaldos_origen_chk
  check (despacho_id is not null or parada_id is not null);
create index if not exists operacion_respaldos_parada on operacion_respaldos (parada_id);


-- ══ PASO 3 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: columna_parada = 1, despacho_opcional = YES, regla = 1.
select (select count(*) from information_schema.columns where table_name = 'operacion_respaldos' and column_name = 'parada_id') as columna_parada,
       (select is_nullable from information_schema.columns where table_name = 'operacion_respaldos' and column_name = 'despacho_id') as despacho_opcional,
       (select count(*) from pg_constraint where conname = 'operacion_respaldos_origen_chk') as regla;
