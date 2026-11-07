import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dossierConnecte } from "@/lib/session";
import { clientAdmin } from "@/lib/supabase";
import { seDeconnecter } from "@/app/compte/actions";
import DemandeAnnulation from "./DemandeAnnulation";
import {
  creneauLong,
  blocLong,
  moisLong,
  regrouperReservations,
} from "@/lib/dates";
import { euros } from "@/lib/constantes";

export const metadata: Metadata = { title: "Mon espace" };
export const dynamic = "force-dynamic";

type Ligne = {
  id: string;
  debut: string;
  statut: string;
  sujet: string | null;
  lien_visio: string | null;
  fin: string;
  prix_cents: number;
  validee_le: string | null;
  demande_type: string | null;
  refus_motif: string | null;
  annulation_demandee_le: string | null;
  annulation_traitee_le: string | null;
  annulation_decision: string | null;
  annulation_reponse: string | null;
};

const LIBELLE_STATUT: Record<string, string> = {
  reservee: "À venir",
  effectuee: "Cours donné",
  annulee_dans_delai: "Annulé à temps",
  annulee_hors_delai: "Annulé tardivement",
  absent: "Absence",
  annulee_par_pauline: "Annulé par Pauline",
};

/**
 * Une séance encore marquée « reservee » alors que l'heure est passée
 * attend simplement que Pauline la clôture. L'annoncer « à venir »
 * serait faux ; on dit ce qui est vrai pour l'élève.
 */
function libelleStatut(ligne: Ligne, maintenant: string): string {
  if (ligne.statut === "reservee" && !ligne.validee_le) {
    return "En attente de validation";
  }
  if (ligne.statut === "reservee" && ligne.debut < maintenant) return "Séance passée";
  // Une demande refusée n'a jamais été un cours : le dire autrement
  // qu'« annulé par Pauline », qui laisserait croire à un désistement.
  if (ligne.statut === "annulee_par_pauline" && !ligne.validee_le) {
    return "Demande refusée";
  }
  return LIBELLE_STATUT[ligne.statut] ?? ligne.statut;
}

export default async function MonEspace() {
  const dossier = await dossierConnecte();
  if (!dossier) redirect("/connexion");

  const supabase = clientAdmin();

  const [{ data }, { data: documents }, { data: factures }] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, debut, fin, statut, sujet, lien_visio, prix_cents, validee_le, demande_type, refus_motif, annulation_demandee_le, annulation_traitee_le, annulation_decision, annulation_reponse"
      )
      .eq("dossier_id", dossier.id)
      .order("debut", { ascending: false }),
    supabase
      .from("documents")
      .select("id, nom_fichier, taille_octets, cree_le")
      .eq("dossier_id", dossier.id)
      .order("cree_le", { ascending: false }),
    supabase
      .from("factures")
      .select("id, numero, statut, total_cents, periode_debut, echeance_le")
      .eq("dossier_id", dossier.id)
      .neq("statut", "brouillon")
      .order("periode_debut", { ascending: false }),
  ]);

  const { data: reglages } = await supabase
    .from("parametres")
    .select("delai_annulation_h")
    .eq("id", true)
    .maybeSingle();

  const delaiAnnulation = reglages?.delai_annulation_h ?? 24;
  const toutes = (data ?? []) as Ligne[];
  const maintenant = new Date().toISOString();
  const aVenir = toutes.filter(
    (r) => r.debut >= maintenant && r.statut === "reservee"
  );
  const passees = toutes.filter((r) => !(r.debut >= maintenant && r.statut === "reservee"));

  // Trois heures qui se suivent sont trois lignes en base, et un seul
  // cours pour l'élève. On ne les réunit que si leur situation est la
  // même : une heure annulée au milieu d'un bloc doit rester visible.
  const memeNature = (a: Ligne, b: Ligne) =>
    a.statut === b.statut &&
    !a.validee_le === !b.validee_le &&
    !a.annulation_demandee_le === !b.annulation_demandee_le &&
    !a.annulation_traitee_le === !b.annulation_traitee_le;

  const blocsAVenir = regrouperReservations(aVenir, memeNature);
  const blocsPassees = regrouperReservations(passees, memeNature).reverse();


  return (
    <section className="section">
      <div className="conteneur">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 40,
          }}
        >
          <div>
            <p className="surtitre">Espace élève</p>
            <h1 style={{ fontSize: 42, lineHeight: 1.12 }}>
              Bonjour <em className="accent">{dossier.prenom ?? ""}</em>
            </h1>
            <p style={{ marginTop: 10, fontSize: 15, color: "var(--texte-gris)" }}>
              {dossier.eleve_prenom}
              {dossier.eleve_classe ? ` · ${dossier.eleve_classe}` : ""} · {dossier.email}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href="/reserver" className="bouton bouton--principal bouton--compact">
              Réserver un cours
            </Link>
            <form action={seDeconnecter}>
              <button type="submit" className="bouton bouton--secondaire bouton--compact">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        <Bloc titre="Cours à venir">
          {aVenir.length === 0 ? (
            <Vide>
              Aucun cours programmé.{" "}
              <Link href="/reserver">Choisissez un créneau</Link>, il n&apos;y a plus
              rien à remplir.
            </Vide>
          ) : (
            blocsAVenir.map((bloc) => {
              const r = bloc.tete;
              return (
              <article key={r.id} className="cours">
                <div>
                  <p className="cours__quand">
                    {bloc.heures > 1 ? blocLong(bloc) : creneauLong(r.debut)}
                  </p>
                  {bloc.heures > 1 ? (
                    <p className="cours__sujet">
                      {bloc.heures} heures d&apos;affilée
                      {r.sujet ? ` · ${r.sujet}` : ""}
                    </p>
                  ) : r.sujet ? (
                    <p className="cours__sujet">{r.sujet}</p>
                  ) : null}
                </div>
                <div style={{ textAlign: "right", minWidth: 0 }}>
                  <span
                    className={
                      r.validee_le ? "etiquette" : "etiquette etiquette--attente"
                    }
                  >
                    {libelleStatut(r, maintenant)}
                  </span>
                  {!r.validee_le ? (
                    <p className="cours__note">
                      Créneau gardé le temps que Pauline réponde
                    </p>
                  ) : r.lien_visio ? (
                    <p style={{ marginTop: 8 }}>
                      <a href={r.lien_visio}>Rejoindre</a>
                    </p>
                  ) : (
                    <p className="cours__note">Lien envoyé avant la séance</p>
                  )}

                  {r.annulation_demandee_le && !r.annulation_traitee_le ? (
                    <p className="annulation__etat">
                      {r.demande_type === "reduction"
                        ? "Réduction demandée. Pauline vous répond par email."
                        : "Annulation demandée. Pauline vous répond par email."}
                    </p>
                  ) : (
                    <DemandeAnnulation
                      ids={bloc.ids}
                      heures={bloc.heures}
                      enAttente={!r.validee_le}
                      dansLesDelais={
                        Date.parse(r.debut) - Date.now() >
                        delaiAnnulation * 3600 * 1000
                      }
                    />
                  )}
                </div>
              </article>
              );
            })
          )}
        </Bloc>

        <Bloc titre="Historique">
          {passees.length === 0 ? (
            <Vide>
              Rien encore. Vos cours passés viendront se ranger ici, avec les documents
              échangés.
            </Vide>
          ) : (
            blocsPassees.map((bloc) => {
              const r = bloc.tete;
              return (
              <article key={r.id} className="cours">
                <div>
                  <p className="cours__quand">
                    {bloc.heures > 1 ? blocLong(bloc) : creneauLong(r.debut)}
                  </p>
                  {bloc.heures > 1 ? (
                    <p className="cours__sujet">
                      {bloc.heures} heures{r.sujet ? ` · ${r.sujet}` : ""}
                    </p>
                  ) : r.sujet ? (
                    <p className="cours__sujet">{r.sujet}</p>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="etiquette">{libelleStatut(r, maintenant)}</span>
                  {r.refus_motif ? (
                    <p className="cours__note">{r.refus_motif}</p>
                  ) : (
                    <p className="cours__note">
                      {r.validee_le
                        ? euros(bloc.lignes.reduce((t, l) => t + l.prix_cents, 0))
                        : "Non facturé"}
                    </p>
                  )}
                </div>
              </article>
              );
            })
          )}
        </Bloc>

        <Bloc titre="Documents">
          {(documents ?? []).length === 0 ? (
            <Vide>
              Les supports utilisés pendant les cours apparaîtront ici dès que Pauline
              les aura déposés.
            </Vide>
          ) : (
            (documents ?? []).map((d) => (
              <article key={d.id} className="cours">
                <div>
                  <p className="cours__quand" style={{ fontSize: 17 }}>
                    {d.nom_fichier}
                  </p>
                  <p className="cours__note">
                    Déposé le {new Date(d.cree_le).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <a href={`/documents/${d.id}`}>télécharger</a>
              </article>
            ))
          )}
        </Bloc>

        <Bloc titre="Factures">
          {(factures ?? []).length === 0 ? (
            <Vide>
              Aucune facture pour l&apos;instant. Elles sont émises en fin de mois et
              restent consultables ici.
            </Vide>
          ) : (
            (factures ?? []).map((f) => (
              <article key={f.id} className="cours">
                <div>
                  <p className="cours__quand" style={{ fontSize: 17 }}>
                    Facture {f.numero ?? ""}
                  </p>
                  <p className="cours__note">
                    {moisLong(f.periode_debut)}
                    {f.echeance_le
                      ? ` · à régler avant le ${new Date(f.echeance_le).toLocaleDateString("fr-FR")}`
                      : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="etiquette">
                    {f.statut === "payee" ? "Réglée" : "À régler"}
                  </span>
                  <p className="cours__note">
                    {euros(f.total_cents)} · <a href={`/factures/${f.id}`}>voir</a>
                  </p>
                </div>
              </article>
            ))
          )}
        </Bloc>
      </div>
    </section>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 44 }}>
      <h2 style={{ fontSize: 24, marginBottom: 16 }}>{titre}</h2>
      <div className="tableau-enveloppe">{children}</div>
    </div>
  );
}

function Vide({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        padding: "28px 28px",
        fontSize: 15,
        lineHeight: 1.65,
        color: "var(--texte-doux)",
      }}
    >
      {children}
    </p>
  );
}
