import { useState } from 'react';
import { Building2, Globe, ChevronRight, X, ShieldCheck, Plus, Trash2, Linkedin, Instagram, Twitter, Facebook, Award, Network, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { auth, createCompany, saveUserData } from '../services/firebaseService';

interface CompanyRegistrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CompanyRegistrationWizard({ isOpen, onClose }: CompanyRegistrationWizardProps) {
  const { t } = useTranslation();
  const [registrationStep, setRegistrationStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const currentUid = auth.currentUser?.uid;

  // Form State — los valores de industry/location/employees/yearsInMarket de
  // los <select> de abajo se guardan tal cual en Firestore (company.industry,
  // company.location, etc.) y también forman `tags`/comparaciones exactas
  // más adelante -- se dejan en español sin traducir, igual que
  // TENDER_CATEGORIES en TendersScreen.tsx.
  const [formData, setFormData] = useState({
    name: '',
    industry: 'Tecnología',
    description: '',
    location: 'Malabo',
    employees: '1-10',
    yearsInMarket: '0-2',
    ceoName: '',
    departments: ['Dirección'],
    leadership: [] as { name: string, role: string }[],
    certifications: [] as { name: string, year: string, entity: string }[],
    social: {
      linkedin: '',
      instagram: '',
      twitter: '',
      facebook: '',
      website: ''
    }
  });

  const handleAddDepartment = () => {
    setFormData({ ...formData, departments: [...formData.departments, ''] });
  };

  const handleRemoveDepartment = (index: number) => {
    const deps = [...formData.departments];
    deps.splice(index, 1);
    setFormData({ ...formData, departments: deps });
  };

  const handleAddLeadership = () => {
    setFormData({ ...formData, leadership: [...formData.leadership, { name: '', role: '' }] });
  };

  const handleRemoveLeadership = (index: number) => {
    const lead = [...formData.leadership];
    lead.splice(index, 1);
    setFormData({ ...formData, leadership: lead });
  };

  const handleAddCert = () => {
    setFormData({ ...formData, certifications: [...formData.certifications, { name: '', year: '2024', entity: '' }] });
  };

  const handleRemoveCert = (index: number) => {
    const certs = [...formData.certifications];
    certs.splice(index, 1);
    setFormData({ ...formData, certifications: certs });
  };

  const handleSubmit = async () => {
    if (!currentUid) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const newCompanyId = await createCompany(currentUid, {
        ...formData,
        website: formData.social.website,
        logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=045C68&color=fff&size=256`,
        tags: [formData.industry],
        isVerified: false
      });
      // Enlace hacia adelante (ver docs/PLAN_MEJORA_360.md sección 3/7 Fase 2:
      // `companies` es la entidad canónica): tras registrar la empresa,
      // reflejamos profileType='company' + companyId en el propio users/{uid}
      // para que este registro y "marcar company en mi perfil" (ProfileScreen)
      // nunca vuelvan a desincronizarse. Si este segundo guardado fallara, la
      // empresa ya quedó creada de todas formas (lo principal de esta acción);
      // no bloqueamos el cierre del modal por esto, solo queda en consola.
      // CompaniesScreen no recibe `onUpdateProfile` como prop hoy (a diferencia
      // de ProfileScreen) -- no se inventa una prop nueva en App.tsx sin
      // necesidad real; la próxima recarga de perfil ya reflejará estos campos
      // desde Firestore.
      if (newCompanyId) {
        try {
          await saveUserData(currentUid, { profileType: 'company', companyId: newCompanyId });
        } catch (linkError) {
          console.error('Empresa creada pero no se pudo enlazar al perfil del usuario:', linkError);
        }
      }
      onClose();
      setRegistrationStep(1);
      setFormData({
        name: '', industry: 'Tecnología', description: '', location: 'Malabo',
        employees: '1-10', yearsInMarket: '0-2', ceoName: '', departments: ['Dirección'],
        leadership: [], certifications: [],
        social: { linkedin: '', instagram: '', twitter: '', facebook: '', website: '' }
      });
    } catch (error) {
      setSubmitError(t('companies.submitErrorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSubmitting && onClose()}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-surface rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-extrabold font-display text-on-surface">{t('companies.registrationTitle')}</h2>
                  <div className="flex gap-2 mt-2">
                     {[1, 2, 3].map(step => (
                       <div key={step} className={`h-1.5 rounded-full transition-all duration-300 ${registrationStep >= step ? 'w-8 bg-primary' : 'w-4 bg-surface-container-high'}`} />
                     ))}
                  </div>
                </div>
                <button onClick={() => onClose()} className="p-2 rounded-full hover:bg-surface-container-high transition-all focus-ring-custom" aria-label={t('companies.closeRegistrationModalAria')}>
                  <X className="w-6 h-6 text-on-surface-variant" />
                </button>
              </div>

              <div className="space-y-8">
                {registrationStep === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div className="flex items-center gap-2 text-primary font-bold mb-4">
                      <Building2 className="w-5 h-5" />
                      <h3>{t('companies.step1Title')}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.companyNameLabel')}</label>
                        <input
                          type="text"
                          className="input-field-custom"
                          placeholder={t('companies.companyNamePlaceholder')}
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.ceoLabel')}</label>
                        <input
                          type="text"
                          className="input-field-custom"
                          placeholder={t('companies.ceoPlaceholder')}
                          value={formData.ceoName}
                          onChange={(e) => setFormData({ ...formData, ceoName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.yearsInMarketLabel')}</label>
                        <select
                          className="select-field-custom"
                          value={formData.yearsInMarket}
                          onChange={(e) => setFormData({ ...formData, yearsInMarket: e.target.value })}
                        >
                          <option value="0-2">{t('companies.yearsOption0to2')}</option>
                          <option value="2-5">{t('companies.yearsOption2to5')}</option>
                          <option value="5-10">{t('companies.yearsOption5to10')}</option>
                          <option value="10+">{t('companies.yearsOption10plus')}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.websiteSocialLabel')}</label>
                        <input
                          type="url"
                          className="input-field-custom"
                          placeholder="https://..."
                          value={formData.social.website}
                          onChange={(e) => setFormData({ ...formData, social: { ...formData.social, website: e.target.value } })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.industryLabel')}</label>
                        <select
                          className="select-field-custom"
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        >
                          <option>Tecnología</option>
                          <option>Petróleo y Gas</option>
                          <option>Banca y Finanzas</option>
                          <option>Construcción</option>
                          <option>Servicios</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.descriptionLabel')}</label>
                      <textarea
                        rows={3}
                        className="textarea-field-custom"
                        placeholder={t('companies.descriptionPlaceholder')}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.headquartersLabel')}</label>
                        <select className="select-field-custom" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}>
                          <option>Malabo</option>
                          <option>Bata</option>
                          <option>Oyala</option>
                          <option>Mongomo</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.employeesSizeLabel')}</label>
                        <select className="select-field-custom" value={formData.employees} onChange={(e) => setFormData({ ...formData, employees: e.target.value })}>
                          <option>1-10</option>
                          <option>11-50</option>
                          <option>51-200</option>
                          <option>200+</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {registrationStep === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                    {/* Structure */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <Network className="w-5 h-5 text-secondary" />
                          <h3>{t('companies.orgStructureTitle')}</h3>
                        </div>
                        <button onClick={handleAddDepartment} className="text-secondary hover:bg-secondary/10 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all">
                          <Plus className="w-3 h-3" />
                          {t('companies.addDepartmentButton')}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.keyDepartmentsLabel')}</label>
                        <div className="grid grid-cols-2 gap-3">
                          {formData.departments.map((dept, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                className="input-field-custom-sm bg-surface-container-low"
                                placeholder={t('companies.departmentPlaceholder')}
                                value={dept}
                                onChange={(e) => {
                                  const deps = [...formData.departments];
                                  deps[index] = e.target.value;
                                  setFormData({ ...formData, departments: deps });
                                }}
                              />
                              <button onClick={() => handleRemoveDepartment(index)} className="p-2 text-error hover:bg-error/10 rounded-xl transition-all focus-ring-custom" aria-label={t('companies.removeDepartmentAria')}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-outline/5">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.leadershipFormTitle')}</label>
                          <button onClick={handleAddLeadership} className="text-primary hover:bg-primary/10 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all">
                            <Plus className="w-3 h-3" />
                            {t('companies.addLeadershipButton')}
                          </button>
                        </div>
                        <div className="space-y-3">
                          {formData.leadership.map((lead, index) => (
                            <div key={index} className="grid grid-cols-5 gap-3 items-center">
                              <input
                                className="col-span-2 input-field-custom-sm bg-surface-container-low"
                                placeholder={t('companies.leadershipNamePlaceholder')}
                                value={lead.name}
                                onChange={(e) => {
                                  const l = [...formData.leadership];
                                  l[index].name = e.target.value;
                                  setFormData({ ...formData, leadership: l });
                                }}
                              />
                              <input
                                className="col-span-2 input-field-custom-sm bg-surface-container-low"
                                placeholder={t('companies.leadershipRolePlaceholder')}
                                value={lead.role}
                                onChange={(e) => {
                                  const l = [...formData.leadership];
                                  l[index].role = e.target.value;
                                  setFormData({ ...formData, leadership: l });
                                }}
                              />
                              <button onClick={() => handleRemoveLeadership(index)} className="p-2 text-error hover:bg-error/10 rounded-xl transition-all justify-self-end focus-ring-custom" aria-label={t('companies.removeLeadershipAria')}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Certifications */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <Award className="w-5 h-5 text-secondary" />
                          <h3>{t('companies.certificationsFormTitle')}</h3>
                        </div>
                        <button onClick={handleAddCert} className="text-secondary hover:bg-secondary/10 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all">
                          <Plus className="w-3 h-3" />
                          {t('companies.addCertButton')}
                        </button>
                      </div>
                      <div className="space-y-3">
                        {formData.certifications.map((cert, index) => (
                          <div key={index} className="bg-surface-container-low p-4 rounded-2xl border border-outline/5 space-y-4 shadow-sm">
                            <div className="flex gap-4">
                              <div className="flex-1 space-y-2">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.certNameLabel')}</label>
                                <input
                                  className="input-field-custom-sm bg-white"
                                  placeholder={t('companies.certNamePlaceholder')}
                                  value={cert.name}
                                  onChange={(e) => {
                                    const certs = [...formData.certifications];
                                    certs[index].name = e.target.value;
                                    setFormData({ ...formData, certifications: certs });
                                  }}
                                />
                              </div>
                              <div className="w-24 space-y-2">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.certYearLabel')}</label>
                                <input
                                  className="input-field-custom-sm bg-white text-center"
                                  value={cert.year}
                                  onChange={(e) => {
                                    const certs = [...formData.certifications];
                                    certs[index].year = e.target.value;
                                    setFormData({ ...formData, certifications: certs });
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex gap-4 items-end">
                              <div className="flex-1 space-y-2">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">{t('companies.certEntityLabel')}</label>
                                <input
                                  className="input-field-custom-sm bg-white"
                                  placeholder={t('companies.certEntityPlaceholder')}
                                  value={cert.entity}
                                  onChange={(e) => {
                                    const certs = [...formData.certifications];
                                    certs[index].entity = e.target.value;
                                    setFormData({ ...formData, certifications: certs });
                                  }}
                                />
                              </div>
                              <button onClick={() => handleRemoveCert(index)} className="p-3 text-error hover:bg-error/10 rounded-xl transition-all focus-ring-custom" aria-label={t('companies.removeCertAria')}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {formData.certifications.length === 0 && (
                          <p className="text-xs text-on-surface-variant opacity-60 text-center py-4 italic">{t('companies.noCertificationsYet')}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {registrationStep === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                     <div className="flex items-center gap-2 text-primary font-bold mb-4">
                      <Globe className="w-5 h-5 text-secondary" />
                      <h3>{t('companies.digitalPresenceTitle')}</h3>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-xl">
                          <Globe className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.officialWebsiteLabel')}</p>
                          <input
                            type="text"
                            className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                            placeholder={t('companies.officialWebsitePlaceholder')}
                            value={formData.social.website}
                            onChange={(e) => setFormData({ ...formData, social: { ...formData.social, website: e.target.value } })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                        <div className="w-12 h-12 bg-[#0077B5]/10 flex items-center justify-center rounded-xl">
                          <Linkedin className="w-6 h-6 text-[#0077B5]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.linkedinUrlLabel')}</p>
                          <input
                            type="text"
                            className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                            placeholder={t('companies.linkedinUrlPlaceholder')}
                            value={formData.social.linkedin}
                            onChange={(e) => setFormData({ ...formData, social: { ...formData.social, linkedin: e.target.value } })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                        <div className="w-12 h-12 bg-[#1877F2]/10 flex items-center justify-center rounded-xl">
                          <Facebook className="w-6 h-6 text-[#1877F2]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.facebookPageLabel')}</p>
                          <input
                            type="text"
                            className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                            placeholder={t('companies.facebookPagePlaceholder')}
                            value={formData.social.facebook}
                            onChange={(e) => setFormData({ ...formData, social: { ...formData.social, facebook: e.target.value } })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                        <div className="w-12 h-12 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-opacity-10 flex items-center justify-center rounded-xl p-0.5">
                          <div className="bg-white/90 w-full h-full rounded-[10px] flex items-center justify-center">
                            <Instagram className="w-6 h-6 text-[#ee2a7b]" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.instagramHandleLabel')}</p>
                          <input
                            type="text"
                            className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                            placeholder={t('companies.instagramHandlePlaceholder')}
                            value={formData.social.instagram}
                            onChange={(e) => setFormData({ ...formData, social: { ...formData.social, instagram: e.target.value } })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[1.5rem] border border-outline/5 transition-all focus-within:border-primary">
                        <div className="w-12 h-12 bg-[#1DA1F2]/10 flex items-center justify-center rounded-xl">
                          <Twitter className="w-6 h-6 text-[#1DA1F2]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1 ml-1">{t('companies.twitterLabel')}</p>
                          <input
                            type="text"
                            className="w-full bg-transparent p-0 text-sm font-semibold focus:outline-hidden"
                            placeholder={t('companies.twitterPlaceholder')}
                            value={formData.social.twitter}
                            onChange={(e) => setFormData({ ...formData, social: { ...formData.social, twitter: e.target.value } })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                      <div className="flex items-start gap-4">
                        <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-1" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-primary">{t('companies.verificationNoticeTitle')}</p>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">
                            {t('companies.verificationNoticeDesc')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {submitError && <p className="text-xs font-bold text-error text-center mt-6">{submitError}</p>}

              <div className="mt-12 flex gap-4">
                {registrationStep > 1 && (
                  <button
                    onClick={() => setRegistrationStep(registrationStep - 1)}
                    className="px-8 py-4 bg-surface-container-high text-on-surface font-bold rounded-full transition-all active:scale-95"
                  >
                    {t('companies.backButton')}
                  </button>
                )}
                <button
                  disabled={isSubmitting}
                  onClick={() => {
                    if (registrationStep < 3) setRegistrationStep(registrationStep + 1);
                    else handleSubmit();
                  }}
                  className="flex-1 py-4 bg-primary text-white font-bold rounded-full shadow-xl shadow-primary/20 active:scale-95 transition-all relative overflow-hidden flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('companies.validatingLabel')}
                    </>
                  ) : (
                    <>
                      <span>{registrationStep === 3 ? t('companies.finishRegistrationButton') : t('companies.continueButton')}</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
