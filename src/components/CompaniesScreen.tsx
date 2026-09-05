import { useState } from 'react';
import { Building2, Search, Filter, Globe, MapPin, Users, CheckCircle2, ChevronRight, X, ShieldCheck, Linkedin, Instagram, Twitter, Facebook, Award, Loader2, MessageSquare, UserCircle, Grid, LayoutList, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { limit, orderBy } from 'firebase/firestore';
import { Company, UserProfile } from '../types';
import { auth, setCompanyVerified } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import CompanyRegistrationWizard from './CompanyRegistrationWizard';

const PAGE_SIZE_INCREMENT = 20;

export default function CompaniesScreen({ onChat, profileData }: { onChat?: (participant?: { id: string; name: string; avatar: string }) => void, profileData?: UserProfile | null }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
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
              className={`p-2 rounded-xl transition-all focus-ring-custom ${viewMode === 'grid' ? 'bg-white shadow-md text-primary' : 'text-on-surface-variant opacity-40 hover:opacity-100'}`}
              title={t('companies.gridViewTooltip')}
              aria-label={t('companies.gridViewTooltip')}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all focus-ring-custom ${viewMode === 'list' ? 'bg-white shadow-md text-primary' : 'text-on-surface-variant opacity-40 hover:opacity-100'}`}
              title={t('companies.listViewTooltip')}
              aria-label={t('companies.listViewTooltip')}
            >
              <LayoutList className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={`relative p-4 border rounded-[1.5rem] transition-colors focus-ring-custom ${
                activeFilterCount > 0 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low border-outline/10 text-on-surface-variant hover:bg-surface-container-high'
              }`}
              aria-label={t('companies.toggleFiltersAria')}
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
                      className="p-2.5 bg-primary/5 text-primary rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 focus-ring-custom"
                      aria-label={t('companies.contactCompanyIconAria')}
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
      <CompanyRegistrationWizard isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

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
                  className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all z-20 focus-ring-inverse"
                  aria-label={t('companies.closeCompanyDetailAria')}
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
                          <a href={`https://${selectedCompany.social.linkedin}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm focus-ring-custom" aria-label={t('companies.visitSocialLinkAria', { platform: 'LinkedIn' })}>
                            <Linkedin className="w-5 h-5" />
                          </a>
                        )}
                        {selectedCompany.social?.instagram && (
                          <a href={`https://${selectedCompany.social.instagram}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm focus-ring-custom" aria-label={t('companies.visitSocialLinkAria', { platform: 'Instagram' })}>
                            <Instagram className="w-5 h-5" />
                          </a>
                        )}
                        {selectedCompany.social?.twitter && (
                          <a href={`https://${selectedCompany.social.twitter}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm focus-ring-custom" aria-label={t('companies.visitSocialLinkAria', { platform: 'Twitter' })}>
                            <Twitter className="w-5 h-5" />
                          </a>
                        )}
                        {selectedCompany.social?.facebook && (
                          <a href={`https://${selectedCompany.social.facebook}`} target="_blank" className="p-3 bg-white rounded-xl hover:text-primary transition-all shadow-sm focus-ring-custom" aria-label={t('companies.visitSocialLinkAria', { platform: 'Facebook' })}>
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
