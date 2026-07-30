import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_CONTACTS, SUGGESTED_CONNECTIONS } from '../constants';
import { MapPin, UserPlus, Sparkles, ChevronRight, MessageSquare, Database, Check, Clock } from 'lucide-react';
import FeedItem from './FeedItem';
import { localDataService } from '../services/localDataService';

interface TimelineScreenProps {
  onChat?: (participant: { id: string; name: string; avatar: string }) => void;
}

export default function TimelineScreen({ onChat }: TimelineScreenProps) {
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsSyncing(false), 2000);
    const cached = localDataService.getCachedContacts();
    if (cached.length > 0) {
      setContacts(cached);
    }
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="py-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-xs pointer-events-none"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
              <div className="flex flex-col items-center">
                <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] animate-pulse">Sincronizando Ecosistema...</p>
                <p className="text-[10px] text-on-surface-variant font-medium mt-1">Recuperando datos locales de Malabo</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="mb-8 px-1">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-4xl font-extrabold text-primary tracking-tight">Conexiones Recientes</h1>
          {localDataService.getLastSyncTime() && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full border border-success/20">
              <Database className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Local-First</span>
            </div>
          )}
        </div>
        <p className="text-on-surface-variant font-sans">Su historial cronológico de crecimiento profesional en Guinea Ecuatorial.</p>
      </section>

      {/* Suggested Connections Section */}
      <section className="space-y-5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-secondary" />
            <h3 className="text-lg font-bold font-display text-primary">Recomendaciones para Ti</h3>
          </div>
          <button className="text-[10px] font-bold text-secondary uppercase tracking-widest flex items-center gap-1 outline-hidden">
            Ver todo <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 px-1">
          {SUGGESTED_CONNECTIONS.map((suggestion) => (
            <motion.div 
              key={suggestion.id}
              whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgba(1, 102, 114, 0.05), 0 8px 10px -6px rgba(1, 102, 114, 0.05)' }}
              className="min-w-[280px] bg-secondary-container/10 border border-secondary/10 p-5 rounded-[2rem] flex flex-col gap-4 relative overflow-hidden transition-colors hover:border-secondary/30"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full -translate-y-8 translate-x-8" />
              <div className="flex items-start gap-4 transition-transform active:scale-95 cursor-pointer">
                <img 
                  src={suggestion.avatar} 
                  alt={suggestion.name}
                  className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white shadow-sm"
                />
                <div className="flex-1">
                  <h4 className="font-bold text-primary">{suggestion.name}</h4>
                  <p className="text-xs text-secondary font-medium leading-tight mb-1">{suggestion.role}</p>
                  <div className="flex items-center gap-1 text-[10px] text-on-surface-variant/70">
                    <MapPin className="w-3 h-3" />
                    <span>{suggestion.location}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/40 backdrop-blur-sm p-3 rounded-xl">
                <p className="text-[10px] font-medium text-on-surface-variant leading-relaxed">
                  <span className="font-bold text-secondary text-balance">¿Por qué conectar?</span> {suggestion.reason}
                </p>
              </div>

                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center text-[10px] font-bold">
                      {suggestion.matchScore}%
                    </div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">Afinidad</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onChat?.({ id: suggestion.id, name: suggestion.name, avatar: suggestion.avatar })}
                      className="p-2 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    {(!suggestion.status || suggestion.status === 'none') ? (
                      <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-full text-[10px] font-bold shadow-md shadow-secondary/20 outline-hidden">
                        <UserPlus className="w-3 h-3" />
                        Conectar
                      </button>
                    ) : suggestion.status === 'connected' ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full text-[10px] font-bold border border-success/20">
                        <Check className="w-3 h-3" />
                        Conectado
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-outline/10 text-outline-variant rounded-full text-[10px] font-bold border border-outline/10">
                        <Clock className="w-3 h-3" />
                        Pendiente
                      </div>
                    )}
                  </div>
                </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Group: Hoy */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-widest text-secondary font-label">Hoy</span>
          <div className="h-px flex-1 bg-surface-container-high" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.filter(c => c.lastMet === 'Hoy').map(contact => (
            <FeedItem key={contact.id} contact={contact} onChat={onChat} />
          ))}
        </div>
      </div>

      {/* Group: Ayer */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-widest text-outline font-label">Ayer</span>
          <div className="h-px flex-1 bg-surface-container-high" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.filter(c => c.lastMet === 'Ayer').map(contact => (
            <FeedItem key={contact.id} contact={contact} onChat={onChat} />
          ))}
        </div>
      </div>
    </div>
  );
}
