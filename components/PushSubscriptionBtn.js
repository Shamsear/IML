'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
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

export default function PushSubscriptionBtn() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      // Check current subscription status
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((sub) => {
          setSubscription(sub);
        });
      });
    }
  }, []);

  const subscribeUser = async () => {
    setLoading(true);
    setError('');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied by user.');
      }

      const registration = await navigator.serviceWorker.ready;
      
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID Public Key not set in environment.');
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Save subscription to database
      const response = await fetch('/api/dashboard/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubscription),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription payload on backend.');
      }

      setSubscription(newSubscription);

      // Trigger a test notification immediately
      await fetch('/api/dashboard/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Notifications Enabled!',
          message: 'You will now receive alerts for logistics movements and damage logs.'
        }),
      });

    } catch (err) {
      console.error('[Subscription error]:', err);
      setError(err.message || 'Failed to enable notifications.');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    if (!subscription) return;
    setLoading(true);
    setError('');

    try {
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (err) {
      setError('Failed to unsubscribe client.');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) return null;

  return (
    <div style={styles.container}>
      {subscription ? (          <button 
          onClick={unsubscribeUser} 
          className="btn btn-secondary" 
          style={{ ...styles.btn, ...styles.activeBtn }}
          disabled={loading}
          title="Disable Push Alerts"
          aria-label="Disable Push Alerts"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <BellRing size={16} style={{ color: 'var(--accent-primary)' }} />
          )}
        </button>
      ) : (
        <button 
          onClick={subscribeUser} 
          className="btn btn-secondary" 
          style={styles.btn}
          disabled={loading}
          title="Enable Push Alerts"
          aria-label="Enable Push Alerts"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Bell size={16} style={{ color: 'var(--text-muted)' }} />
          )}
        </button>
      )}

      {error && <span style={styles.errorText}>{error}</span>}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  btn: {
    padding: '0.45rem',
    borderRadius: 'var(--radius-full)',
  },
  activeBtn: {
    borderColor: 'var(--accent-primary)',
    background: 'var(--accent-primary-glow)',
    boxShadow: 'var(--shadow-glow)',
  },
  errorText: {
    fontSize: '0.7rem',
    color: 'var(--color-danger)',
  },
};
