import type React from "react";

export const etiquette: React.CSSProperties = {
  display: "block",
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--foret)",
  marginBottom: 7,
};

export const saisie: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 46,
  padding: "0 14px",
  border: "1px solid var(--bordure)",
  borderRadius: 4,
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 15,
  color: "var(--texte)",
};

export function Champ({
  nom,
  libelle,
  type = "text",
  requis = false,
  aide,
  defaut,
  autoComplete,
}: {
  nom: string;
  libelle: string;
  type?: string;
  requis?: boolean;
  aide?: string;
  defaut?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={nom} style={etiquette}>
        {libelle}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        required={requis}
        placeholder={aide}
        defaultValue={defaut}
        autoComplete={
          autoComplete ??
          (nom === "email" ? "email" : nom === "telephone" ? "tel" : undefined)
        }
        style={saisie}
      />
    </div>
  );
}

export function ChampClasse({
  classes,
  defaut,
}: {
  classes: readonly string[];
  defaut?: string;
}) {
  return (
    <div>
      <label htmlFor="classe" style={etiquette}>
        Classe de l&apos;élève
      </label>
      <select
        id="classe"
        name="classe"
        required
        defaultValue={defaut ?? ""}
        style={{ ...saisie, padding: "0 12px" }}
      >
        <option value="">Choisir une classe</option>
        {classes.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Alerte({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="alerte">
      {children}
    </p>
  );
}
