/**
 * HIKMAT TANI - Weather Alerts & Risk Mitigation
 */

import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

interface WeatherAlertItem {
  title: string;
  desc: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
}

interface WeatherAlertsProps {
  alerts?: WeatherAlertItem[];
}

export function WeatherAlerts({ alerts = [] }: WeatherAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, idx) => {
        const isDanger = alert.severity === 'DANGER';
        const isWarning = alert.severity === 'WARNING';

        return (
          <div
            key={idx}
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
              isDanger
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : isWarning
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-sky-50 border-sky-200 text-sky-950'
            }`}
          >
            {isDanger ? (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : isWarning ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            )}

            <div className="space-y-0.5">
              <h4 className="text-xs sm:text-sm font-extrabold">{alert.title}</h4>
              <p className="text-[11px] sm:text-xs leading-relaxed opacity-90">{alert.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
