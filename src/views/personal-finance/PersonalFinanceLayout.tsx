import React, { useState } from 'react';
import { 
  PieChart, 
  ArrowLeftRight, 
  PlusCircle, 
  Target, 
  Menu, 
  X, 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  GraduationCap, 
  Repeat, 
  Settings as SettingsIcon, 
  Lock, 
  Eye, 
  EyeOff, 
  Smartphone,
  ChevronRight,
  Shield,
  KeyRound
} from 'lucide-react';
import { 
  PersonalAccount, 
  PersonalCategory, 
  PersonalTransaction, 
  PersonalRecurring, 
  PersonalBudget, 
  SavingsGoal, 
  StudyItem, 
  PersonalFinanceSettings,
  Project,
  IncomeRecord,
  TimeLog
} from '../../types';
import { hapticFeedback } from '../../utils/haptics';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
  accounts: PersonalAccount[];
  categories: PersonalCategory[];
  transactions: PersonalTransaction[];
  recurrings: PersonalRecurring[];
  budgets: PersonalBudget[];
  goals: SavingsGoal[];
  studyItems: StudyItem[];
  settings: PersonalFinanceSettings;
  projects: Project[];
  incomes: IncomeRecord[];
  timeLogs: TimeLog[];
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  onSaveSettings: (settings: PersonalFinanceSettings) => void;
  children: React.ReactNode;
}

export const PersonalFinanceLayout: React.FC<Props> = ({
  currentPath,
  onNavigate,
  accounts,
  categories,
  transactions,
  recurrings,
  budgets,
  goals,
  studyItems,
  settings,
  projects,
  incomes,
  timeLogs,
  privacyMode,
  onTogglePrivacy,
  onSaveSettings,
  children,
}) => {
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(!settings.pinEnabled);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // If PIN is enabled and not unlocked yet, show PIN prompt
  if (settings.pinEnabled && settings.customPin && !pinUnlocked) {
    const handleNumberClick = (digit: string) => {
      hapticFeedback.light();
      setPinError(false);
      const nextPin = pinInput + digit;
      if (nextPin.length <= 4) {
        setPinInput(nextPin);
        if (nextPin.length === 4) {
          if (nextPin === settings.customPin) {
            hapticFeedback.success();
            setPinUnlocked(true);
          } else {
            hapticFeedback.warning();
            setPinError(true);
            setTimeout(() => setPinInput(''), 600);
          }
        }
      }
    };

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 max-w-sm mx-auto animate-in fade-in">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[var(--accent)] mb-6 shadow-xl shadow-black/50">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-1">Finanzas Personales</h2>
        <p className="text-xs text-zinc-400 mb-8 text-center">
          Ingresá tu PIN de 4 dígitos para desbloquear este módulo
        </p>

        {/* PIN Dots */}
        <div className={`flex items-center gap-4 mb-8 ${pinError ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-200 ${
                pinInput.length > idx 
                  ? pinError ? 'bg-rose-500 scale-110' : 'bg-[var(--accent)] scale-110'
                  : 'bg-zinc-800 border border-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key, i) => {
            if (key === '') return <div key={i} />;
            if (key === 'del') {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    hapticFeedback.light();
                    setPinInput(prev => prev.slice(0, -1));
                  }}
                  className="h-14 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 active:scale-95 transition flex items-center justify-center font-bold text-xs"
                >
                  Borrar
                </button>
              );
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleNumberClick(key)}
                className="h-14 rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800 text-zinc-100 text-xl font-bold active:scale-95 transition shadow-sm"
              >
                {key}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/agenda')}
          className="mt-8 text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Volver a la Agenda
        </button>
      </div>
    );
  }

  const navLinks = [
    { path: '/mis-finanzas', label: 'Resumen', icon: PieChart },
    { path: '/mis-finanzas/nuevo', label: 'Carga Rápida', icon: PlusCircle, isAction: true },
    { path: '/mis-finanzas/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
    { path: '/mis-finanzas/cuentas', label: 'Cuentas', icon: Wallet },
    { path: '/mis-finanzas/presupuestos', label: 'Presupuestos', icon: Target },
    { path: '/mis-finanzas/metas', label: 'Metas', icon: ArrowUpRight },
    { path: '/mis-finanzas/estudio', label: 'Estudio', icon: GraduationCap },
    { path: '/mis-finanzas/recurrentes', label: 'Recurrentes', icon: Repeat },
    { path: '/mis-finanzas/ajustes', label: 'Ajustes', icon: SettingsIcon },
  ];

  const isCurrent = (path: string) => {
    if (path === '/mis-finanzas') {
      return currentPath === '/mis-finanzas' || currentPath === '/mis-finanzas/';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 min-h-[calc(100vh-140px)] pb-24 md:pb-10 max-w-full">
      
      {/* Desktop Secondary Sidebar (Swiss Minimalist) */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 space-y-4">
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-zinc-200">
                Mis Finanzas
              </span>
            </div>
            <button
              type="button"
              onClick={onTogglePrivacy}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title={privacyMode ? "Mostrar montos" : "Ocultar montos"}
            >
              {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-zinc-400 leading-tight">
            Gestión personal y de estudio separada del negocio.
          </p>
        </div>

        <nav className="flex flex-col space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = isCurrent(item.path);

            if (item.isAction) {
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    hapticFeedback.medium();
                    onNavigate(item.path);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-xs transition mb-2 shadow-sm ${
                    active 
                      ? 'bg-[var(--accent)] text-black shadow-[var(--accent)]/20' 
                      : 'bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black border border-[var(--accent)]/30'
                  }`}
                >
                  <Icon className="w-4 h-4 stroke-[2.5]" />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  onNavigate(item.path);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700/80 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${active ? 'text-[var(--accent)]' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
                {active && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Module Content */}
      <div className="flex-1 min-w-0 w-full max-w-full">
        {children}
      </div>

      {/* Mobile Sub-Navigation Bottom Bar (Fixed 390px iPhone-optimized) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around max-w-md mx-auto relative">
          
          {/* Tab 1: Resumen */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onNavigate('/mis-finanzas');
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition ${
              isCurrent('/mis-finanzas') && !currentPath.includes('/movimientos') && !currentPath.includes('/presupuestos') && !currentPath.includes('/nuevo')
                ? 'text-[var(--accent)]'
                : 'text-zinc-400'
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">Resumen</span>
          </button>

          {/* Tab 2: Movimientos */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onNavigate('/mis-finanzas/movimientos');
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition ${
              isCurrent('/mis-finanzas/movimientos') ? 'text-[var(--accent)]' : 'text-zinc-400'
            }`}
          >
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">Movs</span>
          </button>

          {/* Tab 3: Carga Rápida (Floating prominent center button) */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.medium();
              onNavigate('/mis-finanzas/nuevo');
            }}
            className="flex flex-col items-center justify-center -mt-5"
          >
            <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[var(--accent)] to-amber-500 text-black flex items-center justify-center shadow-lg shadow-[var(--accent)]/30 border-4 border-zinc-950 active:scale-95 transition">
              <PlusCircle className="w-7 h-7 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-bold text-[var(--accent)] mt-0.5">Cargar</span>
          </button>

          {/* Tab 4: Presupuestos */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onNavigate('/mis-finanzas/presupuestos');
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition ${
              isCurrent('/mis-finanzas/presupuestos') ? 'text-[var(--accent)]' : 'text-zinc-400'
            }`}
          >
            <Target className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">Límites</span>
          </button>

          {/* Tab 5: Más Menú */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowMobileMoreMenu(prev => !prev);
            }}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition ${
              showMobileMoreMenu || currentPath.includes('/cuentas') || currentPath.includes('/metas') || currentPath.includes('/estudio') || currentPath.includes('/recurrentes') || currentPath.includes('/ajustes')
                ? 'text-[var(--accent)]'
                : 'text-zinc-400'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold mt-0.5">Más</span>
          </button>
        </div>
      </div>

      {/* Mobile "Más" Drawer Panel */}
      {showMobileMoreMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end p-3 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 space-y-3 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Módulos de Finanzas Personales
              </span>
              <button
                type="button"
                onClick={() => setShowMobileMoreMenu(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  onNavigate('/mis-finanzas/cuentas');
                }}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-2.5 text-left text-zinc-200"
              >
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Cuentas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  onNavigate('/mis-finanzas/metas');
                }}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-2.5 text-left text-zinc-200"
              >
                <ArrowUpRight className="w-4 h-4 text-sky-400" />
                <span>Metas de Ahorro</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  onNavigate('/mis-finanzas/estudio');
                }}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-2.5 text-left text-zinc-200"
              >
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span>Estudio & Cursos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  onNavigate('/mis-finanzas/recurrentes');
                }}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-2.5 text-left text-zinc-200"
              >
                <Repeat className="w-4 h-4 text-amber-400" />
                <span>Recurrentes</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreMenu(false);
                  onNavigate('/mis-finanzas/ajustes');
                }}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-2.5 text-left text-zinc-200"
              >
                <SettingsIcon className="w-4 h-4 text-zinc-400" />
                <span>Ajustes & Cotización</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  onTogglePrivacy();
                }}
                className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center gap-2.5 text-left text-zinc-200"
              >
                {privacyMode ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-zinc-400" />}
                <span>{privacyMode ? 'Mostrar Montos' : 'Ocultar Montos'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
