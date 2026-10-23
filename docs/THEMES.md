# Ambiances Toc Toc - 23 octobre 2026

Demande Jonathan : garder un tapis de cartes classique et proposer des univers plus cohérents avec la charte LueurVivante, notamment une ambiance Galaxie. Références : `docs/BRAND.md` et page 6 de `docs/brand/LUEURVIVANTE_CHARTE.pdf` (contrastes, profondeur, grilles, énergie graphique). Les références externes du moodboard ne sont pas copiées dans le jeu.

## Ambiances principales

| Nom | Identifiant stable | Traitement |
|---|---|---|
| Tapis casino | `forest` | Tapis vert et cartes ivoire existants ; reste le choix par défaut. |
| LueurVivante | `signature` | Noir chaud, halo orange discret, accents orange et jaune doux de la charte. |
| Galaxie | `galaxy` | Fond de nuit, étoiles statiques discrètes, profondeur et accents lumineux. |
| Impulsion | `impulse` | Graphite, grille fine et diagonales orange ; inspiration graphique et mouvement sans animation ajoutée. |

Les ambiances Bleu nuit (`midnight`), Améthyste (`amethyst`), Velours (`burgundy`), Club ambré (`amber`) restent disponibles dans « Autres ambiances ». Aucun identifiant ancien n’est supprimé ni réaffecté. Renommer Forêt en Tapis casino ne change pas son rendu ni les salles existantes.

## Comportement

Le choix de l’organisateur s’applique à toute la table, comme avant. Les miniatures donnent un aperçu et le décor de préparation change immédiatement. Les ambiances sont une préférence visuelle de salle : aucune modification des règles, points, distributions, délais, pouvoirs ou présences. L’accueil conserve l’identité noire/flamme choisie indépendamment du tapis.

Les décors sont des dégradés CSS statiques, sans canvas, image distante ou animation de fond. Aucun calque ne masque les cartes ni ne capture de toucher. Les motifs restent en arrière-plan ; les cartes et actions gardent leur géométrie. Les couleurs de joueurs et alertes restent sémantiques, distinctes des accents de marque.

## Vérification

`npm test` passe. Le test moteur lance une table pour chaque ambiance principale et vérifie la transmission du thème, la phase, les joueurs et une distribution de quatre cartes inchangée. La normalisation continue d’accepter toutes les ambiances anciennes.

Navigateur local : chaque nouvelle ambiance prévisualisée ; sélecteur vérifié à 375×720, sans débordement horizontal et avec le bouton Créer visible. Table Galaxie créée avec un bot, mémorisation confirmée et pioche exécutée ; cartes de soi/adversaire et actions visibles sur ce format. Il s’agit d’un format mobile émulé, pas d’un appareil physique. Capture locale : `/tmp/toctoc-galaxy-mobile.png`.
