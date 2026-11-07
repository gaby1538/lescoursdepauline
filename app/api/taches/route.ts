import { NextResponse, type NextRequest } from "next/server";
import { clientAdmin } from "@/lib/supabase";
import { rappelSeance, recapitulatifHebdomadaire } from "@/lib/emails";
import { envoyerSauvegarde } from "@/lib/sauvegarde";
import { jourDuCreneau } from "@/lib/dates";
import { euros } from "@/lib/constantes";

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
    .select(
      "rappel_actif, rappel_minutes, recap_actif, recap_envoye_le, email_contact, sauvegarde_active, sauvegarde_email, sauvegarde_envoyee_le"
    )
    .eq("id", true)
    .maybeSingle();

  // --- 3. Récapitulatif du lundi ------------------------------------
  journal.recap = await envoyerRecapitulatif(reglages);

  // --- 4. Sauvegarde du premier du mois -----------------------------
  journal.sauvegarde = await envoyerSauvegarde(reglages);

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

type Reglages = {
  recap_actif?: boolean | null;
  recap_envoye_le?: string | null;
  email_contact?: string | null;
} | null;

/**
 * Le lundi, un état des lieux. La tâche s'exécute toutes les dix
 * minutes : c'est la date du dernier envoi qui empêche de le répéter.
 *
 * Il part même quand il n'y a rien à signaler. C'est voulu : tant que
 * Pauline le reçoit, elle sait que le site tourne et que les emails
 * sortent. Un silence devient alors un signal.
 */
async function envoyerRecapitulatif(reglages: Reglages): Promise<string> {
  if (!reglages?.recap_actif) return "désactivé";

  const supabase = clientAdmin();
  const maintenant = new Date();
  const aujourdhui = jourDuCreneau(maintenant.toISOString());

  const jour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    weekday: "short",
  }).format(maintenant);

  if (jour !== "Mon") return "pas aujourd'hui";
  if (reglages.recap_envoye_le === aujourdhui) return "déjà envoyé";

  const instant = maintenant.toISOString();
  const ilYAUneSemaine = new Date(
    maintenant.getTime() - 7 * 24 * 3600 * 1000
  ).toISOString();
  const dansUneSemaine = new Date(
    maintenant.getTime() + 7 * 24 * 3600 * 1000
  ).toISOString();

  const [semaine, aValider, annulations, retards, echecs] = await Promise.all([
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "reservee")
      .gte("debut", instant)
      .lte("debut", dansUneSemaine),
    supabase
      .from("reservations")
      .select("debut, dossiers (eleve_prenom)")
      .eq("statut", "reservee")
      .lt("debut", instant)
      .order("debut")
      .limit(20),
    supabase
      .from("reservations")
      .select("debut, dossiers (eleve_prenom)")
      .eq("statut", "reservee")
      .not("annulation_demandee_le", "is", null)
      .is("annulation_traitee_le", null)
      .order("debut")
      .limit(20),
    supabase
      .from("factures")
      .select("numero, total_cents, dossiers (eleve_prenom)")
      .in("statut", ["envoyee", "en_retard"])
      .lt("echeance_le", aujourdhui)
      .limit(20),
    supabase
      .from("journal")
      .select("id", { count: "exact", head: true })
      .eq("objet", "email")
      .like("action", "%echou%")
      .gte("cree_le", ilYAUneSemaine),
  ]);

  const nom = (ligne: { dossiers?: unknown }) =>
    ((ligne.dossiers as { eleve_prenom?: string | null } | null)?.eleve_prenom) ??
    "élève";

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  const resultat = await recapitulatifHebdomadaire({
    destinataire: reglages.email_contact ?? "contact.capsvt@gmail.com",
    coursSemaine: semaine.count ?? 0,
    aValider: (aValider.data ?? []).map((r) => ({ debut: r.debut, eleve: nom(r) })),
    annulations: (annulations.data ?? []).map((r) => ({
      debut: r.debut,
      eleve: nom(r),
    })),
    facturesEnRetard: (retards.data ?? []).map((f) => ({
      numero: f.numero ?? "—",
      montant: euros(f.total_cents),
      eleve: nom(f),
    })),
    emailsEnEchec: echecs.count ?? 0,
    lien: `${site}/admin`,
  });

  // Marqué même en cas d'échec : mieux vaut un récapitulatif manqué
  // qu'une tentative toutes les dix minutes toute la journée.
  await supabase
    .from("parametres")
    .update({ recap_envoye_le: aujourdhui })
    .eq("id", true);

  return resultat.ok ? "envoyé" : `échec : ${resultat.detail}`;
}
