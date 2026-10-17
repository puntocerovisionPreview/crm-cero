import express from 'express';

/**
 * IA PARA PROSPECCIÓN (rutas /api/ai/*, protegidas por requireOwner en server.ts)
 *
 * - /api/ai/prospect-line: lee la web del estudio y escribe UNA frase personalizada para el
 *   primer mensaje ("Viendo los proyectos de vivienda en altura que publicaron, ").
 *   De paso busca su Instagram en la web si no lo teníamos.
 * - /api/ai/audit-video-script: guion de 60-90 segundos para el video de la auditoría.
 */

type Generate = (ai: any, options: { preferredModel: string; contents: any; config?: any; fallbackModels?: string[]; timeoutMs?: number }) => Promise<{ response: any; usedModel: string }>;

interface Deps {
  getAIClient: () => any | null;
  generateWithFallback: Generate;
}

const MODELS = { preferredModel: 'gemini-2.5-flash', fallbackModels: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'] };
const clip = (v: any, n = 300) => (v === undefined || v === null ? '' : String(v).slice(0, n).trim());

// No leer direcciones internas (solo webs públicas)
function isPublicUrl(raw: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    const h = u.hostname.toLowerCase();
    if (
      h === 'localhost' ||
      h.endsWith('.local') ||
      h.endsWith('.internal') ||
      /^(127|10|0)\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^169\.254\./.test(h) ||
      h.includes(':') ||
      h === 'metadata.google.internal'
    )
      return null;
    return u;
  } catch {
    return null;
  }
}

async function fetchSite(raw: string): Promise<{ text: string; instagram?: string }> {
  const u = isPublicUrl(raw);
  if (!u) return { text: '' };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(u.toString(), { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CeroCRM/1.0)' } });
    if (!r.ok || !String(r.headers.get('content-type') || '').includes('html')) return { text: '' };
    const html = (await r.text()).slice(0, 400_000);
    const igMatch = html.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i);
    const instagram = igMatch && !['p', 'reel', 'explore', 'accounts', 'sharer'].includes(igMatch[1].toLowerCase()) ? igMatch[1] : undefined;
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] || '';
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { text: `${title}\n${desc}\n${body}`.slice(0, 5000), instagram };
  } catch {
    return { text: '' };
  } finally {
    clearTimeout(t);
  }
}

export function registerProspectAIRoutes(app: express.Express, { getAIClient, generateWithFallback }: Deps) {
  app.post('/api/ai/prospect-line', async (req, res) => {
    const ai = getAIClient();
    if (!ai) return res.status(503).json({ error: 'La IA no está configurada (falta GEMINI_API_KEY en el servidor).', code: 'GEMINI_NOT_CONFIGURED' });
    const b = req.body || {};
    try {
      const site = b.website ? await fetchSite(clip(b.website, 300)) : { text: '' };
      const prompt = `Sos Juan, dueño de .Cero (marketing para estudios de arquitectura). Vas a mandar un primer mensaje por WhatsApp a este estudio.
Escribí SOLO el comienzo de la frase que va antes de "¿me permites realizarte una consulta?".
Reglas:
- Una sola frase, máximo 18 palabras, en español neutro con "tú" (nada de "vos").
- Que mencione algo concreto y real de este estudio (tipo de proyectos, enfoque, ciudad, años, premios) sacado SOLO de los datos de abajo. No inventes nada.
- Empezá con "Viendo", "Vi" o "Me encontré con". Terminá con una coma.
- Sin elogios exagerados, sin emojis, sin signos de exclamación.
- Si los datos no alcanzan para decir algo concreto, respondé "Viendo el enfoque y la trayectoria que tienes en tu estudio,".

Datos:
Nombre: ${clip(b.name)}
Rubro: ${clip(b.category)}
Ciudad: ${clip(b.city)} ${clip(b.country, 4)}
Web (texto): ${site.text || '(sin web o no se pudo leer)'}

Respondé un JSON: {"line": string}`;
      const { response } = await generateWithFallback(ai, { ...MODELS, contents: [{ text: prompt }], config: { responseMimeType: 'application/json' }, timeoutMs: 9000 });
      let line = '';
      try {
        line = String(JSON.parse(response.text || '{}').line || '');
      } catch {
        line = String(response.text || '');
      }
      line = line.replace(/\s+/g, ' ').trim().slice(0, 200);
      res.json({ success: true, line, instagram: site.instagram, readSite: !!site.text });
    } catch (err: any) {
      console.error('Error en /api/ai/prospect-line:', err?.message || err);
      res.status(500).json({ error: 'No se pudo generar la frase. Probá de nuevo en un rato.', code: 'PROSPECT_LINE_FAILED' });
    }
  });

  app.post('/api/ai/audit-video-script', async (req, res) => {
    const ai = getAIClient();
    if (!ai) return res.status(503).json({ error: 'La IA no está configurada (falta GEMINI_API_KEY en el servidor).', code: 'GEMINI_NOT_CONFIGURED' });
    const b = req.body || {};
    const a = b.audit || {};
    try {
      const prompt = `Sos Juan, de .Cero (marketing y captación de clientes para estudios de arquitectura).
Escribí el guion de un video corto (60 a 90 segundos, grabado con la pantalla mostrando su web/Instagram) para explicarle a este estudio el resultado de su auto auditoría.
Estructura en 4 partes con títulos: 1) Saludo y contexto (por qué le grabás esto), 2) Lo que está bien, 3) Las 2 oportunidades más grandes (según los puntajes más bajos y su dolor principal), 4) Cierre: invitación a una llamada de 20 minutos.
Español neutro con "tú". Frases cortas, para decir en voz alta. Nada de promesas de resultados con números.

Estudio: ${clip(b.studio || b.name)} (${clip(b.city)} ${clip(b.country, 4)})
Web: ${clip(b.website)}  Instagram: ${clip(b.instagram)}
Auditoría: total ${clip(a.total, 5)}/30, nivel ${clip(a.nivel)}. Presencia ${clip(a.presencia, 5)}/10, Adquisición ${clip(a.adquisicion, 5)}/10, Funnel ${clip(a.funnel, 5)}/10.
Dedicación: ${clip(a.dedicacion)}. Equipo: ${clip(a.tamanioEquipo)}. Proyectos activos: ${clip(a.proyectosActivos)}.
Clientes llegan por: ${clip(a.origenClientes)}. Inversión previa: ${clip(a.inversionPrevia)}.
Principal dolor: ${clip(a.dolorCaptacion)}. Pidió revisar: ${clip(a.observaciones, 500)}.

Respondé solo el guion en texto plano.`;
      const { response } = await generateWithFallback(ai, { ...MODELS, contents: [{ text: prompt }], timeoutMs: 15000 });
      res.json({ success: true, script: String(response.text || '').trim().slice(0, 4000) });
    } catch (err: any) {
      console.error('Error en /api/ai/audit-video-script:', err?.message || err);
      res.status(500).json({ error: 'No se pudo generar el guion. Probá de nuevo en un rato.', code: 'VIDEO_SCRIPT_FAILED' });
    }
  });
}
