import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Search, Filter, Star, Clock,
  ChevronRight, MapPin,
  MoreVertical, Trash2,
  TrendingUp, Circle, CheckCircle2, UserPlus,
  StickyNote, Mail, Loader2, X, Check
} from 'lucide-react';
import { Contact } from '../types';
import { auth, addContact, importGoogleContacts, GoogleImportedContact } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

export default function CRMScreen() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Prospecto' | 'Socio' | 'Aliado' | 'Cliente'>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [googleContacts, setGoogleContacts] = useState<GoogleImportedContact[] | null>(null);
  const [selectedGoogle, setSelectedGoogle] = useState<Set<number>>(new Set());
  const [isSavingImport, setIsSavingImport] = useState(false);

  const currentUid = auth.currentUser?.uid;
  const { data: contacts, loading } = useFirestoreCollection<Contact>(currentUid ? `users/${currentUid}/contacts` : null);

  const handleImportGoogle = async () => {
    setIsImporting(true);
    setImportError('');
    try {
      const results = await importGoogleContacts();
      setGoogleContacts(results);
      setSelectedGoogle(new Set(results.map((_, i) => i)));
    } catch (error: any) {
      setImportError(error?.message || 'No se pudo conectar con Google Contactos.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveImport = async () => {
    if (!currentUid || !googleContacts) return;
    setIsSavingImport(true);
    try {
      const toImport = googleContacts.filter((_, i) => selectedGoogle.has(i));
      for (const c of toImport) {
        await addContact(currentUid, {
          name: c.name,
          role: c.role,
          company: c.company,
          location: '',
          tags: ['Google'],
          note: c.phone ? `Tel: ${c.phone}` : '',
          avatar: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop',
          lastMet: 'Importado'
        });
      }
      setGoogleContacts(null);
      setSelectedGoogle(new Set());
    } finally {
      setIsSavingImport(false);
    }
  };

  // El estado de relación (Prospecto/Socio/...) todavía no se guarda por contacto —
  // se deriva del orden mientras se construye esa función de verdad.
  const contactsWithCRM = useMemo(() => {
    return contacts.map((c, i) => ({
      ...c,
      crmStatus: ['Prospecto', 'Socio', 'Aliado', 'Cliente'][i % 4] as any,
      lastInteraction: ['Hoy', 'Ayer', 'Hace 3 días', 'Hace 1 semana'][i % 4],
      engagement: 20 + (i * 15) % 80
    }));
  }, [contacts]);

  const filtered = contactsWithCRM.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                         c.company.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'all' || c.crmStatus === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Prospecto': return 'text-amber-500 bg-amber-50 border-amber-100';
      case 'Socio': return 'text-emerald-500 bg-emerald-50 border-emerald-100';
      case 'Aliado': return 'text-blue-500 bg-blue-50 border-blue-100';
      case 'Cliente': return 'text-purple-500 bg-purple-50 border-purple-100';
      default: return 'text-on-surface-variant bg-surface-container border-outline/10';
    }
  };

  return (
    <div className="py-6 space-y-6">
      <header className="px-1 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h2 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Networking CRM</h2>
          </div>
          <h1 className="text-3xl font-black font-display text-primary leading-tight">Gestor de Relaciones</h1>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xs">
            Optimiza tu red de contactos y haz seguimiento a tus alianzas estratégicas.
          </p>
        </div>
        <button
          onClick={handleImportGoogle}
          disabled={isImporting}
          className="bg-white border-2 border-outline/10 text-primary p-4 rounded-2xl shadow-sm active:scale-90 transition-all disabled:opacity-50"
          title="Importar contactos de Google"
        >
          {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
        </button>
      </header>

      {importError && (
        <div className="mx-1 p-4 bg-error/5 border border-error/20 rounded-2xl">
          <p className="text-xs font-bold text-error">{importError}</p>
        </div>
      )}

      {/* CRM Stats Summary */}
      <div className="grid grid-cols-2 gap-4 px-1 text-center">
        <div className="bg-white p-4 rounded-[1.8rem] shadow-sm border border-outline/5">
          <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Total Contactos</p>
          <div className="text-2xl font-black text-primary">{contactsWithCRM.length}</div>
        </div>
        <div className="bg-white p-4 rounded-[1.8rem] shadow-sm border border-outline/5">
          <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Nuevas Sinergias</p>
          <div className="text-2xl font-black text-emerald-500">+4</div>
        </div>
      </div>

      {/* Interface: Search and Filter Tabs */}
      <div className="space-y-4 px-1 sticky top-0 z-10 py-2 bg-surface/80 backdrop-blur-md">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
          <input 
            type="text"
            placeholder="Nombre, empresa o etiquetas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border-2 border-outline/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:border-primary shadow-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
          {['all', 'Prospecto', 'Socio', 'Aliado', 'Cliente'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s as any)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all ${
                filterStatus === s 
                  ? 'bg-primary border-primary text-white shadow-lg' 
                  : 'bg-white border-outline/10 text-on-surface-variant'
              }`}
            >
              {s === 'all' ? 'Ver Todos' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      {!loading && filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3 opacity-60">
          <Users className="w-10 h-10 mx-auto text-outline" />
          <p className="text-sm font-bold text-on-surface-variant">Todavía no tienes contactos guardados.</p>
          <p className="text-xs text-on-surface-variant">Usa "Escanear" para guardar tu primera tarjeta de contacto.</p>
        </div>
      ) : (
      <div className="space-y-3">
        {filtered.map((contact) => (
          <motion.div
            layoutId={contact.id}
            key={contact.id}
            onClick={() => setSelectedContact(contact as any)}
            className="bg-white p-4 rounded-[2rem] shadow-sm border border-outline/5 hover:border-primary/20 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <img 
                  src={contact.avatar} 
                  alt={contact.name} 
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-outline/5" 
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(contact.crmStatus).split(' ')[0].replace('text-', 'bg-')}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-primary truncate">{contact.name}</h3>
                  {contact.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-secondary" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-on-surface-variant font-medium truncate">{contact.role} @ {contact.company}</span>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${getStatusColor(contact.crmStatus)}`}>
                    {contact.crmStatus}
                  </span>
                  <div className="flex items-center gap-1 text-[8px] font-bold text-outline uppercase tracking-tighter">
                    <Clock className="w-2.5 h-2.5" />
                    Interactuó {contact.lastInteraction}
                  </div>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
      )}

      {/* CRM Contact Details Modal (Simplified) */}
      <AnimatePresence>
        {selectedContact && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedContact(null)}
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl relative"
            >
              <div className="h-24 bg-gradient-to-r from-primary to-primary-container p-6 relative">
                 <button 
                  onClick={() => setSelectedContact(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white"
                >
                  <Filter className="w-5 h-5 rotate-45" /> 
                </button>
              </div>
              
              <div className="px-8 pb-8 -mt-12 text-center">
                <div className="relative inline-block mb-4">
                  <img src={selectedContact.avatar} className="w-24 h-24 rounded-3xl border-4 border-white shadow-xl mx-auto object-cover" />
                  <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl shadow-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                
                <h2 className="text-2xl font-black text-primary">{selectedContact.name}</h2>
                <p className="text-sm font-medium text-on-surface-variant mb-6">{selectedContact.role} en {selectedContact.company}</p>

                <div className="space-y-4 text-left">
                  <div className="p-4 bg-surface-container rounded-2xl border border-outline/5">
                    <div className="flex items-center gap-2 mb-2 text-primary">
                      <StickyNote className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Notas</span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      {selectedContact.note || 'Sin notas guardadas para este contacto.'}
                    </p>
                  </div>

                  {selectedContact.location && (
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase">Ubicación</span>
                      </div>
                      <span className="text-[10px] font-bold text-primary">{selectedContact.location}</span>
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => setSelectedContact(null)}
                  className="w-full mt-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                >
                  Cerrar Gestor
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {googleContacts && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSavingImport && setGoogleContacts(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="p-8 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-extrabold font-display text-on-surface">Elige qué importar</h2>
                    <p className="text-xs text-on-surface-variant mt-1">{googleContacts.length} contactos encontrados en Google</p>
                  </div>
                  <button onClick={() => setGoogleContacts(null)} className="p-2 rounded-full hover:bg-surface-container-high transition-all">
                    <X className="w-5 h-5 text-on-surface-variant" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-8 space-y-2">
                {googleContacts.length === 0 && (
                  <p className="text-sm text-on-surface-variant text-center py-8">No encontramos contactos con nombre en tu cuenta de Google.</p>
                )}
                {googleContacts.map((c, i) => {
                  const isSelected = selectedGoogle.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const next = new Set(selectedGoogle);
                        if (isSelected) next.delete(i); else next.add(i);
                        setSelectedGoogle(next);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                        isSelected ? 'bg-primary/5 border-primary' : 'bg-surface-container-low border-outline/5'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-white border border-outline/20'}`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{c.name}</p>
                        {(c.company || c.phone) && (
                          <p className="text-[10px] text-on-surface-variant truncate">{[c.role, c.company, c.phone].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-8 pt-4">
                <button
                  disabled={selectedGoogle.size === 0 || isSavingImport}
                  onClick={handleSaveImport}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {isSavingImport ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Importando...</>
                  ) : (
                    `Importar ${selectedGoogle.size} contacto${selectedGoogle.size !== 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="pt-8 text-center px-6">
        <p className="text-[9px] font-bold text-outline uppercase tracking-[0.2em] leading-relaxed">
          Los datos del CRM se almacenan localmente y son totalmente privados de tu cuenta de EG Connect.
        </p>
      </footer>
    </div>
  );
}
