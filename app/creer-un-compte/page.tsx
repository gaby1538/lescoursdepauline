import type { Metadata } from "next";
import Link from "next/link";
import PageFormulaire from "@/components/PageFormulaire";
import Formulaire from "./Formulaire";

export const metadata: Metadata = { title: "Créer mon espace" };

export default function CreerUnCompte() {
  return (
    <PageFormulaire
      surtitre="Espace élève"
      titre="Créez votre"
      accent="espace"
      large
      intro="Vos coordonnées une bonne fois pour toutes. Ensuite, réserver un cours tient en deux clics : un créneau, et c'est fait."
      pied={
        <>
          Vous avez déjà un espace ? <Link href="/connexion">Se connecter</Link>.<br />
          Vous avez déjà réservé sans compte ? Utilisez la même adresse : vos cours
          passés seront rattachés automatiquement.
        </>
      }
    >
      <Formulaire />
    </PageFormulaire>
  );
}
