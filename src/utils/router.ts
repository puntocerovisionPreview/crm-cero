import { useState, useEffect, useCallback, startTransition, addTransitionType } from 'react';

// Dirección de la navegación para las animaciones entre pantallas:
// entrar a un detalle (/clientes → /clientes/abc) desliza hacia adelante; volver, hacia atrás;
// moverse entre secciones del menú es "lateral" (fundido suave, sin deslizar).
let lastRoutePath = typeof window !== 'undefined' ? window.location.pathname : '/';

export function getNavigationType(prev: string, next: string): 'nav-forward' | 'nav-back' | 'nav-lateral' {
  const depth = (p: string) => p.split('/').filter(Boolean).length;
  if (prev === next) return 'nav-lateral';
  const strip = (p: string) => p.replace(/\/$/, '');
  if (depth(next) > depth(prev) && next.startsWith(strip(prev) + '/')) return 'nav-forward';
  if (depth(next) < depth(prev) && prev.startsWith(strip(next) + '/')) return 'nav-back';
  return 'nav-lateral';
}

function navigationType(nextPath: string) {
  const type = getNavigationType(lastRoutePath, nextPath);
  lastRoutePath = nextPath;
  return type;
}

function setRouteAnimated(setRoute: (r: RouteMatch) => void, next: RouteMatch) {
  const type = navigationType(next.path);
  startTransition(() => {
    addTransitionType(type);
    setRoute(next);
  });
}

export type RouteName =
  | 'inicio'
  | 'hoy'
  | 'prospeccion'
  | 'oportunidades'
  | 'agenda'
  | 'agenda-task'
  | 'calendario'
  | 'gastos-fijos'
  | 'clientes'
  | 'cliente-nuevo'
  | 'cliente-detalle'
  | 'cliente-cobro-nuevo'
  | 'cliente-acuerdo'
  | 'dinero'
  | 'finanzas'
  | 'mis-finanzas'
  | 'cerebro'
  | 'notas'
  | 'grafo'
  | 'segundo-cerebro'
  | 'ajustes'
  | 'ayuda'
  | 'foco'
  | 'horizonte'
  | 'semana'
  | 'mision-detalle';

export interface RouteMatch {
  name: RouteName;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
}

export function parseRoute(rawPathname: string, searchStr: string = ''): RouteMatch {
  // Normalize path
  let path = rawPathname || '/';
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Parse query params
  const searchParams = new URLSearchParams(searchStr || (typeof window !== 'undefined' ? window.location.search : ''));
  const query: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    query[key] = val;
  });

  // Misiones de la semana (/semana)
  if (path === '/semana' || path === '/misiones' || path === '/semanal') {
    return { name: 'semana', path: '/semana', params: {}, query };
  }

  if (path.startsWith('/semana/mision/')) {
    const id = path.replace('/semana/mision/', '');
    return { name: 'mision-detalle', path, params: { id }, query };
  }

  if (path.startsWith('/semana/') && path !== '/semana') {
    const id = path.replace('/semana/', '');
    return { name: 'mision-detalle', path, params: { id }, query };
  }

  // Horizonte
  if (path === '/horizonte' || path === '/horizon' || path === '/horozon' || path === '/gantt') {
    return { name: 'horizonte', path: '/horizonte', params: {}, query };
  }

  // Calendario 360°
  if (path === '/calendario' || path === '/calendar') {
    return { name: 'calendario', path: '/calendario', params: {}, query };
  }

  // Gastos Fijos, Dominios, Hosting & IAs
  if (
    path === '/gastos-fijos' || 
    path === '/vencimientos' || 
    path === '/suscripciones' || 
    path === '/dominios' || 
    path === '/hosting' || 
    path === '/ias'
  ) {
    return { name: 'gastos-fijos', path: '/gastos-fijos', params: {}, query };
  }

  // 0) INICIO: la Home con los sectores del estudio (también al abrir la app)
  if (path === '/inicio' || path === '/home') {
    return { name: 'inicio', path: '/inicio', params: {}, query };
  }
  if (path === '/' && !(typeof localStorage !== 'undefined' && localStorage.getItem('cero_pref_default_view') === 'foco')) {
    return { name: 'inicio', path: '/inicio', params: {}, query };
  }

  // 1) HOY (handles /, /agenda, /hoy)
  if (path === '/' || path === '/agenda' || path === '/hoy') {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('cero_pref_default_view') === 'foco' && path === '/') {
      return { name: 'foco', path: '/foco', params: {}, query };
    }
    return { name: 'hoy', path: '/hoy', params: {}, query };
  }

  // Foco
  if (path === '/foco' || path === '/focus') {
    return { name: 'foco', path: '/foco', params: {}, query };
  }

  // Tarea o reunión detalle
  if (path.startsWith('/agenda/tarea/')) {
    const id = path.replace('/agenda/tarea/', '');
    return { name: 'agenda-task', path, params: { id, type: 'tarea' }, query };
  }

  if (path.startsWith('/agenda/reunion/')) {
    const id = path.replace('/agenda/reunion/', '');
    return { name: 'agenda-task', path, params: { id, type: 'reunion' }, query };
  }

  // 2) CLIENTES
  if (path === '/clientes/nuevo' || path === '/proyectos/nuevo' || path === '/proyectos/new') {
    return { name: 'cliente-nuevo', path: '/clientes/nuevo', params: {}, query };
  }

  // Registrar cobro screen
  const cobroMatch = path.match(/^\/clientes\/([^/]+)\/cobro\/nuevo$/);
  if (cobroMatch) {
    return { name: 'cliente-cobro-nuevo', path, params: { id: cobroMatch[1] }, query };
  }

  // Acuerdo de cobro editor screen
  const acuerdoMatch = path.match(/^\/clientes\/([^/]+)\/acuerdo$/);
  if (acuerdoMatch) {
    return { name: 'cliente-acuerdo', path, params: { id: acuerdoMatch[1] }, query };
  }

  if (path === '/clientes/paf' || path === '/proyectos/paf' || path === '/paf') {
    return { name: 'clientes', path: '/clientes', params: {}, query: { tipo: 'paf', ...query } };
  }

  if (path === '/clientes/web' || path === '/proyectos/web' || path === '/web') {
    return { name: 'clientes', path: '/clientes', params: {}, query: { tipo: 'web', ...query } };
  }

  if (path.startsWith('/clientes/')) {
    const id = path.replace('/clientes/', '');
    return { name: 'cliente-detalle', path, params: { id }, query };
  }

  if (path.startsWith('/proyectos/') || path.startsWith('/proyecto/') || path.startsWith('/fichas/') || path.startsWith('/ficha/')) {
    const id = path.replace(/^(\/proyectos\/|\/proyecto\/|\/fichas\/|\/ficha\/)/, '');
    return { name: 'cliente-detalle', path: `/clientes/${id}`, params: { id }, query };
  }

  if (path === '/oportunidades' || path === '/pipeline') {
    return { name: 'oportunidades', path: '/oportunidades', params: {}, query };
  }

  if (path === '/prospeccion' || path === '/prospectos') {
    return { name: 'prospeccion', path: '/prospeccion', params: {}, query };
  }

  if (path === '/clientes' || path === '/proyectos' || path === '/projects' || path === '/fichas' || path === '/ficha') {
    return { name: 'clientes', path: '/clientes', params: {}, query };
  }

  // 3) DINERO
  if (path === '/dinero') {
    return { name: 'dinero', path: '/dinero', params: {}, query };
  }
  if (path === '/finanzas' || path === '/ingresos') {
    return { name: 'dinero', path: '/dinero', params: {}, query: { modo: 'estudio', ...query } };
  }
  if (path.startsWith('/mis-finanzas')) {
    return { name: 'mis-finanzas', path, params: {}, query };
  }
  if (path === '/finanzas-personales') {
    return { name: 'mis-finanzas', path: '/mis-finanzas', params: {}, query };
  }

  // 4) CEREBRO
  if (path === '/cerebro') {
    return { name: 'cerebro', path: '/cerebro', params: {}, query };
  }
  if (path === '/notas' || path === '/notes') {
    return { name: 'cerebro', path: '/cerebro', params: {}, query: { tab: 'notas', ...query } };
  }
  if (path === '/grafo' || path === '/graph') {
    return { name: 'cerebro', path: '/cerebro', params: {}, query: { tab: 'grafo', ...query } };
  }
  if (path === '/segundo-cerebro' || path === '/brain') {
    return { name: 'cerebro', path: '/cerebro', params: {}, query: { tab: 'inicio', ...query } };
  }

  // 5) AJUSTES
  if (path.startsWith('/ajustes/')) {
    const seccion = path.replace('/ajustes/', '');
    return { name: 'ajustes', path, params: { seccion }, query };
  }
  if (path === '/ajustes') {
    return { name: 'ajustes', path: '/ajustes', params: {}, query };
  }
  if (path === '/ayuda') {
    return { name: 'ajustes', path: '/ajustes/ayuda', params: { seccion: 'ayuda' }, query };
  }

  // Default fallback
  return { name: 'hoy', path: '/hoy', params: {}, query };
}

// Global subscribers for router updates
type RouteListener = (match: RouteMatch) => void;
const listeners = new Set<RouteListener>();

export function navigateTo(path: string, options?: { replace?: boolean }) {
  if (typeof window === 'undefined') return;

  const currentPath = window.location.pathname + window.location.search;
  if (currentPath === path) return;

  if (options?.replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }

  const [pathname, search] = path.split('?');
  const match = parseRoute(pathname, search ? `?${search}` : '');
  listeners.forEach(fn => fn(match));
}

export function goBackTo(fallbackPath: string = '/clientes') {
  if (typeof window === 'undefined') return;
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigateTo(fallbackPath);
  }
}

export function useRouter() {
  const [route, setRoute] = useState<RouteMatch>(() => {
    if (typeof window === 'undefined') {
      return { name: 'agenda', path: '/agenda', params: {}, query: {} };
    }
    return parseRoute(window.location.pathname, window.location.search);
  });

  useEffect(() => {
    const handlePopState = () => {
      const match = parseRoute(window.location.pathname, window.location.search);
      setRouteAnimated(setRoute, match);
    };

    const listener: RouteListener = (newRoute) => {
      setRouteAnimated(setRoute, newRoute);
    };

    listeners.add(listener);
    window.addEventListener('popstate', handlePopState);

    // Initial normalize if at root '/'
    if (window.location.pathname === '/') {
      const startsInFocus = localStorage.getItem('cero_pref_default_view') === 'foco';
      window.history.replaceState({}, '', startsInFocus ? '/foco' : '/inicio');
    }

    return () => {
      listeners.delete(listener);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    navigateTo(path, options);
  }, []);

  const goBack = useCallback((fallback: string = '/clientes') => {
    goBackTo(fallback);
  }, []);

  return {
    path: route.path,
    route,
    currentRoute: route,
    navigate,
    goBack,
  };
}
