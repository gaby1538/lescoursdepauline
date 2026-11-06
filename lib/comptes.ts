import "server-only";
import { clientAdmin } from "./supabase";

export type DossierBrut = {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  user_id: string | null;
  email_confirme_le: string | null;
  token_confirmation: string;
  token_expire_le: string | null;
};

/** Un lien reçu par email cesse d'ouvrir l'espace au bout d'une semaine. */
export const VALIDITE_JETON_JOURS = 7;

const COLONNES =
  "id, email, prenom, nom, user_id, email_confirme_le, token_confirmation, token_expire_le";

/**
 * Retrouve un dossier à partir d'une adresse, en passant par la forme
 * normalisée. C'est indispensable : l'index unique de la table porte sur
 * `email_normalise`, donc jean.dupont@gmail.com et jeandupont@gmail.com
 * désignent le même dossier. Chercher sur `email` brut créerait un
 * doublon que la base refuserait ensuite.
 */
export async function trouverDossierParEmail(
  email: string
): Promise<DossierBrut | null> {
  const supabase = clientAdmin();

  const { data: normalise } = await supabase.rpc("normaliser_email", {
    adresse: email,
  });

  const { data } = await supabase
    .from("dossiers")
    .select(COLONNES)
    .eq("email_normalise", (normalise as string | null) ?? email.toLowerCase())
    .eq("anonymise", false)
    .maybeSingle();

  return (data as DossierBrut | null) ?? null;
}

export async function trouverDossierParJeton(
  jeton: string
): Promise<DossierBrut | null> {
  if (!/^[0-9a-f-]{36}$/i.test(jeton)) return null;

  const { data } = await clientAdmin()
    .from("dossiers")
    .select(COLONNES)
    .eq("token_confirmation", jeton)
    .eq("anonymise", false)
    .maybeSingle();

  const dossier = (data as DossierBrut | null) ?? null;
  if (!dossier) return null;

  // Un vieux message transféré, ou une boîte compromise des mois plus
  // tard, ne doit pas rouvrir l'espace.
  if (dossier.token_expire_le && dossier.token_expire_le < new Date().toISOString()) {
    return null;
  }

  return dossier;
}

/**
 * Remplace le jeton par un neuf. Appelé après chaque usage : un lien
 * d'activation qui dort dans une boîte mail ne doit pas rester une clé
 * d'accès indéfiniment valable.
 */
export async function renouvelerJeton(dossierId: string): Promise<string> {
  const jeton = crypto.randomUUID();
  const expiration = new Date(
    Date.now() + VALIDITE_JETON_JOURS * 24 * 3600 * 1000
  ).toISOString();

  await clientAdmin()
    .from("dossiers")
    .update({ token_confirmation: jeton, token_expire_le: expiration })
    .eq("id", dossierId);

  return jeton;
}

/**
 * Secours : retrouver un compte d'authentification par son adresse.
 * Sert quand un dossier a perdu le lien vers son compte, cas rare mais
 * qui laisserait sinon la personne sans issue.
 */
export async function trouverCompteParEmail(email: string): Promise<string | null> {
  const { data } = await clientAdmin().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const cible = email.trim().toLowerCase();
  const trouve = data?.users.find((u) => (u.email ?? "").toLowerCase() === cible);
  return trouve?.id ?? null;
}

/**
 * Tous les liens envoyés par email passent par /confirmer : cette route
 * valide l'adresse puis redirige vers /activer. Un seul point d'entrée,
 * donc un seul comportement à vérifier.
 */
export function lienActivation(jeton: string, reinitialisation = false): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";
  return `${site}/confirmer?token=${jeton}${reinitialisation ? "&reinit=1" : ""}`;
}
