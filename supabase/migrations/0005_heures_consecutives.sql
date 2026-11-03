-- =====================================================================
--  0005 — Réserver plusieurs heures d'affilée
--
--  Une séance de deux heures s'enregistre comme deux réservations d'une
--  heure qui se suivent : la facturation, les annulations et l'index
--  unique continuent de fonctionner sans rien changer.
--
--  Deux corrections de règles l'accompagnent, et une respiration sur
--  les plafonds, devenus trop serrés dès lors qu'une seule séance peut
--  consommer plusieurs heures.
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

create or replace function creneaux_libres(jour_debut date, jour_fin date)
returns table (debut timestamptz, fin timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select * from parametres where id
  ),
  jours as (
    select d::date as jour
    from generate_series(jour_debut, jour_fin, interval '1 day') as d
  ),
  bruts as (
    select
      ((j.jour + dispo.heure_debut)
        + (n * make_interval(mins => p.pas_grille_min)))
        at time zone 'Europe/Paris' as debut,
      ((j.jour + dispo.heure_debut)
        + (n * make_interval(mins => p.pas_grille_min))
        + make_interval(mins => p.duree_seance_min))
        at time zone 'Europe/Paris' as fin,
      j.jour
    from jours j
    cross join p
    join disponibilites dispo
      on dispo.actif
     and dispo.jour_semaine = extract(isodow from j.jour)
    cross join lateral generate_series(
      0,
      ((extract(epoch from (dispo.heure_fin - dispo.heure_debut)) / 60
        - p.duree_seance_min)::int / p.pas_grille_min)
    ) as n
  )
  select b.debut, b.fin
  from bruts b
  cross join p
  where b.debut >= now() + make_interval(hours => p.delai_reservation_h)
    and not exists (
      select 1 from indisponibilites i
       where i.debut < b.fin and i.fin > b.debut
    )
    and not exists (
      select 1 from reservations r
       where r.statut in ('reservee', 'effectuee')
         and r.debut < b.fin and r.fin > b.debut
    )
    and not exists (
      select 1 from reservations r
       where r.statut in ('reservee', 'effectuee')
         and r.debut < b.fin   + make_interval(mins => p.pause_entre_cours_min)
         and r.fin   > b.debut - make_interval(mins => p.pause_entre_cours_min)
         and r.debut <> b.fin
         and r.fin   <> b.debut
    )
    and (
      select count(*) from reservations r2
       where r2.statut in ('reservee', 'effectuee')
         and (r2.debut at time zone 'Europe/Paris')::date = b.jour
    ) < p.max_cours_par_jour
  order by b.debut;
$$;

-- Les plafonds comptaient des heures comme s'il s'agissait de cours.
-- Avec trois par semaine, une seule séance de deux heures en consommait
-- déjà les deux tiers. La garde la plus solide contre les réservations
-- fictives reste ailleurs : une seule heure tant que l'adresse n'est pas
-- confirmée. Ces deux nombres se règlent ensuite sans redéploiement.
update parametres
   set max_par_semaine = 6,
       max_a_venir     = 10
 where id;

-- « create or replace » conserve les droits, on les repose par sécurité.
grant execute on function creneaux_libres(date, date) to anon, authenticated;
