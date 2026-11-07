import { euros, TARIFS_PAR_DEFAUT } from "@/lib/constantes";

const NIVEAUX = [
  { titre: "Collège et seconde", detail: "De la sixième à la seconde" },
  { titre: "Première et terminale", detail: "Spécialité SVT, bac et Parcoursup" },
] as const;

/**
 * Les deux niveaux et leurs deux tarifs, visibles d'un seul coup d'œil.
 *
 * C'était un tableau de trois colonnes. Sur téléphone il fallait le
 * faire défiler vers la droite pour voir le second prix : autrement dit,
 * la moitié de l'offre restait cachée à la moitié des visiteurs. Deux
 * cartes côte à côte disent la même chose sans rien dissimuler, à
 * n'importe quelle largeur.
 */
export default function GrilleTarifs() {
  return (
    <div className="tarifs-cartes">
      {NIVEAUX.map((niveau, i) => (
        <div key={niveau.titre} className="tarif">
          <p className="tarif__niveau">{niveau.titre}</p>
          <p className="tarif__detail">{niveau.detail}</p>

          <div className="tarif__lignes">
            <div className="tarif__ligne">
              <span className="tarif__prix">
                {euros(TARIFS_PAR_DEFAUT[i].seance)}
              </span>
              <span className="tarif__quoi">à la séance</span>
            </div>
            <div className="tarif__ligne tarif__ligne--accent">
              <span className="tarif__prix">
                {euros(TARIFS_PAR_DEFAUT[i].regulier)}
              </span>
              <span className="tarif__quoi">
                en suivi régulier
                <span className="tarif__note">à partir d&apos;une heure par semaine</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
