-- ---------------------------------------------------------------------
--  0016 — Demander à raccourcir un cours
--
--  Réduire trois heures à une, c'est annuler les deux dernières. Tout
--  le mécanisme d'annulation s'applique donc tel quel : la demande
--  attend l'accord de Pauline, le créneau reste pris jusque-là, et le
--  délai de vingt-quatre heures décide si les heures retirées sont
--  dues.
--
--  Une seule chose manque : savoir, à la lecture, s'il s'agit d'une
--  annulation ou d'une réduction. On ne peut pas le déduire — un élève
--  peut très bien annuler séparément chacune des heures d'un bloc — et
--  les deux ne se disent pas de la même façon à l'écran ni par email.
-- ---------------------------------------------------------------------

alter table reservations
  add column if not exists demande_type text not null default 'annulation'
    check (demande_type in ('annulation', 'reduction'));

comment on column reservations.demande_type is
  'Nature de la demande en cours sur cette heure : annulation du cours, '
  'ou retrait d''une heure d''un cours qui en compte plusieurs.';
