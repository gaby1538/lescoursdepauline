-- ---------------------------------------------------------------------
--  Contrôle : quelles migrations sont réellement passées ?
--
--  À coller dans l'éditeur SQL de Supabase. Ne modifie rien, se contente
--  de regarder si les colonnes, fonctions et déclencheurs attendus sont
--  là. Une ligne « MANQUANTE » veut dire que le fichier correspondant
--  n'a pas été exécuté, ou pas en entier.
-- ---------------------------------------------------------------------

select
  'Annulations et garde-fous (0010)' as migration,
  to_char(count(*), '9') || ' / 5 éléments' as presents,
  case when count(*) = 5 then 'OK' else 'MANQUANTE' end as etat
from (
  select 1 from information_schema.columns
   where table_name = 'reservations' and column_name = 'annulation_demandee_le'
  union all select 1 from information_schema.columns
   where table_name = 'reservations' and column_name = 'rappel_envoye_le'
  union all select 1 from information_schema.columns
   where table_name = 'dossiers' and column_name = 'token_expire_le'
  union all select 1 from information_schema.columns
   where table_name = 'parametres' and column_name = 'rappel_actif'
  union all select 1 from information_schema.tables
   where table_name = 'limites_envoi'
) t

union all select
  'Livre des recettes (0012)',
  to_char(count(*), '9') || ' / 1 élément',
  case when count(*) = 1 then 'OK' else 'MANQUANTE' end
from information_schema.columns
 where table_name = 'factures' and column_name = 'mode_reglement'

union all select
  'Sauvegarde mensuelle (0013)',
  to_char(count(*), '9') || ' / 3 éléments',
  case when count(*) = 3 then 'OK' else 'MANQUANTE' end
from information_schema.columns
 where table_name = 'parametres'
   and column_name in ('sauvegarde_active', 'sauvegarde_email', 'sauvegarde_envoyee_le')

union all select
  'Validation des demandes (0014)',
  to_char(count(*), '9') || ' / 5 éléments',
  case when count(*) = 5 then 'OK' else 'MANQUANTE' end
from (
  select 1 from information_schema.columns
   where table_name = 'reservations' and column_name = 'validee_le'
  union all select 1 from information_schema.columns
   where table_name = 'reservations' and column_name = 'refus_motif'
  union all select 1 from information_schema.columns
   where table_name = 'parametres' and column_name = 'validation_requise'
  union all select 1 from pg_proc where proname = 'decider_demande'
  union all select 1 from pg_trigger where tgname = 'reservations_validation'
) t

order by 1;
