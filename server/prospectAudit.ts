import express from 'express';
import { getAdminDb, sendTelegram } from './automation';
import { applyAction, auditFromWebPayload, matchAuditToProspect, normalizeInstagram } from '../src/prospecting/core';
import { escapeHtml } from '../src/automation/messages';
import { todayLocal } from '../src/utils/dates';
import type { Prospect } from '../src/types';

/**
 * ENTRADA DE AUTO AUDITORÍAS DESDE LA WEB (somospuntocero.online/auditoria)
 *
 * El formulario manda acá una copia de las respuestas además del mail. El servidor:
 * 1) encuentra al prospecto (por el link personal ?p= o por WhatsApp / Instagram / email / estudio),
 *    o lo crea si no estaba en la lista;
 * 2) guarda puntaje y respuestas, lo pasa a "Auditoría completada" y suma la métrica;
 * 3) crea la tarea "Video de auditoría" con vencimiento a 48 hs;
 * 4) avisa por Telegram si está conectado.
 *
 * Es público (lo llama una página web): solo acepta tu dominio, limita la cantidad de envíos
 * y recorta todos los textos. No devuelve datos.
 */

const ALLOWED_ORIGINS = ['https://somospuntocero.online', 'https://www.somospuntocero.online'];
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

const clip = (v: any, n = 200) => (v === undefined || v === null ? '' : String(v).slice(0, n).trim());

export function registerProspectAuditRoute(app: express.Express) {
  const cors: express.RequestHandler = (req, res, next) => {
    const origin = String(req.headers.origin || '');
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };

  // text/plain evita la consulta previa de CORS; el cuerpo es JSON igual
  app.options('/api/prospects/audit', cors);
  app.post('/api/prospects/audit', cors, express.text({ type: '*/*', limit: '64kb' }), async (req, res) => {
    const origin = String(req.headers.origin || '');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ ok: false });
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (rateLimited(ip)) return res.status(429).json({ ok: false });

    let body: Record<string, any>;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch {
      return res.status(400).json({ ok: false });
    }
    if (!clip(body.nombre) && !clip(body.nombre_estudio)) return res.status(400).json({ ok: false });

    const db = getAdminDb();
    if (!db) {
      console.warn('[auditoria] Llegó una auditoría pero el servidor no tiene acceso a la base; solo quedó en el mail.');
      return res.status(503).json({ ok: false });
    }

    try {
      const today = todayLocal();
      const nowIso = new Date().toISOString();
      const snap = await db.collection('prospects').get();
      const prospects = snap.docs.map((d) => ({ followUps: 0, ...(d.data() as Prospect), id: d.id }));
      const audit = auditFromWebPayload(body, nowIso);
      let prospect = matchAuditToProspect(body, prospects);
      const isNew = !prospect;

      if (!prospect) {
        prospect = {
          id: `pros_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name: clip(body.nombre) || clip(body.nombre_estudio),
          studio: clip(body.nombre_estudio) || undefined,
          whatsapp: clip(body.whatsapp, 40) || undefined,
          instagram: clip(body.instagram, 120) || undefined,
          email: clip(body.email, 120) || undefined,
          city: clip(body.ciudad_zona) || undefined,
          source: 'Auditoría web',
          stage: 'nuevo',
          createdAt: today,
          followUps: 0,
        };
      }

      // Si ya estaba más adelante (video, llamada, cliente) no lo hacemos retroceder de etapa
      const advanced = ['video_enviado', 'llamada', 'cliente'].includes(prospect.stage);
      const { updates, event } = applyAction(prospect, 'audit_completed', today);
      const merged: Record<string, any> = {
        ...(isNew ? prospect : {}),
        ...(advanced ? {} : updates),
        audit,
        // completa datos de contacto que no tenía
        whatsapp: prospect.whatsapp || clip(body.whatsapp, 40) || null,
        email: prospect.email || clip(body.email, 120) || null,
        instagram: prospect.instagram || clip(body.instagram, 120) || null,
        studio: prospect.studio || clip(body.nombre_estudio) || null,
        updatedAt: nowIso,
      };
      Object.keys(merged).forEach((k) => merged[k] === undefined && delete merged[k]);

      const batch = db.batch();
      batch.set(db.collection('prospects').doc(prospect.id), merged, { merge: true });
      const evId = `pev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      batch.set(db.collection('prospect_events').doc(evId), { ...event, id: evId, createdAt: nowIso });

      const studio = merged.studio || prospect.name;
      if (!advanced) {
        const taskId = `task_video_${prospect.id}`;
        batch.set(
          db.collection('tasks').doc(taskId),
          {
            id: taskId,
            title: `Video de auditoría para ${studio} (${audit.total}/30)`,
            date: updates.videoDueDate || today,
            completed: false,
            priority: 'alta',
            createdAt: today,
            notes: [
              `Nivel ${audit.nivel}. Presencia ${audit.presencia}/10, Adquisición ${audit.adquisicion}/10, Funnel ${audit.funnel}/10.`,
              audit.dolorCaptacion ? `Principal dolor: ${audit.dolorCaptacion}.` : '',
              audit.proyectosActivos ? `Proyectos activos: ${audit.proyectosActivos}.` : '',
              audit.observaciones ? `Pidió revisar: ${audit.observaciones}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          { merge: true }
        );
      }
      await batch.commit();

      try {
        const s = await db.collection('settings').doc('automation').get();
        const chatId = process.env.TELEGRAM_CHAT_ID || (s.exists && (s.data() as any)?.telegramChatId);
        if (chatId && process.env.TELEGRAM_BOT_TOKEN) {
          await sendTelegram(
            `<b>Nueva auto auditoría</b>\n${escapeHtml(studio)}${isNew ? ' (no estaba en tu lista)' : ''}: ${audit.total}/30, nivel ${escapeHtml(audit.nivel)}.\n` +
              (audit.dolorCaptacion ? `Dolor: ${escapeHtml(audit.dolorCaptacion)}.\n` : '') +
              `Tenés hasta el ${String(updates.videoDueDate || today).slice(8, 10)}/${String(updates.videoDueDate || today).slice(5, 7)} para mandarle el video.` +
              (normalizeInstagram(merged.instagram) ? `\nInstagram: @${escapeHtml(normalizeInstagram(merged.instagram))}` : ''),
            String(chatId)
          );
        }
      } catch (err) {
        console.warn('[auditoria] No se pudo avisar por Telegram:', (err as Error).message);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[auditoria] Error guardando auditoría:', err);
      res.status(500).json({ ok: false });
    }
  });
}
