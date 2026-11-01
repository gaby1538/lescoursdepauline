import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <section className="section">
      <div className="conteneur-etroit">
        <h1 style={{ fontSize: 44, lineHeight: 1.12, marginBottom: 24 }}>Politique de confidentialité</h1>
        <p className="plomb">
          Texte à rédiger avant la mise en ligne. Il sera modifiable par Pauline
          depuis l&apos;administration.
        </p>
      </div>
    </section>
  );
}
