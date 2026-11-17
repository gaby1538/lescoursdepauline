import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { euros } from "@/lib/constantes";
import { dureeCourte, parisVersInstant } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import { creerSerie } from "../../actions";

export const dynamic = "force-dynamic";

const JOURS = [
  { valeur: 1, nom: "lundi" },
  { valeur: 2, nom: "mardi" },
  { valeur: 3, nom: "mercredi" },
  { valeur: 4, nom: "jeudi" },
  { valeur: 5, nom: "vendredi" },
  { valeur: 6, nom: "samedi" },
  { valeur: 7, nom: "dimanche" },
];

const DUREES = [
  { valeur: 60, nom: "1 h" },
  { valeur: 90, nom: "1 h 30" },
  { valeur: 120, nom: "2 h" },
];

/** Le quantième et le mois, sans l'année : la liste tient sur une ligne. */
function jourLisible(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function isoDuJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Le jour de la semaine d'une date civile, au sens isodow. */
function jourSemaine(iso: string): number {
  const n = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return n === 0 ? 7 : n;
}

type Seance = {
  jour: string;
  motif: string | null;
  bloquant: boolean;
};

export default async function SerieDeCours({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = clientAdmin();

  const { data: eleve } = await supabase
    .from("dossiers")
    .select("id, prenom, nom, eleve_prenom, eleve_classe, tarif_horaire_cents, email")
    .eq("id", id)
    .maybeSingle();

  if (!eleve) notFound();

  // Prolonger une série, c'est reprendre sa règle et repartir au
  // lendemain de sa dernière séance : deux clics pour le trimestre
  // suivant plutôt qu'une saisie entière.
  const { data: serieSource } = q.serie
    ? await supabase
        .from("series")
        .select("id, jour_semaine, heure, duree_min, prix_cents")
        .eq("id", q.serie)
        .maybeSingle()
    : { data: null };

  const { data: derniere } = q.serie
    ? await supabase
        .from("reservations")
        .select("debut")
        .eq("serie_id", q.serie)
        .order("debut", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const aujourdhui = new Date();

  const jourChoisi = Number(q.jour_semaine ?? serieSource?.jour_semaine ?? 2);
  const heure = /^\d{2}:\d{2}/.test(q.heure ?? "")
    ? (q.heure as string).slice(0, 5)
    : (serieSource?.heure ?? "17:00").slice(0, 5);
  const minutes = Number(q.duree ?? serieSource?.duree_min ?? 60);

  const tarifCents =
    serieSource?.prix_cents ?? eleve.tarif_horaire_cents ?? null;
  const prix =
    q.prix ?? (tarifCents !== null ? (tarifCents / 100).toString() : "");

  // La première séance : le lendemain de la dernière de la série qu'on
  // prolonge, ou aujourd'hui.
  const departParDefaut = derniere?.debut
    ? isoDuJour(new Date(Date.parse(derniere.debut) + 86400000))
    : isoDuJour(aujourdhui);

  const du = /^\d{4}-\d{2}-\d{2}$/.test(q.du ?? "") ? (q.du as string) : departParDefaut;

  const finParDefaut = isoDuJour(
    new Date(Date.parse(`${du}T12:00:00Z`) + 70 * 86400000)
  );
  const au = /^\d{4}-\d{2}-\d{2}$/.test(q.au ?? "") ? (q.au as string) : finParDefaut;

  // ---- les dates que la règle produit ----
  const candidates: string[] = [];
  if (au >= du) {
    const fin = Date.parse(`${au}T12:00:00Z`);
    for (
      let t = Date.parse(`${du}T12:00:00Z`);
      t <= fin && candidates.length < 60;
      t += 86400000
    ) {
      const jour = isoDuJour(new Date(t));
      if (jourSemaine(jour) === jourChoisi) candidates.push(jour);
    }
  }

  // ---- ce qui empêche une date ----
  const premiere = candidates[0] ?? du;
  const derniereDate = candidates[candidates.length - 1] ?? au;

  const [{ data: vacances }, { data: indispos }, { data: occupe }] =
    await Promise.all([
      supabase
        .from("vacances_scolaires")
        .select("nom, debut, fin")
        .lte("debut", derniereDate)
        .gte("fin", premiere),
      supabase
        .from("indisponibilites")
        .select("debut, fin")
        .lt("debut", `${derniereDate}T23:59:59Z`)
        .gt("fin", `${premiere}T00:00:00Z`),
      supabase
        .from("reservations")
        .select("debut, fin, dossier_id, dossiers (eleve_prenom)")
        .in("statut", ["reservee", "effectuee"])
        .lt("debut", `${derniereDate}T23:59:59Z`)
        .gt("fin", `${premiere}T00:00:00Z`),
    ]);

  type Occupation = {
    debut: string;
    fin: string;
    dossier_id: string;
    dossiers: { eleve_prenom: string | null } | null;
  };

  const seances: Seance[] = candidates.map((jour) => {
    const debut = parisVersInstant(`${jour}T${heure}`);
    const fin = debut
      ? new Date(Date.parse(debut) + minutes * 60000).toISOString()
      : null;

    const vacance = (vacances ?? []).find(
      (v) => v.debut <= jour && v.fin >= jour
    );
    if (vacance) return { jour, motif: vacance.nom, bloquant: false };

    if (debut && fin) {
      const pris = ((occupe ?? []) as unknown as Occupation[]).find(
        (r) => r.debut < fin && r.fin > debut && r.dossier_id !== id
      );
      if (pris) {
        const qui = pris.dossiers?.eleve_prenom;
        return {
          jour,
          motif: qui
            ? `Vous avez déjà un cours avec ${qui} à cette heure`
            : "Vous avez déjà un cours à cette heure",
          bloquant: true,
        };
      }

      const empeche = (indispos ?? []).find(
        (i) => i.debut < fin && i.fin > debut
      );
      if (empeche) {
        return { jour, motif: "Vous vous êtes marquée indisponible", bloquant: false };
      }
    }

    return { jour, motif: null, bloquant: false };
  });

  const retenues = seances.filter((s) => !s.motif);

  // Le tarif saisi est horaire ; une séance de deux heures en vaut deux.
  const horaire = Math.round(Number((prix || "0").replace(",", ".")) * 100) || 0;
  const cents = Math.round((horaire * minutes) / 60);

  const nomEleve =
    eleve.eleve_prenom || `${eleve.prenom ?? ""} ${eleve.nom ?? ""}`.trim() || "—";

  const lien = (modifs: Record<string, string>) => {
    const p = new URLSearchParams({
      jour_semaine: String(jourChoisi),
      heure,
      duree: String(minutes),
      du,
      au,
      prix,
      ...(q.serie ? { serie: q.serie } : {}),
      ...modifs,
    });
    return `/admin/eleves/${id}/serie?${p.toString()}`;
  };

  // Un raccourci ne vaut que s'il tombe après la première séance.
  const finDeVacances = (vacances ?? [])
    .filter((v) => v.debut > du)
    .sort((a, b) => a.debut.localeCompare(b.debut))[0];

  return (
    <section className="section">
      <div className="conteneur">
        <p style={{ fontSize: 13.5, marginBottom: 14 }}>
          <Link href={`/admin/eleves/${id}`}>‹ Retour à la fiche</Link>
        </p>

        <p className="surtitre">
          {nomEleve}
          {eleve.eleve_classe ? ` · ${eleve.eleve_classe}` : ""}
        </p>
        <h1 style={{ fontSize: 34, lineHeight: 1.12 }}>
          {q.serie ? "Prolonger la série" : "Une série de cours"}
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: "var(--texte-doux)",
            maxWidth: "70ch",
          }}
        >
          Vous décrivez la règle à gauche ; la liste des séances se dessine à
          droite. Rien n&apos;est créé tant que vous n&apos;avez pas lu cette liste.
        </p>

        {q.erreur === "aucune" && (
          <p className="alerte">
            Aucune séance n&apos;était cochée : il n&apos;y avait rien à créer.
          </p>
        )}
        {q.erreur === "creation" && (
          <p className="alerte">La série n&apos;a pas pu être créée. Réessayez.</p>
        )}

        <div className="edition" style={{ marginTop: 26 }}>
          {/* ---- la règle ---- */}
          <div className="edition__gauche">
            <form method="get" className="carte">
              {q.serie && <input type="hidden" name="serie" value={q.serie} />}

              <p className="surtitre" style={{ marginBottom: 16 }}>
                Le créneau
              </p>

              <div className="trio">
                <div>
                  <label htmlFor="jour_semaine" style={etiquette}>
                    Tous les
                  </label>
                  <select
                    id="jour_semaine"
                    name="jour_semaine"
                    defaultValue={String(jourChoisi)}
                    style={saisie}
                  >
                    {JOURS.map((j) => (
                      <option key={j.valeur} value={j.valeur}>
                        {j.nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="heure" style={etiquette}>
                    À
                  </label>
                  <input
                    id="heure"
                    name="heure"
                    type="time"
                    defaultValue={heure}
                    style={{ ...saisie, fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div>
                  <label htmlFor="duree" style={etiquette}>
                    Durée
                  </label>
                  <select
                    id="duree"
                    name="duree"
                    defaultValue={String(minutes)}
                    style={saisie}
                  >
                    {DUREES.map((d) => (
                      <option key={d.valeur} value={d.valeur}>
                        {d.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="filet-section" />

              <p className="surtitre" style={{ marginBottom: 14 }}>
                Jusqu&apos;à quand
              </p>

              <div className="duo">
                <div>
                  <label htmlFor="du" style={etiquette}>
                    Première séance
                  </label>
                  <input id="du" name="du" type="date" defaultValue={du} style={saisie} />
                </div>
                <div>
                  <label htmlFor="au" style={etiquette}>
                    Dernière séance
                  </label>
                  <input id="au" name="au" type="date" defaultValue={au} style={saisie} />
                </div>
              </div>

              <div className="duo" style={{ marginTop: 16 }}>
                <div>
                  <label htmlFor="prix" style={etiquette}>
                    Tarif horaire
                  </label>
                  <input
                    id="prix"
                    name="prix"
                    type="text"
                    inputMode="decimal"
                    defaultValue={prix}
                    placeholder="39"
                    style={{ ...saisie, fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div style={{ alignSelf: "end" }}>
                  <button type="submit" className="action action--foret">
                    Voir les séances
                  </button>
                </div>
              </div>

              <p style={{ marginTop: 12, fontSize: 13, color: "var(--texte-gris)" }}>
                Le tarif de sa fiche, par heure. Une séance de{" "}
                {dureeCourte(minutes / 60)} en vaut donc {euros(cents)}, et se
                corrige ensuite au cas par cas.
              </p>
            </form>

            {finDeVacances && (
              <div className="periodes" style={{ marginTop: 14 }}>
                <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                  Arrêter la série :
                </span>
                <Link
                  href={lien({
                    au: isoDuJour(
                      new Date(Date.parse(`${finDeVacances.debut}T12:00:00Z`) - 86400000)
                    ),
                  })}
                  className="periode"
                >
                  avant {finDeVacances.nom.toLowerCase()}
                </Link>
                <Link
                  href={lien({
                    au: isoDuJour(
                      new Date(Date.parse(`${du}T12:00:00Z`) + 140 * 86400000)
                    ),
                  })}
                  className="periode"
                >
                  dans cinq mois
                </Link>
              </div>
            )}

            <div className="carte" style={{ marginTop: 14 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--texte)" }}>
                Prévenir l&apos;élève par email
              </p>
              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--texte-gris)",
                }}
              >
                {eleve.email
                  ? "Aucun message ne part : les cours que vous posez vous-même ne préviennent personne. Si vous voulez l'avertir, écrivez-lui."
                  : "Cette fiche n'a pas d'adresse : personne ne sera prévenu."}
              </p>
            </div>
          </div>

          {/* ---- l'aperçu ---- */}
          <aside className="edition__apercu">
            <p className="surtitre" style={{ marginBottom: 5 }}>
              Les séances qui seront créées
            </p>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 12.5,
                lineHeight: 1.55,
                color: "var(--texte-gris)",
              }}
            >
              Décochées d&apos;office : vos indisponibilités, la Toussaint, Noël et
              les grandes vacances — les seules identiques dans toute la France.
              Février et Pâques changent selon la zone de l&apos;élève : à vous de
              les décocher.
            </p>

            <form action={creerSerie}>
              <input type="hidden" name="dossier" value={id} />
              <input type="hidden" name="jour_semaine" value={jourChoisi} />
              <input type="hidden" name="heure" value={heure} />
              <input type="hidden" name="duree" value={minutes} />
              <input type="hidden" name="prix" value={prix} />

              {seances.length === 0 ? (
                <p className="carte" style={{ fontSize: 14.5, color: "var(--texte-doux)" }}>
                  Aucune date ne tombe un {JOURS[jourChoisi - 1].nom} entre ces deux
                  bornes.
                </p>
              ) : (
                <div className="liste-seances">
                  {seances.map((s) => (
                    <label
                      key={s.jour}
                      className={
                        s.motif
                          ? s.bloquant
                            ? "seance seance--conflit"
                            : "seance seance--ecartee"
                          : "seance"
                      }
                    >
                      <input
                        type="checkbox"
                        name="jour"
                        value={s.jour}
                        defaultChecked={!s.motif}
                      />
                      <span className="seance__corps">
                        <span className="seance__date">
                          {jourLisible(s.jour)} · {heure}
                        </span>
                        {s.motif && (
                          <span
                            className={
                              s.bloquant ? "seance__motif seance__motif--fort" : "seance__motif"
                            }
                          >
                            {s.motif}
                          </span>
                        )}
                      </span>
                      <span className="seance__prix">{euros(cents)}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="lignes__total">
                <span>
                  {retenues.length} séance{retenues.length > 1 ? "s" : ""} retenue
                  {retenues.length > 1 ? "s" : ""} sur {seances.length}
                </span>
                <strong>{euros(retenues.length * cents)}</strong>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  marginTop: 16,
                }}
              >
                <button
                  type="submit"
                  className="action action--foret action--grand"
                  disabled={seances.length === 0}
                >
                  Créer les séances cochées
                </button>
                <Link href={`/admin/eleves/${id}`} className="action action--discret">
                  Annuler
                </Link>
              </div>

              <p
                style={{
                  margin: "14px 0 0",
                  fontSize: 12.5,
                  lineHeight: 1.65,
                  color: "var(--texte-gris)",
                }}
              >
                Les séances décochées ne sont pas créées — ni trace, ni cours fantôme
                à annuler plus tard. Une fois posées, elles vivent chacune leur vie :
                en décaler une ne touche pas les autres.
              </p>
            </form>
          </aside>
        </div>
      </div>
    </section>
  );
}
