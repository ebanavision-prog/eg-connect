import { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Search, Filter, Plus, MessageSquare, MapPin, Tag, ArrowUpRight, ArrowDownRight, Users, Building2, User, X, CheckCircle2, Loader2, DollarSign, Trash2, Share2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ServicePost, Company } from '../types';
import { notificationService } from '../services/notificationService';
import { auth, createMarketplacePost } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import CompanyProfileModal from './CompanyProfileModal';

export default function MarketplaceScreen({ activeProfile, onContact, initialSearchQuery = '', profileData }: {
  activeProfile: 'individual' | 'company',
  onContact?: (participant?: { id: string; name: string; avatar: string }) => void,
  initialSearchQuery?: string,
  profileData?: any
}) {
  const [activeTab, setActiveTab] = useState<'offer' | 'request'>('offer');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [showShareSuccess, setShowShareSuccess] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const currentUid = auth.currentUser?.uid;
  const { data: posts } = useFirestoreCollection<ServicePost>(currentUid ? 'marketplace_posts' : null);
  const { data: companies } = useFirestoreCollection<Company & { ownerId?: string }>(currentUid ? 'companies' : null);

  const handleOpenCompanyProfile = (authorId: string) => {
    const company = companies.find(c => c.ownerId === authorId || c.id === authorId);
    if (company) {
      setSelectedCompany(company);
    }
  };

  useEffect(() => {
    const tendersCount = posts.filter(p => p.tags.some(t => t.toLowerCase() === 'licitación')).length;
    if (tendersCount > 0) {
      notificationService.sendNotification(
        'Nuevas Oportunidades',
        `Hay ${tendersCount} nuevas licitaciones disponibles en el Marketplace.`
      );
    }
  }, []);

  // Filter State
  const [filters, setFilters] = useState({
    location: 'Todos',
    minPrice: '',
    maxPrice: '',
    category: 'Todas',
    authorType: 'Todos'
  });
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');

  const handleShare = (post: ServicePost) => {
    const shareData = {
      title: post.title,
      text: `Echa un vistazo a este anuncio en EG CONNECT: ${post.title}`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareData.url).then(() => {
        setShowShareSuccess(post.id);
        setTimeout(() => setShowShareSuccess(null), 3000);
      });
    }
  };

  // Form State
  const [newPost, setNewPost] = useState({
    title: '',
    description: '',
    category: 'Consultoría',
    type: 'offer' as 'offer' | 'request',
    location: 'Malabo',
    price: ''
  });

  const filteredPosts = useMemo(() => 
    posts.filter(post => {
      const matchesTab = post.type === activeTab;
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           post.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation = filters.location === 'Todos' || post.location === filters.location;
      const matchesCategory = filters.category === 'Todas' || post.category === filters.category;
      const matchesAuthorType = filters.authorType === 'Todos' || post.authorType === filters.authorType;
      
      const priceVal = post.priceValue || 0;
      const minP = filters.minPrice ? parseInt(filters.minPrice) : 0;
      const maxP = filters.maxPrice ? parseInt(filters.maxPrice) : Infinity;
      const matchesPrice = priceVal >= minP && priceVal <= maxP;

      return matchesTab && matchesSearch && matchesLocation && matchesCategory && matchesPrice && matchesAuthorType;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') return (a.priceValue || 0) - (b.priceValue || 0);
      if (sortBy === 'price-desc') return (b.priceValue || 0) - (a.priceValue || 0);
      return b.id.localeCompare(a.id); // Default to newest (based on ID/mock)
    }), [posts, activeTab, searchQuery, filters, sortBy]
  );

  const handlePublish = async () => {
    if (!currentUid) return;
    setIsPublishing(true);
    setPublishError('');
    try {
      await createMarketplacePost(currentUid, {
        ...newPost,
        price: newPost.price ? `${newPost.price} XAF` : undefined,
        priceValue: newPost.price ? parseInt(newPost.price) : 0,
        authorName: profileData?.name || 'Miembro de EG CONNECT',
        authorAvatar: profileData?.avatar || 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=150&h=150',
        authorType: activeProfile,
        tags: [newPost.category, activeProfile === 'company' ? 'Licitación' : 'Servicio']
      });
      setIsModalOpen(false);
      setNewPost({ title: '', description: '', category: 'Consultoría', type: 'offer', location: 'Malabo', price: '' });
    } catch (error) {
      setPublishError('No se pudo publicar el anuncio. Inténtalo de nuevo.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em]">Marketplace</h2>
            <div className="h-1 w-1 bg-outline-variant rounded-full" />
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/5 rounded-lg border border-primary/10">
              {activeProfile === 'individual' ? <User className="w-3 h-3 text-secondary" /> : <Building2 className="w-3 h-3 text-primary" />}
              <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                Efectuando como: {profileData?.name || 'tú'}
              </span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold font-display text-on-surface">Servicios Locales</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="group relative p-3 bg-primary text-white rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all outline-hidden overflow-hidden"
        >
          <div className="absolute inset-0 bg-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
          <Plus className="w-6 h-6 relative z-10" />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-high p-1.5 rounded-3xl">
        <button 
          onClick={() => setActiveTab('offer')}
          className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'offer' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <ArrowUpRight className={`w-4 h-4 ${activeTab === 'offer' ? 'text-secondary' : ''}`} />
          Ofrezco
        </button>
        <button 
          onClick={() => setActiveTab('request')}
          className={`flex-1 py-3 px-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'request' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <ArrowDownRight className={`w-4 h-4 ${activeTab === 'request' ? 'text-error' : ''}`} />
          Busco
        </button>
      </div>

      {/* Search & Filter */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline transition-colors group-focus-within:text-primary" />
              <input 
                type="text" 
                placeholder="Buscar por cargo o servicio..."
                className="w-full bg-surface-container-low border border-outline/10 pl-12 pr-12 py-4 rounded-[1.5rem] text-sm focus:outline-hidden focus:border-primary transition-all focus:bg-white focus:ring-4 focus:ring-primary/5"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-surface-container-high text-outline hover:text-error transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button 
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`p-4 rounded-[1.5rem] border transition-all outline-hidden flex items-center gap-2 ${
                isFilterPanelOpen 
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                  : 'bg-surface-container-low border-outline/10 text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Filter className={`w-5 h-5 transition-transform duration-300 ${isFilterPanelOpen ? 'rotate-180' : ''}`} />
              <span className="text-xs font-bold hidden md:inline">Personalizar Búsqueda</span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isFilterPanelOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              className="overflow-hidden"
            >
              <div className="bg-surface-container-low border border-outline/10 rounded-[2rem] p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-outline/5">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-primary" />
                    <h3 className="text-[10px] font-bold text-on-surface uppercase tracking-[0.2em]">Filtros Avanzados</h3>
                  </div>
                  <button 
                    onClick={() => {
                      setFilters({ location: 'Todos', minPrice: '', maxPrice: '', category: 'Todas', authorType: 'Todos' });
                      setSortBy('newest');
                      setSearchQuery('');
                    }}
                    className="text-[9px] font-bold text-error uppercase tracking-widest hover:bg-error/5 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 group/clear"
                  >
                    <Trash2 className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                    Limpiar todo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Ubicación</label>
                    <select 
                      className="select-field-custom bg-white"
                      value={filters.location}
                      onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    >
                      <option>Todos</option>
                      <option>Malabo</option>
                      <option>Bata</option>
                      <option>Malabo II</option>
                      <option>Ciudad de la Paz (Oyala)</option>
                      <option>Continental</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Categoría de Servicio</label>
                    <select 
                      className="select-field-custom bg-white"
                      value={filters.category}
                      onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    >
                      <option>Todas</option>
                      <option>Tecnología</option>
                      <option>Consultoría</option>
                      <option>Legal</option>
                      <option>Traducción</option>
                      <option>Suministros</option>
                      <option>Seguridad</option>
                      <option>Construcción</option>
                      <option>Logística</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Tipo de Anunciante</label>
                    <select 
                      className="select-field-custom bg-white"
                      value={filters.authorType}
                      onChange={(e) => setFilters({ ...filters, authorType: e.target.value })}
                    >
                      <option value="Todos">Todos</option>
                      <option value="individual">Profesional / Individual</option>
                      <option value="company">Empresa / Corporativo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Rango de Precio (XAF)</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        placeholder="Min"
                        className="input-field-custom-sm bg-white flex-1"
                        value={filters.minPrice}
                        onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                      />
                      <span className="text-outline">/</span>
                      <input 
                        type="number" 
                        placeholder="Max"
                        className="input-field-custom-sm bg-white flex-1"
                        value={filters.maxPrice}
                        onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Ordenar por</label>
                    <select 
                      className="select-field-custom bg-white"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="newest">Más recientes</option>
                      <option value="price-asc">Precio: Menor a Mayor</option>
                      <option value="price-desc">Precio: Mayor a Menor</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setFilters({ location: 'Todos', minPrice: '', maxPrice: '', category: 'Todas', authorType: 'Todos' });
                        setSortBy('newest');
                        setSearchQuery('');
                      }}
                      className="flex-1 py-3.5 bg-surface-container-high text-on-surface-variant font-bold text-xs rounded-xl hover:bg-outline/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Restablecer
                    </button>
                    <button 
                      onClick={() => setIsFilterPanelOpen(false)}
                      className="px-6 py-3.5 bg-primary text-white font-bold text-xs rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Posts List */}
      <div className="space-y-6">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={post.id}
              onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
              className="bg-white border border-outline/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow active:scale-[0.99] cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      if (post.authorType === 'company') {
                        e.stopPropagation();
                        handleOpenCompanyProfile(post.authorId);
                      }
                    }}
                  >
                    <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                      post.authorType === 'individual' ? 'bg-secondary' : 'bg-primary'
                    }`}>
                      {post.authorType === 'individual' ? (
                        <Users className="w-2.5 h-2.5 text-white" />
                      ) : (
                        <Building2 className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 
                      className={`font-bold text-on-surface leading-none flex items-center gap-1.5 ${post.authorType === 'company' ? 'hover:text-primary transition-colors cursor-pointer' : ''}`}
                      onClick={(e) => {
                        if (post.authorType === 'company') {
                          e.stopPropagation();
                          handleOpenCompanyProfile(post.authorId);
                        }
                      }}
                    >
                      {post.authorName}
                      <span className="text-[8px] px-1.5 py-0.5 bg-surface-container-high rounded text-on-surface-variant uppercase tracking-tighter">
                        {post.authorType === 'individual' ? 'Pro' : 'Empresa'}
                      </span>
                      {post.authorType === 'company' && <Info className="w-3 h-3 text-primary" />}
                    </h4>
                    <span className="text-[10px] text-on-surface-variant/60">{post.timestamp}</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  post.type === 'offer' ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'
                }`}>
                  {post.category}
                </div>
              </div>

              <div className="flex justify-between items-start gap-4 mb-1">
                <h3 className="text-xl font-bold text-primary leading-tight">{post.title}</h3>
                <motion.div 
                  animate={{ rotate: expandedPostId === post.id ? 180 : 0 }}
                  className="p-1 px-2.5 text-outline-variant bg-surface-container-high rounded-lg flex items-center gap-2 group-hover:text-primary transition-colors"
                >
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em]">{expandedPostId === post.id ? 'Cerrar' : 'Detalles'}</span>
                  <ArrowUpRight className="w-3 h-3 rotate-45" />
                </motion.div>
              </div>

              {post.price && (
                <div className="flex items-center gap-1.5 text-secondary font-bold text-xs mb-3">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{post.price}</span>
                </div>
              )}

              <motion.p 
                layout
                className={`text-sm text-on-surface-variant leading-relaxed mb-6 ${expandedPostId !== post.id ? 'line-clamp-3' : ''}`}
              >
                {post.description}
              </motion.p>

              <AnimatePresence>
                {expandedPostId === post.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-6"
                  >
                    {post.requirements && post.requirements.length > 0 && (
                      <div className="pt-4 border-t border-outline/5 space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-secondary" />
                          <h4 className="text-[10px] font-bold text-on-surface uppercase tracking-[0.2em]">Requisitos del Anuncio</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {post.requirements.map((req, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-outline/5">
                              <div className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                              <span className="text-xs text-on-surface font-medium">{req}</span>
                            </div>
                          ))}
                        </div>
                        {post.tags.some(t => t.toLowerCase() === 'licitación') && (
                          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                            <Plus className="w-6 h-6 text-primary shrink-0" />
                            <p className="text-[10px] text-primary/80 font-medium leading-tight">
                              Esta es una oportunidad oficial garantizada bajo el marco de Contenido Local. 
                              Asegúrate de adjuntar tu certificación de empresa nacional al contactar.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-wrap gap-2 mb-6">
                {post.tags.map(tag => (
                  <div key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-high rounded-full">
                    <Tag className="w-3 h-3 text-outline" />
                    <span className="text-[10px] font-bold text-on-surface-variant tracking-tight">{tag}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-outline/5">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs font-semibold">{post.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(post);
                      }}
                      className="p-2.5 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {showShareSuccess === post.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-on-surface text-surface text-[10px] rounded-lg whitespace-nowrap z-10"
                        >
                          Enlace copiado
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onContact?.({ id: post.authorId, name: post.authorName, avatar: post.authorAvatar });
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform outline-hidden"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Contactar
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 px-8 opacity-40">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4" />
            <p className="font-bold">No se han encontrado servicios</p>
            <p className="text-xs">Prueba con otra búsqueda o cambia de categoría.</p>
          </div>
        )}
      </div>

      {/* Post Creation Modal */}
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
              className="relative w-full max-w-lg bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-extrabold font-display text-on-surface">Crear Anuncio</h2>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Publicando como <span className="font-bold text-primary">{profileData?.name || 'tú'}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 rounded-full hover:bg-surface-container-high transition-all"
                  >
                    <X className="w-6 h-6 text-on-surface-variant" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 mb-2 block">¿Qué quieres hacer?</label>
                    <div className="flex gap-2 p-1 bg-surface-container-high rounded-2xl">
                      <button 
                        onClick={() => setNewPost({ ...newPost, type: 'offer' })}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${newPost.type === 'offer' ? 'bg-white text-secondary shadow-sm' : 'text-on-surface-variant'}`}
                      >
                        Ofrecer Servicio
                      </button>
                      <button 
                        onClick={() => setNewPost({ ...newPost, type: 'request' })}
                        className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${newPost.type === 'request' ? 'bg-white text-error shadow-sm' : 'text-on-surface-variant'}`}
                      >
                        Buscar Servicio
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Título del Anuncio</label>
                    <input 
                      type="text" 
                      placeholder={newPost.type === 'offer' ? 'Ej: Servicios de Auditoría' : 'Ej: Busco Desarrollador'}
                      className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Descripción Detallada</label>
                    <textarea 
                      placeholder="Describe los puntos clave del servicio o la necesidad..."
                      rows={4}
                      className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary resize-none"
                      value={newPost.description}
                      onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Categoría</label>
                      <select 
                        className="select-field-custom"
                        value={newPost.category}
                        onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                      >
                        <option>Consultoría</option>
                        <option>Tecnología</option>
                        <option>Legal</option>
                        <option>Logística</option>
                        <option>Suministros</option>
                        <option>Seguridad</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Ubicación</label>
                      <select 
                        className="select-field-custom"
                        value={newPost.location}
                        onChange={(e) => setNewPost({ ...newPost, location: e.target.value })}
                      >
                        <option>Malabo</option>
                        <option>Bata</option>
                        <option>Malabo II</option>
                        <option>Oyala</option>
                        <option>Continental</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Precio (XAF)</label>
                      <input 
                        type="number" 
                        placeholder="Ej: 50.000"
                        className="input-field-custom"
                        value={newPost.price}
                        onChange={(e) => setNewPost({ ...newPost, price: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {publishError && <p className="text-xs font-bold text-error text-center">{publishError}</p>}

                <button
                  disabled={!newPost.title || !newPost.description || isPublishing}
                  onClick={handlePublish}
                  className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-3"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Publicando en EG CONNECT...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Publicar Anuncio {activeProfile === 'company' ? 'Corporativo' : 'Personal'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Company Profile Modal */}
      {selectedCompany && (
        <CompanyProfileModal 
          company={selectedCompany}
          isOpen={!!selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}

      {/* Info Card */}
      <div className="p-8 bg-secondary/5 rounded-[2.5rem] border border-secondary/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -translate-y-8 translate-x-8" />
        <h3 className="font-bold text-secondary mb-2">Comercio Profesional Local</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
          El marketplace de EG CONNECT está diseñado para fomentar la colaboración entre profesionales verificado en el ecosistema nacional.
        </p>
        <div className="flex items-center gap-2 p-3 bg-white/60 backdrop-blur rounded-2xl border border-secondary/10 w-fit">
          <ShoppingBag className="w-4 h-4 text-secondary" />
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-none">Marketplace Verificado</span>
        </div>
      </div>
    </div>
  );
}
