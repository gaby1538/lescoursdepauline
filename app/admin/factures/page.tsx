import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { euros } from "@/lib/constantes";
import { dureeCourte, moisLong } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import MoisPrecis from "./MoisPrecis";
import {
  genererFactures,
  envoyerFacture,
  transfererFacture,
  marquerRemise,
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
  remise_le: string | null;
  transferee_le: string | null;
  payee_le: string | null;
  emise_le: string | null;
  dossiers: {
    eleve_prenom: string | null;
    eleve_classe: string | null;
    prenom: string | null;
    nom: string | null;
    email: string;
  } | null;
};

const LIBELLE: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

/** « Envoyée » est devenu ambigu : le statut dit émise, les dates disent transmise. */
function etatFacture(f: Facture): string {
  if (f.statut === "brouillon") return "Brouillon";
  if (f.remise_le) return "Remise en main propre";
  if (f.transferee_le && !f.envoyee_le) return "Transférée";
  if (!f.envoyee_le && (f.statut === "envoyee" || f.statut === "en_retard")) {
    return "À envoyer";
  }
  return LIBELLE[f.statut] ?? f.statut;
}

/**
 * Le numéro qu'un brouillon prendra s'il est émis maintenant, et ceux
 * des suivants s'ils partent dans l'ordre où ils s'affichent. C'est une
 * prévision, pas une réservation : le numéro n'existe qu'à l'émission.
 */
function numeroPrevu(base: string | null, decalage: number): string | null {
  if (!base) return null;
  const m = base.match(/^(.*?)(\d+)$/);
  if (!m) return decalage === 0 ? base : null;
  return m[1] + String(Number(m[2]) + decalage).padStart(m[2].length, "0");
}

function nomDuDossier(d: Facture["dossiers"]): string {
  return `${d?.prenom ?? ""} ${d?.nom ?? ""}`.trim() || d?.email || "—";
}

export default async function Factures({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string; periode?: string }>;
}) {
  const { ok, erreur, periode } = await searchParams;
  const supabase = clientAdmin();

  // La période ne pilote que « À facturer » : c'est la seule section où
  // la question « quels cours ? » se pose. Brouillons, À envoyer et
  // historique restent entiers, sans quoi on croirait avoir perdu une
  // facture en changeant un filtre.
  const maintenantDate = new Date();
  const choix = periode ?? "mois";

  let depuis: Date;
  let libellePeriode: string;

  if (/^\d{4}-\d{2}$/.test(choix)) {
    depuis = new Date(`${choix}-01T00:00:00Z`);
    libellePeriode = moisLong(`${choix}-01`);
  } else if (choix === "trois") {
    depuis = new Date(maintenantDate);
    depuis.setUTCMonth(depuis.getUTCMonth() - 2, 1);
    libellePeriode = "les trois derniers mois";
  } else if (choix === "annee") {
    depuis = new Date(Date.UTC(maintenantDate.getUTCFullYear(), 0, 1));
    libellePeriode = `l'année ${maintenantDate.getUTCFullYear()}`;
  } else {
    depuis = new Date(
      Date.UTC(maintenantDate.getUTCFullYear(), maintenantDate.getUTCMonth(), 1)
    );
    libellePeriode = moisLong(depuis.toISOString().slice(0, 10));
  }

  const jusqua = /^\d{4}-\d{2}$/.test(choix)
    ? (() => {
        const f = new Date(depuis);
        f.setUTCMonth(f.getUTCMonth() + 1);
        return f;
      })()
    : (() => {
        const f = new Date(maintenantDate);
        f.setUTCDate(f.getUTCDate() + 1);
        return f;
      })();

  // Ce qui est validé mais encore sur aucune facture. C'est la réponse à
  // « j'ai validé le cours et je ne vois pas de facture » : la
  // préparation reste un geste volontaire, mais elle ne doit plus être
  // invisible.
  const { data: enAttente } = await supabase
    .from("reservations")
    .select(
      "id, debut, fin, prix_cents, dossier_id, dossiers (eleve_prenom, eleve_classe, prenom, nom)"
    )
    .is("facture_id", null)
    .in("statut", ["effectuee", "annulee_hors_delai", "absent"])
    .gte("debut", depuis.toISOString())
    .lt("debut", jusqua.toISOString())
    .order("debut");

  type EnAttente = {
    id: string;
    debut: string;
    fin: string;
    prix_cents: number | null;
    dossier_id: string;
    dossiers: {
      eleve_prenom: string | null;
      eleve_classe: string | null;
      prenom: string | null;
      nom: string | null;
    } | null;
  };

  // Un brouillon par élève : c'est ainsi que Pauline facture, et c'est
  // ainsi qu'elle s'y retrouve.
  const parEleve = new Map<
    string,
    { nom: string; detail: string; cours: number; heures: number; cents: number }
  >();

  for (const r of (enAttente ?? []) as unknown as EnAttente[]) {
    const d = r.dossiers;
    const c = parEleve.get(r.dossier_id) ?? {
      nom: d?.eleve_prenom ?? (`${d?.prenom ?? ""} ${d?.nom ?? ""}`.trim() || "—"),
      detail: d?.eleve_classe ?? "",
      cours: 0,
      heures: 0,
      cents: 0,
    };
    // Un cours de deux heures est une seule réservation : les deux
    // nombres ne se déduisent pas l'un de l'autre.
    c.cours += 1;
    c.heures += (Date.parse(r.fin) - Date.parse(r.debut)) / 3600000;
    c.cents += r.prix_cents ?? 0;
    parEleve.set(r.dossier_id, c);
  }

  const aFacturer = [...parEleve.entries()].sort((a, b) =>
    a[1].nom.localeCompare(b[1].nom, "fr")
  );

  const { data } = await supabase
    .from("factures")
    .select(
      "id, numero, statut, emise_le, periode_debut, total_cents, echeance_le, envoyee_le, remise_le, transferee_le, payee_le, dossiers (eleve_prenom, eleve_classe, prenom, nom, email)"
    )
    .order("cree_le", { ascending: false });

  const liste = (data ?? []) as unknown as Facture[];

  const brouillons = liste.filter((f) => f.statut === "brouillon");

  // Émises, numérotées, mais la famille ne les a pas. Elles comptent
  // déjà dans les recettes et le délai de paiement court : une facture
  // oubliée ici est pire qu'une facture jamais créée, parce que rien ne
  // la réclame.
  const aEnvoyer = liste.filter(
    (f) =>
      (f.statut === "envoyee" || f.statut === "en_retard") &&
      !f.envoyee_le &&
      !f.remise_le &&
      !f.transferee_le
  );

  // De quoi titrer les brouillons : le nombre d'heures pour une facture
  // issue de réservations, le libellé de la première ligne pour une
  // facture manuelle, qui n'a pas de mois de cours à mettre en avant.
  const idsBrouillons = brouillons.map((f) => f.id);

  const [{ data: coursDesBrouillons }, { data: premieresLignes }, { data: suggestion }] =
    idsBrouillons.length > 0
      ? await Promise.all([
          supabase
            .from("reservations")
            .select("facture_id, debut, fin")
            .in("facture_id", idsBrouillons),
          supabase
            .from("lignes_facture")
            .select("facture_id, description, ordre")
            .in("facture_id", idsBrouillons)
            .order("ordre"),
          supabase.rpc("numero_suggere"),
        ])
      : [{ data: [] }, { data: [] }, { data: null }];

  const heuresParFacture = new Map<string, number>();
  for (const r of (coursDesBrouillons ?? []) as {
    facture_id: string;
    debut: string;
    fin: string;
  }[]) {
    const h = (Date.parse(r.fin) - Date.parse(r.debut)) / 3600000;
    heuresParFacture.set(r.facture_id, (heuresParFacture.get(r.facture_id) ?? 0) + h);
  }

  const libelleParFacture = new Map<string, string>();
  for (const l of (premieresLignes ?? []) as {
    facture_id: string;
    description: string | null;
  }[]) {
    if (!libelleParFacture.has(l.facture_id) && l.description) {
      libelleParFacture.set(l.facture_id, l.description);
    }
  }

  const jours = (quand: string | null) => {
    if (!quand) return 0;
    return Math.floor((Date.now() - Date.parse(quand)) / 86400000);
  };

  const anneeCourante = new Date().getFullYear();
  const annees = [anneeCourante, anneeCourante - 1, anneeCourante - 2];

  // Les douze derniers mois, pour revenir en arrière sans taper de date.
  const moisRecents = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(
      Date.UTC(maintenantDate.getUTCFullYear(), maintenantDate.getUTCMonth() - i, 1)
    );
    const valeur = d.toISOString().slice(0, 7);
    return { valeur, nom: moisLong(`${valeur}-01`) };
  });

  const nomDuMois = moisRecents[0].nom;

  return (
    <section className="section">
      <div className="conteneur">
        <div className="admin__titre">
          <div>
            <p className="surtitre">Administration</p>
            <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Factures</h1>
          </div>
          <Link href="/admin/factures/nouvelle" className="action action--foret">
            Nouvelle facture
          </Link>
        </div>

        {erreur === "envoi" && (
          <p className="alerte">
            La facture est émise et numérotée, mais l&apos;email n&apos;est pas parti.
            Vérifiez les journaux, puis renvoyez-la depuis sa page.
          </p>
        )}
        {erreur === "sans_contact" && (
          <p className="alerte">
            Aucune adresse de contact n&apos;est renseignée dans les réglages : le
            site ne sait pas à qui vous envoyer la facture.
          </p>
        )}
        {erreur === "mois" && <p className="alerte">Choisissez un mois valide.</p>}
        {erreur === "vide" && (
          <p className="alerte">Une facture sans ligne ne peut pas être émise.</p>
        )}
        {erreur === "emise" && (
          <p className="alerte">Cette facture est déjà émise : elle ne se modifie plus.</p>
        )}
        {erreur === "doublon" && (
          <p className="alerte">Ce numéro est déjà porté par une autre facture.</p>
        )}
        {erreur === "numero" && (
          <p className="alerte">L&apos;émission a échoué. Réessayez dans un instant.</p>
        )}
        {erreur === "deja_transmise" && (
          <p className="alerte">
            Cette facture a déjà été transmise. Rechargez la page.
          </p>
        )}
        {erreur === "introuvable" && <p className="alerte">Facture introuvable.</p>}

        {ok === "emise" && (
          <p className="succes">
            Facture émise et numérotée. Elle vous attend dans « À envoyer ».
          </p>
        )}
        {ok === "envoyee" && (
          <p className="succes">
            Facture envoyée, avec le PDF en pièce jointe. Vous en avez reçu une copie.
          </p>
        )}
        {ok === "transferee" && (
          <p className="succes">
            Le message est dans votre boîte, prêt à être transféré à la famille.
          </p>
        )}
        {ok === "remise" && (
          <p className="succes">
            Notée comme remise en main propre. Aucun email n&apos;est parti.
          </p>
        )}
        {ok === "rien" && (
          <p className="succes">
            Aucun cours à facturer sur cette période : tout est déjà sur une facture.
          </p>
        )}
        {ok && !["emise", "envoyee", "transferee", "remise", "rien"].includes(ok) && (
          <p className="succes">C&apos;est fait.</p>
        )}

        <h2 style={{ fontSize: 25, margin: "46px 0 6px" }}>À facturer</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Les cours donnés qui n&apos;ont pas encore de facture. Un clic prépare le
          brouillon et l&apos;ouvre.
        </p>

        <div className="periodes">
          {[
            ["mois", nomDuMois.charAt(0).toUpperCase() + nomDuMois.slice(1)],
            ["trois", "3 derniers mois"],
            ["annee", `Année ${maintenantDate.getUTCFullYear()}`],
          ].map(([cle, nom]) => (
            <Link
              key={cle}
              href={`/admin/factures?periode=${cle}`}
              className={choix === cle ? "periode periode--actif" : "periode"}
            >
              {nom}
            </Link>
          ))}
          <MoisPrecis
            mois={moisRecents}
            actif={/^\d{4}-\d{2}$/.test(choix) ? choix : ""}
          />
        </div>

        {aFacturer.length === 0 ? (
          <p
            className="carte"
            style={{ fontSize: 15, color: "var(--texte-doux)", margin: "16px 0 34px" }}
          >
            Rien à facturer sur {libellePeriode}. Les cours doivent d&apos;abord être
            validés depuis le tableau de bord.
          </p>
        ) : (
          <div className="liste-factures">
            {aFacturer.map(([dossierId, c]) => (
              <form
                key={dossierId}
                action={genererFactures}
                className="carte-facture"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <input type="hidden" name="dossier" value={dossierId} />
                <input
                  type="hidden"
                  name="depuis"
                  value={depuis.toISOString().slice(0, 10)}
                />
                <input
                  type="hidden"
                  name="jusqua"
                  value={jusqua.toISOString().slice(0, 10)}
                />

                <div style={{ minWidth: 0 }}>
                  <p className="carte-facture__nom" style={{ fontSize: 21 }}>
                    {c.nom}
                  </p>
                  <p className="carte-facture__detail">
                    {c.detail ? `${c.detail} · ` : ""}
                    {c.cours} cours · {dureeCourte(c.heures)}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <p className="carte-facture__montant" style={{ fontSize: 25 }}>
                    {euros(c.cents)}
                  </p>
                  <button type="submit" className="action action--foret">
                    Préparer
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}

        {brouillons.length > 0 && (
          <>
            <h2 style={{ fontSize: 25, margin: "46px 0 6px" }}>
              Brouillons
              <span className="pastille-compte">{brouillons.length}</span>
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--texte-doux)" }}>
              Commencés, pas encore émis. Ni numéro ni date tant qu&apos;ils ne le
              sont pas.
            </p>

            <div className="liste-factures">
              {brouillons.map((f, i) => {
                const heures = heuresParFacture.get(f.id) ?? 0;
                const manuelle = heures === 0;
                const titre = manuelle
                  ? libelleParFacture.get(f.id) || "Facture manuelle"
                  : f.dossiers?.eleve_prenom || nomDuDossier(f.dossiers);
                const detail = manuelle
                  ? `${nomDuDossier(f.dossiers)} · hors réservation · facture manuelle`
                  : [f.dossiers?.eleve_classe, moisLong(f.periode_debut), dureeCourte(heures)]
                      .filter(Boolean)
                      .join(" · ");
                const prevu = numeroPrevu(suggestion as string | null, i);

                return (
                  <div key={f.id} className="carte-facture carte-facture--brouillon">
                    <div className="carte-facture__tete">
                      <div style={{ minWidth: 0 }}>
                        <p className="carte-facture__nom">{titre}</p>
                        <p className="carte-facture__detail">{detail}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p className="carte-facture__montant">{euros(f.total_cents)}</p>
                        {prevu && (
                          <p className="carte-facture__numero">sera numérotée {prevu}</p>
                        )}
                      </div>
                    </div>

                    <div className="carte-facture__actions">
                      <Link
                        href={`/admin/factures/${f.id}/modifier`}
                        className="action action--contour"
                      >
                        Modifier
                      </Link>
                      <Link
                        href={`/admin/factures/${f.id}/apercu`}
                        className="action action--contour"
                      >
                        Visualiser
                      </Link>
                      <Link
                        href={`/admin/factures/${f.id}/apercu?emettre=1`}
                        className="action action--or"
                      >
                        Émettre
                      </Link>
                      <form action={supprimerBrouillon} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="id" value={f.id} />
                        <button type="submit" className="action action--discret">
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {aEnvoyer.length > 0 && (
          <>
            <h2 style={{ fontSize: 25, margin: "46px 0 6px" }}>
              À envoyer
              <span className="pastille-compte pastille-compte--foret">
                {aEnvoyer.length}
              </span>
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--texte-doux)" }}>
              Numérotées et définitives, mais la famille ne les a pas encore reçues.
              Elles comptent déjà dans le livre des recettes, et le délai de paiement
              court.
            </p>

            <div className="liste-factures">
              {aEnvoyer.map((f) => {
                const age = jours(f.emise_le);
                const tarde = age >= 3;
                return (
                  <div
                    key={f.id}
                    className={
                      tarde
                        ? "carte-facture carte-facture--tarde"
                        : "carte-facture carte-facture--envoyer"
                    }
                  >
                    <div className="carte-facture__tete">
                      <div style={{ minWidth: 0 }}>
                        <p className="carte-facture__nom">
                          {f.dossiers?.eleve_prenom || nomDuDossier(f.dossiers)}
                        </p>
                        <p
                          className={
                            tarde
                              ? "carte-facture__detail carte-facture__detail--alerte"
                              : "carte-facture__detail"
                          }
                        >
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {f.numero}
                          </span>{" "}
                          · {moisLong(f.periode_debut)} ·{" "}
                          {age === 0
                            ? "émise aujourd'hui"
                            : `émise il y a ${age} jour${age > 1 ? "s" : ""}${
                                tarde ? ", jamais envoyée" : ""
                              }`}
                        </p>
                      </div>
                      <p className="carte-facture__montant">{euros(f.total_cents)}</p>
                    </div>

                    <div className="carte-facture__actions">
                      <form action={envoyerFacture}>
                        <input type="hidden" name="id" value={f.id} />
                        <button type="submit" className="action action--foret">
                          Envoyer par email
                        </button>
                      </form>
                      <Link
                        href={`/admin/factures/${f.id}/apercu`}
                        className="action action--contour"
                      >
                        Visualiser
                      </Link>
                      <a
                        href={`/admin/factures/${f.id}/pdf`}
                        className="action action--contour"
                      >
                        Télécharger
                      </a>

                      {/* Les deux façons de se passer de l'envoi du site
                          restent au bord droit, en petit : ce sont des
                          sorties de secours, pas le geste courant. */}
                      <form action={transfererFacture} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="id" value={f.id} />
                        <button type="submit" className="action action--discret">
                          Me l&apos;envoyer, je transfère
                        </button>
                      </form>
                      <form action={marquerRemise}>
                        <input type="hidden" name="id" value={f.id} />
                        <button type="submit" className="action action--discret">
                          Remise en main propre
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 style={{ fontSize: 25, margin: "46px 0 6px" }}>Historique</h2>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Toutes les factures, depuis le début, quelle que soit la période choisie
          plus haut. C&apos;est le livre des recettes.
        </p>

        <div className="tableau-enveloppe tableau-defilant" style={{ marginTop: 14 }}>
          <table className="liste">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Élève</th>
                <th>Période</th>
                <th className="droite">Montant</th>
                <th className="droite">État</th>
                <th className="droite">Règlement</th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "var(--texte-gris)" }}>
                    Aucune facture pour l&apos;instant.
                  </td>
                </tr>
              )}
              {liste.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    <Link href={`/admin/factures/${f.id}/apercu`}>{f.numero ?? "—"}</Link>
                  </td>
                  <td>{f.dossiers?.eleve_prenom || nomDuDossier(f.dossiers)}</td>
                  <td style={{ color: "var(--texte-gris)" }}>
                    {moisLong(f.periode_debut)}
                  </td>
                  <td className="droite" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {euros(f.total_cents)}
                  </td>
                  <td className="droite">
                    <span
                      className={
                        etatFacture(f) === "À envoyer" || etatFacture(f) === "En retard"
                          ? "etiquette etiquette--attente"
                          : "etiquette"
                      }
                    >
                      {etatFacture(f)}
                    </span>
                  </td>
                  <td className="droite">
                    {f.payee_le ? (
                      new Date(f.payee_le).toLocaleDateString("fr-FR")
                    ) : f.statut === "brouillon" ? (
                      <span style={{ color: "var(--texte-gris)" }}>—</span>
                    ) : (
                      <form action={marquerPayee} className="reglement">
                        <input type="hidden" name="id" value={f.id} />
                        <select
                          name="mode"
                          defaultValue="virement"
                          className="champ-ligne"
                          aria-label="Mode de règlement"
                        >
                          <option value="virement">Virement</option>
                          <option value="wero">Wero</option>
                          <option value="especes">Espèces</option>
                          <option value="cheque">Chèque</option>
                          <option value="autre">Autre</option>
                        </select>
                        <button type="submit" className="action action--contour">
                          Réglée
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Le livre des recettes hors du site : rarement, une fois l'an. */}
        <details className="repli-discret" style={{ marginTop: 40 }}>
          <summary>Exporter le livre des recettes d&apos;une année</summary>
          <div className="repli-discret__corps">
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--texte-gris)",
                marginBottom: 16,
              }}
            >
              Toutes les factures émises d&apos;une année, avec leur date
              d&apos;encaissement et leur mode de règlement, dans un fichier qui
              s&apos;ouvre dans un tableur. À conserver hors du site : les pièces
              comptables se gardent dix ans, ce qu&apos;aucune base de données en
              service gratuit ne garantit.
            </p>
            <form
              method="get"
              action="/admin/factures/export"
              className="rangee-formulaire"
            >
              <div>
                <label htmlFor="annee" style={etiquette}>
                  Année
                </label>
                <select
                  id="annee"
                  name="annee"
                  defaultValue={String(anneeCourante)}
                  style={{ ...saisie, padding: "0 12px" }}
                >
                  {annees.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="bouton bouton--secondaire bouton--compact">
                Télécharger
              </button>
            </form>
          </div>
        </details>
      </div>
    </section>
  );
}
