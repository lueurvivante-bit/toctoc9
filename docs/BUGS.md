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
| B009 | Joueur parti ~1 min (téléphone en veille, message envoyé) : à son retour, mémorisation faite et plusieurs tours joués pour lui ; créateur revenu bloqué sur « En attente de l’organisateur… » | Corrigé : un humain absent n’est plus joué par un bot. Détail ci-dessous ; test absence.mjs. |
| B007 | Partie réelle à deux navigateurs (23/10) : après une coupure, trois échanges sans ACK, l’indicateur reste « connecté », chaque coup expire, plus rien ne passe ; un simple rechargement débloque (le serveur avait l’état d’avant le coup et l’accepte aussitôt). Piste probable pour B002. | Cause : prise WebSocket ouverte mais muette ; l’expiration de l’ACK retirait l’écriture sans jamais remplacer la prise. Correctif net.js : ACK expiré → prise abandonnée et reconnexion (hello, vue complète) ; action expirée jamais rejouée ; écriture hors action (mémorisation) gardée et renvoyée une fois, puis rejet borné ; vigie ping/pong si le serveur l’annonce (15 s sans message, 5 s pour répondre). Tests network.cjs (échouent sur l’ancien net.js). Non vérifié en production avant déploiement. |

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

## B009 — Absence d’un joueur humain

**Historique : la variante de correction ci-dessous est remplacée par la règle actuelle de `PRESENCE_SPEC.md` : dix secondes avec ou sans chrono, aucun bot et aucune validation automatique de mémorisation.**

| | |
|---|---|
| Signalement | 23/10, partie réelle à deux navigateurs sur le serveur public : page quittée environ 65 s. Au retour, la manche 1 était finie, la mémorisation de la manche 2 validée sans voir de carte, et environ trois tours joués à sa place. Le créateur, de retour, voyait « En attente de l’organisateur… » aux écrans de fin. |
| Cause | Boucle de présence serveur (presenceTick) : un humain non vu depuis plus de 10 s avait sa mémorisation validée d’office et son tour joué par la logique des bots (pioche, échange, figures, TOC possible), avec ou sans chrono. Le rôle d’organisateur passait à un autre joueur après 10 s d’absence et n’était jamais rendu. En mode « J’observe », le lancement excluait de l’ordre l’organisateur *du moment* : un remplaçant pouvait devenir arbitre et le créateur recevoir une main. |
| Correction | hostPresenceTick (public/index.html, exécuté par le serveur) ne joue plus jamais pour un humain absent. Sans chrono : la partie l’attend, mémorisation comprise. Avec chrono : le chrono serveur existant (forceSkip) passe son tour sans jouer de carte, et sa mémorisation est validée une fois la durée du chrono écoulée. L’absence est publiée (state.absent) et affichée aux autres : « X est absent · la partie l’attend » ou « · tour passé à la fin du chrono ». L’organisateur peut retirer l’absent (bouton ✕ dans ce message). Le serveur enregistre le créateur (meta.creator) à la création : un remplaçant tient le rôle pendant l’absence (Manche suivante / Rejouer restent possibles), puis le créateur le récupère dès son retour (src/host.js). Le siège joueur/arbitre suit le créateur, pas l’organisateur du moment. Les bots sont inchangés. |
| Preuve | tests/absence.mjs (dans npm test) : sans chrono, aucun coup ni TOC joué et mémorisation attendue, reprise du joueur à son retour ; avec chrono, mémorisation validée après la durée et tour passé sans modifier main ni défausse ; rôle rendu au créateur ; ordre correct en « J’observe » et « Je joue » lancé par un remplaçant. Le test échoue sur l’ancien moteur. Non vérifié sur téléphones réels : à confirmer après déploiement. |

## Complément présence — 23 octobre 2026

Règle exacte : voir [PRESENCE_SPEC.md](PRESENCE_SPEC.md). Arrière-plan détecté,
décompte serveur dix secondes même sans chrono, aucun remplacement par un bot,
mémorisation préservée et retour sur vue fraîche. Tests moteur/transport et parcours
WebSocket locaux validés ; non déployé et non vérifié sur téléphone physique.

### 23 octobre — transitions quitter / recréer / rejoindre

Risques constatés dans les gestionnaires : création/entrée non verrouillées (double appui), variables de salle globales réutilisées par une réponse tardive, sortie effaçant la reprise avant confirmation serveur, ancien transport conservé et susceptible de se reconnecter. La confirmation native de sortie bloquait aussi les pilotes navigateur. Correctif : demandes uniques et invalidables, paramètres capturés, sortie confirmée dans la page, attente ACK/retrait, libération du seul transport quitté. Tests et limites : `docs/PRESENCE_SPEC.md`, section Parcours de salle. Aucun test matériel mobile ni campagne Claude complète revendiqué ici.


## Consolidation du rapport — 23 octobre 2026

Le comptage du bilan fait autorité dans [AUDIT_REPORT_2026-10-23.md](AUDIT_REPORT_2026-10-23.md). Sept anomalies établies : B001, B004, B005, B006, B007, B008, B009. B002 et B003 restent des signalements ouverts ; ils ne sont pas ajoutés comme deux causes distinctes déjà prouvées. Les identifiants B006/B007 réutilisés par les branches de Claude sont normalisés ici : la prise périmée devient B008 ; l’entrée iframe devient B010.

| ID | Signalement / risque | État et preuve |
|---|---|---|
| B008 | Prise correcte jugée contre une défausse arrivée entre le clic et le traitement : pénalité injustifiée | Observé par Claude en duel, issue #5 ; PR #8 ouverte. Tests règles/moteur passent ; capture au clic Prendre + manche ajoutée par Claude. Non publié, pas encore rejoué sur la version corrigée en duel. Les 4→12 cartes de Codex ne sont pas une preuve de cette cause : erreur de pilotage distincte. |
| B010 | Risque de perte d’identité dans l’iframe tierce du domaine officiel, notamment après arrêt du navigateur iOS | Architecture constatée et risque analysé par Claude, PR #7 ouverte ; routage en premier plan testé localement par Claude. Perte d’identité exacte non confirmée par nous sur iPhone physique. |
| B011 | Création/entrée non verrouillée : plusieurs demandes possibles par doubles appuis | Risque de code, pas une nouvelle observation en duel ; correctif PR #12, tests lifecycle. |
| B012 | Réponse tardive d’une ancienne demande susceptible de changer la salle après annulation | Risque de code ; correctif PR #12, tests contrôlant l’ordre des réponses et la nouvelle salle. |
| B013 | Reprise locale effacée avant confirmation de sortie serveur | Risque de code ; correctif PR #12, test d’attente ACK et retrait joueur. |
| B014 | Transport d’une ancienne salle conservé et susceptible de se reconnecter après sortie | Risque de code ; correctif PR #12, test de libération et absence de reconnexion différée. |

Incidents de test exclus du nombre de bugs du jeu : I001, suivi de positions périmées par le pilotage Codex en fin de partie 4 ; I002, contrôle Chrome indisponible autour du dialogue natif Quitter. L’origine exacte de l’indisponibilité du contrôle n’est pas prouvée. PR #12 remplace ce dialogue par une confirmation dans la page, testée localement.

## B010 — entrée en premier plan (23 octobre)

Migration unique : les identités créées dans l’ancienne iframe sont partitionnées
sous lueurvivante.fr et ne sont pas lisibles en premier plan ; un joueur au milieu
d’une partie lancée avant la mise en ligne la perd une fois. Déployer entre deux
parties. Les identités workers.dev ne sont pas transférées non plus (autre origine).

À vérifier sur iPhone réel après déploiement (test décisif) : ouvrir
lueurvivante.fr/toctoc/ dans Safari, rejoindre une partie, fermer Safari de force
(sélecteur d’apps), rouvrir la même adresse : la partie doit reprendre avec le même
joueur, sans repasser par l’accueil. Refaire depuis l’app Messages (lien ouvert puis
retour) et depuis Chrome iOS. Vérifier aussi que wss://lueurvivante.fr/toctoc/ws
s’ouvre (onglet Réseau) et que lueurvivante.fr/toctoc (sans barre) redirige.

