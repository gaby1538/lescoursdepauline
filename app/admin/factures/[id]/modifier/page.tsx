import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAdmin } from "@/lib/supabase";
import { euros } from "@/lib/constantes";
import { periodeLisible } from "@/lib/dates";
import { etiquette, saisie } from "@/components/Champs";
import {
  annulerEnvoi,
  demarquerPayee,
  enregistrerFacture,
  remettreEnBrouillon,
} from "../../actions";
import Edition from "./Edition";

export const dynamic = "force-dynamic";

export default async function ModifierFacture({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    ok?: string;
    erreur?: string;
    numero?: string;
    corriger?: string;
  }>;
}) {
  const { id } = await params;
  const { ok, erreur, numero: numeroRendu, corriger } = await searchParams;
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

  // Le numéro ne se rend qu'au bout de la série : au milieu, il
  // laisserait un trou que rien ne vient combler. On le vérifie ici pour
  // ne pas proposer un bouton qui ne peut que refuser.
  const rang = /^(\d{4})-(\d+)$/.exec(facture.numero ?? "");
  const { data: compteur } = rang
    ? await supabase
        .from("compteur_factures")
        .select("dernier")
        .eq("annee", Number(rang[1]))
        .maybeSingle()
    : { data: null };

  const derniereDeLaSerie = !!rang && compteur?.dernier === Number(rang[2]);
  const transmise = !!(
    facture.envoyee_le ||
    facture.remise_le ||
    facture.transferee_le
  );
  const defaut = `${client?.prenom ?? ""} ${client?.nom ?? ""}`.trim();
  const mois = periodeLisible(facture.periode_debut, facture.periode_fin);
  const titre = mois ? mois.charAt(0).toUpperCase() + mois.slice(1) : "Brouillon";

  return (
    <section className="section">
      <div className="conteneur">
        <p style={{ fontSize: 13.5, marginBottom: 14 }}>
          <Link href="/admin/factures">‹ Toutes les factures</Link>
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
        ) : ok === "rendue" ? (
          <p className="succes">
            Le numéro {numeroRendu || "précédent"} est rendu à la série : la
            prochaine facture émise le reprendra. Celle-ci est redevenue un
            brouillon, avec ses lignes intactes.
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
        {erreur === "pas_la_derniere" && (
          <p className="alerte">
            Cette facture n&apos;est pas la dernière émise de l&apos;année : lui
            reprendre son numéro laisserait un trou au milieu de la série, ce
            qu&apos;une numérotation continue interdit. Pour la corriger, émettez
            une facture rectificative.
          </p>
        )}
        {erreur === "numero_hors_serie" && (
          <p className="alerte">
            Son numéro ne suit pas la forme de la série ({new Date().getFullYear()}
            -0001) : le site ne sait pas à quel rang le rendre.
          </p>
        )}
        {erreur === "deja_brouillon" && (
          <p className="alerte">Cette facture est déjà un brouillon.</p>
        )}
        {erreur === "retour_impossible" && (
          <p className="alerte">
            Le retour au brouillon a échoué. Rechargez la page et réessayez.
          </p>
        )}
        {erreur === "numero" && (
          <p className="alerte">
            L&apos;émission a échoué. Vérifiez le numéro saisi, puis réessayez.
          </p>
        )}

        {!brouillon ? (
          <>
            <div className="admin__titre">
              <div>
                <p className="surtitre">Facture {facture.numero}</p>
                <h1 style={{ fontSize: 36, lineHeight: 1.12 }}>{titre}</h1>
              </div>
              <Link
                href={`/admin/factures/${id}/apercu`}
                className="action action--contour"
              >
                Visualiser
              </Link>
            </div>
            <p className="alerte">
              <strong>Facture émise.</strong> Elle porte le numéro {facture.numero} et
              ne se modifie plus — c&apos;est ce qu&apos;exige une numérotation
              continue.
            </p>

            {/* Replié, parce qu'on ne revient pas en arrière tous les
                jours — mais à portée de main, parce que l'erreur de clic
                existe et qu'il n'y avait aucun moyen de la réparer. */}
            <details
              className="repli-discret"
              style={{ marginTop: 36 }}
              open={corriger === "1"}
            >
              <summary>Corriger l&apos;état de cette facture</summary>
              <div className="repli-discret__corps">
                {transmise && (
                  <form action={annulerEnvoi} style={{ marginBottom: 28 }}>
                    <input type="hidden" name="id" value={id} />
                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: "var(--texte-doux)",
                        marginBottom: 14,
                      }}
                    >
                      Partie trop vite, ou « remise en main propre » cochée à tort ?
                      Elle retourne dans « À envoyer », prête à repartir. Son numéro,
                      ses dates et son montant ne bougent pas — c&apos;est le retour
                      en arrière le plus sûr des trois.
                    </p>
                    <button type="submit" className="action action--contour">
                      Marquer comme non envoyée
                    </button>
                  </form>
                )}

                {facture.payee_le && (
                  <form action={demarquerPayee} style={{ marginBottom: 28 }}>
                    <input type="hidden" name="id" value={id} />
                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: "var(--texte-doux)",
                        marginBottom: 14,
                      }}
                    >
                      Pointée payée par erreur, ou sur la mauvaise ligne ? Elle
                      repasse en attente de règlement et ressort du livre des
                      recettes à cette date. Son numéro ne bouge pas.
                    </p>
                    <button type="submit" className="action action--contour">
                      Démarquer « payée »
                    </button>
                  </form>
                )}

                {derniereDeLaSerie ? (
                  <form action={remettreEnBrouillon}>
                    <input type="hidden" name="id" value={id} />
                    <p
                      style={{
                        fontSize: 14.5,
                        lineHeight: 1.65,
                        color: "var(--texte-doux)",
                        marginBottom: 14,
                      }}
                    >
                      Elle porte le dernier numéro de l&apos;année : il peut lui
                      être repris sans trouer la série. La facture redevient un
                      brouillon modifiable, garde ses lignes et ses cours, et
                      c&apos;est la prochaine émission qui reprendra{" "}
                      {facture.numero}.
                    </p>

                    {transmise && (
                      <p className="alerte" style={{ marginBottom: 16 }}>
                        <strong>Elle est déjà partie chez la famille.</strong> Le
                        document qu&apos;elle a reçu porte {facture.numero} ; si
                        vous rendez ce numéro, il désignera ensuite une autre
                        facture. Mieux vaut, dans ce cas, prévenir la famille ou
                        lui renvoyer la version corrigée.
                      </p>
                    )}

                    <button type="submit" className="action action--contour">
                      Remettre en brouillon
                    </button>
                  </form>
                ) : (
                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.65,
                      color: "var(--texte-doux)",
                    }}
                  >
                    Elle n&apos;est pas la dernière émise de l&apos;année : lui
                    reprendre son numéro laisserait un trou au milieu de la
                    série. Une numérotation continue l&apos;interdit, et le site
                    ne sait pas le faire. Pour corriger une facture de ce
                    rang-là, il faut en émettre une rectificative.
                  </p>
                )}
              </div>
            </details>
          </>
        ) : (
          <>
            <Edition
              factureId={id}
              initiales={(lignes ?? []).map((l) => ({
                id: l.id,
                description: l.description ?? "",
                quantite: Number(l.quantite),
                prix_unitaire_cents: l.prix_unitaire_cents,
                total_cents: l.total_cents,
              }))}
              tarifHoraireCents={tarifHoraire}
              numeroSuggere={(suggestion as string | null) ?? ""}
              eleve={client?.eleve_prenom ?? defaut ?? ""}
              periode={titre}
              destinataireNom={facture.destinataire_nom || defaut}
              destinataireAdresse={facture.destinataire_adresse}
              email={client?.email ?? null}
            />

            {/* Le cas particulier : un autre nom sur la facture, une
                adresse, une mention. Replié, parce que neuf factures sur
                dix n'en ont pas besoin. */}
            <details className="repli-discret" style={{ marginTop: 40 }}>
              <summary>Coordonnées de facturation et mention particulière</summary>
              <div className="repli-discret__corps">
                <form action={enregistrerFacture}>
                  <input type="hidden" name="id" value={id} />

                  <p
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.65,
                      color: "var(--texte-doux)",
                      marginBottom: 16,
                    }}
                  >
                    Ce que le parent vous a demandé : un autre nom de destinataire,
                    une adresse à faire figurer, une mention particulière. Vide, la
                    facture reprend {defaut || "le nom du dossier"}.
                  </p>

                  <div style={{ display: "grid", gap: 14 }}>
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
                        style={{
                          ...saisie,
                          minHeight: 0,
                          padding: "11px 14px",
                          resize: "vertical",
                        }}
                      />
                    </div>
                    <div className="duo">
                      <div>
                        <label htmlFor="periode_debut" style={etiquette}>
                          Période — du
                        </label>
                        <input
                          id="periode_debut"
                          name="periode_debut"
                          type="date"
                          defaultValue={facture.periode_debut ?? ""}
                          style={saisie}
                        />
                      </div>
                      <div>
                        <label htmlFor="periode_fin" style={etiquette}>
                          au
                        </label>
                        <input
                          id="periode_fin"
                          name="periode_fin"
                          type="date"
                          defaultValue={facture.periode_fin ?? ""}
                          style={saisie}
                        />
                      </div>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--texte-gris)" }}>
                      Videz les deux champs pour que la facture ne porte aucune
                      période : chaque ligne dit déjà de quand date le cours. Pour
                      les retirer de toutes les factures d&apos;un coup, c&apos;est
                      dans <Link href="/admin/reglages">les réglages</Link>.
                    </p>
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
                        style={{
                          ...saisie,
                          minHeight: 0,
                          padding: "11px 14px",
                          resize: "vertical",
                        }}
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
                    style={{ marginTop: 18 }}
                  >
                    Enregistrer
                  </button>
                </form>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
