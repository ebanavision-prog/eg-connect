import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, Share, Globe, Link2, MessageCircle, Settings, 
  ChevronRight, Building2, User, CheckCircle2, Radio, 
  ChevronDown, Mail, Phone, MapPin, Sparkles, Users, Zap, Cake,
  ChevronLeft, Camera, Edit2, Save, X, RefreshCcw, Lock, ShieldCheck, Edit3,
  Download, Trash2, AlertTriangle
} from 'lucide-react';
import { where } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Contact, Task, ServicePost, UserProfile } from '../types';
import { auth, saveUserData, uploadAvatarIfNeeded, exportAllUserData, deleteAccount, createCompany } from '../services/firebaseService';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import NetworkBackground from './NetworkBackground';

export default function ProfileScreen({ 
  onSettings, 
  activeProfile, 
  onToggleProfile,
  profileData,
  onUpdateProfile
}: { 
  onSettings: () => void,
  activeProfile: 'individual' | 'company',
  onToggleProfile: (profile: 'individual' | 'company') => void,
  profileData: UserProfile,
  onUpdateProfile: (data: any) => void
}) {
  const { t } = useTranslation();
  const isIndividual = activeProfile === 'individual';
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  // `|| {}` es un resguardo defensivo heredado — profileData es un prop
  // requerido, así que en la práctica siempre llega con datos reales. Se tipa
  // como `Partial<UserProfile>` (en vez de forzar `UserProfile`) precisamente
  // para reflejar con honestidad que ese resguardo existe.
  const [editForm, setEditForm] = useState<Partial<UserProfile>>(profileData || {});
  
  // Initialize birthday parts
  const initialBirthday = profileData?.birthday?.split('-') || ['04', '28'];
  const [birthMonth, setBirthMonth] = useState(initialBirthday[0]);
  const [birthDay, setBirthDay] = useState(initialBirthday[1]);
  
  const [privacyMode, setPrivacyMode] = useState(profileData?.privacyMode || 'public');
  const [shareFeedback, setShareFeedback] = useState('');

  // Exportación completa de datos y borrado de cuenta (privacidad real: hoy
  // la app guarda cumpleaños, teléfono y ubicación GPS opt-in de una persona
  // sin ninguna vía de que esa persona los descargue todos o borre su cuenta).
  const [exportingAllData, setExportingAllData] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteConfirmWord = t('profile.deleteConfirmWord');

  // Estadísticas reales — antes esta sección mostraba números y nombres de
  // dominio inventados ("1.2k Conexiones", "adriant.design") para cualquier
  // perfil, sin relación con el usuario real.
  const currentUid = auth.currentUser?.uid;
  const { data: myContacts } = useFirestoreCollection<Contact>(currentUid ? `users/${currentUid}/contacts` : null);
  const { data: myTasks } = useFirestoreCollection<Task>(currentUid && isIndividual ? `users/${currentUid}/tasks` : null);
  const marketplaceConstraints = useMemo(
    () => (currentUid ? [where('authorId', '==', currentUid)] : []),
    [currentUid]
  );
  const { data: myPosts } = useFirestoreCollection<ServicePost>(currentUid && !isIndividual ? 'marketplace_posts' : null, marketplaceConstraints);

  const [expandedSections, setExpandedSections] = useState({
    contact: true,
    digital: true
  });

  // Antes, sin cumpleaños guardado, esta tarjeta mostraba "28 de Abril" como si
  // fuera el dato real del usuario — una fecha inventada haciéndose pasar por
  // un hecho sobre su propio perfil. Ahora es un estado vacío honesto.
  const months = t('profile.months', { returnObjects: true }) as string[];

  const formattedBirthday = profileData?.birthday
    ? (() => {
        const [month, day] = profileData.birthday.split('-');
        return t('profile.birthdayFormat', { day: parseInt(day), month: months[parseInt(month) - 1] });
      })()
    : t('profile.undefinedFallback');

  const handleSave = async () => {
    try {
      setLoading(true);
      const avatarUrl = await uploadAvatarIfNeeded(`avatars/${profileData.uid}`, editForm.avatar);
      // Enlace hacia adelante (ver docs/PLAN_MEJORA_360.md sección 3/7 Fase 2:
      // `companies` es la entidad canónica): si el usuario marca su perfil
      // como 'company' y todavía no tiene un companyId, creamos aquí mismo el
      // doc canónico en `companies/` a partir de los datos que ya tiene en su
      // perfil -- así "marcar company en mi perfil" y "registrar empresa" en
      // CompaniesScreen terminan siempre en el mismo sitio. Si ya tiene
      // companyId (de un registro anterior en CompaniesScreen, o de una
      // ejecución previa de este mismo guardado), no se crea uno nuevo.
      let companyId = profileData.companyId;
      if (editForm.profileType === 'company' && !companyId) {
        companyId = await createCompany(profileData.uid, {
          name: editForm.name || '',
          // Valor de dato, no texto de UI -- 'Servicios' es una opción real
          // del desplegable de industria en CompaniesScreen.tsx (igual criterio
          // que scripts/migrate-company-model.mjs), no la etiqueta de UI
          // "Otro / Manual..." de t('profile.sectorOther').
          industry: editForm.profession || 'Servicios',
          description: '',
          location: editForm.city || '',
          employees: editForm.employees || '1-10',
          yearsInMarket: editForm.yearsInMarket || '0-2',
          website: editForm.website || '',
          logo: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(editForm.name || '')}&background=045C68&color=fff&size=256`,
          tags: editForm.profession ? [editForm.profession] : [],
          social: { website: editForm.website || '' }
        });
      }
      const updatedData = {
        ...editForm,
        avatar: avatarUrl,
        privacyMode,
        companyId: editForm.profileType === 'company' ? companyId : editForm.companyId,
        birthday: editForm.profileType === 'individual' ? `${birthMonth}-${birthDay.padStart(2, '0')}` : ''
      };
      await saveUserData(profileData.uid, updatedData);
      onUpdateProfile(updatedData);
      // Ensure the app shell stays in sync with profile type
      if (updatedData.profileType !== activeProfile) {
        onToggleProfile(updatedData.profileType);
      }
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({ ...editForm, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleSection = (section: 'contact' | 'digital') => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // "Compartir Red" y el botón de Share no tenían onClick — no hacían nada.
  const handleShareProfile = () => {
    const shareData = {
      title: profileData?.name || t('profile.defaultShareTitle'),
      text: `${t('profile.shareTextBase', { name: profileData?.name || t('profile.myProfileFallback') })}${profileData?.profession ? ` — ${profileData.profession}` : ''}`,
      url: window.location.origin
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`).then(() => {
        setShareFeedback(t('profile.linkCopiedFeedback'));
        setTimeout(() => setShareFeedback(''), 2500);
      });
    }
  };

  // "Descargar Mis Datos CSV" no tenía onClick. Exporta los contactos reales
  // ya cargados (myContacts) — nada inventado, es la misma data del CRM.
  const handleExportContactsCsv = () => {
    const headers = [
      t('profile.csvHeaderName'), t('profile.csvHeaderRole'), t('profile.csvHeaderCompany'),
      t('profile.csvHeaderLocation'), t('profile.csvHeaderCrmStatus'), t('profile.csvHeaderLastContact'),
      t('profile.csvHeaderNotes')
    ];
    const rows = myContacts.map((c) => [
      c.name, c.role, c.company, c.location, c.crmStatus || 'Prospecto', c.lastMet, (c.note || '').replace(/\s+/g, ' ')
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eg-connect-contactos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exporta TODOS los datos del usuario (perfil + contactos + tareas) a un
  // único archivo JSON descargable — a diferencia del CSV de contactos de
  // arriba, que es una exportación más específica y complementaria.
  const handleExportAllData = async () => {
    if (!currentUid) return;
    try {
      setExportingAllData(true);
      const data = await exportAllUserData(currentUid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `eg-connect-mis-datos-${currentUid}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando todos los datos:', error);
    } finally {
      setExportingAllData(false);
    }
  };

  // Borrado real de cuenta, con confirmación explícita (escribir la palabra
  // de confirmación). Tras un borrado exitoso no navegamos a mano a ningún
  // lado: deleteAccount() ya cierra la sesión de Firebase Auth, y el
  // onAuthStateChanged existente en App.tsx detecta user == null y hace la
  // transición a Onboarding por su cuenta — duplicar esa lógica aquí solo
  // daría pie a que se desincronicen.
  const handleDeleteAccount = async () => {
    if (!currentUid || deleteConfirmText !== deleteConfirmWord) return;
    try {
      setDeletingAccount(true);
      setDeleteError(null);
      await deleteAccount(currentUid);
      // Respaldo: si por algún camino la sesión local no se hubiera cerrado
      // ya sola tras deleteUser(), esto la fuerza. Inofensivo si ya no hay
      // sesión activa.
      await auth.signOut().catch(() => {});
    } catch (error: any) {
      console.error('Error borrando cuenta:', error);
      setDeleteError(
        error?.code === 'auth/requires-recent-login'
          ? t('profile.deleteErrorRequiresRecentLogin')
          : t('profile.deleteErrorGeneric')
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  // Profile completeness calculation
  const getCompleteness = () => {
    if (!profileData) return 40;
    let score = 40;
    if (profileData.name) score += 10;
    if (profileData.phone) score += 10;
    if (profileData.birthday) score += 10;
    if (profileData.profession) score += 10;
    if (profileData.city) score += 10;
    if (profileData.role) score += 10;
    return Math.min(score, 100);
  };

  const completeness = getCompleteness();

  return (
    <div className="py-6 space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Profile Switcher Tabs */}
      <div className="flex bg-surface-container-low p-1.5 rounded-2xl border border-outline/5 shadow-sm mx-1">
        <button 
          onClick={() => onToggleProfile('individual')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-300 ${
            isIndividual 
              ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' 
              : 'text-on-surface-variant opacity-60 hover:opacity-100'
          }`}
        >
          <User className="w-4 h-4" />
          {t('profile.tabPersonal')}
        </button>
        <button
          onClick={() => onToggleProfile('company')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all duration-300 ${
            !isIndividual
              ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-on-surface-variant opacity-60 hover:opacity-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          {t('profile.tabCompany')}
        </button>
      </div>

      {/* Hero Section: Digital Business Card */}
      <section className="relative group">
        {/* Completion Indicator */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 w-full max-w-[200px]">
          <div className="flex justify-between w-full px-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-primary/40 bg-surface px-2 py-0.5 rounded-full">{t('profile.progressLabel')}</span>
            <span className="text-[8px] font-black text-secondary bg-surface px-2 py-0.5 rounded-full">{completeness}%</span>
          </div>
          <div className="w-full h-1 bg-primary/5 rounded-full overflow-hidden border border-white shadow-sm">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${completeness}%` }}
              className="h-full bg-secondary"
            />
          </div>
        </div>

        <motion.div 
          layout
          key={activeProfile}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={`rounded-[3rem] p-8 text-white shadow-2xl overflow-hidden relative min-h-[420px] flex flex-col items-center justify-center transition-colors duration-700 ${
          isIndividual 
            ? 'bg-gradient-to-br from-primary via-primary-container to-[#1b1b21]' 
            : 'bg-gradient-to-br from-[#0c1c3d] via-[#1a365d] to-[#2a4365]'
        }`}>
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-secondary-container opacity-10 blur-3xl rounded-full" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-primary opacity-20 blur-3xl rounded-full" />
          <NetworkBackground color="rgba(255, 255, 255, 0.05)" />

          <div className="absolute top-8 left-8">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/20 transition-all active:scale-95 focus-ring-inverse"
              aria-label={isEditing ? t('profile.closeEditAria') : t('profile.editProfileAria')}
            >
              {isEditing ? <ChevronLeft className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </button>
          </div>

          {/* Type Badge */}
          <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
            {isIndividual ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
            <span className="text-[9px] font-bold uppercase tracking-widest tracking-[0.2em]">
              {isIndividual ? t('profile.badgeIndividual') : t('profile.badgeCompany')}
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center w-full">
            <div className="bg-white p-4 rounded-[2.5rem] shadow-xl mb-7 relative group border-4 border-white/20">
              <img 
                src={isEditing ? editForm.avatar : (isIndividual
                  ? (profileData?.avatar || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop")
                  : (profileData?.avatar || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=400&fit=crop"))
                }
                alt="Avatar" 
                className="w-36 h-36 rounded-3xl object-cover"
                referrerPolicy="no-referrer"
              />
              {isEditing ? (
                <label className="absolute -bottom-2 -right-2 bg-secondary text-white p-3 rounded-2xl shadow-lg cursor-pointer hover:scale-110 transition-all border-4 border-white focus-within:ring-2 focus-within:ring-white/80 focus-within:ring-offset-2 focus-within:ring-offset-primary">
                  <Camera className="w-5 h-5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} aria-label={t('profile.uploadPhotoAria')} />
                </label>
              ) : (
                <div className="absolute -bottom-2 -right-2 bg-secondary text-white p-2.5 rounded-xl shadow-lg border-2 border-white">
                  <QrCode className="w-5 h-5" />
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="w-full max-w-sm space-y-4 px-4 h-[400px] overflow-y-auto no-scrollbar py-4 bg-white/5 rounded-[2rem] backdrop-blur-md">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.profileTypeLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, profileType: 'individual' })}
                      className={`py-2.5 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all ${editForm.profileType === 'individual' ? 'bg-white text-primary border-white' : 'bg-white/10 border-white/20 text-white'}`}
                    >
                      {t('common.profileTypePersonal')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, profileType: 'company' })}
                      className={`py-2.5 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all ${editForm.profileType === 'company' ? 'bg-white text-primary border-white' : 'bg-white/10 border-white/20 text-white'}`}
                    >
                      {t('common.profileTypeCompany')}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">
                    {editForm.profileType === 'company' ? t('profile.companyNameLabel') : t('profile.fullNameLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('profile.namePlaceholder')}
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                  />
                </div>

                {editForm.profileType === 'company' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.industrySectorLabel')}</label>
                      <select
                        value={['Energía', 'Agricultura', 'Banca', 'Construcción', 'Telecomunicaciones', 'Tecnología', 'Servicios'].includes(editForm.profession || '') ? editForm.profession : (editForm.profession ? 'Otro' : 'Energía')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditForm({ ...editForm, profession: val === 'Otro' ? '' : val });
                        }}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:bg-white/20 outline-hidden font-bold appearance-none"
                      >
                        <option value="Energía" className="text-primary">{t('profile.sectorEnergy')}</option>
                        <option value="Agricultura" className="text-primary">{t('profile.sectorAgriculture')}</option>
                        <option value="Banca" className="text-primary">{t('profile.sectorBanking')}</option>
                        <option value="Construcción" className="text-primary">{t('profile.sectorConstruction')}</option>
                        <option value="Telecomunicaciones" className="text-primary">{t('profile.sectorTelecom')}</option>
                        <option value="Tecnología" className="text-primary">{t('profile.sectorTech')}</option>
                        <option value="Servicios" className="text-primary">{t('profile.sectorServices')}</option>
                        <option value="Otro" className="text-primary">{t('profile.sectorOther')}</option>
                      </select>
                      {!['Energía', 'Agricultura', 'Banca', 'Construcción', 'Telecomunicaciones', 'Tecnología', 'Servicios'].includes(editForm.profession || '') && (
                        <input
                          type="text"
                          placeholder={t('profile.specifySectorPlaceholder')}
                          value={editForm.profession || ''}
                          onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                          className="mt-2 w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.employeesLabel')}</label>
                        <select
                          value={editForm.employees || '1-10'}
                          onChange={(e) => setEditForm({ ...editForm, employees: e.target.value })}
                          className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:bg-white/20 outline-hidden font-bold appearance-none text-xs"
                        >
                          <option value="1-10" className="text-primary">1-10</option>
                          <option value="10-50" className="text-primary">10-50</option>
                          <option value="50-200" className="text-primary">50-200</option>
                          <option value="200+" className="text-primary">200+</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.trajectoryLabel')}</label>
                        <select
                          value={editForm.yearsInMarket || '0-2'}
                          onChange={(e) => setEditForm({ ...editForm, yearsInMarket: e.target.value })}
                          className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:bg-white/20 outline-hidden font-bold appearance-none text-xs"
                        >
                          <option value="0-2" className="text-primary">{t('profile.trajectoryOption0to2')}</option>
                          <option value="2-5" className="text-primary">{t('profile.trajectoryOption2to5')}</option>
                          <option value="5-10" className="text-primary">{t('profile.trajectoryOption5to10')}</option>
                          <option value="10+" className="text-primary">{t('profile.trajectoryOption10plus')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.corporateWebsiteLabel')}</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={editForm.website || ''}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.specialtyRoleLabel')}</label>
                      <input
                        type="text"
                        placeholder={t('profile.specialtyPlaceholder')}
                        value={editForm.profession || ''}
                        onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.birthdayDateLabel')}</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder={t('profile.dayPlaceholder')}
                          min="1"
                          max="31"
                          value={birthDay}
                          onChange={(e) => setBirthDay(e.target.value)}
                          className="w-20 bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white text-center focus:bg-white/20 outline-hidden font-bold"
                        />
                        <select
                          value={birthMonth}
                          onChange={(e) => setBirthMonth(e.target.value)}
                          className="flex-1 bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:bg-white/20 outline-hidden font-bold appearance-none"
                        >
                          {months.map((m: string, i: number) => (
                            <option key={m} value={(i + 1).toString().padStart(2, '0')} className="text-primary">{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.mainCityLabel')}</label>
                    <input
                      type="text"
                      placeholder={t('profile.cityPlaceholder')}
                      value={editForm.city || ''}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.directPhoneLabel')}</label>
                    <input
                      type="tel"
                      placeholder={t('profile.phonePlaceholder')}
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1 flex items-center justify-between">
                    {t('profile.networkVisibilityLabel')}
                  </label>
                  <div className="flex bg-white/10 p-1 rounded-xl gap-1">
                    {(['public', 'network', 'private'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPrivacyMode(mode)}
                        className={`flex-1 py-2 rounded-lg font-bold text-[9px] uppercase tracking-tighter transition-all ${privacyMode === mode ? 'bg-white text-primary' : 'text-white/40'}`}
                      >
                        {mode === 'public' ? t('profile.privacyPublic') : mode === 'network' ? t('profile.privacyNetwork') : t('profile.privacyPrivate')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-white/10">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1 flex items-center justify-between pt-3">
                    <span>{t('profile.isInvestorLabel')}</span>
                    <button
                      onClick={() => setEditForm({ ...editForm, isInvestor: !editForm.isInvestor })}
                      className={`w-11 h-6 rounded-full transition-all relative focus-ring-inverse ${editForm.isInvestor ? 'bg-amber-400' : 'bg-white/20'}`}
                      role="switch"
                      aria-checked={!!editForm.isInvestor}
                      aria-label={t('profile.isInvestorLabel')}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${editForm.isInvestor ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </label>

                  {editForm.isInvestor && (
                    <div className="space-y-3 bg-white/5 rounded-2xl p-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.sectorsOfInterestLabel')}</label>
                        {/* Estos valores se guardan tal cual en Firestore (investorSectors)
                            y se comparan por igualdad exacta -- se dejan en español sin
                            traducir, igual que TENDER_CATEGORIES en TendersScreen.tsx. */}
                        <div className="flex flex-wrap gap-2">
                          {['Tecnología', 'Agricultura', 'Educación', 'Salud', 'Comercio', 'Energía', 'Turismo'].map((sector) => {
                            const selected = (editForm.investorSectors || []).includes(sector);
                            return (
                              <button
                                key={sector}
                                type="button"
                                onClick={() => {
                                  const current = editForm.investorSectors || [];
                                  setEditForm({
                                    ...editForm,
                                    investorSectors: selected ? current.filter((s: string) => s !== sector) : [...current, sector]
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${selected ? 'bg-amber-400 text-primary' : 'bg-white/10 text-white/60'}`}
                              >
                                {sector}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.ticketRangeLabel')}</label>
                          {/* Valores persistidos tal cual en Firestore (investorTicketRange);
                              no contienen palabras en español que traducir (solo cifras/USD). */}
                          <select
                            value={editForm.investorTicketRange || '5.000 - 25.000 USD'}
                            onChange={(e) => setEditForm({ ...editForm, investorTicketRange: e.target.value })}
                            className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-3 text-white focus:bg-white/20 outline-hidden font-bold appearance-none text-xs"
                          >
                            <option value="< 5.000 USD" className="text-primary">&lt; 5.000 USD</option>
                            <option value="5.000 - 25.000 USD" className="text-primary">5.000 - 25.000 USD</option>
                            <option value="25.000 - 100.000 USD" className="text-primary">25.000 - 100.000 USD</option>
                            <option value="100.000+ USD" className="text-primary">100.000+ USD</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.investmentStageLabel')}</label>
                          {/* Valores persistidos tal cual en Firestore (investorStage) -- se
                              dejan en español sin traducir, igual que TENDER_CATEGORIES. */}
                          <select
                            value={editForm.investorStage || 'Idea / Semilla'}
                            onChange={(e) => setEditForm({ ...editForm, investorStage: e.target.value })}
                            className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-3 text-white focus:bg-white/20 outline-hidden font-bold appearance-none text-xs"
                          >
                            <option value="Idea / Semilla" className="text-primary">Idea / Semilla</option>
                            <option value="Operando" className="text-primary">Operando</option>
                            <option value="En Crecimiento" className="text-primary">En Crecimiento</option>
                            <option value="Cualquier etapa" className="text-primary">Cualquier etapa</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">{t('profile.investmentThesisLabel')}</label>
                        <textarea
                          placeholder={t('profile.investmentThesisPlaceholder')}
                          rows={2}
                          value={editForm.investorBio || ''}
                          onChange={(e) => setEditForm({ ...editForm, investorBio: e.target.value })}
                          className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold resize-none text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4 pb-6">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex-1 bg-secondary text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-secondary/20"
                  >
                    {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('profile.saveButton')}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    {t('profile.cancelButton')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-2 mb-1.5 px-4">
                    {/* Antes usaba "Bernardino Edu"/"GE Petrol" como respaldo — nombres
                        inventados que se mostraban como si fueran el nombre real del
                        usuario en su propia tarjeta de perfil (el mismo "Bernardino Edu"
                        que ya se había señalado como autor inventado en FeedItem.tsx). */}
                    <h2 className="text-3xl font-black font-display tracking-tight leading-tight text-white">
                      {profileData?.name || (isIndividual ? t('profile.nameFallbackIndividual') : t('profile.nameFallbackCompany'))}
                    </h2>
                    {!isIndividual && <CheckCircle2 className="w-5 h-5 text-secondary" />}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-white/70 font-sans text-sm tracking-wide px-6">
                      {isIndividual
                        ? (profileData?.profession || t('profile.professionFallbackIndividual'))
                        : (profileData?.profession || t('profile.professionFallbackCompany'))}
                    </p>
                    {isIndividual && profileData?.role && (
                      <p className="text-[10px] text-secondary font-black uppercase tracking-widest opacity-80">
                        {profileData.role}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${profileData?.privacyMode === 'private' ? 'bg-red-500/20 text-red-100' : 'bg-green-500/20 text-green-100'}`}>
                        {profileData?.privacyMode === 'private' ? t('profile.invisibleModeBadge') : t('profile.publicVisibilityBadge')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 w-full px-4 relative">
                  <button onClick={handleShareProfile} className="flex-1 bg-white text-primary py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-black/10 uppercase tracking-widest">
                    <Radio className="w-4 h-4 animate-pulse text-secondary" />
                    {t('profile.shareNetworkButton')}
                  </button>
                  <button onClick={handleShareProfile} className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-4 rounded-2xl active:scale-95 transition-all focus-ring-inverse border border-white/20 text-white" aria-label={t('profile.shareProfileIconAria')}>
                    <Share className="w-5 h-5" />
                  </button>
                  <AnimatePresence>
                    {shareFeedback && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-white text-primary text-[10px] font-bold rounded-lg whitespace-nowrap shadow-lg"
                      >
                        {shareFeedback}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </section>

      {/* Networking Stats */}
      <section className="grid grid-cols-2 gap-4">
        <motion.div 
          layout
          className="editorial-card p-6 flex flex-col justify-between h-36 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest opacity-60">
            {t('profile.connectionsLabel')}
          </span>
          <motion.div
            key={`${activeProfile}-stat-1`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-end justify-between"
          >
            <span className="text-4xl font-extrabold text-primary font-display">{myContacts.length}</span>
          </motion.div>
        </motion.div>

        <motion.div
          layout
          className="editorial-card p-6 flex flex-col justify-between h-36 bg-surface-container-low border-none shadow-none"
        >
          <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest opacity-60">
            {isIndividual ? t('profile.tasksLabel') : t('profile.postsLabel')}
          </span>
          <motion.div
            key={`${activeProfile}-stat-2`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-end justify-between"
          >
            <span className="text-4xl font-extrabold text-on-surface font-display">{isIndividual ? myTasks.length : myPosts.length}</span>
            <div className="bg-primary/5 p-2 rounded-lg">
              <Settings className="w-4 h-4 text-primary" />
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Badges / Achievements Section */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold font-display text-on-surface flex items-center gap-2 px-1">
          <div className="w-1 h-6 bg-amber-500 rounded-full" />
          {t('profile.achievementsTitle')}
        </h3>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
          {[
            { label: t('profile.badgePioneer'), icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: t('profile.badgeConnected'), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: t('profile.badgeEntrepreneur'), icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
            { label: t('profile.badgeActive'), icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          ].map((badge, i) => (
            <motion.div 
              key={i}
              whileHover={{ scale: 1.05 }}
              className="flex flex-col items-center gap-2 min-w-[80px]"
            >
              <div className={`w-14 h-14 ${badge.bg} rounded-2xl flex items-center justify-center ${badge.color} border border-current/20 shadow-sm transition-transform`}>
                <badge.icon className="w-7 h-7" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant text-center leading-tight">{badge.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Contact Details Section */}
      <section className="space-y-4">
        <button 
          onClick={() => toggleSection('contact')}
          className="w-full flex items-center justify-between px-1 hover:opacity-80 transition-opacity"
        >
          <h3 className="text-lg font-bold font-display text-on-surface flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            {isIndividual ? t('profile.contactDetailsTitle') : t('profile.linkInfoTitle')}
          </h3>
          <motion.div
            animate={{ rotate: expandedSections.contact ? 0 : -90 }}
            className="text-primary bg-primary/5 p-1 rounded-md"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expandedSections.contact && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="editorial-card p-2 border-none shadow-sm h-full">
                {/* El teléfono/ubicación de empresa antes ignoraban profileData por completo
                    y mostraban siempre el mismo número/dirección de muestra como si fueran
                    reales, aunque el usuario ya hubiera guardado los suyos en "Editar".
                    "Trayectoria" también inventaba "10+ años" de experiencia por defecto. */}
                {[
                  {
                    icon: Phone,
                    label: t('profile.phoneLabel'),
                    value: isIndividual ? (profileData?.phone || t('profile.samplePhoneFallback')) : (profileData?.phone || t('profile.undefinedFallback')),
                    color: 'bg-secondary/5 text-secondary'
                  },
                  {
                    icon: MapPin,
                    label: t('profile.cityLocationLabel'),
                    value: isIndividual ? (profileData?.city || t('profile.sampleCityFallback')) : (profileData?.city || t('profile.undefinedFallback')),
                    color: 'bg-secondary/5 text-secondary'
                  },
                  {
                    icon: isIndividual ? Cake : Sparkles,
                    label: isIndividual ? t('profile.birthdayLabel') : t('profile.trajectoryLabel'),
                    value: isIndividual ? formattedBirthday : (profileData?.yearsInMarket ? t('profile.yearsSuffix', { years: profileData.yearsInMarket }) : t('profile.notSpecifiedFallback')),
                    color: isIndividual ? 'bg-secondary/5 text-secondary' : 'bg-primary/5 text-primary'
                  }
                ].map((item, i) => (
                  <motion.div 
                    layout
                    key={`${activeProfile}-${item.label}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex items-center p-4 hover:bg-surface-container-low transition-colors rounded-2xl cursor-pointer group ${i !== 3 ? 'mb-1' : ''}`}
                  >
                    <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mr-4`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">{item.label}</p>
                      <p className="font-semibold text-primary">{item.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Digital Presence Link Group */}
      <section className="space-y-4">
        <button 
          onClick={() => toggleSection('digital')}
          className="w-full flex items-center justify-between px-1 hover:opacity-80 transition-opacity"
        >
          <h3 className="text-lg font-bold font-display text-on-surface flex items-center gap-2">
            <div className="w-1 h-6 bg-secondary rounded-full" />
            {isIndividual ? t('profile.digitalPresenceTitle') : t('profile.corporateInfoTitle')}
          </h3>
          <motion.div
            animate={{ rotate: expandedSections.digital ? 0 : -90 }}
            className="text-secondary bg-secondary/5 p-1 rounded-md"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </button>

        <AnimatePresence>
          {expandedSections.digital && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="editorial-card p-2 border-none shadow-sm h-full">
                {[
                  {
                    icon: Globe,
                    label: isIndividual ? t('profile.portfolioLabel') : t('profile.websiteLabel'),
                    value: isIndividual ? (profileData?.portfolio || t('profile.noPortfolioFallback')) : (profileData?.website || t('profile.notSpecifiedFallback')),
                    color: 'bg-primary/5 text-primary'
                  },
                  {
                    icon: Users,
                    label: isIndividual ? t('profile.networkLabel') : t('profile.employeesDetailLabel'),
                    value: isIndividual ? t('profile.connectionsCount', { count: myContacts.length }) : (profileData?.employees || t('profile.notSpecifiedFallback')),
                    color: 'bg-primary/5 text-primary'
                  },
                  {
                    icon: Link2,
                    label: isIndividual ? t('profile.linkedinLabel') : t('profile.trajectoryLabel'),
                    value: isIndividual ? (profileData?.linkedin || t('profile.noLinkFallback')) : (profileData?.yearsInMarket ? t('profile.yearsSuffix', { years: profileData.yearsInMarket }) : t('profile.notSpecifiedFallback')),
                    color: 'bg-primary/5 text-primary'
                  }
                ].map((item, i) => (
                  <motion.div 
                    layout
                    key={`${activeProfile}-${item.label}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex items-center p-4 hover:bg-surface-container-low transition-colors rounded-2xl cursor-pointer group ${i !== 1 ? 'mb-1' : ''}`}
                  >
                    <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mr-4`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">{item.label}</p>
                      <p className="font-semibold text-primary">{item.value}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-outline-variant group-hover:translate-x-1 transition-transform" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Settings Action */}
      <section className="pb-10">
        <div className="bg-surface-container-high rounded-[2rem] p-6 space-y-4 shadow-sm border border-white/40">
          <button 
            onClick={onSettings}
            className="w-full flex justify-between items-center p-4 bg-white/50 rounded-2xl hover:bg-white transition-colors outline-hidden text-left"
          >
            <div className="text-left pr-2">
              <p className="font-bold text-on-surface">{t('profile.settingsTitle')}</p>
              <p className="text-xs text-on-surface-variant">{t('profile.settingsSubtitle')}</p>
            </div>
            <Settings className="w-5 h-5 text-primary" />
          </button>
          
          {/* Antes este botón no tenía onClick en ningún caso. Para el perfil personal
              exporta ahora un CSV real de los contactos ya cargados (myContacts). Para
              el corporativo no existe todavía una pantalla de panel de empresa a la que
              enlazar (necesitaría una ruta nueva en App.tsx), así que se marca como
              deshabilitado/"Próximamente" en vez de simular un enlace que no lleva a
              ningún sitio. */}
          {isIndividual ? (
            <button
              onClick={handleExportContactsCsv}
              disabled={myContacts.length === 0}
              className="w-full text-center py-4 text-primary font-bold hover:bg-white/80 rounded-2xl transition-colors uppercase tracking-widest text-[10px] outline-hidden disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {t('profile.downloadCsvButton')}
            </button>
          ) : (
            <button disabled className="w-full text-center py-4 text-on-surface-variant/50 font-bold rounded-2xl uppercase tracking-widest text-[10px] cursor-not-allowed">
              {t('profile.companyDashboardComingSoon')}
            </button>
          )}

          <button
            onClick={handleExportAllData}
            disabled={exportingAllData || !currentUid}
            className="w-full flex items-center justify-center gap-2 py-4 text-primary font-bold hover:bg-white/80 rounded-2xl transition-colors uppercase tracking-widest text-[10px] outline-hidden disabled:opacity-50"
          >
            {exportingAllData ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('profile.exportAllDataButton')}
          </button>
        </div>
      </section>

      {/* Danger Zone: borrado real de cuenta */}
      <section className="pb-10">
        <div className="bg-red-500/5 rounded-[2rem] p-6 space-y-3 shadow-sm border border-red-500/20">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-red-500">{t('profile.dangerZoneTitle')}</h3>
          </div>
          <p className="text-xs text-on-surface-variant px-1">
            {t('profile.dangerZoneDescription')}
          </p>
          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmText('');
              setShowDeleteModal(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-600 font-black rounded-2xl transition-colors uppercase tracking-widest text-[10px] outline-hidden hover:bg-red-500/20 active:scale-95"
          >
            <Trash2 className="w-4 h-4" />
            {t('profile.deleteAccountButton')}
          </button>
        </div>
      </section>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => !deletingAccount && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-surface rounded-[2rem] p-6 space-y-4 shadow-2xl border border-red-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="font-black text-on-surface">{t('profile.deleteModalTitle')}</h3>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingAccount}
                  className="p-1.5 rounded-full hover:bg-surface-container-low transition-colors disabled:opacity-40 focus-ring-custom"
                  aria-label={t('profile.closeDeleteModalAria')}
                >
                  <X className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>

              <p className="text-sm text-on-surface-variant">
                {t('profile.deleteModalDescription')}
              </p>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1">
                  {t('profile.deleteConfirmLabel', { word: deleteConfirmWord })}
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteConfirmWord}
                  disabled={deletingAccount}
                  className="w-full bg-surface-container-low border border-outline/10 rounded-xl py-3 px-4 text-on-surface font-bold outline-hidden focus:border-red-500/40"
                />
              </div>

              {deleteError && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-700">{deleteError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingAccount}
                  className="flex-1 bg-surface-container-low text-on-surface py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                >
                  {t('profile.cancelButton')}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== deleteConfirmWord || deletingAccount}
                  className="flex-1 bg-red-600 text-white py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                >
                  {deletingAccount ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {t('profile.deleteConfirmButton')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
