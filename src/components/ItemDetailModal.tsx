import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Calendar, 
  Clock, 
  Bell, 
  FolderKanban, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Trash2, 
  MessageCircle, 
  Phone, 
  CalendarCheck, 
  ListTodo, 
  Plus, 
  Check, 
  Save, 
  AlertCircle,
  Target 
} from 'lucide-react';
import { AgendaTask, AgendaMeeting, DailyAllocationBucketId, TaskPriority, Project, WeeklyMission } from '../types';
import { TASK_CATEGORIES, TASK_PRIORITIES } from '../utils/taskCategories';
import { resolveTaskProject } from '../utils/taskProject';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { fireTaskCelebration } from '../utils/confetti';
import { generateCalendarICS } from '../utils/calendarIcs';
import { formatWhatsAppUrl, formatTelUrl, extractPhoneFromText } from '../utils/contact';
import { addDays, formatDayName, formatShortDay, getTodayString } from '../utils/storage';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    type: 'tarea' | 'reunion';
    data: AgendaTask | AgendaMeeting;
  } | null;
  projects?: Project[];
  missions?: WeeklyMission[];
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
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  projects = [],
  missions = [],
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
}) => {
  if (!isOpen || !item) return null;

  const isTask = item.type === 'tarea';
  const data = item.data;
  const today = getTodayString();
  const tomorrow = addDays(today, 1);

  // Resolve initial project using single source of truth
  const initialProject = isTask 
    ? resolveTaskProject(data as AgendaTask, projects)
    : projects.find(p => p.id === (data as AgendaMeeting).projectId || (p.clientName && p.clientName.toLowerCase() === ((data as AgendaMeeting).projectName || '').toLowerCase()));

  const [title, setTitle] = useState(data.title);
  const [date, setDate] = useState(data.date);
  const [time, setTime] = useState(data.time || '');
  const [reminderMinutes, setReminderMinutes] = useState<number | undefined>(
    data.reminderMinutesBefore !== undefined ? data.reminderMinutesBefore : 15
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProject ? initialProject.id : ((data as any).projectId || '')
  );
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
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  const isCompleted = data.completed;
  const subtasks = isTask ? (data as AgendaTask).subtasks || [] : [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;

  const handleSave = (customProjectId?: string, customMissionId?: string) => {
    hapticFeedback.light();
    const projIdToUse = customProjectId !== undefined ? customProjectId : selectedProjectId;
    const missionIdToUse = customMissionId !== undefined ? customMissionId : selectedMissionId;
    const chosenProject = projects.find(p => p.id === projIdToUse);
    const finalProjectId = chosenProject ? chosenProject.id : undefined;
    const finalProjectName = chosenProject ? chosenProject.clientName : undefined;

    if (isTask && onUpdateTask) {
      onUpdateTask(data.id, {
        title: title.trim(),
        date,
        time: time || undefined,
        category: taskCategory,
        priority: taskPriority,
        reminderMinutesBefore: reminderMinutes,
        projectId: finalProjectId,
        projectName: finalProjectName,
        missionId: missionIdToUse || undefined,
      });
    } else if (!isTask && onUpdateMeeting) {
      onUpdateMeeting(data.id, {
        title: title.trim(),
        date,
        time: time || undefined,
        reminderMinutesBefore: reminderMinutes,
        projectId: finalProjectId,
        projectName: finalProjectName,
        missionId: missionIdToUse || undefined,
        notes: notes.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
      });
    }
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const handleToggleDone = () => {
    hapticFeedback.medium();
    if (!isCompleted) {
      playTaskDone();
      fireTaskCelebration(0.5, 0.5);
    }
    if (isTask) {
      onToggleTask(data.id);
    } else {
      onToggleMeeting(data.id);
    }
  };

  const handleMoveToTomorrow = () => {
    hapticFeedback.medium();
    if (isTask) {
      onMoveTaskDate(data.id, tomorrow);
    } else {
      onMoveMeetingDate(data.id, tomorrow);
    }
    setDate(tomorrow);
    onClose();
  };

  const handleDelete = () => {
    hapticFeedback.heavy();
    if (isTask) {
      onDeleteTask(data.id);
    } else {
      onDeleteMeeting(data.id);
    }
    onClose();
  };

  const handleAddSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !onAddSubtask) return;
    hapticFeedback.light();
    onAddSubtask(data.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  const phoneForCall = clientPhone || extractPhoneFromText(notes);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-950/40">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isTask
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                {isTask ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>{isTask ? 'Tarea' : 'Reunión'}</span>
              </span>

              {isCompleted ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Completada
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Pendiente
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition active:scale-95"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
            {/* Title & Status */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
                Título
              </label>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleToggleDone}
                  className="shrink-0 p-1 rounded-xl hover:bg-zinc-800 transition active:scale-90"
                  title={isCompleted ? 'Reabrir como pendiente' : 'Marcar como realizada'}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <Circle className={`w-6 h-6 ${isTask ? 'text-[var(--accent)]' : 'text-amber-400'}`} />
                  )}
                </button>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => handleSave()}
                  className={`w-full bg-zinc-950 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-3.5 py-2 text-sm sm:text-base font-semibold text-zinc-100 transition focus:outline-hidden ${
                    isCompleted ? 'line-through text-zinc-500' : ''
                  }`}
                  placeholder="Título del compromiso..."
                />
              </div>
            </div>

            {/* Quick Date Shortcuts & Date Picker */}
            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1.5 flex items-center justify-between">
                <span>Fecha</span>
                <span className="text-[11px] text-zinc-500">{formatDayName(date)} · {formatShortDay(date)}</span>
              </label>

              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setDate(today);
                    if (isTask && onUpdateTask) onUpdateTask(data.id, { date: today });
                    if (!isTask && onUpdateMeeting) onUpdateMeeting(data.id, { date: today });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    date === today
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDate(tomorrow);
                    if (isTask && onUpdateTask) onUpdateTask(data.id, { date: tomorrow });
                    if (!isTask && onUpdateMeeting) onUpdateMeeting(data.id, { date: tomorrow });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    date === tomorrow
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  Mañana
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const in2Days = addDays(today, 2);
                    setDate(in2Days);
                    if (isTask && onUpdateTask) onUpdateTask(data.id, { date: in2Days });
                    if (!isTask && onUpdateMeeting) onUpdateMeeting(data.id, { date: in2Days });
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                >
                  En 2 días
                </button>
              </div>

              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (isTask && onUpdateTask) onUpdateTask(data.id, { date: e.target.value });
                  if (!isTask && onUpdateMeeting) onUpdateMeeting(data.id, { date: e.target.value });
                }}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-3.5 py-2 text-sm text-zinc-200 transition focus:outline-hidden"
              />
            </div>

            {/* Time & Alert Reminder */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Horario</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  onBlur={() => handleSave()}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-3.5 py-2 text-sm text-zinc-200 transition focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                  <Bell className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Aviso / Recordatorio</span>
                </label>
                <select
                  value={reminderMinutes !== undefined ? reminderMinutes : 15}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setReminderMinutes(val);
                    if (isTask && onUpdateTask) onUpdateTask(data.id, { reminderMinutesBefore: val });
                    if (!isTask && onUpdateMeeting) onUpdateMeeting(data.id, { reminderMinutesBefore: val });
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-3 py-2 text-sm text-zinc-200 transition focus:outline-hidden"
                >
                  <option value={0}>Al momento exacto</option>
                  <option value={5}>5 minutos antes</option>
                  <option value={15}>15 minutos antes</option>
                  <option value={30}>30 minutos antes</option>
                  <option value={60}>1 hora antes</option>
                </select>
              </div>
            </div>

            {/* Project Association */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                  <FolderKanban className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Proyecto o Cliente Relacionado</span>
                </label>
                {selectedProjectId ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ✓ Vinculado
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-500">
                    Sin vincular
                  </span>
                )}
              </div>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedProjectId(newId);
                  handleSave(newId);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-3.5 py-2 text-sm text-zinc-200 transition focus:outline-hidden cursor-pointer"
              >
                <option value="">-- Sin proyecto (General / Suelta) --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.clientName} {p.serviceType ? `(${p.serviceType.toUpperCase()})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-500 mt-1">
                Al seleccionar un cliente, la tarea se indexa automáticamente en su Ficha 360°, Lista de Proyectos y el Grafo.
              </p>
            </div>

            {/* Misión de la Semana */}
            {isTask && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Misión de la Semana</span>
                  </label>
                  {selectedMissionId ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
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
                    const newMissionId = e.target.value;
                    setSelectedMissionId(newMissionId);
                    handleSave(undefined, newMissionId);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-3.5 py-2 text-sm text-zinc-200 transition focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Suelto (Sin misión asignada) --</option>
                  {missions.map(m => (
                    <option key={m.id} value={m.id}>
                      [{m.frente}] {m.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Las tareas vinculadas a una misión acumulan su tiempo de foco y avance directamente en el objetivo semanal.
                </p>
              </div>
            )}

            {/* Task Specific: Category (Jornada Bucket) & Priority */}
            {isTask && (
              <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                {/* Categoría / Bloque */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
                    Bloque / Categoría de la Jornada
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
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
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            isSelected
                              ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} ring-1 ring-offset-0 ring-current font-bold`
                              : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Prioridad */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
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
                          className={`py-1.5 px-2 rounded-xl text-xs font-semibold border text-center transition active:scale-95 ${
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

            {/* Meeting Specific: Phone & Notes */}
            {!isTask && (
              <div className="space-y-3 pt-2 border-t border-zinc-800">
                <div>
                  <label className="text-xs font-semibold text-amber-400 mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Teléfono o WhatsApp del Cliente</span>
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    onBlur={() => handleSave()}
                    placeholder="Ej: +54 9 11 2345 6789"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-sm text-zinc-200 transition focus:outline-hidden"
                  />
                </div>

                {phoneForCall && (
                  <div className="flex items-center gap-2">
                    <a
                      href={formatWhatsAppUrl(phoneForCall, `Hola! Te contacto por nuestra reunión.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Abrir WhatsApp</span>
                    </a>
                    <a
                      href={formatTelUrl(phoneForCall)}
                      className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Phone className="w-4 h-4 text-emerald-400" />
                      <span>Llamar</span>
                    </a>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
                    Notas y temas de la reunión
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => handleSave()}
                    rows={3}
                    placeholder="Temas a tratar, presupuesto, acuerdos..."
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl p-3 text-xs sm:text-sm text-zinc-200 transition focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            )}

            {/* Task Specific: Subtasks Checklist */}
            {isTask && (
              <div className="space-y-2.5 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <ListTodo className="w-4 h-4 text-[var(--accent)]" />
                    <span>Subtareas ({completedSubtasks}/{subtasks.length})</span>
                  </div>
                  {subtasks.length > 0 && (
                    <span className="text-[11px] font-bold text-zinc-400">
                      {Math.round((completedSubtasks / subtasks.length) * 100)}%
                    </span>
                  )}
                </div>

                {subtasks.length > 0 && (
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[var(--accent)] h-full transition-all duration-300"
                      style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                    />
                  </div>
                )}

                {/* Subtask list */}
                <div className="space-y-1.5">
                  {subtasks.map(sub => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleSubtask && onToggleSubtask(data.id, sub.id)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                          sub.completed
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                            : 'border-zinc-700 bg-zinc-900'
                        }`}>
                          {sub.completed && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className={`text-xs font-medium truncate ${
                          sub.completed ? 'line-through text-zinc-500' : 'text-zinc-200'
                        }`}>
                          {sub.title}
                        </span>
                      </button>

                      {onDeleteSubtask && (
                        <button
                          type="button"
                          onClick={() => onDeleteSubtask(data.id, sub.id)}
                          className="p-1 text-zinc-600 hover:text-red-400 transition rounded-lg hover:bg-zinc-800"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add new subtask form */}
                <form onSubmit={handleAddSubtaskSubmit} className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Nueva subtarea..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-[var(--accent)] rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-[var(--accent)] hover:text-white disabled:opacity-40 text-zinc-200 text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Calendar Export Shortcut */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  generateCalendarICS({
                    title: isTask ? data.title : `Reunión: ${data.title}`,
                    description: isTask 
                      ? (data.projectName ? `Proyecto: ${data.projectName}` : 'Tarea .Cero')
                      : [
                          data.projectName ? `Proyecto: ${data.projectName}` : '',
                          clientPhone ? `Tel/WhatsApp: ${clientPhone}` : '',
                          notes ? `Notas: ${notes}` : '',
                        ].filter(Boolean).join('\n'),
                    date,
                    time,
                    alarmMinutesBefore: reminderMinutes !== undefined ? reminderMinutes : 15,
                  });
                }}
                className="w-full py-2 px-3 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-400 text-xs font-semibold transition flex items-center justify-center gap-2 active:scale-98"
              >
                <CalendarCheck className="w-4 h-4 text-emerald-400" />
                <span>Exportar a Calendario Apple / Google (.ICS)</span>
              </button>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between gap-2.5 flex-wrap">
            {/* Delete button or confirm */}
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 font-semibold">¿Eliminar?</span>
                <button
                  onClick={handleDelete}
                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 transition"
                >
                  Sí, borrar
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition text-xs font-semibold flex items-center gap-1"
                title="Eliminar este compromiso"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMoveToTomorrow}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
              >
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Pasar a mañana</span>
              </button>

              <button
                type="button"
                onClick={handleToggleDone}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-md ${
                  isCompleted
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                    : isTask
                    ? 'bg-[var(--accent)] hover:bg-[#d04e0a] text-white shadow-[var(--accent)]/25'
                    : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/25'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isCompleted ? 'Reabrir' : '¡Completada!'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
