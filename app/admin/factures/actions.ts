"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigerAdmin } from "@/lib/admin";
import { clientAdmin } from "@/lib/supabase";
import { creneauLong, moisLong } from "@/lib/dates";
import { factureEmise, facturePourTransfert } from "@/lib/emails";
import { pdfDeFacture } from "@/lib/facturePdf";

/** Ce que le livre des recettes accepte comme mode de règlement. */
const MODES = ["virement", "wero", "especes", "cheque", "autre"];

const FACTURABLE = ["effectuee", "annulee_hors_delai", "absent"];

function retour(parametre?: string): never {
  revalidatePath("/admin/factures");
  redirect(`/admin/factures${parametre ?? ""}`);
}

/**
 * Rassemble, pour un mois donné, les cours facturables encore libres de
 * toute facture, et en fait un brouillon par élève.
 *
 * Les brouillons ne portent pas de numéro : la numérotation continue
 * n'est attribuée qu'à l'émission, pour qu'un brouillon supprimé ne
 * laisse pas de trou dans la série.
 */
export async function genererFactures(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  // Soit un mois, soit un intervalle quelconque : Pauline peut vouloir
  // facturer un trimestre d'un coup, ou rattraper une année.
  const mois = String(formulaire.get("mois") ?? "");
  const depuis = String(formulaire.get("depuis") ?? "");
  const jusqua = String(formulaire.get("jusqua") ?? "");
  const dossierVoulu = String(formulaire.get("dossier") ?? "").trim();

  let debut: string;
  let fin: string;

  if (/^\d{4}-\d{2}-\d{2}$/.test(depuis) && /^\d{4}-\d{2}-\d{2}$/.test(jusqua)) {
    debut = depuis;
    fin = jusqua;
  } else if (/^\d{4}-\d{2}$/.test(mois)) {
    debut = `${mois}-01`;
    const suivant = new Date(`${debut}T00:00:00Z`);
    suivant.setUTCMonth(suivant.getUTCMonth() + 1);
    fin = suivant.toISOString().slice(0, 10);
  } else {
    retour("?erreur=mois");
  }

  const supabase = clientAdmin();

  let requete = supabase
    .from("reservations")
    .select("id, dossier_id, debut, prix_cents")
    .is("facture_id", null)
    .in("statut", FACTURABLE)
    .gte("debut", `${debut}T00:00:00Z`)
    .lt("debut", `${fin}T00:00:00Z`)
    .order("debut");

  if (/^[0-9a-f-]{36}$/.test(dossierVoulu)) {
    requete = requete.eq("dossier_id", dossierVoulu);
  }

  const { data: cours } = await requete;

  if (!cours || cours.length === 0) retour("?ok=rien");

  const parDossier = new Map<string, typeof cours>();
  for (const c of cours) {
    const liste = parDossier.get(c.dossier_id) ?? [];
    liste.push(c);
    parDossier.set(c.dossier_id, liste);
  }

  let creees = 0;
  let derniere: string | null = null;

  for (const [dossierId, liste] of parDossier) {
    const total = liste.reduce((somme, c) => somme + c.prix_cents, 0);

    const { data: reglages } = await supabase
      .from("dossiers")
      .select("facturation_nom, facturation_adresse, facturation_note")
      .eq("id", dossierId)
      .maybeSingle();

    const { data: facture, error } = await supabase
      .from("factures")
      .insert({
        dossier_id: dossierId,
        periode_debut: debut,
        periode_fin: fin,
        total_cents: total,
        destinataire_nom: reglages?.facturation_nom ?? null,
        destinataire_adresse: reglages?.facturation_adresse ?? null,
        note: reglages?.facturation_note ?? null,
      })
      .select("id")
      .single();

    if (error || !facture) {
      console.error("création facture", error);
      continue;
    }

    const lignes = liste.map((c, index) => ({
      facture_id: facture.id,
      reservation_id: c.id,
      description: `Cours de SVT — ${creneauLong(c.debut)}`,
      quantite: 1,
      prix_unitaire_cents: c.prix_cents,
      total_cents: c.prix_cents,
      ordre: index,
    }));

    await supabase.from("lignes_facture").insert(lignes);
    await supabase
      .from("reservations")
      .update({ facture_id: facture.id })
      .in(
        "id",
        liste.map((c) => c.id)
      );

    creees += 1;
    derniere = facture.id;
  }

  // Une seule facture préparée : on l'ouvre, plutôt que de renvoyer
  // vers une liste où il faudrait la retrouver.
  if (creees === 1 && derniere) {
    revalidatePath("/admin/factures");
    redirect(`/admin/factures/${derniere}/modifier?ok=nouvelle`);
  }

  retour(`?ok=${creees}`);
}

/* ---------------------------------------------------------------------
   Modifier un brouillon
   ------------------------------------------------------------------ */

function centimes(valeur: string): number | null {
  const propre = valeur.replace(/\s|€/g, "").replace(",", ".");
  const n = Number(propre);
  if (!Number.isFinite(n) || Math.abs(n) > 100000) return null;
  return Math.round(n * 100);
}

function nombre(valeur: string): number | null {
  const n = Number(valeur.replace(",", "."));
  if (!Number.isFinite(n) || Math.abs(n) > 9999) return null;
  return Math.round(n * 100) / 100;
}

async function estBrouillon(id: string): Promise<boolean> {
  const { data } = await clientAdmin()
    .from("factures")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  return data?.statut === "brouillon";
}

/**
 * Enregistre les lignes et l'en-tête d'un brouillon.
 *
 * Le total n'est pas écrit ici : un déclencheur le recalcule à partir
 * des lignes. Une facture dont le total ne serait pas la somme de ses
 * lignes n'aurait aucune valeur.
 */
export async function enregistrerFacture(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();
  if (!(await estBrouillon(id))) retour("?erreur=emise");

  const supabase = clientAdmin();

  const ids = formulaire.getAll("ligne_id").map(String);
  const descriptions = formulaire.getAll("description").map(String);
  const quantites = formulaire.getAll("quantite").map(String);
  const prix = formulaire.getAll("prix").map(String);

  for (let i = 0; i < ids.length; i += 1) {
    const description = descriptions[i]?.trim();
    const q = nombre(quantites[i] ?? "");
    const pu = centimes(prix[i] ?? "");
    if (!description || q === null || pu === null) continue;

    await supabase
      .from("lignes_facture")
      .update({
        description: description.slice(0, 300),
        quantite: q,
        prix_unitaire_cents: pu,
        total_cents: Math.round(q * pu),
      })
      .eq("id", ids[i])
      .eq("facture_id", id);
  }

  // Une ligne libre : une remise, un forfait de stage, un rattrapage.
  const nouvelle = String(formulaire.get("nouvelle_description") ?? "").trim();
  if (nouvelle) {
    const q = nombre(String(formulaire.get("nouvelle_quantite") ?? "1")) ?? 1;
    const pu = centimes(String(formulaire.get("nouveau_prix") ?? "0"));
    if (pu !== null) {
      const { count } = await supabase
        .from("lignes_facture")
        .select("id", { count: "exact", head: true })
        .eq("facture_id", id);

      await supabase.from("lignes_facture").insert({
        facture_id: id,
        description: nouvelle.slice(0, 300),
        quantite: q,
        prix_unitaire_cents: pu,
        total_cents: Math.round(q * pu),
        ordre: count ?? 0,
      });
    }
  }

  const destinataireNom =
    String(formulaire.get("destinataire_nom") ?? "").trim() || null;
  const destinataireAdresse =
    String(formulaire.get("destinataire_adresse") ?? "").trim() || null;
  const note = String(formulaire.get("note") ?? "").trim() || null;

  await supabase
    .from("factures")
    .update({
      destinataire_nom: destinataireNom,
      destinataire_adresse: destinataireAdresse,
      note,
    })
    .eq("id", id);

  // Reporter sur la fiche de l'élève, pour que la facture suivante
  // parte déjà remplie. Sans ça, une adresse d'employeur ou un nom de
  // société se ressaisit tous les mois.
  if (String(formulaire.get("memoriser") ?? "") === "1") {
    const { data: facture } = await supabase
      .from("factures")
      .select("dossier_id")
      .eq("id", id)
      .maybeSingle();

    if (facture?.dossier_id) {
      await supabase
        .from("dossiers")
        .update({
          facturation_nom: destinataireNom,
          facturation_adresse: destinataireAdresse,
          facturation_note: note,
        })
        .eq("id", facture.dossier_id);

      revalidatePath(`/admin/eleves/${facture.dossier_id}`);
    }
  }

  revalidatePath(`/admin/factures/${id}/modifier`);
  revalidatePath(`/factures/${id}`);
  redirect(
    `/admin/factures/${id}/modifier?ok=${
      String(formulaire.get("memoriser") ?? "") === "1" ? "memorise" : "1"
    }`
  );
}

export async function supprimerLigne(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const facture = String(formulaire.get("facture") ?? "");
  if (!id || !facture) retour();
  if (!(await estBrouillon(facture))) retour("?erreur=emise");

  await clientAdmin().from("lignes_facture").delete().eq("id", id).eq("facture_id", facture);

  revalidatePath(`/admin/factures/${facture}/modifier`);
  redirect(`/admin/factures/${facture}/modifier?ok=1`);
}

/**
 * Émettre : la facture prend son numéro et se fige. C'est un acte
 * comptable, et le seul geste du site qu'on ne peut pas défaire.
 *
 * L'envoi est séparé. Émettre sans envoyer laisse la facture dans
 * « À envoyer », d'où Pauline l'expédiera, la téléchargera, ou la
 * déclarera remise en main propre. Aucun email ne part d'ici sans
 * qu'elle l'ait demandé.
 */
export async function emettre(
  intention: string,
  formulaire: FormData
): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const surErreur: (q: string) => never = (q) =>
    retour(`/admin/factures/${id}/modifier${q}`);

  if (!(await estBrouillon(id))) surErreur("?erreur=emise");

  const supabase = clientAdmin();

  const { count: nbLignes } = await supabase
    .from("lignes_facture")
    .select("id", { count: "exact", head: true })
    .eq("facture_id", id);

  if ((nbLignes ?? 0) === 0) surErreur("?erreur=vide");

  const choisi = String(formulaire.get("numero") ?? "").trim().slice(0, 40);

  const { data: numero, error } = await supabase.rpc("emettre_facture", {
    facture: id,
    numero_choisi: choisi || null,
  });

  if (error) {
    console.error("numérotation", error);
    const doublon = /duplicate key|unique/i.test(error.message ?? "");
    surErreur(doublon ? "?erreur=doublon" : "?erreur=numero");
  }

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "facture",
    objet_id: id,
    action: "emise",
    details: { numero },
  });

  revalidatePath("/admin/factures");
  revalidatePath(`/factures/${id}`);

  if (intention !== "envoyer") {
    redirect("/admin/factures?ok=emise");
  }

  await expedier(id, String(formulaire.get("message") ?? ""));
}

/**
 * L'envoi proprement dit, depuis « À envoyer » ou juste après
 * l'émission. Le mot ajouté par Pauline est conservé : c'est ce que la
 * famille a lu.
 */
async function expedier(id: string, mot: string): Promise<never> {
  const supabase = clientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select(
      "id, numero, total_cents, echeance_le, periode_debut, envoyee_le, remise_le, transferee_le, dossiers (prenom, email)"
    )
    .eq("id", id)
    .maybeSingle();

  const dossier = facture?.dossiers as unknown as
    | { prenom: string | null; email: string }
    | null;

  if (!facture || !dossier) retour("?erreur=introuvable");
  if (facture.envoyee_le || facture.remise_le || facture.transferee_le) {
    retour("?erreur=deja_transmise");
  }

  const { count } = await supabase
    .from("lignes_facture")
    .select("id", { count: "exact", head: true })
    .eq("facture_id", id);

  const { data: reglages } = await supabase
    .from("parametres")
    .select("email_contact")
    .eq("id", true)
    .maybeSingle();

  const message = mot.trim().slice(0, 1000) || null;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  // Le PDF part avec l'email : beaucoup de familles classent la pièce
  // jointe et ne cliquent jamais sur le lien.
  let piece: { nom: string; contenu: Buffer } | null = null;
  try {
    piece = await pdfDeFacture(id);
  } catch (e) {
    console.error("PDF de facture", e);
  }

  const resultat = await factureEmise({
    destinataire: dossier.email,
    prenom: dossier.prenom ?? "",
    numero: facture.numero ?? "",
    totalCentimes: facture.total_cents,
    echeance: facture.echeance_le
      ? new Date(facture.echeance_le).toLocaleDateString("fr-FR")
      : "",
    lien: `${site}/factures/${facture.id}`,
    heures: count ?? 0,
    periode: moisLong(facture.periode_debut),
    message,
    // Pauline reçoit la même chose que la famille : la facture envoyée
    // se retrouve dans sa messagerie, avec sa date.
    copie: reglages?.email_contact ?? null,
    piece,
  });

  if (resultat.ok) {
    await supabase
      .from("factures")
      .update({
        envoyee_le: new Date().toISOString(),
        message_accompagnement: message,
      })
      .eq("id", id);
  }

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "facture",
    objet_id: id,
    action: resultat.ok ? "envoyee" : "envoi_echoue",
    details: { numero: facture.numero, detail: resultat.detail, piece: Boolean(piece) },
  });

  revalidatePath("/admin/factures");
  retour(resultat.ok ? "?ok=envoyee" : "?erreur=envoi");
}

/** Envoyer une facture déjà émise, depuis la liste « À envoyer ». */
export async function envoyerFacture(formulaire: FormData): Promise<void> {
  await exigerAdmin();
  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();
  await expedier(id, String(formulaire.get("message") ?? ""));
}

/**
 * La seconde façon d'envoyer : le site écrit à Pauline, et c'est elle
 * qui transfère depuis sa propre boîte.
 *
 * La facture quitte « À envoyer » : le document est dans sa messagerie
 * à un transfert près. On garde la distinction en base parce qu'une
 * relance ne se formule pas pareil selon que la famille a reçu la
 * facture du site ou de Pauline.
 */
export async function transfererFacture(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();

  const { data: facture } = await supabase
    .from("factures")
    .select(
      "id, numero, total_cents, echeance_le, periode_debut, envoyee_le, remise_le, transferee_le, dossiers (prenom, email)"
    )
    .eq("id", id)
    .maybeSingle();

  const dossier = facture?.dossiers as unknown as
    | { prenom: string | null; email: string }
    | null;

  if (!facture || !dossier) retour("?erreur=introuvable");
  if (facture.envoyee_le || facture.remise_le || facture.transferee_le) {
    retour("?erreur=deja_transmise");
  }

  const { data: reglages } = await supabase
    .from("parametres")
    .select("email_contact")
    .eq("id", true)
    .maybeSingle();

  // Sans adresse de contact, il n'y a personne à qui écrire : autant le
  // dire plutôt que d'envoyer dans le vide.
  if (!reglages?.email_contact) retour("?erreur=sans_contact");

  const { count } = await supabase
    .from("lignes_facture")
    .select("id", { count: "exact", head: true })
    .eq("facture_id", id);

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lescoursdepauline.com";

  let piece: { nom: string; contenu: Buffer } | null = null;
  try {
    piece = await pdfDeFacture(id);
  } catch (e) {
    console.error("PDF de facture", e);
  }

  const resultat = await facturePourTransfert({
    destinataire: reglages.email_contact,
    famille: dossier.email,
    prenom: dossier.prenom ?? "",
    numero: facture.numero ?? "",
    totalCentimes: facture.total_cents,
    echeance: facture.echeance_le
      ? new Date(facture.echeance_le).toLocaleDateString("fr-FR")
      : "",
    lien: `${site}/factures/${facture.id}`,
    heures: count ?? 0,
    periode: moisLong(facture.periode_debut),
    piece,
  });

  if (resultat.ok) {
    await supabase
      .from("factures")
      .update({ transferee_le: new Date().toISOString() })
      .eq("id", id);
  }

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "facture",
    objet_id: id,
    action: resultat.ok ? "transferee" : "transfert_echoue",
    details: { numero: facture.numero, detail: resultat.detail },
  });

  retour(resultat.ok ? "?ok=transferee" : "?erreur=envoi");
}

/**
 * Remise autrement : en main propre, par courrier, depuis sa propre
 * boîte. La facture sort de « À envoyer » sans qu'aucun email parte.
 */
export async function marquerRemise(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();

  const { error } = await supabase
    .from("factures")
    .update({ remise_le: new Date().toISOString() })
    .eq("id", id)
    .is("envoyee_le", null);

  if (error) {
    console.error("remise en main propre", error);
    retour("?erreur=enregistrement");
  }

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "facture",
    objet_id: id,
    action: "remise_en_main_propre",
  });

  retour("?ok=remise");
}


export async function marquerPayee(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  const mode = String(formulaire.get("mode") ?? "virement");
  const quand = String(formulaire.get("payee_le") ?? "").trim();

  if (!id) retour();

  // Le livre des recettes se tient à la date d'encaissement, qui n'est
  // pas forcément celle où Pauline ouvre le site.
  const encaissee = /^\d{4}-\d{2}-\d{2}$/.test(quand)
    ? new Date(`${quand}T12:00:00Z`).toISOString()
    : new Date().toISOString();

  await clientAdmin()
    .from("factures")
    .update({
      statut: "payee",
      payee_le: encaissee,
      mode_reglement: MODES.includes(mode) ? mode : "autre",
    })
    .eq("id", id);

  retour("?ok=payee");
}

/**
 * Revenir sur l'état d'une facture.
 *
 * Émettre était le seul geste que le site ne savait pas défaire, et
 * l'erreur de clic existe : la mauvaise facture émise, envoyée, repérée
 * dans la minute. Ce qu'il faut préserver n'est pas l'irréversibilité,
 * c'est la continuité de la série — ni trou, ni doublon. Le numéro ne
 * se rend donc qu'au bout de la série, et la base le vérifie
 * elle-même : ces fonctions ne font que traduire son refus.
 */
export async function remettreEnBrouillon(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const surErreur = (cause: string): never => {
    revalidatePath("/admin/factures");
    redirect(`/admin/factures/${id}/modifier?erreur=${cause}`);
  };

  const supabase = clientAdmin();
  const { data: rendu, error } = await supabase.rpc("remettre_en_brouillon", {
    facture: id,
  });

  if (error) {
    const message = error.message ?? "";
    console.error("retour au brouillon", error);
    surErreur(
      message.includes("NUMERO_NON_DERNIER")
        ? "pas_la_derniere"
        : message.includes("NUMERO_HORS_SERIE")
          ? "numero_hors_serie"
          : message.includes("DEJA_BROUILLON")
            ? "deja_brouillon"
            : "retour_impossible"
    );
  }

  // Le numéro rendu est consigné : c'est la seule trace qu'il a servi
  // une première fois, et elle vaut mieux qu'un souvenir.
  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "facture",
    objet_id: id,
    action: `retour_au_brouillon:${rendu ?? "?"}`,
  });

  revalidatePath("/admin/factures");
  redirect(
    `/admin/factures/${id}/modifier?ok=rendue&numero=${encodeURIComponent(
      String(rendu ?? "")
    )}`
  );
}

export async function annulerEnvoi(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();

  // Rien de ce qui touche à la série : le numéro, les dates et le
  // montant ne bougent pas. On efface seulement la trace du départ, et
  // la facture revient dans « À envoyer ».
  const { error } = await supabase
    .from("factures")
    .update({
      envoyee_le: null,
      remise_le: null,
      transferee_le: null,
      message_accompagnement: null,
    })
    .eq("id", id);

  if (error) {
    console.error("annulation de l'envoi", error);
    retour("?erreur=enregistrement");
  }

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "facture",
    objet_id: id,
    action: "envoi_annule",
  });

  retour("?ok=a_renvoyer");
}

export async function demarquerPayee(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();
  const { error } = await supabase.rpc("demarquer_payee", { facture: id });

  if (error) {
    console.error("démarquage du paiement", error);
    retour("?erreur=enregistrement");
  }

  await supabase.from("journal").insert({
    acteur: "pauline",
    objet: "facture",
    objet_id: id,
    action: "paiement_annule",
  });

  retour("?ok=depointee");
}

export async function supprimerBrouillon(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  const id = String(formulaire.get("id") ?? "");
  if (!id) retour();

  const supabase = clientAdmin();
  // Les cours redeviennent facturables : on les détache avant d'effacer.
  await supabase.from("reservations").update({ facture_id: null }).eq("facture_id", id);
  await supabase.from("factures").delete().eq("id", id).eq("statut", "brouillon");

  retour("?ok=supprimee");
}

/**
 * Une facture partie de rien, pour un client qui n'a rien réservé sur
 * le site.
 *
 * Le carnet de clients, c'est la table des dossiers : un client créé
 * ici y reste, avec son nom de facturation et son adresse, et la
 * facture suivante les reprend sans rien ressaisir. La facture naît
 * vide ; les lignes s'ajoutent sur l'écran de modification, qui sait
 * déjà le faire.
 */
export async function creerFactureManuelle(formulaire: FormData): Promise<void> {
  await exigerAdmin();

  // Les reproches reviennent à l'écran qui a posé la question, pas
  // à la liste des factures : sans cela, le formulaire à corriger
  // n'est plus affiché.
  const surErreur: (q: string) => never = (q) => {
    redirect(`/admin/factures/nouvelle${q}`);
  };

  const supabase = clientAdmin();
  let dossierId = String(formulaire.get("dossier_id") ?? "").trim();

  if (!dossierId) {
    const email = String(formulaire.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) surErreur("?erreur=client");

    // Même adresse, même client : on ne crée pas un second dossier qui
    // couperait l'historique en deux.
    const { data: connu } = await supabase
      .from("dossiers")
      .select("id")
      .eq("email_normalise", email)
      .maybeSingle();

    if (connu) {
      dossierId = connu.id;
    } else {
      const { data: cree, error } = await supabase
        .from("dossiers")
        .insert({
          email,
          prenom: String(formulaire.get("prenom") ?? "").trim() || null,
          nom: String(formulaire.get("nom") ?? "").trim() || null,
          eleve_prenom: String(formulaire.get("eleve_prenom") ?? "").trim() || null,
          facturation_nom:
            String(formulaire.get("facturation_nom") ?? "").trim() || null,
          facturation_adresse:
            String(formulaire.get("facturation_adresse") ?? "").trim() || null,
        })
        .select("id")
        .single();

      if (error || !cree) {
        console.error("création client", error);
        surErreur("?erreur=client");
      }
      dossierId = cree.id;
    }
  }

  const { data: client } = await supabase
    .from("dossiers")
    .select("prenom, nom, facturation_nom, facturation_adresse, facturation_note")
    .eq("id", dossierId)
    .maybeSingle();

  // La période par défaut est le mois courant : elle n'a pas de sens
  // pour une prestation ponctuelle, mais la facture en exige une, et
  // elle reste modifiable.
  const aujourdhui = new Date();
  const debut = `${aujourdhui.getFullYear()}-${String(
    aujourdhui.getMonth() + 1
  ).padStart(2, "0")}-01`;
  const suivant = new Date(`${debut}T00:00:00Z`);
  suivant.setUTCMonth(suivant.getUTCMonth() + 1);

  const { data: facture, error } = await supabase
    .from("factures")
    .insert({
      dossier_id: dossierId,
      periode_debut: debut,
      periode_fin: suivant.toISOString().slice(0, 10),
      total_cents: 0,
      destinataire_nom:
        client?.facturation_nom ??
        `${client?.prenom ?? ""} ${client?.nom ?? ""}`.trim() ??
        null,
      destinataire_adresse: client?.facturation_adresse ?? null,
      note: client?.facturation_note ?? null,
    })
    .select("id")
    .single();

  if (error || !facture) {
    console.error("facture manuelle", error);
    surErreur("?erreur=creation");
  }

  revalidatePath("/admin/factures");
  redirect(`/admin/factures/${facture.id}/modifier?ok=nouvelle`);
}

/** Une ligne telle que l'écran d'édition la manipule. */
export type LigneVive = {
  id: string;
  description: string;
  quantite: number;
  prix_unitaire_cents: number;
  total_cents: number;
};

async function exigerBrouillon(factureId: string): Promise<void> {
  if (!(await estBrouillon(factureId))) {
    throw new Error("FACTURE_EMISE");
  }
}

/**
 * Les trois gestes de l'édition vivante.
 *
 * Chacun porte sur une ligne et rend la main tout de suite : l'écran
 * n'a rien à recharger, et le total se recalcule chez lui. Une ligne
 * ajoutée reçoit son identifiant définitif dès sa création, si bien que
 * les modifications qui suivent sont de simples mises à jour — pas de
 * réconciliation d'identifiants provisoires au retour.
 */
export async function ajouterLigneFacture(
  factureId: string,
  description: string,
  quantite: number,
  prixCents: number
): Promise<LigneVive> {
  await exigerAdmin();
  await exigerBrouillon(factureId);

  const supabase = clientAdmin();

  const { count } = await supabase
    .from("lignes_facture")
    .select("id", { count: "exact", head: true })
    .eq("facture_id", factureId);

  const total = Math.round(quantite * prixCents);

  const { data, error } = await supabase
    .from("lignes_facture")
    .insert({
      facture_id: factureId,
      description: description.slice(0, 300),
      quantite,
      prix_unitaire_cents: prixCents,
      total_cents: total,
      ordre: count ?? 0,
    })
    .select("id, description, quantite, prix_unitaire_cents, total_cents")
    .single();

  if (error || !data) {
    console.error("ajout de ligne", error);
    throw new Error("AJOUT");
  }

  revalidatePath(`/factures/${factureId}`);
  return { ...data, quantite: Number(data.quantite) };
}

export async function majLigneFacture(
  factureId: string,
  ligneId: string,
  description: string,
  quantite: number,
  prixCents: number
): Promise<number> {
  await exigerAdmin();
  await exigerBrouillon(factureId);

  const total = Math.round(quantite * prixCents);

  const { error } = await clientAdmin()
    .from("lignes_facture")
    .update({
      description: description.slice(0, 300),
      quantite,
      prix_unitaire_cents: prixCents,
      total_cents: total,
    })
    .eq("id", ligneId)
    .eq("facture_id", factureId);

  if (error) {
    console.error("mise à jour de ligne", error);
    throw new Error("MAJ");
  }

  revalidatePath(`/factures/${factureId}`);
  return total;
}

export async function retirerLigneFacture(
  factureId: string,
  ligneId: string
): Promise<void> {
  await exigerAdmin();
  await exigerBrouillon(factureId);

  const { error } = await clientAdmin()
    .from("lignes_facture")
    .delete()
    .eq("id", ligneId)
    .eq("facture_id", factureId);

  if (error) {
    console.error("retrait de ligne", error);
    throw new Error("RETRAIT");
  }

  revalidatePath(`/factures/${factureId}`);
}
