# .Cero CRM

Aplicación de gestión personal y del estudio .Cero: reúne trabajo diario, prospección comercial, clientes, proyectos Web y PAF, contenido, cobranzas, finanzas personales y notas conectadas.

Está pensada para un operador del estudio con cuentas de Google autorizadas. Los clientes y alumnos acceden a vistas específicas mediante enlaces con token, sin entrar al CRM privado.

Este documento describe el código presente en la carpeta al 25 de octubre de 2026, incluidos los cambios locales de prospección diaria. No certifica que las integraciones estén activas en producción ni que las pruebas hayan pasado. Los nombres históricos como “v3” o “arquitectura de 4 módulos” aparecen en algunos archivos; la navegación actual tiene seis sectores.

## Índice

- [Mapa de la aplicación](#mapa-de-la-aplicación)
- [Cómo se conectan los módulos](#cómo-se-conectan-los-módulos)
- [Mi día](#mi-día)
- [Prospección y oportunidades](#prospección-y-oportunidades)
- [Contenido](#contenido)
- [Clientes, proyectos y PAF](#clientes-proyectos-y-paf)
- [Paneles para clientes y alumnos](#paneles-para-clientes-y-alumnos)
- [Documentos y contratos](#documentos-y-contratos)
- [Finanzas del estudio y personales](#finanzas-del-estudio-y-personales)
- [Cerebro](#cerebro)
- [Asistente con IA](#asistente-con-ia)
- [Ajustes y funciones transversales](#ajustes-y-funciones-transversales)
- [Datos, sincronización y respaldos](#datos-sincronización-y-respaldos)
- [Integraciones y automatizaciones](#integraciones-y-automatizaciones)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Arquitectura y archivos](#arquitectura-y-archivos)
- [Validación y mantenimiento](#validación-y-mantenimiento)
- [Problemas frecuentes](#problemas-frecuentes)

## Mapa de la aplicación

La pantalla **Inicio** (`/inicio`) muestra tarjetas de sectores. Al entrar a uno, el menú lateral de escritorio y la navegación móvil ofrecen las pantallas de ese sector y un acceso para volver a Inicio.

| Sector | Pantallas principales | Para qué sirve |
| --- | --- | --- |
| Mi día | Hoy, Semana, Calendario, Modo foco, Reportes | Organizar tareas, reuniones, prioridades y dedicación. |
| Prospección | Prospección, Oportunidades | Conseguir contactos, hacer seguimientos y convertir ventas. |
| Contenido | Contenido | Preparar y seguir publicaciones, guiones y recursos. |
| Clientes | Clientes, Paneles, Documentos, Horizonte, Nuevo cliente | Gestionar servicios, entregas, acuerdos y comunicación. |
| Finanzas | Dinero, Gastos fijos, Mis finanzas | Controlar cobros, gastos, vencimientos y economía personal. |
| Cerebro | Cerebro, con notas y grafo | Conservar conocimiento y relacionarlo con el trabajo. |

**Ajustes** queda fuera de los seis sectores. Las preferencias permiten ocultar partes de la interfaz; por eso dos dispositivos pueden mostrar opciones distintas.

## Cómo se conectan los módulos

El recorrido comercial habitual es:

1. Importar o cargar contactos en la reserva de prospección.
2. Seleccionar contactos para trabajar y enviar mensajes por WhatsApp.
3. Registrar envíos, respuestas, seguimientos y auditorías.
4. Enviar un video, agendar una llamada y preparar una propuesta.
5. Convertir la oportunidad en cliente/proyecto, o darlo de alta desde el asistente de nuevo cliente.
6. Organizar tareas, reuniones, entregas y pagos alrededor del proyecto.
7. Compartir un presupuesto, portal o panel según el servicio.
8. Registrar los cobros y revisar el dinero recibido y pendiente.

Las entidades centrales son:

| Entidad | Relación y función |
| --- | --- |
| Cliente (`Client`) | Persona o estudio; puede estar asociado a varios proyectos. |
| Proyecto (`Project`) | Servicio concreto: Web, PAF Base, PAF Pro u otro; concentra ejecución y cobros. |
| Tarea / reunión | Puede vincularse a un proyecto y a una misión semanal. |
| Prospecto | Contacto comercial con etapa, próxima acción, conversación y eventos. |
| Acuerdo / cuota | Describe compromisos de pago y vencimientos. |
| Pago / ingreso | Registra dinero recibido y su vínculo con el proyecto cuando corresponde. |
| Documento | Presupuesto o recibo, con copia compartible por token. |
| Panel | Espacio de seguimiento y aprobación para el cliente. |
| Nota / enlace | Conecta conocimiento con otras entidades. |

Parte del código conserva nombres anteriores: algunas rutas `/proyectos/...` se redirigen a `/clientes/...`. Para modificar estas relaciones conviene revisar el enrutador y el modelo, sin asumir que “cliente” y “proyecto” son equivalentes.

## Mi día

### Hoy y agenda

`/hoy` es el centro operativo diario; `/agenda` funciona como alias. Permite trabajar con tareas y reuniones, pendientes atrasados, elementos sin fecha y bloques de prioridades, tiempo, cobros y actividad de otros módulos.

Una tarea puede tener fecha, hora, prioridad, notas, subtareas, categoría, proyecto, misión semanal, estimación y tiempo real. También puede usar estado Kanban y un orden manual. Las reuniones incorporan horario, notas, contacto, recordatorios y vínculo con proyecto.

La recurrencia de tareas contempla frecuencia diaria, días hábiles, semanal, quincenal y mensual. Al completar una tarea recurrente se genera su siguiente instancia; el modelo registra si ya se creó para evitar duplicarla al desmarcar y volver a completar.

La interfaz incluye vistas y componentes de lista, Kanban y matriz de Eisenhower, según pantalla y preferencias. El alta rápida permite capturar registros sin recorrer todo el módulo.

### Semana, rutina y foco

- **Semana** (`/semana`): misiones y objetivos con pasos, fechas, frentes de trabajo y revisión semanal. Las misiones distinguen trabajo, mantenimiento y cobros.
- **Calendario** (`/calendario`): visualización de compromisos y planificación por fechas; la integración con Google Calendar se configura aparte.
- **Modo foco** (`/foco`): entorno para concentrarse en tareas y subtareas con temporizador/Pomodoro.
- **Presupuesto de tiempo**: distribución de la jornada por categorías y bloques, con modo libre o cronograma.
- **Rutina y cierres**: componentes para iniciar/revisar el día, registrar avances y cerrar el día o la semana.
- **Reportes** (`/reportes`): reúne vistas de revisión semanal, alumnos PAF, prospección y mes.

Los registros de dedicación (`TimeLog`) guardan minutos, fecha y asociaciones para analizar el trabajo realizado.

## Prospección y oportunidades

### Reserva de contactos

La reserva importa CSV procedentes de herramientas de extracción de Google Maps. El importador limpia datos, normaliza teléfonos, clasifica rubros y asigna puntaje, nivel y motivos de selección.

Los segmentos previstos incluyen arquitectura, paisajismo, interiorismo y construcción. La configuración permite filtrar países/segmentos y trabajar por lotes. El CRM procesa el archivo importado; el extractor de Google Maps es una herramienta externa.

### Embudo y conversación

El flujo implementado va desde contacto inicial y seguimientos hacia respuesta, auditoría/diagnóstico, video personalizado, llamada, propuesta y cliente. También contempla descarte y postergación.

Cada prospecto puede conservar datos de contacto, sitio/redes, etapa, próxima acción, notas, respuestas al diagnóstico y bitácora. El guion acompaña la conversación con pregunta, respuesta, empatía, acuerdo y envío del diagnóstico. Las plantillas admiten datos del estudio y del contacto.

**Los mensajes de WhatsApp requieren acción del operador.** Copiar un texto o abrir el chat no registra un envío: hay que confirmarlo al volver a la aplicación. Tampoco se debe interpretar una respuesta registrada como una lectura automática de WhatsApp.

La configuración inicial del código propone seguimientos cada 2 días, hasta 3 seguimientos, cupo de 8 acciones diarias y 2 primeros contactos por día. Estos son valores predeterminados que pueden variar con la configuración guardada.

### Escritorio diario

La versión local incluye **Tu día de prospección**, con cuatro vistas:

- **Por hacer**: acciones pendientes del día.
- **Enviados hoy**: contactos con envíos confirmados.
- **Respondieron hoy**: contactos con respuestas registradas.
- **Historial por día**: actividad por fecha, búsqueda y detalle de eventos.

El registro diferencia cantidad de contactos y cantidad de envíos. Las acciones que exceden el cupo siguen pendientes. La lógica combina eventos actuales con bitácoras anteriores para reconstruir actividad sin contar dos veces el mismo registro.

El módulo también incluye preparación de llamadas, ayuda de IA para textos/guiones y recepción de diagnósticos desde la web mediante `/api/prospects/audit`. La URL de diagnóstico y parte del discurso comercial están definidos en `src/prospecting/core.ts`.

**Oportunidades** (`/oportunidades`, alias `/pipeline`) ofrece seguimiento comercial. La conversión debe conservar los vínculos entre prospecto, cliente, proyecto y documentos.

## Contenido

`/contenido` organiza publicaciones por fecha y semana. Cada pieza puede tener formato, pilar, problema que aborda, idea, título, CTA, caption, guion, slides y recursos asociados a palabras clave.

Los formatos contemplan reels, carruseles, estáticos y otros. Los estados recorren idea, guion, producción, revisión, listo/programado y publicado.

La importación acepta un calendario JSON, acompañado de un ZIP de imágenes/PDF, o un ZIP con el JSON incluido. El importador relaciona archivos, procesa imágenes y muestra progreso. Al reimportar preserva estados cambiados desde la app y contempla conservar recursos previos cuando el paquete no los reemplaza.

Las piezas viven en `content_pieces`; sus archivos pueden guardarse como data URL en documentos de `content_assets`. Las referencias `fs:` apuntan a esos archivos; las referencias `pub:` apuntan a copias públicas en `student_portals`. También se admiten URLs externas.

El almacenamiento de archivos impone un límite de longitud de 1.000.000 de caracteres por data URL, no de 1 MB de archivo original. Si un recurso no entra, hay que reducirlo o usar una URL apropiada.

El calendario y el estado “programado” sirven para seguimiento: el código revisado no implementa publicación automática en Instagram u otras redes.

## Clientes, proyectos y PAF

### Alta y ficha

Desde `/clientes/nuevo` se da de alta el servicio. La ficha permite relacionar contacto, proyecto, tareas, reuniones, enlaces importantes, historial, entregas y situación de cobro.

El modelo distingue proyectos Web, PAF Base, PAF Pro y otros. Incluye estados de trabajo, fechas, información económica y campos específicos del servicio. Los componentes de salud y cronograma resumen avance, espera del cliente y atrasos de pago.

Hay plantillas para iniciar proyectos y tareas, seguimiento de clientes sin actividad y sugerencias de continuidad/abonos.

### PAF

Los proyectos PAF incluyen etapas, hitos/listas de salida, sesiones de consultoría y horas previstas/consumidas. La aplicación incorpora catálogo de precios y configuración de servicios PAF.

El portal del alumno publica una copia de información seleccionada del proyecto: avance, entregables y datos del programa según su configuración. La aplicación mantiene esa copia al cambiar la información relevante mientras el CRM está activo.

### Horizonte

`/horizonte` reúne planificación temporal y capacidad de proyectos. La lógica contempla metas económicas, capacidad y la opción de incluir proyectos Web en la meta. Algunas preferencias de esta vista se guardan localmente en el dispositivo.

## Paneles para clientes y alumnos

`/paneles` permite preparar un espacio compartido con objetivos de la semana, tareas y piezas de contenido. El cliente puede marcar tareas, dejar notas, aprobar una pieza o pedir cambios.

Para desarrollo Web, el panel añade etapas de brief, contenido, diseño, desarrollo, revisión y publicación; materiales pendientes, páginas, versión de prueba, rondas de revisión, pedidos de cambios, pagos y datos de entrega. Los pagos mostrados en el panel son información de seguimiento del panel; no deben asumirse equivalentes a un cobro conciliado del libro financiero.

| Acceso público | Uso |
| --- | --- |
| `/alumno/:token` | Portal del alumno PAF; puede integrar su panel. |
| `/panel/:token` | Panel de seguimiento de un cliente. |
| `/doc/:token` | Presupuesto o recibo compartido. |

Los enlaces abren vistas independientes del CRM. El original del panel vive en `client_panels`; la copia pública, en `student_portals/panel_{token}`. Las acciones del cliente pasan por el servidor (`/api/panel/:token/accion`), que actualiza los documentos correspondientes y puede emitir avisos.

El token funciona como acceso al contenido compartido: cualquier persona que tenga el enlace puede ver esa copia. No es una cuenta independiente de cliente con contraseña.

### Panel PAF de tres meses

El portal `/alumno/:token` incluye cinco secciones: **Mi inicio**, **Mis 3 meses**, **Contenido y redes**, **Sesiones** y **Recursos**. La portada resume el objetivo, el mensaje de la semana, entregas completadas, aportes pendientes, contenido para aprobar, trabajo en curso, próxima sesión y siguiente actividad.

La hoja de ruta se divide en Presencia (mes 1), Adquisición (mes 2) y Conversión (mes 3), con actividades por semana y pilar. Cada actividad puede estar pendiente, en curso, esperando al cliente o entregada. El porcentaje mide actividades entregadas; no se completa por el paso del tiempo. El mes es la planificación y el pilar identifica el área de trabajo: pueden cruzarse.

Para configurarlo:

1. Abrir la ficha de un cliente PAF y usar **Crear enlace del programa PAF** o **Panel del alumno**. También se puede entrar por Clientes → Paneles.
2. En **Plan PAF · Los tres meses del cliente**, personalizar objetivo, actividades, estados y detalles visibles. Los proyectos nuevos toman sus hitos existentes o la plantilla Base/Pro correspondiente.
3. Activar y detallar **Gestión de contenido y comunidad (CM)**: cantidades, redes, responsables, publicación, mensajes y revisiones se acuerdan por cliente. La plantilla no fija volúmenes de piezas ni promete atención de mensajes sin definirla.
4. Agregar recursos mediante enlaces web destinados al cliente. No se publican automáticamente los enlaces internos de la ficha.
5. Pulsar **Guardar y publicar plan PAF**. Este editor conserva su propio plan compartido; no modifica el checklist interno del proyecto. Tras publicarlo, los estados del plan se administran desde Paneles.
6. Cargar objetivos, tareas y piezas en las secciones del panel y compartir el enlace. El cliente entra sin contraseña, completa sus tareas y aprueba o pide cambios sobre las piezas.

Los portales anteriores siguen abriendo con su enlace. Si todavía no tienen un plan personalizado, muestran los hitos publicados del proyecto o una hoja de ruta de referencia con estados pendientes. Guardar el plan desde Paneles permite personalizar esa versión. Las sesiones, horas y checklist de etapa siguen viniendo de la ficha del proyecto.

El guardado del panel privado y su copia pública se hace en un mismo lote Firestore; las acciones del cliente también actualizan ambas copias en lote. Esto evita confirmar una copia sin haber guardado la otra, aunque no reemplaza un mecanismo de resolución de ediciones simultáneas.

## Documentos y contratos

`/documentos` permite gestionar presupuestos y recibos con numeración, cliente, ítems, cantidades, precios, moneda ARS/USD, fecha, condiciones y datos de cobro. Los presupuestos pueden incluir servicio, plazos, plan de pagos y cláusulas.

La aplicación genera PDF mediante `@react-pdf/renderer` y permite compartir un enlace. El original queda en `documents`; la versión pública usa `student_portals/doc_{token}`.

El servidor registra aperturas y aceptación del presupuesto. La lógica de aceptación puede iniciar el proyecto desde los datos del presupuesto y guarda el vínculo para evitar repetir el alta. Hay seguimiento de documentos sin abrir, sin respuesta o próximos a vencer.

La aceptación desde el enlace y la firma mediante **Documenso** son mecanismos distintos. Documenso requiere configuración externa y añade envío a firma, webhook de resultado y descarga del PDF firmado. El recibo del CRM documenta un pago dentro de esta aplicación; el código descrito no implementa emisión fiscal ante ARCA.

## Finanzas del estudio y personales

### Dinero del estudio

`/dinero` agrupa ingresos, gastos, cobros pendientes, compromisos, cuotas y proyecciones. Las fichas admiten distintos acuerdos de cobro, compromisos flexibles y planes recurrentes.

La regla del libro de cobros (`src/utils/ledger.ts`) es:

- El dinero cobrado se calcula desde ingresos con estado `cobrado`.
- Para datos anteriores, incorpora pagos de proyectos que no tengan un ingreso asociado.
- Evita duplicar un pago ya reflejado en ingresos.
- Cuotas y acuerdos describen dinero esperado; no se suman como dinero recibido.

El registro de un pago incorpora importe, moneda, fecha y medio. La aplicación contempla transferencias, efectivo, Mercado Pago, USDT y otros medios; registrar un medio no implica conexión automática con ese proveedor.

Mercado Pago tiene una bandeja de pagos entrantes y conciliación con clientes/proyectos. Revisar o conciliar la entrada permite asociarla con el cobro correspondiente.

### Gastos fijos

`/gastos-fijos` reúne suscripciones, hosting, dominios, herramientas y otros gastos recurrentes, con ciclos de facturación y vencimientos. Incluye avisos de próximas renovaciones.

### Mis finanzas

`/mis-finanzas` es el módulo personal, con:

- Cuentas de efectivo, banco, billetera, dólares y otras.
- Movimientos de ingreso, gasto, transferencia y ahorro; confirmados o pendientes.
- Categorías, presupuestos, recurrencias y metas de ahorro.
- Registro de cursos, libros, herramientas y otras inversiones de estudio.
- Ajustes de moneda/cotizaciones y privacidad.

Dispone de formularios de carga rápida y un PIN opcional de interfaz. Ese PIN no reemplaza la autenticación de Firebase ni las reglas de acceso a la base.

El servidor consulta cotizaciones mediante `/api/dolar`, con caché de 30 minutos y uso de la última respuesta disponible cuando falla la consulta. Las pantallas financieras dependen de los datos, monedas y parámetros configurados.

## Cerebro

`/cerebro` reúne notas y grafo de conocimiento. Permite escribir notas, usar plantillas, enlazar entidades, consultar backlinks y explorar conexiones visualmente.

La lógica de relaciones está en `src/lib/links.ts`; la visualización del grafo usa D3. Las rutas anteriores `/notas`, `/grafo` y `/segundo-cerebro` llevan a las pestañas correspondientes de Cerebro.

## Asistente con IA

El panel Gemini usa endpoints del servidor bajo `/api/ai`. Incluye conversación con contexto del CRM, transcripción de voz, sugerencias de objetivos semanales y herramientas para tareas, reuniones, proyectos, notas y movimientos financieros.

El servidor define funciones que el modelo puede solicitar; el componente `GeminiCopilotDrawer` procesa las llamadas y ejecuta las acciones mediante las funciones de la aplicación. Por eso el asistente puede modificar registros, además de responder preguntas.

Las peticiones requieren sesión autorizada y una clave `GEMINI_API_KEY` en el servidor. La disponibilidad real de los modelos configurados depende del proveedor; los identificadores que aparecen en el código no garantizan acceso en una cuenta determinada.

Los datos incluidos en la petición de contexto se envían al servicio de IA. La voz requiere permiso de micrófono del navegador.

## Ajustes y funciones transversales

En `/ajustes` se agrupan estado de la app, automatizaciones, datos de cobro, parámetros fiscales/de reparto, precios PAF, finanzas personales, papelera, privacidad, widgets, ayuda, sincronización y personalización.

Funciones compartidas:

- Tema claro/oscuro, sonidos y respuesta háptica cuando el dispositivo lo admite.
- Modo privacidad y bloqueo/cierre de sesión.
- Buscador/paleta de comandos y creación rápida.
- Papelera para determinados tipos de registros; la interfaz la presenta como papelera de 30 días. No todos los borrados de todos los módulos pasan necesariamente por ella.
- Instalación como PWA y atajos para tareas y movimientos personales.
- Avisos dentro de la app y push en dispositivos suscritos.

Atajos documentados en la interfaz: `Ctrl+K`/`⌘K` para el buscador, `1` Hoy, `2` Clientes, `3` Dinero, `4` Cerebro, `F` Foco, `T` tarea, `R` reunión y `Esc` para cerrar paneles. Su disponibilidad depende del contexto de teclado y la pantalla.

## Datos, sincronización y respaldos

### Dónde se guarda la información

**Firestore es la fuente compartida principal.** El cliente usa suscripciones para recibir cambios y una caché persistente de Firebase con soporte para varias pestañas. Además, hay copias y preferencias en `localStorage`.

`storage.ts` administra datos locales; `firestoreService.ts` reúne gran parte de las operaciones de nube. `cloudMirror.ts` refleja cambios de horas y papelera y combina datos al abrir: una desaparición en nube de un ID previamente sincronizado se interpreta como borrado para evitar resucitarlo desde otra copia local.

La persistencia local facilita continuidad, pero no garantiza que todas las pantallas y operaciones funcionen sin conexión. IA, acciones públicas del cliente, integraciones y automatizaciones dependen del servidor o de servicios externos. Algunas preferencias e historiales auxiliares viven solo en el navegador.

La carpeta `data/` contiene JSON de datos anteriores, con listas vacías en el archivo principal revisado. No es una exportación de la base activa ni el almacenamiento principal del CRM actual. Los endpoints antiguos `/api/sync*` son compatibilidad, no un motor de sincronización de esos JSON.

### Colecciones principales

| Área | Colecciones representativas |
| --- | --- |
| Trabajo diario | `tasks`, `meetings`, `weeklyGoals`, `daily_budgets`, `timeLogs`, `daily_routine`, `daily_routine_log` |
| Clientes y ventas | `clients`, `projects`, `prospects`, `prospect_events`, `prospect_pool` |
| Estudio | `incomes`, `expenses`, `studioFixedExpenses`, `studio_payment_settings`, `mp_incoming` |
| Personal | `personal_accounts`, `personal_categories`, `personal_transactions`, `personal_recurrings`, `personal_budgets`, `personal_savings_goals`, `personal_study_items`, `personal_finance_settings` |
| Conocimiento | `notes`, `links`, `journal` |
| Contenido | `content_pieces`, `content_assets` |
| Compartir | `documents`, `client_panels`, `student_portals` |
| Configuración y diagnóstico | `settings`, `app_errors` |

Esta tabla es orientativa, no un inventario exhaustivo de cada documento auxiliar.

### Autenticación y acceso

El inicio de sesión usa Google/Firebase Auth. El acceso privado verifica correos autorizados en `src/utils/authAccess.ts`, `server.ts` y `firestore.rules`; esos tres lugares deben mantenerse coherentes.

Las reglas permiten a las cuentas autorizadas leer y escribir datos del CRM. Para `student_portals`, permiten lectura pública de un documento por ID; no dan permiso público para listar la colección ni escribir. El servidor valida y procesa las acciones públicas específicas.

El modelo actual utiliza colecciones compartidas para las cuentas autorizadas; no implementa separación de organizaciones mediante un tenant por usuario. El Admin SDK del servidor depende de sus credenciales y permisos de nube, independientemente de las reglas del cliente.

### Qué cubre cada respaldo

Hay dos mecanismos que conviene distinguir:

1. **Exportación/importación desde el cliente:** `exportCompleteCrmBackup` exporta las colecciones enumeradas en `ALL_CRM_COLLECTIONS`, en JSON versión `3.0`. La restauración usa escrituras con `merge: true`; agrega o combina documentos, no reemplaza toda la base ni elimina lo que no esté en el archivo. También acepta formatos antiguos de arrays.
2. **Respaldo del servidor:** `server/health.ts` recorre colecciones raíz y guarda un JSON comprimido en el bucket configurado, conservando hasta ocho respaldos. La tarea `frequent` intenta hacerlo cuando pasaron siete días. Requiere acceso del servidor y un bucket disponible; también existe ejecución manual desde estado de la app.

La exportación del cliente incluye ahora `content_pieces`, `content_assets` y `client_panels`, además de las colecciones anteriores. Esto incorpora las piezas, archivos Firestore y planes PAF de los paneles a la exportación/restauración. No exporta por sí sola todas las preferencias locales ni archivos de Storage.

El respaldo del servidor de documentos Firestore tampoco equivale a copiar todos los objetos de Storage. Para evaluar una recuperación hay que verificar el archivo generado, las colecciones y los archivos externos incluidos. El enlace de descarga del último respaldo del servidor dura diez minutos.

## Integraciones y automatizaciones

Las integraciones requieren configuración externa. La presencia de código no significa que estén conectadas. La guía paso a paso está en [GUIA-AUTOMATIZACION.md](GUIA-AUTOMATIZACION.md).

| Integración | Función | Configuración principal |
| --- | --- | --- |
| Firebase cliente | Login y datos del CRM | `firebase-applet-config.json`, proveedor Google y reglas. |
| Firebase Admin | Trabajo del servidor sin navegador abierto | `FIREBASE_SERVICE_ACCOUNT` o identidad de Cloud Run con permisos. |
| Gemini | Chat, voz y asistencia | `GEMINI_API_KEY`. |
| Telegram | Resúmenes y avisos | `TELEGRAM_BOT_TOKEN` y vinculación de chat; `TELEGRAM_CHAT_ID` opcional. |
| Google Calendar | Sincronización de reuniones | `GOOGLE_CALENDAR_ID`, credenciales y calendario compartido. |
| Calendly | Reservas, sincronización y webhook | `CALENDLY_TOKEN` y conexión desde ajustes. |
| Mercado Pago | Recepción/búsqueda de pagos y conciliación | `MP_ACCESS_TOKEN`, webhook y `MP_WEBHOOK_SECRET` para firma. |
| Documenso | Firma de presupuestos | `DOCUMENSO_API_KEY`, URL y secreto de webhook. |
| Web Push | Avisos por dispositivo | Permiso, suscripción y claves VAPID; el servidor contempla generarlas si faltan. |
| Dólar | Cotizaciones para cálculos | Consulta del servidor a dolarapi.com. |

Google Calendar sincroniza reuniones del CRM hacia Google e importa eventos con horario. Los eventos de día completo se ignoran; borrar en Google no elimina automáticamente la reunión del CRM. La creación de links Meet no está resuelta por la cuenta de servicio. Consultar la guía para el alcance detallado.

### Reloj externo

El servidor no mantiene por sí solo un reloj que ejecute los avisos. Un programador externo debe llamar a `/api/cron/:job` con `CRON_SECRET`, mediante GET o POST. El secreto debe tener al menos 16 caracteres. Las URLs concretas se obtienen desde Ajustes → Automatizaciones.

Los horarios de la guía son una propuesta de configuración del programador externo:

| Trabajo | Frecuencia propuesta |
| --- | --- |
| `daily-brief` | Todos los días, 08:00. |
| `weekly` | Domingos, 19:00. |
| `prospecting-close` | Lunes a viernes, 19:00. |
| `frequent` | Cada 10 minutos. |
| `day-close` | Lunes a viernes, 19:30. |
| `weekly-collections` | Lunes, 09:00. |
| `paf-report` | Viernes, 17:00. |
| `month-close` | Día 1 del mes, 09:00. |

`frequent` agrupa recordatorios, Calendar y Mercado Pago; además comprueba respaldo, seguimiento de presupuestos y avisos de llamadas/contenido. Los trabajos `reminders`, `calendar-sync` y `mercadopago` también pueden invocarse individualmente.

Configurar el programador con zona horaria argentina. El servidor usa `America/Argentina/Cordoba` por defecto; el registro diario de prospección usa `America/Argentina/Buenos_Aires`.

### Variables de entorno

Copiar `.env.example` como `.env` para desarrollo. `dotenv` carga `.env` al iniciar el servidor; los secretos de producción deben configurarse en el entorno del despliegue.

| Variable | Uso |
| --- | --- |
| `GEMINI_API_KEY` | Acceso a Gemini. |
| `APP_URL` | URL pública usada en enlaces y conexiones del servidor. |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de cuenta de servicio o JSON codificado en base64. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Bot y chat para avisos. |
| `CRON_SECRET` | Autenticación de llamadas al reloj. |
| `GOOGLE_CALENDAR_ID` | Calendario que se sincroniza. |
| `CALENDLY_TOKEN` | Acceso a Calendly. |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Alternativa de configuración de firma del webhook; el código también consulta la clave guardada de la conexión. |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | API y firma de webhook de Mercado Pago. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notificaciones Web Push. |
| `DOCUMENSO_URL`, `DOCUMENSO_API_KEY`, `DOCUMENSO_WEBHOOK_SECRET` | Firma de documentos. |
| `PORT` | Puerto HTTP; `3000` por defecto. |
| `NODE_ENV` | Selección de entorno; `production` sirve la compilación. |
| `TZ` | Zona horaria del servidor. |
| `DISABLE_HMR` | Desactiva HMR/observación de archivos de Vite cuando vale `true`. |

`CALENDLY_WEBHOOK_SIGNING_KEY` y las variables operativas de ejecución no figuran todas en `.env.example`; se documentan aquí porque el código las consulta. `.gitignore` excluye archivos `.env*`, salvo el ejemplo.

## Instalación y ejecución

### Requisitos

- Node.js y un gestor de paquetes. El repositorio no fija `engines`; usar una versión compatible con las dependencias de Vite/TypeScript del proyecto.
- Configuración de Firebase válida y una cuenta Google autorizada para el CRM privado.
- Conectividad y credenciales de las integraciones que se quieran utilizar.

El repositorio incluye `bun.lock`. Para instalar respetando ese archivo con Bun:

```sh
bun install --frozen-lockfile
```

El archivo de bloqueo presente no está completamente alineado con `package.json`: faltan algunas dependencias declaradas, incluido el ejecutor de pruebas. Una instalación congelada puede rechazar esa diferencia. La validación del panel se preparó en carpetas temporales ignoradas, sin modificar `package.json` ni `bun.lock`.

Los scripts también pueden ejecutarse con npm. Si se elige npm para instalar:

```sh
npm install
```

Esa alternativa puede crear un `package-lock.json`; evitar mezclar actualizaciones de archivos de bloqueo sin una decisión del proyecto.

En PowerShell, preparar las variables locales:

```powershell
Copy-Item .env.example .env
```

Editar `.env` con los valores necesarios. Revisar `firebase-applet-config.json` antes de iniciar: esta copia apunta al proyecto configurado en ese archivo, no a una base local aislada. No hay configuración de emuladores Firebase en los archivos revisados.

### Desarrollo

```sh
npm run dev
```

Abre el servidor Express en `http://localhost:3000`, salvo que se cambie `PORT`. Express integra Vite como middleware: la interfaz y los endpoints `/api` comparten servidor. Configurar `localhost` como dominio autorizado de Firebase Auth si el proyecto lo requiere.

### Compilación y producción

```sh
npm run build
npm start
```

El build genera la aplicación web en `dist/` y el servidor en `dist/server.cjs`. El proceso de producción sirve ambos. El empaquetado del servidor deja dependencias externas, por lo que el entorno de ejecución también necesita las dependencias instaladas.

`npm run preview` abre la previsualización de Vite; no sustituye el servidor Express para comprobar integraciones y endpoints. El código contiene soporte para AI Studio/Cloud Run, pero no incluye en esta carpeta una receta completa de infraestructura que garantice el despliegue.

### Scripts disponibles

| Comando | Acción |
| --- | --- |
| `npm run dev` | Desarrollo con `tsx server.ts`. |
| `npm run build` | Compila frontend y empaqueta servidor con esbuild. |
| `npm start` | Ejecuta `dist/server.cjs`. |
| `npm run preview` | Previsualización del frontend con Vite. |
| `npm run lint` | Comprobación TypeScript mediante `tsc --noEmit`; no es un linter de estilo. |
| `npm test` | Ejecuta Vitest según `vitest.config.ts`. |
| `npm run clean` | Script de limpieza con `rm -rf`; requiere shell compatible y no funciona tal cual en todos los entornos Windows. |

## Arquitectura y archivos

```text
crm-cero/
├── src/
│   ├── main.tsx              # Entrada: CRM o vista pública por token
│   ├── App.tsx               # Estado central, suscripciones y acciones
│   ├── types.ts              # Modelo de datos compartido
│   ├── firebase.ts           # Firestore y caché persistente
│   ├── firebaseAuth.ts       # Sesión Firebase
│   ├── views/                # Pantallas, incluidas finanzas personales
│   ├── components/           # Navegación, formularios, tarjetas y paneles
│   ├── prospecting/          # Embudo, reserva, eventos y registro diario
│   ├── content/              # Modelo, importación y archivos de contenido
│   ├── panels/               # Paneles públicos y seguimiento Web/PAF
│   ├── automation/           # Construcción de mensajes
│   ├── lib/                  # Relaciones entre entidades
│   ├── utils/                # Persistencia, finanzas, fechas y reglas
│   ├── hooks/                # Temporizadores e instalación PWA
│   ├── pdf/                  # Documento PDF
│   └── styles/               # Tema visual
├── server.ts                 # Express, autenticación, IA y servidor web
├── server/                   # Automatizaciones e integraciones
├── tests/                    # Pruebas de lógica de negocio
├── public/                   # Iconos, recursos y receptor push
├── data/                     # JSON de datos anteriores
├── skills/                   # Instrucciones auxiliares de desarrollo
├── firestore.rules           # Acceso a Firestore
├── firebase-applet-config.json
├── GUIA-AUTOMATIZACION.md
├── .env.example
├── vite.config.ts            # Vite, PWA, recursos y chunks
└── vitest.config.ts           # Alcance de pruebas
```

Stack: React 19, TypeScript, Vite, Tailwind CSS, Express, Firebase cliente/Admin, SDK Google GenAI, D3, React PDF, dnd-kit, Motion y Web Push.

`App.tsx` concentra una parte considerable de la coordinación. Las reglas puras se distribuyen en utilidades y módulos para que puedan compartirse entre interfaz, servidor y pruebas. El enrutado es propio (`src/utils/router.ts`), basado en History API, y conserva alias de rutas anteriores.

### Familias de endpoints

| Familia | Responsabilidad |
| --- | --- |
| `/api/ai/*` | Chat, transcripción, objetivos y asistencia comercial; requiere propietario. |
| `/api/automation/*` | Estado, vinculación y pruebas de automatizaciones. |
| `/api/cron/:job` | Ejecución programada protegida por secreto. |
| `/api/calendly/*` | Conexión, sincronización y webhook. |
| `/api/mercadopago/*` | Pagos, saldo, búsqueda, estado y webhook. |
| `/api/documenso/*` | Envío a firma, estado, PDF y webhook. |
| `/api/documento/:token/*` | Apertura y aceptación pública de documentos. |
| `/api/panel/:token/accion` | Acciones del cliente desde su panel. |
| `/api/prospects/audit` | Recepción del diagnóstico externo. |
| `/api/push/*` | Suscripción y prueba de notificaciones. |
| `/api/health/*` | Estado detallado, errores y respaldos protegidos. |
| `/_health`, `/healthz` | Comprobación simple de disponibilidad del proceso. |
| `/api/dolar` | Consulta pública de cotizaciones. |

Webhooks, enlaces públicos y cron tienen validaciones distintas de las peticiones privadas. Para implementar un consumidor de API, consultar el handler concreto: esta tabla no define cuerpos de petición ni sustituye sus controles.

## Validación y mantenimiento

Las comprobaciones previstas por el proyecto son:

```sh
npm run lint
npm test
npm run build
```

Las pruebas abarcan finanzas, recurrencia, contratos, documentos, rutina, contenido, paneles, prospección, reserva, guiones, llamadas y otras reglas. Son principalmente pruebas de lógica, no una suite completa de navegación real ni de servicios externos.

**Alcance de Vitest:** la configuración actual incluye `tests/**/*.test.ts`. Los archivos de prueba colocados junto al código dentro de `src/`, como los de enlaces o proyectos/tareas, no entran en `npm test` con ese patrón.

Para mantener el sistema:

1. Al agregar una entidad, revisar tipos, guardado, suscripciones, enlaces y permisos.
2. Si se agrega una colección, revisar también exportación, importación, reseteo y respaldo; una colección nueva no entra automáticamente en `ALL_CRM_COLLECTIONS`.
3. Si se comparte información, generar una copia pública con los campos necesarios y validar acciones en el servidor.
4. Si se cambia un cobro, comprobar coherencia entre pago, ingreso, cuota y libro de cobros.
5. Si se cambia una fecha o recurrencia, comprobar zona horaria y cambio de mes.
6. Si se cambia una ruta, revisar alias, sectores, navegación móvil y enlaces compartidos.
7. Antes de probar escrituras, confirmar a qué proyecto Firebase apunta la instancia.

Para la implementación del panel PAF se comprobó TypeScript, se ejecutaron 231 pruebas de Vitest y se compiló frontend/servidor. También se revisaron en navegador las cinco secciones, las tres etapas mensuales, comentarios de contenido, recursos, adaptación móvil y guardado del editor en caso de éxito/error. Esa revisión usó datos de demostración y respuestas simuladas para las acciones del cliente; no verifica las credenciales ni un despliegue de producción.

## Problemas frecuentes

| Síntoma | Qué revisar |
| --- | --- |
| No permite entrar | Proveedor Google, dominio autorizado, correo verificado y listas de acceso del cliente/servidor/reglas. |
| Hay datos locales pero no aparecen en otro dispositivo | Sesión, conexión, reglas, estado de sincronización y errores de Firestore. Distinguir datos compartidos de preferencias locales. |
| No llegan avisos con la app cerrada | Programador externo, `CRON_SECRET`, acceso Admin, bot/chat de Telegram o suscripción push del dispositivo. |
| No se sincronizan reuniones | Calendario compartido con permisos, `GOOGLE_CALENDAR_ID`, credenciales y ejecución de `calendar-sync`/`frequent`. |
| Un pago no figura en el cliente | Configuración de Mercado Pago, recepción/sincronización, bandeja de entrantes y conciliación. |
| Un enlace público no carga o no guarda acciones | Token activo, copia en `student_portals`, reglas de lectura, servidor y acceso Admin para acciones. |
| Falla la importación de contenido | JSON válido, archivos del ZIP, coincidencia de rutas y tamaño de data URL. |
| La IA no responde | Clave Gemini, sesión autorizada, disponibilidad del modelo y respuesta del endpoint. |
| El respaldo automático falla | Bucket configurado, permisos de Storage/Admin y estado de ejecución de `frequent`. |
| Una restauración deja registros anteriores | La importación del cliente combina documentos; no vacía la base antes de importar. |

El punto de diagnóstico operativo es **Ajustes → Estado de la app**, junto con **Automatizaciones**. Ahí se consultan acceso del servidor, integraciones, errores y últimas ejecuciones; el estado real debe verificarse en la instancia en uso.
