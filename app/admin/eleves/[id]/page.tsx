import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { blocLong, creneauLong, dureeCourte, regrouperReservations } from "@/lib/dates";
import { euros } from "@/lib/constantes";
import { etiquette, saisie } from "@/components/Champs";
import Historique, { type Evenement } from "@/components/Historique";
import { supprimerDocument } from "../../documents/actions";
import DepotDocument from "../../documents/DepotDocument";
import {
  archiverEleve,
  modifierPrixCours,
  arreterSerie,
  basculerSuspension,
  annulerCours,
  marquerEffectue,
  supprimerDossier,
  enregistrerFacturation,
} from "../actions";

const JOURS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

type Cours = {
  id: string;
  debut: string;
  fin: string;
  statut: string;
  validee_le: string | null;
  refus_motif: string | null;
  sujet: string | null;
  prix_cents: number;
  facture_id: string | null;
  annulation_demandee_le: string | null;
  annulation_decision: string | null;
  annulation_reponse: string | null;
  annulation_motif: string | null;
};

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
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { ok, erreur, posees, retirees } = await searchParams;
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
        "id, debut, fin, statut, validee_le, refus_motif, sujet, prix_cents, facture_id, annulation_demandee_le, annulation_decision, annulation_reponse, annulation_motif"
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

  // Les séries encore vivantes : celles qu'on peut prolonger ou
  // arrêter. Une série dont toutes les séances sont passées n'a plus
  // rien à arrêter, mais se prolonge très bien.
  const { data: series } = await supabase
    .from("series")
    .select("id, jour_semaine, heure, duree_min, prix_cents, arretee_le")
    .eq("dossier_id", id)
    .is("arretee_le", null)
    .order("cree_le", { ascending: false });

  const idsSeries = (series ?? []).map((x) => x.id);
  const { data: seancesDesSeries } = idsSeries.length
    ? await supabase
        .from("reservations")
        .select("serie_id, debut, statut")
        .in("serie_id", idsSeries)
    : { data: [] };

  const resume = new Map<string, { total: number; derniere: string | null }>();
  for (const r of (seancesDesSeries ?? []) as {
    serie_id: string;
    debut: string;
    statut: string;
  }[]) {
    const c = resume.get(r.serie_id) ?? { total: 0, derniere: null };
    c.total += 1;
    if (!c.derniere || r.debut > c.derniere) c.derniere = r.debut;
    resume.set(r.serie_id, c);
  }

  const horsLigne = !dossier.email;

  // « Ses cours » ne liste que des cours : ceux à venir, ceux qui
  // attendent d'être validés, ceux qui ont été donnés. Les annulations,
  // déplacements et réductions sont des événements du dossier, pas des
  // cours — l'historique en bas de page les raconte déjà, et les voir
  // deux fois ne les rendait pas plus clairs.
  const tous = (cours ?? []) as Cours[];
  const sesCours = tous.filter((c) =>
    ["reservee", "effectuee"].includes(c.statut)
  );

  // Une annulation tardive ou une absence se facture pourtant. Elles
  // sortent de la liste, mais pas de la vue : une ligne le rappelle
  // tant qu'elles ne sont pas sur une facture.
  const aFacturerHorsCours = tous.filter(
    (c) =>
      ["annulee_hors_delai", "absent"].includes(c.statut) && !c.facture_id
  );

  // Deux heures qui se suivent sont un seul cours. Même élève ici par
  // construction : il reste à ne pas fondre deux séances de nature
  // différente, ni l'une facturée avec l'autre qui ne l'est pas.
  const blocs = regrouperReservations(
    sesCours,
    (a, b) =>
      a.statut === b.statut &&
      !a.validee_le === !b.validee_le &&
      !a.facture_id === !b.facture_id &&
      a.sujet === b.sujet &&
      !a.annulation_demandee_le === !b.annulation_demandee_le
  ).reverse();

  const donnes = blocs.filter((b) => b.tete.statut === "effectuee").length;
  const aVenirEleve = blocs.filter(
    (b) =>
      b.tete.statut === "reservee" && b.tete.validee_le && b.tete.debut >= maintenant
  ).length;

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p style={{ fontSize: 13.5, marginBottom: 10 }}>
          <Link href="/admin/eleves">‹ Tous les élèves</Link>
        </p>

        <div className="admin__titre" style={{ marginBottom: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 38, lineHeight: 1.12 }}>
              {dossier.eleve_prenom ?? "Élève"}
              {dossier.eleve_classe ? (
                <span style={{ fontSize: 20, color: "var(--texte-gris)" }}>
                  {" "}
                  · {dossier.eleve_classe}
                </span>
              ) : null}
            </h1>

            <div className="periodes" style={{ marginTop: 11 }}>
              {dossier.tarif_horaire_cents !== null &&
                dossier.tarif_horaire_cents !== undefined && (
                  <span className="etiquette">
                    {euros(dossier.tarif_horaire_cents)} / h
                  </span>
                )}
              {dossier.archive_le ? (
                <span className="etiquette etiquette--attente">Archivé</span>
              ) : horsLigne ? (
                <span className="etiquette etiquette--attente">
                  Hors ligne — aucun accès au site
                </span>
              ) : dossier.user_id ? (
                <span className="etiquette">Accès actif</span>
              ) : (
                <span className="etiquette">Contact connu, sans accès</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link href={`/admin/eleves/${id}/cours`} className="action action--foret">
              Ajouter un cours
            </Link>
            <Link href={`/admin/eleves/${id}/serie`} className="action action--or">
              Créer une série
            </Link>
          </div>
        </div>

        <p style={{ marginTop: 16, fontSize: 15, color: "var(--texte-doux)" }}>
          {dossier.prenom || dossier.nom
            ? `Contact : ${[dossier.prenom, dossier.nom].filter(Boolean).join(" ")}`
            : "Aucun contact renseigné"}
          {dossier.email ? ` — ${dossier.email}` : ""}
          {dossier.telephone ? ` · ${dossier.telephone}` : ""}
        </p>

        {ok === "cree" && (
          <p className="succes">
            Fiche créée. Posez ses cours quand vous voulez : rien n&apos;a été
            envoyé à personne.
          </p>
        )}
        {ok === "cours" && <p className="succes">Le cours est posé.</p>}
        {ok === "prix" && (
          <p className="succes">
            Le tarif de cette séance est enregistré. L&apos;élève le voit dans son
            espace.
          </p>
        )}
        {erreur === "prix" && (
          <p className="alerte">
            Ce montant n&apos;est pas valide. Écrivez-le en euros : 39, ou 39,50.
          </p>
        )}
        {erreur === "deja_facture" && (
          <p className="alerte">
            Cette séance figure déjà sur une facture : son prix ne change plus ici.
            Une facture émise ne se modifie pas — corrigez-la depuis les factures,
            ou émettez une facture rectificative.
          </p>
        )}
        {ok === "serie" && (
          <p className="succes">
            {posees ?? "0"} séance{Number(posees ?? 0) > 1 ? "s" : ""} posée
            {Number(posees ?? 0) > 1 ? "s" : ""}.
          </p>
        )}
        {ok === "arretee" && (
          <p className="succes">
            Série arrêtée. {retirees ?? "0"} séance
            {Number(retirees ?? 0) > 1 ? "s" : ""} à venir retirée
            {Number(retirees ?? 0) > 1 ? "s" : ""} ; les cours passés restent.
          </p>
        )}
        {ok === "archive" && (
          <p className="succes">
            Fiche archivée. Elle sort des listes ; rien n&apos;est effacé.
          </p>
        )}
        {ok === "reprise" && <p className="succes">Fiche réactivée.</p>}
        {ok === "existant" && (
          <p className="alerte">
            Cette adresse email désignait déjà cet élève : voici sa fiche, plutôt
            qu&apos;une seconde qui aurait coupé son historique en deux.
          </p>
        )}
        {ok &&
          !["cree", "cours", "serie", "arretee", "archive", "reprise", "existant"].includes(
            ok
          ) && <p className="succes">C&apos;est fait.</p>}

        {dossier.suspendu && (
          <p className="alerte">
            <strong>Dossier suspendu.</strong>{" "}
            {dossier.motif_suspension ?? "Aucun motif indiqué."} Cet élève ne peut plus
            réserver.
          </p>
        )}

        <div className="chiffres" style={{ marginTop: 28, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="chiffre">
            <p className="chiffre__valeur">{donnes}</p>
            <p className="chiffre__libelle">
              cours donné{donnes > 1 ? "s" : ""}
            </p>
          </div>
          <div className="chiffre">
            <p className="chiffre__valeur">{aVenirEleve}</p>
            <p className="chiffre__libelle">à venir</p>
          </div>
          <div className="chiffre">
            <p className="chiffre__valeur">
              {dossier.email_confirme_le ? (dossier.user_id ? "Actif" : "Confirmé") : "—"}
            </p>
            <p className="chiffre__libelle">espace élève</p>
          </div>
        </div>

        {(series ?? []).length > 0 && (
          <div style={{ marginTop: 28, display: "grid", gap: 8 }}>
            {(series ?? []).map((serie) => {
              const c = resume.get(serie.id) ?? { total: 0, derniere: null };
              const nomJour = JOURS[serie.jour_semaine - 1] ?? "";
              return (
                <div key={serie.id} className="bandeau-serie">
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14.5, color: "var(--foret)" }}>
                      Série du {nomJour} · {String(serie.heure).slice(0, 5)} ·{" "}
                      {dureeCourte(serie.duree_min / 60)}
                    </p>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 13,
                        color: "var(--texte-gris)",
                      }}
                    >
                      {c.total} séance{c.total > 1 ? "s" : ""} posée
                      {c.total > 1 ? "s" : ""}
                      {c.derniere
                        ? `, la dernière le ${new Date(c.derniere).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Link
                      href={`/admin/eleves/${id}/serie?serie=${serie.id}`}
                      className="action action--or"
                    >
                      Prolonger
                    </Link>
                    <form action={arreterSerie}>
                      <input type="hidden" name="id" value={serie.id} />
                      <input type="hidden" name="dossier" value={id} />
                      <button type="submit" className="action action--contour">
                        Arrêter la série
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h2 style={{ fontSize: 25, margin: "44px 0 16px" }}>Ses cours</h2>
        <div className="tableau-enveloppe">
          {blocs.length === 0 ? (
            <p style={{ padding: 24, fontSize: 15, color: "var(--texte-doux)" }}>
              Aucun cours.
            </p>
          ) : (
            <table className="liste">
              <tbody>
                {blocs.map((bloc) => {
                  const c = bloc.tete;
                  const total = bloc.lignes.reduce((t, l) => t + l.prix_cents, 0);
                  return (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {bloc.heures > 1 ? blocLong(bloc) : creneauLong(c.debut)}
                      </strong>
                      {bloc.heures > 1 ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                            {dureeCourte(bloc.heures)} d&apos;affilée
                          </span>
                        </>
                      ) : null}
                      {c.sujet ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13.5, color: "var(--texte-gris)" }}>
                            {c.sujet}
                          </span>
                        </>
                      ) : null}
                      {/* Une demande encore en attente change ce que
                          Pauline doit faire de ce cours : elle reste.
                          Celles déjà tranchées sont de l'histoire, et
                          l'historique du dossier les raconte. */}
                      {c.annulation_demandee_le && !c.annulation_decision ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: "var(--or-texte)" }}>
                            Changement demandé, en attente de votre réponse
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
                      {/* L'élève voit ce montant dans son espace : il doit
                          pouvoir être corrigé ici, séance par séance. Une
                          fois sur une facture, il se fige — la facture
                          ferait foi contre lui. */}
                      {c.facture_id ? (
                        <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                          {euros(total)} · facturé
                        </span>
                      ) : (
                        <form action={modifierPrixCours} className="prix-vif">
                          <input type="hidden" name="id" value={bloc.ids.join(",")} />
                          <input type="hidden" name="dossier" value={id} />
                          <input
                            name="prix"
                            type="text"
                            inputMode="decimal"
                            defaultValue={(c.prix_cents / 100).toString()}
                            aria-label={`Tarif horaire du cours du ${creneauLong(c.debut)}`}
                            className="prix-vif__champ"
                          />
                          <span className="prix-vif__unite">€/h</span>
                          <button type="submit" className="prix-vif__ok">
                            OK
                          </button>
                          {bloc.heures > 1 && (
                            <span className="prix-vif__total">{euros(total)}</span>
                          )}
                        </form>
                      )}
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
                              <input type="hidden" name="id" value={bloc.ids.join(",")} />
                              <input type="hidden" name="dossier" value={id} />
                              <input type="hidden" name="retour" value={`/admin/eleves/${id}`} />
                              <button type="submit" className="lien-bouton">
                                marquer donné
                              </button>
                            </form>
                          )}
                          <form action={annulerCours}>
                            <input type="hidden" name="id" value={bloc.ids.join(",")} />
                            <input type="hidden" name="dossier" value={id} />
                            <button type="submit" className="lien-bouton">
                              annuler
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {aFacturerHorsCours.length > 0 && (
          <p style={{ marginTop: 12, fontSize: 13.5, color: "var(--texte-gris)" }}>
            {aFacturerHorsCours.length} annulation
            {aFacturerHorsCours.length > 1 ? "s tardives ou absences restent" : " tardive ou absence reste"}{" "}
            à facturer. Elles ne figurent pas dans la liste — ce ne sont pas des
            cours — mais elles comptent :{" "}
            <Link href="/admin/factures">les porter sur une facture</Link>.
          </p>
        )}


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

        <form action={archiverEleve} className="carte" style={{ marginBottom: 18 }}>
          <input type="hidden" name="id" value={id} />
          {dossier.archive_le && <input type="hidden" name="rendre" value="1" />}
          <p className="surtitre" style={{ marginBottom: 12 }}>
            {dossier.archive_le ? "Fiche archivée" : "Archiver"}
          </p>
          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.65,
              color: "var(--texte-doux)",
              marginBottom: 16,
            }}
          >
            {dossier.archive_le
              ? "Cette fiche est rangée avec les élèves archivés. La remettre en service la fait réapparaître dans les listes."
              : "Quand l'élève arrête les cours. Sa fiche sort des listes, mais rien ne s'efface : ses cours passés et ses factures restent, comme l'exige la conservation des pièces comptables."}
          </p>
          <button type="submit" className="action action--contour">
            {dossier.archive_le ? "Remettre en service" : "Archiver cette fiche"}
          </button>
        </form>

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

        {/* Supprimer ne se fait presque jamais : archiver répond au cas
            courant, et garde tout. Le geste reste accessible, mais il
            ne se présente plus de lui-même. */}
        <details className="repli-discret repli-discret--bloc" style={{ marginTop: 22 }}>
          <summary>Supprimer définitivement ce dossier</summary>
          <div className="repli-discret__corps repli-discret__corps--large">
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.65,
                color: "var(--texte-doux)",
                marginBottom: 18,
              }}
            >
              Vous cherchez sans doute <strong>Archiver</strong>, juste au-dessus :
              la fiche sort des listes et tout est conservé. La suppression ne sert
              que dans deux cas — un dossier créé par erreur, ou une demande
              d&apos;effacement de la part de la famille.
            </p>

            <form action={supprimerDossier}>
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: "var(--texte-doux)",
                }}
              >
                Le dossier et ses réservations disparaissent. Si des factures ont
                déjà été émises, le dossier est anonymisé au lieu d&apos;être
                effacé : les pièces comptables doivent être conservées dix ans,
                seule l&apos;identité est retirée.
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
        </details>
      </div>
    </section>
  );
}
