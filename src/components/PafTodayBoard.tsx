import React, { useMemo } from 'react';
import { AlertOctagon, BellRing, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, FileText, NotebookPen, Package, Timer } from 'lucide-react';
import { AgendaMeeting, Project } from '../types';
import { PRESENCIA_HITOS, pafTodayRows } from '../portal/model';
import { isActivePafStudent } from '../panels/paf';
import { itemsClientesHoy, type ItemClienteHoy } from '../automation/clientes';
import { saludCliente, textoVisita } from '../portal/salud';
import { useVisitas } from '../portal/useVisitas';
import { SALUD_DOT } from './ClienteSalud';

const ICONO: Record<ItemClienteHoy['tipo'], React.ElementType> = {
  revisar: BellRing, reunion: CalendarDays, acuerdos: NotebookPen, decision: Package,
  accion: ClipboardList, bloqueado: AlertOctagon, vencidas: Timer, reportes: FileText,
};

/**
 * Inicio: "Tus clientes hoy". Arriba, lo que tus clientes necesitan de vos hoy (revisar,
 * reuniones, acuerdos, decisiones, acciones vencidas), cada cosa lleva a su ficha.
 * Abajo, cómo está cada estudio: semáforo, el motivo principal y si entra a su portal.
 */
export const PafTodayBoard: React.FC<{ projects: Project[]; meetings: AgendaMeeting[]; onOpen: (path: string) => void }> = ({ projects, meetings, onOpen }) => {
  const today = new Date().toLocaleDateString('en-CA');
  const visitas = useVisitas();
  const items = useMemo(() => itemsClientesHoy(projects, meetings, today), [projects, meetings, today]);
  const rows = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    const nivel = { riesgo: 0, atencion: 1, ok: 2 } as const;
    return pafTodayRows(projects.filter(isActivePafStudent), meetings, today)
      .map((r) => {
        const p = byId.get(r.id)!;
        const visita = p.pafClienteId ? visitas.get(p.pafClienteId) : undefined;
        return { ...r, salud: saludCliente(p, { meetings, visita, today }), visita: textoVisita(p, visita, today) };
      })
      .sort((a, b) => nivel[a.salud.nivel] - nivel[b.salud.nivel]);
  }, [projects, meetings, today, visitas]);
  if (!rows.length && !items.length) return null;

  return (
    <section className="card-swiss p-5" aria-label="Tus clientes hoy">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Tus clientes hoy</h2>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {items.length ? `${items.length} ${items.length === 1 ? 'cosa' : 'cosas'} para hacer` : `${rows.length} ${rows.length === 1 ? 'estudio' : 'estudios'} en curso`}
        </p>
      </div>

      {items.length ? (
        <ul className="mt-3 space-y-1">
          {items.map((it, i) => {
            const Icon = ICONO[it.tipo];
            return (
              <li key={`${it.tipo}-${it.projectId || ''}-${i}`}>
                <button type="button" onClick={() => onOpen(it.projectId ? `/clientes/${it.projectId}` : '/clientes')}
                  className="w-full flex items-start gap-2.5 rounded-[var(--radius-control)] px-2 py-2 -mx-2 text-left hover:bg-[var(--bg-surface-muted)] cursor-pointer group">
                  <Icon className={`mt-0.5 w-4 h-4 shrink-0 ${it.tipo === 'bloqueado' ? 'text-rose-500' : it.tipo === 'revisar' ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`} aria-hidden />
                  <span className="flex-1 min-w-0 text-[13px] text-[var(--text-primary)]">
                    {it.texto}{it.nota && <span className="text-amber-600"> · {it.nota}</span>}
                  </span>
                  <ChevronRight className="mt-0.5 w-4 h-4 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-[var(--text-secondary)]"><CheckCircle2 className="w-4 h-4 text-emerald-500" />Nada urgente con tus clientes hoy.</p>
      )}

      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--border-divider)] border-t border-[var(--border-divider)]">
          {rows.map((r) => {
            const motivo = r.salud.motivos[0];
            return (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(`/clientes/${r.id}`)} className="w-full flex items-center gap-3 py-3 text-left cursor-pointer group">
                  <span className={`w-2 h-2 shrink-0 rounded-full ${SALUD_DOT[r.salud.nivel]}`} aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[14px] font-medium text-[var(--text-primary)]">{r.estudio}</span>
                    {motivo
                      ? <span className={`block truncate text-[12px] ${motivo.nivel === 'riesgo' ? 'text-rose-500' : 'text-amber-600'}`}>{motivo.texto}{r.salud.motivos.length > 1 ? ` · y ${r.salud.motivos.length - 1} más` : ''}</span>
                      : <span className="block truncate text-[12px] text-[var(--text-tertiary)]">
                          {r.etapa ? `Etapa ${r.etapa} · ${PRESENCIA_HITOS[r.etapa - 1]}` : 'Sin portal'}
                          {' · '}
                          {r.proximaReunion ? `Reunión ${r.proximaReunion.fecha.slice(8, 10)}/${r.proximaReunion.fecha.slice(5, 7)}${r.proximaReunion.hora ? ` ${r.proximaReunion.hora}` : ''}` : 'Sin reunión agendada'}
                        </span>}
                  </span>
                  <span className="shrink-0 text-right">
                    {r.paraRevisar > 0 && <span className="block rounded-full bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] px-2 py-0.5 text-[11px] font-semibold tabular-nums">{r.paraRevisar} para revisar</span>}
                    <span className="block text-[12px] text-[var(--text-tertiary)]">{r.visita || (r.diasSinNovedades === null ? 'Sin novedades' : r.diasSinNovedades === 0 ? 'Novedades hoy' : `${r.diasSinNovedades} d sin novedades`)}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
