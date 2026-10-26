# Paramétrage des deux références du courrier

Cette interface nécessite le backend disposant des routes `/api/numbering/*` et de la migration de double numérotation.

Avec un compte SUPER_ADMIN, ouvrir **Paramètres → Numérotation**, ou `/parametres?onglet=numerotation`.

1. Créer/enregistrer les entités réelles dans l’organigramme.
2. Renseigner leurs codes administratifs uniques dans le panneau de numérotation.
3. Ajouter une règle : périmètre central ou niveau d’entité, éventuellement une entité particulière, type et sens concernés, format, périodicité, largeur et minimum du compteur.
4. Exemple de règle par direction : `{organisation}/{code}/{annee}/{compteur}`. Si les compteurs sont séparés par sens/type, inclure aussi `{sens}`/`{type}`.
5. Enregistrer, puis simuler la configuration enregistrée. La simulation ne réserve aucun numéro et utilise la valeur de départ pour illustrer le format.
6. Activer le numéro organisationnel lorsque les règles et les codes sont prêts, puis enregistrer.

À la saisie, choisir une entité autorisée du registre. Pour une saisie en liste, ce choix est commun au lot : effectuer des lots distincts pour des registres différents. L’API sélectionne la règle du niveau le plus proche dans l’organigramme. À niveau égal, la première règle correspondante gagne ; le bouton de priorité permet d’en modifier l’ordre.

Les deux numéros sont attribués uniquement au moment de l’enregistrement serveur. Le numéro système reste dans le champ historique `numero` ; le numéro organisationnel est une donnée distincte. Le nom/code d’une entité ou le format peuvent évoluer sans réécrire les références anciennes. La référence externe portée sur le document reçu reste un champ séparé.

Les listes, recherches, registres et impressions utilisent les deux références lorsqu’elles existent. Les accusés de réception présentent les numéros système et organisationnel sur deux lignes. Les anciennes références sans numéro organisationnel restent affichées sans valeur inventée.

Un conflit de version de configuration demande de recharger l’écran avant d’enregistrer. Une erreur d’entité ou de format à la création bloque l’attribution plutôt que d’émettre un numéro incorrect. Les compteurs déjà utilisés ne peuvent pas être remis en arrière via la valeur de départ.
