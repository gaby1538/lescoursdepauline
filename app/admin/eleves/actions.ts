"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";
import { parisVersInstant } from "@/lib/dates";
import {
  reponseAnnulation,
  reponseDemande,
  reponseDeplacement,
} from "@/lib/emails";

function retour(chemin: string, parametre?: string): never {
  revalidatePath(chemin);
  redirect(`${chemin}${parametre ?? ""}`);
}

/**
 * Ces deux actions servent depuis la fiche d'un élève comme depuis le
 * tableau de bord. On revient d'où l'on vient, mais seulement vers une
 * page d'administration : le champ vient du navigateur.
 */
function destination(formulaire: FormData, defaut: string): string {
  const demandee = String(formulaire.get("retour") ?? "");
  return /^\/admin(\/[\w-]*)*$/.test(demandee) ? demandee : defaut;
}

export async function basculerSuspension(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const suspendu = String(formulaire.get("suspendu") ?? "") === "1";
  const motif = String(formulaire.get("motif") ?? "").trim() || null;

  if (id) {
    await clientAdmin()
      .from("dossiers")
      .update({
        suspendu: !suspendu,
        motif_suspension: suspendu ? null : motif,
      })
      .eq("id", id);

    await clientAdmin().from("journal").insert({
      acteur: "pauline",
      dossier_id: id,
      objet: "dossier",
      action: suspendu ? "reactive" : "suspendu",
      details: { motif },
    });
  }

  retour(`/admin/eleves/${id}`, "?ok=1");
}

export async function annulerCours(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const ids = identifiants(formulaire);
  const dossier = String(formulaire.get("dossier") ?? "");

  if (ids.length > 0) {
    await clientAdmin()
      .from("reservations")
      .update({ statut: "annulee_par_pauline" })
      .in("id", ids);

    await clientAdmin()
      .from("journal")
      .insert(
        ids.map((unId) => ({
          acteur: "pauline",
          dossier_id: dossier || null,
          objet: "reservation",
          objet_id: unId,
          action: "annulee_par_pauline",
        }))
      );
  }

  retour(destination(formulaire, `/admin/eleves/${dossier}`), "?ok=1");
}

/**
 * Les identifiants d'un cours.
 *
 * Deux heures qui se suivent sont deux lignes en base et un seul cours
 * pour tout le monde. Les écrans les présentent donc en bloc, et un
 * bouton tranche le bloc entier : le champ porte une liste, et une
 * seule valeur reste une liste d'un élément.
 */
function identifiants(formulaire: FormData): string[] {
  return String(formulaire.get("id") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function marquerEffectue(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const ids = identifiants(formulaire);
  const dossier = String(formulaire.get("dossier") ?? "");

  if (ids.length > 0) {
    // L'erreur était ignorée : la base pouvait refuser — un cours non
    // validé n'est pas facturable — et l'écran annonçait quand même
    // « c'est fait », en laissant la ligne en place sans explication.
    const { error } = await clientAdmin()
      .from("reservations")
      .update({ statut: "effectuee" })
      .in("id", ids);

    if (error) {
      console.error("marquer effectué", error);
      retour(
        destination(formulaire, `/admin/eleves/${dossier}`),
        error.message.includes("NON_VALIDEE")
          ? "?erreur=non_validee"
          : "?erreur=enregistrement"
      );
    }

    await clientAdmin()
      .from("journal")
      .insert(
        ids.map((unId) => ({
          acteur: "pauline",
          dossier_id: dossier || null,
          objet: "reservation",
          objet_id: unId,
          action: "effectuee",
        }))
      );
  }

  retour(destination(formulaire, `/admin/eleves/${dossier}`), "?ok=1");
}

/**
 * Supprimer un dossier, ou l'anonymiser s'il porte des factures.
 *
 * Le Code de commerce impose de conserver les pièces comptables dix ans,
 * et la clé étrangère des factures est en « restrict » pour que cette
 * obligation ne puisse pas être contournée par erreur. Dans ce cas on
 * efface l'identité et on garde la coquille comptable.
 */
export async function supprimerDossier(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const bloquer = String(formulaire.get("bloquer") ?? "") === "1";
  const motif = String(formulaire.get("motif") ?? "").trim() || null;
  if (!id) retour("/admin/eleves");

  const supabase = clientAdmin();

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("id, email, email_normalise, telephone")
    .eq("id", id)
    .maybeSingle();

  if (!dossier) retour("/admin/eleves");

  if (bloquer) {
    await supabase.from("liste_noire").insert({
      email_normalise: dossier.email_normalise,
      telephone: dossier.telephone,
      motif,
    });
  }

  const { count } = await supabase
    .from("factures")
    .select("id", { count: "exact", head: true })
    .eq("dossier_id", id);

  if ((count ?? 0) > 0) {
    await supabase
      .from("dossiers")
      .update({
        anonymise: true,
        prenom: null,
        nom: null,
        telephone: null,
        eleve_prenom: null,
        email: `anonyme.${id}@supprime.invalid`,
        user_id: null,
        notes_internes: null,
      })
      .eq("id", id);

    await supabase.from("journal").insert({
      acteur: "pauline",
      dossier_id: id,
      objet: "dossier",
      action: "anonymise",
      details: { factures: count, liste_noire: bloquer },
    });

    retour("/admin/eleves", "?ok=anonymise");
  }

  await supabase.from("dossiers").delete().eq("id", id);

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "dossier",
    action: "supprime",
    details: { liste_noire: bloquer },
  });

  retour("/admin/eleves", "?ok=supprime");
}

export async function retirerDeLaListeNoire(formulaire: FormData): Promise<void> {
  await exigerAdmin();
  const id = String(formulaire.get("id") ?? "");
  if (id) await clientAdmin().from("liste_noire").delete().eq("id", id);
  retour("/admin/eleves", "?ok=1");
}

/**
 * Ce que le parent demande pour ses factures : un autre nom, une
 * adresse, une mention. Enregistré sur le dossier, repris
 * automatiquement sur chaque nouvelle facture — et modifiable ensuite
 * sur le brouillon, au cas par cas.
 */
export async function enregistrerFacturation(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour("/admin/eleves");

  await clientAdmin()
    .from("dossiers")
    .update({
      facturation_nom: String(formulaire.get("facturation_nom") ?? "").trim() || null,
      facturation_adresse:
        String(formulaire.get("facturation_adresse") ?? "").trim() || null,
      facturation_note: String(formulaire.get("facturation_note") ?? "").trim() || null,
    })
    .eq("id", id);

  retour(`/admin/eleves/${id}`, "?ok=1");
}

/**
 * Pauline tranche une demande d'annulation.
 *
 * Le classement dans ou hors délai se fait sur l'instant de la demande,
 * jamais sur celui de la réponse : un élève qui prévient une semaine
 * avant ne doit pas être facturé parce que la réponse a tardé. C'est le
 * déclencheur en base qui s'en charge.
 */
export async function repondreAnnulation(
  decision: string,
  formulaire: FormData
): Promise<void> {
  await exigerAdmin();

  const ou = destination(formulaire, "/admin");
  const ids = String(formulaire.get("ids") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[0-9a-f-]{36}$/.test(v));
  const reponse = String(formulaire.get("reponse") ?? "").trim().slice(0, 500) || null;

  if (ids.length === 0 || !["acceptee", "refusee"].includes(decision)) {
    retour(ou, "?erreur=decision");
  }

  const supabase = clientAdmin();

  const { data: lignes } = await supabase
    .from("reservations")
    .select("id, debut, fin, statut, dossier_id, demande_type")
    .in("id", ids)
    .order("debut");

  const cours = (lignes ?? []).filter((c) => c.statut === "reservee");
  if (cours.length === 0) retour(ou, "?erreur=introuvable");

  const dossierId = cours[0].dossier_id;
  if (cours.some((c) => c.dossier_id !== dossierId)) retour(ou, "?erreur=decision");

  const reduction = cours[0].demande_type === "reduction";
  const modification = cours[0].demande_type === "modification";
  const maintenant = new Date().toISOString();

  // Le créneau proposé en remplacement, s'il y en a un.
  const { data: proposes } = modification
    ? await supabase
        .from("reservations")
        .select("id, debut, fin")
        .eq("remplace", cours[0].id)
        .eq("statut", "reservee")
        .order("debut")
    : { data: [] };

  const nouveaux = proposes ?? [];
  if (modification && nouveaux.length === 0) retour(ou, "?erreur=introuvable");

  const { error } = await supabase
    .from("reservations")
    .update({
      ...(decision === "acceptee" ? { statut: "annulee_dans_delai" } : {}),
      // Un cours déplacé n'est pas un cours perdu : la base ne doit pas
      // le requalifier en annulation tardive.
      ...(decision === "acceptee" && modification ? { deplacee_le: maintenant } : {}),
      annulation_decision: decision,
      annulation_reponse: reponse,
      annulation_traitee_le: maintenant,
    })
    .in("id", cours.map((c) => c.id));

  if (error) {
    console.error("réponse à l'annulation", error);
    retour(ou, "?erreur=enregistrement");
  }

  if (modification) {
    // Accepté, le créneau proposé devient le cours. Refusé, il est rendu.
    const { error: erreurNouveaux } = await supabase
      .from("reservations")
      .update(
        decision === "acceptee"
          ? { validee_le: maintenant }
          : { statut: "annulee_dans_delai" }
      )
      .in(
        "id",
        nouveaux.map((n) => n.id)
      );

    if (erreurNouveaux) {
      console.error("bascule du créneau proposé", erreurNouveaux);
      retour(ou, "?erreur=enregistrement");
    }
  }

  // On relit : le déclencheur a peut-être requalifié en hors délai.
  const { data: apres } = await supabase
    .from("reservations")
    .select("statut")
    .eq("id", cours[0].id)
    .maybeSingle();

  // Pour une réduction, ce qui intéresse l'élève est ce qui reste.
  let restantes = 0;
  if (reduction && decision === "acceptee") {
    const { count } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("dossier_id", dossierId)
      .eq("statut", "reservee")
      .gte("debut", new Date(Date.parse(cours[0].debut) - 12 * 3600 * 1000).toISOString())
      .lt("debut", cours[0].debut);
    restantes = count ?? 0;
  }

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("email, prenom")
    .eq("id", dossierId)
    .maybeSingle();

  if (dossier) {
    const resultat = modification
      ? await reponseDeplacement({
          destinataire: dossier.email,
          prenom: dossier.prenom ?? "",
          ancien: {
            debut: cours[0].debut,
            fin: cours[cours.length - 1].fin,
            heures: cours.length,
          },
          nouveau: {
            debut: nouveaux[0].debut,
            fin: nouveaux[nouveaux.length - 1].fin,
            heures: nouveaux.length,
          },
          acceptee: decision === "acceptee",
          reponse,
        })
      : await reponseAnnulation({
          destinataire: dossier.email,
          prenom: dossier.prenom ?? "",
          debut: cours[0].debut,
          acceptee: decision === "acceptee",
          facturable: apres?.statut === "annulee_hors_delai",
          reponse,
          reduction: reduction ? { heures: cours.length, restantes } : null,
        });

    await supabase.from("journal").insert({
      acteur: "pauline",
      dossier_id: dossierId,
      objet: "reservation",
      objet_id: cours[0].id,
      action: `${
        modification ? "modification" : reduction ? "reduction" : "annulation"
      }_${decision}`,
      details: {
        statut: apres?.statut,
        heures: cours.length,
        ...(modification ? { vers: nouveaux[0].debut, heures_apres: nouveaux.length } : {}),
        email: resultat.detail,
      },
    });
  }

  revalidatePath("/reserver");
  revalidatePath("/mon-espace");
  retour(ou, "?ok=1");
}

/**
 * Pauline accepte ou refuse une demande de cours.
 *
 * Une demande de plusieurs heures qui se suivent arrive ici en un seul
 * bloc : il serait absurde de cliquer trois fois et d'envoyer trois
 * emails pour un cours de trois heures. La décision porte donc sur une
 * liste d'identifiants, et l'élève reçoit un seul message.
 *
 * La bascule elle-même est faite par la base (decider_demande), sous
 * verrou : deux onglets ouverts ne peuvent pas décider deux fois.
 */
export async function deciderDemande(
  decision: string,
  formulaire: FormData
): Promise<void> {
  await exigerAdmin();

  const ou = destination(formulaire, "/admin");
  const accepter = decision === "acceptee";
  const motif = String(formulaire.get("motif") ?? "").trim().slice(0, 500) || null;

  if (!["acceptee", "refusee"].includes(decision)) retour(ou, "?erreur=decision");

  const ids = String(formulaire.get("ids") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => /^[0-9a-f-]{36}$/.test(v));

  if (ids.length === 0) retour(ou, "?erreur=decision");

  const supabase = clientAdmin();

  const { data: lignes } = await supabase
    .from("reservations")
    .select("id, debut, fin, dossier_id, validee_le, statut")
    .in("id", ids)
    .order("debut");

  const demandes = (lignes ?? []).filter(
    (r) => r.statut === "reservee" && !r.validee_le
  );

  if (demandes.length === 0) retour(ou, "?erreur=introuvable");

  // Un bloc appartient à un seul dossier. Si ce n'est pas le cas, le
  // formulaire a été bricolé : on s'arrête plutôt que de deviner.
  const dossierId = demandes[0].dossier_id;
  if (demandes.some((r) => r.dossier_id !== dossierId)) {
    retour(ou, "?erreur=decision");
  }

  const echecs: string[] = [];
  for (const demande of demandes) {
    const { error } = await supabase.rpc("decider_demande", {
      demande: demande.id,
      accepter,
      motif,
    });
    if (error) echecs.push(error.message);
  }

  if (echecs.length === demandes.length) {
    console.error("décision sur demande", echecs[0]);
    retour(ou, "?erreur=enregistrement");
  }

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("email, prenom")
    .eq("id", dossierId)
    .maybeSingle();

  if (dossier) {
    const resultat = await reponseDemande({
      destinataire: dossier.email,
      prenom: dossier.prenom ?? "",
      creneaux: demandes.map((r) => ({ debut: r.debut, fin: r.fin })),
      acceptee: accepter,
      motif,
    });

    await supabase.from("journal").insert({
      acteur: "pauline",
      dossier_id: dossierId,
      objet: "reservation",
      objet_id: demandes[0].id,
      action: accepter ? "demande_acceptee" : "demande_refusee",
      details: {
        heures: demandes.length,
        motif,
        email: resultat.detail,
        echecs: echecs.length ? echecs : undefined,
      },
    });
  }

  revalidatePath("/reserver");
  revalidatePath("/mon-espace");
  retour(ou, echecs.length ? "?erreur=partiel" : "?ok=1");
}

/* ---------------------------------------------------------------------
 *  Les élèves que Pauline crée elle-même
 *
 *  Une fiche n'est pas un compte : sans adresse email, l'élève n'a
 *  aucun accès au site, et c'est l'état normal d'une fiche tenue à la
 *  main. L'adresse, quand il y en a une, sert à envoyer des factures —
 *  pas à ouvrir un accès. Celui-ci se donne à part, jamais par effet de
 *  bord d'une création.
 * ------------------------------------------------------------------ */

/** Un montant saisi à la française : « 39 », « 39,50 », « 39 € ». */
function centimes(saisie: string): number | null {
  const propre = saisie.replace(/[^\d,.-]/g, "").replace(",", ".").trim();
  if (!propre) return null;
  const n = Number(propre);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export async function creerEleve(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const prenomEleve = String(formulaire.get("eleve_prenom") ?? "").trim();
  if (!prenomEleve) retour("/admin/eleves/nouveau", "?erreur=prenom");

  const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
  if (email && !email.includes("@")) {
    retour("/admin/eleves/nouveau", "?erreur=email");
  }

  const supabase = clientAdmin();

  // Une adresse déjà connue désigne un dossier existant : en créer un
  // second couperait l'historique et les factures en deux.
  if (email) {
    const { data: connu } = await supabase
      .from("dossiers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (connu) retour(`/admin/eleves/${connu.id}`, "?ok=existant");
  }

  const { data: cree, error } = await supabase
    .from("dossiers")
    .insert({
      eleve_prenom: prenomEleve,
      eleve_classe: String(formulaire.get("eleve_classe") ?? "").trim() || null,
      nom: String(formulaire.get("nom") ?? "").trim() || null,
      prenom: String(formulaire.get("prenom") ?? "").trim() || null,
      email: email || null,
      telephone: String(formulaire.get("telephone") ?? "").trim() || null,
      facturation_adresse:
        String(formulaire.get("facturation_adresse") ?? "").trim() || null,
      tarif_horaire_cents: centimes(String(formulaire.get("tarif") ?? "")),
    })
    .select("id")
    .single();

  if (error || !cree) {
    console.error("création d'un élève", error);
    retour("/admin/eleves/nouveau", "?erreur=creation");
  }

  revalidatePath("/admin/eleves");

  // « Créer la fiche et poser ses cours » enchaîne sur la série : c'est
  // le geste qui suit neuf fois sur dix.
  const suite = String(formulaire.get("suite") ?? "");
  redirect(
    suite === "cours"
      ? `/admin/eleves/${cree.id}/serie?ok=cree`
      : `/admin/eleves/${cree.id}?ok=cree`
  );
}

export async function archiverEleve(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour("/admin/eleves");

  // Archiver n'efface rien : les cours, les factures et le livre des
  // recettes restent. La fiche sort seulement des listes.
  const rendre = String(formulaire.get("rendre") ?? "") === "1";

  await clientAdmin()
    .from("dossiers")
    .update({ archive_le: rendre ? null : new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/eleves");
  retour(`/admin/eleves/${id}`, rendre ? "?ok=reprise" : "?ok=archive");
}

/* ---------------------------------------------------------------------
 *  Les cours que Pauline pose elle-même
 *
 *  Ils sont valides d'emblée : elle est celle qui valide, lui faire
 *  valider ses propres cours n'aurait pas de sens. La base les laisse
 *  aussi passer outre les garde-fous écrits pour les élèves — délai,
 *  fenêtre de disponibilité, quotas — parce qu'elle est l'agenda. Le
 *  seul refus qui demeure est le chevauchement : deux élèves ne
 *  peuvent pas occuper la même heure.
 * ------------------------------------------------------------------ */

type Creneau = { debut: string; fin: string };

/** Une date et une heure de Paris, plus une durée, font un créneau. */
function creneau(jour: string, heure: string, dureeMin: number): Creneau | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || !/^\d{2}:\d{2}/.test(heure)) return null;

  const debut = parisVersInstant(`${jour}T${heure.slice(0, 5)}`);
  if (!debut) return null;

  const fin = new Date(Date.parse(debut) + dureeMin * 60000).toISOString();
  return { debut, fin };
}

/**
 * Le même cours, découpé comme le site le fait partout : une ligne par
 * heure.
 *
 * Deux heures posées d'un seul bloc feraient une ligne, et une ligne
 * vaut une heure dans tout le reste du code — la séance s'afficherait
 * « une heure » et se facturerait « 1 × 80 € » au lieu de « 2 × 40 € ».
 * Une durée qui ne tombe pas sur l'heure (1 h 30) reste d'un bloc :
 * on ne sait pas la couper, et une ligne de 1 h 30 reste juste.
 */
function creneaux(jour: string, heure: string, dureeMin: number): Creneau[] {
  const entier = creneau(jour, heure, dureeMin);
  if (!entier) return [];
  if (dureeMin % 60 !== 0 || dureeMin < 60) return [entier];

  const tranches: Creneau[] = [];
  for (let i = 0; i < dureeMin / 60; i += 1) {
    const debut = new Date(Date.parse(entier.debut) + i * 3600000).toISOString();
    tranches.push({
      debut,
      fin: new Date(Date.parse(debut) + 3600000).toISOString(),
    });
  }
  return tranches;
}

/** Le prix d'une ligne : l'heure, ou la séance quand elle est d'un bloc. */
function prixDeLaLigne(prixHoraire: number | null, dureeMin: number): number | null {
  if (prixHoraire === null) return null;
  if (dureeMin % 60 === 0 && dureeMin >= 60) return prixHoraire;
  return Math.round((prixHoraire * dureeMin) / 60);
}

function duree(formulaire: FormData): number {
  const n = Number(String(formulaire.get("duree") ?? "60"));
  return Number.isFinite(n) && n >= 15 && n <= 480 ? Math.round(n) : 60;
}

export async function ajouterCours(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const dossier = String(formulaire.get("dossier") ?? "");
  if (!dossier) retour("/admin/eleves");

  const vers = `/admin/eleves/${dossier}/cours`;
  const minutes = duree(formulaire);
  const quand = creneaux(
    String(formulaire.get("jour") ?? ""),
    String(formulaire.get("heure") ?? ""),
    minutes
  );

  if (quand.length === 0) retour(vers, "?erreur=date");

  const sujet = String(formulaire.get("sujet") ?? "").trim() || null;
  const prixLigne = prixDeLaLigne(
    centimes(String(formulaire.get("prix") ?? "")),
    minutes
  );

  const { error } = await clientAdmin().from("reservations").insert(
    quand.map((c) => ({
      dossier_id: dossier,
      debut: c.debut,
      fin: c.fin,
      prix_cents: prixLigne,
      cree_par_pauline: true,
      validee_le: new Date().toISOString(),
      sujet,
    }))
  );

  if (error) {
    const pris = (error.message ?? "").includes("CRENEAU_PRIS");
    console.error("ajout d'un cours", error);
    retour(vers, pris ? "?erreur=pris" : "?erreur=creation");
  }

  revalidatePath("/admin/horaires");
  retour(`/admin/eleves/${dossier}`, "?ok=cours");
}

export async function creerSerie(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const dossier = String(formulaire.get("dossier") ?? "");
  if (!dossier) retour("/admin/eleves");

  const vers = `/admin/eleves/${dossier}/serie`;

  // Les dates cochées dans l'aperçu, et elles seules. Une case décochée
  // ne laisse rien derrière elle : ni cours fantôme, ni trace.
  const jours = formulaire
    .getAll("jour")
    .map((v) => String(v))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));

  if (jours.length === 0) retour(vers, "?erreur=aucune");

  const heure = String(formulaire.get("heure") ?? "");
  const minutes = duree(formulaire);
  const prix = centimes(String(formulaire.get("prix") ?? ""));

  const supabase = clientAdmin();

  const { data: serie, error: erreurSerie } = await supabase
    .from("series")
    .insert({
      dossier_id: dossier,
      jour_semaine: Number(String(formulaire.get("jour_semaine") ?? "2")),
      heure: heure.slice(0, 5),
      duree_min: minutes,
      // Le tarif de la série est horaire : c'est celui de la fiche.
      prix_cents: prix ?? 0,
    })
    .select("id")
    .single();

  if (erreurSerie || !serie) {
    console.error("création d'une série", erreurSerie);
    retour(vers, "?erreur=creation");
  }

  // Une séance à la fois : si l'une se heurte à un créneau déjà pris,
  // les autres n'ont pas à tomber avec elle. On dit à la fin combien
  // sont passées.
  let posees = 0;
  let refusees = 0;

  const prixLigne = prixDeLaLigne(prix, minutes);

  for (const jour of jours) {
    const quand = creneaux(jour, heure, minutes);
    if (quand.length === 0) {
      refusees += 1;
      continue;
    }

    const { error } = await supabase.from("reservations").insert(
      quand.map((c) => ({
        dossier_id: dossier,
        debut: c.debut,
        fin: c.fin,
        prix_cents: prixLigne,
        cree_par_pauline: true,
        validee_le: new Date().toISOString(),
        serie_id: serie.id,
      }))
    );

    if (error) refusees += 1;
    else posees += 1;
  }

  revalidatePath("/admin/horaires");
  revalidatePath(`/admin/eleves/${dossier}`);
  redirect(
    `/admin/eleves/${dossier}?ok=serie&posees=${posees}&refusees=${refusees}`
  );
}

export async function arreterSerie(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const dossier = String(formulaire.get("dossier") ?? "");
  if (!id || !dossier) retour("/admin/eleves");

  const supabase = clientAdmin();

  // Les séances passées restent : elles ont eu lieu, elles se
  // facturent. Seules celles à venir disparaissent.
  const { count } = await supabase
    .from("reservations")
    .delete({ count: "exact" })
    .eq("serie_id", id)
    .eq("statut", "reservee")
    .gt("debut", new Date().toISOString());

  await supabase
    .from("series")
    .update({ arretee_le: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/horaires");
  retour(`/admin/eleves/${dossier}`, `?ok=arretee&retirees=${count ?? 0}`);
}
