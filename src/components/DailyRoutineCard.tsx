import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Flame, Pencil, Plus, Trash2, ArrowUp, ArrowDown, Repeat } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { playTaskDone } from '../utils/sound';
import { fireTaskCelebration } from '../utils/confetti';
import { todayLocal, parseLocalDate } from '../utils/dates';
import {
  RoutineItem,
  RoutineLog,
  WEEKDAY_SHORT,
  WEEKDAY_NAMES,
  appliesOn,
  computeStreak,
  deleteRoutineItem,
  saveRoutineItem,
  setRoutineDone,
  subscribeRoutineItems,
  subscribeRoutineLogs,
} from '../utils/dailyRoutine';

const SUGGESTIONS = [
  'Bloque de prospección (30 min)',
  'Revisar cobros y vencimientos de hoy',
  'Responder WhatsApp de clientes',
  'Planificar las 3 tareas clave del día',
  'Publicar o programar contenido',
  'Revisar avances de alumnos PAF',
];

// Rutina diaria: lo primero que se hace cada día. Se tilda y al día siguiente arranca de cero.
export const DailyRoutineCard: React.FC = () => {
  const [items, setItems] = useState<RoutineItem[] | null>(null);
  const [logs, setLogs] = useState<Record<string, RoutineLog>>({});
  const [today, setToday] = useState(todayLocal());
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Copia siempre actualizada (también entre dos toques en el mismo instante)
  const itemsRef = useRef<RoutineItem[]>([]);
  useEffect(
    () =>
      subscribeRoutineItems((list) => {
        itemsRef.current = list;
        setItems(list);
      }),
    []
  );
  useEffect(() => subscribeRoutineLogs(setLogs), []);

  // A la medianoche la rutina vuelve a empezar
  useEffect(() => {
    const id = setInterval(() => setToday(todayLocal()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const allItems = items || [];
  const todayItems = useMemo(() => allItems.filter((i) => appliesOn(i, today)), [allItems, today]);
  const todayLog = logs[today];
  const doneCount = todayItems.filter((i) => todayLog?.done?.[i.id]).length;
  const complete = todayItems.length > 0 && doneCount === todayItems.length;
  const streak = useMemo(() => computeStreak(allItems, logs, today), [allItems, logs, today]);
  const weekdayName = WEEKDAY_NAMES[parseLocalDate(today).getDay()];

  // Al completar la rutina se pliega sola; se puede volver a abrir
  useEffect(() => {
    if (complete) setCollapsed(true);
  }, [complete]);

  const toggle = (item: RoutineItem) => {
    const willBeDone = !todayLog?.done?.[item.id];
    hapticFeedback.medium();
    if (willBeDone) {
      playTaskDone();
      if (doneCount + 1 === todayItems.length) fireTaskCelebration(0.5, 0.3);
    }
    // Reflejo inmediato; Firestore confirma después
    setLogs((prev) => {
      const done = { ...(prev[today]?.done || {}) };
      if (willBeDone) done[item.id] = new Date().toISOString();
      else delete done[item.id];
      return { ...prev, [today]: { date: today, done } };
    });
    setRoutineDone(today, item.id, willBeDone).catch((err) => console.warn(err));
  };

  const addItem = (title: string) => {
    const clean = title.trim();
    if (!clean) return;
    hapticFeedback.light();
    const maxOrder = allItems.reduce((m, i) => Math.max(m, i.order ?? 0), 0);
    persist({
      id: `rut_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: clean,
      order: maxOrder + 1,
      createdAt: today,
    });
    setNewTitle('');
  };

  // Actualiza la pantalla al instante y después guarda: si se tocan varios botones
  // seguidos, cada cambio parte del estado ya actualizado y no pisa al anterior
  const persist = (item: RoutineItem) => {
    const list = itemsRef.current;
    const exists = list.some((i) => i.id === item.id);
    const next = (exists ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    itemsRef.current = next;
    setItems(next);
    saveRoutineItem(item).catch((err) => console.warn(err));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const list = itemsRef.current;
    const target = list[idx + dir];
    const current = list[idx];
    if (!target || !current) return;
    persist({ ...current, order: target.order });
    persist({ ...target, order: current.order });
  };

  const toggleWeekday = (staleItem: RoutineItem, day: number) => {
    const item = itemsRef.current.find((i) => i.id === staleItem.id) || staleItem;
    const base = item.weekdays && item.weekdays.length > 0 ? item.weekdays : [0, 1, 2, 3, 4, 5, 6];
    const next = base.includes(day) ? base.filter((d) => d !== day) : [...base, day].sort();
    if (next.length === 0) return; // al menos un día
    persist({ ...item, weekdays: next.length === 7 ? [] : next });
  };

  if (items === null) return null;

  const addForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addItem(newTitle);
      }}
      className="flex items-center gap-2"
    >
      <input
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        placeholder="Ej: Revisar mails y WhatsApp"
        className="flex-1 min-w-0 px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
        aria-label="Nuevo hábito diario"
      />
      <button
        type="submit"
        disabled={!newTitle.trim()}
        className="px-3 py-2 rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--on-accent)] text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 shrink-0"
      >
        <Plus className="w-4 h-4" />
        Agregar
      </button>
    </form>
  );

  // Sin hábitos: invitación a armar la rutina
  if (allItems.length === 0) {
    return (
      <section className="mb-4 rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Repeat className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Armá tu rutina diaria</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Lo que hacés todos los días antes de arrancar. Aparece primero en Hoy y se reinicia cada mañana.
            </p>
          </div>
        </div>
        {addForm}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addItem(s)}
              className="px-2.5 py-1 rounded-full border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition"
            >
              + {s}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`mb-4 rounded-[var(--radius-card)] border bg-[var(--bg-surface)] overflow-hidden transition-colors ${
        complete ? 'border-[var(--border-subtle)]' : 'border-[var(--accent)]/40'
      }`}
      aria-label="Rutina diaria"
    >
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
        <Repeat className={`w-5 h-5 shrink-0 ${complete ? 'text-emerald-400' : 'text-[var(--accent)]'}`} />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {complete ? 'Rutina completa' : 'Primero, tu rutina'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] tabular-nums">
            {todayItems.length === 0
              ? `Hoy ${weekdayName} no tenés hábitos programados.`
              : `${doneCount} de ${todayItems.length} hechos`}
          </p>
        </div>
        {streak > 0 && (
          <span
            className="flex items-center gap-1 text-xs font-semibold text-amber-400 tabular-nums shrink-0"
            title="Días seguidos con la rutina completa"
          >
            <Flame className="w-4 h-4" />
            {streak} {streak === 1 ? 'día' : 'días'}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setEditing((v) => !v);
            setCollapsed(false);
          }}
          className={`p-2 rounded-[var(--radius-control)] transition ${
            editing ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
          }`}
          title={editing ? 'Terminar de editar' : 'Editar rutina'}
          aria-pressed={editing}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="p-2 rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition"
          title={collapsed ? 'Mostrar rutina' : 'Ocultar rutina'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && todayItems.length > 0 && !editing && (
        <div className="h-1 bg-[var(--bg-surface-muted)]">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${Math.round((doneCount / todayItems.length) * 100)}%` }}
          />
        </div>
      )}

      {!collapsed && !editing && todayItems.length > 0 && (
        <ul className="px-2 sm:px-3 py-2">
          {todayItems.map((item) => {
            const done = Boolean(todayLog?.done?.[item.id]);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-[var(--radius-control)] hover:bg-[var(--bg-surface-muted)] transition text-left group"
                  aria-pressed={done}
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                      done
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-[var(--text-tertiary)] group-hover:border-[var(--accent)]'
                    }`}
                  >
                    {done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </span>
                  <span
                    className={`text-sm font-medium flex-1 ${
                      done ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {item.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!collapsed && editing && (
        <div className="px-4 sm:px-5 pb-4 pt-1 space-y-3 border-t border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-secondary)] pt-3">
            Tocá los días para elegir cuándo aplica cada hábito.
          </p>
          <ul className="space-y-2">
            {allItems.map((item, idx) => {
              const days = item.weekdays && item.weekdays.length > 0 ? item.weekdays : [0, 1, 2, 3, 4, 5, 6];
              return (
                <li
                  key={item.id}
                  className="p-2.5 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={item.title}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== item.title) persist({ ...item, title: v });
                      }}
                      className="flex-1 min-w-0 bg-transparent text-sm font-medium text-[var(--text-primary)] focus:outline-none border-b border-transparent focus:border-[var(--accent)] py-1"
                      aria-label="Nombre del hábito"
                    />
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-30" title="Subir">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === allItems.length - 1} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-30" title="Bajar">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        hapticFeedback.medium();
                        itemsRef.current = itemsRef.current.filter((i) => i.id !== item.id);
                        setItems(itemsRef.current);
                        deleteRoutineItem(item.id).catch((err) => console.warn(err));
                      }}
                      className="p-1.5 text-[var(--text-tertiary)] hover:text-red-400"
                      title="Eliminar hábito"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-1" role="group" aria-label="Días en que aplica">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                      const on = days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleWeekday(item, d)}
                          className={`w-8 h-8 rounded-full text-xs font-semibold transition ${
                            on
                              ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                              : 'bg-[var(--bg-surface-muted)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                          }`}
                          aria-pressed={on}
                          title={WEEKDAY_NAMES[d]}
                        >
                          {WEEKDAY_SHORT[d]}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
          {addForm}
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="w-full py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
          >
            Listo
          </button>
        </div>
      )}
    </section>
  );
};
