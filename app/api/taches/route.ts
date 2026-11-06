import { NextResponse, type NextRequest } from "next/server";
import { clientAdmin } from "@/lib/supabase";
import { rappelSeance } from "@/lib/emails";

export const dynamic = "force-dynamic";

/**
 * Les tâches régulières, appelées de l'extérieur par un planificateur.
 *
 * Deux choses : garder le projet Supabase éveillé — le plan gratuit le
 * met en pause après sept jours sans requête, et le site tombe alors en
 * entier — et envoyer les rappels avant les séances.
 *
 * L'appel est protégé par un secret partagé. Sans lui, n'importe qui
 * pourrait déclencher les envois en boucle.
 */
export async function GET(requete: NextRequest) {
  const attendu = process.env.CLE_TACHES;
  const fourni =
    requete.headers.get("x-cle-taches") ??
    requete.nextUrl.searchParams.get("cle") ??
    "";

  // Deux refus distincts, parce qu'ils se corrigent différemment et que
  // « accès refusé » ne disait pas lequel des deux.
  if (!attendu) {
    return new NextResponse(
      "La variable CLE_TACHES n'existe pas sur ce déploiement. " +
        "Ajoutez-la dans Vercel, puis redéployez.",
      { status: 503 }
    );
  }

  if (fourni !== attendu) {
    return new NextResponse(
      "Clé refusée : celle envoyée ne correspond pas à CLE_TACHES.",
      { status: 403 }
    );
  }

  const supabase = clientAdmin();
  const journal: Record<string, unknown> = { a: new Date().toISOString() };

  // --- 1. Réveil : une requête suffit à remettre le compteur à zéro ---
  const { count, error: erreurReveil } = await supabase
    .from("parametres")
    .select("id", { count: "exact", head: true });

  journal.reveil = erreurReveil ? `échec : ${erreurReveil.message}` : `ok (${count})`;
  if (erreurReveil) {
    return NextResponse.json(journal, { status: 500 });
  }

  await supabase.rpc("purger_limites");

  // --- 2. Rappels ----------------------------------------------------
  const { data: reglages } = await supabase
    .from("parametres")
    .select("rappel_actif, rappel_minutes")
    .eq("id", true)
    .maybeSingle();

  if (!reglages?.rappel_actif) {
    journal.rappels = "désactivés";
    return NextResponse.json(journal);
  }

  const minutes = reglages.rappel_minutes ?? 30;
  const maintenant = Date.now();
  const limite = new Date(maintenant + minutes * 60_000).toISOString();

  const { data: seances } = await supabase
    .from("reservations")
    .select("id, debut, lien_visio, dossiers (email, prenom, eleve_prenom)")
    .eq("statut", "reservee")
    .is("rappel_envoye_le", null)
    .gte("debut", new Date(maintenant).toISOString())
    .lte("debut", limite)
    .order("debut");

  let envoyes = 0;
  let echecs = 0;

  for (const seance of seances ?? []) {
    const dossier = seance.dossiers as unknown as {
      email: string;
      prenom: string | null;
      eleve_prenom: string | null;
    } | null;
    if (!dossier) continue;

    const resultat = await rappelSeance({
      destinataire: dossier.email,
      prenom: dossier.prenom ?? "",
      eleve: dossier.eleve_prenom ?? "votre élève",
      debut: seance.debut,
      minutes: Math.max(1, Math.round((Date.parse(seance.debut) - maintenant) / 60000)),
      lienVisio: seance.lien_visio,
    });

    // Marqué dans tous les cas : mieux vaut un rappel manqué qu'un
    // rappel renvoyé toutes les dix minutes jusqu'au cours.
    await supabase
      .from("reservations")
      .update({ rappel_envoye_le: new Date().toISOString() })
      .eq("id", seance.id);

    if (resultat.ok) envoyes += 1;
    else echecs += 1;
  }

  journal.rappels = { candidats: seances?.length ?? 0, envoyes, echecs };

  if (envoyes > 0 || echecs > 0) {
    await supabase.from("journal").insert({
      acteur: "systeme",
      objet: "rappel",
      action: echecs === 0 ? "envoyes" : "partiels",
      details: journal.rappels as Record<string, unknown>,
    });
  }

  return NextResponse.json(journal);
}
