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

    if (relevantIncoming.length > 0) {
      relevantIncoming.forEach(tx => {
        const fromLoc = availableLocations.find(l => l.id === tx.fromLocation);
        const fromLocName = fromLoc ? (fromLoc.id === 'warehouse' ? t_text.warehouse : fromLoc.id === 'mammal' ? t_text.mammal : (language === 'ar' ? (fromLoc.nameAr || fromLoc.name) : fromLoc.name)) : tx.fromLocation;
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const title = t_text.incomingRequests;
            const options = {
              body: `${language === 'ar' ? tx.itemNameAr : tx.itemNameEn}: ${tx.quantity} ${tx.unit} ${t_text.from} ${fromLocName}`,
              icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              vibrate: [100, 50, 100],
              data: { primaryKey: tx.id }
            };

            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(err => {
                console.error("Service worker notification failed, falling back to standard", err);
                new Notification(title, options);
              });
            } else {
              new Notification(title, options);
            }
          } catch (e) { console.error("Notification failed", e); }
        }
        notifiedIds.current.add(tx.id);
      });
    }

    if (relevantCompleted.length > 0) {
      relevantCompleted.forEach(tx => {
        const toLoc = availableLocations.find(l => l.id === tx.toLocation);
        const toLocName = toLoc ? (toLoc.id === 'warehouse' ? t_text.warehouse : toLoc.id === 'mammal' ? t_text.mammal : (language === 'ar' ? (toLoc.nameAr || toLoc.name) : toLoc.name)) : tx.toLocation;
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const title = language === 'ar' ? 'تم استلام التحويل' : 'Transfer Received';
            const options = {
              body: `${language === 'ar' ? tx.itemNameAr : tx.itemNameEn}: ${tx.quantity} ${tx.unit} ${language === 'ar' ? 'بواسطة' : 'by'} ${toLocName}`,
              icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
              vibrate: [100, 50, 100],
              data: { primaryKey: tx.id + '_completed' }
            };

            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, options);
              }).catch(err => {
                console.error("Service worker notification failed, falling back to standard", err);
                new Notification(title, options);
              });
            } else {
              new Notification(title, options);
            }
          } catch (e) { console.error("Notification failed", e); }
        }
        notifiedIds.current.add(tx.id + '_completed');
      });
    }
  }, [transactions, currentUser, selectedLocation, language, availableLocations]);
};
