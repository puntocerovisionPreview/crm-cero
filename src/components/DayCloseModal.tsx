import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Moon, X } from 'lucide-react';
import { AgendaTask } from '../types';
import { addDays } from '../utils/dates';
import { saveJournalEntry } from '../utils/journal';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: AgendaTask[];
  today: string;
  initialText?: string;
  onMoveTaskDate: (id: string, date: string) => void;
  onToggleTask: (id: string) => void;
  showToast?: (msg: string) => void;
}

// Cierre del día en 2 minutos: lo hecho, lo pendiente a mañana y una línea de bitácora
export const DayCloseModal: React.FC<Props> = ({ isOpen, onClose, tasks, today, initialText = '', onMoveTaskDate, onToggleTask, showToast }) => {
  const [text, setText] = useState(initialText);
  const [moved, setMoved] = useState(0);
  const [saving, setSaving] = useState(false);
  const tomorrow = addDays(today, 1);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setMoved(0);
    }
  }, [isOpen, initialText]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const doneToday = tasks.filter(t => t.completed && (t.completedAt || t.date) === today);
  const pending = tasks.filter(t => !t.completed && t.date && t.date <= today);

  const moveAll = () => {
    hapticFeedback.success();
    pending.forEach(t => onMoveTaskDate(t.id, tomorrow));
    setMoved(m => m + pending.length);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveJournalEntry({ date: today, text: text.trim(), tareasHechas: doneToday.length, movidasAManana: moved });
      hapticFeedback.success();
      showToast?.('Día cerrado. ¡Buen descanso!');
      onClose();
    } catch (err) {
      showToast?.(`No se guardó la bitácora: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierre-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[22px] sm:rounded-[22px] shadow-[var(--shadow-float)] p-5 space-y-4 max-h-[92vh] overflow-y-auto safe-area-pb t-sheet-enter"
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-[#5856D6] text-white flex items-center justify-center shrink-0" aria-hidden>
            <Moon className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <h3 id="cierre-title" className="text-[19px] font-semibold text-[var(--text-primary)]">Cerrar el día</h3>
            <p className="text-[13px] text-[var(--text-secondary)]">Dos minutos y mañana arrancás con todo en orden.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div className="rounded-[14px] bg-[var(--semantic-green-subtle)] px-4 py-3">
          <p className="text-[28px] font-bold tabular-nums text-[var(--semantic-green)] leading-none">{doneToday.length}</p>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">{doneToday.length === 1 ? 'tarea terminada hoy' : 'tareas terminadas hoy'}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">{pending.length ? `Quedan ${pending.length} pendientes` : 'No queda nada pendiente 🎉'}</p>
            {pending.length > 0 && (
              <button type="button" onClick={moveAll} className="h-8 px-3 rounded-full bg-[var(--accent)] text-white text-[12px] font-semibold flex items-center gap-1 cursor-pointer">
                Todas a mañana <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
          </div>
          {pending.length > 0 && (
            <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] max-h-56 overflow-y-auto">
              {pending.map(t => (
                <li key={t.id} className="flex items-center gap-2 px-3 min-h-[44px]">
                  <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">{t.title}</span>
                  <button type="button" onClick={() => onToggleTask(t.id)} className="h-7 px-2 rounded-full text-[12px] text-[var(--semantic-green)] font-medium flex items-center gap-1 hover:bg-[var(--bg-surface-muted)] cursor-pointer">
                    <Check className="w-3.5 h-3.5" aria-hidden /> Hecha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onMoveTaskDate(t.id, tomorrow);
                      setMoved(m => m + 1);
                    }}
                    className="h-7 px-2 rounded-full text-[12px] text-[var(--accent)] font-medium hover:bg-[var(--bg-surface-muted)] cursor-pointer"
                  >
                    Mañana
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bitacora" className="block text-[13px] font-semibold text-[var(--text-secondary)]">Una línea sobre tu día</label>
          <textarea
            id="bitacora"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={2}
            placeholder="Qué salió bien, qué te trabó, qué aprendiste…"
            className="w-full rounded-[10px] bg-[var(--bg-surface-muted)]/70 border-0 px-3 py-2 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
          />
        </div>

        <button type="button" onClick={save} disabled={saving} className="w-full h-11 rounded-[12px] bg-[var(--accent)] text-white text-[15px] font-semibold disabled:opacity-60 cursor-pointer t-press">
          {saving ? 'Guardando…' : 'Cerrar el día'}
        </button>
      </div>
    </div>
  );
};
