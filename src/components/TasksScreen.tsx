import { MOCK_TASKS } from '../constants';
import { MoreVertical, CheckCircle2, RefreshCw, MapPin, AlertTriangle } from 'lucide-react';

export default function TasksScreen() {
  return (
    <div className="py-6 space-y-10">
      {/* AI Insight Header */}
      <section>
        <div className="bg-primary-container text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center gap-10">
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-secondary/20 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50" />

          <div className="relative z-10 flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-secondary-container" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <span className="font-display font-bold text-[10px] tracking-[0.3em] uppercase text-white/70">Análisis de Datos</span>
            </div>
            <h2 className="font-display font-extrabold text-4xl mb-6 leading-tight max-w-lg">EG Connect identificó 4 nuevas acciones tras sus reuniones.</h2>
            <p className="text-primary-fixed/80 font-medium max-w-md text-lg">El sistema analizó sus notas para priorizar su flujo de networking.</p>
          </div>
          
          <div className="relative z-10">
            <button className="bg-secondary-container text-on-secondary-container font-display font-bold py-5 px-10 rounded-full flex items-center gap-3 active:scale-95 transition-all shadow-xl uppercase tracking-widest text-xs outline-hidden">
              Revisar Todo <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Tasks List */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-8 px-1">
            <h3 className="font-display font-bold text-3xl text-primary tracking-tight">Tareas Pendientes</h3>
            <span className="bg-surface-container-high text-on-surface-variant font-bold text-[10px] px-4 py-1.5 rounded-full uppercase tracking-widest">{MOCK_TASKS.length} Activas</span>
          </div>
          <div className="space-y-4">
            {MOCK_TASKS.map((task) => (
              <div key={task.id} className="editorial-card p-6 flex items-start gap-6 border-none shadow-md hover:shadow-xl transition-all">
                <div className="pt-1.5">
                  <input type="checkbox" className="w-6 h-6 rounded-lg border-outline-variant text-secondary focus:ring-secondary cursor-pointer transition-all outline-hidden" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold font-display tracking-widest uppercase ${task.priority === 'high' ? 'text-secondary' : 'text-on-surface-variant opacity-60'}`}>
                      {task.priority === 'high' ? 'Prioridad Alta' : task.priority}
                    </span>
                    <span className="text-[10px] font-bold text-outline opacity-60">{task.timeAgo}</span>
                  </div>
                  <p className="font-display font-bold text-xl text-on-surface mb-2">{task.title}</p>
                  <p className="text-on-surface-variant text-sm font-medium leading-relaxed bg-surface-container-low p-2 rounded-xl border border-white/50">
                    Origen: "{task.source}"
                  </p>
                </div>
                <button className="text-outline-variant hover:text-primary transition-colors p-2 outline-hidden">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications Sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-surface-container-low p-8 rounded-[2rem] sticky top-24 border border-white/50 shadow-sm">
            <h3 className="font-display font-bold text-2xl text-primary mb-8 tracking-tight">Alertas Generales</h3>
            <div className="space-y-8">
              {[
                { icon: MapPin, color: 'text-secondary bg-secondary/10', title: 'Alerta Proximidad', desc: 'David Chen está cerca de Sipopo (200m).', action: 'Ver Conexión' },
                { icon: RefreshCw, color: 'text-primary bg-primary/10', title: 'Sincronización Exitosa', desc: '124 contactos actualizados desde la nube.', action: 'Ver Log' },
                { icon: AlertTriangle, color: 'text-error bg-error-container/20', title: 'Conflicto de Agenda', desc: 'Seguimiento con Marcus coincide con "Junta Directiva".', action: 'Reprogramar' }
              ].map((alert) => (
                <div key={alert.title} className="flex gap-5">
                  <div className={`w-12 h-12 rounded-2xl ${alert.color} flex items-center justify-center shrink-0`}>
                    <alert.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-base text-on-surface leading-snug mb-1">{alert.title}</p>
                    <p className="text-on-surface-variant text-xs mb-3 font-medium opacity-80">{alert.desc}</p>
                    <button className="text-[10px] font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-0.5 hover:border-primary transition-colors outline-hidden">{alert.action}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
