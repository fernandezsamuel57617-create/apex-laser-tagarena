export type OutfitId =
  | 'default'
  | 'cyber_crimson'
  | 'neon_phantom'
  | 'emerald_viper'
  | 'solar_gold'
  | 'obsidian_royale'
  | 'arctic_stealth'
  | 'volcanic_titan'
  | 'cyber_samurai'
  | 'celestial_nova';

export interface OutfitDefinition {
  id: OutfitId;
  name: string;
  description: string;
  price: number;
  topHex: string;
  pantsHex: string;
  shoeHex: string;
  vestHex: string;
  trimHex: string;
  hasShoulderPads: boolean;
  hasVisor: boolean;
  hasCollar: boolean;
}

export const MAX_OUTFIT_LEVEL = 4;

export const OUTFIT_UPGRADE_COSTS: Record<number, number> = {
  1: 100, // Lv 1 -> Lv 2
  2: 180, // Lv 2 -> Lv 3
  3: 300, // Lv 3 -> Lv 4
};

export const OUTFITS: OutfitDefinition[] = [
  {
    id: 'default',
    name: 'Traje Urbano',
    description: 'Traje táctico ligero de recluta con chaleco estándar de entrenamiento.',
    price: 0,
    topHex: '#2b5b84',
    pantsHex: '#224163',
    shoeHex: '#f8fafc',
    vestHex: '#111827',
    trimHex: '#06b6d4',
    hasShoulderPads: false,
    hasVisor: false,
    hasCollar: false,
  },
  {
    id: 'cyber_crimson',
    name: 'Traje Asalto Carmesí',
    description: 'Blindaje negro mate con hombreras reforzadas y visor táctico rojo.',
    price: 150,
    topHex: '#1e1b24',
    pantsHex: '#131118',
    shoeHex: '#e11d48',
    vestHex: '#881337',
    trimHex: '#fb7185',
    hasShoulderPads: true,
    hasVisor: true,
    hasCollar: false,
  },
  {
    id: 'neon_phantom',
    name: 'Traje Espectro Titanio',
    description: 'Traje blanco aeroespacial con líneas cian de alta visibilidad.',
    price: 250,
    topHex: '#e2e8f0',
    pantsHex: '#334155',
    shoeHex: '#06b6d4',
    vestHex: '#0f172a',
    trimHex: '#22d3ee',
    hasShoulderPads: true,
    hasVisor: true,
    hasCollar: false,
  },
  {
    id: 'arctic_stealth',
    name: 'Traje Fantasma Ártico',
    description: 'Camuflaje glacial blanco y azul hielo con cuello táctico polar.',
    price: 280,
    topHex: '#cbd5e1',
    pantsHex: '#1e293b',
    shoeHex: '#38bdf8',
    vestHex: '#0c4a6e',
    trimHex: '#7dd3fc',
    hasShoulderPads: true,
    hasVisor: false,
    hasCollar: true,
  },
  {
    id: 'emerald_viper',
    name: 'Traje Víbora Esmeralda',
    description: 'Uniforme sigiloso verde bosque con placa pectoral esmeralda.',
    price: 300,
    topHex: '#14532d',
    pantsHex: '#0f291e',
    shoeHex: '#10b981',
    vestHex: '#064e3b',
    trimHex: '#34d399',
    hasShoulderPads: true,
    hasVisor: false,
    hasCollar: true,
  },
  {
    id: 'volcanic_titan',
    name: 'Traje Titán Volcánico',
    description: 'Placas de basalto oscuro con visor ígneo y núcleos naranja fundido.',
    price: 360,
    topHex: '#292524',
    pantsHex: '#1c1917',
    shoeHex: '#f97316',
    vestHex: '#7c2d12',
    trimHex: '#fb923c',
    hasShoulderPads: true,
    hasVisor: true,
    hasCollar: false,
  },
  {
    id: 'solar_gold',
    name: 'Traje Élite Dorada',
    description: 'Armadura metálica dorada de campeón con visor polarizado ámbar.',
    price: 400,
    topHex: '#b45309',
    pantsHex: '#1c1917',
    shoeHex: '#fbbf24',
    vestHex: '#451a03',
    trimHex: '#fcd34d',
    hasShoulderPads: true,
    hasVisor: true,
    hasCollar: true,
  },
  {
    id: 'cyber_samurai',
    name: 'Traje Ronin Neón',
    description: 'Armadura cibernética índigo con hombreras angulares y detalles magenta.',
    price: 480,
    topHex: '#1e1b4b',
    pantsHex: '#0f172a',
    shoeHex: '#ec4899',
    vestHex: '#500724',
    trimHex: '#f472b6',
    hasShoulderPads: true,
    hasVisor: true,
    hasCollar: true,
  },
  {
    id: 'obsidian_royale',
    name: 'Traje Comandante Obsidiana',
    description: 'Armadura completa grafito con cuello alto, hombreras y núcleo violeta.',
    price: 600,
    topHex: '#18181b',
    pantsHex: '#09090b',
    shoeHex: '#a855f7',
    vestHex: '#3b0764',
    trimHex: '#c084fc',
    hasShoulderPads: true,
    hasVisor: true,
    hasCollar: true,
  },
  {
    id: 'celestial_nova',
    name: 'Traje Nova Celestial',
    description: 'Exotraje legendario azul real con visor dorado e injertos de plasma puro.',
    price: 750,
    topHex: '#0f172a',
    pantsHex: '#172554',
    shoeHex: '#38bdf8',
    vestHex: '#1e3a8a',
    trimHex: '#fde047',
    hasShoulderPads: true,
    hasVisor: true,
    hasCollar: true,
  },
];

export const VALID_OUTFIT_IDS: OutfitId[] = OUTFITS.map((o) => o.id);

export function isValidOutfitId(value: unknown): value is OutfitId {
  return typeof value === 'string' && VALID_OUTFIT_IDS.includes(value as OutfitId);
}

export function getOutfitById(id: string | undefined | null): OutfitDefinition {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}

export function clampOutfitLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(MAX_OUTFIT_LEVEL, Math.floor(level)));
}

export function getOutfitLevel(
  levels: Partial<Record<OutfitId, number>> | undefined | null,
  outfitId: OutfitId,
): number {
  if (!levels || typeof levels !== 'object') return 1;
  return clampOutfitLevel(levels[outfitId]);
}

export function getOutfitUpgradeCost(currentLevel: number): number | null {
  const lvl = clampOutfitLevel(currentLevel);
  if (lvl >= MAX_OUTFIT_LEVEL) return null;
  return OUTFIT_UPGRADE_COSTS[lvl] ?? null;
}

export function getOutfitBonusHp(level: number): number {
  return (clampOutfitLevel(level) - 1) * 10;
}

export function getOutfitMaxHp(level: number): number {
  return 100 + getOutfitBonusHp(level);
}

export function getOutfitLevelTitle(level: number): string {
  const lvl = clampOutfitLevel(level);
  if (lvl === 1) return 'Nv. 1 · Estándar';
  if (lvl === 2) return 'Nv. 2 · Reforzado';
  if (lvl === 3) return 'Nv. 3 · Blindado';
  return 'Nv. 4 · Élite Maestro';
}

export function sanitizeOutfitLevels(
  raw: unknown,
  ownedOutfits?: OutfitId[],
): Partial<Record<OutfitId, number>> {
  const result: Partial<Record<OutfitId, number>> = { default: 1 };
  if (ownedOutfits) {
    for (const id of ownedOutfits) {
      if (isValidOutfitId(id)) {
        result[id] = 1;
      }
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (isValidOutfitId(k)) {
        result[k] = clampOutfitLevel(v);
      }
    }
  }
  return result;
}
