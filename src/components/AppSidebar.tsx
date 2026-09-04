import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Map as MapIcon,
  User,
  CheckCircle2,
  Settings,
  X,
  LogOut,
  ChevronRight,
  Wifi,
  Calendar,
  ShoppingBag,
  Briefcase,
  Building2,
  MessageSquare,
  Heart,
  Users,
  Handshake,
  Rocket,
  LayoutDashboard,
  Share2
} from 'lucide-react';

import { Screen, UserProfile } from '../types';
import Logo from './Logo';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeScreen: Screen;
  onNavigate: (id: string) => void;
  activeProfile: 'individual' | 'company';
  onSetActiveProfile: (profile: 'individual' | 'company') => void;
  profileData: UserProfile | null;
  unreadMessageCount: number;
  onSignOut: () => void;
}

export default function AppSidebar({
  isOpen,
  onClose,
  activeScreen,
  onNavigate,
  activeProfile,
  onSetActiveProfile,
  profileData,
  unreadMessageCount,
  onSignOut
}: AppSidebarProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
              <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high outline-hidden transition-colors">
                <X className="w-6 h-6 text-on-surface-variant" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-2">
              <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-4 px-4">{t('nav.sidebar.utilitiesLabel')}</p>
              <button
                onClick={() => onNavigate('map')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'map' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <MapIcon className="w-5 h-5" />
                <span className="font-bold">{t('nav.sidebar.map')}</span>
                <div className="ml-auto flex items-center gap-1.5 bg-secondary-container px-2 py-0.5 rounded-full">
                  <Wifi className="w-2.5 h-2.5 text-on-secondary-container" />
                  <span className="text-[8px] font-bold text-on-secondary-container tracking-tighter">{t('nav.sidebar.mapOfflineBadge')}</span>
                </div>
              </button>
              <button
                onClick={() => onNavigate('events')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'events' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Calendar className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.events')}</span>
              </button>
              <button
                onClick={() => onNavigate('tenders')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'tenders' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Briefcase className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.tenders')}</span>
              </button>
              <button
                onClick={() => onNavigate('groups')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'groups' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <LayoutDashboard className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.discover')}</span>
              </button>
              <button
                onClick={() => onNavigate('invite')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'invite' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Share2 className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.invite')}</span>
              </button>
              <button
                onClick={() => onNavigate('crm')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'crm' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Users className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.crm')}</span>
              </button>
              <button
                onClick={() => onNavigate('marketplace')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'marketplace' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <ShoppingBag className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.marketplace')}</span>
                <div className="ml-auto bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{t('nav.sidebar.marketplaceBadge')}</div>
              </button>
              <button
                onClick={() => onNavigate('companies')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'companies' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Building2 className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.companies')}</span>
              </button>
              <button
                onClick={() => onNavigate('investors')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'investors' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Handshake className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.investors')}</span>
              </button>
              <button
                onClick={() => onNavigate('initiatives')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'initiatives' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Rocket className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.initiatives')}</span>
              </button>
              <button
                onClick={() => onNavigate('chat')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'chat' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <MessageSquare className="w-5 h-5 text-secondary" />
                <span className="font-bold">{t('nav.sidebar.chat')}</span>
                {unreadMessageCount > 0 && (
                  <div className="ml-auto bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {unreadMessageCount}
                  </div>
                )}
              </button>
              <button
                onClick={() => onNavigate('tasks')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'tasks' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-bold">{t('nav.sidebar.tasks')}</span>
              </button>
              <button
                onClick={() => onNavigate('sync-settings')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'sync-settings' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Settings className="w-5 h-5" />
                <span className="font-bold">{t('nav.sidebar.syncSettings')}</span>
              </button>
              <button
                onClick={() => onNavigate('feedback')}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'feedback' ? 'bg-secondary/10 text-secondary' : 'hover:bg-surface-container-low text-on-surface'}`}
              >
                <Heart className="w-5 h-5" />
                <span className="font-bold">{t('nav.sidebar.feedback')}</span>
              </button>

              <div className="pt-8 space-y-2">
                <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-4 px-4">{t('nav.sidebar.switchProfileLabel')}</p>
                <div className="grid grid-cols-2 gap-2 px-2 mb-4">
                  <button
                    onClick={() => onSetActiveProfile('individual')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border ${
                      activeProfile === 'individual'
                        ? 'bg-secondary/10 border-secondary text-secondary'
                        : 'bg-surface-container-low border-transparent text-on-surface-variant opacity-60'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">{t('common.profileTypePersonal')}</span>
                  </button>
                  <button
                    onClick={() => onSetActiveProfile('company')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all border ${
                      activeProfile === 'company'
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-surface-container-low border-transparent text-on-surface-variant opacity-60'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase tracking-tighter">{t('common.profileTypeCompany')}</span>
                  </button>
                </div>

                <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-4 px-4">{t('nav.sidebar.accountLabel')}</p>
                <button
                  onClick={() => onNavigate('profile')}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${activeScreen === 'profile' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-low text-on-surface'}`}
                >
                  <User className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-bold">{activeProfile === 'individual' ? t('nav.sidebar.myProfile') : t('nav.sidebar.companyProfile')}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {profileData?.name || t('nav.sidebar.defaultUserName')}
                    </p>
                  </div>
                  <ChevronRight className="ml-auto w-4 h-4 opacity-40" />
                </button>
              </div>
            </div>

            <div className="mt-auto border-t border-outline/10 pt-6">
              <button
                onClick={onSignOut}
                className="w-full flex items-center gap-4 px-4 py-4 text-error font-bold rounded-2xl hover:bg-error-container/10 transition-all outline-hidden"
              >
                <LogOut className="w-5 h-5" />
                {t('nav.sidebar.signOut')}
              </button>
              <div className="mt-6 text-center space-y-1">
                <p className="text-[10px] text-on-surface-variant font-bold opacity-40 uppercase tracking-widest">
                  {t('nav.sidebar.versionFooter')}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
