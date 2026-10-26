import dotenv from 'dotenv';
dotenv.config({ override: true });

// Todas las fechas del servidor ("hoy", horarios de avisos) en hora argentina,
// igual que en la app. Cloud Run corre en UTC y después de las 21 hs ya sería "mañana".
process.env.TZ = process.env.TZ || 'America/Argentina/Cordoba';

import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';
import { registerAutomationRoutes } from './server/automation';
import { registerProspectAuditRoute } from './server/prospectAudit';
import { registerProspectAIRoutes } from './server/prospectAI';
import { registerCalendlyRoutes, registerCalendlyWebhook } from './server/calendly';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Auto auditorías desde tu web: va antes del lector JSON general (llega como texto)
registerProspectAuditRoute(app);
// Reservas de Calendly (también necesita el cuerpo crudo, para verificar la firma)
registerCalendlyWebhook(app);

// Configuración de límite para audios pesados en Base64
app.use(express.json({ limit: '25mb' }));

// ---------------- AUTH PARA RUTAS DE IA ----------------
// Sin esto, cualquiera que conociera la URL podía usar tu cuota de Gemini.
// Se valida el token de Firebase del usuario con la API pública de Identity Toolkit
// (sin dependencias nuevas) y se exige una de las cuentas autorizadas.
const ALLOWED_EMAILS = ['puntocerovision@gmail.com', 'liendojuan070@gmail.com'];
const verifiedTokens = new Map<string, number>(); // token -> vencimiento (ms)

async function isAuthorizedRequest(req: express.Request): Promise<boolean> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const cachedUntil = verifiedTokens.get(token);
  if (cachedUntil && cachedUntil > Date.now()) return true;
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
    );
    if (!r.ok) return false;
    const data: any = await r.json();
    const user = data?.users?.[0];
    const ok = Boolean(user?.emailVerified && ALLOWED_EMAILS.includes(String(user.email || '').toLowerCase()));
    if (ok) verifiedTokens.set(token, Date.now() + 5 * 60 * 1000);
    if (verifiedTokens.size > 200) verifiedTokens.clear();
    return ok;
  } catch {
    return false;
  }
}

const requireOwner: express.RequestHandler = async (req, res, next) => {
  if (await isAuthorizedRequest(req)) return next();
  res.status(401).json({ success: false, error: 'Iniciá sesión para continuar', code: 'UNAUTHORIZED' });
};

app.use('/api/ai', requireOwner);

// Motor de automatización: Telegram, recordatorios, plan semanal y Google Calendar
registerAutomationRoutes(app, requireOwner);
registerCalendlyRoutes(app, requireOwner);

// ---------------- COTIZACIÓN DEL DÓLAR ----------------
// Proxy con caché de 30 min a dolarapi.com (precio de compra). Público: no expone datos tuyos.
let dolarCache: { at: number; data: any } | null = null;
app.get('/api/dolar', async (req, res) => {
  if (dolarCache && Date.now() - dolarCache.at < 30 * 60 * 1000) return res.json(dolarCache.data);
  try {
    const r = await fetch('https://dolarapi.com/v1/dolares');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const list: any[] = await r.json();
    const pick = (casa: string) => Number(list.find((d) => d.casa === casa)?.compra) || undefined;
    const data = {
      blue: pick('blue'),
      mep: pick('bolsa'),
      oficial: pick('oficial'),
      updatedAt: list.find((d) => d.casa === 'blue')?.fechaActualizacion,
    };
    dolarCache = { at: Date.now(), data };
    res.json(data);
  } catch (err: any) {
    if (dolarCache) return res.json(dolarCache.data);
    res.status(502).json({ error: 'No se pudo obtener la cotización', details: err?.message });
  }
});

// Health check endpoint for Cloud Run container readiness probe
app.get(['/_health', '/healthz', '/api/health'], (req, res) => {
  res.status(200).send('OK');
});

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('GEMINI_API_KEY no está configurada en las variables de entorno del servidor.');
      return null;
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

// Circuit breaker for models experiencing transient outages / 503 high-demand spikes
const degradedModels = new Map<string, number>();

function isModelDegraded(model: string): boolean {
  const until = degradedModels.get(model);
  if (!until) return false;
  if (Date.now() > until) {
    degradedModels.delete(model);
    return false;
  }
  return true;
}

function markModelDegraded(model: string, seconds = 180) {
  degradedModels.set(model, Date.now() + seconds * 1000);
}

// Resilient multi-model fallback helper: tries preferredModel, then falls back seamlessly
interface FallbackOptions {
  preferredModel: string;
  contents: any;
  config?: any;
  fallbackModels?: string[];
  timeoutMs?: number;
}

async function generateWithFallback(
  ai: GoogleGenAI,
  options: FallbackOptions
): Promise<{ response: any; usedModel: string }> {
  const {
    preferredModel,
    contents,
    config,
    fallbackModels = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'],
    timeoutMs = 7000,
  } = options;

  // Build model priority chain: if preferredModel is currently degraded, place healthy models first
  const allModels = Array.from(new Set([preferredModel, ...fallbackModels]));
  const healthyModels = allModels.filter(m => !isModelDegraded(m));
  const degradedList = allModels.filter(m => isModelDegraded(m));

  let modelChain: string[];
  if (!isModelDegraded(preferredModel)) {
    modelChain = [preferredModel, ...healthyModels.filter(m => m !== preferredModel), ...degradedList];
  } else {
    console.warn(`[Gemini Resiliency] Modelo preferido '${preferredModel}' en enfriamiento por 503 previo. Priorizando alternativas activas.`);
    modelChain = [...healthyModels, ...degradedList];
  }

  let lastError: any = null;

  for (const model of modelChain) {
    try {
      const apiCall = ai.models.generateContent({
        model,
        contents,
        config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms en modelo ${model}`)), timeoutMs)
      );

      const response: any = await Promise.race([apiCall, timeoutPromise]);
      return { response, usedModel: model };
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      // If error is 503 / high demand / unavailable / timeout, mark degraded so subsequent requests skip the delay
      if (
        msg.includes('503') ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('Timeout') ||
        msg.includes('RESOURCE_EXHAUSTED')
      ) {
        markModelDegraded(model, 180);
      }
      console.warn(`[Gemini Resiliency] Fallo en modelo '${model}': ${msg.slice(0, 110)}. Probando siguiente alternativa...`);
    }
  }

  throw lastError || new Error('No se pudo comunicar con los modelos de Gemini disponibles.');
}

// IA de prospección: frase personalizada y guion del video de auditoría
registerProspectAIRoutes(app, { getAIClient, generateWithFallback });

// ---------------- API ROUTES ----------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tipos de audio permitidos
const ALLOWED_AUDIO_MIMES = [
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/mpeg',
];

// 2. AI Multimodal Voice Transcription & Parsing
app.post('/api/ai/transcribe-voice', async (req, res) => {
  try {
    const { audioBase64, mimeType, today, weekday } = req.body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Audio en base64 requerido', code: 'MISSING_AUDIO' });
    }

    const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIMES.includes(cleanMime)) {
      return res.status(400).json({
        error: `Formato de audio no soportado: ${cleanMime}`,
        code: 'UNSUPPORTED_MIME',
      });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Servicio de IA no configurado en el servidor',
        code: 'GEMINI_NOT_CONFIGURED',
      });
    }

    const todayRef = today || new Date().toISOString().split('T')[0];
    const weekdayRef = weekday || '';

    const prompt = `Eres el asistente de voz ultra-rápido de .Cero CRM para un operador independiente.
Hoy es ${todayRef} (${weekdayRef}, huso horario Argentina UTC-3).

El usuario dictó un audio en español con una acción o registro.
Puede ser una REUNIÓN (cita, reunión con cliente, videollamada, llamada, meet, etc.), una TAREA, un OBJETIVO SEMANAL, un PROYECTO, un COBRO (ingreso) o un GASTO.

Tu objetivo:
1. Extraer la transcripción fiel de lo que dijo.
2. Identificar el tipo exacto: "reunion" | "tarea" | "objetivo" | "proyecto" | "ingreso" | "gasto". Si menciona una reunión, cita o llamada con una persona o cliente, el tipo DEBE SER "reunion".
3. Extraer los campos estructurados:
   - title: Título conciso y profesional en español (ej: "Reunión con Martín", "Llamar a Estudio Norte", "Cerrar 3 ventas", "Revisar maquetas").
   - date: Fecha calculada en formato YYYY-MM-DD. Si dijo "hoy", es ${todayRef}. Si dijo "mañana", calculá el día siguiente. Si dijo un día de la semana (ej: "el jueves"), calculá el día más cercano a partir de hoy ${todayRef}. Si no especifica, poné ${todayRef}.
   - time: Hora en formato HH:MM (24 horas, ej. "15:00", "09:30"). Si no menciona hora, null.
   - clientName: Nombre de la persona o cliente si es una reunión o proyecto, o null.
   - clientPhone: Si dijo un número de teléfono o WhatsApp, limpialo y extraelo, o null.
   - notes: Notas o contexto adicional mencionado, o null.
   - amount: Monto numérico sin signos si mencionó dinero, o null.
   - category: Para objetivos: "ventas" | "produccion" | "organizacion" | "general". Para gastos: "servicios" | "software" | "marketing" | "impuestos" | "otro".

Responde ÚNICAMENTE un objeto JSON válido con esta estructura:
{
  "transcript": string,
  "type": "reunion" | "tarea" | "objetivo" | "proyecto" | "ingreso" | "gasto",
  "title": string,
  "date": string | null,
  "time": string | null,
  "clientName": string | null,
  "clientPhone": string | null,
  "notes": string | null,
  "amount": number | null,
  "category": string | null
}`;

    const { response, usedModel } = await generateWithFallback(ai, {
      preferredModel: 'gemini-2.5-flash',
      fallbackModels: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'],
      contents: [
        {
          inlineData: {
            mimeType: cleanMime,
            data: audioBase64,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
      timeoutMs: 8000,
    });

    const responseText = response.text || '{}';

    let parsedJson: any = {};
    try {
      parsedJson = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedJson = JSON.parse(match[0]);
      } else {
        throw new Error('Formato JSON no parseable de Gemini');
      }
    }

    return res.json({
      success: true,
      data: parsedJson,
    });
  } catch (err: any) {
    console.error('Error en /api/ai/transcribe-voice:', err);
    if (err.message === 'TIMEOUT') {
      return res.status(504).json({
        error: 'No pude procesar el audio a tiempo. Probá de nuevo.',
        code: 'TIMEOUT',
      });
    }
    return res.status(500).json({
      error: 'No pude entender el audio, probá de nuevo',
      code: 'TRANSCRIPTION_FAILED',
      details: err?.message,
    });
  }
});

// 3. AI Suggest Weekly Goals (Automatización Cierre Semanal)
app.post('/api/ai/suggest-weekly-goals', async (req, res) => {
  try {
    const { summary } = req.body;
    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Servicio de IA no configurado',
        code: 'GEMINI_NOT_CONFIGURED',
      });
    }

    const prompt = `Eres el asesor de operaciones y productividad del CRM .Cero para un arquitecto/diseñador independiente.
Analizá este resumen de cierre de la semana que concluye:
${JSON.stringify(summary || {}, null, 2)}

En base a los cuellos de botella (tareas vencidas, cobros pendientes, horas de consultoría y avances):
Generá entre 3 y 5 objetivos estratégicos y accionables para la PRÓXIMA semana.
Cada objetivo debe tener:
- title: Acción concreta y medible (ej: "Cobrar cuota vencida de Estudio Sol", "Cerrar 4h de consultoría PAF", "Completar wireframes pendientes").
- category: "ventas" | "produccion" | "organizacion" | "general"

Responde ÚNICAMENTE un array JSON con esta estructura:
[
  { "title": string, "category": "ventas" | "produccion" | "organizacion" | "general" }
]`;

    const { response } = await generateWithFallback(ai, {
      preferredModel: 'gemini-2.5-flash',
      fallbackModels: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'],
      contents: [{ text: prompt }],
      config: { responseMimeType: 'application/json' },
      timeoutMs: 8000,
    });

    const parsed = JSON.parse(response.text || '[]');
    return res.json({ success: true, goals: parsed });
  } catch (err: any) {
    console.error('Error en /api/ai/suggest-weekly-goals:', err);
    return res.status(500).json({
      error: 'Error al generar objetivos sugeridos',
      code: 'SUGGESTION_FAILED',
    });
  }
});

// Tool declarations for Gemini to perform actions in the app
const crmTools = [
  {
    functionDeclarations: [
      {
        name: 'crear_tarea',
        description: 'Crea una nueva tarea en la agenda del CRM',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título claro y concreto de la tarea' },
            date: { type: Type.STRING, description: 'Fecha en formato YYYY-MM-DD' },
            time: { type: Type.STRING, description: 'Hora opcional en formato HH:MM (ej: 14:30)' },
            priority: { type: Type.STRING, enum: ['alta', 'media', 'baja'], description: 'Prioridad de la tarea' },
            category: { type: Type.STRING, description: 'Categoría o contexto (gestion, diseno, ventas, general, etc.)' },
            clientName: { type: Type.STRING, description: 'Nombre del cliente o proyecto asociado si aplica' },
            notes: { type: Type.STRING, description: 'Notas o detalles adicionales' }
          },
          required: ['title']
        }
      },
      {
        name: 'completar_tarea',
        description: 'Marca una tarea existente como completada o pendiente',
        parameters: {
          type: Type.OBJECT,
          properties: {
            titleSearch: { type: Type.STRING, description: 'Título o fragmento del título de la tarea a marcar' },
            completed: { type: Type.BOOLEAN, description: 'true para marcar completada, false para desmarcarla' }
          },
          required: ['titleSearch', 'completed']
        }
      },
      {
        name: 'eliminar_tarea',
        description: 'Elimina una tarea de la agenda',
        parameters: {
          type: Type.OBJECT,
          properties: {
            titleSearch: { type: Type.STRING, description: 'Título o palabras clave de la tarea a borrar' }
          },
          required: ['titleSearch']
        }
      },
      {
        name: 'agendar_reunion',
        description: 'Agenda una reunión, llamada o cita con cliente en el calendario',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título o motivo de la reunión' },
            clientName: { type: Type.STRING, description: 'Nombre del cliente o persona' },
            date: { type: Type.STRING, description: 'Fecha de la reunión en formato YYYY-MM-DD' },
            time: { type: Type.STRING, description: 'Hora de la reunión (HH:MM, ej: 16:00)' },
            clientPhone: { type: Type.STRING, description: 'Teléfono o WhatsApp si se mencionó' },
            notes: { type: Type.STRING, description: 'Notas, orden del día o link de Meet/Zoom' }
          },
          required: ['title', 'date']
        }
      },
      {
        name: 'mover_fecha',
        description: 'Reprograma o mueve la fecha/hora de una tarea o reunión existente',
        parameters: {
          type: Type.OBJECT,
          properties: {
            titleSearch: { type: Type.STRING, description: 'Título de la tarea o reunión a reprogramar' },
            itemType: { type: Type.STRING, enum: ['tarea', 'reunion'], description: 'Tipo de elemento' },
            newDate: { type: Type.STRING, description: 'Nueva fecha en formato YYYY-MM-DD' },
            newTime: { type: Type.STRING, description: 'Nueva hora opcional (HH:MM)' }
          },
          required: ['titleSearch', 'newDate']
        }
      },
      {
        name: 'registrar_ingreso',
        description: 'Registra un cobro, pago o ingreso monetario en las finanzas del CRM',
        parameters: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: 'Monto monetario recibido o a cobrar' },
            concept: { type: Type.STRING, description: 'Concepto del cobro (ej: Cuota 2 Arquitectura)' },
            clientName: { type: Type.STRING, description: 'Cliente o proyecto asociado' },
            date: { type: Type.STRING, description: 'Fecha del cobro en formato YYYY-MM-DD' },
            status: { type: Type.STRING, enum: ['cobrado', 'pendiente'], description: 'Estado: cobrado o pendiente' },
            paymentMethod: { type: Type.STRING, description: 'Método de pago (transferencia, efectivo, etc.)' }
          },
          required: ['amount', 'concept']
        }
      },
      {
        name: 'registrar_gasto',
        description: 'Registra un gasto o egreso operativo',
        parameters: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: 'Monto del gasto' },
            category: { type: Type.STRING, description: 'Categoría (software, servicios, marketing, impuestos, otro)' },
            note: { type: Type.STRING, description: 'Detalle o justificación del gasto' },
            date: { type: Type.STRING, description: 'Fecha del gasto (YYYY-MM-DD)' }
          },
          required: ['amount', 'category']
        }
      },
      {
        name: 'crear_objetivo_semanal',
        description: 'Agrega un objetivo estratégico para la semana actual',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título del objetivo (ej: Cerrar 2 contratos PAF)' },
            category: { type: Type.STRING, enum: ['ventas', 'produccion', 'organizacion', 'general'], description: 'Categoría' }
          },
          required: ['title']
        }
      },
      {
        name: 'crear_proyecto',
        description: 'Crea un nuevo proyecto o ficha de cliente en el CRM',
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Nombre del proyecto o estudio' },
            clientName: { type: Type.STRING, description: 'Nombre del cliente de contacto' },
            projectType: { type: Type.STRING, enum: ['paf_pro', 'paf_base', 'web'], description: 'Tipo de servicio' },
            totalAmount: { type: Type.NUMBER, description: 'Presupuesto total acordado' },
            notes: { type: Type.STRING, description: 'Notas o alcance inicial' }
          },
          required: ['name', 'clientName']
        }
      },
      {
        name: 'crear_nota_enlazada',
        description: 'Crea una nueva nota en el sistema de conocimiento, opcionalmente enlazada a proyectos, metas o clientes con sintaxis [[Nombre]]',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título claro de la nota' },
            content: { type: Type.STRING, description: 'Contenido de la nota (puede incluir [[Nombre]] para conectar)' },
            linkedEntities: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: 'Nombres de entidades a conectar con enlaces [[Nombre]]' 
            },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: 'Etiquetas opcionales' 
            },
            folder: { type: Type.STRING, description: 'Carpeta opcional' }
          },
          required: ['title', 'content']
        }
      },
      {
        name: 'buscar_relaciones',
        description: 'Busca las conexiones, enlaces y notas asociadas a un elemento del CRM (proyecto, cliente, meta, tarea o tema)',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'Nombre o concepto a buscar en la red de conocimiento' }
          },
          required: ['query']
        }
      },
      {
        name: 'registrar_movimiento_personal',
        description: 'Registra un movimiento personal (gasto, ingreso, transferencia o ahorro) en el módulo de finanzas personales. Entiende expresiones como "gasté 8 lucas en el super con Mercado Pago" o "me entraron 200 dólares de un cliente".',
        parameters: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ['gasto', 'ingreso', 'transferencia', 'ahorro'], description: 'Tipo de movimiento' },
            amount: { type: Type.NUMBER, description: 'Monto numérico' },
            currency: { type: Type.STRING, enum: ['ARS', 'USD'], description: 'Moneda (ARS o USD)' },
            category: { type: Type.STRING, description: 'Categoría (ej: Comida & Supermercado, Herramientas, Vivienda, Salidas)' },
            account: { type: Type.STRING, description: 'Cuenta (ej: Mercado Pago, Efectivo en mano, Banco, Dólares en mano)' },
            note: { type: Type.STRING, description: 'Detalle o nota del movimiento' },
            date: { type: Type.STRING, description: 'Fecha YYYY-MM-DD (por defecto hoy si no se indica)' }
          },
          required: ['type', 'amount']
        }
      },
      {
        name: 'consultar_gasto_periodo',
        description: 'Consulta los gastos o balance financiero personal en un período (ej: este mes, semana actual, por categoría)',
        parameters: {
          type: Type.OBJECT,
          properties: {
            period: { type: Type.STRING, description: 'Período a consultar (ej: este mes, últimos 30 días, semana)' },
            category: { type: Type.STRING, description: 'Categoría opcional a filtrar' }
          }
        }
      },
      {
        name: 'crear_recurrente',
        description: 'Crea una suscripción o gasto recurrente en finanzas personales (ej: hosting, internet, plataformas)',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título o nombre del servicio' },
            amount: { type: Type.NUMBER, description: 'Monto' },
            currency: { type: Type.STRING, enum: ['ARS', 'USD'], description: 'Moneda' },
            frequency: { type: Type.STRING, enum: ['semanal', 'quincenal', 'mensual', 'anual'], description: 'Frecuencia de pago' },
            type: { type: Type.STRING, enum: ['gasto', 'ingreso'], description: 'Tipo: gasto o ingreso' }
          },
          required: ['title', 'amount']
        }
      }
    ]
  }
];

// 4. Multi-turn Chatbot Interface with Agentic Execution
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, model, rolePreset, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Historial de mensajes requerido', code: 'INVALID_MESSAGES' });
    }

    const ai = getAIClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Servicio Gemini AI no configurado',
        code: 'GEMINI_NOT_CONFIGURED',
      });
    }

    // Model selection:
    let selectedModel = 'gemini-3.1-flash-lite';
    if (
      model === 'gemini-2.5-flash' ||
      model === 'gemini-3.1-flash-lite' ||
      model === 'gemini-3.7-flash' ||
      model === 'gemini-3.8-flash' ||
      model === 'gemini-3.1-pro-preview'
    ) {
      selectedModel = model;
    }

    const todayRef = context?.today || new Date().toISOString().split('T')[0];
    const weekdayRef = context?.weekday || '';

    // Role-specific personas
    const roleDescriptions: Record<string, string> = {
      operativo: `Sos el "Copiloto Operativo Integral" de .Cero CRM & Agenda. Tu misión es asistir al operador en su día a día: organizar la agenda, crear y marcar tareas, agendar reuniones, registrar cobros y resolver dudas rápidamente. Tenés poder para ejecutar acciones en la app mediante las herramientas disponibles.`,
      paf: `Sos el "Asesor Comercial y Estratégico PAF" (Pricing & Architecture Framework). Tu especialidad es asesorar en negociación con clientes de arquitectura y diseño, superar objeciones comerciales ("es muy caro", "lo voy a pensar"), calcular honorarios justos y proteger la rentabilidad del estudio. Si el usuario te pide crear tareas de seguimiento comercial o reuniones de venta, hacelo.`,
      proyectos: `Sos el "Director de Proyectos & Entregas". Tu foco es el cumplimiento de plazos, hitos de obra, cronogramas de diseño y evitar cuellos de botella. Ayudas a descomponer entregas complejas en tareas accionables con fechas realistas.`,
      finanzas: `Sos el "Analista Financiero & Cashflow". Tu enfoque está en la salud del flujo de caja, cobranzas pendientes, control de costos y metas de facturación. Si el usuario te menciona un cobro o gasto, regístralo directamente.`
    };

    const rolePrompt = roleDescriptions[rolePreset || 'operativo'] || roleDescriptions.operativo;

    const systemInstruction = `${rolePrompt}

CONTEXTO DEL DÍA Y DE LA APP:
- Fecha de hoy: ${todayRef} (${weekdayRef}, zona horaria Argentina UTC-3).
- Resumen del estado actual del CRM:
${JSON.stringify(context || {}, null, 2)}

INSTRUCCIONES CLAVE DE COMPORTAMIENTO:
1. Podés y DEBES REALIZAR COSAS EN LA APP usando las herramientas (functions) provistas cuando el usuario te lo solicite o cuando sea la forma natural de ayudarlo:
   - Crear tareas (con fecha YYYY-MM-DD calculada a partir de hoy ${todayRef}, prioridad, hora, notas).
   - Completar o desmarcar tareas existentes.
   - Eliminar tareas.
   - Agendar reuniones con clientes.
   - Mover fechas de tareas o reuniones.
   - Registrar cobros/ingresos o gastos.
   - Crear objetivos semanales.
   - Crear nuevos clientes o proyectos.
   - Crear notas conectadas con links internos [[Entidad]] usando la herramienta "crear_nota_enlazada".
   - Buscar relaciones y conexiones entre proyectos, notas y tareas usando la herramienta "buscar_relaciones".
2. Si el usuario te dice por ejemplo "anotame para mañana llamar a Martín a las 10:00", llamá a la herramienta "crear_tarea" con date="${todayRef}" + 1 día y time="10:00".
3. Si el usuario te dice "anotá una nota sobre X conectada con el proyecto Y", llamá a "crear_nota_enlazada" incluyendo "[[Y]]" en el contenido o en linkedEntities.
4. Si el usuario te pregunta por sus pendientes, cobros o agenda, analizá el JSON del contexto provisto y respondé con datos exactos y concisos.
5. Tono: Cercano, profesional, proactivo, conciso (estilo argentino sobrio: "Dale", "Listo", "Agendado", "Quedó registrado"). Evitá rodeos o texto innecesario. Confirmá con naturalidad la acción ejecutada.`;

    // Convert multi-turn messages to Gemini format:
    // 1. Skip any initial assistant/model greeting (conversation must begin with 'user' turn)
    // 2. Ensure roles strictly alternate (merge consecutive same-role messages)
    let startIndex = 0;
    while (
      startIndex < messages.length &&
      (messages[startIndex].role === 'assistant' || messages[startIndex].role === 'model')
    ) {
      startIndex++;
    }

    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

    for (let i = startIndex; i < messages.length; i++) {
      const m = messages[i];
      const role: 'user' | 'model' = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
      const text = String(m.text || m.content || '').trim();
      if (!text) continue;

      const lastTurn = contents[contents.length - 1];
      if (lastTurn && lastTurn.role === role) {
        lastTurn.parts.push({ text });
      } else {
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    if (contents.length === 0) {
      const lastMsg = messages[messages.length - 1];
      contents.push({
        role: 'user',
        parts: [{ text: String(lastMsg?.text || lastMsg?.content || 'Hola') }],
      });
    }

    const { response, usedModel } = await generateWithFallback(ai, {
      preferredModel: selectedModel,
      fallbackModels: ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.8-flash'],
      contents,
      config: {
        systemInstruction,
        tools: crmTools,
      },
      timeoutMs: 6500,
    });

    const replyText = response?.text || '';
    const functionCalls = response?.functionCalls || [];

    return res.json({
      success: true,
      model: usedModel,
      reply: replyText,
      functionCalls: functionCalls.map(fc => ({
        name: fc.name,
        args: fc.args || {},
      })),
    });
  } catch (err: any) {
    console.error('Error en /api/ai/chat:', err);
    return res.status(500).json({
      error: 'Error al comunicarse con Gemini',
      code: 'CHAT_FAILED',
      details: err?.message,
    });
  }
});

// Stubs inofensivos de compatibilidad para endpoints anteriores
app.all('/api/sync*', (req, res) => {
  res.json({ success: true, message: 'Firestore es la fuente única de verdad.' });
});

app.post('/api/auth/verify', (req, res) => {
  res.json({ success: true, token: 'firestore-auth-active' });
});

// ---------------- VITE MIDDLEWARE / STATIC SERVING ----------------

async function start() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.argv[1] && process.argv[1].endsWith('.cjs'));

  if (!isProduction) {
    // Una PWA usada antes en localhost puede seguir sirviendo el build anterior.
    // Reemplaza solo su worker de producción por uno sin caché y conserva la sesión.
    app.get('/sw.js', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/javascript').send(`
        self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', event => event.waitUntil((async () => {
          await self.clients.claim();
          await self.registration.unregister();
          const tabs = await self.clients.matchAll({ type: 'window' });
          await Promise.all(tabs.map(tab => tab.navigate(tab.url).catch(() => undefined)));
        })()));
      `);
    });
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html')) && fs.existsSync(path.join(__dirname, 'index.html'))) {
      distPath = __dirname;
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (Firestore native + Gemini AI)`);
  });
}

start();
