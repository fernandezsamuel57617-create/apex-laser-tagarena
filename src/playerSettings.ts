export type GraphicsQuality = 'low' | 'medium' | 'high';

export type TouchControlId =
  | 'joystick'
  | 'sprint'
  | 'fire'
  | 'aim'
  | 'reload'
  | 'jump'
  | 'slide'
  | 'crouch';

export interface TouchButtonPos {
  xPct: number;
  yPct: number;
}

export type TouchLayoutMap = Record<TouchControlId, TouchButtonPos>;

export interface PlayerSettings {
  sensitivity: number;
  graphicsQuality: GraphicsQuality;
  touchButtonScale: number;
  touchLayout: TouchLayoutMap;
}

export const DEFAULT_TOUCH_LAYOUT: TouchLayoutMap = {
  joystick: { xPct: 16, yPct: 77 },
  sprint: { xPct: 12, yPct: 58 },
  fire: { xPct: 87, yPct: 77 },
  jump: { xPct: 71, yPct: 82 },
  slide: { xPct: 71, yPct: 68 },
  crouch: { xPct: 58, yPct: 82 },
  aim: { xPct: 79, yPct: 55 },
  reload: { xPct: 91, yPct: 55 },
};

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  sensitivity: 1.0,
  graphicsQuality: 'high',
  touchButtonScale: 1.0,
  touchLayout: { ...DEFAULT_TOUCH_LAYOUT },
};

const SETTINGS_STORAGE_KEY = 'apex_laser_tag_settings_v1';

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeTouchLayout(raw: unknown): TouchLayoutMap {
  const out: TouchLayoutMap = {
    joystick: { ...DEFAULT_TOUCH_LAYOUT.joystick },
    sprint: { ...DEFAULT_TOUCH_LAYOUT.sprint },
    fire: { ...DEFAULT_TOUCH_LAYOUT.fire },
    aim: { ...DEFAULT_TOUCH_LAYOUT.aim },
    reload: { ...DEFAULT_TOUCH_LAYOUT.reload },
    jump: { ...DEFAULT_TOUCH_LAYOUT.jump },
    slide: { ...DEFAULT_TOUCH_LAYOUT.slide },
    crouch: { ...DEFAULT_TOUCH_LAYOUT.crouch },
  };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Partial<Record<TouchControlId, Partial<TouchButtonPos>>>;
  (Object.keys(out) as TouchControlId[]).forEach((key) => {
    const item = obj[key];
    if (item && typeof item === 'object') {
      out[key] = {
        xPct: clampNum(item.xPct, 7, 93, out[key].xPct),
        yPct: clampNum(item.yPct, 14, 91, out[key].yPct),
      };
    }
  });
  return out;
}

export function loadPlayerSettings(): PlayerSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_PLAYER_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
    const quality: GraphicsQuality =
      parsed.graphicsQuality === 'low' ||
      parsed.graphicsQuality === 'medium' ||
      parsed.graphicsQuality === 'high'
        ? parsed.graphicsQuality
        : DEFAULT_PLAYER_SETTINGS.graphicsQuality;

    return {
      sensitivity: clampNum(parsed.sensitivity, 0.3, 2.5, DEFAULT_PLAYER_SETTINGS.sensitivity),
      graphicsQuality: quality,
      touchButtonScale: clampNum(
        parsed.touchButtonScale,
        0.75,
        1.35,
        DEFAULT_PLAYER_SETTINGS.touchButtonScale,
      ),
      touchLayout: sanitizeTouchLayout(parsed.touchLayout),
    };
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
}

export function savePlayerSettings(settings: PlayerSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
