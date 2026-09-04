import { useState } from 'react';
import { Building2, Search, Filter, Globe, MapPin, Users, CheckCircle2, ChevronRight, X, ShieldCheck, Plus, Trash2, Linkedin, Instagram, Twitter, Facebook, Award, Network, Loader2, MessageSquare, UserCircle, Grid, LayoutList, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { limit, orderBy } from 'firebase/firestore';
import { Company, UserProfile } from '../types';
import { auth, createCompany, setCompanyVerified } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

const PAGE_SIZE_INCREMENT = 20;

export default function CompaniesScreen({ onChat, profileData }: { onChat?: (participant?: { id: string; name: string; avatar: string }) => void, profileData?: UserProfile | null }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [registrationStep, setRegistrationStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterLocation, setFilterLocation] = useState('');
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_INCREMENT);

  const isAdmin = !!profileData?.isAdmin;
  const currentUid = auth.currentUser?.uid;
  // Límite creciente en vez de traer la colección entera (ver docs/PLAN_MEJORA_360.md
  // sección 3/7 Fase 2): sigue siendo realtime (onSnapshot) para lo ya cargado,
  // solo cambia cuántos documentos se piden. orderBy('createdAt', 'desc') es
  // obligatorio junto a limit() para un orden determinista -- companies se
  // crean con serverTimestamp() en createCompany (firebaseService.ts).
  const { data: companies, loading } = useFirestoreCollection<Company & { ownerId?: string }>(
    currentUid ? 'companies' : null,
    [orderBy('createdAt', 'desc'), limit(pageSize)]
  );
  const hasMoreToLoad = companies.length === pageSize;
  const isSearchActive = searchQuery.trim().length > 0;

  const handleToggleVerified = async (company: Company) => {
    setIsVerifying(true);
    try {
      await setCompanyVerified(company.id, !company.isVerified);
      setSelectedCompany({ ...company, isVerified: !company.isVerified });
    } finally {
      setIsVerifying(false);
    }
  };

  // Form State — los valores de industry/location/employees/yearsInMarket de
  // los <select> de abajo se guardan tal cual en Firestore (company.industry,
  // company.location, etc.) y también forman `tags`/comparaciones exactas
  // más adelante -- se dejan en español sin traducir, igual que
  // TENDER_CATEGORIES en TendersScreen.tsx.
  const [formData, setFormData] = useState({
    name: '',
    industry: 'Tecnología',
    description: '',
    location: 'Malabo',
    employees: '1-10',
    yearsInMarket: '0-2',
    ceoName: '',
    departments: ['Dirección'],
    leadership: [] as { name: string, role: string }[],
    certifications: [] as { name: string, year: string, entity: string }[],
    social: {
      linkedin: '',
      instagram: '',
      twitter: '',
      facebook: '',
      website: ''
    }
  });

  const locationOptions = Array.from(new Set(companies.map((c) => c.location).filter(Boolean))).sort();

  const filteredCompanies = companies.filter((company) => {
    const matchesSearch =
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.industry.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = !filterLocation || company.location === filterLocation;
    const matchesVerified = !filterVerifiedOnly || company.isVerified;
    return matchesSearch && matchesLocation && matchesVerified;
  });

  const activeFilterCount = (filterLocation ? 1 : 0) + (filterVerifiedOnly ? 1 : 0);

  const handleAddDepartment = () => {
    setFormData({ ...formData, departments: [...formData.departments, ''] });
  };

  const handleRemoveDepartment = (index: number) => {
    const deps = [...formData.departments];
    deps.splice(index, 1);
    setFormData({ ...formData, departments: deps });
  };

  const handleAddLeadership = () => {
    setFormData({ ...formData, leadership: [...formData.leadership, { name: '', role: '' }] });
  };

  const handleRemoveLeadership = (index: number) => {
    const lead = [...formData.leadership];
    lead.splice(index, 1);
    setFormData({ ...formData, leadership: lead });
  };

  const handleAddCert = () => {
    setFormData({ ...formData, certifications: [...formData.certifications, { name: '', year: '2024', entity: '' }] });
  };

  const handleRemoveCert = (index: number) => {
    const certs = [...formData.certifications];
    certs.splice(index, 1);
    setFormData({ ...formData, certifications: certs });
  };

  const handleSubmit = async () => {
    if (!currentUid) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await createCompany(currentUid, {
        ...formData,
        website: formData.social.website,
        logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=045C68&color=fff&size=256`,
        tags: [formData.industry],
        isVerified: false
      });
      setIsModalOpen(false);
      setRegistrationStep(1);
      setFormData({
        name: '', industry: 'Tecnología', description: '', location: 'Malabo',
        employees: '1-10', yearsInMarket: '0-2', ceoName: '', departments: ['Dirección'],
        leadership: [], certifications: [],
        social: { linkedin: '', instagram: '', twitter: '', facebook: '', website: '' }
      });
    } catch (error) {
      setSubmitError(t('companies.submitErrorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2 px-1">{t('companies.sectionLabel')}</h2>
        <h1 className="text-4xl font-extrabold font-display text-on-surface">{t('companies.title')}</h1>
      </header>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
          <input 
            type="text" 
            placeholder={t('companies.searchPlaceholder')}
            className="w-full bg-surface-container-low border border-outline/10 pl-12 pr-4 py-4 rounded-[1.5rem] text-sm focus:outline-hidden focus:border-primary transition-colors font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="bg-surface-container-low p-1.5 rounded-[1.2rem] flex border border-outline/5 shadow-sm">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-md text-primary' : 'text-on-surface-variant opacity-40 hover:opacity-100'}`}
              title={t('companies.gridViewTooltip')}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-md text-primary' : 'text-on-surface-variant opacity-40 hover:opacity-100'}`}
              title={t('companies.listViewTooltip')}
            >
              <LayoutList className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={`relative p-4 border rounded-[1.5rem] transition-colors outline-hidden ${
                activeFilterCount > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low border-outline/10 text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Filter className="w-5 h-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowFilters(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-outline/10 p-4 space-y-4 z-40"
                  >
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('companies.locationFilterLabel')}</label>
                      <select
                        className="select-field-custom"
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                      >
                        <option value="">{t('companies.allLocationsOption')}</option>
                        {locationOptions.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterVerifiedOnly}
                        onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-xs font-bold text-on-surface">{t('companies.verifiedOnlyLabel')}</span>
                    </label>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={() => { setFilterLocation(''); setFilterVerifiedOnly(false); }}
                        className="w-full text-center text-[10px] font-black uppercase tracking-widest text-error py-2 rounded-xl hover:bg-error/5 transition-colors"
                      >
                        {t('companies.clearFiltersButton')}
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {isSearchActive && hasMoreToLoad && (
        <div className="px-4 py-3 bg-secondary/5 border border-secondary/10 rounded-2xl text-xs font-semibold text-secondary">
          {t('companies.searchLimitedNotice', { count: companies.length })}
        </div>
      )}

      {!loading && filteredCompanies.length === 0 ? (
        <div className="text-center py-16 space-y-3 opacity-60">
          <Building2 className="w-10 h-10 mx-auto text-outline" />
          <p className="text-sm font-bold text-on-surface-variant">{t('companies.emptyTitle')}</p>
          <p className="text-xs text-on-surface-variant">{t('companies.emptySubtitle')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCompanies.map((company) => (
            <motion.div 
              layout
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              className="group bg-white border border-outline/10 rounded-[2.5rem] p-6 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-700" />
              
              <div className="flex items-start gap-6 relative z-10">
                <img 
                  src={company.logo} 
                  alt={company.name} 
                  className="w-20 h-20 rounded-3xl object-cover shadow-md group-hover:rotate-3 transition-transform"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-primary group-hover:text-secondary transition-colors">{company.name}</h3>
                    {company.isVerified && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                  </div>
                  <p className="text-xs font-bold text-secondary-container uppercase tracking-widest mb-3">{company.industry}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">{company.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">{company.employees} {t('companies.employeesUnit')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-outline/5 relative z-10">
                <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 mb-6">
                  {company.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onChat?.({ id: company.ownerId || company.id, name: company.name, avatar: company.logo });
                      }}
                      className="p-2.5 bg-primary/5 text-primary rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    {company.tags.slice(0, 1).map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-surface-container-high rounded-lg text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter self-center">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="flex items-center gap-2 text-primary font-bold text-xs group-hover:translate-x-1 transition-transform">
                    {t('companies.viewProfileButton')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredCompanies.map((company) => (
            <motion.div
              layout
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-outline/10 rounded-[2rem] p-5 hover:shadow-lg transition-all cursor-pointer group flex flex-col md:flex-row gap-6 items-start md:items-center"
            >
              <div className="flex items-center gap-6 flex-1 w-full">
                <img 
                  src={company.logo} 
                  alt={company.name} 
                  className="w-20 h-20 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-primary group-hover:text-secondary transition-colors truncate">{company.name}</h3>
                    {company.isVerified && <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{company.industry}</p>
                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <MapPin className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-bold">{company.location}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-on-surface-variant line-clamp-1 opacity-80 md:line-clamp-2">
                    {company.description}
                  </p>
                </div>
              </div>

              <div className="flex w-full md:w-auto gap-3 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-outline/5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChat?.({ id: company.ownerId || company.id, name: company.name, avatar: company.logo });
                  }}
                  className="flex-1 md:flex-none px-6 py-3 bg-primary/5 text-primary rounded-xl font-bold text-xs hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t('companies.contactButton')}
                </button>
                <button className="flex-1 md:flex-none px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs shadow-lg shadow-primary/20 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  {t('companies.viewProfileButton')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {loading && companies.length > 0 && (
        <div className="flex items-center justify-center gap-2 py-4 text-on-surface-variant">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-bold">{t('common.loadingMoreLabel')}</span>
        </div>
      )}
      {!loading && hasMoreToLoad && (
        <div className="flex justify-center py-2">
          <button
            onClick={() => setPageSize((prev) => prev + PAGE_SIZE_INCREMENT)}
            className="px-8 py-3.5 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest font-bold text-xs uppercase tracking-widest rounded-full transition-all active:scale-95"
          >
            {t('common.loadMoreButton')}
          </button>
        </div>
      )}

      {/* Registration Banner */}
      <div className="p-10 rounded-[3rem] bg-primary text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-24 translate-x-24 blur-3xl" />
        <div className="relative z-10 max-w-lg">
          <Building2 className="w-12 h-12 text-secondary-container mb-6" />
          <h2 className="text-3xl font-display font-bold mb-4 leading-tight">{t('companies.registrationBannerTitle')}</h2>
          <p className="text-white/70 text-sm mb-8 leading-relaxed">
            {t('companies.registrationBannerDesc')}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-white text-primary rounded-full font-bold shadow-xl active:scale-95 transition-all outline-hidden"
          >
            {t('companies.startRegistrationButton')}
          </button>
        </div>
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h2 className="text-2xl font-extrabold font-display text-on-surface">{t('companies.registrationTitle')}</h2>
                    <div className="flex gap-2 mt-2">
                       {[1, 2, 3].map(step => (
                         <div key={step} className={`h-1.5 rounded-full transition-all duration-300 ${registrationStep >= step ? 'w-8 bg-primary' : 'w-4 bg-surface-container-high'}`} />
                       ))}
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high transition-all">
                    <X className="w-6 h-6 text-on-surface-variant" />
                  </button>
                </div>

                <div className="space-y-8">
                  {registrationStep === 1 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                      <div className="flex items-center gap-2 text-primary font-bold mb-4">
                        <Building2 className="w-5 h-5" />
                        <h3>{t('companies.step1Title')}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.companyNameLabel')}</label>
                          <input
                            type="text"
                            className="input-field-custom"
                            placeholder={t('companies.companyNamePlaceholder')}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.ceoLabel')}</label>
                          <input
                            type="text"
                            className="input-field-custom"
                            placeholder={t('companies.ceoPlaceholder')}
                            value={formData.ceoName}
                            onChange={(e) => setFormData({ ...formData, ceoName: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.yearsInMarketLabel')}</label>
                          <select
                            className="select-field-custom"
                            value={formData.yearsInMarket}
                            onChange={(e) => setFormData({ ...formData, yearsInMarket: e.target.value })}
                          >
                            <option value="0-2">{t('companies.yearsOption0to2')}</option>
                            <option value="2-5">{t('companies.yearsOption2to5')}</option>
                            <option value="5-10">{t('companies.yearsOption5to10')}</option>
                            <option value="10+">{t('companies.yearsOption10plus')}</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.websiteSocialLabel')}</label>
                          <input
                            type="url"
                            className="input-field-custom"
                            placeholder="https://..."
                            value={formData.social.website}
                            onChange={(e) => setFormData({ ...formData, social: { ...formData.social, website: e.target.value } })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.industryLabel')}</label>
                          <select
                            className="select-field-custom"
                            value={formData.industry}
                            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          >
                            <option>Tecnología</option>
                            <option>Petróleo y Gas</option>
                            <option>Banca y Finanzas</option>
                            <option>Construcción</option>
                            <option>Servicios</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.descriptionLabel')}</label>
                        <textarea
                          rows={3}
                          className="textarea-field-custom"
                          placeholder={t('companies.descriptionPlaceholder')}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.headquartersLabel')}</label>
                          <select className="select-field-custom" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}>
                            <option>Malabo</option>
                            <option>Bata</option>
                            <option>Oyala</option>
                            <option>Mongomo</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.employeesSizeLabel')}</label>
                          <select className="select-field-custom" value={formData.employees} onChange={(e) => setFormData({ ...formData, employees: e.target.value })}>
                            <option>1-10</option>
                            <option>11-50</option>
                            <option>51-200</option>
                            <option>200+</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {registrationStep === 2 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                      {/* Structure */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-primary font-bold">
                            <Network className="w-5 h-5 text-secondary" />
                            <h3>{t('companies.orgStructureTitle')}</h3>
                          </div>
                          <button onClick={handleAddDepartment} className="text-secondary hover:bg-secondary/10 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all">
                            <Plus className="w-3 h-3" />
                            {t('companies.addDepartmentButton')}
                          </button>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.keyDepartmentsLabel')}</label>
                          <div className="grid grid-cols-2 gap-3">
                            {formData.departments.map((dept, index) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  type="text"
                                  className="input-field-custom-sm bg-surface-container-low"
                                  placeholder={t('companies.departmentPlaceholder')}
                                  value={dept}
                                  onChange={(e) => {
                                    const deps = [...formData.departments];
                                    deps[index] = e.target.value;
                                    setFormData({ ...formData, departments: deps });
                                  }}
                                />
                                <button onClick={() => handleRemoveDepartment(index)} className="p-2 text-error hover:bg-error/10 rounded-xl transition-all">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-outline/5">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.leadershipFormTitle')}</label>
                            <button onClick={handleAddLeadership} className="text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all">
                              <Plus className="w-3 h-3" />
                              {t('companies.addLeadershipButton')}
                            </button>
                          </div>
                          <div className="space-y-3">
                            {formData.leadership.map((lead, index) => (
                              <div key={index} className="grid grid-cols-5 gap-3 items-center">
                                <input
                                  className="col-span-2 input-field-custom-sm bg-surface-container-low"
                                  placeholder={t('companies.leadershipNamePlaceholder')}
                                  value={lead.name}
                                  onChange={(e) => {
                                    const l = [...formData.leadership];
                                    l[index].name = e.target.value;
                                    setFormData({ ...formData, leadership: l });
                                  }}
                                />
                                <input
                                  className="col-span-2 input-field-custom-sm bg-surface-container-low"
                                  placeholder={t('companies.leadershipRolePlaceholder')}
                                  value={lead.role}
                                  onChange={(e) => {
                                    const l = [...formData.leadership];
                                    l[index].role = e.target.value;
                                    setFormData({ ...formData, leadership: l });
                                  }}
                                />
                                <button onClick={() => handleRemoveLeadership(index)} className="p-2 text-error hover:bg-error/10 rounded-xl transition-all justify-self-end">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Certifications */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-primary font-bold">
                            <Award className="w-5 h-5 text-secondary" />
                            <h3>{t('companies.certificationsFormTitle')}</h3>
                          </div>
                          <button onClick={handleAddCert} className="text-secondary hover:bg-secondary/10 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all">
                            <Plus className="w-3 h-3" />
                            {t('companies.addCertButton')}
                          </button>
                        </div>
                        <div className="space-y-3">
                          {formData.certifications.map((cert, index) => (
                            <div key={index} className="bg-surface-container-low p-4 rounded-2xl border border-outline/5 space-y-4 shadow-sm">
                              <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                  <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.certNameLabel')}</label>
                                  <input
                                    className="input-field-custom-sm bg-white"
                                    placeholder={t('companies.certNamePlaceholder')}
                                    value={cert.name}
                                    onChange={(e) => {
                                      const certs = [...formData.certifications];
                                      certs[index].name = e.target.value;
                                      setFormData({ ...formData, certifications: certs });
                                    }}
                                  />
                                </div>
                                <div className="w-24 space-y-2">
                                  <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.certYearLabel')}</label>
                                  <input
                                    className="input-field-custom-sm bg-white text-center"
                                    value={cert.year}
                                    onChange={(e) => {
                                      const certs = [...formData.certifications];
                                      certs[index].year = e.target.value;
                                      setFormData({ ...formData, certifications: certs });
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="flex gap-4 items-end">
                                <div className="flex-1 space-y-2">
                                  <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.certEntityLabel')}</label>
                                  <input
                                    className="input-field-custom-sm bg-white"
                                    placeholder={t('companies.certEntityPlaceholder')}
                                    value={cert.entity}
                                    onChange={(e) => {
                                      const certs = [...formData.certifications];
                                      certs[index].entity = e.target.value;
                                      setFormData({ ...formData, certifications: certs });
                                    }}
                                  />
                                </div>
                                <button onClick={() => handleRemoveCert(index)} className="p-3 text-error hover:bg-error/10 rounded-xl transition-all">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {formData.certifications.length === 0 && (
                            <p className="text-xs text-on-surface-variant opacity-60 text-center py-4 italic">{t('companies.noCertificationsYet')}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {registrationStep === 3 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                       <div className="flex items-center gap-2 text-primary font-bold mb-4">
                        <Globe className="w-5 h-5 text-secondary" />
                        <h3>{t('companies.digitalPresenceTitle')}</h3>
                      </div>
                      <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                          <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-xl">
                            <Globe className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.officialWebsiteLabel')}</p>
                            <input
                              type="text"
                              className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                              placeholder={t('companies.officialWebsitePlaceholder')}
                              value={formData.social.website}
                              onChange={(e) => setFormData({ ...formData, social: { ...formData.social, website: e.target.value } })}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                          <div className="w-12 h-12 bg-[#0077B5]/10 flex items-center justify-center rounded-xl">
                            <Linkedin className="w-6 h-6 text-[#0077B5]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.linkedinUrlLabel')}</p>
                            <input
                              type="text"
                              className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                              placeholder={t('companies.linkedinUrlPlaceholder')}
                              value={formData.social.linkedin}
                              onChange={(e) => setFormData({ ...formData, social: { ...formData.social, linkedin: e.target.value } })}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                          <div className="w-12 h-12 bg-[#1877F2]/10 flex items-center justify-center rounded-xl">
                            <Facebook className="w-6 h-6 text-[#1877F2]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.facebookPageLabel')}</p>
                            <input
                              type="text"
                              className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                              placeholder={t('companies.facebookPagePlaceholder')}
                              value={formData.social.facebook}
                              onChange={(e) => setFormData({ ...formData, social: { ...formData.social, facebook: e.target.value } })}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                          <div className="w-12 h-12 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-opacity-10 flex items-center justify-center rounded-xl p-0.5">
                            <div className="bg-white/90 w-full h-full rounded-[10px] flex items-center justify-center">
                              <Instagram className="w-6 h-6 text-[#ee2a7b]" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.instagramHandleLabel')}</p>
                            <input
                              type="text"
                              className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                              placeholder={t('companies.instagramHandlePlaceholder')}
                              value={formData.social.instagram}
                              onChange={(e) => setFormData({ ...formData, social: { ...formData.social, instagram: e.target.value } })}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                          <div className="w-12 h-12 bg-[#1DA1F2]/10 flex items-center justify-center rounded-xl">
                            <Twitter className="w-6 h-6 text-[#1DA1F2]" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.twitterLabel')}</p>
                            <input
                              type="text"
                              className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                              placeholder={t('companies.twitterPlaceholder')}
                              value={formData.social.twitter}
                              onChange={(e) => setFormData({ ...formData, social: { ...formData.social, twitter: e.target.value } })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                        <div className="flex items-start gap-4">
                          <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-1" />
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-primary">{t('companies.verificationNoticeTitle')}</p>
                            <p className="text-[11px] text-on-surface-variant leading-relaxed">
                              {t('companies.verificationNoticeDesc')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {submitError && <p className="text-xs font-bold text-error text-center mt-6">{submitError}</p>}

                <div className="mt-12 flex gap-4">
                  {registrationStep > 1 && (
                    <button
                      onClick={() => setRegistrationStep(registrationStep - 1)}
                      className="px-8 py-4 bg-surface-container-high text-on-surface font-bold rounded-full transition-all active:scale-95"
                    >
                      {t('companies.backButton')}
                    </button>
                  )}
                  <button
                    disabled={isSubmitting}
                    onClick={() => {
                      if (registrationStep < 3) setRegistrationStep(registrationStep + 1);
                      else handleSubmit();
                    }}
                    className="flex-1 py-4 bg-primary text-white font-bold rounded-full shadow-xl shadow-primary/20 active:scale-95 transition-all relative overflow-hidden flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t('companies.validatingLabel')}
                      </>
                    ) : (
                      <>
                        <span>{registrationStep === 3 ? t('companies.finishRegistrationButton') : t('companies.continueButton')}</span>
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Company Detail Modal */}
      <AnimatePresence>
        {selectedCompany && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCompany(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-surface rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="relative h-48 bg-primary overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/50" />
                <button 
                  onClick={() => setSelectedCompany(null)}
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all z-20"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="px-8 pb-12 -mt-16 relative z-10">
                <div className="flex flex-col md:flex-row items-end gap-6 mb-8">
                  <img src={selectedCompany.logo} className="w-32 h-32 rounded-[2rem] bg-white p-1 shadow-2xl" />
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-3">
                      <h2 className="text-4xl font-extrabold font-display text-white drop-shadow-md">{selectedCompany.name}</h2>
                      {selectedCompany.isVerified && <CheckCircle2 className="w-6 h-6 text-secondary fill-white" />}
                    </div>
                    <p className="text-white/80 font-bold text-sm uppercase tracking-widest mt-1">{selectedCompany.industry}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <section>
                      <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4">{t('companies.aboutUsTitle')}</h4>
                      <p className="text-on-surface-variant leading-relaxed text-lg">
                        {selectedCompany.description}
                      </p>
                    </section>

                    {selectedCompany.leadership && selectedCompany.leadership.length > 0 && (
                      <section>
                        <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4">{t('companies.leadershipLabel')}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedCompany.leadership.map((person, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl border border-outline/5 hover:border-primary/20 transition-all">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                                {person.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-on-surface">{person.name}</p>
                                <p className="text-xs text-on-surface-variant">{person.role}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {selectedCompany.certifications && selectedCompany.certifications.length > 0 && (
                      <section>
                        <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-4">{t('companies.certificationsLabel')}</h4>
                        <div className="space-y-3">
                          {selectedCompany.certifications.map((cert, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-outline/5">
                              <div className="flex items-center gap-4">
                                <Award className="w-6 h-6 text-secondary" />
                                <div>
                                  <p className="font-bold text-on-surface">{cert.name}</p>
                                  <p className="text-xs text-on-surface-variant">{cert.entity}</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{cert.year}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>

                  <div className="space-y-8">
                    <div className="p-6 bg-surface-container-low rounded-[2rem] border border-outline/5 space-y-6">
                      <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">{t('companies.detailsTitle')}</h4>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <UserCircle className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-[9px] font-bold text-on-surface-variant uppercase">{t('companies.ceoDetailLabel')}</p>
                            <p className="font-bold text-on-surface">{selectedCompany.ceoName || t('companies.naFallback')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-[9px] font-bold text-on-surface-variant uppercase">{t('companies.employeesDetailLabel')}</p>
                            <p className="font-bold text-on-surface">{selectedCompany.employees}</p>
                          </div>
                        </div>
                        {selectedCompany.yearsInMarket && (
                          <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-primary" />
                            <div>
                              <p className="text-[9px] font-bold text-on-surface-variant uppercase">{t('companies.yearsInMarketDetailLabel')}</p>
                              <p className="font-bold text-on-surface">{selectedCompany.yearsInMarket === '10+' ? t('companies.moreThan10Years') : t('companies.yearsSuffix', { years: selectedCompany.yearsInMarket })}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <MapPin className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-[9px] font-bold text-on-surface-variant uppercase">{t('companies.locationDetailLabel')}</p>
                            <p className="font-bold text-on-surface">{selectedCompany.location}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-[9px] font-bold text-on-surface-variant uppercase">{t('companies.websiteDetailLabel')}</p>
                            <p className="font-bold text-on-surface truncate max-w-[120px]">{selectedCompany.website}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-surface-container-low rounded-[2rem] border border-outline/5 space-y-4">
                      <h4 className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">{t('companies.socialMediaTitle')}</h4>
                      <div className="flex gap-3">
                        {selectedCompany.social?.linkedin && (
                          <a href={`https://${selectedCompany.social.linkedin}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm">
                            <Linkedin className="w-5 h-5" />
                          </a>
                        )}
                        {selectedCompany.social?.instagram && (
                          <a href={`https://${selectedCompany.social.instagram}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm">
                            <Instagram className="w-5 h-5" />
                          </a>
                        )}
                        {selectedCompany.social?.twitter && (
                          <a href={`https://${selectedCompany.social.twitter}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm">
                            <Twitter className="w-5 h-5" />
                          </a>
                        )}
                        {selectedCompany.social?.facebook && (
                          <a href={`https://${selectedCompany.social.facebook}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm">
                            <Facebook className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onChat?.({ id: (selectedCompany as any).ownerId || selectedCompany.id, name: selectedCompany.name, avatar: selectedCompany.logo })}
                      className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <MessageSquare className="w-5 h-5" />
                      {t('companies.contactCompanyButton')}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleToggleVerified(selectedCompany)}
                        disabled={isVerifying}
                        className={`w-full py-4 font-bold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${
                          selectedCompany.isVerified ? 'bg-surface-container-high text-on-surface-variant' : 'bg-secondary text-white shadow-secondary/20'
                        }`}
                      >
                        {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                        {selectedCompany.isVerified ? t('companies.removeVerificationButton') : t('companies.verifyCompanyButton')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
