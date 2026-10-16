import React, { useState } from 'react';
import { 
  Award, 
  Keyboard, 
  Clock, 
  DollarSign, 
  HelpCircle, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Target, 
  Zap, 
  TrendingUp, 
  FileText,
  Search,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { 
  PAF_PRO_PRICING, 
  PAF_BASE_PRICING, 
  PAF_LEAD_SCORING_INFO, 
  PAF_SALES_OBJECTIONS 
} from '../utils/pafTemplates';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  privacyMode?: boolean;
}

export const AyudaView: React.FC<Props> = ({ privacyMode = false }) => {
  type HelpTab = 'paf' | 'atajos' | 'productividad' | 'finanzas';
  const [activeTab, setActiveTab] = useState<HelpTab>('paf');
  const [pafSubTab, setPafSubTab] = useState<'ofertas' | 'scoring' | 'objeciones'>('ofertas');
  const [shortcutSearch, setShortcutSearch] = useState('');

  const formatARS = (amount: number) => {
    if (privacyMode) return '$ ••••••';
    return `$ ${amount.toLocaleString('es-AR')}`;
  };

  const KEYBOARD_SHORTCUTS = [
    { key: '⌘ + K / Ctrl + K', label: 'Buscador Global (Command Palette)', category: 'Navegación' },
    { key: '1', label: 'Ir a Agenda', category: 'Navegación' },
    { key: '2', label: 'Ir a Clientes & Proyectos', category: 'Navegación' },
    { key: '3', label: 'Ir a Finanzas', category: 'Navegación' },
    { key: '4', label: 'Ir a Ayuda / Atajos', category: 'Navegación' },
    { key: 'T', label: 'Nueva Tarea rápida', category: 'Acciones' },
    { key: 'R', label: 'Nueva Reunión 1:1', category: 'Acciones' },
    { key: 'P', label: 'Nuevo Cliente / Proyecto', category: 'Acciones' },
    { key: 'I', label: 'Nuevo Ingreso (Cobro)', category: 'Finanzas' },
    { key: 'G', label: 'Nuevo Gasto', category: 'Finanzas' },
    { key: 'F', label: 'Iniciar / Pausar Pomodoro', category: 'Enfoque' },
    { key: 'H', label: 'Ocultar / Mostrar cifras (Modo Privacidad)', category: 'Privacidad' },
    { key: 'L', label: 'Bloquear sesión con PIN', category: 'Seguridad' },
    { key: 'Esc', label: 'Cerrar selector o panel activo', category: 'General' },
  ];

  const filteredShortcuts = KEYBOARD_SHORTCUTS.filter(
    s => s.label.toLowerCase().includes(shortcutSearch.toLowerCase()) ||
         s.key.toLowerCase().includes(shortcutSearch.toLowerCase()) ||
         s.category.toLowerCase().includes(shortcutSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 text-zinc-100 overflow-y-auto">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between safe-area-top-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100">
              Centro de Ayuda & Metodología .Cero
            </h1>
            <p className="text-[10px] text-zinc-500">
              Método PAF, Atajos de Teclado y Buenas Prácticas
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          {[
            { id: 'paf' as HelpTab, label: 'Método PAF', icon: Award },
            { id: 'atajos' as HelpTab, label: 'Atajos Teclado', icon: Keyboard },
            { id: 'productividad' as HelpTab, label: 'Enfoque & Pomodoro', icon: Clock },
            { id: 'finanzas' as HelpTab, label: 'Finanzas 50/50', icon: DollarSign },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* ================= TAB 1: METODO PAF ================= */}
        {activeTab === 'paf' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Secondary PAF Subtabs */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              {[
                { id: 'ofertas' as const, label: '1. Ofertas PAF Pro vs Base', icon: Award },
                { id: 'scoring' as const, label: '2. Scoring de Prospectos', icon: Target },
                { id: 'objeciones' as const, label: '3. Manejo de Objeciones', icon: MessageSquare },
              ].map(sub => {
                const Icon = sub.icon;
                const isCur = pafSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      setPafSubTab(sub.id);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isCur
                        ? 'bg-zinc-800 text-[var(--accent)] border border-[var(--accent)]/40'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Subtab: Ofertas */}
            {pafSubTab === 'ofertas' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PAF Pro */}
                  <div className="bg-zinc-900/90 border border-[var(--accent)]/40 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)]/10 rounded-bl-full pointer-events-none" />
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-mono font-bold">
                        PROGRAMA ESTRELLA (12 SEMANAS · 26HS)
                      </span>
                      <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                    </div>

                    <h3 className="text-lg font-black text-zinc-100">
                      Método PAF Pro (Aceleración 360°)
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Programa intensivo de 12 semanas con 26 horas de consultoría 1:1, VSL, pauta en Meta Ads y web de alta conversión.
                    </p>

                    <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                      {PAF_PRO_PRICING.map(plan => (
                        <div key={plan.id} className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400">{plan.name}:</span>
                          <span className="font-mono font-bold text-zinc-100">
                            {formatARS(plan.installmentAmount)} {plan.installments > 1 ? `x ${plan.installments}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80">
                      <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
                        Incluye:
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-400">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                          <span>26 horas de consultoría y mentoría 1:1 en vivo</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                          <span>Web comercial de alta conversión para arquitectos</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                          <span>Guion y producción de VSL + Setup de Meta Ads</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 mt-0.5" />
                          <span>Google Business Profile SEO Local + Lead Scoring A/B/C</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* PAF Base */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono font-bold">
                        PLAN BASE (12 SEMANAS · 14HS)
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-zinc-100">
                      Método PAF Base (Mentoring Esencial)
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Programa formativo y de implementación esencial para arquitectos individuales o estudios en fase de despegue.
                    </p>

                    <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                      {PAF_BASE_PRICING.map(plan => (
                        <div key={plan.id} className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400">{plan.name}:</span>
                          <span className="font-mono font-bold text-zinc-100">
                            {formatARS(plan.installmentAmount)} {plan.installments > 1 ? `x ${plan.installments}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80">
                      <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-2">
                        Incluye:
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-400">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                          <span>14 horas de consultoría 1:1</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                          <span>Landing page comercial orientada a comitentes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                          <span>Taller de pauta publicitaria y scripts de ventas</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Subtab: Scoring */}
            {pafSubTab === 'scoring' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(PAF_LEAD_SCORING_INFO).map(([key, s]) => (
                    <div key={key} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                          key === 'A' ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : key === 'B' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {key}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-100">{s.label}</h4>
                          <span className="text-[10px] text-zinc-500 font-mono">{s.badge}</span>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed pt-1 border-t border-zinc-800/80">
                        {s.criteria}
                      </p>
                      <p className="text-xs text-zinc-300 font-medium pt-1">
                        Acción: {s.action}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subtab: Objeciones */}
            {pafSubTab === 'objeciones' && (
              <div className="space-y-3">
                {PAF_SALES_OBJECTIONS.map((obj, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-black text-[var(--accent)] flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Objeción: {obj.objection}</span>
                    </h4>
                    <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-3 rounded-xl border border-zinc-800 font-mono">
                      {obj.rebuttal}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: ATAJOS DE TECLADO ================= */}
        {activeTab === 'atajos' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  Atajos Rápidos de Teclado
                </h3>
                <p className="text-xs text-zinc-400">
                  Acelerá tu flujo de trabajo sin levantar las manos del teclado.
                </p>
              </div>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar atajo..."
                  value={shortcutSearch}
                  onChange={e => setShortcutSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredShortcuts.map((s, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/90 flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-200">{s.label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{s.category}</span>
                  </div>
                  <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono font-bold text-zinc-300 shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: PRODUCTIVIDAD & POMODORO ================= */}
        {activeTab === 'productividad' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--accent)]" />
                <span>Bloques de Tiempo & Técnica Pomodoro para Agencias</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El CRM incorpora un temporizador persistente de 25 minutos de enfoque profundo y 5 minutos de pausa corta.
                Podés asociar cada bloque de tiempo a un cliente o tarea específica para contabilizar horas reales de entrega.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <span className="text-xs font-bold text-zinc-200">1. Enfoque Profundo (25m)</span>
                <p className="text-xs text-zinc-400">Sin interrupciones, notificaciones silenciadas y una sola tarea a la vez.</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <span className="text-xs font-bold text-zinc-200">2. Pausa Corta (5m)</span>
                <p className="text-xs text-zinc-400">Desconexión visual, agua y respiración para recargar energía cognitiva.</p>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                <span className="text-xs font-bold text-zinc-200">3. Registro de Horas</span>
                <p className="text-xs text-zinc-400">Al terminar, el tiempo se suma a las 26hs del Método PAF o dedicación web.</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: FINANZAS 50/50 ================= */}
        {activeTab === 'finanzas' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Control de Flujo de Caja & Esquema 50/50</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Reglas de oro para la estabilidad financiera de .Cero:
              </p>
              <ul className="space-y-2 text-xs text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Anticipo 50% Obligatorio:</strong> Ningún proyecto web o mentoría comienza sin la primera cuota o anticipo acreditado.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Recordatorios Automatizados:</strong> Usá los enlaces directos a WhatsApp 48hs antes del vencimiento de cuota.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Modo Privacidad:</strong> Activá el icono del ojo en cualquier momento si estás compartiendo pantalla con un cliente para ocultar saldos.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
