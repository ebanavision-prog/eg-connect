import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, MapPin, Building2, Users, CheckCircle2, Award, ExternalLink, Linkedin, Instagram, Facebook, Twitter } from 'lucide-react';
import { Company } from '../types';

interface CompanyProfileModalProps {
  company: Company;
  isOpen: boolean;
  onClose: () => void;
}

export default function CompanyProfileModal({ company, isOpen, onClose }: CompanyProfileModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header/Cover */}
          <div className="h-32 bg-primary relative shrink-0">
             <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
             <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-8 pb-8 flex-1 overflow-y-auto no-scrollbar">
            {/* Logo and Name */}
            <div className="relative -mt-12 mb-6">
              <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-xl relative z-10 overflow-hidden">
                <img src={company.logo} alt={company.name} className="w-full h-full object-cover rounded-2xl" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-primary flex items-center gap-2">
                    {company.name}
                    {company.isVerified && <CheckCircle2 className="w-5 h-5 text-secondary" />}
                  </h2>
                  <p className="text-sm font-bold text-secondary uppercase tracking-widest">{company.industry}</p>
                </div>
                <div className="flex gap-2">
                  {company.social?.website && (
                    <a href={company.social.website} target="_blank" rel="noreferrer" className="p-2 bg-primary/5 text-primary rounded-xl hover:bg-primary hover:text-white transition-all">
                      <Globe className="w-5 h-5" />
                    </a>
                  )}
                  {company.social?.linkedin && (
                    <a href={company.social.linkedin} target="_blank" rel="noreferrer" className="p-2 bg-primary/5 text-primary rounded-xl hover:bg-primary hover:text-white transition-all">
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline/5">
                <MapPin className="w-4 h-4 text-primary mb-2" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">Ubicación</span>
                <span className="text-xs font-bold text-on-surface">{company.location}</span>
              </div>
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline/5">
                <Users className="w-4 h-4 text-primary mb-2" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">Empleados</span>
                <span className="text-xs font-bold text-on-surface">{company.employees}</span>
              </div>
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline/5 col-span-2 md:col-span-1">
                <Building2 className="w-4 h-4 text-primary mb-2" />
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest block">Sector</span>
                <span className="text-xs font-bold text-on-surface">{company.industry}</span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-4 mb-8">
              <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                <div className="h-1 w-4 bg-primary rounded-full"></div>
                Sobre la Empresa
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                {company.description}
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-8">
              {company.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-full uppercase tracking-tight">
                  {tag}
                </span>
              ))}
            </div>

            {/* Certifications */}
            {company.certifications && company.certifications.length > 0 && (
              <div className="space-y-4 mb-8">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="h-1 w-4 bg-primary rounded-full"></div>
                  Certificaciones
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {company.certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                      <div className="p-2 bg-white rounded-xl shadow-sm">
                        <Award className="w-5 h-5 text-secondary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-on-surface leading-tight">{cert.name}</h4>
                        <p className="text-[10px] text-on-surface-variant font-medium">
                          {cert.entity} • {cert.year}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leadership */}
            {company.leadership && company.leadership.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="h-1 w-4 bg-primary rounded-full"></div>
                  Liderazgo
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {company.leadership.map((leader, i) => (
                    <div key={i} className="p-4 bg-surface-container-low rounded-2xl border border-outline/5">
                      <h4 className="text-sm font-bold text-on-surface leading-tight">{leader.name}</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-tighter mt-1">{leader.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12">
              {company.social?.website ? (
                <a
                  href={company.social.website}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full h-14 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all"
                >
                  Visitar Sitio Web
                  <ExternalLink className="w-5 h-5" />
                </a>
              ) : (
                <div className="w-full h-14 bg-surface-container-low text-on-surface-variant/60 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 border border-outline/10">
                  Esta empresa no añadió un sitio web
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
