import React, { useRef, useState } from 'react';
import { QrCode, Image, ArrowLeft, UserPlus, Sparkles, Edit3, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractContactFromImage } from '../services/aiService';
import { auth, addContact } from '../services/firebaseService';

const EMPTY_MANUAL_CONTACT = { name: '', role: '', company: '', location: '', note: '' };

export default function ScanScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [scanError, setScanError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Entrada manual, sin cámara ni IA — mismo addContact() real que usa el
  // flujo de escaneo, solo que el usuario escribe los datos él mismo. Antes
  // el botón "Manual" no tenía onClick; ahora abre este formulario de verdad.
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualContact, setManualContact] = useState(EMPTY_MANUAL_CONTACT);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

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
      setSaveError(t('scan.saveErrorGeneric'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError('');
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) {
        const result = await extractContactFromImage(base64String);
        if (result) {
          setScannedResult(result);
        } else {
          setScanError(t('scan.scanErrorGeneric'));
        }
      }
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveManualContact = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !manualContact.name.trim()) return;
    setIsSavingManual(true);
    setManualError('');
    try {
      await addContact(uid, {
        name: manualContact.name.trim(),
        role: manualContact.role.trim(),
        company: manualContact.company.trim(),
        location: manualContact.location.trim(),
        note: manualContact.note.trim(),
        tags: [],
        avatar: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=100&h=100&fit=crop',
        lastMet: 'Hoy'
      });
      setShowManualForm(false);
      setManualContact(EMPTY_MANUAL_CONTACT);
      onBack();
    } catch (error) {
      setManualError(t('scan.saveErrorGeneric'));
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="py-6 flex flex-col items-center animate-in fade-in duration-500">
      <div className="w-full flex justify-between items-center mb-8 px-6 md:px-0">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-surface-container-high transition-all outline-hidden">
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
        <div className="text-center">
          <h1 className="font-display font-bold text-2xl text-primary tracking-tight">{t('scan.title')}</h1>
          <p className="text-on-surface-variant text-sm font-medium">{t('scan.subtitle')}</p>
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
                <p className="text-sm font-bold text-primary">{t('scan.processingTitle')}</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest leading-normal">{t('scan.processingDesc')}</p>
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
                {isSaving ? t('scan.saving') : t('scan.saveContact')}
              </button>
              {saveError && <p className="text-[10px] font-bold text-error mt-3">{saveError}</p>}
            </div>
          ) : (
            <>
              <QrCode className="w-16 h-16 text-primary/10" />
              <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                {t('scan.viewfinderHint')}
              </p>
              {scanError && <p className="text-[10px] font-bold text-error mt-3">{scanError}</p>}
            </>
          )}
        </div>

        {/* Input real compartido: la app no abre una cámara en vivo dentro de la
            pantalla (no hay <video>/getUserMedia aquí), así que "escanear" es
            en realidad subir una foto — el propio selector del sistema deja
            elegir la cámara del teléfono o la galería. Por eso no hay un botón
            de flash aparte: no hay ninguna sesión de cámara propia que
            controlar; el flash lo maneja la app de cámara nativa del teléfono
            si el usuario la usa desde este mismo selector. */}
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />

        {/* Floating Controls */}
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-full glass-effect flex items-center justify-center text-primary shadow-lg active:scale-90 transition-all outline-hidden"
          >
            <Image className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-primary text-white p-6 rounded-[2rem] flex flex-col items-start gap-4 shadow-xl active:scale-95 transition-all outline-hidden"
        >
          <div className="bg-white/10 p-3 rounded-2xl">
            <Sparkles className="w-6 h-6 text-secondary-container" />
          </div>
          <div className="text-left">
            <span className="block text-[10px] uppercase font-bold tracking-widest opacity-60">{t('scan.autoScanLabel')}</span>
            <span className="font-display font-bold text-lg">{t('scan.autoScanCard')}</span>
          </div>
        </button>

        <button
          onClick={() => setShowManualForm(true)}
          className="bg-surface-container-low p-6 rounded-[1.5rem] flex flex-col items-start gap-4 active:scale-95 transition-all outline-hidden hover:bg-surface-container-high transition-colors"
        >
          <div className="bg-primary/5 p-3 rounded-2xl text-primary">
            <Edit3 className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="block text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{t('scan.noCameraLabel')}</span>
            <span className="font-display font-bold text-lg text-primary">{t('scan.manualCard')}</span>
          </div>
        </button>
      </div>

      {showManualForm && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface rounded-[2.5rem] shadow-2xl p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-xl text-primary">{t('scan.manualFormTitle')}</h2>
              <button
                onClick={() => { setShowManualForm(false); setManualError(''); }}
                className="p-2 rounded-full hover:bg-surface-container-high transition-all outline-hidden"
              >
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder={t('scan.namePlaceholder')}
                value={manualContact.name}
                onChange={(e) => setManualContact({ ...manualContact, name: e.target.value })}
                className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
              />
              <input
                type="text"
                placeholder={t('scan.rolePlaceholder')}
                value={manualContact.role}
                onChange={(e) => setManualContact({ ...manualContact, role: e.target.value })}
                className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
              />
              <input
                type="text"
                placeholder={t('scan.companyPlaceholder')}
                value={manualContact.company}
                onChange={(e) => setManualContact({ ...manualContact, company: e.target.value })}
                className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
              />
              <input
                type="text"
                placeholder={t('scan.cityPlaceholder')}
                value={manualContact.location}
                onChange={(e) => setManualContact({ ...manualContact, location: e.target.value })}
                className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary"
              />
              <textarea
                placeholder={t('scan.notePlaceholder')}
                rows={2}
                value={manualContact.note}
                onChange={(e) => setManualContact({ ...manualContact, note: e.target.value })}
                className="w-full bg-surface-container-low border border-outline/10 p-4 rounded-xl text-sm focus:outline-hidden focus:border-primary resize-none"
              />
            </div>

            {manualError && <p className="text-[10px] font-bold text-error text-center">{manualError}</p>}

            <button
              onClick={handleSaveManualContact}
              disabled={!manualContact.name.trim() || isSavingManual}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSavingManual && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSavingManual ? t('scan.saving') : t('scan.saveContact')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-12 flex items-center gap-2 bg-secondary-container/20 px-4 py-2 rounded-full border border-secondary/10">
        <Sparkles className="w-3.5 h-3.5 text-secondary" />
        <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">{t('scan.footerBadge')}</span>
      </div>
    </div>
  );
}
