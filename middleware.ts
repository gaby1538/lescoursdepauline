import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit le jeton de session à chaque navigation. Sans cela, une
 * session expire au bout d'une heure et la personne est déconnectée
 * sans comprendre pourquoi.
 */
export async function middleware(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cleAnonyme = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cleAnonyme) return reponse;

  const supabase = createServerClient(url, cleAnonyme, {
    cookies: {
      getAll: () => requete.cookies.getAll(),
      setAll: (liste: { name: string; value: string; options: CookieOptions }[]) => {
        liste.forEach(({ name, value }) => requete.cookies.set(name, value));
        reponse = NextResponse.next({ request: requete });
        liste.forEach(({ name, value, options }) =>
          reponse.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();
  return reponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
