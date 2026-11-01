type Props = { couleur?: string; taille?: number };

export function IconeAgenda({ couleur = "currentColor", taille = 17 }: Props) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="13" height="12" rx="2" stroke={couleur} strokeWidth="1.4" />
      <path d="M2.5 7.5h13M6.5 2v3M11.5 2v3" stroke={couleur} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconeWhatsapp({ couleur = "currentColor", taille = 17 }: Props) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.6 15.4 3.7 12a6.4 6.4 0 1 1 2.4 2.3l-3.5 1.1Z"
        stroke={couleur}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconeEnveloppe({ couleur = "currentColor", taille = 17 }: Props) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="4" width="13" height="10" rx="1.6" stroke={couleur} strokeWidth="1.4" />
      <path d="m3 5 6 4.5L15 5" stroke={couleur} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeCadeau({ couleur = "currentColor", taille = 17 }: Props) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="6.5" width="13" height="9" rx="1.5" stroke={couleur} strokeWidth="1.3" />
      <path
        d="M2.5 9.5h13M9 6.5v9M9 6.5S7.6 3 5.9 3a1.8 1.8 0 0 0 0 3.5H9Zm0 0s1.4-3.5 3.1-3.5a1.8 1.8 0 0 1 0 3.5H9Z"
        stroke={couleur}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconeCoche({ couleur = "currentColor", taille = 18 }: Props) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      style={{ flex: "0 0 auto", marginTop: 4 }}
    >
      <path
        d="M4 10.5 8 14.5 16 5.5"
        stroke={couleur}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
