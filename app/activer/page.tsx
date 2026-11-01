import type { Metadata } from "next";
import Link from "next/link";
import PageFormulaire from "@/components/PageFormulaire";
import { trouverDossierParJeton } from "@/lib/comptes";
import { clientAdmin } from "@/lib/supabase";
import { IDENTITE } from "@/lib/constantes";
import Formulaire from "./Formulaire";

export const metadata: Metadata = { title: "Activer mon espace" };
export const dynamic = "force-dynamic";

export default async function Activer({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; reinit?: string }>;
}) {
  const { token, reinit } = await searchParams;
  const dossier = token ? await trouverDossierParJeton(token) : null;

  if (!dossier) {
    return (
      <PageFormulaire
        surtitre="Lien expiré"
        titre="Ce lien ne fonctionne"
        accent="plus"
        intro="Un lien d'activation ne sert qu'une fois. Demandez-en un nouveau, il arrive dans la minute."
        pied={
          <>
            Un souci persistant ?{" "}
            <a href={`mailto:${IDENTITE.email}`}>Écrivez-moi</a>.
          </>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Link href="/mot-de-passe-oublie" className="bouton bouton--principal">
            Recevoir un nouveau lien
          </Link>
          <Link href="/connexion" className="bouton bouton--secondaire">
            Se connecter
          </Link>
        </div>
      </PageFormulaire>
    );
  }

  const renouvellement = reinit === "1" || Boolean(dossier.user_id);

  // Combien de cours attendent déjà dans ce dossier : c'est l'argument
  // le plus concret pour finir l'activation.
  const { count } = await clientAdmin()
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("dossier_id", dossier.id);

  const nb = count ?? 0;

  return (
    <PageFormulaire
      surtitre={renouvellement ? "Nouveau mot de passe" : "Adresse confirmée"}
      titre={renouvellement ? "Choisissez votre" : "Votre adresse est"}
      accent={renouvellement ? "nouveau mot de passe" : "confirmée"}
      intro={
        renouvellement
          ? "Saisissez-le deux fois, et vous serez connecté dans la foulée."
          : nb > 0
            ? `Il ne reste qu'à choisir un mot de passe. ${
                nb === 1 ? "Votre cours sera rattaché" : `Vos ${nb} cours seront rattachés`
              } à votre espace, et vous n'aurez plus jamais à ressaisir vos coordonnées pour réserver.`
            : "Il ne reste qu'à choisir un mot de passe. Vous n'aurez plus jamais à ressaisir vos coordonnées pour réserver."
      }
      pied={
        renouvellement ? null : (
          <>
            Le mot de passe n&apos;est pas obligatoire : votre adresse est déjà
            confirmée, vous pouvez <Link href="/reserver">réserver sans compte</Link>.
            Mais il vous évitera de tout retaper à chaque fois.
          </>
        )
      }
    >
      <p
        style={{
          margin: "0 0 18px",
          paddingBottom: 16,
          borderBottom: "1px solid var(--bordure-douce)",
          fontSize: 14.5,
          color: "var(--texte-doux)",
        }}
      >
        Espace de <strong style={{ color: "var(--foret)" }}>{dossier.email}</strong>
      </p>

      <Formulaire jeton={dossier.token_confirmation} renouvellement={renouvellement} />
    </PageFormulaire>
  );
}
