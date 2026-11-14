import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { etiquette, saisie } from "@/components/Champs";
import { ajouterCours } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * Poser un cours, à l'unité.
 *
 * Pas de validation à demander, pas de créneau à chercher dans les
 * disponibilités : c'est Pauline qui écrit son agenda. Le seul refus
 * possible est le chevauchement, et il vient de la base.
 */
export default async function AjouterUnCours({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; jour?: string }>;
}) {
  const { id } = await params;
  const { erreur, jour } = await searchParams;

  const { data: eleve } = await clientAdmin()
    .from("dossiers")
    .select("id, prenom, nom, eleve_prenom, eleve_classe, tarif_horaire_cents")
    .eq("id", id)
    .maybeSingle();

  if (!eleve) notFound();

  const nomEleve =
    eleve.eleve_prenom || `${eleve.prenom ?? ""} ${eleve.nom ?? ""}`.trim() || "—";

  const prix =
    eleve.tarif_horaire_cents !== null && eleve.tarif_horaire_cents !== undefined
      ? (eleve.tarif_horaire_cents / 100).toString()
      : "";

  const defautJour = /^\d{4}-\d{2}-\d{2}$/.test(jour ?? "")
    ? jour
    : new Date().toISOString().slice(0, 10);

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p style={{ fontSize: 13.5, marginBottom: 14 }}>
          <Link href={`/admin/eleves/${id}`}>‹ Retour à la fiche</Link>
        </p>

        <p className="surtitre">
          {nomEleve}
          {eleve.eleve_classe ? ` · ${eleve.eleve_classe}` : ""}
        </p>
        <h1 style={{ fontSize: 34, lineHeight: 1.12 }}>Poser un cours</h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: "var(--texte-doux)",
          }}
        >
          Il est valide d&apos;emblée — c&apos;est vous qui le créez, il n&apos;y a
          rien à valider. Il peut tomber hors de vos disponibilités habituelles :
          vous décidez de votre agenda.
        </p>

        {erreur === "date" && (
          <p className="alerte">Cette date ou cette heure n&apos;est pas valide.</p>
        )}
        {erreur === "pris" && (
          <p className="alerte">
            Vous avez déjà un cours sur ce créneau. Deux élèves ne peuvent pas
            occuper la même heure — choisissez un autre moment.
          </p>
        )}
        {erreur === "creation" && (
          <p className="alerte">Le cours n&apos;a pas pu être créé. Réessayez.</p>
        )}

        <form action={ajouterCours} className="carte" style={{ marginTop: 24 }}>
          <input type="hidden" name="dossier" value={id} />

          <div className="trio">
            <div>
              <label htmlFor="jour" style={etiquette}>
                Date
              </label>
              <input
                id="jour"
                name="jour"
                type="date"
                required
                defaultValue={defautJour}
                style={saisie}
              />
            </div>
            <div>
              <label htmlFor="heure" style={etiquette}>
                Heure
              </label>
              <input
                id="heure"
                name="heure"
                type="time"
                required
                defaultValue="17:00"
                style={{ ...saisie, fontVariantNumeric: "tabular-nums" }}
              />
            </div>
            <div>
              <label htmlFor="duree" style={etiquette}>
                Durée
              </label>
              <select id="duree" name="duree" defaultValue="60" style={saisie}>
                <option value="60">1 h</option>
                <option value="90">1 h 30</option>
                <option value="120">2 h</option>
              </select>
            </div>
          </div>

          <div className="duo" style={{ marginTop: 16 }}>
            <div>
              <label htmlFor="prix" style={etiquette}>
                Tarif
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
            <div>
              <label htmlFor="sujet" style={etiquette}>
                Sujet (facultatif)
              </label>
              <input
                id="sujet"
                name="sujet"
                type="text"
                placeholder="Génétique, révisions du bac blanc…"
                style={saisie}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              marginTop: 22,
            }}
          >
            <button type="submit" className="action action--foret action--grand">
              Poser le cours
            </button>
            <Link
              href={`/admin/eleves/${id}/serie`}
              className="action action--contour action--grand"
            >
              Plutôt une série
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
