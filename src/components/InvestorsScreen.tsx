import { useState, useMemo } from 'react';
import { where } from 'firebase/firestore';
import { Handshake, MessageSquare, MapPin, Briefcase, X, Loader2, Send, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ConnectionRequest, UserProfile } from '../types';
import { auth, createConnectionRequest, respondToConnectionRequest } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { sendPushToUser } from '../services/pushService';

interface InvestorsScreenProps {
  users: UserProfile[];
  onContact: (user: any) => void;
  profileData?: UserProfile | null;
}

// Valores usados para filtrar/comparar contra investorSectors (mismos que
// selecciona el usuario en su perfil) -- se dejan en español, son datos.
const SECTOR_FILTERS = ['Todos', 'Tecnología', 'Agricultura', 'Educación', 'Salud', 'Comercio', 'Energía', 'Turismo'];

export default function InvestorsScreen({ users, onContact, profileData }: InvestorsScreenProps) {
  const { t } = useTranslation();
  const [sectorFilter, setSectorFilter] = useState('Todos');
  const [pitchTarget, setPitchTarget] = useState<UserProfile | null>(null);
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
      // Push real, best-effort — nunca puede romper el envío de la solicitud
      // en sí, que ya se guardó en Firestore en la línea de arriba.
      sendPushToUser(
        pitchTarget.uid,
        t('investors.pushNewRequestTitle'),
        t('investors.pushNewRequestBody', { name: profileData?.name || t('investors.fallbackSomeone'), pitch: pitchText.trim() })
      ).catch(() => {});
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
      sendPushToUser(
        req.fromUid,
        status === 'accepted' ? t('investors.pushAcceptedTitle') : t('investors.pushDeclinedTitle'),
        status === 'accepted'
          ? t('investors.pushAcceptedBody', { name: profileData?.name || t('investors.fallbackInvestor') })
          : t('investors.pushDeclinedBody', { name: profileData?.name || t('investors.fallbackInvestor') })
      ).catch(() => {});
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
        <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">{t('investors.sectionLabel')}</h2>
        <h1 className="text-4xl font-extrabold font-display text-on-surface">{t('investors.title')}</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-lg">
          {t('investors.subtitle')}
        </p>
      </header>

      {isInvestorMyself && pendingReceived.length > 0 && (
        <section className="space-y-3 bg-amber-50 border border-amber-200 rounded-[2rem] p-6">
          <h3 className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-widest">
            <Handshake className="w-4 h-4" /> {t('investors.receivedRequestsTitle', { count: pendingReceived.length })}
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
                    {t('investors.acceptChatButton')}
                  </button>
                  <button
                    onClick={() => handleRespond(req, 'declined')}
                    disabled={respondingId === req.id}
                    className="flex-1 py-2.5 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-bold disabled:opacity-50"
                  >
                    {t('investors.declineButton')}
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
          <p className="font-bold">{sectorFilter !== 'Todos' ? t('investors.noInvestorsInSector', { sector: sectorFilter }) : t('investors.noInvestors')}</p>
          <p className="text-xs">{t('investors.emptySubtitle')}</p>
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
                key={investor.uid}
                className="bg-white border border-outline/10 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <img src={investor.avatar} alt={investor.name} className="w-14 h-14 rounded-full object-cover" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-primary truncate">{investor.name}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-on-surface-variant/60">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{investor.city || t('investors.defaultCity')}</span>
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
                    {investor.investorTicketRange || t('investors.ticketRangeUnspecified')} · {investor.investorStage || t('investors.stageAny')}
                  </span>
                </div>

                {existing?.status === 'accepted' ? (
                  <button
                    onClick={() => onContact({ id: investor.uid, name: investor.name, avatar: investor.avatar })}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {t('investors.goToChat')}
                  </button>
                ) : existing?.status === 'pending' ? (
                  <div className="w-full flex items-center justify-center gap-2 py-3 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-bold">
                    {t('investors.requestSentWaiting')}
                  </div>
                ) : existing?.status === 'declined' ? (
                  <div className="w-full flex items-center justify-center gap-2 py-3 bg-error/5 text-error rounded-full text-xs font-bold">
                    {t('investors.requestDeclined')}
                  </div>
                ) : (
                  <button
                    onClick={() => setPitchTarget(investor)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                  >
                    <Send className="w-4 h-4" />
                    {t('investors.presentProject')}
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
                    <h2 className="text-xl font-extrabold font-display text-on-surface">{t('investors.pitchModalTitle')}</h2>
                    <p className="text-xs text-on-surface-variant mt-1">{t('investors.pitchModalTo', { name: pitchTarget.name })}</p>
                  </div>
                  <button onClick={() => setPitchTarget(null)} className="p-2 rounded-full hover:bg-surface-container-high transition-all focus-ring-custom" aria-label={t('investors.closePitchModalAria')}>
                    <X className="w-5 h-5 text-on-surface-variant" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 block">
                    {t('investors.pitchQuestionLabel')}
                  </label>
                  <textarea
                    rows={5}
                    placeholder={t('investors.pitchPlaceholder')}
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
                    <><Loader2 className="w-5 h-5 animate-spin" />{t('investors.sendingPitch')}</>
                  ) : (
                    <><Send className="w-5 h-5" />{t('investors.sendProposalButton')}</>
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
