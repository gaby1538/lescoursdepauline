import { NextResponse } from "next/server";
import { clientAdmin } from "@/lib/supabase";
import { exigerAdmin } from "@/lib/admin";
import { factureEnWord, type DonneesFacture } from "@/lib/factureDocx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ id: string }> }
) {
  await exigerAdmin();

  const { id } = await contexte.params;
  const supabase = clientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!facture) return new NextResponse("Introuvable", { status: 404 });

  const [{ data: lignes }, { data: p }, { data: client }] = await Promise.all([
    supabase
      .from("lignes_facture")
      .select("description, quantite, prix_unitaire_cents, total_cents")
      .eq("facture_id", id)
      .order("ordre"),
    supabase.from("parametres").select("*").eq("id", true).maybeSingle(),
    supabase
      .from("dossiers")
      .select("prenom, nom, email, eleve_prenom, eleve_classe")
      .eq("id", facture.dossier_id)
      .maybeSingle(),
  ]);

  const contenu = await factureEnWord({
    ...(facture as DonneesFacture),
    lignes: (lignes ?? []).map((l) => ({
      description: l.description,
      quantite: Number(l.quantite),
      prix_unitaire_cents: l.prix_unitaire_cents,
      total_cents: l.total_cents,
    })),
    emetteur: {
      exploitante: p?.exploitante ?? null,
      adresse_postale: p?.adresse_postale ?? null,
      siret: p?.siret ?? null,
      email_contact: p?.email_contact ?? null,
      iban: p?.iban ?? null,
      wero_telephone: p?.wero_telephone ?? null,
      delai_paiement_jours: p?.delai_paiement_jours ?? null,
    },
    client: client ?? null,
  });

  const nom = `facture-${(facture.numero ?? id).replace(/[^\w-]/g, "-")}.docx`;

  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${nom}"`,
      "cache-control": "no-store",
    },
  });
}
