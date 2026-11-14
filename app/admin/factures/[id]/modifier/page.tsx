import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { euros } from "@/lib/constantes";
import { moisLong } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import { enregistrerFacture, emettre } from "../../actions";
import Lignes from "./Lignes";

export const dynamic = "force-dynamic";

export default async function ModifierFacture({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { id } = await params;
  const { ok, erreur } = await searchParams;
  const supabase = clientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!facture) notFound();

  const [{ data: lignes }, { data: client }, { data: suggestion }] = await Promise.all([
    supabase
      .from("lignes_facture")
      .select("id, description, quantite, prix_unitaire_cents, total_cents")
      .eq("facture_id", id)
      .order("ordre"),
    supabase
      .from("dossiers")
      .select("id, prenom, nom, email, eleve_prenom, eleve_classe")
      .eq("id", facture.dossier_id)
      .maybeSingle(),
    supabase.rpc("numero_suggere"),
  ]);

  // Le tarif de l'élève sert de valeur par défaut au raccourci
  // « Heure de cours » : saisir le bon prix est le geste le plus
  // fréquent, autant le proposer.
  const { data: tarif } = await supabase
    .from("reservations")
    .select("prix_cents")
    .eq("dossier_id", facture.dossier_id)
    .not("prix_cents", "is", null)
    .order("debut", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tarifHoraire = tarif?.prix_cents ?? 4000;

  const brouillon = facture.statut === "brouillon";
  const defaut = `${client?.prenom ?? ""} ${client?.nom ?? ""}`.trim();

  return (
    <section className="section">
      <div className="conteneur-etroit">
        <p style={{ fontSize: 13.5, marginBottom: 10 }}>
          <Link href="/admin/factures">‹ Toutes les factures</Link>
        </p>

        <h1 style={{ fontSize: 36, lineHeight: 1.12 }}>
          {brouillon ? "Brouillon" : `Facture ${facture.numero}`}
        </h1>
        <p style={{ marginTop: 10, fontSize: 15, color: "var(--texte-doux)" }}>
          {client?.eleve_prenom} · {moisLong(facture.periode_debut)} ·{" "}
          <Link href={`/factures/${id}`} target="_blank">
            voir la facture
          </Link>
        </p>

        {ok === "memorise" ? (
          <p className="succes">
            Enregistré, et les coordonnées de facturation sont reportées sur la
            fiche de l&apos;élève.
          </p>
        ) : ok === "nouvelle" ? (
          <p className="succes">
            Facture créée, encore vide. Ajoutez vos lignes ci-dessous, puis
            émettez-la.
          </p>
        ) : ok ? (
          <p className="succes">Enregistré.</p>
        ) : null}
        {erreur === "emise" && (
          <p className="alerte">
            Cette facture est émise : ses lignes ne se modifient plus. Pour corriger,
            il faut établir un avoir.
          </p>
        )}
        {erreur === "vide" && (
          <p className="alerte">Une facture sans ligne ne peut pas être émise.</p>
        )}
        {erreur === "doublon" && (
          <p className="alerte">
            Ce numéro est déjà porté par une autre facture. Deux factures ne peuvent
            pas partager un numéro.
          </p>
        )}
        {erreur === "numero" && (
          <p className="alerte">
            L&apos;émission a échoué. Vérifiez le numéro saisi, puis réessayez.
          </p>
        )}

        {!brouillon ? (
          <p className="alerte" style={{ marginTop: 20 }}>
            <strong>Facture émise.</strong> Elle porte le numéro {facture.numero} et ne
            se modifie plus — c&apos;est ce qu&apos;exige une numérotation continue.
          </p>
        ) : (
          <>
          <div className="edition">
            <div className="edition__gauche">
              <Lignes
                factureId={id}
                initiales={(lignes ?? []).map((l) => ({
                  id: l.id,
                  description: l.description ?? "",
                  quantite: Number(l.quantite),
                  prix_unitaire_cents: l.prix_unitaire_cents,
                  total_cents: l.total_cents,
                }))}
                tarifHoraireCents={tarifHoraire}
              />
            </div>

            <aside className="edition__apercu">
              <p className="surtitre" style={{ marginBottom: 10 }}>
                Aperçu
              </p>
              <div className="apercu-facture">
                <div className="apercu-facture__tete">
                  <p className="apercu-facture__marque">
                    Les cours de <span>Pauline</span>
                  </p>
                  <div style={{ textAlign: "right" }}>
                    <p className="apercu-facture__etat">Brouillon</p>
                    <p className="apercu-facture__numero">
                      {(suggestion as string | null) ?? "—"}
                    </p>
                  </div>
                </div>
                <p className="apercu-facture__note">
                  Numéro et dates attribués à l&apos;émission
                </p>

                <p
                  className="surtitre"
                  style={{ marginTop: 18, marginBottom: 6, fontSize: 10.5 }}
                >
                  Facturé à
                </p>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                  {facture.destinataire_nom || defaut || "—"}
                  {facture.destinataire_adresse
                    ? String(facture.destinataire_adresse)
                        .split("\n")
                        .map((ligne: string) => (
                          <span key={ligne}>
                            <br />
                            {ligne}
                          </span>
                        ))
                    : null}
                  <br />
                  <span style={{ color: "var(--texte-gris)" }}>{client?.email}</span>
                </p>

                <p style={{ marginTop: 14, fontSize: 13, color: "var(--texte-gris)" }}>
                  {client?.eleve_prenom} · {moisLong(facture.periode_debut)}
                </p>

                <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--texte-gris)" }}>
                  Les lignes et le total figurent à gauche, à jour à la frappe. Pour
                  voir la facture entière telle qu&apos;elle partira,{" "}
                  <Link href={`/factures/${id}`} target="_blank">
                    visualisez-la
                  </Link>
                  .
                </p>

                <p style={{ marginTop: 14, fontSize: 11, color: "var(--texte-gris)" }}>
                  TVA non applicable, article 293 B du CGI.
                </p>
              </div>
            </aside>
          </div>

          <form action={enregistrerFacture} style={{ marginTop: 40 }}>
            <input type="hidden" name="id" value={id} />

            <h2 style={{ fontSize: 23, margin: "40px 0 6px" }}>Adapter cette facture</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
              Ce que le parent vous a demandé : un autre nom de destinataire, une
              adresse à faire figurer, une mention particulière. Vide, la facture
              reprend {defaut || "le nom du dossier"}.
            </p>

            <div className="carte" style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <div>
                <label htmlFor="destinataire_nom" style={etiquette}>
                  Facturé à
                </label>
                <input
                  id="destinataire_nom"
                  name="destinataire_nom"
                  type="text"
                  defaultValue={facture.destinataire_nom ?? ""}
                  placeholder={defaut}
                  style={saisie}
                />
              </div>
              <div>
                <label htmlFor="destinataire_adresse" style={etiquette}>
                  Adresse (facultative)
                </label>
                <textarea
                  id="destinataire_adresse"
                  name="destinataire_adresse"
                  rows={3}
                  defaultValue={facture.destinataire_adresse ?? ""}
                  placeholder={"12 rue des Lilas\n13007 Marseille"}
                  style={{ ...saisie, minHeight: 0, padding: "11px 14px", resize: "vertical" }}
                />
              </div>
              <div>
                <label htmlFor="note" style={etiquette}>
                  Mention portée sur la facture (facultative)
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={2}
                  defaultValue={facture.note ?? ""}
                  placeholder="Règlement en deux fois convenu, référence dossier CAF…"
                  style={{ ...saisie, minHeight: 0, padding: "11px 14px", resize: "vertical" }}
                />
              </div>
            </div>

            <label className="case-a-cocher" style={{ marginTop: 18 }}>
              <input type="checkbox" name="memoriser" value="1" />
              <span>
                Retenir ces coordonnées pour cet élève
                <span className="case-a-cocher__aide">
                  Elles sont copiées sur sa fiche, et les prochaines factures
                  partiront déjà remplies. Sinon, elles ne valent que pour
                  celle-ci.
                </span>
              </span>
            </label>

            <div className="total-brouillon">
              <span>Total du brouillon</span>
              <strong>{euros(facture.total_cents)}</strong>
            </div>

            <button
              type="submit"
              className="bouton bouton--principal"
              style={{ marginTop: 18, width: "100%" }}
            >
              Enregistrer
            </button>
          </form>
          </>
        )}

        {brouillon && (
          <form className="carte" style={{ marginTop: 18 }}>
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="retour"
              value={`/admin/factures/${id}/modifier`}
            />
            <p className="surtitre" style={{ marginBottom: 10 }}>
              Émettre
            </p>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
              Le numéro devient définitif et la facture part par email. Après cela,
              plus aucune modification n&apos;est possible.
            </p>

            <div style={{ marginTop: 16, maxWidth: 240 }}>
              <label htmlFor="numero" style={etiquette}>
                Numéro de la facture
              </label>
              <input
                id="numero"
                name="numero"
                type="text"
                defaultValue={(suggestion as string | null) ?? ""}
                style={{ ...saisie, fontVariantNumeric: "tabular-nums" }}
              />
            </div>
            <p style={{ marginTop: 9, fontSize: 13, lineHeight: 1.65, color: "var(--texte-gris)" }}>
              Proposé : <strong>{(suggestion as string | null) ?? "—"}</strong>, le
              suivant dans la série. Vous pouvez le remplacer, mais la numérotation
              doit rester continue et sans trou : c&apos;est une obligation
              comptable, et un numéro déjà utilisé sera refusé. Si vous saisissez un
              numéro plus avancé, la série reprendra à partir de celui-là.
            </p>

            <div style={{ marginTop: 20 }}>
              <label htmlFor="message" style={etiquette}>
                Un mot dans l&apos;email (facultatif)
              </label>
              <textarea
                id="message"
                name="message"
                rows={2}
                maxLength={1000}
                placeholder="Merci pour ce trimestre, Camille a beaucoup progressé."
                style={{ ...saisie, minHeight: 0, padding: "11px 14px", resize: "vertical" }}
              />
              <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: "var(--texte-gris)" }}>
                Il s&apos;ajoute au message type, qui garde le montant, l&apos;échéance
                et la facture en pièce jointe. Vous recevez une copie de ce qui part.
              </p>
            </div>

            <div className="actions-ligne" style={{ marginTop: 18, justifyContent: "flex-start" }}>
              <button
                type="submit"
                formAction={emettre.bind(null, "envoyer")}
                className="bouton bouton--or bouton--compact"
              >
                Émettre et envoyer
              </button>
              <button
                type="submit"
                formAction={emettre.bind(null, "plus-tard")}
                className="bouton bouton--secondaire bouton--compact"
              >
                Émettre, j&apos;enverrai plus tard
              </button>
              <a
                href={`/factures/${id}`}
                target="_blank"
                rel="noreferrer"
                style={{ alignSelf: "center", fontSize: 13.5 }}
              >
                Visualiser
              </a>
            </div>

            <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.65, color: "var(--texte-gris)" }}>
              Les deux attribuent le numéro et figent la facture. Le second
              n&apos;envoie rien : elle rejoint <strong>À envoyer</strong>, d&apos;où
              vous l&apos;expédierez, la téléchargerez, ou la déclarerez remise en
              main propre.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
