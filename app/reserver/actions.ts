"use server";

import { redirect } from "next/navigation";
import { clientAdmin, messageErreurReservation } from "@/lib/supabase";
import { adresseBloquee, groupeDeLaClasse } from "@/lib/reservations";
import { confirmationReservation, alerteNouvelleReservation } from "@/lib/emails";

export type EtatReservation = { erreur: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Crée le dossier s'il n'existe pas, puis la réservation.
 *
 * Les règles — plafonds, délais, coupe-circuit, liste noire — sont
 * appliquées par la base, pas ici. Cette fonction se contente de
 * traduire le refus éventuel en français.
 */
export async function reserver(
  _etat: EtatReservation,
  formulaire: FormData
): Promise<EtatReservation> {
  const debut = String(formulaire.get("debut") ?? "");
  const fin = String(formulaire.get("fin") ?? "");
  const prenom = String(formulaire.get("prenom") ?? "").trim();
  const nom = String(formulaire.get("nom") ?? "").trim();
  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  const telephone = String(formulaire.get("telephone") ?? "").trim();
  const elevePrenom = String(formulaire.get("eleve_prenom") ?? "").trim();
  const classe = String(formulaire.get("classe") ?? "").trim();
  const sujet = String(formulaire.get("sujet") ?? "").trim() || null;

  if (!debut || !fin) return { erreur: "Choisissez d'abord un créneau." };
  if (!prenom || !nom) return { erreur: "Indiquez votre prénom et votre nom." };
  if (!EMAIL.test(email)) return { erreur: "Cette adresse email ne semble pas valide." };
  if (!elevePrenom) return { erreur: "Indiquez le prénom de l'élève." };
  if (!classe) return { erreur: "Choisissez la classe de l'élève." };

  const supabase = clientAdmin();

  // Une adresse bloquée ne doit pas même créer de dossier.
  if (await adresseBloquee(email)) {
    return {
      erreur:
        "La réservation n'a pas pu être enregistrée. Écrivez-moi directement pour en savoir plus.",
    };
  }

  // Dossier existant, ou nouveau.
  const { data: existant } = await supabase
    .from("dossiers")
    .select("id, prenom, token_confirmation, email_confirme_le")
    .eq("email", email)
    .eq("anonymise", false)
    .maybeSingle();

  let dossierId: string;
  let token: string;
  let dejaConfirme: boolean;

  if (existant) {
    dossierId = existant.id;
    token = existant.token_confirmation;
    dejaConfirme = Boolean(existant.email_confirme_le);
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
      .select("id, token_confirmation")
      .single();

    if (error || !cree) {
      console.error("création dossier", error);
      return { erreur: "Impossible de créer votre dossier. Réessayez dans un instant." };
    }
    dossierId = cree.id;
    token = cree.token_confirmation;
    dejaConfirme = false;
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
    details: { debut, classe },
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  // On journalise le sort de chaque email : un échec se diagnostique
  // ensuite depuis Supabase, sans fouiller les journaux de Vercel.
  const [emailEleve, emailPauline] = await Promise.all([
    confirmationReservation({
      destinataire: email,
      prenom,
      debut,
      lienVisio: null,
      lienConfirmation: dejaConfirme ? null : `${site}/confirmer?token=${token}`,
    }),
    alerteNouvelleReservation({
      prenomClient: prenom,
      nomClient: nom,
      emailClient: email,
      eleve: elevePrenom,
      classe,
      debut,
      sujet,
      premiere: !existant,
    }),
  ]);

  await supabase.from("journal").insert({
    acteur: "systeme",
    dossier_id: dossierId,
    objet: "email",
    action: emailEleve.ok ? "confirmation_envoyee" : "confirmation_echouee",
    details: {
      destinataire: email,
      confirmation: emailEleve.ok ? `ok ${emailEleve.detail}` : emailEleve.detail,
      alerte_pauline: emailPauline.ok ? `ok ${emailPauline.detail}` : emailPauline.detail,
    },
  });

  redirect(`/reserver/confirmation?debut=${encodeURIComponent(debut)}`);
}
