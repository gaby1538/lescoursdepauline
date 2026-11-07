import DonneesStructurees from "@/components/DonneesStructurees";
import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import Entete from "@/components/Entete";
import Pied from "@/components/Pied";
import "./globals.css";

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--police-titre",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--police-texte",
  display: "swap",
});

// Ceinture et bretelles : l'en-tête accompagne le robots.txt, car
// certains robots ignorent l'un et respectent l'autre.
const INDEXABLE = process.env.SITE_PUBLIC === "1";

export const metadata: Metadata = {
  robots: INDEXABLE ? undefined : { index: false, follow: false },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com"
  ),
  // Le site répond aussi sur www. Sans cette balise, Google verrait deux
  // sites identiques et partagerait le classement entre les deux. Elle
  // désigne l'adresse sans www comme la seule qui compte, quelle que
  // soit celle par laquelle le visiteur est arrivé.
  alternates: { canonical: "./" },
  title: {
    default: "Les cours de Pauline — cours particuliers de SVT en visio",
    template: "%s — Les cours de Pauline",
  },
  description:
    "Cours particuliers de SVT en visioconférence, du collège à la terminale spécialité. " +
    "Pauline Mattern, professeure certifiée, CAPES depuis 2017. Premier échange gratuit.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "./",
    siteName: "Les cours de Pauline",
    title: "Comprendre pour réussir durablement",
    description:
      "Cours particuliers de SVT en visioconférence, du collège à la terminale spécialité.",
    images: ["/pauline.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <DonneesStructurees />
        <Entete />
        <main>{children}</main>
        <Pied />
      </body>
    </html>
  );
}
