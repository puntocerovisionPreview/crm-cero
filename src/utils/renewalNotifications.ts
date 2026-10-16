import { StudioFixedExpense } from '../types';
import { getTodayString } from './storage';

export function getDaysUntilDue(dueDate: string): number {
  if (!dueDate) return 999;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate + 'T00:00:00');
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

/**
 * Checks if browser supports Notifications and current permission state
 */
export function getNotificationPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Trigger local browser notification for upcoming domain or hosting renewals
 */
export function triggerRenewalBrowserNotification(expense: StudioFixedExpense, daysLeft: number) {
  if (getNotificationPermissionState() !== 'granted') return;

  const isDomain = expense.category === 'dominios';
  const prefix = isDomain ? 'Dominio' : 'Servicio / Hosting';
  const urgencyText = daysLeft < 0 
    ? `¡Venció hace ${Math.abs(daysLeft)} días!` 
    : daysLeft === 0 
    ? '¡Vence HOY!' 
    : daysLeft === 1 
    ? '¡Vence mañana!' 
    : `Vence en ${daysLeft} días`;

  try {
    const title = `⚠️ ${prefix} por vencer: ${expense.name}`;
    const body = `${urgencyText} (${expense.nextDueDate}). ${expense.clientName ? `Cliente: ${expense.clientName}. ` : ''}Monto: ${expense.currency === 'USD' ? 'u$s' : '$'}${expense.amount}.`;
    
    new Notification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `renewal-${expense.id}`,
    });
  } catch (err) {
    console.error('Could not fire native notification:', err);
  }
}

/**
 * Checks active domains and hosting due within 15 days, runs once per day notification
 */
export function runRenewalNotificationCheck(expenses: StudioFixedExpense[]) {
  if (typeof window === 'undefined') return;
  const today = getTodayString();
  const lastCheckKey = 'cero_last_renewal_notification_date';
  const lastCheck = localStorage.getItem(lastCheckKey);

  // If already checked today, avoid spamming native notifications
  if (lastCheck === today) return;

  const urgentItems = expenses.filter(e => {
    if (!e.active) return false;
    if (e.category !== 'dominios' && e.category !== 'hosting') return false;
    const days = getDaysUntilDue(e.nextDueDate);
    return days <= 15;
  });

  if (urgentItems.length > 0 && getNotificationPermissionState() === 'granted') {
    // Notify top urgent item
    const topUrgent = urgentItems.sort((a, b) => getDaysUntilDue(a.nextDueDate) - getDaysUntilDue(b.nextDueDate))[0];
    const days = getDaysUntilDue(topUrgent.nextDueDate);
    triggerRenewalBrowserNotification(topUrgent, days);
    localStorage.setItem(lastCheckKey, today);
  }
}

/**
 * Build pre-composed WhatsApp message for domain/hosting client renewal
 */
export function getWhatsAppRenewalUrl(expense: StudioFixedExpense, clientPhone?: string): string {
  const isDomain = expense.category === 'dominios';
  const daysLeft = getDaysUntilDue(expense.nextDueDate);
  const urgencyText = daysLeft < 0 
    ? `venció el pasado ${expense.nextDueDate}` 
    : daysLeft === 0 
    ? `vence hoy ${expense.nextDueDate}` 
    : daysLeft === 1 
    ? `vence mañana ${expense.nextDueDate}` 
    : `vence en ${daysLeft} días (el ${expense.nextDueDate})`;

  const clientGreeting = expense.clientName ? `Hola ${expense.clientName}, ` : 'Hola, ';
  const currencySymbol = expense.currency === 'USD' ? 'u$s ' : '$';

  const text = `${clientGreeting}te escribo de .Cero Estudio para recordarte que la renovación anual de tu ${isDomain ? 'dominio web' : 'servicio de hosting'} *${expense.name}* ${urgencyText}.\n\nEl costo de renovación es de *${currencySymbol}${expense.amount.toLocaleString('es-AR')}*.\n\n¿Me confirmás para gestionarlo y asegurar que el sitio continúe activo sin interrupciones? ¡Muchas gracias!`;

  const phoneParam = clientPhone ? clientPhone.replace(/\D/g, '') : '';
  return `https://wa.me/${phoneParam}?text=${encodeURIComponent(text)}`;
}
