import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { retirerDeLaListeNoire } from "./actions";

export const dynamic = "force-dynamic";

type Dossier = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  eleve_prenom: string | null;
  eleve_classe: string | null;
  email_confirme_le: string | null;
  suspendu: boolean;
  user_id: string | null;
  archive_le: string | null;
  cree_le: string;
};

export default async function Eleves() {
  const supabase = clientAdmin();

  const [dossiers, reservations, noire] = await Promise.all([
    supabase
      .from("dossiers")
      .select(
        "id, prenom, nom, email, eleve_prenom, eleve_classe, email_confirme_le, suspendu, user_id, archive_le, cree_le"
      )
      .eq("anonymise", false)
      .order("cree_le", { ascending: false }),
    supabase.from("reservations").select("dossier_id, statut, debut, validee_le"),
    supabase.from("liste_noire").select("id, email_normalise, telephone, motif, cree_le"),
  ]);

  const tous = (dossiers.data ?? []) as Dossier[];

  // Les fiches archivées sortent des listes sans rien perdre : leur
  // historique et leurs factures restent, dix ans durant.
  const liste = tous.filter((d) => !d.archive_le);
  const archives = tous.filter((d) => d.archive_le);
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
          <div
            style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}
          >
            <p style={{ fontSize: 14, color: "var(--texte-gris)" }}>
              {liste.length} dossier{liste.length > 1 ? "s" : ""}
            </p>
            <Link href="/admin/eleves/nouveau" className="action action--foret">
              Nouvel élève
            </Link>
          </div>
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
                          {d.email ?? "pas d'adresse"}
                        </span>
                      </td>
                      <td>
                        {d.suspendu ? (
                          <span className="etiquette">Suspendu</span>
                        ) : !d.email ? (
                          <span className="etiquette">Hors ligne</span>
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

        {archives.length > 0 && (
          <details className="repli-discret">
            <summary>Élèves archivés ({archives.length})</summary>
            <div className="repli-discret__corps">
              <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--texte-gris)" }}>
                Ils ne prennent plus de cours. Leur fiche reste ouverte : les cours
                passés et les factures émises ne s&apos;effacent pas.
              </p>
              <table className="liste" style={{ marginTop: 14 }}>
                <tbody>
                  {archives.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.eleve_prenom ?? "—"}</strong>
                      </td>
                      <td style={{ color: "var(--texte-gris)" }}>
                        {d.eleve_classe ?? ""}
                      </td>
                      <td className="droite">
                        <Link href={`/admin/eleves/${d.id}`}>ouvrir</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* Bloquer quelqu'un doit rester exceptionnel : la section est
            repliée, sans titre de section, et ne s'annonce que par une
            ligne. Le compte n'apparaît que si quelqu'un est bloqué. */}
        <details className="repli-discret">
          <summary>
            Adresses bloquées
            {(noire.data ?? []).length > 0 ? ` (${(noire.data ?? []).length})` : ""}
          </summary>

          <div className="repli-discret__corps">
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--texte-gris)" }}>
              Ces adresses ne peuvent plus créer de dossier ni réserver. Le site ne le
              leur dit pas : il répond que la réservation n&apos;a pas pu être
              enregistrée. Le blocage s&apos;ajoute depuis la fiche d&apos;un élève,
              au moment de la supprimer.
            </p>

            {(noire.data ?? []).length === 0 ? (
              <p style={{ marginTop: 12, fontSize: 14, color: "var(--texte-gris)" }}>
                Personne n&apos;est bloqué.
              </p>
            ) : (
              <table className="liste" style={{ marginTop: 14 }}>
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
        </details>

      </div>
    </section>
  );
}
