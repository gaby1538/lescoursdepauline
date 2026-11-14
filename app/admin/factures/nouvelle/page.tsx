import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { etiquette, saisie } from "@/components/Champs";
import { creerFactureManuelle } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Une facture partie de rien.
 *
 * Le reste du site facture ce qu'il a vu passer : des cours réservés,
 * donnés, validés. Celle-ci ne s'appuie sur rien — un stage, un
 * forfait, quelqu'un qui n'est jamais passé par le site. C'est l'outil
 * de facturation seul, sans le reste.
 */
export default async function NouvelleFacture({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const supabase = clientAdmin();

  const { data: clients } = await supabase
    .from("dossiers")
    .select("id, prenom, nom, email, eleve_prenom")
    .eq("anonymise", false)
    .order("nom", { nullsFirst: false })
    .limit(500);

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p style={{ fontSize: 13.5, marginBottom: 14 }}>
          <Link href="/admin/factures">‹ Toutes les factures</Link>
        </p>

        <div className="admin__titre">
          <div>
            <p className="surtitre">Administration</p>
            <h1 style={{ fontSize: 36, lineHeight: 1.12 }}>Nouvelle facture</h1>
          </div>
        </div>

        {erreur === "client" && (
          <p className="alerte">
            Choisissez un client existant, ou donnez au moins une adresse email
            valide pour en créer un.
          </p>
        )}
        {erreur === "creation" && (
          <p className="alerte">La facture n&apos;a pas pu être créée. Réessayez.</p>
        )}

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--texte-doux)",
            marginBottom: 22,
          }}
        >
          Une facture sans réservation derrière elle : un stage, un forfait, une
          prestation réglée autrement. Elle naît vide, et vous y ajoutez vos lignes
          sur l&apos;écran suivant.
        </p>

        <div className="carte">
          <form action={creerFactureManuelle}>
            <label htmlFor="dossier_id" style={etiquette}>
              Pour un client déjà connu
            </label>
            <select id="dossier_id" name="dossier_id" style={saisie} defaultValue="">
              <option value="">— choisir —</option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.prenom, c.nom].filter(Boolean).join(" ") || c.email}
                  {c.eleve_prenom ? ` · ${c.eleve_prenom}` : ""}
                </option>
              ))}
            </select>
            <p style={{ marginTop: 8, fontSize: 13, color: "var(--texte-gris)" }}>
              Son nom de facturation et son adresse sont repris automatiquement.
            </p>
            <button
              type="submit"
              className="bouton bouton--principal bouton--compact"
              style={{ marginTop: 14 }}
            >
              Créer la facture
            </button>
          </form>

          <details className="repli-discret" style={{ marginTop: 26 }}>
            <summary>Pour un nouveau client</summary>
            <div className="repli-discret__corps">
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: "var(--texte-gris)",
                  marginBottom: 16,
                }}
              >
                Il est enregistré en même temps que la facture et vous le
                retrouverez dans la liste ci-dessus la prochaine fois. Si
                l&apos;adresse email correspond à un client existant, c&apos;est ce
                dossier qui est utilisé plutôt qu&apos;un second.
              </p>

              <form action={creerFactureManuelle}>
                <div className="duo">
                  <div>
                    <label htmlFor="prenom" style={etiquette}>
                      Prénom
                    </label>
                    <input id="prenom" name="prenom" type="text" style={saisie} />
                  </div>
                  <div>
                    <label htmlFor="nom" style={etiquette}>
                      Nom
                    </label>
                    <input id="nom" name="nom" type="text" style={saisie} />
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <label htmlFor="email" style={etiquette}>
                    Adresse email <span style={{ color: "var(--or-texte)" }}>*</span>
                  </label>
                  <input id="email" name="email" type="email" required style={saisie} />
                </div>

                <div style={{ marginTop: 14 }}>
                  <label htmlFor="facturation_nom" style={etiquette}>
                    Nom sur la facture, s&apos;il diffère
                  </label>
                  <input
                    id="facturation_nom"
                    name="facturation_nom"
                    type="text"
                    placeholder="Société Dupont, ou Madame Claire Dubois"
                    style={saisie}
                  />
                </div>

                <div style={{ marginTop: 14 }}>
                  <label htmlFor="facturation_adresse" style={etiquette}>
                    Adresse de facturation
                  </label>
                  <textarea
                    id="facturation_adresse"
                    name="facturation_adresse"
                    rows={3}
                    placeholder={"12 rue des Lilas\n13006 Marseille"}
                    style={{ ...saisie, resize: "vertical" }}
                  />
                </div>

                <button
                  type="submit"
                  className="bouton bouton--secondaire bouton--compact"
                  style={{ marginTop: 18 }}
                >
                  Créer le client et sa facture
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
