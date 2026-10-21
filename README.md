# Toc Toc 9

Jeu de cartes multijoueur : mémoire, audace et bluff. Mêmes règles que Toc Toc 8 (version du 21 octobre 2026), nouveau moteur en ligne.

## Ce qui change par rapport à Toc Toc 8

| | Toc Toc 8 | Toc Toc 9 |
|---|---|---|
| Où tournent les règles | Dans le navigateur de l'organisateur | Sur un serveur Cloudflare, une salle = un serveur |
| Trajet d'un coup | Joueur → Firebase → organisateur → Firebase → joueur | Joueur ↔ serveur, en direct (WebSocket) |
| Organisateur en veille | La partie se fige | Aucun effet, le serveur continue |
| Cartes des autres | Présentes dans Firebase, lisibles avec les outils du navigateur | Jamais envoyées : chaque joueur ne reçoit que sa main |
| Double appui | Possible, actions rejetées en silence | Écran verrouillé jusqu'à la réponse (≈ 0,1 s), plus de double envoi |

Les règles ne sont pas recopiées : `build.mjs` génère le moteur serveur à partir du script de `public/index.html`. Client et serveur exécutent donc le même code de règles.

## Structure

- `public/index.html` — l'interface (inchangée hors connexion réseau).
- `public/net.js` — connexion au serveur, remplace Firebase.
- `src/worker.js` — le serveur de salle (Durable Object) : règles, bots, chronos, présence, filtrage des données.
- `src/store.js` — petite base en mémoire compatible avec le moteur.
- `build.mjs` — génère `src/engine.gen.js` (non versionné).

## Lancer en local

```sh
npm install
npx wrangler dev
```

Ouvrir http://127.0.0.1:8787/?profil=a et http://127.0.0.1:8787/?profil=b pour deux joueurs.

## Publier

Dans le tableau de bord Cloudflare : Workers et Pages → Créer → Importer un dépôt GitHub → `toctoc9`. Commande de déploiement : `npx wrangler deploy`. Chaque envoi sur GitHub republie le jeu.

## Vérifications

```sh
npm test                     # règles (324 distributions) + moteur serveur
python3 tests/e2e_partie.py  # partie complète à 2 humains + 1 bot, contrôle des fuites
python3 tests/e2e_reprise.py # rechargement en pleine partie, départ de l'organisateur
```

Les tests navigateur visent `http://127.0.0.1:8787/` (serveur local lancé).
