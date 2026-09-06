import { Timestamp } from 'firebase/firestore';

export type Screen = 'home' | 'timeline' | 'scan' | 'feedback' | 'map' | 'profile' | 'groups' | 'summary' | 'invite' | 'tasks' | 'onboarding' | 'contact-detail' | 'insight-detail' | 'my-cards' | 'sync-settings' | 'events' | 'marketplace' | 'companies' | 'company-detail' | 'chat' | 'tenders' | 'crm' | 'investors' | 'initiatives' | 'search' | 'growth-analytics';

// Modela el documento real de `/users/{uid}` en Firestore. Derivado de un grep
// exhaustivo de `profileData.`/`userProfile.`/`realUsers`/`getAllUsers()` en
// src/components + src/App.tsx, cruzado contra la whitelist de campos
// editables de la regla `update` de `/users/{userId}` en firestore.rules
// (que a su vez exige `uid`, `name`, `profileType` en `isValidUser()`).
//
// Campos opcionales que SÍ se leen en algún sitio pero para los que no existe
// ningún camino de escritura real hoy (quedan siempre `undefined` en
// producción) — se documentan igual, ver ProfileScreen.tsx ~717/729:
//   - `linkedin`, `portfolio`
export interface UserProfile {
  uid: string;
  name: string;
  avatar: string;
  profileType: 'individual' | 'company';
  email?: string;
  // Solo se escribe al registrarse (`registerWithUsername` en
  // firebaseService.ts) — no aparece en la whitelist de `update` porque no es
  // editable después, pero es un campo real del documento.
  username?: string;
  phone?: string;
  birthday?: string; // formato 'MM-DD'
  profession?: string;
  role?: string;
  city?: string;
  employees?: string; // solo profileType === 'company'; bucket tipo '1-10'
  yearsInMarket?: string; // solo profileType === 'company'; bucket tipo '0-2'
  website?: string; // solo profileType === 'company'
  // Enlaza al doc canónico de la empresa en `companies/{companyId}` (ver
  // docs/PLAN_MEJORA_360.md sección 3/7 Fase 2: unificación del modelo de
  // empresa, `companies` es la entidad canónica). Se rellena solo hacia
  // adelante: al registrar una empresa desde CompaniesScreen, o al marcar
  // profileType='company' y guardar desde ProfileScreen. `scripts/migrate-
  // company-model.mjs` rellena este campo con backfill para los perfiles
  // `profileType==='company'` creados antes de que existiera este enlace.
  companyId?: string;
  privacyMode?: 'public' | 'network' | 'private';
  isInvestor?: boolean;
  investorSectors?: string[];
  investorTicketRange?: string;
  investorStage?: string;
  investorBio?: string;
  recoveryEmail?: string;
  location?: { lat: number; lng: number; updatedAt?: unknown };
  locationSharing?: boolean;
  fcmTokens?: string[];
  isAdmin?: boolean;
  referredBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  // Se actualiza en cada sesión real confirmada (App.tsx, onAuthStateChanged)
  // -- no en cada acción, solo al abrir/recuperar sesión. Usado por el panel
  // de crecimiento (GrowthAnalyticsScreen.tsx) y el re-enganche automático
  // (scripts/reengagement-push.mjs) para detectar usuarios inactivos.
  lastActiveAt?: Timestamp | null;
  // Escrito únicamente por scripts/reengagement-push.mjs (Admin SDK, corre
  // fuera del cliente vía .github/workflows/reengagement.yml) -- nunca
  // aparece en la whitelist de update de firestore.rules porque el Admin
  // SDK no pasa por las reglas de seguridad, y ningún código de cliente
  // debe escribir este campo.
  lastReengagementPushAt?: Timestamp | null;
  // Leídos en ProfileScreen.tsx pero sin ningún campo de edición ni camino de
  // escritura en todo el código hoy — siempre `undefined` en la práctica.
  linkedin?: string;
  portfolio?: string;
}

export interface InvestorProfile {
  uid: string;
  name: string;
  avatar: string;
  role?: string;
  city?: string;
  sectors: string[];
  ticketRange: string;
  stagePreference: string;
  bio?: string;
}

export interface ConnectionRequest {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  toUid: string;
  pitch: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Timestamp | null;
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  category: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  members: string[];
  createdAt: Timestamp | null;
}

export interface LocalContentOpportunity {
  id: string;
  title: string;
  companyName: string;
  companyLogo: string;
  description: string;
  budget?: string;
  deadline: string;
  location: string;
  category: 'Construcción' | 'IT' | 'Energía' | 'Servicios' | 'Logística';
  requirements: string[];
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  description: string;
  logo: string;
  location: string;
  employees: string;
  yearsInMarket?: string;
  website: string;
  isVerified: boolean;
  tags: string[];
  ceoName?: string;
  departments?: string[];
  leadership?: { name: string; role: string }[];
  certifications?: { name: string; year: string; entity: string }[];
  social?: {
    linkedin?: string;
    instagram?: string;
    twitter?: string;
    facebook?: string;
    website?: string;
  };
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  companyId?: string;
  company: string;
  avatar: string;
  location: string;
  timestamp: string;
  note?: string;
  tags: string[];
  lastMet: string;
  isVerified?: boolean;
  birthday?: string; // ISO format or MM-DD
  kudos?: number;
  crmStatus?: 'Prospecto' | 'Socio' | 'Aliado' | 'Cliente';
}

export interface ContactComment {
  id: string;
  authorName: string;
  text: string;
  parentId?: string | null;
  createdAt?: unknown;
}

export interface Task {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  note?: string;
  completed: boolean;
  createdAt: Timestamp | null;
}

export interface Group {
  id: string;
  title: string;
  description: string;
  image: string;
  count: number;
  featured?: boolean;
  tag?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string; // ISO 'YYYY-MM-DD'
  location: string;
  category: string;
  image: string;
  authorId: string;
  authorName: string;
  attendeeIds: string[];
  createdAt: Timestamp | null;
}

export interface SuggestedConnection extends Contact {
  reason: string;
  matchScore: number;
  status?: 'connected' | 'pending' | 'none';
}

export interface ServicePost {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorType: 'individual' | 'company';
  type: 'offer' | 'request';
  category: string;
  location: string;
  price?: string;
  priceValue?: number;
  createdAt: Timestamp | null;
  tags: string[];
  requirements?: string[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'tender' | 'message' | 'system';
  relatedEntityId?: string;
  timestamp: string;
  isRead: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: Timestamp | null;
  type: 'text' | 'audio';
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  participants: string[]; // UIDs — for 1-on-1 chats this is always length 2
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  lastSenderId?: string;
  readReceipts?: Record<string, Timestamp>;
  createdAt?: Timestamp | null;
}
