import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, MessageSquare, UserPlus, Filter, Grid, List as ListIcon, Building2, User, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { auth } from '../services/firebaseService';
import { UserProfile } from '../types';

interface DiscoverScreenProps {
  users: UserProfile[];
  onContact: (user: any) => void;
}

export default function DiscoverScreen({ users, onContact }: DiscoverScreenProps) {
  const { t } = useTranslation();
  const currentUid = auth.currentUser?.uid;
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'company'>('all');

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Exclude the logged-in user's own profile from their directory,
      // matching TimelineScreen/InvestorsScreen/SearchResultsScreen -- without
      // this, users saw themselves listed and could "Conectar" with themselves.
      if (user.uid === currentUid) return false;

      // Respect privacy mode: exclude private profiles
      if (user.privacyMode === 'private') return false;

      const matchesSearch = 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.profession?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.city?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || user.profileType === filterType;
      
      return matchesSearch && matchesType;
    });
  }, [users, searchTerm, filterType, currentUid]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('discover.shareTitle'),
          text: t('discover.shareText'),
          url: window.location.origin,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback
      alert(t('discover.shareCopyFallback', { url: window.location.origin }));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-primary">{t('discover.title')}</h2>
          <div className="flex bg-surface-container-high p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all focus-ring-custom ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant/40'}`}
              aria-label={t('discover.gridViewAria')}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all focus-ring-custom ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant/40'}`}
              aria-label={t('discover.listViewAria')}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-surface-container-high rounded-2xl">
          {(['all', 'individual', 'company'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${filterType === type ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant/60'}`}
            >
              {type === 'all' ? t('discover.filterAll') : type === 'individual' ? t('discover.filterIndividual') : t('discover.filterCompany')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
          <input 
            type="text" 
            placeholder={t('discover.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-outline/10 rounded-2xl py-4 pl-12 pr-4 outline-hidden font-bold text-sm"
          />
        </div>
      </header>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-20 space-y-6">
          <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <UserPlus className="w-8 h-8 text-primary shadow-2xl" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-black text-primary">{t('discover.emptyTitle')}</p>
            <p className="text-sm font-medium text-on-surface-variant px-12 opacity-60">
              {t('discover.emptyDesc')}
            </p>
          </div>
          <button
            onClick={handleShare}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center gap-3 mx-auto active:scale-95 transition-all"
          >
            <Share2 className="w-4 h-4" />
            {t('discover.shareInviteButton')}
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-4" : "flex flex-col gap-4"}>
          {filteredUsers.map((user) => (
            <motion.div
              layout
              key={user.uid}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white border border-outline/5 relative overflow-hidden group ${
                viewMode === 'grid' ? "p-5 rounded-[2rem]" : "p-4 rounded-2xl flex items-center gap-4"
              }`}
            >
              <div className={`relative ${viewMode === 'grid' ? "mb-4" : "shrink-0"}`}>
                <img 
                  src={user.avatar || 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop'} 
                  alt={user.name} 
                  className={`${viewMode === 'grid' ? "w-full h-32 rounded-2xl" : "w-16 h-16 rounded-xl"} object-cover shadow-sm group-hover:scale-105 transition-transform duration-500`}
                />
                <div className={`absolute bottom-2 right-2 p-1.5 rounded-lg border-2 border-white shadow-xs ${user.profileType === 'company' ? 'bg-primary' : 'bg-secondary'}`}>
                  {user.profileType === 'company' ? <Building2 className="w-3 h-3 text-white" /> : <User className="w-3 h-3 text-white" />}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-primary truncate">{user.name}</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter truncate opacity-70">
                  {user.profession || user.role}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[9px] font-medium text-outline-variant">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{user.city || t('discover.defaultCity')}</span>
                </div>
                
                {viewMode === 'list' && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => onContact(user)}
                      className="flex-1 py-2 bg-primary/10 text-primary rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {t('discover.helloButton')}
                    </button>
                  </div>
                )}
              </div>

              {viewMode === 'grid' && (
                <div className="mt-4 flex gap-2">
                  <button 
                    onClick={() => onContact(user)}
                    className="flex-1 py-2.5 bg-primary/5 text-primary rounded-xl font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {t('discover.connectButton')}
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Invitation Banner */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-secondary text-white p-6 rounded-[2.5rem] relative overflow-hidden shadow-xl shadow-secondary/20"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-8 -translate-y-8" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('discover.viralGrowthBadge')}</span>
          </div>
          <h4 className="text-xl font-black leading-tight">{t('discover.noPartnerTitle')}</h4>
          <p className="text-xs font-medium opacity-80">{t('discover.noPartnerDesc')}</p>
          <button
            onClick={handleShare}
            className="w-full py-4 bg-white text-secondary rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            {t('discover.inviteWhatsappButton')}
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
