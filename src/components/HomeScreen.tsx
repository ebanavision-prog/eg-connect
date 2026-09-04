import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home, Users, Briefcase, MessageSquare, MapPin,
  TrendingUp, Sparkles, ChevronRight, MessageCircle,
  Shield, User, Gift, Cake, Calendar, Zap, Lightbulb, ShoppingBag, UserPlus, QrCode, Share2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Logo from './Logo';


interface HomeScreenProps {
  onNavigate: (screen: any) => void;
  onSearch: (query: string) => void;
  stats: {
    connections: number;
    tasks: number;
    unreadChats: number;
  };
  userProfile: any;
  realUsers?: any[];
  onContact?: (participant: { id: string; name: string; avatar: string }) => void;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop';

export default function HomeScreen({ onNavigate, onSearch, stats, userProfile, realUsers = [], onContact }: HomeScreenProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  
  // Profile completeness calculation
  const completeness = useMemo(() => {
    if (!userProfile) return 40;
    let score = 40; // Base score
    if (userProfile.name) score += 10;
    if (userProfile.phone) score += 10;
    if (userProfile.birthday) score += 10;
    if (userProfile.profession) score += 10;
    if (userProfile.city) score += 10;
    if (userProfile.role) score += 10;
    return Math.min(score, 100);
  }, [userProfile]);
  
  // Calculate birthdays
  const celebrations = useMemo(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${mm}-${dd}`;
    
    return realUsers.filter(contact => contact.birthday === todayStr);
  }, [realUsers]);

  const newcomers = useMemo(() => {
    return realUsers
      .filter(u => u.uid !== userProfile?.uid && u.privacyMode !== 'private')
      .slice(0, 5);
  }, [realUsers, userProfile]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('home.shareTitle'),
          text: t('home.shareText'),
          url: window.location.origin,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert(t('home.shareCopiedFallback', { url: window.location.origin }));
    }
  };

  const categories = [
    { id: 'timeline', label: t('home.categories.timeline.label'), icon: Users, color: 'bg-blue-500', desc: t('home.categories.timeline.desc') },
    { id: 'crm', label: t('home.categories.crm.label'), icon: TrendingUp, color: 'bg-emerald-500', desc: t('home.categories.crm.desc') },
    { id: 'tenders', label: t('home.categories.tenders.label'), icon: Briefcase, color: 'bg-secondary', desc: t('home.categories.tenders.desc') },
    { id: 'marketplace', label: t('home.categories.marketplace.label'), icon: ShoppingBag, color: 'bg-indigo-500', desc: t('home.categories.marketplace.desc') },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="px-1 flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Logo size={24} />
            <div className="w-px h-4 bg-outline/20" />
            <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em]">{t('home.panelLabel')}</h2>
          </div>
          <h1 className="text-3xl font-extrabold font-display text-on-surface leading-tight">
            {t('home.greeting')} <br />
            <span className="text-primary">{userProfile?.name?.split(' ')[0] || t('home.defaultName')}</span>
          </h1>
          <p className="text-on-surface-variant mt-2 font-sans text-sm max-w-[250px]">
            {userProfile?.role || t('home.defaultRoleTagline')}
          </p>
        </div>
        
        {/* User Avatar / Profile Score */}
        <button 
          onClick={() => onNavigate('profile')}
          className="flex flex-col items-center gap-2 pt-1 group"
        >
          <div className="relative w-16 h-16 transition-transform group-hover:scale-105">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-surface-container-high" />
              <circle
                cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 * (1 - completeness / 100)}
                strokeLinecap="round"
                className="text-secondary transition-all"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center p-1.5">
              <img 
                src={userProfile?.avatar || "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop"} 
                className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm"
                alt="Profile"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">
            <span className="text-[7px] font-black text-secondary uppercase tracking-tight">{t('home.profileCompleteness', { percent: completeness })}</span>
          </div>
        </button>
      </header>

      {/* Global Search Bar */}
      <div className="px-1">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (searchValue.trim()) onSearch(searchValue);
          }}
          className="relative group"
        >
          <div className="absolute inset-y-0 left-5 flex items-center pr-3 pointer-events-none">
            <Home className="w-5 h-5 text-outline group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            placeholder={t('home.searchPlaceholder')}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full bg-white border-2 border-outline/10 rounded-[1.8rem] py-4.5 pl-14 pr-6 text-sm font-medium focus:border-primary/30 focus:outline-hidden transition-all shadow-sm"
          />
        </form>
      </div>

      {/* Networking Action Center */}
      <div className="grid grid-cols-2 gap-4 px-1">
        <motion.button 
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('scan')}
          className="bg-primary p-6 rounded-[2.5rem] text-white space-y-3 shadow-xl shadow-primary/20 relative overflow-hidden group text-left"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform" />
          <div className="p-3 bg-white/10 rounded-2xl w-fit">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-[11px] uppercase tracking-widest">{t('home.scanTitle')}</h4>
            <p className="text-[9px] font-bold opacity-50 uppercase mt-1 tracking-tighter">{t('home.scanDesc')}</p>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleShare}
          className="bg-secondary p-6 rounded-[2.5rem] text-white space-y-3 shadow-xl shadow-secondary/20 relative overflow-hidden group text-left"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full translate-x-4 -translate-y-4 group-hover:scale-125 transition-transform" />
          <div className="p-3 bg-white/10 rounded-2xl w-fit">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-[11px] uppercase tracking-widest">{t('home.inviteTitle')}</h4>
            <p className="text-[9px] font-bold opacity-50 uppercase mt-1 tracking-tighter">{t('home.inviteDesc')}</p>
          </div>
        </motion.button>
      </div>

      {/* Cumpleaños Hoy — celebrations ya se calculaba de datos reales
          (birthday real de cada usuario, mismo formato MM-DD que guarda
          OnboardingScreen) pero nunca se renderizaba en ningún lado. Solo
          aparece cuando hay alguien de verdad cumpliendo hoy — nada de
          estado vacío decorativo. */}
      {celebrations.length > 0 && (
        <section className="px-1">
          <div className="editorial-card p-5 bg-gradient-to-br from-amber-50 to-secondary/5 border-amber-200/50 space-y-3">
            <div className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold font-display text-amber-700">
                {celebrations.length === 1 ? 'Hoy cumple años' : `Hoy cumplen años (${celebrations.length})`}
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {celebrations.map((person) => (
                <div key={person.uid} className="flex items-center gap-3 bg-white/60 rounded-2xl p-2.5">
                  <img
                    src={person.avatar || DEFAULT_AVATAR}
                    alt={person.name}
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                  <span className="flex-1 text-sm font-bold text-on-surface truncate">{person.name}</span>
                  <button
                    onClick={() => onContact?.({ id: person.uid, name: person.name, avatar: person.avatar || DEFAULT_AVATAR })}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0"
                  >
                    <Gift className="w-3 h-3" />
                    Felicitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ecosistema en Movimiento */}
      <section className="space-y-4 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            <h3 className="text-lg font-bold font-display text-primary">{t('home.ecosystemMoving')}</h3>
          </div>
          <button
            onClick={() => onNavigate('groups')}
            className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100 uppercase tracking-tighter hover:bg-amber-100 transition-colors"
          >
            {t('home.viewDirectory')}
          </button>
        </div>
        <p className="text-[11px] font-medium text-on-surface-variant/60 -mt-2 ml-1">
          {t('home.ecosystemQuote')}
        </p>

        {newcomers.length === 0 ? (
          <div
            onClick={handleShare}
            className="editorial-card p-6 border-dashed border-2 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container-low transition-all"
          >
            <Users className="w-8 h-8 text-outline/40 mb-2" />
            <p className="text-xs font-bold text-on-surface-variant">{t('home.emptyNewcomersTitle')}</p>
            <p className="text-[10px] text-primary font-black uppercase mt-2 tracking-widest">{t('home.emptyNewcomersCta')}</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {newcomers.map((person) => (
              <motion.div 
                key={person.uid}
                whileHover={{ y: -5 }}
                className="min-w-[260px] bg-white p-5 rounded-[2.5rem] shadow-sm border border-outline/5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-full -translate-y-6 translate-x-6 opacity-50 group-hover:scale-110 transition-transform" />
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="relative">
                    <img 
                      src={person.avatar || "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop"} 
                      alt={person.name} 
                      className="w-14 h-14 rounded-2xl object-cover ring-2 ring-amber-500/10 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-lg border-2 border-white shadow-sm">
                      <Zap className="w-3 h-3 fill-current" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-primary text-sm leading-tight truncate">{person.name}</h4>
                    <p className="text-[10px] text-on-surface-variant font-medium mt-0.5 truncate">{person.profession || t('home.defaultMemberProfession')}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                    <MapPin className="w-2.5 h-2.5" />
                    {person.city || t('home.defaultCity')}
                  </div>
                  <button
                    onClick={() => onContact
                      ? onContact({ id: person.uid, name: person.name, avatar: person.avatar || DEFAULT_AVATAR })
                      : onNavigate('groups')}
                    className="bg-primary text-white p-2.5 rounded-xl shadow-lg shadow-primary/20 hover:scale-110 active:scale-90 transition-all font-black text-[9px] uppercase tracking-widest px-4"
                  >
                    {t('home.connectButton')}
                  </button>
                </div>
              </motion.div>
            ))}
            {/* Invite More card */}
            <motion.div
              whileHover={{ y: -5 }}
              onClick={handleShare}
              className="min-w-[180px] bg-primary/5 p-5 rounded-[2.5rem] border-2 border-dashed border-primary/20 flex flex-col items-center justify-center text-center cursor-pointer group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-bold text-primary text-xs uppercase tracking-widest">{t('home.inviteColleagueLine1')} <br /> {t('home.inviteColleagueLine2')}</h4>
            </motion.div>
          </div>
        )}
      </section>

      {/* Agenda/Events Section */}
      <section className="space-y-4 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold font-display text-primary uppercase tracking-tight">{t('home.agendaTitle')}</h3>
          </div>
        </div>

        <div className="editorial-card p-8 border-dashed border-2 flex flex-col items-center justify-center text-center">
          <Calendar className="w-10 h-10 text-outline/20 mb-3" />
          <p className="text-xs font-bold text-on-surface-variant">{t('home.agendaEmptyTitle')}</p>
          <p className="text-[10px] text-outline/60 mt-1 uppercase tracking-widest">{t('home.agendaEmptySubtitle')}</p>
        </div>
      </section>

      {/* Explore Grid (Modified) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold font-display text-primary">{t('home.servicesTitle')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onNavigate(cat.id)}
              className="group editorial-card p-5 text-left transition-all hover:bg-surface-container-high border-none shadow-md relative overflow-hidden"
            >
              <div className={`absolute top-0 right-0 w-16 h-16 ${cat.color} opacity-5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform`} />
              <div className={`w-10 h-10 rounded-2xl ${cat.color} bg-opacity-10 flex items-center justify-center mb-4 text-primary`}>
                <cat.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-primary mb-1">{cat.label}</h4>
              <p className="text-[10px] text-on-surface-variant font-medium">{cat.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Ecosystem Motivation */}
      <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-primary to-primary-container text-white relative overflow-hidden shadow-xl shadow-primary/20 mx-1">
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-secondary-container" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-container">{t('home.strategyLabel')}</span>
          </div>
          <p className="text-sm font-medium leading-relaxed italic mb-6">
            {t('home.strategyQuote')}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{t('home.versionBadge')}</span>
            </div>
            <span className="text-[8px] font-black text-white/50 uppercase">{t('home.insightBadge')}</span>
          </div>
        </div>
      </div>

      <footer className="pt-8 text-center">
        <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.3em]">
          {t('home.footer')}
        </p>
      </footer>
    </div>
  );
}

