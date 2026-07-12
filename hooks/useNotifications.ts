import { useEffect, useRef } from 'react';
import { Transaction, LocationData, Language, User } from '../types';
import { TRANSLATIONS } from '../constants';

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
