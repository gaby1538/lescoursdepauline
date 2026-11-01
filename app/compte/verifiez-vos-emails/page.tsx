import type { Metadata } from "next";
import Link from "next/link";
import { IDENTITE } from "@/lib/constantes";

export const metadata: Metadata = { title: "Vérifiez vos emails" };

export default function VerifiezVosEmails() {
  return (
    <section className="section">
      <div className="conteneur-etroit" style={{ textAlign: "center" }}>
        <p className="surtitre">Presque fini</p>
        <h1 style={{ fontSize: 44, lineHeight: 1.1 }}>
          Regardez votre <em className="accent">boîte mail</em>
        </h1>
        <p className="plomb" style={{ margin: "22px auto 0", maxWidth: 520 }}>
          Si cette adresse m&apos;est connue, un lien vient d&apos;y être envoyé. Il
          vous laissera choisir votre mot de passe et ouvrira votre espace.
        </p>
        <p
          style={{
            margin: "18px auto 0",
            maxWidth: 520,
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--texte-gris)",
          }}
        >
          Rien au bout de quelques minutes ? Pensez aux indésirables. Si le message
          n&apos;arrive vraiment pas, écrivez-moi à{" "}
          <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a>.
        </p>
        <div style={{ marginTop: 34 }}>
          <Link href="/" className="bouton bouton--secondaire">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
