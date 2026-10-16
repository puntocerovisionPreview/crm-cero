import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  ShieldCheck, 
  Award, 
  DollarSign, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight, 
  FileText,
  Target,
  Zap,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { 
  PAF_PRO_PRICING, 
  PAF_BASE_PRICING, 
  PAF_LEAD_SCORING_INFO, 
  PAF_SALES_OBJECTIONS 
} from '../utils/pafTemplates';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  privacyMode?: boolean;
}

export const PafGuideModal: React.FC<Props> = ({
  isOpen,
  onClose,
  privacyMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'ofertas' | 'scoring' | 'objeciones'>('ofertas');

  if (!isOpen) return null;

  const formatARS = (amount: number) => {
    if (privacyMode) return '$ ••••••';
    return `$ ${amount.toLocaleString('es-AR')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-zinc-100 flex items-center gap-2">
                Método PAF: Guía Comercial & Cierres
              </h2>
              <p className="text-xs text-zinc-400">
                Programa de Escalabilidad Comercial para Arquitectos (.Cero)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-nav Tabs */}
        <div className="p-3 bg-zinc-900/40 border-b border-zinc-800/60 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'ofertas', label: 'Inversión & Ofertas (Pro vs Base)', icon: DollarSign },
            { id: 'scoring', label: 'Lead Scoring (A/B/C)', icon: Target },
            { id: 'objeciones', label: 'Rebatidor de Objeciones', icon: MessageSquare },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  hapticFeedback.selection();
                  setActiveTab(tab.id as any);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap ${
                  active 
                    ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* TAB 1: OFERTAS & PRECIOS */}
          {activeTab === 'ofertas' && (
            <div className="space-y-6">
              {/* PAF Pro Tier */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/60 border-2 border-[var(--accent)]/40 relative space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[10px] font-extrabold uppercase tracking-wider">
                      Acceso Premium Completo
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-zinc-100 mt-1">
                      Programa PAF Pro (3 Meses / 12 Semanas)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Sistema integral de captación, filtrado y cierre para estudios de arquitectura.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-zinc-500 line-through">Oficial: {formatARS(1500000)}</div>
                    <div className="text-xl font-black text-amber-400">{formatARS(1100000)}</div>
                    <div className="text-[10px] text-emerald-400 font-semibold">Cierre en llamada (-$200.000)</div>
                  </div>
                </div>

                {/* What includes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>26 horas de consultoría y mentoría 1:1 (2 sesiones/sem)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>Página Web & Landing Page comercial de alta conversión</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>Gestión y configuración de campañas Meta Ads</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>Producción y lanzamiento de VSL Funnel</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>Optimización Google Business Profile / Maps (SEO Local)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>Soporte en reuniones y auditoría de llamadas reales</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    <span>Librería de Prompts IA .Cero + Manuales de Infraestructura Comercial</span>
                  </div>
                </div>

                {/* Payment Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  {PAF_PRO_PRICING.map(plan => (
                    <div key={plan.id} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-center space-y-1">
                      {plan.badge && (
                        <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 mb-1">
                          {plan.badge}
                        </span>
                      )}
                      <div className="text-xs font-bold text-zinc-200">{plan.name}</div>
                      <div className="text-base font-black text-white">{formatARS(plan.installmentAmount)}</div>
                      <div className="text-[10px] text-zinc-400">
                        {plan.installments > 1 ? `${plan.installments} cuotas (Total ${formatARS(plan.totalAmount)})` : 'Pago único'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PAF Base Tier */}
              <div className="p-4 sm:p-5 rounded-3xl bg-zinc-900/40 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
                      Acceso Base / Económico
                    </span>
                    <h3 className="text-base font-bold text-zinc-100 mt-1">
                      Plan Base de Adquisición Digital PAF
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Fundaciones, Landing ágil, Toolkit de contenidos 30 días y Taller Meta Ads.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-zinc-100">{formatARS(800000)}</div>
                    <div className="text-[10px] text-zinc-500">Precio base oficial</div>
                  </div>
                </div>

                {/* What includes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Workshop de Fundaciones (Nicho & Oferta)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Auditoría de Perfiles (Instagram + Google Maps)</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Landing page ágil de conversión</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Toolkit orgánico: 30 días de contenidos y guiones</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Taller Meta Ads paso a paso</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Scripts de respuesta y precalificación</span>
                  </div>
                </div>

                {/* Payment Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  {PAF_BASE_PRICING.map(plan => (
                    <div key={plan.id} className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center space-y-1">
                      <div className="text-xs font-bold text-zinc-300">{plan.name}</div>
                      <div className="text-base font-black text-zinc-100">{formatARS(plan.installmentAmount)}</div>
                      <div className="text-[10px] text-zinc-400">
                        {plan.installments > 1 ? `${plan.installments} cuotas (Total ${formatARS(plan.totalAmount)})` : 'Pago único'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEAD SCORING */}
          {activeTab === 'scoring' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 space-y-1.5">
                <div className="font-bold text-sm text-zinc-100">
                  🎯 Sistema de Pre-calificación para Arquitectos
                </div>
                <div>
                  Para evitar regalar horas de anteproyecto a curiosos que solo preguntan "precio por metro cuadrado", el Método PAF filtra prospectos en 3 niveles según 3 variables: <strong>Terreno</strong>, <strong>Plazo</strong> y <strong>Presupuesto</strong>.
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(PAF_LEAD_SCORING_INFO).map(([key, info]) => (
                  <div
                    key={key}
                    className={`p-4 rounded-2xl border ${
                      key === 'A' 
                        ? 'bg-emerald-950/20 border-emerald-800/60' 
                        : key === 'B' 
                        ? 'bg-amber-950/20 border-amber-800/60' 
                        : 'bg-zinc-900/30 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        key === 'A' ? 'bg-emerald-500/20 text-emerald-300' : key === 'B' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {info.badge}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {key === 'A' ? 'Prioridad Inmediata' : key === 'B' ? 'Nurturing' : 'Filtrado'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <strong className="text-zinc-200">Criterio: </strong>
                        <span className="text-zinc-300">{info.criteria}</span>
                      </div>
                      <div>
                        <strong className="text-zinc-200">Acción recomendada: </strong>
                        <span className="text-zinc-400">{info.action}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: REBATIDOR DE OBJECIONES */}
          {activeTab === 'objeciones' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300">
                Guion y respuestas probadas para rebatir objeciones en reuniones con dueños de estudios de arquitectura:
              </div>

              <div className="space-y-3">
                {PAF_SALES_OBJECTIONS.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-2">
                    <div className="font-bold text-amber-400 text-xs sm:text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>{item.objection}</span>
                    </div>
                    <div className="text-xs text-zinc-300 leading-relaxed pl-6 border-l-2 border-[var(--accent)]/50">
                      {item.rebuttal}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
