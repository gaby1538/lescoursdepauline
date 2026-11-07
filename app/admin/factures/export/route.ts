import { NextResponse, type NextRequest } from "next/server";
import { exigerAdmin } from "@/lib/admin";
import { livreDesRecettes } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET(requete: NextRequest) {
  await exigerAdmin();

  const demandee = requete.nextUrl.searchParams.get("annee") ?? "";
  const annee = /^\d{4}$/.test(demandee) ? demandee : String(new Date().getFullYear());

  try {
    const contenu = await livreDesRecettes(annee);
    return new NextResponse(contenu, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="recettes-${annee}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (erreur) {
    console.error("export comptable", erreur);
    return new NextResponse("Export impossible", { status: 500 });
  }
}
