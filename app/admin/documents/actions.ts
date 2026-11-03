"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";

const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic"];
const TAILLE_MAX = 10 * 1024 * 1024;

function retour(parametre?: string): never {
  revalidatePath("/admin/documents");
  redirect(`/admin/documents${parametre ?? ""}`);
}

export async function deposerDocument(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const dossierId = String(formulaire.get("dossier_id") ?? "");
  const fichier = formulaire.get("fichier");

  if (!dossierId) retour("?erreur=dossier");
  if (!(fichier instanceof File) || fichier.size === 0) retour("?erreur=fichier");
  if (fichier.size > TAILLE_MAX) retour("?erreur=taille");
  if (!TYPES.includes(fichier.type)) retour("?erreur=type");

  const supabase = clientAdmin();

  // Le nom d'origine ne sert qu'à l'affichage : le chemin est construit
  // par le serveur, pour qu'un nom de fichier malicieux ne puisse pas
  // sortir du dossier de l'élève.
  const extension = fichier.name.includes(".")
    ? `.${fichier.name.split(".").pop()?.slice(0, 8)}`
    : "";
  const chemin = `${dossierId}/${crypto.randomUUID()}${extension}`;

  const { error: erreurDepot } = await supabase.storage
    .from("documents")
    .upload(chemin, fichier, { contentType: fichier.type, upsert: false });

  if (erreurDepot) {
    console.error("dépôt document", erreurDepot);
    retour("?erreur=depot");
  }

  const { error } = await supabase.from("documents").insert({
    dossier_id: dossierId,
    chemin,
    nom_fichier: fichier.name.slice(0, 160),
    type_mime: fichier.type,
    taille_octets: fichier.size,
    depose_par: "pauline",
  });

  if (error) {
    await supabase.storage.from("documents").remove([chemin]);
    console.error("enregistrement document", error);
    retour("?erreur=base");
  }

  retour("?ok=1");
}

export async function supprimerDocument(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();
  const { data } = await supabase
    .from("documents")
    .select("chemin")
    .eq("id", id)
    .maybeSingle();

  if (data?.chemin) await supabase.storage.from("documents").remove([data.chemin]);
  await supabase.from("documents").delete().eq("id", id);

  retour("?ok=1");
}
