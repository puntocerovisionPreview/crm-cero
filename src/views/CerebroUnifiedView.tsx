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
      <div className="sticky top-0 z-20 bg-[var(--bg-app)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-4 py-2.5 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Tabs: Inicio · Notas · Grafo */}
          <div className="flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setActiveTab('inicio');
              }}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200 cursor-pointer ${
                activeTab === 'inicio'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
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
              className={`flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200 cursor-pointer ${
                activeTab === 'notas'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
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
              className={`flex items-center gap-1.5 px-3 h-8 rounded-[8px] text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200 cursor-pointer ${
                activeTab === 'grafo'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
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
            className="min-h-[44px] sm:min-h-[36px] px-3.5 rounded-full bg-[var(--accent)] text-white text-[14px] font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
            title="Crear nota con [[WikiLinks]]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2]" />
            <span>Nueva nota</span>
          </button>
        </div>

        {/* Global Search Bar (el grafo trae su propio buscador) */}
        <div className={`relative ${activeTab === 'grafo' ? 'hidden' : ''}`}>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            aria-label="Buscar en el conocimiento"
            placeholder="Buscar en el conocimiento, notas, tareas o escribir [[link]]..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="ios-search w-full h-9 pl-9 pr-3 rounded-[10px] border-0 bg-[var(--bg-surface-muted)]/70 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition"
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
