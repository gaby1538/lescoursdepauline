/** Tout est stocké en UTC, tout est affiché en heure de Paris. */

export const FUSEAU = "Europe/Paris";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Le lundi de la semaine contenant `date`, en heure de Paris, au format YYYY-MM-DD. */
export function lundiDeLaSemaine(date = new Date()): string {
  const paris = new Date(date.toLocaleString("en-US", { timeZone: FUSEAU }));
  const jour = (paris.getDay() + 6) % 7; // 0 = lundi
  paris.setDate(paris.getDate() - jour);
  return isoJour(paris);
}

export function isoJour(d: Date): string {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${a}-${m}-${j}`;
}

export function ajouterJours(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** « jeudi 12 novembre » */
export function jourLong(iso: string): string {
  // Une date invalide faisait lever Intl, et l'exception emportait la
  // page entière. Un tiret cadratin est un moindre mal qu'un écran blanc.
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    console.warn("jourLong : date invalide", iso);
    return "—";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

/** « lun. » et « 12 », pour l'en-tête d'une colonne du calendrier */
export function enteteJour(iso: string): { nom: string; numero: string } {
  const d = new Date(`${iso}T12:00:00Z`);
  return {
    nom: JOURS[(d.getUTCDay() + 6) % 7].slice(0, 3),
    numero: String(d.getUTCDate()),
  };
}

/** « 17:00 » à partir d'un timestamptz */
export function heure(instant: string): string {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) {
    console.warn("heure : instant invalide", instant);
    return "—";
  }
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU,
  }).format(d);
}

/** « jeudi 12 novembre à 17:00 » */
export function creneauLong(instant: string): string {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) {
    console.warn("creneauLong : instant invalide", instant);
    return "—";
  }
  const jour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: FUSEAU,
  }).format(d);
  return `${jour} à ${heure(instant)}`;
}

/** Le jour (YYYY-MM-DD, heure de Paris) auquel appartient un instant. */
export function jourDuCreneau(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: FUSEAU,
  }).format(new Date(instant));
}

/** « Semaine du 9 au 15 novembre » */
export function libelleSemaine(lundi: string): string {
  const dimanche = ajouterJours(lundi, 6);
  const d1 = new Date(`${lundi}T12:00:00Z`);
  const d2 = new Date(`${dimanche}T12:00:00Z`);
  const memeMois = d1.getUTCMonth() === d2.getUTCMonth();
  const fmtJour = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" });
  const fmtComplet = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return memeMois
    ? `Semaine du ${fmtJour.format(d1)} au ${fmtComplet.format(d2)}`
    : `Semaine du ${fmtComplet.format(d1)} au ${fmtComplet.format(d2)}`;
}

/**
 * Plusieurs heures qui s'enchaînent forment un seul cours. On les
 * regroupe pour les annoncer comme tel : « mardi 3 novembre, 10:00 à
 * 12:00 » plutôt que deux lignes qui se suivent.
 */
export type Bloc = { debut: string; fin: string; heures: number };

export function regrouperBlocs(
  creneaux: { debut: string; fin: string }[]
): Bloc[] {
  const tries = [...creneaux].sort((a, b) => a.debut.localeCompare(b.debut));
  const blocs: Bloc[] = [];

  for (const c of tries) {
    const dernier = blocs[blocs.length - 1];
    if (dernier && dernier.fin === c.debut) {
      dernier.fin = c.fin;
      dernier.heures += 1;
    } else {
      blocs.push({ debut: c.debut, fin: c.fin, heures: 1 });
    }
  }
  return blocs;
}

/** « mardi 3 novembre, de 10:00 à 12:00 » */
export function blocLong(bloc: Bloc): string {
  // jourLong() attend une date (2026-11-03) et non un instant : on
  // formate ici directement, sans passer par elle.
  const jour = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: FUSEAU,
  }).format(new Date(bloc.debut));
  return `${jour}, de ${heure(bloc.debut)} à ${heure(bloc.fin)}`;
}

/** « 2 h » ou « 1 h » — pour les récapitulatifs courts. */
export function dureeCourte(heures: number): string {
  return `${heures} h`;
}

/**
 * Convertit une saisie « datetime-local » — qui n'a pas de fuseau — en
 * instant UTC, en la lisant comme une heure de Paris.
 *
 * On procède en deux passes : la première estime le décalage, la seconde
 * le vérifie à l'instant corrigé. Sans cela, les deux nuits de bascule
 * horaire décaleraient la saisie d'une heure.
 */
function decalageParis(instant: Date): number {
  const enUTC = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  const aParis = new Date(instant.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return aParis.getTime() - enUTC.getTime();
}

export function parisVersInstant(saisie: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(saisie)) return null;

  const vise = Date.parse(`${saisie}:00Z`);
  if (Number.isNaN(vise)) return null;

  let instant = vise - decalageParis(new Date(vise));

  // On vérifie en relisant : si l'instant trouvé ne se réaffiche pas
  // comme la saisie, on corrige de l'écart constaté. Deux tours
  // suffisent, y compris les nuits de changement d'heure.
  for (let essai = 0; essai < 3; essai += 1) {
    const relu = instantVersParis(new Date(instant).toISOString());
    if (relu === saisie) break;
    instant -= Date.parse(`${relu}:00Z`) - vise;
  }

  return new Date(instant).toISOString();
}

/** L'inverse, pour pré-remplir un champ « datetime-local ». */
export function instantVersParis(instant: string): string {
  const d = new Date(instant);
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return p.replace(" ", "T");
}

/** « novembre 2026 », pour les intitulés de facture. */
export function moisLong(jour: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(`${jour.slice(0, 10)}T12:00:00Z`));
}

/* ---------------------------------------------------------------------
   Calendrier mensuel
   ------------------------------------------------------------------ */

/** « 2026-11 » → le mois décalé de n mois. */
export function moisDecale(mois: string, n: number): string {
  const [annee, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(annee, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Le mois courant, en heure de Paris. */
export function moisCourant(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: FUSEAU,
  })
    .format(new Date())
    .slice(0, 7);
}

/**
 * Les jours à afficher pour un mois : du lundi de la première semaine au
 * dimanche de la dernière, afin que la grille soit toujours rectangulaire.
 */
export function grilleDuMois(mois: string): string[] {
  const [annee, m] = mois.split("-").map(Number);
  const premier = new Date(Date.UTC(annee, m - 1, 1));
  const dernier = new Date(Date.UTC(annee, m, 0));

  const debut = new Date(premier);
  debut.setUTCDate(debut.getUTCDate() - ((debut.getUTCDay() + 6) % 7));

  const fin = new Date(dernier);
  fin.setUTCDate(fin.getUTCDate() + (7 - ((fin.getUTCDay() + 6) % 7) - 1));

  const jours: string[] = [];
  for (let d = new Date(debut); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    jours.push(isoJour(d));
  }
  return jours;
}

/** « novembre 2026 » à partir de « 2026-11 ». */
export function nomDuMois(mois: string): string {
  return moisLong(`${mois}-01`);
}

/** Le quantième seul, pour une case du calendrier. */
export function quantieme(jour: string): string {
  return String(Number(jour.slice(8, 10)));
}

/** Le mois auquel appartient un jour, pour griser les jours voisins. */
export function moisDuJour(jour: string): string {
  return jour.slice(0, 7);
}
