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
  const d = new Date(`${iso}T12:00:00Z`);
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
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU,
  }).format(new Date(instant));
}

/** « jeudi 12 novembre à 17:00 » */
export function creneauLong(instant: string): string {
  const d = new Date(instant);
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
