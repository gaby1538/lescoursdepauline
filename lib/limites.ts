import "server-only";
import { clientAdmin } from "./supabase";

/**
 * Plafonne les actions qui déclenchent un envoi d'email.
 *
 * Le compte est tenu par la base, sous verrou de ligne : compter dans
 * l'application ne protégerait de rien, deux requêtes simultanées
 * passeraient toutes les deux. Le quota Resend est de 100 messages par
 * jour — sans cela, quelqu'un qui demande cent réinitialisations pour
 * une adresse connue l'épuise et inonde la boîte d'un parent.
 *
 * En cas de panne de la base, on autorise : un garde-fou ne doit pas
 * devenir lui-même la panne.
 */
export async function autoriserEnvoi(
  cle: string,
  plafond: number,
  fenetreMinutes: number
): Promise<boolean> {
  const { data, error } = await clientAdmin().rpc("autoriser_envoi", {
    cle_demandee: cle.slice(0, 200),
    plafond,
    fenetre_minutes: fenetreMinutes,
  });

  if (error) {
    console.error("autoriser_envoi", error);
    return true;
  }
  return data !== false;
}

/** Les plafonds, rassemblés pour qu'ils se lisent d'un coup d'œil. */
export const PLAFONDS = {
  /** Liens d'activation ou de mot de passe pour une même adresse. */
  lienParAdresse: { plafond: 3, fenetre: 60 },
  /** Créations de dossier depuis une même adresse. */
  compteParAdresse: { plafond: 3, fenetre: 60 },
  /** Réservations déclenchant un email depuis une même adresse. */
  reservationParAdresse: { plafond: 10, fenetre: 60 },
} as const;
