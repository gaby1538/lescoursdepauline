-- ---------------------------------------------------------------------
--  0021 — Revenir en arrière sur l'état d'une facture
--
--  Émettre restait le seul geste irréversible du site. En pratique
--  l'erreur de clic existe : on émet la facture du mauvais élève, on
--  l'envoie, on s'en aperçoit dans la minute. Obliger à vivre avec
--  n'aide personne.
--
--  Ce que la loi demande n'est pas qu'une facture soit indélébile, mais
--  que la série de numéros soit continue : ni trou, ni doublon. Un
--  numéro ne peut donc être rendu que s'il est le dernier attribué de
--  l'année — alors le compteur recule d'un cran et le numéro repartira
--  à la prochaine émission, intact. Au milieu de la série, le rendre
--  creuserait un trou que rien ne vient combler : la fonction refuse.
--
--  Démarquer « payée » ne touche à rien de tout cela : c'est un
--  pointage d'encaissement, pas un numéro.
-- ---------------------------------------------------------------------

-- Le verrou sur le numéro reste la règle ; il apprend son unique
-- exception. remettre_en_brouillon() pose ce drapeau le temps de sa
-- transaction, et elle seule : une mise à jour ordinaire des factures
-- se heurte au verrou comme avant.
create or replace function facture_verrouillee()
returns trigger language plpgsql as $$
begin
  if old.statut <> 'brouillon' and tg_op = 'DELETE' then
    raise exception 'Une facture validée ne se supprime pas : créez un avoir.';
  end if;

  if old.numero is not null
     and new.numero is distinct from old.numero
     and coalesce(current_setting('app.rendre_numero', true), '') <> 'oui' then
    raise exception 'Le numéro d''une facture ne se modifie pas.';
  end if;

  return coalesce(new, old);
end;
$$;

-- Une facture pointée payée par erreur, ou sur la mauvaise ligne.
create or replace function demarquer_payee(facture uuid)
returns void language plpgsql as $$
declare
  f factures;
begin
  select * into f from factures where id = facture;

  if not found then
    raise exception 'FACTURE_INTROUVABLE';
  end if;

  if f.statut = 'brouillon' then
    raise exception 'FACTURE_BROUILLON';
  end if;

  -- Elle retrouve l'état qu'elle aurait sans le paiement : en retard si
  -- l'échéance est passée, en attente sinon.
  update factures
     set statut = case
                    when f.echeance_le is not null and f.echeance_le < current_date
                      then 'en_retard'::statut_facture
                    else 'envoyee'::statut_facture
                  end,
         payee_le = null,
         mode_reglement = null
   where id = facture;
end;
$$;

-- Rendre son numéro à une facture et la ramener au brouillon.
create or replace function remettre_en_brouillon(facture uuid)
returns text language plpgsql as $$
declare
  f         factures;
  v_annee   int;
  v_rang    int;
  v_dernier int;
begin
  select * into f from factures where id = facture;

  if not found then
    raise exception 'FACTURE_INTROUVABLE';
  end if;

  if f.statut = 'brouillon' then
    raise exception 'DEJA_BROUILLON';
  end if;

  if f.numero is null then
    raise exception 'SANS_NUMERO';
  end if;

  -- Un numéro saisi à la main hors du format de la série ne se replace
  -- pas dans le compteur : on ne saurait pas quoi reculer.
  if f.numero !~ '^[0-9]{4}-[0-9]+$' then
    raise exception 'NUMERO_HORS_SERIE';
  end if;

  v_annee := split_part(f.numero, '-', 1)::int;
  v_rang  := split_part(f.numero, '-', 2)::int;

  select dernier into v_dernier
    from compteur_factures where annee = v_annee;

  -- Deux vérifications plutôt qu'une : le compteur dit où en est la
  -- série, les factures disent ce qui existe vraiment. Si l'un des deux
  -- a dérivé, on refuse plutôt que de créer un doublon.
  if v_dernier is null or v_rang <> v_dernier then
    raise exception 'NUMERO_NON_DERNIER';
  end if;

  if exists (
    select 1 from factures
     where id <> facture
       and numero ~ ('^' || v_annee || '-[0-9]+$')
       and split_part(numero, '-', 2)::int >= v_rang
  ) then
    raise exception 'NUMERO_NON_DERNIER';
  end if;

  -- Tout ce que l'émission avait posé s'efface : le numéro, les dates,
  -- la trace de l'envoi et le pointage du paiement. Les lignes et les
  -- cours rattachés restent, c'est bien le même brouillon qu'avant.
  --
  -- Le drapeau ne vaut que pour cette transaction : le verrou se
  -- rétablit de lui-même, même si la suite échoue.
  perform set_config('app.rendre_numero', 'oui', true);

  update factures
     set statut                 = 'brouillon',
         numero                 = null,
         emise_le               = null,
         echeance_le            = null,
         envoyee_le             = null,
         remise_le              = null,
         transferee_le          = null,
         message_accompagnement = null,
         payee_le               = null,
         mode_reglement         = null
   where id = facture;

  perform set_config('app.rendre_numero', '', true);

  update compteur_factures
     set dernier = greatest(dernier - 1, 0)
   where annee = v_annee;

  return f.numero;
end;
$$;

comment on function remettre_en_brouillon(uuid) is
  'Ramène une facture émise à l''état de brouillon et rend son numéro '
  'au compteur. Refuse si ce numéro n''est pas le dernier de l''année, '
  'pour que la série reste sans trou.';
