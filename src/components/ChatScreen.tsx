import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Send, ChevronLeft, MoreVertical, Paperclip, Smile, ShieldCheck, CheckCheck, MessageSquare, Mic, StopCircle, Play, Users, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { where, orderBy } from 'firebase/firestore';
import { Conversation, Message } from '../types';
import { auth, getOrCreateConversation, createGroupConversation, sendMessage, markConversationRead } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';

interface ChatScreenProps {
  initialParticipant?: { id: string; name: string; avatar: string };
  users: any[];
}

function formatTime(ts: { toDate: () => Date } | null | undefined) {
  if (!ts) return 'Ahora';
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ initialParticipant, users }: ChatScreenProps) {
  const currentUid = auth.currentUser?.uid;
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversationsQuery = useMemo(
    () => (currentUid ? [where('participants', 'array-contains', currentUid), orderBy('lastMessageAt', 'desc')] : []),
    [currentUid]
  );
  const { data: conversations } = useFirestoreCollection<Conversation>(currentUid ? 'conversations' : null, conversationsQuery);

  const messagesQuery = useMemo(() => [orderBy('createdAt', 'asc')], []);
  const { data: messages } = useFirestoreCollection<Message>(
    activeConversationId ? `conversations/${activeConversationId}/messages` : null,
    messagesQuery
  );

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // Opening chat from another screen ("Contactar") jumps straight into that conversation.
  useEffect(() => {
    if (!initialParticipant || !currentUid) return;
    getOrCreateConversation(currentUid, initialParticipant).then((id) => {
      if (id) setActiveConversationId(id);
    });
  }, [initialParticipant, currentUid]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Marca la conversación como leída al abrirla y cada vez que llega un
  // mensaje nuevo mientras sigue abierta — antes no existía ningún rastro
  // de "leído" y el badge de mensajes no leídos vivía fijo en 0.
  useEffect(() => {
    if (activeConversationId && currentUid) {
      markConversationRead(activeConversationId, currentUid);
    }
  }, [activeConversationId, currentUid, messages.length]);

  const isConversationUnread = (conv: Conversation) => {
    if (!currentUid || !conv.lastSenderId || conv.lastSenderId === currentUid || !conv.lastMessageAt) return false;
    const readAt = conv.readReceipts?.[currentUid];
    if (!readAt) return true;
    return readAt.toMillis() < conv.lastMessageAt.toMillis();
  };

  const resolveParticipant = (conv: Conversation) => {
    const otherUid = conv.participants.find((id) => id !== currentUid);
    const profile = users.find((u) => u.uid === otherUid);
    return {
      name: profile?.name || 'Usuario de EG CONNECT',
      avatar: profile?.avatar || 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop'
    };
  };

  const [sendError, setSendError] = useState('');

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    if (recordingTime > 0 && activeConversationId && currentUid) {
      sendMessage(activeConversationId, currentUid, { type: 'audio', audioUrl: '#', audioDuration: recordingTime })
        .catch(() => setSendError('No se pudo enviar el audio.'));
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeConversationId || !currentUid) return;
    const text = newMessage;
    setNewMessage('');
    sendMessage(activeConversationId, currentUid, { type: 'text', text }).catch(() => {
      setSendError('No se pudo enviar el mensaje. Revisa tu conexión.');
      setNewMessage(text);
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName || selectedContacts.length === 0 || !currentUid) return;
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=random`;
    const id = await createGroupConversation(currentUid, groupName, avatar, selectedContacts);
    if (id) setActiveConversationId(id);
    setIsCreatingGroup(false);
    setGroupName('');
    setSelectedContacts([]);
  };

  const filteredConversations = conversations.filter((conv) => {
    const name = conv.isGroup ? conv.groupName : resolveParticipant(conv).name;
    return (name || '').toLowerCase().includes(searchQuery.toLowerCase()) || conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (activeConversation) {
    const other = activeConversation.isGroup ? null : resolveParticipant(activeConversation);
    return (
      <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-[2.5rem] shadow-xl border border-outline/5 overflow-hidden">
        <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-container-high/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveConversationId(null)} className="p-2 -ml-2 rounded-full hover:bg-surface-container transition-colors">
              <ChevronLeft className="w-6 h-6 text-primary" />
            </button>
            <div className="relative">
              <img src={activeConversation.isGroup ? activeConversation.groupAvatar : other?.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-secondary rounded-full border-2 border-white" />
            </div>
            <div>
              <h3 className="font-bold text-on-surface text-sm leading-none flex items-center gap-1.5">
                {activeConversation.isGroup ? activeConversation.groupName : other?.name}
                {!activeConversation.isGroup && <ShieldCheck className="w-3 h-3 text-secondary" />}
              </h3>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-widest mt-1">
                {activeConversation.isGroup ? `${activeConversation.participants.length} participantes` : 'Conexión directa'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeConversation.isGroup && (
              <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
                <UserPlus className="w-5 h-5 text-on-surface-variant" />
              </button>
            )}
            <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
              <MoreVertical className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface-container-low/30">
          {messages.length === 0 && (
            <p className="text-center text-xs text-on-surface-variant/60 font-medium pt-10">Todavía no hay mensajes — escribe el primero.</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.senderId === currentUid;
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, x: isMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-[1.5rem] p-4 text-sm relative ${isMe ? 'bg-primary text-white rounded-br-none' : 'bg-white border border-outline/10 text-on-surface rounded-bl-none shadow-sm'}`}>
                  {msg.type === 'text' ? (
                    <p className="leading-relaxed">{msg.text}</p>
                  ) : (
                    <div className="flex items-center gap-3 min-w-[150px]">
                      <div className={`p-2 rounded-full ${isMe ? 'bg-white/20' : 'bg-primary/10'}`}>
                        <Play className={`w-4 h-4 ${isMe ? 'text-white' : 'text-primary'}`} fill="currentColor" />
                      </div>
                      <div className="flex-1 h-1 bg-current opacity-20 rounded-full relative">
                        <div className="absolute left-0 top-0 h-full w-1/3 bg-current rounded-full" />
                      </div>
                      <span className="text-[10px] font-mono">0:{String(msg.audioDuration).padStart(2, '0')}</span>
                    </div>
                  )}
                  <div className={`flex items-center gap-1 mt-1 justify-end ${isMe ? 'text-white/60' : 'text-on-surface-variant/60'}`}>
                    <span className="text-[9px] font-medium">{formatTime(msg.createdAt)}</span>
                    {isMe && <CheckCheck className="w-3 h-3" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="p-4 border-t border-outline/10 bg-white shadow-lg">
          {sendError && <p className="text-[10px] font-bold text-error mb-2 text-center">{sendError}</p>}
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <button className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
                <Paperclip className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 relative flex items-center bg-surface-container-low rounded-2xl border border-outline/10">
              {isRecording ? (
                <div className="flex-1 px-4 py-3 flex items-center justify-between text-primary">
                  <div className="flex items-center gap-2">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-sm font-bold">Grabando... {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</span>
                  </div>
                  <button onClick={stopRecording} className="text-xs font-black uppercase tracking-widest text-red-500">Cancelar</button>
                </div>
              ) : (
                <>
                  <textarea
                    rows={1}
                    placeholder="Escribe un mensaje..."
                    className="w-full bg-transparent p-3 pl-4 pr-10 text-sm focus:outline-hidden resize-none transition-all overflow-hidden"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <button className="absolute right-2 p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
                    <Smile className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            {newMessage.trim() ? (
              <button onClick={handleSendMessage} className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all outline-hidden h-[44px]">
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`p-3 rounded-2xl shadow-lg transition-all outline-hidden h-[44px] flex items-center justify-center ${isRecording ? 'bg-red-500 text-white scale-125 shadow-red-500/20' : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'}`}
              >
                {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-sm font-bold text-secondary uppercase tracking-[0.2em] mb-2">Mensajería</h2>
          <h1 className="text-4xl font-extrabold font-display text-on-surface">Conversaciones</h1>
        </div>
        <button onClick={() => setIsCreatingGroup(true)} className="flex items-center gap-2 py-3 px-6 bg-primary/10 text-primary rounded-[1.5rem] font-bold text-sm hover:bg-primary/20 transition-all border border-primary/20">
          <Users className="w-5 h-5" />
          Nuevo Grupo
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
        <input
          type="text"
          placeholder="Buscar contactos o mensajes..."
          className="w-full bg-surface-container-low border border-outline/10 pl-12 pr-4 py-4 rounded-[1.5rem] text-sm focus:outline-hidden focus:border-primary transition-colors"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredConversations.length === 0 ? (
        <div className="text-center py-16 space-y-3 opacity-60">
          <MessageSquare className="w-10 h-10 mx-auto text-outline" />
          <p className="text-sm font-bold text-on-surface-variant">Aún no tienes conversaciones.</p>
          <p className="text-xs text-on-surface-variant">Usa "Contactar" en el Directorio, Empresas o el Marketplace para empezar una.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConversations.map((conv) => {
            const other = conv.isGroup ? null : resolveParticipant(conv);
            const unread = isConversationUnread(conv);
            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setActiveConversationId(conv.id)}
                className={`group flex items-center gap-4 p-4 bg-white border rounded-[2rem] hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer active:scale-[0.98] ${unread ? 'border-primary/40 shadow-sm' : 'border-outline/10'}`}
              >
                <img src={conv.isGroup ? conv.groupAvatar : other?.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-base truncate flex items-center gap-1.5 ${unread ? 'font-black text-primary' : 'font-bold text-on-surface'}`}>
                      {conv.isGroup ? conv.groupName : other?.name}
                      {conv.isGroup && <Users className="w-3 h-3 text-on-surface-variant/40" />}
                    </h3>
                    <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-tighter shrink-0">{formatTime(conv.lastMessageAt)}</span>
                  </div>
                  <p className={`text-xs truncate ${unread ? 'text-primary font-bold' : 'text-on-surface-variant/70'}`}>{conv.lastMessage || 'Sin mensajes todavía'}</p>
                </div>
                {unread && <div className="w-2.5 h-2.5 bg-secondary rounded-full shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
          <MessageSquare className="w-32 h-32 text-primary" />
        </div>
        <h3 className="font-bold text-primary mb-2">Mensajería real</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Cada conversación se guarda en tu cuenta de EG CONNECT — la ve la otra persona real al iniciar sesión, no solo en este navegador.
        </p>
      </div>

      <AnimatePresence>
        {isCreatingGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreatingGroup(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black font-display text-on-surface">Nuevo Grupo</h2>
                <button onClick={() => setIsCreatingGroup(false)} className="p-2 rounded-full hover:bg-surface-container"><X /></button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Nombre del Grupo</label>
                  <input
                    type="text"
                    placeholder="Ej. Proyecto Alquileres"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-2xl font-bold focus:border-primary outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Participantes</label>
                  <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
                    {users.filter((u) => u.uid !== currentUid).map((contact) => (
                      <button
                        key={contact.uid}
                        onClick={() => {
                          setSelectedContacts((prev) => (prev.includes(contact.uid) ? prev.filter((id) => id !== contact.uid) : [...prev, contact.uid]));
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedContacts.includes(contact.uid) ? 'bg-primary/10 border-primary text-primary' : 'bg-surface-container-low border-outline/10 text-on-surface hover:border-primary/30'}`}
                      >
                        <img src={contact.avatar || 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=50'} className="w-8 h-8 rounded-full object-cover" />
                        <span className="text-xs font-bold truncate">{contact.name}</span>
                      </button>
                    ))}
                    {users.length <= 1 && <p className="col-span-2 text-xs text-on-surface-variant/60 italic px-2">Todavía no hay más miembros en la red para añadir.</p>}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName || selectedContacts.length === 0}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
              >
                Crear Grupo
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
