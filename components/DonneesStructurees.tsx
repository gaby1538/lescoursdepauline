import { IDENTITE, TARIFS_PAR_DEFAUT } from "@/lib/constantes";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

/**
 * Ce que Google lit, et qu'un humain ne voit pas.
 *
 * Sans ces données, un moteur de recherche n'a que du texte : il ne sait
 * pas qu'il s'agit d'une enseignante certifiée, ni ce que coûte une
 * heure, ni qu'on peut réserver en ligne. Avec elles, il peut afficher
 * ces informations directement dans ses résultats.
 *
 * Tout ce qui est déclaré ici doit se retrouver à l'écran : annoncer un
 * prix que la page n'affiche pas est une faute que Google sanctionne.
 */
export default function DonneesStructurees() {
  const donnees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#site`,
        url: SITE,
        name: IDENTITE.raisonSociale,
        inLanguage: "fr-FR",
        publisher: { "@id": `${SITE}/#organisation` },
      },
      {
        "@type": "EducationalOrganization",
        "@id": `${SITE}/#organisation`,
        name: IDENTITE.raisonSociale,
        url: SITE,
        email: IDENTITE.email,
        telephone: IDENTITE.telephone,
        logo: `${SITE}/apple-icon.png`,
        image: `${SITE}/opengraph-image.png`,
        description:
          "Cours particuliers de SVT en visioconférence, du collège à la " +
          "terminale spécialité, assurés par une professeure certifiée.",
        address: {
          "@type": "PostalAddress",
          streetAddress: "245B route du Roucas Blanc",
          postalCode: "13007",
          addressLocality: "Marseille",
          addressCountry: "FR",
        },
        areaServed: { "@type": "Country", name: "France" },
        founder: { "@id": `${SITE}/#pauline` },
        employee: { "@id": `${SITE}/#pauline` },
        identifier: IDENTITE.siret,
      },
      {
        "@type": "Person",
        "@id": `${SITE}/#pauline`,
        name: IDENTITE.exploitante,
        jobTitle: "Professeure certifiée de SVT",
        description:
          "Professeure de sciences de la vie et de la Terre, titulaire du " +
          "CAPES depuis 2017.",
        hasCredential: {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "CAPES",
          name: "CAPES de sciences de la vie et de la Terre",
        },
        worksFor: { "@id": `${SITE}/#organisation` },
      },
      {
        "@type": "Service",
        "@id": `${SITE}/#cours`,
        name: "Cours particuliers de SVT en visioconférence",
        serviceType: "Soutien scolaire en SVT",
        provider: { "@id": `${SITE}/#organisation` },
        areaServed: { "@type": "Country", name: "France" },
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "student",
          audienceType: "Collégiens et lycéens",
        },
        availableChannel: {
          "@type": "ServiceChannel",
          serviceUrl: `${SITE}/reserver`,
          availableLanguage: { "@type": "Language", name: "Français" },
        },
        // Les mêmes montants que la grille affichée sur la page.
        offers: [
          {
            "@type": "Offer",
            name: "Collège et seconde — à la séance",
            price: (TARIFS_PAR_DEFAUT[0].seance / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: `${SITE}/tarifs`,
          },
          {
            "@type": "Offer",
            name: "Collège et seconde — suivi régulier",
            price: (TARIFS_PAR_DEFAUT[0].regulier / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: `${SITE}/tarifs`,
          },
          {
            "@type": "Offer",
            name: "Première et terminale — à la séance",
            price: (TARIFS_PAR_DEFAUT[1].seance / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: `${SITE}/tarifs`,
          },
          {
            "@type": "Offer",
            name: "Première et terminale — suivi régulier",
            price: (TARIFS_PAR_DEFAUT[1].regulier / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: `${SITE}/tarifs`,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees) }}
    />
  );
}
