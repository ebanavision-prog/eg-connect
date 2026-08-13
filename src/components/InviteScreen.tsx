import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Share2, Copy, Check, MessageSquare, Linkedin, Twitter, Users, Sparkles, Send } from 'lucide-react';
import { where } from 'firebase/firestore';
import { auth } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

const REFERRAL_GOAL = 5;

export default function InviteScreen() {
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
