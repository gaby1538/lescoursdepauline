import type React from "react";
import { LEGAL } from "@/lib/constantes";

export default function PageLegale({
  titre,
  accroche,
  children,
}: {
  titre: string;
  accroche?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="conteneur-etroit legal">
        <h1 style={{ fontSize: 44, lineHeight: 1.12 }}>{titre}</h1>
        {accroche ? (
          <p className="plomb" style={{ marginTop: 16 }}>
            {accroche}
          </p>
        ) : null}
        <p className="legal__maj" style={{ marginTop: 14 }}>
          Dernière mise à jour : {LEGAL.dateMaj}
        </p>
        {children}
      </div>
    </section>
  );
}

/** Rend l'adresse, ou un trou visible tant qu'elle n'est pas renseignée. */
export function Adresse() {
  if (LEGAL.adresse) return <>{LEGAL.adresse}</>;
  return (
    <span className="legal__trou">
      Adresse de l&apos;entreprise à renseigner dans <code>lib/constantes.ts</code>{" "}
      avant la mise en ligne publique.
    </span>
  );
}
