import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { Conversation } from '../types';
import { useFirestoreCollection } from './useFirestoreCollection';

// Antes `unreadMessageCount` en App.tsx estaba hardcodeado en 0 — el badge
// de mensajes nunca podía encender, sin importar cuántos mensajes reales
// llegaran. Ahora se deriva de datos reales: `lastSenderId` (quién mandó el
// último mensaje) y `readReceipts[uid]` (cuándo lo leí por última vez, ver
// markConversationRead en firebaseService.ts).
export function useUnreadMessages(uid: string | undefined) {
  const constraints = useMemo(() => (uid ? [where('participants', 'array-contains', uid)] : []), [uid]);
  const { data: conversations } = useFirestoreCollection<Conversation>(uid ? 'conversations' : null, constraints);

  const unreadConversationIds = conversations
    .filter((c) => {
      if (!uid || !c.lastSenderId || c.lastSenderId === uid || !c.lastMessageAt) return false;
      const readAt = c.readReceipts?.[uid];
      if (!readAt) return true;
      return readAt.toMillis() < c.lastMessageAt.toMillis();
    })
    .map((c) => c.id);

  return { unreadCount: unreadConversationIds.length, unreadConversationIds };
}
