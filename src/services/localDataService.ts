import { Contact } from '../types';

export interface SyncAction {
  id: string;
  type: 'add_contact' | 'send_message' | 'update_profile';
  payload: any;
  timestamp: string;
}

const STORAGE_KEYS = {
  CONTACTS: 'eg_connect_contacts',
  SYNC_QUEUE: 'eg_connect_sync_queue',
  LAST_SYNC: 'eg_connect_last_sync',
  USER_PROFILE: 'eg_connect_user_profile'
};

export class LocalDataService {
  private static instance: LocalDataService;
  private isOnline: boolean = navigator.onLine;
  private listeners: ((online: boolean) => void)[] = [];

  private constructor() {
    window.addEventListener('online', () => this.handleStatusChange(true));
    window.addEventListener('offline', () => this.handleStatusChange(false));
  }

  static getInstance() {
    if (!LocalDataService.instance) {
      LocalDataService.instance = new LocalDataService();
    }
    return LocalDataService.instance;
  }

  // User Profile
  saveUserProfile(profile: { name: string; phone: string; birthday: string; profession: string; city: string; role: string; avatar: string; profileType: string }) {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    this.queueAction('update_profile', profile);
  }

  getUserProfile(): { name: string; phone: string; birthday: string; profession: string; city: string; role: string; avatar: string; profileType: string } | null {
    const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  }

  private handleStatusChange(status: boolean) {
    this.isOnline = status;
    if (status) {
      this.processSyncQueue();
    }
    this.listeners.forEach(l => l(status));
  }

  onStatusChange(callback: (online: boolean) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  getIsOnline() {
    return this.isOnline;
  }

  // Cache Management
  cacheContacts(contacts: Contact[]) {
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  getCachedContacts(): Contact[] {
    const data = localStorage.getItem(STORAGE_KEYS.CONTACTS);
    return data ? JSON.parse(data) : [];
  }

  getLastSyncTime(): string | null {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  // Sync Queue
  queueAction(type: SyncAction['type'], payload: any) {
    const action: SyncAction = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      payload,
      timestamp: new Date().toISOString()
    };

    const queue = this.getSyncQueue();
    queue.push(action);
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  getSyncQueue(): SyncAction[] {
    const data = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    return data ? JSON.parse(data) : [];
  }

  async processSyncQueue() {
    const queue = this.getSyncQueue();
    if (queue.length === 0) return;

    console.log(`Processing ${queue.length} offline actions...`);
    
    // Simulate API calls for each action
    for (const action of queue) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
        console.log(`Synced action: ${action.type}`, action.payload);
      } catch (err) {
        console.error(`Failed to sync action ${action.id}`, err);
        throw err; // Re-throw to handle in UI
      }
    }

    // Clear queue after successful processing
    this.clearSyncQueue();
  }

  clearSyncQueue() {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
  }
}

export const localDataService = LocalDataService.getInstance();
