import type { Metadata } from "next";
import Link from "next/link";
import PageLegale, { Adresse } from "@/components/PageLegale";
import { IDENTITE } from "@/lib/constantes";

export const metadata: Metadata = { title: "Conditions générales" };

export default function CGV() {
  return (
    <PageLegale
      titre="Conditions générales de vente"
      accroche="Ce sur quoi nous nous engageons l'une envers l'autre : ce qui est dû, quand, et ce qui se passe quand un cours est annulé."
    >
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent les cours particuliers de sciences de la
        vie et de la Terre dispensés par {IDENTITE.exploitante} et réservés depuis le
        site lescoursdepauline.com. Elles sont acceptées au moment de la réservation
        et prévalent sur tout autre document.
      </p>
      <p>
        Dans ce qui suit, « la Prestataire » désigne {IDENTITE.exploitante}, et
        « vous » la personne majeure qui réserve le cours — l&apos;élève s&apos;il est
        majeur, son parent ou son représentant légal sinon.
      </p>

      <h2>2. La Prestataire</h2>
      <ul>
        <li>
          {IDENTITE.exploitante}, entrepreneuse individuelle sous le nom commercial
          « {IDENTITE.raisonSociale} »
        </li>
        <li>SIRET : {IDENTITE.siret}</li>
        <li>
          Adresse : <Adresse />
        </li>
        <li>
          Courriel : <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a> —
          téléphone : {IDENTITE.telephoneAffiche}
        </li>
        <li>TVA non applicable, article 293 B du Code général des impôts</li>
      </ul>

      <h2>3. Les prestations</h2>
      <p>
        Les cours se déroulent <strong>en visioconférence</strong>, par séances
        d&apos;une heure, en tête-à-tête. Ils s&apos;adressent aux élèves de la
        sixième à la terminale, spécialité SVT comprise.
      </p>
      <p>
        La Prestataire s&apos;engage à une obligation de moyens : elle prépare chaque
        séance, fournit les supports nécessaires et adapte sa méthode à l&apos;élève.
        Aucun résultat scolaire, note ou admission ne peut être garanti.
      </p>
      <p>
        L&apos;accompagnement entre deux séances — une question par message, un
        exercice à vérifier — est compris dans le tarif horaire, dans des limites
        raisonnables.
      </p>

      <h2>4. Tarifs</h2>
      <p>
        Les tarifs en vigueur sont ceux affichés sur la page{" "}
        <Link href="/tarifs">Tarifs</Link> au moment de la réservation. Ils varient
        selon le niveau de l&apos;élève, et un tarif réduit s&apos;applique dans le
        cadre d&apos;un suivi régulier, dont les conditions sont convenues
        directement avec la Prestataire.
      </p>
      <p>
        Le tarif applicable à une séance est celui en vigueur au moment où elle est
        réservée. Il est figé à cet instant : une évolution ultérieure des tarifs
        reste sans effet sur les séances déjà réservées.
      </p>
      <p>Les prix sont exprimés en euros, nets de taxe.</p>

      <h2>5. Réservation</h2>
      <p>
        La réservation s&apos;effectue depuis le site, en choisissant un créneau parmi
        ceux affichés comme libres. Elle doit intervenir{" "}
        <strong>au moins vingt-quatre heures avant</strong> le début de la séance.
      </p>
      <p>
        La réservation est confirmée par un message électronique récapitulant la date
        et l&apos;heure. Le lien de connexion à la visioconférence est transmis avant
        la séance.
      </p>
      <p>
        Aucun paiement n&apos;est demandé au moment de la réservation. Le site ne
        collecte aucune coordonnée bancaire.
      </p>
      <p>
        Tant qu&apos;une adresse électronique n&apos;a pas été confirmée, une seule
        séance peut être réservée. Le nombre de réservations simultanées est par
        ailleurs limité, afin que des créneaux ne soient pas immobilisés sans suite.
      </p>

      <h2>6. Annulation et report</h2>
      <h3>De votre fait</h3>
      <p>
        Une séance peut être annulée ou déplacée librement et sans frais{" "}
        <strong>jusqu&apos;à vingt-quatre heures avant</strong> son début, depuis
        votre espace ou par simple message.
      </p>
      <p>
        Passé ce délai, la séance est due et sera facturée. Le créneau a été réservé
        et préparé, et il ne peut plus être proposé à un autre élève. En cas
        d&apos;empêchement sérieux et imprévisible — maladie, accident — écrivez à la
        Prestataire : une solution est recherchée au cas par cas.
      </p>
      <p>
        Un élève qui ne se présente pas, sans avoir prévenu, est redevable de la
        séance.
      </p>

      <h3>Du fait de la Prestataire</h3>
      <p>
        Si la Prestataire se trouve empêchée, la séance n&apos;est pas facturée et un
        nouveau créneau vous est proposé dans les meilleurs délais.
      </p>

      <h3>Incident technique</h3>
      <p>
        Si la séance ne peut se tenir en raison d&apos;une panne imputable à la
        Prestataire, elle n&apos;est pas facturée. Si la coupure survient de votre
        côté, la séance reste due dès lors qu&apos;elle a commencé ; la Prestataire
        reste toutefois disponible pendant la durée prévue et rattrape le temps perdu
        dans la mesure du possible.
      </p>

      <h2>7. Déroulement de la séance</h2>
      <p>
        Il vous revient de disposer d&apos;une connexion internet suffisante,
        d&apos;un micro en état de marche et d&apos;un endroit calme. La caméra est
        souhaitable mais non obligatoire.
      </p>
      <p>
        En cas de retard de l&apos;élève, la séance se termine à l&apos;heure prévue
        et reste due intégralement. En cas de retard de la Prestataire, le temps perdu
        est rattrapé, ou la séance n&apos;est pas facturée si elle n&apos;a pu se
        tenir.
      </p>
      <p>
        Les séances ne font l&apos;objet d&apos;aucun enregistrement, ni par la
        Prestataire ni par l&apos;élève, sauf accord exprès des deux parties.
      </p>

      <h2>8. Facturation et paiement</h2>
      <p>
        Une facture récapitulant les séances du mois est adressée par message
        électronique à la fin de chaque mois. Elle est{" "}
        <strong>payable sous trente jours</strong> à compter de sa date
        d&apos;émission.
      </p>
      <p>
        Le règlement s&apos;effectue par virement bancaire ou par Wero, selon les
        coordonnées figurant sur la facture.
      </p>
      <p>
        En cas de retard, une relance amiable est adressée. Si le règlement
        n&apos;intervient toujours pas, la Prestataire peut suspendre les
        réservations à venir jusqu&apos;à régularisation.
      </p>

      <h2>9. Droit de rétractation</h2>
      <p>
        Les cours étant réservés à distance, vous disposez d&apos;un délai de{" "}
        <strong>quatorze jours</strong> à compter de la réservation pour vous
        rétracter sans avoir à vous justifier ni à supporter de frais, conformément
        aux articles L. 221-18 et suivants du Code de la consommation.
      </p>
      <p>
        Pour l&apos;exercer, il suffit d&apos;adresser une déclaration dénuée
        d&apos;ambiguïté à{" "}
        <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a> avant
        l&apos;expiration du délai. Le remboursement des sommes éventuellement versées
        intervient dans les quatorze jours suivant la réception de cette déclaration.
      </p>
      <p>
        <strong>Séance tenue avant la fin du délai.</strong> Lorsque vous réservez un
        créneau situé à moins de quatorze jours, vous demandez expressément que la
        prestation commence avant l&apos;expiration du délai de rétractation. Vous
        conservez alors votre droit de rétractation, mais si vous l&apos;exercez après
        que la séance a eu lieu, celle-ci reste due. Une fois la prestation
        entièrement exécutée, le droit de rétractation ne peut plus être exercé à son
        égard.
      </p>
      <p>
        Les séances non encore tenues ne sont, elles, jamais dues en cas de
        rétractation.
      </p>

      <h2>10. Espace élève</h2>
      <p>
        L&apos;ouverture d&apos;un espace est facultative : une séance peut être
        réservée sans compte. L&apos;espace réunit vos cours, les documents échangés
        et vos factures.
      </p>
      <p>
        Vous êtes responsable de la confidentialité de votre mot de passe. Si vous
        soupçonnez qu&apos;il est connu d&apos;un tiers, changez-le depuis la page
        « mot de passe oublié » et prévenez la Prestataire.
      </p>
      <p>
        La Prestataire peut suspendre ou fermer un espace en cas d&apos;usage
        manifestement abusif — réservations fictives, coordonnées fantaisistes,
        propos déplacés — après avoir, sauf urgence, tenté de vous joindre.
      </p>

      <h2>11. Supports pédagogiques</h2>
      <p>
        Les documents remis vous sont confiés pour l&apos;usage personnel de
        l&apos;élève. Ils ne peuvent être diffusés, publiés en ligne ni revendus. Ils
        restent la propriété de leur auteur.
      </p>

      <h2>12. Données personnelles</h2>
      <p>
        Les informations recueillies sont nécessaires à l&apos;organisation des cours
        et à la facturation. Leur traitement est détaillé dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>, qui fait
        partie intégrante des présentes conditions.
      </p>

      <h2>13. Modification des conditions</h2>
      <p>
        Les présentes conditions peuvent être modifiées. La version applicable à une
        séance est celle en vigueur au jour de sa réservation.
      </p>

      <h2>14. Droit applicable et réclamations</h2>
      <p>
        Les présentes conditions sont soumises au droit français.
      </p>
      <p>
        En cas de difficulté, écrivez d&apos;abord à{" "}
        <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a> : la quasi-totalité
        des désaccords se règlent par un échange direct, et une réponse vous sera
        apportée rapidement. À défaut d&apos;accord amiable, le litige relève des
        juridictions françaises compétentes.
      </p>
    </PageLegale>
  );
}
