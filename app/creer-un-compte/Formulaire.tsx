"use client";

import { useActionState } from "react";
import { creerCompte, type EtatFormulaire } from "@/app/compte/actions";
import { Champ, ChampClasse, Alerte } from "@/components/Champs";
import EmailEnvoye from "@/components/EmailEnvoye";
import { GROUPES } from "@/lib/constantes";

const CLASSES = [
  ...GROUPES.college_seconde.classes,
  ...GROUPES.premiere_terminale.classes,
];

const initial: EtatFormulaire = { erreur: null };

export default function Formulaire() {
  const [etat, action, enCours] = useActionState(creerCompte, initial);

  if (etat.envoyeA) {
    return <EmailEnvoye adresse={etat.envoyeA} retour="/creer-un-compte" />;
  }

  return (
    <form action={action}>
      <div className="champs" style={{ marginTop: 0 }}>
        <Champ nom="prenom" libelle="Votre prénom" requis autoComplete="given-name" />
        <Champ nom="nom" libelle="Votre nom" requis autoComplete="family-name" />
        <Champ
          nom="email"
          libelle="Votre email"
          type="email"
          requis
          aide="Pour le lien d'activation"
        />
        <Champ nom="telephone" libelle="Votre téléphone" type="tel" />
        <Champ nom="eleve_prenom" libelle="Prénom de l'élève" requis />
        <ChampClasse classes={CLASSES} />
      </div>

      <div
        style={{
          marginTop: 20,
          background: "var(--creme-fonce)",
          borderRadius: 4,
          padding: "16px 18px",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--texte-doux)",
        }}
      >
        <strong style={{ color: "var(--foret)" }}>Pas de mot de passe ici.</strong> Vous
        le choisirez en cliquant sur le lien que je vous envoie, une fois votre adresse
        vérifiée. Tant que ce lien n&apos;est pas ouvert, aucun compte n&apos;existe.
      </div>

      {etat.erreur && <Alerte>{etat.erreur}</Alerte>}

      <button
        type="submit"
        disabled={enCours}
        className="bouton bouton--principal"
        style={{ marginTop: 20, width: "100%", opacity: enCours ? 0.6 : 1 }}
      >
        {enCours ? "Envoi…" : "Recevoir mon lien d'activation"}
      </button>
    </form>
  );
}
