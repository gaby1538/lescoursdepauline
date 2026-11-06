"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";

// Ces valeurs restent internes : un fichier « use server » ne peut
// exporter que des fonctions asynchrones. Le composant de dépôt tient
// sa propre copie pour refuser un fichier avant même de l'envoyer.
const TYPES_ACCEPTES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
];
const TAILLE_MAX = 25 * 1024 * 1024;

const MAX_DESTINATAIRES = 40;
const CHEMIN_TEMPORAIRE = /^depots\/[0-9a-f-]{36}(\.[a-z0-9]{1,8})?$/i;

type Preparation =
  | { ok: true; chemin: string; url: string }
  | { ok: false; erreur: string };

function extensionDe(nom: string): string {
  const point = nom.lastIndexOf(".");
  if (point <= 0) return "";
  const brute = nom.slice(point + 1).replace(/[^a-z0-9]/gi, "");
  return brute ? `.${brute.slice(0, 8).toLowerCase()}` : "";
}

/**
 * Première étape : le serveur vérifie l'habilitation et le fichier
 * annoncé, puis rend une adresse signée vers laquelle le navigateur
 * téléversera directement.
 *
 * Le fichier ne traverse plus le site. C'est ce qui permet de dépasser
 * les 4,5 Mo que Vercel accepte dans le corps d'une requête — au-delà,
 * la page tombait en erreur au lieu d'afficher un message.
 */
export async function preparerDepot(entree: {
  nom: string;
  type: string;
  taille: number;
}): Promise<Preparation> {
  await exigerAdmin();

  if (!TYPES_ACCEPTES.includes(entree.type)) return { ok: false, erreur: "type" };
  if (!Number.isFinite(entree.taille) || entree.taille <= 0) {
    return { ok: false, erreur: "fichier" };
  }
  if (entree.taille > TAILLE_MAX) return { ok: false, erreur: "taille" };

  const chemin = `depots/${crypto.randomUUID()}${extensionDe(entree.nom)}`;

  const { data, error } = await clientAdmin()
    .storage.from("documents")
    .createSignedUploadUrl(chemin);

  if (error || !data) {
    console.error("adresse de dépôt", error);
    return { ok: false, erreur: "preparation" };
  }

  return { ok: true, chemin, url: data.signedUrl };
}

/**
 * Seconde étape : le fichier est arrivé au dépôt temporaire. On le
 * recopie dans le dossier de chaque élève — chacun sa copie, pour
 * qu'une suppression chez l'un ne touche pas les autres — puis on
 * efface le temporaire.
 */
export async function finaliserDepot(entree: {
  chemin: string;
  dossierIds: string[];
  nom: string;
  type: string;
  taille: number;
}): Promise<{ deposes: number; erreur: string | null }> {
  await exigerAdmin();

  if (!CHEMIN_TEMPORAIRE.test(entree.chemin)) {
    return { deposes: 0, erreur: "chemin" };
  }
  if (!TYPES_ACCEPTES.includes(entree.type)) return { deposes: 0, erreur: "type" };
  if (entree.taille <= 0 || entree.taille > TAILLE_MAX) {
    return { deposes: 0, erreur: "taille" };
  }

  const destinataires = [...new Set(entree.dossierIds.filter(Boolean))];
  if (destinataires.length === 0) return { deposes: 0, erreur: "dossier" };
  if (destinataires.length > MAX_DESTINATAIRES) return { deposes: 0, erreur: "trop" };

  const supabase = clientAdmin();
  const extension = extensionDe(entree.nom);
  let deposes = 0;

  for (const dossierId of destinataires) {
    const cible = `${dossierId}/${crypto.randomUUID()}${extension}`;

    const { error: erreurCopie } = await supabase.storage
      .from("documents")
      .copy(entree.chemin, cible);

    if (erreurCopie) {
      console.error("copie document", dossierId, erreurCopie);
      continue;
    }

    const { error } = await supabase.from("documents").insert({
      dossier_id: dossierId,
      chemin: cible,
      nom_fichier: entree.nom.slice(0, 160),
      type_mime: entree.type,
      taille_octets: entree.taille,
      depose_par: "pauline",
    });

    if (error) {
      await supabase.storage.from("documents").remove([cible]);
      console.error("enregistrement document", dossierId, error);
      continue;
    }

    deposes += 1;
  }

  await supabase.storage.from("documents").remove([entree.chemin]);

  revalidatePath("/admin/documents");
  for (const dossierId of destinataires) revalidatePath(`/admin/eleves/${dossierId}`);

  return { deposes, erreur: deposes === 0 ? "depot" : null };
}

export async function supprimerDocument(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const demandee = String(formulaire.get("retour") ?? "");
  const ou = /^\/admin(\/[\w-]*)*$/.test(demandee) ? demandee : "/admin/documents";

  const id = String(formulaire.get("id") ?? "");
  if (id) {
    const supabase = clientAdmin();
    const { data } = await supabase
      .from("documents")
      .select("chemin")
      .eq("id", id)
      .maybeSingle();

    if (data?.chemin) await supabase.storage.from("documents").remove([data.chemin]);
    await supabase.from("documents").delete().eq("id", id);
  }

  revalidatePath(ou);
  redirect(`${ou}?ok=1`);
}
