import type { Firestore } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { driveRequest } from './driveOAuth';
import { DriveFolder, DriveRole, normalizeClientEmail } from '../src/automation/webRecipe';

export const resourceKey = (key: string) => createHash('sha256').update(key).digest('hex');
/** Persistir el ID ANTES de crear permite recuperar una respuesta perdida sin duplicar. */
export async function ensureFolder(db: Firestore, key: string, name: string, parent?: string): Promise<string> {
  const ref = db.collection('automation_resources').doc(resourceKey(key));
  let id = (await ref.get()).data()?.driveId as string | undefined;
  if (!id) {
    const generated = await driveRequest<{ ids: string[] }>(db, 'files/generateIds?count=1&space=drive&type=files');
    id = await db.runTransaction(async tx => {
      const existing = (await tx.get(ref)).data()?.driveId;
      if (existing) return existing as string;
      tx.create(ref, { driveId: generated.ids[0], key });
      return generated.ids[0];
    });
  }
  try {
    const found = await driveRequest(db, `files/${id}?fields=id,trashed,mimeType`);
    if (found.trashed) throw new Error('Una carpeta está en la papelera de Drive. Restaurala y reintentá.');
    if (found.mimeType !== 'application/vnd.google-apps.folder') throw new Error('El recurso de Drive no es una carpeta.');
    return id!;
  } catch (e: any) { if (e.status !== 404) throw e; }
  try {
    await driveRequest(db, 'files?fields=id', 'POST', { id, name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) });
  } catch (e: any) {
    if (e.status !== 409) throw e;
    await driveRequest(db, `files/${id}?fields=id`);
  }
  return id!;
}
export async function shareFolder(db: Firestore, folder: DriveFolder, rawEmail: string, role: DriveRole): Promise<void> {
  const email = normalizeClientEmail(rawEmail);
  const permissions: any[] = [];
  let page: string | undefined;
  do {
    const data = await driveRequest(db, `files/${folder.id}/permissions?fields=permissions(id,emailAddress,role),nextPageToken&pageSize=100${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
    permissions.push(...(data.permissions || []));
    page = data.nextPageToken;
  } while (page);
  const existing = permissions.find(p => p.emailAddress?.toLowerCase() === email);
  if (existing?.role === 'owner') throw new Error('El correo del cliente coincide con el propietario de Drive. Usá el correo del cliente.');
  if (existing) {
    if (existing.role !== role) await driveRequest(db, `files/${folder.id}/permissions/${existing.id}`, 'PATCH', { role });
  } else {
    await driveRequest(db, `files/${folder.id}/permissions?sendNotificationEmail=true`, 'POST', { type: 'user', role, emailAddress: email });
  }
}

/** Copia recuperable por marcador; el bloqueo por proyecto serializa confirmaciones. */
export async function deliverFile(db: Firestore, projectId: string, fileId: string, destination: string, mode: 'copy' | 'move'): Promise<void> {
  const ref = db.collection('automation_resources').doc(resourceKey(`delivery:${projectId}:${fileId}:${mode}`));
  if ((await ref.get()).data()?.done) return;
  const file = await driveRequest(db, `files/${fileId}?fields=id,name,mimeType,parents,trashed`);
  if (file.trashed || file.mimeType === 'application/vnd.google-apps.folder') throw new Error('Elegí archivos finales, no carpetas ni archivos de la papelera.');
  if (mode === 'move') {
    if (!(file.parents || []).includes(destination)) {
      const remove = (file.parents || []).join(',');
      await driveRequest(db, `files/${fileId}?addParents=${destination}${remove ? `&removeParents=${encodeURIComponent(remove)}` : ''}&fields=id`, 'PATCH', {});
    }
  } else {
    const marker = resourceKey(`copy:${projectId}:${fileId}`);
    const q = `'${destination}' in parents and trashed = false and appProperties has { key='ceroDelivery' and value='${marker}' }`;
    const found = await driveRequest(db, `files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
    if (!found.files?.length) await driveRequest(db, `files/${fileId}/copy?fields=id`, 'POST', { name: file.name, parents: [destination], appProperties: { ceroDelivery: marker } });
  }
  await ref.set({ done: true, fileId, projectId, mode, at: new Date().toISOString() });
}
