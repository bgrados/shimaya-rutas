import { useState, useEffect } from 'react';
import { supabase } from './supabase';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const checkExistingSubscription = async () => {
    const existing = await navigator.serviceWorker?.ready.then(reg => 
      reg.pushManager.getSubscription()
    );
    if (existing) {
      setSubscription(existing as unknown as PushSubscription);
    }
  };

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    checkExistingSubscription();
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Este navegador no soporta notificaciones push');
      return null;
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    
    if (perm === 'granted') {
      return subscribeToPush();
    }
    return null;
  };

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (!registration) {
        console.warn('No service worker registered');
        return null;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || '')
      });

      setSubscription(sub as unknown as PushSubscription);
      
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription: JSON.stringify(sub),
        created_at: new Date().toISOString()
      });

      return sub;
    } catch (err) {
      console.error('Error subscribing to push:', err);
      return null;
    }
  };

  const unsubscribe = async () => {
    const registration = await navigator.serviceWorker?.ready;
    await registration?.pushManager.unsubscribe();
    setSubscription(null);
  };

  return {
    permission,
    subscription,
    requestPermission,
    subscribeToPush,
    unsubscribe,
    isSupported: 'Notification' in window && 'serviceWorker' in navigator
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function sendPushNotification(userId: string, title: string, body: string) {
  try {
    await supabase.functions.invoke('send-push', {
      body: { user_id: userId, title, body }
    });
  } catch (err) {
    console.error('Error sending push:', err);
  }
}