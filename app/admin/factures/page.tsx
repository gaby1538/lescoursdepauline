import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { euros } from "@/lib/constantes";
import { moisLong, jourDuCreneau } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import {
  genererFactures,
  emettreEtEnvoyer,
  marquerPayee,
  supprimerBrouillon,
} from "./actions";

export const dynamic = "force-dynamic";

type Facture = {
  id: string;
  numero: string | null;
  statut: string;
  periode_debut: string;
  total_cents: number;
  echeance_le: string | null;
  envoyee_le: string | null;
  payee_le: string | null;
  dossiers: { eleve_prenom: string | null; prenom: string | null; email: string } | null;
};

const LIBELLE: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

export default async function Factures({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { ok, erreur } = await searchParams;
  const supabase = clientAdmin();

  // Ce qui est validé mais encore sur aucune facture. C'est la réponse à
  // « j'ai validé le cours et je ne vois pas de facture » : la
  // préparation reste un geste volontaire, mais elle ne doit plus être
  // invisible.
  const { data: enAttente } = await supabase
    .from("reservations")
    .select("id, debut, prix_cents")
    .is("facture_id", null)
    .in("statut", ["effectuee", "annulee_hors_delai", "absent"]);

  const parMois = new Map<string, { heures: number; cents: number }>();
  for (const r of enAttente ?? []) {
    const mois = jourDuCreneau(r.debut).slice(0, 7);
    const c = parMois.get(mois) ?? { heures: 0, cents: 0 };
    c.heures += 1;
    c.cents += r.prix_cents ?? 0;
    parMois.set(mois, c);
  }
  const moisEnAttente = [...parMois.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const { data } = await supabase
    .from("factures")
    .select(
      "id, numero, statut, periode_debut, total_cents, echeance_le, envoyee_le, payee_le, dossiers (eleve_prenom, prenom, email)"
    )
    .order("cree_le", { ascending: false });

  const liste = (data ?? []) as unknown as Facture[];

  // Le mois le plus utile est celui qui attend quelque chose ; à défaut,
  // le mois en cours. Proposer le mois précédent par défaut faisait
  // préparer des factures vides.
  const moisDefaut =
    moisEnAttente[0]?.[0] ?? new Date().toISOString().slice(0, 7);

  return (
    <section className="section">
      <div className="conteneur">
        <div className="admin__titre">
          <div>
            <p className="surtitre">Administration</p>
            <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Factures</h1>
          </div>
        </div>

        {erreur === "envoi" && (
          <p className="alerte">
            La facture est émise et numérotée, mais l&apos;email n&apos;est pas parti.
            Vérifiez les journaux, puis renvoyez-la depuis sa page.
          </p>
        )}
        {erreur === "mois" && <p className="alerte">Choisissez un mois valide.</p>}
        {ok === "rien" && (
          <p className="succes">
            Aucun cours à facturer sur ce mois : tout est déjà sur une facture.
          </p>
        )}
        {ok && ok !== "rien" && <p className="succes">C&apos;est fait.</p>}

        {moisEnAttente.length > 0 && (
          <div className="carte" style={{ marginBottom: 20, borderColor: "var(--or-clair)" }}>
            <p className="surtitre" style={{ marginBottom: 14 }}>
              En attente de facturation
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {moisEnAttente.map(([mois, c]) => (
                <form
                  key={mois}
                  action={genererFactures}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <input type="hidden" name="mois" value={mois} />
                  <span style={{ fontSize: 15.5, color: "var(--foret)" }}>
                    <strong style={{ fontFamily: "var(--serif)", fontSize: 19, fontWeight: 500 }}>
                      {moisLong(`${mois}-01`)}
                    </strong>{" "}
                    — {c.heures} h, {euros(c.cents)}
                  </span>
                  <button type="submit" className="bouton bouton--or bouton--compact">
                    Préparer ces factures
                  </button>
                </form>
              ))}
            </div>
            <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.6, color: "var(--texte-gris)" }}>
              Ces cours sont validés mais ne figurent sur aucune facture. Rien
              n&apos;est envoyé à la préparation : vous relisez avant d&apos;émettre.
            </p>
          </div>
        )}

        <form action={genererFactures} className="carte" style={{ marginBottom: 32 }}>
          <p className="surtitre" style={{ marginBottom: 14 }}>
            Préparer les factures d&apos;un mois
          </p>
          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.65,
              color: "var(--texte-doux)",
              marginBottom: 16,
            }}
          >
            Pour revenir sur un autre mois que ceux proposés ci-dessus. Rassemble les
            cours donnés, les annulations tardives et les absences qui ne sont pas
            encore sur une facture, et prépare un brouillon par élève.
          </p>
          <div className="rangee-formulaire">
            <div>
              <label htmlFor="mois" style={etiquette}>
                Mois
              </label>
              <input
                id="mois"
                name="mois"
                type="month"
                required
                defaultValue={moisDefaut}
                style={saisie}
              />
            </div>
            <button type="submit" className="bouton bouton--principal bouton--compact">
              Préparer les brouillons
            </button>
          </div>
        </form>

        <div className="tableau-enveloppe tableau-defilant">
          {liste.length === 0 ? (
            <p style={{ padding: 28, fontSize: 15, color: "var(--texte-doux)" }}>
              Aucune facture pour l&apos;instant.
            </p>
          ) : (
            <table className="liste">
              <thead>
                <tr>
                  <th>Facture</th>
                  <th>Élève</th>
                  <th>Période</th>
                  <th className="droite">Montant</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.numero ?? "—"}</strong>
                      <br />
                      <span className="etiquette">{LIBELLE[f.statut] ?? f.statut}</span>
                    </td>
                    <td>
                      {f.dossiers?.eleve_prenom ?? "—"}
                      <br />
                      <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                        {f.dossiers?.email}
                      </span>
                    </td>
                    <td>
                      {moisLong(f.periode_debut)}
                      {f.echeance_le ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                            échéance {new Date(f.echeance_le).toLocaleDateString("fr-FR")}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td className="droite">
                      <strong>{euros(f.total_cents)}</strong>
                    </td>
                    <td className="droite">
                      <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                        <Link href={`/factures/${f.id}`} target="_blank">
                          voir
                        </Link>
                        {f.statut === "brouillon" && (
                          <>
                            <form action={emettreEtEnvoyer}>
                              <input type="hidden" name="id" value={f.id} />
                              <button type="submit" className="lien-bouton">
                                émettre et envoyer
                              </button>
                            </form>
                            <form action={supprimerBrouillon}>
                              <input type="hidden" name="id" value={f.id} />
                              <button type="submit" className="lien-bouton">
                                supprimer
                              </button>
                            </form>
                          </>
                        )}
                        {(f.statut === "envoyee" || f.statut === "en_retard") && (
                          <form action={marquerPayee}>
                            <input type="hidden" name="id" value={f.id} />
                            <button type="submit" className="lien-bouton">
                              marquer payée
                            </button>
                          </form>
                        )}
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
