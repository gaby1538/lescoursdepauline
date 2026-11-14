-- ---------------------------------------------------------------------
--  0022 — Des élèves que Pauline crée elle-même, et des cours en série
--
--  Jusqu'ici un dossier naissait d'une réservation : quelqu'un arrivait
--  sur le site, laissait son adresse, réservait. Pauline a aussi des
--  élèves qui n'ont jamais vu le site et n'y viendront pas — et parfois
--  pas d'adresse email du tout. Une fiche doit pouvoir exister pour
--  elle seule : tenir un emploi du temps et préparer des factures.
--
--  D'où quatre changements :
--
--  1. L'adresse email devient facultative. Sans elle, aucun accès au
--     site : c'est l'état normal d'une fiche, pas une anomalie.
--  2. Les cours que Pauline pose elle-même échappent aux garde-fous
--     écrits pour les élèves — délai de prévenance, fenêtre de
--     disponibilité, quotas. Elle décide de son agenda. Un seul
--     contrôle demeure : deux élèves ne peuvent pas occuper la même
--     heure.
--  3. Une série est un lot de vrais cours, créés une bonne fois et
--     reliés par une étiquette. Pas une règle vivante qui recalculerait
--     ses occurrences : les vacances la casseraient, et déplacer une
--     séance deviendrait un casse-tête d'exceptions. Ici chaque séance
--     vit sa vie ; la série ne sert qu'à les poser d'un coup, puis à
--     les prolonger ou les arrêter ensemble.
--  4. Les vacances scolaires nationales, pour que l'aperçu d'une série
--     décoche seul ce qui n'a pas lieu d'être.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
--  1. Une fiche sans adresse email
-- ---------------------------------------------------------------------

alter table dossiers alter column email           drop not null;
alter table dossiers alter column email_normalise drop not null;

comment on column dossiers.email is
  'Facultative. Sans elle, l''élève n''a aucun accès au site : Pauline '
  'pose ses cours et prépare ses factures elle-même.';

-- L'index d'unicité ne gêne pas : PostgreSQL admet autant de valeurs
-- nulles qu'on veut dans un index unique. Deux fiches sans adresse
-- cohabitent donc, et c'est bien ce qu'on cherche.

alter table dossiers
  add column if not exists tarif_horaire_cents int
    check (tarif_horaire_cents is null or tarif_horaire_cents between 0 and 100000),
  add column if not exists archive_le timestamptz;

comment on column dossiers.tarif_horaire_cents is
  'Tarif propre à cet élève, qui l''emporte sur celui de son groupe. '
  'Null : on retombe sur la grille.';

comment on column dossiers.archive_le is
  'L''élève ne prend plus de cours. Sa fiche sort des listes mais son '
  'historique et ses factures restent : dix ans de conservation.';

create index if not exists dossiers_actifs on dossiers (cree_le desc)
  where archive_le is null and anonymise = false;


-- ---------------------------------------------------------------------
--  2. Les séries
-- ---------------------------------------------------------------------

create table if not exists series (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references dossiers (id) on delete cascade,
  jour_semaine int  not null check (jour_semaine between 1 and 7),
  heure        time not null,
  duree_min    int  not null default 60 check (duree_min between 15 and 480),
  prix_cents   int  not null check (prix_cents >= 0),
  cree_le      timestamptz not null default now(),
  arretee_le   timestamptz
);

comment on table series is
  'La règle qui a servi à poser un lot de cours : tous les mardis à '
  '17 h, une heure. Elle ne crée rien d''elle-même — elle sert à '
  'prolonger le lot, et à retrouver ses séances pour les arrêter.';

comment on column series.jour_semaine is
  'Au sens isodow : 1 lundi … 7 dimanche, comme les disponibilités.';

create index if not exists series_du_dossier
  on series (dossier_id, cree_le desc);

alter table reservations
  add column if not exists serie_id uuid references series (id) on delete set null,
  add column if not exists cree_par_pauline boolean not null default false;

comment on column reservations.serie_id is
  'La série dont ce cours est issu, s''il en vient d''une. Le cours '
  'reste modifiable seul : l''étiquette ne le contraint pas.';

comment on column reservations.cree_par_pauline is
  'Posé depuis l''administration. Les garde-fous écrits pour les '
  'élèves ne s''y appliquent pas.';

create index if not exists reservations_de_la_serie
  on reservations (serie_id, debut) where serie_id is not null;


-- ---------------------------------------------------------------------
--  3. Les vacances scolaires
--
--  Seules la Toussaint, Noël et les grandes vacances sont identiques
--  dans les trois zones ; février et Pâques changent de l'une à
--  l'autre. Comme les élèves de Pauline ne viennent pas tous de la même
--  zone, on ne sème que les premières — les autres se décochent à la
--  main dans l'aperçu, où elles sont de toute façon sous les yeux.
--
--  Dates publiées par le ministère pour 2026-2027 et 2027-2028. La
--  table reste modifiable : les calendriers suivants s'y ajoutent sans
--  toucher au code.
-- ---------------------------------------------------------------------

create table if not exists vacances_scolaires (
  id    uuid primary key default gen_random_uuid(),
  nom   text not null,
  debut date not null,
  fin   date not null,
  check (fin >= debut)
);

comment on table vacances_scolaires is
  'Périodes pendant lesquelles une série ne pose pas de séance. Bornes '
  'incluses : « fin » est le dernier jour de vacances, la veille de la '
  'reprise.';

create index if not exists vacances_par_date on vacances_scolaires (debut, fin);

insert into vacances_scolaires (nom, debut, fin)
select v.nom, v.debut, v.fin
  from (values
    ('Vacances de la Toussaint 2026', date '2026-10-17', date '2026-11-01'),
    ('Vacances de Noël 2026',         date '2026-12-19', date '2027-01-03'),
    ('Grandes vacances 2027',         date '2027-07-03', date '2027-09-01'),
    ('Vacances de la Toussaint 2027', date '2027-10-23', date '2027-11-07'),
    ('Vacances de Noël 2027',         date '2027-12-18', date '2028-01-02')
  ) as v(nom, debut, fin)
 where not exists (
   select 1 from vacances_scolaires x where x.nom = v.nom
 );


-- ---------------------------------------------------------------------
--  4. Les garde-fous s'effacent devant Pauline
--
--  Tout ce qui suit protège l'agenda contre un élève trop pressé, trop
--  nombreux, ou hors des heures ouvertes. Rien de cela n'a de sens
--  quand c'est Pauline qui pose le cours : elle est l'agenda. Le seul
--  contrôle qu'on garde est celui qui la protège elle — deux élèves ne
--  peuvent pas occuper la même heure.
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

  debut_paris := new.debut at time zone 'Europe/Paris';

  if not new.cree_par_pauline then
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

    -- Liste noire. Une fiche sans adresse ni téléphone ne peut pas y
    -- figurer : la comparaison reste nulle, donc fausse.
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
  end if;

  -- Chevauchement : toujours refusé, quelle que soit la pause réglée,
  -- et quel que soit l'auteur de la réservation. Pauline ne peut pas
  -- être à deux endroits à la fois non plus.
  if exists (
    select 1 from reservations
     where statut in ('reservee', 'effectuee')
       and debut < new.fin
       and fin   > new.debut
  ) then
    raise exception 'CRENEAU_PRIS';
  end if;

  if not new.cree_par_pauline then
    -- Pause minimale entre deux séances. Deux heures qui s'enchaînent
    -- exactement ne sont pas une pause trop courte : c'est un cours
    -- long, voulu comme tel par l'élève.
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
  end if;

  -- Prix figé au moment de la réservation : celui de l'élève s'il en a
  -- un, la grille de son groupe sinon.
  if new.prix_cents is null then
    new.prix_cents := d.tarif_horaire_cents;
  end if;

  if new.prix_cents is null then
    select prix_cents into new.prix_cents
      from tarifs
     where groupe = d.groupe and type = d.type_suivi and valide_au is null;
  end if;

  return new;
end;
$$;
