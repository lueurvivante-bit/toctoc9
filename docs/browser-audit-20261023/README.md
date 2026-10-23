# Dix parties avec deux clients navigateur — 23 octobre 2026

Version de départ : 91b377c7, jeu public toctoc9, salle dédiée CMZT. Deux
identités de test ; aucune donnée d’élève. Pilotage uniquement par les boutons
et observations DOM, sans modifier l’état, les cartes, les scores ou les délais.
Aucune session Claude Code utilisée ; aucun téléphone physique connecté.

Dix parties complètes avec deux affichages mobiles (390×720 et 260×540), neuf
Rejouer, une manche suivante, confirmations mémoire sur chaque relance,
dix tentatives de prise et dix échanges de pioche, neuf lectures de Valet,
quatre échanges Roi, huit échanges Dame. 128 actions de base (hors clics de
mémorisation et de pouvoirs). Rechargements de l’invité et de l’hôte avec reprise.

Une onzième session a vérifié l’absence de clic sur un pouvoir : expiration
automatique puis Piocher activé uniquement chez l’adversaire. Aucun blocage
de pioche/mémorisation reproduit sur ces parcours. Aucun log console error/warn.

Un défaut de texte de résultat a été reproduit et corrigé (B006 dans BUGS.md).
end-before.png le montre ; report.json contient les événements et les mesures.
Les captures mobile-host/guest montrent le parcours réel après les dix parties.

Limites : cela ne couvre pas tous les téléphones, Safari/iOS, les coupures
physiques réseau, chaque variante de réglage, chaque prise réussie/protégée
ni toutes les séquences de double toucher. Des tests moteur/transport
complémentaires restent exécutés par npm test. Les huit premières parties
exploratoires (un client initialement large) ne sont pas comptées parmi ces dix.
