import React, { useState } from 'react';
import { AgendaTask } from '../types';
import { Plus, Check, Clock, Trash2, ArrowRight, ArrowLeft, RotateCcw, Filter, Eye } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { fireTaskCelebration } from '../utils/confetti';
import { addDays } from '../utils/storage';

interface Props {
  tasks: AgendaTask[];
  today: string;
  onToggleTask: (id: string) => void;
  onMoveTaskDate: (id: string, date: string) => void;
  onDeleteTask: (id: string) => void;
  onOpenQuickAdd: (type: 'tarea', defaultDate?: string) => void;
  onUpdateTask?: (id: string, updates: Partial<AgendaTask>) => void;
}

export const KanbanBoard: React.FC<Props> = ({
  tasks,
  today,
  onToggleTask,
  onMoveTaskDate,
  onDeleteTask,
  onOpenQuickAdd,
  onUpdateTask,
}) => {
  // Filter for completed tasks: 'today' (reseteado por día para no marear) or 'all'
  const [doneFilter, setDoneFilter] = useState<'today' | 'all'>(() => {
    try {
      const saved = localStorage.getItem('cero_kanban_done_filter');
      return saved === 'all' ? 'all' : 'today';
    } catch {
      return 'today';
    }
  });

  const toggleDoneFilter = (mode: 'today' | 'all') => {
    hapticFeedback.light();
    setDoneFilter(mode);
    try {
      localStorage.setItem('cero_kanban_done_filter', mode);
    } catch {}
  };

  // Determine which column a task belongs to with backwards compatibility
  const getTaskStatus = (t: AgendaTask): 'todo' | 'inprogress' | 'done' => {
    if (t.completed) return 'done';
    if (t.kanbanStatus === 'inprogress') return 'inprogress';
    if (t.kanbanStatus === 'done') return 'done';
    // Without explicit manual status, tasks always start in 'todo' (Por hacer)
    return 'todo';
  };

  const todoTasks = tasks.filter(t => getTaskStatus(t) === 'todo');
  const inProgressTasks = tasks.filter(t => getTaskStatus(t) === 'inprogress');
  
  const allCompletedTasks = tasks.filter(t => getTaskStatus(t) === 'done');
  const todayCompletedTasks = allCompletedTasks.filter(t => t.date === today);
  const doneTasks = doneFilter === 'today' ? todayCompletedTasks : allCompletedTasks;

  const hiddenCompletedCount = allCompletedTasks.length - todayCompletedTasks.length;

  const handleTaskToggle = (task: AgendaTask) => {
    hapticFeedback.medium();
    if (!task.completed) {
      playTaskDone();
      fireTaskCelebration(0.5, 0.4);
      if (onUpdateTask) {
        onUpdateTask(task.id, { completed: true, kanbanStatus: 'done' });
      } else {
        onToggleTask(task.id);
      }
    } else {
      if (onUpdateTask) {
        onUpdateTask(task.id, { completed: false, kanbanStatus: 'inprogress' });
      } else {
        onToggleTask(task.id);
      }
    }
  };

  // Move task to a specific stage
  const handleMoveToStage = (task: AgendaTask, targetStage: 'todo' | 'inprogress' | 'done') => {
    hapticFeedback.medium();

    if (targetStage === 'done') {
      playTaskDone();
      fireTaskCelebration(0.5, 0.4);
      if (onUpdateTask) {
        onUpdateTask(task.id, { completed: true, kanbanStatus: 'done' });
      } else {
        onToggleTask(task.id);
      }
      return;
    }

    if (targetStage === 'inprogress') {
      const updates: Partial<AgendaTask> = {
        completed: false,
        kanbanStatus: 'inprogress',
        date: task.date > today ? today : task.date,
      };
      if (onUpdateTask) {
        onUpdateTask(task.id, updates);
      } else {
        if (task.completed) onToggleTask(task.id);
        if (task.date > today) onMoveTaskDate(task.id, today);
      }
      return;
    }

    if (targetStage === 'todo') {
      const newDate = task.date <= today ? addDays(today, 1) : task.date;
      const updates: Partial<AgendaTask> = {
        completed: false,
        kanbanStatus: 'todo',
        date: newDate,
      };
      if (onUpdateTask) {
        onUpdateTask(task.id, updates);
      } else {
        if (task.completed) onToggleTask(task.id);
        onMoveTaskDate(task.id, newDate);
      }
      return;
    }
  };

  const columns = [
    { id: 'todo', label: 'POR HACER', items: todoTasks, defaultDate: addDays(today, 1) },
    { id: 'inprogress', label: 'EN CURSO', items: inProgressTasks, defaultDate: today },
    { id: 'done', label: 'HECHO', items: doneTasks, defaultDate: today },
  ];

  return (
    <div className="w-full space-y-3">
      {/* 3 Columns Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(col => (
          <div 
            key={col.id}
            className="card-swiss p-3.5 flex flex-col min-h-[480px]"
          >
            {/* Column Header: Small Uppercase + Counter Badge + Controls */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-divider)] gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="label-swiss text-[11px] font-bold">
                  {col.label}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-medium">
                  {col.items.length}
                </span>
              </div>

              {/* Special Controls for HECHO column: Daily reset filter */}
              {col.id === 'done' ? (
                <div className="flex items-center bg-[var(--bg-app)] p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[10px]">
                  <button
                    type="button"
                    onClick={() => toggleDoneFilter('today')}
                    className={`px-2 py-0.5 rounded transition font-medium cursor-pointer ${
                      doneFilter === 'today'
                        ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title="Ver solo las terminadas hoy (reseteado diario)"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDoneFilter('all')}
                    className={`px-2 py-0.5 rounded transition font-medium cursor-pointer ${
                      doneFilter === 'all'
                        ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                    title="Ver todas las tareas terminadas"
                  >
                    Todas ({allCompletedTasks.length})
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenQuickAdd('tarea', col.defaultDate)}
                  className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
                  title={`Añadir a ${col.label}`}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              )}
            </div>

            {/* Task Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
              {col.items.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-control)] p-3 text-center">
                  <span className="text-xs text-[var(--text-tertiary)] font-medium">
                    {col.id === 'done' && doneFilter === 'today' && hiddenCompletedCount > 0 
                      ? 'Sin tareas completadas hoy' 
                      : 'Sin tareas'}
                  </span>
                  {col.id === 'done' && doneFilter === 'today' && hiddenCompletedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleDoneFilter('all')}
                      className="mt-2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
                    >
                      Ver {hiddenCompletedCount} anteriores
                    </button>
                  )}
                </div>
              ) : (
                col.items.map(task => (
                  <div
                    key={task.id}
                    className="card-swiss p-2.5 space-y-2.5 hover:border-[var(--text-tertiary)] transition group bg-[var(--bg-app)]"
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Rounded Square Checkbox: turns black on check */}
                      <button
                        type="button"
                        onClick={() => handleTaskToggle(task)}
                        className="mt-0.5 shrink-0 cursor-pointer"
                        title={task.completed ? 'Reabrir tarea' : 'Marcar como hecha'}
                      >
                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition ${
                          task.completed
                            ? 'bg-[var(--solid-contrast-bg)] border-[var(--solid-contrast-bg)]'
                            : 'border-[var(--border-subtle)] group-hover:border-[var(--text-primary)] bg-[var(--bg-surface)]'
                        }`}>
                          {task.completed && (
                            <Check className="w-3 h-3 text-[var(--solid-contrast-text)] stroke-[3]" />
                          )}
                        </div>
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium leading-snug break-words ${
                          task.completed 
                            ? 'line-through text-[var(--text-tertiary)]' 
                            : 'text-[var(--text-primary)]'
                        }`}>
                          {task.title}
                        </p>

                        {/* Small Gray Metadata */}
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-mono mt-1.5 flex-wrap">
                          {task.date && (
                            <span className="text-[var(--text-tertiary)]">
                              {task.date === today ? 'Hoy' : task.date.slice(5)}
                            </span>
                          )}
                          {task.time && (
                            <span className="text-[var(--text-secondary)] font-medium">
                              · {task.time} hs
                            </span>
                          )}
                          {task.projectName && (
                            <span className="truncate">
                              · {task.projectName}
                            </span>
                          )}
                          {task.priority && task.priority !== 'media' && (
                            <span className={task.priority === 'alta' ? 'text-[#DC2626] font-medium' : 'text-[var(--text-tertiary)]'}>
                              · {task.priority.toUpperCase()}
                            </span>
                          )}
                          {((task.subtareas && task.subtareas.length > 0) || (task.subtasks && task.subtasks.length > 0)) && (
                            <span className="text-[var(--text-secondary)] font-medium">
                              · {task.subtareas ? `${task.subtareas.filter(s => s.hecha).length}/${task.subtareas.length}` : `${task.subtasks?.filter(s => s.completed).length}/${task.subtasks?.length}`} subtareas
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete icon */}
                      <button
                        type="button"
                        onClick={() => {
                          hapticFeedback.medium();
                          onDeleteTask(task.id);
                        }}
                        className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-[#DC2626] transition shrink-0 cursor-pointer"
                        title="Eliminar tarea"
                      >
                        <Trash2 className="w-3 h-3 stroke-[1.5]" />
                      </button>
                    </div>

                    {/* Quick Move Action Bar between stages */}
                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px]">
                      {/* Backward move */}
                      {col.id === 'inprogress' && (
                        <button
                          type="button"
                          onClick={() => handleMoveToStage(task, 'todo')}
                          className="inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                          title="Pasar a Por Hacer"
                        >
                          <ArrowLeft className="w-3 h-3" />
                          <span>Por hacer</span>
                        </button>
                      )}

                      {col.id === 'done' && (
                        <button
                          type="button"
                          onClick={() => handleMoveToStage(task, 'inprogress')}
                          className="inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                          title="Reabrir a En curso"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reabrir a En curso</span>
                        </button>
                      )}

                      {col.id === 'todo' && <div />}

                      {/* Forward move */}
                      {col.id === 'todo' && (
                        <button
                          type="button"
                          onClick={() => handleMoveToStage(task, 'inprogress')}
                          className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition cursor-pointer ml-auto"
                          title="Pasar a En curso"
                        >
                          <span>En curso</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {col.id === 'inprogress' && (
                        <button
                          type="button"
                          onClick={() => handleMoveToStage(task, 'done')}
                          className="inline-flex items-center gap-1 text-[#16A34A] hover:text-[#15803D] font-medium transition cursor-pointer ml-auto"
                          title="Marcar como Hecho"
                        >
                          <span>Completar</span>
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* HECHO Column footer notice if some completed tasks are hidden by daily reset filter */}
            {col.id === 'done' && doneFilter === 'today' && hiddenCompletedCount > 0 && (
              <div className="pt-2.5 mt-2 border-t border-[var(--border-divider)] text-[10px] text-[var(--text-tertiary)] flex items-center justify-between">
                <span>{hiddenCompletedCount} terminadas en días previos</span>
                <button
                  type="button"
                  onClick={() => toggleDoneFilter('all')}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer"
                >
                  Ver todas
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
