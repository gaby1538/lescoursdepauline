import "server-only";
import { clientAdmin } from "./supabase";
import { sauvegardeMensuelle } from "./emails";
import { livreDesRecettes, copieDesDonnees } from "./export";
import { jourDuCreneau } from "./dates";

type ReglagesSauvegarde = {
  sauvegarde_active?: boolean | null;
  sauvegarde_email?: string | null;
  sauvegarde_envoyee_le?: string | null;
  email_contact?: string | null;
} | null;

/**
 * Une fois par mois, le livre des recettes et une copie des données
 * partent par email.
 *
 * La base est en formule gratuite, donc sans sauvegarde téléchargeable.
 * Une boîte mail n'est pas un coffre-fort, mais elle a deux qualités
 * décisives ici : elle est ailleurs, et personne n'a à y penser.
 */
export async function envoyerSauvegarde(
  reglages: ReglagesSauvegarde,
  forcer = false
): Promise<string> {
  if (!reglages?.sauvegarde_active) return "désactivée";

  const supabase = clientAdmin();
  const aujourdhui = jourDuCreneau(new Date().toISOString());
  const mois = aujourdhui.slice(0, 7);

  // Le premier passage du mois, quel que soit le jour : un envoi calé
  // sur le 1er serait manqué si la tâche ne tournait pas ce jour-là.
  if (!forcer && reglages.sauvegarde_envoyee_le?.slice(0, 7) === mois) {
    return "déjà envoyée";
  }

  const annee = aujourdhui.slice(0, 4);

  try {
    const [recettes, donnees] = await Promise.all([
      livreDesRecettes(annee),
      copieDesDonnees(),
    ]);

    const copie = JSON.parse(donnees) as {
      factures: unknown[];
      dossiers: unknown[];
    };

    const resultat = await sauvegardeMensuelle({
      destinataire:
        reglages.sauvegarde_email ??
        reglages.email_contact ??
        "contact.capsvt@gmail.com",
      annee,
      factures: copie.factures.length,
      dossiers: copie.dossiers.length,
      pieces: [
        { nom: `recettes-${annee}.csv`, contenu: recettes },
        { nom: `donnees-${aujourdhui}.json`, contenu: donnees },
      ],
    });

    // Marquée même en cas d'échec : sinon la tentative repartirait
    // toutes les dix minutes pendant un mois.
    await supabase
      .from("parametres")
      .update({ sauvegarde_envoyee_le: aujourdhui })
      .eq("id", true);

    await supabase.from("journal").insert({
      acteur: "systeme",
      objet: "sauvegarde",
      action: resultat.ok ? "envoyee" : "echouee",
      details: { mois, detail: resultat.detail },
    });

    return resultat.ok ? "envoyée" : `échec : ${resultat.detail}`;
  } catch (erreur) {
    console.error("sauvegarde", erreur);
    return `échec : ${String(erreur).slice(0, 120)}`;
  }
}
