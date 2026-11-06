-- =====================================================================
--  0011 — Un agenda que Pauline peut suivre depuis son téléphone
--
--  Le site publie ses cours sous forme d'abonnement iCalendar. L'adresse
--  porte un jeton : elle n'est pas devinable, et se régénère si elle
--  venait à circuler.
-- =====================================================================

alter table parametres
  add column if not exists jeton_agenda uuid not null default gen_random_uuid();

-- Le récapitulatif hebdomadaire ne doit partir qu'une fois par semaine,
-- alors que la tâche s'exécute toutes les dix minutes.
alter table parametres
  add column if not exists recap_actif    boolean not null default true,
  add column if not exists recap_envoye_le date;
