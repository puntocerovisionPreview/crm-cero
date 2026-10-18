import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior, ZoomTransform } from 'd3-zoom';
import { drag } from 'd3-drag';
import {
  GraphNode,
  LinkCatalogItem,
  LinkEntityType,
  LinkRelation,
  buildGraph,
  getNodeShape,
  normalizeEntityTitle
} from '../lib/links';
import {
  Search,
  X,
  Plus,
  Minus,
  Scan,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Network,
  List,
  ChevronRight,
  ArrowUpRight,
  BookOpen,
  Bookmark
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
  /** Versión chica (ficha de cliente, tarea o nota): sin barra ni panel lateral */
  compact?: boolean;
}

interface SimulationNode extends GraphNode, SimulationNodeDatum {}
interface SimulationLink extends SimulationLinkDatum<SimulationNode> {
  id: string;
  isStructural: boolean;
  weight: number;
}

// ---------------------------------------------------------------------------
// Tipos de elemento: nombre, color (colores del sistema de Apple) y forma.
// La forma acompaña al color para que el tipo no dependa solo del color.
// ---------------------------------------------------------------------------
type LayerKey = 'notas' | 'clientes' | 'objetivos' | 'tareas' | 'reuniones' | 'cobros' | 'personal' | 'etiquetas';

const TYPE_META: Record<LinkEntityType, { label: string; plural: string; light: string; dark: string; layer: LayerKey }> = {
  nota: { label: 'Nota', plural: 'Notas', light: '#007AFF', dark: '#0A84FF', layer: 'notas' },
  cliente: { label: 'Cliente PAF', plural: 'Clientes PAF', light: '#FF9500', dark: '#FF9F0A', layer: 'clientes' },
  proyecto: { label: 'Proyecto', plural: 'Proyectos', light: '#5856D6', dark: '#5E5CE6', layer: 'clientes' },
  objetivo: { label: 'Objetivo', plural: 'Objetivos', light: '#FF2D55', dark: '#FF375F', layer: 'objetivos' },
  habito: { label: 'Hábito', plural: 'Hábitos', light: '#A2845E', dark: '#AC8E68', layer: 'objetivos' },
  tarea: { label: 'Tarea', plural: 'Tareas', light: '#34C759', dark: '#30D158', layer: 'tareas' },
  'resumen-tareas': { label: 'Grupo de tareas', plural: 'Grupos de tareas', light: '#34C759', dark: '#30D158', layer: 'tareas' },
  reunion: { label: 'Reunión', plural: 'Reuniones', light: '#30B0C7', dark: '#40C8E0', layer: 'reuniones' },
  ingreso: { label: 'Cobro', plural: 'Cobros', light: '#00A89D', dark: '#63E6E2', layer: 'cobros' },
  'finanza-personal': { label: 'Movimiento personal', plural: 'Finanzas personales', light: '#AF52DE', dark: '#BF5AF2', layer: 'personal' },
  tag: { label: 'Etiqueta', plural: 'Etiquetas', light: '#8E8E93', dark: '#98989D', layer: 'etiquetas' },
};

const LAYERS: { key: LayerKey; label: string; types: LinkEntityType[] }[] = [
  { key: 'notas', label: 'Notas', types: ['nota'] },
  { key: 'clientes', label: 'Clientes y proyectos', types: ['cliente', 'proyecto'] },
  { key: 'objetivos', label: 'Objetivos y hábitos', types: ['objetivo', 'habito'] },
  { key: 'tareas', label: 'Tareas', types: ['tarea', 'resumen-tareas'] },
  { key: 'reuniones', label: 'Reuniones', types: ['reunion'] },
  { key: 'cobros', label: 'Cobros', types: ['ingreso'] },
  { key: 'personal', label: 'Finanzas personales', types: ['finanza-personal'] },
  { key: 'etiquetas', label: 'Etiquetas', types: ['tag'] },
];

type PresetKey = 'clients_notes' | 'knowledge' | 'clients_finances' | 'all';
type Layers = Record<LayerKey, boolean>;

const PRESETS: { key: PresetKey; label: string; layers: Layers; orphans: boolean }[] = [
  {
    key: 'knowledge',
    label: 'Conocimiento',
    layers: { notas: true, clientes: true, objetivos: true, tareas: true, reuniones: false, cobros: true, personal: false, etiquetas: false },
    orphans: false,
  },
  {
    key: 'clients_notes',
    label: 'Clientes y notas',
    layers: { notas: true, clientes: true, objetivos: false, tareas: false, reuniones: false, cobros: false, personal: false, etiquetas: false },
    orphans: false,
  },
  {
    key: 'clients_finances',
    label: 'Cobros',
    layers: { notas: true, clientes: true, objetivos: false, tareas: false, reuniones: false, cobros: true, personal: false, etiquetas: false },
    orphans: false,
  },
  {
    key: 'all',
    label: 'Todo',
    layers: { notas: true, clientes: true, objetivos: true, tareas: true, reuniones: true, cobros: true, personal: false, etiquetas: false },
    orphans: true,
  },
];

interface SavedGraphView {
  id: string;
  name: string;
  viewMode?: 'knowledge' | 'classic';
  filterTypes: LinkEntityType[];
  showOrphans: boolean;
  includeStructural: boolean;
  includeTags: boolean;
  focusDepth: number;
}

const LEGEND_SHAPE: Record<string, string> = {
  circle: 'w-2.5 h-2.5 rounded-full',
  'rounded-rect': 'w-2.5 h-2.5 rounded-[3px]',
  diamond: 'w-2 h-2 rotate-45 rounded-[1px] mx-[1px]',
  capsule: 'w-3.5 h-2 rounded-full',
  hexagon: 'w-2.5 h-2.5 rounded-full',
};

const STORAGE_SAVED_VIEWS = 'cero_v3_saved_graph_views';
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif';

const isDarkTheme = () => document.documentElement.classList.contains('dark');
const typeColor = (type: LinkEntityType, dark: boolean) => (TYPE_META[type] ? (dark ? TYPE_META[type].dark : TYPE_META[type].light) : dark ? '#98989D' : '#8E8E93');
const typeLabel = (type: LinkEntityType) => TYPE_META[type]?.label || type;

// En modo privado se ocultan los montos que aparezcan en títulos y subtítulos
const maskAmounts = (text: string) => text.replace(/(US?\$|\$)?\s?\d[\d.,]{2,}/g, '•••');

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Dibuja la forma del nodo (círculo, cuadrado redondeado, rombo o cápsula)
function shapePath(ctx: CanvasRenderingContext2D, shape: GraphNode['shape'], x: number, y: number, r: number) {
  ctx.beginPath();
  if (shape === 'rounded-rect') {
    const side = r * 1.75;
    roundRectPath(ctx, x - side / 2, y - side / 2, side, side, side * 0.3);
  } else if (shape === 'diamond') {
    const d = r * 1.3;
    ctx.moveTo(x, y - d);
    ctx.lineTo(x + d, y);
    ctx.lineTo(x, y + d);
    ctx.lineTo(x - d, y);
    ctx.closePath();
  } else if (shape === 'capsule') {
    roundRectPath(ctx, x - r * 1.2, y - r * 0.6, r * 2.4, r * 1.2, r * 0.6);
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

// Interruptor estilo iOS
const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between gap-3 py-2 cursor-pointer text-[13px] text-[var(--text-primary)]">
    <span>{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-[42px] h-[26px] rounded-full shrink-0 transition-colors duration-200 ${checked ? 'bg-[#34C759]' : 'bg-[var(--bg-surface-muted)]'}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[22px] h-[22px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`}
      />
    </button>
  </label>
);

export const KnowledgeGraphCanvas: React.FC<Props> = ({
  catalog,
  relations,
  onNavigate,
  height = '600px',
  focusNodeId,
  privacyMode = false,
  compact: compactProp,
}) => {
  const compact = compactProp ?? (typeof height === 'number' ? height < 420 : /^\d+px$/.test(String(height)) && parseInt(String(height), 10) < 420);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // ---------------- Estado de la vista ----------------
  const [preset, setPreset] = useState<PresetKey | 'custom'>(compact ? 'all' : 'knowledge');
  const [layers, setLayers] = useState<Layers>(() => (compact ? { ...PRESETS[3].layers, personal: true } : { ...PRESETS[0].layers }));
  const [showOrphans, setShowOrphans] = useState(compact);
  const [includeStructural, setIncludeStructural] = useState(true);
  const [displayFormat, setDisplayFormat] = useState<'canvas' | 'list'>('canvas');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showOrphansPanel, setShowOrphansPanel] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(focusNodeId || null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusDepth, setFocusDepth] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const [repulsionStrength, setRepulsionStrength] = useState(220);
  const [linkDistance, setLinkDistance] = useState(70);

  const [savedViews, setSavedViews] = useState<SavedGraphView[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SAVED_VIEWS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [newViewName, setNewViewName] = useState('');

  useEffect(() => {
    if (focusNodeId) setSelectedNodeId(focusNodeId);
  }, [focusNodeId]);

  // Esc cierra, en orden: opciones, panel, pantalla completa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showOptions) setShowOptions(false);
      else if (showOrphansPanel) setShowOrphansPanel(false);
      else if (selectedNodeId && !compact) setSelectedNodeId(null);
      else if (isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showOptions, showOrphansPanel, selectedNodeId, isFullscreen, compact]);

  const activeFilterTypes = useMemo<LinkEntityType[]>(
    () => LAYERS.filter(l => layers[l.key]).flatMap(l => l.types),
    [layers]
  );

  const applyPreset = (key: PresetKey) => {
    const p = PRESETS.find(x => x.key === key)!;
    hapticFeedback.selection();
    setPreset(key);
    setLayers({ ...p.layers });
    setShowOrphans(p.orphans);
  };

  const toggleLayer = (key: LayerKey, value: boolean) => {
    setLayers(prev => ({ ...prev, [key]: value }));
    setPreset('custom');
  };

  // ---------------- Datos del grafo ----------------
  // La selección y la búsqueda NO reconstruyen la red (antes cada clic la reiniciaba)
  const { nodes: rawNodes, edges: rawEdges } = useMemo(
    () =>
      buildGraph(catalog, relations, {
        includeStructural,
        includeTags: layers.etiquetas,
        filterTypes: activeFilterTypes.length ? activeFilterTypes : ['nota'],
        showOrphans,
      }),
    [catalog, relations, includeStructural, layers.etiquetas, activeFilterTypes, showOrphans]
  );

  const catalogById = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);

  const displayTitle = useCallback(
    (title: string, type: LinkEntityType) => (privacyMode && (type === 'ingreso' || type === 'finanza-personal') ? maskAmounts(title) : title),
    [privacyMode]
  );

  const orphansList = useMemo(() => {
    const counts = new Map<string, number>();
    relations.forEach(r => {
      counts.set(r.sourceId, (counts.get(r.sourceId) || 0) + 1);
      counts.set(r.targetId, (counts.get(r.targetId) || 0) + 1);
    });
    return catalog.filter(item => item.type !== 'tag' && !counts.get(item.id));
  }, [catalog, relations]);

  // Vecinos directos de cada nodo (en ambos sentidos)
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    rawEdges.forEach(e => {
      const s = typeof e.source === 'string' ? e.source : e.source.id;
      const t = typeof e.target === 'string' ? e.target : e.target.id;
      if (!map.has(s)) map.set(s, new Set());
      if (!map.has(t)) map.set(t, new Set());
      map.get(s)!.add(t);
      map.get(t)!.add(s);
    });
    return map;
  }, [rawEdges]);

  const neighborhoodOf = useCallback(
    (rootId: string, depth: number) => {
      const seen = new Set<string>([rootId]);
      let layer = [rootId];
      for (let d = 0; d < depth; d++) {
        const next: string[] = [];
        layer.forEach(id => adjacency.get(id)?.forEach(n => {
          if (!seen.has(n)) {
            seen.add(n);
            next.push(n);
          }
        }));
        layer = next;
      }
      return seen;
    },
    [adjacency]
  );

  const searchMatches = useMemo(() => {
    const q = normalizeEntityTitle(searchQuery);
    if (!q) return null;
    return new Set(rawNodes.filter(n => normalizeEntityTitle(n.title).includes(q)).map(n => n.id));
  }, [searchQuery, rawNodes]);

  // Lo que queda resaltado: el vecindario del elegido, el del que está bajo el mouse o lo buscado
  const focusSet = useMemo(() => {
    if (selectedNodeId && rawNodes.some(n => n.id === selectedNodeId)) return neighborhoodOf(selectedNodeId, focusDepth);
    if (hoveredNodeId) return neighborhoodOf(hoveredNodeId, 1);
    return searchMatches;
  }, [selectedNodeId, hoveredNodeId, focusDepth, neighborhoodOf, searchMatches, rawNodes, adjacency]);

  // Los más conectados llevan su nombre siempre visible
  const hubIds = useMemo(() => {
    const sorted = [...rawNodes].filter(n => n.connectionCount > 0).sort((a, b) => b.connectionCount - a.connectionCount);
    return new Set(sorted.slice(0, Math.max(6, Math.round(sorted.length * 0.15))).map(n => n.id));
  }, [rawNodes]);

  // ---------------- Simulación ----------------
  const simulationRef = useRef<Simulation<SimulationNode, SimulationLink> | null>(null);
  const simNodesRef = useRef<SimulationNode[]>([]);
  const simLinksRef = useRef<SimulationLink[]>([]);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const needsFitRef = useRef(true);
  // Si la persona ya movió o hizo zoom, no se le cambia la cámara sola
  const userMovedRef = useRef(false);
  const animRef = useRef<number | null>(null);

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------- Dibujo ----------------
  const stateRef = useRef({ focusSet, selectedNodeId, hoveredNodeId, hubIds, displayTitle });
  stateRef.current = { focusSet, selectedNodeId, hoveredNodeId, hubIds, displayTitle };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    const { focusSet: active, selectedNodeId: selId, hoveredNodeId: hovId, hubIds: hubs, displayTitle: titleOf } = stateRef.current;
    const dark = isDarkTheme();
    const t = transformRef.current;
    const k = t.k;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Grilla de puntos suave (como Freeform), en pantalla
    if (!compact) {
      const step = 22 * k;
      if (step >= 9) {
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.075)';
        const ox = ((t.x % step) + step) % step;
        const oy = ((t.y % step) + step) % step;
        for (let x = ox; x < width; x += step) {
          for (let y = oy; y < height; y += step) {
            ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
          }
        }
      }
    }

    ctx.translate(t.x, t.y);
    ctx.scale(k, k);

    const nodes = simNodesRef.current;
    const links = simLinksRef.current;
    const minX = -t.x / k - 60, maxX = (width - t.x) / k + 60;
    const minY = -t.y / k - 60, maxY = (height - t.y) / k + 60;
    const lw = 1 / Math.sqrt(Math.max(k, 0.3));

    // 1. Conexiones
    ctx.lineCap = 'round';
    links.forEach(link => {
      const s = link.source as SimulationNode;
      const tg = link.target as SimulationNode;
      if (typeof s.x !== 'number' || typeof tg.x !== 'number') return;
      const lit = active ? active.has(s.id) && active.has(tg.id) && (selId ? true : s.id === hovId || tg.id === hovId || !hovId) : false;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y!);
      ctx.lineTo(tg.x, tg.y!);
      ctx.setLineDash(link.isStructural ? [3 * lw, 4 * lw] : []);
      if (active && lit) {
        ctx.strokeStyle = dark ? 'rgba(10,132,255,0.85)' : 'rgba(0,113,227,0.8)';
        ctx.lineWidth = 1.8 * lw;
        ctx.globalAlpha = 1;
      } else if (active) {
        ctx.strokeStyle = dark ? '#FFFFFF' : '#000000';
        ctx.lineWidth = 1 * lw;
        ctx.globalAlpha = 0.04;
      } else {
        ctx.strokeStyle = dark ? '#FFFFFF' : '#000000';
        ctx.lineWidth = (link.isStructural ? 1 : Math.min(2.4, 1.1 + (link.weight - 1) * 0.35)) * lw;
        ctx.globalAlpha = link.isStructural ? 0.1 : 0.16;
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 2. Nodos
    const ring = dark ? '#1C1C1E' : '#FFFFFF';
    const labels: { x: number; y: number; text: string; strong: boolean; alpha: number; priority: number }[] = [];
    nodes.forEach(node => {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
      const isSel = node.id === selId;
      const isHov = node.id === hovId;
      const inFocus = active ? active.has(node.id) : true;
      const alpha = inFocus ? 1 : 0.16;
      const r = node.radius;
      const color = typeColor(node.type, dark);

      ctx.globalAlpha = alpha;
      if (isSel || isHov) {
        shapePath(ctx, node.shape, node.x, node.y, r + 6);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = alpha;
      }
      shapePath(ctx, node.shape, node.x, node.y, r);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2 * lw;
      ctx.strokeStyle = isSel ? (dark ? '#FFFFFF' : '#1D1D1F') : ring;
      ctx.stroke();

      const visible = node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY;
      const wantLabel =
        isSel || isHov ||
        (active ? inFocus && (active.size <= 40 || hubs.has(node.id)) : (k >= 1.05 || (hubs.has(node.id) && k >= 0.45) || compact));
      if (visible && wantLabel) {
        const title = titleOf(node.title, node.type);
        labels.push({
          x: node.x,
          y: node.y + r + 5 / k,
          text: title.length > 28 ? title.slice(0, 26) + '…' : title,
          strong: isSel || hubs.has(node.id),
          alpha,
          priority: isSel || isHov ? 1e6 : (inFocus ? 1000 : 0) + node.connectionCount,
        });
      }
    });

    // 3. Nombres encima de todo, con halo del color de fondo (como en Mapas)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    const fontPx = (compact ? 11 : 12) / k;
    // Sin nombres encimados: primero el elegido y los más conectados; el resto solo si hay lugar
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    labels.sort((a, b) => b.priority - a.priority);
    const visibleLabels = labels.filter(l => {
      ctx.font = `${l.strong ? 600 : 500} ${fontPx}px ${FONT_STACK}`;
      const w = ctx.measureText(l.text).width;
      const box = { x0: l.x - w / 2 - 2 / k, y0: l.y, x1: l.x + w / 2 + 2 / k, y1: l.y + fontPx * 1.2 };
      const clash = placed.some(p => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
      if (clash && l.priority < 1e6) return false;
      placed.push(box);
      return true;
    });
    visibleLabels.forEach(l => {
      ctx.globalAlpha = l.alpha;
      ctx.font = `${l.strong ? 600 : 500} ${fontPx}px ${FONT_STACK}`;
      ctx.lineWidth = 4 / k;
      ctx.strokeStyle = dark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)';
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = dark ? '#F5F5F7' : '#1D1D1F';
      ctx.fillText(l.text, l.x, l.y);
    });
    ctx.globalAlpha = 1;
  }, [compact]);

  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    draw();
  }, [draw, focusSet, selectedNodeId, hoveredNodeId, hubIds, privacyMode]);

  // ---------------- Cámara (zoom y paneo sincronizados con d3) ----------------
  const setCamera = useCallback((next: ZoomTransform, animate = true) => {
    const canvas = canvasRef.current;
    const z = zoomRef.current;
    if (!canvas || !z) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const sel = select(canvas);
    if (!animate || prefersReducedMotion()) {
      sel.call(z.transform, next);
      return;
    }
    const from = transformRef.current;
    const start = performance.now();
    const duration = 380;
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const e = ease(p);
      const k = from.k + (next.k - from.k) * e;
      const x = from.x + (next.x - from.x) * e;
      const y = from.y + (next.y - from.y) * e;
      sel.call(z.transform, zoomIdentity.translate(x, y).scale(k));
      if (p < 1) animRef.current = requestAnimationFrame(step);
      else animRef.current = null;
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  // Panel abierto: el nodo se centra en el espacio que queda libre
  const viewportCenter = useCallback((panelOpen: boolean) => {
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 800;
    const h = canvas?.clientHeight || 600;
    const isWide = w >= 640;
    if (panelOpen && isWide) return { cx: (w - 336) / 2, cy: h / 2 };
    if (panelOpen) return { cx: w / 2, cy: h * 0.3 };
    return { cx: w / 2, cy: h / 2 };
  }, []);

  const fitToView = useCallback((animate = true) => {
    const canvas = canvasRef.current;
    const nodes = simNodesRef.current.filter(n => typeof n.x === 'number');
    if (!canvas || nodes.length === 0) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    nodes.forEach(n => {
      x0 = Math.min(x0, n.x! - n.radius);
      y0 = Math.min(y0, n.y! - n.radius);
      x1 = Math.max(x1, n.x! + n.radius);
      y1 = Math.max(y1, n.y! + n.radius + 16);
    });
    // Margen extra abajo (leyenda) y a la derecha (zoom)
    const [pl, pr, pt, pb] = compact ? [20, 44, 20, 20] : [40, 72, 36, 96];
    const availW = Math.max(80, w - pl - pr);
    const availH = Math.max(80, h - pt - pb);
    const k = Math.max(0.2, Math.min(compact ? 1.4 : 1.6, Math.min(availW / Math.max(1, x1 - x0), availH / Math.max(1, y1 - y0))));
    const tx = pl + availW / 2 - k * (x0 + x1) / 2;
    const ty = pt + availH / 2 - k * (y0 + y1) / 2;
    setCamera(zoomIdentity.translate(tx, ty).scale(k), animate);
  }, [compact, setCamera]);

  const centerOnNode = useCallback((id: string) => {
    const node = simNodesRef.current.find(n => n.id === id);
    if (!node || typeof node.x !== 'number') return;
    const { cx, cy } = viewportCenter(!compact);
    const k = Math.max(transformRef.current.k, 1.1);
    setCamera(zoomIdentity.translate(cx - node.x * k, cy - node.y! * k).scale(k));
  }, [setCamera, viewportCenter, compact]);

  const zoomBy = (factor: number) => {
    hapticFeedback.light();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const t = transformRef.current;
    const k = Math.max(0.2, Math.min(5, t.k * factor));
    const cx = canvas.clientWidth / 2, cy = canvas.clientHeight / 2;
    const wx = (cx - t.x) / t.k, wy = (cy - t.y) / t.k;
    setCamera(zoomIdentity.translate(cx - wx * k, cy - wy * k).scale(k));
  };

  const selectNode = useCallback((id: string | null, center = false) => {
    setSelectedNodeId(id);
    if (id && center) requestAnimationFrame(() => centerOnNode(id));
  }, [centerOnNode]);

  // ---------------- Simulación: se arma cuando cambian los datos ----------------
  const nodeSetKey = useMemo(() => rawNodes.map(n => n.id).sort().join('|'), [rawNodes]);
  const lastNodeSetKey = useRef('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    if (lastNodeSetKey.current !== nodeSetKey) {
      needsFitRef.current = true;
      userMovedRef.current = false;
      lastNodeSetKey.current = nodeSetKey;
    }

    const prev = new Map<string, SimulationNode>();
    simNodesRef.current.forEach(n => prev.set(n.id, n));

    const nodes: SimulationNode[] = rawNodes.map((n, i) => {
      const old = prev.get(n.id);
      if (old && typeof old.x === 'number') return { ...n, x: old.x, y: old.y, vx: 0, vy: 0 };
      // Los nuevos nacen cerca de un vecino ya ubicado, o en espiral alrededor del centro
      const neighbor = [...(adjacency.get(n.id) || [])].map(id => prev.get(id)).find(p => p && typeof p.x === 'number');
      if (neighbor) return { ...n, x: neighbor.x! + (Math.random() - 0.5) * 40, y: neighbor.y! + (Math.random() - 0.5) * 40 };
      const angle = i * 2.399963;
      const radius = 14 * Math.sqrt(i + 1);
      return { ...n, x: width / 2 + Math.cos(angle) * radius, y: height / 2 + Math.sin(angle) * radius };
    });
    const links: SimulationLink[] = rawEdges.map(e => ({
      id: e.id,
      source: typeof e.source === 'string' ? e.source : e.source.id,
      target: typeof e.target === 'string' ? e.target : e.target.id,
      isStructural: e.isStructural,
      weight: e.weight,
    }));

    simNodesRef.current = nodes;
    simLinksRef.current = links;
    simulationRef.current?.stop();

    const charge = compact ? Math.min(repulsionStrength, 140) : repulsionStrength;
    const sim = forceSimulation<SimulationNode>(nodes)
      .force('link', forceLink<SimulationNode, SimulationLink>(links).id(d => d.id).distance(l => (l.isStructural ? linkDistance * 0.8 : linkDistance)).strength(0.5))
      .force('charge', forceManyBody<SimulationNode>().strength(d => -charge * (0.6 + Math.min(1.2, d.connectionCount * 0.08))).distanceMax(600))
      .force('center', forceCenter(width / 2, height / 2))
      .force('x', forceX(width / 2).strength(0.045))
      .force('y', forceY(height / 2).strength(0.045))
      .force('collide', forceCollide<SimulationNode>().radius(d => d.radius + 10))
      .alphaDecay(0.035);

    const hadPositions = nodes.every(n => prev.has(n.id));
    if (hadPositions) sim.alpha(0.25);

    if (prefersReducedMotion()) {
      sim.stop();
      for (let i = 0; i < 200; i++) sim.tick();
      if (needsFitRef.current) {
        needsFitRef.current = false;
        requestAnimationFrame(() => fitToView(false));
      }
      drawRef.current();
    } else {
      let ticks = 0;
      sim.on('tick', () => {
        ticks++;
        // Primero se ubica sola un momento y después se encuadra con una animación suave
        if (needsFitRef.current && ticks === 60) fitToView(true);
        drawRef.current();
      });
      sim.on('end', () => {
        // Encuadre final cuando la red ya se acomodó (si nadie tocó la cámara)
        if (needsFitRef.current && !userMovedRef.current) fitToView(true);
        needsFitRef.current = false;
      });
    }
    simulationRef.current = sim;
    return () => {
      sim.stop();
    };
    // adjacency se usa solo para ubicar nodos nuevos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes, rawEdges, repulsionStrength, linkDistance, compact, nodeSetKey]);

  // ---------------- Interacción: zoom, arrastre, toque y mouse ----------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      return { x: (clientX - rect.left - t.x) / t.k, y: (clientY - rect.top - t.y) / t.k };
    };
    const nodeAt = (clientX: number, clientY: number): SimulationNode | null => {
      const p = toWorld(clientX, clientY);
      const tolerance = 8 / transformRef.current.k;
      let best: SimulationNode | null = null;
      let bestDist = Infinity;
      for (const n of simNodesRef.current) {
        if (typeof n.x !== 'number') continue;
        const d = Math.hypot(p.x - n.x, p.y - n.y!);
        if (d <= n.radius + tolerance && d < bestDist) {
          best = n;
          bestDist = d;
        }
      }
      return best;
    };
    const pointOf = (event: any) => {
      const src = event.sourceEvent || event;
      const touch = src.touches?.[0] || src.changedTouches?.[0];
      return { x: touch ? touch.clientX : src.clientX, y: touch ? touch.clientY : src.clientY };
    };

    const z = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 5])
      .filter(event => {
        if (event.type === 'mousedown' || event.type === 'touchstart' || event.type === 'pointerdown') {
          if (event.button) return false;
          const p = pointOf(event);
          if (event.touches && event.touches.length > 1) return true;
          return !nodeAt(p.x, p.y);
        }
        if (event.type === 'dblclick') {
          return !nodeAt(event.clientX, event.clientY);
        }
        return !event.button;
      })
      .on('zoom', event => {
        if (event.sourceEvent) userMovedRef.current = true;
        transformRef.current = event.transform;
        drawRef.current();
      });
    zoomRef.current = z;
    const sel = select(canvas);
    sel.call(z);
    sel.call(z.transform, transformRef.current);

    let dragMoved = false;
    const dragBehavior = drag<HTMLCanvasElement, unknown>()
      .container(canvas)
      .filter(event => {
        if (event.button) return false;
        const p = pointOf(event);
        return !!nodeAt(p.x, p.y);
      })
      .subject(event => {
        const p = pointOf(event);
        return nodeAt(p.x, p.y) || undefined;
      })
      .on('start', event => {
        dragMoved = false;
        const n = event.subject as SimulationNode;
        n.fx = n.x;
        n.fy = n.y;
      })
      .on('drag', event => {
        const n = event.subject as SimulationNode;
        const p = pointOf(event);
        const w = toWorld(p.x, p.y);
        if (!dragMoved) {
          dragMoved = true;
          simulationRef.current?.alphaTarget(0.25).restart();
          canvas.style.cursor = 'grabbing';
        }
        n.fx = w.x;
        n.fy = w.y;
        drawRef.current();
      })
      .on('end', event => {
        const n = event.subject as SimulationNode;
        simulationRef.current?.alphaTarget(0);
        // Al soltarlo vuelve a acomodarse solo
        n.fx = null;
        n.fy = null;
        canvas.style.cursor = '';
        if (!dragMoved) {
          hapticFeedback.selection();
          setSelectedNodeId(n.id);
        }
      });
    sel.call(dragBehavior);

    let lastHover: string | null = null;
    const onMove = (e: MouseEvent) => {
      if (e.buttons) return;
      const n = nodeAt(e.clientX, e.clientY);
      const id = n ? n.id : null;
      canvas.style.cursor = n ? 'pointer' : '';
      if (id !== lastHover) {
        lastHover = id;
        setHoveredNodeId(id);
      }
    };
    const onLeave = () => {
      lastHover = null;
      setHoveredNodeId(null);
    };
    // Toque en vacío: suelta la selección
    const onClick = (e: MouseEvent) => {
      if (!nodeAt(e.clientX, e.clientY) && !compact) setSelectedNodeId(null);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick);

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      simulationRef.current?.force('center', forceCenter(w / 2, h / 2));
      simulationRef.current?.force('x', forceX(w / 2).strength(0.045));
      simulationRef.current?.force('y', forceY(h / 2).strength(0.045));
      drawRef.current();
    });
    if (stageRef.current) ro.observe(stageRef.current);

    // Cambio de tema claro/oscuro: redibuja con los colores nuevos
    const mo = new MutationObserver(() => drawRef.current());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const onVisibility = () => {
      if (document.hidden) simulationRef.current?.stop();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      mo.disconnect();
      sel.on('.zoom', null).on('.drag', null);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [compact]);

  // Al volver de la lista o pasar a pantalla completa, reencuadra
  const firstLayoutRef = useRef(true);
  useEffect(() => {
    if (firstLayoutRef.current) {
      firstLayoutRef.current = false;
      return;
    }
    if (displayFormat !== 'canvas') return;
    // Espera a que el contenedor tome su tamaño nuevo
    const id = window.setTimeout(() => {
      drawRef.current();
      fitToView(true);
    }, 60);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayFormat, isFullscreen]);

  // ---------------- Vistas guardadas ----------------
  const persistViews = (views: SavedGraphView[]) => {
    setSavedViews(views);
    try {
      localStorage.setItem(STORAGE_SAVED_VIEWS, JSON.stringify(views));
    } catch {}
  };
  const handleSaveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;
    persistViews([
      ...savedViews,
      { id: `view_${Date.now()}`, name, filterTypes: activeFilterTypes, showOrphans, includeStructural, includeTags: layers.etiquetas, focusDepth },
    ]);
    setNewViewName('');
    hapticFeedback.success();
  };
  const handleApplySavedView = (view: SavedGraphView) => {
    const types = view.filterTypes || [];
    const next = {} as Layers;
    LAYERS.forEach(l => {
      next[l.key] = types.length === 0 ? l.key !== 'personal' : l.types.some(t => types.includes(t));
    });
    if (view.includeTags) next.etiquetas = true;
    setLayers(next);
    setShowOrphans(view.showOrphans);
    setIncludeStructural(view.includeStructural);
    setFocusDepth(view.focusDepth || 1);
    setPreset('custom');
    setShowOptions(false);
    hapticFeedback.light();
  };
  const handleDeleteView = (id: string) => persistViews(savedViews.filter(v => v.id !== id));

  // ---------------- Datos del panel ----------------
  const selectedItem = selectedNodeId ? catalogById.get(selectedNodeId) || null : null;
  const selectedConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    const seen = new Map<string, { id: string; title: string; type: LinkEntityType; path: string; structural: boolean }>();
    relations.forEach(r => {
      if (!includeStructural && r.isStructural) return;
      let otherId: string | null = null;
      if (r.sourceId === selectedNodeId) otherId = r.targetId;
      else if (r.targetId === selectedNodeId) otherId = r.sourceId;
      if (!otherId || seen.has(otherId)) return;
      const item = catalogById.get(otherId);
      if (!item) return;
      seen.set(otherId, { id: otherId, title: item.title, type: item.type, path: item.path, structural: Boolean(r.isStructural) });
    });
    return [...seen.values()].sort((a, b) => typeLabel(a.type).localeCompare(typeLabel(b.type)) || a.title.localeCompare(b.title));
  }, [selectedNodeId, relations, catalogById, includeStructural]);

  const legend = useMemo(() => {
    const counts = new Map<LinkEntityType, number>();
    rawNodes.forEach(n => counts.set(n.type, (counts.get(n.type) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rawNodes]);

  const listGroups = useMemo(() => {
    const q = normalizeEntityTitle(searchQuery);
    const groups = new Map<LinkEntityType, GraphNode[]>();
    rawNodes
      .filter(n => !q || normalizeEntityTitle(n.title).includes(q))
      .forEach(n => {
        if (!groups.has(n.type)) groups.set(n.type, []);
        groups.get(n.type)!.push(n);
      });
    return [...groups.entries()].map(([type, items]) => [type, items.sort((a, b) => b.connectionCount - a.connectionCount)] as const);
  }, [rawNodes, searchQuery]);

  const submitSearch = () => {
    if (!searchMatches || searchMatches.size === 0) return;
    const first = rawNodes.filter(n => searchMatches.has(n.id)).sort((a, b) => b.connectionCount - a.connectionCount)[0];
    if (first) {
      hapticFeedback.selection();
      selectNode(first.id, true);
    }
  };

  const dark = typeof document !== 'undefined' && isDarkTheme();
  const glass = 'bg-[var(--bg-surface)]/85 backdrop-blur-xl backdrop-saturate-150 border border-[var(--border-subtle)] shadow-[var(--shadow-float)]';
  const iconBtn = 'w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] transition-colors cursor-pointer';

  return (
    <div
      className={`w-full flex flex-col overflow-hidden select-none bg-[var(--bg-surface)] ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative rounded-[var(--radius-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)]'
      }`}
      style={{ height: isFullscreen ? '100dvh' : height }}
    >
      {/* Barra superior: control segmentado, búsqueda y opciones */}
      {!compact && (
        <div className={`relative flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-[var(--border-subtle)] z-10 ${isFullscreen ? 'safe-area-pt' : ''}`}>
          <div role="tablist" aria-label="Qué mostrar" className="flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70 overflow-x-auto no-scrollbar max-w-full">
            {PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={preset === p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 h-7 rounded-[8px] text-[13px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 cursor-pointer ${
                  preset === p.key
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitSearch();
              }}
              placeholder="Buscar"
              aria-label="Buscar en el grafo"
              className="ios-search w-full h-9 rounded-[10px] bg-[var(--bg-surface-muted)]/70 border-0 pl-8 pr-8 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[var(--text-tertiary)]/60 text-[var(--bg-surface)] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3 h-3" strokeWidth={3} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <div className="flex p-[3px] rounded-[10px] bg-[var(--bg-surface-muted)]/70" role="tablist" aria-label="Formato">
              <button
                type="button"
                role="tab"
                aria-selected={displayFormat === 'canvas'}
                aria-label="Ver como red"
                title="Red"
                onClick={() => setDisplayFormat('canvas')}
                className={`w-8 h-7 rounded-[8px] flex items-center justify-center cursor-pointer ${displayFormat === 'canvas' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[var(--text-secondary)]'}`}
              >
                <Network className="w-4 h-4" aria-hidden />
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={displayFormat === 'list'}
                aria-label="Ver como lista"
                title="Lista"
                onClick={() => setDisplayFormat('list')}
                className={`w-8 h-7 rounded-[8px] flex items-center justify-center cursor-pointer ${displayFormat === 'list' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-[var(--text-secondary)]'}`}
              >
                <List className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowOptions(v => !v)}
              aria-expanded={showOptions}
              aria-label="Opciones del grafo"
              title="Opciones"
              className={`${iconBtn} ${showOptions ? 'bg-[var(--accent)]/12 !text-[var(--accent)]' : ''}`}
            >
              <SlidersHorizontal className="w-[18px] h-[18px]" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticFeedback.light();
                setIsFullscreen(v => !v);
              }}
              aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
              className={iconBtn}
            >
              {isFullscreen ? <Minimize2 className="w-[18px] h-[18px]" aria-hidden /> : <Maximize2 className="w-[18px] h-[18px]" aria-hidden />}
            </button>
          </div>
        </div>
      )}

      {/* Lienzo */}
      <div ref={stageRef} className={`relative flex-1 min-h-0 ${displayFormat === 'canvas' ? '' : 'hidden'}`}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none outline-none"
          role="img"
          aria-label={`Grafo con ${rawNodes.length} elementos y ${rawEdges.length} conexiones. Para recorrerlo con teclado usá la vista de lista.`}
        />

        {rawNodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--bg-surface-muted)] flex items-center justify-center text-[var(--text-tertiary)] mb-3">
              <Network className="w-7 h-7" aria-hidden />
            </div>
            <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">Todavía no hay conexiones para mostrar</h3>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1 max-w-sm">
              Escribí <code className="px-1 rounded bg-[var(--bg-surface-muted)]">[[Nombre]]</code> en una nota para conectarla con un cliente, un proyecto o una tarea.
            </p>
            {!compact && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <button type="button" onClick={() => applyPreset('all')} className="h-9 px-4 rounded-full bg-[var(--accent)] text-white text-[14px] font-semibold cursor-pointer">
                  Mostrar todo
                </button>
                <button type="button" onClick={() => setShowGuideModal(true)} className="h-9 px-4 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-primary)] text-[14px] font-medium cursor-pointer">
                  Cómo conectar notas
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leyenda */}
        {!compact && legend.length > 0 && (
          <div className={`absolute left-3 bottom-3 z-10 max-w-[calc(100%-5.5rem)] rounded-2xl px-3 py-2 ${glass} ${selectedItem ? 'hidden sm:block' : ''}`}>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {legend.map(([type, count]) => (
                <li key={type} className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                  <span
                    aria-hidden
                    className={`shrink-0 ${LEGEND_SHAPE[getNodeShape(type)] || LEGEND_SHAPE.circle}`}
                    style={{ backgroundColor: typeColor(type, dark) }}
                  />
                  <span>{TYPE_META[type]?.plural || type}</span>
                  <span className="tabular-nums text-[var(--text-tertiary)]">{count}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1 tabular-nums">{rawEdges.length} conexiones · tocá un punto para ver sus vínculos</p>
          </div>
        )}

        {/* Zoom */}
        {rawNodes.length > 0 && (
          <div className={`absolute right-3 z-10 flex flex-col rounded-full p-1 ${glass} ${compact ? 'bottom-2 right-2 scale-90 origin-bottom-right' : 'bottom-3'} ${selectedItem && !compact ? 'max-sm:hidden sm:right-[348px]' : ''}`}>
            <button type="button" onClick={() => zoomBy(1.4)} aria-label="Acercar" title="Acercar" className={iconBtn}>
              <Plus className="w-[18px] h-[18px]" aria-hidden />
            </button>
            <button type="button" onClick={() => zoomBy(1 / 1.4)} aria-label="Alejar" title="Alejar" className={iconBtn}>
              <Minus className="w-[18px] h-[18px]" aria-hidden />
            </button>
            <div className="h-px mx-2 bg-[var(--border-subtle)]" />
            <button type="button" onClick={() => { hapticFeedback.light(); fitToView(true); }} aria-label="Ver todo" title="Ver todo" className={iconBtn}>
              <Scan className="w-[18px] h-[18px]" aria-hidden />
            </button>
          </div>
        )}

        {/* Versión chica: botón para abrir lo elegido */}
        {compact && selectedItem && onNavigate && selectedNodeId !== focusNodeId && (
          <button
            type="button"
            onClick={() => onNavigate(selectedItem.path)}
            className={`absolute left-2 bottom-2 z-10 h-8 pl-3 pr-2 rounded-full flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] max-w-[70%] cursor-pointer ${glass}`}
          >
            <span className="truncate">Abrir {displayTitle(selectedItem.title, selectedItem.type)}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
          </button>
        )}

        {/* Inspector del elemento elegido: tarjeta flotante en compu, hoja inferior en el celular */}
        {selectedItem && !compact && (
          <aside
            aria-label={`Detalle de ${selectedItem.title}`}
            className={`z-30 flex flex-col overflow-hidden ${glass}
              fixed inset-x-0 bottom-0 max-h-[62vh] rounded-t-[22px] safe-area-pb
              sm:absolute sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[320px] sm:max-h-none sm:rounded-[18px]
              t-sheet-enter`}
          >
            <div className="w-9 h-[5px] rounded-full bg-[var(--text-tertiary)]/40 mx-auto mt-2 sm:hidden" aria-hidden />
            <div className="px-4 pt-3 pb-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColor(selectedItem.type, dark) }} aria-hidden />
                  {typeLabel(selectedItem.type)}
                </div>
                <h3 className="text-[19px] leading-tight font-semibold text-[var(--text-primary)] mt-1 break-words">
                  {displayTitle(selectedItem.title, selectedItem.type)}
                </h3>
                {selectedItem.subtitle && (
                  <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                    {privacyMode ? maskAmounts(selectedItem.subtitle) : selectedItem.subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Cerrar detalle"
                className="w-7 h-7 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              </button>
            </div>

            <div className="px-4 pb-3 flex items-center justify-between gap-2">
              <span className="text-[13px] text-[var(--text-secondary)]">Mostrar a</span>
              <div className="flex p-[2px] rounded-[9px] bg-[var(--bg-surface-muted)]/70" role="radiogroup" aria-label="Distancia de vínculos">
                {[1, 2, 3].map(d => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={focusDepth === d}
                    onClick={() => setFocusDepth(d)}
                    className={`px-2.5 h-6 rounded-[7px] text-[12px] cursor-pointer ${focusDepth === d ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-[var(--text-secondary)]'}`}
                  >
                    {d === 1 ? '1 paso' : `${d} pasos`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
              <h4 className="px-1 pb-1.5 text-[13px] font-semibold text-[var(--text-secondary)]">
                {selectedConnections.length === 0
                  ? 'Sin conexiones todavía'
                  : `Conectado con ${selectedConnections.length} ${selectedConnections.length === 1 ? 'elemento' : 'elementos'}`}
              </h4>
              {selectedConnections.length > 0 && (
                <ul className="rounded-[12px] bg-[var(--bg-surface-elevated)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                  {selectedConnections.map(c => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          hapticFeedback.light();
                          selectNode(c.id, true);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 flex items-center gap-2.5 text-left hover:bg-[var(--bg-surface-muted)]/60 transition-colors cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: typeColor(c.type, dark) }} aria-hidden />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[14px] text-[var(--text-primary)] truncate">{displayTitle(c.title, c.type)}</span>
                          <span className="block text-[12px] text-[var(--text-tertiary)]">
                            {typeLabel(c.type)}
                            {c.structural ? ' · automática' : ''}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {onNavigate && (
              <div className="p-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.medium();
                    onNavigate(selectedItem.path);
                  }}
                  className="w-full h-11 rounded-[12px] bg-[var(--accent)] text-white text-[15px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer t-press"
                >
                  Abrir
                  <ArrowUpRight className="w-4 h-4" aria-hidden />
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Lista agrupada (alternativa accesible al lienzo) */}
      {displayFormat === 'list' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 bg-[var(--bg-app)]">
          {listGroups.length === 0 && <p className="text-center text-[14px] text-[var(--text-secondary)] py-10">No hay elementos con estos filtros.</p>}
          {listGroups.map(([type, items]) => (
            <section key={type}>
              <h4 className="px-4 pb-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
                {TYPE_META[type]?.plural || type} · {items.length}
              </h4>
              <ul className="rounded-[12px] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)]">
                {items.map(node => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate?.(node.path)}
                      className="w-full min-h-[44px] px-4 py-2 flex items-center gap-3 text-left hover:bg-[var(--bg-surface-muted)]/50 cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: typeColor(node.type, dark) }} aria-hidden />
                      <span className="flex-1 min-w-0 text-[15px] text-[var(--text-primary)] truncate">{displayTitle(node.title, node.type)}</span>
                      <span className="text-[13px] text-[var(--text-tertiary)] tabular-nums shrink-0">
                        {node.connectionCount} {node.connectionCount === 1 ? 'conexión' : 'conexiones'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Opciones: capas, separación y vistas guardadas */}
      {showOptions && !compact && (
        <>
          <div className="fixed inset-0 z-30 sm:absolute" onClick={() => setShowOptions(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Opciones del grafo"
            className={`z-40 overflow-y-auto ${glass} fixed inset-x-0 bottom-0 max-h-[75vh] rounded-t-[22px] safe-area-pb sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-[60px] sm:w-[300px] sm:max-h-[calc(100%-72px)] sm:rounded-[18px] t-dropdown-enter`}
          >
            <div className="w-9 h-[5px] rounded-full bg-[var(--text-tertiary)]/40 mx-auto mt-2 sm:hidden" aria-hidden />
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">Opciones</h3>
              <button type="button" onClick={() => setShowOptions(false)} aria-label="Cerrar opciones" className="w-7 h-7 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer">
                <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-4">
              <section>
                <h4 className="text-[13px] font-medium text-[var(--text-secondary)] pb-1">Mostrar</h4>
                <div className="rounded-[12px] bg-[var(--bg-surface-elevated)] px-3 divide-y divide-[var(--border-subtle)]">
                  {LAYERS.map(l => (
                    <Switch key={l.key} label={l.label} checked={layers[l.key]} onChange={v => toggleLayer(l.key, v)} />
                  ))}
                </div>
                <div className="rounded-[12px] bg-[var(--bg-surface-elevated)] px-3 divide-y divide-[var(--border-subtle)] mt-3">
                  <Switch label="Conexiones automáticas" checked={includeStructural} onChange={v => { setIncludeStructural(v); setPreset('custom'); }} />
                  <Switch label="Elementos sin conexiones" checked={showOrphans} onChange={v => { setShowOrphans(v); setPreset('custom'); }} />
                </div>
                <p className="text-[12px] text-[var(--text-tertiary)] px-1 pt-1.5">
                  Las automáticas (punteadas) unen, por ejemplo, una tarea con su proyecto.
                </p>
              </section>

              <section>
                <h4 className="text-[13px] font-medium text-[var(--text-secondary)] pb-1">Distribución</h4>
                <div className="rounded-[12px] bg-[var(--bg-surface-elevated)] px-3 py-2 space-y-3">
                  <label className="block text-[13px] text-[var(--text-primary)]">
                    <span className="flex justify-between"><span>Separación</span><span className="text-[var(--text-tertiary)] tabular-nums">{repulsionStrength}</span></span>
                    <input type="range" min={60} max={500} value={repulsionStrength} onChange={e => setRepulsionStrength(Number(e.target.value))} className="w-full mt-1 accent-[var(--accent)]" />
                  </label>
                  <label className="block text-[13px] text-[var(--text-primary)]">
                    <span className="flex justify-between"><span>Largo de las conexiones</span><span className="text-[var(--text-tertiary)] tabular-nums">{linkDistance}</span></span>
                    <input type="range" min={30} max={200} value={linkDistance} onChange={e => setLinkDistance(Number(e.target.value))} className="w-full mt-1 accent-[var(--accent)]" />
                  </label>
                </div>
              </section>

              <section>
                <h4 className="text-[13px] font-medium text-[var(--text-secondary)] pb-1">Vistas guardadas</h4>
                <div className="rounded-[12px] bg-[var(--bg-surface-elevated)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                  {savedViews.map(v => (
                    <div key={v.id} className="flex items-center">
                      <button type="button" onClick={() => handleApplySavedView(v)} className="flex-1 min-h-[44px] px-3 flex items-center gap-2 text-left text-[14px] text-[var(--text-primary)] cursor-pointer">
                        <Bookmark className="w-4 h-4 text-[var(--accent)]" aria-hidden />
                        <span className="truncate">{v.name}</span>
                      </button>
                      <button type="button" onClick={() => handleDeleteView(v.id)} aria-label={`Borrar vista ${v.name}`} className="px-3 h-[44px] text-[13px] text-[var(--semantic-red)] cursor-pointer">
                        Borrar
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 p-2">
                    <input
                      type="text"
                      value={newViewName}
                      onChange={e => setNewViewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveCurrentView(); }}
                      placeholder="Nombre de esta vista…"
                      aria-label="Nombre de la vista"
                      className="flex-1 min-w-0 h-9 rounded-[9px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-2.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                    />
                    <button type="button" onClick={handleSaveCurrentView} disabled={!newViewName.trim()} className="h-9 px-3 rounded-[9px] bg-[var(--accent)] text-white text-[14px] font-semibold disabled:opacity-40 cursor-pointer">
                      Guardar
                    </button>
                  </div>
                </div>
              </section>

              <div className="rounded-[12px] bg-[var(--bg-surface-elevated)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                <button type="button" onClick={() => { setShowOptions(false); setShowOrphansPanel(true); }} className="w-full min-h-[44px] px-3 flex items-center justify-between text-[14px] text-[var(--text-primary)] cursor-pointer">
                  <span>Elementos sin conexiones</span>
                  <span className="flex items-center gap-1 text-[var(--text-tertiary)] tabular-nums">{orphansList.length}<ChevronRight className="w-4 h-4" aria-hidden /></span>
                </button>
                <button type="button" onClick={() => { setShowOptions(false); setShowGuideModal(true); }} className="w-full min-h-[44px] px-3 flex items-center gap-2 text-[14px] text-[var(--accent)] cursor-pointer">
                  <BookOpen className="w-4 h-4" aria-hidden />
                  Cómo funciona el grafo
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Elementos sin conexiones */}
      {showOrphansPanel && !compact && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20 sm:bg-transparent sm:absolute" onClick={() => setShowOrphansPanel(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Elementos sin conexiones"
            className={`z-40 flex flex-col ${glass} fixed inset-x-0 bottom-0 max-h-[70vh] rounded-t-[22px] safe-area-pb sm:absolute sm:inset-x-auto sm:right-3 sm:top-[60px] sm:bottom-3 sm:w-[320px] sm:max-h-none sm:rounded-[18px] t-sheet-enter`}
          >
            <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-semibold text-[var(--text-primary)]">Sin conexiones · {orphansList.length}</h3>
                <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
                  Mencionalos con <code className="px-1 rounded bg-[var(--bg-surface-muted)]">[[Nombre]]</code> en una nota para sumarlos a la red.
                </p>
              </div>
              <button type="button" onClick={() => setShowOrphansPanel(false)} aria-label="Cerrar" className="w-7 h-7 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)] flex items-center justify-center shrink-0 cursor-pointer">
                <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto mx-3 mb-3 rounded-[12px] bg-[var(--bg-surface-elevated)] divide-y divide-[var(--border-subtle)]">
              {orphansList.map(item => (
                <li key={item.id}>
                  <button type="button" onClick={() => onNavigate?.(item.path)} className="w-full min-h-[44px] px-3 py-2 flex items-center gap-2.5 text-left cursor-pointer">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: typeColor(item.type, dark) }} aria-hidden />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] text-[var(--text-primary)] truncate">{displayTitle(item.title, item.type)}</span>
                      <span className="block text-[12px] text-[var(--text-tertiary)]">{typeLabel(item.type)}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <SecondBrainGuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
    </div>
  );
};
