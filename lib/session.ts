import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { clientAdmin } from "./supabase";

/**
 * Le client porteur de session. Il lit et écrit les cookies
 * d'authentification, donc il ne s'utilise que dans un composant
 * serveur, une action serveur ou un gestionnaire de route.
 */
export async function clientSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleAnonyme = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cleAnonyme) {
    throw new Error("Les variables Supabase publiques doivent être définies.");
  }

  const magasin = await cookies();

  return createServerClient(url, cleAnonyme, {
    cookies: {
      getAll: () => magasin.getAll(),
      setAll: (liste: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          liste.forEach(({ name, value, options }) =>
            magasin.set(name, value, options)
          );
        } catch {
          // Appelé depuis un composant serveur : le middleware s'en charge.
        }
      },
    },
  });
}

export type DossierConnecte = {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  eleve_prenom: string | null;
  eleve_classe: string | null;
  suspendu: boolean;
};

/**
 * Le dossier de la personne connectée, ou null.
 *
 * On exige email_confirme_le : un compte dont l'adresse n'a jamais été
 * prouvée n'ouvre aucune porte, ce qui reprend la règle posée en base.
 */
export async function dossierConnecte(): Promise<DossierConnecte | null> {
  const supabase = await clientSession();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await clientAdmin()
    .from("dossiers")
    .select(
      "id, email, prenom, nom, telephone, eleve_prenom, eleve_classe, suspendu, email_confirme_le"
    )
    .eq("user_id", auth.user.id)
    .eq("anonymise", false)
    .maybeSingle();

  if (!data || !data.email_confirme_le) return null;

  const { email_confirme_le: _ignore, ...dossier } = data;
  return dossier as DossierConnecte;
}
