import { AgendaTask } from '../types';
import { addDays, getTodayString } from './storage';

export interface TaskTemplateItem {
  title: string;
  category: 'produccion' | 'ventas' | 'organizacion' | 'general';
  offsetDays: number; // Days after project start
  priority: 'alta' | 'media' | 'baja';
  estimatedMinutes?: number;
  notes?: string;
}

export interface ProjectTaskTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  estimatedTotalDays: number;
  badgeColor: string;
  tasks: TaskTemplateItem[];
}

export const PROJECT_TASK_TEMPLATES: ProjectTaskTemplate[] = [
  {
    id: 'landing-page',
    name: 'Landing Page Web',
    tagline: 'Fast Track 7-10 días',
    description: 'Checklist completo desde relevamiento de brief hasta conexión de dominio y test de velocidad.',
    estimatedTotalDays: 10,
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    tasks: [
      {
        title: 'Briefing inicial & Recopilación de material (textos, logos y fotos)',
        category: 'organizacion',
        offsetDays: 1,
        priority: 'alta',
        estimatedMinutes: 60,
        notes: 'Verificar carpeta compartida en Drive con imágenes en alta y textos base.',
      },
      {
        title: 'Arquitectura de información & Wireframe en Figma',
        category: 'produccion',
        offsetDays: 2,
        priority: 'alta',
        estimatedMinutes: 120,
        notes: 'Estructurar Hero, Propuesta de valor, Servicios, Social proof y CTA.',
      },
      {
        title: 'Diseño UI Desktop & Mobile (Figma) para aprobación',
        category: 'produccion',
        offsetDays: 4,
        priority: 'alta',
        estimatedMinutes: 180,
        notes: 'Compartir link interactivo de Figma para feedback del cliente.',
      },
      {
        title: 'Configuración de Dominio & DNS (Nic.ar / Cloudflare / Hostinger)',
        category: 'produccion',
        offsetDays: 5,
        priority: 'media',
        estimatedMinutes: 30,
        notes: 'Delegar DNS y verificar propagación de registros A y CNAME.',
      },
      {
        title: 'Desarrollo Frontend Responsive & Animaciones',
        category: 'produccion',
        offsetDays: 7,
        priority: 'alta',
        estimatedMinutes: 240,
        notes: 'Desarrollo en React / Tailwind / Vite asegurando velocidad de carga.',
      },
      {
        title: 'Integración de Formulario de Contacto & Botón WhatsApp',
        category: 'produccion',
        offsetDays: 8,
        priority: 'alta',
        estimatedMinutes: 45,
        notes: 'Testear envío de mails y clic directo a WhatsApp con mensaje pre-cargado.',
      },
      {
        title: 'SEO Básico, Favicon, OpenGraph & Google Analytics',
        category: 'produccion',
        offsetDays: 9,
        priority: 'media',
        estimatedMinutes: 45,
        notes: 'Meta títulos, descripciones para compartir en WhatsApp y tracking de visitas.',
      },
      {
        title: 'Test final en dispositivos móviles & Publicación a Producción',
        category: 'ventas',
        offsetDays: 10,
        priority: 'alta',
        estimatedMinutes: 60,
        notes: 'Prueba en iPhone y Android + entrega formal con link al cliente.',
      },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce / Tienda Online',
    tagline: 'Catálogo & Pasarelas de Pago',
    description: 'Estructuración de catálogo, medios de pago (Mercado Pago/Stripe), logística y checkout.',
    estimatedTotalDays: 14,
    badgeColor: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    tasks: [
      {
        title: 'Definición de categorías de productos y lista de precios',
        category: 'organizacion',
        offsetDays: 1,
        priority: 'alta',
        estimatedMinutes: 90,
      },
      {
        title: 'Configuración de Pasarela de Pagos (Mercado Pago / Tarjetas)',
        category: 'produccion',
        offsetDays: 3,
        priority: 'alta',
        estimatedMinutes: 60,
        notes: 'Obtener credenciales de producción (Public Key y Access Token).',
      },
      {
        title: 'Configuración de Métodos de Envío y Zonas de Entrega',
        category: 'produccion',
        offsetDays: 4,
        priority: 'media',
        estimatedMinutes: 45,
      },
      {
        title: 'Diseño UI de Catálogo, Ficha de Producto y Checkout',
        category: 'produccion',
        offsetDays: 6,
        priority: 'alta',
        estimatedMinutes: 180,
      },
      {
        title: 'Carga piloto de primeros 10-15 productos con fotos y stock',
        category: 'produccion',
        offsetDays: 8,
        priority: 'media',
        estimatedMinutes: 120,
      },
      {
        title: 'Pruebas de compra completa (Checkout Sandbox / Test)',
        category: 'produccion',
        offsetDays: 11,
        priority: 'alta',
        estimatedMinutes: 60,
        notes: 'Simular compra aprobada, rechazada y confirmación automática por email.',
      },
      {
        title: 'Configuración de Dominio Propio con SSL y Certificado',
        category: 'produccion',
        offsetDays: 12,
        priority: 'alta',
        estimatedMinutes: 30,
      },
      {
        title: 'Entrega de panel administrativo & Capacitación al cliente',
        category: 'ventas',
        offsetDays: 14,
        priority: 'alta',
        estimatedMinutes: 90,
        notes: 'Video instructivo o llamada de cómo gestionar pedidos y precios.',
      },
    ],
  },
  {
    id: 'branding',
    name: 'Identidad Visual & Branding',
    tagline: 'Diseño de Marca & Manual',
    description: 'Moodboards, conceptos de logotipo, paleta de colores, tipografías y brand guidelines.',
    estimatedTotalDays: 12,
    badgeColor: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    tasks: [
      {
        title: 'Brief de Marca & Análisis de Competencia',
        category: 'organizacion',
        offsetDays: 1,
        priority: 'alta',
        estimatedMinutes: 90,
      },
      {
        title: 'Moodboard & Exploración de Territorios Visuales',
        category: 'produccion',
        offsetDays: 3,
        priority: 'media',
        estimatedMinutes: 120,
      },
      {
        title: 'Desarrollo de 2-3 Rutas Conceptuales de Logotipo',
        category: 'produccion',
        offsetDays: 5,
        priority: 'alta',
        estimatedMinutes: 240,
      },
      {
        title: 'Definición de Paleta Cromática y Sistema Tipográfico',
        category: 'produccion',
        offsetDays: 7,
        priority: 'alta',
        estimatedMinutes: 90,
      },
      {
        title: 'Presentación de propuestas en Mockups reales al cliente',
        category: 'ventas',
        offsetDays: 8,
        priority: 'alta',
        estimatedMinutes: 60,
      },
      {
        title: 'Ajustes finos según feedback de la ronda 1',
        category: 'produccion',
        offsetDays: 10,
        priority: 'media',
        estimatedMinutes: 90,
      },
      {
        title: 'Elaboración de Manual de Marca (Brand Guidelines PDF)',
        category: 'produccion',
        offsetDays: 11,
        priority: 'media',
        estimatedMinutes: 150,
      },
      {
        title: 'Exportación de Master Files (.AI, .SVG, .PNG en alta y manual)',
        category: 'ventas',
        offsetDays: 12,
        priority: 'alta',
        estimatedMinutes: 60,
      },
    ],
  },
  {
    id: 'sistema-web',
    name: 'Sistema Web / App Custom',
    tagline: 'Desarrollo Full Stack a Medida',
    description: 'Relevamiento funcional, arquitectura de base de datos, API, autenticación y despliegue.',
    estimatedTotalDays: 20,
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    tasks: [
      {
        title: 'Relevamiento de requerimientos y Especificación Técnica',
        category: 'organizacion',
        offsetDays: 2,
        priority: 'alta',
        estimatedMinutes: 120,
      },
      {
        title: 'Diseño del Modelo de Datos & Esquema de Base de Datos',
        category: 'produccion',
        offsetDays: 4,
        priority: 'alta',
        estimatedMinutes: 90,
      },
      {
        title: 'Setup de Repositorio, Boilerplate & Configuración de Hosting/DB',
        category: 'produccion',
        offsetDays: 6,
        priority: 'alta',
        estimatedMinutes: 90,
      },
      {
        title: 'Implementación de Autenticación, Login y Permisos de Usuario',
        category: 'produccion',
        offsetDays: 9,
        priority: 'alta',
        estimatedMinutes: 180,
      },
      {
        title: 'Desarrollo de Módulo Principal & CRUD de entidades',
        category: 'produccion',
        offsetDays: 14,
        priority: 'alta',
        estimatedMinutes: 300,
      },
      {
        title: 'Pruebas de estrés, QA funcional y corrección de bugs',
        category: 'produccion',
        offsetDays: 17,
        priority: 'alta',
        estimatedMinutes: 180,
      },
      {
        title: 'Despliegue a Producción en servidor cloud y dominio',
        category: 'produccion',
        offsetDays: 19,
        priority: 'alta',
        estimatedMinutes: 60,
      },
      {
        title: 'Capacitación al cliente & Entrega de documentación técnica',
        category: 'ventas',
        offsetDays: 20,
        priority: 'alta',
        estimatedMinutes: 90,
      },
    ],
  },
  {
    id: 'mantenimiento-paf',
    name: 'Acompañamiento PAF / Mensual',
    tagline: 'Mantenimiento & Retainer Activo',
    description: 'Alineación mensual, auditoría de performance, updates, seguridad y mejoras continuas.',
    estimatedTotalDays: 15,
    badgeColor: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    tasks: [
      {
        title: 'Sesión de Alineación Mensual PAF con el cliente',
        category: 'ventas',
        offsetDays: 1,
        priority: 'alta',
        estimatedMinutes: 60,
        notes: 'Revisar prioridades del mes, blockers y nuevas necesidades.',
      },
      {
        title: 'Auditoría de Conversión & Puntos de fricción de la web',
        category: 'produccion',
        offsetDays: 4,
        priority: 'media',
        estimatedMinutes: 60,
      },
      {
        title: 'Actualización de Dependencias, Plugins y Backups de seguridad',
        category: 'produccion',
        offsetDays: 7,
        priority: 'media',
        estimatedMinutes: 45,
      },
      {
        title: 'Implementación de Mejoras prioritarias acordadas',
        category: 'produccion',
        offsetDays: 11,
        priority: 'alta',
        estimatedMinutes: 180,
      },
      {
        title: 'Reporte Mensual Ejecutivo & Próximos pasos recomendados',
        category: 'organizacion',
        offsetDays: 15,
        priority: 'alta',
        estimatedMinutes: 45,
      },
    ],
  },
];

/**
 * Generate AgendaTask items from a template
 */
export function generateTasksFromTemplate(
  templateId: string,
  projectId: string,
  projectName: string,
  startDate?: string
): Omit<AgendaTask, 'id'>[] {
  const template = PROJECT_TASK_TEMPLATES.find(t => t.id === templateId);
  if (!template) return [];

  const baseDate = startDate || getTodayString();

  return template.tasks.map((taskItem) => {
    const taskDate = addDays(baseDate, taskItem.offsetDays);
    return {
      title: taskItem.title,
      category: 'general' as const,
      date: taskDate,
      completed: false,
      priority: taskItem.priority,
      projectId: projectId || undefined,
      projectName: projectName || undefined,
      notes: taskItem.notes || `Generado automáticamente desde plantilla «${template.name}».`,
      estimatedMinutes: taskItem.estimatedMinutes || 60,
      subtasks: [],
      createdAt: getTodayString(),
    };
  });
}
