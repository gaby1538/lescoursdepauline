import type { Metadata } from "next";
import Link from "next/link";
import PageFormulaire from "@/components/PageFormulaire";
import Formulaire from "./Formulaire";

export const metadata: Metadata = { title: "Se connecter" };

export default function Connexion() {
  return (
    <PageFormulaire
      surtitre="Espace élève"
      titre="Content de vous"
      accent="revoir"
      pied={
        <>
          <Link href="/mot-de-passe-oublie">Mot de passe oublié</Link> · Pas encore
          d&apos;espace ? <Link href="/creer-un-compte">En créer un</Link>
        </>
      }
    >
      <Formulaire />
    </PageFormulaire>
  );
}
