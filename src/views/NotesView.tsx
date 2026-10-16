import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SecondBrainNote, 
  AgendaTask, 
  Project, 
  WeeklyGoal, 
  AgendaMeeting 
} from '../types';
import { 
  buildLinkCatalog, 
  extractAllAppRelations, 
  LinkCatalogItem, 
  LinkRelation 
} from '../lib/links';
import { WikiLinkAutocomplete } from '../components/WikiLinkAutocomplete';
import { LinkedText } from '../components/LinkedText';
import { BacklinksPanel } from '../components/BacklinksPanel';
import { LocalGraphWidget } from '../components/LocalGraphWidget';
import { getTodayString } from '../utils/storage';
import { hapticFeedback } from '../utils/haptics';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Pin, 
  Search, 
  Folder, 
  Tag, 
  Network, 
  Eye, 
  Edit3, 
  Calendar, 
  ArrowUpRight,
  AlertTriangle,
  BookOpen,
  Sparkles,
  ChevronLeft,
  LayoutTemplate,
  X,
  ArrowLeft
} from 'lucide-react';
import { SecondBrainGuideModal } from '../components/SecondBrainGuideModal';

interface Props {
  notes: SecondBrainNote[];
  tasks: AgendaTask[];
  meetings?: AgendaMeeting[];
  projects: Project[];
  weeklyGoals: WeeklyGoal[];
  onAddNote: (note: Omit<SecondBrainNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateNote: (id: string, updates: Partial<SecondBrainNote>) => void;
  onDeleteNote: (id: string) => void;
  onNavigate?: (path: string) => void;
  privacyMode?: boolean;
  initialNoteId?: string;
}

export const NotesView: React.FC<Props> = ({
  notes,
  tasks,
  meetings = [],
  projects,
  weeklyGoals,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onNavigate,
  privacyMode,
  initialNoteId,
}) => {
  const today = getTodayString();

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    if (initialNoteId && notes.some(n => n.id === initialNoteId)) return initialNoteId;
    return notes[0]?.id || '';
  });

  // Mobile active tab: 'list' | 'editor' | 'graph'
  const [mobileTab, setMobileTab] = useState<'list' | 'editor' | 'graph'>('list');
  // Guide & Template Modals
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('brief');
  const [templateClientName, setTemplateClientName] = useState<string>(() => projects[0]?.clientName || '');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');

  // Autocomplete state
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });
  const [autocompleteCursorPos, setAutocompleteCursorPos] = useState<number | null>(null);

  // Deletion modal state
  const [noteToDelete, setNoteToDelete] = useState<SecondBrainNote | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync active note if notes change
  useEffect(() => {
    if (initialNoteId && notes.some(n => n.id === initialNoteId)) {
      setActiveNoteId(initialNoteId);
    } else if (!notes.some(n => n.id === activeNoteId) && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, initialNoteId, activeNoteId]);

  const activeNote = useMemo(() => {
    return notes.find(n => n.id === activeNoteId) || notes[0] || null;
  }, [notes, activeNoteId]);

  // Build unified catalog for links
  const catalog: LinkCatalogItem[] = useMemo(() => {
    return buildLinkCatalog({
      notes,
      tasks,
      projects,
      meetings,
      weeklyGoals,
    });
  }, [notes, tasks, projects, meetings, weeklyGoals]);

  // Extract all app relations
  const relations: LinkRelation[] = useMemo(() => {
    return extractAllAppRelations({
      notes,
      tasks,
      projects,
      meetings,
      catalog,
    });
  }, [notes, tasks, projects, meetings, catalog]);

  // Extract all folders and tags
  const folders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      if (n.folder) set.add(n.folder);
    });
    return Array.from(set);
  }, [notes]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => {
      (n.tags || []).forEach(t => set.add(t));
    });
    return Array.from(set);
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      const matchFolder = !selectedFolder || n.folder === selectedFolder;
      const matchTag = !selectedTag || (n.tags && n.tags.includes(selectedTag));
      return matchSearch && matchFolder && matchTag;
    });
  }, [notes, searchQuery, selectedFolder, selectedTag]);

  // Handle typing inside textarea to trigger [[ autocomplete
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;

    if (activeNote) {
      onUpdateNote(activeNote.id, { content: val });
    }

    // Check if user is typing `[[`
    const textBeforeCursor = val.slice(0, cursor);
    const lastBracketIndex = textBeforeCursor.lastIndexOf('[[');

    if (lastBracketIndex !== -1 && lastBracketIndex < cursor) {
      const queryPart = textBeforeCursor.slice(lastBracketIndex + 2);
      // Ensure there are no closed brackets or line breaks in between
      if (!queryPart.includes(']]') && !queryPart.includes('\n')) {
        const textarea = textareaRef.current;
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          setAutocompletePos({
            top: rect.top + 80,
            left: rect.left + 20,
          });
        }
        setAutocompleteQuery(queryPart);
        setAutocompleteCursorPos(lastBracketIndex);
        setAutocompleteOpen(true);
        return;
      }
    }

    setAutocompleteOpen(false);
  };

  const handleSelectAutocomplete = (item: LinkCatalogItem) => {
    if (!activeNote || !textareaRef.current || autocompleteCursorPos === null) return;
    const content = activeNote.content;
    const before = content.slice(0, autocompleteCursorPos);
    const after = content.slice(textareaRef.current.selectionStart);
    const newContent = `${before}[[${item.title}]]${after}`;

    onUpdateNote(activeNote.id, { content: newContent });
    setAutocompleteOpen(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursor = autocompleteCursorPos + item.title.length + 4;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 50);
  };

  const handleCreateNewNoteFromAutocomplete = (title: string) => {
    hapticFeedback.medium();
    onAddNote({
      title,
      content: `# ${title}\n\nNota creada automáticamente desde enlace [[${title}]].`,
      date: today,
      tags: [],
      pinned: false,
    });

    if (activeNote && textareaRef.current && autocompleteCursorPos !== null) {
      const content = activeNote.content;
      const before = content.slice(0, autocompleteCursorPos);
      const after = content.slice(textareaRef.current.selectionStart);
      const newContent = `${before}[[${title}]]${after}`;
      onUpdateNote(activeNote.id, { content: newContent });
    }

    setAutocompleteOpen(false);
  };

  const TEMPLATES = useMemo(() => [
    {
      id: 'brief',
      name: 'Brief de Landing Page',
      desc: 'Propuesta de valor, secciones clave, objeciones y métricas de conversión',
      icon: LayoutTemplate,
      build: (client: string) => ({
        title: `Brief: Landing Page · [[${client}]]`,
        content: `# Brief: Landing Page para [[${client}]]\n**Fecha:** ${today} | **Objetivo:** Conversión y captación de clientes calificados\n\n### 1. Propuesta de Valor & Audiencia\n- **Audiencia objetivo:** \n- **Problema principal a resolver:** \n- **Diferenciador clave de [[${client}]]:** \n\n### 2. Estructura & Secciones Clave\n- [ ] Hero Section con titular contundente y CTA de agenda\n- [ ] Sección de prueba social & casos de éxito verificables\n- [ ] Oferta de servicios y desglose de entregables\n- [ ] FAQ & Objeciones frecuentes resueltas\n- [ ] Formulario / Calendario de llamada\n\n### 3. Métricas de Éxito\n- Tasa de conversión deseada: > 3.5%\n- Conexión del proyecto: [[${client}]]`,
        folder: 'Briefs',
        tags: ['brief', 'landing', 'conversion'],
      })
    },
    {
      id: 'pauta',
      name: 'Estrategia de Pauta & Audiencias',
      desc: 'Objetivos de campaña, segmentación TOFU/MOFU/BOFU y creativos',
      icon: Sparkles,
      build: (client: string) => ({
        title: `Estrategia de Pauta · [[${client}]]`,
        content: `# Estrategia de Pauta & Audiencias: [[${client}]]\n**Fecha:** ${today} | **Canales:** Meta Ads / Google Ads\n\n### 1. Objetivos de Campaña\n- Presupuesto mensual asignado: \n- Costo por Lead (CPL) deseado: \n- Meta de conversiones semanales: \n\n### 2. Estructura de Audiencias & Segmentación\n- **TOFU (Tráfico Frío):** Lookalike 1-2%, intereses específicos del sector\n- **MOFU (Consideración):** Interacción 90d en redes, visitas a la landing\n- **BOFU (Retargeting Directo):** Carritos abandonados, agendas no confirmadas\n\n### 3. Creatividades & Ángulos\n- Ángulo 1: Dolor / Frustración actual del cliente ideal\n- Ángulo 2: Caso de éxito cuantificado con métricas reales\n- Ángulo 3: Oferta irresistible con garantía de servicio\n\n### 4. Próximos Pasos (@tarea)\n- [ ] Configurar píxel y API de conversiones para [[${client}]]\n- [ ] Diseñar 3 variaciones de creativos estáticos y 1 video\n- [ ] Lanzar campaña de testeo y monitorear CTR`,
        folder: 'Pauta',
        tags: ['pauta', 'audiencias', 'ads'],
      })
    },
    {
      id: 'minuta',
      name: 'Minuta de Reunión con Cliente',
      desc: 'Participantes, puntos tratados, acuerdos y tareas pendientes con @tarea',
      icon: Calendar,
      build: (client: string) => ({
        title: `Minuta de Reunión · [[${client}]] · ${today}`,
        content: `# Minuta de Reunión: [[${client}]]\n**Fecha:** ${today} | **Participantes:** Juan Liendo, [[${client}]]\n\n### 1. Puntos Tratados\n- Revisión de avances y entregables de la semana\n- Feedback sobre propuestas presentadas\n- Ajustes de alcance o requerimientos técnicos\n\n### 2. Acuerdos y Decisiones\n- Se aprueba el cronograma de entregas\n- Plazo comprometido: próximo viernes\n\n### 3. Tareas & Próximos Pasos (@tarea)\n- [ ] Enviar minuta y resumen por correo a [[${client}]]\n- [ ] Ajustar entregables según feedback\n- [ ] Programar sesión de seguimiento para la próxima semana`,
        folder: 'Minutas',
        tags: ['reunion', 'minuta', 'acuerdos'],
      })
    },
    {
      id: 'kickoff',
      name: 'Kick-off de Proyecto',
      desc: 'Inicio formal, alcance, roadmap, accesos y credenciales requeridas',
      icon: LayoutTemplate,
      build: (client: string) => ({
        title: `Kick-off de Proyecto · [[${client}]]`,
        content: `# Kick-off de Proyecto: [[${client}]]\n**Fecha de Inicio:** ${today} | **Tipo de Servicio:** PAF / Web\n\n### 1. Alcance y Entregables\n- Objetivos de negocio del cliente: \n- Entregables acordados: \n- Fechas clave del roadmap: \n\n### 2. Accesos y Recursos Requeridos\n- [ ] Dominio y credenciales de hosting\n- [ ] Branding (logos en SVG, paleta de colores, tipografías)\n- [ ] Cuentas publicitarias y permisos de administrador\n\n### 3. Vínculos del Proyecto\n- Cliente principal: [[${client}]]\n- Primera sesión de trabajo agendada`,
        folder: 'Kickoff',
        tags: ['kickoff', 'onboarding'],
      })
    },
    {
      id: 'diario',
      name: 'Bitácora Diaria',
      desc: 'Prioridad #1, foco profundo, entregables completados y aprendizajes',
      icon: Calendar,
      build: (client: string) => ({
        title: `Bitácora Diaria · ${today}`,
        content: `# Bitácora Diaria · ${today}\n\n### 🎯 Foco Principal de Hoy\n- Prioridad #1:\n- Conexión clave con [[${client || 'Proyecto Principal'}]]:\n\n### ⚡ Bloques de Trabajo Realizados\n- [ ] Bloque Mañana: Foco profundo en entregables clave\n- [ ] Bloque Tarde: Seguimiento, reuniones y soporte\n\n### 💡 Notas y Aprendizajes\n- Avance registrado con éxito.`,
        folder: 'Diario',
        tags: ['diario', 'foco'],
      })
    }
  ], [today]);

  const handleApplyTemplate = (templateId: string, clientName: string) => {
    hapticFeedback.medium();
    const tmpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
    const targetName = clientName.trim() || projects[0]?.clientName || 'Cliente Principal';
    const data = tmpl.build(targetName);
    onAddNote({
      title: data.title,
      content: data.content,
      date: today,
      tags: data.tags,
      pinned: false,
      folder: data.folder,
    });
    setShowTemplateModal(false);
    setMobileTab('editor');
  };

  const handleCreateNote = (isDaily = false) => {
    hapticFeedback.light();
    const title = isDaily ? `Nota Diaria · ${today}` : 'Nueva Nota';
    onAddNote({
      title,
      content: isDaily
        ? `### Foco de Hoy (${today})\n\n- Prioridad clave:\n- Conexión con [[${projects[0]?.clientName || 'Proyecto Principal'}]]\n- Avance:`
        : '',
      date: today,
      tags: isDaily ? ['diario'] : [],
      pinned: false,
      folder: selectedFolder || undefined,
    });
    setMobileTab('editor');
  };

  const handleDeleteActiveNote = () => {
    if (!activeNote) return;
    hapticFeedback.selection();
    setNoteToDelete(activeNote);
  };

  const noteToDeleteBacklinksCount = useMemo(() => {
    if (!noteToDelete) return 0;
    return relations.filter(r => r.targetId === noteToDelete.id).length;
  }, [noteToDelete, relations]);

  const handleConfirmDelete = () => {
    if (!noteToDelete) return;
    hapticFeedback.heavy();
    const idToDelete = noteToDelete.id;
    onDeleteNote(idToDelete);

    // If deleting the active note, select another remaining note
    const remaining = notes.filter(n => n.id !== idToDelete);
    if (remaining.length > 0) {
      setActiveNoteId(remaining[0].id);
    } else {
      setActiveNoteId('');
    }

    setNoteToDelete(null);
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Header */}
      <div className="card-swiss p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-swiss text-[11px] font-bold">Base de Conocimiento</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              {notes.length} notas
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-heading tracking-tight mt-1">
            Notas & Documentación Conectada
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Escribe <code className="font-mono text-[var(--text-primary)] bg-[var(--bg-surface-muted)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">[[</code> para conectar con clientes o proyectos. Se indexa de forma automática en el Grafo y en la Ficha 360°.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Guide */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowGuideModal(true);
            }}
            className="btn-swiss-secondary py-2 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
            title="Ver guía paso a paso de uso"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-500" />
            <span>¿Cómo funciona?</span>
          </button>

          {/* Quick Templates Button */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowTemplateModal(true);
            }}
            className="btn-swiss-secondary py-2 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20"
            title="Usar plantilla prediseñada (Brief, Pauta, Minuta)"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            <span>Plantillas</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateNote(true)}
            className="btn-swiss-secondary py-2 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
            title="Crear nota rápida para hoy"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nota de Hoy</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateNote(false)}
            className="btn-solid-primary py-2 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Nota</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              if (onNavigate) onNavigate('/grafo');
            }}
            className="btn-swiss-secondary py-2 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
            title="Ver grafo visual completo"
          >
            <Network className="w-3.5 h-3.5 text-[var(--text-primary)]" />
            <span className="hidden sm:inline">Ver Grafo</span>
          </button>
        </div>
      </div>

      {/* Educational Hint Banner */}
      <div className="card-swiss p-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5 sm:mt-0" />
          <span className="text-[var(--text-secondary)] leading-relaxed">
            <b className="text-[var(--text-primary)]">Tip de Segundo Cerebro:</b> Tipea <code className="font-mono text-[var(--text-primary)] font-bold bg-[var(--bg-surface-muted)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">[[</code> en cualquier nota para vincular a tus clientes (ej. <code className="font-mono text-[var(--text-primary)]">[[{projects[0]?.clientName || 'Cliente'}]]</code>). La nota aparecerá automáticamente en su Ficha 360° y en la red del Grafo.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="text-xs font-semibold text-purple-600 hover:text-purple-500 dark:text-purple-400 cursor-pointer shrink-0 inline-flex items-center gap-1"
        >
          <span>Aprender más</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Mobile Tab Switcher (Visible on < lg screens) */}
      <div className="lg:hidden flex items-center p-1 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl text-xs font-medium">
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer font-semibold ${
            mobileTab === 'list' 
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Notas ({filteredNotes.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer font-semibold truncate px-2 ${
            mobileTab === 'editor' 
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {activeNote ? `Editor · ${activeNote.title.slice(0, 15)}` : 'Editor'}
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('graph')}
          className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer font-semibold ${
            mobileTab === 'graph' 
              ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] shadow-xs' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Grafo Local
        </button>
      </div>

      {/* Main Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Notes List & Filter (4 cols on desktop, responsive tab on mobile) */}
        <div className={`lg:col-span-4 card-swiss p-3.5 space-y-3 ${mobileTab === 'list' ? 'block' : 'hidden lg:block'}`}>
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar notas..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition"
            />
          </div>

          {/* Folders filter */}
          {folders.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => setSelectedFolder(null)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer shrink-0 ${
                  selectedFolder === null 
                    ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Todas
              </button>
              {folders.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFolder(selectedFolder === f ? null : f)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition cursor-pointer shrink-0 ${
                    selectedFolder === f 
                      ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]' 
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span>{f}</span>
                </button>
              ))}
            </div>
          )}

          {/* Notes list items */}
          <div className="space-y-1 max-h-[600px] overflow-y-auto no-scrollbar pr-0.5">
            {filteredNotes.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-tertiary)]">
                No se encontraron notas.
              </div>
            ) : (
              filteredNotes.map(n => {
                const isSelected = n.id === activeNoteId;
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      hapticFeedback.light();
                      setActiveNoteId(n.id);
                      setMobileTab('editor');
                    }}
                    className={`group w-full text-left p-2.5 rounded-xl border transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-[var(--bg-app)] border-[var(--text-primary)] shadow-xs'
                        : 'border-transparent hover:bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-xs font-semibold leading-snug line-clamp-1 ${
                        isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                      }`}>
                        {n.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {n.pinned && (
                          <Pin className="w-3 h-3 text-[var(--text-primary)] fill-current" />
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            hapticFeedback.selection();
                            setNoteToDelete(n);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-tertiary)] hover:text-red-500 rounded transition cursor-pointer"
                          title="Eliminar nota"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] line-clamp-2 mt-1 font-mono leading-relaxed">
                      {n.content ? n.content.slice(0, 90) : 'Nota vacía...'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-mono mt-1.5">
                      <span>{n.date || 'Sin fecha'}</span>
                      {n.folder && <span>· {n.folder}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Note Editor, Backlinks & Mini-Graph (8 cols on desktop, responsive tab on mobile) */}
        <div className={`lg:col-span-8 space-y-4 ${mobileTab === 'editor' ? 'block' : 'hidden lg:block'}`}>
          {activeNote ? (
            <div className="card-swiss p-4 sm:p-5 space-y-4">
              {/* Mobile Back Button & Fast Template action */}
              <div className="lg:hidden flex items-center justify-between pb-2 border-b border-[var(--border-divider)]">
                <button
                  type="button"
                  onClick={() => setMobileTab('list')}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer py-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a notas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20 cursor-pointer"
                >
                  <LayoutTemplate className="w-3 h-3" />
                  <span>Plantillas</span>
                </button>
              </div>

              {/* Note Header / Meta bar */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[var(--border-divider)]">
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) => onUpdateNote(activeNote.id, { title: e.target.value })}
                    placeholder="Título de la nota..."
                    className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)] bg-transparent border-none focus:outline-none w-full tracking-tight"
                  />
                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] font-mono flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {activeNote.date || today}
                    </span>
                    <input
                      type="text"
                      value={activeNote.folder || ''}
                      onChange={(e) => onUpdateNote(activeNote.id, { folder: e.target.value.trim() || undefined })}
                      placeholder="+ Carpeta..."
                      className="bg-transparent border-b border-[var(--border-subtle)] focus:border-[var(--text-primary)] focus:outline-none text-[11px] text-[var(--text-secondary)] px-1 py-0.2"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Mode switcher: Edit vs Preview */}
                  <div className="flex items-center bg-[var(--bg-app)] p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[10px]">
                    <button
                      type="button"
                      onClick={() => setEditorMode('edit')}
                      className={`px-2 py-1 rounded transition font-medium flex items-center gap-1 cursor-pointer ${
                        editorMode === 'edit'
                          ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('preview')}
                      className={`px-2 py-1 rounded transition font-medium flex items-center gap-1 cursor-pointer ${
                        editorMode === 'preview'
                          ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Lectura</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateNote(activeNote.id, { pinned: !activeNote.pinned })}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
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
                    onClick={handleDeleteActiveNote}
                    className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[#DC2626] transition cursor-pointer"
                    title="Eliminar nota"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                  </button>
                </div>
              </div>

              {/* Editor Content Textarea or Preview */}
              {editorMode === 'edit' ? (
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={activeNote.content}
                    onChange={handleTextareaChange}
                    placeholder="Escribe aquí... Escribe [[ para vincular con metas, clientes o proyectos."
                    rows={14}
                    className="w-full bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-3.5 text-xs sm:text-sm text-[var(--text-primary)] font-mono leading-relaxed placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition resize-y"
                  />

                  {/* WikiLink Autocomplete Dropdown */}
                  <WikiLinkAutocomplete
                    catalog={catalog}
                    isOpen={autocompleteOpen}
                    query={autocompleteQuery}
                    position={autocompletePos}
                    onSelect={handleSelectAutocomplete}
                    onCreateNewNote={handleCreateNewNoteFromAutocomplete}
                    onClose={() => setAutocompleteOpen(false)}
                  />
                </div>
              ) : (
                <div className="w-full min-h-[300px] bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl p-4 text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-sans">
                  <LinkedText
                    text={activeNote.content || 'Nota sin contenido.'}
                    catalog={catalog}
                    onNavigate={onNavigate}
                  />
                </div>
              )}

              {/* Backlinks Panel */}
              <BacklinksPanel
                entityId={activeNote.id}
                relations={relations}
                catalog={catalog}
                onNavigate={onNavigate}
              />

              {/* Local Mini-Graph Widget for this Note */}
              <LocalGraphWidget
                entityId={activeNote.id}
                catalog={catalog}
                relations={relations}
                onNavigate={onNavigate}
                privacyMode={privacyMode}
              />
            </div>
          ) : (
            <div className="card-swiss p-12 text-center space-y-3">
              <FileText className="w-8 h-8 mx-auto text-[var(--text-tertiary)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Ninguna nota seleccionada</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Crea una nueva nota o selecciona una de la lista.
              </p>
              <button
                type="button"
                onClick={() => handleCreateNote(false)}
                className="btn-solid-primary py-2 px-4 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Crear Primera Nota</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Standalone Graph Tab */}
        {mobileTab === 'graph' && (
          <div className="lg:hidden col-span-1 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {activeNote ? `Grafo Local: ${activeNote.title}` : 'Grafo de Notas'}
              </span>
              <button
                type="button"
                onClick={() => setMobileTab('editor')}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Ir al Editor →
              </button>
            </div>
            {activeNote ? (
              <LocalGraphWidget
                entityId={activeNote.id}
                catalog={catalog}
                relations={relations}
                onNavigate={onNavigate}
                privacyMode={privacyMode}
              />
            ) : (
              <div className="card-swiss p-8 text-center text-xs text-[var(--text-secondary)]">
                Selecciona una nota para ver sus conexiones en el grafo local.
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Delete Note Confirmation Modal with Backlink Warning */}
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

            {noteToDeleteBacklinksCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-semibold">Atención con los enlaces:</span> Esta nota tiene{' '}
                  <span className="font-bold">{noteToDeleteBacklinksCount}</span> enlace(s) entrante(s) desde otros elementos que quedarán rotos.
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
    </div>
  );
};

export default NotesView;
