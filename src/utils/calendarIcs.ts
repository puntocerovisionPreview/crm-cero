// Calendar .ics generator for native iOS Apple Calendar & Reminders
// Allows 1-tap addition of any task or meeting to the native iPhone Calendar with alarms

export function generateCalendarICS(options: {
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  alarmMinutesBefore?: number; // e.g., 0, 15, 30, 60
}): void {
  const { title, description, date, time, alarmMinutesBefore = 15 } = options;

  let startDateTimeStr = '';
  let endDateTimeStr = '';
  let isAllDay = false;

  const [year, month, day] = date.split('-').map(Number);

  if (time && time.includes(':')) {
    const [hours, minutes] = time.split(':').map(Number);
    const startDate = new Date(year, month - 1, day, hours, minutes);
    // End date 30 min later by default
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const pad = (n: number) => String(n).padStart(2, '0');
    startDateTimeStr = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}T${pad(startDate.getHours())}${pad(startDate.getMinutes())}00`;
    endDateTimeStr = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  } else {
    isAllDay = true;
    const pad = (n: number) => String(n).padStart(2, '0');
    startDateTimeStr = `${year}${pad(month)}${pad(day)}`;
    // Next day for all day event
    const nextDay = new Date(year, month - 1, day + 1);
    endDateTimeStr = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;
  }

  const uid = `cero-${Date.now()}@puntocero.studio`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Format alarm
  let alarmBlock = '';
  if (alarmMinutesBefore !== undefined && alarmMinutesBefore >= 0) {
    alarmBlock = `
BEGIN:VALARM
TRIGGER:-PT${alarmMinutesBefore}M
ACTION:DISPLAY
DESCRIPTION:Recordatorio: ${title.replace(/\n/g, ' ')}
END:VALARM`.trim();
  }

  const dtStartProp = isAllDay ? `DTSTART;VALUE=DATE:${startDateTimeStr}` : `DTSTART:${startDateTimeStr}`;
  const dtEndProp = isAllDay ? `DTEND;VALUE=DATE:${endDateTimeStr}` : `DTEND:${endDateTimeStr}`;

  const cleanDesc = (description || 'Creado desde CRM Personal .Cero')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

  const cleanTitle = title
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, ' ');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Punto Cero Studio//CRM Personal//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    dtStartProp,
    dtEndProp,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDesc}`,
  ];

  if (alarmBlock) {
    icsLines.push(alarmBlock);
  }

  icsLines.push('END:VEVENT');
  icsLines.push('END:VCALENDAR');

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // In iOS Safari, triggering a link with .ics opens the native "Add to Calendar" prompt directly
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function generateBatchCalendarICS(
  events: Array<{
    title: string;
    description?: string;
    date: string;
    time?: string;
    alarmMinutesBefore?: number;
  }>,
  calendarName: string = 'Calendario Cero'
): void {
  if (!events || events.length === 0) return;

  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Punto Cero Studio//CRM Personal//ES',
    `X-WR-CALNAME:${calendarName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  events.forEach((ev, idx) => {
    const { title, description, date, time, alarmMinutesBefore = 15 } = ev;
    const [year, month, day] = date.split('-').map(Number);
    let startDateTimeStr = '';
    let endDateTimeStr = '';
    let isAllDay = false;

    if (time && time.includes(':')) {
      const [hours, minutes] = time.split(':').map(Number);
      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(startDate.getTime() + 45 * 60 * 1000);
      startDateTimeStr = `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}T${pad(startDate.getHours())}${pad(startDate.getMinutes())}00`;
      endDateTimeStr = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
    } else {
      isAllDay = true;
      startDateTimeStr = `${year}${pad(month)}${pad(day)}`;
      const nextDay = new Date(year, month - 1, day + 1);
      endDateTimeStr = `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;
    }

    const dtStartProp = isAllDay ? `DTSTART;VALUE=DATE:${startDateTimeStr}` : `DTSTART:${startDateTimeStr}`;
    const dtEndProp = isAllDay ? `DTEND;VALUE=DATE:${endDateTimeStr}` : `DTEND:${endDateTimeStr}`;
    const cleanDesc = (description || 'CRM Personal .Cero')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
    const cleanTitle = title
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, ' ');

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:cero-batch-${Date.now()}-${idx}@puntocero.studio`);
    icsLines.push(`DTSTAMP:${stamp}`);
    icsLines.push(dtStartProp);
    icsLines.push(dtEndProp);
    icsLines.push(`SUMMARY:${cleanTitle}`);
    icsLines.push(`DESCRIPTION:${cleanDesc}`);

    if (alarmMinutesBefore !== undefined && alarmMinutesBefore >= 0) {
      icsLines.push('BEGIN:VALARM');
      icsLines.push(`TRIGGER:-PT${alarmMinutesBefore}M`);
      icsLines.push('ACTION:DISPLAY');
      icsLines.push(`DESCRIPTION:Recordatorio: ${cleanTitle}`);
      icsLines.push('END:VALARM');
    }

    icsLines.push('END:VEVENT');
  });

  icsLines.push('END:VCALENDAR');

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${calendarName.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
