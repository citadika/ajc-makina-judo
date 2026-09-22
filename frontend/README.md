# JudoCard — Frontend (React + TypeScript)

Application de gestion des cartes de membre du club de judo **AJC MAKINA**
(RDC). Reconstruction fidèle, en React 19 + TypeScript + Vite, de
l'application Angular d'origine — même maquette, mêmes écrans, mêmes
comportements.

## Démarrage

```bash
npm install
npm run dev
```

L'application démarre sur `http://localhost:5173`. Elle nécessite le
backend FastAPI démarré sur `http://localhost:8000` : le serveur de
développement Vite relaie automatiquement tout ce qui commence par
`/api` ou `/uploads` vers ce backend (voir `vite.config.ts`), exactement
comme le faisait `proxy.conf.json` côté Angular — évite tout souci de
CORS entre les deux ports.

Le frontend n'appelle jamais `http://localhost:8000` en dur : toutes les
requêtes utilisent des chemins relatifs (`/api/...`, `/uploads/...`).

## Production

```bash
npm run build
```

Compile le TypeScript (`tsc -b`) puis produit le bundle de production
dans `dist/` via Vite. `npm run preview` sert ensuite ce build
localement.

## Identifiants par défaut

Compte administrateur créé automatiquement au premier démarrage du
backend :

- Utilisateur : `admin`
- Mot de passe : `Admin@123`

## Structure

```
src/
  api/          Client HTTP (axios) + un module par ressource backend
  components/   AppShell (coquille applicative partagée : sidebar, nav)
  context/      AuthContext (session utilisateur, persistée en localStorage)
  hooks/        useAutoRefresh (actualisation périodique des pages)
  pages/        Un dossier par écran (composant + CSS)
  routes/       ProtectedRoute (session requise) / AdminRoute (rôle ADMIN requis)
  styles/       global.css — design tokens, polices, classes partagées
  types/        Interfaces TypeScript portées des modèles Angular
```

## Écrans

- **Connexion** (`/login`, publique)
- **Tableau de bord** (`/dashboard`)
- **Adhérents** (`/members`) — recherche, filtres, création/modification/
  suppression, activation/désactivation
- **Carte de membre** (`/members/:id/card`) — recto/verso, QR code
- **Historique des ceintures** (`/members/:id/belt-history`)
- **Vérification** (`/verification`) — contrôle d'une carte au poste
  d'accueil
- **Utilisateurs** (`/users`, réservé au rôle ADMIN)
- **Paramètres du club** (`/settings`, lecture ouverte à tout utilisateur
  connecté ; enregistrement réservé à l'ADMIN côté backend)

## Simplifications par rapport à la version Angular

- **Recadrage de photo** : la version Angular propose un recadrage
  interactif (zoom/déplacement sur canvas, ngx-image-cropper-like) avant
  l'envoi de la photo d'un adhérent. Cette version React utilise un
  simple champ de téléversement de fichier (mêmes contraintes de format
  et de taille), sans étape de recadrage.
