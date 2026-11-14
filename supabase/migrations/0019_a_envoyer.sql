-- ---------------------------------------------------------------------
--  0019 — Émettre et envoyer deviennent deux gestes
--
--  Ils n'ont rien à voir. Émettre est un acte comptable : la facture
--  existe, prend son numéro, entre dans le livre des recettes. Envoyer
--  est un acte de communication, qui peut attendre, ou passer par la
--  poste, ou ne jamais avoir lieu si la facture est remise en main
--  propre.
--
--  On n'ajoute pas de valeur à l'énumération des statuts : PostgreSQL
--  interdit d'en utiliser une dans la transaction qui l'ajoute, ce qui
--  obligerait à couper la migration en deux, et les dix requêtes qui
--  parlent de « envoyee » seraient toutes à relire. « envoyee » garde
--  donc son sens de « sortie du brouillon », et deux dates disent ce
--  qu'il est advenu du document.
--
--  envoyee_le existe depuis le schéma initial et portait déjà ce sens,
--  sans qu'on s'en serve pour distinguer les deux états. Il ne manquait
--  que remise_le, le message conservé, et l'index.
--
--  À envoyer  = statut émis, envoyee_le et remise_le nulles.
--  Envoyée    = envoyee_le renseignée.
--  Remise     = remise_le renseignée, aucun email n'est parti.
-- ---------------------------------------------------------------------

alter table factures
  add column if not exists remise_le  timestamptz,
  add column if not exists message_accompagnement text;

comment on column factures.envoyee_le is
  'Instant où l''email est effectivement parti. Nulle tant que la '
  'facture attend son envoi, même si elle est émise et numérotée.';

comment on column factures.remise_le is
  'Instant où Pauline a déclaré l''avoir remise autrement : en main '
  'propre, par courrier, depuis sa propre boîte.';

comment on column factures.message_accompagnement is
  'Le mot ajouté à l''email au moment de l''envoi, conservé tel quel : '
  'c''est ce que la famille a lu.';

-- Jusqu'ici, émettre envoyait dans le même geste : une facture sortie
-- du brouillon a donc forcément été transmise. On rattrape les rares
-- cas où l'email a échoué sans que la date soit posée, pour qu'ils ne
-- réapparaissent pas comme « à envoyer » des mois plus tard.
update factures
   set envoyee_le = emise_le::timestamptz
 where envoyee_le is null
   and remise_le is null
   and emise_le is not null
   and statut in ('envoyee', 'payee', 'en_retard');

create index if not exists factures_a_envoyer
  on factures (emise_le)
  where envoyee_le is null and remise_le is null
    and statut in ('envoyee', 'en_retard');

-- ---------------------------------------------------------------------
--  Une facture jamais transmise n'est pas « en retard »
--
--  Le retard se compte à partir du moment où la famille a reçu la
--  facture. Tant qu'elle ne l'a pas, le reproche serait pour Pauline.
-- ---------------------------------------------------------------------

create or replace function facture_transmise(f factures)
returns boolean language sql immutable as $$
  select f.envoyee_le is not null or f.remise_le is not null;
$$;
