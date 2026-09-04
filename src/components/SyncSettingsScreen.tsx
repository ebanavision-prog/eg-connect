import { useState, useEffect } from 'react';
import { ArrowLeft, UserCircle, Bell, MessageCircle, AlertTriangle, Wifi, WifiOff, CheckCircle2, Loader2, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { notificationService, NotificationPreference } from '../services/notificationService';
import { localDataService } from '../services/localDataService';
import { auth } from '../services/firebaseService';
import { enablePushNotifications, isPushConfigured } from '../services/pushService';

export default function SyncSettingsScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference>({
    messages: true,
    alerts: true,
  });
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [isOnline, setIsOnline] = useState(localDataService.getIsOnline());
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    setNotifPrefs(notificationService.getPreferences());
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }

    const unsubscribe = localDataService.onStatusChange(setIsOnline);
    return unsubscribe;
  }, []);

  const handleToggle = (key: keyof NotificationPreference) => {
    const newPrefs = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(newPrefs);
    notificationService.savePreferences(newPrefs);
  };

  // Antes esto solo pedía el permiso de notificaciones del navegador (y este
  // mismo banner ya prometía "incluso cuando la app esté cerrada", algo que
  // ese permiso por sí solo nunca garantiza). Ahora, cuando hay push real
  // configurado (VITE_FCM_VAPID_KEY), también registra este dispositivo de
  // verdad para recibir push en segundo plano; si no está configurado, cae
  // de vuelta al comportamiento anterior sin fingir más de lo que hace.
  const handleRequestPermission = async () => {
    const uid = auth.currentUser?.uid;
    setPushError('');

    if (isPushConfigured() && uid) {
      setIsEnablingPush(true);
      const result = await enablePushNotifications(uid);
      setIsEnablingPush(false);
      if ('Notification' in window) setPermissionStatus(Notification.permission);
      if (result.ok) {
        setPushEnabled(true);
        notificationService.sendNotification(t('syncSettings.notificationsEnabledTitle'), t('syncSettings.notificationsEnabledBodyReal'));
      } else {
        setPushError(result.error || 'No se pudo activar el push.');
      }
      return;
    }

    const granted = await notificationService.requestPermission();
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    if (granted) {
      notificationService.sendNotification(t('syncSettings.notificationsEnabledTitle'), t('syncSettings.notificationsEnabledBodyBasic'));
    }
  };

  const handleLanguageChange = (lng: 'es' | 'en') => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="py-6 space-y-10 max-w-xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 rounded-full hover:bg-surface-container-high transition-all outline-hidden">
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <h1 className="font-display font-extrabold text-3xl text-primary tracking-tight">{t('syncSettings.title')}</h1>
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-display">{t('syncSettings.statusTitle')}</h2>
          {isOnline ? (
            <span className="text-success font-bold text-xs bg-success/10 px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2">
              <Wifi className="w-3 h-3" /> {t('syncSettings.online')}
            </span>
          ) : (
            <span className="text-error font-bold text-xs bg-error/10 px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 animate-pulse">
              <WifiOff className="w-3 h-3" /> {t('syncSettings.offline')}
            </span>
          )}
        </div>
        <p className="text-on-surface-variant leading-relaxed max-w-sm font-medium px-1">
          {t('syncSettings.statusDescription')}
        </p>
      </section>

      {/* Language Switcher */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-outline/10 pb-4 px-1">
          <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase">{t('syncSettings.languageLabel')}</span>
        </div>
        <div className="editorial-card p-6 flex items-center gap-6 border-none shadow-md mx-1">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Languages className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-on-surface">{t('syncSettings.languageLabel')}</h3>
            <p className="text-on-surface-variant text-xs font-medium">{t('syncSettings.languageDesc')}</p>
          </div>
          <div className="flex p-1 bg-surface-container-high rounded-full shrink-0">
            <button
              onClick={() => handleLanguageChange('es')}
              aria-pressed={i18n.resolvedLanguage === 'es'}
              title={t('syncSettings.languageSpanish')}
              className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all ${
                i18n.resolvedLanguage === 'es' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant opacity-60 hover:opacity-100'
              }`}
            >
              ES
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              aria-pressed={i18n.resolvedLanguage === 'en'}
              title={t('syncSettings.languageEnglish')}
              className={`px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all ${
                i18n.resolvedLanguage === 'en' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant opacity-60 hover:opacity-100'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </section>

      {/* Notification Permissions Banner */}
      {(permissionStatus !== 'granted' || (isPushConfigured() && !pushEnabled)) && (
        <div className="mx-1 p-6 bg-secondary/5 border border-secondary/20 rounded-[2rem] flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-primary">{t('syncSettings.enableNotificationsTitle')}</h3>
            <p className="text-xs text-on-surface-variant max-w-[240px]">
              {isPushConfigured()
                ? t('syncSettings.enableNotificationsDescConfigured')
                : t('syncSettings.enableNotificationsDescBasic')}
            </p>
          </div>
          {pushError && <p className="text-[10px] font-bold text-error">{pushError}</p>}
          <button
            onClick={handleRequestPermission}
            disabled={isEnablingPush}
            className="px-8 py-3 bg-secondary text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {isEnablingPush && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEnablingPush ? t('syncSettings.enablingButton') : t('syncSettings.enableNotificationsButton')}
          </button>
        </div>
      )}

      {/* Preference Toggles */}
      <section className="space-y-8 pt-6">
        <div className="flex items-center justify-between border-b border-outline/10 pb-4 px-1">
          <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase">{t('syncSettings.preferencesTitle')}</span>
        </div>

        <div className="space-y-6 px-1">
          {[
            {
              key: 'messages' as const,
              label: t('syncSettings.messagesLabel'),
              desc: t('syncSettings.messagesDesc'),
              icon: MessageCircle
            },
            {
              key: 'alerts' as const,
              label: t('syncSettings.alertsLabel'),
              desc: t('syncSettings.alertsDesc'),
              icon: AlertTriangle
            }
          ].map((tier) => (
            <div key={tier.key} className="flex items-center justify-between gap-4 group">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${notifPrefs[tier.key] ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-outline'}`}>
                  <tier.icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-lg text-on-surface font-display leading-tight">{tier.label}</label>
                  <p className="text-on-surface-variant text-sm font-medium opacity-70 leading-snug">{tier.desc}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(tier.key)}
                className={`w-14 h-7 rounded-full relative transition-all outline-hidden shrink-0 ${notifPrefs[tier.key] ? 'bg-primary' : 'bg-outline-variant/30'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${notifPrefs[tier.key] ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Real persistence status */}
      <div className="editorial-card p-8 flex items-center gap-6 border-none shadow-md">
        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 ${isOnline ? 'bg-success/20 text-success' : 'bg-secondary/10 text-secondary'}`}>
          {isOnline ? <CheckCircle2 className="w-8 h-8" /> : <UserCircle className="w-8 h-8" />}
        </div>
        <div>
          <h3 className="text-xl font-bold text-on-surface font-display">
            {isOnline ? t('syncSettings.upToDateTitle') : t('syncSettings.offlineWorkingTitle')}
          </h3>
          <p className="text-on-surface-variant text-sm font-medium">
            {isOnline ? t('syncSettings.upToDateDesc') : t('syncSettings.offlineWorkingDesc')}
          </p>
        </div>
      </div>

    </div>
  );
}
