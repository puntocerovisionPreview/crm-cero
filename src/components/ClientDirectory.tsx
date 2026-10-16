import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Instagram, MessageCircle, Search, Sparkles, Users } from 'lucide-react';
import { AgendaMeeting, Client, IncomeRecord, Project } from '../types';
import { summarizeClients, ClientSummary } from '../utils/clients';
import { findDataIssues } from '../utils/dataReview';
import { calculateProjectBilling } from '../utils/paymentPlans';
import { formatWhatsAppUrl } from '../utils/contact';
import { hapticFeedback } from '../utils/haptics';
import { todayLocal } from '../utils/dates';

interface Props {
  clients: Client[];
  projects: Project[];
  incomes: IncomeRecord[];
  meetings: AgendaMeeting[];
  privacyMode?: boolean;
  onUpdateClient: (client: Client) => void;
  onOpenProject?: (projectId: string) => void;
}

const fmt = (n: number, c: 'USD' | 'ARS', privacy?: boolean) =>
  privacy ? '••••' : `${c === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`;

function moneyPair(v: { ARS: number; USD: number }, privacy?: boolean): string {
  const parts: string[] = [];
  if (v.USD) parts.push(fmt(v.USD, 'USD', privacy));
  if (v.ARS) parts.push(fmt(v.ARS, 'ARS', privacy));
  return parts.join(' + ') || '—';
}

function sinceLabel(date?: string): string {
  if (!date) return 'Sin contacto registrado';
  const days = Math.round((Date.parse(todayLocal()) - Date.parse(date.slice(0, 10))) / 86400000);
  if (days <= 0) return 'Contacto hoy';
  if (days === 1) return 'Contacto ayer';
  if (days < 30) return `Contacto hace ${days} días`;
  const months = Math.round(days / 30);
  return `Contacto hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

const TYPE_LABEL: Record<string, string> = { web: 'Web', paf_pro: 'PAF Pro', paf_base: 'PAF Base', otro: 'Otro' };

export const ClientDirectory: React.FC<Props> = ({ clients, projects, incomes, meetings, privacyMode, onUpdateClient, onOpenProject }) => {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);

  const summaries = useMemo(() => summarizeClients(clients, projects, incomes, meetings), [clients, projects, incomes, meetings]);
  const issues = useMemo(() => findDataIssues(projects, incomes), [projects, incomes]);
  const projectName = (id?: string) => projects.find((p) => p.id === id)?.clientName;

  const filtered = summaries.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.client.name.toLowerCase().includes(q) || (s.client.rubro || '').toLowerCase().includes(q);
  });

  const unlinkedProjects = projects.filter((p) => !p.clientId).length;

  return (
    <div className="space-y-4">
      {issues.length > 0 && (
        <section className="rounded-[var(--radius-card)] border border-amber-500/30 bg-amber-500/5">
          <button
            type="button"
            onClick={() => setShowIssues((v) => !v)}
            className="w-full flex items-center gap-3 p-4 text-left"
            aria-expanded={showIssues}
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Encontré {issues.length} {issues.length === 1 ? 'dato para revisar' : 'datos para revisar'}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">Pagos repetidos, cobros de más o ingresos sin vincular. No cambio nada sin vos.</p>
            </div>
            {showIssues ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
          </button>
          {showIssues && (
            <ul className="px-4 pb-4 space-y-2">
              {issues.map((issue) => (
                <li key={issue.id} className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{issue.title}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{issue.detail}</p>
                    </div>
                    {issue.projectId && onOpenProject && (
                      <button
                        type="button"
                        onClick={() => onOpenProject(issue.projectId!)}
                        className="shrink-0 text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        Abrir ficha
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente o rubro"
            className="w-full pl-9 pr-3 py-2.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <span className="text-sm text-[var(--text-secondary)] shrink-0 tabular-nums">
          {summaries.length} {summaries.length === 1 ? 'cliente' : 'clientes'}
        </span>
      </div>

      {summaries.length === 0 && (
        <div className="p-8 text-center rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)]">
          <Users className="w-6 h-6 mx-auto text-[var(--text-tertiary)] mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">
            {unlinkedProjects > 0 ? 'Agrupando tus proyectos por cliente…' : 'Todavía no hay clientes. Se crean solos al cargar un proyecto.'}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((s) => (
          <ClientRow
            key={s.client.id}
            summary={s}
            open={openId === s.client.id}
            onToggle={() => {
              hapticFeedback.selection();
              setOpenId((id) => (id === s.client.id ? null : s.client.id));
            }}
            privacyMode={privacyMode}
            incomes={incomes}
            onUpdateClient={onUpdateClient}
            onOpenProject={onOpenProject}
          />
        ))}
      </ul>
    </div>
  );
};

const ClientRow: React.FC<{
  summary: ClientSummary;
  open: boolean;
  onToggle: () => void;
  privacyMode?: boolean;
  incomes: IncomeRecord[];
  onUpdateClient: (c: Client) => void;
  onOpenProject?: (id: string) => void;
}> = ({ summary: s, open, onToggle, privacyMode, incomes, onUpdateClient, onOpenProject }) => {
  const owes = s.pending.ARS > 0 || s.pending.USD > 0;
  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--bg-surface-elevated)] transition" aria-expanded={open}>
        <span className="w-10 h-10 rounded-full bg-[var(--bg-surface-muted)] flex items-center justify-center text-sm font-bold text-[var(--text-primary)] shrink-0">
          {s.client.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">{s.client.name}</p>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {[s.client.rubro, `${s.projects.length} ${s.projects.length === 1 ? 'proyecto' : 'proyectos'}`, sinceLabel(s.lastContact)]
              .filter(Boolean)
              .join(' — ')}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{moneyPair(s.collected, privacyMode)}</p>
          <p className={`text-xs tabular-nums ${owes ? 'text-amber-400' : 'text-[var(--text-tertiary)]'}`}>
            {owes ? `Debe ${moneyPair(s.pending, privacyMode)}` : 'Al día'}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--border-subtle)] pt-4">
          {s.hasDeliveredWebWithoutRetainer && (
            <div className="flex items-start gap-2 p-3 rounded-[var(--radius-control)] bg-[var(--accent)]/10 text-sm text-[var(--text-primary)]">
              <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <span>Oportunidad: tiene una web entregada y no tiene mantenimiento mensual. Buen momento para ofrecérselo.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {s.phone && (
              <a
                href={formatWhatsAppUrl(s.phone, `¡Hola ${s.client.name}!`)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-[var(--radius-control)] bg-emerald-600/20 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            )}
            {s.client.instagramUrl && (
              <a href={s.client.instagramUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 text-[var(--text-primary)]">
                <Instagram className="w-3.5 h-3.5" /> Instagram
              </a>
            )}
            {s.client.websiteUrl && (
              <a href={s.client.websiteUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 text-[var(--text-primary)]">
                <ExternalLink className="w-3.5 h-3.5" /> Sitio web
              </a>
            )}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)]">Proyectos</h3>
            <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
              {s.projects.map((p) => {
                const b = calculateProjectBilling(p, incomes);
                return (
                  <li key={p.id} className="flex items-center gap-3 p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {TYPE_LABEL[p.projectType || ''] || 'Proyecto'}
                        {p.archived ? ' (archivado)' : ''}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">{p.status} — desde {(p.startDate || p.createdAt || '').slice(0, 10)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs tabular-nums text-[var(--text-primary)]">
                        {fmt(b.totalCobrado, b.currency, privacyMode)} de {fmt(b.montoAcordado, b.currency, privacyMode)}
                      </p>
                      {b.saldoPendiente > 0 && <p className="text-xs text-amber-400 tabular-nums">Saldo {fmt(b.saldoPendiente, b.currency, privacyMode)}</p>}
                    </div>
                    {onOpenProject && (
                      <button type="button" onClick={() => onOpenProject(p.id)} className="text-xs font-semibold text-[var(--accent)] hover:underline shrink-0">
                        Abrir
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Rubro</span>
              <input
                defaultValue={s.client.rubro || ''}
                onBlur={(e) => e.target.value !== (s.client.rubro || '') && onUpdateClient({ ...s.client, rubro: e.target.value })}
                className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">WhatsApp</span>
              <input
                defaultValue={s.client.phone || s.phone || ''}
                onBlur={(e) => e.target.value !== (s.client.phone || '') && onUpdateClient({ ...s.client, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Notas del cliente</span>
            <textarea
              defaultValue={s.client.notes || ''}
              rows={3}
              onBlur={(e) => e.target.value !== (s.client.notes || '') && onUpdateClient({ ...s.client, notes: e.target.value })}
              placeholder="Cómo le gusta trabajar, quién decide, preferencias de pago…"
              className="w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </label>
        </div>
      )}
    </li>
  );
};
