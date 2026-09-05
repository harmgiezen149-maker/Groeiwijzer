'use client';

import { useEffect, useState } from 'react';

/**
 * Pushmeldingen aanzetten. Op een iPhone werkt dit alleen wanneer de app via
 * "Zet op beginscherm" is geïnstalleerd (§8.2), dus dat detecteren we en
 * zeggen we erbij.
 */
export function PushAanmelden({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [status, setStatus] = useState<'onbekend' | 'uit' | 'aan' | 'geweigerd' | 'kan-niet'>(
    'onbekend',
  );
  const [standalone, setStandalone] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone)),
    );

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('kan-niet');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('geweigerd');
      return;
    }
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'aan' : 'uit'))
      .catch(() => setStatus('uit'));
  }, []);

  async function aanzetten() {
    if (!vapidPublicKey) return;
    setBezig(true);
    setFout(null);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const toestemming = await Notification.requestPermission();
      if (toestemming !== 'granted') {
        setStatus('geweigerd');
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent.slice(0, 300),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Aanmelden lukte niet');
      }
      setStatus('aan');
    } catch (error) {
      setFout(error instanceof Error ? error.message : 'Aanmelden lukte niet');
    } finally {
      setBezig(false);
    }
  }

  async function uitzetten() {
    setBezig(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        });
        await subscription.unsubscribe();
      }
      setStatus('uit');
    } finally {
      setBezig(false);
    }
  }

  if (!vapidPublicKey) {
    return (
      <p className="text-sm text-[var(--ink-soft)]">
        Pushmeldingen zijn nog niet ingesteld op de server.
      </p>
    );
  }

  if (isIOS && !standalone) {
    return (
      <p className="text-sm text-[var(--ink-soft)]">
        Op een iPhone werken meldingen alleen als je de app op je beginscherm zet. Tik in Safari
        op delen en kies &ldquo;Zet op beginscherm&rdquo;, open Bloeiwijzer daarna vanaf het
        beginscherm en zet de meldingen hier aan.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {fout ? (
        <p role="alert" className="text-sm text-[var(--zinnia-dark)]">
          {fout}
        </p>
      ) : null}
      {status === 'kan-niet' ? (
        <p className="text-sm text-[var(--ink-soft)]">
          Deze browser kan geen pushmeldingen ontvangen.
        </p>
      ) : status === 'geweigerd' ? (
        <p className="text-sm text-[var(--ink-soft)]">
          Meldingen staan uit in je browserinstellingen. Zet ze daar weer aan voor deze site.
        </p>
      ) : status === 'aan' ? (
        <button
          type="button"
          className="bw-btn bw-btn-secondary self-start"
          disabled={bezig}
          onClick={() => void uitzetten()}
        >
          Meldingen op dit apparaat uitzetten
        </button>
      ) : (
        <button
          type="button"
          className="bw-btn bw-btn-primary self-start"
          disabled={bezig || status === 'onbekend'}
          onClick={() => void aanzetten()}
        >
          {bezig ? 'Bezig…' : 'Meldingen op dit apparaat aanzetten'}
        </button>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return buffer;
}
