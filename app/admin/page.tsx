import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { creneauLong, lundiDeLaSemaine } from "@/lib/dates";
import { euros } from "@/lib/constantes";

export const dynamic = "force-dynamic";

type Prochain = {
  id: string;
  debut: string;
  sujet: string | null;
  dossiers: {
    prenom: string | null;
    nom: string | null;
    eleve_prenom: string | null;
    eleve_classe: string | null;
  } | null;
};

export default async function TableauDeBord() {
  const supabase = clientAdmin();
  const maintenant = new Date().toISOString();
  const debutMois = `${new Date().toISOString().slice(0, 7)}-01`;

  const [prochains, eleves, aVenir, duMois, impayees, parametres] = await Promise.all([
    supabase
      .from("reservations")
      .select("id, debut, sujet, dossiers (prenom, nom, eleve_prenom, eleve_classe)")
      .eq("statut", "reservee")
      .gte("debut", maintenant)
      .order("debut")
      .limit(12),
    supabase
      .from("dossiers")
      .select("id", { count: "exact", head: true })
      .eq("anonymise", false),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "reservee")
      .gte("debut", maintenant),
    supabase
      .from("reservations")
      .select("prix_cents")
      .gte("debut", debutMois)
      .in("statut", ["reservee", "effectuee", "annulee_hors_delai", "absent"]),
    supabase
      .from("factures")
      .select("total_cents")
      .in("statut", ["envoyee", "en_retard"]),
    supabase
      .from("parametres")
      .select("reservations_suspendues")
      .eq("id", true)
      .maybeSingle(),
  ]);

  const liste = (prochains.data ?? []) as unknown as Prochain[];
  const heuresDuMois = duMois.data?.length ?? 0;
  const recetteDuMois = (duMois.data ?? []).reduce(
    (somme, r) => somme + (r.prix_cents ?? 0),
    0
  );
  const duImpaye = (impayees.data ?? []).reduce(
    (somme, f) => somme + (f.total_cents ?? 0),
    0
  );
  const suspension = parametres.data?.reservations_suspendues ?? "aucune";

  return (
    <section className="section">
      <div className="conteneur">
        <div className="admin__titre">
          <div>
            <p className="surtitre">Administration</p>
            <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>Tableau de bord</h1>
          </div>
          <Link href="/admin/horaires" className="bouton bouton--secondaire bouton--compact">
            Modifier mes horaires
          </Link>
        </div>

        {suspension !== "aucune" && (
          <p className="alerte" style={{ marginTop: 0, marginBottom: 28 }}>
            <strong>
              {suspension === "totale"
                ? "Les réservations sont totalement suspendues."
                : "Les nouveaux élèves ne peuvent pas réserver."}
            </strong>{" "}
            Personne ne peut réserver tant que ce n&apos;est pas levé.{" "}
            <Link href="/admin/reglages">Lever la suspension</Link>
          </p>
        )}

        <div className="chiffres">
          <Chiffre valeur={String(aVenir.count ?? 0)} libelle="cours à venir" />
          <Chiffre valeur={String(eleves.count ?? 0)} libelle="dossiers élèves" />
          <Chiffre valeur={`${heuresDuMois} h`} libelle="ce mois-ci" />
          <Chiffre
            valeur={euros(recetteDuMois)}
            libelle={duImpaye > 0 ? `dont ${euros(duImpaye)} en attente` : "facturable ce mois"}
          />
        </div>

        <h2 style={{ fontSize: 25, margin: "46px 0 16px" }}>Prochains cours</h2>
        <div className="tableau-enveloppe tableau-defilant">
          {liste.length === 0 ? (
            <p style={{ padding: "28px", fontSize: 15, color: "var(--texte-doux)" }}>
              Aucun cours réservé pour l&apos;instant.
            </p>
          ) : (
            <table className="liste">
              <thead>
                <tr>
                  <th>Quand</th>
                  <th>Élève</th>
                  <th>Réservé par</th>
                  <th>Sujet</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{creneauLong(r.debut)}</strong>
                    </td>
                    <td>
                      {r.dossiers?.eleve_prenom ?? "—"}
                      {r.dossiers?.eleve_classe ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                            {r.dossiers.eleve_classe}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {r.dossiers?.prenom ?? ""} {r.dossiers?.nom ?? ""}
                    </td>
                    <td>{r.sujet ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ marginTop: 20, fontSize: 13.5, color: "var(--texte-gris)" }}>
          Semaine en cours : {lundiDeLaSemaine()}
        </p>
      </div>
    </section>
  );
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <div className="chiffre">
      <p className="chiffre__valeur">{valeur}</p>
      <p className="chiffre__libelle">{libelle}</p>
    </div>
  );
}
