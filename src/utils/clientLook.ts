import type { Project } from '../types';
import { safeColor } from '../portal/model';

/** Iniciales del estudio para su círculo (sin "Estudio" ni "Arq.") */
export const iniciales = (n: string) => n.replace(/^(estudio|arq\.?|arquitectura)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';

const COLORES = ['#2F5D46', '#3B5B8C', '#8A5A3C', '#6B4E8C', '#2E6F73', '#8C3B4E'];
/** El color de su marca si lo cargaste; si no, uno fijo según el nombre */
export const colorDe = (p: Pick<Project, 'clientName' | 'pafPortal'>) => safeColor(p.pafPortal?.marca) || COLORES[[...p.clientName].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORES.length];
