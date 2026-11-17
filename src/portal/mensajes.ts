/**
 * Mensajes para el cliente, con las plantillas del servicio (7_MENSAJES_PARA_EL_CLIENTE y
 * 3_Mensaje_hoy_acordamos). El CRM solo los arma: los manda Juan por WhatsApp.
 * Lo que no se sabe queda entre corchetes para completarlo antes de enviar.
 */

const lineas = (txt: string) => txt.split('\n').map((l) => l.replace(/^[-•*✅📌]\s*/, '').trim()).filter(Boolean);

const fechaLarga = (fecha: string, hora?: string) =>
  `${new Date(`${fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}${hora ? ` a las ${hora}` : ''}`;

export function hoyAcordamos(input: {
  nombre: string;
  decisiones: string;
  deTuLado: string;
  deNuestroLado: string;
  proxima?: { fecha: string; hora?: string } | null;
}): string {
  return [
    `¡Gracias, ${input.nombre}! Hoy acordamos:`,
    ...lineas(input.decisiones).map((d) => `✅ ${d}`),
    ...lineas(input.deTuLado).map((d) => `📌 De tu lado: ${d}`),
    ...lineas(input.deNuestroLado).map((d) => `📌 De nuestro lado: ${d}`),
    ...(input.proxima ? [`📅 Próxima reunión: ${fechaLarga(input.proxima.fecha, input.proxima.hora)} (hora de Argentina)`] : []),
    'Cualquier duda, me escribís por acá.',
  ].join('\n');
}

/** "Subir fotos — 12/11" → tarea con fecha si se puede leer */
export function tareasDeSuLado(txt: string, year = new Date().getFullYear()): { titulo: string; fecha?: string }[] {
  return lineas(txt).map((l) => {
    const m = l.match(/^(.*?)(?:\s*[—–-]\s*(?:para el\s*)?(\d{1,2})\/(\d{1,2}))\s*$/i);
    if (!m) return { titulo: l };
    const fecha = `${year}-${m[3].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return { titulo: m[1].trim(), fecha };
  });
}

/**
 * Recordatorio amable de lo que tiene pendiente en su portal (lo manda Juan, nunca el CRM solo).
 * Las vencidas primero; si no hay pendientes devuelve ''.
 */
export function recordatorioPendientes(nombre: string, tareas: { titulo: string; fecha?: string }[], portal: string, today: string): string {
  if (!tareas.length) return '';
  const dia = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const orden = [...tareas].sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'));
  const lineas = orden.map((t) => `• ${t.titulo}${t.fecha ? (t.fecha < today ? ` (era para el ${dia(t.fecha)})` : ` (para el ${dia(t.fecha)})`) : ''}`);
  return [
    `¡Hola ${nombre}! ¿Cómo va? Te escribo para recordarte lo que tenés pendiente en tu portal:`,
    ...lineas,
    '',
    `Cuando lo tengas, tocá "Terminé" ahí mismo y me llega el aviso: ${portal}`,
    'Si algo te traba o necesitás más tiempo, decime y lo acomodamos.',
  ].join('\n');
}

export type MensajeId = 'recordatorio' | 'novedades' | 'hoyAcordamos' | 'bienvenida' | 'pedirMaterial' | 'confirmarRecepcion' | 'devolucion';
export const MENSAJES: { id: MensajeId; label: string }[] = [
  { id: 'recordatorio', label: 'Recordarle lo pendiente' },
  { id: 'novedades', label: 'Tiene novedades en su portal' },
  { id: 'hoyAcordamos', label: 'Hoy acordamos (última reunión)' },
  { id: 'bienvenida', label: 'Bienvenida a su espacio' },
  { id: 'pedirMaterial', label: 'Pedir material' },
  { id: 'confirmarRecepcion', label: 'Confirmar que recibiste algo' },
  { id: 'devolucion', label: 'Avisar que le dejaste una entrega' },
];

/**
 * Aviso de entrega por WhatsApp (forma de trabajo del 17/11/2026): el informe ya está en su carpeta
 * › Resultados; no se pide aprobación por mail. Si quiere cambios, lo dice por acá y sale otra versión.
 */
export function avisoEntrega(d: {
  nombre: string;
  entrega: { titulo: string; version?: string; enlace?: string; decision?: string };
  resultados?: string;
}): string {
  const e = d.entrega;
  const donde = e.enlace || d.resultados;
  return [
    `Hola ${d.nombre}! Te dejé ${e.titulo}${e.version ? ` (${e.version})` : ''} en tu carpeta, en Resultados${donde ? `: ${donde}` : '.'}`,
    e.decision ? `Cuando lo leas, fijate sobre todo ${e.decision}.` : '',
    'Si querés cambiar algo, decime por acá y lo ajusto.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function mensaje(id: Exclude<MensajeId, 'recordatorio' | 'novedades' | 'hoyAcordamos'>, d: {
  nombre: string;
  portal: string;
  materiales?: string;
  proxima?: { fecha: string; hora?: string } | null;
  entrega?: { titulo: string; version?: string; enlace?: string; decision?: string; canal?: string; hasta?: string } | null;
}): string {
  const proxima = d.proxima ? fechaLarga(d.proxima.fecha, d.proxima.hora) : '[fecha y hora]';
  if (id === 'bienvenida') return `Hola ${d.nombre}, ya tenés tu espacio de trabajo: ${d.portal} (entrás con tu cuenta de Google). Adentro está la bienvenida y una guía para los materiales. Por ahora te pedimos [acción concreta]. Nos vemos el ${proxima}. Si no podés entrar, avisame desde qué correo lo estás intentando.`;
  if (id === 'pedirMaterial') return `Hola ${d.nombre}, para preparar [trabajo] necesitamos [archivos concretos] de [proyecto]. Podés subirlos en ${d.materiales || '[subcarpeta de Materiales]'}. Sumá dos o tres líneas: qué pidió el cliente, qué dificultad había y cómo lo resolvieron. Avisanos qué se puede mostrar. ¿Lo podrías tener para el [fecha]?`;
  if (id === 'confirmarRecepcion') return `Recibí [archivo], gracias. Con esto puedo avanzar en [trabajo]. Para decidir [punto concreto] me falta confirmar [pregunta]. El resto lo sigo preparando; si preferís, ese punto lo vemos en la reunión.`;
  // Sin aprobación por mail: el aviso dice dónde quedó y que los cambios se piden por WhatsApp
  const e = d.entrega;
  return `${avisoEntrega({ nombre: d.nombre, entrega: e || { titulo: '[documento]' } })}\nTambién lo tenés en tu portal: ${d.portal}`;
}
