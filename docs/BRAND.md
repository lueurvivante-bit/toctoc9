# Identité visuelle Toc Toc / LueurVivante

## Référence et portée

Demande Jonathan du 23 octobre 2026 : utiliser les logos et la charte LueurVivante disponibles sur GitHub, et s’y référer pour les prochaines évolutions de Toc Toc. Ce document est le point d’entrée du jeu pour les futurs agents. La charte PDF fournie ensuite par Jonathan est conservée sans modification dans `docs/brand/LUEURVIVANTE_CHARTE.pdf`.

Sources réellement consultées dans `lueurvivante-bit/lueurvivante-academy` :

- Logo SVG : `assets/expo.icon/Assets/logo-flamme.svg` ; copie inchangée `public/brand/lueurvivante-flamme.svg`.
- Logo PNG : `assets/images/logo-flamme.png` ; copie inchangée `public/brand/lueurvivante-flamme.png`.
- Adoption de la marque : commit `ed87b8198cf930a7aa9f1f2cf8f2b71d87700d6d`, message « feat(brand): adopt the LueurVivante flame logo ». Il précise explicitement l’orange `#f2930b` issu de la charte et son association au noir. L’SVG utilise cette couleur.
- `src/constants/theme.ts` et la branche `feat/visual-identity` sont des réglages d’application, pas une charte complète ; ne pas en déduire une typographie officielle ou toutes les règles de marque.

Liens : https://github.com/lueurvivante-bit/lueurvivante-academy/commit/ed87b8198cf930a7aa9f1f2cf8f2b71d87700d6d ; https://github.com/lueurvivante-bit/lueurvivante-academy/blob/main/assets/expo.icon/Assets/logo-flamme.svg .

## Autorité du PDF et décision de logo

Charte, pages 2–3 : ancien symbole arbre dans un cercle. Jonathan a explicitement choisi **la flamme orange de GitHub** à la place lors de la clarification du 23 octobre. Le reste du PDF sert de base ; ne pas remplacer cette flamme par l’ancien arbre.

Palette, page 4 : noir `#000000`, blanc `#FFFFFF`, jaune `#FDC50A`, jaune doux `#FBDF5E`, orange commun `#F2930B`. Sur fond sombre, association blanc/jaune, avec orange en accent ; éviter de multiplier les accents concurrents.

Typographie, page 5 : titres Sequel100Black-75 ; sous-titres Georgia regular ; textes Sequel100Black-45. Les fichiers Sequel ne sont pas présents dans le dépôt source (qui contient Lexend). L’accueil déclare les noms Sequel avec remplacements Arial Black / Arial ; Georgia est utilisée pour le sous-titre. Il faut les fichiers web Sequel pour un rendu exact sur tous les appareils. Ne pas extraire et réutiliser une police partielle du PDF comme si elle était la fonte complète.

Accroche du jeu choisie par Jonathan : **LES JEUX QUI NOUS ÉLÈVENT**. La signature institutionnelle du PDF « Ton pouvoir c’est apprendre » n’est pas substituée à cette demande.

## Application actuelle

Logo officiel sans déformation ni recoloration dans la signature d’accueil, détail de carte d’accueil, favicon et icône de raccourci. Fond d’accueil noir, orange officiel pour l’action principale et les accents, textes blancs/neutres pour le contraste. L’accueil reprend la hiérarchie typographique de la charte avec les remplacements ci-dessus. Les typographies des cartes et du tapis restent celles du jeu pour préserver la lisibilité et la mise en page.

Les thèmes du tapis, couleurs des joueurs, cartes, alertes et règles conservent leur sens. Aucun logo ajouté au tapis de jeu pour ne pas réduire l’espace des cartes sur téléphone.

## Règles pour les prochaines évolutions

1. Lire ce document avant tout travail visuel ; utiliser les fichiers officiels, jamais une flamme redessinée ou un substitut typographique.
2. Employer les variables `--brand-orange`, `--brand-black`, `--brand-white` pour la marque. Les codes de jeu/couleurs sémantiques restent distincts.
3. Respecter les proportions et le contraste du logo ; ne pas étirer, appliquer de filtre de teinte ou ajouter un effet au fichier officiel.
4. Vérifier l’accueil en petit et grand écran ; ne pas introduire de chevauchement ni réduire les cartes/actions en partie.
5. Lire le PDF conservé dans ce dépôt ; respecter les décisions de Jonathan ci-dessus qui actualisent le logo et l’accroche. Ne pas inventer de police officielle ni de règles absentes du document.


## Vérification de cette intégration

`npm test` passe. Accueil contrôlé en navigateur sur grand écran, 375×720 et 320×568 : logos chargés, proportions conservées, accroche exacte, aucun débordement horizontal. Les règles et la connexion ne sont pas modifiées.

Empreintes SHA-256 :
- Charte PDF : `bb116d1547e8dc6590142a29b715b3e371ad1aa61d51aa8c8de28c75e405ef13`.
- Logo SVG : `9b398c22146f1bd046682203e331feb877a7cdaad6e78a5db1066115c92f147c`.
- Logo PNG : `f664bc85adf0e18858970131941771899a0d3e1df90767794f901145d6414e64`.

## Publication vérifiée

PR #18 intégrée, révision applicative `2929b76`. Version Cloudflare publiée : `7d47cd70-4cbf-4c8a-9819-d34061f08fa1`. Contrôle public : accueil et SVG/PNG sous `/toctoc/brand/` répondent 200 et correspondent aux fichiers sources ; logo chargé et accroche exacte constatés dans le navigateur à l’adresse officielle. Capture locale `/tmp/toctoc-brand-published.png`. PR #17 avait publié séparément la seule accroche.

Fichiers de l’intégration visuelle : `AGENTS.md`, `README.md`, `docs/BRAND.md`, `docs/brand/LUEURVIVANTE_CHARTE.pdf`, `public/index.html`, `public/brand/lueurvivante-flamme.svg`, `public/brand/lueurvivante-flamme.png`. La source PDF et les logos sont copiés sans modification. Aucun fichier moteur/réseau/routage modifié dans cette intégration ; seules les chaînes HTML d’accueil et ses styles changent dans index.html.
