import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: true },
};

/**
 * Next.js affiche sinon sa page par défaut, en anglais et sans rapport
 * avec le site. Une adresse mal recopiée ne doit pas donner
 * l'impression d'être tombé ailleurs.
 */
export default function Introuvable() {
  return (
    <section className="section">
      <div className="conteneur-etroit" style={{ textAlign: "center" }}>
        <p className="surtitre">Erreur 404</p>
        <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>
          Cette page n&apos;<em className="accent">existe pas</em>
        </h1>
        <p className="plomb" style={{ margin: "22px auto 0", maxWidth: 480 }}>
          L&apos;adresse a peut-être changé, ou comporte une faute de frappe.
          Tout le site reste accessible depuis le menu.
        </p>

        <div
          style={{
            marginTop: 34,
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            justifyContent: "center",
          }}
        >
          <Link href="/" className="bouton bouton--principal">
            Retour à l&apos;accueil
          </Link>
          <Link href="/reserver" className="bouton bouton--secondaire">
            Réserver un cours
          </Link>
        </div>
      </div>
    </section>
  );
}
