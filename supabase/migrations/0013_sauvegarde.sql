-- =====================================================================
--  0013 — La sauvegarde part toute seule
--
--  La base est en formule gratuite, sans sauvegarde téléchargeable.
--  Chaque mois, le site s'envoie par email le livre des recettes et
--  une copie des données : Gmail les conserve, et les pièces
--  comptables cessent de ne vivre qu'à un seul endroit.
-- =====================================================================

alter table parametres
  add column if not exists sauvegarde_active    boolean not null default true,
  add column if not exists sauvegarde_email     text,
  add column if not exists sauvegarde_envoyee_le date;
