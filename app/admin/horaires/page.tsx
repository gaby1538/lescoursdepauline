import { clientAdmin } from "@/lib/supabase";
import { creneauLong, instantVersParis } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import {
  ajouterPlage,
  supprimerPlage,
  basculerPlage,
  ajouterAbsence,
  supprimerAbsence,
} from "./actions";

export const dynamic = "force-dynamic";

const JOURS = [
  "",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

const MESSAGES: Record<string, string> = {
  jour: "Choisissez un jour de la semaine.",
  heure: "Les heures doivent être au format 09:00.",
  ordre: "La fin doit venir après le début.",
  dates: "Les dates saisies ne sont pas valides.",
  base: "L'enregistrement a échoué. Réessayez dans un instant.",
};

type Plage = {
  id: string;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  actif: boolean;
};

type Absence = { id: string; debut: string; fin: string; motif: string | null };

export default async function Horaires({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; ok?: string }>;
}) {
  const { erreur, ok } = await searchParams;
  const supabase = clientAdmin();

  const [plages, absences] = await Promise.all([
    supabase
      .from("disponibilites")
      .select("id, jour_semaine, heure_debut, heure_fin, actif")
      .order("jour_semaine")
      .order("heure_debut"),
    supabase
      .from("indisponibilites")
      .select("id, debut, fin, motif")
      .gte("fin", new Date().toISOString())
      .order("debut"),
  ]);

  const liste = (plages.data ?? []) as Plage[];
  const parJour = JOURS.map((_, i) => liste.filter((p) => p.jour_semaine === i));

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p className="surtitre">Administration</p>
        <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Mes horaires</h1>
        <p className="plomb" style={{ marginTop: 16 }}>
          Les plages ci-dessous décrivent une semaine type. Le site y découpe des
          créneaux d&apos;une heure et n&apos;affiche que ceux qui restent libres.
        </p>

        {erreur && <p className="alerte">{MESSAGES[erreur] ?? "Action impossible."}</p>}
        {ok && <p className="succes">C&apos;est enregistré.</p>}

        <h2 style={{ fontSize: 25, margin: "44px 0 16px" }}>Semaine type</h2>

        <div className="tableau-enveloppe" style={{ padding: "8px 0" }}>
          {parJour.map((duJour, index) =>
            index === 0 ? null : (
              <div key={index} className="jour-plages">
                <p className="jour-plages__nom">{JOURS[index]}</p>
                <div className="jour-plages__liste">
                  {duJour.length === 0 ? (
                    <span className="jour-plages__vide">aucune plage</span>
                  ) : (
                    duJour.map((p) => (
                      <span
                        key={p.id}
                        className={`plage ${p.actif ? "" : "plage--inactive"}`}
                      >
                        {p.heure_debut.slice(0, 5)} – {p.heure_fin.slice(0, 5)}
                        <form action={basculerPlage} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="actif" value={p.actif ? "1" : "0"} />
                          <button
                            type="submit"
                            className="plage__action"
                            title={p.actif ? "Désactiver" : "Réactiver"}
                          >
                            {p.actif ? "pause" : "activer"}
                          </button>
                        </form>
                        <form action={supprimerPlage} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="plage__action" title="Supprimer">
                            ✕
                          </button>
                        </form>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <form action={ajouterPlage} className="carte" style={{ marginTop: 20 }}>
          <p className="surtitre" style={{ marginBottom: 16 }}>
            Ajouter une plage
          </p>
          <div className="rangee-formulaire">
            <div>
              <label htmlFor="jour_semaine" style={etiquette}>
                Jour
              </label>
              <select
                id="jour_semaine"
                name="jour_semaine"
                required
                style={{ ...saisie, padding: "0 12px" }}
              >
                {JOURS.map((nom, i) =>
                  i === 0 ? null : (
                    <option key={i} value={i}>
                      {nom}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label htmlFor="heure_debut" style={etiquette}>
                De
              </label>
              <input
                id="heure_debut"
                name="heure_debut"
                type="time"
                required
                step={1800}
                defaultValue="10:00"
                style={saisie}
              />
            </div>
            <div>
              <label htmlFor="heure_fin" style={etiquette}>
                À
              </label>
              <input
                id="heure_fin"
                name="heure_fin"
                type="time"
                required
                step={1800}
                defaultValue="12:00"
                style={saisie}
              />
            </div>
            <button type="submit" className="bouton bouton--principal bouton--compact">
              Ajouter
            </button>
          </div>
        </form>

        <h2 style={{ fontSize: 25, margin: "52px 0 10px" }}>Mes absences</h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Vacances, rendez-vous, journée bloquée. Les créneaux concernés disparaissent
          du site. Les cours déjà réservés sur cette période ne sont pas annulés
          automatiquement : prévenez les élèves, puis annulez-les depuis leur fiche.
        </p>

        <div className="tableau-enveloppe" style={{ marginTop: 18 }}>
          {(absences.data ?? []).length === 0 ? (
            <p style={{ padding: 24, fontSize: 15, color: "var(--texte-doux)" }}>
              Aucune absence à venir.
            </p>
          ) : (
            <table className="liste">
              <tbody>
                {((absences.data ?? []) as Absence[]).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{creneauLong(a.debut)}</strong>
                      <br />
                      <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                        jusqu&apos;au {creneauLong(a.fin)}
                      </span>
                    </td>
                    <td>{a.motif ?? "—"}</td>
                    <td className="droite">
                      <form action={supprimerAbsence}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className="lien-bouton">
                          supprimer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form action={ajouterAbsence} className="carte" style={{ marginTop: 20 }}>
          <p className="surtitre" style={{ marginBottom: 16 }}>
            Poser une absence
          </p>
          <div className="rangee-formulaire">
            <div>
              <label htmlFor="debut" style={etiquette}>
                Du
              </label>
              <input
                id="debut"
                name="debut"
                type="datetime-local"
                required
                defaultValue={instantVersParis(new Date().toISOString())}
                style={saisie}
              />
            </div>
            <div>
              <label htmlFor="fin" style={etiquette}>
                Au
              </label>
              <input id="fin" name="fin" type="datetime-local" required style={saisie} />
            </div>
            <div>
              <label htmlFor="motif" style={etiquette}>
                Motif (facultatif)
              </label>
              <input id="motif" name="motif" type="text" placeholder="Vacances" style={saisie} />
            </div>
            <button type="submit" className="bouton bouton--principal bouton--compact">
              Bloquer
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
