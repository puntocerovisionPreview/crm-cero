import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { AgendaMeeting, AgendaTask, ExpenseRecord, IncomeRecord, Project, StudioFixedExpense, WeeklyMission } from '../types';
import { useProspecting } from '../prospecting/useProspecting';
import { JournalEntry, subscribeJournal } from '../utils/journal';
import { money, monthClose, pafReport, prospectingWeek, weekBounds, weekSummary } from '../utils/periodic';
import { addDays, addMonths } from '../utils/dates';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  fixedExpenses: StudioFixedExpense[];
  weeklyGoals: WeeklyMission[];
  privacyMode?: boolean;
  initialTab?: Tab;
  onToggleTask: (id: string) => void;
  onMoveTaskDate: (id: string, date: string) => void;
  onAddWeeklyGoal: (title: string, category: 'ventas' | 'produccion' | 'organizacion' | 'general', weekStart?: string) => void;
  onNavigate: (path: string) => void;
}

type Tab = 'semana' | 'paf' | 'prospeccion' | 'mes';
const TABS: { key: Tab; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'paf', label: 'Alumnos PAF' },
  { key: 'prospeccion', label: 'Prospección' },
  { key: 'mes', label: 'Mes' },
];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const pair = (v: { ARS: number; USD: number }, privacy?: boolean) =>
  privacy ? '••••' : [v.ARS ? money(v.ARS, 'ARS') : '', v.USD ? money(v.USD, 'USD') : ''].filter(Boolean).join(' + ') || '$ 0';

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; step?: number }> = ({ title, subtitle, children, step }) => (
  <section className="card-swiss p-5 space-y-3">
    <div className="flex items-start gap-3">
      {step && (
        <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-white text-[14px] font-bold flex items-center justify-center shrink-0" aria-hidden>
          {step}
        </span>
      )}
      <div>
        <h2 className="text-[17px] font-semibold text-[var(--text-primary)] leading-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-[var(--text-secondary)]">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const Stat: React.FC<{ value: React.ReactNode; label: string; prev?: number; current?: number }> = ({ value, label, prev, current }) => {
  const delta = prev !== undefined && current !== undefined ? current - prev : null;
  return (
    <div className="rounded-[14px] bg-[var(--bg-surface-elevated)] px-4 py-3">
      <p className="text-[24px] font-bold tabular-nums text-[var(--text-primary)] leading-none">{value}</p>
      <p className="text-[12px] text-[var(--text-secondary)] mt-1">{label}</p>
      {delta !== null && (
        <p className={`text-[12px] font-medium mt-0.5 ${delta > 0 ? 'text-[var(--semantic-green)]' : delta < 0 ? 'text-[var(--semantic-red)]' : 'text-[var(--text-tertiary)]'}`}>
          {delta > 0 ? `+${delta}` : delta} vs semana pasada
        </p>
      )}
    </div>
  );
};

// Reportes: revisión semanal guiada, alumnos PAF, prospección y cierre de mes
export const ReportsView: React.FC<Props> = ({
  tasks,
  meetings,
  projects,
  incomes,
  expenses,
  fixedExpenses,
  weeklyGoals,
  privacyMode,
  initialTab = 'semana',
  onToggleTask,
  onMoveTaskDate,
  onAddWeeklyGoal,
  onNavigate,
}) => {
  const today = todayStr();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [monthKey, setMonthKey] = useState(today.slice(0, 7));
  const [missions, setMissions] = useState(['', '', '']);
  const [journal, setJournal] = useState<Record<string, JournalEntry>>({});
  const { events, settings, loadError } = useProspecting();

  useEffect(() => subscribeJournal(setJournal, 14), []);

  const week = useMemo(() => weekSummary({ tasks, meetings, projects, incomes, events }, today), [tasks, meetings, projects, incomes, events, today]);
  const prevWeek = useMemo(() => weekSummary({ tasks, meetings, projects, incomes, events }, today, -1), [tasks, meetings, projects, incomes, events, today]);
  const nextMonday = weekBounds(today, 1).start;
  const nextWeekMissions = weeklyGoals.filter(g => g.weekStart === nextMonday);
  const weekJournal = Object.values(journal)
    .filter(j => j.date >= week.start && j.date <= week.end && j.text)
    .sort((a, b) => a.date.localeCompare(b.date));

  const paf = useMemo(() => pafReport(projects, meetings, today), [projects, meetings, today]);
  const pw = useMemo(() => prospectingWeek(events, today), [events, today]);
  const pwPrev = useMemo(() => prospectingWeek(events, today, -1), [events, today]);
  const month = useMemo(() => monthClose({ projects, incomes, expenses, fixedExpenses }, today, monthKey), [projects, incomes, expenses, fixedExpenses, today, monthKey]);
  const monthLabelRaw = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);

  const saveMissions = () => {
    const titles = missions.map(m => m.trim()).filter(Boolean);
    if (!titles.length) return;
    hapticFeedback.success();
    titles.forEach(t => onAddWeeklyGoal(t, 'general', nextMonday));
    setMissions(['', '', '']);
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-5 pb-28">
      <header className="px-1 space-y-3">
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">Reportes</h1>
        <div role="tablist" aria-label="Reportes" className="inline-flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70 max-w-full overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 h-8 rounded-[8px] text-[14px] whitespace-nowrap cursor-pointer ${
                tab === t.key ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[var(--text-secondary)] font-medium'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* ---------------- SEMANA: revisión guiada ---------------- */}
      {tab === 'semana' && (
        <>
          <Card step={1} title="Cómo te fue esta semana" subtitle={`Del ${shortDay(week.start)} al ${shortDay(week.end)}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat value={week.tareasHechas} label="tareas hechas" current={week.tareasHechas} prev={prevWeek.tareasHechas} />
              <Stat value={week.reunionesHechas} label="reuniones" current={week.reunionesHechas} prev={prevWeek.reunionesHechas} />
              <Stat value={week.contactos} label="contactos de prospección" current={week.contactos} prev={prevWeek.contactos} />
              <Stat value={<span className="text-[18px]">{pair(week.cobrado, privacyMode)}</span>} label="cobrado" />
            </div>
            {weekJournal.length > 0 && (
              <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)]">
                {weekJournal.map(j => (
                  <li key={j.date} className="px-3 py-2 text-[14px] text-[var(--text-primary)]">
                    <span className="text-[12px] text-[var(--text-tertiary)] mr-2">{shortDay(j.date)}</span>
                    {j.text}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card step={2} title="Lo que quedó atrasado" subtitle={week.atrasadas.length ? 'Decidí qué hacer con cada una: hoy, el lunes o ya está hecha.' : 'No hay nada atrasado. ¡Bien ahí!'}>
            {week.atrasadas.length > 0 && (
              <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] max-h-80 overflow-y-auto">
                {week.atrasadas.map(t => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-[14px] text-[var(--text-primary)] truncate">{t.title}</p>
                      <p className="text-[12px] text-[var(--semantic-red)]">desde el {shortDay(t.date)}{t.projectName ? ` · ${t.projectName}` : ''}</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => onMoveTaskDate(t.id, today)} className="h-7 px-2.5 rounded-full bg-[var(--bg-surface-muted)] text-[12px] cursor-pointer">Hoy</button>
                      <button type="button" onClick={() => onMoveTaskDate(t.id, nextMonday)} className="h-7 px-2.5 rounded-full bg-[var(--bg-surface-muted)] text-[12px] cursor-pointer">Lunes</button>
                      <button type="button" onClick={() => onToggleTask(t.id)} className="h-7 px-2.5 rounded-full text-[12px] text-[var(--semantic-green)] font-medium flex items-center gap-1 cursor-pointer">
                        <Check className="w-3.5 h-3.5" aria-hidden /> Hecha
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card step={3} title="Tus 3 misiones para la semana que viene" subtitle={`Semana del ${shortDay(nextMonday)}. Lo que, si sale, hace que la semana valga la pena.`}>
            {nextWeekMissions.length > 0 && (
              <ul className="space-y-1">
                {nextWeekMissions.map(m => (
                  <li key={m.id} className="flex items-center gap-2 text-[14px] text-[var(--text-primary)]">
                    <Check className="w-4 h-4 text-[var(--semantic-green)]" aria-hidden /> {m.title}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              {missions.map((m, i) => (
                <input
                  key={i}
                  value={m}
                  onChange={e => setMissions(ms => ms.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={['Ej: Cerrar 2 clientes PAF', 'Ej: Publicar el sitio de Remodelante', 'Ej: 40 contactos nuevos'][i]}
                  aria-label={`Misión ${i + 1}`}
                  className="w-full h-10 rounded-[10px] bg-[var(--bg-surface-muted)]/70 border-0 px-3 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveMissions} disabled={!missions.some(m => m.trim())} className="h-10 px-4 rounded-[12px] bg-[var(--accent)] text-white text-[15px] font-semibold disabled:opacity-40 cursor-pointer">
                Guardar misiones
              </button>
              <button type="button" onClick={() => onNavigate('/semana')} className="h-10 px-4 rounded-[12px] bg-[var(--bg-surface-muted)] text-[15px] text-[var(--text-primary)] flex items-center gap-1 cursor-pointer">
                Ver la semana <ArrowRight className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </Card>
        </>
      )}

      {/* ---------------- ALUMNOS PAF ---------------- */}
      {tab === 'paf' && (
        <Card title="Alumnos PAF" subtitle="Avance, horas y quién necesita una sesión (10 días o más sin sesión y sin la próxima agendada).">
          {paf.length === 0 ? (
            <p className="text-[14px] text-[var(--text-secondary)]">No hay alumnos PAF activos.</p>
          ) : (
            <ul className="space-y-2">
              {paf.map(r => (
                <li key={r.project.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/clientes/${r.project.id}`)}
                    className={`w-full text-left rounded-[14px] p-3 cursor-pointer border ${r.alert ? 'border-[var(--semantic-amber)]/50 bg-[var(--semantic-amber-subtle)]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-[#AF52DE]" aria-hidden />
                      <span className="flex-1 text-[15px] font-semibold text-[var(--text-primary)] truncate">{r.project.clientName}</span>
                      {r.alert && <AlertTriangle className="w-4 h-4 text-[var(--semantic-amber)]" aria-label="Necesita sesión" />}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[12px] text-[var(--text-secondary)]">
                      <div>
                        <p className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{r.hitos.total ? `${r.hitos.done}/${r.hitos.total}` : '—'}</p>
                        hitos
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{r.horas.total ? `${r.horas.done}/${r.horas.total} h` : `${r.horas.done} h`}</p>
                        horas de consultoría
                      </div>
                      <div>
                        <p className={`text-[15px] font-semibold tabular-nums ${r.alert ? 'text-[var(--semantic-amber)]' : 'text-[var(--text-primary)]'}`}>
                          {r.daysSinceSession === undefined ? 'Sin sesiones' : r.daysSinceSession === 0 ? 'Hoy' : `Hace ${r.daysSinceSession} d`}
                        </p>
                        {r.nextSession ? `próxima: ${shortDay(r.nextSession)}` : 'última sesión'}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* ---------------- PROSPECCIÓN ---------------- */}
      {tab === 'prospeccion' && (
        <Card title="Prospección de la semana" subtitle={loadError ? `No se pudo leer: ${loadError}` : `Meta: ${settings.weeklyGoal} conversaciones nuevas (respuestas) por semana.`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat value={pw.contactos} label="primeros contactos" current={pw.contactos} prev={pwPrev.contactos} />
            <Stat value={pw.seguimientos} label="seguimientos" current={pw.seguimientos} prev={pwPrev.seguimientos} />
            <Stat value={pw.respuestas} label="respuestas" current={pw.respuestas} prev={pwPrev.respuestas} />
            <Stat value={pw.llamadas} label="llamadas" current={pw.llamadas} prev={pwPrev.llamadas} />
            <Stat value={pw.propuestas} label="propuestas" current={pw.propuestas} prev={pwPrev.propuestas} />
            <Stat value={pw.ganados} label="clientes ganados" current={pw.ganados} prev={pwPrev.ganados} />
          </div>
          {settings.weeklyGoal > 0 && (
            <div>
              <div className="flex justify-between text-[13px] text-[var(--text-secondary)] mb-1">
                <span>Conversaciones nuevas</span>
                <span className="tabular-nums">{pw.respuestas} de {settings.weeklyGoal}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-surface-muted)] overflow-hidden">
                <div className="h-full rounded-full bg-[#34C759]" style={{ width: `${Math.min(100, (pw.respuestas / settings.weeklyGoal) * 100)}%` }} />
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                Tasa de respuesta: {pw.contactos + pw.seguimientos ? Math.round((pw.respuestas / (pw.contactos + pw.seguimientos)) * 100) : 0}% de los mensajes enviados.
              </p>
            </div>
          )}
          <button type="button" onClick={() => onNavigate('/oportunidades')} className="text-[14px] text-[var(--accent)] font-medium flex items-center gap-1 cursor-pointer">
            Ver oportunidades <ArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </Card>
      )}

      {/* ---------------- MES ---------------- */}
      {tab === 'mes' && (
        <>
          <div className="flex items-center gap-2 px-1">
            <button type="button" onClick={() => setMonthKey(addMonths(`${monthKey}-01`, -1).slice(0, 7))} aria-label="Mes anterior" className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center cursor-pointer">
              <ChevronLeft className="w-4 h-4" aria-hidden />
            </button>
            <p className="text-[17px] font-semibold text-[var(--text-primary)] min-w-[150px] text-center">{monthLabel}</p>
            <button
              type="button"
              disabled={monthKey >= today.slice(0, 7)}
              onClick={() => setMonthKey(addMonths(`${monthKey}-01`, 1).slice(0, 7))}
              aria-label="Mes siguiente"
              className="w-9 h-9 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          </div>

          <Card title="Cobrado contra gastos">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Stat value={<span className="text-[18px] text-[var(--semantic-green)]">{pair(month.cobrado, privacyMode)}</span>} label="cobrado" />
              <Stat value={<span className="text-[18px] text-[var(--semantic-red)]">{pair(month.gastos, privacyMode)}</span>} label="gastos registrados" />
              <Stat
                value={<span className="text-[18px]">{pair({ ARS: month.cobrado.ARS - month.gastos.ARS, USD: month.cobrado.USD - month.gastos.USD }, privacyMode)}</span>}
                label="neto"
              />
            </div>
          </Card>

          <Card title="Falta facturar" subtitle={month.sinFacturar.length ? 'Pagos del mes sin comprobante emitido.' : 'Todo lo cobrado este mes está facturado.'}>
            {month.sinFacturar.length > 0 && (
              <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)]">
                {month.sinFacturar.map((s, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2 text-[14px]">
                    <span className="text-[var(--text-primary)] truncate">{s.clientName}<span className="text-[12px] text-[var(--text-tertiary)] ml-2">{shortDay(s.date)}</span></span>
                    <span className="tabular-nums font-semibold">{privacyMode ? '••••' : money(s.amount, s.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Renovaciones de los próximos 30 días" subtitle={month.renovaciones.length ? 'Dominios, hosting y suscripciones que vencen pronto.' : 'Nada vence en los próximos 30 días.'}>
            {month.renovaciones.length > 0 && (
              <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)]">
                {month.renovaciones.map(f => (
                  <li key={f.id} className="flex items-center justify-between px-3 py-2 text-[14px]">
                    <span className="text-[var(--text-primary)] truncate">
                      {f.name}
                      <span className="text-[12px] text-[var(--text-tertiary)] ml-2">{shortDay(f.nextDueDate)}{f.clientName ? ` · ${f.clientName}` : ''}</span>
                    </span>
                    <span className="tabular-nums font-semibold">{privacyMode ? '••••' : money(f.amount, f.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => onNavigate('/gastos-fijos')} className="text-[14px] text-[var(--accent)] font-medium flex items-center gap-1 cursor-pointer">
              Ver gastos fijos <ArrowRight className="w-4 h-4" aria-hidden />
            </button>
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportsView;
