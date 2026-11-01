import type React from "react";

export default function PageFormulaire({
  surtitre,
  titre,
  accent,
  intro,
  children,
  pied,
  large = false,
}: {
  surtitre: string;
  titre: string;
  accent?: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  pied?: React.ReactNode;
  large?: boolean;
}) {
  return (
    <section className="section">
      <div className="conteneur-etroit">
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p className="surtitre">{surtitre}</p>
          <h1 style={{ fontSize: 42, lineHeight: 1.12 }}>
            {titre}
            {accent ? (
              <>
                {" "}
                <em className="accent">{accent}</em>
              </>
            ) : null}
          </h1>
          {intro ? (
            <p className="plomb" style={{ margin: "18px auto 0", maxWidth: 520 }}>
              {intro}
            </p>
          ) : null}
        </div>

        <div
          className="carte"
          style={{
            maxWidth: large ? 620 : 460,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {children}
        </div>

        {pied ? (
          <p
            style={{
              marginTop: 22,
              textAlign: "center",
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--texte-gris)",
            }}
          >
            {pied}
          </p>
        ) : null}
      </div>
    </section>
  );
}
