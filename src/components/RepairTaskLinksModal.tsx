import React, { useState } from 'react';
import { AgendaTask, Project } from '../types';
import { repairTaskProjectLinks, RepairResult } from '../utils/taskProjectMigration';
import { RefreshCw, CheckCircle2, AlertTriangle, X, Link2, ArrowRight } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: AgendaTask[];
  projects: Project[];
  onTasksUpdated: (updatedTasks: AgendaTask[]) => void;
}

export const RepairTaskLinksModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tasks,
  projects,
  onTasksUpdated,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunRepair = async () => {
    setIsRunning(true);
    setError(null);
    hapticFeedback.medium();

    try {
      const res = await repairTaskProjectLinks(tasks, projects);
      setResult(res);
      if (res.repairedCount > 0) {
        onTasksUpdated(res.updatedTasks);
        hapticFeedback.success();
      }
    } catch (err: any) {
      console.error('Error repairing task-project links:', err);
      setError(err?.message || 'Error al ejecutar la reparación en Firestore');
      hapticFeedback.heavy();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                Reparar vínculos tarea-proyecto
              </h3>
              <p className="text-[11px] text-zinc-400">
                Sincroniza projectId y projectName en lote de forma idempotente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-xs font-bold p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Box */}
        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-300 space-y-2">
          <p>
            Este proceso audita las <strong>{tasks.length} tareas</strong> del CRM y las cruza contra los <strong>{projects.length} proyectos</strong>:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-400">
            <li>Si una tarea tiene nombre de cliente pero le falta el <code className="text-amber-400 font-mono">projectId</code>, lo busca y lo completa.</li>
            <li>Si tiene <code className="text-amber-400 font-mono">projectId</code> pero le falta el nombre, completa el nombre actualizado.</li>
            <li>Aplica cambios a Firestore mediante <em>Batch Writes</em> atómicos.</li>
          </ul>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results view */}
        {result && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <div className="text-xl font-bold font-mono">{result.repairedCount}</div>
                <div className="text-[10px] uppercase font-semibold text-emerald-400">Tareas reparadas</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                <div className="text-xl font-bold font-mono">{result.unmatchedCount}</div>
                <div className="text-[10px] uppercase font-semibold text-amber-400">Sin coincidencia</div>
              </div>
            </div>

            <p className="text-xs text-zinc-400">
              {result.alreadySyncedCount} tareas ya contaban con un vínculo perfecto y no requirieron modificación.
            </p>

            {/* List of unmatched tasks for manual review */}
            {result.unmatchedTasks.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                  Tareas para revisión manual ({result.unmatchedTasks.length}):
                </div>
                {result.unmatchedTasks.map(t => (
                  <div key={t.id} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-zinc-200">{t.title}</span>
                      {t.projectName && (
                        <span className="block text-[10px] text-amber-400 truncate">
                          Proyecto asignado inexistente: "{t.projectName}"
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 shrink-0 font-mono">{t.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
          >
            {result ? 'Cerrar' : 'Cancelar'}
          </button>

          <button
            type="button"
            onClick={handleRunRepair}
            disabled={isRunning}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Reparando vínculos…' : result ? 'Volver a escanear' : 'Ejecutar Reparación'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
