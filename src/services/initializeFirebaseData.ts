/**
 * Service pour initialiser des données de démonstration dans Firebase
 * Crée quelques courriers avec des fichiers et dossiers
 */

import { courrierService } from './courrierService';
import { categorieFichierService } from './categorieFichierService';
import { adminService } from './adminService';
import { directionService } from './directionService';
import { entiteOrganisationnelleService } from './entiteOrganisationnelleService';
import { TypeCourrier, Priorite, StatutCourrier } from '../types';

/**
 * Créer un fichier texte de démonstration
 */
function createDemoTextFile(content: string, fileName: string): File {
  const blob = new Blob([content], { type: 'text/plain' });
  return new File([blob], fileName, { type: 'text/plain' });
}

/**
 * Créer un fichier PDF de démonstration (simulé avec du texte)
 */
function createDemoPDFFile(content: string, fileName: string): File {
  // Pour la démo, on crée un fichier texte qui simule un PDF
  // En production, vous devriez utiliser une vraie bibliothèque PDF
  const blob = new Blob([content], { type: 'application/pdf' });
  return new File([blob], fileName, { type: 'application/pdf' });
}

/**
 * Initialiser des courriers de démonstration avec fichiers et dossiers
 * @param force - Si true, génère même s'il y a des courriers existants
 */
export async function initializeFirebaseDemoData(force: boolean = false): Promise<void> {
  console.log('🚀 Initialisation des données de démonstration Firebase...');

  // IMPORTANT: Cette fonction ne doit être appelée QUE manuellement via le bouton
  // Elle ne doit JAMAIS être appelée automatiquement au chargement de la page

  // Vérifier la configuration Firebase
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || projectId === 'your-project-id') {
    throw new Error('Configuration Firebase non valide. Vérifiez vos variables d\'environnement dans le fichier .env');
  }

  // Vérifier si l'initialisation a déjà échoué (pour éviter les boucles infinies)
  const initFailed = sessionStorage.getItem('firebase_init_failed');
  if (initFailed === 'true' && !force) {
    const shouldContinue = window.confirm(
      '⚠️ L\'initialisation a échoué précédemment.\n\n' +
      'Cela peut être dû à des problèmes de permissions Firebase Storage.\n\n' +
      'Voulez-vous quand même essayer de générer les courriers ?'
    );
    if (!shouldContinue) {
      console.warn('⚠️ Génération annulée par l\'utilisateur.');
      throw new Error('Génération annulée par l\'utilisateur');
    }
    // Réinitialiser le flag si l'utilisateur veut continuer
    sessionStorage.removeItem('firebase_init_failed');
  }

  // Vérifier si les données existent déjà - vérification stricte (sauf si force = true)
  if (!force) {
    try {
      // Vérifier d'abord dans le store Redux (Firestore)
      const { fetchCourriers } = await import('../store/slices/courriersSlice');
      const { store } = await import('../store/store');
      await store.dispatch(fetchCourriers());
      const state = store.getState();
      const firestoreCourriers = state.courriers.items;
      if (firestoreCourriers && firestoreCourriers.length > 0) {
        console.log(`✅ ${firestoreCourriers.length} courrier(s) existent déjà dans Firestore.`);
        const shouldContinue = window.confirm(
          `Des courriers existent déjà dans Firestore (${firestoreCourriers.length}).\n\n` +
          'Voulez-vous quand même générer de nouveaux courriers de démonstration ?\n\n' +
          'ATTENTION: Cela créera des courriers supplémentaires.'
        );
        if (!shouldContinue) {
          console.log('❌ Génération annulée par l\'utilisateur.');
          throw new Error('Génération annulée par l\'utilisateur');
        }
      }
      
      // Vérifier aussi dans le service local
      const existingCourriers = courrierService.getAllCourriers();
      if (existingCourriers && existingCourriers.length > 0) {
        console.log(`✅ ${existingCourriers.length} courrier(s) existent déjà localement.`);
        const shouldContinue = window.confirm(
          `Des courriers existent déjà localement (${existingCourriers.length}).\n\n` +
          'Voulez-vous quand même générer de nouveaux courriers de démonstration ?\n\n' +
          'ATTENTION: Cela créera des courriers supplémentaires.'
        );
        if (!shouldContinue) {
          console.log('❌ Génération annulée par l\'utilisateur.');
          throw new Error('Génération annulée par l\'utilisateur');
        }
      }
    } catch (error) {
      console.warn('⚠️ Erreur lors de la vérification des courriers existants:', error);
      // Demander confirmation avant de continuer si la vérification échoue
      const shouldContinue = window.confirm(
        'Impossible de vérifier les courriers existants.\n\n' +
        'Voulez-vous continuer la génération ?\n\n' +
        'ATTENTION: Cela pourrait créer des doublons si des courriers existent déjà.'
      );
      if (!shouldContinue) {
        console.log('❌ Génération annulée par l\'utilisateur.');
        return;
      }
    }
  }

  try {
    // Initialiser les services nécessaires
    directionService.initializeDemoData();
    entiteOrganisationnelleService.initializeDemoData();
    
    // Récupérer les utilisateurs
    const users = adminService.getAllUsers();
    const secretaire = users.find(u => u.email === 'secretaire@example.com') || users[0];
    const dg = users.find(u => u.email === 'dg@example.com') || users[1];

    if (!secretaire) {
      console.error('❌ Utilisateur secrétaire non trouvé');
      return;
    }

    // Récupérer les directions et services
    const entities = entiteOrganisationnelleService.getAllEntities().filter(e => e.actif !== false);
    const directions = entities.filter(e => e.type === 'direction_generale' || e.type === 'direction');
    const services = entities.filter(e => e.type === 'service' || e.type === 'sous-service');

    // Générer des dates variées
    const today = new Date();
    const dates = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (4 - i));
      return date;
    });

    // Courrier 1: Externe avec fichiers et dossiers
    console.log('📝 Création du courrier 1...');
    const courrier1 = await courrierService.createCourrier({
      type: TypeCourrier.EXTERNE,
      dateReception: dates[0],
      expediteur: 'Ministère de l\'Économie et des Finances',
      destinataire: 'Direction Générale',
      objet: 'Demande de subvention pour projet d\'infrastructure routière',
      priorite: Priorite.HAUTE,
      enregistrePar: secretaire.id,
      direction: directions[0]?.nom || 'Direction Administrative',
      service: services.find(s => s.parentId === directions[0]?.id)?.nom || services[0]?.nom,
      extraFields: {
        dateReceptionCourrier: dates[0].toISOString(),
        referenceExterne: 'REF-2024-001',
        montant: '5000000',
        dureeProjet: '24 mois'
      }
    });
    // Mettre à jour le statut après création
    await courrierService.updateCourrier(courrier1.id, { statut: StatutCourrier.EN_ATTENTE_DG });

    // Créer des dossiers pour le courrier 1
    const dossier1_1 = await categorieFichierService.createCategorie(
      courrier1.id,
      'Documents administratifs',
      undefined,
      secretaire.id
    );
    const dossier1_2 = await categorieFichierService.createCategorie(
      courrier1.id,
      'Documents techniques',
      undefined,
      secretaire.id
    );
    const sousDossier1_1 = await categorieFichierService.createCategorie(
      courrier1.id,
      'Devis et factures',
      dossier1_1.id,
      secretaire.id
    );

    // Créer des fichiers pour le courrier 1
    const fichier1_1 = createDemoTextFile(
      'Demande de subvention\n\nProjet: Infrastructure routière\nMontant: 5 000 000 FCFA\nDurée: 24 mois',
      'demande_subvention.txt'
    );
    await categorieFichierService.createFichier(
      courrier1.id,
      fichier1_1.name,
      fichier1_1,
      dossier1_1.id,
      secretaire.id,
      fichier1_1.size
    );

    const fichier1_2 = createDemoPDFFile(
      'Devis détaillé du projet\n\nÉquipements: 2 000 000 FCFA\nMain d\'œuvre: 1 500 000 FCFA\nMatériaux: 1 500 000 FCFA',
      'devis_projet.pdf'
    );
    await categorieFichierService.createFichier(
      courrier1.id,
      fichier1_2.name,
      fichier1_2,
      sousDossier1_1.id,
      secretaire.id,
      fichier1_2.size
    );

    const fichier1_3 = createDemoTextFile(
      'Plan d\'exécution du projet\n\nPhase 1: Préparation (3 mois)\nPhase 2: Construction (18 mois)\nPhase 3: Finalisation (3 mois)',
      'plan_execution.txt'
    );
    await categorieFichierService.createFichier(
      courrier1.id,
      fichier1_3.name,
      fichier1_3,
      dossier1_2.id,
      secretaire.id,
      fichier1_3.size
    );

    console.log('✅ Courrier 1 créé avec dossiers et fichiers');

    // Courrier 2: Interne avec fichiers
    console.log('📝 Création du courrier 2...');
    const courrier2 = await courrierService.createCourrier({
      type: TypeCourrier.INTERNE,
      dateReception: dates[1],
      expediteur: 'Direction Financière',
      destinataire: 'Service Comptabilité',
      objet: 'Rapport mensuel de gestion financière - Janvier 2024',
      priorite: Priorite.NORMALE,
      enregistrePar: secretaire.id,
      direction: directions[1]?.nom || directions[0]?.nom || 'Direction Financière',
      service: services.find(s => s.parentId === directions[1]?.id)?.nom || services[1]?.nom || services[0]?.nom,
      extraFields: {
        dateEmission: dates[1].toISOString(),
        referenceInterne: 'INT-2024-001',
        montantTotal: '15000000'
      }
    });
    // Mettre à jour le statut après création
    await courrierService.updateCourrier(courrier2.id, { statut: StatutCourrier.ASSIGNE });

    // Créer un dossier pour le courrier 2
    const dossier2_1 = await categorieFichierService.createCategorie(
      courrier2.id,
      'Rapports financiers',
      undefined,
      secretaire.id
    );

    // Créer des fichiers pour le courrier 2
    const fichier2_1 = createDemoPDFFile(
      'Rapport mensuel de gestion financière\n\nJanvier 2024\n\nRevenus: 15 000 000 FCFA\nDépenses: 12 000 000 FCFA\nSolde: 3 000 000 FCFA',
      'rapport_janvier_2024.pdf'
    );
    await categorieFichierService.createFichier(
      courrier2.id,
      fichier2_1.name,
      fichier2_1,
      dossier2_1.id,
      secretaire.id,
      fichier2_1.size
    );

    const fichier2_2 = createDemoTextFile(
      'Annexes du rapport\n\n- Tableau des dépenses détaillées\n- Graphiques d\'évolution\n- Comparaison avec le budget prévisionnel',
      'annexes_rapport.txt'
    );
    await categorieFichierService.createFichier(
      courrier2.id,
      fichier2_2.name,
      fichier2_2,
      dossier2_1.id,
      secretaire.id,
      fichier2_2.size
    );

    console.log('✅ Courrier 2 créé avec dossiers et fichiers');

    // Courrier 3: Externe urgent avec fichiers
    console.log('📝 Création du courrier 3...');
    const courrier3 = await courrierService.createCourrier({
      type: TypeCourrier.EXTERNE,
      dateReception: dates[2],
      expediteur: 'Fournisseur ABC Technologies',
      destinataire: 'Direction Technique',
      objet: 'Devis pour équipement informatique et serveurs',
      priorite: Priorite.URGENTE,
      enregistrePar: secretaire.id,
      direction: directions[2]?.nom || directions[0]?.nom || 'Direction Technique',
      service: services.find(s => s.parentId === directions[2]?.id)?.nom || services[2]?.nom || services[0]?.nom,
      extraFields: {
        dateReceptionCourrier: dates[2].toISOString(),
        referenceExterne: 'REF-2024-002',
        montant: '2500000',
        delaiLivraison: '30 jours'
      }
    });
    // Mettre à jour le statut après création
    await courrierService.updateCourrier(courrier3.id, { statut: StatutCourrier.EN_TRAITEMENT });

    // Créer des fichiers directement (sans dossier) pour le courrier 3
    const fichier3_1 = createDemoPDFFile(
      'Devis équipement informatique\n\nServeurs: 1 500 000 FCFA\nOrdinateurs: 800 000 FCFA\nRéseau: 200 000 FCFA\nTotal: 2 500 000 FCFA',
      'devis_equipement_informatique.pdf'
    );
    await categorieFichierService.createFichier(
      courrier3.id,
      fichier3_1.name,
      fichier3_1,
      undefined,
      secretaire.id,
      fichier3_1.size
    );

    const fichier3_2 = createDemoTextFile(
      'Spécifications techniques\n\nServeur 1: HP ProLiant DL380\nServeur 2: Dell PowerEdge R740\nSwitch: Cisco Catalyst 2960',
      'specifications_techniques.txt'
    );
    await categorieFichierService.createFichier(
      courrier3.id,
      fichier3_2.name,
      fichier3_2,
      undefined,
      secretaire.id,
      fichier3_2.size
    );

    console.log('✅ Courrier 3 créé avec fichiers');

    // Courrier 4: Interne avec structure de dossiers complexe
    console.log('📝 Création du courrier 4...');
    const courrier4 = await courrierService.createCourrier({
      type: TypeCourrier.INTERNE,
      dateReception: dates[3],
      expediteur: 'Direction Administrative',
      destinataire: 'Service RH',
      objet: 'Demande d\'autorisation de congé - Agent Pierre Durand',
      priorite: Priorite.NORMALE,
      enregistrePar: secretaire.id,
      direction: directions[0]?.nom || 'Direction Administrative',
      service: services.find(s => s.parentId === directions[0]?.id)?.nom || services[0]?.nom,
      extraFields: {
        dateEmission: dates[3].toISOString(),
        referenceInterne: 'INT-2024-002',
        dureeConge: '15 jours',
        dateDebut: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
    // Mettre à jour le statut après création
    await courrierService.updateCourrier(courrier4.id, { statut: StatutCourrier.EN_ATTENTE_DG });

    // Créer une structure de dossiers complexe
    const dossier4_1 = await categorieFichierService.createCategorie(
      courrier4.id,
      'Documents RH',
      undefined,
      secretaire.id
    );
    const sousDossier4_1 = await categorieFichierService.createCategorie(
      courrier4.id,
      'Demandes de congé',
      dossier4_1.id,
      secretaire.id
    );
    const sousDossier4_2 = await categorieFichierService.createCategorie(
      courrier4.id,
      'Justificatifs',
      dossier4_1.id,
      secretaire.id
    );

    // Créer des fichiers dans les sous-catégories
    const fichier4_1 = createDemoTextFile(
      'Demande de congé\n\nAgent: Pierre Durand\nPériode: 15 jours\nDate de début: ' + new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR'),
      'demande_conge.txt'
    );
    await categorieFichierService.createFichier(
      courrier4.id,
      fichier4_1.name,
      fichier4_1,
      sousDossier4_1.id,
      secretaire.id,
      fichier4_1.size
    );

    const fichier4_2 = createDemoPDFFile(
      'Justificatif médical\n\nCertificat médical pour congé de maladie',
      'justificatif_medical.pdf'
    );
    await categorieFichierService.createFichier(
      courrier4.id,
      fichier4_2.name,
      fichier4_2,
      sousDossier4_2.id,
      secretaire.id,
      fichier4_2.size
    );

    console.log('✅ Courrier 4 créé avec structure de dossiers complexe');

    // Courrier 5: Externe simple avec un seul fichier
    console.log('📝 Création du courrier 5...');
    const courrier5 = await courrierService.createCourrier({
      type: TypeCourrier.EXTERNE,
      dateReception: dates[4],
      expediteur: 'Banque Centrale',
      destinataire: 'Direction Financière',
      objet: 'Avis de réception de virement bancaire',
      priorite: Priorite.NORMALE,
      enregistrePar: secretaire.id,
      direction: directions[1]?.nom || directions[0]?.nom || 'Direction Financière',
      service: services.find(s => s.parentId === directions[1]?.id)?.nom || services[1]?.nom || services[0]?.nom,
      extraFields: {
        dateReceptionCourrier: dates[4].toISOString(),
        referenceExterne: 'REF-2024-003',
        montant: '10000000',
        numeroVirement: 'VIR-2024-001'
      }
    });
    // Mettre à jour le statut après création
    await courrierService.updateCourrier(courrier5.id, { statut: StatutCourrier.EN_ATTENTE_DG });

    // Créer un seul fichier pour le courrier 5
    const fichier5_1 = createDemoPDFFile(
      'Avis de réception de virement\n\nNuméro de virement: VIR-2024-001\nMontant: 10 000 000 FCFA\nDate: ' + dates[4].toLocaleDateString('fr-FR'),
      'avis_virement.pdf'
    );
    await categorieFichierService.createFichier(
      courrier5.id,
      fichier5_1.name,
      fichier5_1,
      undefined,
      secretaire.id,
      fichier5_1.size
    );

    console.log('✅ Courrier 5 créé avec fichier');

    console.log('🎉 Initialisation terminée !');
    console.log(`✅ ${5} courriers créés avec fichiers et dossiers`);
    sessionStorage.removeItem('firebase_init_failed');
    
    // Recharger les courriers depuis Firestore pour mettre à jour l'affichage
    try {
      const { fetchCourriers } = await import('../store/slices/courriersSlice');
      const { store } = await import('../store/store');
      await store.dispatch(fetchCourriers());
      console.log('✅ Courriers rechargés depuis Firestore');
    } catch (reloadError) {
      console.warn('⚠️ Erreur lors du rechargement des courriers:', reloadError);
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'initialisation des données:', error);
    console.error('Détails de l\'erreur:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack?.substring(0, 300) // Limiter la taille du stack
    });
    
    // Marquer l'échec pour éviter les tentatives répétées (sauf si force = true)
    if (!force) {
      sessionStorage.setItem('firebase_init_failed', 'true');
    }
    
    // Créer un message d'erreur plus informatif
    let errorMessage = error?.message || String(error);
    
    // Afficher un message d'aide si c'est une erreur Storage
    if (errorMessage.includes('Storage') || errorMessage.includes('CORS')) {
      console.error('💡 Solution: Déployez les règles Firebase Storage avec:');
      console.error('   firebase deploy --only storage');
      console.error('   Voir CONFIGURATION_STORAGE.md pour plus de détails');
      errorMessage = `Erreur Firebase Storage: ${errorMessage}\n\nSolution: Déployez les règles Firebase Storage.`;
    } else if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
      errorMessage = `Erreur de permissions Firestore: ${errorMessage}\n\nVérifiez que les règles Firestore permettent la création de courriers.`;
    } else if (errorMessage.includes('Configuration Firebase')) {
      errorMessage = `Configuration Firebase invalide: ${errorMessage}\n\nVérifiez vos variables d'environnement dans le fichier .env.`;
    } else if (errorMessage.includes('network') || errorMessage.includes('Network') || errorMessage.includes('unavailable')) {
      errorMessage = `Erreur de connexion: ${errorMessage}\n\nVérifiez votre connexion Internet et réessayez.`;
    }
    
    // Propager l'erreur pour que l'interface puisse l'afficher
    const enrichedError = new Error(errorMessage);
    (enrichedError as any).originalError = error;
    (enrichedError as any).code = error?.code;
    throw enrichedError;
  }
}

