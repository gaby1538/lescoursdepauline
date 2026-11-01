import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon espace" };

export default function MonEspace() {
  return (
    <section className="section">
      <div className="conteneur-etroit" style={{ textAlign: "center" }}>
        <p className="surtitre">Espace élève</p>
        <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>Bientôt disponible</h1>
        <p className="plomb" style={{ margin: "18px auto 0", maxWidth: 560 }}>
          Vos cours, vos documents et vos factures seront réunis ici. L&apos;espace
          se crée tout seul à votre première réservation.
        </p>
      </div>
    </section>
  );
}
