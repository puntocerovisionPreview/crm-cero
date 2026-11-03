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
- Opcional, más adelante: que el script devuelva las carpetas al CRM (función `devolverCarpetasAlCRM` en `docs/PAF_FASE4_PLANES.md`), así no tenés que pegar los links a mano.
