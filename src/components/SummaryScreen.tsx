import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { Users, Calendar, Rocket, MapPin, ArrowRight } from 'lucide-react';
import { Contact, Event, Initiative } from '../types';
import { auth } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

export default function SummaryScreen({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const currentUid = auth.currentUser?.uid;

  const { data: contacts } = useFirestoreCollection<Contact>(currentUid ? `users/${currentUid}/contacts` : null);

  const eventConstraints = useMemo(
    () => (currentUid ? [where('attendeeIds', 'array-contains', currentUid)] : []),
    [currentUid]
  );
  const { data: myEvents } = useFirestoreCollection<Event>(currentUid ? 'events' : null, eventConstraints);

  const initiativeConstraints = useMemo(
    () => (currentUid ? [where('members', 'array-contains', currentUid)] : []),
    [currentUid]
  );
  const { data: myInitiatives } = useFirestoreCollection<Initiative>(currentUid ? 'initiatives' : null, initiativeConstraints);

  const upcomingEvents = useMemo(
    () => [...myEvents].filter((e) => e.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    [myEvents]
  );

  return (
    <div className="py-6 space-y-8 max-w-lg mx-auto">
      <section>
        <div className="editorial-card p-8 overflow-hidden relative border-none">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-on-surface-variant font-bold text-[10px] tracking-widest uppercase mb-1 opacity-60">Tu Red</p>
              <h2 className="text-4xl font-extrabold font-display text-primary leading-none">{contacts.length} Contactos</h2>
            </div>
            <div className="bg-secondary-container/20 p-4 rounded-full">
              <Users className="w-8 h-8 text-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-outline/10">
            <div>
              <p className="text-2xl font-extrabold font-display text-primary leading-none">{myEvents.length}</p>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">Eventos confirmados</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold font-display text-primary leading-none">{myInitiatives.length}</p>
              <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">Iniciativas activas</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6 px-1">
          <h3 className="font-display font-bold text-xl text-primary">Próximos Eventos</h3>
          {onNavigate && (
            <button onClick={() => onNavigate('events')} className="text-[10px] font-bold text-secondary tracking-widest uppercase bg-secondary/10 px-3 py-1 rounded-full flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="editorial-card p-6 text-center border-dashed border-2 shadow-none">
            <Calendar className="w-6 h-6 text-outline/40 mx-auto mb-2" />
            <p className="text-xs font-bold text-on-surface-variant">No tienes eventos próximos confirmados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="bg-surface-container-low border border-outline/5 p-4 rounded-[1.5rem] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-on-surface text-sm truncate">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="w-3 h-3 text-on-surface-variant" />
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase">{event.location} · {event.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {myInitiatives.length > 0 && (
        <section className="pb-10">
          <h3 className="font-display font-bold text-xl text-primary mb-6 px-1">Tus Iniciativas</h3>
          <div className="space-y-3">
            {myInitiatives.slice(0, 3).map((initiative) => (
              <div key={initiative.id} className="bg-surface-container-low border border-outline/5 p-4 rounded-[1.5rem] flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Rocket className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-on-surface text-sm truncate">{initiative.title}</h4>
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">{initiative.members?.length || 0} colaboradores</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
