import { laravelApiService } from './services/laravelApiService';
import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store/store'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Role } from './types'
import { GlobalLoadingProvider } from './context/GlobalLoadingContext'
import { NetworkStatusProvider } from './context/NetworkStatusContext'
import { SyncStatusProvider } from './context/SyncStatusContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/WorkDashboard'
import CourrierWorkspace from './pages/CourrierWorkspace'
import AccountRecovery from './pages/AccountRecovery'
const ListeCourriers = lazy(() => import('./pages/ListeCourriers'))
const DetailCourrier = lazy(() => import('./pages/DetailCourrier'))
const EnregistrerCourrier = lazy(() => import('./pages/EnregistrerCourrier'))
const EnregistrerCourrierListe = lazy(() => import('./pages/EnregistrerCourrierListe'))
const RegistreCourriers = lazy(() => import('./pages/RegistreCourriers'))
const Workflow = lazy(() => import('./pages/Workflow'))
const Planning = lazy(() => import('./pages/Planning'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Profil = lazy(() => import('./pages/Profil'))
const Parametres = lazy(() => import('./pages/Parametres'))
const Archives = lazy(() => import('./pages/Archives'))
const ImpressionCourriers = lazy(() => import('./pages/ImpressionCourriers'))
import { initializeTestData } from './services/testDataService'
import { initializeExtendedData } from './services/initializeExtendedData'
import { initializeFirebaseDemoData } from './services/initializeFirebaseData'
import { userSettingsService } from './services/userSettingsService'
import './index.css'
import './workspace.css'
import './auth.css'
import Preloader from './components/Preloader'
import BrandLoader from './components/BrandLoader'
import './brand.css'
import LockScreen from './components/LockScreen'
const Rappels = lazy(() => import('./pages/Rappels'))
const NotificationsModule = lazy(() => import('./pages/NotificationsModule'))
const GestionCategoriesCourriers = lazy(() => import('./pages/GestionCategoriesCourriers'))
const StatistiquesCategoriesCourriers = lazy(() => import('./pages/StatistiquesCategoriesCourriers'))
const StatistiquesAvancees = lazy(() => import('./pages/StatistiquesAvancees'))
const CahierRegistre = lazy(() => import('./pages/CahierRegistre'))
if (import.meta.env.DEV) void import('./utils/testNotifications')

// Lazy loading pour l'organigramme
const Organigramme = lazy(() => import('./pages/Organigramme'))

// Génération automatique des courriers désactivée - utiliser le bouton dans la liste des courriers
// Initialiser les données de test au démarrage (création de courriers désactivée)
// initializeTestData() // Désactivé - ne crée plus de courriers automatiquement
// Initialiser les données étendues (directions, services, utilisateurs supplémentaires)
if (import.meta.env.DEV && !laravelApiService.isConfigured()) initializeExtendedData() // Cette fonction ne crée pas de courriers, seulement des entités et utilisateurs
// Initialisation automatique des données Firebase désactivée - utiliser le bouton dans la liste des courriers
// initializeFirebaseDemoData().catch(error => {
//   console.error('Erreur lors de l\'initialisation des données Firebase:', error)
// })

// Migrer automatiquement les paramètres localStorage vers Firestore au démarrage
// Cette migration s'exécute une seule fois et en arrière-plan
const migrationKey = 'settings_migration_completed';
if (import.meta.env.DEV && !laravelApiService.isConfigured() && !localStorage.getItem(migrationKey)) {
  userSettingsService.migrateAllSettings()
    .then(() => {
      localStorage.setItem(migrationKey, 'true');
      console.log('✅ Migration des paramètres vers Firestore terminée');
    })
    .catch((error) => {
      console.error('❌ Erreur lors de la migration des paramètres:', error);
    });
}

function CourrierDetailView() {
  const [params] = useSearchParams();
  return params.get('mode') === 'popout'
    ? <main className="courrier-popout-page"><DetailCourrier /></main>
    : <Layout><DetailCourrier /></Layout>;
}

function AppContent() {
  // Attendre que la session soit restaurée avant de rediriger vers /login (évite déconnexion au rechargement)
  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, authReady, locked } = useAuth();
    if (!authReady) {
      return <Preloader />;
    }
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return (
      <>
        <div style={{display: 'contents'}} ref={node => { if (node) node.inert = locked; }}>{children}</div>
        {locked && <LockScreen />}
      </>
    );
  };

  const DashboardOrRedirect: React.FC = () => {
    return <Dashboard />;
  };

  return (
        <BrowserRouter>
        <Suspense fallback={<BrandLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/mot-de-passe-oublie" element={<AccountRecovery mode="request" />} />
          <Route path="/reinitialiser-mot-de-passe" element={<AccountRecovery mode="reset" />} />
          <Route path="/confirmer-email" element={<AccountRecovery mode="confirm" />} />
          <Route path="/courriers/compact" element={<ProtectedRoute><Layout><CourrierWorkspace /></Layout></ProtectedRoute>} />
          <Route path="/courriers/avance" element={<ProtectedRoute><Layout><ListeCourriers /></Layout></ProtectedRoute>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardOrRedirect />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardOrRedirect />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/courriers"
            element={
              <ProtectedRoute>
                <Layout>
                  <ListeCourriers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/courriers/:id"
            element={
              <ProtectedRoute>
                <CourrierDetailView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/enregistrer"
            element={
              <ProtectedRoute>
                <Layout>
                  <EnregistrerCourrier />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/enregistrer-liste"
            element={
              <ProtectedRoute>
                <Layout>
                  <EnregistrerCourrierListe />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/registre"
            element={
              <ProtectedRoute>
                <Layout>
                  <RegistreCourriers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/organigramme"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<BrandLoader label="Chargement de l’organigramme…"/>}>
                    <Organigramme />
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflow"
            element={
              <ProtectedRoute>
                <Layout>
                  <Workflow />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rappels"
            element={
              <ProtectedRoute>
                <Layout>
                  <Rappels />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications-module"
            element={
              <ProtectedRoute>
                <Layout>
                  <NotificationsModule />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/planning"
            element={
              <ProtectedRoute>
                <Layout>
                  <Planning />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Layout>
                  <Notifications />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profil"
            element={
              <ProtectedRoute>
                <Layout>
                  <Profil />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/parametres"
            element={
              <ProtectedRoute>
                <Layout>
                  <Parametres />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cachet-accuse"
            element={
              <ProtectedRoute>
                <Layout>
                  <Parametres />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/archives"
            element={
              <ProtectedRoute>
                <Layout>
                  <Archives />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/impression/courriers"
            element={
              <ProtectedRoute>
                <Layout>
                  <ImpressionCourriers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gestion-categories"
            element={
              <ProtectedRoute>
                <Layout>
                  <GestionCategoriesCourriers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/statistiques-categories"
            element={
              <ProtectedRoute>
                <Layout>
                  <StatistiquesCategoriesCourriers />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/statistiques-avancees"
            element={
              <ProtectedRoute>
                <Layout>
                  <StatistiquesAvancees />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cahier-registre"
            element={
              <ProtectedRoute>
                <Layout>
                  <CahierRegistre />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
        </Suspense>
      </BrowserRouter>
  );
}

function App() {

  return (
    <Provider store={store}>
      <GlobalLoadingProvider>
        <NetworkStatusProvider>
          <SyncStatusProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          </SyncStatusProvider>
        </NetworkStatusProvider>
      </GlobalLoadingProvider>
    </Provider>
  );
}

// Single root instance (évite les doublons en hot-reload)
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

type RootWithStore = {
  __appRoot?: ReturnType<typeof ReactDOM.createRoot>;
};

const elementWithRoot = rootElement as HTMLElement & RootWithStore;
const root = elementWithRoot.__appRoot || ReactDOM.createRoot(rootElement);
elementWithRoot.__appRoot = root;

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
