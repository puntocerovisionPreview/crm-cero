import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { deepSanitize } from './sanitize';
import type { Payment, Project, StudioPaymentSettings } from '../types';

/**
 * PRESUPUESTOS Y RECIBOS CON LINK
 * - El original (con todo) queda en `documents/{id}` (solo vos).
 * - El cliente ve una copia mínima en `student_portals/doc_{token}`: esa colección ya se puede
 *   leer por ID con el link (como el portal del alumno), nadie la puede listar ni modificar.
 * - "Acepto" lo registra el servidor (/api/documento/:token/aceptar) y te avisa.
 */

export type DocumentKind = 'presupuesto' | 'recibo';
export type DocumentStatus = 'enviado' | 'aceptado' | 'rechazado';

export interface DocItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface StudioDocument {
  id: string;
  token: string;
  kind: DocumentKind;
  number: number;
  projectId?: string;
  prospectId?: string;
  clientName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  items: DocItem[];
  currency: 'ARS' | 'USD';
  issueDate: string; // YYYY-MM-DD
  validUntil?: string; // presupuesto
  notes?: string; // condiciones / forma de pago / detalle
  paymentDate?: string; // recibo
  paymentMethod?: string; // recibo
  paymentId?: string; // recibo: pago del que sale
  studioName: string;
  paymentInfo?: { holder?: string; alias?: string; cbu?: string; link?: string };
  status: DocumentStatus;
  acceptedAt?: string;
  acceptedName?: string;
  createdAt: string;
}

export const PUBLIC_PREFIX = 'doc_';
export const STUDIO_NAME = 'Punto Cero';

export const docTotal = (items: DocItem[]) => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
export const docTitle = (d: Pick<StudioDocument, 'kind' | 'number'>) => `${d.kind === 'presupuesto' ? 'Presupuesto' : 'Recibo'} N° ${String(d.number).padStart(4, '0')}`;

export function newToken(): string {
  const bytes = new Uint8Array(18);
  const c = (globalThis as any).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 57]).join('');
}

export function nextNumber(docs: StudioDocument[], kind: DocumentKind): number {
  return docs.filter((d) => d.kind === kind).reduce((m, d) => Math.max(m, Number(d.number) || 0), 0) + 1;
}

export function paymentInfoFrom(settings?: StudioPaymentSettings, currency: 'ARS' | 'USD' = 'ARS') {
  if (!settings) return undefined;
  const info = {
    holder: settings.accountHolder,
    alias: currency === 'USD' ? settings.aliasUsd : settings.aliasArs,
    cbu: currency === 'USD' ? settings.cbuUsd : settings.cbuArs,
    link: settings.paymentLink,
  };
  return Object.values(info).some(Boolean) ? info : undefined;
}

/** Lo que ve el cliente: sin ids internos ni datos de contacto */
export function publicCopy(d: StudioDocument) {
  return {
    token: d.token,
    kind: d.kind,
    number: d.number,
    clientName: d.clientName,
    contactName: d.contactName || null,
    items: d.items,
    currency: d.currency,
    total: docTotal(d.items),
    issueDate: d.issueDate,
    validUntil: d.validUntil || null,
    notes: d.notes || null,
    paymentDate: d.paymentDate || null,
    paymentMethod: d.paymentMethod || null,
    studioName: d.studioName,
    paymentInfo: d.kind === 'presupuesto' ? d.paymentInfo || null : null,
    status: d.status,
    acceptedAt: d.acceptedAt || null,
    acceptedName: d.acceptedName || null,
  };
}
export type PublicDocument = ReturnType<typeof publicCopy>;

export function documentUrl(token: string): string {
  return `${window.location.origin}/doc/${token}`;
}

export function receiptFromPayment(project: Project, payment: Payment, number: number, studioName = STUDIO_NAME): StudioDocument {
  const today = payment.date || new Date().toISOString().slice(0, 10);
  return {
    id: `docr_${payment.id}`,
    token: newToken(),
    kind: 'recibo',
    number,
    projectId: project.id,
    clientName: project.clientName,
    contactName: project.ownerName,
    phone: project.clientPhone,
    items: [{ description: payment.note?.trim() || `Pago ${project.clientName}`, quantity: 1, unitPrice: Number(payment.amount) || 0 }],
    currency: payment.currency,
    issueDate: today,
    paymentDate: today,
    paymentMethod: payment.method,
    paymentId: payment.id,
    studioName,
    status: 'enviado',
    createdAt: new Date().toISOString(),
  };
}

export function shareMessage(d: StudioDocument, url: string): string {
  const name = (d.contactName || d.clientName).split(' ')[0];
  return d.kind === 'presupuesto'
    ? `¡Hola ${name}! Te paso el presupuesto: ${url}\n\nAhí podés verlo, descargarlo en PDF y aceptarlo con un toque. Cualquier duda me escribís.`
    : `¡Hola ${name}! Gracias por el pago. Te dejo el recibo: ${url}`;
}

// ---- Firestore ----

export async function saveDocument(d: StudioDocument): Promise<void> {
  await setDoc(doc(db, 'documents', d.id), deepSanitize(d));
  await setDoc(doc(db, 'student_portals', `${PUBLIC_PREFIX}${d.token}`), deepSanitize(publicCopy(d)));
}

export async function deleteDocument(d: StudioDocument): Promise<void> {
  await deleteDoc(doc(db, 'student_portals', `${PUBLIC_PREFIX}${d.token}`));
  await deleteDoc(doc(db, 'documents', d.id));
}

export function subscribeDocuments(onChanged: (docs: StudioDocument[]) => void) {
  return onSnapshot(
    collection(db, 'documents'),
    (snap) => onChanged(snap.docs.map((x) => ({ ...(x.data() as StudioDocument), id: x.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    (err) => console.warn('subscribeDocuments error:', err)
  );
}

export async function loadPublicDocument(token: string): Promise<PublicDocument | null> {
  const snap = await getDoc(doc(db, 'student_portals', `${PUBLIC_PREFIX}${token}`));
  return snap.exists() ? (snap.data() as PublicDocument) : null;
}

export async function acceptPublicDocument(token: string, name: string): Promise<void> {
  const res = await fetch(`/api/documento/${encodeURIComponent(token)}/aceptar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
}
