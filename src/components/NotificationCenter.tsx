import { Bell, X, Briefcase, MessageSquare, Info, CheckCircle, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppNotification } from '../types';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export default function NotificationCenter({ notifications, onClose, onMarkAsRead, onClearAll }: NotificationCenterProps) {
  return (
    <div className="fixed inset-0 z-100 flex justify-end">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-sm bg-surface h-full shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-outline/10 flex justify-between items-center bg-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Notificaciones</h2>
              <p className="text-[10px] font-bold text-outline-variant uppercase tracking-widest">Centro de Actividad</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-low transition-colors">
            <X className="w-6 h-6 text-on-surface-variant" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <motion.div 
                key={notif.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-[1.5rem] border transition-all ${
                  notif.isRead 
                    ? 'bg-surface-container-low border-outline/5' 
                    : 'bg-white border-primary shadow-sm ring-1 ring-primary/10'
                }`}
                onClick={() => onMarkAsRead(notif.id)}
              >
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    notif.type === 'tender' ? 'bg-secondary/10' : 
                    notif.type === 'message' ? 'bg-primary/10' : 'bg-surface-container-high'
                  }`}>
                    {notif.type === 'tender' ? <Briefcase className="w-5 h-5 text-secondary" /> : 
                     notif.type === 'message' ? <MessageSquare className="w-5 h-5 text-primary" /> : <Info className="w-5 h-5 text-on-surface-variant" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm font-bold leading-tight ${notif.isRead ? 'text-on-surface-variant' : 'text-primary'}`}>
                        {notif.title}
                      </h4>
                      {!notif.isRead && <div className="w-2 h-2 bg-secondary rounded-full mt-1 shrink-0" />}
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed mb-2">
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-on-surface-variant/60 font-medium">{notif.timestamp}</span>
                      {notif.type === 'tender' && (
                        <button className="flex items-center gap-1 text-[10px] font-bold text-secondary uppercase tracking-widest hover:underline">
                          Ver Licitación <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
              <Bell className="w-12 h-12 mb-4" />
              <p className="font-bold">Todo al día</p>
              <p className="text-xs">No tienes notificaciones pendientes</p>
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-6 border-t border-outline/10 bg-surface-container-low">
            <button 
              onClick={onClearAll}
              className="w-full py-4 border border-outline/20 rounded-2xl text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Marcar todo como leído
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
