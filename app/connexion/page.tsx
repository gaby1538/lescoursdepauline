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
          <p>
            <Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
          </p>

          <div
            className="carte"
            style={{
              maxWidth: 460,
              margin: "26px auto 0",
              textAlign: "left",
              background: "var(--creme-fonce)",
            }}
          >
            <p className="surtitre" style={{ marginBottom: 10 }}>
              Première visite
            </p>
            <p
              style={{
                fontFamily: "var(--serif)",
                fontSize: 21,
                lineHeight: 1.3,
                color: "var(--foret)",
              }}
            >
              Créez votre espace
            </p>
            <p
              style={{
                margin: "12px 0 20px",
                fontSize: 14.5,
                lineHeight: 1.65,
                color: "var(--texte-doux)",
              }}
            >
              Vos coordonnées une bonne fois pour toutes, et vos réservations
              suivantes tiennent en deux clics. Si vous avez déjà réservé un cours,
              il viendra s&apos;y rattacher tout seul.
            </p>
            <Link
              href="/creer-un-compte"
              className="bouton bouton--or"
              style={{ width: "100%" }}
            >
              Créer mon espace
            </Link>
          </div>
        </>
      }
    >
      <Formulaire />
    </PageFormulaire>
  );
}
