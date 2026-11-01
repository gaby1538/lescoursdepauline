"use server";

import { redirect } from "next/navigation";
import { clientAdmin, messageErreurReservation } from "@/lib/supabase";
import { dossierConnecte } from "@/lib/session";
import { adresseBloquee, groupeDeLaClasse } from "@/lib/reservations";
import { trouverDossierParEmail } from "@/lib/comptes";
import { confirmationReservation, alerteNouvelleReservation } from "@/lib/emails";
import { lienActivation } from "@/lib/comptes";

export type EtatReservation = { erreur: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Crée au besoin le dossier, puis la réservation.
 *
 * Les règles — plafonds, délais, coupe-circuit, liste noire — sont
 * appliquées par la base, pas ici. Cette fonction se contente de
 * traduire le refus éventuel en français.
 *
 * Si la personne est connectée, son dossier fait foi : les champs
 * d'identité du formulaire sont ignorés, car on ne laisse pas le
 * navigateur désigner pour qui il réserve.
 */
export async function reserver(
  _etat: EtatReservation,
  formulaire: FormData
): Promise<EtatReservation> {
  const debut = String(formulaire.get("debut") ?? "");
  const fin = String(formulaire.get("fin") ?? "");
  const sujet = String(formulaire.get("sujet") ?? "").trim() || null;

  if (!debut || !fin) return { erreur: "Choisissez d'abord un créneau." };

  const supabase = clientAdmin();
  const connecte = await dossierConnecte();

  let dossierId: string;
  let destinataire: string;
  let prenom: string;
  let nom: string;
  let elevePrenom: string;
  let classe: string;
  let lienConfirmation: string | null = null;
  let premiere = false;

  if (connecte) {
    dossierId = connecte.id;
    destinataire = connecte.email;
    prenom = connecte.prenom ?? "";
    nom = connecte.nom ?? "";
    elevePrenom = connecte.eleve_prenom ?? "";
    classe = connecte.eleve_classe ?? "";
  } else {
    prenom = String(formulaire.get("prenom") ?? "").trim();
    nom = String(formulaire.get("nom") ?? "").trim();
    destinataire = String(formulaire.get("email") ?? "").trim().toLowerCase();
    const telephone = String(formulaire.get("telephone") ?? "").trim();
    elevePrenom = String(formulaire.get("eleve_prenom") ?? "").trim();
    classe = String(formulaire.get("classe") ?? "").trim();

    if (!prenom || !nom) return { erreur: "Indiquez votre prénom et votre nom." };
    if (!EMAIL.test(destinataire)) {
      return { erreur: "Cette adresse email ne semble pas valide." };
    }
    if (!elevePrenom) return { erreur: "Indiquez le prénom de l'élève." };
    if (!classe) return { erreur: "Choisissez la classe de l'élève." };

    // Une adresse bloquée ne doit pas même créer de dossier.
    if (await adresseBloquee(destinataire)) {
      return {
        erreur:
          "La réservation n'a pas pu être enregistrée. Écrivez-moi directement pour en savoir plus.",
      };
    }

    // Recherche sur la forme normalisée : sans cela, une variante avec
    // des points créerait un doublon que l'index unique refuserait.
    const existant = await trouverDossierParEmail(destinataire);

    if (existant) {
      dossierId = existant.id;
      lienConfirmation = existant.email_confirme_le
        ? null
        : lienActivation(existant.token_confirmation);
    } else {
      const { data: cree, error } = await supabase
        .from("dossiers")
        .insert({
          email: destinataire,
          prenom,
          nom,
          telephone: telephone || null,
          eleve_prenom: elevePrenom,
          eleve_classe: classe,
          groupe: groupeDeLaClasse(classe),
          type_suivi: "seance",
        })
        .select("id, token_confirmation")
        .single();

      if (error || !cree) {
        console.error("création dossier", error);
        return { erreur: "Impossible de créer votre dossier. Réessayez dans un instant." };
      }
      dossierId = cree.id;
      lienConfirmation = lienActivation(cree.token_confirmation);
      premiere = true;
    }
  }

  // La réservation. C'est ici que la base peut refuser.
  const { error: erreurResa } = await supabase
    .from("reservations")
    .insert({ dossier_id: dossierId, debut, fin, sujet });

  if (erreurResa) {
    return { erreur: messageErreurReservation(erreurResa.message) };
  }

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: dossierId,
    objet: "reservation",
    action: "creee",
    details: { debut, classe, connecte: Boolean(connecte) },
  });

  // On journalise le sort de chaque email : un échec se diagnostique
  // ensuite depuis Supabase, sans fouiller les journaux de Vercel.
  const [emailEleve, emailPauline] = await Promise.all([
    confirmationReservation({
      destinataire,
      prenom,
      debut,
      lienVisio: null,
      lienConfirmation,
    }),
    alerteNouvelleReservation({
      prenomClient: prenom,
      nomClient: nom,
      emailClient: destinataire,
      eleve: elevePrenom,
      classe,
      debut,
      sujet,
      premiere,
    }),
  ]);

  await supabase.from("journal").insert({
    acteur: "systeme",
    dossier_id: dossierId,
    objet: "email",
    action: emailEleve.ok ? "confirmation_envoyee" : "confirmation_echouee",
    details: {
      destinataire,
      confirmation: emailEleve.ok ? `ok ${emailEleve.detail}` : emailEleve.detail,
      alerte_pauline: emailPauline.ok ? `ok ${emailPauline.detail}` : emailPauline.detail,
    },
  });

  redirect(`/reserver/confirmation?debut=${encodeURIComponent(debut)}`);
}
