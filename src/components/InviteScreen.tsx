import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Share2, Copy, Check, MessageSquare, Linkedin, Twitter, Users, Sparkles, Send,
  MessageCircle as MessageStyle, Image as ImageIcon, Download, Facebook, Instagram, Loader2, QrCode
} from 'lucide-react';
import { where } from 'firebase/firestore';
import { auth } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { generateShareCard } from '../services/shareCardService';

const REFERRAL_GOAL = 5;

// Igual que VITE_GEMINI_PROXY_URL en aiService.ts y VITE_FIREBASE_STORAGE_ENABLED
// en firebaseService.ts: config opcional, la funcionalidad que depende de ella
// (botón "Compartir en Instagram") solo aparece cuando está configurada, y el
// resto de la pantalla funciona igual de bien sin ella.
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;

export default function InviteScreen({ profileData }: { profileData?: any }) {
  const [copied, setCopied] = useState(false);
  const uid = auth.currentUser?.uid;

  // El link ahora lleva el uid propio como código de invitación real —
  // OnboardingScreen lo lee de `?ref=` y lo guarda como `referredBy` en la
  // cuenta nueva. Antes esta pantalla prometía una insignia "Embajador de
  // Red" a los 5 invitados sin que existiera ningún rastreo: el link era
  // solo el origen, sin código, así que nunca se podría haber sabido quién
  // invitó a quién.
  const inviteLink = uid ? `${window.location.origin}/?ref=${uid}` : window.location.origin;
  const { data: referredUsers } = useFirestoreCollection<{ id: string }>(
    uid ? 'users' : null,
    uid ? [where('referredBy', '==', uid)] : []
  );
  const referralCount = referredUsers.length;
  const isAmbassador = referralCount >= REFERRAL_GOAL;

  const [activeTab, setActiveTab] = useState<'mensaje' | 'tarjeta'>('mensaje');

  const messages = [
    {
      id: 'curiosity',
      title: 'Generar Curiosidad',
      text: '¿Ya estás en EG Connect? He visto que los mejores profesionales de G.E. se están conectando ahí para nuevos proyectos. Te dejo mi link de acceso:',
      icon: Sparkles
    },
    {
      id: 'professional',
      title: 'Enfoque Profesional',
      text: 'Hola, estoy expandiendo mi red profesional en la nueva plataforma EG Connect. Es el sitio ideal para networking en Guinea Ecuatorial. Únete aquí:',
      icon: Linkedin
    },
    {
      id: 'collaborative',
      title: 'Colaboración',
      text: 'Gente como nosotros, haciendo cosas como estas. Me gustaría tenerte en mi red de EG Connect para futuras sinergias:',
      icon: Users
    }
  ];

  const [selectedMessage, setSelectedMessage] = useState(messages[0]);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${selectedMessage.text}\n${inviteLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async (platform?: string) => {
    const fullText = `${selectedMessage.text}\n${inviteLink}`;

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a EG Connect',
          text: fullText,
          url: inviteLink,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <header className="text-center space-y-4">
        <div className="w-20 h-20 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-primary shadow-inner">
          <Share2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-primary">Impulsa tu Red</h2>
          <p className="text-sm font-medium text-on-surface-variant opacity-60 px-8">
            El marketing más potente es el boca a boca. Invita a "gente como nosotros".
          </p>
        </div>
      </header>

      {/* Tabs: mensaje de texto vs. tarjeta visual */}
      <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-outline/5 shadow-sm mx-1">
        <button
          onClick={() => setActiveTab('mensaje')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-300 ${
            activeTab === 'mensaje'
              ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-on-surface-variant opacity-60 hover:opacity-100'
          }`}
        >
          <MessageStyle className="w-4 h-4" />
          Mensaje
        </button>
        <button
          onClick={() => setActiveTab('tarjeta')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-300 ${
            activeTab === 'tarjeta'
              ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-on-surface-variant opacity-60 hover:opacity-100'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Tarjeta Visual
        </button>
      </div>

      {activeTab === 'mensaje' ? (
        <>
          {/* Message Selector */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-outline-variant px-1">Elige tu estilo de invitación</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className={`min-w-[160px] p-6 rounded-[2.5rem] text-left transition-all border-2 ${
                    selectedMessage.id === msg.id
                      ? 'bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-105'
                      : 'bg-white text-on-surface border-outline/10'
                  }`}
                >
                  <msg.icon className={`w-6 h-6 mb-4 ${selectedMessage.id === msg.id ? 'text-secondary' : 'text-primary'}`} />
                  <h4 className="font-bold text-xs leading-tight">{msg.title}</h4>
                </button>
              ))}
            </div>
          </section>

          {/* Preview Area */}
          <section className="bg-surface-container-low rounded-[3rem] p-8 border border-outline/5 space-y-6">
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Vista Previa</h3>
              <div className="bg-white p-6 rounded-2xl border border-outline/10 shadow-sm italic text-sm text-on-surface-variant leading-relaxed">
                "{selectedMessage.text}"
                <div className="mt-2 text-primary font-bold not-italic">{inviteLink}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleShare('whatsapp')}
                className="flex flex-col items-center gap-3 p-6 bg-[#25D366]/10 text-[#075E54] rounded-[2rem] border border-[#25D366]/20 active:scale-95 transition-all group"
              >
                <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <span className="font-black text-[10px] uppercase tracking-widest">WhatsApp</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex flex-col items-center gap-3 p-6 bg-primary/5 text-primary rounded-[2rem] border border-primary/10 active:scale-95 transition-all group"
              >
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                </div>
                <span className="font-black text-[10px] uppercase tracking-widest">{copied ? 'Copiado' : 'Copiar Link'}</span>
              </button>
            </div>
          </section>
        </>
      ) : (
        <ShareCardSection profileData={profileData} inviteLink={inviteLink} />
      )}

      {/* Viral Perk Banner — progreso real, no una promesa sin rastreo */}
      <div className="bg-secondary text-white p-8 rounded-[3rem] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-8 -translate-y-8" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-amber-300" />
            <h4 className="font-black text-xs uppercase tracking-widest">Recompensa Viral</h4>
          </div>
          {isAmbassador ? (
            <p className="text-sm font-medium leading-relaxed opacity-90">
              Ya eres <span className="text-amber-300 font-black">"Embajador de Red"</span> — trajiste a {referralCount} {referralCount === 1 ? 'nuevo miembro' : 'nuevos miembros'} con tu link.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium leading-relaxed opacity-90">
                Trae a {REFERRAL_GOAL} nuevos miembros con tu link y obtén la insignia de <span className="text-amber-300 font-black">"Embajador de Red"</span>.
              </p>
              <div className="space-y-2">
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-300 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (referralCount / REFERRAL_GOAL) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{referralCount} / {REFERRAL_GOAL} invitados reales</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta Visual — genera una imagen PNG real (canvas) con foto, nombre,
// branding de EG CONNECT y un QR real que codifica el mismo inviteLink de
// arriba, y ofrece varias formas reales de compartirla.
// ---------------------------------------------------------------------------

type CardState = 'idle' | 'loading' | 'ready' | 'error';

function ShareCardSection({ profileData, inviteLink }: { profileData?: any; inviteLink: string }) {
  const [cardState, setCardState] = useState<CardState>('idle');
  const [cardDataUrl, setCardDataUrl] = useState<string | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [avatarIncluded, setAvatarIncluded] = useState(true);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const displayName = profileData?.name || 'Miembro de EG Connect';
  const displayProfession = profileData?.profession || profileData?.role || undefined;

  const generate = () => {
    setCardState('loading');
    generateShareCard({
      name: displayName,
      profession: displayProfession,
      avatarUrl: profileData?.avatar,
      inviteLink,
    })
      .then((result) => {
        setCardDataUrl(result.dataUrl);
        setCardBlob(result.blob);
        setAvatarIncluded(result.avatarIncluded);
        setCardState('ready');
      })
      .catch((err) => {
        console.error('Error generando la tarjeta compartible:', err);
        setCardState('error');
      });
  };

  useEffect(() => {
    if (cardState === 'idle') generate();
    // Solo se regenera automáticamente al entrar a la pestaña; cambios
    // posteriores de perfil se reflejan la próxima vez que se abra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardState]);

  // Web Share API Level 2 (`navigator.canShare({ files })`) no está soportada
  // en todos los navegadores — se comprueba con feature-detection real antes
  // de mostrar el botón de compartir nativo con la imagen adjunta.
  useEffect(() => {
    if (!cardBlob) {
      setCanShareFiles(false);
      return;
    }
    try {
      const file = new File([cardBlob], 'eg-connect-invite.png', { type: 'image/png' });
      setCanShareFiles(typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));
    } catch {
      setCanShareFiles(false);
    }
  }, [cardBlob]);

  const handleNativeShare = async () => {
    if (!cardBlob) return;
    try {
      const file = new File([cardBlob], 'eg-connect-invite.png', { type: 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Únete a EG Connect',
          text: `${displayName} te invita a EG Connect`,
          url: inviteLink,
        });
        return;
      }
      if (navigator.share) {
        // El navegador soporta compartir texto/link pero no archivos —
        // se comparte el link igual, sin la imagen.
        await navigator.share({ title: 'Únete a EG Connect', text: `${displayName} te invita a EG Connect`, url: inviteLink });
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') console.error('Error compartiendo la tarjeta:', err);
    }
  };

  const handleDownload = () => {
    if (!cardDataUrl) return;
    const a = document.createElement('a');
    a.href = cardDataUrl;
    a.download = 'eg-connect-invite.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteLink)}`, '_blank', 'noopener,noreferrer');
  };

  const handleTwitter = () => {
    const text = 'Me uní a EG Connect, la red profesional de Guinea Ecuatorial. ¡Únete tú también!';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(inviteLink)}`, '_blank', 'noopener,noreferrer');
  };

  const handleFacebook = () => {
    // El sharer.php de Facebook solo lee metaetiquetas Open Graph (og:image,
    // og:title, etc.) del propio HTML de la URL que se comparte — no acepta
    // una imagen ni un texto personalizados por parámetro. Como esta es una
    // SPA sin backend que sirva OG tags reales para "/?ref=...", el enlace
    // se comparte correctamente, pero la vista previa que arme Facebook casi
    // seguro NO mostrará esta tarjeta ni el texto elegido aquí — solo lo que
    // Facebook logre inferir de la página (o nada). No prometemos más que
    // el link real funcionando.
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`, '_blank', 'noopener,noreferrer');
  };

  // Instagram Stories: técnica real y documentada (usada por apps como
  // Spotify Wrapped) de escribir la imagen al portapapeles y abrir el
  // esquema instagram-stories://share con source_application. No hay forma
  // de confirmar desde JS que Instagram esté instalado ni que el deep link
  // haya funcionado, así que esto es best-effort: si tras un instante seguimos
  // en la misma pestaña (indicio de que no se abrió ninguna app), se cae de
  // vuelta al panel de compartir nativo para que el usuario elija Instagram
  // manualmente si está disponible. NO VERIFICADO en un dispositivo real con
  // Instagram instalado — implementado según la forma documentada de la API,
  // pero sin poder confirmar el resultado final end-to-end en este entorno.
  const handleInstagramShare = async () => {
    if (!FACEBOOK_APP_ID || !cardBlob) return;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob })]);
      }
      window.location.href = `instagram-stories://share?source_application=${encodeURIComponent(FACEBOOK_APP_ID)}`;
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          handleNativeShare();
        }
      }, 1200);
    } catch (err) {
      console.error('No se pudo iniciar el flujo de Instagram Stories (best-effort, sin garantía):', err);
      handleNativeShare();
    }
  };

  return (
    <section className="bg-surface-container-low rounded-[3rem] p-8 border border-outline/5 space-y-6">
      <div className="space-y-1">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
          <QrCode className="w-3.5 h-3.5" />
          Tu Tarjeta para Compartir
        </h3>
        <p className="text-xs text-on-surface-variant opacity-60">
          Una imagen con tu foto, tu nombre y un código QR real hacia tu link de invitación — lista para tus Stories.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] border border-outline/10 shadow-sm overflow-hidden flex items-center justify-center min-h-[220px]">
        {cardState === 'loading' && (
          <div className="py-16 flex flex-col items-center gap-3 text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Generando tarjeta…</span>
          </div>
        )}
        {cardState === 'error' && (
          <div className="py-16 flex flex-col items-center gap-3 text-center px-6">
            <span className="text-sm font-bold text-red-600">No se pudo generar la tarjeta</span>
            <button
              onClick={generate}
              className="text-[10px] font-black uppercase tracking-widest text-primary underline"
            >
              Reintentar
            </button>
          </div>
        )}
        {cardState === 'ready' && cardDataUrl && (
          <img
            src={cardDataUrl}
            alt="Tarjeta de invitación EG CONNECT"
            className="w-full max-w-[280px] mx-auto"
          />
        )}
      </div>

      {cardState === 'ready' && !avatarIncluded && profileData?.avatar && (
        <p className="text-[10px] text-center text-on-surface-variant opacity-50 -mt-2">
          No se pudo incluir tu foto de perfil en la tarjeta; se usó tu inicial en su lugar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={handleDownload}
          disabled={cardState !== 'ready'}
          className="flex flex-col items-center gap-3 p-6 bg-primary/5 text-primary rounded-[2rem] border border-primary/10 active:scale-95 transition-all group disabled:opacity-40 disabled:pointer-events-none"
        >
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Download className="w-6 h-6" />
          </div>
          <span className="font-black text-[10px] uppercase tracking-widest">Descargar Imagen</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="flex flex-col items-center gap-3 p-6 bg-primary/5 text-primary rounded-[2rem] border border-primary/10 active:scale-95 transition-all group"
        >
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            {linkCopied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
          </div>
          <span className="font-black text-[10px] uppercase tracking-widest">{linkCopied ? 'Copiado' : 'Copiar Enlace'}</span>
        </button>

        {canShareFiles && (
          <button
            onClick={handleNativeShare}
            disabled={cardState !== 'ready'}
            className="col-span-2 flex items-center justify-center gap-3 p-5 bg-secondary text-white rounded-[2rem] shadow-lg shadow-secondary/20 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Share2 className="w-5 h-5" />
            <span className="font-black text-[10px] uppercase tracking-widest">Compartir Imagen (WhatsApp, TikTok, Mensajes…)</span>
          </button>
        )}

        {FACEBOOK_APP_ID && (
          <button
            onClick={handleInstagramShare}
            disabled={cardState !== 'ready'}
            title="Best-effort: puede no funcionar según el dispositivo/navegador — ver comentario en el código"
            className="col-span-2 flex items-center justify-center gap-3 p-5 bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] text-white rounded-[2rem] shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <Instagram className="w-5 h-5" />
            <span className="font-black text-[10px] uppercase tracking-widest">Compartir en Instagram</span>
          </button>
        )}

        <button
          onClick={handleLinkedIn}
          className="flex flex-col items-center gap-3 p-6 bg-[#0A66C2]/10 text-[#0A66C2] rounded-[2rem] border border-[#0A66C2]/20 active:scale-95 transition-all group"
        >
          <div className="w-12 h-12 bg-[#0A66C2] rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Linkedin className="w-6 h-6" />
          </div>
          <span className="font-black text-[10px] uppercase tracking-widest">LinkedIn</span>
        </button>

        <button
          onClick={handleTwitter}
          className="flex flex-col items-center gap-3 p-6 bg-black/5 text-black rounded-[2rem] border border-black/10 active:scale-95 transition-all group"
        >
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Twitter className="w-6 h-6" />
          </div>
          <span className="font-black text-[10px] uppercase tracking-widest">X / Twitter</span>
        </button>

        <button
          onClick={handleFacebook}
          className="col-span-2 flex flex-col items-center gap-3 p-6 bg-[#1877F2]/10 text-[#1877F2] rounded-[2rem] border border-[#1877F2]/20 active:scale-95 transition-all group"
        >
          <div className="w-12 h-12 bg-[#1877F2] rounded-full flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
            <Facebook className="w-6 h-6" />
          </div>
          <span className="font-black text-[10px] uppercase tracking-widest">Facebook</span>
          <span className="text-[9px] text-center opacity-60 -mt-1">Comparte el link; la vista previa de imagen no está garantizada</span>
        </button>
      </div>
    </section>
  );
}
