import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Bell, 
  FolderKanban, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Plus, 
  Save, 
  Phone, 
  MessageCircle, 
  AlertCircle,
  Check,
  ListTodo,
  Target
} from 'lucide-react';
import { AgendaTask, AgendaMeeting, Project, DailyAllocationBucketId, TaskPriority, SecondBrainNote, WeeklyMission } from '../types';
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../utils/taskCategories';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { addDays, formatDayName, getTodayString } from '../utils/storage';
import { formatWhatsAppUrl, formatTelUrl } from '../utils/contact';
import { BacklinksPanel } from '../components/BacklinksPanel';
import { LocalGraphWidget } from '../components/LocalGraphWidget';
import { buildLinkCatalog, extractAllAppRelations } from '../lib/links';
import { resolveTaskProject } from '../utils/taskProject';

interface Props {
  itemId: string;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  missions?: WeeklyMission[];
  allNotes?: SecondBrainNote[];
  onBack: () => void;
  onNavigateToProject?: (projectId: string) => void;
  onNavigate?: (path: string) => void;
  onToggleTask: (id: string) => void;
  onToggleMeeting: (id: string) => void;
  onMoveTaskDate: (id: string, targetDate: string) => void;
  onMoveMeetingDate: (id: string, targetDate: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteMeeting: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<AgendaTask>) => void;
  onUpdateMeeting?: (id: string, updates: Partial<AgendaMeeting>) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
  privacyMode?: boolean;
}

export const TaskDetailView: React.FC<Props> = ({
  itemId,
  tasks,
  meetings,
  projects,
  missions = [],
  allNotes = [],
  onBack,
  onNavigateToProject,
  onNavigate,
  onToggleTask,
  onToggleMeeting,
  onMoveTaskDate,
  onMoveMeetingDate,
  onDeleteTask,
  onDeleteMeeting,
  onUpdateTask,
  onUpdateMeeting,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  privacyMode = false,
}) => {
  // Find whether it is a task or a meeting
  const task = tasks.find(t => t.id === itemId);
  const meeting = !task ? meetings.find(m => m.id === itemId) : null;

  if (!task && !meeting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-zinc-950 text-zinc-100">
        <AlertCircle className="w-10 h-10 text-zinc-600 mb-3" />
        <h2 className="text-base font-bold text-zinc-300">Elemento no encontrado</h2>
        <p className="text-xs text-zinc-500 mt-1 mb-4">
          La tarea o reunión que intentás abrir ya fue completada o eliminada.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-bold"
        >
          Volver a la Agenda
        </button>
      </div>
    );
  }

  const isTask = Boolean(task);
  const data = (task || meeting)!;
  const today = getTodayString();
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  const [title, setTitle] = useState(data.title);
  const [date, setDate] = useState(data.date);
  const [time, setTime] = useState(data.time || '');
  const [reminderMinutes, setReminderMinutes] = useState<number | undefined>(
    data.reminderMinutesBefore !== undefined ? data.reminderMinutesBefore : 15
  );
  const [projectName, setProjectName] = useState(data.projectName || '');
  const [selectedMissionId, setSelectedMissionId] = useState<string>(
    isTask ? ((data as AgendaTask).missionId || '') : ((data as AgendaMeeting).missionId || '')
  );
  const [taskCategory, setTaskCategory] = useState<DailyAllocationBucketId | 'general'>(
    isTask ? ((data as AgendaTask).category || 'general') : 'general'
  );
  const [taskPriority, setTaskPriority] = useState<TaskPriority>(
    isTask ? ((data as AgendaTask).priority || 'media') : 'media'
  );
  const [notes, setNotes] = useState((data as AgendaMeeting).notes || '');
  const [clientPhone, setClientPhone] = useState((data as AgendaMeeting).clientPhone || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isCompleted = data.completed;
  const subtasks = isTask ? (data as AgendaTask).subtasks || [] : [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;

  const handleSave = (customMissionId?: string) => {
    hapticFeedback.light();
    const missionIdToUse = customMissionId !== undefined ? customMissionId : selectedMissionId;

    if (isTask && onUpdateTask) {
      onUpdateTask(data.id, {
        title: title.trim(),
        date,
        time: time || undefined,
        category: taskCategory,
        priority: taskPriority,
        reminderMinutesBefore: reminderMinutes,
        projectName: projectName.trim() || undefined,
        missionId: missionIdToUse || undefined,
      });
    } else if (!isTask && onUpdateMeeting) {
      onUpdateMeeting(data.id, {
        title: title.trim(),
        date,
        time: time || undefined,
        reminderMinutesBefore: reminderMinutes,
        projectName: projectName.trim() || undefined,
        missionId: missionIdToUse || undefined,
        notes: notes.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
      });
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleToggle = () => {
    hapticFeedback.medium();
    if (isTask) {
      if (!isCompleted) playTaskDone();
      onToggleTask(data.id);
    } else {
      onToggleMeeting(data.id);
    }
  };

  const handlePostpone = (targetDate: string) => {
    hapticFeedback.selection();
    setDate(targetDate);
    if (isTask) {
      onMoveTaskDate(data.id, targetDate);
    } else {
      onMoveMeetingDate(data.id, targetDate);
    }
  };

  const handleDelete = () => {
    hapticFeedback.heavy();
    if (isTask) {
      onDeleteTask(data.id);
    } else {
      onDeleteMeeting(data.id);
    }
    onBack();
  };

  const handleAddSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !onAddSubtask) return;
    hapticFeedback.light();
    onAddSubtask(data.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  // Find linked project object using single source of truth
  const linkedProject = isTask ? resolveTaskProject(data as AgendaTask, projects) : projects.find(
    p => p.id === data.projectId || (p.clientName && p.clientName.toLowerCase() === (data.projectName || '').toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 text-zinc-100 overflow-y-auto animate-in slide-in-from-right-4 duration-150">
      {/* Header Bar */}
      <div 
        style={{ paddingTop: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.65rem))' }}
        className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              onBack();
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-semibold touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Agenda</span>
          </button>
          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />
          <span className="text-xs font-bold text-zinc-400 hidden sm:inline">
            {isTask ? 'Detalle de Tarea' : 'Detalle de Reunión'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave()}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isSaved ? 'bg-emerald-600 text-white' : 'bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white'
            }`}
          >
            {isSaved ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaved ? 'Guardado' : 'Guardar'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 border border-zinc-800 transition cursor-pointer"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Form */}
      <div className="max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Title & Completion Status */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleToggle}
              className="mt-1 text-zinc-400 hover:text-[var(--accent)] transition cursor-pointer"
            >
              {isCompleted ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <Circle className="w-6 h-6" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título de la tarea o compromiso…"
                className="w-full bg-transparent text-base sm:text-lg font-bold text-zinc-100 focus:outline-none focus:border-b focus:border-[var(--accent)] pb-1"
              />
              <span className="text-[11px] text-zinc-500 font-mono">
                {isTask ? 'Tarea de Agenda' : 'Reunión / Encuentro 1:1'} • {isCompleted ? 'Completado ✓' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Quick Postpone Shortcuts */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/60">
            <span className="text-xs text-zinc-500">Mover fecha:</span>
            <button
              type="button"
              onClick={() => handlePostpone(today)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                date === today ? 'bg-[var(--accent)] text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handlePostpone(tomorrow)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                date === tomorrow ? 'bg-[var(--accent)] text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => handlePostpone(nextWeek)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
            >
              Próx. semana (+7d)
            </button>
          </div>
        </div>

        {/* Date, Time & Linked Project */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Fecha</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Horario (opcional)</span>
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-1.5">
            <label className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <FolderKanban className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Cliente vinculado</span>
            </label>
            <select
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">Sin cliente (Personal)</option>
              {projects.filter(p => !p.archived).map(p => (
                <option key={p.id} value={p.clientName}>
                  {p.clientName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linked Client Shortcut Card (if selected) */}
        {linkedProject && onNavigateToProject && (
          <div className="p-3.5 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FolderKanban className="w-4 h-4 text-[var(--accent)]" />
              <div>
                <p className="text-xs font-bold text-zinc-100">
                  {linkedProject.clientName}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {linkedProject.ownerName ? `${linkedProject.ownerName} • ` : ''}
                  {linkedProject.projectType === 'web' ? 'Desarrollo Web' : 'Programa PAF'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToProject(linkedProject.id)}
              className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold hover:bg-[var(--accent-strong)] transition cursor-pointer"
            >
              Abrir Ficha 360
            </button>
          </div>
        )}

        {/* Task Specific: Category & Priority */}
        {isTask && (
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 space-y-3.5">
            {/* Misión de la Semana */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-zinc-400 block uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>Misión de la Semana</span>
                </label>
                {selectedMissionId ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-bold">
                    ✓ En Misión
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500">
                    Suelto
                  </span>
                )}
              </div>
              <select
                value={selectedMissionId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedMissionId(newId);
                  handleSave(newId);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">Suelto (Sin misión asignada)</option>
                {missions.map(m => (
                  <option key={m.id} value={m.id}>
                    🎯 [{m.frente}] {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 border-t border-zinc-800/60">
              <label className="text-xs font-bold text-zinc-400 mb-2 block uppercase tracking-wider">
                Bloque / Categoría de la Jornada
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {(Object.keys(TASK_CATEGORIES) as (DailyAllocationBucketId | 'general')[]).map(catId => {
                  const cfg = TASK_CATEGORIES[catId];
                  const IconComp = cfg.icon;
                  const isSelected = taskCategory === catId;
                  return (
                    <button
                      key={catId}
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setTaskCategory(catId);
                        if (onUpdateTask) {
                          onUpdateTask(data.id, { category: catId });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                        isSelected
                          ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} ring-1 ring-offset-0 ring-current font-bold`
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/60">
              <label className="text-xs font-bold text-zinc-400 mb-2 block uppercase tracking-wider">
                Prioridad
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['alta', 'media', 'baja'] as TaskPriority[]).map(p => {
                  const pCfg = TASK_PRIORITIES[p];
                  const isSelected = taskPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        hapticFeedback.selection();
                        setTaskPriority(p);
                        if (onUpdateTask) {
                          onUpdateTask(data.id, { priority: p });
                        }
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition active:scale-95 cursor-pointer ${
                        isSelected
                          ? pCfg.badge + ' ring-1 ring-offset-0 ring-current font-bold'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {pCfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Subtasks (if Task) */}
        {isTask && (
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-[var(--accent)]" />
                <span>Subtareas / Checklist ({completedSubtasks}/{subtasks.length})</span>
              </h3>
            </div>

            <form onSubmit={handleAddSubtaskSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Agregar paso o entregable específico…"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </form>

            <div className="space-y-1.5">
              {subtasks.map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      if (onToggleSubtask) onToggleSubtask(data.id, s.id);
                    }}
                    className="flex items-center gap-2 text-xs text-left flex-1"
                  >
                    {s.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    )}
                    <span className={s.completed ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                      {s.title}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteSubtask) onDeleteSubtask(data.id, s.id);
                    }}
                    className="text-zinc-600 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meeting Notes & Direct WhatsApp/Call (if Meeting) */}
        {!isTask && (
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Notas del Encuentro & Temario
            </h3>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Objetivos de la llamada, acuerdos y próximos pasos acordados…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-[var(--accent)]"
            />

            {clientPhone && (
              <div className="flex items-center gap-3 pt-2">
                <a
                  href={formatWhatsAppUrl(clientPhone, `Hola, nos vemos en nuestra reunión de las ${time || '11:00'} hs!`)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Avisar por WhatsApp</span>
                </a>
                <a
                  href={formatTelUrl(clientPhone)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Llamar</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Mini-Grafo de Relaciones Conectadas */}
        <LocalGraphWidget
          entityId={data.id}
          catalog={buildLinkCatalog({ notes: allNotes, tasks, projects, meetings })}
          relations={extractAllAppRelations({ notes: allNotes, tasks, projects, meetings })}
          onNavigate={onNavigate}
          privacyMode={privacyMode}
        />

        {/* Backlinks Panel */}
        <BacklinksPanel
          entityId={data.id}
          relations={extractAllAppRelations({ notes: allNotes, tasks, projects, meetings })}
          catalog={buildLinkCatalog({ notes: allNotes, tasks, projects, meetings })}
          onNavigate={onNavigate}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4">
            <h4 className="text-sm font-bold text-zinc-100">
              ¿Eliminar {isTask ? 'esta tarea' : 'esta reunión'}?
            </h4>
            <p className="text-xs text-zinc-400">
              Se borrará permanentemente de tu agenda.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 text-xs text-zinc-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/25"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
