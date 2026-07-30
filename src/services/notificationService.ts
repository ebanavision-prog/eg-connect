import { Screen } from '../types';

export interface NotificationPreference {
  messages: boolean;
  alerts: boolean;
}

const PREFERENCE_KEY = 'notification_preferences';

export class NotificationService {
  private static instance: NotificationService;
  private preferences: NotificationPreference = {
    messages: true,
    alerts: true,
  };

  private constructor() {
    this.loadPreferences();
  }

  static getInstance() {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private loadPreferences() {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (saved) {
      try {
        this.preferences = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse preferences', e);
      }
    }
  }

  savePreferences(prefs: NotificationPreference) {
    this.preferences = prefs;
    localStorage.setItem(PREFERENCE_KEY, JSON.stringify(prefs));
  }

  getPreferences() {
    return { ...this.preferences };
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications.');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  sendNotification(title: string, body: string, icon = '/logo.png') {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon,
      });
    }
  }

  // Simulated push received from backend
  async simulatePush(type: 'message' | 'alert', title: string, body: string) {
    if (type === 'message' && !this.preferences.messages) return;
    if (type === 'alert' && !this.preferences.alerts) return;

    this.sendNotification(title, body);
  }
}

export const notificationService = NotificationService.getInstance();
