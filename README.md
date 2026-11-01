# Les cours de Pauline

Site de réservation de cours particuliers de SVT, et espace d'échange de
documents entre Pauline Mattern et ses élèves.

**Aucun paiement ne transite par le site.** On réserve un créneau, Pauline
facture les séances effectuées en fin de mois, le client règle par Wero ou par
virement sous 30 jours.

---

## Ce qui est fait, ce qui reste

| Étape | État |
| --- | --- |
| Schéma de base de données, règles de réservation, sécurité | Fait |
| Site public : accueil, tarifs, à propos | Fait |
| Pages légales | Coquilles à remplir |
| Calendrier et moteur de réservation | À faire |
| Espace élève et documents | À faire |
| Administration | À faire |
| Facturation et PDF | À faire |
| Synchronisation Google Calendar | À faire |

---

## Mise en route

### 1. Installer et lancer en local

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs, voir plus bas
npm run dev
```

Le site tourne sur <http://localhost:3000>. Les polices sont téléchargées et
auto-hébergées au moment du build : cela demande un accès réseau à Google Fonts
pendant la compilation, mais **aucune requête n'est envoyée à Google depuis le
navigateur du visiteur** — c'est volontaire, pour le RGPD.

### 2. Préparer la base Supabase

1. Créer le projet dans une **région européenne** (Francfort ou Paris).
2. Ouvrir **SQL Editor**, coller le contenu de
   `supabase/migrations/0001_schema_initial.sql`, exécuter.
3. Faire de même avec `supabase/migrations/0002_disponibilites.sql`, qui pose
   les horaires de départ : 10 h – 12 h et 14 h – 21 h, tous les jours.
4. Dans **Project Settings → API**, relever l'URL du projet, la clé `anon` et la
   clé `service_role`.

### 3. Remplir `.env.local`

| Variable | Où la trouver | Remarque |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | Publique, protégée par RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | idem | **Secrète.** Jamais de préfixe `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | Resend → API Keys | Secrète |
| `EMAIL_EXPEDITEUR` | — | `contact@lescoursdepauline.com` |
| `NEXT_PUBLIC_SITE_URL` | — | `https://lescoursdepauline.com` |

`.env.local` est dans `.gitignore` : il ne part jamais sur GitHub. Sur Vercel,
les mêmes variables se saisissent dans **Settings → Environment Variables**.

### 4. Le domaine et les emails

L'ordre compte : la vérification du domaine chez Resend doit être faite tôt, la
réputation d'un domaine d'envoi met plusieurs jours à s'établir.

1. Acheter `lescoursdepauline.com`.
2. **Garder la zone DNS hors de Vercel** (chez le registrar, ou chez
   Cloudflare). Si l'hébergement doit changer un jour, le basculement prendra
   une heure au lieu d'une journée.
3. Dans Resend, ajouter le domaine et copier les enregistrements SPF, DKIM et
   DMARC dans la zone DNS.
4. Dans Vercel, ajouter le domaine au projet et suivre les enregistrements
   indiqués.

### 5. Le compte Google

Depuis le compte Google dédié à l'activité :

1. Créer un projet sur Google Cloud Console.
2. Activer l'**API Google Calendar**.
3. Créer des identifiants **OAuth client ID**, type « Web application ».
4. Autoriser l'URI de redirection `https://lescoursdepauline.com/api/google/callback`
   et, pour le développement, `http://localhost:3000/api/google/callback`.

---

## Organisation du code

```
app/                pages (App Router)
  page.tsx          accueil
  tarifs/           grille tarifaire et règlement
  reserver/         calendrier (à construire)
  mon-espace/       espace élève (à construire)
components/         en-tête, pied, icônes
lib/
  constantes.ts     identité, groupes de niveaux, formatage des montants
  supabase.ts       les deux clients, et la traduction des erreurs de la base
supabase/migrations/
  0001_...          tables, règles, sécurité
  0002_...          horaires de départ
public/pauline.png  portrait, découpé en cercle
```

---

## Deux choses à savoir avant de toucher au code

**Les règles de réservation sont dans la base, pas dans l'application.** Le
coupe-circuit, la liste noire, le plafond hebdomadaire, la limite à un créneau
tant que l'adresse n'est pas confirmée, le délai de 24 heures : tout est
appliqué par le déclencheur `verifier_reservation()`. Un bug d'écran ou un appel
direct à l'API ne peut pas passer outre. Les codes d'erreur qu'il lève sont
traduits pour l'utilisateur dans `lib/supabase.ts`.

**Une facture validée est intouchable.** Un déclencheur refuse sa suppression et
toute modification de son numéro. C'est une obligation comptable, pas un
confort : pour annuler une facture, on crée un avoir.

---

## Exploitation

- **Supabase, plan gratuit** : le projet est mis en pause après sept jours de
  faible activité. Une tâche hebdomadaire devra interroger la base pour
  l'éviter, en particulier pendant les vacances scolaires.
- **Sauvegarde** : le plan gratuit ne propose pas d'export téléchargeable. Un
  export quotidien de la base et du stockage vers un espace séparé reste à
  mettre en place — la base contient des factures, donc des pièces comptables.
- **Vercel, plan Hobby** : ses conditions le réservent à un usage non
  commercial. Le choix est assumé pour le lancement ; le code reste portable et
  la zone DNS est gérée ailleurs pour qu'un basculement soit rapide.
