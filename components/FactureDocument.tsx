import { euros } from "@/lib/constantes";
import { moisLong } from "@/lib/dates";

/**
 * La facture elle-même, telle qu'elle se lit.
 *
 * Le même document sert à trois endroits : la page que la famille
 * ouvre, l'écran que Pauline regarde avant d'émettre, et l'aperçu
 * d'une facture déjà partie. Il n'en existe qu'une version : si la
 * mise en page vivait en double, l'écran de vérification finirait par
 * montrer autre chose que ce que la famille reçoit, et la
 * vérification ne vaudrait plus rien.
 */

export type FactureAffichee = {
  id: string;
  statut: string;
  numero: string | null;
  emise_le: string | null;
  echeance_le: string | null;
  payee_le: string | null;
  periode_debut: string;
  total_cents: number;
  note: string | null;
  destinataire_nom: string | null;
  destinataire_adresse: string | null;
};

export type LigneAffichee = {
  id: string;
  description: string | null;
  quantite: number | string;
  prix_unitaire_cents: number;
  total_cents: number;
};

export type ReglagesAffiches = {
  exploitante?: string | null;
  adresse_postale?: string | null;
  siret?: string | null;
  email_contact?: string | null;
  iban?: string | null;
  wero_telephone?: string | null;
  delai_paiement_jours?: number | null;
} | null;

export type ClientAffiche = {
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  eleve_prenom?: string | null;
  eleve_classe?: string | null;
} | null;

function date(valeur: string | null): string {
  return valeur ? new Date(valeur).toLocaleDateString("fr-FR") : "—";
}

export default function FactureDocument({
  facture,
  lignes,
  reglages,
  client,
  numeroAVenir,
}: {
  facture: FactureAffichee;
  lignes: LigneAffichee[];
  reglages: ReglagesAffiches;
  client: ClientAffiche;
  numeroAVenir?: string | null;
}) {
  const brouillon = facture.statut === "brouillon";

  return (
    <div className="facture">
      <div className="facture__entete">
        <div>
          <p style={{ fontFamily: "var(--serif)", fontSize: 25, color: "var(--foret)" }}>
            Les cours de <span style={{ color: "var(--or-texte)" }}>Pauline</span>
          </p>
          <p className="facture__petit">
            {reglages?.exploitante}
            <br />
            {reglages?.adresse_postale ?? ""}
            <br />
            SIRET {reglages?.siret}
            <br />
            {reglages?.email_contact}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p className="surtitre">{brouillon ? "Brouillon" : "Facture"}</p>
          <p
            style={{
              fontFamily: "var(--serif)",
              fontSize: 30,
              color: brouillon ? "var(--texte-gris)" : "var(--foret)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {facture.numero ?? numeroAVenir ?? "sans numéro"}
          </p>
          {brouillon ? (
            <p className="facture__petit">Numéro et dates attribués à l&apos;émission</p>
          ) : (
            <p className="facture__petit">
              Émise le {date(facture.emise_le)}
              <br />
              Échéance {date(facture.echeance_le)}
            </p>
          )}
        </div>
      </div>

      <div className="facture__parties">
        <div>
          <p className="surtitre">Facturé à</p>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte)" }}>
            {facture.destinataire_nom ??
              `${client?.prenom ?? ""} ${client?.nom ?? ""}`.trim()}
            {facture.destinataire_adresse
              ? facture.destinataire_adresse.split("\n").map((ligne) => (
                  <span key={ligne}>
                    <br />
                    {ligne}
                  </span>
                ))
              : null}
            <br />
            {client?.email}
          </p>
        </div>
        <div>
          <p className="surtitre">Élève</p>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte)" }}>
            {client?.eleve_prenom}
            {client?.eleve_classe ? (
              <>
                <br />
                {client.eleve_classe}
              </>
            ) : null}
          </p>
        </div>
        <div>
          <p className="surtitre">Période</p>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--texte)" }}>
            {moisLong(facture.periode_debut)}
          </p>
        </div>
      </div>

      <table className="liste facture__lignes">
        <thead>
          <tr>
            <th>Prestation</th>
            <th className="droite">Quantité</th>
            <th className="droite">Prix unitaire</th>
            <th className="droite">Total</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.id}>
              <td>{l.description}</td>
              <td className="droite">{Number(l.quantite)}</td>
              <td className="droite">{euros(l.prix_unitaire_cents)}</td>
              <td className="droite">{euros(l.total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="facture__total">
        <span>Total à régler</span>
        <strong>{euros(facture.total_cents)}</strong>
      </div>

      {facture.note ? <p className="facture__note">{facture.note}</p> : null}

      <p className="facture__mention">TVA non applicable, article 293 B du CGI.</p>

      <div className="facture__paiement">
        <p className="surtitre" style={{ marginBottom: 10 }}>
          Règlement
        </p>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Par virement{reglages?.iban ? ` — IBAN ${reglages.iban}` : ""}
          {reglages?.wero_telephone ? (
            <>
              <br />
              Par Wero au {reglages.wero_telephone}
            </>
          ) : null}
          <br />
          Payable sous {reglages?.delai_paiement_jours ?? 30} jours.
          {facture.payee_le ? ` Réglée le ${date(facture.payee_le)}.` : ""}
        </p>
      </div>
    </div>
  );
}
