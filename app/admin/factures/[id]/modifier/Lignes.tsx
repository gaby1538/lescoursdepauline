"use client";

import { useRef, useState, useTransition } from "react";
import { euros } from "@/lib/constantes";
import { etiquette, saisie } from "@/components/Champs";
import {
  ajouterLigneFacture,
  majLigneFacture,
  retirerLigneFacture,
  type LigneVive,
} from "../../actions";

/**
 * Les lignes de la facture, modifiables sans recharger la page.
 *
 * Auparavant il n'existait qu'un seul emplacement « ajouter une
 * ligne » : trois lignes à saisir coûtaient trois enregistrements et
 * trois rechargements, et la suppression se faisait ailleurs dans la
 * page. Ici tout se passe au même endroit, le total suit à la frappe,
 * et le brouillon s'enregistre de lui-même.
 *
 * Enregistrer n'est pas envoyer : aucun email ne part d'ici.
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

export default function Lignes({
  factureId,
  initiales,
  tarifHoraireCents,
}: {
  factureId: string;
  initiales: LigneVive[];
  tarifHoraireCents: number;
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
    <div className="lignes">
      <div className="lignes__tete">
        <div>
          <h2 style={{ fontSize: 23, marginBottom: 6 }}>Les lignes</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
            Ajoutez, retirez, corrigez. Un montant négatif passe une remise, et le
            total suit à la frappe.
          </p>
        </div>
        <p className="lignes__etat" aria-live="polite">
          {erreur ? "" : enregistre && !enCours ? "Brouillon enregistré" : "Enregistrement…"}
        </p>
      </div>

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
              <label htmlFor={`d-${l.id}`} style={etiquette}>
                Prestation
              </label>
              <input
                id={`d-${l.id}`}
                type="text"
                value={l.description}
                onChange={(e) => modifier(l.id, "description", e.target.value)}
                placeholder="Cours de SVT, stage, remise…"
                style={saisie}
              />
            </div>
            <div className="ligne-vive__petit">
              <label htmlFor={`q-${l.id}`} style={etiquette}>
                Qté
              </label>
              <input
                id={`q-${l.id}`}
                type="text"
                inputMode="decimal"
                value={l.quantite}
                onChange={(e) => modifier(l.id, "quantite", e.target.value)}
                style={{ ...saisie, fontVariantNumeric: "tabular-nums" }}
              />
            </div>
            <div className="ligne-vive__petit">
              <label htmlFor={`p-${l.id}`} style={etiquette}>
                Prix €
              </label>
              <input
                id={`p-${l.id}`}
                type="text"
                inputMode="decimal"
                value={l.prix}
                onChange={(e) => modifier(l.id, "prix", e.target.value)}
                style={{ ...saisie, fontVariantNumeric: "tabular-nums" }}
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
          className="bouton bouton--principal bouton--compact"
        >
          + Ajouter une ligne
        </button>
        <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>ou :</span>
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
        <button
          type="button"
          onClick={() => ajouter("Documents de révision", 1, 0)}
          className="raccourci"
        >
          Documents
        </button>
      </div>

      <div className="lignes__total">
        <span>Total</span>
        <strong>{euros(total)}</strong>
      </div>
    </div>
  );
}
