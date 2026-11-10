-- 06 · Archivos (Storage): carpeta "fosan"
-- Foto de la base de producción de FOSAN tomada el 10/11/2026 (generado desde la base real, no a mano).
-- Fotos y firmas de respaldos de operaciones, documentos, etc. Lectura: usuarios con acceso; escritura: dueño;
-- respaldos: los sube quien realiza la operación.
-- Orden para montar una base nueva: 00 → 01 → 02 → 03 → 04 → 05 → 06 (ver supabase/README.md).

-- ═══ Bucket (1) ═══

insert into storage.buckets (id, name, public) values ('fosan', 'fosan', false) on conflict do nothing;

-- ═══ Reglas de Storage (3) ═══

create policy fosan_escritura on storage.objects as permissive for all to public using (((bucket_id = 'fosan'::text) AND es_dueno())) with check (((bucket_id = 'fosan'::text) AND es_dueno()));
create policy fosan_lectura on storage.objects as permissive for select to public using (((bucket_id = 'fosan'::text) AND tiene_acceso()));
create policy fosan_respaldos_subir on storage.objects as permissive for insert to public with check (((bucket_id = 'fosan'::text) AND (name ~~ 'respaldos/%'::text) AND tiene_acceso()));

