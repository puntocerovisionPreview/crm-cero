import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Command, 
  Calendar, 
  CheckSquare, 
  FolderKanban, 
  DollarSign, 
  Plus, 
  Sun, 
  Moon, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Download, 
  ArrowRight, 
  Clock, 
  Check, 
  X,
  Phone,
  Sparkles,
  Lock,
  Globe,
  GraduationCap,
  Network,
  FileText,
  Link2,
  Smartphone,
  Wallet,
  TrendingDown,
  Compass
} from 'lucide-react';
import { AgendaTask, AgendaMeeting, Project, IncomeRecord, ExpenseRecord, ViewTab, SecondBrainNote } from '../types';
import { hapticFeedback } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  notes?: SecondBrainNote[];
  onSelectTab: (tab: ViewTab) => void;
  onOpenQuickAdd: (type: 'tarea' | 'reunion' | 'proyecto' | 'ingreso' | 'gasto') => void;
  onToggleTask: (id: string) => void;
  onToggleMeeting: (id: string) => void;
  onOpenProject360?: (project: Project) => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  privacyMode?: boolean;
  onTogglePrivacy?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onExportCSV?: () => void;
  onLockSession?: () => void;
  onOpenGeminiChat?: () => void;
  onOpenRepairTaskLinks?: () => void;
  onOpenIosWidgets?: () => void;
  onNavigate?: (path: string) => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Acciones Rápidas' | 'Navegación' | 'Proyectos' | 'Tareas' | 'Reuniones' | 'Finanzas' | 'Notas';
  icon: React.ReactNode;
  badge?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<Props> = ({
  isOpen,
  onClose,
  tasks,
  meetings,
  projects,
  incomes,
  expenses,
  notes = [],
  onSelectTab,
  onOpenQuickAdd,
  onToggleTask,
  onToggleMeeting,
  onOpenProject360,
  theme,
  onToggleTheme,
  privacyMode,
  onTogglePrivacy,
  soundEnabled,
  onToggleSound,
  onExportCSV,
  onLockSession,
  onOpenGeminiChat,
  onOpenRepairTaskLinks,
  onOpenIosWidgets,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const items: CommandItem[] = [];

    // --- ACCIONES RÁPIDAS ---
    if (onOpenGeminiChat) {
      items.push({
        id: 'action-open-gemini',
        title: 'Copiloto Gemini (IA)',
        subtitle: 'Asistente interactivo: anota tareas, agenda reuniones, registra cobros o responde dudas',
        category: 'Acciones Rápidas',
        icon: <Sparkles className="w-4 h-4 text-amber-400" />,
        badge: '⌘J',
        action: () => {
          onClose();
          onOpenGeminiChat();
        },
      });
    }

    items.push({
      id: 'action-new-task',
      title: 'Nueva Tarea',
      subtitle: 'Crear tarea en la agenda diaria',
      category: 'Acciones Rápidas',
      icon: <CheckSquare className="w-4 h-4 text-[var(--accent)]" />,
      badge: 'T',
      action: () => {
        onClose();
        onOpenQuickAdd('tarea');
      },
    });

    items.push({
      id: 'action-new-meeting',
      title: 'Nueva Reunión',
      subtitle: 'Agendar cita con cliente o equipo',
      category: 'Acciones Rápidas',
      icon: <Calendar className="w-4 h-4 text-amber-400" />,
      badge: 'R',
      action: () => {
        onClose();
        onOpenQuickAdd('reunion');
      },
    });

    items.push({
      id: 'action-new-project',
      title: 'Nuevo Proyecto',
      subtitle: 'Registrar nuevo cliente en cartera',
      category: 'Acciones Rápidas',
      icon: <FolderKanban className="w-4 h-4 text-blue-400" />,
      badge: 'P',
      action: () => {
        onClose();
        onOpenQuickAdd('proyecto');
      },
    });

    items.push({
      id: 'action-new-income',
      title: 'Nuevo Ingreso / Cobro',
      subtitle: 'Registrar pago cobrado o pendiente en USD o ARS',
      category: 'Acciones Rápidas',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      badge: 'I',
      action: () => {
        onClose();
        onOpenQuickAdd('ingreso');
      },
    });

    if (onOpenRepairTaskLinks) {
      items.push({
        id: 'action-repair-links',
        title: 'Reparar vínculos tarea-proyecto',
        subtitle: 'Sincronizar projectId y projectName en lote de forma idempotente',
        category: 'Acciones Rápidas',
        icon: <Link2 className="w-4 h-4 text-[var(--accent)]" />,
        action: () => {
          onClose();
          onOpenRepairTaskLinks();
        },
      });
    }

    if (onOpenIosWidgets) {
      items.push({
        id: 'action-ios-widgets',
        title: 'Widgets para iPhone & iOS',
        subtitle: 'Configurar widgets en pantalla de inicio, atajos y Scriptable para iPhone 11 Pro',
        category: 'Acciones Rápidas',
        icon: <Smartphone className="w-4 h-4 text-emerald-400" />,
        action: () => {
          onClose();
          onOpenIosWidgets();
        },
      });
    }

    items.push({
      id: 'action-new-movement',
      title: 'Nuevo Movimiento (Cobro / Ingreso de Estudio)',
      subtitle: 'Registrar cobro, ingreso libre o movimiento financiero en el estudio',
      category: 'Acciones Rápidas',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onClose();
        if (onOpenQuickAdd) onOpenQuickAdd('ingreso');
      },
    });

    items.push({
      id: 'action-new-personal-expense',
      title: 'Nuevo gasto personal',
      subtitle: 'Cargar gasto personal rápido en menos de 5 segundos',
      category: 'Acciones Rápidas',
      icon: <TrendingDown className="w-4 h-4 text-rose-400" />,
      badge: 'G',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/mis-finanzas/nuevo?tipo=gasto');
      },
    });

    items.push({
      id: 'action-new-personal-income',
      title: 'Nuevo ingreso',
      subtitle: 'Registrar ingreso personal en mi cuenta',
      category: 'Acciones Rápidas',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/mis-finanzas/nuevo?tipo=ingreso');
      },
    });

    // --- NAVEGACIÓN Y CONFIGURACIÓN ---
    items.push({
      id: 'nav-mis-finanzas',
      title: 'Ir a Mis finanzas',
      subtitle: 'Módulo personal: patrimonio, presupuestos, metas y estudio',
      category: 'Navegación',
      icon: <Wallet className="w-4 h-4 text-emerald-400" />,
      badge: '$',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/mis-finanzas');
      },
    });

    items.push({
      id: 'nav-foco',
      title: 'Abrir Modo Foco',
      subtitle: 'Pantalla completa sin distracciones con temporizador pomodoro y subtareas',
      category: 'Navegación',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
      badge: 'F',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/foco');
      },
    });

    items.push({
      id: 'nav-horizonte',
      title: 'Ir a Horizonte (Largo Plazo & Ocupación)',
      subtitle: 'Línea de tiempo de proyectos, cronograma Gantt, capacidad mensual y balance de frentes (horozon, horizon, gantt)',
      category: 'Navegación',
      icon: <Compass className="w-4 h-4 text-sky-400" />,
      badge: 'H',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/horizonte');
      },
    });

    items.push({
      id: 'nav-agenda',
      title: 'Ir a Agenda',
      subtitle: 'Planificador semanal y tareas diarias',
      category: 'Navegación',
      icon: <Calendar className="w-4 h-4 text-[var(--accent)]" />,
      badge: '1',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/agenda');
        else onSelectTab('agenda');
      },
    });

    items.push({
      id: 'nav-web',
      title: 'Ir a Desarrollo Web',
      subtitle: 'Sitios web, landing pages y aplicaciones',
      category: 'Navegación',
      icon: <Globe className="w-4 h-4 text-blue-400" />,
      badge: '2',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/clientes/web');
        else onSelectTab('web');
      },
    });

    items.push({
      id: 'nav-paf',
      title: 'Ir a Método PAF & Retainers',
      subtitle: 'Acompañamiento, consultoría y servicios recurrentes',
      category: 'Navegación',
      icon: <GraduationCap className="w-4 h-4 text-amber-400" />,
      badge: '3',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/clientes/paf');
        else onSelectTab('paf');
      },
    });

    items.push({
      id: 'nav-finances',
      title: 'Ir a Dinero & Finanzas',
      subtitle: 'Control de caja, movimientos de estudio y finanzas personales (dinero, finanzas, movimientos, ingresos)',
      category: 'Navegación',
      icon: <DollarSign className="w-4 h-4 text-emerald-400" />,
      badge: '3',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/dinero');
        else onSelectTab('ingresos');
      },
    });

    items.push({
      id: 'nav-grafo',
      title: 'Ir al Grafo de Conocimiento',
      subtitle: 'Simulación visual de red con nodos y enlaces interactivos',
      category: 'Navegación',
      icon: <Network className="w-4 h-4 text-[#16A34A]" />,
      badge: 'G',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/grafo');
      },
    });

    items.push({
      id: 'nav-notas',
      title: 'Ir a Notas',
      subtitle: 'Editor de notas conectadas con backlinks [[...]]',
      category: 'Navegación',
      icon: <FileText className="w-4 h-4 text-zinc-400" />,
      badge: 'N',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/notas');
      },
    });

    items.push({
      id: 'nav-brain',
      title: 'Ir a Segundo Cerebro',
      subtitle: 'Notas conectadas y vista dividida',
      category: 'Navegación',
      icon: <Network className="w-4 h-4 text-purple-400" />,
      badge: '5',
      action: () => {
        onClose();
        if (onNavigate) onNavigate('/segundo-cerebro');
      },
    });

    items.push({
      id: 'action-theme',
      title: theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
      subtitle: 'Alternar tema de interfaz',
      category: 'Navegación',
      icon: theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />,
      action: () => {
        onToggleTheme();
        onClose();
      },
    });

    items.push({
      id: 'action-privacy',
      title: privacyMode ? 'Desactivar Modo Privacidad' : 'Activar Modo Privacidad ($ •••••)',
      subtitle: 'Ocultar o revelar montos numéricos',
      category: 'Navegación',
      icon: privacyMode ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-zinc-400" />,
      action: () => {
        onTogglePrivacy();
        onClose();
      },
    });

    items.push({
      id: 'action-sound',
      title: soundEnabled ? 'Silenciar Sonidos' : 'Activar Sonidos de Interfaz',
      subtitle: 'Efectos sonoros en check, clicks y creación',
      category: 'Navegación',
      icon: soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-400" />,
      badge: 'M',
      action: () => {
        onToggleSound();
        onClose();
      },
    });

    items.push({
      id: 'action-export-csv',
      title: 'Exportar Planilla CSV',
      subtitle: 'Descargar resumen completo compatible con Excel',
      category: 'Navegación',
      icon: <Download className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onExportCSV();
        onClose();
      },
    });

    items.push({
      id: 'action-lock',
      title: 'Bloquear Sesión',
      subtitle: 'Cerrar acceso seguro con contraseña 0720',
      category: 'Navegación',
      icon: <Lock className="w-4 h-4 text-red-400" />,
      action: () => {
        onLockSession();
        onClose();
      },
    });

    // --- NOTAS (Búsqueda en vivo y apertura directa) ---
    notes.forEach(n => {
      items.push({
        id: `note-${n.id}`,
        title: n.title,
        subtitle: `Nota · ${n.folder ? `Carpeta: ${n.folder} · ` : ''}${n.tags && n.tags.length > 0 ? n.tags.map(t => '#' + t).join(' ') : (n.content.slice(0, 45) + '...')}`,
        category: 'Notas',
        icon: <FileText className="w-4 h-4 text-purple-400" />,
        badge: n.folder || 'Nota',
        action: () => {
          onClose();
          if (onNavigate) onNavigate(`/notas?id=${n.id}`);
        },
      });

      items.push({
        id: `graph-note-${n.id}`,
        title: `Abrir grafo de: ${n.title}`,
        subtitle: `Centrar red y simulación física en esta nota`,
        category: 'Notas',
        icon: <Network className="w-4 h-4 text-[#16A34A]" />,
        badge: 'Grafo',
        action: () => {
          onClose();
          if (onNavigate) onNavigate(`/grafo?id=${n.id}`);
        },
      });
    });

    // --- PROYECTOS (Búsqueda en vivo y grafo) ---
    projects.forEach(p => {
      items.push({
        id: `proj-${p.id}`,
        title: p.clientName,
        subtitle: `Proyecto · Estado: ${p.status} ${p.notes ? `· ${p.notes}` : ''}`,
        category: 'Proyectos',
        icon: <FolderKanban className="w-4 h-4 text-sky-400" />,
        badge: p.status,
        action: () => {
          onClose();
          if (onNavigate) {
            onNavigate(`/clientes/${p.id}`);
          } else if (onOpenProject360) {
            onOpenProject360(p);
          } else {
            onSelectTab('proyectos');
          }
        },
      });

      items.push({
        id: `graph-proj-${p.id}`,
        title: `Abrir grafo de: ${p.clientName}`,
        subtitle: `Ver relaciones y dependencias del proyecto en el grafo`,
        category: 'Proyectos',
        icon: <Network className="w-4 h-4 text-[#16A34A]" />,
        badge: 'Grafo',
        action: () => {
          onClose();
          if (onNavigate) onNavigate(`/grafo?id=${p.id}`);
        },
      });
    });

    // --- TAREAS PENDIENTES Y RECIENTES ---
    tasks.slice(0, 30).forEach(t => {
      items.push({
        id: `task-${t.id}`,
        title: t.title,
        subtitle: `${t.completed ? 'Completada' : 'Pendiente'} · ${t.date || 'Sin fecha'} ${t.time ? `· ${t.time} hs` : ''} ${t.projectName ? `· ${t.projectName}` : ''}`,
        category: 'Tareas',
        icon: <CheckSquare className={`w-4 h-4 ${t.completed ? 'text-emerald-400' : 'text-[var(--accent)]'}`} />,
        badge: t.completed ? 'Hecha' : 'Pendiente',
        action: () => {
          onClose();
          onSelectTab('agenda');
        },
      });
    });

    // --- REUNIONES ---
    meetings.slice(0, 20).forEach(m => {
      items.push({
        id: `meet-${m.id}`,
        title: m.title,
        subtitle: `Reunión · ${m.date || 'Sin fecha'} ${m.time ? `· ${m.time} hs` : ''} ${m.clientPhone ? `· Tel: ${m.clientPhone}` : ''}`,
        category: 'Reuniones',
        icon: <Calendar className="w-4 h-4 text-amber-400" />,
        badge: m.time || 'Cita',
        action: () => {
          onClose();
          onSelectTab('agenda');
        },
      });
    });

    // Filter items based on query
    if (!q) {
      // Return top priority items when query is empty
      return items.filter(i => 
        i.category === 'Acciones Rápidas' || 
        i.category === 'Navegación' ||
        (i.category === 'Proyectos' && items.indexOf(i) < 15)
      );
    }

    return items.filter(item => {
      return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [
    query, 
    tasks, 
    meetings, 
    projects, 
    notes,
    theme, 
    privacyMode, 
    soundEnabled, 
    onClose, 
    onOpenQuickAdd, 
    onSelectTab, 
    onToggleTheme, 
    onTogglePrivacy, 
    onToggleSound, 
    onExportCSV, 
    onLockSession, 
    onOpenProject360
  ]);

  // Adjust selected index when list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [commands.length]);

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < commands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : commands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (commands[selectedIndex]) {
        hapticFeedback.light();
        commands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = document.getElementById(`cmd-item-${selectedIndex}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group commands by category
  const groupedCategories: { [cat: string]: CommandItem[] } = {};
  commands.forEach(cmd => {
    if (!groupedCategories[cmd.category]) {
      groupedCategories[cmd.category] = [];
    }
    groupedCategories[cmd.category].push(cmd);
  });

  let globalIndex = 0;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl card-swiss shadow-md overflow-hidden flex flex-col max-h-[75vh] t-modal-enter"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Bar Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-divider)] bg-[var(--bg-surface)]">
          <Search className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 stroke-[1.5]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar proyectos, clientes, tareas, reuniones o acciones (⌘K)..."
            className="w-full bg-transparent text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 divide-y divide-[var(--border-divider)] no-scrollbar space-y-2 bg-[var(--bg-app)]"
        >
          {commands.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-tertiary)] text-xs">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-40 stroke-[1.5]" />
              <p>No se encontraron resultados para "{query}"</p>
            </div>
          ) : (
            Object.entries(groupedCategories).map(([category, items]) => (
              <div key={category} className="pt-2 first:pt-0">
                <div className="label-swiss px-3 mb-1 text-[10px]">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const currentIndex = globalIndex++;
                    const isSelected = currentIndex === selectedIndex;

                    return (
                      <button
                        key={item.id}
                        id={`cmd-item-${currentIndex}`}
                        onClick={() => {
                          hapticFeedback.light();
                          item.action();
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-control)] text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-xs'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-muted)] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-[var(--radius-control)] shrink-0 ${isSelected ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[var(--text-primary)] truncate flex items-center gap-2">
                              <span>{item.title}</span>
                              {item.badge && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-md font-mono bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-tertiary)]">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <div className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">
                                {item.subtitle}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && (
                            <span className="text-[10px] text-[var(--text-primary)] font-mono flex items-center gap-1">
                              <span>↵</span>
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Keyboard Hints */}
        <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/80 text-[11px] text-zinc-400 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-zinc-800 rounded border border-zinc-700">↑</kbd>
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-zinc-800 rounded border border-zinc-700">↓</kbd>
              <span className="ml-1">Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 font-mono text-[9px] bg-zinc-800 rounded border border-zinc-700">↵</kbd>
              <span className="ml-1">Seleccionar</span>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-zinc-500 font-mono text-[10px]">
            <span>.Cero CRM Desktop</span>
          </div>
        </div>
      </div>
    </div>
  );
};
