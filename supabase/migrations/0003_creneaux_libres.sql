-- =====================================================================
--  Calcul des créneaux libres, et confirmation d'adresse email
-- =====================================================================

-- ---------------------------------------------------------------------
--  Jeton de confirmation d'adresse.
--  Le lien envoyé par email confirme l'adresse en un clic, sans mot de
--  passe. Tant qu'elle n'est pas confirmée, le dossier est limité à un
--  seul créneau — c'est la protection anti-spam principale.
-- ---------------------------------------------------------------------

alter table dossiers
  add column token_confirmation uuid not null default gen_random_uuid();

create unique index dossiers_token_confirmation
  on dossiers (token_confirmation);

-- ---------------------------------------------------------------------
--  creneaux_libres(du, au)
--
--  Déroule les plages récurrentes sur la période, découpe à la grille,
--  puis retire ce qui n'est pas réservable : trop proche, en congé,
--  déjà pris, trop collé à un autre cours, ou dans une journée pleine.
--
--  SECURITY DEFINER parce que les tables lues sont protégées par RLS :
--  un visiteur non connecté ne doit pas pouvoir lire les réservations,
--  mais doit pouvoir savoir quels créneaux restent libres.
-- ---------------------------------------------------------------------

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
         and r.debut < b.fin   + make_interval(mins => p.pause_entre_cours_min)
         and r.fin   > b.debut - make_interval(mins => p.pause_entre_cours_min)
    )
    and (
      select count(*) from reservations r2
       where r2.statut in ('reservee', 'effectuee')
         and (r2.debut at time zone 'Europe/Paris')::date = b.jour
    ) < p.max_cours_par_jour
  order by b.debut;
$$;

grant execute on function creneaux_libres(date, date) to anon, authenticated;
