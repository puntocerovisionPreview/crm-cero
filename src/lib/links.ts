// Parser and resolution utility for [[WikiLinks]] in .Cero CRM
import { taskBelongsToProject } from '../utils/taskProject';

export type LinkEntityType = 
  | 'nota' 
  | 'tarea' 
  | 'proyecto' 
  | 'cliente' 
  | 'reunion' 
  | 'objetivo' 
  | 'habito' 
  | 'ingreso'
  | 'tag'
  | 'resumen-tareas'
  | 'finanza-personal';

export type NodeShapeType = 'circle' | 'rounded-rect' | 'diamond' | 'capsule' | 'hexagon';

export interface LinkCatalogItem {
  id: string;
  type: LinkEntityType;
  title: string;
  subtitle?: string;
  path: string;
  date?: string;
  folder?: string;
  tags?: string[];
  meta?: Record<string, any>;
}

export interface ParsedLink {
  raw: string; // e.g. "[[Estudio Cane|Cane]]"
  targetTitle: string; // "Estudio Cane"
  alias?: string; // "Cane"
  displayText: string; // "Cane" or "Estudio Cane"
  startIndex: number;
  endIndex: number;
}

export interface LinkRelation {
  id: string;
  sourceId: string;
  sourceType: LinkEntityType;
  sourceTitle: string;
  targetId: string;
  targetType: LinkEntityType;
  targetTitle: string;
  alias?: string;
  isStructural?: boolean; // true for task->project, etc.
  weight?: number; // count of mentions
  createdAt?: string;
}

export interface GraphNode {
  id: string;
  title: string;
  type: LinkEntityType;
  shape: NodeShapeType;
  path: string;
  connectionCount: number;
  radius: number;
  folder?: string;
  tags?: string[];
  isOrphan?: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  isStructural: boolean;
  weight: number;
  label?: string;
}

/**
 * Normalizes title for strict, accent-agnostic and symbol-agnostic comparison.
 * e.g. "Adán García" -> "adan garcia"
 */
export function normalizeEntityTitle(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // replace symbols and punctuation with spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Extracts [[WikiLinks]] from text, ignoring markdown code blocks (```...```) and inline code (`...`).
 * Supports aliases: [[Title|Display Text]].
 */
export function extractWikiLinks(text: string): ParsedLink[] {
  if (!text || typeof text !== 'string') return [];

  // Identify code block ranges to ignore
  const ignoreRanges: { start: number; end: number }[] = [];

  // Triple backtick code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;
  let cbMatch: RegExpExecArray | null;
  while ((cbMatch = codeBlockRegex.exec(text)) !== null) {
    ignoreRanges.push({ start: cbMatch.index, end: cbMatch.index + cbMatch[0].length });
  }

  // Single backtick inline code
  const inlineCodeRegex = /`[^`\n]+`/g;
  let icMatch: RegExpExecArray | null;
  while ((icMatch = inlineCodeRegex.exec(text)) !== null) {
    ignoreRanges.push({ start: icMatch.index, end: icMatch.index + icMatch[0].length });
  }

  const isInsideIgnoreRange = (index: number) => {
    return ignoreRanges.some(range => index >= range.start && index < range.end);
  };

  // Match [[...]]
  const linkRegex = /\[\[([^[\]\n\r]+)\]\]/g;
  const results: ParsedLink[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;

    if (isInsideIgnoreRange(startIndex)) {
      continue;
    }

    const inside = match[1].trim();
    if (!inside) continue;

    let targetTitle = inside;
    let alias: string | undefined = undefined;

    if (inside.includes('|')) {
      const parts = inside.split('|');
      targetTitle = parts[0].trim();
      alias = parts.slice(1).join('|').trim();
    }

    results.push({
      raw: match[0],
      targetTitle,
      alias,
      displayText: alias || targetTitle,
      startIndex,
      endIndex,
    });
  }

  return results;
}

/**
 * Resolves a targetTitle against a catalog of items with exact normalized comparison.
 * Returns null if no match or if multiple duplicate entities match (to avoid false automatic links).
 */
export function resolveEntityByTitle(
  title: string,
  catalog: LinkCatalogItem[]
): LinkCatalogItem | null {
  if (!title || !catalog || catalog.length === 0) return null;
  const normalizedQuery = normalizeEntityTitle(title);
  if (!normalizedQuery) return null;

  const matches = catalog.filter(item => normalizeEntityTitle(item.title) === normalizedQuery);

  // Exact unique match
  if (matches.length === 1) {
    return matches[0];
  }

  // If multiple exist with exact same name, avoid ambiguity
  if (matches.length > 1) {
    return null;
  }

  return null;
}

/**
 * Helper to determine standard geometric node shape by entity type.
 */
export function getNodeShape(type: LinkEntityType): NodeShapeType {
  switch (type) {
    case 'nota':
      return 'circle';
    case 'finanza-personal':
    case 'proyecto':
    case 'cliente':
      return 'rounded-rect';
    case 'objetivo':
      return 'diamond';
    case 'tag':
      return 'capsule';
    case 'resumen-tareas':
      return 'hexagon';
    default:
      return 'circle';
  }
}

/**
 * Builds the complete unified catalog of linkable entities from CRM data.
 * Supports both an object argument or positional arrays.
 */
export function buildLinkCatalog(
  dataOrNotes: any,
  tasksArg?: any[],
  projectsArg?: any[],
  weeklyGoalsOrMeetings?: any[],
  meetingsOrGoals?: any[],
  incomesArg?: any[]
): LinkCatalogItem[] {
  const catalog: LinkCatalogItem[] = [];
  const tagSet = new Set<string>();

  let notes: any[] = [];
  let tasks: any[] = [];
  let projects: any[] = [];
  let meetings: any[] = [];
  let weeklyGoals: any[] = [];
  let incomes: any[] = [];

  if (Array.isArray(dataOrNotes)) {
    notes = dataOrNotes;
    tasks = tasksArg || [];
    projects = projectsArg || [];
    if (weeklyGoalsOrMeetings && weeklyGoalsOrMeetings.length > 0) {
      if ('date' in weeklyGoalsOrMeetings[0] || 'time' in weeklyGoalsOrMeetings[0]) {
        meetings = weeklyGoalsOrMeetings;
      } else {
        weeklyGoals = weeklyGoalsOrMeetings;
      }
    }
    if (meetingsOrGoals && meetingsOrGoals.length > 0) {
      if ('category' in meetingsOrGoals[0]) {
        weeklyGoals = meetingsOrGoals;
      } else {
        meetings = meetingsOrGoals;
      }
    }
    incomes = incomesArg || [];
  } else if (dataOrNotes && typeof dataOrNotes === 'object') {
    notes = dataOrNotes.notes || [];
    tasks = dataOrNotes.tasks || [];
    projects = dataOrNotes.projects || [];
    meetings = dataOrNotes.meetings || [];
    weeklyGoals = dataOrNotes.weeklyGoals || [];
    incomes = dataOrNotes.incomes || [];
    if (dataOrNotes.personalTransactions && Array.isArray(dataOrNotes.personalTransactions)) {
      dataOrNotes.personalTransactions.forEach((pt: any) => {
        if (pt && (pt.note || pt.amount)) {
          const title = pt.note ? `Movimiento: ${pt.note}` : `Movimiento ${pt.currency} $${pt.amount}`;
          catalog.push({
            id: pt.id,
            type: 'finanza-personal',
            title,
            subtitle: `${pt.type} · ${pt.currency} $${pt.amount} · ${pt.date}`,
            path: '/mis-finanzas/movimientos',
            date: pt.date,
            meta: { amount: pt.amount, currency: pt.currency, type: pt.type },
          });
        }
      });
    }
  }

  // Notes
  notes.forEach(n => {
    if (n && n.title) {
      catalog.push({
        id: n.id,
        type: 'nota',
        title: n.title,
        subtitle: n.date ? `Nota · ${n.date}` : 'Nota',
        path: `/notas?id=${n.id}`,
        date: n.date,
        folder: n.folder,
        tags: n.tags || [],
      });
      if (Array.isArray(n.tags)) {
        n.tags.forEach((t: string) => {
          if (t && t.trim()) tagSet.add(t.trim().replace(/^#/, ''));
        });
      }
    }
  });

  // Projects & Clients
  projects.forEach(p => {
    if (p && p.clientName) {
      const isPaf = p.serviceType === 'paf';
      catalog.push({
        id: p.id,
        type: isPaf ? 'cliente' : 'proyecto',
        title: p.clientName,
        subtitle: isPaf ? 'Cliente PAF' : 'Proyecto Web / Estudio',
        path: `/clientes/${p.id}`,
        date: p.startDate || p.deliveryDate,
      });
    }
  });

  // Tasks
  tasks.forEach(t => {
    if (t && t.title) {
      catalog.push({
        id: t.id,
        type: 'tarea',
        title: t.title,
        subtitle: t.projectName ? `Tarea · ${t.projectName}` : (t.date ? `Tarea · ${t.date}` : 'Tarea'),
        path: `/agenda/tarea/${t.id}`,
        date: t.date,
        meta: { completed: Boolean(t.completed) },
      });
    }
  });

  // Meetings
  meetings.forEach(m => {
    if (m && m.title) {
      catalog.push({
        id: m.id,
        type: 'reunion',
        title: m.title,
        subtitle: m.date ? `Reunión · ${m.date} ${m.time || ''}` : 'Reunión',
        path: `/agenda/reunion/${m.id}`,
        date: m.date,
        meta: { completed: Boolean(m.completed) },
      });
    }
  });

  // Goals
  weeklyGoals.forEach(g => {
    if (g && g.title) {
      catalog.push({
        id: g.id,
        type: 'objetivo',
        title: g.title,
        subtitle: g.category ? `Objetivo · ${g.category}` : 'Objetivo semanal',
        path: `/agenda`,
      });
    }
  });

  // Incomes
  incomes.forEach(i => {
    if (i && i.title) {
      catalog.push({
        id: i.id,
        type: 'ingreso',
        title: i.title,
        subtitle: i.amount ? `Cobro · $${i.amount}` : 'Cobro',
        path: `/finanzas`,
        date: i.date,
      });
    }
  });

  // Tag Entities (#tags)
  tagSet.forEach(tag => {
    catalog.push({
      id: `tag_${tag.toLowerCase()}`,
      type: 'tag',
      title: `#${tag}`,
      subtitle: `Etiqueta #${tag}`,
      path: `/notas?tag=${encodeURIComponent(tag)}`,
    });
  });

  return catalog;
}

/**
 * Builds nodes and edges for the graph visualization.
 */
export function buildGraph(
  catalog: LinkCatalogItem[],
  extractedLinks: LinkRelation[],
  options: {
    includeStructural?: boolean;
    includeTags?: boolean;
    collapseTasksByProject?: boolean;
    filterTypes?: LinkEntityType[];
    searchQuery?: string;
    showOrphans?: boolean;
    filterFolder?: string;
    filterTag?: string;
    filterDateRange?: '7d' | '30d' | 'all';
    focusNodeId?: string;
    focusDepth?: number;
  } = {}
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const {
    includeStructural = true,
    includeTags = false,
    collapseTasksByProject = false,
    filterTypes = [],
    searchQuery = '',
    showOrphans = true,
    filterFolder = '',
    filterTag = '',
    focusNodeId,
    focusDepth = 1,
  } = options;

  // 1. Connection counters and edge weight map
  const connectionCounts = new Map<string, number>();
  catalog.forEach(item => connectionCounts.set(item.id, 0));

  const validEdges: GraphEdge[] = [];
  const query = searchQuery.trim().toLowerCase();

  extractedLinks.forEach(rel => {
    if (!includeStructural && rel.isStructural) return;
    if (!includeTags && (rel.sourceType === 'tag' || rel.targetType === 'tag')) return;

    connectionCounts.set(rel.sourceId, (connectionCounts.get(rel.sourceId) || 0) + 1);
    connectionCounts.set(rel.targetId, (connectionCounts.get(rel.targetId) || 0) + 1);

    validEdges.push({
      id: rel.id,
      source: rel.sourceId,
      target: rel.targetId,
      isStructural: Boolean(rel.isStructural),
      weight: rel.weight || 1,
      label: rel.alias,
    });
  });

  // 2. Compute focus neighborhood if focusNodeId is present
  let focusNeighbors: Set<string> | null = null;
  if (focusNodeId) {
    focusNeighbors = new Set<string>();
    focusNeighbors.add(focusNodeId);

    let currentLayer = new Set<string>([focusNodeId]);
    for (let d = 0; d < focusDepth; d++) {
      const nextLayer = new Set<string>();
      validEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : e.source.id;
        const t = typeof e.target === 'string' ? e.target : e.target.id;
        if (currentLayer.has(s)) nextLayer.add(t);
        if (currentLayer.has(t)) nextLayer.add(s);
      });
      nextLayer.forEach(id => focusNeighbors!.add(id));
      currentLayer = nextLayer;
    }
  }

  // 3. Filter nodes
  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();

  catalog.forEach(item => {
    // Ignore tags if includeTags is false
    if (!includeTags && item.type === 'tag') {
      return;
    }

    // Type filter
    if (filterTypes.length > 0 && !filterTypes.includes(item.type)) {
      return;
    }

    // Folder filter (if entity is note)
    if (filterFolder && item.folder && item.folder !== filterFolder) {
      return;
    }

    // Tag filter
    if (filterTag && item.tags && !item.tags.includes(filterTag)) {
      return;
    }

    // Search filter
    if (query && !item.title.toLowerCase().includes(query)) {
      return;
    }

    const count = connectionCounts.get(item.id) || 0;
    const isOrphan = count === 0;

    if (!showOrphans && isOrphan) {
      return;
    }

    // Node radius: proportional to connections
    const baseRadius = item.type === 'tag' ? 7 : 9;
    const radius = Math.max(baseRadius, Math.min(26, baseRadius + Math.sqrt(count) * 3.5));

    const node: GraphNode = {
      id: item.id,
      title: item.title,
      type: item.type,
      shape: getNodeShape(item.type),
      path: item.path,
      connectionCount: count,
      radius,
      folder: item.folder,
      tags: item.tags,
      isOrphan,
    };

    nodes.push(node);
    nodeMap.set(item.id, node);
  });

  // 4. Keep only edges whose source and target both exist in visible nodes
  const activeEdges = validEdges.filter(
    e => nodeMap.has(e.source as string) && nodeMap.has(e.target as string)
  );

  return { nodes, edges: activeEdges };
}

/**
 * Extracts all relations from content texts in the app (notes, tasks, projects, meetings, etc.)
 * Strictly derived in-memory without persisting phantom edges.
 */
export function extractAllAppRelations(
  dataOrNotes: any,
  tasksArg?: any[],
  projectsArg?: any[],
  meetingsArg?: any[],
  incomesArg?: any[],
  catalogArg?: LinkCatalogItem[]
): LinkRelation[] {
  let notes: any[] = [];
  let tasks: any[] = [];
  let projects: any[] = [];
  let meetings: any[] = [];
  let incomes: any[] = [];
  let personalTransactions: any[] = [];
  let catalog: LinkCatalogItem[] = [];

  if (Array.isArray(dataOrNotes)) {
    notes = dataOrNotes;
    tasks = tasksArg || [];
    projects = projectsArg || [];
    meetings = meetingsArg || [];
    incomes = incomesArg || [];
    catalog = catalogArg || buildLinkCatalog(notes, tasks, projects, [], meetings, incomes);
  } else if (dataOrNotes && typeof dataOrNotes === 'object') {
    notes = dataOrNotes.notes || [];
    tasks = dataOrNotes.tasks || [];
    projects = dataOrNotes.projects || [];
    meetings = dataOrNotes.meetings || [];
    incomes = dataOrNotes.incomes || [];
    personalTransactions = dataOrNotes.personalTransactions || [];
    catalog = dataOrNotes.catalog || buildLinkCatalog({ notes, tasks, projects, meetings, incomes, personalTransactions });
  }

  const relations: LinkRelation[] = [];
  const relationMap = new Map<string, LinkRelation>();

  const addOrIncrementRelation = (rel: LinkRelation) => {
    if (rel.sourceId === rel.targetId) return;
    const key = `${rel.sourceId}->${rel.targetId}`;
    if (relationMap.has(key)) {
      const existing = relationMap.get(key)!;
      existing.weight = (existing.weight || 1) + 1;
    } else {
      relationMap.set(key, { ...rel, weight: 1 });
      relations.push(relationMap.get(key)!);
    }
  };

  // 1. WikiLinks in notes
  notes.forEach(note => {
    if (!note.content) return;
    const parsed = extractWikiLinks(note.content);
    parsed.forEach(p => {
      const target = resolveEntityByTitle(p.targetTitle, catalog);
      if (target) {
        addOrIncrementRelation({
          id: `link_${note.id}_${target.id}`,
          sourceId: note.id,
          sourceType: 'nota',
          sourceTitle: note.title,
          targetId: target.id,
          targetType: target.type,
          targetTitle: target.title,
          alias: p.alias,
          isStructural: false,
        });
      }
    });

    // Tag links for notes
    if (Array.isArray(note.tags)) {
      note.tags.forEach((t: string) => {
        if (!t) return;
        const tagEntity = catalog.find(c => c.id === `tag_${t.toLowerCase().replace(/^#/, '')}`);
        if (tagEntity) {
          addOrIncrementRelation({
            id: `tag_${note.id}_${tagEntity.id}`,
            sourceId: note.id,
            sourceType: 'nota',
            sourceTitle: note.title,
            targetId: tagEntity.id,
            targetType: 'tag',
            targetTitle: tagEntity.title,
            isStructural: true,
          });
        }
      });
    }
  });

  // 2. WikiLinks in project notes
  projects.forEach(proj => {
    if (!proj.notes) return;
    const parsed = extractWikiLinks(proj.notes);
    parsed.forEach(p => {
      const target = resolveEntityByTitle(p.targetTitle, catalog);
      if (target) {
        addOrIncrementRelation({
          id: `link_${proj.id}_${target.id}`,
          sourceId: proj.id,
          sourceType: 'proyecto',
          sourceTitle: proj.clientName,
          targetId: target.id,
          targetType: target.type,
          targetTitle: target.title,
          alias: p.alias,
          isStructural: false,
        });
      }
    });
  });

  // 3. WikiLinks in task titles & notes
  tasks.forEach(task => {
    const parsed = extractWikiLinks(task.title);
    parsed.forEach(p => {
      const target = resolveEntityByTitle(p.targetTitle, catalog);
      if (target) {
        addOrIncrementRelation({
          id: `link_${task.id}_${target.id}`,
          sourceId: task.id,
          sourceType: 'tarea',
          sourceTitle: task.title,
          targetId: target.id,
          targetType: target.type,
          targetTitle: target.title,
          alias: p.alias,
          isStructural: false,
        });
      }
    });
  });

  // 4. WikiLinks in meeting notes
  meetings.forEach(meeting => {
    if (!meeting.notes) return;
    const parsed = extractWikiLinks(meeting.notes);
    parsed.forEach(p => {
      const target = resolveEntityByTitle(p.targetTitle, catalog);
      if (target) {
        addOrIncrementRelation({
          id: `link_${meeting.id}_${target.id}`,
          sourceId: meeting.id,
          sourceType: 'reunion',
          sourceTitle: meeting.title,
          targetId: target.id,
          targetType: target.type,
          targetTitle: target.title,
          alias: p.alias,
          isStructural: false,
        });
      }
    });
  });

  // 5. Structural relations: Task -> Project (single source of truth)
  tasks.forEach(task => {
    const matchingProjects = projects.filter(p => taskBelongsToProject(task, p));

    // Only link if exactly 1 matching project (prevents false links on duplicate names)
    if (matchingProjects.length === 1) {
      const proj = matchingProjects[0];
      addOrIncrementRelation({
        id: `struct_${task.id}_${proj.id}`,
        sourceId: task.id,
        sourceType: 'tarea',
        sourceTitle: task.title,
        targetId: proj.id,
        targetType: proj.serviceType === 'paf' ? 'cliente' : 'proyecto',
        targetTitle: proj.clientName,
        isStructural: true,
      });
    }
  });

  // 6. Structural relations: Meeting -> Project / Client
  meetings.forEach(meeting => {
    const meetProjNorm = meeting.projectName ? normalizeEntityTitle(meeting.projectName) : normalizeEntityTitle(meeting.title);
    const matchingProjects = projects.filter(p => {
      if (meeting.projectId && p.id === meeting.projectId) return true;
      if (meetProjNorm && normalizeEntityTitle(p.clientName) === meetProjNorm) return true;
      return false;
    });

    if (matchingProjects.length === 1) {
      const proj = matchingProjects[0];
      addOrIncrementRelation({
        id: `struct_${meeting.id}_${proj.id}`,
        sourceId: meeting.id,
        sourceType: 'reunion',
        sourceTitle: meeting.title,
        targetId: proj.id,
        targetType: proj.serviceType === 'paf' ? 'cliente' : 'proyecto',
        targetTitle: proj.clientName,
        isStructural: true,
      });
    }
  });

  // 7. Structural relations: Income -> Project
  incomes.forEach(inc => {
    const incProjNorm = inc.projectName ? normalizeEntityTitle(inc.projectName) : '';
    const matchingProjects = projects.filter(p => {
      if (inc.projectId && p.id === inc.projectId) return true;
      if (incProjNorm && normalizeEntityTitle(p.clientName) === incProjNorm) return true;
      return false;
    });

    if (matchingProjects.length === 1) {
      const proj = matchingProjects[0];
      addOrIncrementRelation({
        id: `struct_${inc.id}_${proj.id}`,
        sourceId: inc.id,
        sourceType: 'ingreso',
        sourceTitle: inc.title,
        targetId: proj.id,
        targetType: proj.serviceType === 'paf' ? 'cliente' : 'proyecto',
        targetTitle: proj.clientName,
        isStructural: true,
      });
    }
  });

  // 8. Structural relations: Personal Transactions -> Project & Notes
  personalTransactions.forEach(pt => {
    if (pt.projectId) {
      const projItem = catalog.find(c => c.id === pt.projectId);
      if (projItem) {
        addOrIncrementRelation({
          id: `struct_pt_${pt.id}_${pt.projectId}`,
          sourceId: pt.id,
          sourceType: 'finanza-personal',
          sourceTitle: pt.note || `Movimiento ${pt.currency} $${pt.amount}`,
          targetId: pt.projectId,
          targetType: projItem.type,
          targetTitle: projItem.title,
          isStructural: true,
        });
      }
    }
    if (pt.noteId) {
      const noteItem = catalog.find(c => c.id === pt.noteId || normalizeEntityTitle(c.title) === normalizeEntityTitle(pt.noteId));
      if (noteItem) {
        addOrIncrementRelation({
          id: `struct_pt_${pt.id}_${noteItem.id}`,
          sourceId: pt.id,
          sourceType: 'finanza-personal',
          sourceTitle: pt.note || `Movimiento ${pt.currency} $${pt.amount}`,
          targetId: noteItem.id,
          targetType: noteItem.type,
          targetTitle: noteItem.title,
          isStructural: true,
        });
      }
    }
  });

  return relations;
}

/**
 * Finds all backlinks targeting a specific entity ID.
 */
export function getBacklinksForEntity(
  targetId: string,
  relations: LinkRelation[],
  catalog: LinkCatalogItem[]
): { sourceId: string; sourceType: LinkEntityType; sourceTitle: string; path: string; isStructural: boolean; weight: number }[] {
  return relations
    .filter(r => r.targetId === targetId)
    .map(r => {
      const cat = catalog.find(c => c.id === r.sourceId);
      return {
        sourceId: r.sourceId,
        sourceType: r.sourceType,
        sourceTitle: r.sourceTitle,
        path: cat?.path || '#',
        isStructural: Boolean(r.isStructural),
        weight: r.weight || 1,
      };
    });
}
