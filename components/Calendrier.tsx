"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { reserver, type EtatReservation } from "@/app/reserver/actions";
import { heure, jourLong, quantieme, moisDuJour, isoJour } from "@/lib/dates";
import { GROUPES } from "@/lib/constantes";
import { Champ, ChampClasse, Alerte, etiquette, saisie } from "@/components/Champs";
import type { Creneau } from "@/lib/reservations";

export type CompteAffiche = {
  prenom: string | null;
  email: string;
  eleve_prenom: string | null;
  eleve_classe: string | null;
};

type Props = {
  mois: string;
  nomMois: string;
  jours: string[];
  creneauxParJour: Record<string, Creneau[]>;
  moisPrecedent: string | null;
  moisSuivant: string;
  compte: CompteAffiche | null;
};

const CLASSES = [
  ...GROUPES.college_seconde.classes,
  ...GROUPES.premiere_terminale.classes,
];
const JOURS_COURTS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const DUREES = [1, 2, 3];
const UNE_HEURE = 3_600_000;
const etatInitial: EtatReservation = { erreur: null };

export default function Calendrier({
  mois,
  nomMois,
  jours,
  creneauxParJour,
  moisPrecedent,
  moisSuivant,
  compte,
}: Props) {
  const [jourChoisi, setJourChoisi] = useState<string | null>(null);
  const [duree, setDuree] = useState(1);
  const [debutChoisi, setDebutChoisi] = useState<string | null>(null);
  const [etat, action, enCours] = useActionState(reserver, etatInitial);

  const aujourdhui = isoJour(new Date());

  /**
   * Une séance dure une heure et la grille avance de trente minutes :
   * deux heures de suite, ce sont donc deux créneaux dont les débuts
   * sont espacés d'exactement une heure. On ne peut pas se contenter
   * de compter, il faut vérifier la continuité.
   */
  const departs = useMemo(() => {
    const parJour: Record<string, Record<number, Creneau[]>> = {};

    for (const [jour, liste] of Object.entries(creneauxParJour)) {
      const instants = new Map(liste.map((c) => [Date.parse(c.debut), c]));
      parJour[jour] = {};

      for (const n of DUREES) {
        parJour[jour][n] = liste.filter((c) => {
          const depart = Date.parse(c.debut);
          for (let k = 1; k < n; k += 1) {
            if (!instants.has(depart + k * UNE_HEURE)) return false;
          }
          return true;
        });
      }
    }
    return parJour;
  }, [creneauxParJour]);

  const dureesDuJour = (jour: string) =>
    DUREES.filter((n) => (departs[jour]?.[n]?.length ?? 0) > 0);

  const heuresDuJour =
    jourChoisi ? departs[jourChoisi]?.[duree] ?? [] : [];

  const bloc = useMemo((): Creneau[] => {
    if (!jourChoisi || !debutChoisi) return [];
    const liste = creneauxParJour[jourChoisi] ?? [];
    const instants = new Map(liste.map((c) => [Date.parse(c.debut), c]));
    const depart = Date.parse(debutChoisi);
    const suite: Creneau[] = [];
    for (let k = 0; k < duree; k += 1) {
      const c = instants.get(depart + k * UNE_HEURE);
      if (!c) return [];
      suite.push(c);
    }
    return suite;
  }, [jourChoisi, debutChoisi, duree, creneauxParJour]);

  function choisirJour(jour: string) {
    setJourChoisi(jour);
    setDebutChoisi(null);
    const possibles = dureesDuJour(jour);
    if (!possibles.includes(duree)) setDuree(possibles[0] ?? 1);
  }

  function choisirDuree(n: number) {
    setDuree(n);
    // Le départ retenu ne tient peut-être plus sur la nouvelle durée.
    if (debutChoisi && jourChoisi) {
      const tient = (departs[jourChoisi]?.[n] ?? []).some((c) => c.debut === debutChoisi);
      if (!tient) setDebutChoisi(null);
    }
  }

  const finBloc = bloc.length > 0 ? bloc[bloc.length - 1].fin : null;

  return (
    <div>
      <div className="reservation">
        {/* ------------------------------------------------ Le calendrier */}
        <div className="carte calendrier">
          <div className="calendrier__tete">
            {moisPrecedent ? (
              <Link
                href={`/reserver?mois=${moisPrecedent}`}
                className="calendrier__fleche"
                aria-label="Mois précédent"
              >
                ‹
              </Link>
            ) : (
              <span className="calendrier__fleche calendrier__fleche--eteinte">‹</span>
            )}
            <p className="calendrier__mois">{nomMois}</p>
            <Link
              href={`/reserver?mois=${moisSuivant}`}
              className="calendrier__fleche"
              aria-label="Mois suivant"
            >
              ›
            </Link>
          </div>

          <div className="calendrier__grille" role="grid">
            {JOURS_COURTS.map((nom) => (
              <span key={nom} className="calendrier__entete">
                {nom}
              </span>
            ))}

            {jours.map((jour) => {
              const libre = (departs[jour]?.[1]?.length ?? 0) > 0;
              const horsMois = moisDuJour(jour) !== mois;
              const actif = jour === jourChoisi;
              return (
                <button
                  key={jour}
                  type="button"
                  disabled={!libre}
                  aria-pressed={actif}
                  aria-label={jourLong(jour)}
                  onClick={() => choisirJour(jour)}
                  className={[
                    "calendrier__jour",
                    libre ? "calendrier__jour--libre" : "",
                    actif ? "calendrier__jour--actif" : "",
                    horsMois ? "calendrier__jour--voisin" : "",
                    jour === aujourdhui ? "calendrier__jour--aujourdhui" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {quantieme(jour)}
                </button>
              );
            })}
          </div>

          <p className="calendrier__legende">
            Les jours en relief ont des créneaux libres. Heure de Paris.
          </p>
        </div>

        {/* ------------------------------------------- Durée puis horaires */}
        <div className="carte volet">
          {!jourChoisi ? (
            <div className="volet__attente">
              <p className="surtitre" style={{ marginBottom: 10 }}>
                Première étape
              </p>
              <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
                Choisissez un jour dans le calendrier. Je vous proposerai ensuite les
                durées possibles, puis les heures de début.
              </p>
            </div>
          ) : (
            <>
              <p className="surtitre" style={{ marginBottom: 14 }}>
                {jourLong(jourChoisi)}
              </p>

              <p className="volet__question">Combien de temps ?</p>
              <div className="durees">
                {DUREES.map((n) => {
                  const possible = (departs[jourChoisi]?.[n]?.length ?? 0) > 0;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={!possible}
                      aria-pressed={n === duree}
                      onClick={() => choisirDuree(n)}
                      className={`duree ${n === duree ? "duree--actif" : ""}`}
                    >
                      {n} h
                    </button>
                  );
                })}
              </div>

              <p className="volet__question" style={{ marginTop: 22 }}>
                À quelle heure ?
              </p>
              {heuresDuJour.length === 0 ? (
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--texte-gris)" }}>
                  Aucun créneau de cette durée ce jour-là. Essayez une durée plus
                  courte, ou un autre jour.
                </p>
              ) : (
                <div className="horaires">
                  {heuresDuJour.map((c) => (
                    <button
                      key={c.debut}
                      type="button"
                      aria-pressed={c.debut === debutChoisi}
                      onClick={() => setDebutChoisi(c.debut)}
                      className={`horaire ${c.debut === debutChoisi ? "horaire--actif" : ""}`}
                    >
                      {heure(c.debut)}
                    </button>
                  ))}
                </div>
              )}

              <p className="calendrier__legende" style={{ marginTop: 20 }}>
                Réservation jusqu&apos;à 24 h avant le cours, annulation gratuite dans
                le même délai.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ Formulaire */}
      {bloc.length > 0 && finBloc && (
        <div
          className="carte carte--retenue"
          style={{ marginTop: 24, maxWidth: 620, marginLeft: "auto", marginRight: "auto" }}
        >
          <form action={action}>
            {bloc.map((c) => (
              <input
                key={c.debut}
                type="hidden"
                name="creneaux"
                value={`${c.debut}|${c.fin}`}
              />
            ))}

            <div className="retenu">
              <div>
                <p className="surtitre" style={{ marginBottom: 6 }}>
                  Votre créneau
                </p>
                <p className="retenu__quand">
                  {jourLong(jourChoisi!)}, de {heure(bloc[0].debut)} à {heure(finBloc)}
                </p>
              </div>
              <span className="retenu__duree">{duree} h</span>
            </div>

            {compte ? (
              <div
                style={{
                  marginTop: 20,
                  background: "var(--creme-fonce)",
                  borderRadius: 4,
                  padding: "16px 18px",
                }}
              >
                <p className="surtitre" style={{ marginBottom: 6 }}>
                  Pour
                </p>
                <p
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 20,
                    color: "var(--foret)",
                  }}
                >
                  {compte.eleve_prenom}
                  {compte.eleve_classe ? `, ${compte.eleve_classe}` : ""}
                </p>
                <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--texte-gris)" }}>
                  Espace de {compte.email} · <Link href="/mon-espace">mon espace</Link>
                </p>
              </div>
            ) : (
              <div className="champs">
                <Champ nom="prenom" libelle="Votre prénom" requis />
                <Champ nom="nom" libelle="Votre nom" requis />
                <Champ
                  nom="email"
                  libelle="Votre email"
                  type="email"
                  requis
                  aide="Pour la confirmation et la facture"
                />
                <Champ nom="telephone" libelle="Votre téléphone" type="tel" />
                <Champ nom="eleve_prenom" libelle="Prénom de l'élève" requis />
                <ChampClasse classes={CLASSES} />
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label htmlFor="sujet" style={etiquette}>
                Sur quoi travailler ?{" "}
                <span style={{ fontWeight: 400, color: "var(--texte-gris)" }}>
                  (facultatif)
                </span>
              </label>
              <textarea
                id="sujet"
                name="sujet"
                rows={3}
                placeholder="Le chapitre sur la photosynthèse, un DS à préparer…"
                style={{ ...saisie, minHeight: 0, padding: "11px 14px", resize: "vertical" }}
              />
            </div>

            <div
              style={{
                marginTop: 20,
                background: "var(--creme-fonce)",
                borderRadius: 4,
                padding: "16px 18px",
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--texte-doux)",
              }}
            >
              <strong style={{ color: "var(--foret)" }}>Rien à payer maintenant.</strong>{" "}
              Le tarif horaire dépend du niveau —{" "}
              <Link href="/tarifs">voir les tarifs</Link>. La facture arrive en fin de
              mois, à régler sous 30 jours par Wero ou virement. Le premier échange est
              gratuit.
            </div>

            {etat.erreur && <Alerte>{etat.erreur}</Alerte>}

            <button
              type="submit"
              disabled={enCours}
              className="bouton bouton--principal"
              style={{ marginTop: 20, width: "100%", opacity: enCours ? 0.6 : 1 }}
            >
              {enCours ? "Enregistrement…" : "Confirmer la réservation"}
            </button>

            {!compte && (
              <p
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--texte-gris)",
                }}
              >
                Votre espace sera créé en un clic depuis l&apos;email de confirmation.
                Vous pouvez aussi{" "}
                <Link href="/creer-un-compte">le créer dès maintenant</Link>.
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
