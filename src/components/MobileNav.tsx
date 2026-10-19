import React, { useState } from 'react';
import { Home, MoreHorizontal, Plus, type LucideIcon } from 'lucide-react';
import { Sheet } from './Sheet';
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

  const [moreOpen, setMoreOpen] = useState(false);
  if (isDetailScreen) return null;

  const prefs = getUiPreferences();
  const sector = sectorForPath(currentPath);
  const home: Tab = { label: 'Inicio', path: HOME_PATH, icon: Home, active: currentPath === HOME_PATH };
  // Entran 3 botones al lado de Inicio: si el sector tiene más pantallas, el tercero es "Más"
  const MORE = '__mas__';
  const sectorTabs = sector ? sector.items.map(i => ({ label: i.label, path: i.path, icon: i.icon, active: i.match(currentPath) })) : [];
  const overflow = sectorTabs.length > 3;
  const hiddenActive = overflow && sectorTabs.slice(2).some(t => t.active);

  const tabs: Tab[] = sector
    ? [
        home,
        ...(overflow
          ? [...sectorTabs.slice(0, 2), { label: 'Más', path: MORE, icon: MoreHorizontal, active: hiddenActive }]
          : sectorTabs),
      ]
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
        if (t.path === MORE) setMoreOpen(true);
        else onNavigate(t.path);
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
      {moreOpen && sector && (
        <Sheet onClose={() => setMoreOpen(false)} label={`Pantallas de ${sector.label}`}>
          <div className="px-4 pb-6 pt-2">
            <p className="text-[13px] font-semibold text-[var(--text-secondary)] px-1 pb-2">{sector.label}</p>
            <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
              {sectorTabs.map(t => (
                <li key={t.path}>
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.selection();
                      setMoreOpen(false);
                      onNavigate(t.path);
                    }}
                    aria-current={t.active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-4 min-h-[48px] text-left text-[16px] cursor-pointer ${t.active ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text-primary)]'}`}
                  >
                    <t.icon className="w-5 h-5 shrink-0" aria-hidden />
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Sheet>
      )}
    </nav>
  );
};
