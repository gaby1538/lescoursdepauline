"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";
import { reponseAnnulation, reponseDemande } from "@/lib/emails";

function retour(chemin: string, parametre?: string): never {
  revalidatePath(chemin);
  redirect(`${chemin}${parametre ?? ""}`);
}

/**
 * Ces deux actions servent depuis la fiche d'un élève comme depuis le
 * tableau de bord. On revient d'où l'on vient, mais seulement vers une
 * page d'administration : le champ vient du navigateur.
 */
function destination(formulaire: FormData, defaut: string): string {
  const demandee = String(formulaire.get("retour") ?? "");
  return /^\/admin(\/[\w-]*)*$/.test(demandee) ? demandee : defaut;
}

export async function basculerSuspension(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const suspendu = String(formulaire.get("suspendu") ?? "") === "1";
  const motif = String(formulaire.get("motif") ?? "").trim() || null;

  if (id) {
    await clientAdmin()
      .from("dossiers")
      .update({
        suspendu: !suspendu,
        motif_suspension: suspendu ? null : motif,
      })
      .eq("id", id);

    await clientAdmin().from("journal").insert({
      acteur: "pauline",
      dossier_id: id,
      objet: "dossier",
      action: suspendu ? "reactive" : "suspendu",
      details: { motif },
    });
  }

  retour(`/admin/eleves/${id}`, "?ok=1");
}

export async function annulerCours(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const dossier = String(formulaire.get("dossier") ?? "");

  if (id) {
    await clientAdmin()
      .from("reservations")
      .update({ statut: "annulee_par_pauline" })
      .eq("id", id);

    await clientAdmin().from("journal").insert({
      acteur: "pauline",
      dossier_id: dossier || null,
      objet: "reservation",
      objet_id: id,
      action: "annulee_par_pauline",
    });
  }

  retour(destination(formulaire, `/admin/eleves/${dossier}`), "?ok=1");
}

export async function marquerEffectue(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const dossier = String(formulaire.get("dossier") ?? "");

  if (id) {
    await clientAdmin().from("reservations").update({ statut: "effectuee" }).eq("id", id);
    await clientAdmin().from("journal").insert({
      acteur: "pauline",
      dossier_id: dossier || null,
      objet: "reservation",
      objet_id: id,
      action: "effectuee",
    });
  }

  retour(destination(formulaire, `/admin/eleves/${dossier}`), "?ok=1");
}

/**
 * Supprimer un dossier, ou l'anonymiser s'il porte des factures.
 *
 * Le Code de commerce impose de conserver les pièces comptables dix ans,
 * et la clé étrangère des factures est en « restrict » pour que cette
 * obligation ne puisse pas être contournée par erreur. Dans ce cas on
 * efface l'identité et on garde la coquille comptable.
 */
export async function supprimerDossier(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const bloquer = String(formulaire.get("bloquer") ?? "") === "1";
  const motif = String(formulaire.get("motif") ?? "").trim() || null;
  if (!id) retour("/admin/eleves");

  const supabase = clientAdmin();

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("id, email, email_normalise, telephone")
    .eq("id", id)
    .maybeSingle();

  if (!dossier) retour("/admin/eleves");

  if (bloquer) {
    await supabase.from("liste_noire").insert({
      email_normalise: dossier.email_normalise,
      telephone: dossier.telephone,
      motif,
    });
  }

  const { count } = await supabase
    .from("factures")
    .select("id", { count: "exact", head: true })
    .eq("dossier_id", id);

  if ((count ?? 0) > 0) {
    await supabase
      .from("dossiers")
      .update({
        anonymise: true,
        prenom: null,
        nom: null,
        telephone: null,
        eleve_prenom: null,
        email: `anonyme.${id}@supprime.invalid`,
        user_id: null,
        notes_internes: null,
      })
      .eq("id", id);

    await supabase.from("journal").insert({
      acteur: "pauline",
      dossier_id: id,
      objet: "dossier",
      action: "anonymise",
      details: { factures: count, liste_noire: bloquer },
    });

    retour("/admin/eleves", "?ok=anonymise");
  }

  await supabase.from("dossiers").delete().eq("id", id);

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "dossier",
    action: "supprime",
    details: { liste_noire: bloquer },
  });

  retour("/admin/eleves", "?ok=supprime");
}

export async function retirerDeLaListeNoire(formulaire: FormData): Promise<void> {
  await exigerAdmin();
  const id = String(formulaire.get("id") ?? "");
  if (id) await clientAdmin().from("liste_noire").delete().eq("id", id);
  retour("/admin/eleves", "?ok=1");
}

/**
 * Ce que le parent demande pour ses factures : un autre nom, une
 * adresse, une mention. Enregistré sur le dossier, repris
 * automatiquement sur chaque nouvelle facture — et modifiable ensuite
 * sur le brouillon, au cas par cas.
 */
export async function enregistrerFacturation(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour("/admin/eleves");

  await clientAdmin()
    .from("dossiers")
    .update({
      facturation_nom: String(formulaire.get("facturation_nom") ?? "").trim() || null,
      facturation_adresse:
        String(formulaire.get("facturation_adresse") ?? "").trim() || null,
      facturation_note: String(formulaire.get("facturation_note") ?? "").trim() || null,
    })
    .eq("id", id);

  retour(`/admin/eleves/${id}`, "?ok=1");
}

/**
 * Pauline tranche une demande d'annulation.
 *
 * Le classement dans ou hors délai se fait sur l'instant de la demande,
 * jamais sur celui de la réponse : un élève qui prévient une semaine
 * avant ne doit pas être facturé parce que la réponse a tardé. C'est le
 * déclencheur en base qui s'en charge.
 */
export async function repondreAnnulation(
  decision: string,
  formulaire: FormData
): Promise<void> {
  await exigerAdmin();

  const ou = destination(formulaire, "/admin");
  const ids = String(formulaire.get("ids") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[0-9a-f-]{36}$/.test(v));
  const reponse = String(formulaire.get("reponse") ?? "").trim().slice(0, 500) || null;

  if (ids.length === 0 || !["acceptee", "refusee"].includes(decision)) {
    retour(ou, "?erreur=decision");
  }

  const supabase = clientAdmin();

  const { data: lignes } = await supabase
    .from("reservations")
    .select("id, debut, fin, statut, dossier_id, demande_type")
    .in("id", ids)
    .order("debut");

  const cours = (lignes ?? []).filter((c) => c.statut === "reservee");
  if (cours.length === 0) retour(ou, "?erreur=introuvable");

  const dossierId = cours[0].dossier_id;
  if (cours.some((c) => c.dossier_id !== dossierId)) retour(ou, "?erreur=decision");

  const reduction = cours[0].demande_type === "reduction";
  const maintenant = new Date().toISOString();

  const { error } = await supabase
    .from("reservations")
    .update({
      ...(decision === "acceptee" ? { statut: "annulee_dans_delai" } : {}),
      annulation_decision: decision,
      annulation_reponse: reponse,
      annulation_traitee_le: maintenant,
    })
    .in("id", cours.map((c) => c.id));

  if (error) {
    console.error("réponse à l'annulation", error);
    retour(ou, "?erreur=enregistrement");
  }

  // On relit : le déclencheur a peut-être requalifié en hors délai.
  const { data: apres } = await supabase
    .from("reservations")
    .select("statut")
    .eq("id", cours[0].id)
    .maybeSingle();

  // Pour une réduction, ce qui intéresse l'élève est ce qui reste.
  let restantes = 0;
  if (reduction && decision === "acceptee") {
    const { count } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("dossier_id", dossierId)
      .eq("statut", "reservee")
      .gte("debut", new Date(Date.parse(cours[0].debut) - 12 * 3600 * 1000).toISOString())
      .lt("debut", cours[0].debut);
    restantes = count ?? 0;
  }

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("email, prenom")
    .eq("id", dossierId)
    .maybeSingle();

  if (dossier) {
    const resultat = await reponseAnnulation({
      destinataire: dossier.email,
      prenom: dossier.prenom ?? "",
      debut: cours[0].debut,
      acceptee: decision === "acceptee",
      facturable: apres?.statut === "annulee_hors_delai",
      reponse,
      reduction: reduction ? { heures: cours.length, restantes } : null,
    });

    await supabase.from("journal").insert({
      acteur: "pauline",
      dossier_id: dossierId,
      objet: "reservation",
      objet_id: cours[0].id,
      action: `${reduction ? "reduction" : "annulation"}_${decision}`,
      details: {
        statut: apres?.statut,
        heures: cours.length,
        email: resultat.detail,
      },
    });
  }

  revalidatePath("/reserver");
  revalidatePath("/mon-espace");
  retour(ou, "?ok=1");
}

/**
 * Pauline accepte ou refuse une demande de cours.
 *
 * Une demande de plusieurs heures qui se suivent arrive ici en un seul
 * bloc : il serait absurde de cliquer trois fois et d'envoyer trois
 * emails pour un cours de trois heures. La décision porte donc sur une
 * liste d'identifiants, et l'élève reçoit un seul message.
 *
 * La bascule elle-même est faite par la base (decider_demande), sous
 * verrou : deux onglets ouverts ne peuvent pas décider deux fois.
 */
export async function deciderDemande(
  decision: string,
  formulaire: FormData
): Promise<void> {
  await exigerAdmin();

  const ou = destination(formulaire, "/admin");
  const accepter = decision === "acceptee";
  const motif = String(formulaire.get("motif") ?? "").trim().slice(0, 500) || null;

  if (!["acceptee", "refusee"].includes(decision)) retour(ou, "?erreur=decision");

  const ids = String(formulaire.get("ids") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[0-9a-f-]{36}$/.test(v));

  if (ids.length === 0) retour(ou, "?erreur=decision");

  const supabase = clientAdmin();

  const { data: lignes } = await supabase
    .from("reservations")
    .select("id, debut, fin, dossier_id, validee_le, statut")
    .in("id", ids)
    .order("debut");

  const demandes = (lignes ?? []).filter(
    (r) => r.statut === "reservee" && !r.validee_le
  );

  if (demandes.length === 0) retour(ou, "?erreur=introuvable");

  // Un bloc appartient à un seul dossier. Si ce n'est pas le cas, le
  // formulaire a été bricolé : on s'arrête plutôt que de deviner.
  const dossierId = demandes[0].dossier_id;
  if (demandes.some((r) => r.dossier_id !== dossierId)) {
    retour(ou, "?erreur=decision");
  }

  const echecs: string[] = [];
  for (const demande of demandes) {
    const { error } = await supabase.rpc("decider_demande", {
      demande: demande.id,
      accepter,
      motif,
    });
    if (error) echecs.push(error.message);
  }

  if (echecs.length === demandes.length) {
    console.error("décision sur demande", echecs[0]);
    retour(ou, "?erreur=enregistrement");
  }

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("email, prenom")
    .eq("id", dossierId)
    .maybeSingle();

  if (dossier) {
    const resultat = await reponseDemande({
      destinataire: dossier.email,
      prenom: dossier.prenom ?? "",
      creneaux: demandes.map((r) => ({ debut: r.debut, fin: r.fin })),
      acceptee: accepter,
      motif,
    });

    await supabase.from("journal").insert({
      acteur: "pauline",
      dossier_id: dossierId,
      objet: "reservation",
      objet_id: demandes[0].id,
      action: accepter ? "demande_acceptee" : "demande_refusee",
      details: {
        heures: demandes.length,
        motif,
        email: resultat.detail,
        echecs: echecs.length ? echecs : undefined,
      },
    });
  }

  revalidatePath("/reserver");
  revalidatePath("/mon-espace");
  retour(ou, echecs.length ? "?erreur=partiel" : "?ok=1");
}
