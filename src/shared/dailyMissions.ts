export type DailyMissionId =
  | 'elim_5'
  | 'win_2'
  | 'play_3'
  | 'streak_3';

export interface DailyMissionDef {
  id: DailyMissionId;
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
}

export interface DailyMissionsProgress {
  dateKey: string;
  elims: number;
  wins: number;
  matches: number;
  bestStreak: number;
  claimedIds: DailyMissionId[];
}

export const DAILY_MISSIONS: DailyMissionDef[] = [
  {
    id: 'elim_5',
    title: 'Cazador de Arena',
    description: 'Consigue 5 eliminaciones en partidas hoy',
    target: 5,
    rewardCoins: 60,
  },
  {
    id: 'win_2',
    title: 'Campeón Diario',
    description: 'Gana 2 partidas en la arena hoy',
    target: 2,
    rewardCoins: 120,
  },
  {
    id: 'play_3',
    title: 'Veterano Activo',
    description: 'Completa 3 partidas hoy',
    target: 3,
    rewardCoins: 50,
  },
  {
    id: 'streak_3',
    title: 'Racha Imparable',
    description: 'Alcanza una racha de 3 eliminaciones seguidas',
    target: 3,
    rewardCoins: 75,
  },
];

export function isValidDailyMissionId(val: unknown): val is DailyMissionId {
  return val === 'elim_5' || val === 'win_2' || val === 'play_3' || val === 'streak_3';
}

export function getDailyMissionById(id: DailyMissionId): DailyMissionDef {
  return DAILY_MISSIONS.find((m) => m.id === id) ?? DAILY_MISSIONS[0];
}

export function getTodayDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createEmptyDailyMissions(dateKey = getTodayDateKey()): DailyMissionsProgress {
  return {
    dateKey,
    elims: 0,
    wins: 0,
    matches: 0,
    bestStreak: 0,
    claimedIds: [],
  };
}

export function ensureTodayDailyMissions(
  current: DailyMissionsProgress | null | undefined,
  todayKey = getTodayDateKey(),
): DailyMissionsProgress {
  if (!current || current.dateKey !== todayKey) {
    return createEmptyDailyMissions(todayKey);
  }
  return {
    dateKey: todayKey,
    elims: Math.max(0, Math.min(500, Math.floor(current.elims || 0))),
    wins: Math.max(0, Math.min(100, Math.floor(current.wins || 0))),
    matches: Math.max(0, Math.min(200, Math.floor(current.matches || 0))),
    bestStreak: Math.max(0, Math.min(100, Math.floor(current.bestStreak || 0))),
    claimedIds: Array.from(new Set((current.claimedIds ?? []).filter(isValidDailyMissionId))).slice(0, 4),
  };
}

export function applyMatchStatsToDailyMissions(
  current: DailyMissionsProgress | null | undefined,
  stats: { tags: number; won: boolean; bestStreak: number },
  todayKey = getTodayDateKey(),
): DailyMissionsProgress {
  const base = ensureTodayDailyMissions(current, todayKey);
  return {
    ...base,
    elims: Math.min(500, base.elims + Math.max(0, Math.floor(stats.tags))),
    wins: Math.min(100, base.wins + (stats.won ? 1 : 0)),
    matches: Math.min(200, base.matches + 1),
    bestStreak: Math.min(100, Math.max(base.bestStreak, Math.floor(stats.bestStreak))),
  };
}

export function getMissionCurrentValue(
  mission: DailyMissionDef,
  progress: DailyMissionsProgress,
): number {
  switch (mission.id) {
    case 'elim_5':
      return Math.min(mission.target, progress.elims);
    case 'win_2':
      return Math.min(mission.target, progress.wins);
    case 'play_3':
      return Math.min(mission.target, progress.matches);
    case 'streak_3':
      return Math.min(mission.target, progress.bestStreak);
  }
}

export function isMissionCompleted(
  mission: DailyMissionDef,
  progress: DailyMissionsProgress,
): boolean {
  return getMissionCurrentValue(mission, progress) >= mission.target;
}
