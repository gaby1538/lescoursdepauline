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
  /** Vrai pour un raccourcissement, faux pour une annulation complète. */
  reduction?: boolean;
};

/**
 * L'élève demande, il n'annule pas.
 *
 * Le créneau reste occupé jusqu'à la réponse de Pauline : une simple
 * demande ne doit pas libérer l'agenda, sinon il suffirait de demander
 * en boucle pour le vider.
 *
 * Réduire un cours de trois heures à une, c'est annuler les deux
 * dernières. Le formulaire envoie donc les heures du bloc et le nombre
 * à garder ; tout le reste est le mécanisme d'annulation, inchangé.
 */
export async function demanderAnnulation(
  _etat: EtatAnnulation,
  formulaire: FormData
): Promise<EtatAnnulation> {
  const dossier = await dossierConnecte();
  if (!dossier) return { ok: false, erreur: "Connectez-vous pour faire cette demande." };

  const ids = String(formulaire.get("ids") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const garder = Math.max(0, Number(formulaire.get("garder") ?? 0) || 0);
  const motif = String(formulaire.get("motif") ?? "").trim().slice(0, 500) || null;

  if (ids.length === 0) return { ok: false, erreur: "Cours introuvable." };
  if (garder >= ids.length) {
    return { ok: false, erreur: "Choisissez un nombre d'heures inférieur." };
  }

  const supabase = clientAdmin();

  const { data: lignes } = await supabase
    .from("reservations")
    .select(
      "id, debut, fin, statut, validee_le, annulation_demandee_le, annulation_traitee_le"
    )
    .in("id", ids)
    .eq("dossier_id", dossier.id)
    .order("debut");

  const cours = lignes ?? [];
  if (cours.length !== ids.length) return { ok: false, erreur: "Cours introuvable." };
  if (cours.some((c) => c.statut !== "reservee")) {
    return { ok: false, erreur: "Ce cours n'est plus modifiable." };
  }
  if (cours[0].debut < new Date().toISOString()) {
    return { ok: false, erreur: "Ce cours est passé. Écrivez-moi directement." };
  }
  if (cours.some((c) => c.annulation_demandee_le && !c.annulation_traitee_le)) {
    return { ok: false, erreur: "Une demande est déjà en attente pour ce cours." };
  }

  // On garde les premières heures, on retire les dernières : c'est la
  // fin d'un cours qu'on raccourcit, pas son début.
  const retirees = cours.slice(garder);
  const reduction = garder > 0;
  const maintenant = new Date().toISOString();
  const idsRetires = retirees.map((r) => r.id);

  // Une demande que Pauline n'a pas encore acceptée se retire sans
  // rien demander à personne : il n'y a pas d'accord à défaire.
  if (!cours[0].validee_le) {
    const { error: erreurRetrait } = await supabase
      .from("reservations")
      .update({ statut: "annulee_dans_delai", annulation_motif: motif })
      .in("id", idsRetires)
      .eq("dossier_id", dossier.id);

    if (erreurRetrait) {
      console.error("retrait de demande", erreurRetrait);
      return { ok: false, erreur: "Le retrait n'a pas pu être enregistré. Réessayez." };
    }

    await supabase.from("journal").insert({
      acteur: "client",
      dossier_id: dossier.id,
      objet: "reservation",
      objet_id: idsRetires[0],
      action: "demande_retiree",
      details: { motif, heures: idsRetires.length, reduction },
    });

    revalidatePath("/mon-espace");
    revalidatePath("/admin");
    revalidatePath("/reserver");

    return { ok: true, erreur: null, retiree: true, reduction };
  }

  const { error } = await supabase
    .from("reservations")
    .update({
      annulation_demandee_le: maintenant,
      annulation_motif: motif,
      annulation_decision: null,
      annulation_reponse: null,
      annulation_traitee_le: null,
      demande_type: reduction ? "reduction" : "annulation",
    })
    .in("id", idsRetires)
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
    Date.parse(retirees[0].debut) - (p?.delai_annulation_h ?? 24) * 3600 * 1000
  ).toISOString();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  const resultat = await demandeAnnulation({
    prenomClient: `${dossier.prenom ?? ""} ${dossier.nom ?? ""}`.trim(),
    eleve: dossier.eleve_prenom ?? "",
    debut: retirees[0].debut,
    motif,
    horsDelai: maintenant > limite,
    lien: `${site}/admin`,
    reduction: reduction
      ? { avant: cours.length, apres: garder, debutCours: cours[0].debut }
      : null,
  });

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: dossier.id,
    objet: "reservation",
    objet_id: idsRetires[0],
    action: reduction ? "reduction_demandee" : "annulation_demandee",
    details: {
      motif,
      hors_delai: maintenant > limite,
      heures: idsRetires.length,
      ...(reduction ? { de: cours.length, a: garder } : {}),
      email: resultat.detail,
    },
  });

  revalidatePath("/mon-espace");
  revalidatePath("/admin");

  return { ok: true, erreur: null, reduction };
}
