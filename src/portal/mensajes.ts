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

export type MensajeId = 'novedades' | 'hoyAcordamos' | 'bienvenida' | 'pedirMaterial' | 'confirmarRecepcion' | 'devolucion';
export const MENSAJES: { id: MensajeId; label: string }[] = [
  { id: 'novedades', label: 'Tiene novedades en su portal' },
  { id: 'hoyAcordamos', label: 'Hoy acordamos (última reunión)' },
  { id: 'bienvenida', label: 'Bienvenida a su espacio' },
  { id: 'pedirMaterial', label: 'Pedir material' },
  { id: 'confirmarRecepcion', label: 'Confirmar que recibiste algo' },
  { id: 'devolucion', label: 'Presentar una entrega para revisar' },
];

export function mensaje(id: Exclude<MensajeId, 'novedades' | 'hoyAcordamos'>, d: {
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
  const e = d.entrega;
  const hasta = e?.hasta ? new Date(`${e.hasta}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '[plazo]';
  return `Hola ${d.nombre}, te comparto ${e ? `${e.titulo}${e.version ? ` (${e.version})` : ''}${e.enlace ? `: ${e.enlace}` : ''}` : '[documento, versión y enlace]'}. La propuesta principal es [una frase] por [razón]. Necesitamos que revises ${e?.decision || '[decisión concreta]'}. Podés confirmarlo o pedir cambios por ${e?.canal || '[mail o Asana]'} hasta el ${hasta}. También lo tenés en tu portal: ${d.portal}`;
}
