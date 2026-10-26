import type { Firestore } from 'firebase-admin/firestore';
import { randomBytes, randomUUID } from 'crypto';
import { Project } from '../src/types';
import { ClientPanel, panelDocId, snapshotOf } from '../src/panels/model';
import { emptyWeb } from '../src/panels/web';
import { addDays, startOfWeekMonday, todayLocal } from '../src/utils/dates';
import { DriveFolder, WebRun, WebStep, WEB_FOLDERS, WEB_STEPS, WEB_TASKS, isWebProject, materialFolder, normalizeClientEmail, publicFolders, welcomeMessage } from '../src/automation/webRecipe';
import { appOrigin, DrivePending } from './driveOAuth';
import { ensureFolder, shareFolder } from './driveFiles';
import { recordError, recordJobRun } from './health';

export type AutomationNotify = (title: string, body: string) => Promise<void>;
const clean = <T>(data: T): T => JSON.parse(JSON.stringify(data));
export const runRef = (db: Firestore, id: string) => db.collection('automation_runs').doc(`web_${id}`);

export async function enrollWebProject(db: Firestore, projectId: string): Promise<void> {
  await db.runTransaction(async tx => {
    const pref = db.collection('projects').doc(projectId);
    const project = (await tx.get(pref)).data() as Project | undefined;
    const ref = runRef(db, projectId);
    const existing = await tx.get(ref);
    if (!project) return;
    if (!isWebProject(project)) { tx.update(pref, { webAutomationRequested: false }); return; }
    if (!existing.exists) tx.create(ref, {
      kind: 'state', id: ref.id, recipe: 'desarrollo_web', projectId, clientName: project.clientName,
      createdAt: new Date().toISOString(), baseDate: todayLocal(), pending: true, nextAttemptAt: 0, steps: {},
    } satisfies WebRun);
    tx.update(pref, { webAutomationRequested: false });
  });
}

/** Una instancia por proyecto, con vencimiento recuperable y comprobación antes de cada efecto. */
export async function withProjectLease<T>(db: Firestore, id: string, work: (heartbeat: () => Promise<void>) => Promise<T>): Promise<T> {
  const ref = runRef(db, id);
  const owner = randomUUID();
  await db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (!data) throw new Error('Primero prepará la automatización del proyecto.');
    if (data.leaseUntil > Date.now()) throw new DrivePending('La automatización está en curso. Revisá de nuevo en unos segundos.');
    tx.update(ref, { leaseOwner: owner, leaseUntil: Date.now() + 120_000 });
  });
  const heartbeat = () => db.runTransaction(async tx => {
    const data = (await tx.get(ref)).data();
    if (data?.leaseOwner !== owner) throw new Error('La ejecución cambió. Reintentá.');
    tx.update(ref, { leaseUntil: Date.now() + 120_000 });
  });
  try { return await work(heartbeat); }
  finally {
    await db.runTransaction(async tx => {
      if ((await tx.get(ref)).data()?.leaseOwner === owner) tx.update(ref, { leaseUntil: 0, leaseOwner: '' });
    });
  }
}

async function createOnce(db: Firestore, collection: string, id: string, value: object): Promise<void> {
  await db.runTransaction(async tx => {
    const ref = db.collection(collection).doc(id);
    if (!(await tx.get(ref)).exists) tx.create(ref, clean(value));
  });
}

async function ensurePanel(db: Firestore, p: Project): Promise<ClientPanel> {
  // Incluye paneles manuales ya existentes. La transacción evita dos paneles automáticos.
  return db.runTransaction(async tx => {
    const matches = await tx.get(db.collection('client_panels').where('projectId', '==', p.id).limit(1));
    const ref = matches.docs[0]?.ref || db.collection('client_panels').doc(`web_${p.id}`);
    const previous = matches.docs[0]?.data() as ClientPanel | undefined;
    const panel: ClientPanel = previous ? { ...previous, id: ref.id, web: previous.web || emptyWeb() } : {
      id: ref.id, token: randomBytes(18).toString('hex'), active: true, projectId: p.id,
      clientName: p.clientName, weekStart: startOfWeekMonday(todayLocal()), goals: [], tasks: [], pieces: [],
      createdAt: new Date().toISOString(), web: emptyWeb(),
    };
    tx.set(ref, clean(panel));
    if (panel.active) tx.set(db.collection('student_portals').doc(panelDocId(panel.token)), clean(snapshotOf(panel)));
    return panel;
  });
}

async function linkPanel(db: Firestore, panelId: string, folders: DriveFolder[]): Promise<void> {
  await db.runTransaction(async tx => {
    const ref = db.collection('client_panels').doc(panelId);
    const p = (await tx.get(ref)).data() as ClientPanel | undefined;
    if (!p) throw new Error('No encontramos el panel. Reintentá para volver a vincularlo.');
    const visible = publicFolders(folders);
    const next: ClientPanel = { ...p, driveFolders: visible, updatedAt: new Date().toISOString() };
    if (p.web) next.web = { ...p.web, materials: p.web.materials.map(m => ({ ...m, driveFolderUrl: visible.find(f => f.key === materialFolder(m.title))?.url })) };
    tx.set(ref, clean(next));
    if (next.active) tx.set(db.collection('student_portals').doc(panelDocId(next.token)), clean(snapshotOf(next)));
  });
}

export async function executeWebRecipe(db: Firestore, projectId: string, notify: AutomationNotify = async () => {}): Promise<WebRun> {
  return withProjectLease(db, projectId, async heartbeat => {
    const ref = runRef(db, projectId);
    let run = (await ref.get()).data() as WebRun;
    const data = (await db.collection('projects').doc(projectId).get()).data();
    if (!data) { await ref.update({ pending: false }); throw new Error('El proyecto ya no existe.'); }
    const p = { ...data, id: projectId } as Project;
    if (!isWebProject(p)) { await ref.update({ pending: false }); throw new Error('La receta es para proyectos Web.'); }
    const attempt = db.collection('automation_runs').doc(`attempt_${randomUUID()}`);
    await attempt.set({ kind: 'execution', recipe: 'desarrollo_web', projectId, createdAt: new Date().toISOString(), steps: {}, status: 'en_curso' });
    const persist = async (patch: Partial<WebRun>) => { await ref.update(clean(patch)); run = { ...run, ...patch }; };
    for (const step of WEB_STEPS) {
      await heartbeat();
      try {
        // Los pasos que reflejan links/correo se reconcilian en cada reintento.
        if (run.steps[step]?.status === 'ok' && ['tareas_plantilla', 'reunion_arranque'].includes(step)) continue;
        if (step === 'panel_crear') {
          const panel = await ensurePanel(db, p);
          await persist({ panelId: panel.id, panelToken: panel.token });
        }
        if (step === 'tareas_plantilla') {
          for (const t of WEB_TASKS) {
            await heartbeat();
            const id = `auto_web_${projectId}_${t.key}`;
            await createOnce(db, 'tasks', id, { id, title: t.title, date: addDays(run.baseDate, t.days), completed: false, createdAt: run.createdAt, projectId, projectName: p.clientName, category: 'general' });
          }
        }
        if (step === 'reunion_arranque') {
          const id = `auto_web_${projectId}_arranque`;
          await createOnce(db, 'meetings', id, { id, title: `Propuesta de arranque · ${p.clientName}`, proposed: true, date: addDays(run.baseDate, 2), completed: false, createdAt: run.createdAt, projectId, projectName: p.clientName, durationHours: 1, notes: 'Horario a coordinar con el cliente. Agregá la hora para sincronizar con Google Calendar.' });
        }
        if (step === 'drive_carpetas') {
          const root = await ensureFolder(db, 'cero-root', 'Clientes .Cero');
          await heartbeat();
          const parent = await ensureFolder(db, `project:${projectId}`, `${p.clientName} – Desarrollo web`, root);
          const folders = [...(run.folders || [])];
          for (const f of WEB_FOLDERS) {
            await heartbeat();
            const id = await ensureFolder(db, `project:${projectId}:${f.key}`, f.name, parent);
            const existing = folders.find(x => x.key === f.key);
            if (!existing) folders.push({ ...f, id, url: `https://drive.google.com/drive/folders/${id}`, status: 'creada' });
            await persist({ folders });
          }
        }
        if (step === 'drive_compartir') {
          if (run.folders?.length !== WEB_FOLDERS.length) throw new DrivePending('Primero deben crearse las carpetas.');
          let email: string;
          try { email = normalizeClientEmail(p.clientEmail); } catch (e: any) { throw new DrivePending(e.message); }
          // Cambiar de destinatario requiere revisar el acceso anterior, no compartir silenciosamente.
          if (run.folders.some(f => f.sharedWith && f.sharedWith !== email)) throw new DrivePending('El correo cambió. Revisá y quitá el acceso anterior en Drive antes de cambiar el destinatario de esta automatización.');
          for (const folder of run.folders) {
            await heartbeat();
            await shareFolder(db, folder, email, folder.role);
            folder.status = 'compartida'; folder.sharedWith = email;
            await persist({ folders: run.folders });
          }
        }
        if (step === 'panel_materiales_drive') {
          if (!run.panelId) throw new DrivePending('Primero debe crearse el panel.');
          await linkPanel(db, run.panelId, run.folders || []);
          if (publicFolders(run.folders).length !== WEB_FOLDERS.length) throw new DrivePending('Los enlaces se completan cuando estén compartidas todas las carpetas.');
        }
        if (step === 'mensaje_bienvenida') {
          if (!run.panelToken) throw new DrivePending('Primero debe crearse el panel.');
          const active = run.panelId && (await db.collection('client_panels').doc(run.panelId).get()).data()?.active;
          if (!active) throw new DrivePending('El panel está desactivado. Activá el panel para preparar la bienvenida.');
          await persist({ welcome: welcomeMessage(p.clientName, `${appOrigin()}/panel/${run.panelToken}`, run.folders || []) });
        }
        run.steps[step] = { status: 'ok', detail: 'Listo', at: new Date().toISOString() };
      } catch (e: any) {
        const status = e instanceof DrivePending ? 'pendiente' : 'error';
        run.steps[step] = { status, detail: e.message, at: new Date().toISOString() };
        if (status === 'error') await recordError(db, { source: 'automatizacion-web', message: `${step}: ${e.message}`, path: `/clientes/${projectId}` }, notify);
      }
      await persist({ steps: run.steps });
      await attempt.update({ [`steps.${step}`]: run.steps[step] });
    }
    await persist({ pending: WEB_STEPS.some(s => run.steps[s]?.status !== 'ok'), nextAttemptAt: Date.now() + 15 * 60_000 });
    await recordJobRun(db, 'receta-web', !run.pending, run.pending ? 'Hay acciones pendientes. Revisá la ficha del proyecto.' : 'Receta Web completada.');
    await attempt.update({ status: run.pending ? 'pendiente' : 'ok', completedAt: new Date().toISOString() });
    return run;
  });
}

export async function ensureWebFollowup(db: Firestore, projectId: string): Promise<void> {
  const ref = runRef(db, projectId);
  const run = (await ref.get()).data() as WebRun | undefined;
  if (!run || !run.panelId || run.steps.seguimiento?.status === 'ok') return;
  const panel = (await db.collection('client_panels').doc(run.panelId).get()).data() as ClientPanel | undefined;
  if (panel?.web?.stage !== 'publicada') return;
  const base = run.publishedAt || todayLocal();
  await ref.update({ publishedAt: base });
  for (const days of [30, 90]) {
    const id = `auto_web_${projectId}_seguimiento_${days}`;
    await createOnce(db, 'tasks', id, { id, title: `Seguimiento de la web · ${days} días`, date: addDays(base, days), completed: false, createdAt: new Date().toISOString(), projectId, projectName: run.clientName });
  }
  await ref.update({ 'steps.seguimiento': { status: 'ok', detail: 'Seguimientos creados a 30 y 90 días.', at: new Date().toISOString() } });
}

export async function processWebQueue(db: Firestore, notify: AutomationNotify): Promise<void> {
  const requested = await db.collection('projects').where('webAutomationRequested', '==', true).limit(20).get();
  for (const p of requested.docs) await enrollWebProject(db, p.id);
  const runs = await db.collection('automation_runs').where('kind', '==', 'state').get();
  let count = 0;
  for (const doc of runs.docs) {
    if (doc.data().kind === 'execution') continue;
    const run = doc.data() as WebRun;
    try {
      await ensureWebFollowup(db, run.projectId);
      if (count < 5 && run.pending && run.nextAttemptAt <= Date.now() && !(run.leaseUntil! > Date.now())) { count++; await executeWebRecipe(db, run.projectId, notify); }
    } catch (e: any) {
      if (!(e instanceof DrivePending)) await recordError(db, { source: 'automatizacion-web', message: e.message }, notify);
    }
  }
}
