import React, { useState, useId } from 'react';
import { ModalPortal } from './ModalPortal';
import { 
  Project, 
  ProjectType, 
  PafMilestone, 
  ProjectInstallment,
  PafStage,
  PAF_STAGES 
} from '../types';
import { 
  Building2, 
  User, 
  Phone, 
  Instagram, 
  MapPin, 
  Sparkles, 
  Calendar, 
  CreditCard, 
  Check, 
  X, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight,
  HelpCircle,
  Settings
} from 'lucide-react';
import { generateInstallmentSchedule, formatCurrencyAmount } from '../utils/paymentPlans';
import { 
  PAF_PRO_MILESTONES, 
  PAF_BASE_MILESTONES, 
  DEFAULT_PAF_STAGE_EXIT_MILESTONES 
} from '../utils/pafTemplates';
import { addMonths } from '../utils/projectTimeline';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  getStoredPafPricingSettings, 
  getComputedPafPlans, 
  PafPricingSettings 
} from '../utils/pafPricingConfig';
import { PafPricingConfigModal } from './PafPricingConfigModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  defaultProjectType?: 'paf_pro' | 'paf_base';
}

export const NewPafClientModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onAddProject,
  defaultProjectType = 'paf_pro',
}) => {
  const modalTitleId = useId();

  // Basic Information
  const [clientName, setClientName] = useState(''); // Estudio de Arquitectura
  const [ownerName, setOwnerName] = useState(''); // Titular / Arquitecto responsable
  const [phone, setPhone] = useState(''); // WhatsApp
  const [instagramUrl, setInstagramUrl] = useState(''); // Perfil IG
  const [googleMapsUrl, setGoogleMapsUrl] = useState(''); // Perfil Maps / Business
  const [notes, setNotes] = useState('');

  // Service Modality
  const [projectType, setProjectType] = useState<ProjectType>(defaultProjectType);
  const [stage, setStage] = useState<PafStage>('Kick-Off & Diagnóstico');

  // Dates
  const [startDate, setStartDate] = useState(getTodayString());
  const [deliveryDate, setDeliveryDate] = useState(() => addMonths(getTodayString(), 3));

  // Pricing settings
  const [pafSettings, setPafSettings] = useState<PafPricingSettings>(() => getStoredPafPricingSettings());
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Financial & Currency Setup
  const initialTier = defaultProjectType === 'paf_base' ? 'paf_base' : 'paf_pro';
  const initialPlans = getComputedPafPlans(initialTier, pafSettings);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(initialPlans[0].currency);
  const [planOption, setPlanOption] = useState<'1_pago' | '2_pagos' | '3_pagos' | 'custom'>('1_pago');
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [totalAmount, setTotalAmount] = useState<number>(initialPlans[0].totalAmount);
  const [leadScore, setLeadScore] = useState<'A' | 'B' | 'C'>('A');

  if (!isOpen) return null;

  const currentPlans = getComputedPafPlans(
    projectType === 'paf_base' ? 'paf_base' : 'paf_pro',
    pafSettings
  );

  // Handle Preset Select
  const handleSelectPreset = (
    type: 'paf_pro' | 'paf_base',
    option: '1_pago' | '2_pagos' | '3_pagos',
    customSettings?: PafPricingSettings
  ) => {
    hapticFeedback.selection();
    setProjectType(type);
    setPlanOption(option);

    const plans = getComputedPafPlans(type, customSettings || pafSettings);
    const selected = plans.find(p => p.id === option) || plans[0];
    setCurrency(selected.currency);
    setInstallmentsCount(selected.installments);
    setTotalAmount(selected.totalAmount);
  };

  // When currency toggles, adapt sensible default if still on a standard preset
  const handleToggleCurrency = (newCur: 'ARS' | 'USD') => {
    hapticFeedback.medium();
    setCurrency(newCur);
    if (newCur === 'USD' && totalAmount >= 100000) {
      // Switch to reasonable USD default
      setTotalAmount(projectType === 'paf_pro' ? 1800 : 950);
    } else if (newCur === 'ARS' && totalAmount < 10000) {
      setTotalAmount(projectType === 'paf_pro' ? 1100000 : 800000);
    }
  };

  // Generate live installment preview using exact residue algorithm
  const previewInstallments = generateInstallmentSchedule({
    totalAmount: totalAmount || 0,
    currency,
    installmentsCount,
    startDate: startDate || getTodayString(),
    frequency: 'monthly',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      alert('Por favor, ingresa el nombre del Estudio de Arquitectura o Cliente.');
      return;
    }

    hapticFeedback.success();
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Prepare milestones based on selected modality
    const baseMilestones = projectType === 'paf_pro' ? PAF_PRO_MILESTONES : PAF_BASE_MILESTONES;
    const pafMilestones: PafMilestone[] = baseMilestones.map((m, idx) => ({
      ...m,
      id: `m_${Date.now()}_${idx}`,
      completed: false,
    }));

    // Prepare installments with exact residue applied
    const installments: ProjectInstallment[] = previewInstallments.map(p => ({
      id: `inst_${Date.now()}_${p.number}`,
      number: p.number,
      totalInstallments: previewInstallments.length,
      dueDate: p.dueDate,
      amount: p.amount,
      currency,
      status: 'pendiente',
      paid: false,
    }));

    // Prepare stage checklists
    const stageChecklist: Record<string, { id: string; text: string; done: boolean }[]> = {};
    Object.keys(DEFAULT_PAF_STAGE_EXIT_MILESTONES).forEach(st => {
      stageChecklist[st] = DEFAULT_PAF_STAGE_EXIT_MILESTONES[st].map(item => ({
        id: item.id,
        text: item.text,
        done: false,
      }));
    });

    const newProjectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
      clientName: clientName.trim(),
      ownerName: ownerName.trim() || undefined,
      status: 'En curso',
      notes: notes.trim(),
      archived: false,
      clientPhone: phone.trim() || undefined,
      instagramUrl: instagramUrl.trim() || undefined,
      googleMapsUrl: googleMapsUrl.trim() || undefined,
      isLead: false,
      estimatedPrice: totalAmount,
      estimatedCurrency: currency,
      projectType,
      pafStage: stage,
      pafPlan: installmentsCount === 1 ? '1_pago' : installmentsCount === 2 ? '2_pagos' : installmentsCount === 3 ? '3_pagos' : `${installmentsCount}_pagos`,
      pafConsultingHoursTotal: projectType === 'paf_pro' ? 26 : 8,
      pafConsultingHoursDone: 0,
      consultingSessions: [],
      pafMilestones,
      startDate: startDate || getTodayString(),
      deliveryDate: deliveryDate || addMonths(startDate || getTodayString(), 3),
      pafStartDate: startDate || getTodayString(),
      leadScore,
      installments,
      pafInstallmentDates: installments.map(i => ({
        number: i.number,
        dueDate: i.dueDate,
        amount: i.amount,
        paid: false,
      })),
      pafStageChecklist: stageChecklist,
    };

    onAddProject(newProjectData);
    onClose();
  };

  return (
    <ModalPortal>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
      >
        <div className="relative w-full max-w-2xl bg-[#1E1F20] border border-[#2D2F31] rounded-3xl shadow-2xl overflow-hidden my-auto text-zinc-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D2F31] bg-[#131314]/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 id={modalTitleId} className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Nuevo Cliente PAF · Estudio de Arquitectura</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Aceleración de infraestructura comercial, adquisición & ventas para arquitectos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-2xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Studio & Contact Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>1. Identidad del Estudio & Contacto</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nombre del Estudio de Arquitectura *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Ej. Estudio Cane Arquitectura"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-[#131314] border border-[#37393B] focus:border-[var(--accent)] rounded-2xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Titular / Arquitecto Responsable
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ej. Arq. Juan Cane"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full bg-[#131314] border border-[#37393B] focus:border-[var(--accent)] rounded-2xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  WhatsApp Comercial (con código de país)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ej. +54 9 11 4455-6677"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-[#131314] border border-[#37393B] focus:border-emerald-500 rounded-2xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Perfil de Instagram Institucional
                </label>
                <div className="relative">
                  <Instagram className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ej. @estudiocane.arq"
                    value={instagramUrl}
                    onChange={e => setInstagramUrl(e.target.value)}
                    className="w-full bg-[#131314] border border-[#37393B] focus:border-pink-500 rounded-2xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Ficha Google Business Profile / Maps URL
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ej. https://maps.app.goo.gl/..."
                    value={googleMapsUrl}
                    onChange={e => setGoogleMapsUrl(e.target.value)}
                    className="w-full bg-[#131314] border border-[#37393B] focus:border-sky-500 rounded-2xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Modalidad del Programa PAF */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Modalidad del Servicio PAF</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option PAF Pro */}
              <div
                onClick={() => handleSelectPreset('paf_pro', '1_pago')}
                className={`p-4 rounded-3xl border cursor-pointer transition relative flex flex-col justify-between ${
                  projectType === 'paf_pro'
                    ? 'bg-[#282A2C] border-[var(--accent)] shadow-md shadow-[var(--accent)]/10'
                    : 'bg-[#131314] border-[#37393B] hover:border-zinc-500 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-[var(--accent)]">
                      PAF Pro (12 Semanas)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
                      26 hs 1:1
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Programa integral llave en mano + consultoría estratégica semanal, web comercial, Meta Ads, Google Business, Lead Scoring y VSL.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#37393B] flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Inversión base sugerida:</span>
                  <span className="font-bold text-white font-mono">$ 1.100.000 ARS</span>
                </div>
              </div>

              {/* Option PAF Base */}
              <div
                onClick={() => handleSelectPreset('paf_base', '1_pago')}
                className={`p-4 rounded-3xl border cursor-pointer transition relative flex flex-col justify-between ${
                  projectType === 'paf_base'
                    ? 'bg-[#282A2C] border-amber-500 shadow-md shadow-amber-500/10'
                    : 'bg-[#131314] border-[#37393B] hover:border-zinc-500 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-amber-400">
                      PAF Base (Inicial)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      8 hs 1:1
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Implementación inicial: Landing Page ágil, optimización de perfiles, toolkit orgánico 30 días, taller de pauta y scripts de venta.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#37393B] flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Inversión base sugerida:</span>
                  <span className="font-bold text-white font-mono">$ 800.000 ARS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Presets de Inversión y Motor de Cuotas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. Presets Comerciales & Cuotas Exactas</span>
              </h4>

              {/* Reactive Currency Switcher Toggle */}
              <div className="inline-flex items-center p-1 rounded-2xl bg-[#131314] border border-[#37393B]">
                <button
                  type="button"
                  onClick={() => handleToggleCurrency('ARS')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    currency === 'ARS'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🇦🇷 ARS ($)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCurrency('USD')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    currency === 'USD'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🇺🇸 USD (US$)
                </button>
              </div>
            </div>

            {/* Presets Header & Action */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">
                Opciones Comerciales {projectType === 'paf_pro' ? 'PAF Pro' : 'PAF Base'}
              </span>
              <button
                type="button"
                onClick={() => setShowPricingModal(true)}
                className="text-[11px] font-semibold text-[#A8C7FA] hover:text-white flex items-center gap-1 cursor-pointer transition"
              >
                <Settings className="w-3.5 h-3.5 text-[#34C38F]" />
                <span>Configurar Precios PAF</span>
              </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-3 gap-2">
              {currentPlans.map((plan) => {
                const isSelected = planOption === plan.id;
                const curPrefix = plan.currency === 'USD' ? 'US$' : '$';
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => handleSelectPreset(projectType as 'paf_pro' | 'paf_base', plan.id)}
                    className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#004A77] text-white border-[#A8C7FA]'
                        : 'bg-[#131314] text-zinc-300 border-[#37393B] hover:border-zinc-500'
                    }`}
                  >
                    <div className="text-xs font-bold">{plan.name}</div>
                    <div className="text-[11px] font-mono mt-1 text-[#A8C7FA]">
                      {plan.installments === 1
                        ? `${curPrefix} ${plan.totalAmount.toLocaleString('es-AR')}`
                        : `${plan.installments}x ${curPrefix} ${plan.installmentAmount.toLocaleString('es-AR')}`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Amount / Cuotas Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#131314] border border-[#37393B]">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Monto Total del Contrato ({currency === 'ARS' ? '$ Pesos' : 'US$ Dólares'}):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 font-mono">
                    {currency === 'USD' ? 'US$' : '$'}
                  </span>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={e => {
                      setTotalAmount(Number(e.target.value) || 0);
                      setPlanOption('custom');
                    }}
                    className="w-full bg-[#1E1F20] border border-[#37393B] focus:border-[#A8C7FA] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Cantidad de Cuotas Mensuales:
                </label>
                <select
                  value={installmentsCount}
                  onChange={e => {
                    setInstallmentsCount(Number(e.target.value));
                    setPlanOption('custom');
                  }}
                  className="w-full bg-[#1E1F20] border border-[#37393B] focus:border-[#A8C7FA] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value={1}>1 Pago único (100% al inicio)</option>
                  <option value={2}>2 Pagos (al inicio + 30 días)</option>
                  <option value={3}>3 Pagos mensuales (1 cada mes)</option>
                  <option value={4}>4 Pagos mensuales</option>
                  <option value={6}>6 Pagos mensuales</option>
                </select>
              </div>
            </div>

            {/* Exact Live Installments Table with Residue to Last Installment */}
            <div className="p-3.5 rounded-2xl bg-[#282A2C] border border-[#37393B] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">
                  Desglose exacto de cuotas a generar ({previewInstallments.length}):
                </span>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">
                  Total inmutable: {formatCurrencyAmount(totalAmount, currency, true)}
                </span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {previewInstallments.map((inst, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#1E1F20] border border-[#37393B] text-xs font-mono"
                  >
                    <span className="text-zinc-300">
                      Cuota {inst.number} de {previewInstallments.length}
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Vence: {inst.dueDate}
                    </span>
                    <span className="text-white font-bold">
                      {formatCurrencyAmount(inst.amount, currency, false)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Fechas y Etapa Inicial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Fecha de Arranque / Kick-Off
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setDeliveryDate(addMonths(e.target.value, 3));
                }}
                className="w-full bg-[#131314] border border-[#37393B] focus:border-[var(--accent)] rounded-2xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Fecha Final Estimada (+3 Meses)
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full bg-[#131314] border border-[#37393B] focus:border-[var(--accent)] rounded-2xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Modal Bottom Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2D2F31] bg-[#131314]/90 sticky bottom-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-full bg-[var(--accent)] hover:bg-[#d04e0a] text-white text-xs font-bold shadow-lg shadow-[var(--accent)]/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Creando...' : `Crear Cliente PAF (${projectType === 'paf_pro' ? 'PAF Pro' : 'PAF Base'})`}</span>
          </button>
        </div>

        {/* Dynamic PAF Pricing Settings Modal */}
        <PafPricingConfigModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          onSaved={(newSettings) => {
            setPafSettings(newSettings);
            handleSelectPreset(
              projectType as 'paf_pro' | 'paf_base',
              planOption === 'custom' ? '1_pago' : planOption,
              newSettings
            );
          }}
        />
        </div>
      </div>
    </ModalPortal>
  );
};
