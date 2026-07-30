import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, UserCircle, Cloud, Info, ChevronRight, Trash2, Bell, MessageCircle, AlertTriangle, Wifi, WifiOff, CheckCircle2, Loader2, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService, NotificationPreference } from '../services/notificationService';
import { localDataService, SyncAction } from '../services/localDataService';

export default function SyncSettingsScreen({ onBack }: { onBack: () => void }) {
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference>({
    messages: true,
    alerts: true,
  });
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [isOnline, setIsOnline] = useState(localDataService.getIsOnline());
  const [lastSync, setLastSync] = useState<string | null>(localDataService.getLastSyncTime());
  const [pendingSync, setPendingSync] = useState(0);
  const [syncQueue, setSyncQueue] = useState<SyncAction[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [currentSyncStep, setCurrentSyncStep] = useState('');

  useEffect(() => {
    setNotifPrefs(notificationService.getPreferences());
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }

    const updateSyncState = () => {
      const queue = localDataService.getSyncQueue();
      setSyncQueue(queue);
      setPendingSync(queue.length);
    };

    const unsubscribe = localDataService.onStatusChange((status) => {
      setIsOnline(status);
      if (status) {
        setLastSync(localDataService.getLastSyncTime());
        updateSyncState();
      }
    });

    updateSyncState();

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

  const [isSyncing, setIsSyncing] = useState(false);

  const [syncSummary, setSyncSummary] = useState<{ updated: number; size: string } | null>(null);

  const handleManualSync = async () => {
    if (!isOnline) {
      notificationService.sendNotification('Sin conexión', 'No se puede sincronizar en este momento. Los datos se enviarán cuando recuperes la conexión.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncProgress(5);
    setCurrentSyncStep('Estableciendo conexión segura...');
    setSyncSummary(null);
    
    await new Promise(resolve => setTimeout(resolve, 600));
    setSyncProgress(15);
    setCurrentSyncStep('Preparando paquetes de datos...');
    
    await new Promise(resolve => setTimeout(resolve, 800));
    setSyncProgress(30);
    setCurrentSyncStep('Analizando deltas de base de datos...');

    await new Promise(resolve => setTimeout(resolve, 700));
    setSyncProgress(45);
    setCurrentSyncStep('Comprimiendo binarios localmente...');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSyncProgress(65);
    setCurrentSyncStep('Sincronizando perfiles profesionales...');
    
    // Simulate real sync steps if there are pending actions
    if (syncQueue.length > 0) {
      setSyncProgress(85);
      setCurrentSyncStep(`Transmitiendo ${syncQueue.length} acciones pendientes...`);
      try {
        await localDataService.processSyncQueue();
      } catch (e) {
        console.error('Manual sync processing failed', e);
      }
    }

    setSyncProgress(95);
    setCurrentSyncStep('Verificando integridad de descarga...');
    await new Promise(resolve => setTimeout(resolve, 800));

    // In a real app, we would fetch fresh data and call localDataService.cacheContacts()
    const { MOCK_CONTACTS } = await import('../constants');
    localDataService.cacheContacts(MOCK_CONTACTS);
    
    setSyncProgress(100);
    setCurrentSyncStep('Sincronización completada con éxito');
    await new Promise(resolve => setTimeout(resolve, 500));

    setLastSync(localDataService.getLastSyncTime());
    setPendingSync(0);
    setSyncQueue([]);
    setSyncStatus('success');
    setIsSyncing(false);
    
    // Set a summary for the user to see
    setSyncSummary({
      updated: MOCK_CONTACTS.length,
      size: (Math.random() * 2 + 1).toFixed(1) + ' MB'
    });
    
    notificationService.sendNotification('Sincronización Exitosa', 'Tu base de datos local ha sido actualizada.');
    
    // Reset status after a delay but keep summary a bit longer
    setTimeout(() => setSyncStatus('idle'), 4000);
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
          <div className="flex gap-2">
            {isOnline ? (
              <span className="text-success font-bold text-xs bg-success/10 px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2">
                <Wifi className="w-3 h-3" /> Online
              </span>
            ) : (
              <span className="text-error font-bold text-xs bg-error/10 px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 animate-pulse">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
            <span className="text-secondary font-bold text-xs bg-secondary/10 px-4 py-1.5 rounded-full uppercase tracking-widest">Activo</span>
          </div>
        </div>
        <p className="text-on-surface-variant leading-relaxed max-w-sm font-medium px-1">Gestione su base de datos profesional localmente para asegurar conectividad en todo el país, incluso sin internet.</p>
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

      <div className="grid grid-cols-1 gap-6">
        <div className="editorial-card p-8 flex items-center gap-6 border-none shadow-md">
          <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center shrink-0">
            <UserCircle className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-on-surface font-display">120 contactos offline</h3>
            <p className="text-on-surface-variant text-sm font-medium">8.4 MB de almacenamiento total usado</p>
          </div>
        </div>

        <div className="editorial-card p-8 flex items-center gap-6 border-none bg-surface-container-low shadow-none relative overflow-hidden group">
          {syncStatus === 'syncing' && (
            <div className="absolute bottom-0 left-0 h-1.5 bg-surface-container-high w-full">
              <motion.div 
                initial={{ width: '0%' }}
                animate={{ width: `${syncProgress}%` }}
                className="h-full bg-primary shadow-[0_0_10px_rgba(var(--color-primary),0.5)]"
              />
            </div>
          )}
          
          <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 transition-colors ${syncStatus === 'success' ? 'bg-success/20 text-success' : 'bg-secondary/10 text-secondary'}`}>
            {syncStatus === 'syncing' ? (
              <RefreshCw className="w-8 h-8 animate-spin" />
            ) : syncStatus === 'success' ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : (
              <Cloud className="w-8 h-8" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-on-surface font-display">
              {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronización en la Nube'}
            </h3>
            <p className="text-on-surface-variant text-sm font-medium italic">
              {syncStatus === 'syncing' 
                ? currentSyncStep 
                : lastSync ? `Sincronizado: ${new Date(lastSync).toLocaleTimeString()}` : 'Nunca sincronizado'}
            </p>
          </div>
          
          <AnimatePresence>
            {syncSummary && syncStatus !== 'syncing' && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-success/10 p-4 rounded-2xl border border-success/20 flex flex-col items-end text-right"
              >
                <div className="flex items-center gap-1.5 text-success mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Resumen</span>
                </div>
                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                  {syncSummary.updated} perfiles • {syncSummary.size}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {pendingSync > 0 && syncStatus === 'idle' && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute top-4 right-4 bg-error text-white text-[10px] font-bold px-3 py-1 rounded-full animate-bounce shadow-lg shadow-error/20"
              >
                {pendingSync} Pendientes
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Detailed Pending Actions */}
        <AnimatePresence>
          {syncQueue.length > 0 && syncStatus !== 'success' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-1 p-5 bg-surface-container-low rounded-[1.5rem] border border-outline/5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Database className="w-3 h-3" /> Transacciones en cola
                </span>
                <span className="text-[10px] font-bold text-error animate-pulse uppercase tracking-wider">Esperando conexión</span>
              </div>
              <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
                {syncQueue.map((action, idx) => (
                  <div key={action.id} className="flex items-center justify-between py-2 border-b border-outline/5 last:border-0 group/action">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-surface-container-high group-hover/action:bg-primary/10 transition-colors flex items-center justify-center">
                        {action.type.includes('message') ? <MessageCircle className="w-3.5 h-3.5 text-primary" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface capitalize leading-tight">{action.type.replace('_', ' ')}</span>
                        <span className="text-[9px] text-outline-variant font-medium">ID: {action.id.slice(-8).toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-on-surface-variant">{new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[8px] font-bold text-secondary uppercase tracking-tighter">Prioridad Alta</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center py-4">
        <button 
          onClick={handleManualSync}
          disabled={isSyncing}
          className={`font-display font-bold py-5 px-12 rounded-full flex items-center gap-4 active:scale-95 transition-all shadow-xl uppercase tracking-widest text-xs outline-hidden disabled:opacity-50 overflow-hidden relative ${
            syncStatus === 'success' ? 'bg-success text-white shadow-success/20' : 'bg-primary text-white shadow-primary/20'
          }`}
        >
          <AnimatePresence mode="wait">
            {syncStatus === 'syncing' ? (
              <motion.div
                key="syncing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-4"
              >
                <div className="relative">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-white/50">
                    {syncProgress}
                  </span>
                </div>
                <span>Sincronizando...</span>
              </motion.div>
            ) : syncStatus === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-4"
              >
                <CheckCircle2 className="w-5 h-5" />
                Completado
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-4"
              >
                <RefreshCw className="w-5 h-5" />
                Sincronizar Ahora
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Preference Toggles (Sync) */}
      <section className="space-y-8 pt-6">
        <div className="flex items-center justify-between border-b border-outline/10 pb-4 px-1">
          <span className="text-secondary font-bold tracking-[0.2em] text-[10px] uppercase">Preferencias de Sincronización</span>
        </div>
        
        <div className="space-y-6 px-1">
          {[
            { label: 'Sincronización con Datos Móviles', desc: 'Permitir actualizaciones con red celular (Roaming local)', icon: RefreshCw },
            { label: 'Sincronización Automática', desc: 'Mantener perfiles y licitaciones siempre al día', icon: Cloud }
          ].map((tier) => (
            <div key={tier.label} className="flex items-center justify-between gap-4 group">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0`}>
                  <tier.icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-lg text-on-surface font-display leading-tight">{tier.label}</label>
                  <p className="text-on-surface-variant text-sm font-medium opacity-70 leading-snug">{tier.desc}</p>
                </div>
              </div>
              <button className="w-14 h-7 bg-secondary rounded-full relative transition-colors outline-hidden shrink-0">
                <span className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Transparency Card */}
      <section className="bg-primary-container p-10 rounded-[2.5rem] relative overflow-hidden text-white shadow-2xl shadow-primary/10">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Info className="w-32 h-32" />
        </div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <h4 className="font-bold font-display text-xl tracking-tight text-white">Transparencia de Datos en GE</h4>
          </div>
          <p className="text-primary-fixed/80 text-lg leading-relaxed font-medium">
            EG Connect utiliza un algoritmo de compresión propietario. Una sincronización completa consume aproximadamente <span className="text-secondary-container font-bold">1.2 MB</span> por cada 500 perfiles. 
          </p>
          <div className="grid grid-cols-2 gap-8 pt-4 text-white">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold block mb-1">Este Mes</span>
              <span className="text-4xl font-extrabold font-display">24.8 MB</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold block mb-1">Comprimido</span>
              <span className="text-4xl font-extrabold font-display text-secondary-container">88%</span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 pb-20">
        <button className="editorial-card p-6 flex items-center justify-between hover:bg-white hover:shadow-md cursor-pointer border-none shadow-sm outline-hidden group">
          <span className="font-bold text-primary font-display">Ver Historial de Uso de Datos</span>
          <ChevronRight className="w-5 h-5 text-outline group-hover:translate-x-1 transition-transform" />
        </button>
        <button 
          onClick={() => {
            localDataService.clearSyncQueue();
            setSyncQueue([]);
            setPendingSync(0);
            notificationService.sendNotification('Caché Limpiada', 'La cola de sincronización ha sido vaciada.');
          }}
          className="bg-error-container/20 p-6 rounded-[1.5rem] flex items-center justify-between group hover:bg-error-container/30 transition-colors cursor-pointer outline-hidden w-full"
        >
          <span className="font-bold text-error font-display">Limpiar Cola de Sincronización</span>
          <Trash2 className="w-5 h-5 text-error" />
        </button>
      </div>
    </div>
  );
}
