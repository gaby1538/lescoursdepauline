import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { euros } from "@/lib/constantes";
import { moisLong } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import { enregistrerFacture, supprimerLigne, emettreEtEnvoyer } from "../../actions";

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

        {ok && <p className="succes">Enregistré.</p>}
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
          <form action={enregistrerFacture} style={{ marginTop: 28 }}>
            <input type="hidden" name="id" value={id} />

            <h2 style={{ fontSize: 23, marginBottom: 6 }}>Les lignes</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
              Modifiez le libellé, la quantité ou le prix. Un montant négatif passe une
              remise. Le total se recalcule tout seul.
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {(lignes ?? []).map((l) => (
                <div key={l.id} className="carte ligne-facture">
                  <input type="hidden" name="ligne_id" value={l.id} />
                  <div className="ligne-facture__desc">
                    <label htmlFor={`d-${l.id}`} style={etiquette}>
                      Prestation
                    </label>
                    <input
                      id={`d-${l.id}`}
                      name="description"
                      type="text"
                      defaultValue={l.description}
                      style={saisie}
                    />
                  </div>
                  <div className="ligne-facture__petit">
                    <label htmlFor={`q-${l.id}`} style={etiquette}>
                      Quantité
                    </label>
                    <input
                      id={`q-${l.id}`}
                      name="quantite"
                      type="text"
                      inputMode="decimal"
                      defaultValue={String(Number(l.quantite))}
                      style={saisie}
                    />
                  </div>
                  <div className="ligne-facture__petit">
                    <label htmlFor={`p-${l.id}`} style={etiquette}>
                      Prix unitaire (€)
                    </label>
                    <input
                      id={`p-${l.id}`}
                      name="prix"
                      type="text"
                      inputMode="decimal"
                      defaultValue={(l.prix_unitaire_cents / 100).toString()}
                      style={saisie}
                    />
                  </div>
                  <p className="ligne-facture__total">{euros(l.total_cents)}</p>
                </div>
              ))}

              {(lignes ?? []).length === 0 && (
                <p style={{ fontSize: 15, color: "var(--texte-doux)" }}>
                  Aucune ligne. Ajoutez-en une ci-dessous.
                </p>
              )}
            </div>

            <div
              className="carte ligne-facture"
              style={{ marginTop: 12, background: "var(--creme-fonce)" }}
            >
              <div className="ligne-facture__desc">
                <label htmlFor="nd" style={etiquette}>
                  Ajouter une ligne
                </label>
                <input
                  id="nd"
                  name="nouvelle_description"
                  type="text"
                  placeholder="Stage de révision, remise, déplacement…"
                  style={saisie}
                />
              </div>
              <div className="ligne-facture__petit">
                <label htmlFor="nq" style={etiquette}>
                  Quantité
                </label>
                <input
                  id="nq"
                  name="nouvelle_quantite"
                  type="text"
                  inputMode="decimal"
                  defaultValue="1"
                  style={saisie}
                />
              </div>
              <div className="ligne-facture__petit">
                <label htmlFor="np" style={etiquette}>
                  Prix unitaire (€)
                </label>
                <input
                  id="np"
                  name="nouveau_prix"
                  type="text"
                  inputMode="decimal"
                  placeholder="-10 pour une remise"
                  style={saisie}
                />
              </div>
              <p className="ligne-facture__total">&nbsp;</p>
            </div>

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
        )}

        {brouillon && (lignes ?? []).length > 0 && (
          <div className="carte" style={{ marginTop: 28 }}>
            <p className="surtitre" style={{ marginBottom: 10 }}>
              Supprimer une ligne
            </p>
            <div className="actions-ligne" style={{ justifyContent: "flex-start" }}>
              {(lignes ?? []).map((l) => (
                <form key={l.id} action={supprimerLigne}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="facture" value={id} />
                  <button type="submit" className="lien-bouton">
                    {l.description.slice(0, 40)} ✕
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}

        {brouillon && (
          <form action={emettreEtEnvoyer} className="carte" style={{ marginTop: 18 }}>
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

            <button
              type="submit"
              className="bouton bouton--or bouton--compact"
              style={{ marginTop: 16 }}
            >
              Émettre et envoyer
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
