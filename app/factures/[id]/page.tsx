import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { dossierConnecte } from "@/lib/session";
import { emailAdmin } from "@/lib/admin";
import FactureDocument from "@/components/FactureDocument";

export const dynamic = "force-dynamic";

export default async function Facture({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = clientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!facture) notFound();

  // Pauline voit tout ; un élève ne voit que les siennes, et jamais un
  // brouillon — un brouillon n'est pas encore une facture.
  const admin = await emailAdmin();
  if (!admin) {
    const dossier = await dossierConnecte();
    const sien = dossier && dossier.id === facture.dossier_id;
    if (!sien || facture.statut === "brouillon") notFound();
  }

  const [{ data: lignes }, { data: p }, { data: client }] = await Promise.all([
    supabase
      .from("lignes_facture")
      .select("id, description, quantite, prix_unitaire_cents, total_cents")
      .eq("facture_id", id)
      .order("ordre"),
    supabase.from("parametres").select("*").eq("id", true).maybeSingle(),
    supabase
      .from("dossiers")
      .select("prenom, nom, email, eleve_prenom, eleve_classe")
      .eq("id", facture.dossier_id)
      .maybeSingle(),
  ]);

  // Un brouillon n'a ni numéro ni date : la loi impose une numérotation
  // continue, donc le numéro est attribué à l'émission et pas avant,
  // sinon un brouillon abandonné laisserait un trou dans la série.
  // On montre tout de même celui qu'elle recevra, pour que l'aperçu ne
  // paraisse pas incomplet.
  const { data: numeroAVenir } =
    facture.statut === "brouillon"
      ? await supabase.rpc("numero_suggere")
      : { data: null };

  return (
    <section className="section facture-page">
      <div className="conteneur-etroit">
        <FactureDocument
          facture={facture}
          lignes={lignes ?? []}
          reglages={p}
          client={client}
          numeroAVenir={numeroAVenir}
        />

        <p className="facture__impression">
          Pour enregistrer cette facture en PDF, utilisez l&apos;impression de votre
          navigateur et choisissez « Enregistrer au format PDF ».
        </p>

        {admin && (
          <p className="facture__recours">
            En dernier recours, si une mention très particulière manque :{" "}
            <a href={`/admin/factures/${id}/docx`}>télécharger une version Word</a>.
            Ce fichier est une copie : la facture du site reste la référence
            comptable, et la modifier là-bas ne change rien ici.
          </p>
        )}
      </div>
    </section>
  );
}
