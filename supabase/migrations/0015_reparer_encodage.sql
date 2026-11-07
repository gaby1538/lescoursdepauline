-- ---------------------------------------------------------------------
--  0015 — Réparer les accents abîmés
--
--  « momentanément » s'affiche « momentanÃ©ment ». Les fichiers du site
--  sont en UTF-8 et corrects ; c'est à l'exécution du SQL que les octets
--  ont été relus comme du Windows-1252, si bien que « é » (C3 A9) est
--  devenu les deux caractères « Ã » et « © ».
--
--  La réparation est l'opération inverse : réécrire chaque caractère en
--  octet Windows-1252, puis relire la suite d'octets en UTF-8. Elle ne
--  touche que les textes effectivement abîmés — repérables au « Ã » ou
--  au « â€ », qui n'apparaissent dans aucun mot français — et laisse
--  tout le reste intact.
-- ---------------------------------------------------------------------

create or replace function reparer_texte(valeur text)
returns text language plpgsql immutable as $$
begin
  if valeur is null or valeur !~ '(Ã|â€|Â)' then
    return valeur;
  end if;
  return convert_from(convert_to(valeur, 'WIN1252'), 'UTF8');
exception when others then
  -- Un texte que Windows-1252 ne sait pas représenter n'a pas pu être
  -- abîmé de cette façon : on le rend tel quel plutôt que d'échouer.
  return valeur;
end;
$$;

-- On ne devine pas la liste des colonnes : on les parcourt toutes. Le
-- garde-fou est dans reparer_texte, qui ne touche qu'un texte portant la
-- marque de la corruption. Les colonnes techniques sont écartées : un
-- chemin de fichier ou un IBAN abîmé ne se répare pas, il se ressaisit.
do $$
declare
  colonne record;
  touchees int;
  total int := 0;
begin
  for colonne in
    select table_name as t, column_name as c
      from information_schema.columns
     where table_schema = 'public'
       and data_type = 'text'
       and is_updatable = 'YES'
       and column_name not in (
         'chemin', 'pdf_chemin', 'type_mime', 'google_event_id',
         'lien_visio', 'iban', 'siret', 'numero', 'slug',
         'jeton_agenda', 'token_confirmation'
       )
     order by table_name, ordinal_position
  loop
    execute format(
      'update %I set %I = reparer_texte(%I) where %I ~ ''(Ã|â€|Â)''',
      colonne.t, colonne.c, colonne.c, colonne.c
    );
    get diagnostics touchees = row_count;
    if touchees > 0 then
      total := total + touchees;
      raise notice 'réparé : %.% (% ligne(s))', colonne.t, colonne.c, touchees;
    end if;
  end loop;

  raise notice '— % valeur(s) réparée(s) au total.', total;
end $$;

-- ---------------------------------------------------------------------
--  Les messages d'erreur vivent dans le corps des fonctions, que la
--  réparation ci-dessus ne touche pas. On réécrit les deux concernées.
-- ---------------------------------------------------------------------

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
