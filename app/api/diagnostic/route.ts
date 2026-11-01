import { NextResponse, type NextRequest } from "next/server";
import { clientAdmin } from "@/lib/supabase";
import { IDENTITE } from "@/lib/constantes";

/**
 * Point de contrôle temporaire de la chaîne d'envoi.
 *
 * GET /api/diagnostic          → l'état de la configuration, sans aucun secret
 * GET /api/diagnostic?envoi=1  → tente un vrai envoi et renvoie la réponse de Resend
 *
 * L'envoi ne part que vers l'adresse de Pauline, jamais vers une adresse
 * fournie dans l'URL, et il est plafonné à cinq tentatives par heure.
 * À supprimer une fois les emails en service.
 */

export const dynamic = "force-dynamic";

const REPLI_EXPEDITEUR = "Les cours de Pauline <contact@lescoursdepauline.com>";
const REPLI_SITE = "https://lescoursdepauline.com";

export async function GET(requete: NextRequest) {
  const cle = process.env.RESEND_API_KEY ?? "";
  const expediteur = process.env.EMAIL_EXPEDITEUR ?? REPLI_EXPEDITEUR;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? REPLI_SITE;

  const etat: Record<string, unknown> = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "inconnu",
    deploye_le: process.env.VERCEL_DEPLOYMENT_ID ? "vercel" : "local",
    resend_cle: cle
      ? `présente — ${cle.length} caractères, commence par « ${cle.slice(0, 3)} »`
      : "ABSENTE",
    expediteur: process.env.EMAIL_EXPEDITEUR
      ? expediteur
      : `${expediteur}  ⚠️ variable absente, valeur de repli`,
    site: process.env.NEXT_PUBLIC_SITE_URL
      ? site
      : `${site}  ⚠️ variable absente, valeur de repli`,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "présente" : "ABSENTE",
    supabase_service: process.env.SUPABASE_SERVICE_ROLE_KEY ? "présente" : "ABSENTE",
  };

  if (requete.nextUrl.searchParams.get("envoi") !== "1") {
    etat.envoi = "ajoutez ?envoi=1 à l'adresse pour tenter un envoi de test";
    return NextResponse.json(etat);
  }

  if (!cle) {
    etat.envoi = "impossible : RESEND_API_KEY absente de cet environnement";
    return NextResponse.json(etat);
  }

  // Garde-fou : cinq tests par heure, pas davantage.
  const supabase = clientAdmin();
  const uneHeure = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("journal")
    .select("id", { count: "exact", head: true })
    .eq("objet", "diagnostic")
    .gte("cree_le", uneHeure);

  if ((count ?? 0) >= 5) {
    etat.envoi = "plafond atteint : cinq tests par heure";
    return NextResponse.json(etat, { status: 429 });
  }

  let statut = 0;
  let corps = "";
  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: expediteur,
        to: [IDENTITE.email],
        subject: "Test d'envoi — Les cours de Pauline",
        html: "<p>Si vous lisez ceci, la chaîne Resend fonctionne de bout en bout.</p>",
      }),
    });
    statut = reponse.status;
    corps = (await reponse.text()).slice(0, 500);
  } catch (erreur) {
    corps = `exception : ${String(erreur).slice(0, 300)}`;
  }

  etat.envoi = { destinataire: IDENTITE.email, statut, reponse: corps };

  await supabase.from("journal").insert({
    acteur: "systeme",
    objet: "diagnostic",
    action: statut === 200 ? "test_envoye" : "test_echoue",
    details: { statut, reponse: corps.slice(0, 300) },
  });

  return NextResponse.json(etat);
}
