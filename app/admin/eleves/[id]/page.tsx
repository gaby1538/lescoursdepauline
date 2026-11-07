import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { creneauLong } from "@/lib/dates";
import { euros } from "@/lib/constantes";
import { etiquette, saisie } from "@/components/Champs";
import Historique, { type Evenement } from "@/components/Historique";
import { supprimerDocument } from "../../documents/actions";
import DepotDocument from "../../documents/DepotDocument";
import {
  basculerSuspension,
  annulerCours,
  marquerEffectue,
  supprimerDossier,
  enregistrerFacturation,
} from "../actions";

export const dynamic = "force-dynamic";

const LIBELLE: Record<string, string> = {
  reservee: "Réservé",
  effectuee: "Donné",
  annulee_dans_delai: "Annulé à temps",
  annulee_hors_delai: "Annulé tardivement",
  absent: "Absent",
  annulee_par_pauline: "Annulé par vous",
};

export default async function FicheEleve({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const supabase = clientAdmin();

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!dossier) notFound();

  const [{ data: cours }, { data: documents }, { data: evenements }] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, debut, statut, validee_le, refus_motif, sujet, prix_cents, facture_id, annulation_demandee_le, annulation_decision, annulation_reponse, annulation_motif"
      )
      .eq("dossier_id", id)
      .order("debut", { ascending: false }),
    supabase
      .from("documents")
      .select("id, nom_fichier, taille_octets, cree_le, depose_par")
      .eq("dossier_id", id)
      .order("cree_le", { ascending: false }),
    supabase
      .from("journal")
      .select("id, acteur, objet, action, details, cree_le")
      .eq("dossier_id", id)
      .order("cree_le", { ascending: false })
      .limit(150),
  ]);

  const maintenant = new Date().toISOString();

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p style={{ fontSize: 13.5, marginBottom: 10 }}>
          <Link href="/admin/eleves">‹ Tous les élèves</Link>
        </p>

        <h1 style={{ fontSize: 38, lineHeight: 1.12 }}>
          {dossier.eleve_prenom ?? "Élève"}
          {dossier.eleve_classe ? (
            <span style={{ fontSize: 20, color: "var(--texte-gris)" }}>
              {" "}
              · {dossier.eleve_classe}
            </span>
          ) : null}
        </h1>

        <p style={{ marginTop: 12, fontSize: 15, color: "var(--texte-doux)" }}>
          Dossier ouvert par {dossier.prenom} {dossier.nom} — {dossier.email}
          {dossier.telephone ? ` · ${dossier.telephone}` : ""}
        </p>

        {ok && <p className="succes">C&apos;est fait.</p>}

        {dossier.suspendu && (
          <p className="alerte">
            <strong>Dossier suspendu.</strong>{" "}
            {dossier.motif_suspension ?? "Aucun motif indiqué."} Cet élève ne peut plus
            réserver.
          </p>
        )}

        <div className="chiffres" style={{ marginTop: 28, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="chiffre">
            <p className="chiffre__valeur">{(cours ?? []).length}</p>
            <p className="chiffre__libelle">cours au total</p>
          </div>
          <div className="chiffre">
            <p className="chiffre__valeur">
              {
                (cours ?? []).filter(
                  (c) =>
                    c.statut === "reservee" && c.validee_le && c.debut >= maintenant
                ).length
              }
            </p>
            <p className="chiffre__libelle">à venir</p>
          </div>
          <div className="chiffre">
            <p className="chiffre__valeur">
              {dossier.email_confirme_le ? (dossier.user_id ? "Actif" : "Confirmé") : "—"}
            </p>
            <p className="chiffre__libelle">espace élève</p>
          </div>
        </div>

        <h2 style={{ fontSize: 25, margin: "44px 0 16px" }}>Ses cours</h2>
        <div className="tableau-enveloppe">
          {(cours ?? []).length === 0 ? (
            <p style={{ padding: 24, fontSize: 15, color: "var(--texte-doux)" }}>
              Aucun cours.
            </p>
          ) : (
            <table className="liste">
              <tbody>
                {(cours ?? []).map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{creneauLong(c.debut)}</strong>
                      {c.sujet ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13.5, color: "var(--texte-gris)" }}>
                            {c.sujet}
                          </span>
                        </>
                      ) : null}
                      {c.annulation_demandee_le ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: "var(--or-texte)" }}>
                            {c.annulation_decision === "acceptee"
                              ? "Annulation demandée, acceptée"
                              : c.annulation_decision === "refusee"
                                ? "Annulation demandée, refusée"
                                : "Annulation demandée, en attente"}
                            {c.annulation_motif ? ` — « ${c.annulation_motif} »` : ""}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={
                          c.statut === "reservee" && !c.validee_le
                            ? "etiquette etiquette--attente"
                            : "etiquette"
                        }
                      >
                        {c.statut === "reservee" && !c.validee_le
                          ? "À valider"
                          : c.statut === "annulee_par_pauline" && !c.validee_le
                            ? "Demande refusée"
                            : LIBELLE[c.statut] ?? c.statut}
                      </span>
                      <br />
                      <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                        {euros(c.prix_cents)}
                        {c.facture_id ? " · facturé" : ""}
                      </span>
                    </td>
                    <td className="droite">
                      {c.statut === "reservee" && !c.validee_le && (
                        <Link href="/admin" style={{ fontSize: 13 }}>
                          répondre à la demande
                        </Link>
                      )}
                      {c.statut === "reservee" && c.validee_le && (
                        <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                          {c.debut < maintenant && (
                            <form action={marquerEffectue}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="dossier" value={id} />
                              <input type="hidden" name="retour" value={`/admin/eleves/${id}`} />
                              <button type="submit" className="lien-bouton">
                                marquer donné
                              </button>
                            </form>
                          )}
                          <form action={annulerCours}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="dossier" value={id} />
                            <button type="submit" className="lien-bouton">
                              annuler
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h2 style={{ fontSize: 25, margin: "52px 0 10px" }}>Ses documents</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Déposés ici, ils apparaissent aussitôt dans l&apos;espace de l&apos;élève.
        </p>

        <div className="tableau-enveloppe" style={{ marginTop: 16 }}>
          {(documents ?? []).length === 0 ? (
            <p style={{ padding: 24, fontSize: 15, color: "var(--texte-doux)" }}>
              Aucun document pour cet élève.
            </p>
          ) : (
            <table className="liste">
              <tbody>
                {(documents ?? []).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.nom_fichier}</strong>
                      <br />
                      <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                        {new Date(d.cree_le).toLocaleDateString("fr-FR")} ·{" "}
                        {d.taille_octets > 1024 * 1024
                          ? `${(d.taille_octets / 1024 / 1024).toFixed(1)} Mo`
                          : `${Math.max(1, Math.round(d.taille_octets / 1024))} Ko`}
                        {d.depose_par === "pauline" ? "" : " · déposé par l'élève"}
                      </span>
                    </td>
                    <td className="droite">
                      <div className="actions-ligne">
                        <Link href={`/documents/${d.id}`} target="_blank">
                          ouvrir
                        </Link>
                        <form action={supprimerDocument}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="retour" value={`/admin/eleves/${id}`} />
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

        <div style={{ marginTop: 18 }}>
          <DepotDocument
            titre={`Déposer pour ${dossier.eleve_prenom ?? "cet élève"}`}
            dossierId={id}
          />
        </div>

        <h2 style={{ fontSize: 25, margin: "52px 0 10px" }}>Sa facturation</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Ce que le parent vous a demandé pour ses factures. Repris automatiquement sur
          chaque nouvelle facture, et modifiable ensuite au cas par cas sur le
          brouillon. Laissé vide, la facture reprend le nom du dossier.
        </p>

        <form action={enregistrerFacturation} className="carte" style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={id} />
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label htmlFor="facturation_nom" style={etiquette}>
                Facturer au nom de
              </label>
              <input
                id="facturation_nom"
                name="facturation_nom"
                type="text"
                defaultValue={dossier.facturation_nom ?? ""}
                placeholder={`${dossier.prenom ?? ""} ${dossier.nom ?? ""}`.trim()}
                style={saisie}
              />
            </div>
            <div>
              <label htmlFor="facturation_adresse" style={etiquette}>
                Adresse à faire figurer
              </label>
              <textarea
                id="facturation_adresse"
                name="facturation_adresse"
                rows={3}
                defaultValue={dossier.facturation_adresse ?? ""}
                placeholder={"12 rue des Lilas\n13007 Marseille"}
                style={{ ...saisie, minHeight: 0, padding: "11px 14px", resize: "vertical" }}
              />
            </div>
            <div>
              <label htmlFor="facturation_note" style={etiquette}>
                Mention à porter sur les factures
              </label>
              <textarea
                id="facturation_note"
                name="facturation_note"
                rows={2}
                defaultValue={dossier.facturation_note ?? ""}
                placeholder="Règlement en deux fois convenu, référence employeur…"
                style={{ ...saisie, minHeight: 0, padding: "11px 14px", resize: "vertical" }}
              />
            </div>
          </div>
          <button
            type="submit"
            className="bouton bouton--secondaire bouton--compact"
            style={{ marginTop: 16 }}
          >
            Enregistrer
          </button>
        </form>

        <details className="repli" style={{ marginTop: 44 }}>
          <summary>
            Historique du dossier
            <span className="repli__compte">{(evenements ?? []).length}</span>
          </summary>
          <div className="repli__corps">
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--texte-gris)",
                marginBottom: 16,
              }}
            >
              Tout ce qui a été fait sur ce dossier, du plus récent au plus ancien.
              Utile le jour où quelqu&apos;un conteste une annulation ou affirme
              n&apos;avoir rien reçu.
            </p>
            <Historique evenements={(evenements ?? []) as Evenement[]} />
          </div>
        </details>

        <h2 style={{ fontSize: 25, margin: "52px 0 16px" }}>Agir sur ce dossier</h2>

        <form action={basculerSuspension} className="carte">
          <p className="surtitre" style={{ marginBottom: 12 }}>
            {dossier.suspendu ? "Réactiver" : "Suspendre"}
          </p>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
            {dossier.suspendu
              ? "L'élève pourra de nouveau réserver."
              : "L'élève garde son espace et son historique, mais ne peut plus réserver. À utiliser pour un impayé, le temps d'une régularisation."}
          </p>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="suspendu" value={dossier.suspendu ? "1" : "0"} />
          {!dossier.suspendu && (
            <div style={{ marginTop: 14 }}>
              <label htmlFor="motif" style={etiquette}>
                Motif (visible de vous seule)
              </label>
              <input
                id="motif"
                name="motif"
                type="text"
                placeholder="Facture de septembre impayée"
                style={saisie}
              />
            </div>
          )}
          <button
            type="submit"
            className="bouton bouton--secondaire bouton--compact"
            style={{ marginTop: 16 }}
          >
            {dossier.suspendu ? "Réactiver le dossier" : "Suspendre le dossier"}
          </button>
        </form>

        <form
          action={supprimerDossier}
          className="carte"
          style={{ marginTop: 18, borderColor: "#dec89b", background: "#fdf8ee" }}
        >
          <p className="surtitre" style={{ marginBottom: 12 }}>
            Supprimer
          </p>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
            Le dossier et ses réservations disparaissent. Si des factures ont déjà été
            émises, le dossier est anonymisé au lieu d&apos;être effacé : les pièces
            comptables doivent être conservées dix ans, seule l&apos;identité est
            retirée.
          </p>
          <input type="hidden" name="id" value={id} />
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginTop: 16,
              fontSize: 14.5,
              color: "var(--texte-doux)",
            }}
          >
            <input type="checkbox" name="bloquer" value="1" style={{ marginTop: 3 }} />
            <span>
              Bloquer aussi cette adresse — elle ne pourra plus créer de dossier ni
              réserver.
            </span>
          </label>
          <div style={{ marginTop: 14 }}>
            <label htmlFor="motif_blocage" style={etiquette}>
              Motif du blocage (facultatif)
            </label>
            <input
              id="motif_blocage"
              name="motif"
              type="text"
              placeholder="Réservations fictives"
              style={saisie}
            />
          </div>
          <button
            type="submit"
            className="bouton bouton--secondaire bouton--compact"
            style={{ marginTop: 16 }}
          >
            Supprimer ce dossier
          </button>
        </form>
      </div>
    </section>
  );
}
