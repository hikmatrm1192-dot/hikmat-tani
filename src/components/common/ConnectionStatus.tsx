/**
 * HIKMAT TANI - Connection Status Badge
 * 
 * Prinsip:
 * - Offline: "Offline — data tersimpan di perangkat"
 * - Online: "Tersimpan Lokal" (karena engine sync belum dibangun, tidak berpura-pura data sudah tersinkron ke cloud)
 */

import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
        isOnline
          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
          : 'bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
          <span className="hidden xs:inline sm:inline">Tersimpan Lokal</span>
          <span className="xs:hidden sm:hidden">Lokal</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">Offline — lokal</span>
          <span className="sm:hidden">Offline</span>
        </>
      )}
    </div>
  );
}
