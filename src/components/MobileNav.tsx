import React from 'react';
import { Home, Plus, type LucideIcon } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { getUiPreferences } from '../utils/uiPreferences';
import { HOME_PATH, SECTORS, sectorForPath } from '../utils/sectors';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenQuickAdd: () => void;
}

interface Tab {
  label: string;
  path: string;
  icon: LucideIcon;
  active: boolean;
}

// Barra de abajo (celular): Inicio + las pantallas del sector en el que estás, con el "+" en el medio.
// En Inicio muestra los accesos a los sectores principales.
export const MobileNav: React.FC<Props> = ({ currentPath, onNavigate, onOpenQuickAdd }) => {
  // Full screen details hide bottom nav
  const isDetailScreen =
    (currentPath.startsWith('/clientes/') && currentPath !== '/clientes' && currentPath !== '/clientes/nuevo') ||
    currentPath.startsWith('/agenda/tarea/') ||
    currentPath.startsWith('/agenda/reunion/') ||
    currentPath === '/clientes/nuevo' ||
    currentPath.includes('/cobro/nuevo');

  if (isDetailScreen) return null;

  const prefs = getUiPreferences();
  const sector = sectorForPath(currentPath);
  const home: Tab = { label: 'Inicio', path: HOME_PATH, icon: Home, active: currentPath === HOME_PATH };

  const tabs: Tab[] = sector
    ? [home, ...sector.items.slice(0, 3).map(i => ({ label: i.label, path: i.path, icon: i.icon, active: i.match(currentPath) }))]
    : [
        home,
        ...SECTORS.filter(s => !(s.key === 'cerebro' && prefs.hideCerebro))
          .slice(0, 3)
          .map(s => ({ label: s.label, path: s.items[0].path, icon: s.icon, active: false })),
      ];
  const plusAt = Math.ceil(tabs.length / 2);

  const renderTab = (t: Tab) => (
    <button
      key={t.path}
      type="button"
      onClick={() => {
        hapticFeedback.selection();
        onNavigate(t.path);
      }}
      aria-current={t.active ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[52px] py-1 px-1 transition t-press cursor-pointer ${
        t.active ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <t.icon className="w-6 h-6 mb-0.5 stroke-[1.6]" aria-hidden />
      <span className="text-[10px] font-medium truncate max-w-full">{t.label}</span>
    </button>
  );

  return (
    <nav
      aria-label={sector ? `Sector ${sector.label}` : 'Inicio'}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)]/80 backdrop-blur-xl backdrop-saturate-150 border-t border-[var(--border-subtle)] px-2 pt-1.5 pb-1 safe-area-pb select-none transition-colors"
    >
      <div className="flex items-center justify-between max-w-md mx-auto relative px-1">
        {tabs.slice(0, plusAt).map(renderTab)}

        {/* Agregar rápido */}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.medium();
            onOpenQuickAdd();
          }}
          className="flex items-center justify-center w-11 h-11 mx-1 rounded-full bg-[var(--accent)] text-white -mt-1 shadow-sm shrink-0 cursor-pointer t-press"
          title="Añadir rápido"
          aria-label="Añadir rápido"
        >
          <Plus className="w-5 h-5 stroke-[2]" />
        </button>

        {tabs.slice(plusAt).map(renderTab)}
      </div>
    </nav>
  );
};
