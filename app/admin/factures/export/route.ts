import { NextResponse, type NextRequest } from "next/server";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Le livre des recettes d'une année, en CSV.
 *
 * Il sort du système : une base de données en plan gratuit n'est pas
 * un endroit où conserver dix ans de comptabilité. Pauline dépose ce
 * fichier chez elle et le transmet à qui de droit.
 *
 * Point-virgule, virgule décimale et marque d'ordre des octets : c'est
 * ce qu'attend un tableur en français, sinon tout atterrit dans une
 * seule colonne avec les accents cassés.
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

export async function GET(requete: NextRequest) {
  await exigerAdmin();

  const demandee = requete.nextUrl.searchParams.get("annee") ?? "";
  const annee = /^\d{4}$/.test(demandee)
    ? demandee
    : String(new Date().getFullYear());

  const { data, error } = await clientAdmin()
    .from("factures")
    .select(
      "numero, statut, emise_le, echeance_le, payee_le, mode_reglement, total_cents, periode_debut, destinataire_nom, dossiers (prenom, nom, email, eleve_prenom)"
    )
    .not("numero", "is", null)
    .gte("emise_le", `${annee}-01-01`)
    .lte("emise_le", `${annee}-12-31`)
    .order("emise_le");

  if (error) {
    console.error("export comptable", error);
    return new NextResponse("Export impossible", { status: 500 });
  }

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
    const client =
      f.destinataire_nom ?? (nomDuDossier || dossier?.email || "—");

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

  // La marque d'ordre des octets évite les accents cassés dans Excel.
  const contenu = "﻿" + lignes.join("\r\n") + "\r\n";

  return new NextResponse(contenu, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="recettes-${annee}.csv"`,
      "cache-control": "no-store",
    },
  });
}
