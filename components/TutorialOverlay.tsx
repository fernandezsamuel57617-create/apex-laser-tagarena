import { CheckCircle2, Gamepad2, Keyboard, Smartphone, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
  isTouchMode?: boolean;
}

interface ControlGuideItem {
  id: string;
  keyBadge: string;
  title: string;
  description: string;
  category: 'Movimiento' | 'Combate' | 'Social';
}

const PC_CONTROL_ITEMS: ControlGuideItem[] = [
  {
    id: 'move',
    keyBadge: 'W A S D',
    title: 'Moverse',
    description: 'Desplázate por el Lobby, el Obby y la Arena.',
    category: 'Movimiento',
  },
  {
    id: 'sprint',
    keyBadge: 'SHIFT',
    title: 'Correr',
    description: 'Aumenta tu velocidad consumiendo energía al correr en combate.',
    category: 'Movimiento',
  },
  {
    id: 'crouch',
    keyBadge: 'CTRL',
    title: 'Agacharse',
    description: 'Mantén Control para agacharte, cubrirte y reducir tu silueta.',
    category: 'Movimiento',
  },
  {
    id: 'slide',
    keyBadge: 'C',
    title: 'Deslizarse',
    description: 'Impulso rápido agachado para esquivar láseres enemigos.',
    category: 'Movimiento',
  },
  {
    id: 'jump',
    keyBadge: 'ESPACIO',
    title: 'Saltar',
    description: 'Salta obstáculos y supera las plataformas del Obby.',
    category: 'Movimiento',
  },
  {
    id: 'shoot',
    keyBadge: 'CLIC IZQ',
    title: 'Disparar Láser',
    description: 'Marca oponentes en la Arena (desactivado en el Lobby).',
    category: 'Combate',
  },
  {
    id: 'aim',
    keyBadge: 'CLIC DER / V',
    title: 'Apuntar (ADS)',
    description: 'Aumenta tu precisión y reduce la dispersión de disparo.',
    category: 'Combate',
  },
  {
    id: 'slots',
    keyBadge: '1 / 2 / 3',
    title: 'Arma Larga y Pistola',
    description: '[1] Arma Larga · [2] Pistola Pequeña · [3] Cuchillo.',
    category: 'Combate',
  },
  {
    id: 'knife',
    keyBadge: 'G',
    title: 'Equipar Cuchillo',
    description: 'Saca o guarda tu cuchillo en todos los modos y corre más rápido.',
    category: 'Combate',
  },
  {
    id: 'reload',
    keyBadge: 'R',
    title: 'Recargar Celda',
    description: 'Recarga las cargas del arma larga o pistola que tengas activa.',
    category: 'Combate',
  },
  {
    id: 'emotes',
    keyBadge: 'B / 1-6',
    title: 'Emotes 3D',
    description: 'Pulsa B para abrir el menú de emotes y 1-6 para activarlos.',
    category: 'Social',
  },
  {
    id: 'chat',
    keyBadge: 'T',
    title: 'Chat de Partida',
    description: 'Abre el chat para escribir en el lobby o en plena partida.',
    category: 'Social',
  },
  {
    id: 'inv',
    keyBadge: 'I / TAB / ENTER',
    title: 'Menús Rápidos',
    description: '[I] Inventario · [Tab] Ranking · [Enter] Empezar partida.',
    category: 'Social',
  },
];

const TOUCH_CONTROL_ITEMS: ControlGuideItem[] = [
  {
    id: 't_joystick',
    keyBadge: 'JOYSTICK IZQ',
    title: 'Moverse y Correr',
    description: 'Arrastra el joystick izquierdo para caminar; llévalo al borde para correr.',
    category: 'Movimiento',
  },
  {
    id: 't_sprint',
    keyBadge: 'BOTÓN CORRER',
    title: 'Sprint Fijo',
    description: 'Toca el botón Correr sobre el joystick para mantener carrera automática.',
    category: 'Movimiento',
  },
  {
    id: 't_camera',
    keyBadge: 'DESLIZAR DER',
    title: 'Rotar Cámara',
    description: 'Desliza el dedo en la mitad derecha de la pantalla para apuntar.',
    category: 'Combate',
  },
  {
    id: 't_fire',
    keyBadge: 'DISPARAR / CORTE',
    title: 'Disparar o Cortar',
    description: 'Usa el botón derecho para disparar láser o cortar con tu cuchillo.',
    category: 'Combate',
  },
  {
    id: 't_slots',
    keyBadge: 'BARRA INVENTARIO',
    title: 'Cambiar Arma en Partida',
    description: 'Toca la barra superior/inferior de partida para elegir Arma Larga, Pistola o Cuchillo.',
    category: 'Combate',
  },
  {
    id: 't_aim',
    keyBadge: 'MIRA ADS',
    title: 'Apuntar Preciso',
    description: 'Toca Mira para activar o desactivar el zoom táctico ADS.',
    category: 'Combate',
  },
  {
    id: 't_reload',
    keyBadge: 'RECARGAR',
    title: 'Recargar Celda',
    description: 'Toca Recargar para rellenar tu arma larga o pistola.',
    category: 'Combate',
  },
  {
    id: 't_crouch',
    keyBadge: 'AGACHAR',
    title: 'Agacharse en Combate',
    description: 'Toca Agachar para bajar tu perfil detrás de coberturas.',
    category: 'Movimiento',
  },
  {
    id: 't_slide',
    keyBadge: 'DESLIZAR',
    title: 'Deslizamiento Rápido',
    description: 'Toca Deslizar para esquivar disparos enemigos en movimiento.',
    category: 'Movimiento',
  },
  {
    id: 't_jump',
    keyBadge: 'SALTAR',
    title: 'Saltar y Obby',
    description: 'Toca Saltar para superar obstáculos en la Arena y plataformas del Lobby.',
    category: 'Movimiento',
  },
  {
    id: 't_hub',
    keyBadge: 'HUB INFERIOR',
    title: 'Hub de Teléfono',
    description: 'Usa la barra inferior del Lobby para Modos, Mapas, Sala, Social y Arsenal.',
    category: 'Social',
  },
];

export function TutorialOverlay({ open, onClose, isTouchMode = false }: TutorialOverlayProps) {
  const [guideMode, setGuideMode] = useState<'pc' | 'touch'>('pc');
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768;
    setGuideMode(isTouchMode || isNarrow ? 'touch' : 'pc');
    setActiveIdx(0);
  }, [open, isTouchMode]);

  const items = guideMode === 'touch' ? TOUCH_CONTROL_ITEMS : PC_CONTROL_ITEMS;

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    const id = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % items.length);
    }, 1850);
    return () => window.clearInterval(id);
  }, [open, guideMode, items.length]);

  if (!open) return null;

  const activeItem = items[activeIdx] ?? items[0];

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#060911]/88 p-3 sm:p-4">
      <div className="w-full max-w-4xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-cyan-500/40 bg-[#0B111E] p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-300 shrink-0">
              {guideMode === 'touch' ? (
                <Smartphone className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <Keyboard className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Tutorial de Controles</span>
              </div>
              <h2 className="font-display text-lg sm:text-2xl font-bold text-white leading-tight">
                {guideMode === 'touch'
                  ? 'Domina los controles táctiles del teléfono'
                  : 'Domina todas las teclas antes de entrar'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setGuideMode('touch')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  guideMode === 'touch'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Teléfono</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideMode('pc')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  guideMode === 'pc'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>PC</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar tutorial"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Animated Interactive Spotlight Stage */}
        <div className="mt-4 sm:mt-5 grid gap-4 sm:gap-5 md:grid-cols-[1.1fr_1.4fr] items-center rounded-xl border border-slate-800 bg-[#080D17] p-3.5 sm:p-4">
          <div className="flex flex-col items-center justify-center text-center py-2 sm:py-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
              {activeItem.category}
            </div>
            <div className="mt-2.5 sm:mt-3 flex items-center justify-center">
              <div
                key={`${guideMode}-${activeItem.id}`}
                className="rounded-xl border-2 border-cyan-400 bg-gradient-to-b from-cyan-500/25 to-slate-900 px-5 sm:px-6 py-2.5 sm:py-3.5 font-mono-tab text-lg sm:text-2xl font-bold text-white shadow-lg shadow-cyan-500/20 transition-transform duration-300 scale-105"
              >
                {activeItem.keyBadge}
              </div>
            </div>
            <h3 className="mt-3 sm:mt-4 font-display text-lg sm:text-xl font-bold text-white">
              {activeItem.title}
            </h3>
            <p className="mt-1 max-w-xs text-xs sm:text-sm text-slate-300">
              {activeItem.description}
            </p>

            {/* Animated Visual Movement Demo Bar */}
            <div className="mt-3.5 flex items-center gap-1.5">
              {items.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  aria-label={item.title}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === activeIdx ? 'w-7 bg-cyan-400' : 'w-2 bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* All Keys / Touch Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((item, idx) => {
              const selected = idx === activeIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 min-h-[46px] text-left transition-all duration-200 cursor-pointer ${
                    selected
                      ? 'border-cyan-400 bg-cyan-500/15 shadow-md shadow-cyan-500/10'
                      : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                  }`}
                >
                  <span
                    className={`shrink-0 rounded-lg border px-2 py-1 font-mono-tab text-[10px] sm:text-[11px] font-bold transition-colors ${
                      selected
                        ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-cyan-300'
                    }`}
                  >
                    {item.keyBadge}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-xs font-bold text-white truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Gamepad2 className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>
              Puedes volver a abrir este tutorial desde el botón{' '}
              <strong className="text-slate-200">[?]</strong> arriba.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 min-h-[44px] font-display text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Entendido, ¡A Jugar!</span>
          </button>
        </div>
      </div>
    </div>
  );
}
