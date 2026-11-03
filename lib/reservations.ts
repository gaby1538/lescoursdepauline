import "server-only";
import { clientAdmin } from "./supabase";
import { ajouterJours, jourDuCreneau } from "./dates";
import type { Groupe } from "./constantes";

export type Creneau = { debut: string; fin: string };

/** Les créneaux libres d'une semaine, regroupés par jour (heure de Paris). */
export async function creneauxDeLaSemaine(
  lundi: string
): Promise<Record<string, Creneau[]>> {
  const supabase = clientAdmin();
  const { data, error } = await supabase.rpc("creneaux_libres", {
    jour_debut: lundi,
    jour_fin: ajouterJours(lundi, 6),
  });

  if (error) {
    console.error("creneaux_libres", error);
    return {};
  }

  const parJour: Record<string, Creneau[]> = {};
  for (const c of (data ?? []) as Creneau[]) {
    const jour = jourDuCreneau(c.debut);
    (parJour[jour] ??= []).push(c);
  }
  return parJour;
}

/** Les créneaux libres d'une période quelconque, regroupés par jour. */
export async function creneauxDeLaPeriode(
  premierJour: string,
  dernierJour: string
): Promise<Record<string, Creneau[]>> {
  const supabase = clientAdmin();
  const { data, error } = await supabase.rpc("creneaux_libres", {
    jour_debut: premierJour,
    jour_fin: dernierJour,
  });

  if (error) {
    console.error("creneaux_libres", error);
    return {};
  }

  const parJour: Record<string, Creneau[]> = {};
  for (const c of (data ?? []) as Creneau[]) {
    const jour = jourDuCreneau(c.debut);
    (parJour[jour] ??= []).push(c);
  }
  return parJour;
}

/** La classe choisie détermine le groupe tarifaire. */
export function groupeDeLaClasse(classe: string): Groupe {
  const lycee = ["première", "premiere", "terminale"];
  const c = classe.toLowerCase();
  return lycee.some((mot) => c.includes(mot)) ? "premiere_terminale" : "college_seconde";
}

/** Une adresse bloquée ne doit même pas créer de dossier. */
export async function adresseBloquee(email: string): Promise<boolean> {
  const supabase = clientAdmin();
  const { data } = await supabase.rpc("normaliser_email", { adresse: email });
  const normalise = (data as string | null) ?? email.toLowerCase();

  const { data: bloquee } = await supabase
    .from("liste_noire")
    .select("id")
    .eq("email_normalise", normalise)
    .maybeSingle();

  return Boolean(bloquee);
}
