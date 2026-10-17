import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  CheckSquare, 
  Building2, 
  Briefcase, 
  Calendar, 
  Target, 
  Plus, 
  Search, 
  Zap 
} from 'lucide-react';
import { LinkCatalogItem, LinkEntityType } from '../lib/links';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  catalog: LinkCatalogItem[];
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  onSelect: (item: LinkCatalogItem) => void;
  onCreateNewNote?: (title: string) => void;
  onClose: () => void;
}

export const WikiLinkAutocomplete: React.FC<Props> = ({
  catalog,
  isOpen,
  query,
  position,
  onSelect,
  onCreateNewNote,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanQuery = query.trim().toLowerCase();

  const filtered = catalog.filter(item => {
    if (!cleanQuery) return true;
    return item.title.toLowerCase().includes(cleanQuery) || 
      (item.subtitle && item.subtitle.toLowerCase().includes(cleanQuery));
  }).slice(0, 8);

  const hasExactMatch = catalog.some(
    item => item.title.trim().toLowerCase() === cleanQuery
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length + (!hasExactMatch && cleanQuery ? 1 : 0)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const total = filtered.length + (!hasExactMatch && cleanQuery ? 1 : 0);
        setSelectedIndex(prev => (prev - 1 + total) % total);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex < filtered.length) {
          onSelect(filtered[selectedIndex]);
        } else if (onCreateNewNote && cleanQuery) {
          onCreateNewNote(query.trim());
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, filtered, selectedIndex, cleanQuery, hasExactMatch, onCreateNewNote, onSelect, onClose, query]);

  if (!isOpen) return null;

  const getIcon = (type: LinkEntityType) => {
    switch (type) {
      case 'nota':
        return <FileText className="w-3.5 h-3.5 text-zinc-400" />;
      case 'tarea':
        return <CheckSquare className="w-3.5 h-3.5 text-[#16A34A]" />;
      case 'proyecto':
        return <Building2 className="w-3.5 h-3.5 text-sky-400" />;
      case 'cliente':
        return <Briefcase className="w-3.5 h-3.5 text-amber-400" />;
      case 'reunion':
        return <Calendar className="w-3.5 h-3.5 text-orange-400" />;
      case 'objetivo':
        return <Target className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Zap className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        top: Math.max(10, position.top),
        left: Math.max(10, Math.min(position.left, window.innerWidth - 300)),
      }}
      className="fixed z-50 w-72 max-w-[90vw] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden p-1 text-xs animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-2.5 py-1.5 border-b border-[var(--border-divider)] text-[10px] text-[var(--text-tertiary)] flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wider">Vincular con [[ ... ]]</span>
        <span>Esc para salir</span>
      </div>

      <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
        {filtered.length === 0 && !cleanQuery ? (
          <div className="px-3 py-2 text-zinc-500 text-center">
            Escribe para buscar notas, tareas, proyectos…
          </div>
        ) : (
          filtered.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  hapticFeedback.light();
                  onSelect(item);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
                }`}
              >
                <div className="shrink-0">{getIcon(item.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate leading-tight">{item.title}</div>
                  {item.subtitle && (
                    <div className={`text-[10px] truncate ${isSelected ? 'opacity-75' : 'text-[var(--text-tertiary)]'}`}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <span className={`text-[9px] uppercase px-1 py-0.2 rounded font-mono ${
                  isSelected ? 'bg-white/20' : 'bg-[var(--bg-app)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                }`}>
                  {item.type}
                </span>
              </button>
            );
          })
        )}

        {/* Option to create a new note with this title if it does not exist */}
        {cleanQuery && !hasExactMatch && onCreateNewNote && (
          <button
            type="button"
            onMouseEnter={() => setSelectedIndex(filtered.length)}
            onClick={() => {
              hapticFeedback.selection();
              onCreateNewNote(query.trim());
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 mt-1 border-t border-[var(--border-divider)] pt-2 transition cursor-pointer ${
              selectedIndex === filtered.length
                ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
            <div className="flex-1 truncate">
              Crear nota <span className="font-bold underline">[[{query.trim()}]]</span>
            </div>
            <span className="text-[9px] font-mono opacity-70">Enter</span>
          </button>
        )}
      </div>
    </div>
  );
};
