import { IDENTITE } from "@/lib/constantes";

/**
 * On réaffiche l'adresse servie. Elle n'apprend rien à qui vient de la
 * taper, mais elle rend visible la faute de frappe — sinon la personne
 * attend un message parti ailleurs.
 */
export default function EmailEnvoye({
  adresse,
  retour,
}: {
  adresse: string;
  retour: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <p className="surtitre" style={{ marginBottom: 10 }}>
        Message envoyé
      </p>

      <p
        style={{
          fontFamily: "var(--serif)",
          fontSize: 21,
          lineHeight: 1.35,
          color: "var(--foret)",
          wordBreak: "break-word",
        }}
      >
        {adresse}
      </p>

      <p
        style={{
          margin: "16px auto 0",
          fontSize: 14.5,
          lineHeight: 1.65,
          color: "var(--texte-doux)",
        }}
      >
        Ouvrez le lien qu&apos;il contient pour choisir votre mot de passe. Si rien
        n&apos;arrive d&apos;ici quelques minutes, regardez dans les indésirables.
      </p>

      <p
        style={{
          margin: "18px auto 0",
          paddingTop: 16,
          borderTop: "1px solid var(--bordure-douce)",
          fontSize: 13.5,
          lineHeight: 1.7,
          color: "var(--texte-gris)",
        }}
      >
        Ce n&apos;est pas la bonne adresse ? <a href={retour}>Recommencez</a> avec la
        bonne. Un souci qui dure :{" "}
        <a href={`mailto:${IDENTITE.email}`}>{IDENTITE.email}</a>.
      </p>
    </div>
  );
}
