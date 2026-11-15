import Link from "next/link";
import { clientAdmin } from "@/lib/supabase";
import { ajouterJours, blocLong, creneauLong, dureeCourte, lundiDeLaSemaine, parisVersInstant, regrouperReservations } from "@/lib/dates";
import {
  marquerEffectue,
  annulerCours,
  repondreAnnulation,
  deciderDemande,
} from "./eleves/actions";
import { euros } from "@/lib/constantes";
import { etiquette, saisie } from "@/components/Champs";

export const dynamic = "force-dynamic";

type Prochain = {
  id: string;
  debut: string;
  fin: string;
  dossier_id: string;
  sujet: string | null;
  dossiers: {
    prenom: string | null;
    nom: string | null;
    eleve_prenom: string | null;
    eleve_classe: string | null;
  } | null;
};

const MESSAGES: Record<string, string> = {
  decision: "Aucune décision n'a été transmise. Réessayez.",
  partiel:
    "Une partie des heures seulement a été traitée. Rechargez la page pour voir ce qu'il reste.",
  introuvable: "Ce cours n'est plus en attente : il a peut-être déjà été traité.",
  non_validee:
    "Ce cours n'a jamais été accepté : il ne peut donc pas être marqué comme donné, ni facturé. Répondez d'abord à la demande.",
  enregistrement: "La base a refusé l'enregistrement. Réessayez dans un instant.",
};

export default async function TableauDeBord({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string; periode?: string }>;
}) {
  const { ok, erreur, periode } = await searchParams;
  const supabase = clientAdmin();
  const maintenant = new Date().toISOString();
  const debutMois = `${new Date().toISOString().slice(0, 7)}-01`;

  // « Cours à venir » sans borne ne veut rien dire : quarante cours
  // posés jusqu'en juin ne disent pas à quoi ressemble la semaine. Le
  // chiffre se lit donc sur une période choisie, et le total se range
  // plus bas, où il redevient une information de contexte.
  const choix = ["semaine", "mois", "trois"].includes(periode ?? "")
    ? (periode as string)
    : "semaine";

  const minuit = (jour: string) => parisVersInstant(`${jour}T00:00`) ?? maintenant;
  const dansNJours = (n: number) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // Une semaine, c'est du lundi au dimanche — pas ce qu'il en reste.
  // Bornée à « maintenant », la semaine en cours affichait zéro cours
  // le dimanche soir, ce qui ne décrit rien du tout.
  let debutPeriode: string;
  let finPeriode: string;
  let nomPeriode: string;

  if (choix === "mois") {
    const d = new Date();
    const suivant = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    debutPeriode = minuit(debutMois);
    finPeriode = minuit(suivant.toISOString().slice(0, 10));
    nomPeriode = "ce mois-ci";
  } else if (choix === "trois") {
    debutPeriode = maintenant;
    finPeriode = minuit(dansNJours(90));
    nomPeriode = "d'ici trois mois";
  } else {
    const lundi = lundiDeLaSemaine();
    debutPeriode = minuit(lundi);
    finPeriode = minuit(ajouterJours(lundi, 7));
    nomPeriode = "cette semaine";
  }

  const [
    aDecider,
    demandes,
    prochains,
    aValider,
    eleves,
    aVenir,
    surLaPeriode,
    dernierCours,
    duMois,
    impayees,
    parametres,
  ] = await Promise.all([
    // Les demandes qui attendent une réponse. Le créneau est déjà pris,
    // mais rien n'est confirmé à l'élève.
    supabase
      .from("reservations")
      .select(
        "id, dossier_id, debut, fin, sujet, cree_le, dossiers (prenom, nom, eleve_prenom, eleve_classe)"
      )
      .eq("statut", "reservee")
      .is("validee_le", null)
      .is("remplace", null)
      .order("debut"),
    supabase
      .from("reservations")
      .select(
        "id, dossier_id, debut, fin, demande_type, annulation_demandee_le, annulation_motif, dossiers (prenom, nom, eleve_prenom, eleve_classe)"
      )
      .eq("statut", "reservee")
      .not("annulation_demandee_le", "is", null)
      .is("annulation_traitee_le", null)
      .order("debut"),
    supabase
      .from("reservations")
      .select(
        "id, dossier_id, debut, fin, sujet, dossiers (prenom, nom, eleve_prenom, eleve_classe)"
      )
      .eq("statut", "reservee")
      .not("validee_le", "is", null)
      .gte("debut", maintenant)
      .order("debut")
      // De quoi former douze blocs même si plusieurs durent deux heures.
      .limit(30),
    // Les séances dont l'heure est passée mais que Pauline n'a pas
    // encore clôturées : tant qu'elles restent là, elles ne sont pas
    // facturables.
    supabase
      .from("reservations")
      .select(
        "id, dossier_id, debut, fin, sujet, dossiers (prenom, nom, eleve_prenom, eleve_classe)"
      )
      .eq("statut", "reservee")
      .not("validee_le", "is", null)
      .lt("debut", maintenant)
      .order("debut", { ascending: false })
      .limit(30),
    supabase
      .from("dossiers")
      .select("id", { count: "exact", head: true })
      .eq("anonymise", false),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "reservee")
      .not("validee_le", "is", null)
      .gte("debut", maintenant),
    supabase
      .from("reservations")
      .select("debut, fin, prix_cents, dossier_id, statut, facture_id")
      .not("validee_le", "is", null)
      .in("statut", ["reservee", "effectuee", "annulee_hors_delai", "absent"])
      .gte("debut", debutPeriode)
      .lt("debut", finPeriode),
    supabase
      .from("reservations")
      .select("debut")
      .eq("statut", "reservee")
      .not("validee_le", "is", null)
      .gte("debut", maintenant)
      .order("debut", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reservations")
      .select("debut, fin")
      .gte("debut", debutMois)
      .not("validee_le", "is", null)
      .in("statut", ["reservee", "effectuee", "annulee_hors_delai", "absent"]),
    supabase
      .from("factures")
      .select("total_cents")
      .in("statut", ["envoyee", "en_retard"]),
    supabase
      .from("parametres")
      .select("reservations_suspendues, delai_annulation_h")
      .eq("id", true)
      .maybeSingle(),
  ]);

  // Une requête qui échoue renvoie data: null, que tout le code traite
  // ensuite comme « rien à afficher ». Un écran vide ne dit pas qu'une
  // colonne manque, et la panne se révèle ailleurs, sans rapport. On
  // regarde donc les erreurs avant de dessiner quoi que ce soit.
  const pannes = [
    ["demandes de cours", aDecider],
    ["demandes d'annulation", demandes],
    ["prochains cours", prochains],
    ["cours à valider", aValider],
    ["compteurs", aVenir],
    ["cours de la période", surLaPeriode],
    ["recette du mois", duMois],
    ["factures impayées", impayees],
    ["réglages", parametres],
  ]
    .filter(([, r]) => (r as { error?: unknown }).error)
    .map(([quoi, r]) => ({
      quoi: quoi as string,
      message: String(
        ((r as { error?: { message?: string } }).error?.message ?? "")
      ),
    }));

  // Deux heures qui se suivent sont deux lignes en base et un seul
  // cours dans la vraie vie. Partout où on les montre, on les montre
  // comme un cours — et le même élève, sinon deux séances qui se
  // touchent se retrouveraient fondues en une.
  const memeCours = (a: Prochain, b: Prochain) =>
    a.dossier_id === b.dossier_id && a.sujet === b.sujet;

  const liste = regrouperReservations(
    (prochains.data ?? []) as unknown as Prochain[],
    memeCours
  ).slice(0, 12);

  const enAttente = regrouperReservations(
    (aValider.data ?? []) as unknown as Prochain[],
    memeCours
  ).reverse();
  type Trancher = Prochain & {
    dossier_id: string;
    fin: string;
    demande_type: string | null;
    annulation_demandee_le: string;
    annulation_motif: string | null;
  };
  // Une réduction porte sur plusieurs heures d'un coup : les présenter
  // séparément ferait croire à plusieurs demandes.
  const idsDemandes = ((demandes.data ?? []) as unknown as { id: string }[]).map(
    (r) => r.id
  );
  const { data: proposes } =
    idsDemandes.length > 0
      ? await supabase
          .from("reservations")
          .select("id, debut, fin, remplace")
          .in("remplace", idsDemandes)
          .eq("statut", "reservee")
          .order("debut")
      : { data: [] };

  const propositions = new Map<string, { debut: string; fin: string; heures: number }>();
  for (const r of proposes ?? []) {
    const bloc = propositions.get(r.remplace!);
    if (bloc) {
      bloc.fin = r.fin;
      bloc.heures += 1;
    } else {
      propositions.set(r.remplace!, { debut: r.debut, fin: r.fin, heures: 1 });
    }
  }

  const aTrancher = regrouperReservations(
    (demandes.data ?? []) as unknown as Trancher[],
    (a, b) => a.dossier_id === b.dossier_id && a.demande_type === b.demande_type
  );
  // Trois heures qui se suivent sont un seul cours : on les présente
  // comme un bloc, et une seule décision les tranche.
  type Demande = Prochain & {
    dossier_id: string;
    fin: string;
    cree_le: string;
  };
  const blocsADecider: {
    ids: string[];
    debut: string;
    fin: string;
    heures: number;
    demande: Demande;
  }[] = [];

  for (const r of ((aDecider.data ?? []) as unknown as Demande[])) {
    const dernier = blocsADecider[blocsADecider.length - 1];
    if (
      dernier &&
      dernier.demande.dossier_id === r.dossier_id &&
      dernier.fin === r.debut
    ) {
      dernier.fin = r.fin;
      dernier.heures += 1;
      dernier.ids.push(r.id);
    } else {
      blocsADecider.push({
        ids: [r.id],
        debut: r.debut,
        fin: r.fin,
        heures: 1,
        demande: r,
      });
    }
  }

  const delaiAnnulation = parametres.data?.delai_annulation_h ?? 24;
  // Des heures, pas un nombre de lignes : une séance de deux heures en
  // est une seule depuis qu'on ne les coupe plus.
  const heuresDuMois = ((duMois.data ?? []) as { debut: string; fin: string }[]).reduce(
    (h, r) => h + (Date.parse(r.fin) - Date.parse(r.debut)) / 3600000,
    0
  );
  const duImpaye = (impayees.data ?? []).reduce(
    (somme, f) => somme + (f.total_cents ?? 0),
    0
  );
  const suspension = parametres.data?.reservations_suspendues ?? "aucune";

  // Quatre nombres qui parlent tous de la même période : combien de
  // cours, combien d'heures, ce qu'ils représentent, et pour combien
  // d'élèves. Lus ensemble, ils décrivent une semaine ou un mois ;
  // isolés, ils ne décrivent rien.
  const surPeriode = (surLaPeriode.data ?? []) as {
    debut: string;
    fin: string;
    prix_cents: number | null;
    dossier_id: string;
    statut: string;
    facture_id: string | null;
  }[];

  // Un cours est une séance qui a eu lieu ou qui aura lieu. Une absence
  // ou une annulation tardive se facture, mais ne se compte pas comme
  // un cours donné.
  const coursPeriode = surPeriode.filter((r) =>
    ["reservee", "effectuee"].includes(r.statut)
  );

  const heuresPeriode = coursPeriode.reduce(
    (h, r) => h + (Date.parse(r.fin) - Date.parse(r.debut)) / 3600000,
    0
  );
  const elevesPeriode = new Set(coursPeriode.map((r) => r.dossier_id)).size;

  // Ce qui se facture, et rien d'autre : la facturation ne se fait pas
  // d'avance. Un cours à venir ne vaut rien tant qu'il n'a pas eu lieu.
  const aFacturerPeriode = surPeriode
    .filter(
      (r) =>
        !r.facture_id &&
        ["effectuee", "annulee_hors_delai", "absent"].includes(r.statut)
    )
    .reduce((somme, r) => somme + (r.prix_cents ?? 0), 0);

  const restantes = coursPeriode.filter((r) => r.debut >= maintenant).length;

  const horizon = dernierCours.data?.debut
    ? new Date(dernierCours.data.debut).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      })
    : null;

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

        {pannes.length > 0 && (
          <div className="alerte" style={{ marginTop: 0, marginBottom: 24 }}>
            <strong>La base a refusé {pannes.length} requête
            {pannes.length > 1 ? "s" : ""} de cet écran.</strong> Ce qui s&apos;affiche
            ci-dessous est donc incomplet. La cause habituelle est une migration non
            exécutée : passez <code>verifier_migrations.sql</code> dans
            l&apos;éditeur SQL de Supabase.
            <ul style={{ margin: "10px 0 0", paddingLeft: 20, fontSize: 13.5 }}>
              {pannes.map((p) => (
                <li key={p.quoi}>
                  {p.quoi} — <span style={{ opacity: 0.85 }}>{p.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {erreur && (
          <p className="alerte" style={{ marginTop: 0, marginBottom: 24 }}>
            {MESSAGES[erreur] ?? "L'action n'a pas abouti."}
          </p>
        )}
        {ok && (
          <p className="succes" style={{ marginTop: 0, marginBottom: 24 }}>
            C&apos;est fait.
          </p>
        )}

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

        <div className="periodes" style={{ marginTop: 0, marginBottom: 18 }}>
          {[
            ["semaine", "Cette semaine"],
            ["mois", "Ce mois-ci"],
            ["trois", "3 prochains mois"],
          ].map(([cle, nom]) => (
            <Link
              key={cle}
              href={`/admin?periode=${cle}`}
              className={choix === cle ? "periode periode--actif" : "periode"}
            >
              {nom}
            </Link>
          ))}
        </div>

        <div className="chiffres">
          <Chiffre
            valeur={String(coursPeriode.length)}
            libelle={`cours ${nomPeriode}`}
          />
          <Chiffre
            valeur={dureeCourte(heuresPeriode)}
            libelle={
              restantes > 0
                ? `dont ${restantes} encore à donner`
                : "toutes déjà données"
            }
          />
          <Chiffre
            valeur={String(elevesPeriode)}
            libelle={elevesPeriode > 1 ? "élèves concernés" : "élève concerné"}
          />
          <Chiffre
            valeur={euros(aFacturerPeriode)}
            libelle="à facturer, cours donnés"
          />
        </div>

        {/* Le reste n'est pas de la période : c'est le contexte dans
            lequel elle se lit. Une ligne suffit. */}
        <p
          style={{
            marginTop: 16,
            fontSize: 14,
            lineHeight: 1.75,
            color: "var(--texte-gris)",
          }}
        >
          Au-delà : <strong style={{ color: "var(--foret)" }}>{aVenir.count ?? 0}</strong>{" "}
          cours posés en tout
          {horizon ? `, jusqu'au ${horizon}` : ""} ·{" "}
          <Link href="/admin/eleves">{eleves.count ?? 0} dossiers élèves</Link> ·{" "}
          {dureeCourte(heuresDuMois)} données depuis le 1er
          {duImpaye > 0 ? (
            <>
              {" · "}
              <Link href="/admin/factures">
                <strong style={{ color: "var(--or-texte)" }}>
                  {euros(duImpaye)} en attente de règlement
                </strong>
              </Link>
            </>
          ) : null}
        </p>

        {blocsADecider.length > 0 && (
          <>
            <h2 style={{ fontSize: 25, margin: "46px 0 8px" }}>
              Demandes de cours
              <span className="pastille-compte">{blocsADecider.length}</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
              Le créneau est gardé et personne d&apos;autre ne peut le prendre, mais
              l&apos;élève n&apos;a reçu qu&apos;un accusé de réception. Il attend votre
              réponse. Un refus libère le créneau, et rien n&apos;est facturé.
            </p>

            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {blocsADecider.map((b) => (
                <div key={b.ids[0]} className="carte carte--attente">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "baseline",
                      justifyContent: "space-between",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: 19,
                        color: "var(--foret)",
                      }}
                    >
                      {b.heures > 1
                        ? blocLong({ debut: b.debut, fin: b.fin, heures: b.heures })
                        : creneauLong(b.debut)}
                    </p>
                    <span className="etiquette etiquette--attente">
                      {b.heures > 1 ? `${b.heures} heures` : "1 heure"} — à valider
                    </span>
                  </div>

                  <p style={{ marginTop: 8, fontSize: 14.5, color: "var(--texte-doux)" }}>
                    {b.demande.dossiers?.eleve_prenom ?? "—"}
                    {b.demande.dossiers?.eleve_classe
                      ? ` · ${b.demande.dossiers.eleve_classe}`
                      : ""}{" "}
                    — demandé par {b.demande.dossiers?.prenom} {b.demande.dossiers?.nom}
                  </p>

                  {b.demande.sujet ? (
                    <p
                      style={{
                        marginTop: 10,
                        padding: "10px 14px",
                        borderLeft: "2px solid var(--or-clair)",
                        fontSize: 14.5,
                        lineHeight: 1.6,
                        color: "var(--texte-doux)",
                      }}
                    >
                      {b.demande.sujet}
                    </p>
                  ) : null}

                  <form style={{ marginTop: 14 }}>
                    <input type="hidden" name="ids" value={b.ids.join(",")} />
                    <input type="hidden" name="retour" value="/admin" />
                    <label htmlFor={`motif-${b.ids[0]}`} style={etiquette}>
                      Un mot pour l&apos;élève (facultatif, surtout utile en cas de
                      refus)
                    </label>
                    <input
                      id={`motif-${b.ids[0]}`}
                      name="motif"
                      type="text"
                      placeholder="Je suis prise à cette heure-là, mais jeudi même heure est libre."
                      style={saisie}
                    />
                    <div
                      className="actions-ligne"
                      style={{ justifyContent: "flex-start", marginTop: 14 }}
                    >
                      <button
                        type="submit"
                        formAction={deciderDemande.bind(null, "acceptee")}
                        className="bouton bouton--principal bouton--compact"
                      >
                        Accepter
                      </button>
                      <button
                        type="submit"
                        formAction={deciderDemande.bind(null, "refusee")}
                        className="bouton bouton--secondaire bouton--compact"
                      >
                        Refuser
                      </button>
                      <Link
                        href={`/admin/eleves/${b.demande.dossier_id}`}
                        style={{ fontSize: 14, alignSelf: "center" }}
                      >
                        Voir la fiche
                      </Link>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          </>
        )}

        {aTrancher.length > 0 && (
          <>
            <h2 style={{ fontSize: 25, margin: "46px 0 8px" }}>
              Annulations et changements
              <span className="pastille-compte">{aTrancher.length}</span>
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
              Le créneau reste réservé tant que vous n&apos;avez pas répondu. Le délai
              se juge au moment de la demande, pas de votre réponse.
            </p>

            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {aTrancher.map((bloc) => {
                const r = bloc.tete;
                const reduction = r.demande_type === "reduction";
                const modification = r.demande_type === "modification";
                const propose = propositions.get(r.id) ?? null;
                const horsDelai =
                  Date.parse(r.debut) - Date.parse(r.annulation_demandee_le) <
                  delaiAnnulation * 3600 * 1000;
                return (
                  <div key={r.id} className="carte">
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        alignItems: "baseline",
                        justifyContent: "space-between",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--serif)",
                          fontSize: 19,
                          color: "var(--foret)",
                        }}
                      >
                        {bloc.heures > 1 ? blocLong(bloc) : creneauLong(r.debut)}
                      </p>
                      <span className="etiquette">
                        {modification
                          ? horsDelai
                            ? "Hors délai — jamais facturé"
                            : "Dans les délais"
                          : horsDelai
                            ? "Hors délai — resterait facturable"
                            : "Dans les délais"}
                      </span>
                    </div>

                    <p
                      style={{
                        marginTop: 8,
                        fontSize: 14.5,
                        color: "var(--texte-doux)",
                      }}
                    >
                      <strong style={{ color: "var(--foret)" }}>
                        {modification
                          ? "Veut déplacer ce cours"
                          : reduction
                            ? `Veut retirer ${bloc.heures} heure${
                                bloc.heures > 1 ? "s" : ""
                              } de ce cours`
                            : bloc.heures > 1
                              ? `Veut annuler les ${bloc.heures} heures`
                              : "Veut annuler ce cours"}
                      </strong>
                      <br />
                      {r.dossiers?.eleve_prenom ?? "—"}
                      {r.dossiers?.eleve_classe ? ` · ${r.dossiers.eleve_classe}` : ""} —
                      demandé par {r.dossiers?.prenom} {r.dossiers?.nom}
                    </p>

                    {propose ? (
                      <div className="deplacement">
                        <div className="deplacement__cote">
                          <span className="surtitre">Aujourd&apos;hui</span>
                          <p>{blocLong(bloc)}</p>
                          <span className="deplacement__duree">{bloc.heures} h</span>
                        </div>
                        <span className="deplacement__fleche" aria-hidden="true">
                          →
                        </span>
                        <div className="deplacement__cote deplacement__cote--neuf">
                          <span className="surtitre">Demandé</span>
                          <p>{blocLong(propose)}</p>
                          <span className="deplacement__duree">{propose.heures} h</span>
                        </div>
                      </div>
                    ) : null}

                    {modification ? (
                      <p
                        style={{
                          marginTop: 10,
                          fontSize: 13.5,
                          lineHeight: 1.6,
                          color: "var(--texte-gris)",
                        }}
                      >
                        Le nouveau créneau est déjà retenu. Si vous acceptez,
                        l&apos;ancien est libéré et n&apos;est pas facturé, même hors
                        délai : le cours n&apos;est pas perdu, il change de place.
                      </p>
                    ) : null}

                    {r.annulation_motif ? (
                      <p
                        style={{
                          marginTop: 10,
                          padding: "10px 14px",
                          borderLeft: "2px solid var(--or-clair)",
                          fontSize: 14.5,
                          lineHeight: 1.6,
                          color: "var(--texte-doux)",
                        }}
                      >
                        {r.annulation_motif}
                      </p>
                    ) : null}

                    <form style={{ marginTop: 14 }}>
                      <input type="hidden" name="ids" value={bloc.ids.join(",")} />
                      <input type="hidden" name="retour" value="/admin" />
                      <label htmlFor={`rep-${r.id}`} style={etiquette}>
                        Votre réponse (facultative, transmise à l&apos;élève)
                      </label>
                      <input
                        id={`rep-${r.id}`}
                        name="reponse"
                        type="text"
                        placeholder="Pas de souci, on se rattrape la semaine prochaine."
                        style={saisie}
                      />
                      <div className="actions-ligne" style={{ justifyContent: "flex-start", marginTop: 14 }}>
                        {/* La valeur d'un bouton de soumission n'arrive pas
                            jusqu'à une action serveur : la décision est liée
                            à l'action elle-même. */}
                        <button
                          type="submit"
                          formAction={repondreAnnulation.bind(null, "acceptee")}
                          className="bouton bouton--principal bouton--compact"
                        >
                          Accepter
                        </button>
                        <button
                          type="submit"
                          formAction={repondreAnnulation.bind(null, "refusee")}
                          className="bouton bouton--secondaire bouton--compact"
                        >
                          Refuser
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 style={{ fontSize: 25, margin: "46px 0 8px" }}>
          Cours à valider
          {enAttente.length > 0 ? (
            <span className="pastille-compte">{enAttente.length}</span>
          ) : null}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--texte-doux)" }}>
          Une séance passée reste en attente jusqu&apos;à ce que vous la clôturiez.
          Tant qu&apos;elle l&apos;est, elle n&apos;entre dans aucune facture.
        </p>
        <div className="tableau-enveloppe tableau-defilant" style={{ marginTop: 16 }}>
          {enAttente.length === 0 ? (
            <p style={{ padding: 28, fontSize: 15, color: "var(--texte-doux)" }}>
              Rien en attente. Toutes les séances passées sont réglées.
            </p>
          ) : (
            <table className="liste">
              <tbody>
                {enAttente.map((bloc) => {
                  const r = bloc.tete;
                  return (
                  <tr key={r.id}>
                    <td>
                      <strong>
                        {bloc.heures > 1 ? blocLong(bloc) : creneauLong(r.debut)}
                      </strong>
                      {r.sujet ? (
                        <>
                          <br />
                          <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                            {r.sujet}
                          </span>
                        </>
                      ) : null}
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
                    <td className="droite">
                      <div className="actions-ligne">
                        <form action={marquerEffectue}>
                          <input type="hidden" name="id" value={bloc.ids.join(",")} />
                          <input type="hidden" name="dossier" value={r.dossier_id} />
                          <input type="hidden" name="retour" value="/admin" />
                          <button
                            type="submit"
                            className="bouton bouton--principal bouton--compact"
                          >
                            Cours donné
                          </button>
                        </form>
                        <form action={annulerCours}>
                          <input type="hidden" name="id" value={bloc.ids.join(",")} />
                          <input type="hidden" name="dossier" value={r.dossier_id} />
                          <input type="hidden" name="retour" value="/admin" />
                          <button type="submit" className="lien-bouton">
                            annuler
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
                {liste.map((bloc) => {
                  const r = bloc.tete;
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {bloc.heures > 1 ? blocLong(bloc) : creneauLong(r.debut)}
                        </strong>
                        {bloc.heures > 1 ? (
                          <>
                            <br />
                            <span style={{ fontSize: 13, color: "var(--texte-gris)" }}>
                              {bloc.heures} heures d&apos;affilée
                            </span>
                          </>
                        ) : null}
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>


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
