import { adminService } from './adminService';
import { entiteOrganisationnelleService } from './entiteOrganisationnelleService';
import { laravelApiService } from './laravelApiService';
import { Role } from '../types';

/**
 * Initialise des données étendues avec plusieurs directions, services et utilisateurs.
 * Tous rattachés à la Direction Générale.
 */
export const initializeExtendedData = async () => {
  // Vérifier si les données étendues existent déjà
  const existingEntities = entiteOrganisationnelleService.getAllEntities();
  // En mode API Laravel, rafraîchir d'abord les utilisateurs pour éviter de recréer ceux déjà en base
  if (laravelApiService.isConfigured()) {
    await adminService.refreshUsersFromApi();
  }
  const existingUsers = adminService.getAllUsers();
  
  // Si on a déjà plus de 8 directions, on considère que les données sont déjà initialisées
  const directionsCount = existingEntities.filter(e => (e.type === 'direction_generale' || e.type === 'direction') && e.actif !== false).length;
  if (directionsCount >= 8) {
    console.log('✅ Données étendues déjà initialisées');
    return;
  }

  console.log('🚀 Initialisation des données étendues...');

  // Initialiser d'abord les entités organisationnelles de base
  entiteOrganisationnelleService.initializeDemoData();

  // Ajouter des directions supplémentaires (en utilisant des IDs qui n'existent pas déjà)
  // Les directions 13-16 existent déjà dans initializeDemoData, donc on commence à 21
  const newDirections = [
    { id: '21', nom: 'Direction de la Sécurité', type: 'direction' as const, description: 'Sécurité et sûreté', ordre: 9, actif: true },
    { id: '22', nom: 'Direction de la Recherche et Développement', type: 'direction' as const, description: 'R&D et innovation', ordre: 10, actif: true },
    { id: '23', nom: 'Direction des Achats', type: 'direction' as const, description: 'Gestion des achats et approvisionnements', ordre: 11, actif: true },
    { id: '24', nom: 'Direction des Systèmes d\'Information', type: 'direction' as const, description: 'Gestion des systèmes d\'information', ordre: 12, actif: true },
  ];

  // Ajouter des services pour chaque nouvelle direction
  const newServices = [
    // Direction de la Sécurité (id: 21)
    { id: '51', nom: 'Service Sécurité Physique', type: 'service' as const, parentId: '21', description: 'Sécurité des locaux et accès', ordre: 1, actif: true },
    { id: '52', nom: 'Service Cybersécurité', type: 'service' as const, parentId: '21', description: 'Sécurité informatique et données', ordre: 2, actif: true },
    { id: '53', nom: 'Service Prévention', type: 'service' as const, parentId: '21', description: 'Prévention des risques', ordre: 3, actif: true },
    
    // Direction de la Recherche et Développement (id: 22)
    { id: '54', nom: 'Service Innovation', type: 'service' as const, parentId: '22', description: 'Innovation et veille technologique', ordre: 1, actif: true },
    { id: '55', nom: 'Service Recherche', type: 'service' as const, parentId: '22', description: 'Recherche appliquée', ordre: 2, actif: true },
    { id: '56', nom: 'Service Développement Produit', type: 'service' as const, parentId: '22', description: 'Développement de nouveaux produits', ordre: 3, actif: true },
    
    // Direction des Achats (id: 23)
    { id: '57', nom: 'Service Approvisionnement', type: 'service' as const, parentId: '23', description: 'Gestion des approvisionnements', ordre: 1, actif: true },
    { id: '58', nom: 'Service Relations Fournisseurs', type: 'service' as const, parentId: '23', description: 'Relations avec les fournisseurs', ordre: 2, actif: true },
    { id: '59', nom: 'Service Contrats', type: 'service' as const, parentId: '23', description: 'Gestion des contrats d\'achat', ordre: 3, actif: true },
    
    // Direction des Systèmes d'Information (id: 24)
    { id: '60', nom: 'Service Infrastructure', type: 'service' as const, parentId: '24', description: 'Infrastructure et réseaux', ordre: 1, actif: true },
    { id: '61', nom: 'Service Applications', type: 'service' as const, parentId: '24', description: 'Développement et maintenance applicative', ordre: 2, actif: true },
    { id: '62', nom: 'Service Support', type: 'service' as const, parentId: '24', description: 'Support utilisateurs et helpdesk', ordre: 3, actif: true },
  ];

  // Ajouter les nouvelles entités
  const allEntities = entiteOrganisationnelleService.getAllEntities();
  const entitiesToAdd = [...newDirections, ...newServices];
  
  // Filtrer pour éviter les doublons
  const existingIds = new Set(allEntities.map(e => e.id));
  const uniqueEntities = entitiesToAdd.filter(e => !existingIds.has(e.id));
  
  if (uniqueEntities.length > 0) {
    const updatedEntities = [...allEntities, ...uniqueEntities];
    localStorage.setItem('entites_organisationnelles', JSON.stringify(updatedEntities));
    console.log(`✅ ${uniqueEntities.length} nouvelles entités ajoutées`);
  }

  // Créer des utilisateurs pour les nouvelles directions et services
  const usersToCreate = [
    // Direction de la Sécurité (id: 21)
    { nom: 'Philippe Leroy', email: 'directeur.securite@example.com', role: Role.DIRECTEUR, direction: 'Direction de la Sécurité', actif: true },
    { nom: 'Valérie Henry', email: 'chef.cybersecurite@example.com', role: Role.CHEF_SERVICE, direction: 'Direction de la Sécurité', service: 'Service Cybersécurité', actif: true },
    { nom: 'Sébastien Vincent', email: 'agent.cybersecurite@example.com', role: Role.AGENT, direction: 'Direction de la Sécurité', service: 'Service Cybersécurité', actif: true },
    { nom: 'Marc Dubois', email: 'chef.securite.physique@example.com', role: Role.CHEF_SERVICE, direction: 'Direction de la Sécurité', service: 'Service Sécurité Physique', actif: true },
    
    // Direction de la Recherche et Développement (id: 22)
    { nom: 'Aurélie Rousseau', email: 'directeur.rd@example.com', role: Role.DIRECTEUR, direction: 'Direction de la Recherche et Développement', actif: true },
    { nom: 'Nicolas Fournier', email: 'chef.innovation@example.com', role: Role.CHEF_SERVICE, direction: 'Direction de la Recherche et Développement', service: 'Service Innovation', actif: true },
    { nom: 'Émilie Lamy', email: 'agent.innovation@example.com', role: Role.AGENT, direction: 'Direction de la Recherche et Développement', service: 'Service Innovation', actif: true },
    { nom: 'Romain Guerin', email: 'chef.recherche@example.com', role: Role.CHEF_SERVICE, direction: 'Direction de la Recherche et Développement', service: 'Service Recherche', actif: true },
    { nom: 'Lucas Moreau', email: 'agent.recherche@example.com', role: Role.AGENT, direction: 'Direction de la Recherche et Développement', service: 'Service Recherche', actif: true },
    
    // Direction des Achats (id: 23)
    { nom: 'Claire Martin', email: 'directeur.achats@example.com', role: Role.DIRECTEUR, direction: 'Direction des Achats', actif: true },
    { nom: 'Julien Bernard', email: 'chef.approvisionnement@example.com', role: Role.CHEF_SERVICE, direction: 'Direction des Achats', service: 'Service Approvisionnement', actif: true },
    { nom: 'Sophie Lefebvre', email: 'agent.approvisionnement@example.com', role: Role.AGENT, direction: 'Direction des Achats', service: 'Service Approvisionnement', actif: true },
    { nom: 'Thomas Petit', email: 'chef.fournisseurs@example.com', role: Role.CHEF_SERVICE, direction: 'Direction des Achats', service: 'Service Relations Fournisseurs', actif: true },
    
    // Direction des Systèmes d'Information (id: 24)
    { nom: 'François Durand', email: 'directeur.si@example.com', role: Role.DIRECTEUR, direction: 'Direction des Systèmes d\'Information', actif: true },
    { nom: 'Isabelle Roux', email: 'chef.infrastructure@example.com', role: Role.CHEF_SERVICE, direction: 'Direction des Systèmes d\'Information', service: 'Service Infrastructure', actif: true },
    { nom: 'David Simon', email: 'agent.infrastructure@example.com', role: Role.AGENT, direction: 'Direction des Systèmes d\'Information', service: 'Service Infrastructure', actif: true },
    { nom: 'Nathalie Girard', email: 'chef.applications@example.com', role: Role.CHEF_SERVICE, direction: 'Direction des Systèmes d\'Information', service: 'Service Applications', actif: true },
    
    // Ajouter aussi des utilisateurs pour les directions existantes qui n'en ont pas assez
    { nom: 'George Mercier', email: 'directeur.administratif.financier@example.com', role: Role.DIRECTEUR, direction: 'Direction Administrative', actif: true },
    { nom: 'Georges Mercier', email: 'directeur.financier@example.com', role: Role.DIRECTEUR, direction: 'Direction Financière', actif: true },
    { nom: 'Michel Lambert', email: 'chef.juridique@example.com', role: Role.CHEF_SERVICE, direction: 'Direction Administrative', service: 'Service Juridique', actif: true },
    { nom: 'Caroline Bonnet', email: 'agent.juridique@example.com', role: Role.AGENT, direction: 'Direction Administrative', service: 'Service Juridique', actif: true },
    { nom: 'Stéphane Roussel', email: 'chef.tresorerie@example.com', role: Role.CHEF_SERVICE, direction: 'Direction Financière', service: 'Service Trésorerie', actif: true },
    { nom: 'Patricia Michel', email: 'agent.tresorerie@example.com', role: Role.AGENT, direction: 'Direction Financière', service: 'Service Trésorerie', actif: true },
    { nom: 'Bruno Andre', email: 'chef.informatique@example.com', role: Role.CHEF_SERVICE, direction: 'Direction Technique', service: 'Division Informatique', actif: true },
    { nom: 'Sandra Colin', email: 'agent.informatique@example.com', role: Role.AGENT, direction: 'Direction Technique', service: 'Division Informatique', actif: true },
    { nom: 'Yves Denis', email: 'chef.ventes@example.com', role: Role.CHEF_SERVICE, direction: 'Direction Commerciale', service: 'Service Ventes', actif: true },
    { nom: 'Nadine Legrand', email: 'agent.ventes@example.com', role: Role.AGENT, direction: 'Direction Commerciale', service: 'Service Ventes', actif: true },
    
    // Utilisateurs pour les directions déjà existantes dans initializeDemoData
    { nom: 'Claire Dubois', email: 'directeur.rh@example.com', role: Role.DIRECTEUR, direction: 'Direction des Ressources Humaines', actif: true },
    { nom: 'Marc Lefevre', email: 'chef.recrutement@example.com', role: Role.CHEF_SERVICE, direction: 'Direction des Ressources Humaines', service: 'Service Recrutement', actif: true },
    { nom: 'Julie Martin', email: 'agent.recrutement@example.com', role: Role.AGENT, direction: 'Direction des Ressources Humaines', service: 'Service Recrutement', actif: true },
    { nom: 'François Moreau', email: 'directeur.operations@example.com', role: Role.DIRECTEUR, direction: 'Direction des Opérations', actif: true },
    { nom: 'Isabelle Petit', email: 'chef.production@example.com', role: Role.CHEF_SERVICE, direction: 'Direction des Opérations', service: 'Service Production', actif: true },
    { nom: 'Céline Girard', email: 'directeur.communication@example.com', role: Role.DIRECTEUR, direction: 'Direction de la Communication', actif: true },
    { nom: 'Laurent Fabre', email: 'chef.presse@example.com', role: Role.CHEF_SERVICE, direction: 'Direction de la Communication', service: 'Service Presse', actif: true },
    { nom: 'Sandrine Mercier', email: 'directeur.qualite@example.com', role: Role.DIRECTEUR, direction: 'Direction de la Qualité', actif: true },
    { nom: 'Olivier Blanc', email: 'chef.certification@example.com', role: Role.CHEF_SERVICE, direction: 'Direction de la Qualité', service: 'Service Certification', actif: true },
  ];

  // Créer les utilisateurs qui n'existent pas déjà
  const existingEmails = new Set(existingUsers.map(u => u.email));
  let createdCount = 0;
  
  for (const userData of usersToCreate) {
    if (!existingEmails.has(userData.email)) {
      try {
        // createUser gère déjà le cas "email has already been taken" côté API
        await adminService.createUser(userData);
        existingEmails.add(userData.email);
        createdCount++;
        
        // Log spécial pour George Mercier
        if (userData.email.includes('mercier')) {
          console.log('👤 GEORGE MERCIER CRÉÉ:', userData);
        }
      } catch (e) {
        console.warn('⚠️ Impossible de créer l\'utilisateur démo', userData.email, e);
      }
    }
  }

  console.log(`✅ ${createdCount} nouveaux utilisateurs créés`);
  console.log('✅ Données étendues initialisées avec succès');
};

