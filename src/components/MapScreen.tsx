import { useState } from 'react';
import { Search, SlidersHorizontal, MessageSquare, UserPlus, Verified, MapPin, WifiOff, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService } from '../services/notificationService';

export default function MapScreen() {
  const [showToast, setShowToast] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ name: string; role: string; company: string } | null>(null);

  const handlePinClick = (name: string, role: string, company: string) => {
    setSelectedContact({ name, role, company });
    setShowToast(true);
    notificationService.sendNotification('Contacto Cercano', `${name} - ${role} en ${company}`);
    
    // Auto-hide toast
    setTimeout(() => {
      setShowToast(false);
    }, 5000);
  };

  return (
    <div className="relative h-[calc(100vh-160px)] -mx-6 overflow-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && selectedContact && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-28 left-1/2 z-[100] w-[calc(100%-3rem)] max-w-sm"
          >
            <div className="bg-surface-container-highest/95 backdrop-blur-md text-on-surface p-4 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-70">Contacto Disponible</p>
                <p className="text-sm font-bold truncate">{selectedContact.name}</p>
                <p className="text-[10px] text-on-surface-variant font-medium truncate">{selectedContact.role} @ {selectedContact.company}</p>
              </div>
              <button 
                onClick={() => setShowToast(false)}
                className="p-1.5 hover:bg-black/5 rounded-full outline-hidden transition-colors"
              >
                <X className="w-4 h-4 text-outline-variant" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map Background Mock */}
      <div className="absolute inset-0 z-0 text-balance">
        <img 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuB68nDawo22qZ9Zmm2MPApE0T7bw3I7OvDp8_xsMNt3290mXBSigTK7EE1Z6VhKYUc_UzJ6X59lgFn71kxAXm2ZfvDcHJu0wPP2LISXjdFHypNnzbzXNyLrkrNlm2ETlc5JDfBLAo6I2y_nsFEjX2R_XyNlJTVkv3m2uJ2y49aA3HME8jLF-RkyH1kMLjiRv7ri0AkYeW_Uf81u-tlLs1t57Fsha_cLPK4NgQAtiX4n4vt6G-3pzoE8AUzFzXl2ACcycn-oBJ-Iv0c" 
          alt="Mapa de Guinea Ecuatorial" 
          className="w-full h-full object-cover grayscale-[0.2]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-surface/90 via-transparent to-surface/90 pointer-events-none" />
      </div>

      {/* Offline Badge */}
      <div className="absolute top-24 right-6 z-30 flex items-center gap-2 bg-secondary-container px-3 py-1.5 rounded-full shadow-lg border border-white/20">
        <WifiOff className="w-3 h-3 text-on-secondary-container" />
        <span className="text-[10px] font-bold text-on-secondary-container uppercase tracking-widest">Mapa Offline</span>
      </div>

      {/* Floating Controls */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-lg z-20 space-y-3">
        <div className="glass-effect p-2 rounded-full flex items-center shadow-lg">
          <div className="pl-4 pr-2 text-on-surface-variant">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar contactos cercanos..." 
            className="bg-transparent border-none focus:ring-0 text-on-surface w-full font-sans text-sm outline-hidden"
          />
          <button className="bg-primary text-white p-3 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-md outline-hidden">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
          {['Todo GE', 'Empresas', 'Tecnología', 'Energía'].map((tag, i) => (
            <button key={tag} className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm outline-hidden ${i === 0 ? 'bg-secondary-container text-on-secondary-container' : 'glass-effect text-on-surface-variant font-medium'}`}>
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Map Pins */}
      <div 
        className="absolute top-[40%] left-[30%] z-10"
        onClick={() => handlePinClick('Bernardino Edu', 'Especialista IT', 'Consultora Malabo')}
      >
        <div className="relative group cursor-pointer">
          <div className="absolute -inset-4 bg-primary/20 rounded-full animate-ping" />
          <div className="relative w-12 h-12 rounded-full border-4 border-white shadow-xl overflow-hidden ring-4 ring-primary-container/20 transition-transform group-hover:scale-110">
            <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150" className="w-full h-full object-cover" alt="Pin" />
          </div>
        </div>
      </div>

      <div 
        className="absolute top-[55%] right-[25%] z-10 flex flex-col items-center cursor-pointer group"
        onClick={() => handlePinClick('Manuel Nguema', 'Ingeniero de Minas', 'GEPetrol')}
      >
         <div className="bg-primary-container text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg mb-2 uppercase tracking-widest text-center transition-transform group-hover:scale-105">12 Conexiones</div>
         <div className="w-10 h-10 rounded-full bg-secondary-container border-2 border-white shadow-xl flex items-center justify-center text-on-secondary-container transition-transform group-hover:scale-110">
           <MapPin className="w-5 h-5" />
         </div>
      </div>

      {/* Bottom Sheet Preview */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-30">
        <div className="bg-surface-container-lowest rounded-[2.5rem] p-6 shadow-2xl border-t border-white ring-1 ring-black/5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150" 
                className="w-16 h-16 rounded-2xl object-cover shadow-sm" 
                alt="Esperanza B." 
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-secondary-container rounded-full flex items-center justify-center border-2 border-surface-container-lowest text-on-secondary-container shadow-sm">
                <Verified className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start text-balance">
                <h3 className="text-xl font-bold font-display text-primary">Esperanza Bindang</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant uppercase tracking-widest">200m</span>
              </div>
              <p className="text-sm text-secondary font-semibold font-sans leading-tight">Arquitecta de Software @ EG Connect</p>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 py-3.5 bg-surface-container-low text-primary rounded-full font-bold text-xs transition-transform active:scale-95 outline-hidden">
              <MessageSquare className="w-4 h-4" />
              Mensaje
            </button>
            <button className="flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-full font-bold text-xs transition-transform active:scale-95 shadow-lg shadow-primary/20 outline-hidden">
              <UserPlus className="w-4 h-4" />
              Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
