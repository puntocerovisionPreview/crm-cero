import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { AgendaMeeting, AgendaTask, IncomeRecord, Project, SecondBrainNote } from '../types';
import { SECTORS, Sector, SectorKey } from '../utils/sectors';
import { getCollectedEntries, monthMatcher, sumByCurrency } from '../utils/ledger';
import { calculateProjectBilling } from '../utils/paymentPlans';
import { useProspecting } from '../prospecting/useProspecting';
import { buildDailyQueue, pendingOutcomes } from '../prospecting/core';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  notes: SecondBrainNote[];
  pendingPayments: number;
  privacyMode?: boolean;
  onNavigate: (path: string) => void;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
};

const money = (n: number, cur: 'ARS' | 'USD', privacy?: boolean) =>
  privacy ? '••••' : `${cur === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;


interface Stat {
  value: string;
  label: string;
  tone?: 'warn' | 'good';
}

// Inicio: elegís el sector del estudio y entrás a sus pantallas
export const HomeView: React.FC<Props> = ({ tasks, meetings, projects, incomes, notes, pendingPayments, privacyMode, onNavigate }) => {
  const today = todayStr();
  const month = today.slice(0, 7);
  const { prospects, settings, loadError } = useProspecting();

  const data = useMemo(() => {
    const todayTasks = tasks.filter(t => t.date === today);
    const pendingToday = todayTasks.filter(t => !t.completed);
    const overdue = tasks.filter(t => t.date && t.date < today && !t.completed);
    const todayMeetings = meetings.filter(m => m.date === today && !m.completed).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
    const active = projects.filter(p => !p.archived && !p.isLead);
    const leads = projects.filter(p => !p.archived && p.isLead);
    const withBalance = active.filter(p => {
      try {
        return calculateProjectBilling(p, incomes).saldoPendiente > 0;
      } catch {
        return false;
      }
    });
    const collected = sumByCurrency(getCollectedEntries(incomes, projects, monthMatcher(month)));
    return { todayTasks, pendingToday, overdue, todayMeetings, active, leads, withBalance, collected };
  }, [tasks, meetings, projects, incomes, today, month]);

  const prospecting = useMemo(() => {
    if (!prospects) return null;
    return { queue: buildDailyQueue(prospects, today, settings).items.length, pending: pendingOutcomes(prospects, today).length };
  }, [prospects, settings, today]);

  const stats: Record<SectorKey, Stat[]> = {
    dia: [
      { value: String(data.pendingToday.length), label: data.pendingToday.length === 1 ? 'tarea pendiente' : 'tareas pendientes' },
      { value: String(data.todayMeetings.length), label: data.todayMeetings.length === 1 ? 'reunión' : 'reuniones' },
      ...(data.overdue.length ? [{ value: String(data.overdue.length), label: data.overdue.length === 1 ? 'atrasada' : 'atrasadas', tone: 'warn' as const }] : []),
    ],
    prospeccion: prospecting
      ? [
          { value: String(prospecting.queue), label: 'para contactar hoy' },
          ...(prospecting.pending ? [{ value: String(prospecting.pending), label: 'sin resultado cargado', tone: 'warn' as const }] : []),
        ]
      : [{ value: loadError ? '—' : '…', label: loadError ? 'abrí la sección para ver tu cola' : 'cargando' }],
    clientes: [
      { value: String(data.active.length), label: 'activos' },
      { value: String(data.withBalance.length), label: 'con saldo' },
      ...(data.leads.length ? [{ value: String(data.leads.length), label: data.leads.length === 1 ? 'posible' : 'posibles' }] : []),
    ],
    finanzas: [
      { value: money(data.collected.ARS, 'ARS', privacyMode), label: 'cobrado este mes', tone: 'good' },
      ...(data.collected.USD ? [{ value: money(data.collected.USD, 'USD', privacyMode), label: 'en dólares', tone: 'good' as const }] : []),
      ...(pendingPayments ? [{ value: String(pendingPayments), label: 'pagos por registrar', tone: 'warn' as const }] : []),
    ],
    cerebro: [{ value: String(notes.length), label: notes.length === 1 ? 'nota' : 'notas' }],
  };

  const go = (path: string) => {
    hapticFeedback.selection();
    onNavigate(path);
  };

  const featured = SECTORS.filter(s => s.featured);
  const others = SECTORS.filter(s => !s.featured);

  const StatsRow: React.FC<{ items: Stat[]; big?: boolean }> = ({ items, big }) => (
    <dl className="flex flex-wrap gap-x-5 gap-y-1">
      {items.map(st => (
        <div key={st.label} className="flex items-baseline gap-1.5">
          <dt className="sr-only">{st.label}</dt>
          <dd
            className={`${big ? 'text-[28px]' : 'text-[20px]'} font-bold tracking-tight tabular-nums ${
              st.tone === 'warn' ? 'text-[var(--semantic-amber)]' : st.tone === 'good' ? 'text-[var(--semantic-green)]' : 'text-[var(--text-primary)]'
            }`}
          >
            {st.value}
          </dd>
          <span className="text-[13px] text-[var(--text-secondary)]" aria-hidden>
            {st.label}
          </span>
        </div>
      ))}
    </dl>
  );

  const SectorIcon: React.FC<{ sector: Sector; size?: number }> = ({ sector, size = 44 }) => {
    const Icon = sector.icon;
    return (
      <span
        className="rounded-[12px] flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: sector.tint, width: size, height: size }}
        aria-hidden
      >
        <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2} />
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto w-full px-1 sm:px-2 pb-28 space-y-6">
      <header className="pt-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-[34px] leading-tight font-bold tracking-tight text-[var(--text-primary)]">{greeting()}</h1>
        <p className="text-[15px] text-[var(--text-secondary)] mt-0.5">¿En qué parte del estudio querés trabajar?</p>
      </header>

      {/* Sectores principales */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Sectores principales">
        {featured.map(sector => (
          <article key={sector.key} className="card-swiss p-5 flex flex-col gap-4">
            <button type="button" onClick={() => go(sector.items[0].path)} className="flex items-center gap-3 text-left cursor-pointer group">
              <SectorIcon sector={sector} />
              <span className="flex-1 min-w-0">
                <span className="block text-[22px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">{sector.label}</span>
                <span className="block text-[13px] text-[var(--text-secondary)]">{sector.description}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" aria-hidden />
            </button>

            <StatsRow items={stats[sector.key]} big />

            {/* Mi día: las próximas tareas a la vista */}
            {sector.key === 'dia' && (
              <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                {data.todayMeetings.slice(0, 1).map(m => (
                  <li key={m.id}>
                    <button type="button" onClick={() => go(`/agenda/reunion/${m.id}`)} className="w-full min-h-[44px] px-3 py-2 flex items-center gap-2.5 text-left cursor-pointer">
                      <span className="w-2 h-2 rounded-full bg-[#30B0C7] shrink-0" aria-hidden />
                      <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">{m.title}</span>
                      {m.time && <span className="text-[13px] text-[var(--text-tertiary)] tabular-nums">{m.time}</span>}
                    </button>
                  </li>
                ))}
                {data.pendingToday.slice(0, 4).map(t => (
                  <li key={t.id}>
                    <button type="button" onClick={() => go(`/agenda/tarea/${t.id}`)} className="w-full min-h-[44px] px-3 py-2 flex items-center gap-2.5 text-left cursor-pointer">
                      <span className="w-4 h-4 rounded-full border-2 border-[var(--border-strong)] shrink-0" aria-hidden />
                      <span className="flex-1 min-w-0 text-[14px] text-[var(--text-primary)] truncate">{t.title}</span>
                      {t.projectName && <span className="text-[12px] text-[var(--text-tertiary)] truncate max-w-[40%]">{t.projectName}</span>}
                    </button>
                  </li>
                ))}
                {data.pendingToday.length === 0 && data.todayMeetings.length === 0 && (
                  <li className="px-3 py-3 text-[14px] text-[var(--text-secondary)]">Nada pendiente para hoy.</li>
                )}
              </ul>
            )}

            <div className="flex flex-wrap gap-2 mt-auto">
              {sector.items.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    className="h-9 px-3.5 rounded-full bg-[var(--bg-surface-muted)]/70 hover:bg-[var(--bg-surface-muted)] text-[14px] font-medium text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Icon className="w-4 h-4" style={{ color: sector.tint }} aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      {/* Los demás sectores */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Otros sectores">
        {others.map(sector => (
          <button
            key={sector.key}
            type="button"
            onClick={() => go(sector.items[0].path)}
            className="card-swiss p-4 flex flex-col gap-3 text-left cursor-pointer hover:border-[var(--border-strong)] transition-colors"
          >
            <span className="flex items-center gap-3">
              <SectorIcon sector={sector} size={36} />
              <span className="flex-1 min-w-0">
                <span className="block text-[17px] font-semibold text-[var(--text-primary)] leading-tight">{sector.label}</span>
                <span className="block text-[12px] text-[var(--text-secondary)] truncate">{sector.description}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" aria-hidden />
            </span>
            <StatsRow items={stats[sector.key]} />
          </button>
        ))}
      </section>

      <p className="text-center text-[12px] text-[var(--text-tertiary)]">
        Dentro de cada sector, el menú muestra solo sus pantallas. Volvés acá con «Inicio».
      </p>
    </div>
  );
};

export default HomeView;
