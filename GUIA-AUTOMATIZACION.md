# Guía: activar las automatizaciones de .Cero CRM

Con esto tu CRM te escribe por **Telegram** (resumen a las 8, avisos antes de cada reunión, plan del domingo) y **sincroniza tu Google Calendar**, aunque la app esté cerrada.

Tiempo total: unos 20 minutos, una sola vez. Todo se carga en **AI Studio → Secrets**. Ninguna de estas claves va en el código ni en GitHub.

Dentro de la app, en **Ajustes → Automatizaciones**, vas a ver qué paso falta y cuáles ya están listos.

---

## 1. Clave de servicio de Firebase (obligatoria)

Le permite al servidor leer tus datos cuando vos no estás en la app.

1. Entrá a https://console.firebase.google.com y abrí el proyecto **fabled-fold-lt8c4**.
2. Tocá el engranaje → **Configuración del proyecto** → pestaña **Cuentas de servicio**.
3. Tocá **Generar nueva clave privada**. Se descarga un archivo `.json`.
4. Abrilo con el Bloc de notas, copiá **todo** el contenido y guardalo en los Secrets de AI Studio con el nombre:
   `FIREBASE_SERVICE_ACCOUNT`
5. Borrá el archivo descargado de tu computadora. Esa clave da acceso total a tu base: no la compartas con nadie.

## 2. Bot de Telegram (opcional)

Si no lo usás, no hace falta: el cierre del día, la lista de prospección y los recordatorios siguen apareciendo dentro de la app. Solo te perdés los avisos con la app cerrada.

1. En Telegram buscá **@BotFather** y mandale `/newbot`.
2. Elegí un nombre (por ejemplo "Cero CRM") y un usuario que termine en `bot` (por ejemplo `cero_crm_juan_bot`).
3. BotFather te da un **token** (algo como `123456:ABC-...`). Guardalo en los Secrets como:
   `TELEGRAM_BOT_TOKEN`
4. Redesplegá la app. Abrí tu bot en Telegram y mandale `/start`.
5. En la app: **Ajustes → Automatizaciones → Conectar Telegram**. Te llega un mensaje de confirmación.

## 3. Reloj automático (solo si usás Telegram o Google Calendar)

El servidor no se despierta solo: un reloj externo lo llama en horarios fijos.

1. Inventá una clave larga, de 16 caracteres o más, sin espacios (por ejemplo `cero-reloj-8f3k2m9q7x`). Guardala en los Secrets como:
   `CRON_SECRET`
2. Creá una cuenta gratis en https://cron-job.org.
3. Creá estas 4 tareas. La dirección exacta, con tu dominio, la copiás desde **Ajustes → Automatizaciones**, y reemplazás `TU_CLAVE` por tu `CRON_SECRET`:

| Tarea | Dirección | Cuándo |
|---|---|---|
| Resumen del día | `https://TU-APP/api/cron/daily-brief?key=TU_CLAVE` | Todos los días, 8:00 |
| Plan de la semana | `https://TU-APP/api/cron/weekly?key=TU_CLAVE` | Domingos, 19:00 |
| Cierre de prospección | `https://TU-APP/api/cron/prospecting-close?key=TU_CLAVE` | Lunes a viernes, 19:00 |
| Avisos + calendario | `https://TU-APP/api/cron/frequent?key=TU_CLAVE` | Cada 10 minutos |

En cron-job.org, configurá la zona horaria **America/Argentina/Buenos_Aires**.

> Alternativa: Google Cloud Scheduler, en el mismo proyecto de Google Cloud donde AI Studio publica la app. Funciona igual: son las mismas direcciones.

## 4. Google Calendar (opcional)

1. Abrí Google Calendar en la computadora → **Configuración** → en la izquierda, tu calendario → **Compartir con personas o grupos específicos**.
2. Agregá el correo de la cuenta de servicio. Termina en `@fabled-fold-lt8c4.iam.gserviceaccount.com` y lo ves en **Ajustes → Automatizaciones**.
3. Permiso: **Hacer cambios en los eventos**.
4. Guardá tu Gmail en los Secrets como:
   `GOOGLE_CALENDAR_ID` (por ejemplo `puntocerovision@gmail.com`)

Qué hace la sincronización:
- Cada reunión que creás en el CRM aparece en tu Google Calendar, y si la cambiás se actualiza.
- Lo que agendás en Google con horario (incluidas las reservas de turnos de tus alumnos) entra al CRM como reunión.
- Si movés en Google una reunión del CRM, se mueve también en el CRM.
- Si borrás una reunión en el CRM, se borra su evento. **Nunca se borran reuniones del CRM desde Google.**
- Los eventos de día completo (cumpleaños, feriados) se ignoran.
- La cuenta de servicio no puede crear links de Meet. Si necesitás uno, agregalo en Google al evento.

**Turnos para alumnos:** en Google Calendar, Crear → **Programa de citas**. Compartí ese link con tus alumnos (también podés ponerlo en su portal). Cada turno reservado entra solo al CRM en menos de 10 minutos.

---

## Probar antes de activar

En **Ajustes → Automatizaciones → Probar**:
- **Ver** muestra cómo quedaría el mensaje con tus datos de hoy, sin mandar nada.
- **Enviar** lo manda a tu Telegram en ese momento.

## Si algo falla

- La sección dice "Falta …": revisá que el Secret tenga ese nombre exacto y redesplegá.
- "No encontré mensajes" al conectar Telegram: mandale `/start` a tu bot y volvé a tocar **Conectar**.
- cron-job.org marca error 401: la clave en la dirección no coincide con `CRON_SECRET`.
- Calendar da error 404 o 403: el calendario no está compartido con la cuenta de servicio, o le falta el permiso de "Hacer cambios".

---

## 5. Conectar tu auto auditoría (somospuntocero.online/auditoria)

Así, cada vez que alguien completa el quiz, el CRM:
- lo marca como "Auditoría completada" (lo reconoce por su link personal o por WhatsApp, Instagram, email o estudio; si no estaba en tu lista, lo crea),
- guarda su puntaje y sus respuestas en su ficha,
- crea la tarea **"Video de auditoría"** con vencimiento a 48 hs,
- suma 1 en "Auto Auditorías" de tu tabla semanal,
- y te avisa por Telegram.

Pasos:
1. En la app: **Prospección → Mensajes → Conectar tu formulario de auditoría** → **Copiar fragmento**. Ya trae la dirección de tu CRM.
2. Abrí el archivo de la página de auditoría de tu sitio y buscá, dentro de `form.addEventListener('submit', ...)`, este bloque:

   ```js
   for (var qIdx = 1; qIdx <= 15; qIdx++) {
     ...
   }
   ```

3. Pegá el fragmento **justo debajo de ese bloque** y **antes** de `function advanceToResults() {`.
4. Publicá el sitio.

El mail te sigue llegando igual. Si el CRM no responde, el quiz funciona exactamente como antes.

**Link personal:** cuando le pasás la auditoría a alguien desde la app ("Le pasé la auditoría"), el mensaje ya incluye su link con `?p=...`. Así se identifica aunque escriba su WhatsApp distinto.

**Requisito:** necesita la clave de servicio (paso 1). Sin ella, las auditorías solo llegan por mail.
