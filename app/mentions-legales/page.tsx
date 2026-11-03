import type { Metadata } from "next";
import Link from "next/link";
import PageLegale, { Adresse } from "@/components/PageLegale";
import { IDENTITE } from "@/lib/constantes";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <PageLegale
      titre="Mentions légales"
      accroche="Qui édite ce site, qui l'héberge, et à qui vous écrivez quand quelque chose ne va pas."
    >
      <h2>L&apos;éditrice du site</h2>
      <p>
        Le site <strong>lescoursdepauline.com</strong> est édité par{" "}
        <strong>{IDENTITE.exploitante}</strong>, entrepreneuse individuelle exerçant
        sous le nom commercial « {IDENTITE.raisonSociale} ».
      </p>
      <ul>
        <li>SIRET : {IDENTITE.siret}</li>
        <li>
          Adresse : <Adresse />
        </li>
        <li>
          Courriel : <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a>
        </li>
        <li>
          Téléphone : <a href={`tel:${IDENTITE.telephone}`}>{IDENTITE.telephoneAffiche}</a>
        </li>
        <li>TVA non applicable, article 293 B du Code général des impôts</li>
      </ul>
      <p>
        Activité : cours particuliers de sciences de la vie et de la Terre, dispensés
        à distance par visioconférence.
      </p>

      <h2>La directrice de la publication</h2>
      <p>
        {IDENTITE.exploitante}, à l&apos;adresse et aux coordonnées indiquées
        ci-dessus.
      </p>

      <h2>L&apos;hébergement</h2>
      <p>
        Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133,
        Walnut, CA 91789, États-Unis — <a href="https://vercel.com">vercel.com</a>.
      </p>
      <p>
        Les données des élèves sont stockées par <strong>Supabase, Inc.</strong> —{" "}
        <a href="https://supabase.com">supabase.com</a>. Les messages électroniques
        sont acheminés par <strong>Resend</strong> —{" "}
        <a href="https://resend.com">resend.com</a>. Le détail de ces traitements
        figure dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, la charte graphique, les supports pédagogiques et les documents
        mis à disposition sur ce site sont la propriété de {IDENTITE.exploitante},
        sauf mention contraire. Les supports remis aux élèves sont destinés à leur
        usage personnel dans le cadre de leur suivi : ils ne peuvent être
        redistribués, publiés ni commercialisés sans accord écrit préalable.
      </p>
      <p>
        Les photographies et illustrations utilisées sur le site sont employées avec
        l&apos;autorisation de leurs auteurs ou relèvent du domaine public.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Les informations publiées sur ce site sont fournies à titre indicatif et
        tenues à jour avec soin. Une erreur ou une omission reste toutefois possible :
        si vous en relevez une, signalez-la à{" "}
        <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a>, elle sera corrigée.
      </p>
      <p>
        Le site peut être momentanément indisponible pour maintenance ou en raison
        d&apos;un incident technique chez un hébergeur. Une telle interruption
        n&apos;ouvre pas droit à indemnité, mais ne fait pas obstacle à la tenue des
        cours déjà réservés : en cas d&apos;empêchement, écrivez ou téléphonez
        directement.
      </p>
      <p>
        Les liens pointant vers des sites extérieurs sont proposés pour votre
        commodité. Leur contenu n&apos;engage que leurs éditeurs respectifs.
      </p>

      <h2>Nous écrire</h2>
      <p>
        Pour toute question relative au site ou aux cours :{" "}
        <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a> ou{" "}
        {IDENTITE.telephoneAffiche}.
      </p>
    </PageLegale>
  );
}
