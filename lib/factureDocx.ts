import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { euros } from "./constantes";
import { moisLong } from "./dates";

export type DonneesFacture = {
  numero: string | null;
  statut: string;
  emise_le: string | null;
  echeance_le: string | null;
  payee_le: string | null;
  periode_debut: string;
  total_cents: number;
  note: string | null;
  destinataire_nom: string | null;
  destinataire_adresse: string | null;
  lignes: {
    description: string | null;
    quantite: number;
    prix_unitaire_cents: number;
    total_cents: number;
  }[];
  emetteur: {
    exploitante: string | null;
    adresse_postale: string | null;
    siret: string | null;
    email_contact: string | null;
    iban: string | null;
    wero_telephone: string | null;
    delai_paiement_jours: number | null;
  };
  client: {
    prenom: string | null;
    nom: string | null;
    email: string | null;
    eleve_prenom: string | null;
    eleve_classe: string | null;
  } | null;
};

const VERT = "143A24";
const GRIS = "55604F";
const SANS_BORDURE = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function jour(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString("fr-FR") : "—";
}

function ligne(texte: string, options: { gris?: boolean; gras?: boolean } = {}) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: texte,
        size: options.gris ? 18 : 21,
        color: options.gris ? GRIS : "3C473A",
        bold: options.gras,
      }),
    ],
  });
}

function cellule(
  texte: string,
  options: { droite?: boolean; gras?: boolean; entete?: boolean } = {}
) {
  return new TableCell({
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    shading: options.entete ? { fill: "F0EBDF" } : undefined,
    children: [
      new Paragraph({
        alignment: options.droite ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: texte,
            size: options.entete ? 17 : 21,
            bold: options.gras || options.entete,
            color: options.entete ? GRIS : "3C473A",
          }),
        ],
      }),
    ],
  });
}


/**
 * La même facture, en document Word.
 *
 * Elle n'existe que pour le cas tordu : une mention à ajouter pour un
 * employeur, un intitulé à reformuler, quelque chose que l'écran de
 * facturation ne prévoit pas. La facture du site reste la référence —
 * c'est elle qui porte le numéro, c'est elle que la comptabilité
 * retient, et la modifier ici ne la modifie pas là-bas.
 */
export async function factureEnWord(f: DonneesFacture): Promise<Buffer> {
  const p = f.emetteur;
  const client = f.client;
  const facture = f;
  const lignes = f.lignes;
  const destinataire =
    facture.destinataire_nom ??
    `${client?.prenom ?? ""} ${client?.nom ?? ""}`.trim();

  const colonnes = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cellule("Prestation", { entete: true }),
          cellule("Quantité", { entete: true, droite: true }),
          cellule("Prix unitaire", { entete: true, droite: true }),
          cellule("Total", { entete: true, droite: true }),
        ],
      }),
      ...(lignes ?? []).map(
        (l) =>
          new TableRow({
            children: [
              cellule(l.description ?? ""),
              cellule(String(Number(l.quantite)), { droite: true }),
              cellule(euros(l.prix_unitaire_cents), { droite: true }),
              cellule(euros(l.total_cents), { droite: true }),
            ],
          })
      ),
      new TableRow({
        children: [
          cellule(""),
          cellule(""),
          cellule("Total à régler", { gras: true, droite: true }),
          cellule(euros(facture.total_cents), { gras: true, droite: true }),
        ],
      }),
    ],
  });

  // L'en-tête tient dans un tableau sans bordure : c'est la seule façon
  // fiable de placer deux blocs côte à côte dans un .docx.
  const entete = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SANS_BORDURE,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: SANS_BORDURE,
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: "Les cours de Pauline",
                    size: 30,
                    bold: true,
                    color: VERT,
                  }),
                ],
              }),
              ligne(p?.exploitante ?? "", { gris: true }),
              ...String(p?.adresse_postale ?? "")
                .split("\n")
                .filter(Boolean)
                .map((l) => ligne(l, { gris: true })),
              ligne(`SIRET ${p?.siret ?? ""}`, { gris: true }),
              ligne(p?.email_contact ?? "", { gris: true }),
            ],
          }),
          new TableCell({
            borders: SANS_BORDURE,
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: facture.statut === "brouillon" ? "BROUILLON" : "FACTURE",
                    size: 17,
                    color: GRIS,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: facture.numero ?? "sans numéro",
                    size: 32,
                    bold: true,
                    color: VERT,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Émise le ${jour(facture.emise_le)}`,
                    size: 18,
                    color: GRIS,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Échéance ${jour(facture.echeance_le)}`,
                    size: 18,
                    color: GRIS,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const document = new Document({
    creator: "Les cours de Pauline",
    title: `Facture ${facture.numero ?? ""}`.trim(),
    sections: [
      {
        properties: {
          page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } },
        },
        children: [
          entete,
          new Paragraph({ text: "", spacing: { after: 300 } }),

          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 80 },
            children: [new TextRun({ text: "Facturé à", size: 17, color: GRIS })],
          }),
          ligne(destinataire || "—"),
          ...String(facture.destinataire_adresse ?? "")
            .split("\n")
            .filter(Boolean)
            .map((l) => ligne(l)),
          ligne(client?.email ?? ""),
          new Paragraph({ text: "", spacing: { after: 120 } }),

          ligne(
            `Élève : ${client?.eleve_prenom ?? "—"}${
              client?.eleve_classe ? ` (${client.eleve_classe})` : ""
            }`,
            { gris: true }
          ),
          ligne(`Période : ${moisLong(facture.periode_debut)}`, { gris: true }),
          new Paragraph({ text: "", spacing: { after: 300 } }),

          colonnes,
          new Paragraph({ text: "", spacing: { after: 240 } }),

          ...(facture.note ? [ligne(facture.note), new Paragraph({ text: "" })] : []),

          ligne("TVA non applicable, article 293 B du CGI.", { gris: true }),
          new Paragraph({ text: "", spacing: { after: 200 } }),

          ligne("Règlement", { gras: true }),
          ligne(`Par virement${p?.iban ? ` — IBAN ${p.iban}` : ""}`, { gris: true }),
          ...(p?.wero_telephone
            ? [ligne(`Par Wero au ${p.wero_telephone}`, { gris: true })]
            : []),
          ligne(
            `Payable sous ${p?.delai_paiement_jours ?? 30} jours.${
              facture.payee_le ? ` Réglée le ${jour(facture.payee_le)}.` : ""
            }`,
            { gris: true }
          ),
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}
