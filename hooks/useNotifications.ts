import { useEffect, useRef } from 'react';
import { Transaction, LocationData, Language, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { supabase } from '../services/supabase';

// Utility to convert Base64 string to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const useNotifications = (
  currentUser: User | null,
  selectedLocation: string | null,
  transactions: Transaction[],
  availableLocations: LocationData[],
  language: Language
) => {
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;

    // Web Push Subscription Logic
    const subscribeToWebPush = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window && Notification.permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready;
          let subscription = await registration.pushManager.getSubscription();
          
          if (!subscription) {
            // NOTE: The user will need to put their public VAPID key here
            const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!publicVapidKey) return; // Skip if no key
            
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
          }

          // Save subscription to database
          const subJson = subscription.toJSON();
          if (subJson.endpoint && subJson.keys) {
            await supabase.from('push_subscriptions').upsert({
              user_id: currentUser.id,
              location_id: selectedLocation,
              endpoint: subJson.endpoint,
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth
            }, { onConflict: 'endpoint' });
          }
        } catch (error) {
          console.error('Error subscribing to web push:', error);
        }
      }
    };

    subscribeToWebPush();

    // Filter relevant incoming transfers that haven't been notified yet
    const relevantIncoming = transactions.filter(t =>
      t.toLocation === selectedLocation &&
      t.status === 'pending_target' &&
      !notifiedIds.current.has(t.id)
    );

    // Filter relevant completed transfers (where we were the sender)
    const relevantCompleted = transactions.filter(t =>
      t.fromLocation === selectedLocation &&
      t.status === 'completed' &&
      !notifiedIds.current.has(t.id + '_completed')
    );

    const t_text = TRANSLATIONS[language];

    // Group incoming by transfer group ID to prevent spam
    if (relevantIncoming.length > 0) {
      const incomingGroups = relevantIncoming.reduce((acc, tx) => {
        const groupId = tx.transferGroupId || tx.id; // Fallback to id if no group id
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(tx);
        return acc;
      }, {} as Record<string, Transaction[]>);

      Object.values(incomingGroups).forEach(group => {
        const firstTx = group[0];
        const fromLoc = availableLocations.find(l => l.id === firstTx.fromLocation);
        const fromLocName = fromLoc ? (fromLoc.id === 'warehouse' ? t_text.warehouse : fromLoc.id === 'mammal' ? t_text.mammal : (language === 'ar' ? (fromLoc.nameAr || fromLoc.name) : fromLoc.name)) : firstTx.fromLocation;
        
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const title = t_text.incomingRequests;
            const itemCount = group.length;
            const bodyText = language === 'ar' 
              ? `تحويل وارد: ${itemCount} عناصر من ${fromLocName}`
              : `Incoming Transfer: ${itemCount} items from ${fromLocName}`;

            const options = {
              body: bodyText,
              icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              vibrate: [100, 50, 100],
              data: { primaryKey: firstTx.transferGroupId || firstTx.id }
            };

            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(err => {
                new Notification(title, options);
              });
            } else {
              new Notification(title, options);
            }
          } catch (e) { console.error("Notification failed", e); }
        }
        
        // Mark all items in this group as notified
        group.forEach(tx => notifiedIds.current.add(tx.id));
      });
    }

    // Group completed by transfer group ID
    if (relevantCompleted.length > 0) {
      const completedGroups = relevantCompleted.reduce((acc, tx) => {
        const groupId = tx.transferGroupId || tx.id;
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(tx);
        return acc;
      }, {} as Record<string, Transaction[]>);

      Object.values(completedGroups).forEach(group => {
        const firstTx = group[0];
        const toLoc = availableLocations.find(l => l.id === firstTx.toLocation);
        const toLocName = toLoc ? (toLoc.id === 'warehouse' ? t_text.warehouse : toLoc.id === 'mammal' ? t_text.mammal : (language === 'ar' ? (toLoc.nameAr || toLoc.name) : toLoc.name)) : firstTx.toLocation;
        
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const title = language === 'ar' ? 'تم استلام التحويل' : 'Transfer Received';
            const itemCount = group.length;
            const bodyText = language === 'ar' 
              ? `تم استلام ${itemCount} عناصر بواسطة ${toLocName}`
              : `${itemCount} items received by ${toLocName}`;

            const options = {
              body: bodyText,
              icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              vibrate: [100, 50, 100],
              data: { primaryKey: (firstTx.transferGroupId || firstTx.id) + '_completed' }
            };

            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(err => {
                new Notification(title, options);
              });
            } else {
              new Notification(title, options);
            }
          } catch (e) { console.error("Notification failed", e); }
        }
        
        // Mark all items in this group as notified
        group.forEach(tx => notifiedIds.current.add(tx.id + '_completed'));
      });
    }
  }, [transactions, currentUser, selectedLocation, language, availableLocations]);
};
