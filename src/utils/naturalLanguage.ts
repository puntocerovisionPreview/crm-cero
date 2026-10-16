// Natural Language Parser for .Cero CRM v3
// Parses input strings like:
// "Reunión con Martín mañana a las 16hs cobrar 200 USD"
// "Tarea enviar propuesta a Sofia el viernes a las 11:00"
// "Cobro de 350 usd de Juan Perez para el lunes"
// "Gasto 45000 ars hosting servidor hoy"

import { QuickAddType } from '../components/QuickAddModal';
import { getTodayString, addDays } from './storage';

export interface ParsedNaturalLanguage {
  originalText: string;
  cleanTitle: string;
  type: QuickAddType;
  date: string;
  time?: string;
  amount?: number;
  currency?: 'USD' | 'ARS';
  clientName?: string;
  clientPhone?: string;
  notes?: string;
  confidenceScore: number;
}

export function parseNaturalLanguageInput(rawText: string, defaultDate?: string): ParsedNaturalLanguage {
  const baseDateStr = defaultDate || getTodayString();
  let text = rawText.trim();
  let type: QuickAddType = 'tarea';
  let date = baseDateStr;
  let time: string | undefined = undefined;
  let amount: number | undefined = undefined;
  let currency: 'USD' | 'ARS' | undefined = undefined;
  let clientName: string | undefined = undefined;
  let clientPhone: string | undefined = undefined;
  let score = 0;

  if (!text) {
    return {
      originalText: '',
      cleanTitle: '',
      type: 'tarea',
      date: baseDateStr,
      confidenceScore: 0,
    };
  }

  const lower = text.toLowerCase();

  // 1. Detect Type
  if (/\b(reuni[oó]n|meet|junta|cita|llamada|videollamada|zoom|call)\b/i.test(lower)) {
    type = 'reunion';
    score += 2;
  } else if (/\b(cobro|cobrar|ingreso|factura cobrada|pago recibido)\b/i.test(lower)) {
    type = 'ingreso';
    score += 2;
  } else if (/\b(gasto|gastar|pagar|pago de|abono|egreso|compra de)\b/i.test(lower)) {
    type = 'gasto';
    score += 2;
  } else if (/\b(nuevo proyecto|nuevo cliente|proyecto)\b/i.test(lower)) {
    type = 'proyecto';
    score += 2;
  } else if (/\b(objetivo|meta semanal|meta)\b/i.test(lower)) {
    type = 'objetivo';
    score += 2;
  } else if (/\b(tarea|hacer|revisar|enviar|armar|entregar|terminar|llamar a)\b/i.test(lower)) {
    type = 'tarea';
    score += 1;
  }

  // 2. Detect Currency and Amounts (e.g. 200 USD, $200, 50.000 ARS, 150 dolares, 45000)
  const currencyAmountRegex = /(?:(\$|usd|ars|u\$s|us|pesos|d[oó]lares)\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+)\s*(usd|ars|u\$s|us|pesos|d[oó]lares|\$)?/i;
  // Look specifically for money context like "cobrar 200 usd", "$50000", "200 USD"
  const moneyMatch = text.match(/(?:cobrar|pago|monto|total|por|\$)\s*(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(usd|ars|u\$s|us|pesos|d[oó]lares|\$)?/i) ||
                     text.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(usd|ars|u\$s|us|pesos|d[oó]lares)/i) ||
                     text.match(/(\$\s*\d{1,3}(?:[.,]\d{3})*|\$\s*\d+)/i);

  if (moneyMatch) {
    const rawMatch = moneyMatch[0];
    const numMatch = rawMatch.match(/\d{1,3}(?:[.,]\d{3})*|\d+/);
    if (numMatch) {
      const cleanNumStr = numMatch[0].replace(/\./g, '').replace(/,/g, '.');
      const parsedNum = parseFloat(cleanNumStr);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        amount = parsedNum;
        score += 2;
        if (/usd|u\$s|us|d[oó]lares/i.test(rawMatch)) {
          currency = 'USD';
        } else if (/ars|pesos/i.test(rawMatch) || (currency === undefined && parsedNum >= 5000)) {
          currency = 'ARS';
        } else {
          currency = 'USD';
        }
      }
    }
  }

  // 3. Detect Phone Number
  const phoneRegex = /(?:tel[eé]fono|tel|celular|cel|whatsapp|wpp)?\s*[:\s]?\s*(\+?\d[\d\s-]{6,15}\d)/i;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch && phoneMatch[1]) {
    const rawNum = phoneMatch[1].replace(/[\s-]/g, '');
    if (rawNum.length >= 7 && !rawNum.startsWith('202')) {
      clientPhone = rawNum;
      score += 1;
      text = text.replace(phoneMatch[0], '').trim();
    }
  }

  // 4. Detect Client Name (e.g., "con Martín", "para Sofia Gonzalez", "de Estudio Rossi")
  const clientMatch = text.match(/\b(?:con|para|de|cliente:?)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)/i);
  if (clientMatch && clientMatch[1]) {
    const extracted = clientMatch[1].trim();
    // Exclude common date words mistakenly captured
    const excludeWords = ['hoy', 'mañana', 'pasado', 'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    if (!excludeWords.includes(extracted.toLowerCase())) {
      clientName = extracted;
      score += 1;
    }
  }

  // 5. Detect Date Expressions
  const today = new Date();
  
  if (/\bpasado\s+mañana\b/i.test(text)) {
    const d = new Date();
    d.setDate(today.getDate() + 2);
    date = d.toISOString().split('T')[0];
    score += 2;
    text = text.replace(/\b(?:para\s+|de\s+)?pasado\s+mañana\b/gi, '').trim();
  } else if (/\bmañana\b/i.test(text)) {
    const d = new Date();
    d.setDate(today.getDate() + 1);
    date = d.toISOString().split('T')[0];
    score += 2;
    text = text.replace(/\b(?:para\s+|de\s+|el\s+)?mañana\b/gi, '').trim();
  } else if (/\bhoy\b/i.test(text)) {
    date = today.toISOString().split('T')[0];
    score += 1;
    text = text.replace(/\b(?:para\s+|de\s+)?hoy\b/gi, '').trim();
  } else {
    // Days of week: "el lunes", "el viernes", "este jueves", "proximo martes"
    const dayPatterns: Array<{ regex: RegExp; dayNum: number }> = [
      { regex: /(?:el\s+|este\s+|pr[oó]ximo\s+)?\bdomingo\b/i, dayNum: 0 },
      { regex: /(?:el\s+|este\s+|pr[oó]ximo\s+)?\blunes\b/i, dayNum: 1 },
      { regex: /(?:el\s+|este\s+|pr[oó]ximo\s+)?\bmartes\b/i, dayNum: 2 },
      { regex: /(?:el\s+|este\s+|pr[oó]ximo\s+)?\bmi[eé]rcoles\b/i, dayNum: 3 },
      { regex: /(?:el\s+|este\s+|pr[oó]ximo\s+)?\bjueves\b/i, dayNum: 4 },
      { regex: /(?:el\s+|este\s+|pr[oó]ximo\s+)?\bviernes\b/i, dayNum: 5 },
      { regex: /(?:el\s+|este\s+|pr[oó]ximo\s+)?\bs[aá]bado\b/i, dayNum: 6 },
    ];
    for (const { regex, dayNum } of dayPatterns) {
      if (regex.test(text)) {
        const currentDay = today.getDay();
        let diff = dayNum - currentDay;
        if (diff <= 0) diff += 7; // next upcoming day
        const target = new Date();
        target.setDate(today.getDate() + diff);
        date = target.toISOString().split('T')[0];
        score += 2;
        text = text.replace(regex, '').trim();
        break;
      }
    }

    // Direct dates like "el 25 de octubre" or "el 15/10"
    const numDateMatch = text.match(/(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (numDateMatch) {
      const day = parseInt(numDateMatch[1], 10);
      const month = parseInt(numDateMatch[2], 10);
      const year = numDateMatch[3] ? (numDateMatch[3].length === 2 ? 2000 + parseInt(numDateMatch[3], 10) : parseInt(numDateMatch[3], 10)) : today.getFullYear();
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        score += 2;
        text = text.replace(numDateMatch[0], '').trim();
      }
    }
  }

  // 6. Detect Time Expressions (e.g. "a las 16hs", "a las 16:30", "16hs", "4 pm", "11:00")
  const timeRegex = /(?:a\s+las\s*|a\s+la\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:de\s+la\s+(?:tarde|mañana|noche)|hs|am|pm|hrs)?/i;
  const timeMatches = text.match(/(?:a\s+las\s*|a\s+la\s*)(\d{1,2})(?::(\d{2}))?\s*(de\s+la\s+tarde|de\s+la\s+mañana|de\s+la\s+noche|am|pm|hs|hrs)?/i) ||
                      text.match(/(\d{1,2}):(\d{2})\s*(am|pm|hs)?/i) ||
                      text.match(/(\d{1,2})\s*(?:hs|hrs)\b/i) ||
                      text.match(/(\d{1,2})\s*(?:am|pm)\b/i);

  if (timeMatches) {
    let hour = parseInt(timeMatches[1], 10);
    const minute = timeMatches[2] ? timeMatches[2] : '00';
    const period = (timeMatches[3] || timeMatches[0]).toLowerCase();

    if ((period.includes('tarde') || period.includes('noche') || period.includes('pm')) && hour < 12) {
      hour += 12;
    } else if (period.includes('am') && hour === 12) {
      hour = 0;
    }

    if (hour >= 0 && hour <= 23) {
      time = `${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
      score += 2;
      text = text.replace(timeMatches[0], '').trim();
    }
  }

  // 7. Clean Title from structural prefixes
  let cleanTitle = text
    .replace(/^(reunión\s+con|reunion\s+con|tarea\s+|llamar\s+a|cobro\s+de|gasto\s+de|nuevo\s+proyecto\s+)\s*/i, '')
    .replace(/\b(?:cobrar|pago|por|monto)\s*\d+.*$/i, '') // strip trailing money from title if already extracted
    .replace(/\s{2,}/g, ' ')
    .trim();

  // If clean title is too short or empty, synthesize from extracted data
  if (!cleanTitle || cleanTitle.length < 3) {
    if (type === 'reunion' && clientName) {
      cleanTitle = `Reunión con ${clientName}`;
    } else if (type === 'ingreso' && amount) {
      cleanTitle = `Cobro ${amount} ${currency || 'USD'}${clientName ? ` (${clientName})` : ''}`;
    } else if (type === 'gasto' && amount) {
      cleanTitle = `Gasto ${amount} ${currency || 'ARS'}`;
    } else {
      cleanTitle = rawText.trim();
    }
  } else {
    // Capitalize first letter
    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  }

  return {
    originalText: rawText,
    cleanTitle,
    type,
    date,
    time,
    amount,
    currency,
    clientName,
    clientPhone,
    confidenceScore: score,
  };
}
