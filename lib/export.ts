import "server-only";
import { clientAdmin } from "./supabase";

/**
 * Les exports comptables, partagés entre le téléchargement manuel et
 * la sauvegarde mensuelle : une seule écriture, donc un seul endroit
 * où une erreur peut se glisser.
 */

const MODES: Record<string, string> = {
  virement: "Virement",
  wero: "Wero",
  cheque: "Chèque",
  especes: "Espèces",
  autre: "Autre",
};

const STATUTS: Record<string, string> = {
  envoyee: "Émise, en attente",
  payee: "Encaissée",
  en_retard: "En retard",
  annulee: "Annulée",
};

function champ(valeur: string | number | null | undefined): string {
  const texte = String(valeur ?? "");
  return /[";\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

function somme(centimes: number): string {
  return (centimes / 100).toFixed(2).replace(".", ",");
}

function date(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString("fr-FR") : "";
}

/**
 * Le livre des recettes d'une année.
 *
 * Point-virgule, virgule décimale et marque d'ordre des octets : c'est
 * ce qu'attend un tableur en français, sinon tout atterrit dans une
 * seule colonne avec les accents cassés.
 */
export async function livreDesRecettes(annee: string): Promise<string> {
  const { data, error } = await clientAdmin()
    .from("factures")
    .select(
      "numero, statut, emise_le, echeance_le, payee_le, mode_reglement, total_cents, periode_debut, destinataire_nom, dossiers (prenom, nom, email, eleve_prenom)"
    )
    .not("numero", "is", null)
    .gte("emise_le", `${annee}-01-01`)
    .lte("emise_le", `${annee}-12-31`)
    .order("emise_le");

  if (error) throw new Error(error.message);

  const lignes: string[] = [
    [
      "Numéro",
      "Date d'émission",
      "Client",
      "Élève",
      "Période",
      "Montant (€)",
      "Statut",
      "Date d'encaissement",
      "Mode de règlement",
      "Échéance",
    ].join(";"),
  ];

  let total = 0;
  let encaisse = 0;

  for (const f of data ?? []) {
    const dossier = f.dossiers as unknown as {
      prenom: string | null;
      nom: string | null;
      email: string;
      eleve_prenom: string | null;
    } | null;

    const nomDuDossier = `${dossier?.prenom ?? ""} ${dossier?.nom ?? ""}`.trim();
    const client = f.destinataire_nom ?? (nomDuDossier || dossier?.email || "—");

    total += f.total_cents;
    if (f.statut === "payee") encaisse += f.total_cents;

    lignes.push(
      [
        champ(f.numero),
        champ(date(f.emise_le)),
        champ(client),
        champ(dossier?.eleve_prenom ?? ""),
        champ(f.periode_debut?.slice(0, 7) ?? ""),
        champ(somme(f.total_cents)),
        champ(STATUTS[f.statut] ?? f.statut),
        champ(date(f.payee_le)),
        champ(f.mode_reglement ? MODES[f.mode_reglement] ?? f.mode_reglement : ""),
        champ(date(f.echeance_le)),
      ].join(";")
    );
  }

  lignes.push("");
  lignes.push(`Total facturé ${annee};;;;;${somme(total)}`);
  lignes.push(`Total encaissé ${annee};;;;;${somme(encaisse)}`);
  lignes.push(`Reste à encaisser;;;;;${somme(total - encaisse)}`);
  lignes.push("");
  lignes.push("TVA non applicable, article 293 B du Code général des impôts");
  lignes.push(`Édité le ${new Date().toLocaleDateString("fr-FR")}`);

  return "﻿" + lignes.join("\r\n") + "\r\n";
}

/**
 * Une copie des données qui comptent, en JSON.
 *
 * De quoi tout reconstituer si la base disparaissait. Les paramètres
 * en sont exclus : ils contiennent l'IBAN et les jetons, qui n'ont
 * rien à faire dans une pièce jointe.
 */
export async function copieDesDonnees(): Promise<string> {
  const supabase = clientAdmin();

  const [dossiers, reservations, factures, lignes, documents] = await Promise.all([
    supabase.from("dossiers").select("*").eq("anonymise", false),
    supabase.from("reservations").select("*"),
    supabase.from("factures").select("*"),
    supabase.from("lignes_facture").select("*"),
    supabase.from("documents").select("id, dossier_id, nom_fichier, type_mime, taille_octets, cree_le"),
  ]);

  // Les jetons d'accès n'ont pas à circuler par email.
  const sansJetons = (dossiers.data ?? []).map((d) => {
    const copie = { ...d };
    delete copie.token_confirmation;
    delete copie.token_expire_le;
    return copie;
  });

  return JSON.stringify(
    {
      exporte_le: new Date().toISOString(),
      dossiers: sansJetons,
      reservations: reservations.data ?? [],
      factures: factures.data ?? [],
      lignes_facture: lignes.data ?? [],
      documents: documents.data ?? [],
    },
    null,
    2
  );
}
