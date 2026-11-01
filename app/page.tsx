import Image from "next/image";
import Link from "next/link";
import { IDENTITE, euros, TARIFS_PAR_DEFAUT } from "@/lib/constantes";
import { IconeAgenda, IconeWhatsapp, IconeCadeau, IconeCoche } from "@/components/Icones";

const etapes = [
  {
    titre: "Vous réservez",
    texte:
      "Un créneau libre dans le calendrier, jusqu'à 24 h avant. Pas de compte à créer : il se crée tout seul.",
  },
  {
    titre: "On travaille une heure",
    texte:
      "En visio, avec ma tablette numérique en guise de tableau. On annote ensemble le chapitre, l'énoncé ou le devoir.",
  },
  {
    titre: "Les documents restent",
    texte:
      "Les supports utilisés pendant la séance sont déposés dans votre espace. Le règlement vient après, sur facture.",
  },
];

const diplomes = [
  { titre: "CAPES", precision: "depuis 2017" },
  { titre: "8 ans d'expérience", precision: "en collège et en lycée" },
  { titre: "Enseignante correctrice", precision: "du brevet et du baccalauréat" },
  { titre: "Deux masters", precision: "biologie-géologie, et enseignement" },
];

const pedagogie = [
  "Bienveillance et écoute, avant tout le reste",
  "Un vrai travail des notions scientifiques, pas du bachotage",
  "Une méthodologie calée sur les attentes réelles des examens",
  "Préparation au brevet, au contrôle continu et au bac",
];

const supports = [
  {
    titre: "Le support du cours",
    texte: "Le document travaillé et annoté pendant l'heure.",
  },
  {
    titre: "Le schéma-bilan",
    texte: "Après le cours, le chapitre tenu sur une page.",
  },
  {
    titre: "La fiche de révision",
    texte: "Les définitions et le vocabulaire exigible.",
  },
  {
    titre: "La fiche méthode",
    texte: "Comment traiter l'exercice le jour de l'épreuve.",
  },
];

export default function Accueil() {
  return (
    <>
      {/* ---------------------------------------------------------- Hero */}
      <section className="section">
        <div className="conteneur colonnes" style={{ alignItems: "center" }}>
          <div style={{ flex: "0 1 300px", minWidth: 240 }}>
            <Image
              src="/pauline.png"
              alt="Portrait de Pauline Mattern"
              width={428}
              height={428}
              priority
              style={{ width: "100%", height: "auto", borderRadius: "50%" }}
            />
          </div>

          <div style={{ flex: "1 1 440px", minWidth: 0 }}>
            <p className="surtitre">
              Cours particuliers de SVT · Collège · Lycée · Spécialité
            </p>
            <h1 style={{ fontSize: 54, lineHeight: 1.12, letterSpacing: "-0.01em" }}>
              Comprendre pour réussir <em className="accent">durablement</em>.
            </h1>
            <p className="plomb" style={{ marginTop: 24, maxWidth: 520 }}>
              Professeure certifiée de SVT, j&apos;accompagne les élèves en
              visioconférence, avec une tablette numérique pour écrire et dessiner
              comme au tableau. Les documents de travail s&apos;échangent dans un
              espace dédié entre les séances.
            </p>

            <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 14 }}>
              <Link href="/reserver" className="bouton bouton--principal">
                <IconeAgenda couleur="var(--or-clair)" />
                Réserver un créneau
              </Link>
              <a href={IDENTITE.whatsapp} className="bouton bouton--secondaire">
                <IconeWhatsapp couleur="var(--foret)" />
                Écrire sur WhatsApp
              </a>
            </div>

            <p
              style={{
                marginTop: 20,
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                fontSize: 14.5,
                color: "var(--texte-doux)",
              }}
            >
              <IconeCadeau couleur="var(--or)" />
              <span>
                <strong style={{ color: "var(--foret)" }}>Premier échange gratuit</strong>
                {" — pour faire connaissance et évaluer le niveau."}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Diplômes */}
      <section className="section--teinte" style={{ borderBottom: "1px solid var(--bordure)" }}>
        <div className="conteneur grille-4" style={{ paddingTop: 36, paddingBottom: 36 }}>
          {diplomes.map((d) => (
            <div key={d.titre}>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foret)" }}>
                {d.titre}
              </p>
              <p style={{ marginTop: 3, fontSize: 14, color: "var(--texte-doux)" }}>
                {d.precision}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ Comment ça se passe */}
      <section className="section" id="cours">
        <div className="conteneur">
          <h2 style={{ fontSize: 40, textAlign: "center", marginBottom: 52 }}>
            Comment ça se passe
          </h2>
          <div className="grille-3">
            {etapes.map((etape, i) => (
              <div key={etape.titre} style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontFamily: "var(--serif)",
                    fontSize: 34,
                    fontStyle: "italic",
                    color: "var(--or)",
                    marginBottom: 14,
                  }}
                >
                  {i + 1}
                </p>
                <h3 style={{ fontSize: 22, marginBottom: 10 }}>{etape.titre}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--texte-doux)" }}>
                  {etape.texte}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Pédagogie */}
      <section className="section section--teinte">
        <div className="conteneur colonnes" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 400px", minWidth: 0 }}>
            <p className="surtitre">Ma pédagogie</p>
            <h2 style={{ fontSize: 40, lineHeight: 1.15, marginBottom: 28 }}>
              Les notions d&apos;abord, la méthode ensuite
            </h2>
            <ul style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {pedagogie.map((point) => (
                <li key={point} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <IconeCoche couleur="var(--or)" />
                  <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--texte-doux)" }}>
                    {point}
                  </p>
                </li>
              ))}
            </ul>
            <p
              style={{
                marginTop: 28,
                fontFamily: "var(--serif)",
                fontSize: 22,
                fontStyle: "italic",
                color: "var(--foret)",
              }}
            >
              « Comprendre pour réussir durablement. »
            </p>
          </div>

          <div className="carte" style={{ flex: "1 1 340px", minWidth: 0 }}>
            <h3 style={{ fontSize: 26, marginBottom: 8 }}>Ce que vous recevez</h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--texte-doux)", marginBottom: 24 }}>
              D&apos;abord le support de la séance. Les fiches arrivent ensuite,
              déposées sur le compte de l&apos;élève.
            </p>
            <ul>
              {supports.map((s) => (
                <li
                  key={s.titre}
                  style={{ padding: "16px 0", borderTop: "1px solid var(--bordure-douce)" }}
                >
                  <p style={{ fontSize: 15.5, fontWeight: 600, color: "var(--foret)" }}>
                    {s.titre}
                  </p>
                  <p
                    style={{
                      marginTop: 3,
                      fontSize: 14.5,
                      lineHeight: 1.55,
                      color: "var(--texte-doux)",
                    }}
                  >
                    {s.texte}
                  </p>
                </li>
              ))}
            </ul>
            <p
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid var(--bordure-douce)",
                fontSize: 14.5,
                lineHeight: 1.6,
                color: "var(--texte-doux)",
              }}
            >
              Dans l&apos;autre sens, l&apos;élève dépose ce qu&apos;il veut me
              montrer : un énoncé, un devoir, la photo d&apos;une copie.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- Tarifs */}
      <section className="section">
        <div className="conteneur-etroit">
          <h2 style={{ fontSize: 40, textAlign: "center", marginBottom: 14 }}>Tarifs</h2>
          <p
            className="plomb"
            style={{ textAlign: "center", maxWidth: 520, margin: "0 auto 44px" }}
          >
            Deux niveaux de tarif, et une réduction pour un suivi régulier. Rien à
            payer sur le site.
          </p>

          <div className="tableau-enveloppe">
            <div className="tableau-defilant">
              <table className="tarifs">
                <thead>
                  <tr>
                    <th scope="col">Niveau</th>
                    <th scope="col">À la séance</th>
                    <th scope="col">Suivi régulier</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Collège et seconde</td>
                    <td>{euros(TARIFS_PAR_DEFAUT[0].seance)}</td>
                    <td>{euros(TARIFS_PAR_DEFAUT[0].regulier)}</td>
                  </tr>
                  <tr>
                    <td>Première et terminale</td>
                    <td>{euros(TARIFS_PAR_DEFAUT[1].seance)}</td>
                    <td>{euros(TARIFS_PAR_DEFAUT[1].regulier)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ marginTop: 22, fontSize: 14, color: "var(--texte-gris)" }}>
            Les cours en visio n&apos;ouvrent pas droit au crédit d&apos;impôt de
            50 %, qui ne concerne que les cours à domicile.{" "}
            <Link href="/tarifs">Le détail ici</Link>.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- À propos */}
      <section className="section section--teinte" id="a-propos">
        <div className="conteneur-etroit">
          <p className="surtitre">À propos</p>
          <h2 style={{ fontSize: 40, lineHeight: 1.15 }}>Pauline Mattern</h2>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--texte-gris)",
            }}
          >
            Professeure certifiée de sciences de la vie et de la Terre
          </p>

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <p className="plomb" style={{ lineHeight: 1.75 }}>
              J&apos;enseigne les SVT depuis huit ans. J&apos;ai obtenu le CAPES en
              2017, après un master de biologie-géologie et un master métiers de
              l&apos;enseignement et de l&apos;éducation.
            </p>
            <p className="plomb" style={{ lineHeight: 1.75 }}>
              Chaque année, je corrige les épreuves du brevet et du baccalauréat.
              C&apos;est ce qui m&apos;a le plus appris sur ce qui fait réellement
              gagner des points : rarement la quantité de connaissances, presque
              toujours la façon de les organiser et de les rédiger.
            </p>
            <p className="plomb" style={{ lineHeight: 1.75 }}>
              En cours particulier, je commence par les notions. Un élève qui a
              compris le mécanisme n&apos;a plus besoin de retenir le schéma par
              cœur : il sait le reconstruire. La méthode vient ensuite, calée sur
              les attentes de l&apos;examen qu&apos;il prépare — brevet, contrôle
              continu ou baccalauréat.
            </p>
            <p className="plomb" style={{ lineHeight: 1.75 }}>
              Je travaille en visioconférence, avec une tablette numérique qui me
              sert de tableau : on écrit, on annote et on dessine ensemble, comme en
              présentiel. Le support de la séance reste ensuite dans l&apos;espace
              de l&apos;élève.
            </p>
            <p className="plomb" style={{ lineHeight: 1.75 }}>
              Le premier échange est gratuit et sans engagement. Il sert à faire
              connaissance, à cerner les difficultés et à décider ensemble d&apos;un
              rythme de travail.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="section--foret">
        <div className="conteneur-etroit" style={{ padding: "70px 32px", textAlign: "center" }}>
          <p className="surtitre" style={{ color: "var(--or-clair)" }}>
            Premier échange gratuit
          </p>
          <h2 style={{ fontSize: 44, lineHeight: 1.15, color: "#fff" }}>
            Prêt à <em className="accent" style={{ color: "var(--or-clair)" }}>progresser</em>{" "}
            en SVT ?
          </h2>
          <p
            style={{
              margin: "22px auto 34px",
              maxWidth: 520,
              fontSize: 16.5,
              lineHeight: 1.65,
              color: "var(--vert-pale)",
            }}
          >
            Réservez un créneau, ou écrivez-moi d&apos;abord. On fait connaissance,
            on évalue le niveau, et on définit ensemble un rythme de travail.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
            <Link href="/reserver" className="bouton bouton--or">
              <IconeAgenda couleur="var(--foret)" />
              Réserver un créneau
            </Link>
            <a href={IDENTITE.whatsapp} className="bouton bouton--sur-foret">
              <IconeWhatsapp couleur="var(--or-clair)" />
              {IDENTITE.telephoneAffiche}
            </a>
          </div>
          <p style={{ marginTop: 26, fontSize: 15, color: "var(--vert-pale)" }}>
            ou par mail :{" "}
            <a href={`mailto:${IDENTITE.email}`} style={{ color: "var(--or-clair)" }}>
              {IDENTITE.email}
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
