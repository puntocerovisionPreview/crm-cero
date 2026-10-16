import React from 'react';
import { Keyboard, X, Sparkles, Command } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Navegación Global (5 Secciones Principales)',
      shortcuts: [
        { key: '1', desc: 'Ir a Hoy (Agenda, Tareas y Métricas del día)' },
        { key: '2', desc: 'Ir a Clientes (Fichas, Proyectos y Pipeline)' },
        { key: '3', desc: 'Ir a Dinero (Flujo, Cobros, Gastos Fijos)' },
        { key: '4', desc: 'Ir a Cerebro (Notas, Grafo y Conocimiento)' },
        { key: '5', desc: 'Ir a Ajustes y Preferencias' },
        { key: 'C', desc: 'Abrir Calendario 360°' },
        { key: 'H', desc: 'Abrir Horizonte (3 meses, Capacidad y Proyección)' },
        { key: 'F', desc: 'Abrir Modo Foco (Pantalla completa)' },
        { key: 'G', desc: 'Abrir Grafo de Conocimiento' },
        { key: 'N', desc: 'Ir a Notas & Documentación' },
      ],
    },
    {
      title: 'Herramientas & Asistente',
      shortcuts: [
        { key: '⌘K / Ctrl+K', desc: 'Paleta de comandos y búsqueda global' },
        { key: '⌘J / Ctrl+J', desc: 'Copiloto Gemini asistencial' },
        { key: '?', desc: 'Ver esta ayuda de atajos' },
        { key: 'Esc', desc: 'Cerrar ventanas y modales activos' },
        { key: 'M', desc: 'Silenciar / Activar audio feedback' },
      ],
    },
    {
      title: 'Creación Rápida (+)',
      shortcuts: [
        { key: 'T', desc: 'Crear nueva Tarea en el día de hoy' },
        { key: 'R', desc: 'Crear nueva Reunión' },
        { key: 'P', desc: 'Crear nuevo Proyecto' },
      ],
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-5 animate-in zoom-in-95 duration-150 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[var(--accent)]">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Atajos de Teclado Desktop</h3>
              <p className="text-[11px] text-zinc-400">Trabajá con velocidad profesional en .Cero CRM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
          {shortcutGroups.map(group => (
            <div key={group.title} className="space-y-2">
              <h4 className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-wider">
                {group.title}
              </h4>
              <div className="bg-zinc-950/80 rounded-xl border border-zinc-800/80 divide-y divide-zinc-800/40">
                {group.shortcuts.map(sc => (
                  <div key={sc.key} className="flex items-center justify-between px-3.5 py-2 text-xs">
                    <span className="text-zinc-300 font-medium">{sc.desc}</span>
                    <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-zinc-900 text-zinc-200 rounded-md border border-zinc-700/80 shadow-xs">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Presioná <kbd className="px-1.5 py-0.2 bg-zinc-800 rounded font-mono text-zinc-400">Esc</kbd> para cerrar</span>
          <span className="text-[var(--accent)] font-semibold">Productividad Desktop</span>
        </div>
      </div>
    </div>
  );
};
