-- ---------------------------------------------------------------------
--  0020 — Deux façons d'envoyer une facture
--
--  La première : le site écrit à la famille, avec le PDF en pièce
--  jointe, et Pauline en reçoit copie.
--
--  La seconde : le site écrit à Pauline, et c'est elle qui transfère
--  depuis sa propre boîte. Le message part alors de son adresse, il se
--  range dans ses conversations avec la famille, et elle peut ajouter
--  deux lignes avant de l'envoyer. Beaucoup de familles répondent plus
--  volontiers à une personne qu'à un site.
--
--  Dans les deux cas la facture quitte « À envoyer » : le document est
--  parti, ou il est dans la boîte de Pauline à un transfert près. Les
--  distinguer sert à l'historique, et à ne pas réclamer un paiement en
--  croyant que la famille a reçu quelque chose qu'elle n'a pas reçu.
-- ---------------------------------------------------------------------

alter table factures
  add column if not exists transferee_le timestamptz;

comment on column factures.transferee_le is
  'Instant où la facture a été envoyée à Pauline pour qu''elle la '
  'transfère elle-même. La famille ne l''a pas encore reçue du site.';

-- Une facture transférée n'attend plus rien de cet écran.
drop index if exists factures_a_envoyer;
create index factures_a_envoyer
  on factures (emise_le)
  where envoyee_le is null and remise_le is null and transferee_le is null
    and statut in ('envoyee', 'en_retard');

create or replace function facture_transmise(f factures)
returns boolean language sql immutable as $$
  select f.envoyee_le is not null
      or f.remise_le is not null
      or f.transferee_le is not null;
$$;
