import type { Metadata } from "next";
import Calendrier from "@/components/Calendrier";
import { creneauxDeLaPeriode } from "@/lib/reservations";
import { dossierConnecte } from "@/lib/session";
import { clientAdmin } from "@/lib/supabase";
import { blocLong } from "@/lib/dates";
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
  searchParams: Promise<{ mois?: string; deplacer?: string }>;
}) {
  const params = await searchParams;
  const courant = moisCourant();

  const mois =
    params.mois && /^\d{4}-\d{2}$/.test(params.mois) && params.mois >= courant
      ? params.mois
      : courant;

  // Mode déplacement : on réutilise exactement le même calendrier, en
  // lui disant quel cours il remplace. Construire un second sélecteur
  // de créneau n'apporterait rien et divergerait au premier changement.
  const compte = await dossierConnecte();
  const ids = (params.deplacer ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[0-9a-f-]{36}$/.test(v));

  let deplacement: {
    ids: string[];
    debut: string;
    fin: string;
    heures: number;
  } | null = null;

  if (ids.length > 0 && compte) {
    const { data } = await clientAdmin()
      .from("reservations")
      .select("id, debut, fin")
      .in("id", ids)
      .eq("dossier_id", compte.id)
      .eq("statut", "reservee")
      .order("debut");

    const lignes = data ?? [];
    if (lignes.length > 0) {
      deplacement = {
        ids: lignes.map((r) => r.id),
        debut: lignes[0].debut,
        fin: lignes[lignes.length - 1].fin,
        heures: lignes.length,
      };
    }
  }

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
          <p className="surtitre">
            {deplacement ? "Modifier un cours" : "Réservation"}
          </p>
          <h1 style={{ fontSize: 46, lineHeight: 1.1 }}>
            {deplacement ? (
              <>
                Choisissez le <em className="accent">nouveau</em> créneau
              </>
            ) : (
              <>
                Choisissez un <em className="accent">créneau</em>
              </>
            )}
          </h1>
          {deplacement ? (
            <p className="plomb" style={{ margin: "18px auto 0", maxWidth: 560 }}>
              Votre cours a lieu <strong>{blocLong(deplacement)}</strong>. Choisissez
              quand vous préférez, et la durée que vous voulez — elle peut être plus
              courte. Pauline doit confirmer, et l&apos;ancien créneau reste le vôtre
              jusque-là.
            </p>
          ) : (
            <p className="plomb" style={{ margin: "18px auto 0", maxWidth: 560 }}>
              Un jour, une durée, une heure. Les créneaux affichés sont réellement
              libres, et il n&apos;y a rien à payer ici.
            </p>
          )}
        </div>

        <Calendrier
          mois={mois}
          nomMois={nomDuMois(mois)}
          jours={jours}
          creneauxParJour={creneauxParJour}
          moisPrecedent={mois > courant ? moisDecale(mois, -1) : null}
          moisSuivant={moisDecale(mois, 1)}
          compte={compte}
          deplacement={deplacement}
        />
      </div>
    </section>
  );
}
