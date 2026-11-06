-- =====================================================================
--  0010 — Demandes d'annulation, liens qui expirent, quota d'emails
-- =====================================================================

-- ---------------------------------------------------------------------
--  L'élève demande, Pauline tranche
--
--  Le créneau reste occupé tant que la demande n'est pas acceptée : il
--  ne doit pas se libérer sur une simple demande, sinon n'importe qui
--  pourrait vider l'agenda.
-- ---------------------------------------------------------------------

alter table reservations
  add column if not exists annulation_demandee_le timestamptz,
  add column if not exists annulation_motif       text,
  add column if not exists annulation_decision    text
    check (annulation_decision in ('acceptee', 'refusee')),
  add column if not exists annulation_reponse     text,
  add column if not exists annulation_traitee_le  timestamptz;

create index if not exists reservations_annulation_en_attente
  on reservations (annulation_demandee_le)
  where annulation_demandee_le is not null and annulation_traitee_le is null;

-- ---------------------------------------------------------------------
--  Le délai se juge au moment de la demande, pas de la réponse
--
--  Sinon un élève qui prévient quinze jours avant serait facturé parce
--  que Pauline a mis trois jours à valider.
-- ---------------------------------------------------------------------

create or replace function classer_annulation()
returns trigger language plpgsql as $$
declare
  p parametres%rowtype;
  instant timestamptz;
begin
  select * into p from parametres where id;

  instant := coalesce(new.annulation_demandee_le, now());

  if new.statut = 'annulee_dans_delai'
     and old.debut < instant + make_interval(hours => p.delai_annulation_h) then
    new.statut := 'annulee_hors_delai';
  end if;

  if new.statut <> old.statut and new.statut::text like 'annulee%' then
    new.annule_le := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
--  Les liens envoyés par email cessent d'être valables
-- ---------------------------------------------------------------------

alter table dossiers
  add column if not exists token_expire_le timestamptz;

-- Les jetons déjà en circulation reçoivent une échéance.
update dossiers
   set token_expire_le = now() + interval '7 days'
 where token_expire_le is null and anonymise = false;

-- ---------------------------------------------------------------------
--  Rappel avant la séance
-- ---------------------------------------------------------------------

alter table parametres
  add column if not exists rappel_actif   boolean not null default true,
  add column if not exists rappel_minutes int     not null default 30;

alter table reservations
  add column if not exists rappel_envoye_le timestamptz;

-- ---------------------------------------------------------------------
--  Un plafond d'envois, tenu par la base
--
--  Compter dans l'application ne protège de rien : deux requêtes
--  simultanées passeraient toutes les deux. Le compteur est incrémenté
--  sous verrou de ligne.
-- ---------------------------------------------------------------------

create table if not exists limites_envoi (
  cle        text primary key,
  compte     int not null default 0,
  fenetre_le timestamptz not null default now()
);

create or replace function autoriser_envoi(
  cle_demandee    text,
  plafond         int,
  fenetre_minutes int
)
returns boolean language plpgsql as $$
declare
  actuel limites_envoi%rowtype;
begin
  insert into limites_envoi (cle, compte, fenetre_le)
  values (cle_demandee, 0, now())
  on conflict (cle) do nothing;

  select * into actuel
    from limites_envoi
   where cle = cle_demandee
     for update;

  if actuel.fenetre_le < now() - make_interval(mins => fenetre_minutes) then
    update limites_envoi
       set compte = 1, fenetre_le = now()
     where cle = cle_demandee;
    return true;
  end if;

  if actuel.compte >= plafond then
    return false;
  end if;

  update limites_envoi set compte = compte + 1 where cle = cle_demandee;
  return true;
end;
$$;

-- Ménage : les fenêtres closes depuis longtemps ne servent plus.
create or replace function purger_limites() returns void language sql as $$
  delete from limites_envoi where fenetre_le < now() - interval '2 days';
$$;
