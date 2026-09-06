import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Shield, Zap, Globe, User, Calendar, Check, Phone, Camera, LogIn, RefreshCcw, Lock, UserPlus, ChevronLeft, Sparkles, Handshake, Rocket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import NetworkBackground from './NetworkBackground';
import Logo from './Logo';
import { auth, loginWithGoogle, saveUserData, getUserData, loginWithUsername, registerWithUsername, resetPassword, uploadAvatarIfNeeded, createCompany } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';

export default function OnboardingScreen({ onComplete }: { onComplete: (data: { uid: string; name: string; phone: string; birthday: string; profession: string; city: string; role: string; avatar: string; profileType: string }) => void }) {
  const { t } = useTranslation();
  // Si llegó por un link de invitación (InviteScreen le añade ?ref=<uid>), se
  // guarda una sola vez al crear la cuenta — es lo que hace real el conteo
  // de "Embajador de Red" en InviteScreen (antes era una promesa sin ningún
  // rastreo detrás).
  const [referredBy] = useState<string | null>(() => new URLSearchParams(window.location.search).get('ref'));
  const [step, setStep] = useState<'welcome' | 'auth' | 'register' | 'forgot-password'>('welcome');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Auth fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [backupEmail, setBackupEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  
  // Registration fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [profession, setProfession] = useState('');
  const [role, setRole] = useState('');
  const [city, setCity] = useState('');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400&h=400&fit=crop');
  const [employees, setEmployees] = useState('1-10');
  const [yearsInMarket, setYearsInMarket] = useState('0-2');
  const [profileType, setProfileType] = useState<'individual' | 'company'>('individual');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // Only handle auto-login if we have a user
      if (user) {
        setLoading(true);
        const existingData = await getUserData(user.uid);
        if (existingData) {
          // If data exists, complete onboarding immediately
          onComplete(existingData as any);
        } else if (step === 'auth') {
          // Only auto-redirect to register if we are already in the auth phase
          // (e.g. after a Google login or if the user is returning to the auth screen)
          setName(user.displayName || '');
          setStep('register');
        }
        setLoading(false);
      }
    });
    return () => unsub();
  }, [step]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true);
    setError('');
    
    try {
      if (authMode === 'login') {
        const user = await loginWithUsername(username, password);
        const data = await getUserData(user.uid);
        if (data) onComplete(data as any);
        else setStep('register');
      } else {
        if (password.length < 8) {
          setError(t('onboarding.auth.errorPasswordLength'));
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError(t('onboarding.auth.errorPasswordMismatch'));
          setLoading(false);
          return;
        }
        setStep('register');
      }
    } catch (err: any) {
      console.error(err);
      setError(t('onboarding.auth.errorInvalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await resetPassword(recoveryEmail);
      setSuccess(t('onboarding.forgotPassword.successMessage'));
    } catch (err: any) {
      console.error(err);
      setError(t('onboarding.forgotPassword.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle();
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
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const months = t('onboarding.months', { returnObjects: true }) as string[];

  // Enlace hacia adelante (ver docs/PLAN_MEJORA_360.md sección 3/7 Fase 2:
  // `companies` es la entidad canónica) -- mismo patrón que ya usan
  // CompaniesScreen.tsx/ProfileScreen.tsx. El registro inicial (este
  // archivo) era el único de los 3 caminos hacia "soy una empresa" que
  // todavía no creaba el doc canónico en companies/ -- por eso una empresa
  // registrada desde el onboarding nunca aparecía en el directorio de
  // Companies. Best-effort: si esto falla, el usuario ya quedó creado de
  // todas formas (lo principal), solo queda sin companyId hasta que edite
  // su perfil de nuevo.
  const linkCompanyIfNeeded = async (uid: string, resolvedName: string, resolvedAvatar: string) => {
    if (profileType !== 'company') return undefined;
    try {
      const newCompanyId = await createCompany(uid, {
        name: resolvedName || '',
        industry: profession || 'Servicios',
        description: '',
        location: city || '',
        employees: employees || '1-10',
        yearsInMarket: yearsInMarket || '0-2',
        website: '',
        logo: resolvedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedName || '')}&background=045C68&color=fff&size=256`,
        tags: profession ? [profession] : [],
        social: { website: '' }
      });
      if (newCompanyId) {
        await saveUserData(uid, { companyId: newCompanyId });
        return newCompanyId;
      }
    } catch (linkError) {
      console.error('Empresa creada pero no se pudo enlazar al perfil del usuario:', linkError);
    }
    return undefined;
  };

  const handleFinish = async (e: any) => {
    e.preventDefault();
    if (!auth.currentUser) {
      // If we got here with username/password register, create the account now
      if (authMode === 'register' && username && password) {
        setLoading(true);
        try {
          await registerWithUsername(username, password, {
            name,
            phone,
            birthday: `${birthMonth}-${birthDay.padStart(2, '0')}`,
            profession,
            role,
            city,
            avatar,
            profileType,
            employees: profileType === 'company' ? employees : null,
            yearsInMarket: profileType === 'company' ? yearsInMarket : null,
            recoveryEmail: backupEmail || null,
            referredBy: referredBy || null
          });
          // registerWithUsername already calls saveUserData and returns user
          // onAuthStateChanged will handle the rest or we can call onComplete
          const data = await getUserData(auth.currentUser?.uid || '');
          if (data) {
            const companyId = await linkCompanyIfNeeded(auth.currentUser?.uid || '', (data as any).name, (data as any).avatar);
            if (companyId) (data as any).companyId = companyId;
            onComplete(data as any);
          }
        } catch (err) {
          setError(t('onboarding.register.errorCreateAccount'));
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    if ((profileType === 'individual' && name && phone && birthDay && birthMonth) || (profileType === 'company' && name && phone)) {
      setLoading(true);
      const avatarUrl = await uploadAvatarIfNeeded(`avatars/${auth.currentUser.uid}`, avatar);
      // App.tsx solo monta OnboardingScreen cuando getUserData() ya devolvió
      // null para este uid (ver App.tsx, efecto de onAuthStateChanged) --
      // este `data` es SIEMPRE la primera creación real del documento, nunca
      // una edición de uno existente. Por eso es seguro pasar `createdAt`
      // explícito acá (a diferencia del enlace de companyId más abajo, que
      // sí es un guardado parcial sobre un doc ya existente).
      const data = {
        uid: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        name,
        phone,
        birthday: profileType === 'individual' ? `${birthMonth}-${birthDay.padStart(2, '0')}` : '',
        profession,
        role,
        city,
        avatar: avatarUrl,
        profileType,
        employees: profileType === 'company' ? employees : null,
        yearsInMarket: profileType === 'company' ? yearsInMarket : null,
        referredBy: referredBy || null
      };
      await saveUserData(auth.currentUser.uid, data);
      const companyId = await linkCompanyIfNeeded(auth.currentUser.uid, name, avatarUrl);
      if (companyId) (data as any).companyId = companyId;
      onComplete(data);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      <NetworkBackground color="rgba(1, 102, 114, 0.2)" />
      
      <AnimatePresence mode="wait">
        {step === 'welcome' ? (
          <motion.div 
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex-1 flex flex-col pt-20"
          >
            <div className="flex-1 flex flex-col items-center p-8 text-center relative z-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="mb-8"
              >
                <Logo size={120} showText className="scale-150 sm:scale-[2] mb-12" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-4 max-w-sm"
              >
                <p className="text-on-surface-variant text-base leading-relaxed opacity-80">
                  {t('onboarding.welcome.tagline')}
                </p>
              </motion.div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10 w-full max-w-3xl px-4">
                {[
                  { icon: Shield, title: t('onboarding.welcome.features.offers.title'), desc: t('onboarding.welcome.features.offers.desc'), color: 'text-primary', bg: 'bg-primary/10' },
                  { icon: Globe, title: t('onboarding.welcome.features.networking.title'), desc: t('onboarding.welcome.features.networking.desc'), color: 'text-secondary', bg: 'bg-secondary/10' },
                  { icon: Handshake, title: t('onboarding.welcome.features.investors.title'), desc: t('onboarding.welcome.features.investors.desc'), color: 'text-amber-500', bg: 'bg-amber-50' },
                  { icon: Rocket, title: t('onboarding.welcome.features.initiatives.title'), desc: t('onboarding.welcome.features.initiatives.desc'), color: 'text-emerald-600', bg: 'bg-emerald-50' }
                ].map((item, idx) => (
                  <motion.div 
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    className="flex flex-col items-center gap-3 p-6 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-white/40 shadow-xs"
                  >
                    <div className={`p-4 ${item.bg} rounded-2xl`}>
                      <item.icon className={`w-7 h-7 ${item.color}`} />
                    </div>
                    <div className="space-y-0.5 text-center">
                      <span className={`block text-[11px] font-black uppercase tracking-widest ${item.color}`}>{item.title}</span>
                      <span className="block text-[9px] text-on-surface-variant font-bold opacity-60 uppercase">{item.desc}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="p-8 relative z-10 w-full max-w-md mx-auto space-y-4">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                onClick={() => setStep('auth')}
                className="w-full py-5 bg-primary text-white rounded-[2rem] font-bold shadow-2xl shadow-primary/30 flex items-center justify-center gap-2 group active:scale-95 transition-all text-lg"
              >
                {t('onboarding.welcome.cta')}
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </motion.div>
        ) : step === 'auth' ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex-1 flex flex-col pt-12"
          >
            <div className="p-8 space-y-8 relative z-10 w-full max-w-md mx-auto">
              <button
                onClick={() => setStep('welcome')}
                className="p-2 bg-on-surface/5 rounded-xl self-start focus-ring-custom"
                aria-label={t('onboarding.backAria')}
              >
                <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
              </button>

              <div className="text-center space-y-2">
                <Logo size={60} className="mx-auto mb-4" />
                <h2 className="text-2xl font-black text-primary">{t('onboarding.auth.title')}</h2>
                <p className="text-sm font-medium text-on-surface-variant opacity-60">
                  {t('onboarding.auth.subtitle')}
                </p>
              </div>

              <div className="flex p-1 bg-on-surface/5 rounded-2xl">
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${authMode === 'login' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant/60'}`}
                >
                  {t('onboarding.auth.tabLogin')}
                </button>
                <button
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${authMode === 'register' ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant/60'}`}
                >
                  {t('onboarding.auth.tabRegister')}
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.auth.usernameLabel')}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                    <input
                      type="text"
                      placeholder={t('onboarding.auth.usernamePlaceholder')}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-white border-2 border-outline/10 focus:border-primary/20 rounded-2xl py-4 pl-12 pr-4 outline-hidden font-bold text-sm transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.auth.passwordLabel')}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                    <input
                      type="password"
                      placeholder={t('onboarding.auth.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border-2 border-outline/10 focus:border-primary/20 rounded-2xl py-4 pl-12 pr-4 outline-hidden font-bold text-sm transition-all shadow-xs"
                    />
                  </div>
                </div>

                {authMode === 'register' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.auth.confirmPasswordLabel')}</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                        <input
                          type="password"
                          placeholder={t('onboarding.auth.confirmPasswordPlaceholder')}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-white border-2 border-outline/10 focus:border-primary/20 rounded-2xl py-4 pl-12 pr-4 outline-hidden font-bold text-sm transition-all shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.auth.backupEmailLabel')}</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                        <input
                          type="email"
                          placeholder={t('onboarding.auth.emailPlaceholder')}
                          value={backupEmail}
                          onChange={(e) => setBackupEmail(e.target.value)}
                          className="w-full bg-white border-2 border-outline/10 focus:border-primary/20 rounded-2xl py-4 pl-12 pr-4 outline-hidden font-bold text-sm transition-all shadow-xs"
                        />
                      </div>
                      <p className="text-[9px] text-on-surface-variant/60 font-medium ml-1 pt-1">
                        {t('onboarding.auth.backupEmailHint')}
                      </p>
                    </div>
                  </>
                )}

                {error && <p className="text-[10px] font-bold text-error text-center px-4">{error}</p>}

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setStep('forgot-password')}
                    className="text-[10px] font-bold text-primary/60 hover:text-primary transition-all uppercase tracking-widest"
                  >
                    {t('onboarding.auth.forgotPassword')}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || !username || !password || (authMode === 'register' && (password.length < 8 || password !== confirmPassword))}
                  className="w-full py-4 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-base disabled:opacity-50"
                >
                  {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : (
                    <>
                      {authMode === 'login' ? t('onboarding.auth.submitLogin') : t('onboarding.auth.submitRegister')}
                      {authMode === 'login' ? <LogIn className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                    </>
                  )}
                </button>
              </form>

              <div className="relative flex items-center justify-center py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-on-surface/10"></div></div>
                <span className="relative bg-surface px-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-40">{t('onboarding.auth.orDivider')}</span>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-4 bg-white border-2 border-primary/5 text-primary rounded-2xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-all text-sm disabled:opacity-50 shadow-sm"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" />
                {t('onboarding.auth.googleButton')}
              </button>
            </div>
          </motion.div>
        ) : step === 'forgot-password' ? (
          <motion.div
            key="forgot"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="flex-1 flex flex-col pt-12"
          >
            <div className="p-8 space-y-8 relative z-10 w-full max-w-md mx-auto">
              <button
                onClick={() => setStep('auth')}
                className="p-2 bg-on-surface/5 rounded-xl self-start focus-ring-custom"
                aria-label={t('onboarding.backAria')}
              >
                <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
              </button>

              <div className="text-center space-y-2">
                <Logo size={60} className="mx-auto mb-4" />
                <h2 className="text-2xl font-black text-primary">{t('onboarding.forgotPassword.title')}</h2>
                <p className="text-sm font-medium text-on-surface-variant opacity-60 px-4">
                  {t('onboarding.forgotPassword.subtitle')}
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.forgotPassword.emailLabel')}</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                    <input
                      type="text"
                      placeholder={t('onboarding.auth.emailPlaceholder')}
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="w-full bg-white border-2 border-outline/10 focus:border-primary/20 rounded-2xl py-4 pl-12 pr-4 outline-hidden font-bold text-sm transition-all shadow-xs"
                    />
                  </div>
                </div>

                {error && <p className="text-[10px] font-bold text-error text-center px-4">{error}</p>}
                {success && <p className="text-[10px] font-bold text-secondary text-center px-4">{success}</p>}

                <button
                  type="submit"
                  disabled={loading || !recoveryEmail}
                  className="w-full py-4 bg-primary text-white rounded-[1.5rem] font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-base disabled:opacity-50"
                >
                  {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : (
                    <>
                      {t('onboarding.forgotPassword.submit')}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-on-surface-variant/60 text-center px-4 leading-relaxed">
                  {t('onboarding.forgotPassword.footnote')}
                </p>
              </form>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="register"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col pt-12"
          >
            <div className="p-8 space-y-8 relative z-10 max-w-md mx-auto w-full">
              <div className="space-y-2">
                <h2 className="text-3xl font-black font-display text-primary tracking-tight">{t('onboarding.register.title')}</h2>
                <p className="text-on-surface-variant font-medium">{t('onboarding.register.subtitle')}</p>
              </div>

              <form onSubmit={handleFinish} className="space-y-5 pb-10">
                {/* Image Upload */}
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative group">
                    <div className="w-28 h-28 rounded-3xl overflow-hidden border-4 border-primary/20 shadow-2xl">
                      <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <label className="absolute -bottom-2 -right-2 bg-secondary text-white p-2.5 rounded-2xl shadow-lg cursor-pointer hover:scale-110 active:scale-90 transition-all border-4 border-white focus-within:ring-2 focus-within:ring-primary/50 focus-within:ring-offset-2">
                      <Camera className="w-5 h-5" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} aria-label={t('onboarding.register.uploadPhotoAria')} />
                    </label>
                  </div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">{t('onboarding.register.uploadPhoto')}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.profileTypeLabel')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileType('individual')}
                      className={`py-3 rounded-xl border-2 font-bold text-xs transition-all ${profileType === 'individual' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-outline/10 text-on-surface-variant'}`}
                    >
                      {t('common.profileTypePersonal')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileType('company')}
                      className={`py-3 rounded-xl border-2 font-bold text-xs transition-all ${profileType === 'company' ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-outline/10 text-on-surface-variant'}`}
                    >
                      {t('common.profileTypeCompany')}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">
                    {profileType === 'company' ? t('onboarding.register.companyNameLabel') : t('onboarding.register.fullNameLabel')}
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                    <input
                      required
                      type="text"
                      placeholder={profileType === 'company' ? t('onboarding.register.companyNamePlaceholder') : t('onboarding.register.fullNamePlaceholder')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.phoneLabel')}</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                    <input
                      required
                      type="tel"
                      placeholder={t('onboarding.register.phonePlaceholder')}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 pl-12 pr-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden transition-all shadow-xs"
                    />
                  </div>
                </div>

                {profileType === 'company' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.employeesLabel')}</label>
                      <select
                        value={employees}
                        onChange={(e) => setEmployees(e.target.value)}
                        className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                      >
                        <option value="1-10">{t('onboarding.register.employeesOptions.1-10')}</option>
                        <option value="10-50">{t('onboarding.register.employeesOptions.10-50')}</option>
                        <option value="50-200">{t('onboarding.register.employeesOptions.50-200')}</option>
                        <option value="200+">{t('onboarding.register.employeesOptions.200+')}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.yearsLabel')}</label>
                      <select
                        value={yearsInMarket}
                        onChange={(e) => setYearsInMarket(e.target.value)}
                        className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                      >
                        <option value="0-2">{t('onboarding.register.yearsOptions.0-2')}</option>
                        <option value="2-5">{t('onboarding.register.yearsOptions.2-5')}</option>
                        <option value="5-10">{t('onboarding.register.yearsOptions.5-10')}</option>
                        <option value="10+">{t('onboarding.register.yearsOptions.10+')}</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {profileType === 'individual' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.specialtyLabel')}</label>
                        <input
                          type="text"
                          placeholder={t('onboarding.register.specialtyPlaceholder')}
                          value={profession}
                          onChange={(e) => setProfession(e.target.value)}
                          className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.currentRoleLabel')}</label>
                        <input
                          type="text"
                          placeholder={t('onboarding.register.currentRolePlaceholder')}
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.industryLabel')}</label>
                      <select
                        value={['Energía', 'Agricultura', 'Construcción', 'Banca', 'Tecnología', 'Servicios'].includes(profession) ? profession : (profession ? 'Otro' : '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProfession(val === 'Otro' ? '' : val);
                        }}
                        className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                      >
                        <option value="">{t('onboarding.register.industrySelectPlaceholder')}</option>
                        <option value="Energía">{t('onboarding.register.industryOptions.energy')}</option>
                        <option value="Agricultura">{t('onboarding.register.industryOptions.agriculture')}</option>
                        <option value="Construcción">{t('onboarding.register.industryOptions.construction')}</option>
                        <option value="Banca">{t('onboarding.register.industryOptions.banking')}</option>
                        <option value="Tecnología">{t('onboarding.register.industryOptions.technology')}</option>
                        <option value="Servicios">{t('onboarding.register.industryOptions.services')}</option>
                        <option value="Otro">{t('onboarding.register.industryOptions.other')}</option>
                      </select>
                      {!['Energía', 'Agricultura', 'Construcción', 'Banca', 'Tecnología', 'Servicios'].includes(profession) && profession !== '' && (
                        <motion.input
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          type="text"
                          placeholder={t('onboarding.register.industryCustomPlaceholder')}
                          value={profession}
                          onChange={(e) => setProfession(e.target.value)}
                          className="mt-2 w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                        />
                      )}
                      {profession === '' && !['Energía', 'Agricultura', 'Construcción', 'Banca', 'Tecnología', 'Servicios'].includes(profession) && (
                         <div className="mt-2 text-[10px] text-primary/40 font-medium px-2 italic">{t('onboarding.register.industryCustomHint')}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.cityLabel')}</label>
                  <input
                    type="text"
                    placeholder={t('onboarding.register.cityPlaceholder')}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                  />
                </div>

                {profileType === 'individual' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">{t('onboarding.register.birthdayLabel')}</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="number"
                        min="1"
                        max="31"
                        placeholder={t('onboarding.register.birthdayDayPlaceholder')}
                        value={birthDay}
                        onChange={(e) => setBirthDay(e.target.value)}
                        className="w-20 bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                      />
                      <select
                        required
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(e.target.value)}
                        className="flex-1 bg-white border-2 border-outline/10 rounded-[1.2rem] py-3.5 px-4 text-sm font-bold focus:border-primary/30 focus:outline-hidden shadow-xs"
                      >
                        <option value="">{t('onboarding.register.birthdayMonthPlaceholder')}</option>
                        {months.map((m, i) => (
                          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading || !name || !phone || (profileType === 'individual' && (!birthDay || !birthMonth))}
                    className="w-full py-4 bg-secondary text-white rounded-[1.5rem] font-bold shadow-xl shadow-secondary/20 flex items-center justify-center gap-2 group active:scale-95 transition-all text-base disabled:opacity-50"
                  >
                    {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : (
                      <>
                        {t('onboarding.register.submit')}
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
