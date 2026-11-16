-- 48 · Paquete 30: respaldos en Drive ordenados, firma del chofer y constancia en PDF.
--   Los respaldos de una operación ahora pueden ser de 4 tipos:
--     archivo      → fotos, guías escaneadas (Drive: FOTOS/<mes> o ARCHIVOS/<mes>)
--     firma        → firma del cliente que recibe (Drive: FIRMAS/<mes>)
--     firma_chofer → firma del chofer (Drive: FIRMAS/<mes>)            ← NUEVO
--     constancia   → constancia de la operación en PDF (Drive: CONSTANCIAS/<mes>)  ← NUEVO
--   Solo amplía la lista de tipos permitidos. No cambia ni borra respaldos existentes.
-- Correr PASO POR PASO en Supabase → SQL Editor. Se puede ejecutar más de una vez.


-- ══ PASO 1 · Cambio (seleccionar hasta el PASO 2) ══════════════════════════════
begin;
alter table operacion_respaldos drop constraint if exists operacion_respaldos_tipo_check;
alter table operacion_respaldos add constraint operacion_respaldos_tipo_check
  check (tipo in ('archivo', 'firma', 'firma_chofer', 'constancia'));
comment on column operacion_respaldos.tipo is 'archivo (fotos, guías) · firma (cliente) · firma_chofer · constancia (PDF de la operación)';
commit;


-- ══ PASO 2 · Control (solo lectura) ══════════════════════════════════════════════
-- Esperado: la regla nueva con los 4 tipos, y cuántos respaldos hay hoy de cada tipo.
select pg_get_constraintdef(oid) as regla from pg_constraint where conname = 'operacion_respaldos_tipo_check';
select tipo, count(*) as respaldos from operacion_respaldos group by tipo order by tipo;
