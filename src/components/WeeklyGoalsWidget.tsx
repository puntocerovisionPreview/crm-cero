import React, { useState } from 'react';
import { WeeklyGoal, GoalTargetType, GoalStatus } from '../types';
import { 
  Target, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  X,
  Check,
  ArrowRight,
  TrendingUp,
  ListTodo,
  DollarSign,
  Hash
} from 'lucide-react';
import { formatWeekRange } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { fireTaskCelebration, fireGrandCelebration } from '../utils/confetti';
import { formatCurrency } from '../utils/pricingCatalog';

interface Props {
  weekStart: string; // YYYY-MM-DD Monday
  goals: WeeklyGoal[];
  defaultCollapsed?: boolean;
  onAddGoal: (title: string, category?: 'ventas' | 'produccion' | 'organizacion' | 'general') => void;
  onToggleGoal: (id: string) => void;
  onUpdateGoal: (id: string, updates: Partial<WeeklyGoal>) => void;
  onDeleteGoal: (id: string) => void;
  onViewAll?: () => void;
}

const CATEGORY_OPTIONS: Array<{ id: 'ventas' | 'produccion' | 'organizacion' | 'general'; label: string }> = [
  { id: 'ventas', label: 'Ventas' },
  { id: 'produccion', label: 'Producción' },
  { id: 'organizacion', label: 'Operaciones' },
  { id: 'general', label: 'General' },
];

export const WeeklyGoalsWidget: React.FC<Props> = ({
  weekStart,
  goals,
  defaultCollapsed = false,
  onAddGoal,
  onToggleGoal,
  onUpdateGoal,
  onDeleteGoal,
  onViewAll,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
  const [inputTitle, setInputTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ventas' | 'produccion' | 'organizacion' | 'general'>('general');
  const [targetType, setTargetType] = useState<GoalTargetType>('boolean');
  const [targetValInput, setTargetValInput] = useState<string>('10');
  const [currentValInput, setCurrentValInput] = useState<string>('0');
  const [unitInput, setUnitInput] = useState<string>('');
  const [statusInput, setStatusInput] = useState<GoalStatus>('al_dia');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState<{ [goalId: string]: string }>({});

  // Goals for this active week
  const weekGoals = goals.filter(g => g.weekStart === weekStart);
  const totalCount = weekGoals.length;
  
  // Calculate completion including quantitative progress
  const completedCount = weekGoals.filter(g => {
    if (g.completed) return true;
    if (g.targetType === 'numeric' || g.targetType === 'currency') {
      return (g.currentValue || 0) >= (g.targetValue || 1);
    }
    if (g.targetType === 'tasks' && g.subtasks && g.subtasks.length > 0) {
      return g.subtasks.every(s => s.completed);
    }
    return false;
  }).length;

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllDone = totalCount > 0 && completedCount === totalCount;

  const handleCreate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputTitle.trim();
    if (!clean) return;

    hapticFeedback.light();
    
    if (targetType === 'boolean') {
      onAddGoal(clean, selectedCategory);
    } else {
      // Create quantitative goal
      const numTarget = Number(targetValInput) || 1;
      const numCurrent = Number(currentValInput) || 0;
      const initialSubtasks = targetType === 'tasks' ? [
        { id: `st_${Date.now()}_1`, title: 'Paso 1: Inicio', completed: false },
        { id: `st_${Date.now()}_2`, title: 'Paso 2: Ejecución', completed: false }
      ] : undefined;

      const newGoalData: Partial<WeeklyGoal> = {
        title: clean,
        weekStart,
        completed: false,
        category: selectedCategory,
        targetType,
        targetValue: numTarget,
        currentValue: numCurrent,
        unit: unitInput.trim() || (targetType === 'currency' ? 'ARS' : undefined),
        status: statusInput,
        subtasks: initialSubtasks
      };

      // Call onAddGoal with basic signature and then update or create
      onAddGoal(clean, selectedCategory);
      // Update the last added goal if needed
      setTimeout(() => {
        const found = weekGoals.find(g => g.title === clean);
        if (found) {
          onUpdateGoal(found.id, newGoalData);
        }
      }, 100);
    }

    setInputTitle('');
    setShowAdvancedAdd(false);
  };

  const handleStartEdit = (goal: WeeklyGoal) => {
    setEditingId(goal.id);
    setEditTitle(goal.title);
  };

  const handleSaveEdit = (id: string) => {
    const clean = editTitle.trim();
    if (clean) {
      onUpdateGoal(id, { title: clean });
    }
    setEditingId(null);
  };

  const handleToggle = (goal: WeeklyGoal) => {
    hapticFeedback.selection();
    const nextCompleted = !goal.completed;
    if (nextCompleted) {
      playTaskDone();
      if (completedCount + 1 >= totalCount && totalCount > 0) {
        fireGrandCelebration();
      } else {
        fireTaskCelebration(0.5, 0.4);
      }
    }
    onToggleGoal(goal.id);
  };

  const handleAdjustValue = (goal: WeeklyGoal, delta: number) => {
    hapticFeedback.light();
    const curr = goal.currentValue || 0;
    const target = goal.targetValue || 1;
    const nextVal = Math.max(0, curr + delta);
    const completed = nextVal >= target;

    if (completed && !goal.completed) {
      playTaskDone();
      fireTaskCelebration(0.4, 0.4);
    }

    onUpdateGoal(goal.id, {
      currentValue: nextVal,
      completed
    });
  };

  const handleToggleSubtask = (goal: WeeklyGoal, subtaskId: string) => {
    hapticFeedback.selection();
    const subtasks = (goal.subtasks || []).map(st => {
      if (st.id === subtaskId) {
        return { ...st, completed: !st.completed };
      }
      return st;
    });
    const allDone = subtasks.length > 0 && subtasks.every(s => s.completed);
    if (allDone && !goal.completed) {
      playTaskDone();
      fireTaskCelebration(0.4, 0.4);
    }
    onUpdateGoal(goal.id, {
      subtasks,
      completed: allDone
    });
  };

  const handleAddSubtask = (goal: WeeklyGoal) => {
    const text = (newSubtaskText[goal.id] || '').trim();
    if (!text) return;
    hapticFeedback.light();
    const subtasks = [
      ...(goal.subtasks || []),
      { id: `st_${Date.now()}`, title: text, completed: false }
    ];
    onUpdateGoal(goal.id, { subtasks });
    setNewSubtaskText(prev => ({ ...prev, [goal.id]: '' }));
  };

  const getStatusBadge = (status?: GoalStatus) => {
    if (!status) return null;
    switch (status) {
      case 'al_dia':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 font-medium">Al día</span>;
      case 'adelantada':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20 font-medium">Adelantada</span>;
      case 'retrasada':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20 font-medium">Retrasada</span>;
      case 'sin_plazo':
        return <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] font-medium">Sin plazo</span>;
    }
  };

  return (
    <div className="card-swiss p-4 sm:p-5 mb-4 transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset]">
      {/* Widget Header with Icon + Title + Gray Subtitle + Circular Progress Ring */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-[var(--radius-control)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-primary)]">
            <Target className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] font-heading">
                Metas & Objetivos Cuantitativos
              </h3>
              <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                {formatWeekRange(weekStart)}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
              {totalCount === 0
                ? 'Progreso cuantitativo a mediano y largo plazo'
                : isAllDone
                ? 'Todas las metas alcanzadas'
                : `${completedCount} de ${totalCount} cumplidas`}
            </p>
          </div>
        </div>

        {/* Circular Progress Ring + Collapse toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                className="stroke-[var(--border-subtle)] fill-none"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                className="stroke-[#16A34A] fill-none transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                className="stroke-[#16A34A] fill-none transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                strokeWidth="3"
                strokeDasharray="94.2"
                strokeDashoffset={94.2 - (94.2 * progressPercent) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-[9px] font-mono font-bold text-[var(--text-primary)] tabular-nums">
              {progressPercent}%
            </span>
          </div>

          <button
            aria-label={isCollapsed ? "Mostrar metas" : "Ocultar metas"}
            aria-expanded={!isCollapsed}
            onClick={() => {
              hapticFeedback.selection();
              setIsCollapsed(prev => !prev);
            }}
            className="p-1 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4 stroke-[1.5]" /> : <ChevronUp className="w-4 h-4 stroke-[1.5]" />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {!isCollapsed && (
        <div className="mt-4 pt-3.5 border-t border-[var(--border-divider)] space-y-3">
          {/* Add Goal Form */}
          <form onSubmit={handleCreate} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                aria-label="Nueva meta"
                placeholder="Definir meta (ej: Fondo de emergencia, Leer 12 libros, Lanzar el sitio)…"
                className="flex-1 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-control)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition"
              />
              <button
                type="button"
                onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}
                className={`px-2.5 py-1.5 text-xs rounded-[var(--radius-control)] border transition cursor-pointer ${
                  showAdvancedAdd 
                    ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-[var(--solid-contrast-bg)]' 
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Configurar tipo de meta cuantitativa (número, moneda o tareas)"
              >
                <TrendingUp className="w-3.5 h-3.5 stroke-[1.5]" />
              </button>
              <button
                type="submit"
                disabled={!inputTitle.trim()}
                className="btn-solid-primary px-3 py-1.5 text-xs font-medium flex items-center gap-1 shrink-0 disabled:opacity-40 cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2]" />
                <span>Crear</span>
              </button>
            </div>

            {/* Advanced Quantitative Options */}
            {showAdvancedAdd && (
              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="label-swiss text-[10px]">Tipo de medición:</span>
                  {(['boolean', 'numeric', 'currency', 'tasks'] as GoalTargetType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTargetType(t)}
                      className={`px-2 py-0.5 rounded-[var(--radius-pill)] border text-[11px] capitalize transition cursor-pointer ${
                        targetType === t
                          ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-[var(--solid-contrast-bg)] font-semibold'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {t === 'boolean' && 'Simple (Checkbox)'}
                      {t === 'numeric' && 'Numérica (Cantidad)'}
                      {t === 'currency' && 'Financiera (Dinero)'}
                      {t === 'tasks' && 'Lista de Pasos'}
                    </button>
                  ))}
                </div>

                {targetType !== 'boolean' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Valor Objetivo</label>
                      <input
                        type="number"
                        value={targetValInput}
                        onChange={(e) => setTargetValInput(e.target.value)}
                        placeholder="Ej: 15000000 o 12"
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Avance Actual</label>
                      <input
                        type="number"
                        value={currentValInput}
                        onChange={(e) => setCurrentValInput(e.target.value)}
                        placeholder="Ej: 9750000 o 7"
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Unidad / Moneda</label>
                      <input
                        type="text"
                        value={unitInput}
                        onChange={(e) => setUnitInput(e.target.value)}
                        placeholder={targetType === 'currency' ? 'ARS o USD' : 'libros, km…'}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-secondary)] block mb-1">Estado</label>
                      <select
                        value={statusInput}
                        onChange={(e) => setStatusInput(e.target.value as GoalStatus)}
                        className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                      >
                        <option value="al_dia">Al día</option>
                        <option value="adelantada">Adelantada</option>
                        <option value="retrasada">Retrasada</option>
                        <option value="sin_plazo">Sin plazo</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category selection */}
            <div className="flex items-center gap-1.5">
              <span className="label-swiss text-[10px]">Área:</span>
              {CATEGORY_OPTIONS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`text-[10px] px-2 py-0.5 rounded-[var(--radius-pill)] border transition cursor-pointer ${
                    selectedCategory === c.id
                      ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-[var(--solid-contrast-bg)] font-semibold'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </form>

          {/* List of Goals */}
          <div className="space-y-2 pt-1">
            {weekGoals.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)] py-3 text-center">
                Sin metas registradas para esta semana.
              </p>
            ) : (
              weekGoals.map(goal => {
                const isNumeric = goal.targetType === 'numeric';
                const isCurrency = goal.targetType === 'currency';
                const isTasks = goal.targetType === 'tasks';
                const isQuantitative = isNumeric || isCurrency || isTasks;

                const currVal = goal.currentValue || 0;
                const tgtVal = goal.targetValue || 1;
                const subtasks = goal.subtasks || [];
                const subtasksDone = subtasks.filter(s => s.completed).length;

                const percent = isTasks
                  ? (subtasks.length > 0 ? Math.round((subtasksDone / subtasks.length) * 100) : 0)
                  : (tgtVal > 0 ? Math.min(100, Math.round((currVal / tgtVal) * 100)) : 0);

                return (
                  <div
                    key={goal.id}
                    className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] hover:border-[var(--text-tertiary)] transition group space-y-2.5"
                  >
                    {editingId === goal.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-primary)] rounded"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(goal.id)}
                          className="p-1 text-[#16A34A] hover:bg-[#16A34A]/10 rounded"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-muted)] rounded"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Top row: Checkbox or Target + Title + Status + Actions */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            {/* Checkbox button */}
                            <button
                              type="button"
                              onClick={() => handleToggle(goal)}
                              className="mt-0.5 shrink-0 cursor-pointer"
                            >
                              <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition ${
                                goal.completed 
                                  ? 'bg-[var(--solid-contrast-bg)] border-[var(--solid-contrast-bg)]' 
                                  : 'border-[var(--border-subtle)] group-hover:border-[var(--text-primary)]'
                              }`}>
                                {goal.completed && (
                                  <Check className="w-3 h-3 text-[var(--solid-contrast-text)] stroke-[3]" />
                                )}
                              </div>
                            </button>

                            {/* Title & Category */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-semibold ${
                                  goal.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'
                                }`}>
                                  {goal.title}
                                </span>
                                {getStatusBadge(goal.status)}
                                {goal.category && (
                                  <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded text-[var(--text-tertiary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                                    {goal.category}
                                  </span>
                                )}
                              </div>

                              {/* Quantitative Metric Display */}
                              {isQuantitative && (
                                <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)] tabular-nums">
                                  <span>
                                    {isCurrency && (
                                      `${formatCurrency(currVal, (goal.unit as any) || 'ARS')} / ${formatCurrency(tgtVal, (goal.unit as any) || 'ARS')}`
                                    )}
                                    {isNumeric && (
                                      `${currVal} / ${tgtVal} ${goal.unit || ''}`
                                    )}
                                    {isTasks && (
                                      `${subtasksDone} / ${subtasks.length} Tareas`
                                    )}
                                  </span>
                                  <span className="font-semibold text-[var(--text-primary)]">
                                    {percent}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick Adjust & Controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isNumeric && !goal.completed && (
                              <div className="flex items-center gap-1 border border-[var(--border-subtle)] rounded px-1 py-0.5 bg-[var(--bg-surface)]">
                                <button
                                  type="button"
                                  onClick={() => handleAdjustValue(goal, -1)}
                                  className="px-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[10px] font-bold"
                                  title="Restar 1"
                                >
                                  -1
                                </button>
                                <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] tabular-nums">{currVal}</span>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustValue(goal, 1)}
                                  className="px-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[10px] font-bold"
                                  title="Sumar 1"
                                >
                                  +1
                                </button>
                              </div>
                            )}

                            {isCurrency && !goal.completed && (
                              <button
                                type="button"
                                onClick={() => {
                                  const promptVal = prompt('Actualizar avance acumulado ($):', String(currVal));
                                  if (promptVal !== null) {
                                    const val = Number(promptVal);
                                    if (!isNaN(val)) {
                                      handleAdjustValue(goal, val - currVal);
                                    }
                                  }
                                }}
                                className="px-1.5 py-0.5 text-[10px] rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-mono"
                                title="Editar monto acumulado"
                              >
                                Editar $
                              </button>
                            )}

                            <button
                              onClick={() => handleStartEdit(goal)}
                              className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                              title="Editar título"
                            >
                              <Edit3 className="w-3 h-3 stroke-[1.5]" />
                            </button>
                            <button
                              onClick={() => {
                                hapticFeedback.medium();
                                onDeleteGoal(goal.id);
                              }}
                              className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-[#DC2626] transition cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3 h-3 stroke-[1.5]" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar for Quantitative goals */}
                        {isQuantitative && (
                          <div className="w-full h-1.5 bg-[var(--bg-surface-muted)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
                            <div
                              className="h-full bg-[#16A34A] rounded-full transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        )}

                        {/* Subtasks Checklist for 'tasks' goals */}
                        {isTasks && (
                          <div className="pt-1.5 pl-6 space-y-1.5 border-t border-[var(--border-divider)]">
                            {subtasks.map(st => (
                              <div key={st.id} className="flex items-center gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubtask(goal, st.id)}
                                  className="w-3.5 h-3.5 rounded-[3px] border border-[var(--border-subtle)] flex items-center justify-center shrink-0"
                                >
                                  {st.completed && <Check className="w-2.5 h-2.5 text-[#16A34A] stroke-[3]" />}
                                </button>
                                <span className={st.completed ? 'line-through text-[var(--text-tertiary)] text-[11px]' : 'text-[var(--text-primary)] text-[11px]'}>
                                  {st.title}
                                </span>
                              </div>
                            ))}

                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                value={newSubtaskText[goal.id] || ''}
                                onChange={(e) => setNewSubtaskText(prev => ({ ...prev, [goal.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubtask(goal);
                                  }
                                }}
                                placeholder="Nuevo hito (ej: Subir contenido)…"
                                className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-2 py-0.5 text-[11px] text-[var(--text-primary)]"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddSubtask(goal)}
                                className="px-2 py-0.5 text-[10px] rounded bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
                              >
                                Añadir
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Link "Ver todo →" */}
          {onViewAll && (
            <div className="pt-2 text-right">
              <button
                onClick={onViewAll}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium inline-flex items-center gap-1 transition"
              >
                <span>Ver todo</span>
                <ArrowRight className="w-3 h-3 stroke-[1.5]" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
