import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { etiquette, saisie } from "@/components/Champs";
import { deposerDocument, supprimerDocument } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  dossier: "Choisissez l'élève à qui ce document est destiné.",
  fichier: "Aucun fichier sélectionné.",
  taille: "Le fichier dépasse 10 Mo.",
  type: "Formats acceptés : PDF, JPEG, PNG, HEIC.",
  depot: "Le dépôt a échoué. Le stockage est-il bien créé ?",
  base: "Le fichier est parti mais n'a pas pu être enregistré.",
};

type Doc = {
  id: string;
  nom_fichier: string;
  type_mime: string;
  taille_octets: number;
  cree_le: string;
  depose_par: string;
  dossiers: { id: string; eleve_prenom: string | null; email: string } | null;
};

function poids(octets: number): string {
  return octets > 1024 * 1024
    ? `${(octets / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { ok, erreur } = await searchParams;
  const supabase = clientAdmin();

  const [dossiers, documents] = await Promise.all([
    supabase
      .from("dossiers")
      .select("id, prenom, nom, eleve_prenom, eleve_classe, email")
      .eq("anonymise", false)
      .order("eleve_prenom"),
    supabase
      .from("documents")
      .select(
        "id, nom_fichier, type_mime, taille_octets, cree_le, depose_par, dossiers (id, eleve_prenom, email)"
      )
      .order("cree_le", { ascending: false }),
  ]);

  const liste = (documents.data ?? []) as unknown as Doc[];

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p className="surtitre">Administration</p>
        <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Documents</h1>
        <p className="plomb" style={{ marginTop: 16 }}>
          Les supports déposés ici apparaissent dans l&apos;espace de l&apos;élève. Le
          stockage est privé : chaque consultation passe par un lien signé qui expire
          au bout de quelques minutes.
        </p>

        {erreur && <p className="alerte">{MESSAGES[erreur] ?? "Dépôt impossible."}</p>}
        {ok && <p className="succes">Document déposé.</p>}

        <form action={deposerDocument} className="carte" style={{ marginTop: 28 }}>
          <p className="surtitre" style={{ marginBottom: 16 }}>
            Déposer un document
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label htmlFor="dossier_id" style={etiquette}>
                Pour quel élève
              </label>
              <select
                id="dossier_id"
                name="dossier_id"
                required
                defaultValue=""
                style={{ ...saisie, padding: "0 12px" }}
              >
                <option value="">Choisir un élève</option>
                {(dossiers.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.eleve_prenom ?? "—"}
                    {d.eleve_classe ? ` (${d.eleve_classe})` : ""} — {d.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fichier" style={etiquette}>
                Fichier
              </label>
              <input
                id="fichier"
                name="fichier"
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.heic"
                style={{ ...saisie, padding: "11px 12px", height: "auto" }}
              />
              <p style={{ marginTop: 7, fontSize: 13, color: "var(--texte-gris)" }}>
                PDF, JPEG, PNG ou HEIC. 10 Mo au maximum.
              </p>
            </div>
          </div>
          <button
            type="submit"
            className="bouton bouton--principal"
            style={{ marginTop: 20, width: "100%" }}
          >
            Déposer
          </button>
        </form>

        <h2 style={{ fontSize: 25, margin: "48px 0 16px" }}>Déposés</h2>
        <div className="tableau-enveloppe">
          {liste.length === 0 ? (
            <p style={{ padding: 24, fontSize: 15, color: "var(--texte-doux)" }}>
              Aucun document pour l&apos;instant.
            </p>
          ) : (
            <table className="liste">
              <tbody>
                {liste.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.nom_fichier}</strong>
                      <br />
                      <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                        {poids(d.taille_octets)} ·{" "}
                        {d.depose_par === "pauline" ? "déposé par vous" : "déposé par l'élève"}
                      </span>
                    </td>
                    <td>
                      {d.dossiers?.eleve_prenom ?? "—"}
                      <br />
                      <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                        {d.dossiers?.email}
                      </span>
                    </td>
                    <td className="droite">
                      <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                        <Link href={`/documents/${d.id}`} target="_blank">
                          ouvrir
                        </Link>
                        <form action={supprimerDocument}>
                          <input type="hidden" name="id" value={d.id} />
                          <button type="submit" className="lien-bouton">
                            supprimer
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
