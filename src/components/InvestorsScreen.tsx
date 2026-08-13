import { useState, useMemo } from 'react';
import { where } from 'firebase/firestore';
import { Handshake, MessageSquare, MapPin, Briefcase, X, Loader2, Send, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ConnectionRequest } from '../types';
import { auth, createConnectionRequest, respondToConnectionRequest } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface InvestorsScreenProps {
  users: any[];
  onContact: (user: any) => void;
  profileData?: any;
}

const SECTOR_FILTERS = ['Todos', 'Tecnología', 'Agricultura', 'Educación', 'Salud', 'Comercio', 'Energía', 'Turismo'];

export default function InvestorsScreen({ users, onContact, profileData }: InvestorsScreenProps) {
  const [sectorFilter, setSectorFilter] = useState('Todos');
  const [pitchTarget, setPitchTarget] = useState<any | null>(null);
  const [pitchText, setPitchText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const currentUid = auth.currentUser?.uid;
  const isInvestorMyself = !!profileData?.isInvestor;

  const sentConstraints = useMemo(() => (currentUid ? [where('fromUid', '==', currentUid)] : []), [currentUid]);
  const { data: sentRequests } = useFirestoreCollection<ConnectionRequest>(currentUid ? 'connectionRequests' : null, sentConstraints);

  const receivedConstraints = useMemo(() => (currentUid ? [where('toUid', '==', currentUid)] : []), [currentUid]);
  const { data: receivedRequests } = useFirestoreCollection<ConnectionRequest>(
    currentUid && isInvestorMyself ? 'connectionRequests' : null, receivedConstraints
  );

  const pendingReceived = useMemo(() => receivedRequests.filter((r) => r.status === 'pending'), [receivedRequests]);

  const investors = useMemo(() =>
    users.filter((u) =>
      u.isInvestor &&
      u.privacyMode !== 'private' &&
      u.uid !== currentUid &&
      (sectorFilter === 'Todos' || (u.investorSectors || []).includes(sectorFilter))
    ),
    [users, sectorFilter, currentUid]
  );

  const requestFor = (investorUid: string) => sentRequests.find((r) => r.toUid === investorUid);

  const handleSendPitch = async () => {
    if (!currentUid || !pitchTarget || !pitchText.trim()) return;
    setIsSending(true);
    try {
      await createConnectionRequest(currentUid, {
        toUid: pitchTarget.uid,
        fromName: profileData?.name || 'Miembro de EG CONNECT',
        fromAvatar: profileData?.avatar || 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop',
        pitch: pitchText.trim()
      });
      setPitchTarget(null);
      setPitchText('');
    } finally {
      setIsSending(false);
    }
  };

  const handleRespond = async (req: ConnectionRequest, status: 'accepted' | 'declined') => {
    setRespondingId(req.id);
    try {
      await respondToConnectionRequest(req.id, status);
      if (status === 'accepted') {
        onContact({ id: req.fromUid, name: req.fromName, avatar: req.fromAvatar });
      }
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">Inversionistas</h2>
        <h1 className="text-4xl font-extrabold font-display text-on-surface">Conecta con Capital</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-lg">
          Perfiles que se han identificado como inversionistas activos en Guinea Ecuatorial. Envía una propuesta breve — el chat se abre solo si el inversionista la acepta.
        </p>
      </header>

      {isInvestorMyself && pendingReceived.length > 0 && (
        <section className="space-y-3 bg-amber-50 border border-amber-200 rounded-[2rem] p-6">
          <h3 className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-widest">
            <Handshake className="w-4 h-4" /> Solicitudes Recibidas ({pendingReceived.length})
          </h3>
          <div className="space-y-3">
            {pendingReceived.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl p-4 border border-amber-100">
                <div className="flex items-center gap-3 mb-2">
                  <img src={req.fromAvatar} alt={req.fromName} className="w-10 h-10 rounded-full object-cover" />
                  <p className="font-bold text-on-surface text-sm">{req.fromName}</p>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{req.pitch}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(req, 'accepted')}
                    disabled={respondingId === req.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-full text-xs font-bold disabled:opacity-50"
                  >
                    {respondingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Aceptar y Chatear
                  </button>
                  <button
                    onClick={() => handleRespond(req, 'declined')}
                    disabled={respondingId === req.id}
                    className="flex-1 py-2.5 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-bold disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
          {investors.map((investor) => {
            const existing = requestFor(investor.uid);
            return (
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

                {existing?.status === 'accepted' ? (
                  <button
                    onClick={() => onContact({ id: investor.uid, name: investor.name, avatar: investor.avatar })}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ir al Chat
                  </button>
                ) : existing?.status === 'pending' ? (
                  <div className="w-full flex items-center justify-center gap-2 py-3 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-bold">
                    Solicitud Enviada — Esperando Respuesta
                  </div>
                ) : existing?.status === 'declined' ? (
                  <div className="w-full flex items-center justify-center gap-2 py-3 bg-error/5 text-error rounded-full text-xs font-bold">
                    Solicitud Rechazada
                  </div>
                ) : (
                  <button
                    onClick={() => setPitchTarget(investor)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                  >
                    <Send className="w-4 h-4" />
                    Presentar mi Proyecto
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {pitchTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSending && setPitchTarget(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-extrabold font-display text-on-surface">Presenta tu Proyecto</h2>
                    <p className="text-xs text-on-surface-variant mt-1">A {pitchTarget.name}</p>
                  </div>
                  <button onClick={() => setPitchTarget(null)} className="p-2 rounded-full hover:bg-surface-container-high transition-all">
                    <X className="w-5 h-5 text-on-surface-variant" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">
                    ¿Qué buscas y por qué encaja con este inversionista?
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Ej: Busco 20.000 USD para escalar mi taller de agroprocesamiento en Bata. Ya tengo clientes en Malabo y..."
                    className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary resize-none"
                    value={pitchText}
                    onChange={(e) => setPitchText(e.target.value)}
                  />
                </div>

                <button
                  disabled={!pitchText.trim() || isSending}
                  onClick={handleSendPitch}
                  className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                >
                  {isSending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Enviando...</>
                  ) : (
                    <><Send className="w-5 h-5" />Enviar Propuesta</>
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
