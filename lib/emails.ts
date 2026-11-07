import "server-only";
import { IDENTITE } from "./constantes";
import {
  creneauLong,
  jourLong,
  jourDuCreneau,
  blocLong,
  regrouperBlocs,
  heure,
} from "./dates";

/**
 * Envoi par l'API Resend, en fetch direct — inutile d'ajouter une
 * dépendance pour deux requêtes POST.
 *
 * Si la clé n'est pas configurée, on journalise et on continue : une
 * réservation ne doit jamais échouer parce que l'email ne part pas.
 */

const API = "https://api.resend.com/emails";

export type ResultatEnvoi = { ok: boolean; detail: string };

export type PieceJointe = { nom: string; contenu: string };

async function envoyer(options: {
  destinataire: string;
  sujet: string;
  html: string;
  repondreA?: string;
  pieces?: PieceJointe[];
}): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY;
  const expediteur =
    process.env.EMAIL_EXPEDITEUR ??
    `Les cours de Pauline <contact@lescoursdepauline.com>`;

  if (!cle) {
    console.warn("[email] RESEND_API_KEY absente — non envoyé :", options.sujet);
    return { ok: false, detail: "cle_absente" };
  }

  try {
    const reponse = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: expediteur,
        to: [options.destinataire],
        subject: options.sujet,
        html: options.html,
        reply_to: options.repondreA ?? IDENTITE.email,
        ...(options.pieces && options.pieces.length > 0
          ? {
              attachments: options.pieces.map((p) => ({
                filename: p.nom,
                content: Buffer.from(p.contenu, "utf8").toString("base64"),
              })),
            }
          : {}),
      }),
    });

    const corps = await reponse.text();

    if (!reponse.ok) {
      console.error("[email] refusé par Resend", reponse.status, corps);
      return { ok: false, detail: `resend_${reponse.status}: ${corps.slice(0, 300)}` };
    }

    let id = "";
    try {
      id = (JSON.parse(corps) as { id?: string }).id ?? "";
    } catch {
      /* réponse inattendue mais acceptée : on garde l'essentiel */
    }
    console.log("[email] envoyé", options.sujet, id);
    return { ok: true, detail: id };
  } catch (erreur) {
    console.error("[email] Resend injoignable", erreur);
    return { ok: false, detail: `injoignable: ${String(erreur).slice(0, 300)}` };
  }
}

// ---------------------------------------------------------------------
//  Gabarit commun
// ---------------------------------------------------------------------

function gabarit(titre: string, corps: string): string {
  return `
<!doctype html>
<html lang="fr"><body style="margin:0;background:#f5f1e8;padding:32px 16px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
  color:#3c473a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fcfaf5;
        border:1px solid #e2dbca;border-radius:6px;" cellpadding="0" cellspacing="0">
        <tr><td style="padding:32px 32px 0;">
          <p style="margin:0;font-size:20px;color:#143a24;">
            Les cours de <span style="color:#8a5e0c;">Pauline</span>
          </p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#143a24;">${titre}</h1>
          ${corps}
        </td></tr>
      </table>
      <p style="max-width:560px;margin:20px auto 0;font-size:12px;color:#55604f;text-align:center;">
        ${IDENTITE.raisonSociale} — ${IDENTITE.exploitante} · SIRET ${IDENTITE.siret}<br>
        ${IDENTITE.email} · ${IDENTITE.telephoneAffiche}
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function bouton(lien: string, libelle: string): string {
  return `<p style="margin:24px 0;">
    <a href="${lien}" style="display:inline-block;background:#143a24;color:#ffffff;
      text-decoration:none;padding:14px 26px;border-radius:4px;font-size:14px;
      font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${libelle}</a>
  </p>`;
}

const P = `margin:0 0 14px;font-size:15px;line-height:1.6;`;

// ---------------------------------------------------------------------
//  Les messages
// ---------------------------------------------------------------------

type Creneau = { debut: string; fin: string };

/** Les heures retenues, les suites regroupées en un seul cours long. */
function listeCreneaux(creneaux: Creneau[]): string {
  const lignes = regrouperBlocs(creneaux)
    .map(
      (bloc) =>
        `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;">${blocLong(bloc)}${
          bloc.heures > 1
            ? ` <strong style="color:#8a5e0c;">(${bloc.heures} h d'affilée)</strong>`
            : ""
        }</li>`
    )
    .join("");
  return `<ul style="margin:0 0 16px;padding-left:20px;">${lignes}</ul>`;
}

function resumeCourt(creneaux: Creneau[]): string {
  if (creneaux.length <= 1) return creneauLong(creneaux[0].debut);
  return `${creneaux.length} heures à partir du ${jourLong(
    jourDuCreneau(creneaux[0].debut)
  )}`;
}

/**
 * Les textes saisis à la main finissent dans du HTML : on les échappe,
 * sans quoi une apostrophe typographique passe mais un « < » casse la
 * mise en page de l'email.
 */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function confirmationReservation(options: {
  destinataire: string;
  prenom: string;
  creneaux: Creneau[];
  lienVisio: string | null;
  lienConfirmation: string | null;
  enAttente: boolean;
}): Promise<ResultatEnvoi> {
  const plusieurs = options.creneaux.length > 1;
  const quand = resumeCourt(options.creneaux);

  const blocVisio = options.enAttente
    ? ""
    : options.lienVisio
      ? `<p style="${P}">Le lien pour nous retrouver :<br>
           <a href="${options.lienVisio}" style="color:#8a5e0c;">${options.lienVisio}</a></p>`
      : `<p style="${P}">Je vous enverrai le lien de connexion avant la séance.</p>`;

  const blocConfirmation = options.lienConfirmation
    ? `<hr style="border:none;border-top:1px solid #ede7d9;margin:28px 0;">
       <p style="${P}"><strong>Créez votre espace, c'est l'affaire d'un clic.</strong>
         Le lien ci-dessous confirme votre adresse et vous laisse choisir un mot de
         passe. Vos coordonnées sont alors retenues : pour réserver un prochain cours,
         il vous suffira de choisir un créneau, sans retaper quoi que ce soit.</p>
       ${bouton(options.lienConfirmation, "Créer mon espace")}
       <p style="${P}font-size:13px;color:#55604f;">Vous y retrouverez vos cours à
         venir et passés, les documents échangés pendant les séances et vos factures.
         Si vous préférez vous en passer, le même lien confirme simplement votre
         adresse, ce qui suffit pour réserver d'autres cours.</p>`
    : "";

  return envoyer({
    destinataire: options.destinataire,
    sujet: options.enAttente
      ? plusieurs
        ? `Votre demande de cours — ${quand}`
        : `Votre demande de cours — ${quand}`
      : plusieurs
        ? `Vos cours de SVT — ${quand}`
        : `Votre cours de SVT — ${quand}`,
    html: gabarit(
      options.enAttente ? "J'ai bien reçu votre demande" : "C'est noté",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       <p style="${P}">${
         options.enAttente
           ? plusieurs
             ? "J'ai bien reçu votre demande pour ces heures :"
             : "J'ai bien reçu votre demande pour ce créneau :"
           : plusieurs
             ? "Vos heures sont réservées, en visioconférence :"
             : "Votre cours est réservé, en visioconférence, pour une heure :"
       }</p>
       ${listeCreneaux(options.creneaux)}
       ${blocVisio}
       ${
         options.enAttente
           ? `<p style="${P}">Le créneau vous est gardé le temps que je vous réponde.
                Je confirme en général dans la journée, et vous recevrez un email dès
                que ce sera fait. Rien n'est définitif avant cette réponse, et rien ne
                vous sera facturé si je ne peux pas assurer le cours.</p>`
           : ""
       }
       <p style="${P}">Une fois ${
         options.enAttente ? "le cours confirmé, vous pourrez" : "réservé, vous pouvez"
       } annuler sans frais jusqu'à 24 heures avant
         ${plusieurs ? "chaque séance" : "la séance"}. Au-delà, la séance est due.${
           plusieurs
             ? " Vous pouvez aussi demander à n'en garder qu'une partie."
             : ""
         } Tout se fait depuis votre espace, et je vous réponds par email.</p>
       <p style="${P}">Il n'y a rien à régler maintenant : je vous enverrai une
         facture en fin de mois, payable par virement.</p>
       ${blocConfirmation}
       <p style="${P}">À bientôt,<br>Pauline</p>`
    ),
  });
}

export async function alerteNouvelleReservation(options: {
  prenomClient: string;
  nomClient: string;
  emailClient: string;
  eleve: string;
  classe: string;
  creneaux: Creneau[];
  sujet: string | null;
  premiere: boolean;
  enAttente: boolean;
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: IDENTITE.email,
    sujet: `${
      options.enAttente
        ? options.premiere
          ? "Demande d'un nouvel élève"
          : "Demande de cours"
        : options.premiere
          ? "Nouvel élève"
          : "Réservation"
    } — ${resumeCourt(options.creneaux)}`,
    html: gabarit(
      options.enAttente
        ? options.premiere
          ? "Un nouvel élève demande un cours"
          : "Une demande attend votre réponse"
        : options.premiere
          ? "Un nouvel élève a réservé"
          : "Nouvelle réservation",
      `${listeCreneaux(options.creneaux)}
       <p style="${P}">
         ${options.prenomClient} ${options.nomClient} — ${options.emailClient}<br>
         Élève : ${options.eleve}, ${options.classe}
       </p>
       ${
         options.sujet
           ? `<p style="${P}">Ce qu'il souhaite travailler :<br><em>${echapper(
               options.sujet
             )}</em></p>`
           : ""
       }
       ${
         options.premiere
           ? `<p style="${P}font-size:13px;color:#55604f;">Premier cours de ce dossier.
                Tant que l'adresse n'est pas confirmée, il ne peut pas réserver
                davantage.</p>`
           : ""
       }
       ${
         options.enAttente
           ? `<p style="${P}">Le créneau est gardé en attendant votre réponse. L'élève
                a reçu un accusé de réception, pas une confirmation.</p>
              ${bouton(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com"}/admin`, "Répondre à la demande")}`
           : ""
       }`
    ),
  });
}

export async function bienvenueCompte(options: {
  destinataire: string;
  prenom: string;
  lien: string;
  dossierExistant: boolean;
}): Promise<ResultatEnvoi> {
  const rappel = options.dossierExistant
    ? `<p style="${P}">Vous aviez déjà réservé avec cette adresse : vos cours passés
         et à venir seront rattachés automatiquement à votre espace.</p>`
    : "";

  return envoyer({
    destinataire: options.destinataire,
    sujet: "Activez votre espace — Les cours de Pauline",
    html: gabarit(
      "Plus qu'une étape",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       <p style="${P}">Voici le lien qui active votre espace. Il confirme votre adresse
         et vous laisse choisir votre mot de passe.</p>
       ${bouton(options.lien, "Choisir mon mot de passe")}
       ${rappel}
       <p style="${P}font-size:13px;color:#55604f;">Si vous n'êtes pas à l'origine de
         cette demande, ignorez ce message : sans ce clic, aucun compte n'est créé.</p>
       <p style="${P}">À bientôt,<br>Pauline</p>`
    ),
  });
}

export async function reinitialisationMotDePasse(options: {
  destinataire: string;
  prenom: string;
  lien: string;
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: options.destinataire,
    sujet: "Votre nouveau mot de passe — Les cours de Pauline",
    html: gabarit(
      "Choisissez un nouveau mot de passe",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       <p style="${P}">Ce lien vous permet de définir un nouveau mot de passe pour
         votre espace.</p>
       ${bouton(options.lien, "Changer mon mot de passe")}
       <p style="${P}font-size:13px;color:#55604f;">Il ne fonctionne qu'une fois. Si
         vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel
         reste valable.</p>
       <p style="${P}">À bientôt,<br>Pauline</p>`
    ),
  });
}

export async function factureEmise(options: {
  destinataire: string;
  prenom: string;
  numero: string;
  totalCentimes: number;
  echeance: string;
  lien: string;
  heures: number;
  periode: string;
}): Promise<ResultatEnvoi> {
  const montant = `${(options.totalCentimes / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: options.totalCentimes % 100 === 0 ? 0 : 2,
  })} €`;

  return envoyer({
    destinataire: options.destinataire,
    sujet: `Facture ${options.numero} — Les cours de Pauline`,
    html: gabarit(
      `Facture ${options.numero}`,
      `<p style="${P}">Bonjour ${options.prenom},</p>
       <p style="${P}">Voici la facture des cours de ${options.periode} :
         <strong>${options.heures} heure${options.heures > 1 ? "s" : ""}</strong>,
         soit <strong>${montant}</strong>.</p>
       <p style="${P}">Elle est à régler avant le <strong>${options.echeance}</strong>,
         par virement ou par Wero. Les coordonnées figurent sur la facture.</p>
       ${bouton(options.lien, "Voir ma facture")}
       <p style="${P}font-size:13px;color:#55604f;">La facture reste disponible dans
         votre espace élève, avec toutes les précédentes.</p>
       <p style="${P}">Merci,<br>Pauline</p>`
    ),
  });
}

export async function nouveauDocument(options: {
  destinataire: string;
  prenom: string;
  nomFichier: string;
  lien: string;
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: options.destinataire,
    sujet: "Un document vous attend — Les cours de Pauline",
    html: gabarit(
      "Nouveau document",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       <p style="${P}">Je viens de déposer <strong>${options.nomFichier}</strong> dans
         votre espace. Vous pouvez le consulter et le télécharger quand vous voulez.</p>
       ${bouton(options.lien, "Voir mon espace")}
       <p style="${P}font-size:13px;color:#55604f;">Les documents restent disponibles
         dans votre espace, avec les précédents.</p>
       <p style="${P}">À bientôt,<br>Pauline</p>`
    ),
  });
}

export async function demandeAnnulation(options: {
  prenomClient: string;
  eleve: string;
  debut: string;
  motif: string | null;
  horsDelai: boolean;
  lien: string;
  /** Renseigné quand l'élève veut raccourcir le cours au lieu de l'annuler. */
  reduction?: {
    avant: number;
    apres: number;
    debutCours: string;
  } | null;
}): Promise<ResultatEnvoi> {
  const r = options.reduction;

  return envoyer({
    destinataire: IDENTITE.email,
    sujet: r
      ? `Demande de réduction — ${creneauLong(r.debutCours)}`
      : `Demande d'annulation — ${creneauLong(options.debut)}`,
    html: gabarit(
      r ? "Une réduction d'heures est demandée" : "Une annulation est demandée",
      `<p style="${P}"><strong>${creneauLong(
         r ? r.debutCours : options.debut
       )}</strong><br>
         ${options.prenomClient} — élève : ${options.eleve}</p>
       ${
         r
           ? `<p style="${P}">Le cours passerait de <strong>${r.avant} heures</strong>
                à <strong>${r.apres} heure${r.apres > 1 ? "s" : ""}</strong>. Les
                heures retirées commencent à ${heure(options.debut)}.</p>`
           : ""
       }
       ${
         options.motif
           ? `<p style="${P}">Motif indiqué :<br><em>${options.motif}</em></p>`
           : `<p style="${P}">Aucun motif indiqué.</p>`
       }
       <p style="${P}">${
         options.horsDelai
           ? `<strong>Demande hors délai.</strong> Si vous l'acceptez, ${
               r ? "les heures retirées seront comptées" : "la séance sera comptée"
             } comme annulée${r ? "s" : ""} tardivement, donc facturable${r ? "s" : ""}.`
           : `Demande dans les délais. Acceptée, ${
               r ? "les heures retirées ne seront pas facturées" : "la séance ne sera pas facturée"
             }.`
       }</p>
       ${bouton(options.lien, "Répondre à la demande")}
       <p style="${P}font-size:13px;color:#55604f;">${
         r ? "Les heures restent réservées" : "Le créneau reste réservé"
       } tant que vous n'avez pas répondu.</p>`
    ),
  });
}

export async function reponseAnnulation(options: {
  destinataire: string;
  prenom: string;
  debut: string;
  acceptee: boolean;
  facturable: boolean;
  reponse: string | null;
  /** Renseigné quand la demande portait sur un raccourcissement. */
  reduction?: { heures: number; restantes: number } | null;
}): Promise<ResultatEnvoi> {
  const quand = creneauLong(options.debut);
  const r = options.reduction;
  const h = r ? `${r.heures} heure${r.heures > 1 ? "s" : ""}` : "";

  return envoyer({
    destinataire: options.destinataire,
    sujet: options.acceptee
      ? r
        ? `Cours raccourci — ${quand}`
        : `Annulation confirmée — ${quand}`
      : r
        ? `Votre cours garde sa durée — ${quand}`
        : `Votre cours est maintenu — ${quand}`,
    html: gabarit(
      options.acceptee
        ? r
          ? "C'est raccourci"
          : "C'est annulé"
        : r
          ? "Le cours garde sa durée"
          : "Le cours est maintenu",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       ${
         options.acceptee
           ? r
             ? `<p style="${P}">J'ai retiré ${h} à votre cours.${
                 r.restantes > 0
                   ? ` Il commence comme prévu et dure maintenant ${r.restantes} heure${
                       r.restantes > 1 ? "s" : ""
                     }.`
                   : ""
               }</p>
                <p style="${P}">${
                  options.facturable
                    ? `La demande étant arrivée à moins de 24 heures du cours, ${h} ${
                        r.heures > 1 ? "restent dues" : "reste due"
                      } et figurera sur votre facture.`
                    : `${h} ${r.heures > 1 ? "ne vous seront pas facturées" : "ne vous sera pas facturée"}.`
                }</p>`
             : `<p style="${P}">Votre cours du <strong>${quand}</strong> est annulé.</p>
                <p style="${P}">${
                  options.facturable
                    ? "La demande étant arrivée à moins de 24 heures de la séance, celle-ci reste due et figurera sur votre facture."
                    : "Rien ne vous sera facturé pour cette séance."
                }</p>`
           : r
             ? `<p style="${P}">Je n'ai pas pu retirer ${h} au cours du
                  <strong>${quand}</strong>. Il garde donc sa durée.</p>`
             : `<p style="${P}">Je n'ai pas pu accepter l'annulation du cours du
                  <strong>${quand}</strong>. Il reste donc prévu.</p>`
       }
       ${
         options.reponse
           ? `<p style="${P}">Mon message :<br><em>${echapper(options.reponse)}</em></p>`
           : ""
       }
       <p style="${P}">À bientôt,<br>Pauline</p>`
    ),
  });
}

export async function rappelSeance(options: {
  destinataire: string;
  prenom: string;
  eleve: string;
  debut: string;
  minutes: number;
  lienVisio: string | null;
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: options.destinataire,
    sujet: `Cours de SVT dans ${options.minutes} minutes`,
    html: gabarit(
      "C'est bientôt",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       <p style="${P}">Le cours de ${options.eleve} commence à
         <strong>${heure(options.debut)}</strong>, dans ${options.minutes} minutes.</p>
       ${
         options.lienVisio
           ? bouton(options.lienVisio, "Rejoindre le cours")
           : `<p style="${P}">Je vous envoie le lien de connexion juste avant.</p>`
       }
       <p style="${P}font-size:13px;color:#55604f;">Pensez à avoir de quoi écrire et le
         chapitre travaillé sous les yeux.</p>
       <p style="${P}">À tout de suite,<br>Pauline</p>`
    ),
  });
}

export async function recapitulatifHebdomadaire(options: {
  destinataire: string;
  coursSemaine: number;
  demandes: { debut: string; eleve: string }[];
  aValider: { debut: string; eleve: string }[];
  annulations: { debut: string; eleve: string }[];
  facturesEnRetard: { numero: string; montant: string; eleve: string }[];
  emailsEnEchec: number;
  lien: string;
}): Promise<ResultatEnvoi> {
  const liste = (titre: string, elements: string[]) =>
    elements.length === 0
      ? ""
      : `<p style="${P}"><strong>${titre}</strong></p>
         <ul style="margin:0 0 16px;padding-left:20px;">
           ${elements
             .map(
               (e) =>
                 `<li style="margin:0 0 6px;font-size:15px;line-height:1.5;">${e}</li>`
             )
             .join("")}
         </ul>`;

  const riens =
    options.demandes.length === 0 &&
    options.aValider.length === 0 &&
    options.annulations.length === 0 &&
    options.facturesEnRetard.length === 0 &&
    options.emailsEnEchec === 0;

  return envoyer({
    destinataire: options.destinataire,
    sujet: riens
      ? "Rien à signaler — Les cours de Pauline"
      : "Votre semaine — Les cours de Pauline",
    html: gabarit(
      "Votre lundi",
      `<p style="${P}">${
        options.coursSemaine === 0
          ? "Aucun cours programmé cette semaine."
          : options.coursSemaine === 1
            ? "Un cours est programmé cette semaine."
            : `${options.coursSemaine} cours sont programmés cette semaine.`
      }</p>

       ${liste(
         "Demandes de cours sans réponse — un élève attend",
         options.demandes.map((s) => `${creneauLong(s.debut)} — ${s.eleve}`)
       )}

       ${liste(
         "Séances passées encore à valider",
         options.aValider.map((s) => `${creneauLong(s.debut)} — ${s.eleve}`)
       )}

       ${liste(
         "Demandes d'annulation sans réponse",
         options.annulations.map((s) => `${creneauLong(s.debut)} — ${s.eleve}`)
       )}

       ${liste(
         "Factures en retard de paiement",
         options.facturesEnRetard.map(
           (f) => `${f.numero} — ${f.eleve}, ${f.montant}`
         )
       )}

       ${
         options.emailsEnEchec > 0
           ? `<p style="${P}"><strong>${options.emailsEnEchec} email${
               options.emailsEnEchec > 1 ? "s ne sont" : " n'est"
             } pas parti${
               options.emailsEnEchec > 1 ? "s" : ""
             } cette semaine.</strong> C'est le signal qu'il faut vérifier Resend.</p>`
           : ""
       }

       ${
         riens
           ? `<p style="${P}">Rien ne demande votre attention. Ce message vous
                parvient quand même chaque lundi : tant que vous le recevez, le site
                tourne et les emails partent.</p>`
           : bouton(options.lien, "Ouvrir l'administration")
       }`
    ),
  });
}

export async function sauvegardeMensuelle(options: {
  destinataire: string;
  annee: string;
  pieces: PieceJointe[];
  factures: number;
  dossiers: number;
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: options.destinataire,
    sujet: `Sauvegarde du ${new Date().toLocaleDateString("fr-FR")} — Les cours de Pauline`,
    pieces: options.pieces,
    html: gabarit(
      "Votre sauvegarde",
      `<p style="${P}">Deux fichiers sont joints à ce message.</p>
       <p style="${P}"><strong>Le livre des recettes ${options.annee}</strong> —
         ${options.factures} facture${options.factures > 1 ? "s" : ""} émise${
           options.factures > 1 ? "s" : ""
         }, avec les dates d'encaissement et les modes de règlement. Il s'ouvre dans
         un tableur. C'est la pièce à conserver dix ans, et à transmettre si on vous
         la demande.</p>
       <p style="${P}"><strong>Une copie des données</strong> — ${options.dossiers}
         dossier${options.dossiers > 1 ? "s" : ""} élève, les cours et les factures.
         Elle ne se lit pas à l'œil nu, mais elle permettrait de tout reconstituer si
         la base venait à disparaître.</p>
       <p style="${P}font-size:13px;color:#55604f;">Gardez ce message : tant qu'il
         reste dans votre boîte, vos pièces comptables existent ailleurs que sur le
         site. Le prochain partira le mois prochain.</p>`
    ),
  });
}

/**
 * Réponse de Pauline à une demande de cours.
 *
 * Un seul envoi couvre les deux cas : l'élève attend une réponse, et
 * recevoir « acceptée » ou « refusée » dans le même fil lui évite de
 * chercher lequel des deux emails est le plus récent.
 */
export async function reponseDemande(options: {
  destinataire: string;
  prenom: string;
  creneaux: Creneau[];
  acceptee: boolean;
  motif: string | null;
}): Promise<ResultatEnvoi> {
  const plusieurs = options.creneaux.length > 1;
  const quand = resumeCourt(options.creneaux);

  return envoyer({
    destinataire: options.destinataire,
    sujet: options.acceptee
      ? `C'est confirmé — ${quand}`
      : `Je ne peux pas assurer ce cours — ${quand}`,
    html: gabarit(
      options.acceptee ? "C'est confirmé" : "Je suis désolée",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       ${
         options.acceptee
           ? `<p style="${P}">${
               plusieurs ? "Vos heures sont confirmées" : "Votre cours est confirmé"
             }, en visioconférence :</p>
              ${listeCreneaux(options.creneaux)}
              <p style="${P}">Je vous enverrai le lien de connexion avant la séance.</p>
              <p style="${P}">Vous pouvez annuler ou déplacer jusqu'à 24 heures avant
                ${plusieurs ? "chaque séance" : "la séance"}, sans frais. Au-delà, la
                séance est due.</p>
              <p style="${P}">Il n'y a rien à régler maintenant : je vous enverrai une
                facture en fin de mois.</p>`
           : `<p style="${P}">Je ne peux pas assurer ${
               plusieurs ? "les heures" : "le créneau"
             } que vous avez demandé :</p>
              ${listeCreneaux(options.creneaux)}
              <p style="${P}">Le créneau est de nouveau libre, et rien ne vous est
                facturé. N'hésitez pas à en choisir un autre : je serai ravie de vous
                retrouver.</p>`
       }
       ${
         options.motif
           ? `<p style="${P}">Mon message :<br><em>${echapper(options.motif)}</em></p>`
           : ""
       }
       <p style="${P}">À bientôt,<br>Pauline</p>`
    ),
  });
}

/** Une demande de déplacement, pour Pauline. */
export async function demandeDeplacement(options: {
  prenomClient: string;
  eleve: string;
  ancien: { debut: string; fin: string; heures: number };
  nouveau: { debut: string; fin: string; heures: number };
  motif: string | null;
  horsDelai: boolean;
  lien: string;
}): Promise<ResultatEnvoi> {
  const avant = blocLong(options.ancien);
  const apres = blocLong(options.nouveau);

  return envoyer({
    destinataire: IDENTITE.email,
    sujet: `Demande de modification — ${creneauLong(options.ancien.debut)}`,
    html: gabarit(
      "Un cours doit être déplacé",
      `<p style="${P}">${options.prenomClient} — élève : ${options.eleve}</p>

       <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;">
         <tr>
           <td style="padding:12px 14px;background:#f5f1e8;border-radius:4px;">
             <span style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#55604f;">Aujourd'hui</span><br>
             <strong style="color:#143a24;">${avant}</strong>
             <span style="color:#55604f;"> — ${options.ancien.heures} h</span>
           </td>
         </tr>
         <tr><td style="height:8px;"></td></tr>
         <tr>
           <td style="padding:12px 14px;background:#fdf6e4;border-radius:4px;border-left:3px solid #e8c87a;">
             <span style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a5e0c;">Demandé</span><br>
             <strong style="color:#143a24;">${apres}</strong>
             <span style="color:#55604f;"> — ${options.nouveau.heures} h</span>
           </td>
         </tr>
       </table>

       ${
         options.motif
           ? `<p style="${P}">Motif indiqué :<br><em>${echapper(options.motif)}</em></p>`
           : ""
       }
       <p style="${P}">Le nouveau créneau est déjà retenu : personne d'autre ne peut
         le prendre. L'ancien reste occupé tant que vous n'avez pas répondu, et il
         n'est libéré qu'en cas d'acceptation.</p>
       <p style="${P}">${
         options.horsDelai
           ? "<strong>Demande hors délai.</strong> Si vous l'acceptez, l'heure libérée n'est pas facturée pour autant : le cours n'est pas perdu, il change de place. Si cela ne vous convient pas, refusez."
           : "Demande dans les délais."
       }</p>
       ${bouton(options.lien, "Répondre à la demande")}`
    ),
  });
}

/** La réponse de Pauline à une demande de déplacement. */
export async function reponseDeplacement(options: {
  destinataire: string;
  prenom: string;
  ancien: { debut: string; fin: string; heures: number };
  nouveau: { debut: string; fin: string; heures: number };
  acceptee: boolean;
  reponse: string | null;
}): Promise<ResultatEnvoi> {
  const avant = blocLong(options.ancien);
  const apres = blocLong(options.nouveau);

  return envoyer({
    destinataire: options.destinataire,
    sujet: options.acceptee
      ? `Cours déplacé — ${creneauLong(options.nouveau.debut)}`
      : `Votre cours ne change pas — ${creneauLong(options.ancien.debut)}`,
    html: gabarit(
      options.acceptee ? "C'est déplacé" : "Le cours reste à sa place",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       ${
         options.acceptee
           ? `<p style="${P}">Votre cours a bien été déplacé. Il a désormais lieu :</p>
              <p style="${P}font-size:18px;color:#143a24;"><strong>${apres}</strong>
                ${options.nouveau.heures > 1 ? ` — ${options.nouveau.heures} heures` : ""}</p>
              <p style="${P}">L'ancien créneau du ${avant} est libéré, et ne vous est
                pas facturé.</p>
              <p style="${P}">Vous pouvez annuler ou déplacer à nouveau jusqu'à
                24 heures avant la séance. Je vous enverrai le lien de connexion avant
                le cours.</p>`
           : `<p style="${P}">Je n'ai pas pu déplacer votre cours au ${apres}.</p>
              <p style="${P}">Il reste donc prévu comme avant :</p>
              <p style="${P}font-size:18px;color:#143a24;"><strong>${avant}</strong></p>`
       }
       ${
         options.reponse
           ? `<p style="${P}">Mon message :<br><em>${echapper(options.reponse)}</em></p>`
           : ""
       }
       <p style="${P}">À bientôt,<br>Pauline</p>`
    ),
  });
}
