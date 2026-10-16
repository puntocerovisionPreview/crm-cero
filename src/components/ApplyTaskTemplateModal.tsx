import React, { useState } from 'react';
import { 
  Sparkles, 
  Layers, 
  Calendar, 
  Check, 
  ChevronRight, 
  X, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ListTodo
} from 'lucide-react';
import { Project, AgendaTask } from '../types';
import { 
  PROJECT_TASK_TEMPLATES, 
  ProjectTaskTemplate, 
  generateTasksFromTemplate 
} from '../utils/projectTaskTemplates';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { fireTaskCelebration } from '../utils/confetti';
import { ModalPortal } from './ModalPortal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onAddTask: (task: Omit<AgendaTask, 'id'>) => void;
}

export const ApplyTaskTemplateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  onAddTask,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    // Smart pre-select based on project type
    const pType = (project.projectType || '').toLowerCase();
    if (pType.includes('paf')) return 'mantenimiento-paf';
    if (pType.includes('brand') || pType.includes('identidad')) return 'branding';
    if (pType.includes('tienda') || pType.includes('shop') || pType.includes('ecom')) return 'ecommerce';
    if (pType.includes('sistema') || pType.includes('app')) return 'sistema-web';
    return 'landing-page';
  });

  const [startDate, setStartDate] = useState(getTodayString());
  const [selectedTaskIndexes, setSelectedTaskIndexes] = useState<Record<number, boolean>>({});
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentTemplate = PROJECT_TASK_TEMPLATES.find(t => t.id === selectedTemplateId) || PROJECT_TASK_TEMPLATES[0];
  const generatedTasks = generateTasksFromTemplate(
    currentTemplate.id, 
    project.id, 
    project.clientName, 
    startDate
  );

  const toggleTaskSelection = (idx: number) => {
    hapticFeedback.light();
    setSelectedTaskIndexes(prev => ({
      ...prev,
      [idx]: prev[idx] !== undefined ? !prev[idx] : false, // defaults true if undefined
    }));
  };

  const isTaskIncluded = (idx: number) => {
    return selectedTaskIndexes[idx] !== false; // true unless explicitly disabled
  };

  const activeTasksToApply = generatedTasks.filter((_, idx) => isTaskIncluded(idx));

  const handleApply = () => {
    if (activeTasksToApply.length === 0) return;
    hapticFeedback.success();

    activeTasksToApply.forEach(task => {
      onAddTask(task);
    });

    fireTaskCelebration(0.5, 0.4);
    setAppliedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="card-swiss bg-[var(--bg-surface)] border-[var(--border-subtle)] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                  Cargar Plantilla de Tareas Automatizadas
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Para el cliente: <strong className="text-[var(--text-primary)]">{project.clientName}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {appliedSuccess ? (
            <div className="p-8 text-center space-y-3 my-auto">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <h4 className="text-base font-bold text-[var(--text-primary)] font-heading">
                ¡{activeTasksToApply.length} tareas cargadas con éxito!
              </h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Ya están sincronizadas en la agenda y cronograma de {project.clientName}.
              </p>
            </div>
          ) : (
            <>
              {/* Content body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* 1. Selector de Plantillas */}
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
                    1. Elegí el tipo de proyecto
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PROJECT_TASK_TEMPLATES.map((tpl) => {
                      const isSelected = tpl.id === selectedTemplateId;
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            hapticFeedback.light();
                            setSelectedTemplateId(tpl.id);
                            setSelectedTaskIndexes({});
                          }}
                          className={`p-3 rounded-xl border transition cursor-pointer select-none space-y-1 ${
                            isSelected
                              ? 'bg-[var(--bg-surface-muted)] border-[var(--text-primary)] shadow-xs'
                              : 'bg-[var(--bg-app)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-muted)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs text-[var(--text-primary)]">
                              {tpl.name}
                            </span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${tpl.badgeColor}`}>
                              {tpl.tagline}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-[var(--text-secondary)] line-clamp-2">
                            {tpl.description}
                          </p>
                          <div className="flex items-center gap-2 pt-1 text-[10px] text-[var(--text-tertiary)] font-mono">
                            <span className="flex items-center gap-1">
                              <ListTodo className="w-3 h-3" />
                              {tpl.tasks.length} pasos
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              ~{tpl.estimatedTotalDays} días
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Fecha de inicio */}
                <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Fecha de inicio del proyecto
                    </span>
                    <span className="text-[11px] text-[var(--text-secondary)] block">
                      Las fechas de cada entrega se calcularán automáticamente a partir de este día.
                    </span>
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] font-mono focus:outline-none"
                  />
                </div>

                {/* 3. Previsualización de tareas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      2. Tareas a generar ({activeTasksToApply.length} seleccionadas)
                    </label>
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      Hacé clic para desmarcar tareas que no correspondan
                    </span>
                  </div>

                  <div className="card-swiss divide-y divide-[var(--border-subtle)] overflow-hidden max-h-60 overflow-y-auto">
                    {generatedTasks.map((t, idx) => {
                      const included = isTaskIncluded(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleTaskSelection(idx)}
                          className={`p-2.5 flex items-start gap-2.5 transition cursor-pointer select-none text-xs ${
                            included ? 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-muted)]' : 'bg-[var(--bg-app)] opacity-40'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition ${
                            included 
                              ? 'bg-[var(--solid-contrast-bg)] border-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' 
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                          }`}>
                            {included && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className={`font-medium ${included ? 'text-[var(--text-primary)]' : 'line-through text-[var(--text-secondary)]'}`}>
                                {t.title}
                              </span>
                              <span className="text-[10px] font-mono text-[var(--text-secondary)] shrink-0">
                                {t.date}
                              </span>
                            </div>
                            {t.notes && (
                              <p className="text-[10.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                                {t.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  disabled={activeTasksToApply.length === 0}
                  className="btn-solid-primary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-40 shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cargar {activeTasksToApply.length} tareas automáticas</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};
