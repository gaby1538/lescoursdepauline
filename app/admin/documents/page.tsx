import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import DepotDocument from "./DepotDocument";
import { type EleveChoisissable } from "./ChoixEleves";
import { supprimerDocument } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  dossier: "Choisissez au moins un élève.",
  trop: "Quarante élèves au maximum pour un même envoi.",
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

        {erreur && <p className="alerte">{MESSAGES[erreur] ?? "Action impossible."}</p>}
        {ok && <p className="succes">C&apos;est fait.</p>}

        <DepotDocument
          titre="Déposer un document"
          eleves={(dossiers.data ?? []) as EleveChoisissable[]}
        />

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
