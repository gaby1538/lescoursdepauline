"use server";

import { redirect } from "next/navigation";
import { clientAdmin, messageErreurReservation } from "@/lib/supabase";
import { dossierConnecte } from "@/lib/session";
import { adresseBloquee, groupeDeLaClasse } from "@/lib/reservations";
import { trouverDossierParEmail } from "@/lib/comptes";
import {
  confirmationReservation,
  alerteNouvelleReservation,
  demandeDeplacement,
} from "@/lib/emails";
import { lienActivation, VALIDITE_JETON_JOURS } from "@/lib/comptes";
import { autoriserEnvoi, PLAFONDS } from "@/lib/limites";

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
      const expiration = new Date(
        Date.now() + VALIDITE_JETON_JOURS * 24 * 3600 * 1000
      ).toISOString();

      const { data: cree, error } = await supabase
        .from("dossiers")
        .insert({
          token_expire_le: expiration,
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
  const { data: reglages } = await supabase
    .from("parametres")
    .select("validation_requise")
    .eq("id", true)
    .maybeSingle();

  // Par défaut la demande attend l'accord de Pauline. Le créneau est pris
  // dès maintenant : personne ne double la file pendant qu'elle réfléchit.
  const enAttente = reglages?.validation_requise ?? true;

  const { error: erreurResa } = await supabase
    .from("reservations")
    .insert(
      creneaux.map((c) => ({
        dossier_id: dossierId,
        debut: c.debut,
        fin: c.fin,
        sujet,
        validee_le: enAttente ? null : new Date().toISOString(),
      }))
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
    action: enAttente ? "demandee" : "creee",
    details: {
      creneaux: creneaux.map((c) => c.debut),
      heures: creneaux.length,
      classe,
      connecte: Boolean(connecte),
    },
  });

  const quota = PLAFONDS.reservationParAdresse;
  const peutEcrire = await autoriserEnvoi(
    `resa:${destinataire}`,
    quota.plafond,
    quota.fenetre
  );

  // On journalise le sort de chaque email : un échec se diagnostique
  // ensuite depuis Supabase, sans fouiller les journaux de Vercel.
  const [emailEleve, emailPauline] = peutEcrire
    ? await Promise.all([
    confirmationReservation({
      destinataire,
      prenom,
      creneaux,
      lienVisio: null,
      lienConfirmation,
      enAttente,
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
      enAttente,
    }),
      ])
    : [
        { ok: false, detail: "plafond_atteint" },
        { ok: false, detail: "plafond_atteint" },
      ];

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
    `/reserver/confirmation?debut=${encodeURIComponent(debut)}&h=${creneaux.length}${
      enAttente ? "&attente=1" : ""
    }`
  );
}

/**
 * L'élève propose une autre date, une autre heure, une autre durée.
 *
 * Le créneau proposé est réservé tout de suite, en attente de
 * validation, et pointe vers le cours qu'il remplace. C'est la seule
 * façon de savoir qu'il est réellement libre — ce sont les
 * déclencheurs de la base qui le disent — et d'éviter qu'un autre
 * élève le prenne pendant que Pauline réfléchit.
 *
 * Si la base refuse le nouveau créneau, rien n'est touché : l'ancien
 * cours reste tel quel et l'élève voit pourquoi.
 */
export async function demanderDeplacement(
  _etat: EtatReservation,
  formulaire: FormData
): Promise<EtatReservation> {
  const dossier = await dossierConnecte();
  if (!dossier) return { erreur: "Connectez-vous pour modifier un cours." };

  const anciens = String(formulaire.get("deplacer") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[0-9a-f-]{36}$/.test(v));

  if (anciens.length === 0) return { erreur: "Cours introuvable." };

  const vus = new Set<string>();
  const creneaux = formulaire
    .getAll("creneaux")
    .map((valeur) => String(valeur).split("|"))
    .filter(
      (paire) =>
        paire.length === 2 &&
        ISO.test(paire[0]) &&
        ISO.test(paire[1]) &&
        paire[0] < paire[1]
    )
    .map(([debut, fin]) => ({ debut, fin }))
    .filter((c) => (vus.has(c.debut) ? false : vus.add(c.debut)))
    .sort((a, b) => a.debut.localeCompare(b.debut));

  if (creneaux.length === 0) return { erreur: "Choisissez d'abord un créneau." };
  if (creneaux.length > MAX_HEURES) {
    return { erreur: `Pas plus de ${MAX_HEURES} heures en une fois.` };
  }

  const supabase = clientAdmin();

  const { data: lignes } = await supabase
    .from("reservations")
    .select("id, debut, fin, statut, validee_le, annulation_demandee_le, annulation_traitee_le")
    .in("id", anciens)
    .eq("dossier_id", dossier.id)
    .order("debut");

  const cours = lignes ?? [];
  if (cours.length !== anciens.length) return { erreur: "Cours introuvable." };
  if (cours.some((c) => c.statut !== "reservee")) {
    return { erreur: "Ce cours n'est plus modifiable." };
  }
  if (cours[0].debut < new Date().toISOString()) {
    return { erreur: "Ce cours est passé. Écrivez-moi directement." };
  }
  if (cours.some((c) => c.annulation_demandee_le && !c.annulation_traitee_le)) {
    return { erreur: "Une demande est déjà en attente pour ce cours." };
  }
  if (creneaux.some((n) => cours.some((a) => a.debut === n.debut))) {
    return { erreur: "Le nouveau créneau est identique à l'ancien." };
  }

  const sujet = String(formulaire.get("sujet") ?? "").trim() || null;
  const motif = String(formulaire.get("motif") ?? "").trim().slice(0, 500) || null;

  const { error: erreurNouveaux } = await supabase.from("reservations").insert(
    creneaux.map((c) => ({
      dossier_id: dossier.id,
      debut: c.debut,
      fin: c.fin,
      sujet,
      validee_le: null,
      remplace: cours[0].id,
    }))
  );

  if (erreurNouveaux) {
    return { erreur: messageErreurReservation(erreurNouveaux) };
  }

  const maintenant = new Date().toISOString();

  const { error } = await supabase
    .from("reservations")
    .update({
      demande_type: "modification",
      annulation_demandee_le: maintenant,
      annulation_motif: motif,
      annulation_decision: null,
      annulation_reponse: null,
      annulation_traitee_le: null,
    })
    .in("id", anciens)
    .eq("dossier_id", dossier.id);

  if (error) {
    // Le nouveau créneau existe déjà : on le retire plutôt que de
    // laisser l'élève avec deux cours et aucune demande.
    await supabase.from("reservations").delete().eq("remplace", cours[0].id);
    console.error("demande de déplacement", error);
    return { erreur: "La demande n'a pas pu être enregistrée. Réessayez." };
  }

  const { data: p } = await supabase
    .from("parametres")
    .select("delai_annulation_h")
    .eq("id", true)
    .maybeSingle();

  const limite = new Date(
    Date.parse(cours[0].debut) - (p?.delai_annulation_h ?? 24) * 3600 * 1000
  ).toISOString();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  const resultat = await demandeDeplacement({
    prenomClient: `${dossier.prenom ?? ""} ${dossier.nom ?? ""}`.trim(),
    eleve: dossier.eleve_prenom ?? "",
    ancien: { debut: cours[0].debut, fin: cours[cours.length - 1].fin, heures: cours.length },
    nouveau: {
      debut: creneaux[0].debut,
      fin: creneaux[creneaux.length - 1].fin,
      heures: creneaux.length,
    },
    motif,
    horsDelai: maintenant > limite,
    lien: `${site}/admin`,
  });

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: dossier.id,
    objet: "reservation",
    objet_id: cours[0].id,
    action: "modification_demandee",
    details: {
      motif,
      hors_delai: maintenant > limite,
      de: cours.length,
      a: creneaux.length,
      vers: creneaux[0].debut,
      email: resultat.detail,
    },
  });

  redirect("/mon-espace?demande=deplacement");
}
