"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { reserver, type EtatReservation } from "@/app/reserver/actions";
import { enteteJour, heure, creneauLong, libelleSemaine, jourLong } from "@/lib/dates";
import { GROUPES } from "@/lib/constantes";
import type { Creneau } from "@/lib/reservations";

type Props = {
  lundi: string;
  jours: string[];
  creneauxParJour: Record<string, Creneau[]>;
  semainePrecedente: string | null;
  semaineSuivante: string;
};

const CLASSES = [...GROUPES.college_seconde.classes, ...GROUPES.premiere_terminale.classes];
const etatInitial: EtatReservation = { erreur: null };

/** Matin, après-midi, soir — on ne montre que les groupes non vides. */
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
}: Props) {
  const [jourDemande, setJourDemande] = useState<string | null>(null);
  const [creneauDemande, setCreneauDemande] = useState<string | null>(null);
  const [etat, action, enCours] = useActionState(reserver, etatInitial);

  // Si la semaine change, la sélection précédente n'a plus de sens.
  const premierJourLibre = jours.find((j) => (creneauxParJour[j]?.length ?? 0) > 0);
  const jourChoisi =
    jourDemande && jours.includes(jourDemande) ? jourDemande : premierJourLibre ?? null;

  const creneauxDuJour = jourChoisi ? creneauxParJour[jourChoisi] ?? [] : [];
  const choisi = creneauxDuJour.find((c) => c.debut === creneauDemande) ?? null;

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
          const nb = creneauxParJour[jour]?.length ?? 0;
          const actif = jour === jourChoisi;
          return (
            <button
              key={jour}
              type="button"
              disabled={nb === 0}
              aria-pressed={actif}
              onClick={() => {
                setJourDemande(jour);
                setCreneauDemande(null);
              }}
              className={`jour ${actif ? "jour--actif" : ""}`}
            >
              <span className="jour__nom">{nom}</span>
              <span className="jour__numero">{numero}</span>
              <span className="jour__compte">{nb === 0 ? "complet" : `${nb} libres`}</span>
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
          <p className="surtitre" style={{ marginBottom: 20 }}>
            {jourLong(jourChoisi)}
          </p>

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
                {groupe.liste.map((c) => (
                  <button
                    key={c.debut}
                    type="button"
                    aria-pressed={choisi?.debut === c.debut}
                    onClick={() => setCreneauDemande(c.debut)}
                    className={`horaire ${choisi?.debut === c.debut ? "horaire--actif" : ""}`}
                  >
                    {heure(c.debut)}
                  </button>
                ))}
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
      {choisi && (
        <div
          className="carte"
          style={{ marginTop: 24, maxWidth: 620, marginLeft: "auto", marginRight: "auto" }}
        >
          <form action={action}>
            <input type="hidden" name="debut" value={choisi.debut} />
            <input type="hidden" name="fin" value={choisi.fin} />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "baseline",
                justifyContent: "space-between",
                paddingBottom: 20,
                borderBottom: "1px solid var(--bordure-douce)",
              }}
            >
              <div>
                <p className="surtitre" style={{ marginBottom: 6 }}>
                  Créneau choisi
                </p>
                <p
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 22,
                    lineHeight: 1.3,
                    color: "var(--foret)",
                  }}
                >
                  {creneauLong(choisi.debut)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreneauDemande(null)}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  font: "inherit",
                  fontSize: 14,
                  color: "var(--or-texte)",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                changer
              </button>
            </div>

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
              <div>
                <label htmlFor="classe" style={etiquette}>
                  Classe de l&apos;élève
                </label>
                <select id="classe" name="classe" required style={{ ...saisie, padding: "0 12px" }}>
                  <option value="">Choisir une classe</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
              La facture arrive en fin de mois, à régler sous 30 jours par Wero ou
              virement. Le premier échange est gratuit.
            </div>

            {etat.erreur && (
              <p role="alert" className="alerte">
                {etat.erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={enCours}
              className="bouton bouton--principal"
              style={{ marginTop: 20, width: "100%", opacity: enCours ? 0.6 : 1 }}
            >
              {enCours ? "Enregistrement…" : "Confirmer la réservation"}
            </button>

            <p
              style={{
                marginTop: 14,
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--texte-gris)",
              }}
            >
              Votre espace élève est créé automatiquement, sans mot de passe à choisir.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

const etiquette: React.CSSProperties = {
  display: "block",
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--foret)",
  marginBottom: 7,
};

const saisie: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 46,
  padding: "0 14px",
  border: "1px solid var(--bordure)",
  borderRadius: 4,
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 15,
  color: "var(--texte)",
};

function Champ({
  nom,
  libelle,
  type = "text",
  requis = false,
  aide,
}: {
  nom: string;
  libelle: string;
  type?: string;
  requis?: boolean;
  aide?: string;
}) {
  return (
    <div>
      <label htmlFor={nom} style={etiquette}>
        {libelle}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        required={requis}
        placeholder={aide}
        autoComplete={nom === "email" ? "email" : nom === "telephone" ? "tel" : undefined}
        style={saisie}
      />
    </div>
  );
}
