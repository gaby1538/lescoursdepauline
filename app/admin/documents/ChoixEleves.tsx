"use client";

import { useMemo, useState } from "react";

export type EleveChoisissable = {
  id: string;
  eleve_prenom: string | null;
  eleve_classe: string | null;
  prenom: string | null;
  nom: string | null;
  email: string;
};

export default function ChoixEleves({ eleves }: { eleves: EleveChoisissable[] }) {
  const [filtre, setFiltre] = useState("");
  const [coches, setCoches] = useState<string[]>([]);

  const visibles = useMemo(() => {
    const q = filtre.trim().toLowerCase();
    if (!q) return eleves;
    return eleves.filter((e) =>
      [e.eleve_prenom, e.eleve_classe, e.prenom, e.nom, e.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [eleves, filtre]);

  const tousVisiblesCoches =
    visibles.length > 0 && visibles.every((e) => coches.includes(e.id));

  function basculer(id: string) {
    setCoches((liste) =>
      liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]
    );
  }

  function toutBasculer() {
    const ids = visibles.map((e) => e.id);
    setCoches((liste) =>
      tousVisiblesCoches
        ? liste.filter((x) => !ids.includes(x))
        : [...new Set([...liste, ...ids])]
    );
  }

  return (
    <div>
      <div className="choix__tete">
        <input
          type="search"
          value={filtre}
          onChange={(e) => setFiltre(e.target.value)}
          placeholder="Filtrer par prénom, classe ou email"
          aria-label="Filtrer les élèves"
          className="choix__filtre"
        />
        <button type="button" onClick={toutBasculer} className="lien-bouton">
          {tousVisiblesCoches ? "tout décocher" : "tout cocher"}
        </button>
      </div>

      <div className="choix__liste">
        {visibles.length === 0 ? (
          <p style={{ padding: 14, fontSize: 14.5, color: "var(--texte-gris)" }}>
            Aucun élève ne correspond.
          </p>
        ) : (
          visibles.map((e) => (
            <label key={e.id} className="choix__ligne">
              <input
                type="checkbox"
                name="dossier_ids"
                value={e.id}
                checked={coches.includes(e.id)}
                onChange={() => basculer(e.id)}
              />
              <span>
                <strong>{e.eleve_prenom ?? "—"}</strong>
                {e.eleve_classe ? ` · ${e.eleve_classe}` : ""}
                <br />
                <span className="choix__contact">
                  {e.prenom} {e.nom} — {e.email}
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      <p className="choix__compte">
        {coches.length === 0
          ? "Aucun élève sélectionné."
          : coches.length === 1
            ? "1 élève sélectionné."
            : `${coches.length} élèves sélectionnés — chacun recevra sa copie.`}
      </p>
    </div>
  );
}
