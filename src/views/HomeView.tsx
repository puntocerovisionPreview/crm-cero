import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Moon } from 'lucide-react';
import { weeklyCollections } from '../utils/periodic';
import { AgendaMeeting, AgendaTask, IncomeRecord, Project, SecondBrainNote, StudioPaymentSettings } from '../types';
import { Top3Card } from '../components/Top3Card';
import { HomeMoneyCard } from '../components/HomeMoneyCard';
import { DayCloseModal } from '../components/DayCloseModal';
import { JournalEntry, subscribeJournal } from '../utils/journal';
import { SECTORS, Sector, SectorKey } from '../utils/sectors';
import { getCollectedEntries, monthMatcher, sumByCurrency } from '../utils/ledger';
import { calculateProjectBilling } from '../utils/paymentPlans';
import { useProspecting } from '../prospecting/useProspecting';
import { buildDailyQueue, pendingOutcomes } from '../prospecting/core';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { ColdClientsCard } from '../components/ColdClientsCard';
import { PafTodayBoard } from '../components/PafTodayBoard';
import { coldClients } from '../utils/coldClients';
import { hapticFeedback } from '../utils/haptics';
import { usePulse } from '../components/ProspectingVisuals';
import { useContent } from '../content/useContent';
import { ContentTodayCard } from '../components/ContentTodayCard';
import { addDays } from '../utils/dates';
import { isLate, nextToPublish, statusStage } from '../content/model';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  notes: SecondBrainNote[];
  pendingPayments: number;
  privacyMode?: boolean;
  onNavigate: (path: string) => void;
  onAddTask: (task: Omit<AgendaTask, 'id' | 'createdAt'>) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onToggleTask: (id: string) => void;
  onMoveTaskDate: (id: string, date: string) => void;
  studioSettings?: StudioPaymentSettings;
  showToast?: (msg: string) => void;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
};

const money = (n: number, cur: 'ARS' | 'USD', privacy?: boolean) =>
  privacy ? '••••' : `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

interface Stat {
  value: string;
  label: string;
  tone?: 'warn' | 'good';
}

const toneClass = (tone?: Stat['tone']) =>
  tone === 'warn' ? 'text-[var(--semantic-amber)]' : tone === 'good' ? 'text-[var(--semantic-green)]' : 'text-[var(--text-primary)]';

const SectorIcon: React.FC<{ sector: Sector; size?: number }> = ({ sector, size = 40 }) => {
  const Icon = sector.icon;
  return (
    <span className="rounded-[12px] flex items-center justify-center text-white shrink-0" style={{ backgroundColor: sector.tint, width: size, height: size }} aria-hidden>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2} />
    </span>
  );
};

const sectorPath = (key: SectorKey) => SECTORS.find(s => s.key === key)!.items[0].path;

const DETALLE_KEY = 'inicio_detalle';

// Inicio: elegís el sector del estudio y entrás a sus pantallas
export const HomeView: React.FC<Props> = ({
  tasks,
  meetings,
  projects,
  incomes,
  notes,
  pendingPayments,
  privacyMode,
  onNavigate,
  onAddTask,
  onUpdateProject,
  onToggleTask,
  onMoveTaskDate,
  studioSettings,
  showToast,
}) => {
  const today = todayStr();
  const [showDayClose, setShowDayClose] = useState(false);
  const [journal, setJournal] = useState<Record<string, JournalEntry>>({});
  useEffect(() => subscribeJournal(setJournal, 7), []);
  const dayClosed = Boolean(journal[today]);
  const evening = new Date().getHours() >= 18;
  const month = today.slice(0, 7);
  const { prospects, events, settings, loadError } = useProspecting();

  const data = useMemo(() => {
    const todayTasks = tasks.filter(t => t.date === today);
    const pendingToday = todayTasks.filter(t => !t.completed);
    const overdue = tasks.filter(t => t.date && t.date < today && !t.completed);
    const todayMeetings = meetings.filter(m => m.date === today && !m.completed).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    const active = projects.filter(p => !p.archived && !p.isLead);
    const leads = projects.filter(p => !p.archived && p.isLead);
    // Mismo criterio que la cobranza de Dinero: saldo del acuerdo o una cuota/abono que ya toca cobrar
    const porCobrar = new Set(weeklyCollections(projects, incomes, today).map(c => c.projectId));
    const withBalance = active.filter(p => {
      if (porCobrar.has(p.id)) return true;
      try {
        return calculateProjectBilling(p, incomes).saldoPendiente > 0;
      } catch {
        return false;
      }
    });
    const collected = sumByCurrency(getCollectedEntries(incomes, projects, monthMatcher(month)));
    return { todayTasks, pendingToday, overdue, todayMeetings, active, leads, withBalance, collected };
  }, [tasks, meetings, projects, incomes, today, month]);

  const cold = useMemo(() => coldClients(projects, meetings, tasks, today), [projects, meetings, tasks, today]);

  const prospecting = useMemo(() => {
    if (!prospects) return null;
    return { queue: buildDailyQueue(prospects, today, settings).items.length, pending: pendingOutcomes(prospects, today).length };
  }, [prospects, settings, today]);
  const pulse = usePulse(prospects || [], events, today, settings);
  const { pieces: content } = useContent();
  const contentStats = useMemo(() => {
    if (!content) return null;
    const next = nextToPublish(content, today);
    return {
      next,
      thisWeek: content.filter(p => p.date >= today && p.date <= addDays(today, 6) && statusStage(p.status) !== 'publicado').length,
      late: content.filter(p => isLate(p, today)).length,
      total: content.length,
    };
  }, [content, today]);

  const stats: Record<SectorKey, Stat[]> = {
    dia: [
      { value: String(data.pendingToday.length), label: data.pendingToday.length === 1 ? 'tarea pendiente' : 'tareas pendientes' },
      { value: String(data.todayMeetings.length), label: data.todayMeetings.length === 1 ? 'reunión' : 'reuniones' },
      ...(data.overdue.length ? [{ value: String(data.overdue.length), label: data.overdue.length === 1 ? 'atrasada' : 'atrasadas', tone: 'warn' as const }] : []),
    ],
    prospeccion: prospecting
      ? [
          ...(pulse.mine ? [{ value: String(pulse.mine), label: pulse.mine === 1 ? 'espera tu respuesta' : 'esperan tu respuesta', tone: 'good' as const }] : []),
          { value: String(prospecting.queue), label: 'para hacer hoy' },
          ...(prospecting.pending ? [{ value: String(prospecting.pending), label: 'sin anotar si respondieron', tone: 'warn' as const }] : []),
        ]
      : [{ value: loadError ? '—' : '…', label: loadError ? 'abrí la sección para ver tu cola' : 'cargando' }],
    clientes: [
      { value: String(data.active.length), label: 'activos' },
      { value: String(data.withBalance.length), label: 'por cobrar', ...(data.withBalance.length ? { tone: 'warn' as const } : {}) },
      ...(data.leads.length ? [{ value: String(data.leads.length), label: data.leads.length === 1 ? 'posible' : 'posibles' }] : []),
      ...(cold.length ? [{ value: String(cold.length), label: 'sin contacto', tone: 'warn' as const }] : []),
    ],
    finanzas: [
      { value: money(data.collected.ARS, 'ARS', privacyMode), label: 'cobrado este mes', tone: 'good' },
      ...(data.collected.USD ? [{ value: money(data.collected.USD, 'USD', privacyMode), label: 'en dólares', tone: 'good' as const }] : []),
      ...(pendingPayments ? [{ value: String(pendingPayments), label: 'pagos por registrar', tone: 'warn' as const }] : []),
    ],
    contenido: !contentStats
      ? [{ value: '…', label: 'cargando' }]
      : contentStats.total === 0
        ? [{ value: '—', label: 'importá tu calendario' }]
        : [
            { value: String(contentStats.thisWeek), label: 'por publicar en 7 días' },
            ...(contentStats.next ? [{ value: contentStats.next.date === today ? 'Hoy' : `${contentStats.next.date.slice(8, 10)}/${contentStats.next.date.slice(5, 7)}`, label: 'la próxima' }] : []),
            ...(contentStats.late ? [{ value: String(contentStats.late), label: 'sin marcar publicada', tone: 'warn' as const }] : []),
          ],
    cerebro: [{ value: String(notes.length), label: notes.length === 1 ? 'nota' : 'notas' }],
  };

  const go = (path: string) => {
    hapticFeedback.selection();
    onNavigate(path);
  };

  // Lo que pide atención ahora, en una sola fila: cada aviso lleva a su lugar
  const avisos: { key: string; n: number; label: string; path: string }[] = [
    { key: 'atrasadas', n: data.overdue.length, label: data.overdue.length === 1 ? 'tarea atrasada' : 'tareas atrasadas', path: sectorPath('dia') },
    { key: 'respuestas', n: pulse.mine, label: pulse.mine === 1 ? 'prospecto espera tu respuesta' : 'prospectos esperan tu respuesta', path: sectorPath('prospeccion') },
    { key: 'anotar', n: prospecting?.pending || 0, label: 'sin anotar si respondieron', path: sectorPath('prospeccion') },
    { key: 'cobrar', n: data.withBalance.length, label: data.withBalance.length === 1 ? 'cliente por cobrar' : 'clientes por cobrar', path: sectorPath('finanzas') },
    { key: 'pagos', n: pendingPayments, label: pendingPayments === 1 ? 'pago por registrar' : 'pagos por registrar', path: sectorPath('finanzas') },
    { key: 'frios', n: cold.length, label: cold.length === 1 ? 'cliente sin contacto' : 'clientes sin contacto', path: sectorPath('clientes') },
    { key: 'contenido', n: contentStats?.late || 0, label: 'sin marcar publicada', path: sectorPath('contenido') },
  ].filter(x => x.n > 0);

  // El detalle (dinero, constancia, clientes fríos) queda plegado: lo abrís cuando lo querés mirar
  const [detalle, setDetalle] = useState(() => {
    try { return localStorage.getItem(DETALLE_KEY) === '1'; } catch { return false; }
  });
  const toggleDetalle = () => setDetalle(v => {
    try { localStorage.setItem(DETALLE_KEY, v ? '0' : '1'); } catch { /* sin almacenamiento */ }
    return !v;
  });

  return (
    <div className="max-w-5xl mx-auto w-full px-1 sm:px-2 pb-28 space-y-6">
      <header className="pt-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-[34px] leading-tight font-bold tracking-tight text-[var(--text-primary)]">{greeting()}</h1>
        <p className="text-[15px] text-[var(--text-secondary)] mt-0.5">{avisos.length ? 'Esto pide tu atención:' : 'Todo al día. Elegí en qué querés trabajar.'}</p>
        {avisos.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-3" aria-label="Para atender ahora">
            {avisos.map(a => (
              <li key={a.key}>
                <button type="button" onClick={() => go(a.path)} className="h-9 pl-2 pr-3.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[14px] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer transition-colors">
                  <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--semantic-amber)] text-white text-[12px] font-bold tabular-nums flex items-center justify-center">{a.n}</span>
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => setShowDayClose(true)}
            className={`h-9 px-3.5 rounded-full text-[14px] font-medium flex items-center gap-1.5 cursor-pointer ${
              evening && !dayClosed ? 'bg-[#5856D6] text-white' : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            <Moon className="w-4 h-4" aria-hidden />
            {dayClosed ? 'Día cerrado ✓' : 'Cerrar el día'}
          </button>
          <button
            type="button"
            onClick={() => go('/reportes')}
            className="h-9 px-3.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4" aria-hidden />
            Reportes y revisión semanal
          </button>
        </div>
      </header>

      {/* Tus 3 del día */}
      <Top3Card tasks={tasks} today={today} onToggleTask={onToggleTask} onOpenTask={id => go(`/agenda/tarea/${id}`)} />

      {/* Tus clientes hoy: lo que te piden y cómo está cada estudio */}
      <PafTodayBoard projects={projects} meetings={meetings} onOpen={go} onUpdateProject={onUpdateProject} />

      {/* Los sectores del estudio: todos iguales, con su número clave */}
      <section aria-label="Sectores del estudio">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Ir a</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {SECTORS.map(sector => {
            const items = stats[sector.key].slice(0, 2);
            return (
              <button key={sector.key} type="button" onClick={() => go(sector.items[0].path)}
                className="card-swiss group p-4 flex flex-col gap-3 text-left cursor-pointer hover:border-[var(--border-strong)] hover:-translate-y-0.5 transition">
                <span className="flex items-center gap-3">
                  <SectorIcon sector={sector} />
                  <span className="flex-1 min-w-0 text-[17px] font-semibold text-[var(--text-primary)] leading-tight">{sector.label}</span>
                  <ChevronRight className="hidden sm:block w-4 h-4 text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  {items.map(st => (
                    <span key={st.label} className="flex items-baseline gap-1.5 min-w-0">
                      <span className={`text-[17px] font-bold tabular-nums ${toneClass(st.tone)}`}>{st.value}</span>
                      <span className="text-[12px] text-[var(--text-secondary)] truncate">{st.label}</span>
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Más detalle: plegado para que Inicio sea corto */}
      <section>
        <button type="button" onClick={toggleDetalle} aria-expanded={detalle}
          className="w-full flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-left cursor-pointer hover:border-[var(--border-strong)] transition-colors">
          <span>
            <span className="block text-[15px] font-semibold text-[var(--text-primary)]">Más detalle</span>
            <span className="block text-[12px] text-[var(--text-secondary)]">Contenido de hoy, dinero, clientes sin contacto y tu constancia</span>
          </span>
          <ChevronDown className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform ${detalle ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {detalle && (
          <div className="mt-4 space-y-6">
            <ContentTodayCard onNavigate={go} />
            <HomeMoneyCard projects={projects} incomes={incomes} today={today} privacyMode={privacyMode} onOpen={() => go('/dinero')} />
            <ColdClientsCard
              clients={cold}
              onOpenClient={id => go(`/clientes/${id}`)}
              onCreateTask={c =>
                onAddTask({
                  title: `Escribirle a ${c.project.clientName}`,
                  date: today,
                  completed: false,
                  priority: 'media',
                  projectId: c.project.id,
                  projectName: c.project.clientName,
                  notes: `Último contacto hace ${c.daysSince} días.`,
                })
              }
              onMarkContacted={c => onUpdateProject(c.project.id, { lastContactDate: today })}
            />
            <ActivityHeatmap tasks={tasks} meetings={meetings} prospectEvents={events} today={today} />
          </div>
        )}
      </section>

      <DayCloseModal
        isOpen={showDayClose}
        onClose={() => setShowDayClose(false)}
        tasks={tasks}
        today={today}
        initialText={journal[today]?.text || ''}
        onMoveTaskDate={onMoveTaskDate}
        onToggleTask={onToggleTask}
        showToast={showToast}
      />
    </div>
  );
};

export default HomeView;
