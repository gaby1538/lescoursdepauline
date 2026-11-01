import type { Metadata } from "next";
import { IDENTITE } from "@/lib/constantes";

export const metadata: Metadata = { title: "Réserver un créneau" };

export default function Reserver() {
  return (
    <section className="section">
      <div className="conteneur-etroit" style={{ textAlign: "center" }}>
        <p className="surtitre">Réservation</p>
        <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>
          Choisissez un <em className="accent">créneau</em>
        </h1>
        <p className="plomb" style={{ margin: "18px auto 32px", maxWidth: 560 }}>
          Le calendrier arrive à l&apos;étape suivante du développement. En
          attendant, écrivez-moi : je réponds vite et le premier échange est
          gratuit.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
          <a href={IDENTITE.whatsapp} className="bouton bouton--principal">
            Écrire sur WhatsApp
          </a>
          <a href={`mailto:${IDENTITE.email}`} className="bouton bouton--secondaire">
            {IDENTITE.email}
          </a>
        </div>
      </div>
    </section>
  );
}
