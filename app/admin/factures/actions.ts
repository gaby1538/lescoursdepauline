"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";
import { creneauLong, moisLong } from "@/lib/dates";
import { factureEmise } from "@/lib/emails";

const FACTURABLE = ["effectuee", "annulee_hors_delai", "absent"];

function retour(parametre?: string): never {
  revalidatePath("/admin/factures");
  redirect(`/admin/factures${parametre ?? ""}`);
}

/**
 * Rassemble, pour un mois donné, les cours facturables encore libres de
 * toute facture, et en fait un brouillon par élève.
 *
 * Les brouillons ne portent pas de numéro : la numérotation continue
 * n'est attribuée qu'à l'émission, pour qu'un brouillon supprimé ne
 * laisse pas de trou dans la série.
 */
export async function genererFactures(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const mois = String(formulaire.get("mois") ?? "");
  if (!/^\d{4}-\d{2}$/.test(mois)) retour("?erreur=mois");

  const debut = `${mois}-01`;
  const suivant = new Date(`${debut}T00:00:00Z`);
  suivant.setUTCMonth(suivant.getUTCMonth() + 1);
  const fin = suivant.toISOString().slice(0, 10);

  const supabase = clientAdmin();

  const { data: cours } = await supabase
    .from("reservations")
    .select("id, dossier_id, debut, prix_cents")
    .is("facture_id", null)
    .in("statut", FACTURABLE)
    .gte("debut", `${debut}T00:00:00Z`)
    .lt("debut", `${fin}T00:00:00Z`)
    .order("debut");

  if (!cours || cours.length === 0) retour("?ok=rien");

  const parDossier = new Map<string, typeof cours>();
  for (const c of cours) {
    const liste = parDossier.get(c.dossier_id) ?? [];
    liste.push(c);
    parDossier.set(c.dossier_id, liste);
  }

  let creees = 0;

  for (const [dossierId, liste] of parDossier) {
    const total = liste.reduce((somme, c) => somme + c.prix_cents, 0);

    const { data: facture, error } = await supabase
      .from("factures")
      .insert({
        dossier_id: dossierId,
        periode_debut: debut,
        periode_fin: fin,
        total_cents: total,
      })
      .select("id")
      .single();

    if (error || !facture) {
      console.error("création facture", error);
      continue;
    }

    const lignes = liste.map((c, index) => ({
      facture_id: facture.id,
      reservation_id: c.id,
      description: `Cours de SVT — ${creneauLong(c.debut)}`,
      quantite: 1,
      prix_unitaire_cents: c.prix_cents,
      total_cents: c.prix_cents,
      ordre: index,
    }));

    await supabase.from("lignes_facture").insert(lignes);
    await supabase
      .from("reservations")
      .update({ facture_id: facture.id })
      .in(
        "id",
        liste.map((c) => c.id)
      );

    creees += 1;
  }

  retour(`?ok=${creees}`);
}

export async function emettreEtEnvoyer(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();

  const { data: numero, error } = await supabase.rpc("attribuer_numero_facture", {
    facture: id,
  });

  if (error) {
    console.error("numérotation", error);
    retour("?erreur=numero");
  }

  const { data: facture } = await supabase
    .from("factures")
    .select(
      "id, numero, total_cents, echeance_le, periode_debut, dossiers (prenom, email)"
    )
    .eq("id", id)
    .maybeSingle();

  const { count } = await supabase
    .from("lignes_facture")
    .select("id", { count: "exact", head: true })
    .eq("facture_id", id);

  const dossier = facture?.dossiers as unknown as
    | { prenom: string | null; email: string }
    | null;

  if (facture && dossier) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";
    const resultat = await factureEmise({
      destinataire: dossier.email,
      prenom: dossier.prenom ?? "",
      numero: facture.numero ?? String(numero),
      totalCentimes: facture.total_cents,
      echeance: facture.echeance_le
        ? new Date(facture.echeance_le).toLocaleDateString("fr-FR")
        : "",
      lien: `${site}/factures/${facture.id}`,
      heures: count ?? 0,
      periode: moisLong(facture.periode_debut),
    });

    if (resultat.ok) {
      await supabase
        .from("factures")
        .update({ envoyee_le: new Date().toISOString() })
        .eq("id", id);
    }

    await supabase.from("journal").insert({
      acteur: "pauline",
      objet: "facture",
      objet_id: id,
      action: resultat.ok ? "envoyee" : "envoi_echoue",
      details: { numero: facture.numero, detail: resultat.detail },
    });

    retour(resultat.ok ? "?ok=envoyee" : "?erreur=envoi");
  }

  retour("?ok=emise");
}

export async function marquerPayee(formulaire: FormData): Promise<void> {
  await exigerAdmin();
  const id = String(formulaire.get("id") ?? "");
  if (id) {
    await clientAdmin()
      .from("factures")
      .update({ statut: "payee", payee_le: new Date().toISOString() })
      .eq("id", id);
  }
  retour("?ok=payee");
}

export async function supprimerBrouillon(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();
  // Les cours redeviennent facturables : on les détache avant d'effacer.
  await supabase.from("reservations").update({ facture_id: null }).eq("facture_id", id);
  await supabase.from("factures").delete().eq("id", id).eq("statut", "brouillon");

  retour("?ok=supprimee");
}
