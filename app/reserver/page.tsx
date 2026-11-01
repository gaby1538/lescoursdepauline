import type { Metadata } from "next";
import Calendrier from "@/components/Calendrier";
import { creneauxDeLaSemaine } from "@/lib/reservations";
import { lundiDeLaSemaine, ajouterJours } from "@/lib/dates";
import { dossierConnecte } from "@/lib/session";

export const metadata: Metadata = { title: "Réserver un créneau" };
export const dynamic = "force-dynamic";

export default async function Reserver({
  searchParams,
}: {
  searchParams: Promise<{ semaine?: string }>;
}) {
  const params = await searchParams;
  const semaineCourante = lundiDeLaSemaine();
  const demandee = params.semaine;

  const lundi =
    demandee && /^\d{4}-\d{2}-\d{2}$/.test(demandee) && demandee >= semaineCourante
      ? demandee
      : semaineCourante;

  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
  const creneauxParJour = await creneauxDeLaSemaine(lundi);
  const compte = await dossierConnecte();

  return (
    <section className="section">
      <div className="conteneur">
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <p className="surtitre">Réservation</p>
          <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>
            Choisissez un <em className="accent">créneau</em>
          </h1>
          <p className="plomb" style={{ margin: "18px auto 0", maxWidth: 560 }}>
            Les créneaux affichés sont réellement libres. Rien à payer ici : la facture
            arrive en fin de mois.
          </p>
        </div>

        <Calendrier
          lundi={lundi}
          jours={jours}
          creneauxParJour={creneauxParJour}
          semainePrecedente={lundi > semaineCourante ? ajouterJours(lundi, -7) : null}
          semaineSuivante={ajouterJours(lundi, 7)}
          compte={compte}
        />
      </div>
    </section>
  );
}
