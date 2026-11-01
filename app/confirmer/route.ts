import { NextResponse, type NextRequest } from "next/server";
import { clientAdmin } from "@/lib/supabase";

/**
 * Le lien envoyé dans l'email de confirmation.
 * Un clic suffit : il valide l'adresse et lève la limite d'un créneau.
 */
export async function GET(requete: NextRequest) {
  const token = requete.nextUrl.searchParams.get("token");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? requete.nextUrl.origin;

  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.redirect(`${site}/confirmer/resultat?etat=invalide`);
  }

  const supabase = clientAdmin();
  const { data, error } = await supabase
    .from("dossiers")
    .update({ email_confirme_le: new Date().toISOString() })
    .eq("token_confirmation", token)
    .eq("anonymise", false)
    .select("id, email_confirme_le")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.redirect(`${site}/confirmer/resultat?etat=invalide`);
  }

  await supabase.from("journal").insert({
    acteur: "client",
    dossier_id: data.id,
    objet: "dossier",
    action: "email_confirme",
  });

  return NextResponse.redirect(`${site}/confirmer/resultat?etat=ok`);
}
