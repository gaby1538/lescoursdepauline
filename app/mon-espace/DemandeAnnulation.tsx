"use client";

import { useActionState } from "react";
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

  if (etat.ok) {
    return (
      <p className="annulation__etat">
        {etat.retiree
          ? "Demande retirée. Le créneau est de nouveau libre."
          : "Demande envoyée. Pauline vous répond par email, et le cours reste prévu jusque-là."}
      </p>
    );
  }

  const plusieurs = heures > 1;

  return (
    <details className="annulation">
      <summary>
        {enAttente ? "Retirer ma demande" : "Annuler ce cours"}
      </summary>
      <form action={action} className="annulation__corps">
        <input type="hidden" name="ids" value={ids.join(",")} />

        <p className="annulation__avis">
          {enAttente
            ? "Pauline n'a pas encore répondu : le retrait est immédiat et rien ne vous sera facturé."
            : dansLesDelais
              ? `Vous êtes dans les délais : acceptée, ${
                  plusieurs ? "ces heures ne vous seront pas facturées" : "cette séance ne vous sera pas facturée"
                }. Si vous souhaitez seulement changer d'horaire ou raccourcir, utilisez plutôt « Modifier ».`
              : `Il reste moins de 24 heures avant le cours. Pauline peut accepter, mais ${
                  plusieurs ? "ces heures resteront dues" : "la séance restera due"
                }. Un déplacement, lui, n'est jamais facturé.`}
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
              ? "Retirer ma demande"
              : "Demander l'annulation"}
        </button>
      </form>
    </details>
  );
}
