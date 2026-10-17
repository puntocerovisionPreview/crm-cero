import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

// ==========================================
// 1. AmountText: Centralized privacy & formatting
// ==========================================
interface AmountTextProps {
  amount: number | string;
  currency?: 'USD' | 'ARS' | string;
  privacyMode?: boolean;
  className?: string;
  showCurrency?: boolean;
  prefix?: string;
  suffix?: string;
}

export const AmountText: React.FC<AmountTextProps> = ({
  amount,
  currency = 'USD',
  privacyMode = false,
  className = '',
  showCurrency = true,
  prefix = '',
  suffix = '',
}) => {
  if (privacyMode) {
    return <span className={`font-mono ${className}`}>$ ••••••</span>;
  }

  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const formatted = num.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const currencyLabel = showCurrency ? (currency === 'USD' ? 'US$ ' : '$ ') : '';

  return (
    <span className={`font-mono font-semibold tracking-tight ${className}`}>
      {prefix}{currencyLabel}{formatted}{suffix}
    </span>
  );
};

// ==========================================
// 2. SectionCard: Collapsible card with UI memory
// ==========================================
interface SectionCardProps {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  count?: number;
  collapsible?: boolean;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  storageKey?: string;
  variant?: 'default' | 'subtle' | 'highlight';
}

export const SectionCard: React.FC<SectionCardProps> = ({
  id,
  title,
  subtitle,
  icon,
  badge,
  count,
  collapsible = false,
  defaultOpen = true,
  headerAction,
  children,
  className = '',
  storageKey,
  variant = 'default',
}) => {
  const key = storageKey || (id ? `ui_section_${id}` : undefined);

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (!collapsible) return true;
    if (key && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored !== null) return stored === 'true';
    }
    return defaultOpen;
  });

  const toggle = () => {
    if (!collapsible) return;
    hapticFeedback.light();
    setIsOpen(prev => {
      const next = !prev;
      if (key && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, String(next));
      }
      return next;
    });
  };

  const bgVariants = {
    default: 'bg-[var(--bg-surface)] border-[var(--border-subtle)]',
    subtle: 'bg-[var(--bg-surface-muted)]/50 border-[var(--border-subtle)]',
    highlight: 'bg-[var(--bg-surface)] border-[var(--solid-contrast-bg)]/20 shadow-xs',
  };

  return (
    <div className={`rounded-[var(--radius-card)] border overflow-hidden transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-200 ${bgVariants[variant]} ${className}`}>
      <div
        onClick={collapsible ? toggle : undefined}
        className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 select-none ${
          collapsible ? 'cursor-pointer hover:bg-[var(--bg-surface-muted)]/40 transition active:scale-[0.995]' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {icon && <div className="text-[var(--text-secondary)] shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] font-heading truncate">
                {title}
              </h3>
              {typeof count === 'number' && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  {count}
                </span>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {headerAction}
          {collapsible && (
            <button
              type="button"
              onClick={toggle}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg transition"
              aria-label={isOpen ? 'Colapsar sección' : 'Expandir sección'}
            >
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="p-3.5 sm:p-4 pt-0 sm:pt-0 border-t border-[var(--border-divider)]/40 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. SegmentedControl: Tactile mobile-friendly switcher
// ==========================================
export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: SegmentedControlProps<T>) {
  const sizeStyles = {
    sm: 'p-0.5 text-[11px]',
    md: 'p-1 text-xs',
    lg: 'p-1.5 text-sm',
  };

  const itemSizeStyles = {
    sm: 'px-2 py-1',
    md: 'px-3 py-1.5',
    lg: 'px-4 py-2 font-semibold',
  };

  return (
    <div
      className={`inline-flex items-center rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] ${sizeStyles[size]} ${className}`}
      role="tablist"
    >
      {options.map(opt => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              hapticFeedback.selection();
              onChange(opt.id);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-150 cursor-pointer min-h-[36px] select-none ${itemSizeStyles[size]} ${
              active
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold shadow-xs border border-[var(--border-subtle)]/60'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  active
                    ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-tertiary)]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ==========================================
// 4. TabBar: Slideable tab bar for mobile
// ==========================================
interface TabBarProps<T extends string> {
  tabs: SegmentOption<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}

export function TabBar<T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: TabBarProps<T>) {
  return (
    <div className={`overflow-x-auto no-scrollbar scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] pb-1 min-w-max">
        {tabs.map(tab => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                onChange(tab.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] cursor-pointer min-h-[44px] select-none ${
                active
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
              }`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  active ? 'bg-[var(--solid-contrast-text)] text-[var(--solid-contrast-bg)]' : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 5. StatusPill: Project and task status pill
// ==========================================
interface StatusPillProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const displayLabel = label || status.replace(/_/g, ' ');

  const statusStyles: Record<string, string> = {
    lead: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    propuesta: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    en_progreso: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    revision: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    entregado: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    mantenimiento: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    pausado: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    cancelado: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    cobrado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    pendiente: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    atrasado: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    pagado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  };

  const currentStyle = statusStyles[status] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  const sizeStyle = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]';

  return (
    <span className={`inline-flex items-center font-mono font-medium rounded-md border capitalize ${sizeStyle} ${currentStyle} ${className}`}>
      {displayLabel}
    </span>
  );
};

// ==========================================
// 6. ProgressBar: Base progress bar
// ==========================================
interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  colorClass?: string;
  heightClass?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  colorClass = 'bg-emerald-500',
  heightClass = 'h-2',
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full bg-[var(--bg-app)] rounded-full overflow-hidden border border-[var(--border-subtle)] ${heightClass} ${className}`}>
      <div
        className={`h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ease-out ${colorClass}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// ==========================================
// 7. EmptyState: Consistent empty states
// ==========================================
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div className={`p-8 sm:p-12 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-muted)]/30 space-y-3 ${className}`}>
      {icon && (
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)] shadow-xs">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] font-heading">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            {description}
          </p>
        )}
      </div>
      {actionText && onAction && (
        <button
          type="button"
          onClick={() => {
            hapticFeedback.light();
            onAction();
          }}
          className="btn-solid-primary px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

// ==========================================
// 8. PageHeader: Standard header block
// ==========================================
interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)] ${className}`}>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] font-heading tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
};

// ==========================================
// 9. ConfirmDialog: Safe inline or popover confirm
// ==========================================
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
            {title}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {message}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onCancel}
            className="btn-swiss-secondary px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              hapticFeedback.medium();
              onConfirm();
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl text-white shadow-xs cursor-pointer active:scale-95 ${
              variant === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
