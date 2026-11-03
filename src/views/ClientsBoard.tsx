import React from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, FileText, ListChecks, NotebookPen, Package } from 'lucide-react';
import { AgendaMeeting, Project, getServiceType } from '../types';
import { hitosDe, nextMeeting } from '../portal/model';
import { ETAPAS, type Etapa } from '../portal/presencia';
import { RESPONSABLE_ACCION, estadoCliente } from '../components/ProximaAccionCard';

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const CAPACIDAD = 4; // estudios activos a la vez (lo que declara la oferta)
const DOT: Record<string, string> = { bloqueado: 'bg-rose-500', mi_accion: 'bg-amber-500', esperando: 'bg-sky-500', sin_accion: 'bg-zinc-400' };

const esPaf = (p: Project) => getServiceType(p.projectType) === 'paf' || p.serviceType === 'paf';
const esWeb = (p: Project) => getServiceType(p.projectType) === 'web' || p.serviceType === 'web';

/** Días desde el último movimiento (historial, una reunión hecha o la última edición) */
function diasSinMovimiento(p: Project, meetings: AgendaMeeting[], today: string): number {
  const fechas = [p.pafHistorial?.[0]?.fecha?.slice(0, 10), p.updatedAt?.slice(0, 10), ...meetings.filter((m) => m.projectId === p.id && m.completed).map((m) => m.date)].filter(Boolean) as string[];
  const ultima = fechas.sort().slice(-1)[0];
  return ultima ? Math.max(0, Math.round((Date.parse(today) - Date.parse(ultima)) / 86400000)) : 0;
}

/**
 * TABLERO: una columna por etapa del método (y los clientes Web aparte), una tarjeta por cliente.
 * Arriba, tu capacidad de estudios activos.
 */
export const ClientsBoard: React.FC<{ projects: Project[]; meetings: AgendaMeeting[]; onNavigate: (path: string) => void }> = ({ projects, meetings, onNavigate }) => {
  const today = new Date().toLocaleDateString('en-CA');
  const activos = projects.filter((p) => !p.archived && !p.isLead);
  const pafActivos = activos.filter((p) => esPaf(p) && !p.ejemplo);
  const columnas: { id: Etapa | 'web'; label: string; items: Project[] }[] = [
    ...ETAPAS.map((e) => ({ id: e.id as Etapa | 'web', label: e.label, items: activos.filter((p) => esPaf(p) && (p.pafEtapa || 'presencia') === e.id) })),
    { id: 'web', label: 'Web', items: activos.filter(esWeb) },
  ];
  const lleno = pafActivos.length >= CAPACIDAD;
  return (
    <div className="space-y-4">
      <div className="card-swiss p-4 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">{pafActivos.length} de {CAPACIDAD} estudios activos</p>
          <p className={`text-xs ${pafActivos.length > CAPACIDAD ? 'text-rose-500' : lleno ? 'text-amber-600' : 'text-[var(--text-tertiary)]'}`}>
            {pafActivos.length > CAPACIDAD ? 'Estás por encima de tu capacidad' : lleno ? 'Capacidad completa' : `Te quedan ${CAPACIDAD - pafActivos.length} lugares`}
          </p>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(CAPACIDAD, pafActivos.length)}, minmax(0, 1fr))` }} aria-hidden>
          {Array.from({ length: Math.max(CAPACIDAD, pafActivos.length) }, (_, i) => <span key={i} className={`h-2 rounded-full ${i < pafActivos.length ? (i >= CAPACIDAD ? 'bg-rose-500' : 'bg-[var(--solid-contrast-bg)]') : 'bg-[var(--border-subtle)]'}`} />)}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {columnas.map((c) => (
          <section key={c.id} className="rounded-[var(--radius-card)] bg-[var(--bg-surface-muted)] p-2.5 space-y-2 min-w-0">
            <h2 className="flex items-center justify-between px-1 text-xs font-semibold text-[var(--text-secondary)]">{c.label}<span className="text-[var(--text-tertiary)]">{c.items.length}</span></h2>
            {c.items.length ? c.items.map((p) => {
              const estado = estadoCliente(p, today);
              const hito = p.pafPortal?.hito || 1;
              const titulos = hitosDe(c.id === 'web' ? 'web' : 'presencia', c.id === 'web' ? 'presencia' : (c.id as Etapa));
              const reunion = nextMeeting(meetings, p.id, today);
              const dias = diasSinMovimiento(p, meetings, today);
              const hechas = meetings.filter((m) => m.projectId === p.id && m.completed && !m.proposed).length;
              const acordadas = p.pafPortal?.reunionesAcordadas;
              return (
                <button key={p.id} type="button" onClick={() => onNavigate(`/clientes/${p.id}`)} className="card-swiss block w-full p-3 text-left transition hover:-translate-y-0.5">
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 shrink-0 rounded-full ${DOT[estado]}`} aria-hidden />
                    <span className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--text-primary)]">{p.clientName}</span>
                  </span>
                  <span className="mt-1 block text-xs text-[var(--text-secondary)]">Hito {hito} · {titulos[hito - 1] || ''}</span>
                  {p.proximaAccion
                    ? <span className="mt-2 block text-xs text-[var(--text-primary)]">→ {p.proximaAccion.texto}<span className="text-[var(--text-tertiary)]"> · {RESPONSABLE_ACCION[p.proximaAccion.responsable]}{p.proximaAccion.fecha ? ` · ${fmt(p.proximaAccion.fecha)}` : ''}</span></span>
                    : <span className="mt-2 block text-xs text-amber-600">Sin próxima acción</span>}
                  {estado === 'esperando' && p.proximaAccion?.necesita && <span className="mt-1 block text-[11px] text-sky-600">Espera: {p.proximaAccion.necesita}</span>}
                  <span className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-tertiary)]">
                    <span>{reunion ? `Reunión ${fmt(reunion.fecha)}` : 'Sin reunión'}</span>
                    {acordadas ? <span>{hechas}/{acordadas} reuniones</span> : null}
                    {dias >= 7 && <span className="text-amber-600">{dias} días sin movimiento</span>}
                  </span>
                </button>
              );
            }) : <p className="px-1 py-3 text-xs text-[var(--text-tertiary)]">Nadie en esta etapa.</p>}
          </section>
        ))}
      </div>
    </div>
  );
};

/** Un pendiente de la semana */
interface Pendiente { key: string; projectId: string; cliente: string; texto: string; detalle?: string; urgente?: boolean }

/**
 * TU SEMANA: todo lo que vence esta semana en todos los clientes, agrupado por tipo.
 * Es la rutina del lunes en una sola lista.
 */
export const TuSemana: React.FC<{ projects: Project[]; meetings: AgendaMeeting[]; onNavigate: (path: string) => void }> = ({ projects, meetings, onNavigate }) => {
  const today = new Date().toLocaleDateString('en-CA');
  const d = new Date(`${today}T12:00:00`);
  const lunes = new Date(d); lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  const ini = lunes.toLocaleDateString('en-CA');
  const fin = domingo.toLocaleDateString('en-CA');
  const hace14 = new Date(d); hace14.setDate(d.getDate() - 14);
  const activos = projects.filter((p) => !p.archived && !p.isLead);
  const byId = new Map(activos.map((p) => [p.id, p]));
  const nombre = (id?: string) => (id && byId.get(id)?.clientName) || '';

  const grupos: { titulo: string; icon: React.ElementType; items: Pendiente[] }[] = [
    {
      titulo: 'Para revisar', icon: CheckCircle2,
      items: activos.flatMap((p) => (p.pafTareas || []).filter((t) => t.estado === 'enviada').map((t) => ({ key: `r${p.id}${t.id}`, projectId: p.id, cliente: p.clientName, texto: t.titulo, detalle: 'Avisó que la terminó', urgente: true }))),
    },
    {
      titulo: 'Tus próximas acciones de la semana', icon: ClipboardList,
      items: activos.filter((p) => p.proximaAccion?.responsable === 'yo' && p.proximaAccion.fecha && p.proximaAccion.fecha <= fin).map((p) => ({ key: `a${p.id}`, projectId: p.id, cliente: p.clientName, texto: p.proximaAccion!.texto, detalle: p.proximaAccion!.fecha! < today ? `Venció el ${fmt(p.proximaAccion!.fecha!)}` : `Para el ${fmt(p.proximaAccion!.fecha!)}`, urgente: p.proximaAccion!.fecha! < today })),
    },
    {
      titulo: 'Reuniones de esta semana', icon: CalendarDays,
      items: meetings.filter((m) => m.projectId && byId.has(m.projectId) && !m.completed && !m.proposed && m.date >= today && m.date <= fin).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).map((m) => {
        const prep = Object.values(m.prep || {}).filter((v) => v?.trim()).length;
        return { key: `m${m.id}`, projectId: m.projectId!, cliente: nombre(m.projectId), texto: `${fmt(m.date)}${m.time ? ` ${m.time}` : ''} · ${m.title.split(' · ')[0]}`, detalle: prep >= 3 ? 'Preparada' : 'Sin preparar', urgente: prep < 3 };
      }),
    },
    {
      titulo: 'Acuerdos sin anotar', icon: NotebookPen,
      items: meetings.filter((m) => m.projectId && byId.has(m.projectId) && !m.proposed && m.date < today && m.date >= hace14.toLocaleDateString('en-CA'))
        .filter((m) => !(byId.get(m.projectId!)!.pafResumenes || []).some((r) => r.fecha >= m.date))
        .map((m) => ({ key: `s${m.id}`, projectId: m.projectId!, cliente: nombre(m.projectId), texto: `Reunión del ${fmt(m.date)}`, detalle: 'Anotá lo que acordaron y mandá el Hoy acordamos' })),
    },
    {
      titulo: 'Tareas del cliente vencidas', icon: ListChecks,
      items: activos.flatMap((p) => (p.pafTareas || []).filter((t) => t.estado === 'habilitada' && (t.responsable || 'estudio') === 'estudio' && t.fecha && t.fecha < today).map((t) => ({ key: `v${p.id}${t.id}`, projectId: p.id, cliente: p.clientName, texto: t.titulo, detalle: `Venció el ${fmt(t.fecha!)}` }))),
    },
    {
      titulo: 'Entregas esperando su decisión', icon: Package,
      items: activos.flatMap((p) => (p.pafEntregas || []).filter((e) => e.publicada && (e.estado || 'en_revision') === 'en_revision' && (!e.hasta || e.hasta <= fin)).map((e) => ({ key: `e${p.id}${e.id}`, projectId: p.id, cliente: p.clientName, texto: `${e.titulo}${e.version ? ` ${e.version}` : ''}`, detalle: e.hasta ? (e.hasta < today ? `Vencía el ${fmt(e.hasta)}` : `Hasta el ${fmt(e.hasta)}`) : 'Sin plazo', urgente: !!e.hasta && e.hasta < today }))),
    },
    {
      titulo: 'Reporte del viernes', icon: FileText,
      items: activos.filter((p) => esPaf(p) && !p.ejemplo && !(p.pafReportes || []).some((r) => r.hasta >= ini)).map((p) => ({ key: `p${p.id}`, projectId: p.id, cliente: p.clientName, texto: 'Falta el reporte de esta semana', detalle: 'Inicio → Reporte del viernes → Armar reporte' })),
    },
  ];
  const total = grupos.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">Semana del {fmt(ini)} al {fmt(fin)} · {total ? `${total} pendientes` : 'nada pendiente'}</p>
      {grupos.filter((g) => g.items.length).map((g) => {
        const Icon = g.icon;
        return (
          <section key={g.titulo} className="card-swiss">
            <h2 className="flex items-center gap-2 border-b border-[var(--border-divider)] px-4 py-3 text-sm font-medium text-[var(--text-primary)]"><Icon className="w-4 h-4 text-[var(--text-tertiary)]" />{g.titulo}<span className="ml-auto text-xs text-[var(--text-tertiary)]">{g.items.length}</span></h2>
            <ul className="divide-y divide-[var(--border-divider)]">
              {g.items.map((x) => (
                <li key={x.key}>
                  <button type="button" onClick={() => onNavigate(`/clientes/${x.projectId}`)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--bg-surface-muted)]">
                    {x.urgente ? <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0 text-amber-500" /> : <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-[var(--text-tertiary)]" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-[var(--text-primary)]">{x.texto}</span>
                      <span className="block text-xs text-[var(--text-tertiary)]">{x.cliente}{x.detalle ? ` · ${x.detalle}` : ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {!total && <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">Semana al día. Nada vence.</p>}
    </div>
  );
};
