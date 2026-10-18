import {
  Brain,
  Calendar,
  CalendarDays,
  Compass,
  DollarSign,
  Send,
  Server,
  Sparkles,
  Sun,
  Target,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * SECTORES DEL ESTUDIO
 * La Home (/inicio) muestra un sector por tarjeta; al entrar a uno, el menú lateral y la barra
 * de abajo muestran solo las pantallas de ese sector (más "← Inicio").
 * Ninguna pantalla se quitó: cada una vive en su sector.
 */

export type SectorKey = 'dia' | 'prospeccion' | 'clientes' | 'finanzas' | 'cerebro';

export interface SectorItem {
  label: string;
  path: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

export interface Sector {
  key: SectorKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Color de acento de la tarjeta (colores del sistema de Apple) */
  tint: string;
  /** Los principales van grandes arriba en la Home */
  featured: boolean;
  items: SectorItem[];
}

const is = (...paths: string[]) => (p: string) => paths.includes(p);
const starts = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p === x || p.startsWith(`${x}/`));

export const SECTORS: Sector[] = [
  {
    key: 'dia',
    label: 'Mi día',
    description: 'Tareas, reuniones, rutina y foco',
    icon: Sun,
    tint: '#FF9500',
    featured: true,
    items: [
      { label: 'Hoy', path: '/hoy', icon: Calendar, match: (p) => is('/hoy', '/agenda')(p) || p.startsWith('/agenda/') },
      { label: 'Semana', path: '/semana', icon: Target, match: starts('/semana', '/misiones') },
      { label: 'Calendario', path: '/calendario', icon: CalendarDays, match: starts('/calendario', '/calendar') },
      { label: 'Modo foco', path: '/foco', icon: Sparkles, match: starts('/foco', '/focus') },
    ],
  },
  {
    key: 'prospeccion',
    label: 'Prospección',
    description: 'Contactos en frío, seguimientos y auditorías',
    icon: Send,
    tint: '#34C759',
    featured: true,
    items: [{ label: 'Prospección', path: '/prospeccion', icon: Send, match: starts('/prospeccion', '/prospectos') }],
  },
  {
    key: 'clientes',
    label: 'Clientes',
    description: 'Fichas Web y PAF, cuotas y proyectos',
    icon: Users,
    tint: '#007AFF',
    featured: false,
    items: [
      { label: 'Clientes', path: '/clientes', icon: Users, match: (p) => starts('/clientes', '/proyectos')(p) && p !== '/clientes/nuevo' },
      { label: 'Horizonte', path: '/horizonte', icon: Compass, match: starts('/horizonte', '/horizon', '/gantt') },
      { label: 'Nuevo cliente', path: '/clientes/nuevo', icon: UserPlus, match: is('/clientes/nuevo') },
    ],
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    description: 'Cobros, gastos del estudio y finanzas personales',
    icon: DollarSign,
    tint: '#5856D6',
    featured: false,
    items: [
      { label: 'Dinero', path: '/dinero', icon: DollarSign, match: starts('/dinero', '/finanzas', '/ingresos') },
      { label: 'Gastos fijos', path: '/gastos-fijos', icon: Server, match: starts('/gastos-fijos', '/vencimientos', '/suscripciones', '/dominios', '/hosting', '/ias') },
      { label: 'Mis finanzas', path: '/mis-finanzas', icon: User, match: starts('/mis-finanzas', '/finanzas-personales') },
    ],
  },
  {
    key: 'cerebro',
    label: 'Cerebro',
    description: 'Notas conectadas y grafo',
    icon: Brain,
    tint: '#AF52DE',
    featured: false,
    // Notas y Grafo son pestañas dentro de Cerebro
    items: [{ label: 'Cerebro', path: '/cerebro', icon: Brain, match: starts('/cerebro', '/notas', '/notes', '/grafo', '/graph', '/segundo-cerebro') }],
  },
];

export const HOME_PATH = '/inicio';

/** Sector al que pertenece una pantalla (null en la Home, Ajustes o Ayuda) */
export function sectorForPath(path: string): Sector | null {
  return SECTORS.find((s) => s.items.some((i) => i.match(path))) || null;
}
