import { profileRequest } from '../services/profileService';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Utilisateur, Role, Permission } from '../types';
import { adminService } from '../services/adminService';
import { laravelApiService, getAuthToken } from '../services/laravelApiService';
import { formulaireCourrierService } from '../services/formulaireCourrierService';

interface AuthContextType {
  user: Utilisateur | null;
  refreshProfile: (profile: Utilisateur) => void;
  completeSecureLogin: (token: string) => Promise<void>;
  authReady: boolean;
  locked: boolean;
  lockSession: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  logout: () => void;
  unlockWithPassword: (password: string) => Promise<boolean>;
  isAuthenticated: boolean;
  hasRole: (role: Role | Role[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAccessToDirection: (direction: string) => boolean;
  hasAccessToService: (service: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialiser les utilisateurs par défaut
const initializeDefaultUsers = () => {
  const existingUsers = adminService.getAllUsers();
  
  // Toujours vérifier que le super admin existe
  const superAdminExists = existingUsers.some(u => u.email === 'admin@example.com');
  if (!superAdminExists) {
    adminService.createUser({
      nom: 'Super Admin',
      email: 'admin@example.com',
      role: Role.SUPER_ADMIN,
      actif: true
    });
  }
  
  // Toujours s'assurer que Marie Dupont a la bonne direction (secrétaire DG)
  const marieDupont = existingUsers.find(u => u.email === 'secretaire@example.com');
  console.log('🔍 Vérification Marie Dupont:', marieDupont ? {
    nom: marieDupont.nom,
    direction: marieDupont.direction,
    needsUpdate: !marieDupont.direction || marieDupont.direction !== 'Direction Générale'
  } : 'Non trouvée');
  
  if (marieDupont && (!marieDupont.direction || marieDupont.direction !== 'Direction Générale')) {
    console.log('🔄 Mise à jour de Marie Dupont vers Direction Générale');
    adminService.updateUser(marieDupont.id, { direction: 'Direction Générale' });
  }
  
  // Créer les autres utilisateurs de démo seulement s'il n'y a pas d'utilisateurs
  if (existingUsers.length === 0 || (existingUsers.length === 1 && !superAdminExists)) {
    // Mettre à jour les secrétaires sans direction
    existingUsers.forEach(user => {
      if (user.role === Role.SECRETAIRE && !user.direction) {
        adminService.updateUser(user.id, { direction: 'Direction Générale' });
      }
    });
    
    // Créer d'autres utilisateurs de démo
    if (!existingUsers.some(u => u.email === 'secretaire@example.com')) {
      adminService.createUser({
        nom: 'Marie Dupont',
        email: 'secretaire@example.com',
        role: Role.SECRETAIRE,
        direction: 'Direction Générale',
        actif: true
      });
    } else {
      // Mettre à jour Marie Dupont si elle existe sans direction
      const marieDupont = existingUsers.find(u => u.email === 'secretaire@example.com');
      if (marieDupont && !marieDupont.direction) {
        adminService.updateUser(marieDupont.id, { direction: 'Direction Générale' });
      }
    }
    
    if (!existingUsers.some(u => u.email === 'dg@example.com')) {
      adminService.createUser({
        nom: 'Jean Martin',
        email: 'dg@example.com',
        role: Role.DIRECTEUR_GENERAL,
        actif: true
      });
    }
    
    // Ajouter des utilisateurs avec directions et services pour l'organigramme
    if (!existingUsers.some(u => u.email === 'directeur.admin@example.com')) {
      adminService.createUser({
        nom: 'Sophie Bernard',
        email: 'directeur.admin@example.com',
        role: Role.DIRECTEUR,
        direction: 'Direction Administrative',
        actif: true
      });
    }
    
    if (!existingUsers.some(u => u.email === 'chef.rh@example.com')) {
      adminService.createUser({
        nom: 'Pierre Durand',
        email: 'chef.rh@example.com',
        role: Role.CHEF_SERVICE,
        direction: 'Direction Administrative',
        service: 'Service RH',
        actif: true
      });
    }
    
    if (!existingUsers.some(u => u.email === 'agent.rh@example.com')) {
      adminService.createUser({
        nom: 'Lucie Moreau',
        email: 'agent.rh@example.com',
        role: Role.AGENT,
        direction: 'Direction Administrative',
        service: 'Service RH',
        actif: true
      });
    }
    
    if (!existingUsers.some(u => u.email === 'directeur.fin@example.com')) {
      adminService.createUser({
        nom: 'Thomas Lefebvre',
        email: 'directeur.fin@example.com',
        role: Role.DIRECTEUR,
        direction: 'Direction Financière',
        actif: true
      });
    }
    
    if (!existingUsers.some(u => u.email === 'chef.compta@example.com')) {
      adminService.createUser({
        nom: 'Emma Petit',
        email: 'chef.compta@example.com',
        role: Role.CHEF_SERVICE,
        direction: 'Direction Financière',
        service: 'Service Comptabilité',
        actif: true
      });
    }
    
    if (!existingUsers.some(u => u.email === 'agent.compta@example.com')) {
      adminService.createUser({
        nom: 'Marc Dubois',
        email: 'agent.compta@example.com',
        role: Role.AGENT,
        direction: 'Direction Financière',
        service: 'Service Comptabilité',
        actif: true
      });
    }
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Utilisateur | null>(null);
  const refreshProfile = (profile: Utilisateur) => {
    setUser(current => {
      if (!current || current.id !== profile.id) return current;
      const updated = { ...current, nom: profile.nom, photoUrl: profile.photoUrl };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };
  const [authReady, setAuthReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const lockSession = () => {
    localStorage.setItem('session_locked', 'true');
    laravelApiService.clearAuthToken();
    setLocked(true);
  };
  useEffect(() => {
    const syncLock = (event: StorageEvent) => { if (event.key === 'session_locked' && event.newValue === 'true') { laravelApiService.clearAuthToken(); setLocked(true); } };
    window.addEventListener('storage', syncLock);
    return () => window.removeEventListener('storage', syncLock);
  }, []);
  const completeSecureLogin = async (token: string) => {
    laravelApiService.setAuthToken(token);
    const me = await laravelApiService.getMe();
    if (!me) throw new Error('Connexion impossible. Veuillez réessayer.');
    localStorage.removeItem('session_locked');
    setUser(me); setLocked(false); localStorage.setItem('user', JSON.stringify(me));
  };

  useEffect(() => {
    // Utilisateurs par défaut uniquement en mode local (pas d'API) ; sinon la base Laravel fait foi
    if (!laravelApiService.isConfigured()) {
      initializeDefaultUsers();
    }

    const savedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    const parsed = savedUser ? (() => { try { return JSON.parse(savedUser); } catch { return null; } })() : null;

    let disposed = false;
    let settled = false;
    const api = laravelApiService.isConfigured();
    const showLocked = () => {
      if (disposed) return;
      settled = true;
      laravelApiService.clearAuthToken();
      setUser(parsed?.email ? parsed : null);
      setLocked(Boolean(parsed?.email));
      if (parsed?.email) localStorage.setItem('session_locked', 'true');
      setAuthReady(true);
    };
    const expired = () => {
      laravelApiService.clearAuthToken();
      localStorage.setItem('session_locked', 'true');
      setLocked(true);
    };
    window.addEventListener('auth:expired', expired);
    const timeoutId = setTimeout(() => { if (!settled && api) showLocked(); }, 12000);
    const restoreSession = async () => {
      if (!api) {
        if (!disposed) { setUser(parsed); setAuthReady(true); settled = true; }
        return;
      }
      if (localStorage.getItem('session_locked') === 'true' || !getAuthToken()) {
        showLocked();
        return;
      }
      try {
        // Validate the JWT before loading any privileged lists or displaying cached identity as active.
        const me = await laravelApiService.getMe();
        if (disposed || settled) return;
        if (!me) { showLocked(); return; }
        settled = true;
        setUser(me); setLocked(false);
        localStorage.setItem('user', JSON.stringify(me));
        setAuthReady(true);
        void Promise.allSettled([adminService.refreshUsersFromApi(), adminService.refreshRolesFromApi(), formulaireCourrierService.getConfigAsync()]);
      } catch {
        showLocked();
      }
    };
    void restoreSession().finally(() => clearTimeout(timeoutId));
    return () => { disposed = true; clearTimeout(timeoutId); window.removeEventListener('auth:expired', expired); };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    if (laravelApiService.isConfigured()) {
      const token = await laravelApiService.login(email, password);
      if (token) {
        laravelApiService.setAuthToken(token);
        const me = await laravelApiService.getMe();
        if (me) {
          localStorage.removeItem('session_locked');
          setUser(me);
          setLocked(false);
          localStorage.setItem('user', JSON.stringify(me));
          await Promise.all([adminService.refreshUsersFromApi(), adminService.refreshRolesFromApi()]);
          await formulaireCourrierService.getConfigAsync().catch(() => {});
          return true;
        }
      }
      return false;
    }
    // Mode local (démo) : utilisateurs adminService + mot de passe "password"
    const allUsers = adminService.getAllUsers();
    const foundUser = allUsers.find(u => u.email === email && u.actif);
    if (foundUser && password === 'password') {
      localStorage.removeItem('session_locked');
      setUser(foundUser);
      setLocked(false);
      localStorage.setItem('user', JSON.stringify(foundUser));
      return true;
    }
    return false;
  };

  const unlockWithPassword = async (password: string): Promise<boolean> => {
    if (!user?.email) return false;
    const ok = await login(user.email, password);
    if (ok) setLocked(false);
    return ok;
  };

  const loginWithGoogle = async (credential: string): Promise<boolean> => {
    const response = await profileRequest<{token?: string; twoFactorRequired?: boolean; challenge?: string}>('auth/google', {credential});
    if (response.twoFactorRequired && response.challenge) throw Object.assign(new Error('Confirmez votre identité.'), {challenge: response.challenge});
    if (!response.token) return false;
    await completeSecureLogin(response.token);
    return true;
  };

  const logout = () => {
    localStorage.removeItem('session_locked');
    setUser(null);
    setLocked(false);
    localStorage.removeItem('user');
    laravelApiService.clearAuthToken();
  };

  const hasRole = (role: Role | Role[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  const hasAccessToDirection = (direction: string): boolean => {
    if (!user) return false;
    // Le DG et le secrétaire ont accès à toutes les directions
    if (user.role === Role.DIRECTEUR_GENERAL || user.role === Role.SECRETAIRE) {
      return true;
    }
    return user.direction === direction;
  };

  const hasAccessToService = (service: string): boolean => {
    if (!user) return false;
    // Le super admin, DG et le secrétaire ont accès à tous les services
    if (user.role === Role.SUPER_ADMIN || user.role === Role.DIRECTEUR_GENERAL || user.role === Role.SECRETAIRE) {
      return true;
    }
    // Le directeur a accès à tous les services de sa direction
    if (user.role === Role.DIRECTEUR) {
      return true; // Simplifié pour la démo
    }
    return user.service === service;
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    // Le super admin et le directeur général ont toutes les permissions
    if (Array.isArray(user.permissions)) return user.permissions.includes(permission);
    
    // Vérifier les permissions du rôle
    const roles = adminService.getAllRoles();
    const roleDef = roles.find(r => r.code === user.role);
    if (roleDef && roleDef.permissions.includes(permission)) {
      return true;
    }
    
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        refreshProfile,
        completeSecureLogin,
        authReady,
        locked,
        lockSession,
        login,
        loginWithGoogle,
        logout,
        unlockWithPassword,
        isAuthenticated: !!user && !locked,
        hasRole,
        hasPermission,
        hasAccessToDirection,
        hasAccessToService
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

