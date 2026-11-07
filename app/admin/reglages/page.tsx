import { headers } from "next/headers";
import { clientAdmin } from "@/lib/supabase";
import { etiquette, saisie } from "@/components/Champs";
import { euros, GROUPES } from "@/lib/constantes";
import { jourLong } from "@/lib/dates";
import {
  enregistrerReglages,
  enregistrerTarif,
  envoyerSauvegardeMaintenant,
  regenererAgenda,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function Reglages({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { ok, erreur } = await searchParams;
  const supabase = clientAdmin();

  const [{ data: p }, { data: tarifs }] = await Promise.all([
    supabase.from("parametres").select("*").eq("id", true).maybeSingle(),
    supabase
      .from("tarifs")
      .select("groupe, type, prix_cents")
      .is("valide_au", null),
  ]);

  if (!p) {
    return (
      <section className="section">
        <div className="conteneur-etroit">
          <p className="alerte">
            La table des paramètres est vide. Exécutez les migrations avant d&apos;aller
            plus loin.
          </p>
        </div>
      </section>
    );
  }

  // L'adresse se construit à partir de celle qu'on visite, et non d'une
  // variable : tant que le domaine n'est pas branché, une adresse en
  // .com serait affichée alors qu'elle ne répond pas encore.
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");
  const protocole = entetes.get("x-forwarded-proto") ?? "https";
  const site = hote
    ? `${protocole}://${hote}`
    : process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  const lienAgenda = p.jeton_agenda
    ? `${site}/agenda/${p.jeton_agenda}.ics`
    : null;

  const tarif = (groupe: string, type: string) =>
    tarifs?.find((t) => t.groupe === groupe && t.type === type)?.prix_cents ?? 0;

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p className="surtitre">Administration</p>
        <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Réglages</h1>

        {ok === "agenda" ? (
          <p className="succes">
            Nouvelle adresse d&apos;agenda. Réabonnez-vous avec celle ci-dessous.
          </p>
        ) : ok === "sauvegarde" ? (
          <p className="succes">
            Sauvegarde envoyée. Regardez votre boîte : deux fichiers joints.
          </p>
        ) : ok ? (
          <p className="succes">Enregistré.</p>
        ) : null}
        {erreur === "sauvegarde-eteinte" ? (
          <p className="alerte">
            La sauvegarde est décochée. Activez-la et enregistrez d&apos;abord.
          </p>
        ) : erreur === "sauvegarde" ? (
          <p className="alerte">
            L&apos;envoi a échoué. Le détail est dans le journal ; vérifiez
            l&apos;adresse de destination.
          </p>
        ) : erreur ? (
          <p className="alerte">Une valeur saisie n&apos;est pas valide.</p>
        ) : null}

        <form action={enregistrerReglages}>
          <h2 style={{ fontSize: 25, margin: "40px 0 8px" }}>Coupe-circuit</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
            À utiliser si quelque chose ne tourne pas rond. La suspension agit
            immédiatement, avant toute autre règle, et les cours déjà réservés ne sont
            pas touchés.
          </p>

          <div className="carte" style={{ marginTop: 16 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label htmlFor="reservations_suspendues" style={etiquette}>
                  État des réservations
                </label>
                <select
                  id="reservations_suspendues"
                  name="reservations_suspendues"
                  defaultValue={p.reservations_suspendues}
                  style={{ ...saisie, padding: "0 12px" }}
                >
                  <option value="aucune">Ouvertes à tous</option>
                  <option value="nouveaux">Fermées aux nouveaux élèves</option>
                  <option value="totale">Fermées à tout le monde</option>
                </select>
              </div>
              <div>
                <label htmlFor="message_suspension" style={etiquette}>
                  Message affiché
                </label>
                <input
                  id="message_suspension"
                  name="message_suspension"
                  type="text"
                  defaultValue={p.message_suspension}
                  style={saisie}
                />
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 25, margin: "44px 0 8px" }}>Règles de réservation</h2>
          <div className="carte" style={{ marginTop: 16 }}>
            <div className="rangee-formulaire">
              <Nombre
                nom="delai_reservation_h"
                libelle="Réserver au moins (h avant)"
                valeur={p.delai_reservation_h}
              />
              <Nombre
                nom="delai_annulation_h"
                libelle="Annuler sans frais (h avant)"
                valeur={p.delai_annulation_h}
              />
              <Nombre
                nom="pause_entre_cours_min"
                libelle="Pause entre cours (min)"
                valeur={p.pause_entre_cours_min}
              />
              <Nombre
                nom="max_cours_par_jour"
                libelle="Cours max par jour"
                valeur={p.max_cours_par_jour}
              />
            </div>
            <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--texte-gris)" }}>
              La pause ne s&apos;applique pas entre deux heures qui s&apos;enchaînent :
              un élève peut toujours réserver un cours de deux heures.
            </p>
          </div>

          <h2 style={{ fontSize: 25, margin: "44px 0 8px" }}>Garde-fous anti-spam</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
            Ces plafonds comptent des heures. Le plus efficace est le dernier : tant
            qu&apos;une adresse n&apos;est pas confirmée, elle ne peut réserver
            qu&apos;une seule heure.
          </p>
          <div className="carte" style={{ marginTop: 16 }}>
            <div className="rangee-formulaire">
              <Nombre
                nom="max_par_semaine"
                libelle="Heures max par semaine"
                valeur={p.max_par_semaine}
              />
              <Nombre nom="max_a_venir" libelle="Heures max à venir" valeur={p.max_a_venir} />
              <Nombre
                nom="max_email_non_confirme"
                libelle="Avant confirmation"
                valeur={p.max_email_non_confirme}
              />
            </div>
          </div>

          <h2 style={{ fontSize: 25, margin: "44px 0 8px" }}>
            Récapitulatif du lundi
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
            Un email chaque lundi matin : les séances passées non validées, les
            demandes d&apos;annulation sans réponse, les factures en retard et les
            emails qui ne sont pas partis. C&apos;est ce qui attrape les pannes
            silencieuses, celles où le site répond mais où plus rien ne sort.
          </p>
          <div className="carte" style={{ marginTop: 16 }}>
            <label className="case-a-cocher" style={{ marginTop: 0 }}>
              <input
                type="checkbox"
                name="recap_actif"
                value="1"
                defaultChecked={p.recap_actif ?? true}
              />
              <span>
                Recevoir le récapitulatif
                <span className="case-a-cocher__aide">
                  Envoyé à {p.email_contact}.
                </span>
              </span>
            </label>
          </div>

          <h2 style={{ fontSize: 25, margin: "44px 0 8px" }}>
            Sauvegarde mensuelle
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
            Le premier passage de chaque mois, le site vous envoie deux fichiers :
            le livre des recettes de l&apos;année au format tableur, et une copie
            de toutes les données du site. Gardez ces emails : si la base devenait
            inaccessible, c&apos;est avec eux que tout se reconstruit.
          </p>
          <div className="carte" style={{ marginTop: 16 }}>
            <label className="case-a-cocher" style={{ marginTop: 0 }}>
              <input
                type="checkbox"
                name="sauvegarde_active"
                value="1"
                defaultChecked={p.sauvegarde_active ?? true}
              />
              <span>
                Recevoir la sauvegarde
                <span className="case-a-cocher__aide">
                  Décochée, aucune copie ne sort du site.
                </span>
              </span>
            </label>
            <div style={{ marginTop: 16 }}>
              <label htmlFor="sauvegarde_email" style={etiquette}>
                Adresse de destination
              </label>
              <input
                id="sauvegarde_email"
                name="sauvegarde_email"
                type="email"
                style={saisie}
                defaultValue={p.sauvegarde_email ?? ""}
                placeholder={p.email_contact}
              />
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--texte-gris)" }}>
                Vide, la sauvegarde part à {p.email_contact}. Une adresse Gmail
                convient : les pièces jointes y restent, et Google les conserve.
              </p>
            </div>
          </div>

          <h2 style={{ fontSize: 25, margin: "44px 0 8px" }}>Rappel avant la séance</h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
            Un message envoyé à l&apos;élève peu avant le cours. Il part par tranches
            de dix minutes, donc le délai réel peut dépasser le réglage de quelques
            minutes.
          </p>
          <div className="carte" style={{ marginTop: 16 }}>
            <label className="case-a-cocher" style={{ marginTop: 0 }}>
              <input
                type="checkbox"
                name="rappel_actif"
                value="1"
                defaultChecked={p.rappel_actif ?? true}
              />
              <span>
                Envoyer un rappel
                <span className="case-a-cocher__aide">
                  Décoché, aucun rappel ne part.
                </span>
              </span>
            </label>
            <div className="rangee-formulaire" style={{ marginTop: 16 }}>
              <Nombre
                nom="rappel_minutes"
                libelle="Combien de minutes avant"
                valeur={p.rappel_minutes ?? 30}
              />
            </div>
          </div>

          <h2 style={{ fontSize: 25, margin: "44px 0 8px" }}>Facturation</h2>
          <div className="carte" style={{ marginTop: 16 }}>
            <div className="rangee-formulaire">
              <Nombre
                nom="delai_paiement_jours"
                libelle="Payable sous (jours)"
                valeur={p.delai_paiement_jours}
              />
              <Nombre
                nom="delai_relance_jours"
                libelle="Relancer après (jours)"
                valeur={p.delai_relance_jours}
              />
            </div>
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              <div>
                <label htmlFor="iban" style={etiquette}>
                  IBAN porté sur les factures
                </label>
                <input
                  id="iban"
                  name="iban"
                  type="text"
                  defaultValue={p.iban ?? ""}
                  placeholder="FR76 ····"
                  autoComplete="off"
                  style={saisie}
                />
              </div>
              <div>
                <label htmlFor="wero_telephone" style={etiquette}>
                  Numéro Wero
                </label>
                <input
                  id="wero_telephone"
                  name="wero_telephone"
                  type="tel"
                  defaultValue={p.wero_telephone ?? ""}
                  style={saisie}
                />
              </div>
              <div>
                <label htmlFor="adresse_postale" style={etiquette}>
                  Adresse portée sur les factures
                </label>
                <input
                  id="adresse_postale"
                  name="adresse_postale"
                  type="text"
                  defaultValue={p.adresse_postale ?? ""}
                  style={saisie}
                />
              </div>
              <div>
                <label htmlFor="email_contact" style={etiquette}>
                  Adresse de contact
                </label>
                <input
                  id="email_contact"
                  name="email_contact"
                  type="email"
                  defaultValue={p.email_contact}
                  style={saisie}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="bouton bouton--principal"
            style={{ marginTop: 24, width: "100%" }}
          >
            Enregistrer les réglages
          </button>
        </form>

        <div className="carte" style={{ marginTop: 20 }}>
          <p style={etiquette}>Envoyer une sauvegarde maintenant</p>
          <p
            style={{
              margin: "8px 0 14px",
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--texte-doux)",
            }}
          >
            Sans attendre le mois prochain. À faire une fois tout de suite, pour
            vérifier que l&apos;email arrive, puis avant toute manipulation
            délicate.
            {p.sauvegarde_envoyee_le
              ? ` Dernier envoi automatique : ${jourLong(p.sauvegarde_envoyee_le)}.`
              : " Aucun envoi pour l'instant."}
          </p>
          <form action={envoyerSauvegardeMaintenant}>
            <button type="submit" className="bouton bouton--secondaire bouton--compact">
              Envoyer maintenant
            </button>
          </form>
        </div>

        <h2 style={{ fontSize: 25, margin: "56px 0 8px" }}>Votre agenda</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Abonnez votre agenda à cette adresse : vos cours s&apos;afficheront à côté
          de vos rendez-vous, sur téléphone comme sur ordinateur, et se mettront à
          jour tout seuls.
        </p>

        <div className="carte" style={{ marginTop: 16 }}>
          <p style={etiquette}>Adresse de l&apos;abonnement</p>
          {lienAgenda ? (
            <p className="agenda__lien">{lienAgenda}</p>
          ) : (
            <p className="alerte" style={{ marginTop: 0 }}>
              La migration <code>0011_agenda.sql</code> n&apos;a pas encore été
              exécutée dans Supabase : l&apos;adresse n&apos;existe pas.
            </p>
          )}

          <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.7, color: "var(--texte-doux)" }}>
            <strong style={{ color: "var(--foret)" }}>Google Agenda</strong> — sur
            ordinateur, « Autres agendas » puis « À partir de l&apos;URL ».
            <br />
            <strong style={{ color: "var(--foret)" }}>iPhone</strong> — Réglages,
            Apps, Calendrier, Comptes, Ajouter un compte, Autre, Ajouter un abonnement
            à un calendrier.
          </p>

          <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.65, color: "var(--texte-gris)" }}>
            Quiconque possède cette adresse voit votre agenda : ne la publiez pas.
            Google ne la relit que toutes les quelques heures ; sur iPhone, le délai
            se règle dans les réglages du calendrier.
          </p>

          <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, color: "var(--texte-gris)" }}>
            Cette adresse reprend celle par laquelle vous êtes arrivée. Le jour où le
            domaine sera branché, revenez ici : elle aura changé d&apos;elle-même, et
            il faudra se réabonner.
          </p>

          <form action={regenererAgenda} style={{ marginTop: 16 }}>
            <button type="submit" className="bouton bouton--secondaire bouton--compact">
              Changer l&apos;adresse
            </button>
          </form>
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--texte-gris)" }}>
            L&apos;ancienne cesse aussitôt de fonctionner. À faire si le lien a
            circulé.
          </p>
        </div>

        <h2 style={{ fontSize: 25, margin: "56px 0 8px" }}>Tarifs</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Changer un tarif n&apos;écrase pas l&apos;ancien : il est clos à la date du
          jour et un nouveau prend la suite. Les cours déjà réservés gardent le prix
          qu&apos;ils avaient, et les factures passées restent explicables.
        </p>

        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {(["college_seconde", "premiere_terminale"] as const).map((groupe) =>
            (["seance", "regulier"] as const).map((type) => (
              <form
                key={`${groupe}-${type}`}
                action={enregistrerTarif}
                className="carte"
                style={{ padding: 20 }}
              >
                <input type="hidden" name="groupe" value={groupe} />
                <input type="hidden" name="type" value={type} />
                <div className="rangee-formulaire">
                  <div>
                    <p style={{ fontSize: 14.5, color: "var(--foret)", fontWeight: 600 }}>
                      {GROUPES[groupe].libelle}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                      {type === "seance" ? "à la séance" : "suivi régulier"}
                    </p>
                  </div>
                  <div>
                    <label htmlFor={`prix-${groupe}-${type}`} style={etiquette}>
                      Prix de l&apos;heure (€)
                    </label>
                    <input
                      id={`prix-${groupe}-${type}`}
                      name="prix"
                      type="text"
                      inputMode="decimal"
                      defaultValue={(tarif(groupe, type) / 100).toString()}
                      style={saisie}
                    />
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--texte-gris)" }}>
                    Actuel : {euros(tarif(groupe, type))}
                  </div>
                  <button type="submit" className="bouton bouton--secondaire bouton--compact">
                    Mettre à jour
                  </button>
                </div>
              </form>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Nombre({
  nom,
  libelle,
  valeur,
}: {
  nom: string;
  libelle: string;
  valeur: number;
}) {
  return (
    <div>
      <label htmlFor={nom} style={etiquette}>
        {libelle}
      </label>
      <input id={nom} name={nom} type="number" defaultValue={valeur} style={saisie} />
    </div>
  );
}
