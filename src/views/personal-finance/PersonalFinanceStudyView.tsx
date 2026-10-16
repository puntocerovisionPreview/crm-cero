import React, { useState } from 'react';
import { 
  GraduationCap, 
  Plus, 
  BookOpen, 
  Cpu, 
  Layers, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  Trash2, 
  Edit3, 
  ArrowLeft, 
  FolderKanban, 
  TrendingUp,
  Brain,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { StudyItem, StudyItemKind, StudyItemStatus, Project, TimeLog } from '../../types';
import { calculateStudyInvestmentMetrics, formatPersonalAmount } from '../../utils/personalFinance';
import { hapticFeedback } from '../../utils/haptics';

interface Props {
  studyItems: StudyItem[];
  projects: Project[];
  timeLogs: TimeLog[];
  privacyMode: boolean;
  usdRate: number;
  onSaveStudyItem: (item: Omit<StudyItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateStudyItem: (id: string, updates: Partial<StudyItem>) => Promise<void>;
  onDeleteStudyItem: (id: string) => Promise<void>;
  onNavigate: (path: string) => void;
}

const KIND_LABELS: Record<StudyItemKind, { label: string; icon: any; color: string }> = {
  curso: { label: 'Curso / Mentoría', icon: GraduationCap, color: '#a855f7' },
  libro: { label: 'Libro / Lectura', icon: BookOpen, color: '#3b82f6' },
  herramienta: { label: 'Herramienta / Software', icon: Cpu, color: '#06b6d4' },
  suscripcion: { label: 'Suscripción de Estudio', icon: Layers, color: '#f59e0b' },
  certificacion: { label: 'Certificación Oficial', icon: CheckCircle2, color: '#10b981' },
  otro: { label: 'Otro Material', icon: BookOpen, color: '#a1a1aa' },
};

const STATUS_CONFIG: Record<StudyItemStatus, { label: string; badgeClass: string }> = {
  planeado: { label: 'Planeado', badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  'en curso': { label: 'En Curso', badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  terminado: { label: 'Terminado', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

export const PersonalFinanceStudyView: React.FC<Props> = ({
  studyItems,
  projects,
  timeLogs,
  privacyMode,
  usdRate,
  onSaveStudyItem,
  onUpdateStudyItem,
  onDeleteStudyItem,
  onNavigate,
}) => {
  const [filterStatus, setFilterStatus] = useState<StudyItemStatus | 'todos'>('todos');
  const [filterKind, setFilterKind] = useState<StudyItemKind | 'todos'>('todos');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<StudyItemKind>('curso');
  const [status, setStatus] = useState<StudyItemStatus>('en curso');
  const [totalCostStr, setTotalCostStr] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [hoursInvestedStr, setHoursInvestedStr] = useState('0');
  const [projectId, setProjectId] = useState('');
  const [noteId, setNoteId] = useState('');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');

  const metrics = calculateStudyInvestmentMetrics(studyItems, timeLogs, usdRate);

  const filteredItems = studyItems.filter(item => {
    if (filterStatus !== 'todos' && item.status !== filterStatus) return false;
    if (filterKind !== 'todos' && item.kind !== filterKind) return false;
    return true;
  });

  const openNewForm = () => {
    hapticFeedback.light();
    setEditingId(null);
    setTitle('');
    setKind('curso');
    setStatus('en curso');
    setTotalCostStr('');
    setCurrency('ARS');
    setHoursInvestedStr('0');
    setProjectId('');
    setNoteId('');
    setLink('');
    setNotes('');
    setIsEditing(true);
  };

  const openEditForm = (item: StudyItem) => {
    hapticFeedback.light();
    setEditingId(item.id);
    setTitle(item.title);
    setKind(item.kind);
    setStatus(item.status);
    setTotalCostStr(item.totalCost ? String(item.totalCost) : '');
    setCurrency(item.currency);
    setHoursInvestedStr(String(item.hoursInvested || 0));
    setProjectId(item.projectId || '');
    setNoteId(item.noteId || '');
    setLink(item.link || '');
    setNotes(item.notes || '');
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    hapticFeedback.medium();
    const cost = parseFloat(totalCostStr.replace(',', '.')) || 0;
    const hours = parseFloat(hoursInvestedStr.replace(',', '.')) || 0;
    const selectedProj = projects.find(p => p.id === projectId);

    const payload = {
      title: title.trim(),
      kind,
      status,
      totalCost: cost,
      currency,
      hoursInvested: hours,
      projectId: projectId || undefined,
      projectName: selectedProj ? selectedProj.clientName : undefined,
      noteId: noteId.trim() || undefined,
      link: link.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (editingId) {
      await onUpdateStudyItem(editingId, payload);
    } else {
      await onSaveStudyItem(payload);
    }

    setIsEditing(false);
    setEditingId(null);
  };

  // Full-page edit/creation panel (Swiss mobile-first)
  if (isEditing) {
    return (
      <div className="w-full max-w-xl mx-auto space-y-4 animate-in fade-in">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-zinc-100">
              {editingId ? 'Editar Formación' : 'Nueva Inversión en Estudio'}
            </h2>
            <p className="text-xs text-zinc-400">
              Seguimiento de cursos, libros y certificaciones
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Título o Nombre del Estudio *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Curso de TypeScript Avanzado, Libro Clean Code..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* Kind & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Tipo
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as StudyItemKind)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-purple-500 transition"
              >
                {Object.entries(KIND_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudyItemStatus)}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-purple-500 transition"
              >
                <option value="planeado">Planeado</option>
                <option value="en curso">En Curso</option>
                <option value="terminado">Terminado</option>
              </select>
            </div>
          </div>

          {/* Cost & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Costo Total Invertido
              </label>
              <input
                type="number"
                step="any"
                value={totalCostStr}
                onChange={(e) => setTotalCostStr(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-sm focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Moneda
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrency('ARS')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${
                    currency === 'ARS' ? 'bg-purple-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  ARS
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${
                    currency === 'USD' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          {/* Hours Dedicated */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Horas Dedicadas (Manual o acumuladas)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                value={hoursInvestedStr}
                onChange={(e) => setHoursInvestedStr(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-sm focus:outline-none focus:border-purple-500 transition pl-10"
              />
              <Clock className="w-4 h-4 text-purple-400 absolute left-3.5 top-3" />
            </div>
          </div>

          {/* Project Link */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Vincular con Proyecto / Cliente .Cero (Opcional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-purple-500 transition"
            >
              <option value="">Ninguno (Formación general)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.clientName} ({p.projectType || 'Proyecto'})
                </option>
              ))}
            </select>
          </div>

          {/* Note Link (Second Brain) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Nota del Segundo Cerebro ([[link]] opcional)
            </label>
            <input
              type="text"
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              placeholder="Ej: [[Resumen TypeScript]] o título de la nota"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* URL Link */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Enlace Web / Plataforma
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Notas & Comentarios
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Puntos clave, temario, objetivos..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-900/30"
            >
              {editingId ? 'Guardar Cambios' : 'Registrar Estudio'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 animate-in fade-in">
      
      {/* 1. Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-purple-400" />
            <h1 className="text-lg font-black tracking-tight text-zinc-100">
              Inversión en Estudio
            </h1>
          </div>
          <p className="text-xs text-zinc-400">
            Formación continua, desarrollo profesional y costo/hora de estudio
          </p>
        </div>

        <button
          type="button"
          onClick={openNewForm}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nuevo Estudio</span>
        </button>
      </div>

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Total Invertido
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-purple-400">
            {formatPersonalAmount(metrics.normalizedTotalARS, 'ARS', privacyMode)}
          </p>
          <span className="text-[10px] text-zinc-400 block">
            {metrics.totalInvestedUSD > 0 && `(incl. US$ ${metrics.totalInvestedUSD})`}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Horas Dedicadas
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-zinc-100">
            {metrics.totalHoursStudied} hs
          </p>
          <span className="text-[10px] text-zinc-400 block">
            {metrics.completedCount} terminados / {metrics.inProgressCount} en curso
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Costo por Hora
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-amber-400">
            {formatPersonalAmount(metrics.averageCostPerHourARS, 'ARS', privacyMode)}
            <span className="text-xs text-zinc-400 font-sans">/h</span>
          </p>
          <span className="text-[10px] text-zinc-400 block">
            Inversión real vs tiempo
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Programas Activos
          </span>
          <p className="text-base sm:text-lg font-black font-mono text-emerald-400">
            {metrics.inProgressCount}
          </p>
          <span className="text-[10px] text-zinc-400 block">
            de {metrics.totalItems} registrados
          </span>
        </div>
      </div>

      {/* 3. Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterStatus('todos')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
            filterStatus === 'todos' 
              ? 'bg-purple-600 text-white' 
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Todos ({studyItems.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('en curso')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
            filterStatus === 'en curso' 
              ? 'bg-purple-600 text-white' 
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          En Curso ({studyItems.filter(s => s.status === 'en curso').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('planeado')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
            filterStatus === 'planeado' 
              ? 'bg-purple-600 text-white' 
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Planeados ({studyItems.filter(s => s.status === 'planeado').length})
        </button>
        <button
          type="button"
          onClick={() => setFilterStatus('terminado')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
            filterStatus === 'terminado' 
              ? 'bg-purple-600 text-white' 
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Terminados ({studyItems.filter(s => s.status === 'terminado').length})
        </button>
      </div>

      {/* 4. Study Items List */}
      {filteredItems.length === 0 ? (
        <div className="p-8 rounded-3xl bg-zinc-950/60 border border-zinc-800/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-zinc-200">
            No hay programas de estudio con este filtro
          </p>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Registrá tus cursos, libros, herramientas o certificaciones para medir tu inversión formativa.
          </p>
          <button
            type="button"
            onClick={openNewForm}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Primer Estudio</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => {
            const kindMeta = KIND_LABELS[item.kind] || KIND_LABELS.otro;
            const statusMeta = STATUS_CONFIG[item.status] || STATUS_CONFIG.planeado;
            const KindIcon = kindMeta.icon;

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700/80 transition space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                      style={{ 
                        backgroundColor: `${kindMeta.color}15`, 
                        borderColor: `${kindMeta.color}35`,
                        color: kindMeta.color 
                      }}
                    >
                      <KindIcon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-zinc-100 truncate">
                          {item.title}
                        </h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.badgeClass}`}>
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
                        <span className="font-medium text-zinc-300">
                          {kindMeta.label}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-purple-400 font-mono">
                          <Clock className="w-3 h-3" />
                          {item.hoursInvested || 0} hs
                        </span>
                        {item.projectName && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-[#E8590C]">
                              <FolderKanban className="w-3 h-3" />
                              {item.projectName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold font-mono text-zinc-100 block">
                      {formatPersonalAmount(item.totalCost, item.currency, privacyMode)}
                    </span>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          hapticFeedback.medium();
                          onDeleteStudyItem(item.id);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 transition cursor-pointer"
                        title="Borrar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Links & Notes */}
                {(item.noteId || item.link || item.notes) && (
                  <div className="pt-2 border-t border-zinc-900 flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2 truncate">
                      {item.noteId && (
                        <button
                          type="button"
                          onClick={() => onNavigate('/segundo-cerebro')}
                          className="inline-flex items-center gap-1 text-purple-400 hover:underline"
                        >
                          <Brain className="w-3 h-3" />
                          <span>{item.noteId}</span>
                        </button>
                      )}
                      {item.notes && (
                        <span className="text-zinc-400 truncate">
                          {item.notes}
                        </span>
                      )}
                    </div>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 shrink-0"
                      >
                        <span>Ver</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
