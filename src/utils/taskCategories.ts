// Task Category & Reordering helpers aligned with Daily Allocation Buckets
// This guarantees 100% backward compatibility with existing Firestore & LocalStorage tasks.

import { 
  Video, 
  Scissors, 
  FileText, 
  Laptop, 
  MessageSquare, 
  Target, 
  Coffee,
  CheckSquare
} from 'lucide-react';
import { DailyAllocationBucketId, TaskPriority, AgendaTask } from '../types';

export interface TaskCategoryConfig {
  id: DailyAllocationBucketId | 'general';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBg: string;
  cardBorder: string;
  cardBorderHover: string;
  cardBorderLeft: string;
  glowHover: string;
}

export const TASK_CATEGORIES: Record<DailyAllocationBucketId | 'general', TaskCategoryConfig> = {
  grabacion: {
    id: 'grabacion',
    label: 'Grabación',
    icon: Video,
    accentColor: '#EF4444',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/30',
    cardBg: 'bg-rose-950/30',
    cardBorder: 'border-rose-800/40',
    cardBorderHover: 'hover:border-rose-600/70 hover:bg-rose-950/40',
    cardBorderLeft: 'border-l-rose-500',
    glowHover: 'hover:border-rose-500/40',
  },
  edicion: {
    id: 'edicion',
    label: 'Edición',
    icon: Scissors,
    accentColor: '#EC4899',
    badgeBg: 'bg-pink-500/20',
    badgeText: 'text-pink-300',
    badgeBorder: 'border-pink-500/30',
    cardBg: 'bg-pink-950/30',
    cardBorder: 'border-pink-800/40',
    cardBorderHover: 'hover:border-pink-600/70 hover:bg-pink-950/40',
    cardBorderLeft: 'border-l-pink-500',
    glowHover: 'hover:border-pink-500/40',
  },
  guion: {
    id: 'guion',
    label: 'Guion',
    icon: FileText,
    accentColor: '#06B6D4',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    badgeBorder: 'border-cyan-500/30',
    cardBg: 'bg-cyan-950/30',
    cardBorder: 'border-cyan-800/40',
    cardBorderHover: 'hover:border-cyan-600/70 hover:bg-cyan-950/40',
    cardBorderLeft: 'border-l-cyan-500',
    glowHover: 'hover:border-cyan-500/40',
  },
  foco: {
    id: 'foco',
    label: 'Foco / Web',
    icon: Laptop,
    accentColor: '#3B82F6',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    badgeBorder: 'border-blue-500/30',
    cardBg: 'bg-blue-950/30',
    cardBorder: 'border-blue-800/40',
    cardBorderHover: 'hover:border-blue-600/70 hover:bg-blue-950/40',
    cardBorderLeft: 'border-l-blue-500',
    glowHover: 'hover:border-blue-500/40',
  },
  gestion: {
    id: 'gestion',
    label: 'Gestión',
    icon: MessageSquare,
    accentColor: '#10B981',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    cardBg: 'bg-emerald-950/30',
    cardBorder: 'border-emerald-800/40',
    cardBorderHover: 'hover:border-emerald-600/70 hover:bg-emerald-950/40',
    cardBorderLeft: 'border-l-emerald-500',
    glowHover: 'hover:border-emerald-500/40',
  },
  estrategia: {
    id: 'estrategia',
    label: 'Estrategia',
    icon: Target,
    accentColor: '#8B5CF6',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    badgeBorder: 'border-purple-500/30',
    cardBg: 'bg-purple-950/30',
    cardBorder: 'border-purple-800/40',
    cardBorderHover: 'hover:border-purple-600/70 hover:bg-purple-950/40',
    cardBorderLeft: 'border-l-purple-500',
    glowHover: 'hover:border-purple-500/40',
  },
  buffer: {
    id: 'buffer',
    label: 'Buffer',
    icon: Coffee,
    accentColor: '#F59E0B',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-amber-500/30',
    cardBg: 'bg-amber-950/30',
    cardBorder: 'border-amber-800/40',
    cardBorderHover: 'hover:border-amber-600/70 hover:bg-amber-950/40',
    cardBorderLeft: 'border-l-amber-500',
    glowHover: 'hover:border-amber-500/40',
  },
  general: {
    id: 'general',
    label: 'General',
    icon: CheckSquare,
    accentColor: '#71717A',
    badgeBg: 'bg-zinc-800/80',
    badgeText: 'text-zinc-300',
    badgeBorder: 'border-zinc-700/60',
    cardBg: 'bg-zinc-900/80',
    cardBorder: 'border-zinc-800',
    cardBorderHover: 'hover:border-zinc-700 hover:bg-zinc-900',
    cardBorderLeft: 'border-l-zinc-600',
    glowHover: 'hover:border-zinc-700',
  },
};

export const TASK_PRIORITIES: Record<TaskPriority, { label: string; color: string; badge: string }> = {
  alta: {
    label: 'Alta',
    color: '#EF4444',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  media: {
    label: 'Media',
    color: '#F59E0B',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  baja: {
    label: 'Baja',
    color: '#71717A',
    badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  },
};

// Automatic detection of category by keywords if none was explicitly set
export function inferTaskCategory(title: string): DailyAllocationBucketId | undefined {
  const t = title.toLowerCase();
  
  if (t.includes('video') || t.includes('edit') || t.includes('premiere') || t.includes('render') || t.includes('corte') || t.includes('color') || t.includes('audio') || t.includes('reel') || t.includes('tiktok') || t.includes('youtube')) {
    return 'edicion';
  }
  if (t.includes('grabar') || t.includes('grabacion') || t.includes('rodaje') || t.includes('camara') || t.includes('toma') || t.includes('iluminac')) {
    return 'grabacion';
  }
  if (t.includes('guion') || t.includes('copy') || t.includes('texto') || t.includes('redact') || t.includes('brief') || t.includes('idea') || t.includes('hook') || t.includes('escaleta')) {
    return 'guion';
  }
  if (t.includes('web') || t.includes('program') || t.includes('codigo') || t.includes('figma') || t.includes('desarroll') || t.includes('landing') || t.includes('diseñ') || t.includes('bug') || t.includes('deploy')) {
    return 'foco';
  }
  if (t.includes('prospect') || t.includes('cliente') || t.includes('onboarding') || t.includes('mensaje') || t.includes('mail') || t.includes('llamar') || t.includes('whatsapp') || t.includes('form') || t.includes('reunion') || t.includes('follow')) {
    return 'gestion';
  }
  if (t.includes('estrateg') || t.includes('paf') || t.includes('consultor') || t.includes('plan') || t.includes('meta') || t.includes('lanzam') || t.includes('vsl') || t.includes('funnel') || t.includes('precio')) {
    return 'estrategia';
  }
  return undefined;
}

// Helper to get category config with fallback
export function getTaskCategoryConfig(taskOrCategory?: AgendaTask | DailyAllocationBucketId | 'general'): TaskCategoryConfig {
  if (!taskOrCategory) return TASK_CATEGORIES.general;

  if (typeof taskOrCategory === 'string') {
    if (TASK_CATEGORIES[taskOrCategory as DailyAllocationBucketId | 'general']) {
      return TASK_CATEGORIES[taskOrCategory as DailyAllocationBucketId | 'general'];
    }
    return TASK_CATEGORIES.general;
  }

  const task = taskOrCategory;
  if (task.category && TASK_CATEGORIES[task.category]) {
    return TASK_CATEGORIES[task.category];
  }
  // If no category stored, try automatic inference so existing tasks look categorized
  const inferred = inferTaskCategory(task.title);
  if (inferred && TASK_CATEGORIES[inferred]) {
    return TASK_CATEGORIES[inferred];
  }
  return TASK_CATEGORIES.general;
}

// Sort day tasks preserving custom user order first, then time, then createdAt
export function sortTasksWithCustomOrder(tasks: AgendaTask[]): AgendaTask[] {
  return [...tasks].sort((a, b) => {
    // 1. Completed tasks always go to bottom unless both are completed
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }

    // 2. Explicit user order index (if defined)
    const hasOrderA = typeof a.orderIndex === 'number';
    const hasOrderB = typeof b.orderIndex === 'number';

    if (hasOrderA && hasOrderB) {
      return (a.orderIndex as number) - (b.orderIndex as number);
    }
    if (hasOrderA) return -1;
    if (hasOrderB) return 1;

    // 3. Time assigned (HH:MM) if both have time
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    if (a.time) return -1;
    if (b.time) return 1;

    // 4. Default by creation date / ID
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}
