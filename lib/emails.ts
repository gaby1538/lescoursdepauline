import "server-only";
import { IDENTITE } from "./constantes";
import { creneauLong, jourLong, blocLong, regrouperBlocs } from "./dates";

/**
 * Envoi par l'API Resend, en fetch direct — inutile d'ajouter une
 * dépendance pour deux requêtes POST.
 *
 * Si la clé n'est pas configurée, on journalise et on continue : une
 * réservation ne doit jamais échouer parce que l'email ne part pas.
 */

const API = "https://api.resend.com/emails";

export type ResultatEnvoi = { ok: boolean; detail: string };

async function envoyer(options: {
  destinataire: string;
  sujet: string;
  html: string;
  repondreA?: string;
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
  return `${creneaux.length} heures à partir du ${jourLong(creneaux[0].debut)}`;
}

export async function confirmationReservation(options: {
  destinataire: string;
  prenom: string;
  creneaux: Creneau[];
  lienVisio: string | null;
  lienConfirmation: string | null;
}): Promise<ResultatEnvoi> {
  const plusieurs = options.creneaux.length > 1;
  const quand = resumeCourt(options.creneaux);

  const blocVisio = options.lienVisio
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
    sujet: plusieurs ? `Vos cours de SVT — ${quand}` : `Votre cours de SVT — ${quand}`,
    html: gabarit(
      "C'est noté",
      `<p style="${P}">Bonjour ${options.prenom},</p>
       <p style="${P}">${
         plusieurs
           ? "Vos heures sont réservées, en visioconférence :"
           : "Votre cours est réservé, en visioconférence, pour une heure :"
       }</p>
       ${listeCreneaux(options.creneaux)}
       ${blocVisio}
       <p style="${P}">Vous pouvez annuler ou déplacer jusqu'à 24 heures avant
         ${plusieurs ? "chaque séance" : "la séance"}, sans frais. Au-delà, la séance
         est due.</p>
       <p style="${P}">Il n'y a rien à régler maintenant : je vous enverrai une
         facture en fin de mois.</p>
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
}): Promise<ResultatEnvoi> {
  return envoyer({
    destinataire: IDENTITE.email,
    sujet: `${options.premiere ? "Nouvel élève" : "Réservation"} — ${resumeCourt(
      options.creneaux
    )}`,
    html: gabarit(
      options.premiere ? "Un nouvel élève a réservé" : "Nouvelle réservation",
      `${listeCreneaux(options.creneaux)}
       <p style="${P}">
         ${options.prenomClient} ${options.nomClient} — ${options.emailClient}<br>
         Élève : ${options.eleve}, ${options.classe}
       </p>
       ${
         options.sujet
           ? `<p style="${P}">Ce qu'il souhaite travailler :<br><em>${options.sujet}</em></p>`
           : ""
       }
       ${
         options.premiere
           ? `<p style="${P}font-size:13px;color:#55604f;">Premier cours de ce dossier.
                Tant que l'adresse n'est pas confirmée, il ne peut pas réserver
                davantage.</p>`
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
