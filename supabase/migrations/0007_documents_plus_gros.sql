-- =====================================================================
--  0007 — Des documents jusqu'à 25 Mo
--
--  Le plafond de 10 Mo venait d'une époque où le fichier transitait par
--  le serveur du site. Il monte désormais en direct vers le stockage,
--  par une adresse signée : ni la limite de corps de requête de Vercel
--  (4,5 Mo), ni celle de Next n'entrent plus en jeu.
-- =====================================================================

alter table documents drop constraint if exists documents_taille_octets_check;
alter table documents add constraint documents_taille_max
  check (taille_octets > 0 and taille_octets <= 26214400);

update storage.buckets
   set file_size_limit = 26214400
 where id = 'documents';
