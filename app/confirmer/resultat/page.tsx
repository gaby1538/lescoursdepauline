import type { Metadata } from "next";
import Link from "next/link";
import { IDENTITE } from "@/lib/constantes";

export const metadata: Metadata = { title: "Confirmation d'adresse" };

export default async function Resultat({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  const { etat } = await searchParams;
  const reussi = etat === "ok";

  return (
    <section className="section">
      <div className="conteneur-etroit" style={{ textAlign: "center" }}>
        <p className="surtitre">{reussi ? "Merci" : "Lien invalide"}</p>
        <h1 style={{ fontSize: 44, lineHeight: 1.1 }}>
          {reussi ? (
            <>
              Votre adresse est <em className="accent">confirmée</em>
            </>
          ) : (
            <>Ce lien ne fonctionne plus</>
          )}
        </h1>
        <p className="plomb" style={{ margin: "22px auto 0", maxWidth: 520 }}>
          {reussi
            ? "Vous pouvez désormais réserver plusieurs cours. À tout moment, l'espace élève vous donnera accès à vos séances, vos documents et vos factures."
            : "Le lien a peut-être été tronqué par votre messagerie. Écrivez-moi, je vous en renvoie un."}
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
          {reussi ? (
            <Link href="/reserver" className="bouton bouton--principal">
              Réserver un cours
            </Link>
          ) : (
            <a href={`mailto:${IDENTITE.email}`} className="bouton bouton--principal">
              Écrire à Pauline
            </a>
          )}
          <Link href="/" className="bouton bouton--secondaire">
            Accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
