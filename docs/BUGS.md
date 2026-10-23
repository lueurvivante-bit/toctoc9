# Journal des bugs Toc Toc

Une entrée distingue signalement, reproduction et preuve de correction. Ne jamais
noter des mains, noms, jetons ou informations d’élèves.

| ID | Signalement | État et preuve |
|---|---|---|
| B001 | Mémorisation recouverte par son bouton (capture du 22/10) | Corrigé 33800dd ; régression structurelle dans rules.cjs. |
| B002 | Pioche parfois impossible, partie bloquée | Signalé le 23/10 ; non reproduit dans dix simulations moteur complètes avec redémarrages. Ne pas prétendre le bug exact résolu. |
| B003 | Impossible de mémoriser/confirmer ou lancer après relance | Signalé le 23/10 ; moteur : transitions validées, cause exacte sur téléphone encore à confirmer. Bouton indique désormais le nombre de cartes restant à regarder. |
| B004 | Écriture sans ACK ou réservation d’identité sans réponse : promesse indéfinie | Reproduit avec transport simulé. Délai de 8 s, rejet explicite, verrou retiré et message visible ; test network.cjs. |
| B005 | Refus/erreur serveur seulement en console, verrou jusqu’à une nouvelle vue | Erreurs journalisées, état explicite, verrou retiré sur ACK/refus et reconnexion sur erreur serveur. Tests refus/déconnexion. |
| B006 | Prendre jugé contre une défausse qui a changé pendant la latence (pénalité et tour sauté injustes) ; appuis répétés pénalisés plusieurs fois | Signalé le 23/10 en partie réelle à deux navigateurs. snap/take portent la carte de défausse affichée (`top`) : si elle a changé, refus « Trop tard : la défausse a changé » sans pénalité, message pour ce joueur seul. Même joueur, même carte de main, même défausse : une seule pénalité. Verrou client tant que la prise attend l’ACK. Sans `top`, comportement inchangé. Tests rules.cjs et engine.mjs. Non déployé, non vérifié en partie réelle. |

## Collecte locale

`tocBugJournal()` renvoie au maximum 100 événements persistés localement sous
`toc9-bugs-v1` : date, catégorie et type d’action uniquement. Aucun envoi distant.
Une demande expirée est retirée de la file ; aucune action expirée n’est rejouée
automatiquement. Le coup peut avoir été reçu : regarder l’état avant de réessayer.
Les erreurs de stockage du journal ne bloquent pas le jeu.

## Bilan du 23 octobre 2026

`npm test` : tests existants, 10 simulations (2/3/4 joueurs, 4/5/6 cartes, quotas
0/1/2), chacune terminée puis rejouée jusqu’à la fin ; changements de manche,
figures, pioches, défausses et TOC. Transport simulé : succès, refus, coupure,
ACK absent et réservation sans réponse. Ce sont des tests moteur/transport,
pas dix parties jouées dans Safari sur un iPhone réel.

Pour B002/B003 : relever heure, action, phase, taille d’écran et journal local ;
reproduire avec deux clients WebSocket et vérifier l’action attendue côté serveur.

## Audit navigateur réel du 23 octobre

Dix parties complètes avec deux clients connectés au serveur public et deux
identités distinctes, sans bot, neuf redémarrages. Viewports contrôlés : hôte
390×720, invité 260×540. B002/B003 non reproduits pendant cette campagne ;
ne pas les fermer comme résolus universellement. Aucun avertissement/erreur
console observé. Preuves : browser-audit-20261023/report.json et captures.

B006 — Reproduit sur l’écran de fin : les deux totaux dépassent la limite,
le plus petit gagne selon la règle existante, mais le verdict indique que
tous sont éliminés. Corrigé dans le texte de finishRound/renderOver ; résultat
et élimination inchangés. Test de régression : 33 contre 43, limite 30.
