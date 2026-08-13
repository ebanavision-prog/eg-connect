import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Sparkles, MessageSquare, Database, Users as UsersIcon } from 'lucide-react';
import FeedItem from './FeedItem';
import { Contact } from '../types';
import { auth } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface TimelineScreenProps {
  onChat?: (participant: { id: string; name: string; avatar: string }) => void;
  users?: any[];
  currentUserName?: string;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop';

export default function TimelineScreen({ onChat, users = [], currentUserName = 'Yo' }: TimelineScreenProps) {
  const currentUid = auth.currentUser?.uid;
  const { data: contacts, loading } = useFirestoreCollection<Contact>(
    currentUid ? `users/${currentUid}/contacts` : null
  );

  const today = contacts.filter((c) => c.lastMet === 'Hoy');
  const yesterday = contacts.filter((c) => c.lastMet === 'Ayer');
  const earlier = contacts.filter((c) => c.lastMet !== 'Hoy' && c.lastMet !== 'Ayer');

  // Otros miembros reales del directorio (colección `users`) que todavía no son
  // contactos guardados — no existe backend de "recomendaciones" con match score,
  // así que mostramos personas reales en vez de datos inventados.
  const networkMembers = useMemo(() => {
    const savedIds = new Set(contacts.map((c) => c.id));
    return users
      .filter((u) => u.uid !== currentUid && u.privacyMode !== 'private' && !savedIds.has(u.uid))
      .slice(0, 10);
  }, [users, contacts, currentUid]);

  return (
    <div className="py-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <AnimatePresence>
        {loading && (
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
                <p className="text-[10px] text-on-surface-variant font-medium mt-1">Recuperando tus contactos guardados</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="mb-8 px-1">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-4xl font-extrabold text-primary tracking-tight">Conexiones Recientes</h1>
          {!loading && contacts.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full border border-success/20">
              <Database className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizado</span>
            </div>
          )}
        </div>
        <p className="text-on-surface-variant font-sans">Su historial cronológico de crecimiento profesional en Guinea Ecuatorial.</p>
      </section>

      {/* Miembros de la Red: personas reales del directorio que aún no son contactos */}
      {networkMembers.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              <h3 className="text-lg font-bold font-display text-primary">Miembros de la Red</h3>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6 px-1">
            {networkMembers.map((member) => (
              <motion.div
                key={member.uid}
                whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgba(1, 102, 114, 0.05), 0 8px 10px -6px rgba(1, 102, 114, 0.05)' }}
                className="min-w-[240px] bg-secondary-container/10 border border-secondary/10 p-5 rounded-[2rem] flex flex-col gap-4 relative overflow-hidden transition-colors hover:border-secondary/30"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="flex items-start gap-4">
                  <img
                    src={member.avatar || DEFAULT_AVATAR}
                    alt={member.name}
                    className="w-14 h-14 rounded-2xl object-cover ring-2 ring-white shadow-sm"
                  />
                  <div className="flex-1">
                    <h4 className="font-bold text-primary">{member.name}</h4>
                    <p className="text-xs text-secondary font-medium leading-tight mb-1">
                      {member.profession || member.role || 'Miembro de EG Connect'}
                    </p>
                    {member.city && (
                      <div className="flex items-center gap-1 text-[10px] text-on-surface-variant/70">
                        <MapPin className="w-3 h-3" />
                        <span>{member.city}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end mt-1">
                  <button
                    onClick={() => onChat?.({ id: member.uid, name: member.name, avatar: member.avatar || DEFAULT_AVATAR })}
                    className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-full text-[10px] font-bold shadow-md shadow-secondary/20 outline-hidden"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Contactar
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {!loading && contacts.length === 0 && (
        <div className="text-center py-16 space-y-3 opacity-60 px-1">
          <UsersIcon className="w-10 h-10 mx-auto text-outline" />
          <p className="text-sm font-bold text-on-surface-variant">Todavía no tienes contactos guardados.</p>
          <p className="text-xs text-on-surface-variant">Usa "Escanear" para guardar tu primera tarjeta de contacto.</p>
        </div>
      )}

      {/* Group: Hoy */}
      {today.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary font-label">Hoy</span>
            <div className="h-px flex-1 bg-surface-container-high" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {today.map((contact) => (
              <FeedItem key={contact.id} contact={contact} onChat={onChat} currentUserName={currentUserName} />
            ))}
          </div>
        </div>
      )}

      {/* Group: Ayer */}
      {yesterday.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-outline font-label">Ayer</span>
            <div className="h-px flex-1 bg-surface-container-high" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {yesterday.map((contact) => (
              <FeedItem key={contact.id} contact={contact} onChat={onChat} currentUserName={currentUserName} />
            ))}
          </div>
        </div>
      )}

      {/* Group: Anteriores */}
      {earlier.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-outline font-label">Anteriores</span>
            <div className="h-px flex-1 bg-surface-container-high" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {earlier.map((contact) => (
              <FeedItem key={contact.id} contact={contact} onChat={onChat} currentUserName={currentUserName} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
