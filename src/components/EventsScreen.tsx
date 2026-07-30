import { Calendar, MapPin, Users, ChevronRight, Filter } from 'lucide-react';
import { MOCK_EVENTS } from '../constants';

export default function EventsScreen() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">Agenda</h2>
          <h1 className="text-4xl font-extrabold font-display text-on-surface">Eventos Locales</h1>
        </div>
        <button className="p-3 bg-surface-container-high rounded-full text-primary outline-hidden">
          <Filter className="w-5 h-5" />
        </button>
      </header>

      <div className="space-y-6">
        {MOCK_EVENTS.map((event) => (
          <div 
            key={event.id}
            className="group relative overflow-hidden bg-surface-container-lowest rounded-[2.5rem] border border-outline/10 shadow-sm transition-all hover:shadow-xl active:scale-[0.98] cursor-pointer"
          >
            <div className="relative h-48 overflow-hidden">
              <img 
                src={event.image} 
                alt={event.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl flex flex-col items-center min-w-[60px]">
                <span className="text-[10px] font-bold text-primary uppercase tracking-tighter leading-none">MAY</span>
                <span className="text-xl font-extrabold text-primary leading-none mt-1">{event.date.split(' ')[0]}</span>
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
                    <span className="text-xs font-semibold">{event.attendees} profesionales asistiendo</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-outline transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10 border-dashed text-center">
        <Calendar className="w-8 h-8 text-primary/40 mx-auto mb-4" />
        <h3 className="font-bold text-primary mb-1">¿Organizas un evento?</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Sincroniza tu calendario institucional para publicar eventos de networking.
        </p>
        <button className="mt-4 px-6 py-2.5 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 outline-hidden">
          Publicar Evento
        </button>
      </div>
    </div>
  );
}
