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
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/;

/** Au-delà, ce n'est plus une séance longue mais un stage, qui se cale
 *  de vive voix avec Pauline. */
const MAX_HEURES = 8;

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
  const sujet = String(formulaire.get("sujet") ?? "").trim() || null;

  // Une séance longue arrive ici comme plusieurs heures qui se suivent.
  const vus = new Set<string>();
  const creneaux = formulaire
    .getAll("creneaux")
    .map((valeur) => String(valeur).split("|"))
    .filter(
      (paire) =>
        paire.length === 2 && ISO.test(paire[0]) && ISO.test(paire[1]) && paire[0] < paire[1]
    )
    .map(([debut, fin]) => ({ debut, fin }))
    .filter((c) => (vus.has(c.debut) ? false : vus.add(c.debut)))
    .sort((a, b) => a.debut.localeCompare(b.debut));

  if (creneaux.length === 0) return { erreur: "Choisissez d'abord au moins un créneau." };
  if (creneaux.length > MAX_HEURES) {
    return {
      erreur: `Pas plus de ${MAX_HEURES} heures en une fois. Pour un stage plus long, écrivez-moi directement.`,
    };
  }

  const debut = creneaux[0].debut;

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

  // Les heures partent en une seule instruction : la base les accepte
  // toutes ou n'en garde aucune. Pas de demi-réservation à rattraper.
  const { error: erreurResa } = await supabase
    .from("reservations")
    .insert(
      creneaux.map((c) => ({ dossier_id: dossierId, debut: c.debut, fin: c.fin, sujet }))
    );

  if (erreurResa) {
    const message = messageErreurReservation(erreurResa.message);
    return {
      erreur:
        creneaux.length > 1 ? `Aucune heure n'a été réservée. ${message}` : message,
    };
  }

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: dossierId,
    objet: "reservation",
    action: "creee",
    details: {
      creneaux: creneaux.map((c) => c.debut),
      heures: creneaux.length,
      classe,
      connecte: Boolean(connecte),
    },
  });

  // On journalise le sort de chaque email : un échec se diagnostique
  // ensuite depuis Supabase, sans fouiller les journaux de Vercel.
  const [emailEleve, emailPauline] = await Promise.all([
    confirmationReservation({
      destinataire,
      prenom,
      creneaux,
      lienVisio: null,
      lienConfirmation,
    }),
    alerteNouvelleReservation({
      prenomClient: prenom,
      nomClient: nom,
      emailClient: destinataire,
      eleve: elevePrenom,
      classe,
      creneaux,
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

  redirect(
    `/reserver/confirmation?debut=${encodeURIComponent(debut)}&h=${creneaux.length}`
  );
}
