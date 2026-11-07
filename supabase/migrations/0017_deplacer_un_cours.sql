-- ---------------------------------------------------------------------
--  0017 — Déplacer un cours
--
--  L'élève ne choisit plus entre annuler et raccourcir, mais entre
--  annuler et modifier : nouvelle date, nouvelle heure, nouvelle durée.
--  Pauline tranche, comme pour une annulation.
--
--  Le créneau proposé est réservé dès la demande, en attente de
--  validation, et pointe vers celui qu'il remplace. C'est la seule
--  façon de garantir qu'il est réellement libre, et que personne ne le
--  prenne pendant que Pauline réfléchit. Conséquence : l'ancienne et la
--  nouvelle heure coexistent le temps de la réponse, et les plafonds
--  doivent ignorer celle qui est en partance, sans quoi un élève au
--  maximum ne pourrait jamais rien déplacer.
--
--  Un déplacement accepté ne facture pas les heures libérées, même
--  hors délai : le cours n'est pas perdu, il change de place, et la
--  nouvelle heure sera facturée. Si Pauline ne veut pas d'un
--  déplacement tardif, elle le refuse.
-- ---------------------------------------------------------------------

alter table reservations drop constraint if exists reservations_demande_type_check;
alter table reservations add constraint reservations_demande_type_check
  check (demande_type in ('annulation', 'reduction', 'modification'));

alter table reservations
  add column if not exists remplace uuid references reservations (id) on delete set null,
  add column if not exists deplacee_le timestamptz;

create index if not exists reservations_remplace
  on reservations (remplace) where remplace is not null;

comment on column reservations.remplace is
  'Pour une heure proposée en remplacement : la première heure du cours '
  'qu''elle doit remplacer. Nulle pour une réservation ordinaire.';

comment on column reservations.deplacee_le is
  'Posé sur l''ancienne heure quand un déplacement est accepté. Empêche '
  'la requalification en annulation tardive : le cours n''est pas perdu.';

-- ---------------------------------------------------------------------
--  Un déplacement accepté ne bascule pas en « hors délai »
-- ---------------------------------------------------------------------

create or replace function classer_annulation()
returns trigger language plpgsql as $$
declare p parametres%rowtype;
begin
  select * into p from parametres where id;

  if new.statut = 'annulee_dans_delai'
     and new.deplacee_le is null
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
--  Les plafonds ignorent une heure en partance
-- ---------------------------------------------------------------------

create or replace function verifier_reservation()
returns trigger language plpgsql as $$
declare
  p                 parametres%rowtype;
  d                 dossiers%rowtype;
  plafond_semaine   int;
  plafond_a_venir   int;
  nb_semaine        int;
  nb_a_venir        int;
  debut_paris       timestamp;
begin
  select * into p from parametres where id;
  select * into d from dossiers where id = new.dossier_id;

  -- Coupe-circuit
  if p.reservations_suspendues = 'totale' then
    raise exception 'RESERVATIONS_SUSPENDUES';
  end if;
  if p.reservations_suspendues = 'nouveaux' and d.email_confirme_le is null then
    raise exception 'RESERVATIONS_SUSPENDUES_NOUVEAUX';
  end if;

  -- Dossier suspendu pour impayé
  if d.suspendu then
    raise exception 'DOSSIER_SUSPENDU';
  end if;

  -- Liste noire
  if exists (
    select 1 from liste_noire
    where email_normalise = d.email_normalise
       or (telephone is not null and telephone = d.telephone)
  ) then
    raise exception 'ADRESSE_BLOQUEE';
  end if;

  -- Délai minimum
  if new.debut < now() + make_interval(hours => p.delai_reservation_h) then
    raise exception 'TROP_TARD';
  end if;

  -- Le créneau doit tomber dans une disponibilité et hors indisponibilité
  debut_paris := new.debut at time zone 'Europe/Paris';
  if not exists (
    select 1 from disponibilites
    where actif
      and jour_semaine = extract(isodow from debut_paris)
      and heure_debut <= debut_paris::time
      and heure_fin   >= (new.fin at time zone 'Europe/Paris')::time
  ) then
    raise exception 'HORS_DISPONIBILITE';
  end if;

  if exists (
    select 1 from indisponibilites
    where debut < new.fin and fin > new.debut
  ) then
    raise exception 'CRENEAU_INDISPONIBLE';
  end if;

  -- Tant que l'adresse n'est pas confirmée : un seul créneau.
  if d.email_confirme_le is null then
    select count(*) into nb_a_venir
      from reservations
     where dossier_id = new.dossier_id
       and statut = 'reservee'
       and debut > now();
    if nb_a_venir >= p.max_email_non_confirme then
      raise exception 'EMAIL_NON_CONFIRME';
    end if;
  end if;

  plafond_semaine := coalesce(d.max_par_semaine, p.max_par_semaine);
  plafond_a_venir := coalesce(d.max_a_venir,     p.max_a_venir);

  -- Plafond hebdomadaire, semaine civile en heure de Paris
  select count(*) into nb_semaine
    from reservations
   where dossier_id = new.dossier_id
     and statut in ('reservee', 'effectuee', 'annulee_hors_delai', 'absent')
     and not (demande_type = 'modification'
              and annulation_demandee_le is not null
              and annulation_traitee_le is null)
     and date_trunc('week', debut at time zone 'Europe/Paris')
       = date_trunc('week', debut_paris);
  if nb_semaine >= plafond_semaine then
    raise exception 'PLAFOND_SEMAINE';
  end if;

  -- Plafond de réservations à venir
  select count(*) into nb_a_venir
    from reservations
   where dossier_id = new.dossier_id
     and statut = 'reservee'
     and not (demande_type = 'modification'
              and annulation_demandee_le is not null
              and annulation_traitee_le is null)
     and debut > now();
  if nb_a_venir >= plafond_a_venir then
    raise exception 'PLAFOND_A_VENIR';
  end if;

  -- Nombre de cours dans la journée, côté Pauline
  if (select count(*) from reservations
       where statut in ('reservee', 'effectuee')
         and (debut at time zone 'Europe/Paris')::date = debut_paris::date
     ) >= p.max_cours_par_jour then
    raise exception 'JOURNEE_COMPLETE';
  end if;

  -- Chevauchement : toujours refusé, quelle que soit la pause réglée.
  -- Ce contrôle manquait quand la pause valait zéro : l'index unique ne
  -- porte que sur l'heure de début, si bien que deux personnes voyant
  -- 10 h 00 et 10 h 30 libres au même instant pouvaient réserver deux
  -- séances qui se recouvrent.
  if exists (
    select 1 from reservations
     where statut in ('reservee', 'effectuee')
       and debut < new.fin
       and fin   > new.debut
  ) then
    raise exception 'CRENEAU_PRIS';
  end if;

  -- Pause minimale entre deux séances. Deux heures qui s'enchaînent
  -- exactement ne sont pas une pause trop courte : c'est un cours long,
  -- voulu comme tel par l'élève.
  if p.pause_entre_cours_min > 0 and exists (
    select 1 from reservations
     where statut in ('reservee', 'effectuee')
       and debut < new.fin   + make_interval(mins => p.pause_entre_cours_min)
       and fin   > new.debut - make_interval(mins => p.pause_entre_cours_min)
       and debut <> new.fin
       and fin   <> new.debut
  ) then
    raise exception 'PAUSE_INSUFFISANTE';
  end if;

  -- Prix figé au moment de la réservation
  if new.prix_cents is null then
    select prix_cents into new.prix_cents
      from tarifs
     where groupe = d.groupe and type = d.type_suivi and valide_au is null;
  end if;

  return new;
end;
$$;
