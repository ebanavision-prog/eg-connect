import { Timestamp } from 'firebase/firestore';

export type Screen = 'home' | 'timeline' | 'scan' | 'feedback' | 'map' | 'profile' | 'groups' | 'summary' | 'invite' | 'tasks' | 'onboarding' | 'contact-detail' | 'insight-detail' | 'my-cards' | 'sync-settings' | 'events' | 'marketplace' | 'companies' | 'company-detail' | 'chat' | 'tenders' | 'crm' | 'investors' | 'initiatives' | 'search';

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
  timestamp: string;
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
  createdAt?: Timestamp | null;
}
