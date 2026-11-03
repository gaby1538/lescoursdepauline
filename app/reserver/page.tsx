import type { Metadata } from "next";
import Calendrier from "@/components/Calendrier";
import { creneauxDeLaPeriode } from "@/lib/reservations";
import { dossierConnecte } from "@/lib/session";
import {
  grilleDuMois,
  moisCourant,
  moisDecale,
  nomDuMois,
  isoJour,
} from "@/lib/dates";

export const metadata: Metadata = { title: "Réserver un créneau" };
export const dynamic = "force-dynamic";

export default async function Reserver({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const params = await searchParams;
  const courant = moisCourant();

  const mois =
    params.mois && /^\d{4}-\d{2}$/.test(params.mois) && params.mois >= courant
      ? params.mois
      : courant;

  const jours = grilleDuMois(mois);
  const aujourdhui = isoJour(new Date());

  // Inutile d'interroger le passé : la grille commence au plus tôt
  // aujourd'hui, et les créneaux trop proches sont de toute façon
  // écartés par la base.
  const premier = jours[0] > aujourdhui ? jours[0] : aujourdhui;
  const creneauxParJour =
    premier <= jours[jours.length - 1]
      ? await creneauxDeLaPeriode(premier, jours[jours.length - 1])
      : {};

  return (
    <section className="section">
      <div className="conteneur">
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <p className="surtitre">Réservation</p>
          <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>
            Choisissez un <em className="accent">créneau</em>
          </h1>
          <p className="plomb" style={{ margin: "18px auto 0", maxWidth: 560 }}>
            Un jour, une durée, une heure. Les créneaux affichés sont réellement
            libres, et il n&apos;y a rien à payer ici.
          </p>
        </div>

        <Calendrier
          mois={mois}
          nomMois={nomDuMois(mois)}
          jours={jours}
          creneauxParJour={creneauxParJour}
          moisPrecedent={mois > courant ? moisDecale(mois, -1) : null}
          moisSuivant={moisDecale(mois, 1)}
          compte={await dossierConnecte()}
        />
      </div>
    </section>
  );
}
