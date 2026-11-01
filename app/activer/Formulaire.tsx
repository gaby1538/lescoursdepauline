"use client";

import { useActionState } from "react";
import { activerCompte, type EtatFormulaire } from "@/app/compte/actions";
import { Champ, Alerte } from "@/components/Champs";

const initial: EtatFormulaire = { erreur: null };

export default function Formulaire({
  jeton,
  renouvellement,
}: {
  jeton: string;
  renouvellement: boolean;
}) {
  const [etat, action, enCours] = useActionState(activerCompte, initial);

  return (
    <form action={action}>
      <input type="hidden" name="token" value={jeton} />

      <div style={{ display: "grid", gap: 16 }}>
        <Champ
          nom="mot_de_passe"
          libelle={renouvellement ? "Nouveau mot de passe" : "Choisissez un mot de passe"}
          type="password"
          requis
          aide="8 caractères au minimum"
          autoComplete="new-password"
        />
        <Champ
          nom="mot_de_passe_2"
          libelle="Répétez-le"
          type="password"
          requis
          autoComplete="new-password"
        />
      </div>

      {etat.erreur && <Alerte>{etat.erreur}</Alerte>}

      <button
        type="submit"
        disabled={enCours}
        className="bouton bouton--principal"
        style={{ marginTop: 20, width: "100%", opacity: enCours ? 0.6 : 1 }}
      >
        {enCours
          ? "Enregistrement…"
          : renouvellement
            ? "Enregistrer le nouveau mot de passe"
            : "Activer mon espace"}
      </button>
    </form>
  );
}
