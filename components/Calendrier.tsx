"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { reserver, type EtatReservation } from "@/app/reserver/actions";
import { enteteJour, heure, creneauLong, libelleSemaine } from "@/lib/dates";
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

export default function Calendrier({
  lundi,
  jours,
  creneauxParJour,
  semainePrecedente,
  semaineSuivante,
}: Props) {
  const [choisi, setChoisi] = useState<Creneau | null>(null);
  const [etat, action, enCours] = useActionState(reserver, etatInitial);

  const totalLibres = Object.values(creneauxParJour).reduce((n, c) => n + c.length, 0);

  return (
    <div className="colonnes" style={{ alignItems: "flex-start", gap: 24 }}>
      {/* ---------------------------------------------------- Calendrier */}
      <div
        className="carte"
        style={{ flex: "999 1 580px", minWidth: 0, padding: 30 }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 26,
          }}
        >
          <h2 style={{ fontSize: 22 }}>{libelleSemaine(lundi)}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {semainePrecedente ? (
              <Link
                href={`/reserver?semaine=${semainePrecedente}`}
                aria-label="Semaine précédente"
                className="bouton bouton--secondaire bouton--compact"
                style={{ padding: "0 16px" }}
              >
                ‹
              </Link>
            ) : (
              <span
                className="bouton bouton--secondaire bouton--compact"
                style={{ padding: "0 16px", opacity: 0.35, cursor: "default" }}
                aria-hidden="true"
              >
                ‹
              </span>
            )}
            <Link
              href={`/reserver?semaine=${semaineSuivante}`}
              aria-label="Semaine suivante"
              className="bouton bouton--secondaire bouton--compact"
              style={{ padding: "0 16px" }}
            >
              ›
            </Link>
          </div>
        </div>

        {totalLibres === 0 ? (
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte-doux)" }}>
            Aucun créneau libre cette semaine. Essayez la suivante, ou écrivez-moi : je
            trouve souvent une solution.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
              gap: 10,
            }}
          >
            {jours.map((jour) => {
              const { nom, numero } = enteteJour(jour);
              const creneaux = creneauxParJour[jour] ?? [];
              return (
                <div key={jour} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div
                    style={{
                      textAlign: "center",
                      paddingBottom: 8,
                      borderBottom: "1px solid var(--bordure-douce)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11.5,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--texte-gris)",
                      }}
                    >
                      {nom}
                    </p>
                    <p
                      style={{
                        marginTop: 4,
                        fontFamily: "var(--serif)",
                        fontSize: 22,
                        color: "var(--foret)",
                      }}
                    >
                      {numero}
                    </p>
                  </div>

                  {creneaux.length === 0 ? (
                    <p
                      style={{
                        padding: "12px 4px",
                        textAlign: "center",
                        fontSize: 12.5,
                        color: "var(--texte-gris)",
                      }}
                    >
                      —
                    </p>
                  ) : (
                    creneaux.map((c) => {
                      const actif = choisi?.debut === c.debut;
                      return (
                        <button
                          key={c.debut}
                          type="button"
                          aria-pressed={actif}
                          onClick={() => setChoisi(c)}
                          style={{
                            minHeight: 44,
                            borderRadius: 4,
                            border: actif
                              ? "1.5px solid var(--foret)"
                              : "1px solid var(--bordure)",
                            background: actif ? "var(--foret)" : "transparent",
                            color: actif ? "#fff" : "var(--foret)",
                            fontFamily: "inherit",
                            fontSize: 14.5,
                            fontWeight: actif ? 600 : 400,
                            cursor: "pointer",
                          }}
                        >
                          {heure(c.debut)}
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p
          style={{
            marginTop: 24,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--texte-gris)",
          }}
        >
          Heure de Paris. Les créneaux déjà pris et les indisponibilités n&apos;apparaissent
          pas. Réservation jusqu&apos;à 24 h avant le cours, annulation gratuite dans le
          même délai.
        </p>
      </div>

      {/* ------------------------------------------------------ Formulaire */}
      <aside
        className="carte"
        style={{ flex: "1 1 330px", minWidth: 300, padding: 30 }}
      >
        {!choisi ? (
          <>
            <h2 style={{ fontSize: 22, marginBottom: 12 }}>Votre réservation</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--texte-doux)" }}>
              Choisissez un créneau dans le calendrier, le formulaire apparaîtra ici.
            </p>
          </>
        ) : (
          <form action={action}>
            <input type="hidden" name="debut" value={choisi.debut} />
            <input type="hidden" name="fin" value={choisi.fin} />

            <p className="surtitre" style={{ marginBottom: 6 }}>
              Créneau choisi
            </p>
            <p
              style={{
                fontFamily: "var(--serif)",
                fontSize: 21,
                lineHeight: 1.3,
                color: "var(--foret)",
              }}
            >
              {creneauLong(choisi.debut)}
            </p>
            <p style={{ marginTop: 6, fontSize: 14, color: "var(--texte-gris)" }}>
              1 heure, en visioconférence
            </p>

            <div
              style={{
                marginTop: 22,
                paddingTop: 22,
                borderTop: "1px solid var(--bordure-douce)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <Champ nom="prenom" libelle="Votre prénom" requis />
              <Champ nom="nom" libelle="Votre nom" requis />
              <Champ nom="email" libelle="Votre email" type="email" requis
                aide="Pour la confirmation et la facture" />
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

              <div>
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
            </div>

            <div
              style={{
                marginTop: 22,
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
              <p
                role="alert"
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  borderRadius: 4,
                  background: "#f7efdc",
                  border: "1px solid #dec89b",
                  color: "#4a3206",
                  fontSize: 14.5,
                  lineHeight: 1.55,
                }}
              >
                {etat.erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={enCours}
              className="bouton bouton--principal"
              style={{ marginTop: 22, width: "100%", opacity: enCours ? 0.6 : 1 }}
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
              Vous recevrez un email de confirmation. Votre espace élève est créé
              automatiquement, sans mot de passe à choisir.
            </p>
          </form>
        )}
      </aside>
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
        autoComplete={
          nom === "email" ? "email" : nom === "telephone" ? "tel" : undefined
        }
        style={saisie}
      />
    </div>
  );
}
