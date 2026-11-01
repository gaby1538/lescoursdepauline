"use server";

import { redirect } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { clientSession } from "@/lib/session";
import { groupeDeLaClasse, adresseBloquee } from "@/lib/reservations";
import {
  trouverDossierParEmail,
  trouverDossierParJeton,
  trouverCompteParEmail,
  renouvelerJeton,
  lienActivation,
} from "@/lib/comptes";
import {
  bienvenueCompte,
  reinitialisationMotDePasse,
} from "@/lib/emails";

export type EtatFormulaire = { erreur: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LONGUEUR_MINIMALE = 8;

/**
 * Message volontairement identique que l'adresse soit connue ou non :
 * sinon ce formulaire devient un moyen de savoir qui est élève ici.
 */
const NEUTRE = "/compte/verifiez-vos-emails";

// ---------------------------------------------------------------------
//  Créer un compte, sans avoir réservé
// ---------------------------------------------------------------------

export async function creerCompte(
  _etat: EtatFormulaire,
  formulaire: FormData
): Promise<EtatFormulaire> {
  const prenom = String(formulaire.get("prenom") ?? "").trim();
  const nom = String(formulaire.get("nom") ?? "").trim();
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const telephone = String(formulaire.get("telephone") ?? "").trim();
  const elevePrenom = String(formulaire.get("eleve_prenom") ?? "").trim();
  const classe = String(formulaire.get("classe") ?? "").trim();

  if (!prenom || !nom) return { erreur: "Indiquez votre prénom et votre nom." };
  if (!EMAIL.test(email)) return { erreur: "Cette adresse email ne semble pas valide." };
  if (!elevePrenom) return { erreur: "Indiquez le prénom de l'élève." };
  if (!classe) return { erreur: "Choisissez la classe de l'élève." };

  if (await adresseBloquee(email)) redirect(NEUTRE);

  const supabase = clientAdmin();
  const existant = await trouverDossierParEmail(email);

  // Un compte est déjà actif : on envoie de quoi reprendre la main
  // plutôt que de révéler que l'adresse est connue.
  if (existant?.user_id) {
    const jeton = await renouvelerJeton(existant.id);
    await reinitialisationMotDePasse({
      destinataire: existant.email,
      prenom: existant.prenom ?? prenom,
      lien: lienActivation(jeton, true),
    });
    redirect(NEUTRE);
  }

  let dossierId: string;

  if (existant) {
    // On complète les cases vides sans écraser ce que Pauline a pu saisir.
    const complements: Record<string, string> = {};
    if (!existant.prenom) complements.prenom = prenom;
    if (!existant.nom) complements.nom = nom;
    if (Object.keys(complements).length > 0) {
      await supabase.from("dossiers").update(complements).eq("id", existant.id);
    }
    dossierId = existant.id;
  } else {
    const { data: cree, error } = await supabase
      .from("dossiers")
      .insert({
        email,
        prenom,
        nom,
        telephone: telephone || null,
        eleve_prenom: elevePrenom,
        eleve_classe: classe,
        groupe: groupeDeLaClasse(classe),
        type_suivi: "seance",
      })
      .select("id")
      .single();

    if (error || !cree) {
      console.error("création dossier (compte)", error);
      return { erreur: "Impossible de créer votre espace. Réessayez dans un instant." };
    }
    dossierId = cree.id;
  }

  const jeton = await renouvelerJeton(dossierId);

  await bienvenueCompte({
    destinataire: email,
    prenom,
    lien: lienActivation(jeton),
    dossierExistant: Boolean(existant),
  });

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: dossierId,
    objet: "compte",
    action: "activation_demandee",
    details: { dossier_preexistant: Boolean(existant) },
  });

  redirect(NEUTRE);
}

// ---------------------------------------------------------------------
//  Activer : choisir son mot de passe
// ---------------------------------------------------------------------

export async function activerCompte(
  _etat: EtatFormulaire,
  formulaire: FormData
): Promise<EtatFormulaire> {
  const jeton = String(formulaire.get("token") ?? "");
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");
  const repetition = String(formulaire.get("mot_de_passe_2") ?? "");

  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return { erreur: `Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE} caractères.` };
  }
  if (motDePasse !== repetition) {
    return { erreur: "Les deux mots de passe ne sont pas identiques." };
  }

  const dossier = await trouverDossierParJeton(jeton);
  if (!dossier) {
    return {
      erreur:
        "Ce lien n'est plus valable. Demandez-en un nouveau depuis la page de connexion.",
    };
  }

  const supabase = clientAdmin();
  let compteId = dossier.user_id;

  if (compteId) {
    const { error } = await supabase.auth.admin.updateUserById(compteId, {
      password: motDePasse,
    });
    if (error) {
      console.error("mise à jour mot de passe", error);
      return { erreur: "Le mot de passe n'a pas pu être enregistré. Réessayez." };
    }
  } else {
    const { data: cree, error } = await supabase.auth.admin.createUser({
      email: dossier.email,
      password: motDePasse,
      email_confirm: true,
    });

    if (error || !cree?.user) {
      // Un compte existe déjà pour cette adresse sans être rattaché au
      // dossier : on le retrouve et on lui applique le mot de passe.
      const secours = await trouverCompteParEmail(dossier.email);
      if (!secours) {
        console.error("création compte", error);
        return { erreur: "Le compte n'a pas pu être créé. Réessayez dans un instant." };
      }
      await supabase.auth.admin.updateUserById(secours, { password: motDePasse });
      compteId = secours;
    } else {
      compteId = cree.user.id;
    }
  }

  // Le rattachement au dossier : c'est lui qui ramène tout l'historique,
  // puisque les réservations pendent du dossier, pas du compte.
  await supabase
    .from("dossiers")
    .update({
      user_id: compteId,
      email_confirme_le: dossier.email_confirme_le ?? new Date().toISOString(),
      token_confirmation: crypto.randomUUID(),
    })
    .eq("id", dossier.id);

  const { count } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("dossier_id", dossier.id);

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: dossier.id,
    objet: "compte",
    action: "active",
    details: { reservations_rattachees: count ?? 0 },
  });

  const session = await clientSession();
  await session.auth.signInWithPassword({
    email: dossier.email,
    password: motDePasse,
  });

  redirect("/mon-espace");
}

// ---------------------------------------------------------------------
//  Connexion, déconnexion, oubli
// ---------------------------------------------------------------------

export async function seConnecter(
  _etat: EtatFormulaire,
  formulaire: FormData
): Promise<EtatFormulaire> {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(formulaire.get("mot_de_passe") ?? "");

  if (!EMAIL.test(email) || !motDePasse) {
    return { erreur: "Indiquez votre adresse et votre mot de passe." };
  }

  const session = await clientSession();
  const { error } = await session.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    return { erreur: "Adresse ou mot de passe incorrect." };
  }

  redirect("/mon-espace");
}

export async function seDeconnecter(): Promise<void> {
  const session = await clientSession();
  await session.auth.signOut();
  redirect("/");
}

export async function demanderReinitialisation(
  _etat: EtatFormulaire,
  formulaire: FormData
): Promise<EtatFormulaire> {
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { erreur: "Cette adresse email ne semble pas valide." };

  const dossier = await trouverDossierParEmail(email);

  if (dossier) {
    const jeton = await renouvelerJeton(dossier.id);
    if (dossier.user_id) {
      await reinitialisationMotDePasse({
        destinataire: dossier.email,
        prenom: dossier.prenom ?? "",
        lien: lienActivation(jeton, true),
      });
    } else {
      await bienvenueCompte({
        destinataire: dossier.email,
        prenom: dossier.prenom ?? "",
        lien: lienActivation(jeton),
        dossierExistant: true,
      });
    }
  }

  redirect(NEUTRE);
}
