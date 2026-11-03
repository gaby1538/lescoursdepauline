import type { Metadata } from "next";
import Link from "next/link";
import { euros, TARIFS_PAR_DEFAUT } from "@/lib/constantes";
import { IconeCoche } from "@/components/Icones";

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "40 € l'heure au collège et en seconde, 45 € en première et terminale, " +
    "réduits en suivi régulier. Règlement sur facture, par Wero ou virement.",
};

const compris = [
  "Le schéma-bilan du chapitre travaillé",
  "La fiche de révision et la fiche méthode",
  "Un espace où déposer vos documents de travail",
  "Annulation gratuite jusqu'à 24 h avant",
];

const etapesReglement = [
  "Vous réservez et vous suivez vos cours, sans rien avancer.",
  "La facture du mois arrive par email, avec le détail des séances.",
  "Vous réglez par Wero ou par virement, sous 30 jours.",
];

export default function Tarifs() {
  return (
    <>
      <section style={{ paddingTop: 70 }}>
        <div className="conteneur-etroit" style={{ textAlign: "center" }}>
          <p className="surtitre">Tarifs</p>
          <h1 style={{ fontSize: 52, lineHeight: 1.1 }}>
            Simple, et <em className="accent">sans surprise</em>
          </h1>
          <p className="plomb" style={{ margin: "24px auto 0", maxWidth: 540 }}>
            Un tarif à l&apos;heure selon le niveau, réduit pour un suivi régulier.
            Aucun abonnement, aucun frais d&apos;inscription, et rien à payer sur le
            site.
          </p>
        </div>
      </section>

      <section style={{ paddingTop: 48 }}>
        <div className="conteneur-etroit">
          <div className="tableau-enveloppe">
            <div className="tableau-defilant">
              <table className="tarifs">
                <thead>
                  <tr>
                    <th scope="col">Niveau</th>
                    <th scope="col">À la séance</th>
                    <th scope="col">Suivi régulier</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      Collège et seconde
                      <span
                        style={{
                          display: "block",
                          marginTop: 5,
                          fontSize: 14,
                          color: "var(--texte-gris)",
                        }}
                      >
                        De la sixième à la seconde générale
                      </span>
                    </td>
                    <td>{euros(TARIFS_PAR_DEFAUT[0].seance)}</td>
                    <td>{euros(TARIFS_PAR_DEFAUT[0].regulier)}</td>
                  </tr>
                  <tr>
                    <td>
                      Première et terminale
                      <span
                        style={{
                          display: "block",
                          marginTop: 5,
                          fontSize: 14,
                          color: "var(--texte-gris)",
                        }}
                      >
                        Spécialité SVT comprise
                      </span>
                    </td>
                    <td>{euros(TARIFS_PAR_DEFAUT[1].seance)}</td>
                    <td>{euros(TARIFS_PAR_DEFAUT[1].regulier)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.6, color: "var(--texte-doux)" }}>
            <strong style={{ color: "var(--foret)" }}>Le suivi régulier</strong>{" "}
            s&apos;adresse aux élèves accompagnés sur plusieurs cours, dans la
            durée. On en fixe les modalités ensemble lors du premier échange, qui
            est gratuit.
          </p>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="conteneur-etroit">
          <h2 style={{ fontSize: 30, marginBottom: 24 }}>Compris dans l&apos;heure</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "18px 36px",
            }}
          >
            {compris.map((ligne) => (
              <div key={ligne} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <IconeCoche couleur="var(--or)" />
                <p style={{ fontSize: 15.5, lineHeight: 1.55 }}>{ligne}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 56 }}>
        <div className="conteneur-etroit">
          <div
            style={{
              background: "var(--creme-fonce)",
              border: "1px solid var(--bordure)",
              borderRadius: 6,
              padding: "34px 36px",
            }}
          >
            <h2 style={{ fontSize: 30, marginBottom: 18 }}>Le règlement</h2>
            <p className="plomb" style={{ marginBottom: 26 }}>
              Rien n&apos;est demandé au moment de la réservation. En fin de mois,
              je vous envoie une facture récapitulant les séances, à régler sous
              30 jours par Wero ou par virement.
            </p>
            <div className="grille-3">
              {etapesReglement.map((etape, i) => (
                <div key={etape}>
                  <p
                    style={{
                      fontFamily: "var(--serif)",
                      fontSize: 20,
                      fontStyle: "italic",
                      color: "var(--or)",
                      marginBottom: 8,
                    }}
                  >
                    {i + 1}
                  </p>
                  <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--texte-doux)" }}>
                    {etape}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "48px 0 70px" }}>
        <div className="conteneur-etroit">
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>
            Ce que comprend l&apos;heure
          </h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--texte-doux)" }}>
            La séance elle-même, mais aussi sa préparation : j&apos;arrive avec le
            support adapté au chapitre travaillé. Entre deux cours, vous pouvez
            m&apos;écrire pour une question qui bloque, un exercice à vérifier ou un
            devoir à relire. C&apos;est compris, et c&apos;est souvent là que se joue
            la progression.
          </p>
          <p style={{ marginTop: 28 }}>
            <Link href="/reserver" className="bouton bouton--principal">
              Réserver un créneau
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
