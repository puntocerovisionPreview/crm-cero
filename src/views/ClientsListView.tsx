import React, { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { AgendaMeeting, IncomeRecord, Project, getServiceType } from '../types';
import { calculateProjectBilling } from '../utils/paymentPlans';
import { nextMeeting } from '../portal/model';

type Filter = 'activos' | 'paf' | 'web' | 'archivados';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'activos', label: 'Activos' },
  { id: 'paf', label: 'PAF' },
  { id: 'web', label: 'Web' },
  { id: 'archivados', label: 'Archivados' },
];

interface Row {
  project: Project;
  tipo: string;
  revisar: number;
  cobro: { fecha: string; monto: string; vencido: boolean } | null;
  reunion: { fecha: string; hora?: string } | null;
  dot: string; // punto de estado: lo único con color
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/**
 * CLIENTES: una lista limpia. Por fila: estudio, tipo y estado; próximo cobro y
 * próxima reunión; avisos para revisar. Tocar la fila abre la ficha.
 * La vista completa anterior sigue en /clientes?vista=completa.
 */
export const ClientsListView: React.FC<{
  projects: Project[];
  meetings: AgendaMeeting[];
  incomes: IncomeRecord[];
  privacyMode?: boolean;
  onNavigate: (path: string) => void;
}> = ({ projects, meetings, incomes, privacyMode, onNavigate }) => {
  const [filter, setFilter] = useState<Filter>('activos');
  const [q, setQ] = useState('');
  const today = new Date().toLocaleDateString('en-CA');

  const rows = useMemo<Row[]>(() => projects
    .filter((p) => (filter === 'archivados' ? p.archived : !p.archived))
    .filter((p) => filter === 'paf' ? getServiceType(p.projectType) === 'paf' : filter === 'web' ? getServiceType(p.projectType) === 'web' : true)
    .filter((p) => !q.trim() || `${p.clientName} ${p.ownerName || ''} ${p.clientEmail || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .map((p) => {
      const billing = calculateProjectBilling(p, incomes);
      const money = (n: number) => (privacyMode ? '••••' : `${billing.currency === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`);
      const cuota = [...(p.installments || [])].filter((i) => !i.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      const next = cuota ? { fecha: cuota.dueDate, monto: cuota.amount } : billing.nextCommitment ? { fecha: billing.nextCommitment.dueDate, monto: billing.nextCommitment.amount } : null;
      const cobro = next ? { fecha: next.fecha, monto: money(next.monto), vencido: next.fecha < today } : null;
      const revisar = (p.pafTareas || []).filter((t) => t.estado === 'enviada').length;
      const service = getServiceType(p.projectType);
      return {
        project: p,
        tipo: p.isLead ? 'Posible cliente' : service === 'paf' ? 'PAF' : service === 'web' ? 'Web' : 'Otro',
        revisar,
        cobro,
        reunion: nextMeeting(meetings, p.id, today),
        dot: cobro?.vencido ? 'bg-rose-500' : revisar ? 'bg-amber-500' : p.archived ? 'bg-zinc-600' : 'bg-emerald-500',
      };
    })
    // Lo que pide atención, arriba
    .sort((a, b) => Number(!!b.cobro?.vencido) - Number(!!a.cobro?.vencido) || b.revisar - a.revisar || a.project.clientName.localeCompare(b.project.clientName)),
  [projects, meetings, incomes, filter, q, privacyMode, today]);

  return (
    <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 pb-28 pt-2 space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Clientes</h1>
        <button type="button" onClick={() => onNavigate('/clientes/nuevo')} className="btn-solid-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"><Plus className="w-4 h-4" />Nuevo cliente</button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Filtro">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${filter === f.id ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-tertiary)] w-full sm:w-56">
          <Search className="w-3.5 h-3.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar cliente" className="w-full bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]" />
        </label>
      </div>

      {rows.length ? (
        <ul className="card-swiss divide-y divide-[var(--border-divider)]">
          {rows.map((r) => (
            <li key={r.project.id}>
              <button type="button" onClick={() => onNavigate(`/clientes/${r.project.id}`)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left group">
                <span className={`w-2 h-2 shrink-0 rounded-full ${r.dot}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">{r.project.clientName}</span>
                    <span className="shrink-0 text-xs text-[var(--text-tertiary)]">{r.tipo} · {r.project.status}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[var(--text-secondary)]">
                    <span>{r.cobro ? <>Cobro {r.cobro.monto} · {fmt(r.cobro.fecha)}{r.cobro.vencido && <span className="text-rose-500"> vencido</span>}</> : 'Sin cobro pendiente'}</span>
                    <span>{r.reunion ? `Reunión ${fmt(r.reunion.fecha)}${r.reunion.hora ? ` ${r.reunion.hora}` : ''}` : 'Sin reunión'}</span>
                    {r.revisar > 0 && <span className="text-[var(--text-primary)]">{r.revisar} para revisar</span>}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">
          {q ? 'No hay clientes con ese nombre.' : filter === 'archivados' ? 'No hay clientes archivados.' : 'Todavía no hay clientes acá.'}
        </p>
      )}

      <p className="text-center text-xs text-[var(--text-tertiary)]">
        <button type="button" onClick={() => onNavigate('/clientes?vista=completa')} className="underline underline-offset-4 hover:text-[var(--text-primary)]">Ver la vista completa (cobros, presupuestos, roadmap)</button>
      </p>
    </div>
  );
};
