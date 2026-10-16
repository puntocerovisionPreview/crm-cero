export interface NoteTemplate {
  id: string;
  title: string;
  category: 'web' | 'pauta' | 'reuniones' | 'retainer';
  description: string;
  icon: string;
  defaultFolder: string;
  defaultTags: string[];
  generateContent: (clientName?: string) => string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'brief-web',
    title: 'Brief de Sitio Web & Landing Page',
    category: 'web',
    description: 'Estructura comercial, secciones, propuesta de valor y entregables.',
    icon: 'Globe',
    defaultFolder: 'Briefs Web',
    defaultTags: ['brief', 'web', 'ux-ui'],
    generateContent: (clientName = 'Nombre del Cliente') => `# Brief de Sitio Web — [[${clientName}]]

## 1. Información General
- **Cliente / Marca:** [[${clientName}]]
- **Objetivo Principal:** Generar leads / Ventas directas / Presencia de marca
- **Público Objetivo:** Quién compra y qué problema resolvemos.
- **Plazo de Entrega estimado:** [[${clientName}]]

---

## 2. Propuesta de Valor & Mensaje Clave
- **Titular Principal (Hero):** 
- **Subtítulo persuasivo:** 
- **Llamado a la Acción (CTA):** "Pedir Presupuesto" / "Contactar por WhatsApp"

---

## 3. Estructura de Secciones (Arquitectura de Información)
1. **Hero Section:** Titular de impacto, subtítulo, foto representativa y botón principal.
2. **Problema / Dolor:** Qué sufre el cliente actual antes de contratarlos.
3. **Solución & Servicios:** Desglose claro de servicios o productos.
4. **Prueba Social / Casos de Éxito:** Testimonios, fotos de obras/proyectos o métricas.
5. **Sobre el Estudio / Quiénes Somos:** Autoridad, trayectoria y equipo.
6. **Preguntas Frecuentes (FAQ):** 3-5 dudas típicas resueltas.
7. **Footer & Contacto:** Formulario, enlaces rápidos y datos de contacto.

---

## 4. Requerimientos Técnicos & Recursos
- [ ] Dominio configurado en DNS
- [ ] Hosting / Servidor activo
- [ ] Píxel de Meta & Google Tag Manager
- [ ] Formulario conectado a Email / WhatsApp
- [ ] Enlace a Figma / Drive de recursos: 

---
*Vinculado a la Ficha 360° de [[${clientName}]]*
`,
  },
  {
    id: 'estrategia-pauta',
    title: 'Estrategia de Pauta (Meta / Google Ads)',
    category: 'pauta',
    description: 'Presupuesto, audiencias, ángulos de copy y métricas objetivo.',
    icon: 'TrendingUp',
    defaultFolder: 'Campañas Ads',
    defaultTags: ['ads', 'meta-ads', 'pauta', 'adquisicion'],
    generateContent: (clientName = 'Nombre del Cliente') => `# Estrategia de Pauta Publicitaria — [[${clientName}]]

## 1. Resumen de Campaña
- **Cliente:** [[${clientName}]]
- **Canales:** Meta Ads (Instagram/Facebook) + Google Search
- **Presupuesto Mensual Inversión Cliente:** $ / US$ 
- **Fee de Gestión Estudio:** Registrado en [[${clientName}]]
- **KPI Primario:** Costo por Lead calificado (CPL) / Mensajes iniciados

---

## 2. Segmentación & Audiencias
- **Audiencia Fría (Prospección):**
  - Ubicación geográfica: 
  - Edad y demografía: 
  - Intereses / Comportamientos: 
- **Audiencia Tibia / Retargeting:**
  - Visitantes del sitio web (últimos 60 días)
  - Interactuaron con Instagram / Facebook

---

## 3. Ángulos de Comunicación & Creativos
1. **Ángulo 1 (Dolor):** "¿Cansado de perder tiempo en...?"
2. **Ángulo 2 (Resultado):** "Cómo logramos entregar en tiempo récord..."
3. **Ángulo 3 (Autoridad):** Caso real con fotos de alta calidad.

---

## 4. Checklist de Configuración
- [ ] Píxel de Meta instalado y verificado con API de conversiones
- [ ] Cuenta publicitaria y método de pago del cliente vinculado
- [ ] Creativos aprobados (formatos 1:1 Feed y 9:16 Stories/Reels)
- [ ] Landing page de destino optimizada en mobile

---
*Métricas analizadas semanalmente en [[${clientName}]]*
`,
  },
  {
    id: 'minuta-reunion',
    title: 'Minuta de Reunión / Kick-off',
    category: 'reuniones',
    description: 'Resumen de sesión, acuerdos pactados y próximos pasos con @tarea.',
    icon: 'MessageSquare',
    defaultFolder: 'Reuniones',
    defaultTags: ['reunion', 'minuta', 'acuerdos'],
    generateContent: (clientName = 'Nombre del Cliente') => `# Minuta de Reunión — [[${clientName}]]

- **Cliente:** [[${clientName}]]
- **Fecha:** @fecha
- **Participantes:** 
- **Tipo de Encuentro:** Kick-off / Revisión de Avance / Cierre de Entrega

---

## 1. Temas Tratados
1. 
2. 
3. 

---

## 2. Acuerdos Pactados
- Se definió que: 
- El cliente enviará antes del viernes: 

---

## 3. Próximos Pasos & Tareas (@tarea)
- [ ] Enviar propuesta ajustada @tarea
- [ ] Subir maqueta a staging para revisión @tarea
- [ ] Confirmar fecha de próxima sesión con [[${clientName}]]

---
*Documento centralizado en el Segundo Cerebro y vinculado a [[${clientName}]]*
`,
  },
  {
    id: 'retainer-mantenimiento',
    title: 'Acuerdo de Retainer & Mantenimiento',
    category: 'retainer',
    description: 'Alcance mensual, horas de soporte, revisiones técnicas y fee recurrente.',
    icon: 'Clock',
    defaultFolder: 'Retainers',
    defaultTags: ['retainer', 'mantenimiento', 'mrr'],
    generateContent: (clientName = 'Nombre del Cliente') => `# Retainer Mensual & Mantenimiento — [[${clientName}]]

## 1. Alcance Mensual
- **Cliente:** [[${clientName}]]
- **Fee Mensual Acordado:** $ / US$ (Cobro los días 1 al 5 de cada mes)
- **Horas de dedicación incluidas por mes:** 

---

## 2. Tareas Recurrentes Incluidas
- Actualizaciones de seguridad, plugins y dependencias
- Monitoreo de uptime y backups semanales en nube
- Ajustes menores de copy, banners o contenido nuevo
- Reporte mensual de métricas de tráfico y conversión

---

## 3. No Incluido (Cotización por separado)
- Rediseño estructural completo del sitio
- Desarrollo de nuevos módulos complejos o integraciones backend

---
*Facturación recurrente registrada en Finanzas vinculada a [[${clientName}]]*
`,
  },
];
