# Portal PAF · Fase 4: planes y propuestas (03/11/2026)

Lo que necesita una decisión de Juan o un cambio en otro proyecto. Nada de esto está aplicado.

---

## 1. Apps Script: que los altas del CRM creen las carpetas

### Por qué hace falta
Hoy el CRM da el ID (`PAF-002`…) y el link de Tally al instante, y guarda el pedido en `paf_pedidos_alta/{clienteId}`.
El Apps Script **solo crea carpetas para estudios que están en la pestaña `Clientes`** de la Sheet.
Si nadie agrega esa fila, cuando el estudio responde Tally **no se crean las carpetas**.

Hasta que esto se adapte, Juan tiene que agregar la fila a mano (ID, ESTUDIO, EMAIL_CLIENTE…) con el mismo ID que dio el CRM.

### Plan (para la sesión de Google, proyecto "METODO PAF - ENTREGA DE SERVICIO")
1. Agregar el permiso de Firestore al script (`appsscript.json` → `oauthScopes`):
   `https://www.googleapis.com/auth/datastore`, además de los que ya tenga (Sheets, Drive, `script.external_request`).
2. Nueva función `procesarPedidosCRM()` que corre cada 5 minutos (junto con la actual):
   - lee los pedidos con `estado == "pendiente"`;
   - si el ID **no** está en `Clientes`, agrega la fila con ESE ID (no genera uno nuevo);
   - marca el pedido `estado: "registrado"` (o `"error"` con el motivo).
3. El resto del flujo **no cambia**: el estudio responde Tally → el script crea las carpetas → comparte solo la del estudio.
4. Opcional, porque hoy Juan pega los links a mano: `devolverCarpetasAlCRM()` copia CARPETA_INTERNA, CARPETA_COMPARTIDA, FICHA y FECHA_RESPUESTA al bloque `alta` del pedido. Con eso aparecen solas en la ficha del CRM.
5. Desde ahora los IDs se crean **solo desde el CRM** (no desde el menú PAF), para que no se repitan.

### Código propuesto (revisarlo contra el script real antes de pegarlo)
```javascript
// ===== Pedidos de alta que llegan desde el CRM .CERO =====
// Base: proyecto fabled-fold-lt8c4, base ai-studio-crmpersonalcero-c4c0d8e9-24b3-4492-856e-4554aeab5492
const FS_PROYECTO = 'fabled-fold-lt8c4';
const FS_BASE = 'ai-studio-crmpersonalcero-c4c0d8e9-24b3-4492-856e-4554aeab5492';
const FS_URL = `https://firestore.googleapis.com/v1/projects/${FS_PROYECTO}/databases/${FS_BASE}/documents`;
const HOJA_CLIENTES = 'Clientes';
// TODO: usar el mismo texto que pone hoy el menú PAF al registrar un estudio
const ESTADO_REGISTRADO = 'Registrado';

function fsFetch_(url, opciones) {
  const r = UrlFetchApp.fetch(url, Object.assign({
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    contentType: 'application/json',
    muteHttpExceptions: true,
  }, opciones || {}));
  if (r.getResponseCode() >= 300) throw new Error('Firestore ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText() || '{}');
}

const valor_ = (campo) => campo ? (campo.stringValue ?? campo.booleanValue ?? campo.integerValue ?? '') : '';

function procesarPedidosCRM() {
  const res = fsFetch_(`${FS_URL}:runQuery`, {
    method: 'post',
    payload: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'paf_pedidos_alta' }],
      where: { fieldFilter: { field: { fieldPath: 'estado' }, op: 'EQUAL', value: { stringValue: 'pendiente' } } },
      limit: 20,
    } }),
  });
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_CLIENTES);
  const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const col = (nombre) => encabezados.indexOf(nombre);
  const idsExistentes = hoja.getLastRow() > 1
    ? hoja.getRange(2, col('ID') + 1, hoja.getLastRow() - 1, 1).getValues().map((f) => String(f[0]).trim())
    : [];

  res.filter((x) => x.document).forEach(({ document: doc }) => {
    const f = doc.fields || {};
    const id = String(valor_(f.clienteId)).trim();
    const ahora = new Date().toISOString();
    try {
      if (!/^PAF-(PRUEBA-)?\d{3,}$/.test(id)) throw new Error('ID inválido');
      if (!idsExistentes.includes(id)) {
        const fila = encabezados.map(() => '');
        fila[col('ID')] = id;
        fila[col('ESTUDIO')] = valor_(f.estudio);
        fila[col('CONTACTO')] = valor_(f.contacto);
        fila[col('EMAIL_CLIENTE')] = valor_(f.email);
        fila[col('ZONA_HORARIA')] = valor_(f.zonaHoraria);
        fila[col('ESTADO_ALTA')] = ESTADO_REGISTRADO;
        fila[col('ENLACE_FORMULARIO')] = valor_(f.enlaceFormulario);
        hoja.appendRow(fila);
        idsExistentes.push(id);
      }
      actualizarPedido_(doc.name, { estado: 'registrado', actualizadoEn: ahora });
    } catch (e) {
      actualizarPedido_(doc.name, { estado: 'error', error: String(e.message || e).slice(0, 300), actualizadoEn: ahora });
    }
  });
}

function actualizarPedido_(nombreDoc, campos) {
  const fields = {};
  Object.keys(campos).forEach((k) => { fields[k] = { stringValue: String(campos[k]) }; });
  const mascara = Object.keys(campos).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  fsFetch_(`https://firestore.googleapis.com/v1/${nombreDoc}?${mascara}`, { method: 'patch', payload: JSON.stringify({ fields }) });
}

// Opcional: devuelve las carpetas al CRM (aparecen solas en la ficha)
function devolverCarpetasAlCRM() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_CLIENTES);
  const datos = hoja.getDataRange().getValues();
  const enc = datos.shift();
  const c = (n) => enc.indexOf(n);
  datos.forEach((fila) => {
    const id = String(fila[c('ID')]).trim();
    if (!/^PAF-(PRUEBA-)?\d{3,}$/.test(id) || !fila[c('CARPETA_COMPARTIDA')]) return;
    const alta = { mapValue: { fields: {
      estado: { stringValue: String(fila[c('ESTADO_ALTA')] || '') },
      carpetaInterna: { stringValue: String(fila[c('CARPETA_INTERNA')] || '') },
      carpetaCompartida: { stringValue: String(fila[c('CARPETA_COMPARTIDA')] || '') },
      ficha: { stringValue: String(fila[c('FICHA')] || '') },
      fechaRespuesta: { stringValue: fila[c('FECHA_RESPUESTA')] ? new Date(fila[c('FECHA_RESPUESTA')]).toISOString() : '' },
      error: { stringValue: String(fila[c('ERROR_ALTA')] || '') },
    } } };
    try {
      fsFetch_(`${FS_URL}/paf_pedidos_alta/${encodeURIComponent(id)}?updateMask.fieldPaths=alta&currentDocument.exists=true`, {
        method: 'patch', payload: JSON.stringify({ fields: { alta } }),
      });
    } catch (e) { /* el pedido no existe en el CRM (alta vieja hecha desde la Sheet): se ignora */ }
  });
}
```

**Ojo:** el script escribe con la cuenta de Google de Juan. Esas escrituras **no pasan por las reglas de Firestore**, así que que el script solo toque `paf_pedidos_alta` depende de que el código esté bien escrito. Las reglas no lo frenan.

---

## 2. Portal viejo: quién lo usa y cómo apagarlo

### Situación (revisado el 03/11/2026, solo lectura)
| Estudio | Link de alumno (`/alumno/…`) | Panel viejo | Contenido |
|---|---|---|---|
| adrede diseño & arquitectura | Sí | Activo | Vacío (sin objetivos, tareas ni piezas) |
| Remodelante | Sí | Activo | 3 objetivos y 3 tareas |
| afa | No | **Panel web** (cliente Web, no PAF) | Seguimiento de la web |

### Qué migrar
- **Objetivos de la semana:** no hace falta. El portal nuevo usa los mismos.
- **Contenido para aprobar:** no hace falta. El portal nuevo copia las piezas del mismo panel.
- **Tareas del panel viejo** (Remodelante, 3): pasarlas a "Tareas del estudio" del portal nuevo. Las hechas, como aprobadas (canal: Portal); las pendientes, como habilitadas. Se hace con un botón "Pasar tareas del portal anterior", con confirmación de Juan.
- **Plan de 3 meses, sesiones y horas** del portal del alumno: el portal nuevo todavía no lo muestra. Hay que decidir si se suma (Fase 4.8) o se deja de mostrar.

### Pasos para apagarlo (cuando Juan confirme)
1. Publicar el portal nuevo de cada estudio PAF activo (adrede, Remodelante), con su correo.
2. Migrar las tareas viejas (Remodelante).
3. Avisarles el link nuevo (lo manda Juan).
4. Una semana después: en cada ficha, Configuración → Portal anterior → **Desactivar** el link de alumno.
5. **El panel de afa NO se apaga:** los clientes Web siguen usando `/panel/…`.
6. Cuando ningún PAF lo use, sacar "Portal anterior" de la ficha PAF.

---

## 3. Rol limitado para la community manager (propuesta)

**Necesita decisiones:** su correo, qué puede ver y aprobar, y tocar las reglas de Firestore.

Hoy el CRM tiene dos cuentas con acceso total. Un rol limitado implica:
- **Lo que vería:** solo una pantalla "Contenido" con los estudios y sus piezas (cargar imágenes, texto y fecha, y ver qué aprobó o pidió cambiar cada estudio). Ni pagos, ni notas, ni fichas.
- **Reglas nuevas:** la CM solo puede leer y escribir `client_panels` (únicamente el campo `pieces`) y `content_assets`, y leer `paf_portal` (solo lectura). Todo lo demás le queda cerrado.
- **Login:** su correo en una lista aparte. La app abre directo la pantalla de Contenido.
- **Alternativa más simple:** que siga trabajando en Asana como hoy y Juan sube las piezas aprobadas. No requiere tocar reglas.

**Recomendación:** empezar con la alternativa simple. Hacer el rol cuando la CM cargue piezas todas las semanas.

---

## 4. Aviso por mail al estudio cuando hay algo nuevo (opciones)

Regla: el CRM no manda nada sin que Juan lo decida.

| Opción | Cómo funciona | Pros | Contras |
|---|---|---|---|
| A. **Botón "Avisar por mail"** en la ficha | Juan lo toca y se abre su Gmail con el correo armado ("Tenés 2 tareas nuevas en tu portal" + link) | Juan decide cada envío; sale de su cuenta; no hay que configurar nada | Un paso manual |
| B. **Resumen diario automático** | Una vez por día, si hubo novedades, el servidor manda un mail desde una cuenta de envío | Cero trabajo | Manda solo (va contra la regla actual); hay que configurar el envío (Gmail API o un servicio) y cuidar el spam |
| C. **Automático con interruptor por estudio** | Como B, pero Juan lo activa estudio por estudio | Control fino | Lo mismo que B, más complejo |

**Recomendación:** A, y el mismo botón con WhatsApp ("Avisar por WhatsApp"), que ya es su canal.

---

## 5. Adquisición y Conversión (pendiente de contenido)

El portal ya muestra el recorrido Presencia → Adquisición → Conversión, con los dos últimos bloqueados.
Para habilitarlos, Juan tiene que pasar:
- las etapas de cada pilar (como los 5 hitos de Presencia);
- qué se muestra de campañas (por ejemplo: nombre, estado, inversión, resultados semanales, link a reportes);
- el paso a paso de la web, con el link de preview y qué puede aprobar el estudio.

Con eso se agregan como pilares activos, con su línea de avance, sus plantillas de tareas y sus bloques en el Inicio.
