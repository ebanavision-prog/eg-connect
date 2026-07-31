import { useState, useEffect } from 'react';
import { ArrowLeft, UserCircle, Bell, MessageCircle, AlertTriangle, Wifi, WifiOff, CheckCircle2, ChevronRight } from 'lucide-react';
import { notificationService, NotificationPreference } from '../services/notificationService';
import { localDataService } from '../services/localDataService';

export default function SyncSettingsScreen({ onBack }: { onBack: () => void }) {
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference>({
    messages: true,
    alerts: true,
  });
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [isOnline, setIsOnline] = useState(localDataService.getIsOnline());

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

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    if (granted) {
      notificationService.sendNotification('¡Notificaciones activadas!', 'Ahora recibirás alertas importantes de EG CONNECT.');
    }
  };

  return (
    <div className="py-6 space-y-10 max-w-xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 rounded-full hover:bg-surface-container-high transition-all outline-hidden">
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <h1 className="font-display font-extrabold text-3xl text-primary tracking-tight">Sincronización y Alertas</h1>
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-display">Estado</h2>
          {isOnline ? (
            <span className="text-success font-bold text-xs bg-success/10 px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2">
              <Wifi className="w-3 h-3" /> Online
            </span>
          ) : (
            <span className="text-error font-bold text-xs bg-error/10 px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 animate-pulse">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
        </div>
        <p className="text-on-surface-variant leading-relaxed max-w-sm font-medium px-1">
          Tus datos se guardan de forma real en tu dispositivo y se sincronizan solos en cuanto recuperas conexión — no hace falta ningún paso manual.
        </p>
      </section>

      {/* Notification Permissions Banner */}
      {permissionStatus !== 'granted' && (
        <div className="mx-1 p-6 bg-secondary/5 border border-secondary/20 rounded-[2rem] flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
            <Bell className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-primary">Activar Notificaciones de Sistema</h3>
            <p className="text-xs text-on-surface-variant max-w-[240px]">Para recibir alertas instantáneas incluso cuando la app esté cerrada en segundo plano.</p>
          </div>
          <button
            onClick={handleRequestPermission}
            className="px-8 py-3 bg-secondary text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-lg shadow-secondary/20 active:scale-95 transition-all"
          >
            Permitir Notificaciones
          </button>
        </div>
      )}

      {/* Preference Toggles */}
      <section className="space-y-8 pt-6">
        <div className="flex items-center justify-between border-b border-outline/10 pb-4 px-1">
          <span className="text-primary font-bold tracking-[0.2em] text-[10px] uppercase">Preferencias de Comunicación</span>
        </div>

        <div className="space-y-6 px-1">
          {[
            {
              key: 'messages' as const,
              label: 'Nuevos Mensajes',
              desc: 'Notificar cuando recibas un mensaje de un contacto',
              icon: MessageCircle
            },
            {
              key: 'alerts' as const,
              label: 'Alertas y Licitaciones',
              desc: 'Alertas de nuevas oportunidades locales o sistema',
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
            {isOnline ? 'Datos al día' : 'Trabajando sin conexión'}
          </h3>
          <p className="text-on-surface-variant text-sm font-medium">
            {isOnline
              ? 'Todo lo que ves está guardado y actualizado en tiempo real.'
              : 'Sigues pudiendo ver y crear datos — se enviarán solos al reconectar.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-20">
        <button className="editorial-card p-6 flex items-center justify-between hover:bg-white hover:shadow-md cursor-pointer border-none shadow-sm outline-hidden group">
          <span className="font-bold text-primary font-display">Ver Historial de Uso de Datos</span>
          <ChevronRight className="w-5 h-5 text-outline group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
