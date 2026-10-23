# Présence et reprise — décision Jonathan du 23 octobre 2026

Cette décision remplace la variante de la PR nº 9 qui attendait indéfiniment
un absent sans chrono et validait sa mémorisation avec chrono.

- Mettre le navigateur en arrière-plan ou fermer temporairement l’onglet ne
  constitue pas un départ volontaire : identité, siège et partie sont conservés.
- Les autres voient « X est inactif actuellement » et le décompte serveur de dix
  secondes. Après ce délai, le tour de l’absent passe, même sans chrono optionnel.
- Aucun bot ne joue pour l’humain absent. Ses cartes ne sont pas échangées à sa
  place. Une pioche déjà engagée se termine selon la résolution existante du
  chrono (`forceSkip`, défausse de la pioche en attente).
- La grâce d’absence prime sur un chrono de tour plus court. Au retour, les
  actions reprennent sur l’état du serveur ; un coup expiré n’est jamais rejoué.
- Une mémorisation inachevée reste à valider par le joueur à son retour. Aucun
  passage hors écran ne lui attribue des cartes vues ou une confirmation fictive.
- Quitter volontairement par le bouton de sortie retire le joueur ; c’est un
  parcours distinct du passage en arrière-plan.

## Contrat technique

`hello` annonce `presence:true` et `active`. Les messages `presence` contiennent
uniquement `active` (booléen). `visibilitychange` et `pagehide` signalent le départ ;
le retour et la restauration BFCache remplacent la connexion pour récupérer une
vue fraîche, avec le même identifiant/jeton. Un battement visible entretient la
présence ; un socket moderne silencieux ne suffit pas à déclarer un joueur actif.
Les anciens clients sans ce contrat restent compatibles avec le transport.

Le serveur publie `state.absent[uid] = {since, deadline}`. Les instants sont ceux
du serveur ; l’interface ne décide pas quand passer le tour. Une coupure sans
signal explicite est détectée par perte de connexion ou expiration des battements,
ce qui reste une estimation du moment réel de départ. Ne pas promettre une détection
instantanée d’un arrêt brutal d’iOS ou du réseau.

## Vérifications

- `npm test` : moteur, mémorisation préservée, grâce 10 s avec/sans chrono, reprise,
  visibilité/pagehide/BFCache, identité stable, refus des coups avant resynchronisation.
- `node tests/presence-live.mjs` contre `wrangler dev --local --port 8137` : deux
  clients WebSocket locaux, attente réelle de plus de dix secondes, retour, trois
  créations de salle avec nouveaux pseudos, doublon de pseudo refusé et sortie.
- Ces contrôles ne constituent ni dix duels humains, ni un test sur iPhone physique.
  Les scénarios navigateur et la vérification publique doivent être consignés
  séparément, sans conclure « zéro bug dans tous les cas ».
