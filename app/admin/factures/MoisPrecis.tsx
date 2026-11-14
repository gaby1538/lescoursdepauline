"use client";

import { useRouter } from "next/navigation";

/**
 * Le choix d'un mois plus ancien, dans la rangée des périodes.
 *
 * Une liste plutôt qu'un champ « mois » du navigateur : Pauline
 * remonte de quelques mois, pas de quelques années, et un bouton
 * « Voir » à côté d'un choix déjà fait ne sert à rien — le choix suffit
 * à dire ce qu'on veut voir.
 */
export default function MoisPrecis({
  mois,
  actif,
}: {
  mois: { valeur: string; nom: string }[];
  actif: string;
}) {
  const router = useRouter();

  return (
    <>
      <label htmlFor="mois-precis" style={{ marginLeft: 6, fontSize: 13, color: "var(--texte-gris)" }}>
        ou un mois précis
      </label>
      <select
        id="mois-precis"
        className="selecteur-mois"
        value={actif}
        onChange={(e) => router.push(`/admin/factures?periode=${e.target.value}`)}
      >
        <option value="">—</option>
        {mois.map((m) => (
          <option key={m.valeur} value={m.valeur}>
            {m.nom}
          </option>
        ))}
      </select>
    </>
  );
}
