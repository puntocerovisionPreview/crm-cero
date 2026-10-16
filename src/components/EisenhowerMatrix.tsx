import React from 'react';
import { AgendaTask, AgendaMeeting } from '../types';
import { Plus, Check, Clock, Trash2 } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { fireTaskCelebration } from '../utils/confetti';

interface Props {
  tasks: AgendaTask[];
  meetings?: AgendaMeeting[];
  today: string;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onOpenQuickAdd: (type: 'tarea', defaultDate?: string) => void;
}

export const EisenhowerMatrix: React.FC<Props> = ({
  tasks,
  meetings = [],
  today,
  onToggleTask,
  onDeleteTask,
  onOpenQuickAdd,
}) => {
  // Classification logic into 4 quadrants:
  // Q1: Urgente & Importante (Priority 'alta' or due today/overdue)
  // Q2: Importante, No Urgente (Priority 'media' or linked to project, date > today)
  // Q3: Urgente, No Importante (Meetings or tasks with time today)
  // Q4: Después (Priority 'baja' or backlog)

  const pendingTasks = tasks.filter(t => !t.completed);

  const q1Tasks = pendingTasks.filter(
    t => t.priority === 'alta' || (t.date <= today && !t.completed)
  );

  const q2Tasks = pendingTasks.filter(
    t => (t.priority === 'media' || Boolean(t.projectName)) && t.date > today && t.priority !== 'alta'
  );

  const q3Tasks = pendingTasks.filter(
    t => (t.priority === 'baja' && t.date <= today) || (Boolean(t.time) && t.priority !== 'alta' && !q1Tasks.includes(t))
  );

  const q4Tasks = pendingTasks.filter(
    t => !q1Tasks.includes(t) && !q2Tasks.includes(t) && !q3Tasks.includes(t)
  );

  const quadrants = [
    {
      id: 'q1',
      title: 'URGENTE & IMPORTANTE',
      subtitle: 'Hacer de inmediato',
      colorClass: 'text-[#DC2626]',
      items: q1Tasks,
    },
    {
      id: 'q2',
      title: 'IMPORTANTE (PLANIFICAR)',
      subtitle: 'Objetivos estratégicos',
      colorClass: 'text-[#16A34A]',
      items: q2Tasks,
    },
    {
      id: 'q3',
      title: 'URGENTE (RÁPIDO)',
      subtitle: 'Trámites y operativas',
      colorClass: 'text-[#D97706]',
      items: q3Tasks,
    },
    {
      id: 'q4',
      title: 'DESPUÉS',
      subtitle: 'Secundarias o backlog',
      colorClass: 'text-[var(--text-tertiary)]',
      items: q4Tasks,
    },
  ];

  const handleTaskToggle = (task: AgendaTask) => {
    hapticFeedback.medium();
    if (!task.completed) {
      playTaskDone();
      fireTaskCelebration(0.5, 0.4);
    }
    onToggleTask(task.id);
  };

  return (
    <div className="w-full">
      {/* 2x2 Quadrant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quadrants.map(q => (
          <div
            key={q.id}
            className="card-swiss p-4 flex flex-col min-h-[300px]"
          >
            {/* Quadrant Header: Only title carries semantic color per Swiss rule */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-divider)]">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className={`text-xs font-bold tracking-wider ${q.colorClass}`}>
                    {q.title}
                  </h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-medium">
                    {q.items.length}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {q.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpenQuickAdd('tarea', today)}
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
                title="Añadir tarea a este cuadrante"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
              </button>
            </div>

            {/* Task list in quadrant */}
            <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
              {q.items.length === 0 ? (
                <div className="h-28 flex items-center justify-center border border-dashed border-[var(--border-subtle)] rounded-[var(--radius-control)]">
                  <span className="text-xs text-[var(--text-tertiary)] font-medium">
                    Cuadrante libre
                  </span>
                </div>
              ) : (
                q.items.map(task => (
                  <div
                    key={task.id}
                    className="card-swiss p-2.5 space-y-1.5 hover:border-[var(--text-tertiary)] transition group bg-[var(--bg-app)]"
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Rounded Square Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleTaskToggle(task)}
                        className="mt-0.5 shrink-0 cursor-pointer"
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
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-mono mt-1 flex-wrap">
                          {task.date && (
                            <span>{task.date}</span>
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
                        </div>
                      </div>

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
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
