export type WeaponGunSlot = 'primary' | 'sidearm';

export type WeaponId =
  | 'pulse_carbine'
  | 'twin_smg'
  | 'scatter_shotgun'
  | 'rail_sniper'
  | 'burst_rifle'
  | 'heavy_lmg'
  | 'plasma_cannon'
  | 'tactical_pistol'
  | 'burst_pistol'
  | 'magnum_revolver'
  | 'stinger_pistol';

export interface WeaponDefinition {
  id: WeaponId;
  slot: WeaponGunSlot;
  name: string;
  category: string;
  description: string;
  price: number;
  damage: number;
  critDamage: number;
  fireCooldownMs: number;
  boostedCooldownMs: number;
  maxAmmo: number;
  reloadDurationMs: number;
  pellets: number;
  spreadRad: number;
  adsFov: number;
  beamRadius: number;
  range: number;
}

export const WEAPONS: WeaponDefinition[] = [
  // === ARMAS LARGAS (PRIMARY) ===
  {
    id: 'pulse_carbine',
    slot: 'primary',
    name: 'Carabina de Pulso',
    category: 'Asalto Equilibrado',
    description:
      'Rifle láser versátil de precisión media con cadencia estable y recarga rápida.',
    price: 0,
    damage: 34,
    critDamage: 50,
    fireCooldownMs: 230,
    boostedCooldownMs: 135,
    maxAmmo: 12,
    reloadDurationMs: 1450,
    pellets: 1,
    spreadRad: 0,
    adsFov: 54,
    beamRadius: 0.032,
    range: 130,
  },
  {
    id: 'twin_smg',
    slot: 'primary',
    name: 'Subfusil Dual Láser',
    category: 'Alta Cadencia',
    description:
      'Chasis compacto de doble cañón que dispara ráfagas ultrarrápidas con cargador ampliado.',
    price: 220,
    damage: 20,
    critDamage: 30,
    fireCooldownMs: 115,
    boostedCooldownMs: 75,
    maxAmmo: 24,
    reloadDurationMs: 1350,
    pellets: 1,
    spreadRad: 0.016,
    adsFov: 58,
    beamRadius: 0.024,
    range: 95,
  },
  {
    id: 'burst_rifle',
    slot: 'primary',
    name: 'Rifle Pulso MK-II',
    category: 'Rifle de Precisión Táctica',
    description:
      'Carabina avanzada con mira holográfica, disparo veloz de alto alcance y estabilidad superior.',
    price: 290,
    damage: 38,
    critDamage: 58,
    fireCooldownMs: 185,
    boostedCooldownMs: 110,
    maxAmmo: 18,
    reloadDurationMs: 1400,
    pellets: 1,
    spreadRad: 0.004,
    adsFov: 48,
    beamRadius: 0.034,
    range: 145,
  },
  {
    id: 'scatter_shotgun',
    slot: 'primary',
    name: 'Escopeta Prisma',
    category: 'Corto Alcance · 5 Haces',
    description:
      'Dispara un abanico de 5 haces de plasma simultáneos letales en duelos cercanos.',
    price: 350,
    damage: 18,
    critDamage: 26,
    fireCooldownMs: 620,
    boostedCooldownMs: 420,
    maxAmmo: 6,
    reloadDurationMs: 1650,
    pellets: 5,
    spreadRad: 0.068,
    adsFov: 60,
    beamRadius: 0.022,
    range: 65,
  },
  {
    id: 'heavy_lmg',
    slot: 'primary',
    name: 'Ametralladora Titan',
    category: 'Fuego Sostenido · 36 Balas',
    description:
      'Cañón rotativo pesado con cargador masivo de 36 celdas ideal para controlar pasillos.',
    price: 440,
    damage: 25,
    critDamage: 38,
    fireCooldownMs: 128,
    boostedCooldownMs: 85,
    maxAmmo: 36,
    reloadDurationMs: 1950,
    pellets: 1,
    spreadRad: 0.02,
    adsFov: 56,
    beamRadius: 0.03,
    range: 115,
  },
  {
    id: 'rail_sniper',
    slot: 'primary',
    name: 'Rifle Francotirador Rail',
    category: 'Precisión Letal',
    description:
      'Cañón electromagnético largo con mira telescópica de zoom profundo y daño crítico masivo.',
    price: 500,
    damage: 68,
    critDamage: 105,
    fireCooldownMs: 780,
    boostedCooldownMs: 520,
    maxAmmo: 5,
    reloadDurationMs: 1750,
    pellets: 1,
    spreadRad: 0,
    adsFov: 38,
    beamRadius: 0.052,
    range: 160,
  },
  {
    id: 'plasma_cannon',
    slot: 'primary',
    name: 'Cañón Hiperplasma',
    category: 'Impacto Pesado · Doble Haz',
    description:
      'Lanzador experimental de doble núcleo hiperconcentrado capaz de destruir escudos al impacto.',
    price: 620,
    damage: 36,
    critDamage: 52,
    fireCooldownMs: 690,
    boostedCooldownMs: 460,
    maxAmmo: 8,
    reloadDurationMs: 1850,
    pellets: 2,
    spreadRad: 0.015,
    adsFov: 52,
    beamRadius: 0.064,
    range: 125,
  },

  // === PISTOLAS PEQUEÑAS (SIDEARM / SECUNDARIAS) ===
  {
    id: 'tactical_pistol',
    slot: 'sidearm',
    name: 'Pistola Pulso P-9',
    category: 'Secundaria Estándar',
    description:
      'Pistola compacta de respaldo con desenfundado veloz y recarga de menos de un segundo.',
    price: 0,
    damage: 24,
    critDamage: 38,
    fireCooldownMs: 215,
    boostedCooldownMs: 135,
    maxAmmo: 10,
    reloadDurationMs: 900,
    pellets: 1,
    spreadRad: 0.008,
    adsFov: 60,
    beamRadius: 0.022,
    range: 95,
  },
  {
    id: 'burst_pistol',
    slot: 'sidearm',
    name: 'Pistola Ráfaga VX',
    category: 'Secundaria Automática',
    description:
      'Micro-pistola automática de bolsillo ideal para rematar oponentes sin recargar el rifle.',
    price: 160,
    damage: 17,
    critDamage: 26,
    fireCooldownMs: 118,
    boostedCooldownMs: 80,
    maxAmmo: 16,
    reloadDurationMs: 960,
    pellets: 1,
    spreadRad: 0.02,
    adsFov: 62,
    beamRadius: 0.02,
    range: 80,
  },
  {
    id: 'magnum_revolver',
    slot: 'sidearm',
    name: 'Revólver Láser Magnum',
    category: 'Secundaria Alto Calibre',
    description:
      'Cañón corto de plasma denso con enorme poder de parada en formato portátil.',
    price: 280,
    damage: 44,
    critDamage: 68,
    fireCooldownMs: 460,
    boostedCooldownMs: 310,
    maxAmmo: 6,
    reloadDurationMs: 1100,
    pellets: 1,
    spreadRad: 0.003,
    adsFov: 52,
    beamRadius: 0.035,
    range: 115,
  },
  {
    id: 'stinger_pistol',
    slot: 'sidearm',
    name: 'Pistola Aguijón S-4',
    category: 'Secundaria Ligera Veloz',
    description:
      'Pistola futurista silenciada de alta precisión y recarga ultrarrápida.',
    price: 340,
    damage: 28,
    critDamage: 44,
    fireCooldownMs: 170,
    boostedCooldownMs: 110,
    maxAmmo: 12,
    reloadDurationMs: 820,
    pellets: 1,
    spreadRad: 0.004,
    adsFov: 56,
    beamRadius: 0.024,
    range: 105,
  },
];

export const PRIMARY_WEAPONS: WeaponDefinition[] = WEAPONS.filter(
  (w) => w.slot === 'primary',
);

export const SIDEARM_WEAPONS: WeaponDefinition[] = WEAPONS.filter(
  (w) => w.slot === 'sidearm',
);

export const VALID_WEAPON_IDS: WeaponId[] = WEAPONS.map((w) => w.id);
export const VALID_PRIMARY_WEAPON_IDS: WeaponId[] = PRIMARY_WEAPONS.map((w) => w.id);
export const VALID_SIDEARM_WEAPON_IDS: WeaponId[] = SIDEARM_WEAPONS.map((w) => w.id);

export function isValidWeaponId(value: unknown): value is WeaponId {
  return typeof value === 'string' && VALID_WEAPON_IDS.includes(value as WeaponId);
}

export function isPrimaryWeapon(id: string | undefined | null): boolean {
  return VALID_PRIMARY_WEAPON_IDS.includes(id as WeaponId);
}

export function isSidearmWeapon(id: string | undefined | null): boolean {
  return VALID_SIDEARM_WEAPON_IDS.includes(id as WeaponId);
}

export function getWeaponById(id: string | undefined | null): WeaponDefinition {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}

export function getSidearmById(id: string | undefined | null): WeaponDefinition {
  return SIDEARM_WEAPONS.find((w) => w.id === id) ?? SIDEARM_WEAPONS[0];
}
