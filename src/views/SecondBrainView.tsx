import React, { useState, useEffect, useMemo } from 'react';
import { 
  SecondBrainNote, 
  AgendaTask, 
  Project, 
  WeeklyGoal 
} from '../types';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  Network, 
  FileText, 
  Plus, 
  Trash2, 
  Pin, 
  Link2, 
  Check, 
  Search, 
  ArrowUpRight, 
  Maximize2, 
  Calendar,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  BookOpen,
  LayoutTemplate,
  X,
  ArrowLeft
} from 'lucide-react';
import { KnowledgeGraphCanvas } from '../components/KnowledgeGraphCanvas';
import { SecondBrainGuideModal } from '../components/SecondBrainGuideModal';
import { buildLinkCatalog, extractAllAppRelations } from '../lib/links';

interface Props {
  tasks: AgendaTask[];
  projects: Project[];
  weeklyGoals: WeeklyGoal[];
  notes?: SecondBrainNote[];
  onAddNote?: (note: Omit<SecondBrainNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateNote?: (id: string, updates: Partial<SecondBrainNote>) => void;
  onDeleteNote?: (id: string) => void;
  onToggleTask?: (id: string) => void;
  onNavigate?: (path: string) => void;
}

const DEFAULT_NOTES: SecondBrainNote[] = [
  {
    id: 'note_demo_1',
    title: 'Nota diaria: Lunes productivo',
    content: `Empecé temprano y mantuve el foco todo el día. Avancé bastante y aún me sobró energía.

- Estudié 2h de [[Cálculo]]
- Avancé en la meta [[Viaje a Japón]]
- Entreno de fuerza en el gimnasio @tarea
- Mañana repasar entregables de [[Estudio Cane Arquitectura]]`,
    date: getTodayString(),
    tags: ['diario', 'foco'],
    pinned: true,
    linkedEntityTitles: ['Cálculo', 'Viaje a Japón', 'Estudio Cane Arquitectura'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'note_demo_2',
    title: 'Estrategia de Adquisición PAF',
    content: `Definición de pilares para escalado de consultorías de arquitectura.
Conectado con [[Fondo de emergencia]] y la meta de ventas anual.
Revisar propuestas activas con @tarea.`,
    date: getTodayString(),
    tags: ['estrategia', 'ventas'],
    pinned: false,
    linkedEntityTitles: ['Fondo de emergencia'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const SecondBrainView: React.FC<Props> = ({
  tasks,
  projects,
  weeklyGoals,
  notes: propNotes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onToggleTask,
  onNavigate,
}) => {
  const today = getTodayString();

  // Local state fallback if propNotes is not provided
  const [localNotes, setLocalNotes] = useState<SecondBrainNote[]>(() => {
    try {
      const saved = localStorage.getItem('cero_second_brain_notes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_NOTES;
  });

  const notes = propNotes || localNotes;

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    return notes[0]?.id || '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'graph'>('split');
  const [mobileTab, setMobileTab] = useState<'list' | 'editor' | 'graph'>('list');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<SecondBrainNote | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('brief');
  const [templateClientName, setTemplateClientName] = useState('');

  const TEMPLATES = useMemo(() => [
    {
      id: 'brief',
      name: 'Brief de Landing Page',
      desc: 'Propuesta de valor, secciones clave, objeciones y métricas de conversión',
      icon: LayoutTemplate,
      build: (client: string) => {
        const target = client.trim() ? `[[${client.trim()}]]` : '[[Cliente]]';
        return {
          title: `Brief Landing · ${client.trim() || 'Proyecto'}`,
          content: `### Brief de Landing Page · ${target}
**Fecha:** ${today}
**Objetivo principal:** Maximizar tasa de conversión de tráfico cualificado

#### 1. Propuesta de Valor & Ángulo Único
- **Titular Principal (H1):** 
- **Subtítulo:** 
- **Beneficio #1:** 
- **Beneficio #2:** 
- **Beneficio #3:** 

#### 2. Estructura de Secciones
- [ ] Hero Section con formulario arriba del pliegue (Above the fold)
- [ ] Prueba social cuantificada (Testimonios con métricas reales)
- [ ] Mecanismo único / Cómo funciona en 3 pasos
- [ ] Destrucción de objeciones frecuentes (FAQ interactiva)
- [ ] CTA flotante / Footer de conversión directa

#### 3. Metas de Rendimiento
- **Tasa de Conversión Objetivo:** > 4.5%
- Conectado a la meta de negocio de ${target}.`
        };
      }
    },
    {
      id: 'pauta',
      name: 'Estrategia de Pauta / Audiencias',
      desc: 'Embudo de Meta Ads, públicos segmentados, ofertas de gancho y retargeting',
      icon: Sparkles,
      build: (client: string) => {
        const target = client.trim() ? `[[${client.trim()}]]` : '[[Cliente]]';
        return {
          title: `Estrategia de Pauta · ${client.trim() || 'Campaña'}`,
          content: `### Estrategia de Pauta Digital & Audiencias · ${target}
**Fecha de Lanzamiento:** ${today}
**Plataformas:** Meta Ads (Instagram/Facebook) + Google Search

#### 1. Audiencias por Nivel de Consciencia
- **Top of Funnel (TOF - Tráfico Frío):** Públicos lookalike 1-2% basados en compradores + Intereses específicos del nicho.
- **Middle of Funnel (MOF - Tráfico Templado):** Interacción 90 días en Instagram, reproducciones 50%+ de Reels de valor.
- **Bottom of Funnel (BOF - Retargeting Caliente):** Visitantes de landing sin agendamiento en últimos 14 días.

#### 2. Creativos & Ángulos de Copy
- **Ángulo A (Dolor):** "¿Cansado de perder prospectos por no tener un proceso claro?"
- **Ángulo B (Prueba):** "Cómo ayudamos a clientes como ${target} a escalar sus conversiones."
- **Ángulo C (Oferta directa):** Diagnóstico estratégico sin costo en 15 minutos.

#### 3. Presupuesto & ROAS Esperado
- **Inversión mensual inicial:** $ 
- **CPA Máximo Permitido:** $ 
- **Pixel & CAPI:** Verificado en dominio principal.`
        };
      }
    },
    {
      id: 'minuta',
      name: 'Minuta de Reunión con Cliente',
      desc: 'Temas tratados, acuerdos de entrega, blockers y próximos pasos asignados',
      icon: Calendar,
      build: (client: string) => {
        const target = client.trim() ? `[[${client.trim()}]]` : '[[Cliente]]';
        return {
          title: `Minuta Reunión · ${client.trim() || 'Cliente'} · ${today}`,
          content: `### Minuta de Reunión Estratégica · ${target}
**Fecha:** ${today}
**Participantes:** Equipo .cero + ${client.trim() || 'Cliente'}

#### Puntos Tratados
1. Revisión de hitos entregados la semana previa.
2. Estado de feedback sobre diseño y funcionalidades.
3. Validación de fechas de entrega para el próximo sprint.

#### Acuerdos & Próximos Pasos (@tarea)
- [ ] Enviar propuesta de diseño final antes del viernes @tarea
- [ ] Cliente debe proveer accesos a DNS y pasarela de cobros @tarea
- [ ] Agendar sesión de QA y testeo en vivo para el próximo martes @tarea

#### Conexiones de Conocimiento
- Vinculado con el proyecto activo de ${target}.`
        };
      }
    },
    {
      id: 'onboarding',
      name: 'Kick-off & Onboarding de Cliente',
      desc: 'Checklist inicial, accesos requeridos, mapa de entregables y expectativas',
      icon: LayoutTemplate,
      build: (client: string) => {
        const target = client.trim() ? `[[${client.trim()}]]` : '[[Cliente]]';
        return {
          title: `Kick-off & Onboarding · ${client.trim() || 'Nuevo Cliente'}`,
          content: `### Kick-off & Onboarding Inicial · ${target}
**Fecha de Inicio:** ${today}

#### 1. Accesos & Activos Requeridos
- [ ] Acceso a cuenta publicitaria (Meta Business / Google Ads)
- [ ] Acceso a dominio y DNS (Cloudflare / GoDaddy / Namecheap)
- [ ] Carpeta de activos de marca (Logos SVG, manual de marca, tipografías)
- [ ] Banco de imágenes de alta resolución del producto/servicio

#### 2. Fechas Críticas del Roadmap
- **Entrega de wireframes y arquitectura:** 
- **Aprobación de prototipo interactivo:** 
- **Desarrollo frontend y configuraciones de tracking:** 
- **Fecha de salida a producción (Go-Live):** 

#### 3. Expectativas & Reglas del Juego
- Comunicación principal: WhatsApp / Email para decisiones críticas.
- Actualizaciones de avance: Los días viernes con informe visual.`
        };
      }
    },
    {
      id: 'daily',
      name: 'Bitácora Diaria · Foco de Hoy',
      desc: 'Prioridades no negociables del día, bloques de trabajo profundo y notas rápidas',
      icon: BookOpen,
      build: (client: string) => {
        const target = client.trim() ? `[[${client.trim()}]]` : '';
        return {
          title: `Nota Diaria · ${today}`,
          content: `### Foco de Hoy (${today})

#### 1. Las 3 Prioridades No Negociables
1. Terminar entregable crítico para ${target || 'cliente principal'} @tarea
2. Revisar cobros pendientes y flujo de caja @tarea
3. 2 horas de trabajo profundo sin distracciones

#### 2. Bloques de Trabajo
- **Bloque Mañana (09:00 - 12:30):** Deep work en código y entregables.
- **Bloque Tarde (14:30 - 17:00):** Reuniones, llamadas y seguimiento.
- **Bloque Cierre (17:00 - 18:00):** Limpieza de inbox y plan del día siguiente.

#### 3. Notas & Aprendizajes Rápidos
- `
        };
      }
    }
  ], [today]);

  const handleApplyTemplate = (templateId: string, clientName: string) => {
    hapticFeedback.medium();
    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
    const generated = template.build(clientName);
    const detectedLinks = extractWikiLinks(generated.content);

    const newNoteData: Omit<SecondBrainNote, 'id' | 'createdAt' | 'updatedAt'> = {
      title: generated.title,
      content: generated.content,
      date: today,
      tags: [template.id],
      pinned: false,
      linkedEntityTitles: detectedLinks,
    };

    if (onAddNote) {
      onAddNote(newNoteData);
    } else {
      const created: SecondBrainNote = {
        ...newNoteData,
        id: `note_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLocalNotes(prev => [created, ...prev]);
      setActiveNoteId(created.id);
    }

    setShowTemplateModal(false);
    setMobileTab('editor');
  };

  // Build unified catalog & relations for the knowledge graph
  const catalog = useMemo(() => {
    return buildLinkCatalog({
      notes,
      tasks,
      projects,
      weeklyGoals,
    });
  }, [notes, tasks, projects, weeklyGoals]);

  const relations = useMemo(() => {
    return extractAllAppRelations({
      notes,
      tasks,
      projects,
      catalog,
    });
  }, [notes, tasks, projects, catalog]);

  // Auto-save local notes if standalone
  useEffect(() => {
    if (!propNotes) {
      try {
        localStorage.setItem('cero_second_brain_notes', JSON.stringify(localNotes));
      } catch {}
    }
  }, [localNotes, propNotes]);

  // Keep active note valid if notes change
  useEffect(() => {
    if (!notes.some(n => n.id === activeNoteId) && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0] || null;

  // Helper to extract [[links]] from content
  const extractWikiLinks = (text: string): string[] => {
    const matches = text.match(/\[\[(.*?)\]\]/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/\[\[|\]\]/g, '').trim())));
  };

  const handleUpdateActiveNote = (updates: Partial<SecondBrainNote>) => {
    if (!activeNote) return;
    const updatedContent = updates.content !== undefined ? updates.content : activeNote.content;
    const detectedLinks = extractWikiLinks(updatedContent);
    const fullUpdates = {
      ...updates,
      linkedEntityTitles: detectedLinks,
    };

    if (onUpdateNote) {
      onUpdateNote(activeNote.id, fullUpdates);
    } else {
      setLocalNotes(prev => prev.map(n => {
        if (n.id === activeNote.id) {
          return {
            ...n,
            ...fullUpdates,
            updatedAt: new Date().toISOString()
          };
        }
        return n;
      }));
    }
  };

  const handleCreateNote = (isDaily: boolean = false) => {
    hapticFeedback.light();
    const newNoteData: Omit<SecondBrainNote, 'id' | 'createdAt' | 'updatedAt'> = {
      title: isDaily ? `Nota de hoy: ${today}` : 'Nueva Nota Sin Título',
      content: isDaily 
        ? `Nota del día: ${today}\n\n- Avance clave en [[${weeklyGoals[0]?.title || 'Meta Principal'}]]\n- Foco completado con éxito.`
        : '',
      date: today,
      tags: isDaily ? ['diario'] : [],
      pinned: false,
      linkedEntityTitles: isDaily && weeklyGoals[0] ? [weeklyGoals[0].title] : [],
    };

    if (onAddNote) {
      onAddNote(newNoteData);
    } else {
      const created: SecondBrainNote = {
        ...newNoteData,
        id: `note_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setLocalNotes(prev => [created, ...prev]);
      setActiveNoteId(created.id);
    }
  };

  const handleRequestDelete = (note: SecondBrainNote) => {
    hapticFeedback.selection();
    setNoteToDelete(note);
  };

  const handleConfirmDelete = () => {
    if (!noteToDelete) return;
    hapticFeedback.heavy();
    const idToDelete = noteToDelete.id;

    if (onDeleteNote) {
      onDeleteNote(idToDelete);
    } else {
      setLocalNotes(prev => prev.filter(n => n.id !== idToDelete));
    }

    const remaining = notes.filter(n => n.id !== idToDelete);
    if (remaining.length > 0) {
      setActiveNoteId(remaining[0].id);
    } else {
      setActiveNoteId('');
    }

    setNoteToDelete(null);
  };

  const handleTogglePin = (id: string) => {
    hapticFeedback.selection();
    const target = notes.find(n => n.id === id);
    if (!target) return;
    if (onUpdateNote) {
      onUpdateNote(id, { pinned: !target.pinned });
    } else {
      setLocalNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    }
  };

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = searchQuery === '' || 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !selectedTag || (n.tags && n.tags.includes(selectedTag));
      return matchesSearch && matchesTag;
    });
  }, [notes, searchQuery, selectedTag]);

  // All known entities to link with [[ ]]
  const linkableEntities = useMemo(() => {
    const list: { label: string; type: 'meta' | 'proyecto' | 'nota' }[] = [];
    weeklyGoals.forEach(g => list.push({ label: g.title, type: 'meta' }));
    projects.forEach(p => list.push({ label: p.clientName, type: 'proyecto' }));
    notes.forEach(n => {
      if (n.id !== activeNote?.id) list.push({ label: n.title, type: 'nota' });
    });
    return list;
  }, [weeklyGoals, projects, notes, activeNote]);

  // Graph Data generation
  const graphNodes = useMemo(() => {
    const nodes: { id: string; label: string; type: 'note' | 'goal' | 'project' | 'task'; size: number }[] = [];
    const links: { source: string; target: string }[] = [];

    notes.forEach(n => {
      nodes.push({ id: n.id, label: n.title, type: 'note', size: 14 });

      // Links inside notes
      (n.linkedEntityTitles || []).forEach(linkTitle => {
        // match goal
        const matchedGoal = weeklyGoals.find(g => g.title.toLowerCase() === linkTitle.toLowerCase());
        if (matchedGoal) {
          if (!nodes.some(node => node.id === matchedGoal.id)) {
            nodes.push({ id: matchedGoal.id, label: matchedGoal.title, type: 'goal', size: 18 });
          }
          links.push({ source: n.id, target: matchedGoal.id });
        }

        // match project
        const matchedProj = projects.find(p => p.clientName.toLowerCase() === linkTitle.toLowerCase());
        if (matchedProj) {
          if (!nodes.some(node => node.id === matchedProj.id)) {
            nodes.push({ id: matchedProj.id, label: matchedProj.clientName, type: 'project', size: 16 });
          }
          links.push({ source: n.id, target: matchedProj.id });
        }

        // match another note
        const matchedNote = notes.find(other => other.id !== n.id && other.title.toLowerCase() === linkTitle.toLowerCase());
        if (matchedNote) {
          links.push({ source: n.id, target: matchedNote.id });
        }
      });
    });

    return { nodes, links };
  }, [notes, weeklyGoals, projects]);

  return (
    <div className="w-full space-y-4">
      {/* Top Header / Second Brain Intro & Controls */}
      <div className="card-swiss p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-swiss text-[11px] font-bold">TIER 3 · Segundo Cerebro</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              {notes.length} notas conectadas
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-heading tracking-tight mt-1">
            Notas Conectadas & Grafo de Ideas
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Escribe <code className="font-mono text-[var(--text-primary)] bg-[var(--bg-surface-muted)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">[[ ]]</code> para conectar con metas y proyectos, o <code className="font-mono text-[var(--text-primary)] bg-[var(--bg-surface-muted)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">@</code> para tareas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Guide Button */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowGuideModal(true);
            }}
            className="btn-swiss-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer"
            title="Ver guía paso a paso de uso"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-500" />
            <span className="hidden sm:inline">¿Cómo funciona?</span>
          </button>

          {/* Mode Switcher */}
          <div className="hidden sm:flex items-center bg-[var(--bg-app)] p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 text-xs rounded transition font-medium cursor-pointer ${
                viewMode === 'split' ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Dual
            </button>
            <button
              onClick={() => setViewMode('editor')}
              className={`px-2.5 py-1 text-xs rounded transition font-medium cursor-pointer ${
                viewMode === 'editor' ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-2.5 py-1 text-xs rounded transition font-medium cursor-pointer ${
                viewMode === 'graph' ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Grafo
            </button>
          </div>

          {/* Templates Trigger */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowTemplateModal(true);
            }}
            className="btn-swiss-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer"
            title="Usar plantilla de Brief, Pauta o Minuta"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-purple-500" />
            <span className="hidden sm:inline">Plantillas</span>
          </button>

          <button
            onClick={() => handleCreateNote(true)}
            className="btn-swiss-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            title="Crear o abrir la nota de hoy"
          >
            <Calendar className="w-3.5 h-3.5 stroke-[1.5]" />
            <span className="hidden sm:inline">Nota de Hoy</span>
          </button>

          <button
            onClick={() => handleCreateNote(false)}
            className="btn-swiss-primary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
            <span>Nueva Nota</span>
          </button>
        </div>
      </div>

      {/* Mobile Segmented Tab Switcher (<lg) */}
      <div className="lg:hidden flex items-center bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-subtle)] gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setMobileTab('list');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'list'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notas ({notes.length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setMobileTab('editor');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'editor'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>
        <button
          type="button"
          onClick={() => {
            hapticFeedback.selection();
            setMobileTab('graph');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
            mobileTab === 'graph'
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Grafo</span>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[580px]">
        {/* Left Sidebar: Notes Navigator */}
        <div className={`lg:col-span-4 card-swiss p-3.5 space-y-3 ${viewMode === 'graph' ? 'lg:hidden' : ''} ${mobileTab !== 'list' ? 'hidden lg:block' : 'block'}`}>
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar en notas"
              placeholder="Buscar en notas y conexiones…"
              className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-control)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition"
            />
          </div>

          {/* Notes list */}
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto no-scrollbar">
            {filteredNotes.length === 0 ? (
              <div className="text-center py-8 text-xs text-[var(--text-tertiary)]">
                No se encontraron notas
              </div>
            ) : (
              filteredNotes.map(n => {
                const isActive = n.id === activeNote?.id;
                const linkCount = (n.linkedEntityTitles || []).length;

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      hapticFeedback.light();
                      setActiveNoteId(n.id);
                      setMobileTab('editor');
                    }}
                    className={`p-3 rounded-[var(--radius-control)] border transition cursor-pointer text-left group relative ${
                      isActive
                        ? 'bg-[var(--bg-app)] border-[var(--text-primary)] shadow-xs'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate flex-1">
                        {n.title || 'Nota sin título'}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {n.pinned && (
                          <Pin className="w-3 h-3 text-[var(--text-tertiary)] fill-[var(--text-tertiary)]" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestDelete(n);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition cursor-pointer"
                          title="Eliminar nota"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-1 font-sans">
                      {n.content ? n.content.slice(0, 90) : 'Sin contenido…'}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-divider)] text-[10px] text-[var(--text-tertiary)] font-mono">
                      <span>{n.date}</span>
                      {linkCount > 0 && (
                        <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                          <Link2 className="w-2.5 h-2.5" />
                          <span>{linkCount} vínculos</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center/Right: Active Note Editor & Connected Graph */}
        <div className={`${viewMode === 'graph' ? 'lg:col-span-12' : viewMode === 'editor' ? 'lg:col-span-8' : 'lg:col-span-8'} ${mobileTab === 'list' ? 'hidden lg:block' : 'block'} space-y-4`}>
          {/* GRAPH MODE / MOBILE GRAPH TAB */}
          {((viewMode === 'graph' || viewMode === 'split') && (mobileTab === 'graph' || mobileTab === 'editor')) && (
            <div className={`w-full ${mobileTab === 'editor' && viewMode === 'split' ? 'hidden lg:block' : ''} ${mobileTab === 'editor' && viewMode !== 'split' ? 'hidden' : ''}`}>
              <KnowledgeGraphCanvas
                catalog={catalog}
                relations={relations}
                onNavigate={onNavigate}
                height={viewMode === 'graph' || mobileTab === 'graph' ? 'calc(100vh - 240px)' : '380px'}
              />
            </div>
          )}

          {/* EDITOR MODE: Markdown / Linked Note Editor */}
          {activeNote && (viewMode !== 'graph' || mobileTab === 'editor') && (mobileTab === 'editor' || mobileTab === 'list') && (
            <div className="card-swiss p-4 sm:p-5 space-y-4">
              {/* Mobile Back to Notes button */}
              <div className="lg:hidden flex items-center justify-between pb-2 border-b border-[var(--border-divider)]">
                <button
                  type="button"
                  onClick={() => setMobileTab('list')}
                  className="btn-swiss-secondary py-1 px-2.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>← Volver a lista</span>
                </button>
                <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                  Editando nota
                </span>
              </div>
              {/* Note Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-divider)]">
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
                  placeholder="Título de la nota…"
                  className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)] bg-transparent border-none focus:outline-none flex-1 tracking-tight"
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleTogglePin(activeNote.id)}
                    className={`p-1.5 rounded-[var(--radius-control)] border transition cursor-pointer ${
                      activeNote.pinned 
                        ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-[var(--solid-contrast-bg)]' 
                        : 'border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                    }`}
                    title="Fijar nota"
                  >
                    <Pin className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestDelete(activeNote)}
                    className="p-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[#DC2626] transition cursor-pointer"
                    title="Eliminar nota"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              </div>

              {/* Note Content Textarea */}
              <textarea
                value={activeNote.content}
                onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
                placeholder="Escribe lo que mueve tu día… Escribe [[Nombre de Meta o Proyecto]] para conectar con nodos, o @tarea para incluir tareas."
                rows={12}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[var(--radius-control)] p-3 text-xs sm:text-sm text-[var(--text-primary)] font-mono leading-relaxed placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition resize-y"
              />

              {/* Quick Link Suggester Pill Row */}
              <div className="pt-2 border-t border-[var(--border-divider)] space-y-2">
                <span className="label-swiss text-[10px]">Conectar con entidades existentes:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {linkableEntities.slice(0, 6).map((ent, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        hapticFeedback.light();
                        const tag = `[[${ent.label}]]`;
                        handleUpdateActiveNote({
                          content: activeNote.content + (activeNote.content.endsWith('\n') ? '' : '\n') + `- ${tag}`
                        });
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-[var(--radius-pill)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition cursor-pointer bg-[var(--bg-app)]"
                    >
                      + [[{ent.label}]]
                    </button>
                  ))}
                </div>
              </div>

              {/* Connected Backlinks Box */}
              {(activeNote.linkedEntityTitles || []).length > 0 && (
                <div className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    <Link2 className="w-3 h-3 text-[#16A34A]" />
                    <span>Conexiones activas en esta nota:</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeNote.linkedEntityTitles?.map((link, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-medium inline-flex items-center gap-1"
                      >
                        <ArrowUpRight className="w-3 h-3 text-[var(--text-tertiary)]" />
                        {link}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Note Confirmation Modal */}
      {noteToDelete && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setNoteToDelete(null)}
        >
          <div 
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 border border-red-500/20">
                <Trash2 className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
                  ¿Eliminar nota?
                </h3>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {noteToDelete.title || 'Nota sin título'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Esta acción no se puede deshacer. La nota se eliminará permanentemente de tu base de conocimiento.
            </p>

            {(noteToDelete.linkedEntityTitles || []).length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-semibold">Vínculos vinculados:</span> Esta nota contiene {noteToDelete.linkedEntityTitles?.length} enlace(s) a otras entidades.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setNoteToDelete(null);
                }}
                className="btn-swiss-secondary py-2 px-4 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2 px-4 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar Nota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selector Modal */}
      {showTemplateModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setShowTemplateModal(false)}
        >
          <div 
            className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-divider)] flex items-center justify-between bg-[var(--bg-app)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <LayoutTemplate className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] font-heading">
                    Plantillas de Consultoría & Estudio
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Estructuras listas para rellenar con indexación automática en Ficha 360°
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs no-scrollbar">
              {/* Client picker */}
              <div className="p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1.5">
                <label className="text-[11px] font-semibold text-[var(--text-primary)] block">
                  Cliente o Proyecto Asociado (Opcional):
                </label>
                <div className="flex gap-2">
                  <select
                    value={templateClientName}
                    onChange={e => setTemplateClientName(e.target.value)}
                    className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="">-- Sin cliente específico --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.clientName}>
                        {p.clientName} ({p.serviceType?.toUpperCase() || 'PROYECTO'})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)]">
                  Al elegir un cliente, la nota incluirá <code className="font-mono text-[var(--text-secondary)]">[[{templateClientName || 'Cliente'}]]</code> y quedará indexada de forma automática en su Ficha y en el Grafo.
                </p>
              </div>

              {/* Template cards */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Selecciona la plantilla:
                </span>
                {TEMPLATES.map(t => {
                  const Icon = t.icon;
                  const isSelected = selectedTemplateId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                        isSelected 
                          ? 'bg-[var(--bg-app)] border-[var(--text-primary)] shadow-xs' 
                          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isSelected ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[var(--text-primary)]">
                            {t.name}
                          </h4>
                          {isSelected && (
                            <span className="text-[10px] font-mono font-semibold text-purple-600 dark:text-purple-400">
                              Seleccionada
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                          {t.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 sm:p-4 border-t border-[var(--border-divider)] bg-[var(--bg-app)] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="btn-swiss-secondary py-2 px-4 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleApplyTemplate(selectedTemplateId, templateClientName)}
                className="btn-solid-primary py-2 px-5 text-xs font-semibold rounded-xl cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Nota con Plantilla</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      <SecondBrainGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
};
