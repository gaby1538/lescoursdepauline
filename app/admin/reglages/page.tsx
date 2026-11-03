import { clientAdmin } from "@/lib/supabase";
import { etiquette, saisie } from "@/components/Champs";
import { euros, GROUPES } from "@/lib/constantes";
import { enregistrerReglages, enregistrerTarif } from "./actions";

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

  const tarif = (groupe: string, type: string) =>
    tarifs?.find((t) => t.groupe === groupe && t.type === type)?.prix_cents ?? 0;

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p className="surtitre">Administration</p>
        <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Réglages</h1>

        {ok && <p className="succes">Enregistré.</p>}
        {erreur && <p className="alerte">Une valeur saisie n&apos;est pas valide.</p>}

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
