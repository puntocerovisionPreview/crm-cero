// System notification scheduler and Web Notification API helper for .Cero CRM

export type NotificationPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionStatus;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

export function showSystemNotification(title: string, options?: NotificationOptions): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    // If ServiceWorker registration exists, prefer service worker notification (better for mobile lock screens)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          icon: '/logo.png',
          badge: '/logo.png',
          vibrate: [200, 100, 200],
          tag: options?.tag || 'crm-cero-task',
          renotify: true,
          ...options,
        } as NotificationOptions);
      });
      return true;
    }

    // Fallback standard Notification
    new Notification(title, {
      icon: '/logo.png',
      ...options,
    });
    return true;
  } catch (err) {
    console.error('Error showing notification:', err);
    return false;
  }
}
