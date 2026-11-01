"use client";

import { useActionState } from "react";
import { seConnecter, type EtatFormulaire } from "@/app/compte/actions";
import { Champ, Alerte } from "@/components/Champs";

const initial: EtatFormulaire = { erreur: null };

export default function Formulaire() {
  const [etat, action, enCours] = useActionState(seConnecter, initial);

  return (
    <form action={action}>
      <div style={{ display: "grid", gap: 16 }}>
        <Champ nom="email" libelle="Votre email" type="email" requis />
        <Champ
          nom="mot_de_passe"
          libelle="Votre mot de passe"
          type="password"
          requis
          autoComplete="current-password"
        />
      </div>

      {etat.erreur && <Alerte>{etat.erreur}</Alerte>}

      <button
        type="submit"
        disabled={enCours}
        className="bouton bouton--principal"
        style={{ marginTop: 20, width: "100%", opacity: enCours ? 0.6 : 1 }}
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
