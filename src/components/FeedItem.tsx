import React, { useState, FC, useEffect } from 'react';
import { MapPin, MessageSquare, Send, User, Sparkles, Share2, Copy, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Contact } from '../types';
import { notificationService } from '../services/notificationService';
import { generateIcebreaker } from '../services/aiService';
import { auth, addContactComment, toggleContactKudo } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  parentId?: string | null;
}

interface FeedItemProps {
  contact: Contact;
  onChat?: (participant: { id: string; name: string; avatar: string }) => void;
  currentUserName?: string;
}

const FeedItem: FC<FeedItemProps> = ({ contact, onChat, currentUserName = 'Yo' }) => {
  const ownerId = auth.currentUser?.uid;
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasKudoed, setHasKudoed] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const [isGeneratingIcebreaker, setIsGeneratingIcebreaker] = useState(false);
  const [icebreakerError, setIcebreakerError] = useState('');

  // Notas reales del propio usuario sobre este contacto — antes vivían solo
  // en localStorage bajo un autor inventado ("Bernardino Edu"); ahora es una
  // subcolección privada real bajo el propio contacto.
  const { data: rawComments } = useFirestoreCollection<{ id: string; authorName: string; text: string; parentId?: string | null; createdAt?: any }>(
    ownerId ? `users/${ownerId}/contacts/${contact.id}/comments` : null
  );
  const comments: Comment[] = rawComments.map((c) => ({
    id: c.id,
    author: c.authorName,
    text: c.text,
    parentId: c.parentId ?? null,
    timestamp: c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Ahora'
  }));
  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesOf = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  const kudos = contact.kudos || 0;

  useEffect(() => {
    setHasKudoed(false);
  }, [contact.id]);

  const handleGenerateIcebreaker = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingIcebreaker(true);
    setIcebreakerError('');
    try {
      const text = await generateIcebreaker(contact.name, contact.role, contact.company, contact.tags);
      if (text) {
        setIcebreaker(text);
        notificationService.sendNotification('Idea de Gemini', 'Hemos generado una frase de apertura personalizada.');
      } else {
        setIcebreakerError('El asistente de IA no está disponible ahora mismo. Inténtalo más tarde.');
      }
    } catch (err) {
      console.error(err);
      setIcebreakerError('El asistente de IA no está disponible ahora mismo. Inténtalo más tarde.');
    } finally {
      setIsGeneratingIcebreaker(false);
    }
  };

  const handleKudo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ownerId) return;
    const wasKudoed = hasKudoed;
    setHasKudoed(!wasKudoed);
    toggleContactKudo(ownerId, contact.id, !wasKudoed).catch(() => setHasKudoed(wasKudoed));
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSharing(true);
    const shareData = {
      title: `Contacto: ${contact.name}`,
      text: `${contact.name} - ${contact.role} en ${contact.company}`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        notificationService.sendNotification('Enlace Copiado', 'La información del contacto ha sido copiada al portapapeles.');
      }
    } catch (err) {
      console.error('Error al compartir:', err);
    } finally {
      setTimeout(() => setIsSharing(false), 1000);
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !ownerId) return;
    addContactComment(ownerId, contact.id, {
      authorName: currentUserName,
      text: newComment.trim(),
      parentId: replyingTo
    });
    setReplyingTo(null);
    setNewComment('');
  };

  return (
    <div className="editorial-card p-6 group hover:shadow-xl transition-all border-none shadow-md bg-white">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-sm relative">
            <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
            {contact.isVerified && (
              <div className="absolute -bottom-1 -right-1 bg-secondary text-white rounded-full p-0.5 border-2 border-white">
                <span className="material-symbols-outlined text-[10px] select-none" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-on-surface leading-tight font-display">{contact.name}</h3>
            <p className="text-sm text-on-surface-variant font-medium">{contact.role}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-[10px] font-bold text-outline uppercase tracking-tighter">{contact.timestamp}</span>
          <button 
            onClick={() => onChat?.({ id: contact.id, name: contact.name, avatar: contact.avatar })}
            className="p-2 rounded-full bg-primary/5 text-primary hover:bg-primary/10 transition-colors outline-hidden"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tags/Location */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-low rounded-full">
          <MapPin className="w-3 h-3 text-secondary" />
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">{contact.location}</span>
        </div>
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSharing ? <Copy className="w-3 h-3 animate-pulse" /> : <Share2 className="w-3 h-3" />}
          <span className="text-[10px] font-bold uppercase tracking-wider">Compartir</span>
        </button>

        <button 
          onClick={handleGenerateIcebreaker}
          disabled={isGeneratingIcebreaker}
          className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full hover:bg-amber-500/20 transition-all active:scale-95 disabled:opacity-50 group/ai"
        >
          {isGeneratingIcebreaker ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Zap className={`w-3 h-3 ${icebreaker ? 'fill-amber-500' : ''} group-hover/ai:animate-pulse`} />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider">Rompehielo AI</span>
        </button>
      </div>

      {icebreakerError && !icebreaker && (
        <p className="text-[10px] font-bold text-error mb-4 px-1">{icebreakerError}</p>
      )}

      {/* Icebreaker Display */}
      <AnimatePresence>
        {icebreaker && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl relative group/ice"
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Sugerencia de Gemini</span>
            </div>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              "{icebreaker}"
            </p>
            <div className="mt-3 flex gap-2">
              <button 
                onClick={() => {
                  setNewComment(icebreaker);
                  setIcebreaker(null);
                }}
                className="text-[9px] font-bold bg-amber-500 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-amber-600 transition-colors"
              >
                Usar como comentario
              </button>
              <button 
                onClick={() => setIcebreaker(null)}
                className="text-[9px] font-bold text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                Ocultar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {(contact.note || (contact.tags && contact.tags.length > 0)) && (
        <motion.div 
          onClick={() => setIsExpanded(!isExpanded)}
          layout
          className="bg-surface-container-low rounded-xl p-4 relative overflow-hidden border-l-4 border-primary mb-6 cursor-pointer hover:bg-surface-container-low/80 transition-colors group/content"
        >
          {contact.note ? (
            <motion.p layout className={`text-sm text-on-surface-variant leading-relaxed italic font-sans ${!isExpanded ? 'line-clamp-2' : ''}`}>
              "{contact.note}"
            </motion.p>
          ) : (
            <motion.p layout className="text-xs text-outline-variant font-bold uppercase tracking-widest">
              Información de contacto
            </motion.p>
          )}
          
          <AnimatePresence>
            {isExpanded && contact.tags && contact.tags.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-outline/5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-3 h-3 text-primary/60" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Tags de Interés</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag, idx) => (
                    <span 
                      key={idx}
                      className="text-[9px] font-bold text-primary bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10 uppercase tracking-wider hover:bg-primary hover:text-white transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-2 flex justify-center items-center gap-2">
            <span className="text-[10px] font-bold text-primary/40 group-hover/content:text-primary transition-colors uppercase tracking-widest">
              {isExpanded ? 'Ver menos' : 'Ver más'}
            </span>
            <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <span className="material-symbols-outlined text-xs text-primary/40">expand_more</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Comments Thread */}
      <AnimatePresence>
        {comments.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 rounded-3xl bg-surface-container-lowest/50 border border-outline/5 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-outline/5 flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{comments.length} Comentarios</span>
              </div>
              <div className="flex -space-x-2">
                {comments.slice(0, 3).map((_, i) => (
                  <div key={i} className="w-5 h-5 rounded-full bg-surface-container-high border-2 border-white flex items-center justify-center">
                    <User className="w-2.5 h-2.5 text-outline-variant" />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              {topLevelComments.map((comment) => (
                <div key={comment.id} className="space-y-3">
                  <div className="flex gap-3 group/comment">
                    <div className="w-8 h-8 rounded-full bg-white border border-outline/10 flex items-center justify-center text-primary flex-shrink-0 shadow-sm">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                        <span className="text-primary">{comment.author}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReplyingTo(comment.id)}
                            className="text-secondary hover:underline cursor-pointer"
                          >
                            Responder
                          </button>
                          <span className="text-outline-variant italic">{comment.timestamp}</span>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl rounded-tl-none p-3 border border-outline/5 group-hover/comment:border-primary/20 transition-all shadow-xs">
                        <p className="text-xs text-on-surface-variant leading-relaxed font-sans">{comment.text}</p>
                      </div>
                    </div>
                  </div>

                  {/* Nested Replies */}
                  {repliesOf(comment.id).length > 0 && (
                    <div className="pl-11 space-y-3 border-l-2 border-outline/5 ml-4">
                      {repliesOf(comment.id).map((reply) => (
                        <div key={reply.id} className="flex gap-3 group/reply">
                          <div className="w-6 h-6 rounded-full bg-white border border-outline/10 flex items-center justify-center text-primary flex-shrink-0 shadow-sm">
                            <User className="w-3 h-3" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center text-[9px] uppercase font-bold tracking-wider">
                              <span className="text-primary">{reply.author}</span>
                              <span className="text-outline-variant italic">{reply.timestamp}</span>
                            </div>
                            <div className="bg-surface-container-lowest rounded-2xl rounded-tl-none p-2 border border-outline/5 group-hover/reply:border-primary/20 transition-all shadow-xs">
                              <p className="text-xs text-on-surface-variant leading-relaxed font-sans">{reply.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Comment Input */}
      <div className="flex gap-3 items-center pt-2">
        <button 
          onClick={handleKudo}
          className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl transition-all border ${
            hasKudoed 
              ? 'bg-secondary/10 border-secondary text-secondary shadow-inner' 
              : 'bg-surface-container-low border-outline/5 text-outline hover:border-secondary/20 hover:text-secondary'
          }`}
        >
          <Sparkles className={`w-4 h-4 ${hasKudoed ? 'fill-secondary' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{kudos}</span>
        </button>

        <div className="flex-1 flex flex-col gap-1">
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-1 bg-secondary/10 rounded-t-xl border-x border-t border-outline/10">
              <span className="text-[9px] font-bold text-secondary uppercase tracking-wider">
                Respondiendo a {comments.find(c => c.id === replyingTo)?.author}
              </span>
              <button onClick={() => setReplyingTo(null)} className="text-secondary">
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          )}
          <div className={`flex gap-2 items-center bg-surface-container-low/50 hover:bg-surface-container-low p-1.5 ${replyingTo ? 'rounded-b-[1.5rem] border-x border-b' : 'rounded-[1.5rem] border'} border-outline/10 focus-within:border-primary/30 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary/5 transition-all shadow-xs group/input`}>
            <div className="pl-3 py-2 text-primary/40 group-focus-within/input:text-primary transition-colors">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
            </div>
            <input 
              type="text" 
              placeholder={replyingTo ? "Escribe tu respuesta..." : "Añadir comentario..."}
              className="flex-1 bg-transparent border-none focus:outline-hidden text-sm py-2 px-1 font-medium placeholder:text-outline-variant/60"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddComment();
              }}
            />
            <AnimatePresence mode="wait">
              {newComment.trim() && (
                <motion.button 
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  onClick={handleAddComment}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2 overflow-hidden"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Enviar</span>
                  <Send className="w-3.5 h-3.5 translate-x-0.5 -translate-y-0.5" />
                </motion.button>
              )}
            </AnimatePresence>
            {!newComment.trim() && (
              <div className="pr-3 text-outline-variant/40">
                <Send className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedItem;
