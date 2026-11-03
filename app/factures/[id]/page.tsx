import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { dossierConnecte } from "@/lib/session";
import { emailAdmin } from "@/lib/admin";
import { euros } from "@/lib/constantes";
import { moisLong } from "@/lib/dates";

export const dynamic = "force-dynamic";

function date(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString("fr-FR") : "—";
}

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

  return (
    <section className="section facture-page">
      <div className="conteneur-etroit">
        <div className="facture">
          <div className="facture__entete">
            <div>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 25,
                  color: "var(--foret)",
                }}
              >
                Les cours de <span style={{ color: "var(--or-texte)" }}>Pauline</span>
              </p>
              <p className="facture__petit">
                {p?.exploitante}
                <br />
                {p?.adresse_postale ?? ""}
                <br />
                SIRET {p?.siret}
                <br />
                {p?.email_contact}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="surtitre">
                {facture.statut === "brouillon" ? "Brouillon" : "Facture"}
              </p>
              <p
                style={{
                  fontFamily: "var(--serif)",
                  fontSize: 30,
                  color: "var(--foret)",
                }}
              >
                {facture.numero ?? "sans numéro"}
              </p>
              <p className="facture__petit">
                Émise le {date(facture.emise_le)}
                <br />
                Échéance {date(facture.echeance_le)}
              </p>
            </div>
          </div>

          <div className="facture__parties">
            <div>
              <p className="surtitre">Facturé à</p>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte)" }}>
                {client?.prenom} {client?.nom}
                <br />
                {client?.email}
              </p>
            </div>
            <div>
              <p className="surtitre">Élève</p>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte)" }}>
                {client?.eleve_prenom}
                {client?.eleve_classe ? (
                  <>
                    <br />
                    {client.eleve_classe}
                  </>
                ) : null}
              </p>
            </div>
            <div>
              <p className="surtitre">Période</p>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte)" }}>
                {moisLong(facture.periode_debut)}
              </p>
            </div>
          </div>

          <table className="liste facture__lignes">
            <thead>
              <tr>
                <th>Prestation</th>
                <th className="droite">Quantité</th>
                <th className="droite">Prix unitaire</th>
                <th className="droite">Total</th>
              </tr>
            </thead>
            <tbody>
              {(lignes ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{l.description}</td>
                  <td className="droite">{Number(l.quantite)}</td>
                  <td className="droite">{euros(l.prix_unitaire_cents)}</td>
                  <td className="droite">{euros(l.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="facture__total">
            <span>Total à régler</span>
            <strong>{euros(facture.total_cents)}</strong>
          </div>

          <p className="facture__mention">TVA non applicable, article 293 B du CGI.</p>

          <div className="facture__paiement">
            <p className="surtitre" style={{ marginBottom: 10 }}>
              Règlement
            </p>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--texte-doux)" }}>
              Par virement{p?.iban ? ` — IBAN ${p.iban}` : ""}
              {p?.wero_telephone ? ( 
                <>
                  <br />
                  Par Wero au {p.wero_telephone}
                </>
              ) : null}
              <br />
              Payable sous {p?.delai_paiement_jours ?? 30} jours.
              {facture.payee_le ? ` Réglée le ${date(facture.payee_le)}.` : ""}
            </p>
          </div>
        </div>

        <p className="facture__impression">
          Pour enregistrer cette facture en PDF, utilisez l&apos;impression de votre
          navigateur et choisissez « Enregistrer au format PDF ».
        </p>
      </div>
    </section>
  );
}
