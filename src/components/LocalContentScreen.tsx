import { Search, Filter, ShieldCheck, MapPin, Calendar, DollarSign, ChevronRight, Briefcase } from 'lucide-react';
import { MOCK_LOCAL_CONTENT } from '../constants';

export default function LocalContentScreen() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <div className="flex items-center gap-2 mb-2 px-1">
          <ShieldCheck className="w-4 h-4 text-secondary" />
          <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em]">Contenido Local</h2>
        </div>
        <h1 className="text-4xl font-extrabold font-display text-on-surface">Licitaciones y Oportunidades</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          Portal exclusivo para empresas nacionales. Encuentra proyectos que requieren talento y servicios locales en Guinea Ecuatorial.
        </p>
      </header>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
          <input 
            type="text" 
            placeholder="Buscar por sector o empresa..."
            className="w-full bg-surface-container-low border border-outline/10 pl-12 pr-4 py-4 rounded-[1.5rem] text-sm focus:outline-hidden focus:border-primary transition-colors"
          />
        </div>
        <button className="p-4 bg-surface-container-low border border-outline/10 rounded-[1.5rem] text-on-surface-variant hover:bg-surface-container-high transition-colors outline-hidden">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Opportunities List */}
      <div className="space-y-6">
        {MOCK_LOCAL_CONTENT.map((opportunity) => (
          <div 
            key={opportunity.id}
            className="group bg-white border border-outline/10 rounded-[2.5rem] p-8 hover:shadow-2xl hover:shadow-primary/5 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              <img 
                src={opportunity.companyLogo} 
                alt={opportunity.companyName} 
                className="w-24 h-24 rounded-3xl object-cover shadow-lg group-hover:scale-105 transition-transform"
              />
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest px-2 py-0.5 bg-secondary/10 rounded-lg">{opportunity.category}</span>
                    <h3 className="text-2xl font-bold text-primary mt-2 group-hover:text-secondary transition-colors">{opportunity.title}</h3>
                    <p className="font-semibold text-on-surface-variant text-sm">{opportunity.companyName}</p>
                  </div>
                  {opportunity.budget && (
                    <div className="px-4 py-2 bg-primary/5 rounded-2xl flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-primary">{opportunity.budget}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {opportunity.description}
                </p>

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-semibold">{opportunity.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-error">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-tighter">Cierre: {opportunity.deadline}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-outline/5">
                  <h4 className="text-[10px] font-bold text-outline-variant uppercase tracking-widest mb-3">Requisitos de Contenido Local</h4>
                  <div className="flex flex-wrap gap-2">
                    {opportunity.requirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high rounded-full">
                        <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
                        <span className="text-[10px] font-bold text-on-surface-variant">{req}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-full font-bold shadow-xl shadow-primary/10 hover:scale-105 active:scale-95 transition-all group/btn">
                Postular a Proyecto
                <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Local Content Policy Card */}
      <div className="p-10 rounded-[3rem] bg-gradient-to-br from-[#1a1a1a] to-[#2d2d2d] text-white relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-80 h-80 bg-secondary/10 rounded-full -translate-y-20 translate-x-20 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="p-6 bg-white/5 backdrop-blur rounded-[2.5rem] border border-white/10 shrink-0">
            <Briefcase className="w-16 h-16 text-secondary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display mb-4 leading-tight">Guía de Contenido Local en GE</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Asegúrate de que tu empresa cumple con los requisitos legales para acceder a estas licitaciones. Consulta la normativa actualizada del Ministerio de Minas e Hidrocarburos.
            </p>
            <button className="text-secondary font-bold text-xs uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-4 transition-all">
              Leer Normativa OHADA / GE
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
