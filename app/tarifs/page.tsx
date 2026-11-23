import { redirect } from "next/navigation";

/**
 * L'ancienne page des tarifs.
 *
 * Le site ne publie plus de montants : ils se fixent avec chaque
 * famille, selon le niveau et le rythme. La page n'a donc plus d'objet,
 * mais l'adresse a pu circuler — dans un message, sur un papier — et
 * une redirection vaut mieux qu'une page d'erreur.
 */
export default function Tarifs() {
  redirect("/reserver");
}
