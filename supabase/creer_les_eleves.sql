-- ---------------------------------------------------------------------
--  Les cinq élèves de Pauline, et leurs cours jusqu'à l'été
--
--  À coller dans l'éditeur SQL de Supabase, en une fois. Le script peut
--  être relancé sans dommage : il ne recrée pas une fiche qui existe
--  déjà, ne repose pas une séance déjà posée, et saute les créneaux
--  occupés plutôt que d'échouer.
--
--  Ce qu'il fait, pour chacun :
--    — une fiche sans adresse email (l'élève n'a aucun accès au site) ;
--    — une série, pour pouvoir prolonger ou arrêter d'un clic ;
--    — une séance par semaine, d'ici la fin de l'année scolaire,
--      en sautant les vacances connues de la table vacances_scolaires.
--
--  Une séance de deux heures fait DEUX lignes d'une heure : c'est ainsi
--  que le site compte partout ailleurs, et c'est ce qui fait qu'une
--  facture dit « 2 × 40 € » et non « 1 × 80 € ».
--
--  Prérequis : les migrations 0018 à 0024. Sans 0022, ce script
--  échouera — la table « series » n'existerait pas.
-- ---------------------------------------------------------------------

do $$
declare
  c         record;
  v_dossier uuid;
  v_serie   uuid;
  d         date;
  premier   date;
  v_debut   timestamptz;
  v_fin     timestamptz;
  i         int;
  tranches  int;
begin
  for c in
    select * from (values
      --  prénom,     tarif/h, jour (1=lundi … 7=dimanche), heure,  durée
      ('Alan',    3900, 3, time '17:00', 60),
      ('Yanis',   2500, 7, time '18:00', 60),
      ('CRPE',    4000, 4, time '20:00', 120),
      ('Antoine', 3400, 1, time '17:30', 60),
      ('Yasmine', 3300, 3, time '15:00', 60)
    ) as t(prenom, tarif, jour, heure, duree)
  loop
    -- ---- la fiche ----
    select id into v_dossier
      from dossiers
     where eleve_prenom = c.prenom
       and email is null
       and archive_le is null
       and anonymise = false
     limit 1;

    if v_dossier is null then
      insert into dossiers (eleve_prenom, tarif_horaire_cents)
      values (c.prenom, c.tarif)
      returning id into v_dossier;
    else
      -- Déjà là : on remet seulement le tarif à jour.
      update dossiers set tarif_horaire_cents = c.tarif where id = v_dossier;
    end if;

    -- ---- la série ----
    select id into v_serie
      from series
     where dossier_id = v_dossier
       and jour_semaine = c.jour
       and heure = c.heure
       and arretee_le is null
     limit 1;

    if v_serie is null then
      insert into series (dossier_id, jour_semaine, heure, duree_min, prix_cents)
      values (v_dossier, c.jour, c.heure, c.duree, c.tarif)
      returning id into v_serie;
    end if;

    -- ---- les séances ----
    -- La première tombe au prochain jour voulu, à partir de demain.
    premier := (current_date + 1)
             + ((c.jour - extract(isodow from current_date + 1)::int + 7) % 7);

    tranches := greatest(c.duree / 60, 1);

    for d in
      select g::date
        from generate_series(premier, date '2027-07-02', interval '7 days') g
    loop
      -- Les vacances connues : Toussaint, Noël, grandes vacances. Celles
      -- de février et de Pâques changent selon la zone de chaque élève,
      -- et ne sont donc pas dans la table : elles s'annulent à la main.
      continue when exists (
        select 1 from vacances_scolaires v
         where v.debut <= d and v.fin >= d
      );

      for i in 0 .. tranches - 1 loop
        v_debut := (d + c.heure) at time zone 'Europe/Paris'
                 + make_interval(hours => i);
        v_fin   := v_debut + interval '1 hour';

        -- Déjà posée, ou l'heure est prise par quelqu'un d'autre :
        -- on passe, plutôt que de faire échouer tout le script.
        continue when exists (
          select 1 from reservations r
           where r.statut in ('reservee', 'effectuee')
             and r.debut < v_fin
             and r.fin   > v_debut
        );

        insert into reservations (
          dossier_id, debut, fin, prix_cents,
          cree_par_pauline, validee_le, serie_id
        )
        values (
          v_dossier, v_debut, v_fin, c.tarif,
          true, now(), v_serie
        );
      end loop;
    end loop;
  end loop;
end $$;


-- ---------------------------------------------------------------------
--  Ce qui a été créé. À lire avant de fermer la page.
-- ---------------------------------------------------------------------
select
  d.eleve_prenom                                   as "Élève",
  to_char(d.tarif_horaire_cents / 100.0, '999D99') || ' €/h' as "Tarif",
  case s.jour_semaine
    when 1 then 'lundi'    when 2 then 'mardi'  when 3 then 'mercredi'
    when 4 then 'jeudi'    when 5 then 'vendredi'
    when 6 then 'samedi'   else 'dimanche'
  end || ' ' || to_char(s.heure, 'HH24:MI')        as "Créneau",
  s.duree_min || ' min'                            as "Durée",
  count(r.id)                                      as "Lignes posées",
  min(r.debut at time zone 'Europe/Paris')::date   as "Première",
  max(r.debut at time zone 'Europe/Paris')::date   as "Dernière"
from dossiers d
join series s on s.dossier_id = d.id
left join reservations r on r.serie_id = s.id
where d.eleve_prenom in ('Alan', 'Yanis', 'CRPE', 'Antoine', 'Yasmine')
  and d.email is null
group by d.eleve_prenom, d.tarif_horaire_cents, s.jour_semaine, s.heure, s.duree_min
order by s.jour_semaine, s.heure;
