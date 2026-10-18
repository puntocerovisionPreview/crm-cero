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
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-[28px] leading-tight font-bold text-[var(--text-primary)] font-heading">Grafo</h2>
          <p className="text-[15px] text-[var(--text-secondary)] mt-0.5">
            Cómo se conectan tus notas, clientes, proyectos y tareas.{' '}
            <span className="text-[var(--text-tertiary)] tabular-nums">
              {catalog.length} elementos · {relations.length} conexiones
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              setShowGuideModal(true);
            }}
            className="h-9 px-3.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] font-medium text-[var(--accent)] flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" aria-hidden />
            <span>Cómo funciona</span>
          </button>
          <button
            type="button"
            onClick={() => {
              hapticFeedback.light();
              if (onNavigate) onNavigate('/notas');
            }}
            className="h-9 px-3.5 rounded-full bg-[var(--accent)] text-white text-[14px] font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" aria-hidden />
            <span>Notas</span>
          </button>
        </div>
      </div>

      {/* Main Graph Component */}
      <KnowledgeGraphCanvas
        catalog={catalog}
        relations={relations}
        onNavigate={onNavigate}
        height="calc(100dvh - 230px)"
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
