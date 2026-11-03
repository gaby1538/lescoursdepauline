import Link from "next/link";
import { IDENTITE } from "@/lib/constantes";

export default function Pied() {
  return (
    <footer className="pied">
      <div className="conteneur pied__barre">
        <p className="pied__mentions">
          {IDENTITE.raisonSociale} — {IDENTITE.exploitante}, micro-entreprise,
          SIRET {IDENTITE.siret}. TVA non applicable, art. 293 B du CGI.
        </p>
        <nav>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/cgv">Conditions générales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
        </nav>
      </div>
    </footer>
  );
}
