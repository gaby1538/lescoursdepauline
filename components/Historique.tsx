export type Evenement = {
  id: number;
  acteur: string;
  objet: string;
  action: string;
  details: Record<string, unknown> | null;
  cree_le: string;
};

const ACTEURS: Record<string, string> = {
  client: "l'élève",
  pauline: "vous",
  systeme: "le site",
};

/** Ce que chaque entrée veut dire, en français. */
const LIBELLES: Record<string, string> = {
  "reservation:creee": "Cours réservé",
  "reservation:demandee": "Cours demandé",
  "reservation:demande_acceptee": "Demande acceptée",
  "reservation:demande_refusee": "Demande refusée",
  "reservation:demande_retiree": "Demande retirée par l'élève",
  "reservation:annulation_demandee": "Annulation demandée",
  "reservation:annulation_acceptee": "Annulation acceptée",
  "reservation:annulation_refusee": "Annulation refusée",
  "reservation:annulee_par_pauline": "Cours annulé",
  "reservation:effectuee": "Cours marqué donné",
  "compte:activation_demandee": "Lien d'activation envoyé",
  "compte:active": "Espace élève activé",
  "dossier:email_confirme": "Adresse email confirmée",
  "dossier:suspendu": "Dossier suspendu",
  "dossier:reactive": "Dossier réactivé",
  "dossier:anonymise": "Dossier anonymisé",
  "email:confirmation_envoyee": "Confirmation de réservation envoyée",
  "email:confirmation_echouee": "Confirmation de réservation en échec",
  "email:document_signale": "Nouveau document signalé par email",
  "email:document_signale_echec": "Signalement du document en échec",
  "facture:envoyee": "Facture envoyée",
  "facture:envoi_echoue": "Envoi de la facture en échec",
};

const ECHECS = new Set([
  "email:confirmation_echouee",
  "email:document_signale_echec",
  "facture:envoi_echoue",
]);

function quand(instant: string): string {
  return new Date(instant).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

/** Le détail utile, quand il y en a un. Jamais le contenu brut. */
function precision(e: Evenement): string | null {
  const d = e.details ?? {};

  if (e.action === "creee" && Array.isArray(d.creneaux)) {
    const heures = d.creneaux.length;
    return heures > 1 ? `${heures} heures d'affilée` : null;
  }
  if (e.action === "annulation_demandee") {
    const bouts = [
      typeof d.motif === "string" && d.motif ? `« ${d.motif} »` : null,
      d.hors_delai ? "hors délai" : null,
    ].filter(Boolean);
    return bouts.length > 0 ? bouts.join(" · ") : null;
  }
  if (e.action === "active" && typeof d.reservations_rattachees === "number") {
    const n = d.reservations_rattachees;
    return n > 0 ? `${n} cours rattaché${n > 1 ? "s" : ""}` : null;
  }
  if (typeof d.fichier === "string") return d.fichier;
  if (typeof d.numero === "string") return `facture ${d.numero}`;
  if (typeof d.motif === "string" && d.motif) return `« ${d.motif} »`;

  return null;
}

export default function Historique({
  evenements,
}: {
  evenements: Evenement[];
}) {
  if (evenements.length === 0) {
    return (
      <p style={{ fontSize: 14.5, color: "var(--texte-gris)" }}>
        Rien à afficher pour l&apos;instant.
      </p>
    );
  }

  return (
    <ol className="histo">
      {evenements.map((e) => {
        const cle = `${e.objet}:${e.action}`;
        const detail = precision(e);
        return (
          <li key={e.id} className={`histo__ligne ${ECHECS.has(cle) ? "histo__ligne--echec" : ""}`}>
            <span className="histo__date">{quand(e.cree_le)}</span>
            <span className="histo__quoi">
              {LIBELLES[cle] ?? `${e.objet} — ${e.action}`}
              {detail ? <span className="histo__detail"> · {detail}</span> : null}
              <span className="histo__acteur"> ({ACTEURS[e.acteur] ?? e.acteur})</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
