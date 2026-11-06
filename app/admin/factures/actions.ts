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

    const { data: reglages } = await supabase
      .from("dossiers")
      .select("facturation_nom, facturation_adresse, facturation_note")
      .eq("id", dossierId)
      .maybeSingle();

    const { data: facture, error } = await supabase
      .from("factures")
      .insert({
        dossier_id: dossierId,
        periode_debut: debut,
        periode_fin: fin,
        total_cents: total,
        destinataire_nom: reglages?.facturation_nom ?? null,
        destinataire_adresse: reglages?.facturation_adresse ?? null,
        note: reglages?.facturation_note ?? null,
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

/* ---------------------------------------------------------------------
   Modifier un brouillon
   ------------------------------------------------------------------ */

function centimes(valeur: string): number | null {
  const propre = valeur.replace(/\s|€/g, "").replace(",", ".");
  const n = Number(propre);
  if (!Number.isFinite(n) || Math.abs(n) > 100000) return null;
  return Math.round(n * 100);
}

function nombre(valeur: string): number | null {
  const n = Number(valeur.replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > 9999) return null;
  return Math.round(n * 100) / 100;
}

async function estBrouillon(id: string): Promise<boolean> {
  const { data } = await clientAdmin()
    .from("factures")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  return data?.statut === "brouillon";
}

/**
 * Enregistre les lignes et l'en-tête d'un brouillon.
 *
 * Le total n'est pas écrit ici : un déclencheur le recalcule à partir
 * des lignes. Une facture dont le total ne serait pas la somme de ses
 * lignes n'aurait aucune valeur.
 */
export async function enregistrerFacture(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();
  if (!(await estBrouillon(id))) retour("?erreur=emise");

  const supabase = clientAdmin();

  const ids = formulaire.getAll("ligne_id").map(String);
  const descriptions = formulaire.getAll("description").map(String);
  const quantites = formulaire.getAll("quantite").map(String);
  const prix = formulaire.getAll("prix").map(String);

  for (let i = 0; i < ids.length; i += 1) {
    const description = descriptions[i]?.trim();
    const q = nombre(quantites[i] ?? "");
    const pu = centimes(prix[i] ?? "");
    if (!description || q === null || pu === null) continue;

    await supabase
      .from("lignes_facture")
      .update({
        description: description.slice(0, 300),
        quantite: q,
        prix_unitaire_cents: pu,
        total_cents: Math.round(q * pu),
      })
      .eq("id", ids[i])
      .eq("facture_id", id);
  }

  // Une ligne libre : une remise, un forfait de stage, un rattrapage.
  const nouvelle = String(formulaire.get("nouvelle_description") ?? "").trim();
  if (nouvelle) {
    const q = nombre(String(formulaire.get("nouvelle_quantite") ?? "1")) ?? 1;
    const pu = centimes(String(formulaire.get("nouveau_prix") ?? "0"));
    if (pu !== null) {
      const { count } = await supabase
        .from("lignes_facture")
        .select("id", { count: "exact", head: true })
        .eq("facture_id", id);

      await supabase.from("lignes_facture").insert({
        facture_id: id,
        description: nouvelle.slice(0, 300),
        quantite: q,
        prix_unitaire_cents: pu,
        total_cents: Math.round(q * pu),
        ordre: count ?? 0,
      });
    }
  }

  await supabase
    .from("factures")
    .update({
      destinataire_nom: String(formulaire.get("destinataire_nom") ?? "").trim() || null,
      destinataire_adresse:
        String(formulaire.get("destinataire_adresse") ?? "").trim() || null,
      note: String(formulaire.get("note") ?? "").trim() || null,
    })
    .eq("id", id);

  revalidatePath(`/admin/factures/${id}/modifier`);
  revalidatePath(`/factures/${id}`);
  redirect(`/admin/factures/${id}/modifier?ok=1`);
}

export async function supprimerLigne(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const facture = String(formulaire.get("facture") ?? "");
  if (!id || !facture) retour();
  if (!(await estBrouillon(facture))) retour("?erreur=emise");

  await clientAdmin().from("lignes_facture").delete().eq("id", id).eq("facture_id", facture);

  revalidatePath(`/admin/factures/${facture}/modifier`);
  redirect(`/admin/factures/${facture}/modifier?ok=1`);
}

export async function emettreEtEnvoyer(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  // En cas de refus, on revient là où le numéro a été saisi.
  const surErreur = (parametre: string): never => {
    const demandee = String(formulaire.get("retour") ?? "");
    if (/^\/admin\/factures\/[0-9a-f-]{36}\/modifier$/.test(demandee)) {
      revalidatePath(demandee);
      redirect(`${demandee}${parametre}`);
    }
    retour(parametre);
  };

  const supabase = clientAdmin();

  const { count: nbLignes } = await supabase
    .from("lignes_facture")
    .select("id", { count: "exact", head: true })
    .eq("facture_id", id);

  if ((nbLignes ?? 0) === 0) surErreur("?erreur=vide");

  const choisi = String(formulaire.get("numero") ?? "").trim().slice(0, 40);

  const { data: numero, error } = await supabase.rpc("emettre_facture", {
    facture: id,
    numero_choisi: choisi || null,
  });

  if (error) {
    console.error("numérotation", error);
    const doublon = /duplicate key|unique/i.test(error.message ?? "");
    surErreur(doublon ? "?erreur=doublon" : "?erreur=numero");
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
