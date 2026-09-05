import { useState, useMemo } from 'react';
import { Calendar, MapPin, Users, ChevronRight, Plus, X, Loader2, CheckCircle2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Event, UserProfile } from '../types';
import { auth, createEvent, toggleEventAttendance } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

// Los valores de esta lista se guardan tal cual en Firestore (event.category)
// -- son datos persistidos, no solo texto de UI, así que se dejan en español
// para no desincronizar categorías ya guardadas por usuarios existentes.
const CATEGORIES = ['Networking', 'Formación', 'Conferencia', 'Cultura', 'Deporte', 'Otro'];

const formatDay = (isoDate: string, monthsShort: string[]) => {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return { day: '--', month: '---' };
  return { day: String(d.getDate()), month: monthsShort[d.getMonth()] };
};

export default function EventsScreen({ profileData }: { profileData?: UserProfile | null }) {
  const { t } = useTranslation();
  const monthsShort = t('events.monthsShort', { returnObjects: true }) as string[];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const currentUid = auth.currentUser?.uid;
  const { data: events, loading } = useFirestoreCollection<Event>(currentUid ? 'events' : null);

  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    location: 'Malabo',
    category: 'Networking',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80'
  });

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  );

  const handlePublish = async () => {
    if (!currentUid) return;
    setIsPublishing(true);
    setPublishError('');
    try {
      await createEvent(currentUid, {
        ...newEvent,
        authorName: profileData?.name || 'Miembro de EG CONNECT'
      });
      setIsModalOpen(false);
      setNewEvent({ title: '', date: '', location: 'Malabo', category: 'Networking', image: newEvent.image });
    } catch (error) {
      setPublishError(t('events.errorGeneric'));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleAttendance = async (event: Event) => {
    if (!currentUid) return;
    const attending = event.attendeeIds?.includes(currentUid);
    setJoiningId(event.id);
    try {
      await toggleEventAttendance(event.id, currentUid, !attending);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">{t('events.sectionLabel')}</h2>
          <h1 className="text-4xl font-extrabold font-display text-on-surface">{t('events.title')}</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-3 bg-primary text-white rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all focus-ring-inverse"
          aria-label={t('events.createEventAria')}
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      <div className="space-y-6">
        {!loading && sortedEvents.length === 0 && (
          <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10 border-dashed text-center">
            <Calendar className="w-8 h-8 text-primary/40 mx-auto mb-4" />
            <h3 className="font-bold text-primary mb-1">{t('events.ctaTitle')}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('events.ctaDesc')}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-6 py-2.5 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 outline-hidden"
            >
              {t('events.publishButton')}
            </button>
          </div>
        )}

        {sortedEvents.map((event) => {
          const { day, month } = formatDay(event.date, monthsShort);
          const isAttending = !!currentUid && event.attendeeIds?.includes(currentUid);
          const isAuthor = event.authorId === currentUid;
          return (
            <div
              key={event.id}
              className="group relative overflow-hidden bg-surface-container-lowest rounded-[2.5rem] border border-outline/10 shadow-sm transition-all hover:shadow-xl"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl flex flex-col items-center min-w-[60px]">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-tighter leading-none">{month}</span>
                  <span className="text-xl font-extrabold text-primary leading-none mt-1">{day}</span>
                </div>
                <div className="absolute bottom-4 left-6 right-6">
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest block mb-1">{event.category}</span>
                  <h3 className="text-xl font-bold text-white leading-tight">{event.title}</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-on-surface-variant">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{event.location}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-semibold">{t('events.attendeesCount', { count: event.attendeeIds?.length || 0, author: event.authorName })}</span>
                    </div>
                    {!isAuthor && (
                      <button
                        onClick={() => handleToggleAttendance(event)}
                        disabled={joiningId === event.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all disabled:opacity-50 ${
                          isAttending ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary text-white shadow-lg shadow-primary/20'
                        }`}
                      >
                        {joiningId === event.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isAttending ? (
                          <><LogOut className="w-4 h-4" />{t('events.notAttendingButton')}</>
                        ) : (
                          <><CheckCircle2 className="w-4 h-4" />{t('events.attendingButton')}</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
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
                  <h2 className="text-2xl font-extrabold font-display text-on-surface">{t('events.modalTitle')}</h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-full hover:bg-surface-container-high transition-all focus-ring-custom" aria-label={t('events.closeCreateEventAria')}>
                    <X className="w-6 h-6 text-on-surface-variant" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('events.titleLabel')}</label>
                    <input
                      type="text"
                      placeholder={t('events.titlePlaceholder')}
                      className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('events.dateLabel')}</label>
                      <input
                        type="date"
                        className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('events.categoryLabel')}</label>
                      <select
                        className="select-field-custom"
                        value={newEvent.category}
                        onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                      >
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">{t('events.locationLabel')}</label>
                    <input
                      type="text"
                      placeholder={t('events.locationPlaceholder')}
                      className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    />
                  </div>
                </div>

                {publishError && <p className="text-xs font-bold text-error text-center">{publishError}</p>}

                <button
                  disabled={!newEvent.title || !newEvent.date || !newEvent.location || isPublishing}
                  onClick={handlePublish}
                  className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {isPublishing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />{t('events.publishing')}</>
                  ) : (
                    <><ChevronRight className="w-5 h-5" />{t('events.publishButton')}</>
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
