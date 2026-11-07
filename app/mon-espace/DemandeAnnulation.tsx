"use client";

import { useActionState } from "react";
import { demanderAnnulation, type EtatAnnulation } from "./actions";
import { saisie } from "@/components/Champs";

const initial: EtatAnnulation = { erreur: null, ok: false };

export default function DemandeAnnulation({
  id,
  dansLesDelais,
  enAttente = false,
}: {
  id: string;
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

  return (
    <details className="annulation">
      <summary>
        {enAttente ? "Retirer ma demande" : "Demander l'annulation"}
      </summary>
      <form action={action} className="annulation__corps">
        <input type="hidden" name="id" value={id} />
        <p className="annulation__avis">
          {enAttente
            ? "Pauline n'a pas encore répondu : le retrait est immédiat et rien ne vous sera facturé."
            : dansLesDelais
              ? "Vous êtes dans les délais : acceptée, cette séance ne vous sera pas facturée."
              : "Il reste moins de 24 heures avant le cours. Pauline peut accepter, mais la séance restera due."}
        </p>
        <label htmlFor={`motif-${id}`} className="annulation__etiquette">
          Un mot pour expliquer ? (facultatif)
        </label>
        <textarea
          id={`motif-${id}`}
          name="motif"
          rows={2}
          placeholder="Malade, sortie scolaire…"
          style={{ ...saisie, minHeight: 0, padding: "10px 12px", resize: "vertical" }}
        />
        {etat.erreur && (
          <p role="alert" className="alerte" style={{ marginTop: 12 }}>
            {etat.erreur}
          </p>
        )}
        <button
          type="submit"
          disabled={enCours}
          className="bouton bouton--secondaire bouton--compact"
          style={{ marginTop: 12 }}
        >
          {enCours ? "Envoi…" : enAttente ? "Retirer ma demande" : "Envoyer la demande"}
        </button>
      </form>
    </details>
  );
}
