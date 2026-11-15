-- ---------------------------------------------------------------------
--  0024 — La période facturée devient facultative
--
--  Une facture portait jusqu'ici une période obligatoire, héritée du
--  mois pour lequel elle avait été préparée. C'était juste tant que la
--  facturation était mensuelle ; ça ne l'est plus. Une facture peut
--  réunir un stage de février et deux cours de mars, ou n'avoir aucune
--  période du tout — ses lignes portent déjà la date de chaque séance,
--  et une mention « Période : septembre » au-dessus de cours de
--  novembre est pire qu'une absence : elle est fausse.
--
--  Deux niveaux de décision, parce que ce sont deux questions :
--  l'interrupteur dans les réglages dit si la période a sa place sur
--  les documents en général ; la période d'une facture donnée peut
--  être changée ou effacée, quelle que soit la réponse.
-- ---------------------------------------------------------------------

alter table factures alter column periode_debut drop not null;
alter table factures alter column periode_fin   drop not null;

comment on column factures.periode_debut is
  'Facultative. Vide, le document ne porte aucune mention de période : '
  'les lignes disent déjà de quand datent les cours.';

-- Les deux vont ensemble : une période qui n'aurait qu'une borne ne
-- voudrait rien dire, et l'affichage ne saurait quoi en faire.
alter table factures
  add constraint factures_periode_entiere
  check (
    (periode_debut is null and periode_fin is null)
    or (periode_debut is not null and periode_fin is not null)
  );

alter table parametres
  add column if not exists afficher_periode boolean not null default true;

comment on column parametres.afficher_periode is
  'Décroché, aucune facture ne porte de période, même celles qui en ont '
  'une enregistrée. Le réglage ne modifie pas les factures : il décide '
  'seulement de ce qui est imprimé.';
