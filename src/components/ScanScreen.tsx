import React, { useState } from 'react';
import { QrCode, Zap, Image, ArrowLeft, UserPlus, Sparkles, Edit3, Loader2 } from 'lucide-react';
import { extractContactFromImage } from '../services/aiService';
import { auth, addContact } from '../services/firebaseService';

export default function ScanScreen({ onBack }: { onBack: () => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSaveContact = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !scannedResult) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await addContact(uid, {
        name: scannedResult.name || 'Sin nombre',
        role: scannedResult.role || '',
        company: scannedResult.company || '',
        location: scannedResult.location || '',
        tags: scannedResult.tags || [],
        note: scannedResult.note || '',
        avatar: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop',
        lastMet: 'Hoy'
      });
      setScannedResult(null);
      onBack();
    } catch (error) {
      setSaveError('No se pudo guardar el contacto. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) {
        const result = await extractContactFromImage(base64String);
        setScannedResult(result);
      }
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="py-6 flex flex-col items-center animate-in fade-in duration-500">
      <div className="w-full flex justify-between items-center mb-8 px-6 md:px-0">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-surface-container-high transition-all outline-hidden">
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <div className="text-center">
          <h1 className="font-display font-bold text-2xl text-primary tracking-tight">Escaneo Inteligente</h1>
          <p className="text-on-surface-variant text-sm font-medium">Extrae datos automáticamente de cualquier tarjeta</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Viewfinder Box */}
      <div className="relative w-full aspect-square max-w-[320px] group mb-12">
        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-secondary-container rounded-tl-[1.5rem]" />
        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-secondary-container rounded-tr-[1.5rem]" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-secondary-container rounded-bl-[1.5rem]" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-secondary-container rounded-br-[1.5rem]" />
        
        {/* Animated Scan Line */}
        <div className="absolute inset-x-6 top-1/2 h-0.5 bg-secondary-container shadow-[0_0_20px_#58fdc8] animate-pulse z-10" />

        {/* Viewfinder Background Mock */}
        <div className="absolute inset-4 rounded-xl overflow-hidden glass-effect flex flex-col items-center justify-center p-8 text-center gap-4">
          {isScanning ? (
            <>
              <Loader2 className="w-12 h-12 text-secondary animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-primary">Procesando Tarjeta...</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest leading-normal">El sistema está analizando los datos</p>
              </div>
            </>
          ) : scannedResult ? (
            <div className="animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-secondary-container rounded-2xl flex items-center justify-center text-on-secondary-container mx-auto mb-4 shadow-lg shadow-secondary/20">
                <UserPlus className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-primary text-xl leading-tight mb-1">{scannedResult.name}</h3>
              <p className="text-xs text-secondary font-semibold uppercase tracking-widest mb-1">{scannedResult.role}</p>
              <p className="text-[10px] text-on-surface-variant font-medium opacity-70 mb-4">{scannedResult.company}</p>
              <button
                onClick={handleSaveContact}
                disabled={isSaving}
                className="px-6 py-2 bg-primary text-white rounded-full text-xs font-bold shadow-lg shadow-primary/20 outline-hidden active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving ? 'Guardando...' : 'Guardar Contacto'}
              </button>
              {saveError && <p className="text-[10px] font-bold text-error mt-3">{saveError}</p>}
            </div>
          ) : (
            <>
              <QrCode className="w-16 h-16 text-primary/10" />
              <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                Apunta a una tarjeta de visita o sube una foto para que el sistema la guarde automáticamente.
              </p>
            </>
          )}
        </div>

        {/* Floating Controls */}
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
          <button className="w-12 h-12 rounded-full glass-effect flex items-center justify-center text-primary shadow-lg active:scale-90 transition-all outline-hidden">
            <Zap className="w-5 h-5" />
          </button>
          <label className="w-12 h-12 rounded-full glass-effect flex items-center justify-center text-primary shadow-lg active:scale-90 transition-all outline-hidden cursor-pointer">
            <Image className="w-5 h-5" />
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <button className="bg-primary text-white p-6 rounded-[2rem] flex flex-col items-start gap-4 shadow-xl active:scale-95 transition-all outline-hidden">
          <div className="bg-white/10 p-3 rounded-2xl">
            <Sparkles className="w-6 h-6 text-secondary-container" />
          </div>
          <div className="text-left">
            <span className="block text-[10px] uppercase font-bold tracking-widest opacity-60">Escaneo Automático</span>
            <span className="font-display font-bold text-lg">Tarjeta Física</span>
          </div>
        </button>
        
        <button className="bg-surface-container-low p-6 rounded-[1.5rem] flex flex-col items-start gap-4 active:scale-95 transition-all outline-hidden hover:bg-surface-container-high transition-colors">
          <div className="bg-primary/5 p-3 rounded-2xl text-primary">
            <Edit3 className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Sin Cámara</span>
            <span className="font-display font-bold text-lg text-primary">Manual</span>
          </div>
        </button>
      </div>

      <div className="mt-12 flex items-center gap-2 bg-secondary-container/20 px-4 py-2 rounded-full border border-secondary/10">
        <Sparkles className="w-3.5 h-3.5 text-secondary" />
        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Optimizado para Guinea Ecuatorial</span>
      </div>
    </div>
  );
}
