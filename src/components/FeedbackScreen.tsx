import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, AlertCircle, Sparkles, Star, CheckCircle2, Loader2, ArrowLeft, ChevronRight } from 'lucide-react';

interface FeedbackScreenProps {
  onBack: () => void;
}

export default function FeedbackScreen({ onBack }: FeedbackScreenProps) {
  const [type, setType] = useState<'feedback' | 'error' | 'proposal'>('feedback');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSent(true);
    }, 1500);
  };

  if (isSent) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-xl shadow-emerald-500/20">
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold font-display text-primary mb-4">¡Gracias por tu aporte!</h2>
        <p className="text-on-surface-variant leading-relaxed mb-10 font-sans max-w-xs mx-auto">
          Tus sugerencias nos ayudan a construir una mejor plataforma para todos los profesionales de Guinea Ecuatorial.
        </p>
        <button
          onClick={onBack}
          className="px-8 py-4 bg-primary text-white rounded-full font-bold shadow-xl active:scale-95 transition-all outline-hidden"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="px-1 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em]">Comunidad</h2>
          </div>
          <h1 className="text-4xl font-extrabold font-display text-on-surface">Feedback</h1>
          <p className="text-on-surface-variant font-sans mt-2">Ayúdanos a evolucionar EG CONNECT.</p>
        </div>
        <button 
          onClick={onBack}
          className="p-3 bg-surface-container-high rounded-full hover:bg-surface-container-highest transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-on-surface" />
        </button>
      </header>

      <div className="space-y-8">
        {/* Type Selector */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Tipo de mensaje</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'feedback', icon: MessageSquare, label: 'Opinión', color: 'bg-emerald-500' },
              { id: 'error', icon: AlertCircle, label: 'Error', color: 'bg-error' },
              { id: 'proposal', icon: Sparkles, label: 'Idea', color: 'bg-secondary' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setType(item.id as any)}
                className={`editorial-card p-4 flex flex-col items-center gap-2 transition-all ${
                  type === item.id ? 'ring-2 ring-primary bg-white shadow-xl translate-y-[-4px]' : 'opacity-60 bg-surface-container-low'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg ${item.color} bg-opacity-10 flex items-center justify-center text-${item.id === 'error' ? 'error' : 'secondary'}`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Rating */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1 text-center">Califica tu experiencia</h3>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="p-1 transition-transform active:scale-75"
              >
                <Star 
                  className={`w-8 h-8 transition-colors ${rating >= star ? 'text-secondary fill-secondary' : 'text-surface-container-highest'}`} 
                />
              </button>
            ))}
          </div>
        </section>

        {/* Text Area */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Tu mensaje</h3>
          <div className="bg-surface-container-low border border-outline/10 rounded-[2.5rem] p-6 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <textarea
              className="w-full bg-transparent border-none focus:outline-hidden text-sm leading-relaxed font-sans placeholder:opacity-40 min-h-[120px] resize-none"
              placeholder={
                type === 'error' ? 'Describe el error: ¿En qué pantalla ocurrió? ¿Qué estabas haciendo?' : 'Escribe tus sugerencias aquí...'
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </section>

        <button
          disabled={!message || isSubmitting}
          onClick={handleSubmit}
          className="w-full py-5 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Enviando información...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Enviar Feedback</span>
            </>
          )}
        </button>

        <div className="text-center p-6 bg-surface-container-low/50 rounded-[2rem] border border-outline/5">
          <p className="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-[0.2em] leading-relaxed">
            EG CONNECT - Versión 1.0<br/>
            Desarrollado por Grupo Ebana Vision
          </p>
        </div>
      </div>
    </div>
  );
}
