# Galaxie par défaut et partie sans défilement — 23 octobre 2026

Demande Jonathan : Galaxie par défaut partout ; le choix de l’organisateur habille toujours toute la table. Cartes et actions doivent tenir dans le même écran, même après pioche et pendant un pouvoir.

## Cause et correction

Reproduction dans le navigateur à 375×667 : la zone d’actions faisait 160 px, mais son contenu atteignait 257 px en cumulant pioche, absence, mode Prendre et résultat de pénalité. `overflow:auto` imposait un défilement. L’ancien ajustement ne concernait que les cartes.

La partie dispose maintenant de deux régions bornées : table et commandes. Chacune ajuste son contenu à son espace et à la hauteur du viewport visuel. La hauteur réservée aux actions reste stable pendant pioche/pouvoir ; les notifications de présence restent avec la table. La page et les régions de jeu ne défilent plus. Les boutons Piocher/TOC/Prendre utilisent trois colonnes sans largeur minimale débordante. En paysage court, table et commandes sont côte à côte. Les récapitulatifs de réglages sont masqués pendant la partie pour libérer la place ; les réglages restent consultables avant de jouer. Aux résultats, Manche suivante/Rejouer restent hors de la région réduite.

La normalisation utilise `galaxy` lorsque le thème est absent ou inconnu. Le premier rendu et l’accueil utilisent aussi Galaxie. Les thèmes explicitement choisis et les salles existantes sont conservés. Aucun changement de règles, délais de pouvoirs, réseau, routage, données ou moteur des salles hors défaut visuel.

## Contrôles réalisés

- `npm test` : règles, moteur, 10 simulations avec redémarrage, présence, réseau et cycle des salles passent. Assertions ajoutées pour le défaut Galaxie et la transmission du thème absent ; les choix explicites restent acceptés.
- Navigateur : 90 scènes synthétiques du rendu réel, sans connexion ni données de joueurs. Formats 320×568, 375×667, 430×800, 667×375, 1280×720 ; 2 joueurs/4 cartes et 10 joueurs/12 cartes (charge de pénalités). Scènes : mémorisation, pioche, pioche + présence/pénalité/Prendre, proposition de pouvoir, choix Roi, choix Valet, carte regardée, révélation, fin de partie. Mesure des rectangles des cartes/boutons : aucun hors du viewport ni coupé par ses régions parentes ; aucun défilement de la page. Le contrôle a également détecté puis permis de corriger le débordement horizontal des commandes en paysage.
- Partie locale connectée avec un bot : Galaxie sélectionnée par défaut, mémorisation puis validation, pioche, échange déclenchant une Dame, activation du pouvoir, choix des deux cartes et passage au bot. Vérification au format 375×667, sortie confirmée ensuite. Capture `/tmp/toctoc-fixed-screen-mobile.png`.
- Banc local reproductible : `node tests/layout-preview.mjs`, puis `http://127.0.0.1:8138/?scene=crowded&players=10&cards=12`. Il emploie le véritable HTML/rendu avec des données fictives et un transport neutralisé. Il ne doit jamais être déployé dans `public/` ni décrit comme une partie humaine.

Limite : émulation navigateur, pas essais sur appareils iOS/Android physiques. Une table avec beaucoup de joueurs/cartes réduit nécessairement les cartes ; les commandes de résultat restent à taille normale. Contrôler sur les téléphones utilisés en séance, notamment avec la barre du navigateur affichée/masquée et au retour d’arrière-plan.

## Publication

À compléter après déploiement et vérification de l’adresse officielle.
