import React, { useEffect, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { Project } from '../types';
import { ClientPanel, PanelGoal, newItemId, startNewWeek } from '../panels/model';
import { createPanel, savePanel, subscribePanelOfProject } from '../panels/store';
import { portalGoals } from '../portal/model';
import { publishPortalExtras } from '../portal/store';
import { startOfWeekMonday, todayLocal } from '../utils/dates';

const input = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600';
const WHO: Record<'cero' | 'estudio', string> = { cero: '.CERO', estudio: 'Estudio' };

/**
 * Objetivos de la semana: son los mismos del panel del estudio (portal anterior),
 * con quién hace cada uno. Si el estudio no tiene panel, se crea uno inactivo (sin link).
 * Si el portal está publicado, el estudio los ve en "Esta semana".
 */
export const PafWeekGoals: React.FC<{ project: Project; publishedId?: string }> = ({ project, publishedId }) => {
  const [panel, setPanel] = useState<ClientPanel | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [quien, setQuien] = useState<'cero' | 'estudio'>('estudio');
  const [error, setError] = useState('');

  useEffect(() => subscribePanelOfProject(project.id, setPanel), [project.id]);

  const goals = panel?.goals || [];

  const save = async (next: PanelGoal[], weekStart?: string) => {
    setError('');
    try {
      if (panel) {
        const base = weekStart ? startNewWeek(panel, weekStart) : panel;
        await savePanel({ ...base, goals: weekStart ? base.goals : next });
        if (publishedId) await publishPortalExtras(publishedId, { objetivos: portalGoals(weekStart ? base.goals : next) });
      } else {
        await createPanel(project.clientName, { projectId: project.id, phone: project.clientPhone, active: false, goals: next });
        if (publishedId) await publishPortalExtras(publishedId, { objetivos: portalGoals(next) });
      }
    } catch {
      setError('No se pudo guardar. Revisá la conexión y reintentá.');
    }
  };

  const add = () => {
    if (!text.trim()) return;
    save([...goals, { id: newItemId(), text: text.trim(), done: false, quien }]);
    setText('');
  };

  const newWeek = () => {
    if (!panel || !window.confirm('¿Empezar una semana nueva? Los objetivos cumplidos pasan al historial y los pendientes se mantienen.')) return;
    save(goals, startOfWeekMonday(todayLocal()));
  };

  if (panel === undefined) return null;
  return (
    <div className="space-y-1.5">
      {goals.length > 0 && (
        <ul className="space-y-1">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center gap-2 text-xs">
              <input type="checkbox" aria-label={`Cumplido: ${g.text}`} checked={g.done} onChange={(e) => save(goals.map((x) => (x.id === g.id ? { ...x, done: e.target.checked } : x)))} />
              <span className={`flex-1 min-w-0 ${g.done ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>{g.text}</span>
              <button type="button" title="Cambiar quién lo hace" onClick={() => save(goals.map((x) => (x.id === g.id ? { ...x, quien: x.quien === 'cero' ? 'estudio' : 'cero' } : x)))} className="shrink-0 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">{WHO[g.quien === 'cero' ? 'cero' : 'estudio']}</button>
              <button type="button" aria-label={`Quitar ${g.text}`} onClick={() => save(goals.filter((x) => x.id !== g.id))} className="text-zinc-500 hover:text-rose-300"><X className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-1.5">
        <input className={input} value={text} placeholder="Objetivo de esta semana (2 o 3 alcanzan)" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select aria-label="Quién lo hace" value={quien} onChange={(e) => setQuien(e.target.value as 'cero' | 'estudio')} className="rounded-lg bg-zinc-950 border border-zinc-800 px-1.5 text-xs text-zinc-100">
          <option value="estudio">Estudio</option>
          <option value="cero">.CERO</option>
        </select>
        <button type="button" aria-label="Agregar objetivo" onClick={add} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2 text-zinc-200"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      {panel && goals.length > 0 && (
        <button type="button" onClick={newWeek} className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200"><RotateCcw className="w-3 h-3" />Semana nueva</button>
      )}
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
};
