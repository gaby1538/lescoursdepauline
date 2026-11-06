-- =====================================================================
--  0008 — Des factures modifiables, et justes
--
--  Trois choses : de quoi personnaliser une facture pour un élève, un
--  total qui reste toujours égal à la somme de ses lignes, et un verrou
--  qui fige ces lignes dès que la facture est émise.
-- =====================================================================

-- Ce que le parent communique une fois, repris sur chaque facture.
alter table dossiers
  add column if not exists facturation_nom     text,
  add column if not exists facturation_adresse text,
  add column if not exists facturation_note    text;

-- Ce qui est figé sur une facture donnée, modifiable tant qu'elle est
-- au brouillon. On ne lit pas le dossier au moment d'afficher une
-- facture émise : elle doit rester le reflet de ce qui a été envoyé.
alter table factures
  add column if not exists destinataire_nom     text,
  add column if not exists destinataire_adresse text,
  add column if not exists note                 text;

-- ---------------------------------------------------------------------
--  Le total suit les lignes, sans que personne ait à y penser
-- ---------------------------------------------------------------------

create or replace function recalculer_total_facture()
returns trigger language plpgsql as $$
declare
  cible uuid := coalesce(new.facture_id, old.facture_id);
begin
  update factures
     set total_cents = coalesce(
           (select sum(total_cents) from lignes_facture where facture_id = cible), 0)
   where id = cible;
  return coalesce(new, old);
end;
$$;

drop trigger if exists lignes_total on lignes_facture;
create trigger lignes_total
  after insert or update or delete on lignes_facture
  for each row execute function recalculer_total_facture();

-- ---------------------------------------------------------------------
--  Une facture émise ne se réécrit pas
-- ---------------------------------------------------------------------

create or replace function lignes_modifiables()
returns trigger language plpgsql as $$
declare
  etat statut_facture;
begin
  select statut into etat
    from factures
   where id = coalesce(new.facture_id, old.facture_id);

  -- etat nul : la facture disparaît dans la même instruction, la
  -- suppression en cascade n'a pas à être bloquée.
  if etat is not null and etat <> 'brouillon' then
    raise exception 'FACTURE_EMISE';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists lignes_verrou on lignes_facture;
create trigger lignes_verrou
  before insert or update or delete on lignes_facture
  for each row execute function lignes_modifiables();

-- Les totaux déjà en base peuvent dater d'avant le déclencheur.
update factures f
   set total_cents = coalesce(
         (select sum(l.total_cents) from lignes_facture l where l.facture_id = f.id), 0)
 where f.statut = 'brouillon';
