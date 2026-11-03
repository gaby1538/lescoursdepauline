import "server-only";
import { redirect } from "next/navigation";
import { clientSession } from "./session";

/**
 * Qui est administrateur se décide par variable d'environnement, pas en
 * base : une colonne « admin » peut être basculée par une requête, une
 * variable réclame un accès au compte Vercel. Et si elle est absente,
 * personne ne l'est — on échoue du bon côté.
 */
function adressesAdmin(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
}

export async function emailAdmin(): Promise<string | null> {
  const autorisees = adressesAdmin();
  if (autorisees.length === 0) return null;

  const supabase = await clientSession();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();

  return email && autorisees.includes(email) ? email : null;
}

export async function exigerAdmin(): Promise<string> {
  const email = await emailAdmin();
  if (!email) redirect("/connexion");
  return email;
}
