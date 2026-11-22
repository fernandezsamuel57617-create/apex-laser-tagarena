export type RankTierId = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master';

export interface RankTierDefinition {
  id: RankTierId;
  name: string;
  minWins: number;
  primaryHex: string;
  secondaryHex: string;
  glowHex: string;
  badgeClass: string;
  textClass: string;
  description: string;
}

export const RANK_TIERS: RankTierDefinition[] = [
  {
    id: 'bronze',
    name: 'Bronce',
    minWins: 0,
    primaryHex: '#CD7F32',
    secondaryHex: '#92400E',
    glowHex: '#F59E0B',
    badgeClass: 'border-amber-700/80 bg-amber-950/60 text-amber-300',
    textClass: 'text-amber-400',
    description: '0–2 victorias en Modo Rangos',
  },
  {
    id: 'silver',
    name: 'Plata',
    minWins: 3,
    primaryHex: '#E2E8F0',
    secondaryHex: '#64748B',
    glowHex: '#CBD5E1',
    badgeClass: 'border-slate-300/70 bg-slate-700/40 text-slate-100',
    textClass: 'text-slate-200',
    description: '3–6 victorias en Modo Rangos',
  },
  {
    id: 'gold',
    name: 'Oro',
    minWins: 7,
    primaryHex: '#FACC15',
    secondaryHex: '#CA8A04',
    glowHex: '#FDE047',
    badgeClass: 'border-amber-400/80 bg-amber-500/20 text-amber-300',
    textClass: 'text-amber-300',
    description: '7–12 victorias en Modo Rangos',
  },
  {
    id: 'diamond',
    name: 'Diamante',
    minWins: 13,
    primaryHex: '#38BDF8',
    secondaryHex: '#0284C7',
    glowHex: '#7DD3FC',
    badgeClass: 'border-cyan-400/80 bg-cyan-500/20 text-cyan-200',
    textClass: 'text-cyan-300',
    description: '13–21 victorias en Modo Rangos',
  },
  {
    id: 'master',
    name: 'Maestro',
    minWins: 22,
    primaryHex: '#C084FC',
    secondaryHex: '#7E22CE',
    glowHex: '#F43F5E',
    badgeClass: 'border-purple-400/80 bg-purple-600/25 text-purple-200',
    textClass: 'text-purple-300',
    description: '22+ victorias en Modo Rangos',
  },
];

export function getRankByWins(rankedWins: number): RankTierDefinition {
  const safeWins = Number.isFinite(rankedWins) ? Math.max(0, Math.floor(rankedWins)) : 0;
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (safeWins >= tier.minWins) {
      current = tier;
    }
  }
  return current;
}

export function getNextRankProgress(rankedWins: number): {
  current: RankTierDefinition;
  next: RankTierDefinition | null;
  winsIntoTier: number;
  winsNeededForNext: number;
  pct: number;
} {
  const safeWins = Number.isFinite(rankedWins) ? Math.max(0, Math.floor(rankedWins)) : 0;
  const current = getRankByWins(safeWins);
  const idx = RANK_TIERS.findIndex((t) => t.id === current.id);
  const next = idx >= 0 && idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
  if (!next) {
    return {
      current,
      next: null,
      winsIntoTier: safeWins - current.minWins,
      winsNeededForNext: 0,
      pct: 100,
    };
  }
  const span = Math.max(1, next.minWins - current.minWins);
  const winsIntoTier = Math.max(0, safeWins - current.minWins);
  return {
    current,
    next,
    winsIntoTier,
    winsNeededForNext: Math.max(0, next.minWins - safeWins),
    pct: Math.min(100, Math.round((winsIntoTier / span) * 100)),
  };
}
