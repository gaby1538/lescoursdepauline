import Link from "next/link";

const liens = [
  { href: "/#cours", libelle: "Les cours" },
  { href: "/tarifs", libelle: "Tarifs" },
  { href: "/#a-propos", libelle: "À propos" },
  { href: "/mon-espace", libelle: "Mon espace" },
];

export default function Entete() {
  return (
    <header className="entete">
      <div className="conteneur entete__barre">
        <Link href="/" className="logo">
          <span className="logo__nom">
            Les cours de <span>Pauline</span>
          </span>
          <span className="logo__matiere">SVT</span>
        </Link>

        <nav className="nav">
          {liens.map((lien) => (
            <Link key={lien.href} href={lien.href}>
              {lien.libelle}
            </Link>
          ))}
          <Link href="/reserver" className="bouton bouton--blanc bouton--compact">
            Réserver
          </Link>
        </nav>
      </div>
    </header>
  );
}
