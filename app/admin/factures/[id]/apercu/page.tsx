import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import FactureDocument from "@/components/FactureDocument";
import { emettre } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * La facture en grand, avant le geste.
 *
 * Deux chemins y mènent depuis le brouillon. « Visualiser » ne montre
 * que le document : on repart comme on est venu. « Émettre » montre le
 * même document, mais avec les boutons qui attribuent le numéro — et
 * cela, le site ne sait pas le défaire. Autant que Pauline ait lu la
 * facture entière juste avant, à l'endroit même où elle décide.
 */
export default async function ApercuFacture({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emettre?: string; numero?: string }>;
}) {
  const { id } = await params;
  const recherche = await searchParams;
  const supabase = clientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!facture) notFound();

  const [{ data: lignes }, { data: reglages }, { data: client }] = await Promise.all([
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

  const brouillon = facture.statut === "brouillon";

  // Le numéro vient de l'écran précédent si Pauline l'a corrigé ; sinon
  // c'est le suivant de la série.
  const { data: suggestion } = brouillon
    ? await supabase.rpc("numero_suggere")
    : { data: null };

  const numero =
    String(recherche.numero ?? "").trim().slice(0, 40) || (suggestion as string | null);

  // On ne propose les deux gestes que sur un brouillon : une facture
  // déjà numérotée ne s'émet pas deux fois.
  const decider = brouillon && recherche.emettre === "1";

  return (
    <section className="section">
      <div className="conteneur-etroit">
        {decider ? (
          <div className="avertissement-envoi">
            <p className="surtitre">Rien n&apos;est encore parti</p>
            <h1>Voici la facture telle qu&apos;elle partira</h1>
            <p>
              Elle prendra le numéro{" "}
              <strong style={{ color: "var(--foret)", fontVariantNumeric: "tabular-nums" }}>
                {numero ?? "—"}
              </strong>
              {client?.email ? (
                <>
                  {" "}
                  et sera envoyée à{" "}
                  <strong style={{ color: "var(--foret)", wordBreak: "break-all" }}>
                    {client.email}
                  </strong>
                </>
              ) : null}
              . Après confirmation, le numéro est consommé et la facture ne se
              modifie plus.
            </p>
          </div>
        ) : (
          <div className="admin__titre">
            <div>
              <p className="surtitre">
                {brouillon ? "Brouillon" : `Facture ${facture.numero ?? ""}`}
              </p>
              <h1 style={{ fontSize: 32, lineHeight: 1.12 }}>
                {brouillon ? "Rien n'est figé" : "La facture"}
              </h1>
            </div>
            <Link
              href={brouillon ? `/admin/factures/${id}/modifier` : "/admin/factures"}
              className="action action--contour"
            >
              {brouillon ? "Revenir au brouillon" : "Retour aux factures"}
            </Link>
          </div>
        )}

        <div style={{ marginTop: decider ? 20 : 8 }}>
          <FactureDocument
            facture={facture}
            lignes={lignes ?? []}
            reglages={reglages}
            client={client}
            numeroAVenir={numero}
          />
        </div>

        {decider && (
          <div className="barre-emission">
            <div className="barre-emission__gestes">
              <form action={emettre.bind(null, "envoyer")}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="numero" value={numero ?? ""} />
                <button type="submit" className="action action--or action--grand">
                  Émettre et envoyer
                </button>
              </form>
              <form action={emettre.bind(null, "plus-tard")}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="numero" value={numero ?? ""} />
                <button type="submit" className="action action--contour action--grand">
                  Émettre, j&apos;enverrai plus tard
                </button>
              </form>
              <Link
                href={`/admin/factures/${id}/modifier`}
                className="action action--discret"
                style={{ marginLeft: 0 }}
              >
                Revenir au brouillon
              </Link>
            </div>

            <p>
              Les deux attribuent le numéro et figent la facture : une correction
              après coup passerait par un avoir. Le second n&apos;envoie rien — la
              facture rejoint <strong>À envoyer</strong>, d&apos;où vous
              l&apos;enverrez, la téléchargerez, ou la marquerez remise en main
              propre.
            </p>
          </div>
        )}

        {!decider && !brouillon && (
          <p className="facture__impression">
            Pour l&apos;enregistrer en PDF :{" "}
            <a href={`/admin/factures/${id}/pdf`}>télécharger le PDF</a>, celui-là
            même qui part en pièce jointe. Une erreur à réparer ?{" "}
            <Link href={`/admin/factures/${id}/modifier`}>
              corriger l&apos;état de cette facture
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
