/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCcw, Share2 } from 'lucide-react';
import { localDataService } from './services/localDataService';
import { auth, getUserData, getAllUsers } from './services/firebaseService';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  History, 
  QrCode, 
  Map as MapIcon, 
  User, 
  LayoutDashboard, 
  CheckCircle2, 
  Bell,
  Plus,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Wifi,
  Calendar,
  ShoppingBag,
  Briefcase,
  Building2,
  MessageSquare,
  Home,
  Heart,
  Users,
  Handshake,
  Rocket
} from 'lucide-react';

import { Screen } from './types';
import HomeScreen from './components/HomeScreen';
import OnboardingScreen from './components/OnboardingScreen';

// El resto de pantallas se carga bajo demanda: Home es lo único que hace
// falta de inmediato en la primera carga, todo lo demás baja el bundle
// inicial en vez de venir todo junto (ver aviso de tamaño en `npm run build`).
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

import NotificationCenter from './components/NotificationCenter';
import NetworkBackground from './components/NetworkBackground';
import Logo from './components/Logo';
import { AppNotification } from './types';

import { notificationService } from './services/notificationService';

export default function App() {
  // La pantalla activa vive en la URL (React Router) en vez de en un useState —
  // esto le da a cada pantalla su propia dirección: enlaces compartibles y el
  // botón "atrás" del navegador funcionan de verdad. El resto del componente
  // no cambia: sigue leyendo/comparando `activeScreen` igual que antes.
  const navigate = useNavigate();
  const location = useLocation();
  const activeScreen = (location.pathname === '/' ? 'home' : location.pathname.slice(1)) as Screen;
  const setActiveScreen = (screen: Screen) => navigate(screen === 'home' ? '/' : `/${screen}`);
  const [onboarded, setOnboarded] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(localDataService.getIsOnline());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [realUsers, setRealUsers] = useState<any[]>([]);

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
            setProfileData(data);
            setOnboarded(true);
            // Sync with local service for backward compatibility if needed
            localDataService.saveUserProfile(data as any);
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
          '¡Bienvenido a EG CONNECT!', 
          'Explora las nuevas licitaciones locales disponibles hoy.'
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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Simulation: Add a new tender notification for companies after a delay
  useEffect(() => {
    if (activeProfile === 'company' && onboarded) {
      const timer = setTimeout(() => {
        const newNotif: AppNotification = {
          id: `notif-${Date.now()}`,
          title: 'Nueva Licitación Coincidente',
          message: 'Se ha detectado una nueva oportunidad en tu sector que coincide con tu perfil corporativo.',
          type: 'tender',
          timestamp: 'Ahora mismo',
          isRead: false
        };
        setNotifications(prev => [newNotif, ...prev]);
        setLastNotification(newNotif);
        setShowToast(true);
        
        // Hide toast after 5 seconds
        setTimeout(() => setShowToast(false), 5000);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [activeProfile, onboarded]);

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const clearAllNotifications = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const unreadNotifCount = notifications.filter(n => !n.isRead).length;
  const unreadMessageCount = 0; // Reset unread messages count

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <NetworkBackground color="rgba(1, 102, 114, 0.1)" />
        <Logo size={80} className="animate-pulse" />
        <p className="mt-4 text-xs font-bold text-primary uppercase tracking-[0.3em]">Cargando...</p>
      </div>
    );
  }

  if (!onboarded) {
    return <OnboardingScreen onComplete={(data) => {
      setProfileData(data);
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
      />;
      case 'timeline': return <TimelineScreen onChat={startChat} users={realUsers} />;
      case 'scan': return <ScanScreen onBack={() => setActiveScreen('home')} />;
      case 'map': return <MapScreen />;
      case 'profile': return <ProfileScreen 
        onSettings={() => setActiveScreen('sync-settings')} 
        activeProfile={activeProfile} 
        onToggleProfile={setActiveProfile}
        profileData={profileData}
        onUpdateProfile={(data) => setProfileData(data)}
      />;
      case 'groups': return <DiscoverScreen users={realUsers} onContact={startChat} />;
      case 'summary': return <SummaryScreen />;
      case 'invite': return <InviteScreen />;
      case 'tasks': return <TasksScreen />;
      case 'events': return <EventsScreen profileData={profileData} />;
      case 'marketplace': return <MarketplaceScreen
        activeProfile={activeProfile}
        onContact={(p) => p ? startChat(p) : setActiveScreen('chat')}
        initialSearchQuery={globalSearchTerm}
        profileData={profileData}
      />;
      case 'companies': return <CompaniesScreen onChat={(p) => p ? startChat(p) : setActiveScreen('chat')} />;
      case 'chat': return <ChatScreen initialParticipant={chatParticipant} users={realUsers} />;
      case 'sync-settings': return <SyncSettingsScreen onBack={() => setActiveScreen('profile')} />;
      case 'feedback': return <FeedbackScreen onBack={() => setActiveScreen('home')} />;
      case 'tenders': return <TendersScreen />;
      case 'crm': return <CRMScreen />;
      case 'investors': return <InvestorsScreen users={realUsers} onContact={startChat} />;
      case 'initiatives': return <InitiativesScreen profileData={profileData} />;
      default: return <HomeScreen 
        onNavigate={handleNavClick} 
        onSearch={handleGlobalSearch} 
        stats={{ connections: realUsers.length || 0, tasks: 0, unreadChats: unreadMessageCount }} 
        userProfile={profileData}
        realUsers={realUsers}
      />;
    }
  };

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'timeline', icon: History, label: 'Reciente' },
    { id: 'scan', icon: QrCode, label: 'Escanear' },
    { id: 'groups', icon: LayoutDashboard, label: 'Descubrir' }
  ];

  const handleNavClick = (id: string) => {
    if (id !== 'chat') setChatParticipant(undefined);
    if (id !== 'marketplace') setGlobalSearchTerm('');
    setActiveScreen(id as Screen);
    setIsSidebarOpen(false);
  };

  const handleGlobalSearch = (query: string) => {
    setGlobalSearchTerm(query);
    setActiveScreen('marketplace');
  };

  const startChat = (participant: { id: string; name: string; avatar: string }) => {
    setChatParticipant(participant);
    setActiveScreen('chat');
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      <NetworkBackground color="rgba(1, 102, 114, 0.1)" />
      {/* Sidebar Overlay */}
      <AnimatePresence>
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
              <span>Modo Sin Conexión</span>
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
              <span>{syncStatus === 'syncing' ? 'Sincronizando' : 'Sincronizado'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[85%] max-w-sm bg-surface z-[70] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex justify-between items-center mb-10">
                <Logo size={48} showText />
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high outline-hidden transition-colors">
                  <X className="w-6 h-6 text-on-surface-variant" />
                </button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-4 px-4">Utilidades</p>
                <button 
                  onClick={() => handleNavClick('map')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'map' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <MapIcon className="w-5 h-5" />
                  <span className="font-bold">Mapa de Conexiones</span>
                  <div className="ml-auto flex items-center gap-1.5 bg-secondary-container px-2 py-0.5 rounded-full">
                    <Wifi className="w-2.5 h-2.5 text-on-secondary-container" />
                    <span className="text-[8px] font-bold text-on-secondary-container tracking-tighter">OFFLINE</span>
                  </div>
                </button>
                <button 
                  onClick={() => handleNavClick('events')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'events' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Calendar className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Agenda de Eventos</span>
                </button>
                <button 
                  onClick={() => handleNavClick('tenders')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'tenders' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Briefcase className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Licitaciones y Proyectos</span>
                </button>
                <button 
                  onClick={() => handleNavClick('groups')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'groups' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <LayoutDashboard className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Descubrir Usuarios</span>
                </button>
                <button 
                  onClick={() => handleNavClick('invite')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'invite' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Share2 className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Impulsar Red</span>
                </button>
                <button 
                  onClick={() => handleNavClick('crm')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'crm' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Users className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Gestor de Relaciones (CRM)</span>
                </button>
                <button 
                  onClick={() => handleNavClick('marketplace')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'marketplace' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <ShoppingBag className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Marketplace</span>
                  <div className="ml-auto bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Nuevo</div>
                </button>
                <button 
                  onClick={() => handleNavClick('companies')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'companies' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Building2 className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Empresas (Ecosistema)</span>
                </button>
                <button
                  onClick={() => handleNavClick('investors')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'investors' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Handshake className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Inversionistas</span>
                </button>
                <button
                  onClick={() => handleNavClick('initiatives')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'initiatives' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Rocket className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Iniciativas y Proyectos</span>
                </button>
                <button
                  onClick={() => handleNavClick('chat')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'chat' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <MessageSquare className="w-5 h-5 text-secondary" />
                  <span className="font-bold">Mensajería</span>
                  {unreadMessageCount > 0 && (
                    <div className="ml-auto bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadMessageCount}
                    </div>
                  )}
                </button>
                <button 
                  onClick={() => handleNavClick('tasks')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'tasks' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold">Mis Tareas</span>
                </button>
                <button 
                  onClick={() => handleNavClick('sync-settings')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'sync-settings' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-bold">Sincronización</span>
                </button>
                <button 
                  onClick={() => handleNavClick('feedback')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'feedback' ? 'bg-secondary/10 text-secondary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <Heart className="w-5 h-5" />
                  <span className="font-bold">Feedback y Propuestas</span>
                </button>
                
                <div className="pt-8 space-y-2">
                  <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-4 px-4">Intercambiar Perfil</p>
                  <div className="grid grid-cols-2 gap-2 px-2 mb-4">
                    <button 
                      onClick={() => setActiveProfile('individual')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border ${
                        activeProfile === 'individual' 
                          ? 'bg-secondary/10 border-secondary text-secondary' 
                          : 'bg-surface-container-low border-transparent text-on-surface-variant opacity-60'
                      }`}
                    >
                      <User className="w-5 h-5" />
                      <span className="text-[9px] font-bold uppercase tracking-tighter">Personal</span>
                    </button>
                    <button 
                      onClick={() => setActiveProfile('company')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border ${
                        activeProfile === 'company' 
                          ? 'bg-primary/10 border-primary text-primary' 
                          : 'bg-surface-container-low border-transparent text-on-surface-variant opacity-60'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                      <span className="text-[9px] font-bold uppercase tracking-tighter">Empresa</span>
                    </button>
                  </div>

                  <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-4 px-4">Cuenta</p>
                  <button 
                    onClick={() => handleNavClick('profile')}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'profile' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                  >
                    <User className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-bold">{activeProfile === 'individual' ? 'Mi Perfil' : 'Perfil de Empresa'}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {profileData?.name || 'Usuario'}
                      </p>
                    </div>
                    <ChevronRight className="ml-auto w-4 h-4 opacity-40" />
                  </button>
                </div>
              </div>

              <div className="mt-auto border-t border-outline/10 pt-6">
                <button 
                  onClick={() => auth.signOut()}
                  className="w-full flex items-center gap-4 px-4 py-4 text-error font-bold rounded-2xl hover:bg-error-container/10 transition-all outline-hidden"
                >
                  <LogOut className="w-5 h-5" />
                  Salir de la sesión
                </button>
                <div className="mt-6 text-center space-y-1">
                  <p className="text-[10px] text-on-surface-variant font-bold opacity-40 uppercase tracking-widest">
                    V1.0 • Guinea Ecuatorial
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Sincronizado</span>
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
                title="Perfil Personal"
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
                title="Perfil de Empresa"
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
                alt="Perfil" 
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
          />
        )}
      </AnimatePresence>

      {/* Toast Alert for matching tenders */}
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
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Nueva Coincidencia</p>
                <p className="text-sm font-bold leading-tight">{lastNotification.title}</p>
              </div>
              <button 
                onClick={() => setShowToast(false)} 
                className="p-1 hover:bg-white/10 rounded-full outline-hidden transition-colors"
                aria-label="Cerrar notificación"
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
                title="Escanear Tarjeta"
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
                title="Nuevo Mensaje"
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
