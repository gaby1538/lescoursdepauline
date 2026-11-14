import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { clientAdmin } from "./supabase";
import { euros } from "./constantes";
import { moisLong } from "./dates";

/**
 * La facture en PDF, fabriquée en mémoire.
 *
 * Pas de navigateur sans interface : il pèse plus de cinquante
 * mégaoctets, démarre en plusieurs secondes et tombe au premier
 * changement de version. Un document d'une page se dessine très bien à
 * la main, et la fonction s'exécute en quelques millisecondes.
 *
 * Helvetica couvre les accents français par son encodage WinAnsi.
 * Seules les rares lettres hors de cette table seraient perdues : on
 * les remplace plutôt que de laisser la génération échouer.
 */

const VERT = rgb(0.078, 0.227, 0.141);
const GRIS = rgb(0.333, 0.376, 0.31);
const ENCRE = rgb(0.235, 0.278, 0.227);
const OR = rgb(0.541, 0.369, 0.047);
const FILET = rgb(0.886, 0.859, 0.792);
const BANDE = rgb(0.941, 0.922, 0.874);

const MARGE = 56;
const HAUT = 842; // A4 en points
const LARGE = 595;

/**
 * Helvetica est encodée en WinAnsi, qui couvre le latin-1 plus une
 * vingtaine de caractères — dont l'euro, les guillemets typographiques
 * et le tiret cadratin. Tout le reste ferait échouer la génération, et
 * se voit donc retiré.
 *
 * Le premier jet écartait tout ce qui dépassait le latin-1, euro
 * compris : les montants sortaient sans leur symbole.
 */
const EXTRAS_WINANSI =
  "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152" +
  "\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A" +
  "\u0153\u017E\u0178";

function lisible(texte: string): string {
  return texte
    .replace(/\u202f|\u00a0/g, " ")
    .split("")
    .map((c) => (c.charCodeAt(0) <= 0xff || EXTRAS_WINANSI.includes(c) ? c : ""))
    .join("");
}

type Plume = {
  page: PDFPage;
  normal: PDFFont;
  gras: PDFFont;
};

function ecrire(
  p: Plume,
  texte: string,
  x: number,
  y: number,
  options: { taille?: number; gras?: boolean; couleur?: typeof ENCRE; droite?: number } = {}
) {
  const taille = options.taille ?? 10;
  const police = options.gras ? p.gras : p.normal;
  const t = lisible(texte);
  const largeur = police.widthOfTextAtSize(t, taille);
  p.page.drawText(t, {
    x: options.droite !== undefined ? options.droite - largeur : x,
    y,
    size: taille,
    font: police,
    color: options.couleur ?? ENCRE,
  });
}

/** Découpe un texte à la largeur voulue, sans couper les mots. */
function lignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const sortie: string[] = [];
  for (const paragraphe of lisible(texte).split("\n")) {
    let courante = "";
    for (const mot of paragraphe.split(" ")) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) > largeur && courante) {
        sortie.push(courante);
        courante = mot;
      } else {
        courante = essai;
      }
    }
    sortie.push(courante);
  }
  return sortie;
}

export async function pdfDeFacture(
  id: string
): Promise<{ nom: string; contenu: Buffer }> {
  const supabase = clientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!facture) throw new Error("facture introuvable");

  const [{ data: lignesFacture }, { data: p }, { data: client }] = await Promise.all([
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

  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${facture.numero ?? ""}`.trim());
  doc.setAuthor(p?.exploitante ?? "Les cours de Pauline");
  doc.setProducer("lescoursdepauline.com");

  const page = doc.addPage([LARGE, HAUT]);
  const plume: Plume = {
    page,
    normal: await doc.embedFont(StandardFonts.Helvetica),
    gras: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const droite = LARGE - MARGE;
  let y = HAUT - MARGE;

  // ---- en-tête ----
  ecrire(plume, "Les cours de Pauline", MARGE, y, { taille: 17, gras: true, couleur: VERT });
  ecrire(plume, facture.statut === "brouillon" ? "BROUILLON" : "FACTURE", 0, y + 4, {
    taille: 8,
    couleur: GRIS,
    droite,
  });
  ecrire(plume, facture.numero ?? "sans numéro", 0, y - 14, {
    taille: 19,
    gras: true,
    couleur: VERT,
    droite,
  });

  y -= 34;
  const emetteur = [
    p?.exploitante,
    ...(p?.adresse_postale ?? "").split("\n"),
    p?.siret ? `SIRET ${p.siret}` : null,
    p?.email_contact,
  ].filter(Boolean) as string[];

  for (const ligne of emetteur) {
    ecrire(plume, ligne, MARGE, y, { taille: 9, couleur: GRIS });
    y -= 12;
  }

  const jour = (v: string | null) =>
    v ? new Date(v).toLocaleDateString("fr-FR") : "—";

  let yDroite = HAUT - MARGE - 38;
  ecrire(plume, `Émise le ${jour(facture.emise_le)}`, 0, yDroite, {
    taille: 9,
    couleur: GRIS,
    droite,
  });
  yDroite -= 12;
  ecrire(plume, `Échéance ${jour(facture.echeance_le)}`, 0, yDroite, {
    taille: 9,
    couleur: GRIS,
    droite,
  });

  y = Math.min(y, yDroite) - 20;
  page.drawLine({
    start: { x: MARGE, y },
    end: { x: droite, y },
    thickness: 0.7,
    color: FILET,
  });

  // ---- parties ----
  y -= 24;
  const depart = y;
  ecrire(plume, "FACTURÉ À", MARGE, y, { taille: 7.5, gras: true, couleur: OR });
  y -= 14;

  const destinataire =
    facture.destinataire_nom ??
    `${client?.prenom ?? ""} ${client?.nom ?? ""}`.trim();

  for (const ligne of [
    destinataire || "—",
    ...String(facture.destinataire_adresse ?? "").split("\n").filter(Boolean),
    client?.email ?? "",
  ].filter(Boolean)) {
    ecrire(plume, ligne, MARGE, y, { taille: 10 });
    y -= 13;
  }

  let yCol = depart;
  const colonne = MARGE + 250;
  ecrire(plume, "ÉLÈVE", colonne, yCol, { taille: 7.5, gras: true, couleur: OR });
  yCol -= 14;
  ecrire(plume, client?.eleve_prenom ?? "—", colonne, yCol, { taille: 10 });
  yCol -= 13;
  if (client?.eleve_classe) {
    ecrire(plume, client.eleve_classe, colonne, yCol, { taille: 9, couleur: GRIS });
    yCol -= 13;
  }

  let yPer = depart;
  const colonne2 = MARGE + 390;
  ecrire(plume, "PÉRIODE", colonne2, yPer, { taille: 7.5, gras: true, couleur: OR });
  yPer -= 14;
  ecrire(plume, moisLong(facture.periode_debut), colonne2, yPer, { taille: 10 });

  y = Math.min(y, yCol, yPer) - 26;

  // ---- tableau ----
  page.drawRectangle({
    x: MARGE,
    y: y - 6,
    width: droite - MARGE,
    height: 22,
    color: BANDE,
  });
  // Trois colonnes alignées à droite, assez espacées pour qu'un montant
  // à quatre chiffres ne vienne pas mordre la précédente.
  const finQte = MARGE + 344;
  const finPu = MARGE + 412;
  const finTotal = droite - 10;
  const largeurDesc = finQte - (MARGE + 10) - 46;

  ecrire(plume, "PRESTATION", MARGE + 10, y, { taille: 7.5, gras: true, couleur: GRIS });
  ecrire(plume, "QTÉ", 0, y, { taille: 7.5, gras: true, couleur: GRIS, droite: finQte });
  ecrire(plume, "PRIX UNIT.", 0, y, { taille: 7.5, gras: true, couleur: GRIS, droite: finPu });
  ecrire(plume, "TOTAL", 0, y, { taille: 7.5, gras: true, couleur: GRIS, droite: finTotal });

  y -= 24;

  for (const l of lignesFacture ?? []) {
    const enveloppe = lignes(l.description ?? "", plume.normal, 10, largeurDesc);
    for (let i = 0; i < enveloppe.length; i += 1) {
      ecrire(plume, enveloppe[i], MARGE + 10, y - i * 12, { taille: 10 });
    }
    ecrire(plume, String(Number(l.quantite)), 0, y, { taille: 10, droite: finQte });
    ecrire(plume, euros(l.prix_unitaire_cents), 0, y, { taille: 10, droite: finPu });
    ecrire(plume, euros(l.total_cents), 0, y, { taille: 10, droite: finTotal });

    // Le filet se place entre deux lignes, pas dans la suivante : il
    // faut qu'il reste sous les jambages de l'une et au-dessus des
    // hampes de l'autre, qui montent de sept points à cette taille.
    y -= Math.max(enveloppe.length, 1) * 12 + 14;
    page.drawLine({
      start: { x: MARGE, y: y + 10 },
      end: { x: droite, y: y + 10 },
      thickness: 0.5,
      color: FILET,
    });
  }

  // ---- total ----
  y -= 10;
  ecrire(plume, "Total à régler", 0, y, {
    taille: 10,
    gras: true,
    couleur: VERT,
    droite: finPu - 10,
  });
  ecrire(plume, euros(facture.total_cents), 0, y - 3, {
    taille: 15,
    gras: true,
    couleur: VERT,
    droite: finTotal,
  });

  // ---- mentions ----
  y -= 34;
  if (facture.note) {
    for (const ligne of lignes(facture.note, plume.normal, 9, droite - MARGE)) {
      ecrire(plume, ligne, MARGE, y, { taille: 9, couleur: ENCRE });
      y -= 12;
    }
    y -= 8;
  }

  ecrire(plume, "TVA non applicable, article 293 B du CGI.", MARGE, y, {
    taille: 9,
    couleur: GRIS,
  });

  y -= 26;
  ecrire(plume, "Règlement", MARGE, y, { taille: 10, gras: true, couleur: VERT });
  y -= 14;

  const reglement = [
    p?.iban ? `Par virement — IBAN ${p.iban}` : "Par virement",
    p?.wero_telephone ? `Par Wero au ${p.wero_telephone}` : null,
    `Payable sous ${p?.delai_paiement_jours ?? 30} jours.`,
    facture.payee_le ? `Réglée le ${jour(facture.payee_le)}.` : null,
  ].filter(Boolean) as string[];

  for (const ligne of reglement) {
    ecrire(plume, ligne, MARGE, y, { taille: 9, couleur: GRIS });
    y -= 12;
  }

  const octets = await doc.save();
  const nom = `facture-${(facture.numero ?? id).replace(/[^\w-]/g, "-")}.pdf`;

  return { nom, contenu: Buffer.from(octets) };
}
