/**
 * Les valeurs qui ne bougeront pas, ou qui ne bougent qu'avec un commit.
 * Tout ce que Pauline doit pouvoir changer seule vit dans la table
 * `parametres` de la base, pas ici.
 */

export const IDENTITE = {
  raisonSociale: "Les cours de Pauline",
  exploitante: "Pauline Mattern",
  siret: "108 427 196 00010",
  email: "contact.capsvt@gmail.com",
  telephone: "+33667910490",
  telephoneAffiche: "06 67 91 04 90",
  whatsapp: "https://wa.me/33667910490",
} as const;

/**
 * Ce que réclament les pages légales. L'adresse de l'entreprise est
 * obligatoire dans les mentions légales : tant qu'elle est vide, la page
 * affiche un avertissement visible plutôt qu'une information inventée.
 */
export const LEGAL = {
  adresse: "",
  dateMaj: "3 novembre 2026",
  /** Région d'hébergement du projet Supabase, à vérifier dans le tableau
   *  de bord et à corriger ici si elle diffère. */
  regionDonnees: "Union européenne",
} as const;

export const GROUPES = {
  college_seconde: {
    libelle: "Collège et seconde",
    precision: "De la sixième à la seconde générale",
    classes: ["Sixième", "Cinquième", "Quatrième", "Troisième", "Seconde"],
  },
  premiere_terminale: {
    libelle: "Première et terminale",
    precision: "Spécialité SVT comprise",
    classes: ["Première spécialité SVT", "Terminale spécialité SVT"],
  },
} as const;

export type Groupe = keyof typeof GROUPES;

/** Repli d'affichage si la base n'est pas joignable. La source de vérité
 *  reste la table `tarifs`. */
export const TARIFS_PAR_DEFAUT = [
  { groupe: "college_seconde", seance: 4000, regulier: 3500 },
  { groupe: "premiere_terminale", seance: 4500, regulier: 3900 },
] as const;

export function euros(centimes: number): string {
  return `${(centimes / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: centimes % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} €`;
}
