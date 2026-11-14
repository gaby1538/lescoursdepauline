import { NextResponse } from "next/server";
import { exigerAdmin } from "@/lib/admin";
import { pdfDeFacture } from "@/lib/facturePdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** La facture en PDF, celle-là même qui part en pièce jointe. */
export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ id: string }> }
) {
  await exigerAdmin();

  const { id } = await contexte.params;

  try {
    const { nom, contenu } = await pdfDeFacture(id);
    return new NextResponse(new Uint8Array(contenu), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${nom}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("téléchargement PDF", e);
    return new NextResponse("Facture introuvable", { status: 404 });
  }
}
