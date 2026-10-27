import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/firebase', () => ({ db: {} }));
import { createPafPlan, planProgress, publicMilestones, safeResourceUrl } from '../src/panels/pafPlan';
import { buildStudentPortalSnapshot } from '../src/utils/studentPortal';
import { snapshotOf, type ClientPanel } from '../src/panels/model';
import type { Project } from '../src/types';

const project = {
  id: 'private-project', clientName: 'Estudio prueba', projectType: 'paf_pro', notes: 'Nota interna',
  clientEmail: 'private@example.com', montoAcordado: 1100,
  pafStartDate: '2026-01-01', pafStage: 'Mes 3: Cierres',
  pafMilestones: [{ id: 'm1', title: 'Web publicada', month: 1, pillar: 'presencia', completed: true }, { id: 'm2', title: 'Contenido', month: 2, pillar: 'adquisicion', completed: false }],
  consultingSessions: [{ id: 's1', date: '2026-01-05', topics: 'Oferta', notes: 'Comentario privado', recordingUrl: 'https://example.com/video' }],
} as Project;

describe('portal PAF: programa real y compatibilidad', () => {
  it('respeta los hitos guardados sin completar pendientes por fecha o etapa', () => {
    const plan = createPafPlan(project);
    expect(plan.items.map((i) => i.status)).toEqual(['entregado', 'pendiente']);
    expect(planProgress(plan)).toEqual({ done: 1, total: 2, percent: 50 });
  });
  it('prepara los tres meses para proyectos anteriores sin hitos, sin inventar entregas', () => {
    const plan = createPafPlan();
    expect(new Set(plan.items.map((i) => i.month))).toEqual(new Set([1, 2, 3]));
    expect(planProgress(plan).done).toBe(0);
    expect(plan.cm.enabled).toBe(true);
    expect(createPafPlan({ projectType: 'paf_base' }).items.length).toBeLessThan(plan.items.length);
  });
  it('admite un plan vacío sin divisiones inválidas', () => {
    expect(planProgress({ ...createPafPlan(), items: [] })).toEqual({ done: 0, total: 0, percent: 0 });
  });
  it('publica el roadmap sin notas, pagos, emails ni campos extra de los hitos', () => {
    const snap = buildStudentPortalSnapshot(project, 'a'.repeat(36));
    expect(snap.roadmap?.[0].status).toBe('entregado');
    expect(snap.sessions[0].topics).toBe('Oferta');
    const json = JSON.stringify(snap);
    expect(json).not.toContain('Nota interna');
    expect(json).not.toContain('Comentario privado');
    expect(json).not.toContain('private@example.com');
    expect(json).not.toContain('montoAcordado');
    const milestones = publicMilestones([{ ...project.pafMilestones![0], secret: 'privado' } as any]);
    expect(JSON.stringify(milestones)).not.toContain('secret');
  });
  it('conserva la compatibilidad con portales sin hitos y horas acordadas en cero', () => {
    const snap = buildStudentPortalSnapshot({ ...project, pafMilestones: undefined, pafConsultingHoursTotal: 0 }, 'b'.repeat(36));
    expect(snap.roadmap).toEqual([]);
    expect(snap.hoursTotal).toBe(0);
  });
  it('las acciones y copias del panel conservan su plan PAF', () => {
    const paf = createPafPlan(project);
    const panel = { id: 'internal', token: 'a'.repeat(36), active: true, clientName: 'Estudio', phone: 'privado', goals: [], tasks: [], pieces: [], weekStart: '2026-01-01', createdAt: '', paf } as ClientPanel;
    expect(snapshotOf(panel).paf).toEqual(paf);
    expect(snapshotOf(panel)).not.toHaveProperty('phone');
  });
});

describe('recursos del panel público', () => {
  it('acepta enlaces web sin credenciales y rechaza scripts, archivos o URLs inválidas', () => {
    expect(safeResourceUrl('https://example.com/guia')).toBe('https://example.com/guia');
    for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///private', '/relative', 'https://user:password@example.com', 'no es un enlace']) expect(safeResourceUrl(value)).toBeNull();
  });
});
