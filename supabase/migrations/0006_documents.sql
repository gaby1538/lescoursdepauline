-- =====================================================================
--  0006 — Le dépôt des documents
--
--  Le bucket reste privé : rien n'y est accessible par une adresse
--  devinable. Le site sert les fichiers par des liens signés, valables
--  quelques minutes, générés après vérification du dossier.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do update
   set public             = excluded.public,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;
