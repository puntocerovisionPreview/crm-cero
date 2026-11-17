/**
 * PUENTE CLAUDE ↔ CRM (17/11/2026)
 * Deja que Claude lea y anote en el CRM desde C:\CERO_EMPRESA, con la llave de Firebase de Juan.
 *
 * Reglas:
 * - La llave vive SOLO en la compu de Juan (C:\CERO_EMPRESA\04_SISTEMAS\accesos_aplicaciones\firebase-crm-cero-clave.json
 *   o la variable CRM_CLAVE). Nunca va a GitHub ni a OneDrive.
 * - Toda escritura muestra antes qué va a cambiar y SOLO se guarda con --confirmar (Claude lo usa después del OK de Juan).
 * - Lecturas acotadas (un documento o una consulta filtrada) para cuidar el cupo gratis de Firestore.
 *
 * Uso (desde 04_SISTEMAS/crm-cero):
 *   node node_modules/tsx/dist/cli.mjs scripts/claude-crm.ts <comando> [...]
 *
 *   cliente <PAF-013|WEB-001>                   ficha resumida: temas, entregas, Base, tareas
 *   entregar <PAF-ID> <tema> [--link URL] [--version v2] [--confirmar]
 *                                               marca la entrega del tema como Entregado (hoy) y actualiza el portal
 *   embudo [YYYY-MM]                            los números del mes en Web y PAF
 *   prospecto <texto>                           busca por estudio o nombre (empieza con…)
 *   venta <prospectoId> [--interes web|paf] [--tildar id,id] [--carpeta URL] [--confirmar]
 *                                               Web/PAF, checklist del paso a paso y carpeta de una oportunidad
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldPath, type Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { BASE_DEL_TEMA, entregaHecha, portalFromProject, PORTAL_SEPARATE_FIELDS, PAF_PORTAL_COLLECTION, type PafDelivery } from '../src/portal/model';
import { conHistorial } from '../src/portal/historial';
import { temaPorId, type TemaId } from '../src/portal/presencia';
import { VENTA_ETAPAS, embudoDelMes, etapaDeProspecto, PASOS_EMBUDO } from '../src/utils/ventaEtapas';
import type { Project, Prospect, ProspectEvent } from '../src/types';

const CLAVE_POR_DEFECTO = 'C:\\CERO_EMPRESA\\04_SISTEMAS\\accesos_aplicaciones\\firebase-crm-cero-clave.json';

function conectar(): Firestore {
  const ruta = process.env.CRM_CLAVE || CLAVE_POR_DEFECTO;
  let app;
  if (existsSync(ruta)) {
    const creds = JSON.parse(readFileSync(ruta, 'utf8'));
    app = initializeApp({ credential: cert(creds), projectId: creds.project_id });
  } else {
    // Sin llave (el proyecto de AI Studio no deja crearla): entra con la cuenta de Google de Juan,
    // que tiene "Usuario de Cloud Datastore". Se activa una vez con:
    //   gcloud auth application-default login
    // (C:\Users\.Cero\google-cloud-sdk\bin\gcloud.cmd)
    app = initializeApp({ credential: applicationDefault(), projectId: firebaseConfig.projectId });
  }
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// ---------- argumentos ----------
const [, , comando, ...resto] = process.argv;
const flags: Record<string, string | true> = {};
const pos: string[] = [];
for (let i = 0; i < resto.length; i++) {
  const a = resto[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = resto[i + 1];
    if (v !== undefined && !v.startsWith('--')) { flags[k] = v; i++; } else flags[k] = true;
  } else pos.push(a);
}
const confirmar = flags.confirmar === true;
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
const ddmm = (d?: string) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '—');

/** Quita undefined (Firestore no los acepta) */
const limpio = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

async function proyectoPorId(db: Firestore, clienteId: string): Promise<Project> {
  const snap = await db.collection('projects').where('pafClienteId', '==', clienteId.toUpperCase()).limit(1).get();
  if (snap.empty) { console.error(`No encontré ningún cliente con ID ${clienteId}.`); process.exit(3); }
  return { ...(snap.docs[0].data() as Project), id: snap.docs[0].id };
}

async function reunionesDe(db: Firestore, projectId: string) {
  const snap = await db.collection('meetings').where('projectId', '==', projectId).get();
  return snap.docs.map((d) => ({ ...(d.data() as any), id: d.id }));
}

// ---------- comandos ----------
async function cliente(db: Firestore) {
  const p = await proyectoPorId(db, pos[0] || '');
  console.log(`${p.pafClienteId} · ${p.clientName}${p.ownerName ? ` (${p.ownerName})` : ''}`);
  console.log(`Portal: ${p.pafPortal?.publishedAt ? `publicado el ${ddmm(p.pafPortal.publishedAt.slice(0, 10))}` : 'sin publicar'}`);
  if (p.pafDrive) console.log(`Drive: interna ${p.pafDrive.carpetaInterna || '—'} · resultados ${p.pafDrive.resultados || '—'}`);
  const temas = (p as any).pafTemas || {};
  console.log('\nTemas empezados:', Object.keys(temas).filter((k) => temas[k]?.empezado).join(', ') || 'ninguno');
  console.log('\nEntregas:');
  (p.pafEntregas || []).forEach((e) => console.log(`- [${e.tema || '—'}] ${e.titulo}${e.version ? ` ${e.version}` : ''}: ${e.estado || 'por preparar'}${e.fecha ? ` · ${ddmm(e.fecha)}` : ''}${e.publicada ? ' · la ve' : ''}`));
  console.log('\nBase estratégica:');
  (Object.keys(BASE_DEL_TEMA) as TemaId[]).forEach((t) => {
    const b = BASE_DEL_TEMA[t]!;
    const hecha = (p.pafEntregas || []).find((e) => e.tema === t && entregaHecha(e.estado));
    console.log(`- p. ${b.pagina} (${t}): ${hecha ? `cargada ${ddmm(hecha.fecha)}` : 'pendiente'}`);
  });
  const tareas = p.pafTareas || [];
  console.log(`\nTareas del estudio: ${tareas.filter((t) => t.estado === 'habilitada').length} habilitadas · ${tareas.filter((t) => t.estado === 'enviada').length} tocó "Terminé" · ${tareas.filter((t) => t.estado === 'aprobada').length} completas`);
}

async function entregar(db: Firestore) {
  const [id, tema] = pos;
  if (!id || !tema) { console.error('Uso: entregar <PAF-ID> <tema> [--link URL] [--version v2] [--confirmar]'); process.exit(1); }
  const p = await proyectoPorId(db, id);
  const t = temaPorId(tema as TemaId);
  const lista = p.pafEntregas || [];
  let e: PafDelivery | undefined = lista.find((x) => x.tema === tema && !entregaHecha(x.estado));
  const link = typeof flags.link === 'string' ? flags.link : undefined;
  const version = typeof flags.version === 'string' ? flags.version : undefined;
  if (link && !/^https:\/\//.test(link)) { console.error('El link tiene que empezar con https://'); process.exit(1); }
  const nueva = !e;
  if (!e) {
    const titulo = t?.entregas[0]?.titulo;
    if (!titulo) { console.error(`El tema "${tema}" no tiene entrega en la plantilla y no hay una cargada.`); process.exit(1); }
    e = { id: `e_${Date.now().toString(36)}`, tema: tema as TemaId, titulo, publicada: false, decision: t?.entregas[0]?.decision, canal: 'WhatsApp' };
  }
  const actualizada: PafDelivery = { ...e, estado: 'entregada', fecha: hoy, publicada: true, ...(link ? { enlace: link } : {}), ...(version ? { version } : {}) };
  const entregas = nueva ? [...lista, actualizada] : lista.map((x) => (x.id === e!.id ? actualizada : x));
  const updates = { pafEntregas: entregas, ...conHistorial(p, `Entregado: ${actualizada.titulo}${actualizada.version ? ` ${actualizada.version}` : ''} (subido a Resultados)`), updatedAt: new Date().toISOString() };

  console.log(`${p.pafClienteId} · ${p.clientName}`);
  console.log(`${nueva ? 'Nueva entrega' : 'Entrega'}: ${actualizada.titulo}${actualizada.version ? ` ${actualizada.version}` : ''} → Entregado ${ddmm(hoy)}, visible en el portal${link ? `, link ${link}` : ''}`);
  const base = BASE_DEL_TEMA[tema as TemaId];
  if (base) console.log(`Base: la página ${base.pagina} queda como cargada.`);
  if (!confirmar) { console.log('\n(Vista previa: no se guardó nada. Para guardar, agregá --confirmar.)'); return; }

  await db.collection('projects').doc(p.id).set(limpio(updates), { merge: true });
  console.log('✓ Guardado en la ficha.');
  if (p.pafClienteId && p.pafPortal?.publishedAt) {
    const r = portalFromProject({ ...p, ...updates } as any, await reunionesDe(db, p.id));
    if ('errors' in r) { console.log(`⚠ La ficha se guardó, pero el portal no se actualizó: ${r.errors.join(' ')}`); return; }
    const own = Object.fromEntries(Object.entries(r.doc).filter(([k]) => !(PORTAL_SEPARATE_FIELDS as readonly string[]).includes(k)));
    await db.collection(PAF_PORTAL_COLLECTION).doc(r.doc.clienteId).set(limpio(own), { mergeFields: Object.keys(own) });
    console.log('✓ Portal actualizado.');
  } else console.log('(El portal no está publicado: no se tocó.)');
}

async function embudo(db: Firestore) {
  const month = pos[0] || hoy.slice(0, 7);
  const evSnap = await db.collection('prospect_events').where('date', '>=', `${month}-01`).where('date', '<=', `${month}-31`).get();
  const events = evSnap.docs.map((d) => ({ ...(d.data() as ProspectEvent), id: d.id }));
  // Solo los prospectos de esos eventos (para saber si son Web o PAF)
  const ids = [...new Set(events.map((e) => e.prospectId))];
  const prospects: Prospect[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((x) => db.collection('prospects').doc(x));
    if (refs.length) (await db.getAll(...refs)).forEach((d) => d.exists && prospects.push({ ...(d.data() as Prospect), id: d.id }));
  }
  const projSnap = await db.collection('projects').get();
  const projects = projSnap.docs.map((d) => ({ ...(d.data() as Project), id: d.id }));
  const e = embudoDelMes(events, prospects, projects, month);
  console.log(`Embudo de ${month}`);
  console.log(['', ...PASOS_EMBUDO.map((p) => p.label)].join('\t'));
  (['web', 'paf', 'sin'] as const).forEach((f) => console.log([f === 'sin' ? 'Sin definir' : f.toUpperCase(), ...PASOS_EMBUDO.map((p) => e[f][p.key])].join('\t')));
  console.log(['Total', ...PASOS_EMBUDO.map((p) => e.web[p.key] + e.paf[p.key] + e.sin[p.key])].join('\t'));
}

async function prospecto(db: Firestore) {
  const q = pos.join(' ').trim();
  if (!q) { console.error('Uso: prospecto <texto>'); process.exit(1); }
  const variantes = [...new Set([q, q[0].toUpperCase() + q.slice(1), q.toLowerCase()])];
  const vistos = new Map<string, Prospect>();
  for (const campo of ['studio', 'name']) {
    for (const v of variantes) {
      const s = await db.collection('prospects').where(campo, '>=', v).where(campo, '<=', `${v}\uf8ff`).limit(10).get();
      s.docs.forEach((d) => vistos.set(d.id, { ...(d.data() as Prospect), id: d.id }));
    }
  }
  if (!vistos.size) { console.log('No encontré prospectos que empiecen así.'); return; }
  vistos.forEach((p) => {
    const et = etapaDeProspecto(p);
    console.log(`${p.id} · ${p.studio || p.name}${p.studio ? ` (${p.name})` : ''} · ${p.stage}${p.interes ? ` · ${p.interes.toUpperCase()}` : ''} · ${et.etapa ? `etapa ${et.n} de 9 (${et.hechos}/${et.total})` : et.n === 0 ? 'esperando auditoría' : 'etapas listas'}`);
  });
}

async function venta(db: Firestore) {
  const id = pos[0];
  if (!id) { console.error('Uso: venta <prospectoId> [--interes web|paf] [--tildar id,id] [--carpeta URL] [--confirmar]'); process.exit(1); }
  const ref = db.collection('prospects').doc(id);
  const snap = await ref.get();
  if (!snap.exists) { console.error(`No existe el prospecto ${id}.`); process.exit(3); }
  const p = { ...(snap.data() as Prospect), id };
  const updates: Partial<Prospect> = {};
  if (flags.interes === 'web' || flags.interes === 'paf') updates.interes = flags.interes;
  if (typeof flags.carpeta === 'string') {
    if (!/^https:\/\//.test(flags.carpeta)) { console.error('La carpeta tiene que ser un link https://'); process.exit(1); }
    updates.carpetaUrl = flags.carpeta;
  }
  if (typeof flags.tildar === 'string') {
    const validos = new Set(VENTA_ETAPAS.flatMap((e) => e.checks.map((c) => c.id)));
    const pedidos = flags.tildar.split(',').map((s) => s.trim()).filter(Boolean);
    const malos = pedidos.filter((x) => !validos.has(x));
    if (malos.length) { console.error(`No existen: ${malos.join(', ')}`); process.exit(1); }
    updates.ventaChecks = { ...(p.ventaChecks || {}), ...Object.fromEntries(pedidos.map((x) => [x, true])) };
  }
  const antes = etapaDeProspecto(p);
  const despues = etapaDeProspecto({ ...p, ...updates });
  console.log(`${p.studio || p.name} · ${p.stage}`);
  console.log(`Etapa: ${antes.n} → ${despues.n}${despues.etapa ? ` (${despues.etapa.titulo}: ${despues.hechos}/${despues.total})` : ''}`);
  if (despues.etapa) despues.etapa.checks.forEach((c) => console.log(`  [${({ ...(p.ventaChecks || {}), ...(updates.ventaChecks || {}) } as Record<string, boolean>)[c.id] ? 'x' : ' '}] ${c.id} · ${c.text}`));
  if (!Object.keys(updates).length) return;
  console.log('Cambios:', JSON.stringify(updates));
  if (!confirmar) { console.log('\n(Vista previa: no se guardó nada. Para guardar, agregá --confirmar.)'); return; }
  await ref.set(limpio({ ...updates, updatedAt: new Date().toISOString() }), { merge: true });
  console.log('✓ Guardado.');
}

const COMANDOS: Record<string, (db: Firestore) => Promise<void>> = { cliente, entregar, embudo, prospecto, venta };
const fn = COMANDOS[comando || ''];
if (!fn) {
  console.log('Comandos: cliente, entregar, embudo, prospecto, venta (ver el encabezado de scripts/claude-crm.ts)');
  process.exit(comando ? 1 : 0);
}
fn(conectar()).then(() => process.exit(0)).catch((err) => {
  const msg = String(err?.message || err);
  console.error(
    /RESOURCE_EXHAUSTED|Quota/i.test(msg) ? 'Se terminó el cupo diario gratis de Firestore. Vuelve a las ~5 de la mañana.'
      : /default credentials|invalid_grant|reauth/i.test(msg) ? 'No hay sesión de Google para el puente. Juan tiene que correr una vez: gcloud auth application-default login'
        : `Error: ${msg}`
  );
  process.exit(1);
});
