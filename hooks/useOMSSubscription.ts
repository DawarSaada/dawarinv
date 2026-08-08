import { useState, useEffect } from 'react';
import { omsSupabase } from '../services/omsClient';

export interface SubscriptionSettings {
  simulateFailure: boolean;
  polarSubscriptionStatus: string | null;
  polarCurrentPeriodEnd: string | null;
  lastPaidMonth: string | null;
}

export const useOMSSubscription = () => {
  const [isSubscriptionLocked, setIsSubscriptionLocked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subDetails, setSubDetails] = useState<{status: string, expiry: string | null}>({ status: 'unknown', expiry: null });

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!omsSupabase) {
        setIsSubscriptionLocked(false);
        setSubDetails({ status: 'bypassed (no credentials)', expiry: null });
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await omsSupabase
          .from('app_settings')
          .select('key, value')
          .in('key', [
            'sub_simulate_fail',
            'polar_subscription_status',
            'polar_current_period_end',
            'sub_last_paid_month'
          ]);

        if (fetchError) throw fetchError;

        const settings: SubscriptionSettings = {
          simulateFailure: false,
          polarSubscriptionStatus: null,
          polarCurrentPeriodEnd: null,
          lastPaidMonth: null
        };

        if (data) {
          data.forEach(row => {
            if (row.key === 'sub_simulate_fail') settings.simulateFailure = row.value === 'true';
            if (row.key === 'polar_subscription_status') settings.polarSubscriptionStatus = row.value;
            if (row.key === 'polar_current_period_end') settings.polarCurrentPeriodEnd = row.value;
            if (row.key === 'sub_last_paid_month') settings.lastPaidMonth = row.value;
          });
        }

        // Logic matched perfectly with OMS App.tsx
        if (settings.polarSubscriptionStatus) {
          const endDate = settings.polarCurrentPeriodEnd ? new Date(settings.polarCurrentPeriodEnd) : null;
          const now = new Date();
          const isExpired = endDate ? (now.getTime() >= endDate.getTime()) : false;

          const isPaid = settings.polarSubscriptionStatus === 'active' && !settings.simulateFailure && !isExpired;
          
          setIsSubscriptionLocked(!isPaid);
        } else {
          // Fallback if Polar is not set up yet
          const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
          const isPaid = settings.lastPaidMonth === currentMonth && !settings.simulateFailure;
          
          setIsSubscriptionLocked(!isPaid);
        }
        
        setSubDetails({
          status: settings.polarSubscriptionStatus || (settings.lastPaidMonth ? 'active (legacy)' : 'inactive'),
          expiry: settings.polarCurrentPeriodEnd
        });
      } catch (err: any) {
        console.error("Failed to fetch OMS subscription status:", err);
        setError(err.message);
        setIsSubscriptionLocked(true);
        setSubDetails({ status: 'error', expiry: null });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  return { isSubscriptionLocked, isLoading, error, subDetails };
};
