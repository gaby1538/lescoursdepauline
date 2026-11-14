"use client";

/**
 * Dernier filet. Il remplace entièrement la page, mise en forme
 * comprise, car il s'affiche quand la racine elle-même a échoué : il ne
 * peut donc compter ni sur la feuille de style ni sur la mise en page
 * du site. Son seul rôle est de donner la référence de l'erreur, sans
 * laquelle on ne peut rien retrouver dans les journaux.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f5f1e8",
          color: "#3c473a",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <main style={{ maxWidth: 520 }}>
          <p
            style={{
              fontSize: 11.5,
              letterSpacing: "0.17em",
              textTransform: "uppercase",
              color: "#8a5e0c",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Les cours de Pauline
          </p>
          <h1 style={{ fontSize: 30, lineHeight: 1.15, margin: "12px 0 0", color: "#143a24" }}>
            Le site a rencontré une erreur
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#55604f" }}>
            Rien n&apos;est perdu : rechargez la page. Si cela se reproduit,
            transmettez la référence ci-dessous.
          </p>

          {error.digest ? (
            <p style={{ fontSize: 14, color: "#55604f" }}>
              Référence :{" "}
              <code
                style={{
                  background: "#f0e4c6",
                  color: "#8a5e0c",
                  padding: "2px 7px",
                  borderRadius: 4,
                }}
              >
                {error.digest}
              </code>
            </p>
          ) : (
            <p style={{ fontSize: 14, color: "#55604f" }}>
              {error.message || "Aucun détail n'a été transmis."}
            </p>
          )}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 18,
              padding: "11px 22px",
              border: "1px solid #143a24",
              borderRadius: 999,
              background: "#143a24",
              color: "#f5f1e8",
              font: "inherit",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Recharger
          </button>
        </main>
      </body>
    </html>
  );
}
