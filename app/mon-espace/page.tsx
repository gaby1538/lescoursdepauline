import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dossierConnecte } from "@/lib/session";
import { clientAdmin } from "@/lib/supabase";
import { seDeconnecter } from "@/app/compte/actions";
import { creneauLong } from "@/lib/dates";
import { euros } from "@/lib/constantes";

export const metadata: Metadata = { title: "Mon espace" };
export const dynamic = "force-dynamic";

type Ligne = {
  id: string;
  debut: string;
  statut: string;
  sujet: string | null;
  lien_visio: string | null;
  prix_cents: number;
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
  if (ligne.statut === "reservee" && ligne.debut < maintenant) return "Séance passée";
  return LIBELLE_STATUT[ligne.statut] ?? ligne.statut;
}

export default async function MonEspace() {
  const dossier = await dossierConnecte();
  if (!dossier) redirect("/connexion");

  const { data } = await clientAdmin()
    .from("reservations")
    .select("id, debut, statut, sujet, lien_visio, prix_cents")
    .eq("dossier_id", dossier.id)
    .order("debut", { ascending: false });

  const toutes = (data ?? []) as Ligne[];
  const maintenant = new Date().toISOString();
  const aVenir = toutes
    .filter((r) => r.debut >= maintenant && r.statut === "reservee")
    .reverse();
  const passees = toutes.filter((r) => !(r.debut >= maintenant && r.statut === "reservee"));

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
            aVenir.map((r) => (
              <article key={r.id} className="cours">
                <div>
                  <p className="cours__quand">{creneauLong(r.debut)}</p>
                  {r.sujet ? <p className="cours__sujet">{r.sujet}</p> : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="etiquette">{libelleStatut(r, maintenant)}</span>
                  {r.lien_visio ? (
                    <p style={{ marginTop: 8 }}>
                      <a href={r.lien_visio}>Rejoindre</a>
                    </p>
                  ) : (
                    <p className="cours__note">Lien envoyé avant la séance</p>
                  )}
                </div>
              </article>
            ))
          )}
        </Bloc>

        <Bloc titre="Historique">
          {passees.length === 0 ? (
            <Vide>
              Rien encore. Vos cours passés viendront se ranger ici, avec les documents
              échangés.
            </Vide>
          ) : (
            passees.map((r) => (
              <article key={r.id} className="cours">
                <div>
                  <p className="cours__quand">{creneauLong(r.debut)}</p>
                  {r.sujet ? <p className="cours__sujet">{r.sujet}</p> : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="etiquette">{libelleStatut(r, maintenant)}</span>
                  <p className="cours__note">{euros(r.prix_cents)}</p>
                </div>
              </article>
            ))
          )}
        </Bloc>

        <Bloc titre="Documents et factures">
          <Vide>
            Les supports utilisés pendant les cours et vos factures apparaîtront ici.
            Pauline les dépose depuis son espace.
          </Vide>
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
