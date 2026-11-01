-- =====================================================================
--  0004 — Comptes élèves
--
--  Le compte ne donne accès au dossier qu'une fois l'adresse prouvée.
--  Le jeton envoyé par email est la seule preuve : tant que
--  email_confirme_le est nul, une session authentifiée ne voit rien,
--  même si user_id est renseigné.
-- =====================================================================

drop policy if exists "mon dossier"           on dossiers;
drop policy if exists "mes reservations"      on reservations;
drop policy if exists "mes documents"         on documents;
drop policy if exists "mes factures"          on factures;
drop policy if exists "mes lignes de facture" on lignes_facture;

create policy "mon dossier" on dossiers
  for select using (
    user_id = auth.uid()
    and email_confirme_le is not null
    and anonymise = false
  );

create policy "mes reservations" on reservations
  for select using (
    dossier_id in (
      select id from dossiers
      where user_id = auth.uid()
        and email_confirme_le is not null
        and anonymise = false
    )
  );

create policy "mes documents" on documents
  for select using (
    dossier_id in (
      select id from dossiers
      where user_id = auth.uid()
        and email_confirme_le is not null
        and anonymise = false
    )
  );

create policy "mes factures" on factures
  for select using (
    dossier_id in (
      select id from dossiers
      where user_id = auth.uid()
        and email_confirme_le is not null
        and anonymise = false
    )
    and statut <> 'brouillon'
  );

create policy "mes lignes de facture" on lignes_facture
  for select using (
    facture_id in (
      select f.id from factures f
      join dossiers d on d.id = f.dossier_id
      where d.user_id = auth.uid()
        and d.email_confirme_le is not null
        and d.anonymise = false
        and f.statut <> 'brouillon'
    )
  );

-- Retrouver un dossier par son jeton doit rester immédiat.
create index if not exists dossiers_token
  on dossiers (token_confirmation) where anonymise = false;
