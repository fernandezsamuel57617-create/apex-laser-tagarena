import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Instalar Apex Laser Tag como aplicación"
        className={`flex items-center gap-1.5 rounded-lg border border-cyan-400/60 bg-cyan-500/20 font-semibold text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'min-h-[38px] px-2.5 py-1.5 text-xs' : 'min-h-[44px] px-3 sm:px-3.5 py-2 text-xs sm:text-sm'
        }`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Agregar a pantalla de inicio en iPhone/iPad"
          className={`flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 font-semibold text-cyan-200 hover:border-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'min-h-[38px] px-2.5 py-1.5 text-xs' : 'min-h-[44px] px-3 py-2 text-xs sm:text-sm'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Instalar iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-cyan-500/40 bg-[#0B111E] p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-white">
                  Instalar en iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar guía"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed">
                <li>1. Toca el botón <strong>Compartir</strong> en la barra de Safari.</li>
                <li>2. Desliza hacia abajo y selecciona <strong>Agregar a inicio</strong>.</li>
                <li>3. Pulsa <strong>Agregar</strong> para jugar en pantalla completa.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-xl bg-cyan-400 py-2 font-display text-xs font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-400/60 bg-amber-500/95 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Sin conexión — Esperando red para multijugador</span>
    </div>
  );
}
