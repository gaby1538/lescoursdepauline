"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";

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
