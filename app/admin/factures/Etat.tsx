"use client";

import { useState, useTransition } from "react";
import { changerEtat, type Etat as Cible } from "./actions";

/**
 * L'état d'une facture, modifiable là où on le lit.
 *
 * Auparavant il fallait ouvrir la facture, déplier un panneau et
 * choisir parmi trois boutons dont chacun faisait une chose
 * différente. En pratique on veut dire « celle-ci n'en est pas là » et
 * passer à la suivante.
 *
 * Le refus compte autant que le changement : remettre en brouillon une
 * facture qui n'est pas la dernière de la série creuserait un trou dans
 * la numérotation. Le message le dit sur place, sans quitter la liste.
 */

const CHOIX: { valeur: Cible; nom: string }[] = [
  { valeur: "brouillon", nom: "Brouillon" },
  { valeur: "a_envoyer", nom: "À envoyer" },
  { valeur: "envoyee", nom: "Envoyée" },
  { valeur: "payee", nom: "Payée" },
];

export default function Etat({
  id,
  etat,
  libelle,
}: {
  id: string;
  etat: Cible;
  libelle: string;
}) {
  const [valeur, setValeur] = useState<Cible>(etat);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function choisir(cible: Cible) {
    if (cible === valeur) return;

    const avant = valeur;
    setErreur(null);
    setValeur(cible);

    demarrer(() => {
      changerEtat(id, cible)
        .then((r) => {
          if (!r.ok) {
            // On remet le menu sur l'état réel : laisser afficher un
            // état que la base a refusé serait un mensonge tranquille.
            setValeur(avant);
            setErreur(r.message);
          }
        })
        .catch(() => {
          setValeur(avant);
          setErreur("Le changement n'a pas pu être enregistré. Réessayez.");
        });
    });
  }

  const enAttente = valeur === "a_envoyer" || libelle === "En retard";

  return (
    <div className="etat-vif">
      <select
        className={
          enAttente ? "etat-vif__menu etat-vif__menu--attente" : "etat-vif__menu"
        }
        value={valeur}
        disabled={enCours}
        aria-label={`État de la facture — actuellement ${libelle}`}
        onChange={(e) => choisir(e.target.value as Cible)}
      >
        {CHOIX.map((c) => (
          <option key={c.valeur} value={c.valeur}>
            {/* L'état courant garde son libellé exact — « Remise en main
                propre », « En retard » — que le menu ne sait pas dire. */}
            {c.valeur === etat ? libelle : c.nom}
          </option>
        ))}
      </select>

      {erreur && <p className="etat-vif__erreur">{erreur}</p>}
    </div>
  );
}
