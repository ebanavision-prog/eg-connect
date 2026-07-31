import { useState, useMemo } from 'react';
import { Rocket, Plus, X, Loader2, CheckCircle2, Users, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Initiative } from '../types';
import { auth, createInitiative, toggleInitiativeMembership } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

const CATEGORIES = ['Tecnología', 'Agricultura', 'Educación', 'Salud', 'Comercio', 'Energía', 'Turismo', 'Otro'];

export default function InitiativesScreen({ profileData }: { profileData?: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('Todas');

  const currentUid = auth.currentUser?.uid;
  const { data: initiatives, loading } = useFirestoreCollection<Initiative>(currentUid ? 'initiatives' : null);

  const [newInitiative, setNewInitiative] = useState({
    title: '',
    description: '',
    category: 'Tecnología'
  });

  const filtered = useMemo(() =>
    initiatives
      .filter((i) => filterCategory === 'Todas' || i.category === filterCategory)
      .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0)),
    [initiatives, filterCategory]
  );

  const handlePublish = async () => {
    if (!currentUid) return;
    setIsPublishing(true);
    setPublishError('');
    try {
      await createInitiative(currentUid, {
        ...newInitiative,
        creatorName: profileData?.name || 'Miembro de EG CONNECT',
        creatorAvatar: profileData?.avatar || 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&w=150&h=150'
      });
      setIsModalOpen(false);
      setNewInitiative({ title: '', description: '', category: 'Tecnología' });
    } catch (error) {
      setPublishError('No se pudo crear la iniciativa. Inténtalo de nuevo.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleMembership = async (initiative: Initiative) => {
    if (!currentUid) return;
    const isMember = initiative.members?.includes(currentUid);
    setJoiningId(initiative.id);
    try {
      await toggleInitiativeMembership(initiative.id, currentUid, !isMember);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">Iniciativas</h2>
          <h1 className="text-4xl font-extrabold font-display text-on-surface">Crea o Únete a Proyectos</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="group relative p-3 bg-primary text-white rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all outline-hidden overflow-hidden"
        >
          <Plus className="w-6 h-6 relative z-10" />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['Todas', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filterCategory === cat ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 px-8 opacity-40">
            <Rocket className="w-12 h-12 mx-auto mb-4" />
            <p className="font-bold">Todavía no hay iniciativas{filterCategory !== 'Todas' ? ` en ${filterCategory}` : ''}</p>
            <p className="text-xs">Sé el primero en crear una y suma colaboradores.</p>
          </div>
        )}

        {filtered.map((initiative) => {
          const isMember = !!currentUid && initiative.members?.includes(currentUid);
          const isCreator = initiative.creatorId === currentUid;
          return (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={initiative.id}
              className="bg-white border border-outline/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img src={initiative.creatorAvatar} alt={initiative.creatorName} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <h4 className="font-bold text-on-surface leading-none">{initiative.creatorName}</h4>
                    <span className="text-[10px] text-on-surface-variant/60">Creador de la iniciativa</span>
                  </div>
                </div>
                <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                  {initiative.category}
                </div>
              </div>

              <h3 className="text-xl font-bold text-primary leading-tight mb-2">{initiative.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">{initiative.description}</p>

              <div className="flex items-center justify-between pt-4 border-t border-outline/5">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-semibold">{initiative.members?.length || 0} colaboradores</span>
                </div>
                {!isCreator && (
                  <button
                    onClick={() => handleToggleMembership(initiative)}
                    disabled={joiningId === initiative.id}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold shadow-lg transition-transform hover:scale-105 disabled:opacity-50 ${
                      isMember ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-white shadow-primary/20'
                    }`}
                  >
                    {joiningId === initiative.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isMember ? (
                      <><LogOut className="w-4 h-4" />Salir</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" />Unirme</>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

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
                  <h2 className="text-2xl font-extrabold font-display text-on-surface">Crear Iniciativa</h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high transition-all">
                    <X className="w-6 h-6 text-on-surface-variant" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Título</label>
                    <input
                      type="text"
                      placeholder="Ej: Cooperativa de exportación de cacao"
                      className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                      value={newInitiative.title}
                      onChange={(e) => setNewInitiative({ ...newInitiative, title: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Descripción</label>
                    <textarea
                      placeholder="¿Qué problema resuelve? ¿Qué tipo de colaboradores buscas?"
                      rows={4}
                      className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary resize-none"
                      value={newInitiative.description}
                      onChange={(e) => setNewInitiative({ ...newInitiative, description: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">Categoría</label>
                    <select
                      className="select-field-custom"
                      value={newInitiative.category}
                      onChange={(e) => setNewInitiative({ ...newInitiative, category: e.target.value })}
                    >
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {publishError && <p className="text-xs font-bold text-error text-center">{publishError}</p>}

                <button
                  disabled={!newInitiative.title || !newInitiative.description || isPublishing}
                  onClick={handlePublish}
                  className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {isPublishing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Creando...</>
                  ) : (
                    <><Rocket className="w-5 h-5" />Lanzar Iniciativa</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
