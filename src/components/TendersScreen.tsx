import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase, Search, Calendar, MapPin,
  Building2, ShieldCheck,
  FileText, Zap, Globe, Plus, X, Loader2, Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LocalContentOpportunity } from '../types';
import { auth, createTender, deleteTender } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

// Valores persistidos tal cual en Firestore (tender.category) -- se dejan en
// español para no desincronizar licitaciones ya guardadas.
const TENDER_CATEGORIES = ['IT', 'Construcción', 'Energía', 'Servicios', 'Logística'];

export default function TendersScreen({ profileData }: { profileData?: any }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'it' | 'const' | 'energy'>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedTender, setSelectedTender] = useState<LocalContentOpportunity | null>(null);

  const isAdmin = !!profileData?.isAdmin;
  const currentUid = auth.currentUser?.uid;
  const { data: tenders, loading } = useFirestoreCollection<LocalContentOpportunity>(currentUid ? 'tenders' : null);

  const [newTender, setNewTender] = useState({
    title: '',
    companyName: '',
    companyLogo: 'https://ui-avatars.com/api/?background=045C68&color=fff&size=128',
    description: '',
    location: 'Malabo',
    deadline: '',
    category: 'IT',
    requirements: ['']
  });

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError('');
    try {
      await createTender({
        ...newTender,
        requirements: newTender.requirements.filter((r) => r.trim())
      });
      setIsModalOpen(false);
      setNewTender({ title: '', companyName: '', companyLogo: newTender.companyLogo, description: '', location: 'Malabo', deadline: '', category: 'IT', requirements: [''] });
    } catch (error) {
      setPublishError(t('tenders.errorGeneric'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTender(id);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = tenders.filter(t => {
    const matchesFilter = filter === 'all' || 
                         (filter === 'it' && t.category === 'IT') ||
                         (filter === 'const' && t.category === 'Construcción') ||
                         (filter === 'energy' && t.category === 'Energía');
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                         t.companyName.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="py-6 space-y-6">
      <header className="px-1 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-6 bg-secondary rounded-full" />
            <h2 className="text-sm font-black text-secondary uppercase tracking-[0.2em]">{t('tenders.opportunitiesLabel')}</h2>
          </div>
          <h1 className="text-3xl font-black font-display text-primary leading-tight">{t('tenders.title')}</h1>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xs">
            {t('tenders.subtitle')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-3 bg-primary text-white rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all outline-hidden shrink-0"
            title={t('tenders.publishTooltip')}
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </header>

      {/* Search and Quick Filters */}
      <div className="space-y-4 sticky top-0 z-10 py-2 bg-surface/80 backdrop-blur-md px-1">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            type="text"
            placeholder={t('tenders.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border-2 border-outline/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:border-secondary shadow-sm"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'all', label: t('tenders.filterAll'), icon: Globe },
            { id: 'it', label: t('tenders.filterTech'), icon: Zap },
            { id: 'const', label: t('tenders.filterInfra'), icon: Building2 },
            { id: 'energy', label: t('tenders.filterEnergy'), icon: ShieldCheck }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all ${
                filter === btn.id 
                  ? 'bg-secondary border-secondary text-white shadow-lg' 
                  : 'bg-white border-outline/10 text-on-surface-variant hover:border-secondary/20'
              }`}
            >
              <btn.icon className="w-3.5 h-3.5" />
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tenders List */}
      <div className="space-y-4">
        {filtered.map((tender) => (
          <motion.div
            key={tender.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-outline/5 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-110 transition-transform" />
            
            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center p-2 border border-outline/5">
                  <img src={tender.companyLogo} alt={tender.companyName} className="w-full h-full object-contain grayscale-0 group-hover:grayscale-0 transition-all" />
                </div>
                <div>
                  <h3 className="font-bold text-primary leading-tight group-hover:text-secondary transition-colors">{tender.title}</h3>
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mt-1">{tender.companyName}</p>
                </div>
              </div>
              <div className="bg-primary/5 text-primary text-[10px] font-black px-2.5 py-1 rounded-lg border border-primary/10">
                {tender.category}
              </div>
            </div>

            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed line-clamp-2">
              {tender.description}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <MapPin className="w-3.5 h-3.5 text-secondary" />
                <span className="text-[10px] font-bold">{tender.location}</span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Calendar className="w-3.5 h-3.5 text-secondary" />
                <span className="text-[10px] font-bold">{t('tenders.deadlinePrefix', { date: tender.deadline })}</span>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <p className="text-[9px] font-black uppercase text-outline tracking-[0.2em] mb-1">{t('tenders.keyRequirementsLabel')}</p>
              {tender.requirements.map((req, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] font-bold text-primary">
                  <div className="w-1 h-1 rounded-full bg-secondary mt-1.5 flex-shrink-0" />
                  <span>{req}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedTender(tender)}
                className="flex-1 bg-primary text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-3.5 h-3.5" />
                {t('tenders.moreDetailsButton')}
              </button>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(tender.id)}
                  disabled={deletingId === tender.id}
                  className="w-12 h-12 bg-error/10 text-error rounded-2xl flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
                  title={t('tenders.deleteTooltip')}
                >
                  {deletingId === tender.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20 px-6">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-outline/30" />
            </div>
            <h3 className="font-bold text-primary mb-2">{t('tenders.noTendersFoundTitle')}</h3>
            <p className="text-xs text-on-surface-variant font-medium">{t('tenders.noTendersFoundDesc')}</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-secondary/5 rounded-3xl border-2 border-secondary/10 mx-1">
        <h4 className="font-bold text-secondary text-sm mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {t('tenders.localContentNoticeTitle')}
        </h4>
        <p className="text-[10px] text-on-surface-variant leading-relaxed">
          {t('tenders.localContentNoticeDesc')}
        </p>
      </div>

      {/* Modal de detalle — antes "Más Detalles" no tenía onClick y la descripción
          quedaba siempre truncada a 2 líneas sin forma de leerla completa. */}
      <AnimatePresence>
        {selectedTender && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTender(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 space-y-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center p-2 border border-outline/5 shrink-0">
                      <img src={selectedTender.companyLogo} alt={selectedTender.companyName} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold font-display text-on-surface leading-tight">{selectedTender.title}</h2>
                      <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mt-1">{selectedTender.companyName}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedTender(null)} className="p-2 rounded-full hover:bg-surface-container-high transition-all shrink-0">
                    <X className="w-6 h-6 text-on-surface-variant" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <MapPin className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-xs font-bold">{selectedTender.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Calendar className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-xs font-bold">{t('tenders.deadlinePrefix', { date: selectedTender.deadline })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Building2 className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-xs font-bold">{selectedTender.category}</span>
                  </div>
                  {selectedTender.budget && (
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                      <span className="text-xs font-bold">{selectedTender.budget}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase text-outline tracking-[0.2em]">{t('tenders.descriptionLabel')}</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed">{selectedTender.description}</p>
                </div>

                {selectedTender.requirements.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase text-outline tracking-[0.2em]">{t('tenders.keyRequirementsLabel')}</p>
                    {selectedTender.requirements.map((req, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-bold text-primary">
                        <div className="w-1 h-1 rounded-full bg-secondary mt-1.5 shrink-0" />
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isAdmin && (
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isPublishing && setIsModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              >
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <h2 className="text-2xl font-extrabold font-display text-on-surface">{t('tenders.modalTitle')}</h2>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high transition-all">
                      <X className="w-6 h-6 text-on-surface-variant" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('tenders.projectTitleLabel')}</label>
                      <input
                        type="text"
                        placeholder={t('tenders.projectTitlePlaceholder')}
                        className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                        value={newTender.title}
                        onChange={(e) => setNewTender({ ...newTender, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('tenders.entityLabel')}</label>
                      <input
                        type="text"
                        placeholder={t('tenders.entityPlaceholder')}
                        className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                        value={newTender.companyName}
                        onChange={(e) => setNewTender({ ...newTender, companyName: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('tenders.categoryLabel')}</label>
                        <select
                          className="select-field-custom"
                          value={newTender.category}
                          onChange={(e) => setNewTender({ ...newTender, category: e.target.value })}
                        >
                          {TENDER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('tenders.deadlineLabel')}</label>
                        <input
                          type="date"
                          className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                          value={newTender.deadline}
                          onChange={(e) => setNewTender({ ...newTender, deadline: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('tenders.locationLabel')}</label>
                      <input
                        type="text"
                        placeholder={t('tenders.locationPlaceholder')}
                        className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                        value={newTender.location}
                        onChange={(e) => setNewTender({ ...newTender, location: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('tenders.descriptionLabel')}</label>
                      <textarea
                        rows={3}
                        placeholder={t('tenders.descriptionPlaceholder')}
                        className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary resize-none"
                        value={newTender.description}
                        onChange={(e) => setNewTender({ ...newTender, description: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('tenders.requirementsLabel')}</label>
                      <textarea
                        rows={3}
                        placeholder={t('tenders.requirementsPlaceholder')}
                        className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary resize-none"
                        value={newTender.requirements.join('\n')}
                        onChange={(e) => setNewTender({ ...newTender, requirements: e.target.value.split('\n') })}
                      />
                    </div>
                  </div>

                  {publishError && <p className="text-xs font-bold text-error text-center">{publishError}</p>}

                  <button
                    disabled={!newTender.title || !newTender.companyName || !newTender.deadline || isPublishing}
                    onClick={handlePublish}
                    className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                  >
                    {isPublishing ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />{t('tenders.publishing')}</>
                    ) : (
                      <><Briefcase className="w-5 h-5" />{t('tenders.publishButton')}</>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
