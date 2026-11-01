import { createClient } from "@supabase/supabase-js";

/**
 * Deux clients, deux usages.
 *
 *  - `clientPublic()` porte la clé anonyme. Il respecte les règles RLS,
 *    donc un visiteur ne voit que son propre dossier. C'est celui que le
 *    navigateur utilise.
 *
 *  - `clientAdmin()` porte la clé de service, qui ignore RLS. Il ne doit
 *    JAMAIS être importé dans un composant client : la clé fuiterait dans
 *    le bundle envoyé au navigateur. Serveur uniquement.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cleAnonyme = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function clientPublic() {
  if (!url || !cleAnonyme) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies."
    );
  }
  return createClient(url, cleAnonyme);
}

export function clientAdmin() {
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies."
    );
  }
  if (typeof window !== "undefined") {
    throw new Error("clientAdmin() ne doit jamais être appelé côté navigateur.");
  }
  return createClient(url, cleService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Les erreurs que lève le déclencheur `verifier_reservation()`,
 *  traduites pour l'écran. */
export const MESSAGES_RESERVATION: Record<string, string> = {
  RESERVATIONS_SUSPENDUES:
    "Les réservations sont momentanément fermées. Écrivez-moi, je vous recontacte vite.",
  RESERVATIONS_SUSPENDUES_NOUVEAUX:
    "Les nouvelles inscriptions sont momentanément fermées. Écrivez-moi directement.",
  DOSSIER_SUSPENDU:
    "Votre dossier est en attente de régularisation. Contactez-moi pour le réactiver.",
  ADRESSE_BLOQUEE:
    "La réservation n'a pas pu être enregistrée. Écrivez-moi pour en savoir plus.",
  TROP_TARD: "Ce créneau est trop proche : il faut réserver au moins 24 h à l'avance.",
  HORS_DISPONIBILITE: "Ce créneau n'est pas proposé.",
  CRENEAU_INDISPONIBLE: "Ce créneau vient d'être pris.",
  EMAIL_NON_CONFIRME:
    "Confirmez d'abord votre adresse avec le lien reçu par email, puis vous pourrez réserver d'autres cours.",
  PLAFOND_SEMAINE:
    "Vous avez déjà le maximum de cours réservés sur cette semaine. Écrivez-moi s'il vous en faut davantage.",
  PLAFOND_A_VENIR:
    "Vous avez atteint le nombre maximum de cours réservés à l'avance.",
  JOURNEE_COMPLETE: "Cette journée est complète.",
  PAUSE_INSUFFISANTE: "Ce créneau est trop proche d'un autre cours.",
};

export function messageErreurReservation(erreur: unknown): string {
  const texte = erreur instanceof Error ? erreur.message : String(erreur);
  for (const [code, message] of Object.entries(MESSAGES_RESERVATION)) {
    if (texte.includes(code)) return message;
  }
  return "La réservation n'a pas pu être enregistrée. Réessayez dans un instant.";
}
