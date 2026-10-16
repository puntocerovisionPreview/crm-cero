import { describe, it, expect } from 'vitest';
import { taskBelongsToProject, resolveTaskProject, normalizeText } from './taskProject';
import { AgendaTask, Project } from '../types';

describe('taskProject utilities', () => {
  const mockProject1: Project = {
    id: 'proj_cane',
    clientName: 'Estudio Cane Arquitectura',
    status: 'En curso',
    notes: '',
    archived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  const mockProject2: Project = {
    id: 'proj_skyvilla',
    clientName: 'SkyVilla Residencias',
    status: 'En curso',
    notes: '',
    archived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('normalizes accents and casing correctly', () => {
    expect(normalizeText('  Estúdio Cané  ')).toBe('estudio cane');
    expect(normalizeText('SkyVilla')).toBe('skyvilla');
  });

  it('matches by direct projectId', () => {
    const task: AgendaTask = {
      id: 't1',
      title: 'Hacer entrega',
      date: '2026-10-01',
      completed: false,
      createdAt: '2026-10-01',
      projectId: 'proj_cane',
    };
    expect(taskBelongsToProject(task, mockProject1)).toBe(true);
    expect(taskBelongsToProject(task, mockProject2)).toBe(false);
  });

  it('NEVER matches another project even if title contains other project name when projectId is different', () => {
    const task: AgendaTask = {
      id: 't2',
      title: 'Reunión con Estudio Cane Arquitectura para SkyVilla',
      date: '2026-10-01',
      completed: false,
      createdAt: '2026-10-01',
      projectId: 'proj_skyvilla',
      projectName: 'SkyVilla Residencias',
    };
    // Even though title mentions Estudio Cane Arquitectura, its projectId is proj_skyvilla!
    expect(taskBelongsToProject(task, mockProject1)).toBe(false);
    expect(taskBelongsToProject(task, mockProject2)).toBe(true);
  });

  it('matches by projectName when projectId is missing', () => {
    const task: AgendaTask = {
      id: 't3',
      title: 'Diseñar wireframes',
      date: '2026-10-01',
      completed: false,
      createdAt: '2026-10-01',
      projectName: 'Estudio Cane Arquitectura',
    };
    expect(taskBelongsToProject(task, mockProject1)).toBe(true);
    expect(taskBelongsToProject(task, mockProject2)).toBe(false);
  });

  it('falls back to title only when neither projectId nor projectName exists', () => {
    const taskWithMention: AgendaTask = {
      id: 't4',
      title: 'Llamar a Estudio Cane Arquitectura a las 15hs',
      date: '2026-10-01',
      completed: false,
      createdAt: '2026-10-01',
    };
    expect(taskBelongsToProject(taskWithMention, mockProject1)).toBe(true);
    expect(taskBelongsToProject(taskWithMention, mockProject2)).toBe(false);

    const taskUnrelated: AgendaTask = {
      id: 't5',
      title: 'Ir al supermercado',
      date: '2026-10-01',
      completed: false,
      createdAt: '2026-10-01',
    };
    expect(taskBelongsToProject(taskUnrelated, mockProject1)).toBe(false);
  });

  it('resolveTaskProject correctly resolves the matching project', () => {
    const projects = [mockProject1, mockProject2];

    const taskWithId: AgendaTask = {
      id: 't6',
      title: 'Tarea 6',
      date: '2026-10-01',
      completed: false,
      createdAt: '2026-10-01',
      projectId: 'proj_skyvilla',
    };
    expect(resolveTaskProject(taskWithId, projects)?.id).toBe('proj_skyvilla');

    const taskWithName: AgendaTask = {
      id: 't7',
      title: 'Tarea 7',
      date: '2026-10-01',
      completed: false,
      createdAt: '2026-10-01',
      projectName: 'Estudio Cane Arquitectura',
    };
    expect(resolveTaskProject(taskWithName, projects)?.id).toBe('proj_cane');
  });
});
