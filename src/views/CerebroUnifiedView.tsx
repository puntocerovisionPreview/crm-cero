import React, { useState, useEffect } from 'react';
import { SecondBrainNote, AgendaTask, Project, WeeklyGoal, AgendaMeeting, IncomeRecord, ExpenseRecord } from '../types';
import { SecondBrainView } from './SecondBrainView';
import { NotesView } from './NotesView';
import { hapticFeedback } from '../utils/haptics';
import { 
  Brain, 
  FileText, 
  Network, 
  Search, 
  Plus, 
  Sparkles,
  BookOpen
} from 'lucide-react';
import { todayLocal } from '../utils/dates';

const KnowledgeGraphView = React.lazy(() => import('./KnowledgeGraphView'));

interface Props {
  initialTab?: 'inicio' | 'notas' | 'grafo';
  tasks: AgendaTask[];
  projects: Project[];
  weeklyGoals: WeeklyGoal[];
  notes?: SecondBrainNote[];
  meetings?: AgendaMeeting[];
  incomes?: IncomeRecord[];
  expenses?: ExpenseRecord[];
  onAddNote?: (note: Omit<SecondBrainNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateNote?: (id: string, updates: Partial<SecondBrainNote>) => void;
  onDeleteNote?: (id: string) => void;
  onToggleTask?: (id: string) => void;
  onNavigate?: (path: string) => void;
}

export const CerebroUnifiedView: React.FC<Props> = ({
  initialTab = 'inicio',
  tasks,
  projects,
  weeklyGoals,
  notes = [],
  meetings = [],
  incomes = [],
  expenses = [],
  onAddNote = () => {},
  onUpdateNote = () => {},
  onDeleteNote = () => {},
  onToggleTask = () => {},
  onNavigate = () => {},
}) => {
  const [activeTab, setActiveTab] = useState<'inicio' | 'notas' | 'grafo'>(initialTab);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* Top Header with Global Search and Tabs */}
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-2.5 space-y-2.5 safe-area-top-header">
        <div className="flex items-center justify-between gap-3">
          {/* Tabs: Inicio · Notas · Grafo */}
          <div className="flex p-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setActiveTab('inicio');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold transition cursor-pointer ${
                activeTab === 'inicio'
                  ? 'btn-solid-primary shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Inicio</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setActiveTab('notas');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold transition cursor-pointer ${
                activeTab === 'notas'
                  ? 'btn-solid-primary shadow-xs'
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
                setActiveTab('grafo');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-control)] text-xs font-semibold transition cursor-pointer ${
                activeTab === 'grafo'
                  ? 'btn-solid-primary shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Grafo</span>
            </button>
          </div>

          {/* Quick New Note Button */}
          <button
            type="button"
            onClick={() => {
              hapticFeedback.medium();
              onAddNote({
                title: 'Nueva nota',
                content: '',
                date: todayLocal(),
                tags: ['idea'],
                pinned: false,
                linkedEntityTitles: [],
              });
              setActiveTab('notas');
            }}
            className="min-h-[44px] sm:min-h-[32px] px-3 py-1.5 rounded-[var(--radius-control)] btn-solid-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs shrink-0"
            title="Crear nota con [[WikiLinks]]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
            <span>Nueva nota</span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            aria-label="Buscar en el conocimiento"
            placeholder="Buscar en el conocimiento, notas, tareas o escribir [[link]]..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--text-primary)] transition"
          />
        </div>
      </div>

      {/* Sub-view Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'inicio' && (
          <SecondBrainView
            tasks={tasks}
            projects={projects}
            weeklyGoals={weeklyGoals}
            notes={notes}
            onAddNote={onAddNote}
            onUpdateNote={onUpdateNote}
            onDeleteNote={onDeleteNote}
            onToggleTask={onToggleTask}
            onNavigate={(p) => {
              if (p === '/notas') setActiveTab('notas');
              else if (p === '/grafo') setActiveTab('grafo');
              else onNavigate(p);
            }}
          />
        )}

        {activeTab === 'notas' && (
          <NotesView
            notes={notes}
            tasks={tasks}
            meetings={meetings}
            projects={projects}
            weeklyGoals={weeklyGoals}
            onAddNote={onAddNote}
            onUpdateNote={onUpdateNote}
            onDeleteNote={onDeleteNote}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === 'grafo' && (
          <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center p-12 text-xs text-[var(--text-secondary)]">
              Cargando grafo interactivo de conocimiento…
            </div>
          }>
            <KnowledgeGraphView
              notes={notes}
              tasks={tasks}
              meetings={meetings}
              projects={projects}
              incomes={incomes}
              expenses={expenses}
              weeklyGoals={weeklyGoals}
              onNavigate={onNavigate}
            />
          </React.Suspense>
        )}
      </div>
    </div>
  );
};
