# Traspaso: conectar el CRM con la entrega del Método PAF

Para Claude Code, en el repositorio `puntocerovisionPreview/crm-cero`. Escrito el 02/11/2026 desde el proyecto "METODO PAF - ENTREGA DE SERVICIO". Comunicate con Juan en español rioplatense, corto y concreto. La marca se escribe **.CERO**.

## Qué quiere Juan

Manejar la entrega de sus clientes PAF desde su CRM, sin abrir la Sheet ni Drive:

1. **Dar el alta** de un estudio desde el CRM y ver en su ficha los enlaces de Drive cuando estén creados.
2. **Tareas, entregas y reuniones** por cliente, con estados y registro de aprobaciones.
3. Más adelante, **un portal para cada cliente**: resumen, próxima reunión, tareas habilitadas, entregas, enlaces a sus carpetas de Drive, su web (si la tiene) y el botón a Asana.

## Cómo se divide el trabajo

| Parte | Dónde se trabaja | Quién la toca |
|---|---|---|
| CRM, Firebase (datos y reglas), portal del cliente | Este repositorio | Claude Code, acá |
| Tally, Sheet, Apps Script del alta, carpetas de Drive | Google (proyecto "METODO PAF - ENTREGA DE SERVICIO") | La otra sesión de Claude. **No modificar desde acá.** |

Las dos partes se comunican **solo a través de Firestore**, con colecciones acordadas (abajo). Si hace falta cambiar ese contrato, hay que escribir el cambio en este archivo y avisar a Juan, para que se aplique también del lado de Google.

## Lo que ya existe y funciona en Google (comprobado el 02/11/2026)

- **Tally** `https://tally.so/r/2jXEVg`, con campo oculto `cliente_id`. Escribe en la Sheet "Formulario de arranque — datos para organizarnos".
- **Apps Script "PAF — Alta de clientes"**, vinculado a esa Sheet. Corre cada 5 minutos. Cuando un estudio registrado responde Tally, crea dos carpetas, la privada de Juan (ficha y plan) y la compartida con el estudio (bienvenida, Para completar, Materiales, Resultados), y comparte **solo** la del estudio con el correo confirmado.
- **Sheet**, pestaña `Clientes`: ID, ESTUDIO, CONTACTO, EMAIL_CLIENTE, ZONA_HORARIA, ESTADO_ALTA, ENLACE_FORMULARIO, CARPETA_INTERNA, CARPETA_COMPARTIDA, FICHA, FECHA_RESPUESTA, ERROR_ALTA.
- **IDs:** `PAF-001` fue una prueba; el primer cliente real será `PAF-002`. Las pruebas usan `PAF-PRUEBA-00N`. Un ID no se reutiliza nunca.
- **Hoy el alta se pide desde el menú PAF de la Sheet.** El objetivo es pedirla desde el CRM.

## Contrato en Firestore (ACTUALIZADO 02/11/2026 desde el CRM, ya implementado)

**Base de datos:** proyecto `fabled-fold-lt8c4`, base **`ai-studio-crmpersonalcero-c4c0d8e9-24b3-4492-856e-4554aeab5492`** (no la "(default)"). El script tiene que apuntar a esa base.

**Cambio respecto de la propuesta:** el script escribe **solo** en `paf_pedidos_alta`. No toca la ficha del cliente: el CRM ya tiene sus fichas en `projects` y lee el resultado desde el pedido. Así el script toca una sola colección.

**1. `paf_pedidos_alta/{clienteId}`.** Lo crea el CRM; el script lo registra y lo completa.

**Cambio (02/11/2026, a pedido de Juan): el ID y el link de Tally los asigna el CRM al instante**, para que Juan mande el formulario sin esperar al script. El ID del documento es el `clienteId`, así no se puede repetir. El CRM lleva un contador en `settings/paf_ids` (`ultimoReal`, `ultimoPrueba`).
```
Lo escribe el CRM:
{ projectId, clienteId,          // PAF-002… o PAF-PRUEBA-00N si prueba == true
  enlaceFormulario,              // https://tally.so/r/2jXEVg?cliente_id=<clienteId>
  estudio, contacto, email, zonaHoraria, prueba: bool,
  estado: "pendiente", creadoEn, actualizadoEn }      // fechas en ISO 8601

Lo completa el script, en el MISMO documento:
{ estado: "registrado" | "error",
  error?,                        // texto corto si estado == "error"
  alta: { estado, carpetaInterna, carpetaCompartida, ficha, fechaRespuesta, error },
  actualizadoEn }
```
- El script toma los pedidos con `estado == "pendiente"` y agrega la fila en la pestaña `Clientes` **con ese mismo `clienteId`** (no genera uno nuevo) y `ENLACE_FORMULARIO` = `enlaceFormulario`. Después escribe `estado: "registrado"`.
- Cuando el estudio responde Tally y se crean las carpetas, actualiza el bloque `alta` del mismo pedido (URLs completas de Drive).
- Si el ID ya existe en la Sheet con otro estudio: `estado: "error"` y `error`. Juan corrige y el CRM reescribe ese pedido o crea otro con un ID nuevo.
- Para no chocar: desde ahora los IDs se crean solo desde el CRM, no desde el menú PAF de la Sheet.
- Nunca reutilizar un `clienteId`. Juan envía el enlace por su canal; nadie manda mensajes automáticos.

**2. Ficha privada del cliente:** es `projects/{projectId}` en el CRM (ya existía). El CRM guarda ahí `pafClienteId`, tareas, entregas y el borrador del portal. **El script no la toca.**

**3. Vista del cliente** (`paf_portal/{clienteId}`). Solo contiene lo que Juan decide publicar.
```
{ estudio, emailsAutorizados: [..], hitoVisible, resumenVisible,
  enlaces: { carpeta, materiales, resultados, web?, asana? },
  tareas: [...publicadas], entregas: [...publicadas], proximaReunion, actualizadoEn }
```
Nunca copiar acá notas internas, la ficha privada, respuestas de Tally ni la carpeta interna.

Implementado así: `paf_portal/{clienteId}` = `{ clienteId, estudio, emailsAutorizados, hitoVisible (1–5), resumenVisible, enlaces: { carpeta?, materiales?, resultados?, web?, asana? }, tareas, entregas, proximaReunion: { fecha, hora? } | null, actualizadoEn }`. Lo publica solo el CRM. El estudio entra en `/portal` con Google; las reglas solo le dejan leer el suyo. Su "Terminé" crea `paf_portal/{clienteId}/avisos/{autoId}` = `{ tareaId, email, creadoEn }` y nada más; la aprobación la registra Juan en el CRM con fecha y canal. **El script no escribe en `paf_portal`.**

**Autenticación del script:** escribe en Firestore con la cuenta de Google de Juan (OAuth del propio Apps Script). No hay que crear ni guardar claves secretas en el CRM.

## Reglas que no se negocian

- **Seguridad real, no visual.** El portal del cliente necesita inicio de sesión propio (Firebase Auth con Google, con el mismo correo con el que se comparte la carpeta) y **reglas de Firestore** que solo dejen leer `paf_portal/{id}` si el correo del usuario está en `emailsAutorizados`. La ficha privada y los pedidos: solo Juan. El código de acceso o PIN actual del CRM sirve para Juan, **no** para clientes.
- **Antes de cambiar nada, revisar las reglas actuales de Firestore.** Si hoy la base está abierta o depende de un código compartido, resolverlo antes de cargar datos de clientes.
- **Los archivos quedan en Drive.** El CRM y el portal muestran enlaces; no copian archivos.
- **El cliente completa una tarea solo cuando Juan la habilitó.** "Terminé" no la aprueba; la aprobación la confirma Juan y queda registrada con fecha y canal.
- **No enviar mensajes, invitaciones ni correos a clientes de forma automática.** Las reuniones se crean en el Calendar de Juan; la invitación la manda él.
- **Asana es la herramienta de la CM** (hermana de Juan). El portal solo enlaza; no se sincronizan piezas.
- **Probar con dos clientes de prueba** que no puedan ver datos del otro, incluso pegando la URL o el ID, antes de usarlo con clientes reales.

## Orden sugerido

1. **Relevar el repositorio:** modelo de datos en Firestore, autenticación actual, reglas de seguridad, pantalla de clientes. Mostrarle a Juan qué hay y qué falta antes de programar.
2. **Asegurar Firebase:** autenticación y reglas, y separar privado de público.
3. **Alta desde el CRM:** formulario que crea el pedido y ficha que muestra estado y enlaces. Del lado de Google, la otra sesión adapta el script para leer los pedidos y devolver resultados.
4. **Tareas, entregas, aprobaciones y reuniones** en la ficha del cliente.
5. **Portal del cliente**, alimentado solo por `paf_portal`.

## Referencias

La especificación visual del portal y del panel de Juan está en el proyecto de entrega: `01_MI_GESTION/plataforma-cliente/PLATAFORMA_CLIENTE_ESTRUCTURA_Y_FUNCIONAMIENTO.pdf`. Los 5 hitos de Presencia que muestra el portal son: 1 Nos organizamos · 2 Definimos el foco · 3 Acordamos el mensaje · 4 Lo llevamos a tus canales · 5 Revisamos y cerramos. Adquisición y Conversión todavía no van en el portal.
