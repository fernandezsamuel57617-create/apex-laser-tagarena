export type KnifeId =
  | 'tactical_blade'
  | 'karambit_neon'
  | 'katana_edge'
  | 'cyber_butterfly'
  | 'plasma_dagger';

export interface KnifeDefinition {
  id: KnifeId;
  name: string;
  category: string;
  description: string;
  price: number;
  damage: number;
  critDamage: number;
  cooldownMs: number;
  range: number;
  speedBonus: number;
  bladeHex: string;
  edgeHex: string;
  handleHex: string;
}

export const KNIVES: KnifeDefinition[] = [
  {
    id: 'tactical_blade',
    name: 'Cuchillo Táctico C-1',
    category: 'Combate Estándar',
    description:
      'Hoja compacta de titanio con filo cian energizado. Ligero y siempre listo con la tecla G.',
    price: 0,
    damage: 48,
    critDamage: 72,
    cooldownMs: 440,
    range: 3.15,
    speedBonus: 1.14,
    bladeHex: '#334155',
    edgeHex: '#22d3ee',
    handleHex: '#0f172a',
  },
  {
    id: 'karambit_neon',
    name: 'Karambit Neón',
    category: 'Corte Veloz',
    description:
      'Garra curva de fibra oscura con anillo táctico y filo carmesí de recuperación ultrarrápida.',
    price: 180,
    damage: 52,
    critDamage: 80,
    cooldownMs: 360,
    range: 3.05,
    speedBonus: 1.17,
    bladeHex: '#1e1b24',
    edgeHex: '#fb7185',
    handleHex: '#881337',
  },
  {
    id: 'katana_edge',
    name: 'Wakizashi Cibernético',
    category: 'Alcance Extendido',
    description:
      'Hoja recta alargada de acero cuántico con mayor alcance cuerpo a cuerpo y corte esmeralda.',
    price: 320,
    damage: 58,
    critDamage: 88,
    cooldownMs: 490,
    range: 3.65,
    speedBonus: 1.13,
    bladeHex: '#1e293b',
    edgeHex: '#34d399',
    handleHex: '#064e3b',
  },
  {
    id: 'cyber_butterfly',
    name: 'Mariposa Cuántica',
    category: 'Ágil · Doble Filo',
    description:
      'Balisong futurista con núcleo violeta prismático, cadencia rápida y movilidad máxima.',
    price: 420,
    damage: 55,
    critDamage: 85,
    cooldownMs: 350,
    range: 3.2,
    speedBonus: 1.18,
    bladeHex: '#27272a',
    edgeHex: '#c084fc',
    handleHex: '#3b0764',
  },
  {
    id: 'plasma_dagger',
    name: 'Daga Solar Apex',
    category: 'Hoja Élite Dorada',
    description:
      'Daga de plasma sobrecalentado capaz de atravesar escudos con daño crítico devastador.',
    price: 550,
    damage: 66,
    critDamage: 98,
    cooldownMs: 420,
    range: 3.35,
    speedBonus: 1.16,
    bladeHex: '#292524',
    edgeHex: '#fbbf24',
    handleHex: '#78350f',
  },
];

export const VALID_KNIFE_IDS: KnifeId[] = KNIVES.map((k) => k.id);

export function isValidKnifeId(value: unknown): value is KnifeId {
  return typeof value === 'string' && VALID_KNIFE_IDS.includes(value as KnifeId);
}

export function getKnifeById(id: string | undefined | null): KnifeDefinition {
  return KNIVES.find((k) => k.id === id) ?? KNIVES[0];
}
