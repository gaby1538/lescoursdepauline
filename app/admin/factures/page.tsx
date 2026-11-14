import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { euros } from "@/lib/constantes";
import { moisLong, jourDuCreneau } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import {
  genererFactures,
  creerFactureManuelle,
  emettre,
  envoyerFacture,
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
  payee_le: string | null;
  emise_le: string | null;
  dossiers: { eleve_prenom: string | null; prenom: string | null; email: string } | null;
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
  if (!f.envoyee_le && (f.statut === "envoyee" || f.statut === "en_retard")) {
    return "À envoyer";
  }
  return LIBELLE[f.statut] ?? f.statut;
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
      "id, debut, prix_cents, dossier_id, dossiers (eleve_prenom, eleve_classe, prenom, nom)"
    )
    .is("facture_id", null)
    .in("statut", ["effectuee", "annulee_hors_delai", "absent"])
    .gte("debut", depuis.toISOString())
    .lt("debut", jusqua.toISOString())
    .order("debut");

  type EnAttente = {
    id: string;
    debut: string;
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
    { nom: string; detail: string; heures: number; cents: number }
  >();

  for (const r of ((enAttente ?? []) as unknown as EnAttente[])) {
    const d = r.dossiers;
    const c = parEleve.get(r.dossier_id) ?? {
      nom:
        d?.eleve_prenom ?? (`${d?.prenom ?? ""} ${d?.nom ?? ""}`.trim() || "—"),
      detail: d?.eleve_classe ?? "",
      heures: 0,
      cents: 0,
    };
    c.heures += 1;
    c.cents += r.prix_cents ?? 0;
    parEleve.set(r.dossier_id, c);
  }

  const aFacturer = [...parEleve.entries()].sort((a, b) =>
    a[1].nom.localeCompare(b[1].nom, "fr")
  );

  const { data: clients } = await supabase
    .from("dossiers")
    .select("id, prenom, nom, email, eleve_prenom")
    .eq("anonymise", false)
    .order("nom", { nullsFirst: false })
    .limit(500);

  const { data } = await supabase
    .from("factures")
    .select(
      "id, numero, statut, emise_le, periode_debut, total_cents, echeance_le, envoyee_le, remise_le, payee_le, dossiers (eleve_prenom, prenom, email)"
    )
    .order("cree_le", { ascending: false });

  const liste = (data ?? []) as unknown as Facture[];

  // Émises, numérotées, mais la famille ne les a pas. Elles comptent
  // déjà dans les recettes et le délai de paiement court : une facture
  // oubliée ici est pire qu'une facture jamais créée, parce que rien ne
  // la réclame.
  const brouillons = liste.filter((f) => f.statut === "brouillon");

  const aEnvoyer = liste.filter(
    (f) =>
      (f.statut === "envoyee" || f.statut === "en_retard") &&
      !f.envoyee_le &&
      !f.remise_le
  );

  const jours = (depuis: string | null) => {
    if (!depuis) return 0;
    return Math.floor((Date.now() - Date.parse(depuis)) / 86400000);
  };

  // Le mois le plus utile est celui qui attend quelque chose ; à défaut,
  // le mois en cours. Proposer le mois précédent par défaut faisait
  // préparer des factures vides.
  const anneeCourante = new Date().getFullYear();
  const annees = [anneeCourante, anneeCourante - 1, anneeCourante - 2];


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
        {erreur === "client" && (
          <p className="alerte">
            Choisissez un client existant, ou donnez au moins une adresse email
            valide pour en créer un.
          </p>
        )}
        {erreur === "creation" && (
          <p className="alerte">La facture n&apos;a pas pu être créée. Réessayez.</p>
        )}
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
        {ok === "remise" && (
          <p className="succes">
            Notée comme remise en main propre. Aucun email n&apos;est parti.
          </p>
        )}
        {erreur === "deja_transmise" && (
          <p className="alerte">
            Cette facture a déjà été transmise. Rechargez la page.
          </p>
        )}
        {erreur === "introuvable" && (
          <p className="alerte">Facture introuvable.</p>
        )}
        {ok === "rien" && (
          <p className="succes">
            Aucun cours à facturer sur ce mois : tout est déjà sur une facture.
          </p>
        )}
        {ok && ok !== "rien" && <p className="succes">C&apos;est fait.</p>}

        <h2 style={{ fontSize: 25, margin: "40px 0 6px" }}>À facturer</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Les cours donnés qui ne figurent sur aucune facture. Un clic prépare le
          brouillon et l&apos;ouvre. Rien n&apos;est envoyé à la préparation.
        </p>

        <div className="periodes">
          {[
            ["mois", "Ce mois-ci"],
            ["trois", "3 derniers mois"],
            ["annee", `Année ${new Date().getUTCFullYear()}`],
          ].map(([cle, nom]) => (
            <Link
              key={cle}
              href={`/admin/factures?periode=${cle}`}
              className={choix === cle ? "periode periode--actif" : "periode"}
            >
              {nom}
            </Link>
          ))}
          <form method="get" className="periodes__mois">
            <label htmlFor="periode" style={{ fontSize: 13, color: "var(--texte-gris)" }}>
              ou un mois précis
            </label>
            <input
              id="periode"
              name="periode"
              type="month"
              defaultValue={/^\d{4}-\d{2}$/.test(choix) ? choix : ""}
              style={{ ...saisie, width: 170, padding: "8px 12px" }}
            />
            <button type="submit" className="bouton bouton--secondaire bouton--compact">
              Voir
            </button>
          </form>
        </div>

        {aFacturer.length === 0 ? (
          <p
            className="carte"
            style={{ fontSize: 15, color: "var(--texte-doux)", marginBottom: 34 }}
          >
            Rien à facturer sur {libellePeriode}. Les cours doivent d&apos;abord être
            validés depuis le tableau de bord.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10, margin: "16px 0 34px" }}>
            {aFacturer.map(([dossierId, c]) => (
              <form
                key={dossierId}
                action={genererFactures}
                className="carte"
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
                  <p style={{ fontFamily: "var(--serif)", fontSize: 21, color: "var(--foret)" }}>
                    {c.nom}
                  </p>
                  <p style={{ marginTop: 4, fontSize: 13.5, color: "var(--texte-gris)" }}>
                    {c.detail ? `${c.detail} · ` : ""}
                    {c.heures} h · {libellePeriode}
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                  <p
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 25,
                      color: "var(--foret)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {euros(c.cents)}
                  </p>
                  <button type="submit" className="bouton bouton--principal bouton--compact">
                    Préparer
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}

        <details className="repli-discret repli-discret--bloc">
          <summary>Créer une facture manuelle</summary>
          <div className="repli-discret__corps repli-discret__corps--large">
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.65,
                color: "var(--texte-doux)",
                marginBottom: 18,
              }}
            >
              Une facture partie de rien, sans passer par une réservation : un
              stage, un forfait, une prestation réglée autrement. Elle naît vide,
              vous y ajoutez les lignes que vous voulez sur l&apos;écran suivant.
            </p>

            <form action={creerFactureManuelle}>
              <label htmlFor="dossier_id" style={etiquette}>
                Pour un client déjà connu
              </label>
              <select id="dossier_id" name="dossier_id" style={saisie} defaultValue="">
                <option value="">— choisir —</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.prenom, c.nom].filter(Boolean).join(" ") || c.email}
                    {c.eleve_prenom ? ` · ${c.eleve_prenom}` : ""}
                  </option>
                ))}
              </select>
              <p
                style={{ marginTop: 8, fontSize: 13, color: "var(--texte-gris)" }}
              >
                Son nom de facturation et son adresse sont repris automatiquement.
              </p>
              <button
                type="submit"
                className="bouton bouton--principal bouton--compact"
                style={{ marginTop: 14 }}
              >
                Créer la facture
              </button>
            </form>

            <details className="repli-discret" style={{ marginTop: 26 }}>
              <summary>Pour un nouveau client</summary>
              <div className="repli-discret__corps">
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "var(--texte-gris)",
                    marginBottom: 16,
                  }}
                >
                  Il est enregistré en même temps que la facture et vous le
                  retrouverez dans la liste ci-dessus la prochaine fois. Si
                  l&apos;adresse email correspond à un client existant, c&apos;est
                  ce dossier qui est utilisé plutôt qu&apos;un second.
                </p>

                <form action={creerFactureManuelle}>
                  <div className="duo">
                    <div>
                      <label htmlFor="prenom" style={etiquette}>Prénom</label>
                      <input id="prenom" name="prenom" type="text" style={saisie} />
                    </div>
                    <div>
                      <label htmlFor="nom" style={etiquette}>Nom</label>
                      <input id="nom" name="nom" type="text" style={saisie} />
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label htmlFor="email" style={etiquette}>
                      Adresse email <span style={{ color: "var(--or-texte)" }}>*</span>
                    </label>
                    <input id="email" name="email" type="email" required style={saisie} />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label htmlFor="facturation_nom" style={etiquette}>
                      Nom sur la facture, s&apos;il diffère
                    </label>
                    <input
                      id="facturation_nom"
                      name="facturation_nom"
                      type="text"
                      placeholder="Société Dupont, ou Madame Claire Dubois"
                      style={saisie}
                    />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label htmlFor="facturation_adresse" style={etiquette}>
                      Adresse de facturation
                    </label>
                    <textarea
                      id="facturation_adresse"
                      name="facturation_adresse"
                      rows={3}
                      placeholder={"12 rue des Lilas\n13006 Marseille"}
                      style={{ ...saisie, resize: "vertical" }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="bouton bouton--secondaire bouton--compact"
                    style={{ marginTop: 18 }}
                  >
                    Créer le client et sa facture
                  </button>
                </form>
              </div>
            </details>
          </div>
        </details>

        <form
          method="get"
          action="/admin/factures/export"
          className="carte"
          style={{ marginBottom: 24 }}
        >
          <p className="surtitre" style={{ marginBottom: 12 }}>
            Livre des recettes
          </p>
          <p
            style={{
              fontSize: 14.5,
              lineHeight: 1.65,
              color: "var(--texte-doux)",
              marginBottom: 16,
            }}
          >
            Toutes les factures émises d&apos;une année, avec leur date
            d&apos;encaissement et leur mode de règlement, dans un fichier qui
            s&apos;ouvre dans un tableur. À conserver hors du site : les pièces
            comptables se gardent dix ans, ce qu&apos;aucune base de données en
            service gratuit ne garantit.
          </p>
          <div className="rangee-formulaire">
            <div>
              <label htmlFor="annee" style={etiquette}>
                Année
              </label>
              <select
                id="annee"
                name="annee"
                defaultValue={String(new Date().getFullYear())}
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
          </div>
        </form>

        {brouillons.length > 0 && (
          <>
            <h2 style={{ fontSize: 25, margin: "46px 0 6px" }}>
              Brouillons
              <span className="pastille-compte">{brouillons.length}</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
              Commencés, pas encore émis. Ni numéro ni date tant qu&apos;ils ne le
              sont pas : la numérotation doit rester continue, et un brouillon
              abandonné laisserait un trou dans la série.
            </p>

            <div style={{ display: "grid", gap: 10, margin: "16px 0 34px" }}>
              {brouillons.map((f) => (
                <div
                  key={f.id}
                  className="carte"
                  style={{ boxShadow: "inset 3px 0 0 var(--or-clair)" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 16,
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--serif)", fontSize: 21, color: "var(--foret)" }}>
                        {f.dossiers?.eleve_prenom ?? f.dossiers?.prenom ?? "—"}
                      </p>
                      <p style={{ marginTop: 5, fontSize: 13.5, color: "var(--texte-gris)" }}>
                        {moisLong(f.periode_debut)} · {f.dossiers?.email}
                      </p>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 25,
                        color: "var(--foret)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {euros(f.total_cents)}
                    </p>
                  </div>

                  <div
                    className="actions-ligne"
                    style={{ justifyContent: "flex-start", marginTop: 14 }}
                  >
                    <Link
                      href={`/admin/factures/${f.id}/modifier`}
                      className="bouton bouton--principal bouton--compact"
                    >
                      Modifier
                    </Link>
                    <Link
                      href={`/factures/${f.id}`}
                      target="_blank"
                      className="bouton bouton--secondaire bouton--compact"
                    >
                      Visualiser
                    </Link>
                    <form action={supprimerBrouillon} style={{ marginLeft: "auto" }}>
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className="lien-bouton">
                        supprimer
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {aEnvoyer.length > 0 && (
          <>
            <h2 style={{ fontSize: 25, margin: "46px 0 6px" }}>
              À envoyer
              <span className="pastille-compte">{aEnvoyer.length}</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
              Numérotées et définitives, mais la famille ne les a pas encore reçues.
              Elles comptent déjà dans le livre des recettes, et le délai de paiement
              court depuis leur émission.
            </p>

            <div style={{ display: "grid", gap: 10, margin: "16px 0 34px" }}>
              {aEnvoyer.map((f) => {
                const age = jours(f.emise_le);
                const tarde = age >= 3;
                return (
                  <div
                    key={f.id}
                    className={tarde ? "carte carte--attente" : "carte"}
                    style={tarde ? undefined : { boxShadow: "inset 3px 0 0 var(--foret)" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: "var(--serif)", fontSize: 21, color: "var(--foret)" }}>
                          {f.dossiers?.eleve_prenom ?? f.dossiers?.prenom ?? "—"}
                        </p>
                        <p
                          style={{
                            marginTop: 5,
                            fontSize: 13.5,
                            color: tarde ? "var(--or-texte)" : "var(--texte-gris)",
                            fontWeight: tarde ? 600 : 400,
                          }}
                        >
                          {f.numero} · {moisLong(f.periode_debut)} ·{" "}
                          {age === 0
                            ? "émise aujourd'hui"
                            : `émise il y a ${age} jour${age > 1 ? "s" : ""}${
                                tarde ? ", jamais envoyée" : ""
                              }`}
                        </p>
                      </div>
                      <p
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: 25,
                          color: "var(--foret)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {euros(f.total_cents)}
                      </p>
                    </div>

                    <form action={envoyerFacture} style={{ marginTop: 14 }}>
                      <input type="hidden" name="id" value={f.id} />
                      <label htmlFor={`msg-${f.id}`} style={etiquette}>
                        Un mot dans l&apos;email (facultatif)
                      </label>
                      <input
                        id={`msg-${f.id}`}
                        name="message"
                        type="text"
                        maxLength={1000}
                        placeholder="Merci pour ce trimestre."
                        style={saisie}
                      />
                      <div className="actions-ligne" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                        <button type="submit" className="bouton bouton--principal bouton--compact">
                          Envoyer par email
                        </button>
                        <Link
                          href={`/factures/${f.id}`}
                          target="_blank"
                          className="bouton bouton--secondaire bouton--compact"
                        >
                          Visualiser
                        </Link>
                        <a
                          href={`/admin/factures/${f.id}/pdf`}
                          className="bouton bouton--secondaire bouton--compact"
                        >
                          Télécharger
                        </a>
                      </div>
                    </form>

                    <form action={marquerRemise} style={{ marginTop: 10 }}>
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className="lien-bouton">
                        remise en main propre, ne rien envoyer
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 style={{ fontSize: 25, margin: "46px 0 14px" }}>Historique</h2>

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
                      <span
                        className={
                          etatFacture(f) === "À envoyer"
                            ? "etiquette etiquette--attente"
                            : "etiquette"
                        }
                      >
                        {etatFacture(f)}
                      </span>
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
                        <a
                          href={`/admin/factures/${f.id}/docx`}
                          style={{ fontSize: 12.5, color: "var(--texte-gris)" }}
                        >
                          version Word
                        </a>
                        {f.statut === "brouillon" && (
                          <>
                            <Link href={`/admin/factures/${f.id}/modifier`}>
                              modifier
                            </Link>
                            <form action={emettre.bind(null, "envoyer")}>
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
                          <details className="annulation" style={{ textAlign: "right" }}>
                            <summary>marquer payée</summary>
                            <form action={marquerPayee} className="annulation__corps">
                              <input type="hidden" name="id" value={f.id} />
                              <label htmlFor={`d-${f.id}`} className="annulation__etiquette">
                                Date d&apos;encaissement
                              </label>
                              <input
                                id={`d-${f.id}`}
                                name="payee_le"
                                type="date"
                                defaultValue={new Date().toISOString().slice(0, 10)}
                                style={saisie}
                              />
                              <label
                                htmlFor={`m-${f.id}`}
                                className="annulation__etiquette"
                                style={{ marginTop: 12 }}
                              >
                                Mode de règlement
                              </label>
                              <select
                                id={`m-${f.id}`}
                                name="mode"
                                defaultValue="virement"
                                style={{ ...saisie, padding: "0 12px" }}
                              >
                                <option value="virement">Virement</option>
                                <option value="wero">Wero</option>
                                <option value="cheque">Chèque</option>
                                <option value="especes">Espèces</option>
                                <option value="autre">Autre</option>
                              </select>
                              <button
                                type="submit"
                                className="bouton bouton--secondaire bouton--compact"
                                style={{ marginTop: 12 }}
                              >
                                Enregistrer l&apos;encaissement
                              </button>
                            </form>
                          </details>
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
