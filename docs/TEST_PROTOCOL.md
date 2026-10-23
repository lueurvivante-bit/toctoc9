# Sessions Codex / Claude Code

Les deux agents peuvent piloter des clients distincts du même serveur de test.
GitHub partage les sources, journaux et correctifs ; il ne transporte pas les coups.
Ne pas dire qu’une session Claude a été exécutée sans accès et résultat réel.

1. Partir du même commit dans deux branches séparées.
2. Démarrer `npm run dev` dans un environnement de test avec données isolées.
3. Deux navigateurs/profils distincts : un hôte, un invité, une salle de test dédiée.
4. Tester lancement, quota mémoire, confirmation, pioche/défausse, figures, manche
   suivante, fin/rejouer ; puis rechargement, coupure/reconnexion, double toucher.
5. Consigner dans BUGS.md les étapes, résultat attendu, résultat réel et preuves.
6. Corriger par PR ciblée, exécuter `npm test`, rejouer le scénario avec les deux
   clients avant publication. Ne pas modifier simultanément main depuis deux agents.

Les scripts Python e2e existants sont des scénarios de référence ; leur présence
ne prouve pas leur exécution sur une machine ou un téléphone.

## Campagne réelle du 23 octobre 2026 — état intermédiaire

Coordination et observations : [issue nº 5](https://github.com/lueurvivante-bit/toctoc9/issues/5).
Deux clients distincts, Claude et Codex, salle dédiée XNP2 sur le serveur public.
Les agents utilisent leur interface et leur mémoire ; aucune carte ni stratégie
n’est partagée dans la coordination. Le format téléphone 390 × 720 a été appliqué
au client Codex en cours de campagne : ce n’est pas un test sur iPhone physique.

Six parties terminées, scores finaux Codex / Claude : 31/14, 16/42, 21/40,
83/51, 28/41, 35/1. La fin de la quatrième est non représentative : le pilotage
Codex a réutilisé des positions avant confirmation, provoquant des prises ratées
répétées. Ce défaut d’instrumentation ne constitue pas un bug du jeu. Le suivi a
été corrigé ; prévoir une partie supplémentaire pour remplacer cet échantillon.

Reprises observées côté Codex : départ après mémorisation avant confirmation,
retour et confirmation acceptés ; rechargement pendant un pouvoir puis résolution
acceptée ; fermeture/réouverture de l’onglet avec retour comme joueur, sans passage
en spectateur. L’absence prolongée de Claude a transféré le rôle d’organisateur
à Codex. Le remplacement automatique d’un absent par un bot est un comportement
existant à clarifier, même dans une salle configurée sans bots.

Corrections en cours : [PR nº 6](https://github.com/lueurvivante-bit/toctoc9/pull/6)
(connexion silencieuse) et [PR nº 8](https://github.com/lueurvivante-bit/toctoc9/pull/8)
(prise jugée contre une nouvelle défausse). `npm test` passe sur les deux propositions
dans des copies locales isolées. La PR nº 10 de Codex, doublon de nº 8, a été fermée ;
son commit 4fffd99 conserve deux contrôles complémentaires (intention dès le clic
Prendre et numéro de manche), transmis à Claude. Aucune de ces corrections n’a
été déployée par Codex pendant cette campagne. Les contrôles Workers Builds des
branches échouent ; leur motif détaillé reste à vérifier dans Cloudflare.

À reprendre : créer une nouvelle salle à deux joueurs avec chrono 10 s, coordonner
son code dans l’issue nº 5, observer absence/retour puis poursuivre jusqu’à dix
parties représentatives. Le pilotage Chrome est devenu indisponible pendant la
confirmation Quitter après la sixième partie ; intervention utilisateur demandée.
Ne pas annoncer dix parties à deux agents terminées, ni une correction publique
vérifiée, sur la seule base des simulations moteur antérieures.
