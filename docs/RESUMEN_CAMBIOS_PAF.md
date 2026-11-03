# Resumen de cambios · Portal PAF y panel del estudio (CRM .CERO)

Sesión del 02 y 03/11/2026 (Claude Code). Este documento es para que otra sesión de Claude pueda revisar o cambiar lo hecho.
Juan prefiere español rioplatense, corto y concreto. La marca se escribe **.CERO**.

---

## 0. Dónde está todo (accesos y links)

### Código
| Qué | Dónde |
|---|---|
| Repositorio | https://github.com/puntocerovisionPreview/crm-cero |
| **Rama con TODO lo de esta sesión** | `codex/automatizaciones-drive` → https://github.com/puntocerovisionPreview/crm-cero/tree/codex/automatizaciones-drive (último commit `aa2cd38`) |
| Rama `main` | Tiene solo hasta `57ed782` (portal rediseñado del 02/11). **Las fases 1 a 4 NO están en main.** |
| Copia local de Juan | `C:\Users\.Cero\OneDrive\Desktop\crm-cero` (Windows, PowerShell; Node 18) |
| Otra copia local (no tocada) | `C:\Users\.Cero\crm-cero-revision` (rama `mejoras-revision-claude`) |
| Correr local | `npm run dev` → http://localhost:3000. Tests: `npx vitest run`. Tipos: `npx tsc --noEmit`. Build: `npm run build` |
| Portal de ejemplo (solo local) | http://localhost:3000/portal?demo (datos inventados, sin login) |
| Vista previa de un portal real (solo Juan) | http://localhost:3000/portal?ver=PAF-PRUEBA-001 |

### Firebase (Firestore)
| Qué | Dónde |
|---|---|
| Consola | https://console.firebase.google.com/project/fabled-fold-lt8c4/firestore |
| Proyecto | `fabled-fold-lt8c4` |
| **Base de datos (NO es la default)** | `ai-studio-crmpersonalcero-c4c0d8e9-24b3-4492-856e-4554aeab5492` |
| Reglas | Pestaña **Reglas** de esa base. El archivo fuente es `firestore.rules` del repo (rama `codex/automatizaciones-drive`). Juan publicó la versión de la fase 1, que es la actual; no cambió después. |
| Cuentas dueñas (acceso total al CRM) | `puntocerovision@gmail.com`, `liendojuan070@gmail.com` (en `firestore.rules`, `src/utils/authAccess.ts` y `server.ts`) |

### Google AI Studio (donde se publica el CRM)
- App: **"CRM Personal .Cero"** en https://aistudio.google.com (sección Build/apps).
- Está conectada a GitHub: repo `puntocerovisionPreview/crm-cero`, rama **`main`**. Última sincronización: 15/10. Último deploy: 20/10, 12:50.
- AI Studio marca **"There are changes in both Google AI Studio and GitHub"**: hay cambios hechos directo en AI Studio que no están en GitHub. **Nada de esta sesión está publicado ahí.**
- Lo que tiene publicado equivale al repo hasta el commit `f0e302f` (paneles conectados con alumnos PAF), más sus cambios propios.
- Secrets que se configuran ahí (no en el código): `GOOGLE_CALENDAR_ID` (Calendar, hoy sin configurar), `CRON_SECRET`, `FIREBASE_SERVICE_ACCOUNT` (opcional en AI Studio), `TELEGRAM_BOT_TOKEN`, etc. (ver `GUIA-AUTOMATIZACION.md`).

### Google (otro proyecto: "METODO PAF - ENTREGA DE SERVICIO")
- **Tally:** https://tally.so/r/2jXEVg, con el campo oculto `cliente_id`.
- **Sheet:** "Formulario de arranque — datos para organizarnos", pestaña `Clientes` (columnas: ID, ESTUDIO, CONTACTO, EMAIL_CLIENTE, ZONA_HORARIA, ESTADO_ALTA, ENLACE_FORMULARIO, CARPETA_INTERNA, CARPETA_COMPARTIDA, FICHA, FECHA_RESPUESTA, ERROR_ALTA).
- **Apps Script:** "PAF — Alta de clientes", vinculado a esa Sheet; corre cada 5 minutos. **Desde acá no se tocó.** No tengo los links directos: se abren desde la Sheet → Extensiones → Apps Script.
- Documento de traspaso entre proyectos: `C:\Users\.Cero\Downloads\TRASPASO_CRM_PAF.md` (copia en el repo: `docs/TRASPASO_CRM_PAF.md`). Lo modifiqué: sección "Contrato en Firestore (ACTUALIZADO 02/11/2026)".
- Plan y código propuesto para adaptar el Apps Script: `docs/PAF_FASE4_PLANES.md`, sección 1. **No está aplicado.**

---

## 1. Commits (en orden)
| Commit | Qué hizo |
|---|---|
| `34db28f` | Portal con cuenta de Google (`/portal`), colección `paf_portal`, reglas por correo autorizado, tarjeta en la ficha |
| `e18db2d` | Alta desde el CRM (`paf_pedidos_alta`), tareas con habilitar/aprobar, entregas, "Terminé" con avisos, contrato actualizado, Drive sin mail automático |
| `36e8286` | Link de Tally al instante con ID asignado por el CRM, carpetas de Drive pegadas a mano, "Agendar reunión", arreglo de "crypto is not defined" |
| `2f5d3b1` | Primer rediseño del portal (oscuro, tipo portal del alumno) |
| `57ed782` | Rediseño con el estilo del CRM, en pestañas (**hasta acá está en main**) |
| `5c24c0f` | Fase 1: reglas estrictas para "Terminé", correos normalizados, contador en Inicio, aviso push/Telegram |
| `382abc7` | Fase 2: panel de la ficha reorganizado (encabezado, pestañas, guardado solo, ver como cliente, motivo, canal, links privados) |
| `bb0edbd` | El correo del alta pasa solo a correos autorizados; la carpeta del estudio pasa sola a "Tu carpeta" |
| `650b4fd` | Fase 3: nuevo Inicio del portal (semana, objetivos, vencidas, Materiales, WhatsApp, bienvenida) |
| `aa2cd38` | Fase 4: tablero "PAF hoy", resúmenes de reunión, plantillas por etapa, contenido para aprobar, documento de planes |

---

## 2. Archivos (todos en el repo; ruta relativa a la raíz)

### Nuevos
| Archivo | Qué es |
|---|---|
| `src/portal/model.ts` | **Toda la lógica pura del portal**: tipos (`PafPortalDoc`, `PafTask`, `PafPortalDraft`, `PafPedidoAlta`, `PafMeetingSummary`, `PafPortalPiece`…), armado del documento público (`buildPafPortal`, `portalFromProject`), IDs y link de Tally, plantillas por etapa (`PAF_STAGE_TEMPLATES`), tablero (`pafTodayRows`), validaciones del servidor (`checkTerminado`, `checkPieza`), cambios sin publicar (`portalDirty`), links privados (`isPrivateUrl`) |
| `src/portal/store.ts` | Lecturas y escrituras en Firestore del portal: publicar/despublicar, avisos, pedidos de alta, contador de IDs, configuración (WhatsApp), envío de "Terminé" y de decisiones sobre piezas |
| `src/portal/usePafAvisos.ts` | Hook en `App.tsx`: toma los "Terminé" de todos los estudios y pasa esas tareas a "Avisó que terminó" |
| `src/portal/usePafPiezasSync.ts` | Hook en `App.tsx`: copia las piezas de contenido del panel de cada estudio a su portal publicado |
| `src/views/PafPortalView.tsx` | **Lo que ve el estudio** en `/portal` (login, Inicio, Tareas, Contenido, Entregas, Archivos, bienvenida, WhatsApp, vista de ejemplo y vista previa) |
| `src/components/PafAdminPanel.tsx` | **El panel de Juan en la ficha** del estudio (encabezado, pestañas Hoy/Tareas/Configuración, tareas, entregas, plantillas, WhatsApp) |
| `src/components/PafAltaCard.tsx` | "Alta del estudio": ID, link de Tally, WhatsApp, carpetas a mano |
| `src/components/PafReunionCard.tsx` | "Agendar reunión" (abre Google Calendar con el evento armado si Calendar no está conectado) |
| `src/components/PafWeekGoals.tsx` | Objetivos de la semana (reusa los del panel viejo `client_panels`) |
| `src/components/PafMeetingSummaries.tsx` | Resumen de reunión (acuerdos y próximos pasos) |
| `src/components/PafTodayBoard.tsx` | Tablero "PAF hoy" en el Inicio del CRM |
| `server/pafPortal.ts` | Rutas del servidor `POST /api/paf/terminado` y `POST /api/paf/pieza` |
| `server/nodeCrypto.ts` | Arreglo de "crypto is not defined" en Node 18 |
| `tests/paf-portal-login.test.ts` | Tests del portal (todo `src/portal/model.ts` y partes de las reglas) |
| `docs/TRASPASO_CRM_PAF.md` | Copia del traspaso con el contrato actualizado |
| `docs/PAF_FASE4_PLANES.md` | Planes sin aplicar: Apps Script (con código), portal viejo, rol CM, mail, Adquisición/Conversión |

### Modificados
| Archivo | Cambio |
|---|---|
| `firestore.rules` | Reglas de `paf_portal`, de `paf_portal/{id}/avisos` y lectura de avisos para el dueño (detalle en la sección 4) |
| `src/main.tsx` | Ruta `/portal` → `PafPortalView` (no carga el CRM) |
| `src/App.tsx` | Usa `usePafAvisos` y `usePafPiezasSync` |
| `src/types.ts` | `Project` suma `pafClienteId`, `pafPortal`, `pafDrive`, `pafTareas`, `pafEntregas`, `pafResumenes` |
| `src/views/ClientDetailView.tsx` | El bloque PAF de la ficha ahora es `PafAdminPanel` (el portal anterior queda dentro, en Configuración) |
| `src/views/HomeView.tsx` | Tablero "PAF hoy" debajo de "Tus 3 del día" |
| `src/panels/model.ts` | `PanelGoal` suma `quien?: 'cero' \| 'estudio'` |
| `server/automation.ts` | Registra las rutas de `server/pafPortal.ts` con aviso push/Telegram |
| `server/driveFiles.ts` | Compartir carpeta con `sendNotificationEmail=false` (antes mandaba mail automático; afecta a clientes Web) |
| `server.ts`, `vite.config.ts`, `vitest.config.ts` | Arreglo de crypto (Node 18); en Node 18 el service worker se arma sin minificar |

### Borrados (reemplazados)
`src/components/PafPortalCard.tsx` y `src/components/PafTareasCard.tsx` (por `PafAdminPanel`), y `src/components/PafReviewCard.tsx` (por `PafTodayBoard`).

---

## 3. Datos en Firestore (colecciones nuevas o usadas)

| Colección / doc | Quién escribe | Quién lee | Contenido |
|---|---|---|---|
| `paf_portal/{clienteId}` (ej. `PAF-002`) | CRM (Juan) y servidor (piezas) | El estudio (si su correo está en `emailsAutorizados`) y Juan | Lo único que ve el estudio: `estudio`, `emailsAutorizados`, `hitoVisible` (1–5), `resumenVisible`, `enlaces` {carpeta, materiales, resultados, web, asana}, `tareas`, `tareasHabilitadas` (IDs), `entregas`, `proximaReunion`, `semana`, `reuniones`, `actualizadoEn`. Aparte (no se pisan al republicar): `objetivos`, `contacto.whatsapp`, `piezas` |
| `paf_portal/{clienteId}/avisos/{autoId}` | El estudio (solo crear) | El estudio y Juan | "Terminé": `{ tareaId, email, creadoEn }` |
| `paf_pedidos_alta/{clienteId}` | CRM (y el Apps Script, cuando se adapte) | Juan | Alta: `projectId, clienteId, enlaceFormulario, estudio, contacto, email, zonaHoraria, prueba, estado, alta{…}, creadoEn, actualizadoEn` |
| `settings/paf_ids` | CRM | Juan | Contador de IDs: `ultimoReal`, `ultimoPrueba` |
| `settings/paf_portal` | CRM | Juan | `whatsapp` de Juan para el botón del portal |
| `projects/{id}` | CRM | Juan | La ficha privada (campos `paf*` de arriba) |
| `client_panels/{id}` | CRM / servidor | Juan | Panel viejo: de acá salen los **objetivos de la semana** y las **piezas de contenido** |

**Datos de prueba que quedaron:**
- `paf_portal/PAF-PRUEBA-001` (correo `franciscoliendo74@gmail.com`) y `paf_portal/PAF-PRUEBA-002` (correo inventado `prueba2@example.com`).
- Pedido `paf_pedidos_alta/PAF-PRUEBA-003`: Juan lo creó en el estudio real **adrede**, que quedó con `pafClienteId = PAF-PRUEBA-003`.
- Una reunión del 03/11 a las 11:00 en adrede, que creó Juan.

---

## 4. Seguridad (reglas de Firestore, ya publicadas por Juan)
- `paf_portal/{id}`: lo leen solo los correos de `emailsAutorizados` (con Google y `email_verified`, en minúscula). El estudio no puede escribir.
- `paf_portal/{id}/avisos`: el estudio solo puede **crear** avisos, con exactamente `tareaId`, su propio correo y la hora del servidor, y solo para una tarea que esté en `tareasHabilitadas` de **su** portal. No puede editar ni borrar.
- `/{path=**}/avisos/{id}`: lectura para el dueño (lo usa el contador del Inicio).
- Todo lo demás: solo las dos cuentas dueñas.
- El portal viejo (`student_portals`) sigue abierto por link, como antes.
- El servidor verifica el token de Google del estudio en `/api/paf/terminado` y `/api/paf/pieza`, con un límite de 10 pedidos por minuto por correo.

---

## 5. Qué ve y hace Juan (ficha del estudio PAF → bloque "Portal del estudio · Método PAF")

**Encabezado fijo:**
- Estado con un punto de color: "Sin publicar" (gris), "Hay cambios sin publicar" (ámbar) o "Publicado · fecha" (verde).
- Selector de **Etapa** (1–5).
- Botones **Publicar portal / Publicar cambios**, **Ver como cliente** (abre `/portal?ver=ID`, solo lectura) y **Copiar enlace** (copia `…/portal`).

**Pestaña Hoy:**
- *Sugerencias de la etapa* (plantilla): checkboxes, "Agregar y habilitar", "Agregar ocultas", "Agendar reunión de X" y "Ahora no".
- *Esta semana*: foco (texto, se guarda solo) y objetivos con quién los hace (Estudio o .CERO), check de cumplido y "Semana nueva".
- *Para revisar*: tareas en las que el estudio tocó "Terminé".
- *Agendar reunión*: título, fecha, hora, duración y temas. Guarda la reunión en la agenda del CRM y abre Google Calendar con el evento armado, porque Calendar no está conectado.
- *Resumen de reunión*: fecha, acuerdos, próximos pasos y "Que lo vea el estudio".
- *Entregas*: título, link de Drive, fecha y "La ve el estudio"; nacen ocultas.

**Pestaña Tareas:**
- Lista completa con estados: Sin habilitar, Habilitada, Avisó que terminó y Aprobada.
- Botones: Habilitar, Ocultar, **Aprobar** en un toque con el canal sugerido (el último usado, o Portal), **Volver a habilitar** (pide un motivo de hasta 140 caracteres, que ve el estudio) y Borrar.
- "+ Tareas sugeridas para la etapa".
- Para agregar: título, detalle, fecha y "Pide subir archivos". Las tareas nacen ocultas.

**Pestaña Configuración:**
- *Alta del estudio*: casilla "Es una prueba", ID sugerido (editable), estudio, correo, contacto, zona horaria y **"Crear link de Tally"**. Después muestra el link con Copiar, Abrir WhatsApp y Ver formulario, y "Carpetas de Drive" para pegar a mano (compartida, interna, ficha).
- *Acceso al portal*: ID y correos autorizados. El del alta se suma solo.
- *Enlaces del estudio*: Tu carpeta, Materiales, Resultados, Tu web y Calendario de contenido. Bloquea la carpeta interna y la ficha.
- *Tu WhatsApp*: uno solo para todos los estudios.
- *Portal anterior (por link)*: los botones viejos del alumno.
- *Despublicar*, al final.

**Guardado:**
- Etapa, foco, correos y enlaces se guardan solos en la ficha, pero el estudio los ve recién con "Publicar cambios".
- Tareas, entregas, resúmenes, objetivos y próxima reunión se publican solos si el portal ya está publicado.

**Inicio del CRM:**
- Tablero **"PAF hoy"**: una fila por estudio activo con etapa, próxima reunión, "N para revisar" y "N d sin novedades" (en ámbar desde 7 días).

**Avisos:**
- Cuando el estudio toca "Terminé" o aprueba o pide cambios en contenido, llega un aviso push/Telegram (desde el servidor publicado).

---

## 6. Qué ve el estudio (`/portal`, login con Google)
- **Login:** "Entrar con Google". Con otro correo ve "Esta cuenta no tiene un portal".
- **Estilo:** el mismo del CRM (Manrope, neutros, bordes finos). Claro u oscuro según su dispositivo.
- **Encabezado:** "Hola, [estudio]" y una línea "Presencia · Etapa X de 5 · *nombre* · Semana X de 12" con una barra de 5 tramos. Al tocarla se abre el recorrido Presencia → Adquisición 🔒 → Conversión 🔒 y las 5 etapas.
- **Bienvenida** la primera vez (3 pasos y "Entendido"; se guarda en el navegador).
- **Pestañas:** Inicio · Tareas · Contenido (solo si hay piezas) · Entregas · Archivos.
- **Inicio:**
  - Esta semana (foco y objetivos "Hace .CERO" / "Hace tu estudio"; si no hay nada, no aparece).
  - Aviso de piezas para revisar.
  - Lo que necesitamos de vos (hasta 3 tareas con "Terminé").
  - Próxima reunión y Última entrega.
  - Lo que acordamos (el último resumen).
- **Tareas:** tarjetas con fecha, "Venció el…" (punto rojo), "Te pedimos: [motivo]", detalle, "Subir a Materiales" y **Terminé**; debajo, En revisión y Aprobadas.
- **Contenido:** imágenes deslizables, fecha, soporte, estado, texto, **Aprobar** y **Pedir cambios** (con comentario obligatorio).
- **Entregas:** la lista y los resúmenes de reunión.
- **Archivos:** tarjetas con ícono para Tu carpeta, Materiales, Resultados, Tu web y Calendario de contenido.
- **Botón fijo "Hablar con Juan"** (WhatsApp), si Juan cargó su número.
- **Nunca muestra** notas internas, la ficha privada, respuestas de Tally, la carpeta interna, montos ni pagos.

---

## 7. Flujo de alta acordado con Juan
1. En la ficha, Configuración → Alta → **Crear link de Tally**. El CRM da el ID y el link al instante.
2. Juan manda el link (copiar o WhatsApp). El CRM no manda nada solo.
3. El estudio responde Tally → Sheet → el Apps Script crea las carpetas y comparte la del estudio.
   **Esto todavía no anda con los IDs del CRM:** el script solo procesa estudios que están en la pestaña `Clientes`. Hasta adaptarlo, Juan agrega la fila a mano con el mismo ID.
4. Juan pega a mano los links de Drive en la ficha (Alta → Carpetas de Drive, y Enlaces del estudio).
5. Solo entran al portal los correos autorizados; el del alta se suma solo.

---

## 8. Pendiente o no verificado
- **Nada publicado en AI Studio.** `main` no tiene las fases 1 a 4.
- **No probado de punta a punta con una cuenta real de estudio:** el "Terminé" con aviso push/Telegram y aprobar contenido. En la compu de Juan el servidor no tiene acceso a la base (no hay `.env`).
- **Google Calendar no conectado:** "Agendar" abre Calendar para guardar el evento a mano. Quedó a medio hacer y descartado un cambio para crear el evento al instante cuando Calendar está conectado.
- **El Apps Script no está adaptado** (plan y código en `docs/PAF_FASE4_PLANES.md`).
- **Textos de las plantillas por etapa:** son un borrador de Claude, en `src/portal/model.ts` → `PAF_STAGE_TEMPLATES`.
- **Decisiones abiertas** (en `docs/PAF_FASE4_PLANES.md`): rol de la CM, aviso por mail, apagado del portal viejo (lo usan adrede y Remodelante; **"afa" es cliente Web y no se apaga**) y contenido de Adquisición/Conversión.
- **Adrede** (cliente real) quedó con el ID de prueba `PAF-PRUEBA-003`.
- **Cambio que afecta a clientes Web:** compartir carpeta de Drive ya no manda mail automático (`server/driveFiles.ts`).

---

## 9. Cómo cambiar cosas típicas
| Querés cambiar… | Archivo |
|---|---|
| Textos, orden o diseño de lo que ve el estudio | `src/views/PafPortalView.tsx` |
| El panel de Juan en la ficha | `src/components/PafAdminPanel.tsx` (y `PafAltaCard`, `PafReunionCard`, `PafWeekGoals`, `PafMeetingSummaries`) |
| Las 5 etapas, las etiquetas de los enlaces, las plantillas de tareas, qué se publica | `src/portal/model.ts` |
| Tablero "PAF hoy" | `src/components/PafTodayBoard.tsx` y `pafTodayRows` en `src/portal/model.ts` |
| Reglas de seguridad | `firestore.rules`, y después **publicarlas** en la consola de Firebase (base `ai-studio-…`) |
| Rutas del servidor (avisos, contenido) | `server/pafPortal.ts` |
| Link de Tally | `TALLY_FORM_URL` en `src/portal/model.ts` |
| Después de cambiar | `npx tsc --noEmit`, `npx vitest run`, `npm run build`; commit en `codex/automatizaciones-drive`; pasar a `main` y sincronizar AI Studio para publicar |
