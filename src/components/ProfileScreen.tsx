import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, Share, Globe, Link2, MessageCircle, Settings, 
  ChevronRight, Building2, User, CheckCircle2, Radio, 
  ChevronDown, Mail, Phone, MapPin, Sparkles, Users, Zap, Cake,
  ChevronLeft, Camera, Edit2, Save, X, RefreshCcw, Lock, ShieldCheck, Edit3
} from 'lucide-react';
import { where } from 'firebase/firestore';
import { Contact, Task, ServicePost } from '../types';
import { localDataService } from '../services/localDataService';
import { auth, saveUserData, uploadAvatarIfNeeded } from '../services/firebaseService';
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
  profileData: any,
  onUpdateProfile: (data: any) => void
}) {
  const isIndividual = activeProfile === 'individual';
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState(profileData || {});
  
  // Initialize birthday parts
  const initialBirthday = profileData?.birthday?.split('-') || ['04', '28'];
  const [birthMonth, setBirthMonth] = useState(initialBirthday[0]);
  const [birthDay, setBirthDay] = useState(initialBirthday[1]);
  
  const [privacyMode, setPrivacyMode] = useState(profileData?.privacyMode || 'public');

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

  const formattedBirthday = profileData?.birthday 
    ? (() => {
        const [month, day] = profileData.birthday.split('-');
        const monthNames = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return `${parseInt(day)} de ${monthNames[parseInt(month) - 1]}`;
      })()
    : '28 de Abril';

  const handleSave = async () => {
    try {
      setLoading(true);
      const avatarUrl = await uploadAvatarIfNeeded(`avatars/${profileData.uid}`, editForm.avatar);
      const updatedData = {
        ...editForm,
        avatar: avatarUrl,
        privacyMode,
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

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

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
          Perfil Personal
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
          Perfil Corporativo
        </button>
      </div>

      {/* Hero Section: Digital Business Card */}
      <section className="relative group">
        {/* Completion Indicator */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 w-full max-w-[200px]">
          <div className="flex justify-between w-full px-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-primary/40 bg-surface px-2 py-0.5 rounded-full">Progreso del Perfil</span>
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
              className="p-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 hover:bg-white/20 transition-all active:scale-95 outline-hidden"
            >
              {isEditing ? <ChevronLeft className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </button>
          </div>

          {/* Type Badge */}
          <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
            {isIndividual ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
            <span className="text-[9px] font-bold uppercase tracking-widest tracking-[0.2em]">
              {isIndividual ? 'Socio' : 'Compañía'}
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
                <label className="absolute -bottom-2 -right-2 bg-secondary text-white p-3 rounded-2xl shadow-lg cursor-pointer hover:scale-110 transition-all border-4 border-white">
                  <Camera className="w-5 h-5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
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
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Tipo de Perfil</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setEditForm({ ...editForm, profileType: 'individual' })}
                      className={`py-2.5 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all ${editForm.profileType === 'individual' ? 'bg-white text-primary border-white' : 'bg-white/10 border-white/20 text-white'}`}
                    >
                      Personal
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditForm({ ...editForm, profileType: 'company' })}
                      className={`py-2.5 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all ${editForm.profileType === 'company' ? 'bg-white text-primary border-white' : 'bg-white/10 border-white/20 text-white'}`}
                    >
                      Empresa
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">
                    {editForm.profileType === 'company' ? 'Nombre de la Empresa' : 'Nombre Completo'}
                  </label>
                  <input 
                    type="text"
                    placeholder="Ej: GE Petrol S.A."
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                  />
                </div>

                {editForm.profileType === 'company' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Sector Industrial</label>
                      <select 
                        value={['Energía', 'Agricultura', 'Banca', 'Construcción', 'Telecomunicaciones', 'Tecnología', 'Servicios'].includes(editForm.profession || '') ? editForm.profession : (editForm.profession ? 'Otro' : 'Energía')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditForm({ ...editForm, profession: val === 'Otro' ? '' : val });
                        }}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:bg-white/20 outline-hidden font-bold appearance-none"
                      >
                        <option value="Energía" className="text-primary">Energía y Petróleo</option>
                        <option value="Agricultura" className="text-primary">Agricultura y Pesca</option>
                        <option value="Banca" className="text-primary">Banca y Finanzas</option>
                        <option value="Construcción" className="text-primary">Construcción</option>
                        <option value="Telecomunicaciones" className="text-primary">Telecomunicaciones</option>
                        <option value="Tecnología" className="text-primary">Tecnología y Software</option>
                        <option value="Servicios" className="text-primary">Servicios Profesionales</option>
                        <option value="Otro" className="text-primary">Otro / Manual...</option>
                      </select>
                      {!['Energía', 'Agricultura', 'Banca', 'Construcción', 'Telecomunicaciones', 'Tecnología', 'Servicios'].includes(editForm.profession || '') && (
                        <input 
                          type="text"
                          placeholder="Especificar sector..."
                          value={editForm.profession || ''}
                          onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                          className="mt-2 w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                        />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Empleados</label>
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
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Trayectoria</label>
                        <select 
                          value={editForm.yearsInMarket || '0-2'}
                          onChange={(e) => setEditForm({ ...editForm, yearsInMarket: e.target.value })}
                          className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white focus:bg-white/20 outline-hidden font-bold appearance-none text-xs"
                        >
                          <option value="0-2" className="text-primary">0-2 años</option>
                          <option value="2-5" className="text-primary">2-5 años</option>
                          <option value="5-10" className="text-primary">5-10 años</option>
                          <option value="10+" className="text-primary">10+ años</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Sitio Web Corporativo</label>
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
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Especialidad / Cargo</label>
                      <input 
                        type="text"
                        placeholder="Ej: Director Comercial"
                        value={editForm.profession || ''}
                        onChange={(e) => setEditForm({ ...editForm, profession: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Fecha de Cumpleaños</label>
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          placeholder="DD"
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
                          {months.map((m, i) => (
                            <option key={m} value={(i + 1).toString().padStart(2, '0')} className="text-primary">{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Ciudad Principal</label>
                    <input 
                      type="text"
                      placeholder="Ciudad"
                      value={editForm.city || ''}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Teléfono Directo</label>
                    <input 
                      type="tel"
                      placeholder="+240 ..."
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/40 focus:bg-white/20 outline-hidden font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1 flex items-center justify-between">
                    Visibilidad en la Red
                  </label>
                  <div className="flex bg-white/10 p-1 rounded-xl gap-1">
                    {(['public', 'network', 'private'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPrivacyMode(mode)}
                        className={`flex-1 py-2 rounded-lg font-bold text-[9px] uppercase tracking-tighter transition-all ${privacyMode === mode ? 'bg-white text-primary' : 'text-white/40'}`}
                      >
                        {mode === 'public' ? 'Público' : mode === 'network' ? 'Mi Red' : 'Privado'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-white/10">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1 flex items-center justify-between pt-3">
                    <span>Soy Inversionista</span>
                    <button
                      onClick={() => setEditForm({ ...editForm, isInvestor: !editForm.isInvestor })}
                      className={`w-11 h-6 rounded-full transition-all relative ${editForm.isInvestor ? 'bg-amber-400' : 'bg-white/20'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${editForm.isInvestor ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </label>

                  {editForm.isInvestor && (
                    <div className="space-y-3 bg-white/5 rounded-2xl p-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Sectores de Interés</label>
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
                          <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Rango de Ticket</label>
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
                          <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Etapa Preferida</label>
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
                        <label className="text-[9px] font-black uppercase tracking-widest text-white/50 ml-1">Sobre tu Tesis de Inversión</label>
                        <textarea
                          placeholder="¿Qué tipo de proyectos buscas?"
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
                    Guardar
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-2 mb-1.5 px-4">
                    <h2 className="text-3xl font-black font-display tracking-tight leading-tight text-white">
                      {isIndividual ? (profileData?.name || 'Bernardino Edu') : (profileData?.name || 'GE Petrol')}
                    </h2>
                    {!isIndividual && <CheckCircle2 className="w-5 h-5 text-secondary" />}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-white/70 font-sans text-sm tracking-wide px-6">
                      {isIndividual 
                        ? (profileData?.profession || 'Especialista') 
                        : (profileData?.profession || 'Sector Industrial')}
                    </p>
                    {isIndividual && profileData?.role && (
                      <p className="text-[10px] text-secondary font-black uppercase tracking-widest opacity-80">
                        {profileData.role}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${profileData?.privacyMode === 'private' ? 'bg-red-500/20 text-red-100' : 'bg-green-500/20 text-green-100'}`}>
                        {profileData?.privacyMode === 'private' ? 'Modo Invisible' : 'Visibilidad Pública'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 w-full px-4">
                  <button className="flex-1 bg-white text-primary py-4 rounded-2xl font-black text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-black/10 uppercase tracking-widest">
                    <Radio className="w-4 h-4 animate-pulse text-secondary" />
                    Compartir Red
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md p-4 rounded-2xl active:scale-95 transition-all outline-hidden border border-white/20 text-white">
                    <Share className="w-5 h-5" />
                  </button>
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
            Conexiones
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
            {isIndividual ? 'Tareas' : 'Anuncios'}
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
          Logros y Reconocimientos
        </h3>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
          {[
            { label: 'Pionero', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Conectado', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Empresario', icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Activo', icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
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
            {isIndividual ? 'Detalles de contacto' : 'Información de Enlace'}
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
                {[
                  { 
                    icon: Phone, 
                    label: 'Teléfono', 
                    value: isIndividual ? (profileData?.phone || '+240 222 123 456') : '+240 333 456 789', 
                    color: 'bg-secondary/5 text-secondary' 
                  },
                  { 
                    icon: MapPin, 
                    label: 'Ciudad / Ubicación', 
                    value: isIndividual ? (profileData?.city || 'Malabo II, Torre K') : 'Carretera del Aeropuerto, Malabo', 
                    color: 'bg-secondary/5 text-secondary' 
                  },
                  { 
                    icon: isIndividual ? Cake : Sparkles, 
                    label: isIndividual ? 'Cumpleaños' : 'Trayectoria', 
                    value: isIndividual ? formattedBirthday : (profileData?.yearsInMarket ? `${profileData.yearsInMarket} años` : '10+ años'), 
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
            {isIndividual ? 'Presencia Digital' : 'Información Corporativa'}
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
                    label: isIndividual ? 'Portfolio' : 'Sitio Web',
                    value: isIndividual ? (profileData?.portfolio || 'Sin portfolio añadido') : (profileData?.website || 'No especificado'),
                    color: 'bg-primary/5 text-primary'
                  },
                  {
                    icon: Users,
                    label: isIndividual ? 'Red' : 'Empleados',
                    value: isIndividual ? `${myContacts.length} Conexiones` : (profileData?.employees || 'No especificado'),
                    color: 'bg-primary/5 text-primary'
                  },
                  {
                    icon: Link2,
                    label: isIndividual ? 'LinkedIn' : 'Trayectoria',
                    value: isIndividual ? (profileData?.linkedin || 'Sin enlace añadido') : (profileData?.yearsInMarket ? `${profileData.yearsInMarket} años` : 'No especificado'),
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
              <p className="font-bold text-on-surface">Configuración</p>
              <p className="text-xs text-on-surface-variant">Gestione sus preferencias y datos locales</p>
            </div>
            <Settings className="w-5 h-5 text-primary" />
          </button>
          
          <button className="w-full text-center py-4 text-primary font-bold hover:bg-white/80 rounded-2xl transition-colors uppercase tracking-widest text-[10px] outline-hidden">
            {isIndividual ? 'Descargar Mi Datos CSV' : 'Panel de Control de Empresa'}
          </button>
        </div>
      </section>
    </div>
  );
}
