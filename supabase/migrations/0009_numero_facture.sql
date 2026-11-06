-- =====================================================================
--  0009 — Choisir le numéro de facture
--
--  Le numéro restait imposé. Pauline peut désormais le saisir, avec la
--  suite logique proposée par défaut. Le compteur se cale sur ce
--  qu'elle choisit, pour que la proposition suivante ne retombe jamais
--  sur un numéro déjà pris.
-- =====================================================================

/** Le prochain numéro, sans le consommer : c'est une suggestion. */
create or replace function numero_suggere()
returns text language sql stable as $$
  select extract(year from now())::int || '-' || lpad(
    (coalesce(
       (select dernier from compteur_factures
         where annee = extract(year from now())::int), 0) + 1)::text,
    3, '0');
$$;

create or replace function emettre_facture(
  facture uuid,
  numero_choisi text default null
)
returns text language plpgsql as $$
declare
  annee_courante int := extract(year from now());
  suivant  int;
  v_numero text;
  propose  text := nullif(btrim(coalesce(numero_choisi, '')), '');
begin
  insert into compteur_factures (annee, dernier) values (annee_courante, 0)
    on conflict (annee) do nothing;

  if propose is null then
    update compteur_factures
       set dernier = dernier + 1
     where annee = annee_courante
    returning dernier into suivant;

    v_numero := annee_courante || '-' || lpad(suivant::text, 3, '0');
  else
    v_numero := propose;

    -- Numéro saisi à la forme habituelle : on fait avancer le compteur
    -- jusque-là, sinon la suggestion suivante reproposerait un numéro
    -- déjà utilisé et l'émission échouerait.
    if v_numero ~ ('^' || annee_courante || '-[0-9]+$') then
      suivant := split_part(v_numero, '-', 2)::int;
      update compteur_factures
         set dernier = greatest(dernier, suivant)
       where annee = annee_courante;
    end if;
  end if;

  update factures
     set numero      = v_numero,
         statut      = 'envoyee',
         emise_le    = current_date,
         echeance_le = current_date
                     + (select delai_paiement_jours from parametres where id)
   where id = facture and statut = 'brouillon';

  if not found then
    raise exception 'FACTURE_NON_BROUILLON';
  end if;

  return v_numero;
end;
$$;

-- Une seule mécanique d'émission : l'ancienne fonction délègue.
create or replace function attribuer_numero_facture(facture uuid)
returns text language sql as $$
  select emettre_facture(facture, null);
$$;
