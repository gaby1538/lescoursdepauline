"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Sans ce fichier, la moindre erreur dans l'administration affiche la
 * page blanche de Next.js, en anglais, qui dit seulement d'aller voir
 * la console. On préfère nommer la cause probable et donner le code
 * qui permet de retrouver l'erreur dans les journaux de Vercel.
 */
export default function ErreurAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erreur dans l'administration :", error);
  }, [error]);

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p className="surtitre">Administration</p>
        <h1 style={{ fontSize: 38, lineHeight: 1.15 }}>
          Cette page n&apos;a pas pu s&apos;afficher
        </h1>

        <p className="plomb" style={{ marginTop: 18 }}>
          La cause la plus fréquente : une migration qui n&apos;a pas été exécutée
          dans Supabase. L&apos;écran demande alors une colonne qui n&apos;existe
          pas encore.
        </p>

        <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Passez <code>supabase/verifier_migrations.sql</code> dans l&apos;éditeur SQL
          de Supabase : il dit en une fois lesquelles manquent.
        </p>

        {error.digest ? (
          <p style={{ marginTop: 20, fontSize: 13.5, color: "var(--texte-gris)" }}>
            Référence de l&apos;erreur : <code>{error.digest}</code>
            <br />
            Elle permet de retrouver le détail dans Vercel, onglet Logs.
          </p>
        ) : null}

        <div
          style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}
        >
          <button
            type="button"
            onClick={reset}
            className="bouton bouton--principal bouton--compact"
          >
            Réessayer
          </button>
          <Link href="/admin" className="bouton bouton--secondaire bouton--compact">
            Tableau de bord
          </Link>
        </div>
      </div>
    </section>
  );
}
