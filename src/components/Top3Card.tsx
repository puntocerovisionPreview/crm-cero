import React, { useMemo, useState } from 'react';
import { Check, RefreshCw, Star, X } from 'lucide-react';
import { AgendaTask } from '../types';
import { pickTop3 } from '../utils/periodic';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  tasks: AgendaTask[];
  today: string;
  onToggleTask: (id: string) => void;
  onOpenTask: (id: string) => void;
}

const storeKey = (d: string) => `cero_top3_${d}`;
const readIds = (d: string): string[] | null => {
  try {
    const raw = localStorage.getItem(storeKey(d));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Tus 3 del día: la app propone las 3 más importantes; las confirmás y quedan fijas hasta mañana
export const Top3Card: React.FC<Props> = ({ tasks, today, onToggleTask, onOpenTask }) => {
  const [confirmed, setConfirmed] = useState<string[] | null>(() => readIds(today));
  const [skipped, setSkipped] = useState<string[]>([]);

  const suggestion = useMemo(
    () => pickTop3(tasks.filter(t => !skipped.includes(t.id)), today),
    [tasks, skipped, today]
  );
  const list = confirmed ? confirmed.map(id => tasks.find(t => t.id === id)).filter(Boolean) as AgendaTask[] : suggestion;
  const done = list.filter(t => t.completed).length;

  if (list.length === 0) return null;

  const confirm = () => {
    hapticFeedback.success();
    const ids = suggestion.map(t => t.id);
    setConfirmed(ids);
    try {
      localStorage.setItem(storeKey(today), JSON.stringify(ids));
    } catch {}
  };
  const reset = () => {
    setConfirmed(null);
    setSkipped([]);
    try {
      localStorage.removeItem(storeKey(today));
    } catch {}
  };

  return (
    <section className="card-swiss p-5 space-y-3" aria-labelledby="top3-title">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-[10px] bg-[#FF9500] text-white flex items-center justify-center shrink-0" aria-hidden>
          <Star className="w-[18px] h-[18px]" fill="currentColor" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 id="top3-title" className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight">Tus 3 de hoy</h2>
          <p className="text-[13px] text-[var(--text-secondary)]">
            {confirmed ? `${done} de ${list.length} hechas. Si terminás estas, el día ya valió la pena.` : 'Lo más importante según prioridad y atraso. ¿Van estas?'}
          </p>
        </div>
        {confirmed && (
          <button type="button" onClick={reset} className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer" aria-label="Elegir de nuevo" title="Elegir de nuevo">
            <RefreshCw className="w-4 h-4" aria-hidden />
          </button>
        )}
      </div>

      <ol className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
        {list.map((t, i) => (
          <li key={t.id} className="flex items-center gap-3 px-3 min-h-[48px]">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.medium();
                onToggleTask(t.id);
              }}
              aria-label={t.completed ? `Desmarcar ${t.title}` : `Terminar ${t.title}`}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                t.completed ? 'bg-[#34C759] border-[#34C759] text-white' : 'border-[var(--border-strong)] hover:border-[#34C759]'
              }`}
            >
              {t.completed && <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />}
            </button>
            <button type="button" onClick={() => onOpenTask(t.id)} className="flex-1 min-w-0 text-left py-2 cursor-pointer">
              <span className={`block text-[15px] truncate ${t.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                <span className="text-[var(--text-tertiary)] tabular-nums mr-1.5">{i + 1}.</span>
                {t.title}
              </span>
              <span className="block text-[12px] text-[var(--text-tertiary)] truncate">
                {[t.date < today ? 'atrasada' : null, t.time, t.projectName].filter(Boolean).join(' · ')}
              </span>
            </button>
            {!confirmed && (
              <button
                type="button"
                onClick={() => setSkipped(s => [...s, t.id])}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                aria-label={`Cambiar ${t.title} por otra`}
                title="Cambiar por otra"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ol>

      {!confirmed && (
        <button type="button" onClick={confirm} className="w-full h-10 rounded-[12px] bg-[var(--accent)] text-white text-[15px] font-semibold cursor-pointer t-press">
          Confirmar mis 3
        </button>
      )}
    </section>
  );
};
