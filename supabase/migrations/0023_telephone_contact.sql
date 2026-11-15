-- ---------------------------------------------------------------------
--  0023 — Le numéro où l'on peut écrire
--
--  L'espace élève propose désormais d'écrire à Pauline sur WhatsApp. Il
--  lui faut donc un numéro, et pas celui de Wero : l'un sert à être
--  payée, l'autre à être jointe. Ce sont aujourd'hui les mêmes chiffres,
--  mais rien ne dit qu'ils le resteront, et lier les deux obligerait à
--  changer son moyen de paiement pour changer son numéro de contact.
--
--  Vide, le bouton WhatsApp ne s'affiche pas : l'email reste.
-- ---------------------------------------------------------------------

alter table parametres
  add column if not exists telephone_contact text
    default '+33 6 67 91 04 90';

comment on column parametres.telephone_contact is
  'Numéro affiché à l''élève pour écrire sur WhatsApp. Vide : le bouton '
  'disparaît et seul l''email est proposé.';

-- PostgreSQL 11 et suivants posent la valeur par défaut sur les lignes
-- existantes, sans réécrire la table. Cette mise à jour ne sert donc
-- qu'au cas où la colonne existait déjà, sans défaut : elle ne coûte
-- rien et évite d'avoir à le vérifier.
update parametres
   set telephone_contact = '+33 6 67 91 04 90'
 where telephone_contact is null;
