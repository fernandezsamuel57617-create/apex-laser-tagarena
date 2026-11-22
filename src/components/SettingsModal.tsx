import {
  CheckCircle2,
  Gamepad2,
  Monitor,
  Move,
  RotateCcw,
  Settings,
  Sliders,
  Smartphone,
  X,
} from 'lucide-react';
import {
  DEFAULT_TOUCH_LAYOUT,
  type GraphicsQuality,
  type PlayerSettings,
} from '../shared/playerSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: PlayerSettings;
  onChangeSettings: (next: PlayerSettings) => void;
  showTouchControls: boolean;
  onToggleForceTouch: () => void;
  onEnterHudEditMode: () => void;
}

const GRAPHICS_OPTIONS: Array<{
  id: GraphicsQuality;
  label: string;
  hint: string;
}> = [
  { id: 'low', label: 'Bajos', hint: 'Máximos FPS · Sin sombras' },
  { id: 'medium', label: 'Medios', hint: 'Balanceado · Resolución media' },
  { id: 'high', label: 'Altos', hint: 'Sombras HD y reflejos completos' },
];

const SENSITIVITY_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Baja', value: 0.65 },
  { label: 'Normal', value: 1.0 },
  { label: 'Alta', value: 1.5 },
  { label: 'Rápida', value: 2.0 },
];

export function SettingsModal({
  open,
  onClose,
  settings,
  onChangeSettings,
  showTouchControls,
  onToggleForceTouch,
  onEnterHudEditMode,
}: SettingsModalProps) {
  if (!open) return null;

  const updateSensitivity = (value: number) => {
    const rounded = Math.round(value * 20) / 20;
    onChangeSettings({
      ...settings,
      sensitivity: Math.max(0.3, Math.min(2.5, rounded)),
    });
  };

  const updateGraphics = (graphicsQuality: GraphicsQuality) => {
    onChangeSettings({ ...settings, graphicsQuality });
  };

  const updateButtonScale = (value: number) => {
    const rounded = Math.round(value * 20) / 20;
    onChangeSettings({
      ...settings,
      touchButtonScale: Math.max(0.75, Math.min(1.35, rounded)),
    });
  };

  const resetTouchLayout = () => {
    onChangeSettings({
      ...settings,
      touchButtonScale: 1.0,
      touchLayout: { ...DEFAULT_TOUCH_LAYOUT },
    });
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/88 p-3 sm:p-4">
      <div className="flex w-full max-w-lg max-h-[92dvh] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0B111E] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3.5 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-300 shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                Configuración
              </h2>
              <p className="text-xs text-slate-400">
                Sensibilidad, calidad gráfica y controles de teléfono
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. Camera Sensitivity */}
          <div className="rounded-xl border border-slate-800 bg-[#080D17] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-cyan-400" />
                <span className="font-display text-sm font-bold text-white">
                  Sensibilidad de Cámara
                </span>
              </div>
              <span className="font-mono-tab text-sm font-bold text-cyan-300">
                {settings.sensitivity.toFixed(2)}x
              </span>
            </div>

            <input
              type="range"
              min={0.3}
              max={2.5}
              step={0.05}
              value={settings.sensitivity}
              onChange={(e) => updateSensitivity(parseFloat(e.target.value))}
              aria-label="Sensibilidad de cámara"
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="grid grid-cols-4 gap-1.5">
              {SENSITIVITY_PRESETS.map((preset) => {
                const active = Math.abs(settings.sensitivity - preset.value) < 0.04;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateSensitivity(preset.value)}
                    className={`min-h-[36px] rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Graphics Quality */}
          <div className="rounded-xl border border-slate-800 bg-[#080D17] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-amber-400" />
              <span className="font-display text-sm font-bold text-white">
                Gráficos y Rendimiento
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {GRAPHICS_OPTIONS.map((opt) => {
                const active = settings.graphicsQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateGraphics(opt.id)}
                    className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border px-2.5 py-2 text-center transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-400/15 text-amber-200'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="font-display text-xs sm:text-sm font-bold">{opt.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
                      {opt.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Phone Touch Buttons Customization */}
          <div className="rounded-xl border border-slate-800 bg-[#080D17] p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-400" />
                <div>
                  <div className="font-display text-sm font-bold text-white">
                    Controles de Teléfono
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Mueve cada botón a donde te sea más cómodo
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleForceTouch}
              className={`flex min-h-[42px] w-full items-center justify-between rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                showTouchControls
                  ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4" />
                <span>Mostrar Botones Táctiles</span>
              </span>
              <span className="font-mono-tab">
                {showTouchControls ? 'ACTIVO' : 'AUTO / OFF'}
              </span>
            </button>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-semibold">Tamaño de Botones</span>
                <span className="font-mono-tab font-bold text-cyan-300">
                  {Math.round(settings.touchButtonScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={settings.touchButtonScale}
                onChange={(e) => updateButtonScale(parseFloat(e.target.value))}
                aria-label="Tamaño de botones táctiles"
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEnterHudEditMode();
                }}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-display text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                <Move className="h-4 w-4" />
                <span>Mover Botones en Pantalla</span>
              </button>

              <button
                type="button"
                onClick={resetTouchLayout}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restablecer Posiciones</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 px-4 py-3 sm:px-6 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-2 font-display text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Listo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
