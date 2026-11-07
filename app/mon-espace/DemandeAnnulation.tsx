"use client";

import { useActionState, useState } from "react";
import { demanderAnnulation, type EtatAnnulation } from "./actions";
import { saisie } from "@/components/Champs";

const initial: EtatAnnulation = { erreur: null, ok: false };

export default function DemandeAnnulation({
  ids,
  heures,
  dansLesDelais,
  enAttente = false,
}: {
  /** Les heures du cours, dans l'ordre. */
  ids: string[];
  heures: number;
  dansLesDelais: boolean;
  /** La demande n'a pas encore été acceptée : elle se retire librement. */
  enAttente?: boolean;
}) {
  const [etat, action, enCours] = useActionState(demanderAnnulation, initial);
  // Combien d'heures l'élève souhaite garder. Zéro annule le cours.
  const [garder, setGarder] = useState(0);

  if (etat.ok) {
    return (
      <p className="annulation__etat">
        {etat.retiree
          ? etat.reduction
            ? "Heures retirées. Le reste du cours est inchangé."
            : "Demande retirée. Le créneau est de nouveau libre."
          : etat.reduction
            ? "Demande envoyée. Pauline vous répond par email, et le cours reste prévu en entier jusque-là."
            : "Demande envoyée. Pauline vous répond par email, et le cours reste prévu jusque-là."}
      </p>
    );
  }

  const plusieurs = heures > 1;
  const reduction = garder > 0;

  return (
    <details className="annulation">
      <summary>
        {enAttente
          ? "Retirer ma demande"
          : plusieurs
            ? "Annuler ou raccourcir"
            : "Demander l'annulation"}
      </summary>
      <form action={action} className="annulation__corps">
        <input type="hidden" name="ids" value={ids.join(",")} />
        <input type="hidden" name="garder" value={garder} />

        {plusieurs && (
          <div className="annulation__choix">
            <p className="annulation__etiquette">Que souhaitez-vous garder ?</p>
            <div className="annulation__options">
              <button
                type="button"
                onClick={() => setGarder(0)}
                className={garder === 0 ? "duree duree--actif" : "duree"}
              >
                Rien, annuler
              </button>
              {Array.from({ length: heures - 1 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGarder(n)}
                  className={garder === n ? "duree duree--actif" : "duree"}
                >
                  {n} h
                </button>
              ))}
            </div>
            {reduction && (
              <p className="annulation__consequence">
                Le cours commencerait comme prévu et durerait {garder} heure
                {garder > 1 ? "s" : ""} au lieu de {heures}. Ce sont les dernières
                heures qui sont retirées.
              </p>
            )}
          </div>
        )}

        <p className="annulation__avis">
          {enAttente
            ? "Pauline n'a pas encore répondu : le retrait est immédiat et rien ne vous sera facturé."
            : dansLesDelais
              ? `Vous êtes dans les délais : acceptée, ${
                  reduction ? "les heures retirées ne vous seront pas facturées" : "cette séance ne vous sera pas facturée"
                }.`
              : `Il reste moins de 24 heures avant le cours. Pauline peut accepter, mais ${
                  reduction ? "les heures retirées resteront dues" : "la séance restera due"
                }.`}
        </p>

        <label htmlFor={`motif-${ids[0]}`} className="annulation__etiquette">
          Un mot pour expliquer ? (facultatif)
        </label>
        <textarea
          id={`motif-${ids[0]}`}
          name="motif"
          rows={2}
          maxLength={500}
          style={{ ...saisie, resize: "vertical" }}
          placeholder="Un imprévu, un contrôle déplacé…"
        />

        {etat.erreur && (
          <p className="alerte" style={{ marginTop: 10 }}>
            {etat.erreur}
          </p>
        )}
        <button
          type="submit"
          disabled={enCours}
          className="bouton bouton--secondaire bouton--compact"
          style={{ marginTop: 12 }}
        >
          {enCours
            ? "Envoi…"
            : enAttente
              ? reduction
                ? "Retirer ces heures"
                : "Retirer ma demande"
              : reduction
                ? `Demander à garder ${garder} h`
                : "Demander l'annulation"}
        </button>
      </form>
    </details>
  );
}
