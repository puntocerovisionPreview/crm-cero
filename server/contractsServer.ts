import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore, DocumentReference } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AcceptedDoc, docTotalOf, onboardingFromDoc, agreementFromDoc } from '../src/utils/contracts';
import { todayLocal, addDays } from '../src/utils/dates';
import { isWebProject } from '../src/automation/webRecipe';

/**
 * DEL "ACEPTO" AL PROYECTO EN MARCHA
 * - Al aceptar o firmar: proyecto (o se completa el existente) con su plan de cobro,
 *   tareas de arranque y el prospecto pasa a "cliente". Solo una vez por presupuesto.
 * - Seguimiento: avisa si no lo abrió en 3 días, si lo abrió y no respondió, y 2 días antes de vencer.
 * - Firma digital: guarda una copia del PDF firmado en Storage.
 */

type Notify = (title: string, body: string) => Promise<void>;
const num = (n: number) => String(n).padStart(4, '0');

export async function onboardAcceptedDocument(db: Firestore, ref: DocumentReference, notify?: Notify): Promise<string | null> {
  const outcome = await db.runTransaction(async batch => {
  const snap = await batch.get(ref);
  if (!snap.exists) return null;
  const d = { ...(snap.data() as any), id: snap.id } as AcceptedDoc & { kind: string; onboardedProjectId?: string; status: string };
  if (d.kind !== 'presupuesto' || d.status !== 'aceptado') return null;
  if (d.onboardedProjectId) return { projectId: d.onboardedProjectId, notice: null };

  const today = todayLocal();
  const nowIso = new Date().toISOString();
  let projectId: string;
  let created = false;
  let installments = 0;
  let webRecipe = false;

  if (d.projectId) {
    // Ya era un proyecto/posible cliente: se activa y, si no tenía plan de cobro, se le crea
    projectId = d.projectId;
    const pref = db.collection('projects').doc(projectId);
    const p = (await batch.get(pref)).data() as any;
    if (!p) throw new Error('El proyecto del presupuesto ya no existe.');
    webRecipe = isWebProject(p);
    const update: Record<string, any> = { isLead: false, updatedAt: today, lastContactDate: today };
    if (!p.clientEmail && d.email) update.clientEmail = d.email;
    if (!p?.billingAgreement?.installments?.length) {
      const agreement = agreementFromDoc(d, today);
      update.billingAgreement = agreement;
      update.montoAcordado = agreement.totalAmount;
      update.estimatedPrice = p?.estimatedPrice || agreement.totalAmount;
      update.estimatedCurrency = p?.estimatedCurrency || d.currency;
      installments = agreement.installments.length;
    }
    if (p && ['Posible proyecto', 'Propuesta enviada', 'En negociación'].includes(p.status)) update.status = 'En curso';
    batch.set(pref, update, { merge: true });
  } else {
    const { project, agreement } = onboardingFromDoc(d, today, nowIso);
    webRecipe = isWebProject(project);
    projectId = project.id;
    created = true;
    installments = agreement.installments.length;
    batch.set(db.collection('projects').doc(projectId), JSON.parse(JSON.stringify(project)));
  }

  const { tasks } = onboardingFromDoc(d, today, nowIso);
  // Web tiene una única plantilla compartida con el alta manual, evitando dos kick-offs.
  if (!webRecipe) tasks.forEach((t) => batch.set(db.collection('tasks').doc(t.id), { ...t, projectId }, { merge: true }));
  if (webRecipe) batch.set(db.collection('projects').doc(projectId), { webAutomationRequested: true }, { merge: true });
  if (d.prospectId) {
    batch.set(db.collection('prospects').doc(d.prospectId), { stage: 'cliente', nextActionDate: null, updatedAt: nowIso }, { merge: true });
  }
  batch.set(ref, { onboardedProjectId: projectId }, { merge: true });
  return { projectId, notice: { title: `🚀 ${d.clientName}: proyecto en marcha`, body: `${created ? 'Se creó el proyecto' : 'Se activó el proyecto'}${installments ? ` con ${installments} ${installments === 1 ? 'cobro' : 'cobros'} agendados` : ''}${webRecipe ? '. La preparación Web quedó en cola.' : ` y ${tasks.length} tareas de arranque.`}` } };
  });
  if (notify && outcome?.notice) await notify(outcome.notice.title, outcome.notice.body).catch(() => undefined);
  return outcome?.projectId || null;
}

/** El cliente abrió el link. La primera vez te avisa. */
export async function markDocumentViewed(db: Firestore, token: string, notify?: Notify): Promise<void> {
  const found = await db.collection('documents').where('token', '==', token).limit(1).get();
  const doc = found.docs[0];
  if (!doc) return;
  const d = doc.data() as any;
  if (d.kind !== 'presupuesto' || d.status === 'aceptado') return;
  const now = new Date().toISOString();
  const first = !d.viewedAt;
  await doc.ref.set({ viewedAt: d.viewedAt || now, lastViewedAt: now, viewCount: (Number(d.viewCount) || 0) + 1 }, { merge: true });
  if (first && notify) await notify(`👀 ${d.clientName} abrió el presupuesto`, `Presupuesto N° ${num(d.number)}. Buen momento para escribirle.`).catch(() => undefined);
}

/** Una vez por día: presupuestos que necesitan un empujón. Solo te avisa a vos. */
export async function documentFollowups(db: Firestore, notify: Notify): Promise<string> {
  const today = todayLocal();
  const healthRef = db.collection('settings').doc('system_health');
  const h = ((await healthRef.get()).data() as any) || {};
  if (h.docFollowupsDay === today) return 'ya revisado hoy';
  const snap = await db.collection('documents').where('status', '==', 'enviado').get();
  const lines: string[] = [];
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const d = doc.data() as any;
    if (d.kind !== 'presupuesto') return;
    const r = d.reminders || {};
    const sent = String(d.createdAt || d.issueDate || '').slice(0, 10);
    const expired = d.validUntil && d.validUntil < today;
    if (expired) return;
    if (!d.viewedAt && sent && addDays(sent, 3) <= today && !r.noView) {
      lines.push(`${d.clientName} no abrió el presupuesto N° ${num(d.number)} (hace 3 días o más).`);
      batch.set(doc.ref, { reminders: { ...r, noView: today } }, { merge: true });
    } else if (d.viewedAt && addDays(String(d.viewedAt).slice(0, 10), 3) <= today && !r.noReply) {
      lines.push(`${d.clientName} vio el presupuesto N° ${num(d.number)} y no respondió.`);
      batch.set(doc.ref, { reminders: { ...r, noReply: today } }, { merge: true });
    }
    if (d.validUntil && addDays(today, 2) >= d.validUntil && !r.expiring) {
      lines.push(`El presupuesto de ${d.clientName} vence el ${d.validUntil.slice(8, 10)}/${d.validUntil.slice(5, 7)}.`);
      batch.set(doc.ref, { reminders: { ...r, expiring: today } }, { merge: true });
    }
  });
  batch.set(healthRef, { docFollowupsDay: today }, { merge: true });
  await batch.commit();
  if (lines.length) await notify(`📄 ${lines.length === 1 ? 'Un presupuesto' : `${lines.length} presupuestos`} para seguir`, lines.slice(0, 4).join('\n')).catch(() => undefined);
  return lines.length ? `${lines.length} avisos` : 'nada para avisar';
}

/** Copia del PDF firmado (Documenso) en Storage: el comprobante queda tuyo aunque cambies de proveedor. */
export async function saveSignedPdf(
  db: Firestore,
  ref: DocumentReference,
  envelopeId: string,
  documenso: (path: string, init: RequestInit) => Promise<any>,
  download: (path: string) => Promise<Buffer>
): Promise<string> {
  const bucketName = (firebaseConfig as any).storageBucket as string | undefined;
  if (!bucketName || !getApps()[0]) throw new Error('No hay bucket de Storage configurado');
  const env = await documenso(`/envelope/${encodeURIComponent(envelopeId)}`, { method: 'GET' });
  const items: any[] = env.envelopeItems || env.items || [];
  const itemId = items[0]?.id;
  if (!itemId) throw new Error('Documenso no devolvió el archivo del sobre');
  const pdf = await download(`/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`);
  const path = `documentos-firmados/${ref.id}.pdf`;
  await getStorage(getApps()[0]).bucket(bucketName).file(path).save(pdf, { contentType: 'application/pdf', resumable: false });
  await ref.set({ signature: { signedPdfPath: path } }, { merge: true });
  return path;
}

export { docTotalOf };
