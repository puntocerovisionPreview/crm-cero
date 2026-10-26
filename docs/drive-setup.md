# Conectar el Drive del estudio

Esta guía corresponde a la fase 1: preparación automática de proyectos Web. Las carpetas quedan en el Drive de **puntocerovision@gmail.com**. No usa una cuenta de servicio para Drive.

## 1. Elegir el proyecto de Google Cloud

Entrá a Google Cloud con puntocerovision@gmail.com y elegí el proyecto donde vas a configurar OAuth. Puede ser el mismo proyecto del CRM, si tenés permiso para administrarlo.

Si aparece «oauthconfig.testusers.get» o «Necesitas acceso adicional», falta permiso de configuración OAuth. El administrador debe otorgarte **Editor de configuración de OAuth**. Si una política de la organización bloquea el acceso, también debe revisarla. No hace falta modificar Firebase ni cambiar sus archivos de configuración.

También podés crear un proyecto propio para la conexión con Drive. En ese caso, habilitá las APIs y creá las credenciales en ese proyecto; el CRM sigue usando su base Firebase actual. No reutilices ni borres las credenciales de inicio de sesión de Firebase.

## 2. Habilitar las APIs

En «APIs y servicios → Biblioteca», buscá **Google Drive API** y tocá «Habilitar». Para elegir los archivos finales, habilitá también **Google Picker API**.

## 3. Configurar la autorización de Google

En «Google Auth Platform»:

1. En «Desarrollo de la marca», usá el nombre **.Cero · Drive** y tu correo como contacto.
2. En «Público», elegí **Externo** si usás Gmail personal. Para las primeras pruebas agregá puntocerovision@gmail.com como usuario de prueba.
3. En «Acceso a los datos», agregá `https://www.googleapis.com/auth/drive.file`, `openid` y `https://www.googleapis.com/auth/userinfo.email` si no están incluidos.

El permiso drive.file alcanza para crear las carpetas y compartirlas. Para archivos que subas vos o el cliente desde Drive, el selector de Google te permite elegir los archivos concretos que la app podrá copiar o mover. No da acceso general a todo tu Drive.

## 4. Crear el cliente OAuth

En «Clientes → Crear cliente», elegí **Aplicación web** y llamalo **.Cero Drive servidor**.

En «URIs de redireccionamiento autorizados», agregá la dirección pública de tu CRM seguida de:

```text
/api/drive/callback
```

Ejemplo: si abrís el CRM en `https://mi-crm.run.app`, la dirección completa es `https://mi-crm.run.app/api/drive/callback`. Usá tu dirección real. Copiá el ID y el secreto del cliente directamente a los Secrets; no los pegues en el chat ni en archivos del repositorio.

## 5. Cargar los Secrets en AI Studio / Cloud Run

| Nombre | Qué guardar |
| --- | --- |
| `APP_URL` | La dirección pública exacta del CRM, con `https://`. |
| `GOOGLE_OAUTH_CLIENT_ID` | ID del cliente OAuth que acabás de crear. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Secreto de ese cliente OAuth. |
| `GOOGLE_OAUTH_ENCRYPTION_KEY` | Una clave aleatoria de 32 bytes, codificada en base64. |
| `GOOGLE_PICKER_API_KEY` | Clave de API para Google Picker, explicada abajo. |

Para generar la clave de cifrado, quien publique la app puede ejecutar en su terminal:

```sh
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
```

Guardá el resultado únicamente en el Secret y conservá una copia segura. No cambies esa clave mientras Drive esté conectado: el servidor la necesita para leer la autorización guardada.

Para Picker, creá una **clave de API** en el mismo proyecto que el cliente OAuth. Restringila a Google Picker API y, como restricción de sitio web, a `https://TU-DOMINIO/*`. Esta clave es pública por diseño; el secreto OAuth y el refresh token nunca se envían al navegador. Picker recibe un token de acceso temporal con permiso drive.file.

Publicá la nueva versión con estas variables. El servidor necesita su acceso habitual a Firestore; esto es independiente de la cuenta OAuth de Drive.

## 6. Conectar

1. En el CRM, abrí **Ajustes → Automatizaciones → Google Drive**.
2. Tocá **Conectar Google Drive**.
3. Elegí **puntocerovision@gmail.com** y aceptá los permisos.
4. Al volver, debe aparecer **Conectado con puntocerovision@gmail.com**.

Si Google rechaza la dirección de retorno, compará el URI autorizado con `APP_URL` + `/api/drive/callback`: deben coincidir exactamente.

En modo OAuth «Prueba», una autorización con acceso a Drive puede vencer a los 7 días. Para el uso diario revisá la publicación de OAuth en «Público» y los requisitos que Google muestre para tu aplicación. Si vence o revocás el acceso, tocá **Volver a conectar**.

## 7. Probar con un cliente de prueba

La prueba real crea carpetas y envía las invitaciones de Google al correo que cargues. Usá otra cuenta tuya o un destinatario de prueba acordado.

1. Creá un proyecto de Desarrollo web llamado «Prueba Drive» con ese correo.
2. En su ficha, revisá **Carpetas de Drive** y el estado de la preparación.
3. En tu Drive debe haber `Clientes .Cero/Prueba Drive – Desarrollo web` y cuatro subcarpetas: Identidad, Proyectos y fotografías, Textos y contenido y Entregables.
4. Abrí el panel con el enlace del mensaje de bienvenida. Revisá «Tus carpetas» y los botones de los materiales.
5. Entrá a Drive con la cuenta del cliente de prueba: las primeras tres permiten editar y Entregables permite leer. No se comparte la carpeta raíz ni se habilita acceso público.
6. Tocá «Reintentar preparación» dos veces: deben mantenerse las mismas carpetas, el mismo panel, tres tareas y una propuesta de reunión.
7. Confirmá fecha y hora de la propuesta de arranque en la agenda. Con Google Calendar configurado, el cron la sincroniza. No se invita automáticamente al cliente a una reunión sin coordinar.
8. Cambiá la etapa del panel a «Publicada». Se crean tareas a 30 y 90 días. En la ficha, elegí archivos finales con Google Picker, revisá la lista y confirmá si querés copiarlos o moverlos a Entregables. Hasta confirmar, no se toca ningún archivo.

El mensaje de bienvenida solo se copia o abre en WhatsApp. Vos decidís cuándo enviarlo.

## 8. Probar pendientes y recuperación

- Sin Drive conectado, creá otro proyecto Web: el panel, las tareas y la propuesta de reunión deben existir. Las acciones de Drive quedan pendientes.
- Conectá Drive y tocá «Reintentar preparación» desde la ficha.
- Sin correo del cliente, se crean las carpetas pero no se comparten. Guardá el correo y reintentá.
- Si falla una parte, las que ya se completaron se conservan. El detalle está en la ficha y los errores aparecen en Ajustes → Estado de la app.
- Los presupuestos aceptados encolan la preparación Web. El reloj existente debe llamar a `/api/cron/frequent` con su secreto, cada 10–15 minutos. También podés iniciarla desde la ficha.
- La automatización solo se inicia sola para altas nuevas y presupuestos aceptados a partir de esta versión. Para un proyecto anterior usá «Preparar proyecto Web».
- Si el correo ya recibió acceso, cambiarlo queda bloqueado: la fase 1 no revoca automáticamente permisos de personas. La gestión de cambio de destinatario requiere revisar los accesos en Drive.

## Datos y seguridad

El refresh token se guarda cifrado en `settings/integrations_private`. La clave de cifrado vive en Secrets. Las reglas actuales autorizan a las dos cuentas dueñas del CRM a leer y escribir settings; el documento no es exclusivo del servidor. La app no incluye la credencial en sus respuestas ni en sus respaldos/exportaciones. La desconexión revoca el acceso y conserva carpetas y enlaces.

El panel sigue protegido por su enlace con token. Drive exige la cuenta autorizada para abrir cada carpeta. No se agregó login por correo al panel.

## Alcance de esta fase

Incluye receta Web fija, reintentos, registro por acción, carpetas, permisos, panel, materiales, tareas, propuesta de arranque, bienvenida, entrega confirmada y seguimientos. El editor genérico, simulación de recetas, recetas PAF y Finalizar corresponden a la fase 2.

Referencias: [OAuth de servidor](https://developers.google.com/identity/protocols/oauth2/web-server), [permisos de Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [compartir carpetas](https://developers.google.com/workspace/drive/api/guides/manage-sharing).
