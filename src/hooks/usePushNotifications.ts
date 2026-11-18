import { useCallback, useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputBuffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(outputBuffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(vapidPublicKey: string, authToken?: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator;
    setPushSupported(supported);

    if (supported && Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager?.getSubscription())
        .then((sub) => {
          if (sub) setIsSubscribed(true);
        })
        .catch(() => {});
    }
  }, []);

  const subscribe = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return {
        ok: false,
        message: 'Browser Anda tidak mendukung Web Notification API.',
      };
    }

    setIsSubscribing(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        return {
          ok: false,
          message: 'Izin notifikasi ditolak di pengaturan browser.',
        };
      }

      if ('serviceWorker' in navigator && vapidPublicKey) {
        try {
          const registration = await navigator.serviceWorker.ready;
          if (registration.pushManager) {
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
              });
            }

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (authToken) {
              headers.Authorization = `Bearer ${authToken}`;
            }

            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers,
              body: JSON.stringify(subscription.toJSON()),
            });
            setIsSubscribed(true);
            return {
              ok: true,
              message: 'Notifikasi Push Web aktif. Pembaruan pembayaran akan muncul real-time.',
            };
          }
        } catch {
          // Fallback to foreground Notification API if PushManager is blocked in iframe
          setIsSubscribed(true);
          return {
            ok: true,
            message: 'Notifikasi Browser aktif untuk pelacakan pembayaran real-time.',
          };
        }
      }

      setIsSubscribed(true);
      return {
        ok: true,
        message: 'Notifikasi pembayaran real-time telah diaktifkan.',
      };
    } finally {
      setIsSubscribing(false);
    }
  }, [vapidPublicKey, authToken]);

  const showForegroundNotification = useCallback(
    (title: string, body: string) => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
          });
        } catch {
          // ServiceWorker showNotification handles background cases
        }
      }
    },
    []
  );

  return {
    permission,
    isSubscribed,
    isSubscribing,
    pushSupported,
    subscribe,
    showForegroundNotification,
  };
}
