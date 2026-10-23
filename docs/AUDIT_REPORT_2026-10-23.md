# Bilan Toc Toc — 23 octobre 2026

## Périmètre et arrêt de campagne

Rapport demandé par Jonathan pour conclure et faire le point, sans présenter la campagne comme achevée à dix duels. Sources : journal BUGS.md, TEST_PROTOCOL.md de la PR #11, PRESENCE_SPEC.md, issue GitHub #5 et propositions #6/#7/#8/#9/#12. État GitHub vérifié : #3/#4 intégrées ; #6/#7/#8/#9/#11/#12 ouvertes ; #10 fermée comme doublon de #8. Aucune publication des nouvelles corrections #6–#12 confirmée. Claude confirme avoir relu #12 et exécuté npm test avec succès ; aucun déploiement de sa part non plus.

## Parties et tests effectués

| Échantillon | Résultat | Limite |
|---|---|---|
| Duels Codex–Claude | 6 parties terminées, cinq redémarrages entre ces parties | Dix duels non atteints ; cinq seulement représentatifs jusqu’au bout |
| Audit navigateur antérieur | 10 parties complètes, deux clients pilotés par Codex, neuf redémarrages ; vues 390×720 et 260×540 | Deux clients, pas deux agents ni téléphones physiques |
| Tests moteur | 10 scénarios automatisés, chacun terminé puis rejoué jusqu’à la fin | Ce ne sont pas des duels ; ne pas additionner les exécutions répétées de npm test comme de nouvelles parties humaines |
| Diagnostic présence local | Deux connexions WebSocket réelles, reprise et trois cycles de nouvelles salles ; deux interfaces navigateur | Pas un test iPhone/Android matériel ni une campagne compétitive |

Scores des duels, points Codex / Claude (le plus petit gagne) :

| Partie | Codex | Claude | Gagnant |
|---|---:|---:|---|
| 1 | 31 | 14 | Claude |
| 2 | 16 | 42 | Codex |
| 3 | 21 | 40 | Codex |
| 4 | 83 | 51 | Claude — fin non représentative |
| 5 | 28 | 41 | Codex |
| 6 | 35 | 1 | Claude |

Score brut : 3–3. La fin de partie 4 est invalidée comme échantillon compétitif : Codex a réutilisé des positions sans attendre la confirmation, entraînant des prises fausses et des pénalités répétées. Cela n’établit pas un bug du jeu. Le suivi a été corrigé, mais la partie de remplacement n’a pas été jouée. YSHK a été créée par Claude pour la suite ; Codex ne l’a pas rejointe et aucune partie 7 n’est revendiquée.

## Comptage des problèmes

**Sept anomalies établies**, sans compter plusieurs symptômes comme plusieurs causes :

1. **B001 — chevauchement mémorisation/bouton.** Bouton et texte se recouvraient ; correction antérieure intégrée et test structurel.
2. **B004 — demande sans réponse sans fin.** ACK ou réservation d’identité absent : attente indéfinie. Reproduit en transport simulé ; délai borné et erreur visible intégrés antérieurement.
3. **B005 — refus serveur invisible.** Erreur seulement en console et interface verrouillée jusqu’à une nouvelle vue. Testé par refus/déconnexion simulés ; traitement explicite intégré antérieurement.
4. **B006 — verdict final contradictoire.** Deux scores au-dessus de la limite, vainqueur correct mais texte « tous éliminés ». Corrigé via #4 ; texte cohérent constaté ensuite en duel 4.
5. **B007 — connexion ouverte mais muette.** Échanges sans ACK, statut « connecté », rechargement nécessaire. Observé à deux clients ; PR #6 incluse dans #12, tests de remplacement de socket passent. Correction non publiée.
6. **B008 — prise jugée sur la mauvaise défausse.** La carte change pendant la latence et provoque une pénalité injustifiée. Observé par Claude ; PR #8 testée, non publiée. Capture au clic et numéro de manche prévus dans sa version actuelle.
7. **B009 — jeu automatique pour un humain absent et rôle non rendu.** Mémorisation validée et tours joués par un bot, même sans bots ; créateur bloqué en attente d’organisateur. Observé en partie. PR #12 complète #9 : aucun bot, dix secondes puis tour passé avec/sans chrono, mémorisation inachevée attendue, rôle restauré. Tests locaux passent ; non publié.

**Deux signalements encore ouverts :** B002, impossibilité intermittente de piocher ; B003, impossibilité intermittente de mémoriser/confirmer/lancer après relance. Des causes plausibles ont été corrigées, mais les blocages exacts rapportés par Jonathan sur son téléphone ne sont pas suffisamment reproduits pour déclarer ces deux signalements clos.

**Cinq risques techniques supplémentaires :** B010, identité dans l’iframe tierce ; B011, doubles demandes de création/entrée ; B012, réponse tardive d’une ancienne salle ; B013, nettoyage avant confirmation de sortie ; B014, ancien transport qui se reconnecte. Le premier reste à valider sur iPhone matériel (#7), les quatre autres sont protégés et testés localement dans #12. Ce ne sont pas cinq nouveaux bugs tous observés pendant les duels.

**Deux incidents de test distincts :** I001, erreur de suivi Codex en partie 4 ; I002, indisponibilité du pilotage Chrome autour de la confirmation native Quitter (cause technique exacte non prouvée). Ils ne sont pas comptés comme bugs du jeu. La confirmation dans la page de #12 a été testée avec annulation et sortie effective.

## Vérifications de reprise réussies

Rechargement pendant un pouvoir puis résolution ; fermeture/réouverture avec retour joueur ; mémorisation interrompue et confirmation au retour ; absence au tour sans chrono avec décompte puis saut sans bot ; retour même siège/main et pioche possible au tour suivant ; absence après pioche avec carte défaussée au saut ; sortie volontaire puis nouveau pseudo/personnage/salle ; rechargement de cette nouvelle salle et rôle organisateur conservé.

Si le système mobile tue le réseau sans envoyer d’événement, l’absence est détectée par expiration du dernier battement : la détection peut ajouter un délai. Reprise seulement avec le même profil et stockage local conservé. Une mémorisation inachevée attend le retour ou le retrait explicite par l’organisateur.

## Ce qui reste à valider avant de conclure « corrigé en ligne »

Consolider #7 (entrée sans iframe), #8 (prises) et #12 (réseau, absence, salles), résoudre les contrôles Workers Builds en échec à partir de leurs logs, publier une seule version cohérente et vérifier l’adresse officielle. Refaire les parcours sur téléphones physiques iOS/Android et terminer les dix duels représentatifs si cette campagne est reprise. Les tests locaux et la revue Claude sont favorables ; ils ne prouvent ni publication ni absence universelle de bugs.
