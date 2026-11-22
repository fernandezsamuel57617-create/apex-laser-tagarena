import {
  ArrowDown,
  ArrowUp,
  Check,
  Crosshair,
  Move,
  RotateCcw,
  RotateCw,
  Swords,
  Zap,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { WeaponHudState } from '../game/ArenaEngine';
import {
  DEFAULT_TOUCH_LAYOUT,
  type TouchControlId,
  type TouchLayoutMap,
} from '../shared/playerSettings';
import type { GamePhase } from '../shared/types';

interface MobileControlsOverlayProps {
  phase: GamePhase;
  alive: boolean;
  weaponState: WeaponHudState;
  touchLayout: TouchLayoutMap;
  touchButtonScale: number;
  editMode: boolean;
  onChangeLayout: (nextLayout: TouchLayoutMap) => void;
  onExitEditMode: () => void;
  onMove: (strafe: number, forward: number) => void;
  onFireChange: (firing: boolean) => void;
  onAimChange: (aiming: boolean) => void;
  onSprintChange: (sprinting: boolean) => void;
  onCrouchChange: (crouching: boolean) => void;
  onJump: () => void;
  onSlide: () => void;
  onReload: () => void;
}

const JOYSTICK_RADIUS = 46;

export function MobileControlsOverlay({
  phase,
  alive,
  weaponState,
  touchLayout,
  touchButtonScale,
  editMode,
  onChangeLayout,
  onExitEditMode,
  onMove,
  onFireChange,
  onAimChange,
  onSprintChange,
  onCrouchChange,
  onJump,
  onSlide,
  onReload,
}: MobileControlsOverlayProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const dragInfoRef = useRef<{
    id: TouchControlId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const [draggingId, setDraggingId] = useState<TouchControlId | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [sprintLocked, setSprintLocked] = useState(false);
  const [aimLocked, setAimLocked] = useState(false);
  const [crouchLocked, setCrouchLocked] = useState(false);
  const [firingPressed, setFiringPressed] = useState(false);

  // Reset transient touch holds if phase, life state, or edit mode changes
  useEffect(() => {
    if (editMode || phase === 'results' || phase === 'countdown' || !alive) {
      joyPointerIdRef.current = null;
      setKnobOffset({ x: 0, y: 0 });
      setJoyActive(false);
      setFiringPressed(false);
      setAimLocked(false);
      setSprintLocked(false);
      setCrouchLocked(false);
      onMove(0, 0);
      onFireChange(false);
      onAimChange(false);
      onSprintChange(false);
      onCrouchChange(false);
    }
  }, [editMode, phase, alive, onMove, onFireChange, onAimChange, onSprintChange, onCrouchChange]);

  const updateJoystickFromClient = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > JOYSTICK_RADIUS) {
      const scale = JOYSTICK_RADIUS / dist;
      dx *= scale;
      dy *= scale;
    }

    setKnobOffset({ x: dx, y: dy });

    const normX = dx / JOYSTICK_RADIUS;
    const normY = -dy / JOYSTICK_RADIUS;
    const mag = Math.hypot(normX, normY);

    if (mag < 0.14) {
      onMove(0, 0);
    } else {
      onMove(
        Math.max(-1, Math.min(1, normX)),
        Math.max(-1, Math.min(1, normY)),
      );
    }
  };

  const resetJoystick = () => {
    joyPointerIdRef.current = null;
    setJoyActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const handleJoyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editMode) return;
    e.stopPropagation();
    if (joyPointerIdRef.current !== null) return;
    joyPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setJoyActive(true);
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoyPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editMode) return;
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleJoyPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editMode) return;
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    resetJoystick();
  };

  // Drag-to-reposition handlers for Edit Mode
  const startDragControl = (id: TouchControlId, e: ReactPointerEvent<HTMLDivElement>) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const currentCenterX = (touchLayout[id].xPct / 100) * vw;
    const currentCenterY = (touchLayout[id].yPct / 100) * vh;

    dragInfoRef.current = {
      id,
      pointerId: e.pointerId,
      offsetX: e.clientX - currentCenterX,
      offsetY: e.clientY - currentCenterY,
    };
    setDraggingId(id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const moveDragControl = (id: TouchControlId, e: ReactPointerEvent<HTMLDivElement>) => {
    if (!editMode) return;
    const info = dragInfoRef.current;
    if (!info || info.id !== id || info.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const nextXPct = Math.max(
      7,
      Math.min(93, ((e.clientX - info.offsetX) / vw) * 100),
    );
    const nextYPct = Math.max(
      14,
      Math.min(91, ((e.clientY - info.offsetY) / vh) * 100),
    );
    onChangeLayout({
      ...touchLayout,
      [id]: {
        xPct: Math.round(nextXPct * 10) / 10,
        yPct: Math.round(nextYPct * 10) / 10,
      },
    });
  };

  const endDragControl = (id: TouchControlId, e: ReactPointerEvent<HTMLDivElement>) => {
    const info = dragInfoRef.current;
    if (!info || info.id !== id || info.pointerId !== e.pointerId) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragInfoRef.current = null;
    setDraggingId(null);
  };

  if (!editMode && (phase === 'results' || phase === 'countdown' || !alive)) return null;

  const isCombat = phase === 'playing';
  const isKnifeActive = weaponState.activeSlot === 'knife';
  const joyPullRatio = Math.hypot(knobOffset.x, knobOffset.y) / JOYSTICK_RADIUS;
  const autoSprintVisual = joyPullRatio > 0.88 || sprintLocked || weaponState.isSprinting;

  const toggleSprintLock = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (editMode) return;
    e.stopPropagation();
    const next = !sprintLocked;
    setSprintLocked(next);
    onSprintChange(next);
  };

  const toggleAimLock = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (editMode) return;
    e.stopPropagation();
    const next = !aimLocked;
    setAimLocked(next);
    onAimChange(next);
  };

  const toggleCrouchLock = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (editMode) return;
    e.stopPropagation();
    const next = !crouchLocked;
    setCrouchLocked(next);
    onCrouchChange(next);
  };

  const posStyle = (id: TouchControlId): CSSProperties => {
    const pos = touchLayout[id] ?? DEFAULT_TOUCH_LAYOUT[id];
    return {
      left: `${pos.xPct}%`,
      top: `${pos.yPct}%`,
      transform: `translate(-50%, -50%) scale(${touchButtonScale})`,
    };
  };

  const editRingClass = (id: TouchControlId) =>
    editMode
      ? `cursor-grab active:cursor-grabbing ring-2 ring-dashed ${
          draggingId === id ? 'ring-amber-300 scale-105' : 'ring-cyan-400/80'
        } rounded-2xl p-1 bg-cyan-500/10`
      : '';

  return (
    <>
      {/* EDIT MODE FLOATING BANNER */}
      {editMode && (
        <div className="pointer-events-auto fixed inset-0 z-30 bg-[#050810]/55">
          <div className="mx-auto mt-3 sm:mt-4 w-[94vw] max-w-lg rounded-2xl border border-cyan-400/70 bg-[#0B111E]/96 px-4 py-3 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Move className="h-4 w-4 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <div className="font-display text-xs sm:text-sm font-bold text-white">
                    Personalizar Botones Táctiles
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Arrastra cualquier botón o joystick adonde prefieras
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => onChangeLayout({ ...DEFAULT_TOUCH_LAYOUT })}
                  className="flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
                <button
                  type="button"
                  onClick={onExitEditMode}
                  className="flex min-h-[38px] items-center gap-1 rounded-lg bg-amber-400 px-3.5 py-1.5 font-display text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Guardar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. VIRTUAL JOYSTICK */}
      <div
        style={posStyle('joystick')}
        onPointerDown={(e) => startDragControl('joystick', e)}
        onPointerMove={(e) => moveDragControl('joystick', e)}
        onPointerUp={(e) => endDragControl('joystick', e)}
        onPointerCancel={(e) => endDragControl('joystick', e)}
        className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('joystick')}`}
      >
        <div
          ref={padRef}
          onPointerDown={handleJoyPointerDown}
          onPointerMove={handleJoyPointerMove}
          onPointerUp={handleJoyPointerUp}
          onPointerCancel={handleJoyPointerUp}
          onLostPointerCapture={resetJoystick}
          role="application"
          aria-label="Joystick táctil de movimiento"
          className={`relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full border-2 transition-colors touch-control ${
            editMode ? 'pointer-events-none' : ''
          } ${
            autoSprintVisual
              ? 'border-amber-400/80 bg-[#0B101B]/75'
              : joyActive
                ? 'border-cyan-400/80 bg-[#0B101B]/75'
                : 'border-slate-600/75 bg-[#0B101B]/65'
          }`}
        >
          <div className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-slate-600/45" />
          <span className="pointer-events-none absolute top-1.5 text-[9px] font-bold text-slate-400">
            ▲
          </span>
          <span className="pointer-events-none absolute bottom-1.5 text-[9px] font-bold text-slate-400">
            ▼
          </span>
          <span className="pointer-events-none absolute left-2 text-[9px] font-bold text-slate-400">
            ◀
          </span>
          <span className="pointer-events-none absolute right-2 text-[9px] font-bold text-slate-400">
            ▶
          </span>

          <div
            className={`pointer-events-none flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg transition-colors ${
              autoSprintVisual
                ? 'border-amber-300 bg-amber-400/35'
                : joyActive
                  ? 'border-cyan-300 bg-cyan-400/35'
                  : 'border-slate-400/80 bg-slate-800/85'
            }`}
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          >
            <div className="h-3.5 w-3.5 rounded-full bg-white/85" />
          </div>
        </div>
      </div>

      {/* 2. SPRINT LOCK BUTTON */}
      <div
        style={posStyle('sprint')}
        onPointerDown={(e) => startDragControl('sprint', e)}
        onPointerMove={(e) => moveDragControl('sprint', e)}
        onPointerUp={(e) => endDragControl('sprint', e)}
        onPointerCancel={(e) => endDragControl('sprint', e)}
        className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('sprint')}`}
      >
        <button
          type="button"
          onPointerDown={toggleSprintLock}
          aria-pressed={sprintLocked}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
            editMode ? 'pointer-events-none' : ''
          } ${
            autoSprintVisual
              ? 'border-amber-400 bg-amber-400/25 text-amber-200'
              : 'border-slate-700/80 bg-[#0B101B]/80 text-slate-300'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>{sprintLocked ? 'Correr: ON' : 'Correr'}</span>
        </button>
      </div>

      {/* 3. JUMP BUTTON */}
      <div
        style={posStyle('jump')}
        onPointerDown={(e) => startDragControl('jump', e)}
        onPointerMove={(e) => moveDragControl('jump', e)}
        onPointerUp={(e) => endDragControl('jump', e)}
        onPointerCancel={(e) => endDragControl('jump', e)}
        className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('jump')}`}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            if (editMode) return;
            e.stopPropagation();
            onJump();
          }}
          aria-label="Saltar"
          className={`flex h-12 w-14 flex-col items-center justify-center rounded-xl border border-slate-600/85 bg-[#0B101B]/85 text-slate-100 active:bg-slate-700 ${
            editMode ? 'pointer-events-none' : ''
          }`}
        >
          <ArrowUp className="h-4 w-4" />
          <span className="text-[10px] font-bold leading-none mt-0.5">Saltar</span>
        </button>
      </div>

      {/* 4. SLIDE BUTTON */}
      <div
        style={posStyle('slide')}
        onPointerDown={(e) => startDragControl('slide', e)}
        onPointerMove={(e) => moveDragControl('slide', e)}
        onPointerUp={(e) => endDragControl('slide', e)}
        onPointerCancel={(e) => endDragControl('slide', e)}
        className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('slide')}`}
      >
        <button
          type="button"
          onPointerDown={(e) => {
            if (editMode) return;
            e.stopPropagation();
            onSlide();
          }}
          aria-label="Deslizarse"
          className={`flex h-12 w-14 flex-col items-center justify-center rounded-xl border transition-colors ${
            editMode ? 'pointer-events-none' : ''
          } ${
            weaponState.isSliding
              ? 'border-cyan-300 bg-cyan-500/35 text-white'
              : 'border-cyan-500/50 bg-[#0B101B]/85 text-cyan-200 active:bg-cyan-500/30'
          }`}
        >
          <ArrowDown className="h-4 w-4" />
          <span className="text-[10px] font-bold leading-none mt-0.5">Deslizar</span>
        </button>
      </div>

      {/* 4B. CROUCH / DESCEND TOGGLE BUTTON */}
      <div
        style={posStyle('crouch')}
        onPointerDown={(e) => startDragControl('crouch', e)}
        onPointerMove={(e) => moveDragControl('crouch', e)}
        onPointerUp={(e) => endDragControl('crouch', e)}
        onPointerCancel={(e) => endDragControl('crouch', e)}
        className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('crouch')}`}
      >
        <button
          type="button"
          onPointerDown={toggleCrouchLock}
          aria-label={weaponState.canFly ? 'Bajar volando' : 'Agacharse'}
          aria-pressed={crouchLocked}
          className={`flex h-12 w-14 flex-col items-center justify-center rounded-xl border transition-colors ${
            editMode ? 'pointer-events-none' : ''
          } ${
            crouchLocked || weaponState.isCrouching
              ? 'border-emerald-300 bg-emerald-500/30 text-white'
              : 'border-slate-600/85 bg-[#0B101B]/85 text-slate-200 active:bg-slate-700'
          }`}
        >
          <ArrowDown className="h-4 w-4" />
          <span className="text-[10px] font-bold leading-none mt-0.5">
            {weaponState.canFly
              ? crouchLocked
                ? 'Bajando'
                : 'Bajar'
              : crouchLocked
                ? 'Agachado'
                : 'Agachar'}
          </span>
        </button>
      </div>

      {/* 5. AIM (ADS) BUTTON (hidden when holding knife unless editing layout) */}
      {((isCombat && !isKnifeActive) || editMode) && (
        <div
          style={posStyle('aim')}
          onPointerDown={(e) => startDragControl('aim', e)}
          onPointerMove={(e) => moveDragControl('aim', e)}
          onPointerUp={(e) => endDragControl('aim', e)}
          onPointerCancel={(e) => endDragControl('aim', e)}
          className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('aim')}`}
        >
          <button
            type="button"
            onPointerDown={toggleAimLock}
            aria-label="Apuntar (ADS)"
            aria-pressed={aimLocked}
            className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl border transition-colors ${
              editMode ? 'pointer-events-none' : ''
            } ${
              aimLocked || weaponState.isAiming
                ? 'border-amber-400 bg-amber-400/30 text-amber-200'
                : 'border-slate-700/85 bg-[#0B101B]/85 text-slate-200 active:bg-slate-800'
            }`}
          >
            <Crosshair className="h-5 w-5" />
            <span className="text-[9px] font-bold mt-0.5">Mira</span>
          </button>
        </div>
      )}

      {/* 6. RELOAD BUTTON (hidden when holding knife unless editing layout) */}
      {((isCombat && !isKnifeActive) || editMode) && (
        <div
          style={posStyle('reload')}
          onPointerDown={(e) => startDragControl('reload', e)}
          onPointerMove={(e) => moveDragControl('reload', e)}
          onPointerUp={(e) => endDragControl('reload', e)}
          onPointerCancel={(e) => endDragControl('reload', e)}
          className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('reload')}`}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              if (editMode) return;
              e.stopPropagation();
              onReload();
            }}
            disabled={!editMode && (weaponState.isReloading || weaponState.ammo >= weaponState.maxAmmo)}
            aria-label="Recargar arma"
            className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl border transition-colors ${
              editMode ? 'pointer-events-none' : ''
            } ${
              weaponState.isReloading
                ? 'border-amber-400/70 bg-amber-500/20 text-amber-300'
                : weaponState.ammo === 0
                  ? 'border-rose-500 bg-rose-500/25 text-rose-200'
                  : 'border-slate-700/85 bg-[#0B101B]/85 text-cyan-200 active:bg-slate-800 disabled:opacity-55'
            }`}
          >
            <RotateCw className={`h-4 w-4 ${weaponState.isReloading ? 'animate-spin' : ''}`} />
            <span className="font-mono-tab text-[10px] font-bold mt-0.5">
              {weaponState.isReloading
                ? `${Math.round(weaponState.reloadProgress * 100)}%`
                : `${weaponState.ammo}/${weaponState.maxAmmo}`}
            </span>
          </button>
        </div>
      )}

      {/* 7. PRIMARY FIRE / KNIFE SLASH BUTTON (visible in combat or when holding knife in lobby) */}
      {(isCombat || isKnifeActive || editMode) && (
        <div
          style={posStyle('fire')}
          onPointerDown={(e) => startDragControl('fire', e)}
          onPointerMove={(e) => moveDragControl('fire', e)}
          onPointerUp={(e) => endDragControl('fire', e)}
          onPointerCancel={(e) => endDragControl('fire', e)}
          className={`pointer-events-auto fixed z-30 touch-control ${editRingClass('fire')}`}
        >
          <button
            type="button"
            onPointerDown={(e) => {
              if (editMode) return;
              e.stopPropagation();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setFiringPressed(true);
              onFireChange(true);
            }}
            onPointerUp={(e) => {
              if (editMode) return;
              e.stopPropagation();
              e.currentTarget.releasePointerCapture?.(e.pointerId);
              setFiringPressed(false);
              onFireChange(false);
            }}
            onPointerCancel={(e) => {
              if (editMode) return;
              e.stopPropagation();
              setFiringPressed(false);
              onFireChange(false);
            }}
            onLostPointerCapture={() => {
              if (editMode) return;
              setFiringPressed(false);
              onFireChange(false);
            }}
            aria-label={isKnifeActive ? 'Cortar con cuchillo' : 'Disparar láser'}
            className={`flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 font-display text-xs font-bold shadow-xl transition-transform ${
              editMode ? 'pointer-events-none' : ''
            } ${
              firingPressed
                ? 'scale-95 border-amber-200 bg-amber-400/50 text-white'
                : isKnifeActive
                  ? 'border-cyan-300/90 bg-cyan-500/25 text-cyan-100'
                  : 'border-amber-400/85 bg-amber-400/25 text-amber-100'
            }`}
          >
            {isKnifeActive ? (
              <>
                <Swords className="h-6 w-6 mb-0.5" />
                <span>CORTE</span>
              </>
            ) : (
              <>
                <Crosshair className="h-6 w-6 mb-0.5" />
                <span>DISPARAR</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
