import React, { useMemo, useState } from 'react';
import { CheckCircle2, DollarSign, FileText, GraduationCap, Mail, MessageCircle, Phone, Receipt, Sparkles, Trash2, Users } from 'lucide-react';
import type { DocumentPrefill } from './DocumentEditorModal';
import { AgendaMeeting, AgendaTask, ContactLogEntry, Project } from '../types';
import { CONTACT_TYPES, TimelineKind, buildTimeline, groupByMonth } from '../utils/clientTimeline';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  project: Project;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  privacyMode?: boolean;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onNewDocument?: (prefill: DocumentPrefill) => void;
}

const KIND_STYLE: Record<TimelineKind, { icon: React.ElementType; color: string }> = {
  whatsapp: { icon: MessageCircle, color: '#25D366' },
  llamada: { icon: Phone, color: '#007AFF' },
  email: { icon: Mail, color: '#5856D6' },
  reunion: { icon: Users, color: '#30B0C7' },
  nota: { icon: FileText, color: '#8E8E93' },
  tarea: { icon: CheckCircle2, color: '#34C759' },
  pago: { icon: DollarSign, color: '#FF9500' },
  sesion: { icon: GraduationCap, color: '#AF52DE' },
  alta: { icon: Sparkles, color: '#FF2D55' },
};

const monthTitle = (m: string) => {
  const t = new Date(`${m}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });

// Historial del cliente: todo lo que pasó, en una sola línea de tiempo
export const ClientTimeline: React.FC<Props> = ({ project, tasks, meetings, privacyMode, onUpdateProject, onNewDocument }) => {
  const today = getTodayString();
  const [type, setType] = useState<ContactLogEntry['type']>('whatsapp');
  const [text, setText] = useState('');
  const [date, setDate] = useState(today);

  const groups = useMemo(() => groupByMonth(buildTimeline(project, tasks, meetings)), [project, tasks, meetings]);

  const addContact = (e: React.FormEvent) => {
    e.preventDefault();
    hapticFeedback.success();
    const entry: ContactLogEntry = { id: `ct_${Date.now().toString(36)}`, date, type, text: text.trim() || undefined };
    const contactLog = [entry, ...(project.contactLog || [])];
    const lastContactDate = !project.lastContactDate || date > project.lastContactDate ? date : project.lastContactDate;
    onUpdateProject(project.id, { contactLog, lastContactDate });
    setText('');
    setDate(today);
  };

  const removeContact = (entryId: string) => {
    const id = entryId.replace(/^c-/, '');
    onUpdateProject(project.id, { contactLog: (project.contactLog || []).filter(c => c.id !== id) });
  };

  const base: DocumentPrefill = {
    projectId: project.id,
    clientName: project.clientName,
    contactName: project.ownerName,
    phone: project.clientPhone,
    currency: project.estimatedCurrency || 'USD',
  };

  return (
    <div className="space-y-5">
      {onNewDocument && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNewDocument({ ...base, kind: 'presupuesto' })} className="h-9 px-4 rounded-full bg-[var(--accent)] text-white text-[14px] font-semibold flex items-center gap-1.5 cursor-pointer">
            <FileText className="w-4 h-4" aria-hidden /> Presupuesto
          </button>
          <button type="button" onClick={() => onNewDocument({ ...base, kind: 'recibo' })} className="h-9 px-4 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer">
            <Receipt className="w-4 h-4" aria-hidden /> Recibo
          </button>
        </div>
      )}

      {/* Registrar contacto */}
      <form onSubmit={addContact} className="card-swiss p-4 space-y-3" aria-label="Registrar un contacto">
        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Registrar contacto</h3>
        <div role="radiogroup" aria-label="Cómo fue el contacto" className="flex flex-wrap gap-1.5">
          {CONTACT_TYPES.map(t => {
            const S = KIND_STYLE[t.value];
            const on = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(t.value)}
                className={`h-8 px-3 rounded-full text-[13px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                  on ? 'text-white' : 'bg-[var(--bg-surface-muted)]/70 text-[var(--text-primary)]'
                }`}
                style={on ? { backgroundColor: S.color } : undefined}
              >
                <S.icon className="w-3.5 h-3.5" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="¿De qué hablaron? (opcional)"
            aria-label="Resumen del contacto"
            className="flex-1 h-10 rounded-[10px] bg-[var(--bg-surface-muted)]/70 border-0 px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
          />
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value || today)}
            aria-label="Fecha"
            className="h-10 rounded-[10px] bg-[var(--bg-surface-muted)]/70 border-0 px-3 text-[14px] text-[var(--text-primary)]"
          />
          <button type="submit" className="h-10 px-4 rounded-[10px] bg-[var(--accent)] text-white text-[15px] font-semibold cursor-pointer t-press">
            Guardar
          </button>
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)]">Actualiza el "último contacto" del cliente.</p>
      </form>

      {/* Línea de tiempo */}
      {groups.length === 0 ? (
        <p className="text-center text-[14px] text-[var(--text-secondary)] py-8">Todavía no hay historial con este cliente.</p>
      ) : (
        groups.map(g => (
          <section key={g.month} aria-label={monthTitle(g.month)}>
            <h3 className="px-1 pb-2 text-[13px] font-semibold text-[var(--text-secondary)]">{monthTitle(g.month)}</h3>
            <ol className="relative ml-4 border-l border-[var(--border-subtle)] space-y-3">
              {g.entries.map(e => {
                const S = KIND_STYLE[e.kind];
                return (
                  <li key={e.id} className="relative pl-6 group">
                    <span
                      className="absolute -left-[13px] top-0.5 w-[26px] h-[26px] rounded-full flex items-center justify-center text-white ring-4 ring-[var(--bg-app)]"
                      style={{ backgroundColor: S.color }}
                      aria-hidden
                    >
                      <S.icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-[var(--text-primary)]">
                          {e.title}
                          {e.amount !== undefined && (
                            <span className="ml-1.5 font-semibold tabular-nums text-[var(--semantic-green)]">
                              {privacyMode ? '••••' : `${e.currency === 'USD' ? 'US$' : '$'} ${Math.round(e.amount).toLocaleString('es-AR')}`}
                            </span>
                          )}
                        </p>
                        {e.detail && <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-line line-clamp-3">{e.detail}</p>}
                        <p className="text-[12px] text-[var(--text-tertiary)]">{dayLabel(e.date)}</p>
                      </div>
                      {e.kind === 'pago' && onNewDocument && e.amount !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            onNewDocument({
                              ...base,
                              kind: 'recibo',
                              currency: e.currency || base.currency,
                              items: [{ description: e.detail || `Pago ${project.clientName}`, quantity: 1, unitPrice: e.amount || 0 }],
                              paymentDate: e.date,
                              paymentId: e.id.replace(/^p-/, ''),
                            })
                          }
                          className="h-8 px-3 rounded-full bg-[var(--bg-surface-muted)] text-[12px] font-medium text-[var(--text-primary)] flex items-center gap-1 shrink-0 cursor-pointer"
                          title="Generar recibo de este pago"
                        >
                          <Receipt className="w-3.5 h-3.5" aria-hidden /> Recibo
                        </button>
                      )}
                      {e.removable && (
                        <button
                          type="button"
                          onClick={() => removeContact(e.id)}
                          aria-label="Borrar este contacto"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--semantic-red)] hover:bg-[var(--bg-surface-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
};
