import React, { useEffect, useState } from 'react';
import { AgendaMeeting } from '../types';
import { CalendarPlus, CheckCircle2, DollarSign, X, ArrowRight, Clock, CheckSquare } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { getTodayString, addDays } from '../utils/storage';

interface Props {
  isOpen: boolean;
  meeting: AgendaMeeting | null;
  onClose: () => void;
  onScheduleNextMeeting: (meeting: AgendaMeeting) => void;
  onCreateDerivedTask: (meeting: AgendaMeeting, nextActionText?: string, nextActionDate?: string) => void;
  onCreateDerivedIncome?: (meeting: AgendaMeeting) => void;
  onUpdateMeetingLeadScore?: (meetingId: string, score: 'A' | 'B' | 'C') => void;
  /** Guarda lo que se habló (queda en la reunión y en el historial del cliente) */
  onSaveNotes?: (meeting: AgendaMeeting, notes: string) => void;
}

const SCORES: { value: 'A' | 'B' | 'C'; label: string; hint: string; color: string }[] = [
  { value: 'A', label: 'Caliente', hint: 'Listo para cerrar', color: '#34C759' },
  { value: 'B', label: 'Tibio', hint: 'A mediano plazo', color: '#FF9500' },
  { value: 'C', label: 'Frío', hint: 'No califica', color: '#8E8E93' },
];

const PRESETS = ['Enviar propuesta y link de seña', 'Seguimiento por WhatsApp', 'Enviar wireframes y alcance', 'Coordinar kick-off'];

// Al terminar una reunión: qué se habló, cómo quedó y cuál es el próximo paso
export const PostMeetingCheckoutModal: React.FC<Props> = ({
  isOpen,
  meeting,
  onClose,
  onScheduleNextMeeting,
  onCreateDerivedTask,
  onCreateDerivedIncome,
  onUpdateMeetingLeadScore,
  onSaveNotes,
}) => {
  const [selectedScore, setSelectedScore] = useState<'A' | 'B' | 'C' | null>(null);
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('Enviar propuesta y resumen');
  const [nextActionDate, setNextActionDate] = useState(() => addDays(getTodayString(), 1));

  useEffect(() => {
    if (meeting) {
      setNotes(meeting.notes || '');
      setSelectedScore(null);
    }
  }, [meeting?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isOpen || !meeting) return null;

  const saveNotes = () => {
    const clean = notes.trim();
    if (onSaveNotes && clean !== (meeting.notes || '').trim()) onSaveNotes(meeting, clean);
  };
  const close = () => {
    saveNotes();
    onClose();
  };

  const field = 'w-full rounded-[10px] bg-[var(--bg-surface-muted)]/70 border-0 px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px]" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="w-full sm:max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-[22px] sm:rounded-[22px] shadow-[var(--shadow-float)] p-5 space-y-4 max-h-[92vh] overflow-y-auto safe-area-pb t-sheet-enter"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-[var(--semantic-green-subtle)] text-[var(--semantic-green)] flex items-center justify-center shrink-0" aria-hidden>
            <CheckCircle2 className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--semantic-green)]">Reunión terminada</p>
            <h3 id="checkout-title" className="text-[19px] font-semibold text-[var(--text-primary)] leading-tight truncate">{meeting.title}</h3>
            {(meeting.time || meeting.projectName) && (
              <p className="text-[13px] text-[var(--text-secondary)] flex items-center gap-1.5">
                {meeting.time && (<><Clock className="w-3.5 h-3.5" aria-hidden />{meeting.time}</>)}
                {meeting.projectName && <span>· {meeting.projectName}</span>}
              </p>
            )}
          </div>
          <button type="button" onClick={close} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] flex items-center justify-center shrink-0 cursor-pointer">
            <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {/* 1. Qué se habló */}
        <div className="space-y-1.5">
          <label htmlFor="checkout-notes" className="block text-[13px] font-semibold text-[var(--text-secondary)]">¿Qué se habló?</label>
          <textarea
            id="checkout-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Acuerdos, dudas, presupuesto que mencionó…"
            className={`${field} py-2 resize-none`}
          />
          {meeting.projectId && <p className="text-[12px] text-[var(--text-tertiary)]">Queda en el historial del cliente.</p>}
        </div>

        {/* 2. Cómo quedó */}
        {onUpdateMeetingLeadScore && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">¿Cómo quedó?</p>
            <div role="radiogroup" aria-label="Interés" className="grid grid-cols-3 gap-2">
              {SCORES.map(s => {
                const on = selectedScore === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      hapticFeedback.selection();
                      setSelectedScore(s.value);
                      onUpdateMeetingLeadScore(meeting.id, s.value);
                    }}
                    className={`rounded-[12px] px-2 py-2 text-center cursor-pointer transition-colors ${on ? 'text-white' : 'bg-[var(--bg-surface-muted)]/70 text-[var(--text-primary)]'}`}
                    style={on ? { backgroundColor: s.color } : undefined}
                  >
                    <span className="block text-[14px] font-semibold">{s.label}</span>
                    <span className={`block text-[11px] ${on ? 'text-white/85' : 'text-[var(--text-tertiary)]'}`}>{s.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Próximo paso */}
        <div className="rounded-[14px] bg-[var(--bg-surface-elevated)] p-3 space-y-2.5">
          <p className="text-[13px] font-semibold text-[var(--text-secondary)]">Próximo paso</p>
          <div className="flex gap-2">
            <input aria-label="Próximo paso" value={nextAction} onChange={e => setNextAction(e.target.value)} className={`${field} h-10 flex-1 min-w-0`} />
            <input aria-label="Fecha" type="date" value={nextActionDate} onChange={e => setNextActionDate(e.target.value)} className={`${field} h-10 w-[150px] text-[14px]`} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => (
              <button key={p} type="button" onClick={() => setNextAction(p)} className="h-7 px-2.5 rounded-full bg-[var(--bg-surface-muted)] text-[12px] text-[var(--text-primary)] cursor-pointer">
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              hapticFeedback.success();
              saveNotes();
              onCreateDerivedTask(meeting, nextAction, nextActionDate);
            }}
            className="w-full h-11 rounded-[12px] bg-[var(--accent)] text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer t-press"
          >
            <CheckSquare className="w-4 h-4" aria-hidden />
            Crear la tarea
          </button>
        </div>

        {/* 4. Otras acciones */}
        <ul className="rounded-[14px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
          <li>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                saveNotes();
                onScheduleNextMeeting(meeting);
              }}
              className="w-full min-h-[48px] px-3 flex items-center gap-3 text-left cursor-pointer"
            >
              <span className="w-7 h-7 rounded-[8px] bg-[#5856D6] text-white flex items-center justify-center" aria-hidden><CalendarPlus className="w-4 h-4" /></span>
              <span className="flex-1 text-[15px] text-[var(--text-primary)]">Agendar la próxima reunión</span>
              <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)]" aria-hidden />
            </button>
          </li>
          {onCreateDerivedIncome && (
            <li>
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.selection();
                  saveNotes();
                  onCreateDerivedIncome(meeting);
                }}
                className="w-full min-h-[48px] px-3 flex items-center gap-3 text-left cursor-pointer"
              >
                <span className="w-7 h-7 rounded-[8px] bg-[#34C759] text-white flex items-center justify-center" aria-hidden><DollarSign className="w-4 h-4" /></span>
                <span className="flex-1 text-[15px] text-[var(--text-primary)]">Registrar cobro o seña acordada</span>
                <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)]" aria-hidden />
              </button>
            </li>
          )}
        </ul>

        <button type="button" onClick={close} className="w-full h-11 rounded-[12px] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[15px] font-medium cursor-pointer">
          Listo
        </button>
      </div>
    </div>
  );
};
