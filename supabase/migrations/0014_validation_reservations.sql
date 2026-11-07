-- ---------------------------------------------------------------------
--  0014 — Les réservations deviennent des demandes
--
--  Pauline valide ou refuse. On n'ajoute pas de statut à l'énumération :
--  un statut de plus obligerait à relire chaque requête du site, et
--  PostgreSQL interdit d'utiliser une valeur d'énumération dans la
--  transaction qui l'ajoute. Une demande est donc une réservation
--  « reservee » dont la validation est encore nulle.
--
--  Conséquence voulue : le créneau est pris dès la demande. Deux élèves
--  ne peuvent pas demander la même heure, et le premier arrivé n'est pas
--  doublé pendant que Pauline réfléchit.
-- ---------------------------------------------------------------------

alter table reservations
  add column if not exists validee_le  timestamptz,
  add column if not exists refus_motif text;

alter table parametres
  add column if not exists validation_requise boolean not null default true;

-- Tout ce qui existe déjà a été accepté de fait.
update reservations set validee_le = cree_le where validee_le is null;

create index if not exists reservations_a_valider
  on reservations (debut)
  where validee_le is null and statut = 'reservee';

-- ---------------------------------------------------------------------
--  Une demande non validée n'est jamais facturable
-- ---------------------------------------------------------------------

create or replace function exiger_validation()
returns trigger language plpgsql as $$
begin
  if new.validee_le is null
     and new.statut in ('effectuee', 'annulee_hors_delai', 'absent') then
    raise exception 'NON_VALIDEE';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_validation on reservations;
create trigger reservations_validation
  before insert or update of statut, validee_le on reservations
  for each row execute function exiger_validation();

-- L'annulation d'une demande non validée est toujours sans frais :
-- on ne facture pas un cours que Pauline n'a pas encore accepté.
create or replace function classer_annulation()
returns trigger language plpgsql as $$
declare p parametres%rowtype;
begin
  select * into p from parametres where id;

  if new.statut = 'annulee_dans_delai'
     and old.validee_le is not null
     and coalesce(old.annulation_demandee_le, now())
         > old.debut - make_interval(hours => p.delai_annulation_h) then
    new.statut := 'annulee_hors_delai';
  end if;

  if new.statut <> old.statut and new.statut::text like 'annulee%' then
    new.annule_le := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
--  Valider / refuser, côté base, pour que l'écran n'ait pas à savoir
--  dans quel ordre toucher les colonnes.
-- ---------------------------------------------------------------------

create or replace function decider_demande(
  demande uuid,
  accepter boolean,
  motif text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare r reservations%rowtype;
begin
  select * into r from reservations where id = demande for update;

  if r.id is null then raise exception 'INTROUVABLE'; end if;
  if r.validee_le is not null then raise exception 'DEJA_VALIDEE'; end if;
  if r.statut <> 'reservee' then raise exception 'DEJA_CLASSEE'; end if;

  if accepter then
    update reservations
       set validee_le = now()
     where id = demande;
  else
    update reservations
       set statut      = 'annulee_par_pauline',
           refus_motif = nullif(btrim(coalesce(motif, '')), ''),
           annule_le   = now()
     where id = demande;
  end if;
end;
$$;

revoke all on function decider_demande(uuid, boolean, text) from public, anon, authenticated;
