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
