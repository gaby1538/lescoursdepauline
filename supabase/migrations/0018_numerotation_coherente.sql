-- ---------------------------------------------------------------------
--  0018 — Une série de numéros qui reste cohérente
--
--  Constaté en rejouant le cas « Pauline a facturé hors du site » :
--
--    numéro proposé par le site      2026-001
--    numéro saisi à la main          2026-0009
--    proposition suivante            2026-010      ← trois chiffres
--
--  La largeur était figée à trois chiffres, quelle que soit celle que
--  Pauline avait employée. La série se lisait 001, 0009, 010, et deux
--  écritures du même rang — 2026-010 et 2026-0010 — sont deux chaînes
--  différentes pour la base : le classement s'en trouve faussé et la
--  continuité devient impossible à démontrer.
--
--  Désormais le numéro reprend la largeur déjà employée cette année, et
--  quatre chiffres par défaut : de quoi tenir sans changer de format, et
--  l'usage courant des factures françaises.
-- ---------------------------------------------------------------------

-- La largeur de la série en cours, telle que Pauline l'a établie.
create or replace function largeur_numero(annee_voulue int)
returns int language sql stable as $$
  select greatest(
    coalesce(
      (select max(length(split_part(numero, '-', 2)))
         from factures
        where numero ~ ('^' || annee_voulue || '-[0-9]+$')),
      4),
    4);
$$;

create or replace function numero_suggere()
returns text language sql stable as $$
  select extract(year from now())::int || '-' || lpad(
    (coalesce(
       (select dernier from compteur_factures
         where annee = extract(year from now())::int), 0) + 1)::text,
    largeur_numero(extract(year from now())::int), '0');
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
    -- L'incrément et la lecture en une seule instruction : deux
    -- émissions simultanées ne peuvent pas obtenir le même rang.
    update compteur_factures
       set dernier = dernier + 1
     where annee = annee_courante
    returning dernier into suivant;

    v_numero := annee_courante || '-' ||
                lpad(suivant::text, largeur_numero(annee_courante), '0');
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
