# Plan: alta del cliente sin Tally, todo desde el CRM

Escrito el 11/11/2026. Para hacerlo **otro día, con la base con cupo**. No se toca nada hasta entonces.

## Qué queremos

Hoy el alta pasa por cuatro sistemas encadenados (CRM → planilla → Tally → Google Script → CRM), con esperas de 5 minutos entre medio. Si uno falla, el resto queda trabado sin avisar. La idea:

1. **Vos:** en la ficha tocás **"Dar de alta"**. Se crea el ID y se publica su portal con la bienvenida.
2. **Vos:** le mandás **un solo link**, el del portal (el CRM te arma el WhatsApp; lo mandás vos).
3. **El cliente:** entra con su Google y ve **"Completá tus datos"**, un formulario corto adentro del portal.
4. **El CRM, solo:** guarda las respuestas en su ficha, **crea sus carpetas en tu Drive**, le comparte la suya, le muestra la carta "Tus materiales" y te avisa a vos.

Un solo sistema. Sin Tally, sin la planilla y sin el script para los clientes nuevos.

## Qué ya existe y se reutiliza

- **Drive conectado al servidor** (`server/driveOAuth.ts`): crea carpetas que no se duplican aunque se repita el paso (`ensureFolder`) y las comparte sin mandar mails (`shareFolder`). Hoy lo usan los clientes Web.
- **El portal** ya sabe mostrar las carpetas (Tu carpeta, Materiales y sus 4 subcarpetas, el Excel) cuando están en la ficha (`pafDrive`), y ya habilita tareas solas cuando llegan las carpetas.
- **El "Terminé" del portal** ya manda datos del cliente al servidor sin cambiar las reglas de la base. El formulario va por el mismo camino.
- **Las cartas**: "Completá tus datos" y "Tus materiales" son cartas como cualquier otra.

## Las carpetas que crea (igual que hoy)

**Carpeta compartida con el cliente** (`Adrede`):
- `00_BIENVENIDA.pdf`
- `01_Para_completar/`: `Excel_Cliente_ideal_nicho_y_oferta.xlsx`, `Excel_Competidores_opcional.xlsx`
- `02_Materiales/`: `01_Proyectos/`, `02_Equipo_y_marca/`, `03_Referencias/`, `04_Registro_de_obra/` (cada una con su PDF explicativo)
- `03_Resultados/`

**Carpeta interna, solo tuya:** `01_Acuerdo_y_arranque/`, `02_Analisis_y_borradores/`, `03_Reuniones_y_reportes/`, `04_Historial/`, `00_Ficha_actual`

Se copian de una **carpeta modelo** en tu Drive: lo que cambies ahí (un PDF nuevo, otro Excel) les llega a los clientes que vengan después.

## Cómo se hace sin romper nada

- **Interruptor por cliente.** El flujo nuevo se prende cliente por cliente. Los clientes actuales y cualquiera que no lo tenga prendido siguen exactamente igual (Tally, planilla y script). Si algo sale mal, se apaga y vuelve al de siempre.
- **Primero con el cliente de ejemplo** (Estudio Bosque), con carpetas de prueba en una carpeta aparte. Recién cuando anda de punta a punta, Adrede.
- **Sin tocar las reglas de la base:** el formulario lo recibe el servidor, que revisa que quien lo manda sea el correo autorizado de ese portal.
- **Lo privado sigue privado:** las respuestas del formulario van a la ficha (como hoy las de Tally) y nunca se muestran en el portal. La carpeta interna nunca se comparte.
- **Nada se le manda solo al cliente.** El WhatsApp lo mandás vos.
- **Cada paso se puede repetir sin duplicar:** si se corta a la mitad, "Reintentar" sigue desde donde quedó.

## Pasos

### Paso 0 (vos, del lado de Google, 5 minutos)
La base **sigue en el plan gratis** (decisión de Juan: no se pasa a pago por uso). Por eso el CRM tiene que gastar poco: ver "Quedarse dentro del cupo gratis", abajo.
1. **Reconectar Drive con permiso para leer tus plantillas.** Hoy el CRM solo puede tocar lo que creó él. Para copiar los PDF y los Excel de la carpeta modelo necesita permiso para ver tu Drive. Es un clic en Ajustes del CRM con puntocerovision@gmail.com. Yo dejo el botón listo; vos aceptás.
2. **Decirme cuál es la carpeta modelo** o confirmar la que encuentre yo. En la carpeta de PAF-011 no vi los PDF dentro de cada subcarpeta de Materiales: hay que confirmar que estén en la carpeta modelo.

### Paso 1: el formulario en el portal
- Carta **"Completá tus datos"** como lo de ahora, hasta que la mande.
- Las mismas preguntas que hoy tiene Tally, más cortas donde se pueda: nombre del estudio, contacto y rol, WhatsApp, correo de Google para la carpeta, quién aprueba (con sus correos), ciudad, días y horarios para reunirnos, links (web, Instagram, Google), qué materiales tiene, si ya tiene una carpeta con material, qué no se puede mostrar, y ausencias o fechas a tener en cuenta.
- Se guarda a medida que escribe: si cierra, no pierde nada.

### Paso 2: el servidor recibe y crea las carpetas
- Revisa que lo mande el correo autorizado de ese portal.
- Guarda las respuestas en la ficha.
- Copia la carpeta modelo: la compartida y la interna, dentro de `Clientes .CERO / <ID> - <Estudio>`.
- Comparte la carpeta compartida con el correo que puso en el formulario.
- Guarda todos los links en la ficha, y el portal los muestra solo.

### Paso 3: lo que pasa solo después
- Se habilita la carta **"Tus materiales"** con sus 4 tareas, una por subcarpeta.
- Te llega un aviso: "Adrede completó sus datos. Carpetas listas."
- La ficha muestra las respuestas del formulario, igual que hoy las de Tally.

### Paso 4: tu lado en la ficha
- Un solo botón **"Dar de alta"**: crea el ID y publica el portal con la bienvenida y el formulario.
- **Semáforo del alta**, para ver en qué paso está cada cliente:
  `ID creado → Portal publicado → Formulario respondido → Carpetas creadas → Carpeta compartida`
  Si un paso falla, dice por qué y tiene su botón **Reintentar**.

### Paso 5: probar y pasar a Adrede
1. Cliente de ejemplo de punta a punta: formulario → carpetas → portal → aviso.
2. Revisamos juntos las carpetas creadas en tu Drive.
3. Prendemos el flujo nuevo en Adrede, publicás, le mandás el link.
4. Tests, build, commit, `main` (con tu OK) y redeploy en AI Studio.

## Quedarse dentro del cupo gratis

El cupo gratis son **50.000 lecturas por día**, compartidas con tus otras apps de AI Studio, y se renueva cada madrugada (alrededor de las 5 de Argentina). Antes del 11/11 el CRM solo gastaba unas 29.000 por día; con los cambios del 11/11 el servidor gasta mucho menos.
- El alta nueva **gasta menos que la de hoy**: no hay un script consultando la base cada 5 minutos, solo unas pocas lecturas cuando el cliente manda el formulario.
- **Medidor en Ajustes → Estado:** cuánto se usó hoy (lo que lee el servidor) y un aviso a tu teléfono si pasa del 70%, para que nunca te enteres por un "no se pudo".
- **Si un día se llega al tope igual:** el CRM lo dice claro ("la base llegó a su límite de hoy, vuelve a las 5") en vez de "revisá la conexión", y lo que no se pudo guardar se reintenta solo cuando vuelve.
- **Tus otras apps de AI Studio comparten el cupo:** si tenés alguna que ya no usás, conviene borrarla (o al menos no abrirla) para que no gaste.

## Para decidir antes de empezar

1. **¿Google le manda al cliente el mail de "te compartieron una carpeta"?** Hoy el CRM lo comparte sin mail. Mi sugerencia: sin mail, porque ya le llega todo por el portal.
2. **¿Mismas preguntas que Tally o recortamos alguna?** Mi sugerencia: las mismas, porque ya las pensaste.
3. **¿La planilla sigue como registro?** Mi sugerencia: no. El CRM pasa a ser el registro de clientes y la planilla queda solo para los que ya están.

## Lo que queda igual

- Los clientes ya dados de alta con Tally: siguen igual, con sus carpetas.
- Tally, la planilla y el Google Script siguen andando para quien no tenga prendido el flujo nuevo.
- Las reglas de la base y las claves no se tocan.

## Para hoy, mientras tanto

Nada. Mañana, cuando se renueve el cupo, se puede seguir con el alta de siempre para Adrede (Publicar portal y link de Tally) o esperar a que esté el flujo nuevo. Las dos opciones sirven.
