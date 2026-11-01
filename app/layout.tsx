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

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com"
  ),
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
        <Entete />
        <main>{children}</main>
        <Pied />
      </body>
    </html>
  );
}
