import type { Metadata } from "next";
import Link from "next/link";
import PageFormulaire from "@/components/PageFormulaire";
import Formulaire from "./Formulaire";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function MotDePasseOublie() {
  return (
    <PageFormulaire
      surtitre="Mot de passe oublié"
      titre="Ça arrive à"
      accent="tout le monde"
      intro="Indiquez votre adresse : je vous envoie un lien pour en choisir un nouveau."
      pied={
        <>
          Vous vous en souvenez finalement ?{" "}
          <Link href="/connexion">Se connecter</Link>
        </>
      }
    >
      <Formulaire />
    </PageFormulaire>
  );
}
