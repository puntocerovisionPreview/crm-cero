import React, { useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { AgendaMeeting, IncomeRecord, Project, getServiceType } from '../types';
import { calculateProjectBilling } from '../utils/paymentPlans';
import { WEB_HITOS, nextMeeting } from '../portal/model';
import { colorDe, iniciales } from '../utils/clientLook';
import { ETAPAS, ETAPA_HITOS } from '../portal/presencia';
import { ClientsBoard, TuSemana } from './ClientsBoard';
import { estadoCliente, type EstadoCliente } from '../components/ProximaAccionCard';
import { SALUD_DOT } from '../components/ClienteSalud';
import { resumenCliente, saludCliente, textoVisita, type SaludCliente } from '../portal/salud';
import { useVisitas } from '../portal/useVisitas';
import { itemsClientesHoy } from '../automation/clientes';

type Filter = 'activos' | 'atencion' | 'mi_accion' | 'esperando' | 'bloqueado' | 'paf' | 'web' | 'archivados';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'activos', label: 'Todos' },
  { id: 'atencion', label: 'Necesitan atención' },
  { id: 'mi_accion', label: 'Me necesitan' },
  { id: 'esperando', label: 'Esperando' },
  { id: 'bloqueado', label: 'Trabados' },
  { id: 'paf', label: 'PAF' },
  { id: 'web', label: 'Web' },
  { id: 'archivados', label: 'Archivados' },
];

interface Row {
  project: Project;
  tipo: string;
  cobro: { fecha: string; monto: string; vencido: boolean } | null;
  reunion: { fecha: string; hora?: string } | null;
  estado: EstadoCliente;
  salud: SaludCliente;
  frase: string;
  visita: string | null;
  avance: { label: string; hecho: number; total: number } | null;
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const ORDEN: Record<EstadoCliente, number> = { bloqueado: 0, mi_accion: 1, esperando: 2, sin_accion: 3 };
const NIVEL = { riesgo: 0, atencion: 1, ok: 2 } as const;
const CAPACIDAD = 4;
const lista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/**
 * CLIENTES: cada estudio contado en una frase. Arriba, cuántos tenés y quién te necesita hoy,
 * con lo que hay que hacer y el botón al lado. Tocar un cliente abre su ficha.
 * La vista completa anterior sigue en /clientes?vista=completa.
 */
export const ClientsListView: React.FC<{
  projects: Project[];
  meetings: AgendaMeeting[];
  incomes: IncomeRecord[];
  privacyMode?: boolean;
  onNavigate: (path: string) => void;
  /** Crea (o abre) el cliente de ejemplo */
  onCrearEjemplo?: () => void;
  creandoEjemplo?: boolean;
}> = ({ projects, meetings, incomes, privacyMode, onNavigate, onCrearEjemplo, creandoEjemplo }) => {
  const [filter, setFilter] = useState<Filter>('activos');
  // Tres formas de ver a tus clientes: lista, tablero por etapa y tu semana
  type Vista = 'lista' | 'tablero' | 'semana';
  const [vista, setVistaState] = useState<Vista>(() => { try { return (localStorage.getItem('clientes_vista') as Vista) || 'lista'; } catch { return 'lista'; } });
  const setVista = (v: Vista) => { setVistaState(v); try { localStorage.setItem('clientes_vista', v); } catch { /* sin almacenamiento */ } };
  const [q, setQ] = useState('');
  const today = new Date().toLocaleDateString('en-CA');
  const visitas = useVisitas();

  const rows = useMemo<Row[]>(() => projects
    .filter((p) => (filter === 'archivados' ? p.archived : !p.archived && !p.isLead))
    .filter((p) => filter === 'paf' ? getServiceType(p.projectType) === 'paf' : filter === 'web' ? getServiceType(p.projectType) === 'web' : true)
    .filter((p) => (['mi_accion', 'esperando', 'bloqueado'] as Filter[]).includes(filter) ? estadoCliente(p, today) === filter : true)
    .filter((p) => !q.trim() || `${p.clientName} ${p.ownerName || ''} ${p.clientEmail || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .map((p) => {
      const visita = p.pafClienteId ? visitas.get(p.pafClienteId) : undefined;
      const salud = saludCliente(p, { meetings, visita, today });
      const billing = calculateProjectBilling(p, incomes);
      const money = (n: number) => (privacyMode ? '••••' : `${billing.currency === 'USD' ? 'US$' : '$'} ${Math.round(n).toLocaleString('es-AR')}`);
      const cuota = [...(p.installments || [])].filter((i) => !i.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      const abono = (p.recurringPlans || []).find((r) => r.active);
      const next = cuota ? { fecha: cuota.dueDate, monto: cuota.amount } : billing.nextCommitment ? { fecha: billing.nextCommitment.dueDate, monto: billing.nextCommitment.amount } : abono ? { fecha: abono.nextDueDate, monto: abono.amount } : null;
      const service = getServiceType(p.projectType);
      const etapa = p.pafEtapa || 'presencia';
      const hito = p.pafPortal?.hito || 1;
      const avance = service === 'paf'
        ? { label: `${ETAPAS.find((e) => e.id === etapa)!.label} · hito ${hito} de ${ETAPA_HITOS[etapa].length}`, hecho: hito, total: ETAPA_HITOS[etapa].length }
        : service === 'web' ? { label: `${WEB_HITOS[hito - 1] || WEB_HITOS[0]} · paso ${hito} de ${WEB_HITOS.length}`, hecho: hito, total: WEB_HITOS.length } : null;
      return {
        project: p,
        tipo: service === 'paf' ? 'PAF' : service === 'web' ? 'Web' : 'Otro',
        cobro: next ? { fecha: next.fecha, monto: money(next.monto), vencido: next.fecha < today } : null,
        reunion: nextMeeting(meetings, p.id, today),
        estado: estadoCliente(p, today),
        salud,
        frase: p.archived ? 'Archivado.' : resumenCliente(p, salud, { meetings, today }),
        visita: textoVisita(p, visita, today),
        avance,
      };
    })
    .filter((r) => filter !== 'atencion' || r.salud.nivel !== 'ok')
    // Lo que pide atención, arriba
    .sort((a, b) => (a.project.archived ? 0 : NIVEL[a.salud.nivel]) - (b.project.archived ? 0 : NIVEL[b.salud.nivel]) || ORDEN[a.estado] - ORDEN[b.estado] || a.project.clientName.localeCompare(b.project.clientName)),
  [projects, meetings, incomes, filter, q, privacyMode, today, visitas]);

  const activos = projects.filter((p) => !p.archived && !p.isLead);
  const pafActivos = activos.filter((p) => getServiceType(p.projectType) === 'paf' && !p.ejemplo);
  const hoy = useMemo(() => itemsClientesHoy(projects, meetings, today), [projects, meetings, today]);
  const necesitan = [...new Set(hoy.filter((i) => i.projectId).map((i) => projects.find((p) => p.id === i.projectId)?.clientName).filter(Boolean) as string[])];
  const libres = CAPACIDAD - pafActivos.length;
  const posibles = projects.filter((p) => !p.archived && p.isLead).length;
  const archivados = projects.filter((p) => p.archived).length;

  return (
    <div className={`${vista === 'tablero' ? 'max-w-6xl' : 'max-w-4xl'} w-full mx-auto px-4 sm:px-6 pb-28 pt-4 space-y-10`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)] first-letter:uppercase">Clientes · {new Date(`${today}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <button type="button" onClick={() => onNavigate('/clientes/nuevo')} className="btn-solid-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"><Plus className="w-4 h-4" />Nuevo cliente</button>
      </header>

      <section className="space-y-4">
        <h1 className="max-w-3xl text-3xl sm:text-4xl font-light tracking-tight leading-tight text-[var(--text-primary)]">
          {activos.length ? <>Tenés {activos.length === 1 ? 'un cliente' : `${activos.length} clientes`} en marcha{pafActivos.length ? (libres > 0 ? ` y ${libres === 1 ? 'un lugar libre' : `${libres} lugares libres`}` : ' y la capacidad completa') : ''}. </> : 'Todavía no tenés clientes en marcha. '}
          {necesitan.length ? <>Hoy, <span className="text-orange-500">{lista(necesitan.slice(0, 3))}{necesitan.length > 3 ? ` y ${necesitan.length - 3} más` : ''}</span> te {necesitan.length === 1 ? 'necesita' : 'necesitan'}.</> : activos.length ? 'Hoy nadie te necesita con urgencia.' : ''}
        </h1>
        {pafActivos.length > 0 && (
          <div className="flex items-center gap-1.5" aria-label={`${pafActivos.length} de ${CAPACIDAD} lugares ocupados`}>
            {Array.from({ length: Math.max(CAPACIDAD, pafActivos.length) }, (_, i) => <span key={i} className={`h-1.5 w-10 rounded-full ${i < pafActivos.length ? (i >= CAPACIDAD ? 'bg-rose-500' : 'bg-[var(--text-primary)]') : 'bg-[var(--border-subtle)]'}`} />)}
            <span className="ml-2 text-xs text-[var(--text-tertiary)]">{pafActivos.length} de {CAPACIDAD} lugares PAF</span>
          </div>
        )}
      </section>

      {hoy.length > 0 && vista === 'lista' && (
        <section aria-label="Para hoy">
          <p className="mb-2 text-xs text-[var(--text-tertiary)]">Para hoy</p>
          <ul className="divide-y divide-[var(--border-divider)] border-y border-[var(--border-divider)]">
            {hoy.slice(0, 6).map((it, i) => (
              <li key={`${it.tipo}-${it.projectId || ''}-${i}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <p className="flex-1 min-w-[16rem] text-base text-[var(--text-primary)]">{it.texto}{it.nota && <span className="text-orange-500"> · {it.nota}</span>}</p>
                <button type="button" onClick={() => onNavigate(it.projectId ? `/clientes/${it.projectId}` : '/clientes')}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${i === 0 ? 'bg-orange-500 text-zinc-950 font-medium' : 'border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'}`}>
                  {it.tipo === 'revisar' ? 'Revisarla' : it.tipo === 'reunion' ? 'Prepararla' : it.tipo === 'acuerdos' ? 'Anotar' : it.tipo === 'plan' ? 'Empezar' : it.tipo === 'accesos' ? 'Recordárselo' : 'Abrir'}
                </button>
              </li>
            ))}
          </ul>
          {hoy.length > 6 && <p className="mt-2 text-xs text-[var(--text-tertiary)]">Y {hoy.length - 6} más en Tu semana.</p>}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5" role="tablist" aria-label="Vista">
          {([['lista', 'Lista'], ['tablero', 'Tablero'], ['semana', 'Tu semana']] as [Vista, string][]).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={vista === id} onClick={() => setVista(id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${vista === id ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>{label}</button>
          ))}
        </div>
        {vista === 'lista' && (
          <label className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-tertiary)] w-full sm:w-56">
            <Search className="w-3.5 h-3.5" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar cliente" className="w-full bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]" />
          </label>
        )}
      </div>

      {vista === 'tablero' && <ClientsBoard projects={projects} meetings={meetings} onNavigate={onNavigate} />}
      {vista === 'semana' && <TuSemana projects={projects} meetings={meetings} onNavigate={onNavigate} />}
      {vista === 'lista' && <>
        <nav className="-mt-4 flex max-w-full gap-4 overflow-x-auto no-scrollbar text-sm" aria-label="Filtro">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
              className={`shrink-0 whitespace-nowrap py-1 transition ${filter === f.id ? 'text-[var(--text-primary)] underline underline-offset-[6px] decoration-2 decoration-orange-500' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
              {f.label}
            </button>
          ))}
        </nav>

        {rows.length ? (
          <ul className="divide-y divide-[var(--border-divider)] border-y border-[var(--border-divider)]">
            {rows.map((r) => (
              <li key={r.project.id}>
                <button type="button" onClick={() => onNavigate(`/clientes/${r.project.id}`)} className="group flex w-full flex-wrap items-center gap-x-5 gap-y-3 py-5 text-left">
                  <span className="flex w-12 h-12 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white" style={{ background: r.project.archived ? '#71717a' : colorDe(r.project), color: '#fff' }} aria-hidden>{iniciales(r.project.clientName)}</span>
                  <span className="min-w-[14rem] flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xl font-normal tracking-tight text-[var(--text-primary)]">{r.project.clientName}</span>
                      {!r.project.archived && <span className={`w-2 h-2 shrink-0 rounded-full ${r.cobro?.vencido ? SALUD_DOT.riesgo : SALUD_DOT[r.salud.nivel]}`} title={r.salud.motivos.map((m) => m.texto).join(' · ') || 'Todo en orden'} />}
                      <span className="text-xs text-[var(--text-tertiary)]">{r.tipo}</span>
                    </span>
                    <span className={`mt-0.5 block text-sm ${r.salud.nivel === 'riesgo' ? 'text-rose-500' : 'text-[var(--text-secondary)]'}`}>{r.frase}</span>
                  </span>
                  <span className="flex w-full sm:w-56 shrink-0 flex-col gap-1.5 text-xs text-[var(--text-tertiary)]">
                    {r.avance && <>
                      <span>{r.avance.label}</span>
                      <span className="flex gap-1" aria-hidden>{Array.from({ length: r.avance.total }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i + 1 < r.avance!.hecho ? 'bg-[var(--text-primary)]' : i + 1 === r.avance!.hecho ? 'bg-orange-500' : 'bg-[var(--border-subtle)]'}`} />)}</span>
                    </>}
                    <span>
                      {r.reunion ? `Reunión ${fmt(r.reunion.fecha)}${r.reunion.hora ? ` ${r.reunion.hora}` : ''}` : r.visita || 'Sin reunión'}
                      {r.cobro && <> · {r.cobro.vencido ? <span className="text-rose-500">cobro vencido</span> : `cobro ${fmt(r.cobro.fecha)}`}</>}
                    </span>
                  </span>
                  <ChevronRight className="hidden sm:block w-4 h-4 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
            {q ? 'No hay clientes con ese nombre.' : filter === 'archivados' ? 'No hay clientes archivados.' : filter === 'atencion' ? 'Todos tus clientes están en orden.' : filter === 'mi_accion' ? 'Nada espera una acción tuya.' : filter === 'esperando' ? 'No estás esperando a ningún cliente.' : filter === 'bloqueado' ? 'Ningún cliente trabado.' : 'Todavía no hay clientes acá.'}
          </p>
        )}

        <p className="text-sm text-[var(--text-tertiary)]">
          {posibles > 0 && <>También tenés <button type="button" onClick={() => onNavigate('/clientes?vista=completa')} className="underline underline-offset-4 hover:text-[var(--text-primary)]">{posibles === 1 ? '1 posible cliente' : `${posibles} posibles clientes`}</button>{archivados ? ' y ' : '. '}</>}
          {archivados > 0 && <><button type="button" onClick={() => setFilter('archivados')} className="underline underline-offset-4 hover:text-[var(--text-primary)]">{archivados} archivados</button>. </>}
          <button type="button" onClick={() => onNavigate('/clientes?vista=completa')} className="underline underline-offset-4 hover:text-[var(--text-primary)]">Vista completa (cobros, presupuestos, roadmap)</button>
          {onCrearEjemplo && <> · <button type="button" onClick={onCrearEjemplo} disabled={creandoEjemplo} className="underline underline-offset-4 hover:text-[var(--text-primary)] disabled:opacity-50">{creandoEjemplo ? 'Armando el ejemplo…' : projects.some((p) => p.ejemplo) ? 'Abrir el cliente de ejemplo' : 'Ver un cliente de ejemplo'}</button></>}
        </p>
      </>}
    </div>
  );
};
