import type { MetadataRoute } from "next";

/**
 * Tant que SITE_PUBLIC ne vaut pas « 1 », le site demande aux moteurs
 * de ne pas l'indexer.
 *
 * Le domaine peut ainsi être branché et éprouvé en vraie grandeur sans
 * qu'une version inachevée se retrouve dans les résultats de recherche
 * — Google découvre les domaines tout seul, par les registres de
 * certificats, sans que personne ne lui ait donné l'adresse.
 */
export default function robots(): MetadataRoute.Robots {
  const ouvert = process.env.SITE_PUBLIC === "1";

  if (!ouvert) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Rien de personnel n'a à figurer dans un moteur de recherche.
        disallow: ["/admin", "/mon-espace", "/factures", "/documents", "/agenda", "/api"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
