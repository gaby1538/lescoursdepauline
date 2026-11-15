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
  remplace: string | null;
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

export default async function MonEspace({
  searchParams,
}: {
  searchParams: Promise<{ demande?: string }>;
}) {
  const { demande } = await searchParams;
  const dossier = await dossierConnecte();
  if (!dossier) redirect("/connexion");

  const supabase = clientAdmin();

  const [{ data }, { data: documents }, { data: factures }] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "id, debut, fin, statut, sujet, lien_visio, prix_cents, validee_le, demande_type, remplace, refus_motif, annulation_demandee_le, annulation_traitee_le, annulation_decision, annulation_reponse"
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
    .select("delai_annulation_h, telephone_contact, email_contact")
    .eq("id", true)
    .maybeSingle();

  const delaiAnnulation = reglages?.delai_annulation_h ?? 24;
  const toutes = (data ?? []) as Ligne[];
  const maintenant = new Date().toISOString();
  const aVenir = toutes.filter(
    (r) => r.debut >= maintenant && r.statut === "reservee" && !r.remplace
  );

  // Les créneaux proposés en remplacement, rangés sous le cours qu'ils
  // doivent remplacer.
  const propositions = new Map<string, Ligne[]>();
  for (const r of toutes) {
    if (!r.remplace || r.statut !== "reservee") continue;
    const liste = propositions.get(r.remplace) ?? [];
    liste.push(r);
    propositions.set(r.remplace, liste);
  }
  const passees = toutes.filter(
    (r) => !(r.debut >= maintenant && r.statut === "reservee") && !r.remplace
  );

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


  const prochain = blocsAVenir[0] ?? null;
  const suivants = blocsAVenir.slice(1);

  const eleve = dossier.eleve_prenom ?? "";
  const classe = dossier.eleve_classe ?? "";

  /** « aujourd'hui », « demain », « dans 3 jours ». */
  function dansCombien(debut: string): string {
    const jours = Math.round(
      (Date.parse(debut.slice(0, 10)) - Date.parse(maintenant.slice(0, 10))) / 86400000
    );
    if (jours <= 0) return "aujourd'hui";
    if (jours === 1) return "demain";
    if (jours < 7) return `dans ${jours} jours`;
    if (jours < 14) return "dans une semaine";
    return `dans ${Math.round(jours / 7)} semaines`;
  }

  // Un message déjà rempli épargne à la famille d'avoir à se présenter,
  // et à Pauline de demander de qui il s'agit.
  const intro = `Bonjour Pauline, je vous écris au sujet de ${
    eleve || "mon enfant"
  }${classe ? ` (${classe})` : ""}. `;

  const chiffres = (reglages?.telephone_contact ?? "").replace(/\D/g, "");
  const international = chiffres.startsWith("0") ? `33${chiffres.slice(1)}` : chiffres;
  const whatsapp =
    international.length >= 10
      ? `https://wa.me/${international}?text=${encodeURIComponent(intro)}`
      : null;

  const courriel = `mailto:${
    reglages?.email_contact ?? "contact.capsvt@gmail.com"
  }?subject=${encodeURIComponent(
    `Au sujet de ${eleve || "mon enfant"}`
  )}&body=${encodeURIComponent(intro)}`;

  const aRegler = (factures ?? []).filter((f) => f.statut !== "payee").length;

  return (
    <section className="section">
      <div className="conteneur">

        <div className="espace__tete">
          <div style={{ minWidth: 0 }}>
            <p className="surtitre">Espace élève</p>
            <h1 style={{ fontSize: 38, lineHeight: 1.12 }}>
              Bonjour <em className="accent">{dossier.prenom ?? eleve}</em>
            </h1>
            <p style={{ marginTop: 9, fontSize: 14.5, color: "var(--texte-gris)" }}>
              {eleve}
              {classe ? ` · ${classe}` : ""}
            </p>
          </div>
          <form action={seDeconnecter}>
            <button type="submit" className="action action--contour">
              Se déconnecter
            </button>
          </form>
        </div>

        {demande === "deplacement" && (
          <p className="succes" style={{ marginBottom: 20 }}>
            Demande envoyée. Le nouveau créneau vous est retenu, l&apos;ancien reste
            prévu, et Pauline vous répond par email.
          </p>
        )}

        <div className="espace">

          {/* ---- le prochain cours : ce pour quoi on ouvre la page ---- */}
          <div className="espace__hero">
            {prochain ? (
              <>
                <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                  <p className="hero__surtitre">Votre prochain cours</p>
                  <p className="hero__quand">
                    {prochain.heures > 1
                      ? blocLong(prochain)
                      : creneauLong(prochain.tete.debut)}
                  </p>
                  <p className="hero__detail">
                    {prochain.heures > 1
                      ? `${prochain.heures} heures d'affilée`
                      : "Une heure"}
                    {" · "}
                    {dansCombien(prochain.tete.debut)}
                    {prochain.tete.validee_le
                      ? ` · ${euros(
                          prochain.lignes.reduce((t, l) => t + l.prix_cents, 0)
                        )}`
                      : ""}
                    {prochain.tete.sujet ? ` · ${prochain.tete.sujet}` : ""}
                  </p>

                  {!prochain.tete.validee_le && (
                    <p className="hero__avis">
                      En attente de validation — le créneau vous est gardé le temps
                      que Pauline réponde.
                    </p>
                  )}

                  {prochain.tete.annulation_demandee_le &&
                    !prochain.tete.annulation_traitee_le && (
                      <p className="hero__avis">
                        {prochain.tete.demande_type === "modification"
                          ? "Changement demandé. Pauline vous répond par email, et ce cours reste prévu jusque-là."
                          : "Annulation demandée. Pauline vous répond par email, et ce cours reste prévu jusque-là."}
                      </p>
                    )}
                </div>

                <div className="hero__actions">
                  {prochain.tete.validee_le && prochain.tete.lien_visio ? (
                    <a href={prochain.tete.lien_visio} className="action action--or action--grand">
                      Rejoindre le cours
                    </a>
                  ) : prochain.tete.validee_le ? (
                    <p className="hero__detail" style={{ margin: 0 }}>
                      Le lien vous est envoyé avant la séance.
                    </p>
                  ) : null}

                  {!(
                    prochain.tete.annulation_demandee_le &&
                    !prochain.tete.annulation_traitee_le
                  ) && (
                    <div className="hero__liens">
                      {prochain.tete.validee_le && (
                        <Link
                          href={`/reserver?deplacer=${prochain.ids.join(",")}`}
                          className="action-cours action-cours--clair"
                        >
                          Modifier
                        </Link>
                      )}
                      <DemandeAnnulation
                        ids={prochain.ids}
                        heures={prochain.heures}
                        sombre
                        enAttente={!prochain.tete.validee_le}
                        dansLesDelais={
                          Date.parse(prochain.tete.debut) - Date.now() >
                          delaiAnnulation * 3600 * 1000
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ minWidth: 0 }}>
                <p className="hero__surtitre">Aucun cours prévu</p>
                <p className="hero__quand">Choisissez un créneau</p>
                <p className="hero__detail" style={{ marginBottom: 18 }}>
                  Les disponibilités de Pauline s&apos;affichent en temps réel. Il
                  n&apos;y a rien d&apos;autre à remplir.
                </p>
                <Link href="/reserver" className="action action--or action--grand">
                  Réserver un cours
                </Link>
              </div>
            )}
          </div>

          {/* ---- écrire à Pauline ---- */}
          <div className="espace__contact">
            <p className="contact__titre">Une question ?</p>
            <p className="contact__texte">
              Un créneau qui n&apos;apparaît pas, un empêchement, une question sur un
              chapitre : écrivez directement.
            </p>
            <div className="contact__boutons">
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="contact__bouton contact__bouton--vert">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 20.5l1.6-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
                  </svg>
                  Écrire sur WhatsApp
                </a>
              )}
              <a href={courriel} className="contact__bouton contact__bouton--or">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2.5" y="5" width="19" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                Écrire par email
              </a>
            </div>
            <p className="contact__note">
              Le message s&apos;ouvre déjà rempli avec le prénom de {eleve || "l'élève"}
              {classe ? " et sa classe" : ""}.
            </p>
          </div>

          {/* ---- les cours ---- */}
          <div className="espace__principal">
            {suivants.length > 0 && (
              <>
                <h2 style={{ fontSize: 23, marginBottom: 14 }}>Les suivants</h2>
                <div style={{ display: "grid", gap: 8 }}>
                  {suivants.map((bloc) => {
                    const r = bloc.tete;
                    const enDemande =
                      !!r.annulation_demandee_le && !r.annulation_traitee_le;
                    return (
                      <article key={r.id} className="seance-eleve">
                        <div className="seance-eleve__tete">
                          <div style={{ minWidth: 0 }}>
                            <p className="seance-eleve__quand">
                              {bloc.heures > 1
                                ? blocLong(bloc)
                                : creneauLong(r.debut)}
                            </p>
                            <p className="seance-eleve__detail">
                              {bloc.heures > 1
                                ? `${bloc.heures} heures d'affilée`
                                : "Une heure"}
                              {r.sujet ? ` · ${r.sujet}` : ""}
                            </p>
                          </div>
                          <span
                            className={
                              r.validee_le
                                ? "etiquette"
                                : "etiquette etiquette--attente"
                            }
                          >
                            {libelleStatut(r, maintenant)}
                          </span>
                        </div>

                        {enDemande ? (
                          <p className="seance-eleve__avis">
                            {r.demande_type === "modification"
                              ? "Changement demandé"
                              : "Annulation demandée"}
                            {propositions.get(r.id)?.length
                              ? ` pour le ${blocLong({
                                  debut: propositions.get(r.id)![0].debut,
                                  fin: propositions.get(r.id)![
                                    propositions.get(r.id)!.length - 1
                                  ].fin,
                                  heures: propositions.get(r.id)!.length,
                                })}`
                              : ""}
                            . Pauline vous répond par email, et ce cours reste prévu
                            jusque-là.
                          </p>
                        ) : (
                          <div className="seance-eleve__actions">
                            {r.validee_le && (
                              <Link
                                href={`/reserver?deplacer=${bloc.ids.join(",")}`}
                                className="action-cours"
                              >
                                Modifier
                              </Link>
                            )}
                            <DemandeAnnulation
                              ids={bloc.ids}
                              heures={bloc.heures}
                              enAttente={!r.validee_le}
                              dansLesDelais={
                                Date.parse(r.debut) - Date.now() >
                                delaiAnnulation * 3600 * 1000
                              }
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            {prochain && (
              <Link
                href="/reserver"
                className="action action--foret action--grand"
                style={{ marginTop: suivants.length > 0 ? 16 : 0 }}
              >
                Réserver un autre cours
              </Link>
            )}

            {blocsPassees.length > 0 && (
              <details className="repli-discret" style={{ marginTop: 30 }}>
                <summary>
                  Mes cours passés — {blocsPassees.length} depuis le début
                </summary>
                <div className="repli-discret__corps" style={{ maxWidth: "none" }}>
                  <div style={{ display: "grid", gap: 7 }}>
                    {blocsPassees.map((bloc) => {
                      const r = bloc.tete;
                      return (
                        <div key={r.id} className="seance-passee">
                          <p className="seance-passee__quand">
                            {bloc.heures > 1 ? blocLong(bloc) : creneauLong(r.debut)}
                          </p>
                          <p className="seance-passee__etat">
                            {libelleStatut(r, maintenant)}
                            {r.refus_motif
                              ? ` — ${r.refus_motif}`
                              : r.validee_le
                                ? ` · ${euros(
                                    bloc.lignes.reduce((t, l) => t + l.prix_cents, 0)
                                  )}`
                                : " · non facturé"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            )}
          </div>

          {/* ---- factures et documents ---- */}
          <aside className="espace__cote">
            <div className="carte-cote">
              <div className="carte-cote__tete">
                <p className="carte-cote__titre">Factures</p>
                {aRegler > 0 && (
                  <span className="etiquette etiquette--attente">
                    {aRegler} à régler
                  </span>
                )}
              </div>
              {(factures ?? []).length === 0 ? (
                <p className="carte-cote__vide">
                  Aucune facture pour l&apos;instant. Elles sont émises en fin de mois
                  et restent consultables ici.
                </p>
              ) : (
                <div className="carte-cote__liste">
                  {(factures ?? []).slice(0, 6).map((f) => (
                    <a key={f.id} href={`/factures/${f.id}`} className="entree-cote">
                      <span style={{ minWidth: 0 }}>
                        <span className="entree-cote__nom">{f.numero ?? "—"}</span>
                        <span className="entree-cote__note">
                          {moisLong(f.periode_debut)}
                          {f.statut === "payee"
                            ? " · réglée"
                            : f.echeance_le
                              ? ` · avant le ${new Date(f.echeance_le).toLocaleDateString("fr-FR")}`
                              : ""}
                        </span>
                      </span>
                      <span className="entree-cote__montant">
                        {euros(f.total_cents)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="carte-cote">
              <div className="carte-cote__tete">
                <p className="carte-cote__titre">Documents</p>
              </div>
              {(documents ?? []).length === 0 ? (
                <p className="carte-cote__vide">
                  Les supports utilisés pendant les cours apparaîtront ici dès que
                  Pauline les aura déposés.
                </p>
              ) : (
                <div className="carte-cote__liste">
                  {(documents ?? []).slice(0, 8).map((d) => (
                    <a key={d.id} href={`/documents/${d.id}`} className="entree-cote">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", color: "var(--or-texte)" }}>
                        <path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z" />
                        <path d="M14 2.5v5h5" />
                      </svg>
                      <span className="entree-cote__nom" style={{ minWidth: 0 }}>
                        {d.nom_fichier}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </aside>

        </div>
      </div>
    </section>
  );
}
