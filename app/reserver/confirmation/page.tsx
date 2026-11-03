import type { Metadata } from "next";
import Link from "next/link";
import { creneauLong } from "@/lib/dates";
import { IDENTITE } from "@/lib/constantes";

export const metadata: Metadata = { title: "Réservation confirmée" };

export default async function Confirmation({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string; h?: string }>;
}) {
  const { debut, h } = await searchParams;
  const heures = Math.max(1, Number(h) || 1);
  const quand = debut ? creneauLong(debut) : null;

  return (
    <section className="section">
      <div className="conteneur-etroit" style={{ textAlign: "center" }}>
        <p className="surtitre">C&apos;est noté</p>
        <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>
          {heures > 1 ? (
            <>
              Vos {heures} heures sont <em className="accent">réservées</em>
            </>
          ) : (
            <>
              Votre cours est <em className="accent">réservé</em>
            </>
          )}
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
            {heures > 1 ? `À partir du ${quand}` : quand}
          </p>
        )}
        {heures > 1 && (
          <p style={{ marginTop: 10, fontSize: 15, color: "var(--texte-gris)" }}>
            Le détail de chaque heure figure dans l&apos;email de confirmation.
          </p>
        )}
        <p className="plomb" style={{ margin: "22px auto 0", maxWidth: 520 }}>
          Un email de confirmation vient de partir. S&apos;il s&apos;agit de votre
          premier cours, il contient un lien qui confirme votre adresse et crée votre
          espace : un clic, un mot de passe, et vos coordonnées sont retenues pour
          toutes vos prochaines réservations.
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
