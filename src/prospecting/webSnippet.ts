/**
 * Fragmento para pegar en somospuntocero.online/auditoria: manda una copia de la auto
 * auditoría al CRM. Va dentro del evento "submit", justo después del bucle que agrega
 * las respuestas q1..q15 al FormData (fd) y antes de "function advanceToResults()".
 * Si el CRM no responde, el quiz sigue igual y el mail se envía como siempre.
 */
export function buildWebSnippet(crmOrigin: string): string {
  return `        // .Cero CRM: copia de la auto auditoría al CRM (si falla, el quiz sigue igual)
        try {
          var crmData = {};
          fd.forEach(function (value, key) { crmData[key] = String(value); });
          crmData.ref = new URLSearchParams(window.location.search).get('p') || '';
          fetch('${crmOrigin.replace(/\/$/, '')}/api/prospects/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(crmData),
            keepalive: true
          }).catch(function () {});
        } catch (crmErr) {}
`;
}
