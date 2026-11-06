import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";
  const maj = new Date();

  return [
    { url: site, lastModified: maj, priority: 1 },
    { url: `${site}/tarifs`, lastModified: maj, priority: 0.8 },
    { url: `${site}/reserver`, lastModified: maj, priority: 0.9 },
    { url: `${site}/creer-un-compte`, lastModified: maj, priority: 0.5 },
    { url: `${site}/mentions-legales`, lastModified: maj, priority: 0.1 },
    { url: `${site}/cgv`, lastModified: maj, priority: 0.1 },
    { url: `${site}/confidentialite`, lastModified: maj, priority: 0.1 },
  ];
}
