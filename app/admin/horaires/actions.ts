"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";
import { parisVersInstant } from "@/lib/dates";

/**
 * Chaque action revérifie l'habilitation. Une action serveur est une
 * adresse publique : la protection du gabarit ne la couvre pas.
 */

const HEURE = /^\d{2}:\d{2}$/;

function retour(parametre?: string): never {
  revalidatePath("/admin/horaires");
  redirect(`/admin/horaires${parametre ?? ""}`);
}

export async function ajouterPlage(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const jour = Number(formulaire.get("jour_semaine"));
  const debut = String(formulaire.get("heure_debut") ?? "");
  const fin = String(formulaire.get("heure_fin") ?? "");

  if (!Number.isInteger(jour) || jour < 1 || jour > 7) retour("?erreur=jour");
  if (!HEURE.test(debut) || !HEURE.test(fin)) retour("?erreur=heure");
  if (fin <= debut) retour("?erreur=ordre");

  const { error } = await clientAdmin().from("disponibilites").insert({
    jour_semaine: jour,
    heure_debut: debut,
    heure_fin: fin,
  });

  retour(error ? "?erreur=base" : "?ok=plage");
}

export async function supprimerPlage(formulaire: FormData): Promise<void> {
  await exigerAdmin();
  const id = String(formulaire.get("id") ?? "");
  if (id) await clientAdmin().from("disponibilites").delete().eq("id", id);
  retour("?ok=suppression");
}

export async function basculerPlage(formulaire: FormData): Promise<void> {
  await exigerAdmin();
  const id = String(formulaire.get("id") ?? "");
  const actif = String(formulaire.get("actif") ?? "") === "1";
  if (id) {
    await clientAdmin().from("disponibilites").update({ actif: !actif }).eq("id", id);
  }
  retour();
}

export async function ajouterAbsence(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const debut = parisVersInstant(String(formulaire.get("debut") ?? ""));
  const fin = parisVersInstant(String(formulaire.get("fin") ?? ""));
  const motif = String(formulaire.get("motif") ?? "").trim() || null;

  if (!debut || !fin) retour("?erreur=dates");
  if (fin <= debut) retour("?erreur=ordre");

  const { error } = await clientAdmin()
    .from("indisponibilites")
    .insert({ debut, fin, motif });

  retour(error ? "?erreur=base" : "?ok=absence");
}

export async function supprimerAbsence(formulaire: FormData): Promise<void> {
  await exigerAdmin();
  const id = String(formulaire.get("id") ?? "");
  if (id) await clientAdmin().from("indisponibilites").delete().eq("id", id);
  retour("?ok=suppression");
}
