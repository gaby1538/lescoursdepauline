-- =====================================================================
--  Les cours de Pauline — schéma initial
--  Toutes les heures sont stockées en UTC (timestamptz) et affichées
--  en heure de Paris. Les montants sont en centimes, jamais en float.
-- =====================================================================

create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  Types
-- ---------------------------------------------------------------------

create type groupe_tarifaire as enum ('college_seconde', 'premiere_terminale');
create type type_suivi        as enum ('seance', 'regulier');
create type statut_reservation as enum (
  'reservee',              -- à venir
  'effectuee',             -- le cours a eu lieu        → facturable
  'annulee_dans_delai',    -- annulée > 24 h avant      → non facturable
  'annulee_hors_delai',    -- annulée < 24 h avant      → facturable
  'absent',                -- l'élève n'est pas venu    → facturable
  'annulee_par_pauline'    --                           → non facturable
);
create type statut_facture as enum ('brouillon', 'envoyee', 'payee', 'en_retard', 'annulee');
create type depose_par     as enum ('pauline', 'eleve');
create type suspension      as enum ('aucune', 'nouveaux', 'totale');

-- ---------------------------------------------------------------------
--  Normalisation des adresses email
--  Chez Gmail, « p.mattern+svt@gmail.com » et « pmattern@gmail.com »
--  sont la même boîte. La liste noire et l'unicité travaillent sur la
--  forme normalisée, pas sur ce que la personne a tapé.
-- ---------------------------------------------------------------------

create or replace function normaliser_email(adresse citext)
returns citext
language sql immutable strict as $$
  select case
    when split_part(lower(adresse), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(adresse), '@', 1), '+', 1), '.', '')
           || '@gmail.com'
    else lower(adresse)
  end::citext;
$$;

-- ---------------------------------------------------------------------
--  Paramètres — une seule ligne, modifiable depuis l'administration.
--  Tout ce qui est ici se change sans redéploiement.
-- ---------------------------------------------------------------------

create table parametres (
  id                      boolean primary key default true check (id),

  -- Réservation
  delai_reservation_h     int not null default 24,   -- réserver au plus tard X h avant
  delai_annulation_h      int not null default 24,   -- annuler sans frais jusqu'à X h avant
  duree_seance_min        int not null default 60,
  pas_grille_min          int not null default 30,
  pause_entre_cours_min   int not null default 0,
  max_cours_par_jour      int not null default 4,

  -- Garde-fous anti-spam
  max_par_semaine         int not null default 3,
  max_a_venir             int not null default 6,
  max_email_non_confirme  int not null default 1,

  -- Coupe-circuit
  reservations_suspendues suspension not null default 'aucune',
  message_suspension      text not null default
    'Les réservations sont momentanément fermées. Écrivez-moi, je vous recontacte vite.',
  suspendu_le             timestamptz,

  -- Facturation
  jour_emission_factures  int not null default 31 check (jour_emission_factures between 1 and 31),
  delai_paiement_jours    int not null default 30,
  delai_relance_jours     int not null default 7,
  iban                    text,
  wero_telephone          text,

  -- Identité portée sur les factures et les mentions légales
  raison_sociale          text not null default 'Les cours de Pauline',
  exploitante             text not null default 'Pauline Mattern',
  siret                   text not null default '10842719600010',
  adresse_postale         text,
  email_contact           citext not null default 'contact.capsvt@gmail.com',

  maj_le                  timestamptz not null default now()
);

insert into parametres (id) values (true);

-- ---------------------------------------------------------------------
--  Tarifs — le prix dépend du niveau et du type de suivi.
--  Historisés : on ne modifie jamais une ligne, on en crée une nouvelle,
--  sinon une ancienne facture changerait de montant toute seule.
-- ---------------------------------------------------------------------

create table tarifs (
  id          uuid primary key default gen_random_uuid(),
  groupe      groupe_tarifaire not null,
  type        type_suivi       not null,
  prix_cents  int not null check (prix_cents > 0),
  valide_du   timestamptz not null default now(),
  valide_au   timestamptz
);

create unique index tarifs_actif_unique
  on tarifs (groupe, type) where valide_au is null;

insert into tarifs (groupe, type, prix_cents) values
  ('college_seconde',    'seance',   4000),
  ('college_seconde',    'regulier', 3500),
  ('premiere_terminale', 'seance',   4500),
  ('premiere_terminale', 'regulier', 3900);

-- ---------------------------------------------------------------------
--  Dossiers — la racine du modèle.
--  Créé à la première réservation, ou à la main par Pauline.
--  user_id est nul tant que le client n'a pas choisi de mot de passe :
--  le dossier existe et fonctionne sans compte activé.
-- ---------------------------------------------------------------------

create table dossiers (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid unique references auth.users (id) on delete set null,

  email              citext not null,
  email_normalise    citext not null generated always as (normaliser_email(email)) stored,
  email_confirme_le  timestamptz,

  nom                text,
  prenom             text,
  telephone          text,

  eleve_prenom       text,
  eleve_classe       text,
  groupe             groupe_tarifaire not null default 'college_seconde',
  type_suivi         type_suivi       not null default 'seance',

  -- Dérogations accordées au cas par cas (null = on applique le paramètre global)
  max_par_semaine    int,
  max_a_venir        int,

  suspendu           boolean not null default false,
  motif_suspension   text,

  anonymise          boolean not null default false,
  notes_internes     text,
  cree_le            timestamptz not null default now()
);

create unique index dossiers_email_unique
  on dossiers (email_normalise) where anonymise = false;

create index dossiers_jamais_venus
  on dossiers (cree_le) where email_confirme_le is null and anonymise = false;

-- ---------------------------------------------------------------------
--  Liste noire
-- ---------------------------------------------------------------------

create table liste_noire (
  id              uuid primary key default gen_random_uuid(),
  email_normalise citext,
  telephone       text,
  motif           text,
  cree_le         timestamptz not null default now(),
  check (email_normalise is not null or telephone is not null)
);

create unique index liste_noire_email on liste_noire (email_normalise)
  where email_normalise is not null;

-- ---------------------------------------------------------------------
--  Disponibilités
--  Les plages récurrentes disent quand Pauline travaille, les
--  indisponibilités retirent des moments précis (congés, agenda Google,
--  contraintes hors cours).
-- ---------------------------------------------------------------------

create table disponibilites (
  id           uuid primary key default gen_random_uuid(),
  jour_semaine int  not null check (jour_semaine between 1 and 7),  -- 1 = lundi
  heure_debut  time not null,
  heure_fin    time not null,
  actif        boolean not null default true,
  check (heure_fin > heure_debut)
);

create table indisponibilites (
  id              uuid primary key default gen_random_uuid(),
  debut           timestamptz not null,
  fin             timestamptz not null,
  motif           text,
  google_event_id text unique,           -- posé si l'origine est l'agenda Google
  cree_le         timestamptz not null default now(),
  check (fin > debut)
);

create index indisponibilites_periode on indisponibilites (debut, fin);

-- ---------------------------------------------------------------------
--  Réservations
--  prix_cents est figé à la réservation : changer un tarif ne doit pas
--  réécrire le passé.
-- ---------------------------------------------------------------------

create table reservations (
  id              uuid primary key default gen_random_uuid(),
  dossier_id      uuid not null references dossiers (id) on delete cascade,
  debut           timestamptz not null,
  fin             timestamptz not null,
  statut          statut_reservation not null default 'reservee',
  sujet           text,
  lien_visio      text,
  google_event_id text unique,
  prix_cents      int not null,
  facture_id      uuid,
  cree_le         timestamptz not null default now(),
  annule_le       timestamptz,
  check (fin > debut)
);

-- Deux personnes ne peuvent pas prendre le même créneau, même si elles
-- cliquent à la même seconde : c'est la base qui tranche, pas l'écran.
create unique index reservations_creneau_unique
  on reservations (debut)
  where statut in ('reservee', 'effectuee', 'annulee_hors_delai', 'absent');

create index reservations_dossier on reservations (dossier_id, debut desc);
create index reservations_a_facturer on reservations (debut)
  where facture_id is null and statut in ('effectuee', 'annulee_hors_delai', 'absent');

-- ---------------------------------------------------------------------
--  Documents
-- ---------------------------------------------------------------------

create table documents (
  id             uuid primary key default gen_random_uuid(),
  dossier_id     uuid not null references dossiers (id) on delete cascade,
  reservation_id uuid references reservations (id) on delete set null,
  chemin         text not null,                 -- clé dans Supabase Storage
  nom_fichier    text not null,
  type_mime      text not null,
  taille_octets  int  not null check (taille_octets <= 10 * 1024 * 1024),
  depose_par     depose_par not null,
  cree_le        timestamptz not null default now(),
  check (type_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic'))
);

create index documents_dossier on documents (dossier_id, cree_le desc);

-- ---------------------------------------------------------------------
--  Factures
--  Numérotation continue par année, attribuée à la validation et
--  jamais réutilisée. Une facture validée ne se supprime pas : elle
--  s'annule par un avoir.
-- ---------------------------------------------------------------------

create table compteur_factures (
  annee   int primary key,
  dernier int not null default 0
);

create table factures (
  id              uuid primary key default gen_random_uuid(),
  dossier_id      uuid not null references dossiers (id) on delete restrict,
  numero          text unique,                  -- nul tant que brouillon
  statut          statut_facture not null default 'brouillon',
  periode_debut   date not null,
  periode_fin     date not null,
  emise_le        date,
  echeance_le     date,
  total_cents     int not null default 0,
  pdf_chemin      text,
  envoyee_le      timestamptz,
  payee_le        timestamptz,
  relancee_le     timestamptz,
  avoir_de        uuid references factures (id),
  cree_le         timestamptz not null default now()
);

create index factures_dossier on factures (dossier_id, periode_debut desc);
create index factures_impayees on factures (echeance_le)
  where statut in ('envoyee', 'en_retard');

alter table reservations
  add constraint reservations_facture_fk
  foreign key (facture_id) references factures (id) on delete set null;

create table lignes_facture (
  id                 uuid primary key default gen_random_uuid(),
  facture_id         uuid not null references factures (id) on delete cascade,
  reservation_id     uuid references reservations (id) on delete set null,
  description        text not null,
  quantite           numeric(6,2) not null default 1,
  prix_unitaire_cents int not null,
  total_cents        int not null,
  ordre              int not null default 0
);

create index lignes_facture_facture on lignes_facture (facture_id, ordre);

-- Une facture validée est intouchable.
create or replace function facture_verrouillee()
returns trigger language plpgsql as $$
begin
  if old.statut <> 'brouillon' and tg_op = 'DELETE' then
    raise exception 'Une facture validée ne se supprime pas : créez un avoir.';
  end if;
  if old.numero is not null and new.numero is distinct from old.numero then
    raise exception 'Le numéro d''une facture ne se modifie pas.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger factures_verrou
  before update or delete on factures
  for each row execute function facture_verrouillee();

-- ---------------------------------------------------------------------
--  Pages éditoriales — Pauline change ses textes sans nous.
-- ---------------------------------------------------------------------

create table pages (
  slug     text primary key,
  titre    text not null,
  contenu  text not null default '',
  maj_le   timestamptz not null default now()
);

insert into pages (slug, titre) values
  ('accueil',        'Accueil'),
  ('a-propos',       'À propos'),
  ('tarifs',         'Tarifs'),
  ('mentions',       'Mentions légales'),
  ('cgv',            'Conditions générales de vente'),
  ('confidentialite','Politique de confidentialité');

-- ---------------------------------------------------------------------
--  Journal — qui a fait quoi, quand.
--  Sert le jour où un parent affirme avoir annulé à temps.
-- ---------------------------------------------------------------------

create table journal (
  id         bigserial primary key,
  acteur     text not null,              -- 'client' | 'pauline' | 'systeme'
  dossier_id uuid references dossiers (id) on delete set null,
  objet      text not null,              -- 'reservation' | 'facture' | 'dossier' | …
  objet_id   uuid,
  action     text not null,
  details    jsonb not null default '{}'::jsonb,
  cree_le    timestamptz not null default now()
);

create index journal_dossier on journal (dossier_id, cree_le desc);
create index journal_objet   on journal (objet, objet_id, cree_le desc);

-- =====================================================================
--  Les règles de réservation, appliquées par la base
--  Elles ne sont pas dans le code de l'application : même un bug
--  d'écran ou un appel direct à l'API ne peut pas les contourner.
-- =====================================================================

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

  -- Pause minimale entre deux séances
  if p.pause_entre_cours_min > 0 and exists (
    select 1 from reservations
     where statut in ('reservee', 'effectuee')
       and debut < new.fin   + make_interval(mins => p.pause_entre_cours_min)
       and fin   > new.debut - make_interval(mins => p.pause_entre_cours_min)
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

create trigger reservations_regles
  before insert on reservations
  for each row execute function verifier_reservation();

-- Classer une annulation selon le délai, sans faire confiance à l'appelant.
create or replace function classer_annulation()
returns trigger language plpgsql as $$
declare p parametres%rowtype;
begin
  select * into p from parametres where id;
  if new.statut = 'annulee_dans_delai'
     and old.debut < now() + make_interval(hours => p.delai_annulation_h) then
    new.statut := 'annulee_hors_delai';
  end if;
  if new.statut <> old.statut and new.statut like 'annulee%' then
    new.annule_le := now();
  end if;
  return new;
end;
$$;

create trigger reservations_annulation
  before update of statut on reservations
  for each row execute function classer_annulation();

-- Numéro de facture attribué à la validation, jamais avant.
create or replace function attribuer_numero_facture(facture uuid)
returns text language plpgsql as $$
declare
  annee_courante int := extract(year from now());
  suivant int;
  numero text;
begin
  insert into compteur_factures (annee, dernier) values (annee_courante, 0)
    on conflict (annee) do nothing;

  update compteur_factures
     set dernier = dernier + 1
   where annee = annee_courante
  returning dernier into suivant;

  numero := annee_courante || '-' || lpad(suivant::text, 3, '0');

  update factures
     set numero = numero,
         statut = 'envoyee',
         emise_le = current_date,
         echeance_le = current_date
                     + (select delai_paiement_jours from parametres where id)
   where id = facture and statut = 'brouillon';

  return numero;
end;
$$;

-- =====================================================================
--  Sécurité : chaque client ne voit que son dossier.
--  L'administration passe par la clé de service, côté serveur.
-- =====================================================================

alter table dossiers        enable row level security;
alter table reservations    enable row level security;
alter table documents       enable row level security;
alter table factures        enable row level security;
alter table lignes_facture  enable row level security;
alter table journal         enable row level security;
alter table liste_noire     enable row level security;
alter table parametres      enable row level security;
alter table tarifs          enable row level security;
alter table disponibilites  enable row level security;
alter table indisponibilites enable row level security;
alter table pages           enable row level security;

create policy "mon dossier" on dossiers
  for select using (user_id = auth.uid());

create policy "mes reservations" on reservations
  for select using (dossier_id in (select id from dossiers where user_id = auth.uid()));

create policy "mes documents" on documents
  for select using (dossier_id in (select id from dossiers where user_id = auth.uid()));

create policy "mes factures" on factures
  for select using (
    dossier_id in (select id from dossiers where user_id = auth.uid())
    and statut <> 'brouillon'
  );

create policy "mes lignes de facture" on lignes_facture
  for select using (
    facture_id in (
      select f.id from factures f
      join dossiers d on d.id = f.dossier_id
      where d.user_id = auth.uid() and f.statut <> 'brouillon'
    )
  );

-- Les pages publiques sont lisibles par tout le monde.
create policy "pages publiques" on pages for select using (true);

-- Tout le reste n'est accessible qu'à la clé de service, qui ignore RLS.
