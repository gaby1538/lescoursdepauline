import type { Metadata } from "next";
import Link from "next/link";
import PageLegale, { Adresse } from "@/components/PageLegale";
import { IDENTITE, LEGAL } from "@/lib/constantes";

export const metadata: Metadata = { title: "Confidentialité" };

export default function Confidentialite() {
  return (
    <PageLegale
      titre="Politique de confidentialité"
      accroche="Ce que ce site enregistre, pourquoi, combien de temps, et comment reprendre la main dessus."
    >
      <h2>Qui est responsable</h2>
      <p>
        {IDENTITE.exploitante}, entrepreneuse individuelle sous le nom commercial
        « {IDENTITE.raisonSociale} », SIRET {IDENTITE.siret}, décide des traitements
        décrits ici.
      </p>
      <ul>
        <li>
          Adresse : <Adresse />
        </li>
        <li>
          Courriel : <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a>
        </li>
      </ul>
      <p>
        L&apos;activité ne requiert pas la désignation d&apos;un délégué à la
        protection des données. Les demandes se font directement à l&apos;adresse
        ci-dessus.
      </p>

      <h2>Ce qui est enregistré</h2>
      <h3>Quand vous réservez un cours</h3>
      <ul>
        <li>Vos prénom, nom, adresse électronique et, si vous le souhaitez, téléphone</li>
        <li>Le prénom de l&apos;élève et sa classe</li>
        <li>La date et l&apos;heure du créneau, et le sujet que vous avez indiqué</li>
      </ul>

      <h3>Quand vous créez un espace</h3>
      <ul>
        <li>Les mêmes informations, plus un mot de passe</li>
        <li>
          Le mot de passe n&apos;est jamais conservé en clair : seule une empreinte
          chiffrée est stockée, et elle ne permet pas de le retrouver
        </li>
      </ul>

      <h3>Au fil des cours</h3>
      <ul>
        <li>L&apos;historique de vos séances et leur statut</li>
        <li>Les documents échangés pendant les cours</li>
        <li>Les factures émises et leur règlement</li>
        <li>
          Un journal technique des actions importantes — réservation, annulation,
          confirmation d&apos;adresse — qui sert à retrouver ce qui s&apos;est passé
          en cas de désaccord
        </li>
      </ul>

      <p>
        Aucune donnée n&apos;est collectée au-delà. Ce site ne pratique ni profilage,
        ni publicité, ni mesure d&apos;audience, et ne revend aucune information.
      </p>

      <h2>Pourquoi, et sur quel fondement</h2>
      <ul>
        <li>
          <strong>Organiser et donner les cours</strong> — réservations, envoi des
          liens de connexion, partage des supports. Fondement : l&apos;exécution du
          contrat qui nous lie.
        </li>
        <li>
          <strong>Facturer et tenir la comptabilité</strong> — émission des factures
          et suivi des règlements. Fondement : l&apos;exécution du contrat et le
          respect d&apos;obligations légales.
        </li>
        <li>
          <strong>Protéger le service</strong> — limitation du nombre de réservations,
          vérification des adresses, journal des actions. Fondement : l&apos;intérêt
          légitime à empêcher les réservations fictives qui bloqueraient des créneaux
          pour les autres élèves.
        </li>
      </ul>

      <h2>Qui y a accès</h2>
      <p>
        {IDENTITE.exploitante} elle-même, et personne d&apos;autre. Aucune donnée
        n&apos;est cédée, louée ni transmise à des tiers à des fins commerciales.
      </p>
      <p>
        Trois prestataires techniques interviennent, strictement pour faire
        fonctionner le service :
      </p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong> — hébergement du site
        </li>
        <li>
          <strong>Supabase, Inc.</strong> — base de données, hébergée en{" "}
          {LEGAL.regionDonnees}
        </li>
        <li>
          <strong>Resend</strong> — acheminement des messages électroniques
        </li>
      </ul>
      <p>
        Vercel et Resend sont des sociétés établies aux États-Unis. Les transferts de
        données vers ces prestataires sont encadrés par les clauses contractuelles
        types de la Commission européenne, complétées le cas échéant par le cadre de
        protection des données UE–États-Unis.
      </p>

      <h2>Combien de temps</h2>
      <ul>
        <li>
          <strong>Un dossier resté sans suite</strong>, c&apos;est-à-dire sans aucun
          cours donné ni facture émise, est supprimé après douze mois
          d&apos;inactivité.
        </li>
        <li>
          <strong>Les factures et les pièces comptables</strong> sont conservées dix
          ans, comme l&apos;impose le Code de commerce.
        </li>
        <li>
          <strong>Les documents pédagogiques</strong> restent accessibles dans votre
          espace tant que le suivi dure, puis deux ans après le dernier cours.
        </li>
        <li>
          <strong>Le journal technique</strong> est conservé douze mois.
        </li>
      </ul>
      <p>
        Si vous demandez l&apos;effacement de votre dossier alors que des factures ont
        déjà été émises, celles-ci sont conservées pour satisfaire à
        l&apos;obligation comptable, mais votre dossier est anonymisé : votre nom, vos
        coordonnées et le prénom de l&apos;élève disparaissent, et il ne reste
        qu&apos;une référence comptable.
      </p>

      <h2>Comment c&apos;est protégé</h2>
      <p>
        Les échanges avec le site sont chiffrés. L&apos;accès à la base est régi par
        des règles qui limitent chaque compte à son propre dossier, appliquées par la
        base de données elle-même et non par le site : un défaut de programmation ne
        peut donc pas exposer le dossier d&apos;un autre élève. Les documents partagés
        sont stockés dans un espace privé et ne sont servis que par des liens
        temporaires.
      </p>
      <p>
        Un compte ne donne accès à rien tant que l&apos;adresse électronique
        n&apos;a pas été confirmée par un lien reçu dans la boîte correspondante.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification,
        d&apos;effacement, de limitation et d&apos;opposition, ainsi que d&apos;un
        droit à la portabilité de vos données. Pour l&apos;exercer, écrivez à{" "}
        <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a>. Une réponse vous
        sera apportée dans un délai d&apos;un mois.
      </p>
      <p>
        Lorsque l&apos;élève est mineur, ces droits sont exercés par le parent ou le
        représentant légal qui a ouvert le dossier.
      </p>
      <p>
        Si la réponse ne vous satisfait pas, vous pouvez saisir la Commission
        nationale de l&apos;informatique et des libertés :{" "}
        <a href="https://www.cnil.fr">cnil.fr</a>, 3 place de Fontenoy, TSA 80715,
        75334 Paris Cedex 07.
      </p>

      <h2>Cookies</h2>
      <p>
        Ce site ne dépose aucun cookie publicitaire ni aucun traceur de mesure
        d&apos;audience. Le seul cookie utilisé est celui qui vous maintient connecté
        à votre espace ; il est strictement nécessaire au fonctionnement du service et
        disparaît à la déconnexion. À ce titre, il ne requiert pas votre
        consentement préalable.
      </p>

      <h2>Modifications</h2>
      <p>
        Cette politique peut évoluer, notamment si un nouvel outil est mis en place.
        La date de dernière mise à jour figure en haut de cette page. Les{" "}
        <Link href="/cgv">conditions générales</Link> et les{" "}
        <Link href="/mentions-legales">mentions légales</Link> la complètent.
      </p>
    </PageLegale>
  );
}
