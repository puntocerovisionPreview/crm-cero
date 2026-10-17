import React, { useState, useEffect } from 'react';
import { ExpenseRecord, DEFAULT_EXPENSE_CATEGORIES } from '../types';
import { formatCurrency } from '../utils/pricingCatalog';
import { getMonthKey } from '../utils/storage';
import { Sliders, AlertTriangle, Check, Plus, Edit2 } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  expenses: ExpenseRecord[];
  selectedYear: number;
  selectedMonth: string;
  privacyMode?: boolean;
}

// Default limits in ARS (persisted in localStorage)
const DEFAULT_LIMITS: Record<string, number> = {
  'Pauta & Inversión Ads (Meta, Google)': 250000,
  'Servidores, Hosting & Dominios': 80000,
  'Software, SaaS & IA (Figma, GitHub, OpenAI)': 120000,
  'Subcontratos & Freelancers (Copy, Video, Renders)': 150000,
  'Impuestos, Servicios & Comisiones': 180000,
  'Equipamiento & Hardware': 200000,
  'General de Estudio': 70000,
  'Otros': 50000,
};

export const CategoryBudgetManager: React.FC<Props> = ({
  expenses,
  selectedYear,
  selectedMonth,
  privacyMode = false,
}) => {
  const [limits, setLimits] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('cero_budget_limits');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_LIMITS;
  });

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');

  const targetMonthKey = `${selectedYear}-${selectedMonth}`;

  // Filter expenses for this month
  const monthExpenses = expenses.filter(e => {
    const m = e.month || getMonthKey(e.date);
    return m === targetMonthKey;
  });

  // Calculate spent per category
  const spentPerCat: Record<string, number> = {};
  DEFAULT_EXPENSE_CATEGORIES.forEach(cat => {
    spentPerCat[cat] = 0;
  });

  monthExpenses.forEach(e => {
    const cat = e.category || 'Otros';
    spentPerCat[cat] = (spentPerCat[cat] || 0) + (e.currency === 'USD' ? e.amount * 1200 : e.amount);
  });

  const totalBudget = Object.values(limits).reduce((a, b) => a + b, 0);
  const totalSpent = Object.values(spentPerCat).reduce((a, b) => a + b, 0);
  const totalPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
  const isOverTotal = totalSpent > totalBudget;

  const handleSaveLimit = (cat: string) => {
    const num = Number(editAmount);
    if (!isNaN(num) && num >= 0) {
      hapticFeedback.light();
      const updated = { ...limits, [cat]: num };
      setLimits(updated);
      try {
        localStorage.setItem('cero_budget_limits', JSON.stringify(updated));
      } catch {}
    }
    setEditingCat(null);
  };

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="card-swiss p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="label-swiss text-[11px]">Presupuesto Mensual por Categoría</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)]">
                {privacyMode ? '$ ••••••' : formatCurrency(totalSpent, 'ARS')}
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                de {privacyMode ? '$ ••••••' : formatCurrency(totalBudget, 'ARS')} límite
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-xs font-mono font-bold ${isOverTotal ? 'text-[#DC2626]' : 'text-[var(--text-primary)]'}`}>
              {totalPercent}% consumido
            </span>
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full h-1.5 bg-[var(--bg-surface-muted)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
          <div 
            className={`h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ${
              isOverTotal ? 'bg-[#DC2626]' : 'bg-[var(--solid-contrast-bg)]'
            }`}
            style={{ width: `${Math.min(100, totalPercent)}%` }}
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DEFAULT_EXPENSE_CATEGORIES.map(cat => {
          const spent = spentPerCat[cat] || 0;
          const limit = limits[cat] || 100000;
          const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
          const isOver = spent > limit;

          return (
            <div 
              key={cat}
              className="card-swiss p-3.5 space-y-2 hover:border-[var(--text-tertiary)] transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {cat}
                </span>

                {editingCat === cat ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-24 px-2 py-0.5 text-xs font-mono bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)]"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveLimit(cat)}
                      className="p-1 text-[#16A34A] hover:bg-[#16A34A]/10 rounded"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingCat(cat);
                      setEditAmount(String(limit));
                    }}
                    className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                    title="Editar límite"
                  >
                    <span className="font-mono text-[10px]">
                      Límite: {privacyMode ? '$ ••••••' : formatCurrency(limit, 'ARS')}
                    </span>
                    <Edit2 className="w-3 h-3 text-[var(--text-tertiary)]" />
                  </button>
                )}
              </div>

              {/* Progress and numbers */}
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className={`font-semibold ${isOver ? 'text-[#DC2626]' : 'text-[var(--text-primary)]'}`}>
                  {privacyMode ? '$ ••••••' : formatCurrency(spent, 'ARS')}
                </span>
                <span className={`text-[10px] ${isOver ? 'text-[#DC2626] font-bold' : 'text-[var(--text-secondary)]'}`}>
                  {isOver ? `Excedido +${percent - 100}%` : `${percent}%`}
                </span>
              </div>

              <div className="w-full h-1 bg-[var(--bg-surface-muted)] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300 ${
                    isOver ? 'bg-[#DC2626]' : 'bg-[var(--solid-contrast-bg)]'
                  }`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
