export type WeaponSkinId =
  | 'default'
  | 'plasma_cobalt'
  | 'solar_ember'
  | 'emerald_helix'
  | 'crimson_striker'
  | 'void_prism';

export interface WeaponSkinDefinition {
  id: WeaponSkinId;
  name: string;
  description: string;
  price: number;
  bodyHex: string;
  railHex: string;
  coreHex: string;
  gripHex: string;
  metalness: number;
  roughness: number;
}

export const WEAPON_SKINS: WeaponSkinDefinition[] = [
  {
    id: 'default',
    name: 'Titanio Estándar',
    description: 'Chasis táctico gris acero con riel magnético estándar.',
    price: 0,
    bodyHex: '#161f2e',
    railHex: '#475569',
    coreHex: '#06b6d4',
    gripHex: '#0f172a',
    metalness: 0.85,
    roughness: 0.28,
  },
  {
    id: 'plasma_cobalt',
    name: 'Cobalto Glacial',
    description: 'Acabado azul zafiro anodizado con núcleo criogénico brillante.',
    price: 120,
    bodyHex: '#0f294a',
    railHex: '#93c5fd',
    coreHex: '#38bdf8',
    gripHex: '#081426',
    metalness: 0.88,
    roughness: 0.22,
  },
  {
    id: 'crimson_striker',
    name: 'Asalto Carmesí',
    description: 'Blindaje negro carbono con riel rojo rubí de alta potencia.',
    price: 180,
    bodyHex: '#1c1917',
    railHex: '#9f1239',
    coreHex: '#fb7185',
    gripHex: '#0c0a09',
    metalness: 0.82,
    roughness: 0.3,
  },
  {
    id: 'emerald_helix',
    name: 'Hélice Esmeralda',
    description: 'Aleación verde boscoso con condensadores de plasma esmeralda.',
    price: 240,
    bodyHex: '#064e3b',
    railHex: '#6ee7b7',
    coreHex: '#10b981',
    gripHex: '#022c22',
    metalness: 0.86,
    roughness: 0.24,
  },
  {
    id: 'solar_ember',
    name: 'Forja Solar',
    description: 'Oro bruñido y bronce térmico con núcleo incandescente ámbar.',
    price: 350,
    bodyHex: '#78350f',
    railHex: '#fcd34d',
    coreHex: '#f59e0b',
    gripHex: '#291507',
    metalness: 0.92,
    roughness: 0.18,
  },
  {
    id: 'void_prism',
    name: 'Prisma del Vacío',
    description: 'Edición obsidiana iridiscente con núcleo violeta cuántico.',
    price: 500,
    bodyHex: '#18181b',
    railHex: '#a855f7',
    coreHex: '#d8b4fe',
    gripHex: '#09090b',
    metalness: 0.94,
    roughness: 0.16,
  },
];

export const VALID_WEAPON_SKIN_IDS: WeaponSkinId[] = WEAPON_SKINS.map((s) => s.id);

export function isValidWeaponSkinId(value: unknown): value is WeaponSkinId {
  return typeof value === 'string' && VALID_WEAPON_SKIN_IDS.includes(value as WeaponSkinId);
}

export function getWeaponSkinById(id: string | undefined | null): WeaponSkinDefinition {
  return WEAPON_SKINS.find((s) => s.id === id) ?? WEAPON_SKINS[0];
}
