# Interface bleu ciel — 26 octobre 2026

Direction validée par le retour utilisateur : conserver la logique de la liste historique, enrichir le tableau de bord et reprendre l’esprit lumineux de la référence ARMP Academia (fonds ciel, titres bleu profond, cartes généreuses, boutons arrondis).

## Composition
Tableau de bord : accueil personnalisé, avancement réel, six compteurs, volumes mensuels sur six mois, répartition des traitements, derniers courriers ouverts et raccourcis. Les agrégats sont calculés côté API sur le périmètre autorisé. Aucun volume fictif. Un nombre nul reste visible.
Liste : page historique par défaut, arborescence et liste, imports, classement et statistiques conservés. La vue compacte paginée reste disponible à /courriers/compact. La recherche globale transmet q à la liste historique.

## Palette et composants
Encre #17385d, texte secondaire #49657c, bleu d’action #0369a1, bleu ciel #0284c7, fonds #f0f9ff et #daf2ff, bordure #d6eaf5. Les textes sur fonds clairs utilisent une encre foncée. Vert/ambre/rose distinguent les états avec une légende textuelle. Rayons 12 px pour contrôles, 18–24 px pour cartes. Police Plus Jakarta Sans existante conservée.
Contrôles au moins 44 px, focus visible de 3 px, libellés accessibles, navigation clavier et animations réduites. Menu mobile fermé au chargement, piège de focus et touche Échap. Grille d’indicateurs 3 colonnes puis 2 sur mobile. Graphiques accompagnés de valeurs et descriptions lisibles sans couleur.

## Saisie
Téléphones : masque progressif +243 81 234 5678, chiffres internationaux limités à 15, collage et retour arrière pris en charge ; valeur API sans espaces. Autres indicatifs internationaux conservés. Dates : saisie française segmentée JJ/MM/AAAA et HH:mm avec calendrier ; dates invalides non propagées. Codes SMS limités à six chiffres. Les références organisationnelles restent paramétrables, sans imposer un format fixe contradictoire.

## Vérification
Build TypeScript/Vite, tests API dans une base de recette et vérification visuelle bureau/mobile. Les captures définitives et le compte rendu de livraison décrivent le résultat réellement contrôlé. Le domaine temporaire et les canaux de communication non activés restent des contraintes d’exploitation.
