"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";

const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic"];
const TAILLE_MAX = 10 * 1024 * 1024;
const MAX_DESTINATAIRES = 40;

/** Le champ vient du navigateur : on ne revient que dans l'administration. */
function destination(formulaire: FormData): string {
  const demandee = String(formulaire.get("retour") ?? "");
  return /^\/admin(\/[\w-]*)*$/.test(demandee) ? demandee : "/admin/documents";
}

function retour(chemin: string, parametre?: string): never {
  revalidatePath(chemin);
  redirect(`${chemin}${parametre ?? ""}`);
}

/**
 * Dépose un fichier dans le dossier d'un élève, ou de plusieurs à la
 * fois. Chaque élève reçoit sa propre copie : supprimer le document
 * d'un élève ne doit pas le faire disparaître chez les autres.
 */
export async function deposerDocument(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const ou = destination(formulaire);

  const destinataires = [
    ...new Set(
      [
        ...formulaire.getAll("dossier_ids").map(String),
        String(formulaire.get("dossier_id") ?? ""),
      ].filter(Boolean)
    ),
  ];

  const fichier = formulaire.get("fichier");

  if (destinataires.length === 0) retour(ou, "?erreur=dossier");
  if (destinataires.length > MAX_DESTINATAIRES) retour(ou, "?erreur=trop");
  if (!(fichier instanceof File) || fichier.size === 0) retour(ou, "?erreur=fichier");
  if (fichier.size > TAILLE_MAX) retour(ou, "?erreur=taille");
  if (!TYPES.includes(fichier.type)) retour(ou, "?erreur=type");

  const supabase = clientAdmin();

  // Lu une seule fois : un File ne se relit pas d'un envoi à l'autre.
  const octets = new Uint8Array(await fichier.arrayBuffer());

  // Le nom d'origine ne sert qu'à l'affichage. Le chemin est construit
  // par le serveur, pour qu'un nom de fichier malicieux ne puisse pas
  // sortir du dossier de l'élève.
  const point = fichier.name.lastIndexOf(".");
  const extension =
    point > 0 ? "." + fichier.name.slice(point + 1).replace(/[^a-z0-9]/gi, "").slice(0, 8) : "";

  let deposes = 0;

  for (const dossierId of destinataires) {
    const chemin = `${dossierId}/${crypto.randomUUID()}${extension}`;

    const { error: erreurDepot } = await supabase.storage
      .from("documents")
      .upload(chemin, octets, { contentType: fichier.type, upsert: false });

    if (erreurDepot) {
      console.error("dépôt document", dossierId, erreurDepot);
      continue;
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
      console.error("enregistrement document", dossierId, error);
      continue;
    }

    deposes += 1;
  }

  if (deposes === 0) retour(ou, "?erreur=depot");
  retour(ou, `?ok=${deposes}`);
}

export async function supprimerDocument(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const ou = destination(formulaire);
  const id = String(formulaire.get("id") ?? "");
  if (!id) retour(ou);

  const supabase = clientAdmin();
  const { data } = await supabase
    .from("documents")
    .select("chemin")
    .eq("id", id)
    .maybeSingle();

  if (data?.chemin) await supabase.storage.from("documents").remove([data.chemin]);
  await supabase.from("documents").delete().eq("id", id);

  retour(ou, "?ok=1");
}
