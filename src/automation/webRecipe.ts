/** Contrato compartido de la primera receta. No contiene credenciales. */
export type DriveRole = 'writer' | 'reader';
export const WEB_FOLDERS = [
  { key: 'identidad', name: 'Identidad', role: 'writer' },
  { key: 'proyectos', name: 'Proyectos y fotografías', role: 'writer' },
  { key: 'textos', name: 'Textos y contenido', role: 'writer' },
  { key: 'entregables', name: 'Entregables', role: 'reader' },
] as const;
export interface ClientDriveFolder { key: string; name: string; url: string; role: DriveRole }
export interface DriveFolder extends ClientDriveFolder {
  id: string;
  sharedWith?: string;
  status: 'creada' | 'compartida';
}
export const WEB_STEPS = ['panel_crear', 'tareas_plantilla', 'reunion_arranque', 'drive_carpetas', 'drive_compartir', 'panel_materiales_drive', 'mensaje_bienvenida'] as const;
export type WebStep = typeof WEB_STEPS[number];
export interface StepResult { status: 'ok' | 'pendiente' | 'error'; detail: string; at: string }
export interface WebRun {
  kind?: 'state';
  id: string; recipe: 'desarrollo_web'; projectId: string; clientName: string;
  createdAt: string; baseDate: string; pending: boolean; nextAttemptAt: number;
  steps: Partial<Record<WebStep | 'seguimiento', StepResult>>;
  folders?: DriveFolder[]; panelId?: string; panelToken?: string; welcome?: string;
  publishedAt?: string; leaseUntil?: number; leaseOwner?: string;
}
export function validClientEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function normalizeClientEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!validClientEmail(email)) throw new Error('Cargá un correo válido del cliente para compartir las carpetas.');
  return email;
}
export function isWebProject(project: { serviceType?: string; projectType?: string }): boolean {
  return project.serviceType ? project.serviceType === 'web' : project.projectType === 'web';
}
export function materialFolder(title: string): string | undefined {
  const t = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/logo|identidad|marca/.test(t)) return 'identidad';
  if (/foto|obra|proyecto/.test(t)) return 'proyectos';
  if (/texto|contenido|contacto|redes/.test(t)) return 'textos';
  return undefined;
}
export function publicFolders(folders: DriveFolder[] = []): ClientDriveFolder[] {
  return folders.filter(f => f.status === 'compartida').map(({ key, name, url, role }) => ({ key, name, url, role }));
}
export function welcomeMessage(client: string, panelUrl: string, folders: DriveFolder[]): string {
  const links = publicFolders(folders).map(f => `${f.name}: ${f.url}`).join('\n');
  return `Hola ${client}, ¡arrancamos con tu web!\nAcá tenés tu panel: ${panelUrl}${links ? `\n\nTus carpetas:\n${links}` : '\nLas carpetas de Drive todavía están pendientes.'}\n\nPodés subir tu logo, fotos y textos. Coordinamos la llamada de arranque por acá.`;
}
export const WEB_TASKS = [
  { key: 'llamada', title: 'Coordinar llamada de arranque', days: 2 },
  { key: 'materiales', title: 'Revisar identidad, fotos y textos recibidos', days: 3 },
  { key: 'estructura', title: 'Definir estructura y páginas de la web', days: 5 },
] as const;
export function validDriveId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{10,150}$/.test(id);
}
export function isPrivateIntegrationDocument(collection: string, id: string): boolean {
  return collection === 'settings' && (id === 'integrations_private' || id.startsWith('drive_oauth_'));
}
