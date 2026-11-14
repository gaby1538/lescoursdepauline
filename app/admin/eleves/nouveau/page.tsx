import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { etiquette, saisie } from "@/components/Champs";
import { creerEleve } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Créer un élève — une fiche, pas un compte.
 *
 * Jusqu'ici un dossier naissait d'une réservation : quelqu'un arrivait
 * sur le site et laissait son adresse. Pauline a aussi des élèves qui
 * n'y viendront jamais, et parfois pas d'adresse du tout. La fiche
 * existe alors pour elle seule : tenir un emploi du temps, préparer
 * des factures.
 *
 * D'où l'ordre des champs : l'élève d'abord, le contact ensuite et
 * tout entier facultatif, l'accès au site en dernier et décoché.
 */
export default async function NouvelEleve({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  // Le tarif de départ : celui de la grille, pour ne pas le retaper.
  const { data: tarif } = await clientAdmin()
    .from("tarifs")
    .select("prix_cents")
    .is("valide_au", null)
    .order("prix_cents")
    .limit(1)
    .maybeSingle();

  const propose = tarif?.prix_cents ? (tarif.prix_cents / 100).toString() : "";

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p style={{ fontSize: 13.5, marginBottom: 14 }}>
          <Link href="/admin/eleves">‹ Tous les élèves</Link>
        </p>

        <p className="surtitre">Administration</p>
        <h1 style={{ fontSize: 36, lineHeight: 1.12 }}>Nouvel élève</h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 14.5,
            lineHeight: 1.7,
            color: "var(--texte-doux)",
          }}
        >
          Une fiche, pas un compte. Elle existe pour vous : poser des cours dans
          l&apos;agenda et préparer des factures. L&apos;élève n&apos;en sait rien
          tant que vous ne l&apos;invitez pas.
        </p>

        {erreur === "prenom" && (
          <p className="alerte">Le prénom de l&apos;élève est le seul champ obligatoire.</p>
        )}
        {erreur === "email" && (
          <p className="alerte">Cette adresse email ne ressemble pas à une adresse.</p>
        )}
        {erreur === "creation" && (
          <p className="alerte">La fiche n&apos;a pas pu être créée. Réessayez.</p>
        )}

        <form action={creerEleve}>
          {/* l'élève : le strict nécessaire */}
          <div className="carte" style={{ marginTop: 24 }}>
            <div className="duo">
              <div>
                <label htmlFor="eleve_prenom" style={etiquette}>
                  Prénom de l&apos;élève <span style={{ color: "var(--or-texte)" }}>*</span>
                </label>
                <input
                  id="eleve_prenom"
                  name="eleve_prenom"
                  type="text"
                  required
                  autoFocus
                  style={saisie}
                />
              </div>
              <div>
                <label htmlFor="nom" style={etiquette}>
                  Nom de famille
                </label>
                <input id="nom" name="nom" type="text" style={saisie} />
              </div>
            </div>

            <div className="duo" style={{ marginTop: 16 }}>
              <div>
                <label htmlFor="eleve_classe" style={etiquette}>
                  Classe
                </label>
                <input
                  id="eleve_classe"
                  name="eleve_classe"
                  type="text"
                  placeholder="Première spécialité"
                  style={saisie}
                />
              </div>
              <div>
                <label htmlFor="tarif" style={etiquette}>
                  Tarif horaire
                </label>
                <input
                  id="tarif"
                  name="tarif"
                  type="text"
                  inputMode="decimal"
                  defaultValue={propose}
                  placeholder="39"
                  style={{ ...saisie, fontVariantNumeric: "tabular-nums" }}
                />
              </div>
            </div>
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--texte-gris)" }}>
              Repris sur chacun de ses cours et de ses factures. Modifiable au cas
              par cas.
            </p>
          </div>

          {/* le contact : tout facultatif, et on le dit */}
          <div className="carte" style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "baseline",
                justifyContent: "space-between",
              }}
            >
              <p className="surtitre" style={{ margin: 0 }}>
                Contact
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--texte-gris)" }}>
                tout est facultatif
              </p>
            </div>

            <p
              style={{
                marginTop: 12,
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--texte-doux)",
              }}
            >
              Sans adresse email, l&apos;élève n&apos;a aucun accès au site : vous
              posez ses cours et préparez ses factures vous-même, et rien ne part
              jamais tout seul. Vous pourrez en ajouter une plus tard.
            </p>

            <div className="duo" style={{ marginTop: 18 }}>
              <div>
                <label htmlFor="prenom" style={etiquette}>
                  Parent ou responsable
                </label>
                <input
                  id="prenom"
                  name="prenom"
                  type="text"
                  placeholder="Claire"
                  style={saisie}
                />
              </div>
              <div>
                <label htmlFor="telephone" style={etiquette}>
                  Téléphone
                </label>
                <input id="telephone" name="telephone" type="tel" style={saisie} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label htmlFor="email" style={etiquette}>
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="laissez vide si vous n'en avez pas"
                style={saisie}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label htmlFor="facturation_adresse" style={etiquette}>
                Adresse de facturation
              </label>
              <textarea
                id="facturation_adresse"
                name="facturation_adresse"
                rows={2}
                placeholder={"18 rue Paradis\n13006 Marseille"}
                style={{ ...saisie, minHeight: 0, padding: "11px 14px", resize: "vertical" }}
              />
            </div>
          </div>

          <p
            style={{
              marginTop: 18,
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--texte-gris)",
            }}
          >
            Donner accès au site est un geste à part, qui se fait depuis sa fiche —
            jamais par effet de bord d&apos;une création.
          </p>

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
              Créer la fiche
            </button>
            <button
              type="submit"
              name="suite"
              value="cours"
              className="action action--contour action--grand"
            >
              Créer la fiche et poser ses cours
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
