import { useEffect, useState } from 'react';

/**
 * Whether the browser believes it has a connection.
 *
 * **`navigator.onLine` is only half-trustworthy, and asymmetrically so.** A
 * `false` is reliable — the device knows it has no network interface up. A
 * `true` means only that an interface exists: a phone on a car-park wifi that
 * needs a captive-portal login reports itself online while nothing can reach
 * the server.
 *
 * That asymmetry is why this hook is used to *explain* rather than to decide.
 * The banner it drives is a courtesy; the request layer still tries, and a
 * request that fails for want of a network falls back to cache regardless of
 * what this says. Gating requests on `onLine` would strand exactly the member
 * on the flaky connection who most needs the app to keep trying.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    /*
     * Re-read on mount. The events fire on change, so a tab opened while
     * already offline would otherwise sit at the initial `true` forever.
     */
    setOnline(navigator.onLine !== false);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
