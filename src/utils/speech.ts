import { todayLocal, currentWeekdayLocal, addDays, parseLocalDate } from './dates';

// Speech helper with iOS PWA WebKit detection, AudioRecorder, and AI transcription
// On iOS Web-App-Capable mode (standalone added to Home Screen), WebKit disables SpeechRecognition.
// MediaRecorder + AI endpoint provides universal voice capture across all mobile and desktop devices.
// Native iOS Siri Dictation (the microphone key on the keyboard) is also highlighted as a 100% native alternative.

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export interface ParsedVoiceItem {
  transcript: string;
  type?: 'reunion' | 'tarea' | 'objetivo' | 'proyecto' | 'ingreso' | 'gasto';
  title: string;
  date?: string;
  time?: string;
  clientName?: string;
  clientPhone?: string;
  notes?: string;
  amount?: number;
  category?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isMediaRecorderSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Converts a Blob to a base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g. data:audio/webm;base64,)
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends audio directly to server-side Gemini AI for transcription and structured data extraction
 */
export async function transcribeAudioWithAI(
  audioBlob: Blob,
  todayStr?: string
): Promise<ParsedVoiceItem | null> {
  try {
    const base64 = await blobToBase64(audioBlob);
    const mimeType = audioBlob.type || 'audio/webm';

    const res = await fetch('/api/ai/transcribe-voice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audioBase64: base64,
        mimeType,
        today: todayStr || todayLocal(),
        weekday: currentWeekdayLocal(),
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const json = await res.json();
    if (json.success && json.data) {
      return json.data as ParsedVoiceItem;
    }
    return null;
  } catch (err) {
    console.warn('AI Voice transcription error:', err);
    return null;
  }
}

/**
 * Universal Audio Recorder for mobile devices (including iOS PWA standalone)
 */
export function createAudioRecorder(
  onStop: (blob: Blob) => void,
  onError: (err: string) => void
): { start: () => Promise<boolean>; stop: () => void; isRecording: () => boolean } {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let stream: MediaStream | null = null;
  let recording = false;

  return {
    isRecording: () => recording,
    start: async () => {
      try {
        if (!isMediaRecorderSupported()) {
          onError('Grabador de audio no soportado en este dispositivo.');
          return false;
        }

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Find optimal supported mime type
        const possibleTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/aac',
          'audio/ogg',
          'audio/wav',
        ];
        let chosenMime = '';
        for (const t of possibleTypes) {
          if (MediaRecorder.isTypeSupported(t)) {
            chosenMime = t;
            break;
          }
        }

        audioChunks = [];
        mediaRecorder = chosenMime
          ? new MediaRecorder(stream, { mimeType: chosenMime })
          : new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          recording = false;
          const finalMime = mediaRecorder?.mimeType || chosenMime || 'audio/webm';
          const audioBlob = new Blob(audioChunks, { type: finalMime });
          
          // Cleanup tracks
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
          }

          onStop(audioBlob);
        };

        mediaRecorder.start(250); // collect in 250ms chunks
        recording = true;
        return true;
      } catch (err: any) {
        console.warn('Failed to start AudioRecorder:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          onError('Permiso de micrófono denegado. Habilitalo en los ajustes de tu navegador.');
        } else {
          onError('No se pudo acceder al micrófono.');
        }
        return false;
      }
    },
    stop: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    },
  };
}

export function createSpeechRecognizer(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (errorMessage: string, isIOSGuide?: boolean) => void,
  onEnd: () => void
): { start: () => void; stop: () => void; isSupported: boolean } {
  if (!isSpeechSupported()) {
    return {
      start: () => {
        if (isIOSDevice()) {
          onError('En iPhone al inicio: usá el botón 🎙️ del teclado', true);
        } else {
          onError('Tu navegador no soporta entrada de voz.');
        }
      },
      stop: () => {},
      isSupported: false,
    };
  }

  const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!RecognitionClass) {
    return {
      start: () => {},
      stop: () => {},
      isSupported: false,
    };
  }

  let recognition: SpeechRecognitionInstance | null = null;
  try {
    recognition = new RecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript.trim(), true);
      } else if (interim) {
        onTranscript(interim.trim(), false);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        if (isIOSDevice()) {
          onError('Apple bloquea el micrófono en PWA. Tocá el campo y usá el 🎙️ del teclado.', true);
        } else {
          onError('Permiso de micrófono no habilitado en el dispositivo.');
        }
      } else if (event.error === 'no-speech') {
        onError('No se detectó voz.');
      } else {
        onError(`Error de voz (${event.error})`);
      }
    };

    recognition.onend = () => {
      onEnd();
    };
  } catch (err) {
    console.warn('Failed to instantiate SpeechRecognition:', err);
    return {
      start: () => {
        if (isIOSDevice()) {
          onError('En iPhone al inicio: usá el botón 🎙️ del teclado', true);
        } else {
          onError('Entrada de voz no disponible.');
        }
      },
      stop: () => {},
      isSupported: false,
    };
  }

  return {
    start: () => {
      try {
        recognition?.start();
      } catch (err) {
        console.warn('Speech start error:', err);
        if (isIOSDevice()) {
          onError('En iPhone: usá el botón 🎙️ del teclado', true);
        } else {
          onError('No se pudo iniciar el micrófono.');
        }
      }
    },
    stop: () => {
      try {
        recognition?.stop();
      } catch (err) {
        console.warn('Speech stop error:', err);
      }
    },
    isSupported: true,
  };
}

/**
 * Parses spoken text to infer dates, times, phone numbers, client names, and types
 * e.g. "Reunión con Martín mañana a las 4 de la tarde teléfono 1123456789"
 */
export function parseSpokenInput(text: string): {
  cleanTitle: string;
  inferredType?: 'reunion' | 'tarea' | 'objetivo' | 'proyecto' | 'ingreso' | 'gasto';
  inferredDate?: string;
  inferredTime?: string;
  inferredPhone?: string;
  inferredClient?: string;
} {
  let clean = text.trim();
  let inferredType: 'reunion' | 'tarea' | 'objetivo' | 'proyecto' | 'ingreso' | 'gasto' | undefined;
  let inferredDate: string | undefined;
  let inferredTime: string | undefined;
  let inferredPhone: string | undefined;
  let inferredClient: string | undefined;

  const today = parseLocalDate(todayLocal());

  // Detect Type
  const lower = clean.toLowerCase();
  if (/(\breuni[oó]n\b|\bmeet\b|\bjunta\b|\bcita\b|\bllamada con\b|\bvideollamada\b)/i.test(lower)) {
    inferredType = 'reunion';
  } else if (/(\bobjetivo\b|\bmeta semanal\b|\bmeta de la semana\b)/i.test(lower)) {
    inferredType = 'objetivo';
  } else if (/(\bproyecto\b|\bnuevo cliente\b)/i.test(lower)) {
    inferredType = 'proyecto';
  } else if (/(\bcobro\b|\bingreso\b|\bfactura cobrada\b)/i.test(lower)) {
    inferredType = 'ingreso';
  } else if (/(\bgasto\b|\bpago de\b|\babono\b|\begreso\b)/i.test(lower)) {
    inferredType = 'gasto';
  } else if (/(\btarea\b|\bhacer\b|\brevisar\b|\bentregar\b)/i.test(lower)) {
    inferredType = 'tarea';
  }

  // Detect Phone / Whatsapp numbers (e.g. tel 11 2345 6789, telefono 1123456789, whatsapp 1123456789)
  const phoneRegex = /(?:tel[eé]fono|tel|celular|cel|whatsapp|wpp)?\s*[:\s]?\s*(\+?\d[\d\s-]{6,15}\d)/i;
  const phoneMatch = clean.match(phoneRegex);
  if (phoneMatch && phoneMatch[1]) {
    const rawNum = phoneMatch[1].replace(/[\s-]/g, '');
    if (rawNum.length >= 7) {
      inferredPhone = rawNum;
      clean = clean.replace(phoneMatch[0], '').trim();
    }
  }

  // Detect Client Name in "con [Nombre]"
  const clientMatch = clean.match(/\bcon\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)/i);
  if (clientMatch && clientMatch[1]) {
    inferredClient = clientMatch[1].trim();
  }

  // Match mañana, hoy, pasado mañana
  if (/(\bpasado mañana\b)/i.test(clean)) {
    inferredDate = addDays(todayLocal(), 2);
    clean = clean.replace(/(\bpara pasado mañana\b|\bpasado mañana\b)/gi, '').trim();
  } else if (/(\bmañana\b)/i.test(clean)) {
    inferredDate = addDays(todayLocal(), 1);
    clean = clean.replace(/(\bpara mañana\b|\bde mañana\b|\bmañana\b)/gi, '').trim();
  } else if (/(\bhoy\b)/i.test(clean)) {
    inferredDate = todayLocal();
    clean = clean.replace(/(\bpara hoy\b|\bde hoy\b|\bhoy\b)/gi, '').trim();
  }

  // Match specific day of week like "el lunes", "el martes", etc.
  const dayPatterns: Array<{ regex: RegExp; dayNum: number }> = [
    { regex: /(?:el\s+)?\bdomingo\b/i, dayNum: 0 },
    { regex: /(?:el\s+)?\blunes\b/i, dayNum: 1 },
    { regex: /(?:el\s+)?\bmartes\b/i, dayNum: 2 },
    { regex: /(?:el\s+)?\bmi[eé]rcoles\b/i, dayNum: 3 },
    { regex: /(?:el\s+)?\bjueves\b/i, dayNum: 4 },
    { regex: /(?:el\s+)?\bviernes\b/i, dayNum: 5 },
    { regex: /(?:el\s+)?\bs[aá]bado\b/i, dayNum: 6 },
  ];
  for (const { regex, dayNum } of dayPatterns) {
    if (regex.test(clean)) {
      const currentDay = today.getDay();
      let diff = dayNum - currentDay;
      if (diff <= 0) diff += 7; // next occurrence
      inferredDate = addDays(todayLocal(), diff);
      clean = clean.replace(regex, '').trim();
      break;
    }
  }

  // Match time like "a las 15", "a las 4 de la tarde", "16:30", "11 hs"
  const timeRegex = /(?:a las\s*)?(\d{1,2})(?::(\d{2}))?\s*(de la tarde|de la mañana|am|pm|hs)?/i;
  const match = clean.match(timeRegex);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? match[2] : '00';
    const period = match[3]?.toLowerCase();

    if (period && (period.includes('tarde') || period.includes('pm')) && hour < 12) {
      hour += 12;
    } else if (period && period.includes('am') && hour === 12) {
      hour = 0;
    }

    if (hour >= 0 && hour <= 23) {
      inferredTime = `${hour.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
      clean = clean.replace(match[0], '').trim();
    }
  }

  // Clean trailing punctuation or connector words
  clean = clean.replace(/^(reunión\s+con|reunion\s+con|tarea\s+|llamar\s+a)\s+/i, (m) => m);
  clean = clean.replace(/\s{2,}/g, ' ').trim();

  // If clean title is empty or just punctuation, fallback to original
  if (!clean || clean.length < 2) {
    clean = text.trim();
  }

  return {
    cleanTitle: clean.charAt(0).toUpperCase() + clean.slice(1),
    inferredType,
    inferredDate,
    inferredTime,
    inferredPhone,
    inferredClient,
  };
}
