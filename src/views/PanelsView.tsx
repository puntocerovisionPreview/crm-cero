import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  GraduationCap,
  Check,
  Clapperboard,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Images,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Project } from '../types';
import {
  ClientPanel,
  PANEL_STATE_LABEL_OWNER,
  PanelPiece,
  PanelPieceState,
  PanelSupport,
  newItemId,
  panelSummary,
  startNewWeek,
} from '../panels/model';
import { createPanel, deletePanel, ensurePafPanel, panelLink, renewPanelLink, savePanel, slideRefs, subscribePanels, uploadPanelSlides } from '../panels/store';
import { isActivePafStudent, pafWithoutPanel } from '../panels/paf';
import { WEB_STAGES, emptyWeb, stageIndex } from '../panels/web';
import { PanelWebEditor } from '../components/PanelWebEditor';
import { PafPlanEditor } from '../components/PafPlanEditor';
import { getServiceType } from '../types';
import { deletePublicAssets } from '../content/assets';
import { ImageDrop } from '../components/ImageDrop';
import { AssetImg } from '../content/AssetImg';
import { shortDay } from '../content/model';
import { formatWhatsAppUrl } from '../utils/contact';
import { startOfWeekMonday, todayLocal } from '../utils/dates';

/**
 * PANELES DE CLIENTES (tu lado)
 * Lista de paneles y, adentro de cada uno: link para el cliente, objetivos de la semana,
 * tareas que le dejás y contenido para que apruebe (subís las imágenes y listo).
 */

const btn = 'px-3 py-2 rounded-[var(--radius-control)] text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-strong)]`;
const btnGhost = `${btn} border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]`;
const card = 'rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]';
const input =
  'w-full px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-base sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]';

const STATE_TONE: Record<PanelPieceState, string> = {
  para_aprobar: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  aprobada: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  cambios: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  publicada: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
};

const SUPPORTS: { id: PanelSupport; label: string; icon: React.ReactNode }[] = [
  { id: 'carrusel', label: 'Carrusel', icon: <Images className="w-4 h-4" /> },
  { id: 'reel', label: 'Reel', icon: <Clapperboard className="w-4 h-4" /> },
  { id: 'estatico', label: 'Estático', icon: <ImageIcon className="w-4 h-4" /> },
];

const dm = (d?: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

type UpdateProject = (id: string, updates: Partial<Project>) => void;

export const PanelsView: React.FC<{ projects: Project[]; onUpdateProject: UpdateProject }> = ({ projects, onUpdateProject }) => {
  const [panels, setPanels] = useState<ClientPanel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('panel');
    } catch {
      return null;
    }
  });
  const [creating, setCreating] = useState(false);
  const [creatingPaf, setCreatingPaf] = useState<string | null>(null);
  const setToken = (projectId: string) => (token: string) => onUpdateProject(projectId, { studentPortalToken: token });
  const createForPaf = async (p: Project) => {
    setCreatingPaf(p.id);
    try {
      const panel = await ensurePafPanel(p, undefined, setToken(p.id));
      setOpenId(panel.id);
    } catch {
      setError('No pudimos crear el panel. Revisá la conexión y volvé a intentarlo.');
    } finally {
      setCreatingPaf(null);
    }
  };

  useEffect(() => subscribePanels(setPanels, (e) => setError(e.message)), []);

  const open = panels?.find((p) => p.id === openId) || null;
  if (panels === null && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando paneles…
      </div>
    );
  }
  if (open) return <PanelEditor panel={open} projects={projects} onBack={() => setOpenId(null)} />;
  const pafPending = pafWithoutPanel(projects, panels || []);

  const list = [...(panels || [])].sort((a, b) => (b.lastClientAction?.at || b.updatedAt || '').localeCompare(a.lastClientAction?.at || a.updatedAt || ''));
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-24">
      {error && <p className="text-[13px] text-rose-300">No se pudieron leer los paneles: {error}</p>}
      <section className={`${card} p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
        <p className="flex-1 text-sm text-[var(--text-secondary)]">
          Cada cliente tiene un <b className="text-[var(--text-primary)]">link privado</b> con sus objetivos de la semana, las tareas que le dejás y el contenido para aprobar. No necesita usuario ni contraseña.
        </p>
        <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> Nuevo panel
        </button>
      </section>

      {creating && (
        <NewPanelForm
          projects={projects}
          taken={new Set((panels || []).map((p) => p.projectId).filter(Boolean) as string[])}
          onClose={() => setCreating(false)}
          onCreated={(id) => (setCreating(false), setOpenId(id))}
          setToken={setToken}
        />
      )}

      {pafPending.length > 0 && (
        <section className={`${card} p-4 space-y-2`}>
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-[var(--text-primary)]">
            <GraduationCap className="w-4 h-4 text-amber-400" /> Alumnos PAF activos sin panel
          </h2>
          <p className="text-[12px] text-[var(--text-secondary)]">Su panel usa el mismo link de su portal: ve su avance, sus objetivos, sus tareas y el contenido, todo junto.</p>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {pafPending.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 min-w-0 text-sm text-[var(--text-primary)] truncate">{p.clientName}</span>
                <button type="button" className={`${btnGhost} py-1.5 text-xs`} disabled={creatingPaf === p.id} onClick={() => createForPaf(p)}>
                  {creatingPaf === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Crear panel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.length === 0 && !creating && <p className="text-sm text-[var(--text-secondary)] px-1">Todavía no tenés paneles. Creá el primero con "Nuevo panel".</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {list.map((p) => {
          const s = panelSummary(p);
          return (
            <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className={`${card} p-4 text-left space-y-2 hover:border-[var(--border-strong)] transition`}>
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-[16px] font-bold text-[var(--text-primary)] truncate">{p.clientName}</span>
                {p.portal && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">PAF</span>}
                {!p.active && <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-300">Link apagado</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 text-[12px]">
                <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                  Objetivos {s.goalsDone}/{s.goals}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                  {s.tasksOpen} {s.tasksOpen === 1 ? 'tarea pendiente' : 'tareas pendientes'}
                </span>
                {s.toApprove > 0 && <span className={`px-2 py-0.5 rounded-full border ${STATE_TONE.para_aprobar}`}>{s.toApprove} para aprobar</span>}
                {p.web && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">Web: {WEB_STAGES[stageIndex(p.web.stage)].label}</span>
                )}
                {s.webPending > 0 && <span className={`px-2 py-0.5 rounded-full border ${STATE_TONE.cambios}`}>{s.webPending} cambios web</span>}
                {s.changes > 0 && <span className={`px-2 py-0.5 rounded-full border ${STATE_TONE.cambios}`}>{s.changes} con cambios</span>}
              </div>
              {p.lastClientAction && (
                <p className="text-[12px] text-[var(--text-tertiary)] truncate">
                  Último: {p.lastClientAction.text} · {dm(p.lastClientAction.at.slice(0, 10))}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------- Crear ----------------

const NewPanelForm: React.FC<{
  projects: Project[];
  taken: Set<string>;
  onClose: () => void;
  onCreated: (id: string) => void;
  setToken: (projectId: string) => (token: string) => void;
}> = ({ projects, taken, onClose, onCreated, setToken }) => {
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(
    () => projects.filter((p) => p.clientName && !taken.has(p.id)).sort((a, b) => a.clientName.localeCompare(b.clientName)),
    [projects, taken]
  );
  const project = projects.find((p) => p.id === projectId);
  const finalName = (project?.clientName || name).trim();

  const create = async () => {
    if (!finalName) return;
    setBusy(true);
    try {
      // Alumno PAF activo: mismo link que su portal
      const p =
        project && isActivePafStudent(project)
          ? await ensurePafPanel(project, undefined, setToken(project.id))
          : await createPanel(
              finalName,
              project
                ? {
                    projectId: project.id,
                    phone: project.clientPhone,
                    // Cliente de desarrollo web: el panel arranca con su parte web
                    ...(getServiceType(project.projectType) === 'web' ? { web: emptyWeb() } : {}),
                  }
                : {}
            );
      onCreated(p.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Nuevo panel</h2>
        <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]" aria-label="Cerrar">
          <X className="w-4 h-4" />
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Cliente</span>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={input}>
          <option value="">Escribir el nombre…</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.clientName}
            </option>
          ))}
        </select>
      </label>
      {!projectId && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente o del estudio" className={input} autoFocus />}
      <div className="flex justify-end">
        <button type="button" className={btnPrimary} disabled={busy || !finalName} onClick={create}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Crear panel
        </button>
      </div>
    </section>
  );
};

// ---------------- Editar un panel ----------------

const PanelEditor: React.FC<{ panel: ClientPanel; projects: Project[]; onBack: () => void }> = ({ panel, projects, onBack }) => {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const save = async (next: ClientPanel) => {
    setSaving(true);
    try {
      await savePanel(next);
    } finally {
      setSaving(false);
    }
  };
  const link = panelLink(panel);
  const phone = panel.phone || projects.find((p) => p.id === panel.projectId)?.clientPhone;
  const thisWeek = startOfWeekMonday(todayLocal());

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className={btnGhost}>
          <ArrowLeft className="w-4 h-4" /> Paneles
        </button>
      <h1 className="flex-1 min-w-0 text-[20px] font-bold text-[var(--text-primary)] truncate">{panel.clientName}</h1>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-[var(--text-secondary)]" aria-label="Guardando" />}
      </div>

      {/* Link */}
      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[15px] font-bold text-[var(--text-primary)]">{panel.portal ? 'Link del alumno (su portal PAF)' : 'Link del cliente'}</h2>
          <label className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={panel.active} onChange={(e) => save({ ...panel, active: e.target.checked })} className="w-4 h-4 accent-[var(--accent)]" />
            {panel.active ? 'Activo' : 'Apagado'}
          </label>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)]">
          <span className="flex-1 min-w-0 truncate text-[13px] text-[var(--text-secondary)]">{link}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              } catch {
                /* sin portapapeles */
              }
            }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar link'}
          </button>
          {phone && (
            <a
              className={btnGhost}
              href={formatWhatsAppUrl(
                phone,
                panel.portal
                  ? `Hola! En tu portal ahora también vas a ver los objetivos de la semana, lo que te toca hacer y el contenido para aprobar. Es el mismo link de siempre:\n${link}`
                  : `Hola! Te dejo tu panel: ahí vas a ver los objetivos de la semana, lo que te toca hacer y el contenido para aprobar.\n${link}`
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="w-4 h-4 text-[#25D366]" /> Mandar por WhatsApp
            </a>
          )}
          <a className={btnGhost} href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" /> Ver como el cliente
          </a>
        </div>
        <label className="block space-y-1">
          <span className="text-[12px] text-[var(--text-tertiary)]">Mensaje arriba del panel (opcional)</span>
          <textarea
            defaultValue={panel.note || ''}
            rows={2}
            placeholder="Ej: Esta semana arrancamos con las fotos de la obra."
            onBlur={(e) => e.target.value.trim() !== (panel.note || '') && save({ ...panel, note: e.target.value.trim() })}
            className={`${input} resize-none`}
          />
        </label>
      </section>

      {panel.web ? (
        <PanelWebEditor panel={panel} save={save} />
      ) : (
        <button type="button" className={`${btnGhost} w-full`} onClick={() => save({ ...panel, web: emptyWeb() })}>
          <Plus className="w-4 h-4" /> Agregar seguimiento de desarrollo web
        </button>
      )}

      {(panel.portal || panel.paf) && <PafPlanEditor key={panel.id} panel={panel} project={projects.find((p) => p.id === panel.projectId)} save={save} />}
      <GoalsSection panel={panel} save={save} thisWeek={thisWeek} />
      <TasksSection panel={panel} save={save} />
      <ContentSection panel={panel} save={save} />

      <section className="flex flex-wrap gap-2 justify-end pt-2">
        {/* El link de un alumno PAF se maneja desde su ficha (es el de su portal) */}
        {!panel.portal && (
          <button
            type="button"
            className={`${btnGhost} text-xs`}
            onClick={async () => window.confirm('¿Generar un link nuevo? El que tiene el cliente deja de funcionar.') && (await renewPanelLink(panel))}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Link nuevo
          </button>
        )}
        <button
          type="button"
          className={`${btnGhost} text-xs text-rose-300`}
          onClick={async () => {
            if (!window.confirm(`¿Eliminar el panel de ${panel.clientName}? Se borran sus objetivos, tareas y contenido del panel.`)) return;
            await deletePanel(panel);
            onBack();
          }}
        >
          <Trash2 className="w-3.5 h-3.5" /> Eliminar panel
        </button>
      </section>
    </div>
  );
};

type Save = (p: ClientPanel) => Promise<void>;

// ---------------- Objetivos ----------------

const GoalsSection: React.FC<{ panel: ClientPanel; save: Save; thisWeek: string }> = ({ panel, save, thisWeek }) => {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    save({ ...panel, goals: [...panel.goals, { id: newItemId(), text: text.trim(), done: false }] });
    setText('');
  };
  const done = panel.goals.filter((g) => g.done).length;
  return (
    <section className={`${card} p-4 space-y-3`}>
      <div className="flex items-baseline gap-2">
        <h2 className="flex-1 text-[15px] font-bold text-[var(--text-primary)]">Objetivos de la semana</h2>
        <span className="text-[12px] text-[var(--text-tertiary)]">
          Semana del {dm(panel.weekStart)} · {done}/{panel.goals.length}
        </span>
      </div>
      {panel.weekStart < thisWeek && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[13px] text-amber-200">
          <span className="flex-1">Empezó una semana nueva.</span>
          <button type="button" className="font-semibold underline" onClick={() => save(startNewWeek(panel, thisWeek))}>
            Pasar a esta semana
          </button>
        </div>
      )}
      <ul className="space-y-1.5">
        {panel.goals.map((g) => (
          <li key={g.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={g.done}
              onChange={(e) => save({ ...panel, goals: panel.goals.map((x) => (x.id === g.id ? { ...x, done: e.target.checked } : x)) })}
              className="w-4 h-4 accent-[var(--accent)] shrink-0"
              aria-label={`Cumplido: ${g.text}`}
            />
            <span className={`flex-1 text-sm ${g.done ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>{g.text}</span>
            <button type="button" onClick={() => save({ ...panel, goals: panel.goals.filter((x) => x.id !== g.id) })} className="p-1 text-[var(--text-tertiary)] hover:text-rose-300" aria-label="Quitar objetivo">
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Ej: Publicar 3 piezas" className={input} />
        <button type="button" className={btnGhost} onClick={add} disabled={!text.trim()}>
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
    </section>
  );
};

// ---------------- Tareas ----------------

const TasksSection: React.FC<{ panel: ClientPanel; save: Save }> = ({ panel, save }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [detail, setDetail] = useState('');
  const add = () => {
    if (!title.trim()) return;
    save({ ...panel, tasks: [...panel.tasks, { id: newItemId(), title: title.trim(), date: date || undefined, detail: detail.trim() || undefined, done: false }] });
    setTitle('');
    setDate('');
    setDetail('');
  };
  const sorted = [...panel.tasks].sort((a, b) => (a.done === b.done ? (a.date || '9').localeCompare(b.date || '9') : a.done ? 1 : -1));
  return (
    <section className={`${card} p-4 space-y-3`}>
      <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Tareas para el cliente</h2>
      <ul className="space-y-2">
        {sorted.map((t) => (
          <li key={t.id} className="flex items-start gap-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] px-3 py-2">
            <input
              type="checkbox"
              checked={t.done}
              onChange={(e) => save({ ...panel, tasks: panel.tasks.map((x) => (x.id === t.id ? { ...x, done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : undefined } : x)) })}
              className="mt-0.5 w-4 h-4 accent-[var(--accent)] shrink-0"
              aria-label={`Hecha: ${t.title}`}
            />
            <span className="flex-1 min-w-0">
              <span className={`block text-sm ${t.done ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>{t.title}</span>
              {(t.date || t.detail) && (
                <span className="block text-[12px] text-[var(--text-secondary)]">
                  {t.date ? `Para el ${dm(t.date)}` : ''}
                  {t.date && t.detail ? ' · ' : ''}
                  {t.detail}
                </span>
              )}
              {t.done && <span className="block text-[12px] text-emerald-300">Hecha{t.doneAt ? ` el ${dm(t.doneAt.slice(0, 10))}` : ''}</span>}
              {t.clientNote && <span className="block text-[12px] text-sky-300">Nota del cliente: {t.clientNote}</span>}
            </span>
            <button type="button" onClick={() => save({ ...panel, tasks: panel.tasks.filter((x) => x.id !== t.id) })} className="p-1 text-[var(--text-tertiary)] hover:text-rose-300" aria-label="Quitar tarea">
              <X className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Qué tiene que hacer (ej: Mandarme las fotos de la obra)" className={input} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} sm:w-44`} aria-label="Para cuándo (opcional)" />
      </div>
      <div className="flex gap-2">
        <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Detalle (opcional)" className={input} />
        <button type="button" className={btnGhost} onClick={add} disabled={!title.trim()}>
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
    </section>
  );
};

// ---------------- Contenido ----------------

const ContentSection: React.FC<{ panel: ClientPanel; save: Save }> = ({ panel, save }) => {
  const [adding, setAdding] = useState(false);
  const pieces = [...panel.pieces].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className={`${card} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-bold text-[var(--text-primary)]">Contenido para aprobar</h2>
        {!adding && (
          <button type="button" className={btnPrimary} onClick={() => setAdding(true)}>
            <Upload className="w-4 h-4" /> Subir pieza
          </button>
        )}
      </div>
      {adding && <PieceForm onCancel={() => setAdding(false)} onSave={async (p) => (await save({ ...panel, pieces: [...panel.pieces, p] }), setAdding(false))} />}
      {pieces.length === 0 && !adding && <p className="text-[13px] text-[var(--text-secondary)]">Todavía no subiste contenido. Tocá "Subir pieza", elegí las imágenes y listo.</p>}
      <div className="space-y-3">
        {pieces.map((x) => (
          <PieceRow
            key={x.id}
            piece={x}
            onChange={async (next) => {
              await save({ ...panel, pieces: panel.pieces.map((y) => (y.id === x.id ? next : y)) });
              // Si cambiaron las imágenes, las viejas se borran
              const keep = new Set(slideRefs(next.slides));
              await deletePublicAssets(slideRefs(x.slides).filter((r) => !keep.has(r)));
            }}
            onDelete={async () => {
              await save({ ...panel, pieces: panel.pieces.filter((y) => y.id !== x.id) });
              await deletePublicAssets(slideRefs(x.slides));
            }}
          />
        ))}
      </div>
    </section>
  );
};

const PieceForm: React.FC<{ onCancel: () => void; onSave: (p: PanelPiece) => Promise<void> }> = ({ onCancel, onSave }) => {
  const [date, setDate] = useState(todayLocal());
  const [support, setSupport] = useState<PanelSupport>('carrusel');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) return setErr('Poné un título.');
    if (!files.length && support !== 'reel') return setErr('Agregá al menos una imagen.');
    setErr(null);
    try {
      const slides = await uploadPanelSlides(files, (d, t) => setProgress(t ? `Subiendo imagen ${Math.min(d + 1, t)} de ${t}…` : 'Guardando…'));
      setProgress('Guardando…');
      await onSave({ id: newItemId(), date, support, title: title.trim(), caption: caption.trim() || undefined, slides, state: 'para_aprobar' });
    } catch (e) {
      setErr((e as Error).message);
      setProgress(null);
    }
  };
  const busy = !!progress && !err;

  return (
    <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        {SUPPORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            onClick={() => setSupport(s.id)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 border transition ${
              support === s.id ? 'bg-[var(--accent)] text-[var(--on-accent)] border-transparent' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ej: 5 errores al elegir aberturas)" className={input} disabled={busy} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} sm:w-44`} aria-label="Fecha de publicación" disabled={busy} />
      </div>
      <ImageDrop
        files={files}
        onChange={setFiles}
        disabled={busy}
        label={support === 'reel' ? 'Portada del reel (opcional): arrastrala o tocá para elegir' : support === 'estatico' ? 'Arrastrá la imagen o tocá para elegirla' : 'Arrastrá las slides o tocá para elegirlas'}
      />
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} placeholder="Descripción / caption (opcional)" className={`${input} resize-y`} disabled={busy} />
      {err && <p className="text-[13px] text-rose-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className={btnPrimary} onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {busy ? progress : 'Subir al panel'}
        </button>
      </div>
    </div>
  );
};

const PieceRow: React.FC<{ piece: PanelPiece; onChange: (p: PanelPiece) => Promise<void>; onDelete: () => Promise<void> }> = ({ piece, onChange, onDelete }) => {
  const [replacing, setReplacing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const replace = async () => {
    if (!files.length) return;
    try {
      const slides = await uploadPanelSlides(files, (d, t) => setBusy(`Subiendo ${Math.min(d + 1, t)} de ${t}…`));
      // Imágenes nuevas: vuelve a pedirle aprobación
      await onChange({ ...piece, slides, state: 'para_aprobar', clientComment: undefined, reviewedAt: undefined });
      setReplacing(false);
      setFiles([]);
    } finally {
      setBusy(null);
    }
  };
  return (
    <article className="rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-[var(--text-primary)]">{shortDay(piece.date)}</span>
        <span className="text-[12px] text-[var(--text-secondary)]">{SUPPORTS.find((s) => s.id === piece.support)?.label}</span>
        <span className={`ml-auto px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATE_TONE[piece.state]}`}>{PANEL_STATE_LABEL_OWNER[piece.state]}</span>
      </div>
      <p className="text-[15px] font-semibold text-[var(--text-primary)]">{piece.title}</p>
      {piece.clientComment && <p className="text-[13px] text-rose-200 bg-rose-500/10 rounded-lg px-2.5 py-1.5">"{piece.clientComment}"</p>}
      {piece.slides.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {piece.slides.map((s, i) => (
            <div key={i} className="shrink-0 w-14 aspect-[4/5] rounded-md overflow-hidden border border-[var(--border-subtle)]">
              <AssetImg src={s.thumb} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
      {piece.caption && <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 whitespace-pre-line">{piece.caption}</p>}
      {replacing && (
        <div className="space-y-2">
          <ImageDrop files={files} onChange={setFiles} disabled={!!busy} label="Arrastrá las imágenes nuevas (reemplazan a las de ahora)" />
          <div className="flex justify-end gap-2">
            <button type="button" className={`${btnGhost} text-xs`} onClick={() => (setReplacing(false), setFiles([]))} disabled={!!busy}>
              Cancelar
            </button>
            <button type="button" className={`${btnPrimary} text-xs`} onClick={replace} disabled={!!busy || !files.length}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {busy || 'Reemplazar y pedir aprobación'}
            </button>
          </div>
        </div>
      )}
      {!replacing && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${btnGhost} text-xs py-1.5`} onClick={() => setReplacing(true)}>
            <Images className="w-3.5 h-3.5" /> Cambiar imágenes
          </button>
          {piece.state !== 'publicada' && (
            <button type="button" className={`${btnGhost} text-xs py-1.5`} onClick={() => onChange({ ...piece, state: 'publicada' })}>
              <Check className="w-3.5 h-3.5" /> Marcar publicada
            </button>
          )}
          <button type="button" className={`${btnGhost} text-xs py-1.5 text-rose-300`} onClick={() => window.confirm(`¿Quitar "${piece.title}" del panel?`) && onDelete()}>
            <Trash2 className="w-3.5 h-3.5" /> Quitar
          </button>
        </div>
      )}
    </article>
  );
};
