import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions générales de vente" };

export default function Page() {
  return (
    <section className="section">
      <div className="conteneur-etroit">
        <h1 style={{ fontSize: 44, lineHeight: 1.12, marginBottom: 24 }}>Conditions générales de vente</h1>
        <p className="plomb">
          Texte à rédiger avant la mise en ligne. Il sera modifiable par Pauline
          depuis l&apos;administration.
        </p>
      </div>
    </section>
  );
}
