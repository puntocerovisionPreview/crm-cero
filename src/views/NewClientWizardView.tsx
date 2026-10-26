import React, { useState } from 'react';
import { 
  Award, 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Sparkles, 
  Building2, 
  User, 
  Phone, 
  Instagram, 
  DollarSign, 
  Calendar, 
  ShieldCheck,
  Zap,
  CheckCircle2,
  Wallet,
  Plus,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { 
  Project, 
  ProjectType, 
  ProjectInstallment, 
  PafMilestone, 
  Payment, 
  PaymentMethod, 
  FlexiblePaymentCommitment, 
  IncomeRecord, 
  PersonalAccount,
  BillingAgreement,
  BillingInstallment,
  BillingAgreementType
} from '../types';
import { hapticFeedback } from '../utils/haptics';
import { validClientEmail } from '../automation/webRecipe';
import { getTodayString, addDays } from '../utils/storage';
import { addMonths } from '../utils/projectTimeline';
import { 
  PAF_PRO_PRICING, 
  PAF_BASE_PRICING, 
  PAF_PRO_MILESTONES, 
  PAF_BASE_MILESTONES 
} from '../utils/pafTemplates';

interface Props {
  onBack: () => void;
  onAddProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string | void> | string | void;
  onNavigateToProject: (projectId: string) => void;
  onAddIncome?: (income: Omit<IncomeRecord, 'id' | 'createdAt'>) => void;
  personalAccounts?: PersonalAccount[];
}

export const NewClientWizardView: React.FC<Props> = ({
  onBack,
  onAddProject,
  onNavigateToProject,
  onAddIncome,
  personalAccounts = [],
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [serviceType, setServiceType] = useState<'paf' | 'web' | 'otro'>('paf');
  const [pafPlanType, setPafPlanType] = useState<'paf_pro' | 'paf_base'>('paf_pro');

  // Client Data
  const [clientName, setClientName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [rubro, setRubro] = useState('Arquitectura');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Commercial Proposal
  const defaultPro3 = PAF_PRO_PRICING.find(p => p.id === '3_pagos')?.totalAmount || 1650000;
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [price, setPrice] = useState<number>(defaultPro3);
  const [installmentsCount, setInstallmentsCount] = useState<1 | 2 | 3>(3);
  const [leadScore, setLeadScore] = useState<'A' | 'B' | 'C'>('A');

  // Agreement and Flexible Billing State
  const [agreementType, setAgreementType] = useState<BillingAgreementType>('cuotas');
  const [dueDayRule, setDueDayRule] = useState<number>(10);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PaymentMethod>('transferencia');
  const [agreementNotes, setAgreementNotes] = useState<string>('');
  const [billingOption, setBillingOption] = useState<'indefinido' | 'sena' | 'cuotas'>('indefinido');

  // Option B: Seña / Primer pago
  const [senaAmount, setSenaAmount] = useState<number | ''>('');
  const [senaDate, setSenaDate] = useState(getTodayString());
  const [senaMethod, setSenaMethod] = useState<PaymentMethod>('transferencia');
  const [senaNote, setSenaNote] = useState('');
  const [senaDestAccountId, setSenaDestAccountId] = useState('');

  // Option C: Cuotas / Compromisos flexibles
  const [customCommitments, setCustomCommitments] = useState<{ id: string; title: string; amount: number; dueDate: string }[]>([
    { id: 'cmt_1', title: 'Anticipo 50%', amount: Math.floor(defaultPro3 / 2), dueDate: getTodayString() },
    { id: 'cmt_2', title: 'Entrega final 50%', amount: defaultPro3 - Math.floor(defaultPro3 / 2), dueDate: addMonths(getTodayString(), 1) },
  ]);

  // Dates
  const [startDate, setStartDate] = useState(getTodayString());
  const [deliveryDate, setDeliveryDate] = useState(() => {
    return addMonths(getTodayString(), 3);
  });

  const applyCommitmentTemplate = (tpl: 'unico' | '50_50' | '40_30_30' | 'iguales_3' | 'retainer' | 'por_hora') => {
    hapticFeedback.light();
    const tot = Math.max(0, Math.round(price));
    if (tpl === 'unico') {
      setAgreementType('unico');
      setCustomCommitments([
        { id: `c_${Date.now()}_1`, title: 'Pago Único (100%)', amount: tot, dueDate: startDate }
      ]);
    } else if (tpl === '50_50') {
      setAgreementType('hitos');
      const c1 = Math.floor(tot / 2);
      const c2 = tot - c1;
      setCustomCommitments([
        { id: `c_${Date.now()}_1`, title: 'Anticipo 50%', amount: c1, dueDate: startDate },
        { id: `c_${Date.now()}_2`, title: 'Entrega Final 50%', amount: c2, dueDate: addMonths(startDate, 1) },
      ]);
    } else if (tpl === '40_30_30') {
      setAgreementType('hitos');
      const c1 = Math.round(tot * 0.4);
      const c2 = Math.round(tot * 0.3);
      const c3 = tot - c1 - c2;
      setCustomCommitments([
        { id: `c_${Date.now()}_1`, title: 'Anticipo Kick-Off (40%)', amount: c1, dueDate: startDate },
        { id: `c_${Date.now()}_2`, title: 'Hito Intermedio (30%)', amount: c2, dueDate: addDays(startDate, 20) },
        { id: `c_${Date.now()}_3`, title: 'Entrega Final (30%)', amount: c3, dueDate: addMonths(startDate, 2) },
      ]);
    } else if (tpl === 'iguales_3') {
      setAgreementType('cuotas');
      const base = Math.floor(tot / 3);
      const res = tot - (base * 3);
      setCustomCommitments([
        { id: `c_${Date.now()}_1`, title: 'Cuota 1 de 3', amount: base, dueDate: startDate },
        { id: `c_${Date.now()}_2`, title: 'Cuota 2 de 3', amount: base, dueDate: addMonths(startDate, 1) },
        { id: `c_${Date.now()}_3`, title: 'Cuota 3 de 3', amount: base + res, dueDate: addMonths(startDate, 2) },
      ]);
    } else if (tpl === 'retainer') {
      setAgreementType('retainer');
      setCustomCommitments([
        { id: `c_${Date.now()}_1`, title: 'Abono Mes 1', amount: tot, dueDate: startDate },
        { id: `c_${Date.now()}_2`, title: 'Abono Mes 2', amount: tot, dueDate: addMonths(startDate, 1) },
        { id: `c_${Date.now()}_3`, title: 'Abono Mes 3', amount: tot, dueDate: addMonths(startDate, 2) },
      ]);
    } else if (tpl === 'por_hora') {
      setAgreementType('por_hora');
      setCustomCommitments([
        { id: `c_${Date.now()}_1`, title: 'Horas / Trabajo suelto', amount: tot, dueDate: startDate },
      ]);
    }
  };

  const handleAddCommitment = () => {
    hapticFeedback.light();
    setCustomCommitments(prev => [
      ...prev,
      {
        id: `c_${Date.now()}`,
        title: `Cuota ${prev.length + 1}`,
        amount: 0,
        dueDate: addMonths(startDate, prev.length),
      }
    ]);
  };

  const handleRemoveCommitment = (index: number) => {
    hapticFeedback.light();
    setCustomCommitments(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateCommitment = (index: number, updates: Partial<{ title: string; amount: number; dueDate: string }>) => {
    setCustomCommitments(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  // Handle Preset selection for PAF
  const handleSelectPafPreset = (type: 'pro' | 'base', count: 1 | 2 | 3) => {
    hapticFeedback.selection();
    const pricingList = type === 'pro' ? PAF_PRO_PRICING : PAF_BASE_PRICING;
    const planKey = count === 1 ? '1_pago' : count === 2 ? '2_pagos' : '3_pagos';
    const found = pricingList.find(p => p.id === planKey);

    if (type === 'pro') {
      setPafPlanType('paf_pro');
    } else {
      setPafPlanType('paf_base');
    }
    setCurrency('ARS');
    setInstallmentsCount(count);
    if (found) {
      setPrice(found.totalAmount);
    }
  };

  // Handle Finish Wizard
  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clientEmail.trim() && !validClientEmail(clientEmail)) {
      setEmailError('Revisá el correo del cliente.'); setCurrentStep(2); return;
    }
    if (!clientName.trim()) {
      setCurrentStep(2);
      return;
    }

    hapticFeedback.heavy();

    // Flexible payments & commitments resolution
    let payments: Payment[] | undefined = undefined;
    let paymentCommitments: FlexiblePaymentCommitment[] | undefined = undefined;
    const legacyInstallments: ProjectInstallment[] = [];

    if (billingOption === 'sena' && senaAmount && Number(senaAmount) > 0) {
      const paymentId = `pay_${Date.now()}`;
      const incomeId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      payments = [
        {
          id: paymentId,
          projectId: '', // will be associated
          amount: Number(senaAmount),
          currency,
          date: senaDate || getTodayString(),
          method: senaMethod,
          note: senaNote.trim() || 'Seña / Pago inicial',
          destinationAccountId: senaDestAccountId && senaDestAccountId !== 'none' ? senaDestAccountId : undefined,
          incomeRecordId: incomeId,
          createdAt: getTodayString(),
        }
      ];

      // Auto-create income record for the initial payment
      if (onAddIncome) {
        onAddIncome({
          title: senaNote.trim() ? `${senaNote.trim()} (${clientName.trim()})` : `Seña de ${clientName.trim()}`,
          concept: senaNote.trim() || `Cobro inicial ${clientName.trim()}`,
          amount: Number(senaAmount),
          currency,
          date: senaDate || getTodayString(),
          month: (senaDate || getTodayString()).slice(0, 7),
          status: 'cobrado',
          projectName: clientName.trim(),
        });
      }
    } else if (billingOption === 'cuotas' && customCommitments.length > 0) {
      paymentCommitments = customCommitments.map((c, idx) => ({
        id: c.id || `cmt_${Date.now()}_${idx + 1}`,
        title: c.title,
        amount: Number(c.amount) || 0,
        dueDate: c.dueDate || getTodayString(),
        currency,
        status: 'pendiente',
        clientName: clientName.trim(),
      }));

      // Backward compatibility with legacy installments
      paymentCommitments.forEach((cmt, i) => {
        legacyInstallments.push({
          id: cmt.id,
          number: i + 1,
          totalInstallments: paymentCommitments?.length,
          amount: cmt.amount,
          currency,
          dueDate: cmt.dueDate,
          paid: false,
          note: cmt.title,
        });
      });
    }

    const milestonesSource = pafPlanType === 'paf_pro' ? PAF_PRO_MILESTONES : PAF_BASE_MILESTONES;
    const populatedMilestones: PafMilestone[] = milestonesSource.map((m, idx) => ({
      ...m,
      id: `m_${Date.now()}_${idx}`,
      completed: false,
    }));

    const billingAgreementInstallments: BillingInstallment[] = legacyInstallments.map((inst, idx) => ({
      id: inst.id || `inst_${Date.now()}_${idx + 1}`,
      number: inst.number,
      totalInstallments: legacyInstallments.length,
      title: inst.note || `Cuota ${inst.number}`,
      dueDate: inst.dueDate,
      expectedAmount: inst.amount,
      currency,
      actualPaidAmount: inst.paid ? inst.amount : 0,
      paidAt: inst.paidAt,
      status: inst.paid ? 'pagado_a_tiempo' : 'pendiente',
    }));

    const billingAgreement: BillingAgreement = {
      id: `agr_${Date.now()}`,
      type: billingOption === 'cuotas' ? agreementType : 'cuotas',
      title: clientName.trim(),
      currency,
      totalAmount: price,
      monthlyAmount: agreementType === 'retainer' ? (price || Number(senaAmount) || 0) : undefined,
      installmentsCount: billingAgreementInstallments.length,
      startDate,
      endDate: agreementType === 'retainer' ? undefined : deliveryDate,
      dueDayRule: dueDayRule || 10,
      preferredPaymentMethod,
      notes: agreementNotes.trim() || undefined,
      installments: billingAgreementInstallments,
    };

    const newProjectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
      clientName: clientName.trim(),
      ownerName: ownerName.trim() || undefined,
      rubro: rubro.trim() || undefined,
      status: serviceType === 'paf' ? 'Kick-Off & Diagnóstico' : 'No iniciado',
      notes: `Alta generada mediante Asistente de Clientes. Rubro: ${rubro.trim() || 'General'}. Modalidad: ${
        serviceType === 'paf' ? (pafPlanType === 'paf_pro' ? 'PAF Pro (12 sem / 26h)' : 'PAF Base') : 'Desarrollo Web'
      }.`,
      archived: false,
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim().toLowerCase() || undefined,
      instagramUrl: instagramUrl.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
      // Financial Flexibility:
      montoAcordado: price,
      estimatedPrice: price,
      estimatedCurrency: currency,
      billingAgreement,
      payments,
      paymentCommitments,
      installments: legacyInstallments.length > 0 ? legacyInstallments : undefined,
      serviceType,
      projectType: serviceType === 'paf' ? pafPlanType : serviceType,
      pafStage: serviceType === 'paf' ? 'Kick-Off & Diagnóstico' : undefined,
      pafConsultingHoursTotal: serviceType === 'paf' ? (pafPlanType === 'paf_pro' ? 26 : 14) : undefined,
      pafConsultingHoursDone: 0,
      pafMilestones: serviceType === 'paf' ? populatedMilestones : undefined,
      startDate,
      deliveryDate,
      leadScore: serviceType === 'paf' ? leadScore : undefined,
    };

    const res = await onAddProject(newProjectData);
    if (res && typeof res === 'string') {
      onNavigateToProject(res);
    } else {
      onBack();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 text-zinc-100 overflow-y-auto">
      {/* Header */}
      <div 
        style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.65rem))' }}
        className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3.5 flex items-center justify-between touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onBack();
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-semibold touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <h1 className="text-sm font-bold text-zinc-100">
            Nuevo Cliente / Proyecto
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(stepNum => (
            <div
              key={stepNum}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition ${
                currentStep === stepNum
                  ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/25'
                  : currentStep > stepNum
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
              }`}
            >
              {currentStep > stepNum ? <Check className="w-3 h-3 stroke-[3]" /> : stepNum}
            </div>
          ))}
        </div>
      </div>

      {/* Main Wizard Content */}
      <div className="max-w-2xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-between">
        
        {/* STEP 1: Tipo de Servicio */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] font-bold">
                Paso 1 de 4
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-100 mt-1">
                ¿Qué tipo de servicio vas a dar de alta?
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Seleccioná el modelo de trabajo para configurar las etapas y finanzas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Programa PAF */}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  setServiceType('paf');
                  setCurrency('ARS');
                  const pro3 = PAF_PRO_PRICING.find(p => p.id === '3_pagos')?.totalAmount || 1650000;
                  setPrice(pro3);
                }}
                className={`p-5 rounded-2xl border text-left transition cursor-pointer relative ${
                  serviceType === 'paf'
                    ? 'bg-gradient-to-b from-[var(--accent)]/15 to-zinc-900/90 border-[var(--accent)] shadow-lg shadow-[var(--accent)]/10'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]/40 flex items-center justify-center text-[var(--accent)] mb-3">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-zinc-100 mb-1">
                  Programa PAF (.Cero)
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Aceleración comercial para estudios de arquitectura. Mentoría 1:1, 5 etapas y plan de cuotas mensuales.
                </p>
                <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-bold">
                  26hs de Consultoría • 12 Semanas
                </span>
              </button>

              {/* Option 2: Desarrollo Web */}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  setServiceType('web');
                  setCurrency('USD');
                  setPrice(450);
                  setInstallmentsCount(2);
                }}
                className={`p-5 rounded-2xl border text-left transition cursor-pointer relative ${
                  serviceType === 'web'
                    ? 'bg-gradient-to-b from-blue-500/15 to-zinc-900/90 border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mb-3">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-zinc-100 mb-1">
                  Desarrollo Web
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Diseño y desarrollo web institucional para arquitectos. Esquema simple 50% anticipo / 50% entrega.
                </p>
                <span className="inline-block px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                  Esquema 50/50 • Figma & Código
                </span>
              </button>

              {/* Option 3: Cliente a Medida / Cualquier Rubro */}
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  setServiceType('otro');
                  setCurrency('USD');
                  setPrice(500);
                  setRubro('General');
                }}
                className={`p-5 rounded-2xl border text-left transition cursor-pointer relative sm:col-span-2 ${
                  serviceType === 'otro'
                    ? 'bg-gradient-to-b from-purple-500/15 to-zinc-900/90 border-purple-500 shadow-lg shadow-purple-500/10'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-zinc-100 mb-1">
                  Cualquier Rubro / Servicio a Medida
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Consultoría, diseño, desarrollo, abono mensual (retainer), hitos, pago único o por horas. Sin campos innecesarios.
                </p>
                <span className="inline-block px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                  Cuotas • Abono Retainer • Hitos • Por Hora • Pago Único
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Datos del Estudio */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] font-bold">
                Paso 2 de 4
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-100 mt-1">
                Datos del Estudio y Contacto
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Ingresá la información clave para tener accesos directos por WhatsApp y llamadas.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Nombre del Estudio / Cliente *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Estudio Cane Arquitectura o Empresa XYZ"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Rubro o Especialidad del Cliente
                </label>
                <input
                  type="text"
                  placeholder="Ej: Arquitectura, Desarrollo Software, Diseño, Marketing, Salud, Consultoría"
                  value={rubro}
                  onChange={e => setRubro(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {['Arquitectura', 'Desarrollo Software', 'Diseño UI/UX', 'Marketing & Ads', 'Consultoría', 'Salud / Médico', 'Comercio'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        hapticFeedback.light();
                        setRubro(r);
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                        rubro === r ? 'bg-zinc-800 text-emerald-400 border-emerald-500/40 font-bold' : 'text-zinc-400 border-zinc-800 hover:bg-zinc-800/50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Titular o Arquitecto Responsable
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Ej: Arq. Juan Cane"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  WhatsApp Comercial (con código de país)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    placeholder="Ej: +54 9 11 3844 5599"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">Correo del cliente</label>
                <input type="email" value={clientEmail} onChange={e => { setClientEmail(e.target.value); setEmailError(''); }} placeholder="cliente@gmail.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100" />
                <p className="text-xs text-zinc-500 mt-1">Para compartir las carpetas de Drive. Si lo dejás vacío, el acceso queda pendiente.</p>
                {emailError && <p role="alert" className="text-xs text-red-400">{emailError}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Instagram del Estudio
                  </label>
                  <div className="relative">
                    <Instagram className="w-4 h-4 text-pink-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Ej: @estudiocane"
                      value={instagramUrl}
                      onChange={e => setInstagramUrl(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                    Sitio Web o Staging
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Ej: estudiocane.com"
                      value={websiteUrl}
                      onChange={e => setWebsiteUrl(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Propuesta Comercial & Cobro Flexible */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] font-bold">
                Paso 3 de 4
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-100 mt-1">
                Acuerdo Comercial y Cobro
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                El precio acordado es solo una referencia. Podés registrar una seña ahora, dividir en pagos o completarlo después.
              </p>
            </div>

            {/* Presets rápidos PAF si es servicio PAF */}
            {serviceType === 'paf' && (
              <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="text-xs font-bold text-zinc-300">
                  Valores sugeridos del Método PAF:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPafPreset('pro', 3)}
                    className={`p-2 rounded-xl border text-center text-xs transition cursor-pointer ${
                      pafPlanType === 'paf_pro' && installmentsCount === 3
                        ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)] font-bold'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-mono">PAF Pro</div>
                    <div>3 Cuotas</div>
                    <div className="font-mono text-[10px] text-zinc-300">
                      $ {(PAF_PRO_PRICING.find(p => p.id === '3_pagos')?.installmentAmount || 550000).toLocaleString('es-AR')} c/u
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPafPreset('pro', 1)}
                    className={`p-2 rounded-xl border text-center text-xs transition cursor-pointer ${
                      pafPlanType === 'paf_pro' && installmentsCount === 1
                        ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent)] font-bold'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-mono">PAF Pro</div>
                    <div>Contado</div>
                    <div className="font-mono text-[10px] text-zinc-300">
                      $ {(PAF_PRO_PRICING.find(p => p.id === '1_pago')?.totalAmount || 1100000).toLocaleString('es-AR')}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPafPreset('base', 3)}
                    className={`p-2 rounded-xl border text-center text-xs transition cursor-pointer ${
                      pafPlanType === 'paf_base' && installmentsCount === 3
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-mono">PAF Base</div>
                    <div>3 Cuotas</div>
                    <div className="font-mono text-[10px] text-zinc-300">
                      $ {(PAF_BASE_PRICING.find(p => p.id === '3_pagos')?.installmentAmount || 370000).toLocaleString('es-AR')} c/u
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Monto Acordado & Moneda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Monto Total Acordado (Referencia)
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min="0"
                    value={price || ''}
                    onChange={e => setPrice(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-100 font-mono font-bold focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Monto total del proyecto"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Moneda del Proyecto
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as 'ARS' | 'USD')}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100 font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                >
                  <option value="USD">USD ($ Dólares)</option>
                  <option value="ARS">ARS ($ Pesos Argentinos)</option>
                </select>
              </div>
            </div>

            {/* Selector de Modalidad de Cobro: 3 Opciones Flexibles */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-zinc-300">
                ¿Cómo querés registrar el cobro de este cliente?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Opción A: Todavía no definí cómo cobra */}
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setBillingOption('indefinido');
                  }}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    billingOption === 'indefinido'
                      ? 'bg-zinc-800/90 border-[var(--accent)] ring-1 ring-[var(--accent)]'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-zinc-100">
                      Todavía no definí cómo cobra
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Guarda solo el monto total pactado. Cero cuotas obligatorias.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 mt-2 block">
                    Más flexible
                  </span>
                </button>

                {/* Opción B: Ya me señó / pagó algo */}
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setBillingOption('sena');
                    if (!senaAmount && price > 0) {
                      setSenaAmount(Math.round(price * 0.5));
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    billingOption === 'sena'
                      ? 'bg-emerald-950/20 border-emerald-500 ring-1 ring-emerald-500'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-zinc-100">
                      Ya me señó / pagó algo
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Registra el primer pago recibido ahora mismo en 1 solo paso.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 mt-2 block">
                    Ingreso inmediato
                  </span>
                </button>

                {/* Opción C: Dividir en pagos */}
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.selection();
                    setBillingOption('cuotas');
                    if (customCommitments.length === 0 && price > 0) {
                      applyCommitmentTemplate('50_50');
                    }
                  }}
                  className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    billingOption === 'cuotas'
                      ? 'bg-blue-950/20 border-blue-500 ring-1 ring-blue-500'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-zinc-100">
                      Dividir en pagos
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Plantillas 100%, 50/50, 40/30/30 o cuotas libres y editables.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-blue-400 mt-2 block">
                    Compromisos
                  </span>
                </button>
              </div>
            </div>

            {/* DETALLE OPCIÓN B: Registro de Seña / Primer Pago */}
            {billingOption === 'sena' && (
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-zinc-100">
                      Datos del Primer Pago / Seña
                    </h4>
                  </div>
                  {price > 0 && (
                    <button
                      type="button"
                      onClick={() => setSenaAmount(price)}
                      className="text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer"
                    >
                      Pagar total ({currency} {price.toLocaleString()})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                      Monto Cobrado *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={senaAmount}
                      onChange={e => setSenaAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Monto señado"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                      Fecha del Pago *
                    </label>
                    <input
                      type="date"
                      value={senaDate}
                      onChange={e => setSenaDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                      Medio de Pago
                    </label>
                    <select
                      value={senaMethod}
                      onChange={e => setSenaMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="transferencia">Transferencia bancaria</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="mercadopago">MercadoPago</option>
                      <option value="usdt">Cripto (USDT)</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  {personalAccounts.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                        ¿En qué cuenta ingresó? (Mis Finanzas)
                      </label>
                      <select
                        value={senaDestAccountId}
                        onChange={e => setSenaDestAccountId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">No acreditar en personal</option>
                        {personalAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                    Nota opcional
                  </label>
                  <input
                    type="text"
                    value={senaNote}
                    onChange={e => setSenaNote(e.target.value)}
                    placeholder="Ej: Seña 50% para inicio de diseño"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* DETALLE OPCIÓN C: Esquema de Pagos y Cuotas Editables */}
            {billingOption === 'cuotas' && (
              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-blue-500/40 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold text-zinc-100">
                      Plantillas y Cronograma de Cuotas
                    </h4>
                  </div>

                  {/* Plantillas Rápidas */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-mono text-zinc-500">Plantillas:</span>
                    <button
                      type="button"
                      onClick={() => applyCommitmentTemplate('unico')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer ${
                        agreementType === 'unico' ? 'bg-blue-600 text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCommitmentTemplate('50_50')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer ${
                        agreementType === 'hitos' && customCommitments.length === 2 ? 'bg-blue-600 text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      50/50
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCommitmentTemplate('40_30_30')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer ${
                        agreementType === 'hitos' && customCommitments.length === 3 ? 'bg-blue-600 text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      40/30/30
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCommitmentTemplate('iguales_3')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer ${
                        agreementType === 'cuotas' ? 'bg-blue-600 text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      3 Cuotas
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCommitmentTemplate('retainer')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer ${
                        agreementType === 'retainer' ? 'bg-emerald-600 text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      Retainer
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCommitmentTemplate('por_hora')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition cursor-pointer ${
                        agreementType === 'por_hora' ? 'bg-amber-600 text-white font-bold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      Por Hora
                    </button>
                  </div>
                </div>

                {/* Lista de Cuotas Editables */}
                <div className="space-y-2">
                  {customCommitments.map((cmt, idx) => (
                    <div
                      key={cmt.id}
                      className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          value={cmt.title}
                          onChange={e => handleUpdateCommitment(idx, { title: e.target.value })}
                          placeholder={`Cuota ${idx + 1}`}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={cmt.amount || ''}
                            onChange={e => handleUpdateCommitment(idx, { amount: Number(e.target.value) })}
                            placeholder="Monto"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-2 pr-8 py-1.5 text-xs font-mono font-bold text-zinc-100 focus:outline-none focus:border-blue-500"
                          />
                          <span className="absolute right-2 top-2 text-[10px] font-mono text-zinc-500">
                            {currency}
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          type="date"
                          value={cmt.dueDate}
                          onChange={e => handleUpdateCommitment(idx, { dueDate: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveCommitment(idx)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition cursor-pointer"
                          title="Eliminar cuota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleAddCommitment}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Agregar cuota</span>
                  </button>

                  <div className="text-xs font-mono text-zinc-400">
                    Suma: <strong className="text-zinc-100">{currency} {customCommitments.reduce((sum, c) => sum + (Number(c.amount) || 0), 0).toLocaleString()}</strong>
                    {price > 0 && ` de ${price.toLocaleString()}`}
                  </div>
                </div>

                {/* Parámetros adicionales del acuerdo */}
                <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                      Medio de cobro preferido
                    </label>
                    <select
                      value={preferredPaymentMethod}
                      onChange={e => setPreferredPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="transferencia">Transferencia bancaria / CBU</option>
                      <option value="mercado_pago">Mercado Pago / CVU</option>
                      <option value="cripto">Cripto (USDT / USDC)</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="otro">Otro medio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                      Día habitual de vencimiento (1 al 31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dueDayRule}
                      onChange={e => setDueDayRule(Math.max(1, Math.min(31, Number(e.target.value) || 10)))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                      Notas libres del acuerdo (opcional)
                    </label>
                    <input
                      type="text"
                      value={agreementNotes}
                      onChange={e => setAgreementNotes(e.target.value)}
                      placeholder="Ej: Cobrar antes del día 10, enviar factura tipo A, etc."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Botón para saltear paso */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setBillingOption('indefinido');
                  setCurrentStep(4);
                }}
                className="text-xs text-zinc-400 hover:text-zinc-200 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Omitir este paso y definir cobros más adelante</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Fechas & Confirmación */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] font-bold">
                Paso 4 de 4
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-100 mt-1">
                Fechas y Confirmación Final
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Verificá el resumen antes de activar el cliente en el CRM.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Fecha de Entrega / Graduación
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Resumen de la Ficha:
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Estudio:</span>
                  <span className="font-bold text-zinc-100">{clientName || 'Sin definir'}</span>
                </div>
                {ownerName && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Titular:</span>
                    <span className="text-zinc-200">{ownerName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Servicio:</span>
                  <span className="text-[var(--accent)] font-bold">
                    {serviceType === 'paf' ? (pafPlanType === 'paf_pro' ? 'PAF Pro (12 sem / 26h)' : 'PAF Base') : 'Desarrollo Web'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Monto total acordado:</span>
                  <span className="font-mono font-bold text-zinc-100">
                    {currency} {price.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Esquema de cobro:</span>
                  <span className="text-zinc-200 font-medium">
                    {billingOption === 'sena' 
                      ? `Seña de ${currency} ${Number(senaAmount || 0).toLocaleString()} registrada` 
                      : billingOption === 'cuotas' 
                      ? `${customCommitments.length} cuotas pactadas` 
                      : 'Cobro flexible (a definir desde la ficha)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-6 mt-6 border-t border-zinc-800/80 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setCurrentStep((prev) => (prev - 1) as any);
              }}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              Cancelar
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              disabled={currentStep === 2 && !clientName.trim()}
              onClick={() => {
                if (currentStep === 2 && !clientName.trim()) return;
                hapticFeedback.light();
                setCurrentStep((prev) => (prev + 1) as any);
              }}
              className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[var(--accent)]/20 cursor-pointer"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Crear Cliente & Abrir Ficha</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
