"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";

function retour(parametre?: string): never {
  revalidatePath("/admin/reglages");
  revalidatePath("/reserver");
  redirect(`/admin/reglages${parametre ?? ""}`);
}

function entier(formulaire: FormData, nom: string, min: number, max: number): number | null {
  const valeur = Number(formulaire.get(nom));
  if (!Number.isInteger(valeur) || valeur < min || valeur > max) return null;
  return valeur;
}

export async function enregistrerReglages(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const suspension = String(formulaire.get("reservations_suspendues") ?? "aucune");
  if (!["aucune", "nouveaux", "totale"].includes(suspension)) retour("?erreur=1");

  const champs = {
    delai_reservation_h: entier(formulaire, "delai_reservation_h", 0, 168),
    delai_annulation_h: entier(formulaire, "delai_annulation_h", 0, 168),
    pause_entre_cours_min: entier(formulaire, "pause_entre_cours_min", 0, 240),
    max_cours_par_jour: entier(formulaire, "max_cours_par_jour", 1, 24),
    max_par_semaine: entier(formulaire, "max_par_semaine", 1, 50),
    max_a_venir: entier(formulaire, "max_a_venir", 1, 100),
    max_email_non_confirme: entier(formulaire, "max_email_non_confirme", 1, 10),
    delai_paiement_jours: entier(formulaire, "delai_paiement_jours", 1, 180),
    delai_relance_jours: entier(formulaire, "delai_relance_jours", 1, 90),
  };

  if (Object.values(champs).some((v) => v === null)) retour("?erreur=1");

  const { error } = await clientAdmin()
    .from("parametres")
    .update({
      ...champs,
      reservations_suspendues: suspension,
      message_suspension:
        String(formulaire.get("message_suspension") ?? "").trim() ||
        "Les réservations sont momentanément fermées. Écrivez-moi, je vous recontacte vite.",
      suspendu_le: suspension === "aucune" ? null : new Date().toISOString(),
      iban: String(formulaire.get("iban") ?? "").trim() || null,
      wero_telephone: String(formulaire.get("wero_telephone") ?? "").trim() || null,
      adresse_postale: String(formulaire.get("adresse_postale") ?? "").trim() || null,
      email_contact:
        String(formulaire.get("email_contact") ?? "").trim() ||
        "contact.capsvt@gmail.com",
      maj_le: new Date().toISOString(),
    })
    .eq("id", true);

  retour(error ? "?erreur=1" : "?ok=1");
}

export async function enregistrerTarif(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const groupe = String(formulaire.get("groupe") ?? "");
  const type = String(formulaire.get("type") ?? "");
  const euros = Number(String(formulaire.get("prix") ?? "").replace(",", "."));

  if (!["college_seconde", "premiere_terminale"].includes(groupe)) retour("?erreur=1");
  if (!["seance", "regulier"].includes(type)) retour("?erreur=1");
  if (!Number.isFinite(euros) || euros <= 0 || euros > 500) retour("?erreur=1");

  const supabase = clientAdmin();
  const maintenant = new Date().toISOString();

  // On ferme l'ancien tarif au lieu de l'écraser : les factures déjà
  // émises doivent rester explicables des années plus tard.
  await supabase
    .from("tarifs")
    .update({ valide_au: maintenant })
    .eq("groupe", groupe)
    .eq("type", type)
    .is("valide_au", null);

  const { error } = await supabase.from("tarifs").insert({
    groupe,
    type,
    prix_cents: Math.round(euros * 100),
    valide_du: maintenant,
  });

  retour(error ? "?erreur=1" : "?ok=tarif");
}
