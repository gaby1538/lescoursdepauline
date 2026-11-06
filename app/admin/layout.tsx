import type { Metadata } from "next";
import Link from "next/link";
import { exigerAdmin } from "@/lib/admin";
import { seDeconnecter } from "@/app/compte/actions";
import CalerBarreAdmin from "@/components/CalerBarreAdmin";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

const LIENS = [
  { href: "/admin", libelle: "Tableau de bord" },
  { href: "/admin/horaires", libelle: "Horaires" },
  { href: "/admin/eleves", libelle: "Élèves" },
  { href: "/admin/documents", libelle: "Documents" },
  { href: "/admin/factures", libelle: "Factures" },
  { href: "/admin/reglages", libelle: "Réglages" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await exigerAdmin();

  return (
    <>
      <CalerBarreAdmin />
      <div className="admin__barre">
        <div className="conteneur admin__barre-contenu">
          <nav className="admin__nav">
            {LIENS.map((lien) => (
              <Link key={lien.href} href={lien.href}>
                {lien.libelle}
              </Link>
            ))}
          </nav>
          <div className="admin__compte">
            <span>{email}</span>
            <form action={seDeconnecter}>
              <button type="submit" className="lien-bouton">
                quitter
              </button>
            </form>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
