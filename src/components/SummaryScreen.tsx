import { TrendingUp, UserPlus, MapPin, Building, Send, Bell, Briefcase, ChevronRight } from 'lucide-react';
import { MOCK_CONTACTS } from '../constants';

export default function SummaryScreen() {
  return (
    <div className="py-6 space-y-8 max-w-lg mx-auto">
      <section>
        <div className="editorial-card p-8 overflow-hidden relative border-none">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-on-surface-variant font-bold text-[10px] tracking-widest uppercase mb-1 opacity-60">Crecimiento de Red</p>
              <h2 className="text-4xl font-extrabold font-display text-primary leading-none">15 Contactos Nuevos</h2>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center gap-1 bg-secondary/10 px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3 text-secondary" />
                  <span className="text-secondary font-bold text-[10px]">+20% vs la semana pasada</span>
                </div>
              </div>
            </div>
            <div className="bg-secondary-container/20 p-4 rounded-full">
              <UserPlus className="w-8 h-8 text-secondary" />
            </div>
          </div>
          
          {/* Mock Chart */}
          <div className="flex items-end gap-2 h-20 mt-8">
            {[30, 45, 25, 60, 40, 85, 100].map((h, i) => (
              <div key={i} className={`flex-1 rounded-t-xl transition-all duration-500 ${i === 6 ? 'bg-primary' : 'bg-surface-container-high'}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </section>

      {/* Recommended Tenders Section */}
      <section>
        <div className="flex justify-between items-center mb-6 px-1">
          <h3 className="font-display font-bold text-xl text-primary">Licitaciones para ti</h3>
          <span className="text-[10px] font-bold text-secondary tracking-widest uppercase bg-secondary/10 px-3 py-1 rounded-full">Recomendado</span>
        </div>
        <div className="space-y-3">
          {[
            { id: 1, title: 'Equipamiento IT Luba', company: 'BANGE', budget: '25.000.000 XAF', match: '98%' },
            { id: 2, title: 'Suministro Solar Sipopo', company: 'GE Petrol', budget: '15.000.000 XAF', match: '92%' }
          ].map((tender) => (
            <div key={tender.id} className="bg-surface-container-low border border-outline/5 p-4 rounded-[1.5rem] flex items-center gap-4 hover:border-primary/20 transition-all cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">{tender.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">{tender.company}</span>
                  <div className="w-1 h-1 bg-outline-variant rounded-full" />
                  <span className="text-[10px] font-bold text-secondary tracking-tighter">{tender.match} de coincidencia</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-on-surface-variant/40 group-hover:translate-x-1 transition-transform" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-display font-bold text-xl text-primary mb-6 px-1">Actividad por Ubicación</h3>
        <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar px-1">
          {[
            { icon: MapPin, label: 'Bata', count: 8 },
            { icon: Building, label: 'Malabo Hub', count: 4 },
            { icon: MapPin, label: 'Sipopo', count: 3 }
          ].map((loc) => (
            <div key={loc.label} className="shrink-0 bg-surface-container-low px-6 py-4 rounded-[1.5rem] flex items-center gap-3 border border-white/50">
              <loc.icon className="w-5 h-5 text-primary" />
              <span className="font-bold text-on-surface text-sm">{loc.label} <span className="text-on-surface-variant font-normal">({loc.count})</span></span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6 px-1">
          <h3 className="font-display font-bold text-xl text-primary">Contactos en Riesgo</h3>
          <span className="text-[10px] font-bold text-error tracking-widest uppercase bg-error-container/20 px-3 py-1 rounded-full">Acción Requerida</span>
        </div>
        <div className="space-y-4">
          {MOCK_CONTACTS.slice(1, 3).map((contact, i) => (
            <div key={contact.id} className="editorial-card p-5 flex items-center justify-between group border-none shadow-md">
              <div className="flex items-center gap-4">
                <img src={contact.avatar} alt={contact.name} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                <div className="flex-1">
                  <p className="font-bold font-display text-on-surface leading-tight">{contact.name}</p>
                  <p className="text-xs text-on-surface-variant font-medium mt-1">Visto hace {5 - i} días • {i === 0 ? 'Sin seguimiento' : 'Esperando respuesta'}</p>
                </div>
              </div>
              <button className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 outline-hidden ${i === 0 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface-container text-primary'}`}>
                {i === 0 ? <Send className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* AI Suggestion Card */}
      <section className="pb-10">
        <div className="bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl shadow-primary/20">
          <div className="absolute -right-6 -top-6 opacity-10">
            <span className="material-symbols-outlined text-[160px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-secondary-container p-2 rounded-xl">
              <span className="material-symbols-outlined text-on-secondary-container text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <span className="text-white/80 font-bold text-[10px] font-display tracking-[0.2em] uppercase">Sugerencias del Sistema</span>
          </div>
          <p className="text-white text-2xl leading-tight font-display font-bold relative z-10 mb-8 text-balance">
            Conecte con <span className="text-secondary-container underline underline-offset-4">Elena R.</span> de logística, tiene intereses similares en expansión regional.
          </p>
          <div className="flex gap-4">
            <button className="bg-white text-primary rounded-full px-8 py-3.5 text-sm font-bold active:scale-95 transition-all shadow-lg uppercase tracking-widest outline-hidden">Ver Perfil</button>
          </div>
        </div>
      </section>
    </div>
  );
}
