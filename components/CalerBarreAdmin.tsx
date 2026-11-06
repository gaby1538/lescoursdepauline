"use client";

import { useEffect } from "react";

/**
 * La barre d'administration se colle sous l'en-tête du site. Sa hauteur
 * dépend de la police chargée, du zoom et du repli de la navigation :
 * une valeur écrite en dur finit toujours par être fausse, et la barre
 * disparaît alors à moitié derrière l'en-tête. On la mesure.
 */
export default function CalerBarreAdmin() {
  useEffect(() => {
    const entete = document.querySelector<HTMLElement>(".entete");
    if (!entete) return;

    const poser = () =>
      document.documentElement.style.setProperty(
        "--hauteur-entete",
        `${Math.round(entete.getBoundingClientRect().height)}px`
      );

    poser();
    const observateur = new ResizeObserver(poser);
    observateur.observe(entete);
    window.addEventListener("resize", poser);

    return () => {
      observateur.disconnect();
      window.removeEventListener("resize", poser);
    };
  }, []);

  return null;
}
