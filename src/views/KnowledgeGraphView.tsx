import React, { useMemo } from 'react';
import { 
  AgendaTask, 
  AgendaMeeting, 
  Project, 
  IncomeRecord, 
  ExpenseRecord, 
  WeeklyGoal, 
  SecondBrainNote,
  PersonalTransaction
} from '../types';
import { 
  buildLinkCatalog, 
  extractAllAppRelations, 
  LinkRelation 
} from '../lib/links';
import { KnowledgeGraphCanvas } from '../components/KnowledgeGraphCanvas';
import { Network, Plus, FileText, ArrowLeft, BookOpen } from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { SecondBrainGuideModal } from '../components/SecondBrainGuideModal';

interface Props {
  tasks: AgendaTask[];
  meetings: AgendaMeeting[];
  projects: Project[];
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  weeklyGoals: WeeklyGoal[];
  notes: SecondBrainNote[];
  personalTransactions?: PersonalTransaction[];
  storedRelations?: LinkRelation[];
  onNavigate?: (path: string) => void;
  privacyMode?: boolean;
}

export const KnowledgeGraphView: React.FC<Props> = ({
  tasks,
  meetings,
  projects,
  incomes,
  expenses,
  weeklyGoals,
  notes,
  personalTransactions = [],
  storedRelations,
  onNavigate,
  privacyMode,
}) => {
  // Build dynamic catalog from all active entities
  const catalog = useMemo(() => {
    return buildLinkCatalog({
      notes,
      tasks,
      projects,
      meetings,
      weeklyGoals,
      incomes,
      personalTransactions,
    });
  }, [notes, tasks, projects, meetings, weeklyGoals, incomes, personalTransactions]);

  const [showGuideModal, setShowGuideModal] = React.useState(false);

  // Extract all relations (wiki links + structural)
  const relations = useMemo(() => {
    const extracted = extractAllAppRelations({
      notes,
      tasks,
      projects,
      meetings,
      incomes,
      personalTransactions,
      catalog,
    });

    if (storedRelations && storedRelations.length > 0) {
      // Merge unique stored relations
      const map = new Map<string, LinkRelation>();
      extracted.forEach(r => map.set(`${r.sourceId}->${r.targetId}`, r));
      storedRelations.forEach(r => map.set(`${r.sourceId}->${r.targetId}`, r));
      return Array.from(map.values());
    }

    return extracted;
  }, [notes, tasks, projects, meetings, incomes, personalTransactions, catalog, storedRelations]);

  return (
    <div className="w-full space-y-4">
      {/* Top Header */}
      <div className="card-swiss p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-swiss text-[11px] font-bold">Base de Conocimiento</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              {catalog.length} entidades · {relations.length} relaciones
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] font-heading tracking-tight mt-1">
            Grafo Interactivo de Relaciones
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Visualiza conexiones entre notas, clientes PAF, proyectos web, tareas y reuniones. Usa <code className="font-mono text-[var(--text-primary)] bg-[var(--bg-surface-muted)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">[[Nombre]]</code> para crear nuevos enlaces.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowGuideModal(true);
            }}
            className="btn-swiss-secondary py-2 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
            title="Ver guía visual de cómo usar el segundo cerebro y grafo"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-500" />
            <span>¿Cómo funciona?</span>
          </button>
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              if (onNavigate) onNavigate('/notas');
            }}
            className="btn-swiss-secondary py-2 px-3 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Ver Notas</span>
          </button>
        </div>
      </div>

      {/* Main Graph Component */}
      <KnowledgeGraphCanvas
        catalog={catalog}
        relations={relations}
        onNavigate={onNavigate}
        height="calc(100vh - 220px)"
        privacyMode={privacyMode}
      />

      {/* Guide Modal */}
      <SecondBrainGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
};

export default KnowledgeGraphView;
