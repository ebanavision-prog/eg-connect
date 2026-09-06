/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCcw } from 'lucide-react';
import { localDataService } from './services/localDataService';
import { auth, getUserData, getAllUsers, saveUserData } from './services/firebaseService';
import { serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  History,
  QrCode,
  User,
  LayoutDashboard,
  CheckCircle2,
  Bell,
  Plus,
  Menu,
  X,
  Briefcase,
  Building2,
  MessageSquare,
  Home
} from 'lucide-react';

import { Screen, UserProfile } from './types';
import { useAppStore } from './store/useAppStore';
import HomeScreen from './components/HomeScreen';
import OnboardingScreen from './components/OnboardingScreen';
import AppSidebar from './components/AppSidebar';

// El resto de pantallas se carga bajo demanda: Home es lo único que hace
// falta de inmediato en la primera carga, todo lo demás baja el bundle
// inicial en vez de venir todo junto (ver aviso de tamaño en `npm run build`).
const GrowthAnalyticsScreen = lazy(() => import('./components/GrowthAnalyticsScreen'));
const TimelineScreen = lazy(() => import('./components/TimelineScreen'));
const ScanScreen = lazy(() => import('./components/ScanScreen'));
const MapScreen = lazy(() => import('./components/MapScreen'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const DiscoverScreen = lazy(() => import('./components/DiscoverScreen'));
const InviteScreen = lazy(() => import('./components/InviteScreen'));
const SummaryScreen = lazy(() => import('./components/SummaryScreen'));
const TasksScreen = lazy(() => import('./components/TasksScreen'));
const SyncSettingsScreen = lazy(() => import('./components/SyncSettingsScreen'));
const EventsScreen = lazy(() => import('./components/EventsScreen'));
const MarketplaceScreen = lazy(() => import('./components/MarketplaceScreen'));
const CompaniesScreen = lazy(() => import('./components/CompaniesScreen'));
const ChatScreen = lazy(() => import('./components/ChatScreen'));
const FeedbackScreen = lazy(() => import('./components/FeedbackScreen'));
const TendersScreen = lazy(() => import('./components/TendersScreen'));
const CRMScreen = lazy(() => import('./components/CRMScreen'));
const InvestorsScreen = lazy(() => import('./components/InvestorsScreen'));
const InitiativesScreen = lazy(() => import('./components/InitiativesScreen'));
const SearchResultsScreen = lazy(() => import('./components/SearchResultsScreen'));

import NotificationCenter from './components/NotificationCenter';
import NetworkBackground from './components/NetworkBackground';
import Logo from './components/Logo';
import { AppNotification } from './types';

import { notificationService } from './services/notificationService';
import { useAppNotifications } from './hooks/useAppNotifications';
import { useUnreadMessages } from './hooks/useUnreadMessages';
import { listenForForegroundPush } from './services/pushService';

export default function App() {
  // La pantalla activa vive en la URL (React Router) en vez de en un useState —
  // esto le da a cada pantalla su propia dirección: enlaces compartibles y el
  // botón "atrás" del navegador funcionan de verdad. El resto del componente
  // no cambia: sigue leyendo/comparando `activeScreen` igual que antes.
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeScreen = (location.pathname === '/' ? 'home' : location.pathname.slice(1)) as Screen;
  const setActiveScreen = (screen: Screen) => navigate(screen === 'home' ? '/' : `/${screen}`);
  const [onboarded, setOnboarded] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Fase 1 del store ligero (ver docs/PLAN_MEJORA_360.md, sección 7 -- Fase 1):
  // `profileData`/`realUsers` ahora viven en un store de Zustand
  // (`src/store/useAppStore.ts`) en vez de en un `useState` local, pero la
  // lógica de carga/actualización de abajo (onAuthStateChanged, getAllUsers,
  // el refetch tras editar el perfil) es exactamente la misma que antes --
  // solo cambió dónde vive el estado, no qué hace. Las pantallas hijas siguen
  // recibiendo `profileData`/`realUsers` como props tal cual (Fase 1.5,
  // pendiente: migrarlas a leer del store directamente).
  const profileData = useAppStore((s) => s.currentUserProfile);
  const setProfileData = useAppStore((s) => s.setCurrentUserProfile);
  const realUsers = useAppStore((s) => s.realUsers);
  const setRealUsers = useAppStore((s) => s.setRealUsers);
  const [loading, setLoading] = useState(true);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(localDataService.getIsOnline());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await getAllUsers(100);
      setRealUsers(users);
    };
    if (onboarded) fetchUsers();
  }, [onboarded]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      try {
        if (user) {
          const data = await getUserData(user.uid);
          if (data) {
            // getUserData() devuelve `DocumentData` (el tipo genérico sin tipar
            // del SDK de Firestore) — este cast documenta el límite real del
            // sistema donde ese documento entra a la app ya con la forma de
            // `UserProfile`, sin cambiar qué dato llega ni cómo se usa.
            setProfileData(data as UserProfile);
            setOnboarded(true);
            // Sync with local service for backward compatibility if needed
            localDataService.saveUserProfile(data as any);
            // Marca de actividad real (para el re-enganche automático de
            // usuarios inactivos, ver .github/workflows/reengagement.yml y
            // scripts/reengagement-push.mjs) -- se guarda cada vez que hay
            // una sesión real confirmada (login fresco o refresh de la
            // pestaña con sesión ya activa), no solo en el login inicial.
            // Best-effort: si esto falla, no debe romper el resto del flujo
            // de carga del perfil.
            saveUserData(user.uid, { lastActiveAt: serverTimestamp() }).catch((err) => {
              console.warn('No se pudo actualizar lastActiveAt:', err);
            });
          } else {
            setOnboarded(false);
          }
        } else {
          setProfileData(null);
          setOnboarded(false);
        }
      } catch (error) {
        // Sin esto, un fallo de red/Firestore aquí dejaba la app atascada
        // para siempre en la pantalla de "Cargando..." — nunca se llegaba a
        // setLoading(false).
        console.error('Error cargando el perfil:', error);
        setOnboarded(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = localDataService.onStatusChange((online) => {
      setIsOnline(online);
      if (online) {
        setSyncStatus('syncing');
        setTimeout(() => setSyncStatus('synced'), 2000);
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Simulate a push notification after a short delay if onboarded
    if (onboarded) {
      const timer = setTimeout(() => {
        notificationService.simulatePush(
          'alert',
          t('nav.welcomePushTitle'),
          t('nav.welcomePushBody')
        );
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [onboarded]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<'individual' | 'company'>('individual');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [lastNotification, setLastNotification] = useState<AppNotification | null>(null);
  const [chatParticipant, setChatParticipant] = useState<{ id: string; name: string; avatar: string } | undefined>(undefined);

  // El centro de notificaciones antes era 100% de mentira: un único aviso de
  // licitación fabricado por un setTimeout de 15s, siempre el mismo texto,
  // sin relación con datos reales. Ahora se deriva de Firestore de verdad
  // (solicitudes de conexión + licitaciones publicadas) — ver el hook.
  const usersById = useMemo(() => {
    const map: Record<string, string> = {};
    realUsers.forEach((u) => { if (u.uid) map[u.uid] = u.name; });
    return map;
  }, [realUsers]);
  const { notifications, markAsRead, clearAll: clearAllNotifications, unreadCount: unreadNotifCount } =
    useAppNotifications(firebaseUser?.uid, usersById);

  // Avisa con un toast solo cuando llega una notificación nueva de verdad
  // mientras la app está abierta — no en la carga inicial de las que ya existían.
  const seenNotifIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (seenNotifIds.current === null) {
      seenNotifIds.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const fresh = notifications.find((n) => !seenNotifIds.current!.has(n.id));
    notifications.forEach((n) => seenNotifIds.current!.add(n.id));
    if (fresh) {
      setLastNotification(fresh);
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const { unreadCount: unreadMessageCount } = useUnreadMessages(firebaseUser?.uid);

  // Push real (FCM) mientras la app está abierta: FCM no muestra sola una
  // notificación de sistema si la pestaña tiene foco, así que se crea a mano
  // con el contenido real que llegó. Sin efecto si el dispositivo nunca
  // activó push (isPushConfigured()===false o el usuario no dio permiso) —
  // listenForForegroundPush() no hace nada en ese caso.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (firebaseUser) {
      listenForForegroundPush((title, body) => notificationService.sendNotification(title, body)).then((unsub) => {
        unsubscribe = unsub;
      });
    }
    return () => unsubscribe?.();
  }, [firebaseUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <NetworkBackground color="rgba(1, 102, 114, 0.1)" />
        <Logo size={80} className="animate-pulse" />
        <p className="mt-4 text-xs font-bold text-primary uppercase tracking-[0.3em]">{t('nav.loading')}</p>
      </div>
    );
  }

  if (!onboarded) {
    return <OnboardingScreen onComplete={(data) => {
      // OnboardingScreen.onComplete's propio tipo declara `profileType:
      // string` (más ancho que el `'individual' | 'company'` real de
      // UserProfile) — mismo límite documentado que en getUserData() arriba.
      setProfileData(data as UserProfile);
      setOnboarded(true);
    }} />;
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home': return <HomeScreen
        onNavigate={handleNavClick}
        onSearch={handleGlobalSearch}
        stats={{ connections: realUsers.length || 0, tasks: 0, unreadChats: unreadMessageCount }}
        userProfile={profileData}
        realUsers={realUsers}
        onContact={startChat}
      />;
      case 'timeline': return <TimelineScreen onChat={startChat} users={realUsers} currentUserName={profileData?.name || 'Yo'} />;
      case 'scan': return <ScanScreen onBack={() => setActiveScreen('home')} />;
      case 'map': return <MapScreen
        users={realUsers}
        profileData={profileData}
        onContact={startChat}
        onUpdateProfile={(data) => setProfileData(data)}
      />;
      case 'profile': return <ProfileScreen 
        onSettings={() => setActiveScreen('sync-settings')} 
        activeProfile={activeProfile} 
        onToggleProfile={setActiveProfile}
        profileData={profileData}
        onUpdateProfile={(data) => {
          setProfileData(data);
          // realUsers is a one-shot snapshot fetched on boot -- without this,
          // toggling "Soy Inversionista" (or any profile change) saved fine but
          // never showed up in InvestorsScreen/HomeScreen until a full reload,
          // even though those screens filter the very same realUsers array.
          getAllUsers(100).then(setRealUsers);
        }}
      />;
      case 'groups': return <DiscoverScreen users={realUsers} onContact={startChat} />;
      case 'summary': return <SummaryScreen onNavigate={(s) => setActiveScreen(s as Screen)} />;
      case 'invite': return <InviteScreen profileData={profileData} />;
      case 'tasks': return <TasksScreen />;
      case 'events': return <EventsScreen profileData={profileData} />;
      case 'marketplace': return <MarketplaceScreen
        activeProfile={activeProfile}
        onContact={(p) => p ? startChat(p) : setActiveScreen('chat')}
        initialSearchQuery={globalSearchTerm}
        profileData={profileData}
      />;
      case 'companies': return <CompaniesScreen onChat={(p) => p ? startChat(p) : setActiveScreen('chat')} profileData={profileData} />;
      case 'chat': return <ChatScreen initialParticipant={chatParticipant} users={realUsers} />;
      case 'sync-settings': return <SyncSettingsScreen onBack={() => setActiveScreen('profile')} />;
      case 'feedback': return <FeedbackScreen onBack={() => setActiveScreen('home')} />;
      case 'tenders': return <TendersScreen profileData={profileData} />;
      case 'crm': return <CRMScreen />;
      case 'investors': return <InvestorsScreen users={realUsers} onContact={startChat} profileData={profileData} />;
      case 'initiatives': return <InitiativesScreen profileData={profileData} />;
      case 'search': return <SearchResultsScreen query={globalSearchTerm} users={realUsers} onContact={startChat} onNavigate={(s) => setActiveScreen(s as Screen)} />;
      case 'growth-analytics': return <GrowthAnalyticsScreen onBack={() => setActiveScreen('home')} profileData={profileData} />;
      default: return <HomeScreen
        onNavigate={handleNavClick}
        onSearch={handleGlobalSearch}
        stats={{ connections: realUsers.length || 0, tasks: 0, unreadChats: unreadMessageCount }}
        userProfile={profileData}
        realUsers={realUsers}
        onContact={startChat}
      />;
    }
  };

  const navItems = [
    { id: 'home', icon: Home, label: t('nav.bottom.home') },
    { id: 'timeline', icon: History, label: t('nav.bottom.recent') },
    { id: 'scan', icon: QrCode, label: t('nav.bottom.scan') },
    { id: 'groups', icon: LayoutDashboard, label: t('nav.bottom.discover') }
  ];

  const handleNavClick = (id: string) => {
    if (id !== 'chat') setChatParticipant(undefined);
    if (id !== 'marketplace' && id !== 'search') setGlobalSearchTerm('');
    setActiveScreen(id as Screen);
    setIsSidebarOpen(false);
  };

  // Antes esto solo mandaba a Marketplace, aunque la caja de búsqueda decía
  // "Buscar profesionales, socios o licitaciones" — ahora sí busca en toda la red.
  const handleGlobalSearch = (query: string) => {
    setGlobalSearchTerm(query);
    setActiveScreen('search');
  };

  const startChat = (participant: { id: string; name: string; avatar: string }) => {
    setChatParticipant(participant);
    setActiveScreen('chat');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      <NetworkBackground color="rgba(1, 102, 114, 0.1)" />
      {/* Global Offline/Sync Status Indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-error text-white px-4 py-2 rounded-full shadow-lg font-bold text-xs uppercase tracking-widest"
          >
            <WifiOff className="w-3 h-3" />
            <span>{t('nav.offlineBanner')}</span>
          </motion.div>
        )}
        {isOnline && syncStatus !== 'idle' && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className={`${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-primary'} fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 text-white px-4 py-2 rounded-full shadow-lg font-bold text-xs uppercase tracking-widest transition-colors`}
          >
            {syncStatus === 'syncing' ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
            <span>{syncStatus === 'syncing' ? t('nav.syncing') : t('nav.synced')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeScreen={activeScreen}
        onNavigate={handleNavClick}
        activeProfile={activeProfile}
        onSetActiveProfile={setActiveProfile}
        profileData={profileData}
        unreadMessageCount={unreadMessageCount}
        onSignOut={() => auth.signOut()}
      />

      {/* Background Ornaments */}
      <div className="fixed top-1/2 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/4 -left-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="sticky top-0 z-50 glass-effect">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 rounded-full hover:bg-surface-container-low transition-colors outline-hidden"
            >
              <Menu className="w-6 h-6 text-primary" />
            </button>
            <div className="flex items-center gap-2">
              <Logo size={40} className="sm:hidden" />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
                <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t('nav.header.syncedBadge')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Profile Switcher */}
            <div className="flex bg-surface-container-high p-1 rounded-full items-center">
              <button 
                onClick={() => setActiveProfile('individual')}
                className={`p-1.5 rounded-full transition-all ${
                  activeProfile === 'individual' 
                    ? 'bg-white text-secondary shadow-sm' 
                    : 'text-on-surface-variant opacity-40 hover:opacity-100'
                }`}
                title={t('nav.header.personalProfileTitle')}
              >
                <User className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActiveProfile('company')}
                className={`p-1.5 rounded-full transition-all ${
                  activeProfile === 'company'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-surface-variant opacity-40 hover:opacity-100'
                }`}
                title={t('nav.header.companyProfileTitle')}
              >
                <Building2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button 
              onClick={() => setIsNotificationOpen(true)}
              className="p-2 rounded-full hover:bg-surface-container-high transition-colors relative outline-hidden"
            >
              <Bell className="w-5 h-5 text-on-surface-variant" />
              {unreadNotifCount > 0 && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full" />
              )}
            </button>
            <button 
              onClick={() => setActiveScreen('profile')}
              className="w-10 h-10 rounded-full border-2 border-primary/10 overflow-hidden outline-hidden active:scale-95 transition-transform"
            >
              <img 
                src={profileData?.avatar || (activeProfile === 'individual' 
                  ? "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150"
                  : "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=150&h=150")
                }
                alt={t('nav.header.avatarAlt')}
                className="w-full h-full object-cover transition-all duration-500"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Notification Center overlay */}
      <AnimatePresence>
        {isNotificationOpen && (
          <NotificationCenter
            notifications={notifications}
            onClose={() => setIsNotificationOpen(false)}
            onMarkAsRead={markAsRead}
            onClearAll={clearAllNotifications}
            onNavigate={setActiveScreen}
          />
        )}
      </AnimatePresence>

      {/* Toast para una notificación real recién llegada */}
      <AnimatePresence>
        {showToast && lastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -100, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -100, x: '-50%' }}
            className="fixed top-0 left-1/2 z-[150] w-full max-w-sm px-4"
          >
            <div className="bg-primary-container text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20">
              <div className="bg-secondary-container p-2 rounded-xl">
                <Briefcase className="w-5 h-5 text-on-secondary-container" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                  {lastNotification.type === 'tender' ? t('nav.toast.newTender') : t('nav.toast.notification')}
                </p>
                <p className="text-sm font-bold leading-tight">{lastNotification.title}</p>
              </div>
              <button
                onClick={() => setShowToast(false)}
                className="p-1 hover:bg-white/10 rounded-full outline-hidden transition-colors"
                aria-label={t('nav.toast.closeAria')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-screen-xl mx-auto px-6 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <Suspense fallback={<div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" /></div>}>
              {renderScreen()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Action Bar */}
      <div className="fixed right-6 bottom-28 flex flex-col items-center gap-3 z-40">
        <AnimatePresence>
          {activeScreen !== 'scan' && (
            <>
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                onClick={() => setActiveScreen('scan')}
                className="w-12 h-12 bg-white text-primary rounded-full shadow-lg border border-primary/10 flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-90 outline-hidden group"
                title={t('nav.fab.scanCard')}
              >
                <QrCode className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </motion.button>
              
              <motion.button
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                transition={{ delay: 0.1 }}
                onClick={() => setActiveScreen('chat')}
                className="w-12 h-12 bg-white text-secondary rounded-full shadow-lg border border-secondary/10 flex items-center justify-center hover:bg-secondary hover:text-white transition-all active:scale-90 outline-hidden group"
                title={t('nav.fab.newMessage')}
              >
                <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </motion.button>

              <motion.button
                layoutId="main-fab"
                onClick={() => setActiveScreen('timeline')}
                className="w-14 h-14 bg-primary text-white rounded-full shadow-xl shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-hidden relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
                <Plus className="w-6 h-6" />
              </motion.button>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 rounded-t-[2.5rem] glass-effect border-t border-outline/10 shadow-[0_-8px_32px_rgba(21,21,125,0.08)]">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex justify-around items-center">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id as Screen)}
              className={`flex flex-col items-center gap-1 transition-all duration-300 outline-hidden ${
                activeScreen === item.id 
                  ? 'text-primary scale-110' 
                  : 'text-on-surface-variant opacity-60 hover:opacity-100'
              }`}
            >
              <div className={`p-2 rounded-full transition-colors ${
                activeScreen === item.id ? 'bg-primary/10' : ''
              }`}>
                <item.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
