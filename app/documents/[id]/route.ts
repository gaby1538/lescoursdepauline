import { NextResponse, type NextRequest } from "next/server";
import { clientAdmin } from "@/lib/supabase";
import { dossierConnecte } from "@/lib/session";
import { emailAdmin } from "@/lib/admin";

/**
 * Sert un document par un lien signé de courte durée.
 *
 * Le bucket est privé : personne ne peut deviner une adresse. On vérifie
 * ici que le demandeur est Pauline, ou l'élève propriétaire du dossier,
 * puis on fabrique un lien valable cinq minutes.
 */
export async function GET(
  _requete: NextRequest,
  contexte: { params: Promise<{ id: string }> }
) {
  const { id } = await contexte.params;
  const supabase = clientAdmin();

  const { data: document } = await supabase
    .from("documents")
    .select("chemin, dossier_id, nom_fichier")
    .eq("id", id)
    .maybeSingle();

  if (!document) return new NextResponse("Introuvable", { status: 404 });

  const admin = await emailAdmin();
  if (!admin) {
    const dossier = await dossierConnecte();
    if (!dossier || dossier.id !== document.dossier_id) {
      return new NextResponse("Accès refusé", { status: 403 });
    }
  }

  const { data: lien, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(document.chemin, 300, { download: document.nom_fichier });

  if (error || !lien) {
    console.error("lien signé", error);
    return new NextResponse("Lien indisponible", { status: 500 });
  }

  return NextResponse.redirect(lien.signedUrl);
}
