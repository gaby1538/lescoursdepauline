"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { preparerDepot, finaliserDepot } from "./actions";
import ChoixEleves, { type EleveChoisissable } from "./ChoixEleves";
import { etiquette } from "@/components/Champs";

const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic"];
const TAILLE_MAX = 25 * 1024 * 1024;

const MESSAGES: Record<string, string> = {
  type: "Formats acceptés : PDF, JPEG, PNG ou HEIC.",
  taille: "Le fichier dépasse 25 Mo.",
  fichier: "Choisissez un fichier.",
  dossier: "Choisissez au moins un élève.",
  trop: "Quarante élèves au maximum pour un même envoi.",
  preparation: "Le stockage n'a pas répondu. Le dépôt est-il bien créé dans Supabase ?",
  televersement: "Le transfert a été interrompu. Réessayez.",
  depot: "Le fichier est arrivé mais n'a pas pu être rangé. Réessayez.",
  chemin: "Dépôt refusé.",
};

function poids(octets: number): string {
  return octets >= 1024 * 1024
    ? `${(octets / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/**
 * Le fichier monte directement vers le stockage, par une adresse signée
 * que le serveur délivre après vérification. Il ne traverse pas le
 * site : au-delà de 4,5 Mo, Vercel refusait la requête et la page
 * tombait en erreur sans rien expliquer.
 */
export default function DepotDocument({
  eleves,
  dossierId,
  titre,
}: {
  eleves?: EleveChoisissable[];
  dossierId?: string;
  titre: string;
}) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);

  const [fichier, setFichier] = useState<File | null>(null);
  const [coches, setCoches] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [avancement, setAvancement] = useState<number | null>(null);
  const [prevenir, setPrevenir] = useState(false);

  const destinataires = dossierId ? [dossierId] : coches;
  const occupe = avancement !== null;

  function choisirFichier(f: File | null) {
    setSucces(null);
    setErreur(null);
    if (!f) return setFichier(null);
    if (!TYPES.includes(f.type)) {
      setFichier(null);
      return setErreur(MESSAGES.type);
    }
    if (f.size > TAILLE_MAX) {
      setFichier(null);
      return setErreur(`${MESSAGES.taille} Le vôtre fait ${poids(f.size)}.`);
    }
    setFichier(f);
  }

  function televerser(url: string, f: File): Promise<void> {
    return new Promise((resoudre, rejeter) => {
      const requete = new XMLHttpRequest();
      requete.open("PUT", url, true);
      requete.setRequestHeader("content-type", f.type);
      requete.upload.onprogress = (e) => {
        if (e.lengthComputable) setAvancement(Math.round((e.loaded / e.total) * 100));
      };
      requete.onload = () =>
        requete.status >= 200 && requete.status < 300
          ? resoudre()
          : rejeter(new Error(String(requete.status)));
      requete.onerror = () => rejeter(new Error("réseau"));
      requete.send(f);
    });
  }

  async function envoyer() {
    setErreur(null);
    setSucces(null);

    if (!fichier) return setErreur(MESSAGES.fichier);
    if (destinataires.length === 0) return setErreur(MESSAGES.dossier);

    setAvancement(0);
    try {
      const preparation = await preparerDepot({
        nom: fichier.name,
        type: fichier.type,
        taille: fichier.size,
      });
      if (!preparation.ok) {
        setAvancement(null);
        return setErreur(MESSAGES[preparation.erreur] ?? "Dépôt impossible.");
      }

      await televerser(preparation.url, fichier);

      const resultat = await finaliserDepot({
        chemin: preparation.chemin,
        dossierIds: destinataires,
        nom: fichier.name,
        type: fichier.type,
        taille: fichier.size,
        prevenir,
      });

      setAvancement(null);

      if (resultat.erreur) {
        return setErreur(MESSAGES[resultat.erreur] ?? "Dépôt impossible.");
      }

      const avertis = prevenir
        ? resultat.prevenus === resultat.deposes
          ? " Chacun en a été averti par email."
          : ` ${resultat.prevenus} sur ${resultat.deposes} ont été avertis par email.`
        : "";

      setSucces(
        (resultat.deposes > 1
          ? `Document déposé pour ${resultat.deposes} élèves.`
          : "Document déposé.") + avertis
      );
      setFichier(null);
      setCoches([]);
      setPrevenir(false);
      if (champ.current) champ.current.value = "";
      router.refresh();
    } catch {
      setAvancement(null);
      setErreur(MESSAGES.televersement);
    }
  }

  return (
    <div className="carte">
      <p className="surtitre" style={{ marginBottom: 16 }}>
        {titre}
      </p>

      {eleves ? (
        <div style={{ marginBottom: 18 }}>
          <p style={etiquette}>Pour qui</p>
          <ChoixEleves eleves={eleves} coches={coches} onChange={setCoches} />
        </div>
      ) : null}

      <label htmlFor="fichier" style={etiquette}>
        Fichier
      </label>
      <input
        ref={champ}
        id="fichier"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic"
        disabled={occupe}
        onChange={(e) => choisirFichier(e.target.files?.[0] ?? null)}
        className="depot__champ"
      />
      <p style={{ marginTop: 7, fontSize: 13, color: "var(--texte-gris)" }}>
        PDF, JPEG, PNG ou HEIC. 25 Mo au maximum.
        {fichier ? ` Choisi : ${fichier.name}, ${poids(fichier.size)}.` : ""}
      </p>

      <label className="case-a-cocher">
        <input
          type="checkbox"
          checked={prevenir}
          disabled={occupe}
          onChange={(e) => setPrevenir(e.target.checked)}
        />
        <span>
          Prévenir par email
          <span className="case-a-cocher__aide">
            Un message annonçant le document et renvoyant vers l&apos;espace élève.
            Laissé décoché, rien n&apos;est envoyé — le document apparaît simplement
            dans l&apos;espace.
          </span>
        </span>
      </label>

      {avancement !== null && (
        <div className="depot__jauge" aria-live="polite">
          <div className="depot__jauge-barre" style={{ width: `${avancement}%` }} />
          <span>{avancement < 100 ? `Transfert ${avancement} %` : "Rangement…"}</span>
        </div>
      )}

      {erreur && <p className="alerte">{erreur}</p>}
      {succes && <p className="succes">{succes}</p>}

      <button
        type="button"
        onClick={envoyer}
        disabled={occupe || !fichier || destinataires.length === 0}
        className="bouton bouton--principal"
        style={{ marginTop: 18, width: "100%", opacity: occupe ? 0.6 : 1 }}
      >
        {occupe ? "Dépôt en cours…" : "Déposer"}
      </button>
    </div>
  );
}
