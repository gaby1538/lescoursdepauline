import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { retirerDeLaListeNoire } from "./actions";

export const dynamic = "force-dynamic";

type Dossier = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string;
  eleve_prenom: string | null;
  eleve_classe: string | null;
  email_confirme_le: string | null;
  suspendu: boolean;
  user_id: string | null;
  cree_le: string;
};

export default async function Eleves() {
  const supabase = clientAdmin();

  const [dossiers, reservations, noire] = await Promise.all([
    supabase
      .from("dossiers")
      .select(
        "id, prenom, nom, email, eleve_prenom, eleve_classe, email_confirme_le, suspendu, user_id, cree_le"
      )
      .eq("anonymise", false)
      .order("cree_le", { ascending: false }),
    supabase.from("reservations").select("dossier_id, statut, debut, validee_le"),
    supabase.from("liste_noire").select("id, email_normalise, telephone, motif, cree_le"),
  ]);

  const liste = (dossiers.data ?? []) as Dossier[];
  const maintenant = new Date().toISOString();

  const compte = new Map<string, { total: number; aVenir: number; attente: number }>();
  for (const r of reservations.data ?? []) {
    const c = compte.get(r.dossier_id) ?? { total: 0, aVenir: 0, attente: 0 };
    c.total += 1;
    if (r.statut === "reservee" && !r.validee_le) c.attente += 1;
    else if (r.statut === "reservee" && r.debut >= maintenant) c.aVenir += 1;
    compte.set(r.dossier_id, c);
  }

  return (
    <section className="section">
      <div className="conteneur">
        <div className="admin__titre">
          <div>
            <p className="surtitre">Administration</p>
            <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Élèves</h1>
          </div>
          <p style={{ fontSize: 14, color: "var(--texte-gris)" }}>
            {liste.length} dossier{liste.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="tableau-enveloppe tableau-defilant">
          {liste.length === 0 ? (
            <p style={{ padding: 28, fontSize: 15, color: "var(--texte-doux)" }}>
              Aucun dossier pour l&apos;instant.
            </p>
          ) : (
            <table className="liste">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Contact</th>
                  <th>État</th>
                  <th className="droite">Cours</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.map((d) => {
                  const c = compte.get(d.id) ?? { total: 0, aVenir: 0, attente: 0 };
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.eleve_prenom ?? "—"}</strong>
                        {d.eleve_classe ? (
                          <>
                            <br />
                            <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                              {d.eleve_classe}
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td>
                        {d.prenom} {d.nom}
                        <br />
                        <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                          {d.email}
                        </span>
                      </td>
                      <td>
                        {d.suspendu ? (
                          <span className="etiquette">Suspendu</span>
                        ) : d.email_confirme_le ? (
                          <span className="etiquette">
                            {d.user_id ? "Espace actif" : "Adresse confirmée"}
                          </span>
                        ) : (
                          <span className="etiquette">Adresse non confirmée</span>
                        )}
                      </td>
                      <td className="droite">
                        {c.total}
                        {c.attente > 0 ? (
                          <>
                            <br />
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--or-texte)",
                                fontWeight: 600,
                              }}
                            >
                              {c.attente} à valider
                            </span>
                          </>
                        ) : null}
                        {c.aVenir > 0 ? (
                          <>
                            <br />
                            <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                              {c.aVenir} à venir
                            </span>
                          </>
                        ) : null}
                      </td>
                      <td className="droite">
                        <Link href={`/admin/eleves/${d.id}`}>ouvrir</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <h2 style={{ fontSize: 25, margin: "52px 0 10px" }}>Liste noire</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Ces adresses ne peuvent plus créer de dossier ni réserver. Le site ne le leur
          dit pas explicitement : il répond que la réservation n&apos;a pas pu être
          enregistrée.
        </p>

        <div className="tableau-enveloppe" style={{ marginTop: 18 }}>
          {(noire.data ?? []).length === 0 ? (
            <p style={{ padding: 24, fontSize: 15, color: "var(--texte-doux)" }}>
              Personne n&apos;est bloqué.
            </p>
          ) : (
            <table className="liste">
              <tbody>
                {(noire.data ?? []).map((n) => (
                  <tr key={n.id}>
                    <td>
                      <strong>{n.email_normalise ?? n.telephone}</strong>
                    </td>
                    <td>{n.motif ?? "—"}</td>
                    <td className="droite">
                      <form action={retirerDeLaListeNoire}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" className="lien-bouton">
                          débloquer
                        </button>
                      </form>
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
