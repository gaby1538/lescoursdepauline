"use client";

import { useActionState } from "react";
import { demanderReinitialisation, type EtatFormulaire } from "@/app/compte/actions";
import { Champ, Alerte } from "@/components/Champs";
import EmailEnvoye from "@/components/EmailEnvoye";

const initial: EtatFormulaire = { erreur: null };

export default function Formulaire() {
  const [etat, action, enCours] = useActionState(demanderReinitialisation, initial);

  if (etat.envoyeA) {
    return <EmailEnvoye adresse={etat.envoyeA} retour="/mot-de-passe-oublie" />;
  }

  return (
    <form action={action}>
      <Champ nom="email" libelle="Votre email" type="email" requis />

      {etat.erreur && <Alerte>{etat.erreur}</Alerte>}

      <button
        type="submit"
        disabled={enCours}
        className="bouton bouton--principal"
        style={{ marginTop: 20, width: "100%", opacity: enCours ? 0.6 : 1 }}
      >
        {enCours ? "Envoi…" : "Recevoir un lien"}
      </button>
    </form>
  );
}
