"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { reserver, type EtatReservation } from "@/app/reserver/actions";
import {
  enteteJour,
  heure,
  libelleSemaine,
  jourLong,
  regrouperBlocs,
  blocLong,
  jourDuCreneau,
} from "@/lib/dates";
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
  lundi: string;
  jours: string[];
  creneauxParJour: Record<string, Creneau[]>;
  semainePrecedente: string | null;
  semaineSuivante: string;
  compte: CompteAffiche | null;
};

const CLASSES = [
  ...GROUPES.college_seconde.classes,
  ...GROUPES.premiere_terminale.classes,
];
const etatInitial: EtatReservation = { erreur: null };

/** La sélection survit au changement de semaine, qui recharge la page. */
const CLE = "lcp.creneaux-choisis";

function grouper(creneaux: Creneau[]) {
  const heureDe = (c: Creneau) => Number(heure(c.debut).slice(0, 2));
  return [
    { titre: "Matin", liste: creneaux.filter((c) => heureDe(c) < 12) },
    { titre: "Après-midi", liste: creneaux.filter((c) => heureDe(c) >= 12 && heureDe(c) < 18) },
    { titre: "Soir", liste: creneaux.filter((c) => heureDe(c) >= 18) },
  ].filter((g) => g.liste.length > 0);
}

export default function Calendrier({
  lundi,
  jours,
  creneauxParJour,
  semainePrecedente,
  semaineSuivante,
  compte,
}: Props) {
  const [jourDemande, setJourDemande] = useState<string | null>(null);
  const [choix, setChoix] = useState<Creneau[]>([]);
  const [etat, action, enCours] = useActionState(reserver, etatInitial);

  // Au retour d'un changement de semaine, on retrouve sa sélection. Les
  // créneaux devenus passés entre-temps sont écartés en silence.
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(CLE);
      if (!brut) return;
      const maintenant = new Date().toISOString();
      setChoix(
        (JSON.parse(brut) as Creneau[]).filter((c) => c?.debut && c.debut > maintenant)
      );
    } catch {
      /* navigation privée, stockage bloqué : on repart d'une liste vide */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLE, JSON.stringify(choix));
    } catch {
      /* sans conséquence : la sélection vit alors le temps de la page */
    }
  }, [choix]);

  const premierJourLibre = jours.find((j) => (creneauxParJour[j]?.length ?? 0) > 0);
  const jourChoisi =
    jourDemande && jours.includes(jourDemande) ? jourDemande : premierJourLibre ?? null;
  const creneauxDuJour = jourChoisi ? creneauxParJour[jourChoisi] ?? [] : [];

  const estChoisi = (c: Creneau) => choix.some((x) => x.debut === c.debut);

  /**
   * La grille avance de trente minutes alors qu'une séance dure une
   * heure : 10 h 00 et 10 h 30 se chevauchent. Dès qu'on retient l'un,
   * l'autre s'éteint — sinon on compose une sélection que la base
   * refusera, et le refus arriverait trop tard.
   */
  const estEmpeche = (c: Creneau) =>
    choix.some((x) => x.debut !== c.debut && x.debut < c.fin && x.fin > c.debut);

  function basculer(c: Creneau) {
    setChoix((liste) =>
      liste.some((x) => x.debut === c.debut)
        ? liste.filter((x) => x.debut !== c.debut)
        : [...liste, { debut: c.debut, fin: c.fin }]
    );
  }

  const blocs = regrouperBlocs(choix);
  const total = choix.length;

  return (
    <div>
      {/* ------------------------------------------------ Barre de semaine */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 24 }}>{libelleSemaine(lundi)}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {semainePrecedente ? (
            <Link
              href={`/reserver?semaine=${semainePrecedente}`}
              className="bouton bouton--secondaire bouton--compact"
            >
              ‹ Semaine précédente
            </Link>
          ) : null}
          <Link
            href={`/reserver?semaine=${semaineSuivante}`}
            className="bouton bouton--secondaire bouton--compact"
          >
            Semaine suivante ›
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------- Les jours */}
      <div className="jours">
        {jours.map((jour) => {
          const { nom, numero } = enteteJour(jour);
          const libres = creneauxParJour[jour]?.length ?? 0;
          const retenus = choix.filter((c) => jourDuCreneau(c.debut) === jour).length;
          const actif = jour === jourChoisi;
          return (
            <button
              key={jour}
              type="button"
              disabled={libres === 0}
              aria-pressed={actif}
              onClick={() => setJourDemande(jour)}
              className={`jour ${actif ? "jour--actif" : ""}`}
            >
              <span className="jour__nom">{nom}</span>
              <span className="jour__numero">{numero}</span>
              <span className="jour__compte">
                {libres === 0 ? "complet" : `${libres} libres`}
              </span>
              {retenus > 0 ? <span className="jour__pastille">{retenus}</span> : null}
            </button>
          );
        })}
      </div>

      {/* ----------------------------------------------------- Les horaires */}
      {!jourChoisi ? (
        <div className="carte" style={{ marginTop: 24, textAlign: "center" }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte-doux)" }}>
            Aucun créneau libre cette semaine. Essayez la suivante, ou écrivez-moi : je
            trouve souvent une solution.
          </p>
        </div>
      ) : (
        <div className="carte" style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <p className="surtitre" style={{ marginBottom: 0 }}>
              {jourLong(jourChoisi)}
            </p>
            <p style={{ fontSize: 13.5, color: "var(--texte-gris)" }}>
              Cliquez sur plusieurs heures pour un cours plus long
            </p>
          </div>

          {grouper(creneauxDuJour).map((groupe) => (
            <div key={groupe.titre} style={{ marginBottom: 24 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--foret)",
                  marginBottom: 12,
                }}
              >
                {groupe.titre}
              </p>
              <div className="horaires">
                {groupe.liste.map((c) => {
                  const retenu = estChoisi(c);
                  const empeche = !retenu && estEmpeche(c);
                  return (
                    <button
                      key={c.debut}
                      type="button"
                      disabled={empeche}
                      aria-pressed={retenu}
                      onClick={() => basculer(c)}
                      title={
                        empeche
                          ? "Chevauche une heure déjà retenue"
                          : `${heure(c.debut)} à ${heure(c.fin)}`
                      }
                      className={`horaire ${retenu ? "horaire--actif" : ""} ${
                        empeche ? "horaire--empeche" : ""
                      }`}
                    >
                      {heure(c.debut)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--texte-gris)" }}>
            Heure de Paris, séances d&apos;une heure. Réservation jusqu&apos;à 24 h avant
            le cours, annulation gratuite dans le même délai.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------ Formulaire */}
      {total > 0 && (
        <div
          className="carte carte--retenue"
          style={{ marginTop: 24, maxWidth: 620, marginLeft: "auto", marginRight: "auto" }}
        >
          <form action={action}>
            {choix.map((c) => (
              <input
                key={c.debut}
                type="hidden"
                name="creneaux"
                value={`${c.debut}|${c.fin}`}
              />
            ))}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <p className="surtitre" style={{ marginBottom: 0 }}>
                {total === 1 ? "Votre créneau" : `Vos ${total} heures`}
              </p>
              <button type="button" onClick={() => setChoix([])} className="lien-bouton">
                tout effacer
              </button>
            </div>

            <ul style={{ display: "grid", gap: 10 }}>
              {blocs.map((bloc) => (
                <li key={bloc.debut} className="bloc">
                  <span>
                    <span className="bloc__quand">{blocLong(bloc)}</span>
                    {bloc.heures > 1 ? (
                      <span className="bloc__duree">{bloc.heures} h d&apos;affilée</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    aria-label="Retirer ce créneau"
                    onClick={() =>
                      setChoix((liste) =>
                        liste.filter((c) => c.debut < bloc.debut || c.debut >= bloc.fin)
                      )
                    }
                    className="lien-bouton"
                  >
                    retirer
                  </button>
                </li>
              ))}
            </ul>

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
              {enCours
                ? "Enregistrement…"
                : total === 1
                  ? "Confirmer la réservation"
                  : `Confirmer les ${total} heures`}
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
