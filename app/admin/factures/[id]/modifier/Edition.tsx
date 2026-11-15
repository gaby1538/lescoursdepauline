"use client";

import { useRef, useState, useTransition } from "react";
import { euros } from "@/lib/constantes";
import {
  ajouterLigneFacture,
  majLigneFacture,
  retirerLigneFacture,
  type LigneVive,
} from "../../actions";

/**
 * L'écran d'un brouillon : les lignes à gauche, la facture à droite.
 *
 * Tout tient dans un seul composant parce que tout bouge ensemble. Une
 * frappe dans une quantité change le total de la ligne, le total de la
 * facture et l'aperçu de droite ; si ces trois-là vivaient dans des
 * composants séparés, il faudrait recharger la page pour les remettre
 * d'accord, et c'est précisément ce qu'on cherchait à supprimer.
 *
 * Rien de ce qui se passe ici n'envoie quoi que ce soit : le brouillon
 * s'enregistre seul, et émettre reste un geste à part, derrière une
 * relecture de la facture entière.
 */

type Brouillon = {
  id: string;
  description: string;
  quantite: string;
  prix: string;
  total: number;
};

const vers = (l: LigneVive): Brouillon => ({
  id: l.id,
  description: l.description ?? "",
  quantite: String(Number(l.quantite)),
  prix: (l.prix_unitaire_cents / 100).toString(),
  total: l.total_cents,
});

/** Les nombres se saisissent à la française : la virgule est admise. */
function nombre(valeur: string): number | null {
  const n = Number(valeur.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

export default function Edition({
  factureId,
  initiales,
  tarifHoraireCents,
  numeroSuggere,
  eleve,
  periode,
  destinataireNom,
  destinataireAdresse,
  email,
}: {
  factureId: string;
  initiales: LigneVive[];
  tarifHoraireCents: number;
  numeroSuggere: string;
  eleve: string;
  periode: string;
  destinataireNom: string;
  destinataireAdresse: string | null;
  email: string | null;
}) {
  const [lignes, setLignes] = useState<Brouillon[]>(initiales.map(vers));
  const [enregistre, setEnregistre] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const minuteurs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const total = lignes.reduce((somme, l) => somme + l.total, 0);

  function calcul(l: Brouillon): number {
    const q = nombre(l.quantite);
    const p = nombre(l.prix);
    if (q === null || p === null) return 0;
    return Math.round(q * Math.round(p * 100));
  }

  function modifier(id: string, champ: keyof Brouillon, valeur: string) {
    setErreur(null);
    setEnregistre(false);

    setLignes((avant) =>
      avant.map((l) => {
        if (l.id !== id) return l;
        const neuve = { ...l, [champ]: valeur };
        return { ...neuve, total: calcul(neuve) };
      })
    );

    // On attend que la frappe se calme : une requête par caractère
    // saturerait la base pour rien.
    clearTimeout(minuteurs.current[id]);
    minuteurs.current[id] = setTimeout(() => {
      setLignes((actuelles) => {
        const l = actuelles.find((x) => x.id === id);
        if (!l) return actuelles;

        const q = nombre(l.quantite) ?? 0;
        const p = nombre(l.prix) ?? 0;

        majLigneFacture(factureId, id, l.description, q, Math.round(p * 100))
          .then(() => setEnregistre(true))
          .catch(() =>
            setErreur("Cette modification n'a pas pu être enregistrée. Réessayez.")
          );

        return actuelles;
      });
    }, 600);
  }

  function ajouter(description: string, quantite: number, prixCents: number) {
    setErreur(null);
    setEnregistre(false);
    demarrer(() => {
      ajouterLigneFacture(factureId, description, quantite, prixCents)
        .then((creee) => {
          setLignes((avant) => [...avant, vers(creee)]);
          setEnregistre(true);
        })
        .catch(() => setErreur("La ligne n'a pas pu être ajoutée. Réessayez."));
    });
  }

  function retirer(id: string) {
    setErreur(null);
    setEnregistre(false);
    clearTimeout(minuteurs.current[id]);
    const avant = lignes;
    setLignes((l) => l.filter((x) => x.id !== id));

    retirerLigneFacture(factureId, id)
      .then(() => setEnregistre(true))
      .catch(() => {
        setLignes(avant);
        setErreur("La ligne n'a pas pu être retirée. Réessayez.");
      });
  }

  return (
    <>
      <div className="admin__titre" style={{ marginBottom: 0 }}>
        <div>
          <p className="surtitre">Brouillon · {eleve}</p>
          <h1 style={{ fontSize: 36, lineHeight: 1.12 }}>{periode}</h1>
        </div>
        <p className="lignes__etat" aria-live="polite">
          {erreur ? "" : enregistre && !enCours ? "Brouillon enregistré" : "Enregistrement…"}
        </p>
      </div>

      <div className="edition">
        <div className="edition__gauche">
          <h2 style={{ fontSize: 23, marginBottom: 6 }}>Les lignes</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
            Ajoutez, retirez, corrigez. Le total suit à la frappe, et rien ne
            recharge.
          </p>

          {erreur && (
            <p className="alerte" style={{ marginTop: 14 }}>
              {erreur}
            </p>
          )}

          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {lignes.length === 0 && (
              <p style={{ fontSize: 15, color: "var(--texte-doux)" }}>
                Aucune ligne pour l&apos;instant. Ajoutez-en une ci-dessous.
              </p>
            )}

            {lignes.map((l) => (
              <div key={l.id} className="ligne-vive">
                <div className="ligne-vive__desc">
                  <label htmlFor={`d-${l.id}`} className="etiquette-ligne">
                    Prestation
                  </label>
                  <input
                    id={`d-${l.id}`}
                    type="text"
                    value={l.description}
                    onChange={(e) => modifier(l.id, "description", e.target.value)}
                    placeholder="Cours de SVT, stage, remise…"
                    className="champ-ligne"
                  />
                </div>
                <div className="ligne-vive__petit">
                  <label htmlFor={`q-${l.id}`} className="etiquette-ligne">
                    Qté
                  </label>
                  <input
                    id={`q-${l.id}`}
                    type="text"
                    inputMode="decimal"
                    value={l.quantite}
                    onChange={(e) => modifier(l.id, "quantite", e.target.value)}
                    className="champ-ligne champ-ligne--nombre"
                  />
                </div>
                <div className="ligne-vive__petit">
                  <label htmlFor={`p-${l.id}`} className="etiquette-ligne">
                    Prix €
                  </label>
                  <input
                    id={`p-${l.id}`}
                    type="text"
                    inputMode="decimal"
                    value={l.prix}
                    onChange={(e) => modifier(l.id, "prix", e.target.value)}
                    className="champ-ligne champ-ligne--nombre"
                  />
                </div>
                <p className="ligne-vive__total">{euros(l.total)}</p>
                <button
                  type="button"
                  onClick={() => retirer(l.id)}
                  aria-label={`Retirer la ligne ${l.description || "sans libellé"}`}
                  className="ligne-vive__retirer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="lignes__ajouts">
            <button
              type="button"
              onClick={() => ajouter("", 1, 0)}
              className="action action--foret"
            >
              + Ajouter une ligne
            </button>
            <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>ou&nbsp;:</span>
            <button
              type="button"
              onClick={() => ajouter("Heure de cours de SVT", 1, tarifHoraireCents)}
              className="raccourci"
            >
              Heure de cours
            </button>
            <button
              type="button"
              onClick={() => ajouter("Remise", 1, -1000)}
              className="raccourci"
            >
              Remise
            </button>
            <button
              type="button"
              onClick={() => ajouter("Stage de révisions", 1, 16000)}
              className="raccourci"
            >
              Stage
            </button>
          </div>

          <div className="lignes__total">
            <span>Total</span>
            <strong>{euros(total)}</strong>
          </div>

          {/* Le numéro se choisit ici, pendant qu'on regarde la facture,
              et pas dans l'écran suivant : c'est maintenant qu'on sait
              si Pauline a facturé quelque chose hors du site. */}
          <form
            method="get"
            action={`/admin/factures/${factureId}/apercu`}
            className="bloc-numero"
          >
            <div className="bloc-numero__haut">
              <div>
                <label htmlFor="numero" className="etiquette-ligne">
                  Numéro
                </label>
                <input
                  id="numero"
                  name="numero"
                  type="text"
                  defaultValue={numeroSuggere}
                  className="champ-ligne champ-ligne--nombre"
                  style={{ width: 190 }}
                />
              </div>
              <p className="bloc-numero__aide">
                Le suivant de la série. Modifiable si vous avez facturé hors du
                site : la série reprendra à partir du numéro saisi.
              </p>
            </div>

            <div className="barre-emission__gestes" style={{ marginTop: 18 }}>
              <button
                type="submit"
                name="emettre"
                value="1"
                className="action action--or action--grand"
              >
                Émettre
              </button>
              <button type="submit" className="action action--contour action--grand">
                Visualiser
              </button>
              {/* Un brouillon se télécharge aussi : c'est souvent comme ça
                  qu'on relit, ou qu'on retouche une ligne avant d'émettre. */}
              <a
                href={`/admin/factures/${factureId}/docx`}
                className="action action--discret"
              >
                Word
              </a>
              <a
                href={`/admin/factures/${factureId}/pdf`}
                className="action action--discret"
              >
                PDF
              </a>
            </div>

            <p className="bloc-numero__loi">
              <strong>Visualiser</strong> ouvre la facture en grand, sans rien
              figer : on revient au brouillon comme on est venu.{" "}
              <strong>Émettre</strong> y mène aussi, mais avec les deux boutons qui
              attribuent le numéro — c&apos;est le seul geste du site qu&apos;on ne
              peut pas défaire.
            </p>
          </form>
        </div>

        <aside className="edition__apercu">
          <p className="surtitre" style={{ marginBottom: 10 }}>
            Aperçu
          </p>
          <div className="apercu-facture">
            <div className="apercu-facture__tete">
              <p className="apercu-facture__marque">
                Les cours de <span>Pauline</span>
              </p>
              <div style={{ textAlign: "right" }}>
                <p className="apercu-facture__etat">Brouillon</p>
                <p className="apercu-facture__numero">{numeroSuggere || "—"}</p>
              </div>
            </div>
            <p className="apercu-facture__note">
              Numéro et dates attribués à l&apos;émission
            </p>

            <div className="apercu-facture__filet" />

            <p className="surtitre" style={{ marginBottom: 6, fontSize: 10.5 }}>
              Facturé à
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              {destinataireNom || "—"}
              {destinataireAdresse
                ? destinataireAdresse.split("\n").map((ligne) => (
                    <span key={ligne}>
                      <br />
                      {ligne}
                    </span>
                  ))
                : null}
              {email ? (
                <>
                  <br />
                  <span style={{ color: "var(--texte-gris)" }}>{email}</span>
                </>
              ) : null}
            </p>

            <div style={{ marginTop: 18, display: "grid", gap: 7 }}>
              {lignes.map((l) => (
                <div key={l.id} className="apercu-facture__ligne">
                  <span>{l.description || "Sans libellé"}</span>
                  <span>{euros(l.total)}</span>
                </div>
              ))}
            </div>

            <div className="apercu-facture__total">
              <span>Total à régler</span>
              <strong>{euros(total)}</strong>
            </div>

            <p style={{ marginTop: 16, fontSize: 11, color: "var(--texte-gris)", lineHeight: 1.5 }}>
              TVA non applicable, article 293 B du CGI.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
