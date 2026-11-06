-- =====================================================================
--  0012 — De quoi tenir un livre des recettes
--
--  Un micro-entrepreneur doit consigner, pour chaque encaissement, sa
--  date, sa référence, le client, le montant et le mode de règlement.
--  Ce dernier manquait.
-- =====================================================================

alter table factures
  add column if not exists mode_reglement text
    check (mode_reglement in ('virement', 'wero', 'cheque', 'especes', 'autre'));
