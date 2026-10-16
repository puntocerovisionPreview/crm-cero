import React from 'react';
import { Calendar, Users, DollarSign, Plus, Brain, Sparkles, Settings } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { getUiPreferences } from '../utils/uiPreferences';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenQuickAdd: () => void;
}

export const MobileNav: React.FC<Props> = ({
  currentPath,
  onNavigate,
  onOpenQuickAdd,
}) => {
  // Full screen details hide bottom nav
  const isDetailScreen = 
    (currentPath.startsWith('/clientes/') && currentPath !== '/clientes' && currentPath !== '/clientes/nuevo') || 
    currentPath.startsWith('/agenda/tarea/') || 
    currentPath.startsWith('/agenda/reunion/') ||
    currentPath === '/clientes/nuevo' ||
    currentPath.includes('/cobro/nuevo');

  if (isDetailScreen) return null;

  const prefs = getUiPreferences();

  const isHoy = currentPath === '/' || currentPath === '/hoy' || currentPath === '/agenda' || currentPath === '/calendario' || currentPath.startsWith('/semana') || currentPath.startsWith('/misiones');
  const isClientes = currentPath.startsWith('/clientes') || currentPath.startsWith('/proyectos') || currentPath === '/horizonte' || currentPath === '/horizon' || currentPath === '/horozon';
  const isDinero = currentPath.startsWith('/dinero') || currentPath.startsWith('/finanzas') || currentPath.startsWith('/mis-finanzas');
  const isCerebro = currentPath.startsWith('/cerebro') || currentPath.startsWith('/notas') || currentPath.startsWith('/grafo') || currentPath.startsWith('/segundo-cerebro');

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-app)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-2 py-1 safe-area-pb select-none transition-colors">
      <div className="flex items-center justify-between max-w-md mx-auto relative px-1">
        {/* Tab 1: Hoy */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/hoy');
          }}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[52px] py-1 px-1 transition t-press cursor-pointer ${
            isHoy
              ? 'text-[var(--text-primary)] font-semibold'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5 stroke-[1.75]" />
          <span className="text-[10.5px] tracking-tight">Hoy</span>
          {isHoy && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--solid-contrast-bg)] mt-0.5 t-badge-pop" />
          )}
        </button>

        {/* Tab 2: Clientes */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/clientes');
          }}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[52px] py-1 px-1 transition t-press cursor-pointer ${
            isClientes
              ? 'text-[var(--text-primary)] font-semibold'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5 stroke-[1.75]" />
          <span className="text-[10.5px] tracking-tight">Clientes</span>
          {isClientes && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--solid-contrast-bg)] mt-0.5 t-badge-pop" />
          )}
        </button>

        {/* Center Button: Solid Quick Add */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.medium();
            onOpenQuickAdd();
          }}
          className="flex items-center justify-center w-11 h-11 rounded-full btn-solid-primary -mt-3 shadow-md shrink-0 cursor-pointer t-press border border-[var(--border-subtle)]"
          title="Añadir rápido"
          aria-label="Añadir rápido"
        >
          <Plus className="w-5 h-5 stroke-[2]" />
        </button>

        {/* Tab 4: Dinero */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            onNavigate('/dinero');
          }}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[52px] py-1 px-1 transition t-press cursor-pointer ${
            isDinero
              ? 'text-[var(--text-primary)] font-semibold'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <DollarSign className="w-4 h-4 mb-0.5 stroke-[1.75]" />
          <span className="text-[10.5px] tracking-tight">Dinero</span>
          {isDinero && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--solid-contrast-bg)] mt-0.5 t-badge-pop" />
          )}
        </button>

        {/* Tab 5: Cerebro (or fallback to Ajustes if Cerebro is hidden) */}
        {!prefs.hideCerebro ? (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/cerebro');
            }}
            className={`flex flex-col items-center justify-center min-h-[44px] min-w-[52px] py-1 px-1 transition t-press cursor-pointer ${
              isCerebro
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Brain className="w-4 h-4 mb-0.5 stroke-[1.75]" />
            <span className="text-[10.5px] tracking-tight">Cerebro</span>
            {isCerebro && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--solid-contrast-bg)] mt-0.5 t-badge-pop" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              hapticFeedback.selection();
              onNavigate('/ajustes');
            }}
            className={`flex flex-col items-center justify-center min-h-[44px] min-w-[52px] py-1 px-1 transition t-press cursor-pointer ${
              currentPath.startsWith('/ajustes')
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Settings className="w-4 h-4 mb-0.5 stroke-[1.75]" />
            <span className="text-[10.5px] tracking-tight">Ajustes</span>
            {currentPath.startsWith('/ajustes') && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--solid-contrast-bg)] mt-0.5 t-badge-pop" />
            )}
          </button>
        )}
      </div>
    </nav>
  );
};
