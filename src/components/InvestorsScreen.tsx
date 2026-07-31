import { useState, useMemo } from 'react';
import { Handshake, MessageSquare, MapPin, Briefcase } from 'lucide-react';
import { motion } from 'motion/react';

interface InvestorsScreenProps {
  users: any[];
  onContact: (user: any) => void;
}

const SECTOR_FILTERS = ['Todos', 'Tecnología', 'Agricultura', 'Educación', 'Salud', 'Comercio', 'Energía', 'Turismo'];

export default function InvestorsScreen({ users, onContact }: InvestorsScreenProps) {
  const [sectorFilter, setSectorFilter] = useState('Todos');

  const investors = useMemo(() =>
    users.filter((u) =>
      u.isInvestor &&
      u.privacyMode !== 'private' &&
      (sectorFilter === 'Todos' || (u.investorSectors || []).includes(sectorFilter))
    ),
    [users, sectorFilter]
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">Inversionistas</h2>
        <h1 className="text-4xl font-extrabold font-display text-on-surface">Conecta con Capital</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-lg">
          Perfiles que se han identificado como inversionistas activos en Guinea Ecuatorial. Contacta directamente para presentar tu proyecto.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTOR_FILTERS.map((sector) => (
          <button
            key={sector}
            onClick={() => setSectorFilter(sector)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              sectorFilter === sector ? 'bg-amber-500 text-white' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {sector}
          </button>
        ))}
      </div>

      {investors.length === 0 ? (
        <div className="text-center py-20 px-8 opacity-40">
          <Handshake className="w-12 h-12 mx-auto mb-4" />
          <p className="font-bold">Todavía no hay inversionistas registrados{sectorFilter !== 'Todos' ? ` en ${sectorFilter}` : ''}</p>
          <p className="text-xs">Actívalo en tu perfil si quieres aparecer aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {investors.map((investor) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={investor.uid || investor.id}
              className="bg-white border border-outline/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <img src={investor.avatar} alt={investor.name} className="w-14 h-14 rounded-full object-cover" />
                <div className="min-w-0">
                  <h3 className="font-bold text-primary truncate">{investor.name}</h3>
                  <div className="flex items-center gap-1 text-[10px] text-on-surface-variant/60">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{investor.city || 'Guinea Ecuatorial'}</span>
                  </div>
                </div>
              </div>

              {investor.investorBio && (
                <p className="text-sm text-on-surface-variant leading-relaxed mb-4 line-clamp-3">{investor.investorBio}</p>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {(investor.investorSectors || []).map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold">{s}</span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-on-surface-variant mb-6">
                <Briefcase className="w-4 h-4" />
                <span className="text-xs font-semibold">
                  {investor.investorTicketRange || 'Rango no especificado'} · {investor.investorStage || 'Cualquier etapa'}
                </span>
              </div>

              <button
                onClick={() => onContact(investor)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
              >
                <MessageSquare className="w-4 h-4" />
                Presentar mi Proyecto
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
