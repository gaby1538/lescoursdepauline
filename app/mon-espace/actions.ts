"use server";

import { revalidatePath } from "next/cache";
import { clientAdmin } from "@/lib/supabase";
import { dossierConnecte } from "@/lib/session";
import { demandeAnnulation } from "@/lib/emails";

export type EtatAnnulation = {
  erreur: string | null;
  ok: boolean;
  /** Vrai quand la demande a été retirée d'elle-même, sans décision de Pauline. */
  retiree?: boolean;
};

/**
 * L'élève demande, il n'annule pas.
 *
 * Le créneau reste occupé jusqu'à la réponse de Pauline : une simple
 * demande ne doit pas libérer l'agenda, sinon il suffirait de demander
 * en boucle pour le vider.
 */
export async function demanderAnnulation(
  _etat: EtatAnnulation,
  formulaire: FormData
): Promise<EtatAnnulation> {
  const dossier = await dossierConnecte();
  if (!dossier) return { ok: false, erreur: "Connectez-vous pour faire cette demande." };

  const id = String(formulaire.get("id") ?? "");
  const motif = String(formulaire.get("motif") ?? "").trim().slice(0, 500) || null;
  if (!id) return { ok: false, erreur: "Cours introuvable." };

  const supabase = clientAdmin();

  const { data: cours } = await supabase
    .from("reservations")
    .select(
      "id, debut, statut, validee_le, annulation_demandee_le, annulation_traitee_le"
    )
    .eq("id", id)
    .eq("dossier_id", dossier.id)
    .maybeSingle();

  if (!cours) return { ok: false, erreur: "Cours introuvable." };
  if (cours.statut !== "reservee") {
    return { ok: false, erreur: "Ce cours n'est plus modifiable." };
  }
  if (cours.debut < new Date().toISOString()) {
    return { ok: false, erreur: "Ce cours est passé. Écrivez-moi directement." };
  }
  if (cours.annulation_demandee_le && !cours.annulation_traitee_le) {
    return { ok: false, erreur: "Une demande est déjà en attente pour ce cours." };
  }

  const maintenant = new Date().toISOString();

  // Une demande que Pauline n'a pas encore acceptée se retire sans
  // rien demander à personne : il n'y a pas d'accord à défaire.
  if (!cours.validee_le) {
    const { error: erreurRetrait } = await supabase
      .from("reservations")
      .update({ statut: "annulee_dans_delai", annulation_motif: motif })
      .eq("id", id)
      .eq("dossier_id", dossier.id);

    if (erreurRetrait) {
      console.error("retrait de demande", erreurRetrait);
      return { ok: false, erreur: "Le retrait n'a pas pu être enregistré. Réessayez." };
    }

    await supabase.from("journal").insert({
      acteur: "client",
      dossier_id: dossier.id,
      objet: "reservation",
      objet_id: id,
      action: "demande_retiree",
      details: { motif },
    });

    revalidatePath("/mon-espace");
    revalidatePath("/admin");
    revalidatePath("/reserver");

    return { ok: true, erreur: null, retiree: true };
  }

  const { error } = await supabase
    .from("reservations")
    .update({
      annulation_demandee_le: maintenant,
      annulation_motif: motif,
      annulation_decision: null,
      annulation_reponse: null,
      annulation_traitee_le: null,
    })
    .eq("id", id)
    .eq("dossier_id", dossier.id);

  if (error) {
    console.error("demande d'annulation", error);
    return { ok: false, erreur: "La demande n'a pas pu être enregistrée. Réessayez." };
  }

  const { data: p } = await supabase
    .from("parametres")
    .select("delai_annulation_h")
    .eq("id", true)
    .maybeSingle();

  const limite = new Date(
    Date.parse(cours.debut) - (p?.delai_annulation_h ?? 24) * 3600 * 1000
  ).toISOString();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  const resultat = await demandeAnnulation({
    prenomClient: `${dossier.prenom ?? ""} ${dossier.nom ?? ""}`.trim(),
    eleve: dossier.eleve_prenom ?? "",
    debut: cours.debut,
    motif,
    horsDelai: maintenant > limite,
    lien: `${site}/admin`,
  });

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: dossier.id,
    objet: "reservation",
    objet_id: id,
    action: "annulation_demandee",
    details: { motif, hors_delai: maintenant > limite, email: resultat.detail },
  });

  revalidatePath("/mon-espace");
  revalidatePath("/admin");

  return { ok: true, erreur: null };
}
