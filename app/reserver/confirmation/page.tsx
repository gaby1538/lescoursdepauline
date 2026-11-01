import type { Metadata } from "next";
import Link from "next/link";
import { creneauLong } from "@/lib/dates";
import { IDENTITE } from "@/lib/constantes";

export const metadata: Metadata = { title: "Réservation confirmée" };

export default async function Confirmation({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string }>;
}) {
  const { debut } = await searchParams;
  const quand = debut ? creneauLong(debut) : null;

  return (
    <section className="section">
      <div className="conteneur-etroit" style={{ textAlign: "center" }}>
        <p className="surtitre">C&apos;est noté</p>
        <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>
          Votre cours est <em className="accent">réservé</em>
        </h1>
        {quand && (
          <p
            style={{
              marginTop: 20,
              fontFamily: "var(--serif)",
              fontSize: 26,
              color: "var(--foret)",
            }}
          >
            {quand}
          </p>
        )}
        <p className="plomb" style={{ margin: "22px auto 0", maxWidth: 520 }}>
          Un email de confirmation vient de partir. Il contient le lien de connexion et,
          s&apos;il s&apos;agit de votre premier cours, un lien pour confirmer votre
          adresse — un clic suffit, et cela vous permettra de réserver d&apos;autres
          séances.
        </p>
        <p className="plomb" style={{ margin: "16px auto 0", maxWidth: 520 }}>
          Rien à régler maintenant. La facture arrivera en fin de mois.
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
          <a href={IDENTITE.whatsapp} className="bouton bouton--secondaire">
            Une question ?
          </a>
        </div>
      </div>
    </section>
  );
}
