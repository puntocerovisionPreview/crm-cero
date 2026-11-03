# Apps Script: registrar los pedidos de alta del CRM

Para pegarle a la extensión de Chrome (o hacerlo a mano). Revisado el 03/11/2026: los pedidos PAF-PRUEBA-003 y PAF-005 a PAF-008 están en `pendiente` en Firestore y no tienen fila en `Clientes`.

---

## Pedido para la extensión

En el Apps Script **"PAF — Alta de clientes"**. Se abre desde la Sheet "Formulario de arranque — datos para organizarnos" → Extensiones → Apps Script.

**Objetivo:** que los clientes creados en el CRM .CERO queden como "venta registrada" en la pestaña `Clientes`, así cuando responden Tally se crean sus carpetas. No cambies nada del flujo que ya existe.

1. **Antes de tocar nada**, leé el script actual y anotá:
   - el texto exacto de la columna de estado (ESTADO_ALTA o como se llame) que el script considera "venta registrada" (el mismo que pone el menú PAF al registrar un estudio);
   - los nombres exactos de las columnas de la pestaña `Clientes` para: ID, estudio, contacto, email del cliente, zona horaria, estado del alta y enlace del formulario.
2. En **Configuración del proyecto**, activá "Mostrar el archivo de manifiesto appsscript.json". En `appsscript.json` → `oauthScopes`, **agregá** estos permisos sin sacar los que ya están:
   - `https://www.googleapis.com/auth/datastore`
   - `https://www.googleapis.com/auth/script.external_request` (si no está)
   - Si el manifiesto no tenía `oauthScopes`, no lo crees solo con estos dos: decímelo antes, porque dejaría sin permisos a lo que ya anda.
3. Creá un archivo nuevo **`PedidosCRM.gs`** y pegá el código de abajo.
   - Ajustá `ESTADO_REGISTRADO` y el objeto `COLUMNAS` con lo que anotaste en el paso 1.
   - No modifiques las otras funciones del script.
4. Guardá y ejecutá **`procesarPedidosCRM`** una vez a mano. Aceptá los permisos con puntocerovision@gmail.com.
5. Revisá:
   - en `Clientes` tienen que aparecer filas para PAF-PRUEBA-003, PAF-005, PAF-006, PAF-007 y PAF-008 (si alguna ya estaba, no se duplica);
   - en el registro de ejecución tiene que decir cuántos registró y si hubo errores.
6. En **Activadores**, creá uno de tiempo: función `procesarPedidosCRM`, cada 5 minutos.
7. Contame qué texto usaste en `ESTADO_REGISTRADO`, qué columnas y qué dijo la ejecución.

```javascript
// ===== Pedidos de alta que llegan desde el CRM .CERO =====
// El CRM crea paf_pedidos_alta/{ID} con estado "pendiente". Esto agrega la fila en Clientes
// con ESE MISMO ID (no genera uno nuevo) y marca el pedido "registrado" (o "error" con el motivo).
// Solo escribe en paf_pedidos_alta: no toca ninguna otra colección del CRM.

const FS_PROYECTO = 'fabled-fold-lt8c4';
const FS_BASE = 'ai-studio-crmpersonalcero-c4c0d8e9-24b3-4492-856e-4554aeab5492';
const FS_URL = 'https://firestore.googleapis.com/v1/projects/' + FS_PROYECTO + '/databases/' + FS_BASE + '/documents';
const HOJA_CLIENTES = 'Clientes';

// AJUSTAR con el script real: el texto que cuenta como "venta registrada"
const ESTADO_REGISTRADO = 'Registrado';
// AJUSTAR con los encabezados reales de la pestaña Clientes
const COLUMNAS = {
  id: 'ID',
  estudio: 'ESTUDIO',
  contacto: 'CONTACTO',
  email: 'EMAIL_CLIENTE',
  zonaHoraria: 'ZONA_HORARIA',
  estado: 'ESTADO_ALTA',
  enlace: 'ENLACE_FORMULARIO',
};

function fsFetch_(url, opciones) {
  const r = UrlFetchApp.fetch(url, Object.assign({
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    contentType: 'application/json',
    muteHttpExceptions: true,
  }, opciones || {}));
  if (r.getResponseCode() >= 300) throw new Error('Firestore ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText() || '{}');
}

function valor_(campo) {
  if (!campo) return '';
  if (campo.stringValue !== undefined) return campo.stringValue;
  if (campo.booleanValue !== undefined) return campo.booleanValue;
  if (campo.integerValue !== undefined) return campo.integerValue;
  return '';
}

function procesarPedidosCRM() {
  // Que no corran dos a la vez (activador + ejecución a mano)
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const res = fsFetch_(FS_URL + ':runQuery', {
      method: 'post',
      payload: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'paf_pedidos_alta' }],
        where: { fieldFilter: { field: { fieldPath: 'estado' }, op: 'EQUAL', value: { stringValue: 'pendiente' } } },
        limit: 20,
      } }),
    });
    const pedidos = (res || []).filter(function (x) { return x.document; });
    if (!pedidos.length) { console.log('Sin pedidos pendientes'); return; }

    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_CLIENTES);
    if (!hoja) throw new Error('No existe la pestaña ' + HOJA_CLIENTES);
    const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
    const col = {};
    Object.keys(COLUMNAS).forEach(function (k) {
      col[k] = encabezados.indexOf(COLUMNAS[k]);
      if (col[k] < 0) throw new Error('Falta la columna "' + COLUMNAS[k] + '" en ' + HOJA_CLIENTES);
    });
    const ids = hoja.getLastRow() > 1
      ? hoja.getRange(2, col.id + 1, hoja.getLastRow() - 1, 1).getValues().map(function (f) { return String(f[0]).trim(); })
      : [];

    let registrados = 0, errores = 0;
    pedidos.forEach(function (p) {
      const doc = p.document;
      const f = doc.fields || {};
      const id = String(valor_(f.clienteId) || doc.name.split('/').pop()).trim();
      const ahora = new Date().toISOString();
      try {
        if (!/^PAF-(PRUEBA-)?\d{3,}$/.test(id)) throw new Error('ID inválido: ' + id);
        if (ids.indexOf(id) < 0) {
          const fila = encabezados.map(function () { return ''; });
          fila[col.id] = id;
          fila[col.estudio] = valor_(f.estudio);
          fila[col.contacto] = valor_(f.contacto);
          fila[col.email] = valor_(f.email);
          fila[col.zonaHoraria] = valor_(f.zonaHoraria);
          fila[col.estado] = ESTADO_REGISTRADO;
          fila[col.enlace] = valor_(f.enlaceFormulario);
          hoja.appendRow(fila);
          ids.push(id);
        }
        actualizarPedido_(doc.name, { estado: 'registrado', actualizadoEn: ahora });
        registrados++;
      } catch (e) {
        actualizarPedido_(doc.name, { estado: 'error', error: String(e.message || e).slice(0, 300), actualizadoEn: ahora });
        errores++;
      }
    });
    console.log('Pedidos del CRM: ' + registrados + ' registrados, ' + errores + ' con error');
  } finally {
    lock.releaseLock();
  }
}

function actualizarPedido_(nombreDoc, campos) {
  const fields = {};
  Object.keys(campos).forEach(function (k) { fields[k] = { stringValue: String(campos[k]) }; });
  const mascara = Object.keys(campos).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  fsFetch_('https://firestore.googleapis.com/v1/' + nombreDoc + '?' + mascara, { method: 'patch', payload: JSON.stringify({ fields: fields }) });
}
```

## Después

- La respuesta de Tally de PAF-008 que ya llegó con "Sin venta registrada" puede que no se vuelva a procesar. Para probar, mandá el formulario de nuevo con el mismo link.
- Desde ahora, los IDs se crean **solo desde el CRM** (no desde el menú PAF), para que no se repitan.
- Que el script devuelva las carpetas al CRM: ver la parte 2, abajo.

---

# Parte 2: que el script devuelva las carpetas al CRM

Ya aplicada la parte 1 (los pedidos quedan en `registrado`). Con esto, cuando el script crea las carpetas de un estudio, el CRM las recibe solo: marca "Carpetas listas" en el alta y agrega "Tu carpeta" y "Materiales" a los accesos del portal. No hace falta pegar links a mano.

## Pedido para la extensión

En el mismo Apps Script **"PAF — Alta de clientes"**:

1. **Antes de tocar nada**, en la pestaña `Clientes` anotá los nombres exactos de las columnas de: ID, estado del alta, carpeta interna, carpeta compartida, ficha, fecha de respuesta y error del alta.
2. En el archivo **`PedidosCRM.gs`** (el de la parte 1), pegá al final el código de abajo y ajustá `COLUMNAS_ALTA` con lo que anotaste. No modifiques nada más.
3. Si el manifiesto `appsscript.json` no tiene `https://www.googleapis.com/auth/drive` ni `https://www.googleapis.com/auth/drive.readonly`, agregá `https://www.googleapis.com/auth/drive.readonly` (sirve para encontrar la subcarpeta Materiales). Si ya tiene alguno de los dos, no hace falta.
4. Ejecutá **`devolverCarpetasAlCRM`** una vez a mano y aceptá los permisos.
5. En **Activadores**, creá uno de tiempo: función `devolverCarpetasAlCRM`, cada 5 minutos.
6. Contame qué dijo la ejecución: cuántos devolvió y si hubo errores.

```javascript
// ===== Devuelve al CRM las carpetas que creó el alta =====
// Escribe SOLO el bloque "alta" de paf_pedidos_alta/{ID}, y solo si ese pedido existe
// (las altas viejas hechas desde la Sheet se ignoran). No toca nada más del CRM.

// AJUSTAR con los encabezados reales de la pestaña Clientes
const COLUMNAS_ALTA = {
  id: 'ID',
  estado: 'ESTADO_ALTA',
  carpetaInterna: 'CARPETA_INTERNA',
  carpetaCompartida: 'CARPETA_COMPARTIDA',
  ficha: 'FICHA',
  fechaRespuesta: 'FECHA_RESPUESTA',
  error: 'ERROR_ALTA',
};

/**
 * Link de la subcarpeta de materiales dentro de la carpeta compartida ('' si no está).
 * La real se llama "02_Materiales": acepta cualquier nombre que termine en "Materiales".
 */
function linkMateriales_(urlCompartida) {
  try {
    const m = String(urlCompartida).match(/folders\/([\w-]{10,})/);
    if (!m) return '';
    const subs = DriveApp.getFolderById(m[1]).getFolders();
    while (subs.hasNext()) {
      const f = subs.next();
      if (/materiales$/i.test(f.getName().trim())) return f.getUrl();
    }
    return '';
  } catch (e) { return ''; }
}

function devolverCarpetasAlCRM() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA_CLIENTES);
    const datos = hoja.getDataRange().getValues();
    const enc = datos.shift().map(function (h) { return String(h).trim(); });
    const c = {};
    Object.keys(COLUMNAS_ALTA).forEach(function (k) {
      c[k] = enc.indexOf(COLUMNAS_ALTA[k]);
      if (c[k] < 0 && (k === 'id' || k === 'carpetaCompartida')) throw new Error('Falta la columna "' + COLUMNAS_ALTA[k] + '" en ' + HOJA_CLIENTES);
    });
    const celda = function (fila, k) { return c[k] < 0 ? '' : fila[c[k]]; };
    // No repetir lo que ya se mandó (se recuerda por ID + carpeta)
    const props = PropertiesService.getScriptProperties();
    const enviados = JSON.parse(props.getProperty('CRM_CARPETAS_ENVIADAS') || '{}');

    let devueltos = 0, errores = 0;
    datos.forEach(function (fila) {
      const id = String(celda(fila, 'id')).trim();
      const compartida = String(celda(fila, 'carpetaCompartida') || '').trim();
      if (!/^PAF-(PRUEBA-)?\d{3,}$/.test(id) || !compartida) return;
      if (enviados[id] === compartida) return;
      const fecha = celda(fila, 'fechaRespuesta');
      const alta = { mapValue: { fields: {
        estado: { stringValue: String(celda(fila, 'estado') || '') },
        carpetaInterna: { stringValue: String(celda(fila, 'carpetaInterna') || '') },
        carpetaCompartida: { stringValue: compartida },
        materiales: { stringValue: linkMateriales_(compartida) },
        ficha: { stringValue: String(celda(fila, 'ficha') || '') },
        fechaRespuesta: { stringValue: fecha ? new Date(fecha).toISOString() : '' },
        error: { stringValue: String(celda(fila, 'error') || '') },
      } } };
      try {
        fsFetch_(FS_URL + '/paf_pedidos_alta/' + encodeURIComponent(id) + '?updateMask.fieldPaths=alta&currentDocument.exists=true', {
          method: 'patch', payload: JSON.stringify({ fields: { alta: alta } }),
        });
        enviados[id] = compartida;
        devueltos++;
      } catch (e) {
        // 404: el pedido no existe en el CRM (alta vieja hecha desde la Sheet): se ignora
        if (String(e.message).indexOf('Firestore 404') !== 0) { errores++; console.warn(id + ': ' + e.message); }
        else enviados[id] = compartida;
      }
    });
    props.setProperty('CRM_CARPETAS_ENVIADAS', JSON.stringify(enviados));
    console.log('Carpetas devueltas al CRM: ' + devueltos + (errores ? ', con error: ' + errores : ''));
  } finally {
    lock.releaseLock();
  }
}
```

## Después

- En el CRM, la ficha del estudio pasa a "Carpetas listas" y en Archivos aparecen solos "Tu carpeta" y "Materiales". Si el portal está publicado, el cliente los ve en segundos.
- La carpeta interna y la ficha nunca se publican: el CRM las bloquea.
