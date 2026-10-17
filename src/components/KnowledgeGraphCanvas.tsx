import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { 
  forceSimulation, 
  forceManyBody, 
  forceLink, 
  forceCenter, 
  forceCollide, 
  SimulationNodeDatum, 
  SimulationLinkDatum 
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, ZoomTransform } from 'd3-zoom';
import { drag } from 'd3-drag';
import { 
  GraphNode, 
  GraphEdge, 
  LinkCatalogItem, 
  LinkEntityType, 
  LinkRelation, 
  buildGraph, 
  getBacklinksForEntity,
  getNodeShape
} from '../lib/links';
import { 
  Search, 
  Filter, 
  Maximize2, 
  Minimize2,
  RotateCcw, 
  ArrowUpRight, 
  X, 
  FileText, 
  CheckSquare, 
  Building2, 
  Briefcase, 
  Calendar, 
  Target, 
  Zap,
  HelpCircle,
  Eye,
  EyeOff,
  Layers,
  Sliders,
  Bookmark,
  Plus,
  Table,
  CircleDot,
  Compass,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Sparkles,
  Network
} from 'lucide-react';
import { hapticFeedback } from '../utils/haptics';
import { SecondBrainGuideModal } from './SecondBrainGuideModal';

interface Props {
  catalog: LinkCatalogItem[];
  relations: LinkRelation[];
  onNavigate?: (path: string) => void;
  height?: number | string;
  focusNodeId?: string;
  privacyMode?: boolean;
}

interface SimulationNode extends GraphNode, SimulationNodeDatum {}
interface SimulationLink extends SimulationLinkDatum<SimulationNode> {
  id: string;
  isStructural: boolean;
  weight: number;
  label?: string;
}

interface SavedGraphView {
  id: string;
  name: string;
  viewMode: 'knowledge' | 'classic';
  filterTypes: LinkEntityType[];
  showOrphans: boolean;
  includeStructural: boolean;
  includeTags: boolean;
  focusDepth: number;
}

const STORAGE_SAVED_VIEWS = 'cero_v3_saved_graph_views';

function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

export const KnowledgeGraphCanvas: React.FC<Props> = ({
  catalog,
  relations,
  onNavigate,
  height = '600px',
  focusNodeId,
  privacyMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // View Preset: "knowledge" (Clean default: Notes, Projects, PAF, Goals) vs "classic" (All loose nodes)
  const [viewMode, setViewMode] = useState<'knowledge' | 'classic'>('knowledge');
  const [quickPreset, setQuickPreset] = useState<'clients_notes' | 'knowledge' | 'clients_finances' | 'all'>('knowledge');
  const [displayFormat, setDisplayFormat] = useState<'canvas' | 'table'>('canvas');
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layer toggles
  const [showTasks, setShowTasks] = useState(true);
  const [showMeetings, setShowMeetings] = useState(false);
  const [showIncomes, setShowIncomes] = useState(true);
  const [showPersonalFinance, setShowPersonalFinance] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showOrphans, setShowOrphans] = useState(true);
  const [includeStructural, setIncludeStructural] = useState(true);

  // Focus & Depth State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(focusNodeId || null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusDepth, setFocusDepth] = useState<number>(1); // 1, 2 or 3 jumps

  // Physics tuning state
  const [repulsionStrength, setRepulsionStrength] = useState<number>(180);
  const [linkDistance, setLinkDistance] = useState<number>(85);
  const [showPhysicsControls, setShowPhysicsControls] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  // UI Panels
  const [showOrphansPanel, setShowOrphansPanel] = useState(false);
  const [showSavedViewsModal, setShowSavedViewsModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // Handle Fullscreen escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Saved Views in LocalStorage
  const [savedViews, setSavedViews] = useState<SavedGraphView[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SAVED_VIEWS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      {
        id: 'view_clients_notes',
        name: 'Clientes & Notas',
        viewMode: 'knowledge',
        filterTypes: ['nota', 'proyecto', 'cliente'],
        showOrphans: false,
        includeStructural: true,
        includeTags: false,
        focusDepth: 1,
      },
      {
        id: 'view_knowledge',
        name: 'Conocimiento Puro',
        viewMode: 'knowledge',
        filterTypes: ['nota', 'proyecto', 'cliente', 'objetivo'],
        showOrphans: false,
        includeStructural: true,
        includeTags: false,
        focusDepth: 1,
      },
      {
        id: 'view_all',
        name: 'Ecosistema Completo',
        viewMode: 'classic',
        filterTypes: [],
        showOrphans: true,
        includeStructural: true,
        includeTags: true,
        focusDepth: 2,
      },
    ];
  });

  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  transformRef.current = transform;

  // Active filter types based on quickPreset, viewMode and toggles
  const activeFilterTypes = useMemo<LinkEntityType[]>(() => {
    if (quickPreset === 'clients_notes') {
      return ['cliente', 'proyecto', 'nota'];
    }
    if (quickPreset === 'clients_finances') {
      return ['cliente', 'proyecto', 'nota', 'ingreso'];
    }
    if (quickPreset === 'all' || viewMode === 'classic') {
      return showPersonalFinance ? [] : ['nota', 'tarea', 'proyecto', 'cliente', 'reunion', 'objetivo', 'habito', 'ingreso', 'tag', 'resumen-tareas'];
    }
    // 'knowledge'
    const types: LinkEntityType[] = ['nota', 'proyecto', 'cliente', 'objetivo'];
    if (showTasks) types.push('tarea');
    if (showMeetings) types.push('reunion');
    if (showIncomes) types.push('ingreso');
    if (showTags) types.push('tag');
    if (showPersonalFinance) types.push('finanza-personal');
    return types;
  }, [quickPreset, viewMode, showTasks, showMeetings, showIncomes, showPersonalFinance, showTags]);

  // Zoom handlers for touch and controls
  const handleZoomIn = () => {
    hapticFeedback.light();
    const current = transformRef.current;
    const newK = Math.min(current.k * 1.35, 8);
    const newTransform = zoomIdentity.translate(current.x, current.y).scale(newK);
    setTransform(newTransform);
    transformRef.current = newTransform;
    draw();
  };

  const handleZoomOut = () => {
    hapticFeedback.light();
    const current = transformRef.current;
    const newK = Math.max(current.k / 1.35, 0.15);
    const newTransform = zoomIdentity.translate(current.x, current.y).scale(newK);
    setTransform(newTransform);
    transformRef.current = newTransform;
    draw();
  };

  const handleResetZoom = () => {
    hapticFeedback.light();
    setTransform(zoomIdentity);
    transformRef.current = zoomIdentity;
    draw();
  };

  // Compute filtered graph nodes and edges
  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    return buildGraph(catalog, relations, {
      includeStructural,
      includeTags: showTags,
      filterTypes: activeFilterTypes,
      searchQuery,
      showOrphans: viewMode === 'classic' ? true : showOrphans,
      filterFolder: selectedFolder,
      filterTag: selectedTag,
      focusNodeId: selectedNodeId || undefined,
      focusDepth,
    });
  }, [
    catalog, 
    relations, 
    includeStructural, 
    showTags, 
    activeFilterTypes, 
    searchQuery, 
    viewMode, 
    showOrphans, 
    selectedFolder, 
    selectedTag, 
    selectedNodeId, 
    focusDepth
  ]);

  // Orphans list for review panel
  const orphansList = useMemo(() => {
    const counts = new Map<string, number>();
    catalog.forEach(item => counts.set(item.id, 0));
    relations.forEach(r => {
      counts.set(r.sourceId, (counts.get(r.sourceId) || 0) + 1);
      counts.set(r.targetId, (counts.get(r.targetId) || 0) + 1);
    });
    return catalog.filter(item => (counts.get(item.id) || 0) === 0);
  }, [catalog, relations]);

  // Simulation references
  const simulationRef = useRef<any>(null);
  const simNodesRef = useRef<SimulationNode[]>([]);
  const simLinksRef = useRef<SimulationLink[]>([]);
  const isSimulationFrozenRef = useRef(false);

  // Selected & Hovered node details
  const selectedNode = useMemo(() => {
    return catalog.find(item => item.id === selectedNodeId) || null;
  }, [catalog, selectedNodeId]);

  // Compute active focus neighborhood with n-depth
  const activeNeighborhood = useMemo(() => {
    const rootId = selectedNodeId || hoveredNodeId;
    if (!rootId) return null;

    const neighbors = new Set<string>();
    neighbors.add(rootId);

    let currentLayer = new Set<string>([rootId]);
    const depthLimit = selectedNodeId ? focusDepth : 1;

    for (let d = 0; d < depthLimit; d++) {
      const nextLayer = new Set<string>();
      rawEdges.forEach(e => {
        const s = typeof e.source === 'string' ? e.source : (e.source as any).id;
        const t = typeof e.target === 'string' ? e.target : (e.target as any).id;
        if (currentLayer.has(s)) nextLayer.add(t);
        if (currentLayer.has(t)) nextLayer.add(s);
      });
      nextLayer.forEach(id => neighbors.add(id));
      currentLayer = nextLayer;
    }

    return neighbors;
  }, [selectedNodeId, hoveredNodeId, focusDepth, rawEdges]);

  // Monochromatic Neutral Palette
  const getNodeColor = useCallback((type: LinkEntityType, isSelected: boolean, isNeighbor: boolean) => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isSelected) {
      return isDark ? '#FFFFFF' : '#09090B';
    }
    if (isNeighbor) {
      return isDark ? '#E4E4E7' : '#18181B';
    }
    // Grayscale neutrals by entity hierarchy
    switch (type) {
      case 'nota':
        return isDark ? '#71717A' : '#A1A1AA';
      case 'proyecto':
      case 'cliente':
        return isDark ? '#A1A1AA' : '#52525B';
      case 'objetivo':
        return isDark ? '#D4D4D8' : '#3F3F46';
      case 'tag':
        return isDark ? '#52525B' : '#71717A';
      case 'finanza-personal':
        return isDark ? '#10B981' : '#059669';
      default:
        return isDark ? '#71717A' : '#A1A1AA';
    }
  }, []);

  // Sync simulation nodes with position preservation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const existingPos = new Map<string, { x: number; y: number; vx: number; vy: number; fx?: number | null; fy?: number | null }>();
    simNodesRef.current.forEach(n => {
      if (typeof n.x === 'number' && typeof n.y === 'number') {
        existingPos.set(n.id, { x: n.x, y: n.y, vx: n.vx || 0, vy: n.vy || 0, fx: n.fx, fy: n.fy });
      }
    });

    const newSimNodes: SimulationNode[] = rawNodes.map((n, i) => {
      const prev = existingPos.get(n.id);
      if (prev) {
        return { ...n, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy, fx: prev.fx, fy: prev.fy };
      }
      const angle = (i / Math.max(1, rawNodes.length)) * 2 * Math.PI;
      const radius = 100 + Math.random() * 80;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      };
    });

    const newSimLinks: SimulationLink[] = rawEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      isStructural: e.isStructural,
      weight: e.weight,
      label: e.label,
    }));

    simNodesRef.current = newSimNodes;
    simLinksRef.current = newSimLinks;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    if (prefersReducedMotion) {
      const sim = forceSimulation<SimulationNode>(newSimNodes)
        .force('link', forceLink<SimulationNode, SimulationLink>(newSimLinks).id(d => d.id).distance(linkDistance))
        .force('charge', forceManyBody().strength(-repulsionStrength))
        .force('center', forceCenter(width / 2, height / 2))
        .force('collide', forceCollide<SimulationNode>().radius(d => d.radius + 6))
        .stop();
      for (let i = 0; i < 70; ++i) sim.tick();
      draw();
      return;
    }

    // Fast-cooling simulation to prevent jitters and save battery
    const sim = forceSimulation<SimulationNode>(newSimNodes)
      .force('link', forceLink<SimulationNode, SimulationLink>(newSimLinks).id(d => d.id).distance(linkDistance))
      .force('charge', forceManyBody().strength(-repulsionStrength))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimulationNode>().radius(d => d.radius + 6))
      .alphaDecay(0.04);

    isSimulationFrozenRef.current = false;

    sim.on('tick', () => {
      draw();
      if (sim.alpha() < 0.005) {
        sim.stop();
        isSimulationFrozenRef.current = true;
      }
    });

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [rawNodes, rawEdges, repulsionStrength, linkDistance]);

  // Main Canvas render loop with Culling and High-DPI support
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) return;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const t = transformRef.current;
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const isDark = document.documentElement.classList.contains('dark');
    const nodes = simNodesRef.current;
    const links = simLinksRef.current;
    const activeSet = activeNeighborhood;

    // Visible bounding box for text culling in screen space
    const minX = -t.x / t.k - 50;
    const maxX = (width - t.x) / t.k + 50;
    const minY = -t.y / t.k - 50;
    const maxY = (height - t.y) / t.k + 50;

    // 1. Draw Edges
    links.forEach(link => {
      const source = link.source as SimulationNode;
      const target = link.target as SimulationNode;
      if (!source || !target || typeof source.x !== 'number' || typeof target.x !== 'number') return;

      const isConnectedToActive = activeSet
        ? (activeSet.has(source.id) && activeSet.has(target.id))
        : false;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (link.isStructural) {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      if (activeSet) {
        if (isConnectedToActive) {
          ctx.strokeStyle = isDark ? '#F4F4F5' : '#18181B';
          ctx.lineWidth = Math.min(3, 1.4 + (link.weight - 1) * 0.5);
          ctx.globalAlpha = 0.95;
        } else {
          ctx.strokeStyle = isDark ? '#27272A' : '#E4E4E7';
          ctx.lineWidth = 0.7;
          ctx.globalAlpha = 0.12;
        }
      } else {
        ctx.strokeStyle = isDark ? '#3F3F46' : '#D4D4D8';
        ctx.lineWidth = link.isStructural ? 0.8 : Math.min(2.5, 1.1 + (link.weight - 1) * 0.4);
        ctx.globalAlpha = link.isStructural ? 0.45 : 0.65;
      }

      ctx.stroke();
    });

    ctx.setLineDash([]);

    // 2. Draw Nodes
    nodes.forEach(node => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;
      const isNeighbor = activeSet ? activeSet.has(node.id) : false;

      if (activeSet) {
        ctx.globalAlpha = (isSelected || isHovered || isNeighbor) ? 1.0 : 0.12;
      } else {
        ctx.globalAlpha = 1.0;
      }

      const color = getNodeColor(node.type, isSelected, isNeighbor);
      const r = node.radius;

      // Selection Halo
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4.5, 0, 2 * Math.PI);
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)';
        ctx.fill();
        ctx.strokeStyle = isDark ? '#FFFFFF' : '#09090B';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      // Geometric Shape Render
      ctx.fillStyle = color;
      ctx.strokeStyle = isDark ? '#27272A' : '#E4E4E7';
      ctx.lineWidth = 1;

      if (node.shape === 'rounded-rect') {
        const side = r * 1.7;
        const corner = 4;
        ctx.beginPath();
        safeRoundRect(ctx, node.x - side / 2, node.y - side / 2, side, side, corner);
        ctx.fill();
        ctx.stroke();
      } else if (node.shape === 'diamond') {
        const side = r * 1.3;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y - side);
        ctx.lineTo(node.x + side, node.y);
        ctx.lineTo(node.x, node.y + side);
        ctx.lineTo(node.x - side, node.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (node.shape === 'capsule') {
        const w = r * 2.2;
        const h = r * 1.1;
        ctx.beginPath();
        safeRoundRect(ctx, node.x - w / 2, node.y - h / 2, w, h, h / 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Circle (default)
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }

      // 3. Node Labels (Culling outside viewport & visibility with zoom or hover/selected)
      const isVisibleInViewport = node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY;
      const showLabel = isVisibleInViewport && (t.k >= 0.72 || isSelected || isHovered || isNeighbor);

      if (showLabel) {
        ctx.font = isSelected ? '600 11px system-ui, sans-serif' : '400 10px system-ui, sans-serif';
        ctx.fillStyle = isDark ? '#F4F4F5' : '#18181B';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const titleText = node.title.length > 24 ? node.title.slice(0, 22) + '…' : node.title;
        ctx.fillText(titleText, node.x, node.y + r + 4);
      }
    });

    ctx.restore();
  }, [activeNeighborhood, selectedNodeId, hoveredNodeId, getNodeColor]);

  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Trigger draw on hover / selection / neighborhood changes
  useEffect(() => {
    draw();
  }, [draw]);

  // D3 Zoom & Drag interaction (attached stably without churn on hover)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Node hit testing helper
    const getNodeAt = (screenX: number, screenY: number): SimulationNode | null => {
      const rect = canvas.getBoundingClientRect();
      const clickX = screenX - rect.left;
      const clickY = screenY - rect.top;

      const t = transformRef.current;
      const canvasX = (clickX - t.x) / t.k;
      const canvasY = (clickY - t.y) / t.k;

      for (let i = simNodesRef.current.length - 1; i >= 0; i--) {
        const node = simNodesRef.current[i];
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          const dx = canvasX - node.x;
          const dy = canvasY - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= Math.max(24, node.radius + 6)) {
            return node;
          }
        }
      }
      return null;
    };

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 5])
      .filter((event) => {
        // Allow zoom/pan unless user is starting a drag on a specific node
        if (event.type === 'pointerdown' || event.type === 'mousedown' || event.type === 'touchstart') {
          const clientX = event.clientX ?? (event.touches ? event.touches[0]?.clientX : 0);
          const clientY = event.clientY ?? (event.touches ? event.touches[0]?.clientY : 0);
          const node = getNodeAt(clientX, clientY);
          return !node; // If node hit, let dragBehavior handle it
        }
        return true;
      })
      .on('zoom', (event) => {
        setTransform(event.transform);
        transformRef.current = event.transform;
        drawRef.current();
      });

    const selection = select(canvas);
    selection.call(zoomBehavior as any);

    // Drag behavior (only activates when starting on a node)
    const dragBehavior = drag<HTMLCanvasElement, unknown>()
      .filter((event) => {
        if (event.button !== undefined && event.button !== 0) return false;
        const source = event.sourceEvent || event;
        const clientX = source.clientX ?? (source.touches ? source.touches[0]?.clientX : event.x);
        const clientY = source.clientY ?? (source.touches ? source.touches[0]?.clientY : event.y);
        const node = getNodeAt(clientX, clientY);
        return !!node;
      })
      .subject((event) => {
        const source = event.sourceEvent || event;
        const clientX = source.clientX ?? (source.touches ? source.touches[0]?.clientX : event.x);
        const clientY = source.clientY ?? (source.touches ? source.touches[0]?.clientY : event.y);
        const node = getNodeAt(clientX, clientY);
        return node || undefined;
      })
      .on('start', (event) => {
        if (!event.subject) return;
        hapticFeedback.selection();
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0.3).restart();
        }
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on('drag', (event) => {
        if (!event.subject) return;
        const source = event.sourceEvent || event;
        const clientX = source.clientX ?? (source.touches ? source.touches[0]?.clientX : event.x);
        const clientY = source.clientY ?? (source.touches ? source.touches[0]?.clientY : event.y);
        const rect = canvas.getBoundingClientRect();
        const t = transformRef.current;
        event.subject.fx = (clientX - rect.left - t.x) / t.k;
        event.subject.fy = (clientY - rect.top - t.y) / t.k;
        drawRef.current();
      })
      .on('end', (event) => {
        if (!event.subject) return;
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }
        setSelectedNodeId(event.subject.id);
        drawRef.current();
      });

    selection.call(dragBehavior as any);

    // Double click to release pinned node
    const handleDblClick = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node) {
        hapticFeedback.light();
        node.fx = null;
        node.fy = null;
        if (simulationRef.current) {
          simulationRef.current.alpha(0.15).restart();
        }
      }
    };

    // Hover hit test
    const handleMouseMove = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      setHoveredNodeId(node ? node.id : null);
      drawRef.current();
    };

    // Click selection
    const handleClick = (e: MouseEvent) => {
      const node = getNodeAt(e.clientX, e.clientY);
      if (node) {
        hapticFeedback.medium();
        setSelectedNodeId(node.id);
      }
    };

    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    // Resize observer to handle container resizes and view switches smoothly
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w > 0 && h > 0) {
          if (simulationRef.current) {
            simulationRef.current.force('center', forceCenter(w / 2, h / 2));
            simulationRef.current.alpha(0.08).restart();
          }
          drawRef.current();
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    const handleWinResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0 && simulationRef.current) {
        simulationRef.current.force('center', forceCenter(w / 2, h / 2));
        simulationRef.current.alpha(0.05).restart();
      }
      drawRef.current();
    };
    window.addEventListener('resize', handleWinResize);

    return () => {
      canvas.removeEventListener('dblclick', handleDblClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleWinResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Pause simulation when container is hidden, or redraw on tab switch
  useEffect(() => {
    if (displayFormat === 'canvas') {
      requestAnimationFrame(() => {
        draw();
      });
    }
  }, [displayFormat, draw]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && simulationRef.current) {
        simulationRef.current.stop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Save current view preset
  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) return;
    const newView: SavedGraphView = {
      id: `view_${Date.now()}`,
      name: newViewName.trim(),
      viewMode,
      filterTypes: activeFilterTypes,
      showOrphans,
      includeStructural,
      includeTags: showTags,
      focusDepth,
    };
    const updated = [...savedViews, newView];
    setSavedViews(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_VIEWS, JSON.stringify(updated));
    } catch {}
    setNewViewName('');
    setShowSavedViewsModal(false);
    hapticFeedback.success();
  };

  const handleApplySavedView = (view: SavedGraphView) => {
    setViewMode(view.viewMode);
    setShowOrphans(view.showOrphans);
    setIncludeStructural(view.includeStructural);
    setShowTags(view.includeTags);
    setFocusDepth(view.focusDepth);
    setShowTasks(view.filterTypes.includes('tarea'));
    setShowMeetings(view.filterTypes.includes('reunion'));
    setShowIncomes(view.filterTypes.includes('ingreso'));
    setShowSavedViewsModal(false);
    hapticFeedback.light();
  };

  // Backlinks of currently selected node
  const selectedBacklinks = useMemo(() => {
    if (!selectedNodeId) return [];
    return getBacklinksForEntity(selectedNodeId, relations, catalog);
  }, [selectedNodeId, relations, catalog]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden flex flex-col font-sans select-none transition-[color,background-color,border-color,opacity,box-shadow,transform,width,stroke-dashoffset] ${
        isFullscreen ? '!fixed !inset-0 !z-50 !rounded-none !h-screen !w-screen !border-none' : ''
      }`}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* 1. Control Header Bar (Sobrio / Swiss Minimal) */}
      <div className="p-2.5 sm:p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-app)] flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 z-20">
        
        {/* Left: Quick Presets (Clientes & Notas, Conocimiento, Cobros, Todo) & Canvas/Table */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
          {/* Quick Filter Presets */}
          <div className="flex p-0.5 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs font-medium shrink-0">
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setQuickPreset('clients_notes');
                setShowOrphans(false);
              }}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-[11px] sm:text-xs whitespace-nowrap ${
                quickPreset === 'clients_notes'
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Solo ver Clientes y sus Notas asociadas"
            >
              Clientes & Notas
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setQuickPreset('knowledge');
                setShowOrphans(false);
              }}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-[11px] sm:text-xs whitespace-nowrap ${
                quickPreset === 'knowledge'
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Notas, Proyectos, Clientes y Metas"
            >
              Conocimiento
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setQuickPreset('clients_finances');
                setShowOrphans(false);
              }}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-[11px] sm:text-xs whitespace-nowrap ${
                quickPreset === 'clients_finances'
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Clientes, Proyectos y Cobros"
            >
              Cobros
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.selection();
                setQuickPreset('all');
                setViewMode('classic');
                setShowOrphans(true);
              }}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer text-[11px] sm:text-xs whitespace-nowrap ${
                quickPreset === 'all'
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Todos los nodos del ecosistema"
            >
              Todo
            </button>
          </div>

          {/* Canvas vs Table Toggle */}
          <div className="flex p-0.5 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] text-xs shrink-0">
            <button
              type="button"
              onClick={() => setDisplayFormat('canvas')}
              className={`p-1 rounded-md transition cursor-pointer ${
                displayFormat === 'canvas' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-tertiary)]'
              }`}
              title="Vista Canvas Grafo"
            >
              <CircleDot className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDisplayFormat('table')}
              className={`p-1 rounded-md transition cursor-pointer ${
                displayFormat === 'table' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-tertiary)]'
              }`}
              title="Vista Tabla Accesible"
            >
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="text-[11px] font-mono text-[var(--text-secondary)] pl-1 whitespace-nowrap hidden sm:inline">
            {rawNodes.length} nodos · {rawEdges.length} enlaces
          </div>
        </div>

        {/* Center & Right Controls */}
        <div className="flex items-center gap-2 justify-between lg:justify-end">
          {/* Search input */}
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en la red…"
              className="w-full bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Guide Button */}
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setShowGuideModal(true);
              }}
              className="px-2 py-1 rounded-lg bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer font-medium"
              title="Guía: Cómo usar el 2° Cerebro y el Grafo"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-500" />
              <span className="hidden sm:inline">¿Cómo funciona?</span>
            </button>

            {/* Saved Views Button */}
            <button
              type="button"
              onClick={() => setShowSavedViewsModal(true)}
              className="px-2 py-1 rounded-lg bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
              title="Vistas Guardadas"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Vistas</span>
            </button>

            {/* Physics Tuning Toggle */}
            <button
              type="button"
              onClick={() => setShowPhysicsControls(prev => !prev)}
              className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                showPhysicsControls
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-transparent'
                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
              title="Ajustar Físicas d3"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Reset Zoom & Pan */}
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] cursor-pointer"
              title="Recentrar vista"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setIsFullscreen(prev => !prev);
              }}
              className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                isFullscreen
                  ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] border-transparent'
                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
              title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Optional Layer Toggles Bar (Subtle Strip) */}
      <div className="px-3 py-1.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)] gap-2 z-10 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono uppercase text-[var(--text-tertiary)] mr-1">Capas:</span>
          
          <button
            type="button"
            onClick={() => setShowTasks(prev => !prev)}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
              showTasks
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-strong)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Tareas
          </button>

          <button
            type="button"
            onClick={() => setShowMeetings(prev => !prev)}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
              showMeetings
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-strong)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Reuniones
          </button>

          <button
            type="button"
            onClick={() => setShowIncomes(prev => !prev)}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
              showIncomes
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-strong)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Cobros
          </button>

          <button
            type="button"
            onClick={() => setShowPersonalFinance(prev => !prev)}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
              showPersonalFinance
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-strong)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Finanzas Personales
          </button>

          <button
            type="button"
            onClick={() => setShowTags(prev => !prev)}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
              showTags
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-strong)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            #Tags
          </button>

          <button
            type="button"
            onClick={() => setIncludeStructural(prev => !prev)}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
              includeStructural
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-[var(--border-strong)]'
                : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
            title="Líneas punteadas automáticas"
          >
            Estructurales
          </button>
        </div>

        {/* Orphans reviewer toggle button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowOrphansPanel(prev => !prev)}
            className={`px-2 py-0.5 rounded-md text-[11px] transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
              showOrphansPanel
                ? 'bg-[var(--bg-surface-muted)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span>Huérfanos ({orphansList.length})</span>
          </button>
        </div>
      </div>

      {/* 3. Focus Active Banner (with depth adjuster & exit button) */}
      {selectedNodeId && (
        <div className="absolute top-24 left-3 z-30 px-3 py-1.5 rounded-xl bg-[var(--bg-app)]/95 border border-[var(--border-subtle)] shadow-md backdrop-blur-sm flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150 max-w-[90vw]">
          <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-medium truncate">
            <span className="w-2 h-2 rounded-full bg-[var(--solid-contrast-bg)] shrink-0" />
            <span className="truncate max-w-[140px]">{selectedNode?.title || 'Elemento'}</span>
          </div>

          <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-2 text-[11px] text-[var(--text-secondary)] shrink-0">
            <span>Saltos:</span>
            {[1, 2, 3].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setFocusDepth(d)}
                className={`px-1.5 py-0.2 rounded font-mono cursor-pointer ${
                  focusDepth === d ? 'bg-[var(--solid-contrast-bg)] text-[var(--solid-contrast-text)] font-bold' : 'hover:text-[var(--text-primary)]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSelectedNodeId(null)}
            className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] ml-1 cursor-pointer shrink-0"
            title="Salir del modo foco"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. Physics Tuning Floating Drawer */}
      {showPhysicsControls && (
        <div className="absolute top-24 right-3 z-30 w-64 p-4 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] shadow-xl text-xs space-y-3 animate-in fade-in duration-100">
          <div className="flex items-center justify-between font-semibold text-[var(--text-primary)]">
            <span>Físicas de la Red</span>
            <button
              type="button"
              onClick={() => setShowPhysicsControls(false)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
              <span>Repulsión:</span>
              <span className="font-mono">{repulsionStrength}</span>
            </div>
            <input
              type="range"
              min="50"
              max="400"
              value={repulsionStrength}
              onChange={e => setRepulsionStrength(Number(e.target.value))}
              className="w-full h-1 bg-[var(--bg-surface-muted)] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
              <span>Distancia de resortes:</span>
              <span className="font-mono">{linkDistance}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="200"
              value={linkDistance}
              onChange={e => setLinkDistance(Number(e.target.value))}
              className="w-full h-1 bg-[var(--bg-surface-muted)] rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* 5. Main Canvas Display with Floating Zoom / Touch Controls */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`w-full h-full cursor-grab active:cursor-grabbing touch-none ${
            displayFormat === 'canvas' ? 'block' : 'hidden'
          }`}
        />

        {/* Empty state when no nodes match current filter */}
        {displayFormat === 'canvas' && rawNodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-[var(--bg-app)]/85 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)] mb-3">
              <Network className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              No hay elementos visibles en el grafo
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
              Puedes cambiar el preset a &quot;Todo&quot; o activar elementos sin conexiones para explorar notas, proyectos, tareas y cobros.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  hapticFeedback.light();
                  setQuickPreset('all');
                  setViewMode('classic');
                  setShowOrphans(true);
                  setShowTasks(true);
                  setShowIncomes(true);
                  setSearchQuery('');
                  setSelectedFolder('');
                  setSelectedTag('');
                }}
                className="btn-solid-primary text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer active:scale-98"
              >
                Mostrar todos los nodos
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="btn-swiss-secondary text-xs font-medium px-3 py-1.5 rounded-xl cursor-pointer"
              >
                Ver cómo conectar notas
              </button>
            </div>
          </div>
        )}

        {/* Floating Controls for Mobile Touch & Quick Zoom */}
        {displayFormat === 'canvas' && (
          <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 bg-[var(--bg-app)]/90 backdrop-blur-md p-1 rounded-xl border border-[var(--border-subtle)] shadow-lg">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
              title="Acercar (Zoom In)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
              title="Alejar (Zoom Out)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
              title="Recentrar vista"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setIsFullscreen(prev => !prev);
              }}
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition cursor-pointer"
              title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Accessible Table View */}
      {displayFormat === 'table' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[var(--bg-surface)]">
          <div className="text-xs font-semibold text-[var(--text-primary)] mb-2">
            Vista Estructurada y Accesible de Nodos ({rawNodes.length})
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono text-[11px]">
                <th className="py-2">Tipo</th>
                <th className="py-2">Título</th>
                <th className="py-2 text-right">Conexiones</th>
                <th className="py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rawNodes.map(node => (
                <tr key={node.id} className="hover:bg-[var(--bg-surface-muted)]/50">
                  <td className="py-2 capitalize text-[var(--text-secondary)] font-mono text-[11px]">
                    {node.type}
                  </td>
                  <td className="py-2 font-medium text-[var(--text-primary)]">
                    {node.title}
                  </td>
                  <td className="py-2 text-right font-mono text-[var(--text-secondary)]">
                    {node.connectionCount}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigate) onNavigate(node.path);
                      }}
                      className="px-2 py-1 rounded bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[11px] font-semibold hover:bg-[var(--solid-contrast-bg)] hover:text-[var(--solid-contrast-text)] cursor-pointer"
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Orphans Panel (Responsive: Bottom sheet on mobile, right drawer on sm+) */}
      {showOrphansPanel && (
        <div className="fixed sm:absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-12 sm:w-72 max-h-[75vh] sm:max-h-full bg-[var(--bg-app)] border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] rounded-t-2xl sm:rounded-none shadow-2xl z-40 p-4 flex flex-col space-y-3 animate-in slide-in-from-bottom sm:slide-in-from-right duration-150">
          <div className="w-10 h-1 bg-[var(--border-subtle)] rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Nodos Huérfanos ({orphansList.length})
            </h4>
            <button
              type="button"
              onClick={() => setShowOrphansPanel(false)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Elementos sin conexiones en la red. Escribe <code className="px-1 py-0.5 rounded bg-[var(--bg-surface-muted)]">[[Nombre]]</code> para vincularlos.
          </p>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {orphansList.map(item => (
              <div 
                key={item.id}
                className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <span className="font-medium text-[var(--text-primary)] truncate block">{item.title}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] capitalize">{item.type}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigate) onNavigate(item.path);
                  }}
                  className="p-1 rounded bg-[var(--bg-surface-muted)] hover:bg-[var(--solid-contrast-bg)] hover:text-[var(--solid-contrast-text)] transition cursor-pointer"
                  title="Abrir elemento"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Selected Node Detail Panel (Responsive: Bottom sheet on mobile, right drawer on sm+) */}
      {selectedNode && (
        <div className="fixed sm:absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-12 sm:w-80 max-h-[80vh] sm:max-h-full bg-[var(--bg-app)] border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] rounded-t-2xl sm:rounded-none shadow-2xl z-40 p-4 sm:p-5 flex flex-col space-y-3 sm:space-y-4 animate-in slide-in-from-bottom sm:slide-in-from-right duration-150 overflow-y-auto">
          {/* Mobile grab handle */}
          <div className="w-10 h-1 bg-[var(--border-subtle)] rounded-full mx-auto -mt-1 sm:hidden shrink-0" />
          
          <div className="flex items-start justify-between border-b border-[var(--border-subtle)] pb-3">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                {selectedNode.type}
              </span>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mt-1.5 font-heading">
                {selectedNode.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <span>Conexiones totales:</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{selectedBacklinks.length}</span>
            </div>
            {selectedNode.date && (
              <div className="flex justify-between py-1 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
                <span>Fecha:</span>
                <span className="font-mono text-[var(--text-primary)]">{selectedNode.date}</span>
              </div>
            )}
          </div>

          {/* Backlinks list */}
          <div className="space-y-2 flex-1">
            <h4 className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Menciones y Conexiones ({selectedBacklinks.length})
            </h4>
            {selectedBacklinks.length === 0 ? (
              <div className="text-[11px] text-[var(--text-tertiary)] italic">
                Sin menciones entrantes.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedBacklinks.map(b => (
                  <button
                    key={`${b.sourceId}-${b.sourceTitle}`}
                    type="button"
                    onClick={() => {
                      hapticFeedback.light();
                      setSelectedNodeId(b.sourceId);
                    }}
                    className="w-full text-left p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="truncate text-[var(--text-primary)]">{b.sourceTitle}</span>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0 ml-1">
                      {b.isStructural ? 'estructural' : 'link'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              hapticFeedback.medium();
              if (onNavigate) onNavigate(selectedNode.path);
            }}
            className="w-full py-2.5 rounded-xl btn-solid-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
          >
            <span>Abrir Pantalla Completa</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 8. Saved Views Modal */}
      {showSavedViewsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Vistas Guardadas del Grafo</h3>
              <button
                type="button"
                onClick={() => setShowSavedViewsModal(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-[var(--text-secondary)]">Vistas Disponibles:</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {savedViews.map(view => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => handleApplySavedView(view)}
                    className="w-full p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-left flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{view.name}</span>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase">{view.viewMode}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
              <span className="text-xs text-[var(--text-secondary)]">Guardar Configuración Actual:</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nombre de la vista…"
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  className="flex-1 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentView}
                  className="px-3 py-1.5 rounded-xl btn-solid-primary text-xs font-semibold cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Second Brain Guide Modal */}
      <SecondBrainGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
};
