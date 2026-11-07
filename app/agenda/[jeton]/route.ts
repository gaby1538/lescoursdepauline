import { NextResponse } from "next/server";
import { clientAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * L'agenda des cours, au format iCalendar.
 *
 * Pauline s'abonne une fois depuis son téléphone ou Google Agenda, et
 * ses cours apparaissent à côté de ses rendez-vous. L'adresse contient
 * un jeton : quiconque l'obtient voit l'agenda, d'où la possibilité de
 * la régénérer depuis les réglages.
 */

const PLIAGE = 73; // octets utiles par ligne, hors retour chariot

/** iCalendar impose des lignes courtes, repliées par une espace. */
function plier(ligne: string): string {
  const octets = Buffer.from(ligne, "utf8");
  if (octets.length <= PLIAGE) return ligne;

  const morceaux: string[] = [];
  let debut = 0;
  while (debut < octets.length) {
    let fin = Math.min(debut + (debut === 0 ? PLIAGE : PLIAGE - 1), octets.length);
    // Ne pas couper au milieu d'un caractère multi-octets.
    while (fin < octets.length && (octets[fin] & 0xc0) === 0x80) fin -= 1;
    morceaux.push(
      (debut === 0 ? "" : " ") + octets.subarray(debut, fin).toString("utf8")
    );
    debut = fin;
  }
  return morceaux.join("\r\n");
}

function echapper(texte: string): string {
  return texte
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function horodatage(instant: string | Date): string {
  return new Date(instant).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

type Seance = {
  id: string;
  debut: string;
  fin: string;
  statut: string;
  validee_le: string | null;
  sujet: string | null;
  lien_visio: string | null;
  annulation_demandee_le: string | null;
  annulation_traitee_le: string | null;
  dossiers: {
    prenom: string | null;
    nom: string | null;
    email: string;
    eleve_prenom: string | null;
    eleve_classe: string | null;
  } | null;
};

export async function GET(
  _requete: Request,
  contexte: { params: Promise<{ jeton: string }> }
) {
  const { jeton } = await contexte.params;
  const nu = jeton.replace(/\.ics$/i, "");

  if (!/^[0-9a-f-]{36}$/i.test(nu)) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const supabase = clientAdmin();

  const { data: reglages } = await supabase
    .from("parametres")
    .select("jeton_agenda")
    .eq("id", true)
    .maybeSingle();

  if (!reglages || reglages.jeton_agenda !== nu) {
    return new NextResponse("Introuvable", { status: 404 });
  }

  const depuis = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const jusqua = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();

  const { data } = await supabase
    .from("reservations")
    .select(
      "id, debut, fin, statut, validee_le, sujet, lien_visio, annulation_demandee_le, annulation_traitee_le, dossiers (prenom, nom, email, eleve_prenom, eleve_classe)"
    )
    .in("statut", ["reservee", "effectuee"])
    .gte("debut", depuis)
    .lte("debut", jusqua)
    .order("debut");

  const seances = (data ?? []) as unknown as Seance[];
  const maintenant = horodatage(new Date());

  const lignes: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Les cours de Pauline//Agenda//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Cours de Pauline",
    "X-WR-TIMEZONE:Europe/Paris",
  ];

  for (const s of seances) {
    const eleve = s.dossiers?.eleve_prenom ?? "Élève";
    const classe = s.dossiers?.eleve_classe ? ` (${s.dossiers.eleve_classe})` : "";
    const enAttente = s.annulation_demandee_le && !s.annulation_traitee_le;
    // Une demande non validée figure quand même dans l'agenda : le créneau
    // est pris, et le voir évite de promettre la même heure ailleurs.
    const aValider = !s.validee_le;

    const details = [
      `Réservé par ${s.dossiers?.prenom ?? ""} ${s.dossiers?.nom ?? ""}`.trim(),
      s.dossiers?.email ?? "",
      s.sujet ? `Sujet : ${s.sujet}` : "",
      aValider ? "⚠ Demande en attente de votre validation." : "",
      enAttente ? "⚠ Annulation demandée, en attente de votre réponse." : "",
    ]
      .filter(Boolean)
      .join("\n");

    lignes.push(
      "BEGIN:VEVENT",
      plier(`UID:${s.id}@lescoursdepauline.com`),
      `DTSTAMP:${maintenant}`,
      `DTSTART:${horodatage(s.debut)}`,
      `DTEND:${horodatage(s.fin)}`,
      plier(
        `SUMMARY:${echapper(
          `${aValider ? "? " : enAttente ? "⚠ " : ""}SVT — ${eleve}${classe}${
            aValider ? " — à valider" : ""
          }`
        )}`
      ),
      plier(`DESCRIPTION:${echapper(details)}`),
      ...(s.lien_visio ? [plier(`LOCATION:${echapper(s.lien_visio)}`)] : []),
      `STATUS:${aValider ? "TENTATIVE" : "CONFIRMED"}`,
      "END:VEVENT"
    );
  }

  lignes.push("END:VCALENDAR");

  return new NextResponse(lignes.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "public, max-age=900",
      "content-disposition": 'inline; filename="cours-de-pauline.ics"',
    },
  });
}
