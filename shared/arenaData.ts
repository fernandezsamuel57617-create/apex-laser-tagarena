import type { ArenaMapId, BoostPadSnapshot, LobbyTargetSnapshot, Vec3, ZoneId } from './types.ts';

export interface ArenaBox {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  kind: 'wall' | 'cover' | 'platform' | 'ramp' | 'beacon' | 'obby';
  accent?: string;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface ZoneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type ArenaFloorPattern =
  | 'cyber_grid'
  | 'sky_cloud'
  | 'obsidian_hex'
  | 'colosseum_tile'
  | 'arctic_ice'
  | 'volcanic_lava'
  | 'sandstone_ruin'
  | 'orbital_deck';

export interface ArenaMapTheme {
  skyHex: string;
  fogHex: string;
  fogDensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  keyHex: string;
  keyIntensity: number;
  rimHex: string;
  rimIntensity: number;
  wallHex: string;
  platformHex: string;
  floorBaseHex: string;
  floorTileHex: string;
  wallRoughness: number;
  wallMetalness: number;
  floorPattern: ArenaFloorPattern;
  propStyle:
    | 'reactor'
    | 'sky'
    | 'obsidian'
    | 'colosseum'
    | 'arctic'
    | 'volcanic'
    | 'temple'
    | 'orbital';
}

export interface ArenaMapConfig {
  id: ArenaMapId;
  name: string;
  subtitle: string;
  floorGridHex: string;
  floorAccentHex: string;
  theme: ArenaMapTheme;
  boxes: ArenaBox[];
  spawns: SpawnPoint[];
  boostPads: BoostPadSnapshot[];
}

export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.78;
export const PLAYER_EYE_HEIGHT = 1.56;
export const GRAVITY = 24;
export const JUMP_VELOCITY = 9.4;
export const MOVE_SPEED = 8.4;
export const SPRINT_SPEED_MULTIPLIER = 1.45;

// External Sky-Lobby positioned completely outside the Combat Arena (North of z = -38, elevated at y = 4.0)
export const LOBBY_CENTER_Z = -80;
export const LOBBY_FLOOR_Y = 4.0;
export const LOBBY_HALF_SIZE = 22;
export const ARENA_HALF_SIZE = 38;

export const LOBBY_BOUNDS: ZoneBounds = {
  minX: -LOBBY_HALF_SIZE,
  maxX: LOBBY_HALF_SIZE,
  minZ: LOBBY_CENTER_Z - LOBBY_HALF_SIZE, // -102
  maxZ: LOBBY_CENTER_Z + LOBBY_HALF_SIZE, // -58
};

export const ARENA_BOUNDS: ZoneBounds = {
  minX: -ARENA_HALF_SIZE,
  maxX: ARENA_HALF_SIZE,
  minZ: -ARENA_HALF_SIZE,
  maxZ: ARENA_HALF_SIZE,
};

export const LOBBY_START_PAD = {
  x: 0,
  y: LOBBY_FLOOR_Y,
  z: LOBBY_CENTER_Z + 12, // -68
  radius: 2.35,
};

export const OBBY_FINISH_PAD = {
  x: -14.5,
  y: LOBBY_FLOOR_Y + 4.05,
  z: LOBBY_CENTER_Z - 15.5, // -95.5, atop obby_balcony
  radius: 2.15,
};

function makeBox(
  id: string,
  cx: number,
  bottomY: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  kind: ArenaBox['kind'],
  accent?: string,
): ArenaBox {
  return {
    id,
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minY: bottomY,
    maxY: bottomY + h,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
    kind,
    accent,
  };
}

// Enclosed External Sky-Lobby & Obby Course (combat map stays hidden while inside Lobby/Obby)
export const LOBBY_BOXES: ArenaBox[] = [
  makeBox('l_deck_base', 0, 0, LOBBY_CENTER_Z, LOBBY_HALF_SIZE * 2, LOBBY_FLOOR_Y, LOBBY_HALF_SIZE * 2, 'platform', '#06b6d4'),

  // Full enclosed perimeter walls around the Lobby & Obby
  makeBox('l_wall_n', 0, LOBBY_FLOOR_Y, LOBBY_CENTER_Z - LOBBY_HALF_SIZE - 0.5, LOBBY_HALF_SIZE * 2 + 2, 6.0, 1, 'wall', '#06b6d4'),
  makeBox('l_wall_s_rail', 0, LOBBY_FLOOR_Y, LOBBY_CENTER_Z + LOBBY_HALF_SIZE + 0.5, LOBBY_HALF_SIZE * 2 + 2, 6.0, 1, 'wall', '#10b981'),
  makeBox('l_wall_w', -LOBBY_HALF_SIZE - 0.5, LOBBY_FLOOR_Y, LOBBY_CENTER_Z, 1, 6.0, LOBBY_HALF_SIZE * 2 + 2, 'wall', '#f59e0b'),
  makeBox('l_wall_e', LOBBY_HALF_SIZE + 0.5, LOBBY_FLOOR_Y, LOBBY_CENTER_Z, 1, 6.0, LOBBY_HALF_SIZE * 2 + 2, 'wall', '#f59e0b'),

  // Staging Start Dais (South side of External Lobby)
  makeBox('l_start_dais', 0, LOBBY_FLOOR_Y, LOBBY_START_PAD.z, 6.2, 0.25, 6.2, 'platform', '#10b981'),
  makeBox('l_arch_l', -4.2, LOBBY_FLOOR_Y, LOBBY_START_PAD.z, 0.9, 4.2, 0.9, 'beacon', '#10b981'),
  makeBox('l_arch_r', 4.2, LOBBY_FLOOR_Y, LOBBY_START_PAD.z, 0.9, 4.2, 0.9, 'beacon', '#10b981'),

  // Obby Parkour Course on the West Side of the External Lobby
  makeBox('obby_1', -10, LOBBY_FLOOR_Y, LOBBY_CENTER_Z + 10, 3.6, 0.85, 3.6, 'obby', '#06b6d4'),
  makeBox('obby_2', -14.0, LOBBY_FLOOR_Y, LOBBY_CENTER_Z + 6.0, 3.4, 1.55, 3.4, 'obby', '#06b6d4'),
  makeBox('obby_3', -14.5, LOBBY_FLOOR_Y, LOBBY_CENTER_Z + 0.5, 3.2, 2.25, 3.2, 'obby', '#f59e0b'),
  makeBox('obby_4', -14.0, LOBBY_FLOOR_Y, LOBBY_CENTER_Z - 5.0, 3.2, 2.95, 3.2, 'obby', '#f59e0b'),
  makeBox('obby_5', -11.2, LOBBY_FLOOR_Y, LOBBY_CENTER_Z - 9.6, 3.2, 3.55, 3.2, 'obby', '#10b981'),
  makeBox('obby_balcony', -14.5, LOBBY_FLOOR_Y + 3.55, LOBBY_CENTER_Z - 15.5, 7.5, 0.5, 6.0, 'platform', '#10b981'),
  makeBox('obby_pillar_l', -17.5, LOBBY_FLOOR_Y, LOBBY_CENTER_Z - 18, 1.1, 3.55, 1.1, 'cover'),
  makeBox('obby_pillar_r', -11.5, LOBBY_FLOOR_Y, LOBBY_CENTER_Z - 18, 1.1, 3.55, 1.1, 'cover'),

  // Lobby Central Tactical Seating & Chill Cover
  makeBox('l_cover_mid1', 6.5, LOBBY_FLOOR_Y, LOBBY_CENTER_Z + 5.5, 3.0, 1.6, 1.2, 'cover'),
  makeBox('l_cover_mid2', -4.5, LOBBY_FLOOR_Y, LOBBY_CENTER_Z + 2.5, 3.0, 1.6, 1.2, 'cover'),
];

export const LOBBY_SPAWNS: SpawnPoint[] = [
  { x: 0, y: LOBBY_FLOOR_Y, z: LOBBY_CENTER_Z - 8, yaw: Math.PI },
  { x: -3.5, y: LOBBY_FLOOR_Y, z: LOBBY_CENTER_Z - 10, yaw: Math.PI - 0.15 },
  { x: 3.5, y: LOBBY_FLOOR_Y, z: LOBBY_CENTER_Z - 10, yaw: Math.PI + 0.15 },
  { x: -6, y: LOBBY_FLOOR_Y, z: LOBBY_CENTER_Z - 6, yaw: Math.PI - 0.25 },
  { x: 6, y: LOBBY_FLOOR_Y, z: LOBBY_CENTER_Z - 6, yaw: Math.PI + 0.25 },
  { x: 0, y: LOBBY_FLOOR_Y, z: LOBBY_CENTER_Z - 13, yaw: Math.PI },
];

export const INITIAL_LOBBY_TARGETS: LobbyTargetSnapshot[] = [];

const DEFAULT_SPAWNS: SpawnPoint[] = [
  { x: -30, y: 0, z: -30, yaw: -Math.PI * 0.75 },
  { x: 30, y: 0, z: -30, yaw: Math.PI * 0.75 },
  { x: -30, y: 0, z: 30, yaw: -Math.PI * 0.25 },
  { x: 30, y: 0, z: 30, yaw: Math.PI * 0.25 },
  { x: 0, y: 0, z: -32, yaw: Math.PI },
  { x: 0, y: 0, z: 32, yaw: 0 },
  { x: -32, y: 0, z: 0, yaw: -Math.PI / 2 },
  { x: 32, y: 0, z: 0, yaw: Math.PI / 2 },
];

function makePerimeterWalls(c1: string, c2: string): ArenaBox[] {
  return [
    makeBox('a_wall_n', 0, 0, -ARENA_HALF_SIZE - 0.75, ARENA_HALF_SIZE * 2 + 3, 8.5, 1.5, 'wall', c1),
    makeBox('a_wall_s', 0, 0, ARENA_HALF_SIZE + 0.75, ARENA_HALF_SIZE * 2 + 3, 8.5, 1.5, 'wall', c2),
    makeBox('a_wall_w', -ARENA_HALF_SIZE - 0.75, 0, 0, 1.5, 8.5, ARENA_HALF_SIZE * 2 + 3, 'wall', c1),
    makeBox('a_wall_e', ARENA_HALF_SIZE + 0.75, 0, 0, 1.5, 8.5, ARENA_HALF_SIZE * 2 + 3, 'wall', c2),
  ];
}

// MAP 1: Reactor Central
const NEON_REACTOR_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#06b6d4', '#f43f5e'),
  makeBox('a_center_deck', 0, 0, 0, 11.0, 2.4, 11.0, 'platform', '#06b6d4'),
  makeBox('a_center_beacon', 0, 2.4, 0, 2.2, 4.8, 2.2, 'beacon', '#06b6d4'),
  makeBox('a_step_n1', 0, 0, -8.8, 4.4, 0.8, 2.6, 'platform', '#06b6d4'),
  makeBox('a_step_n2', 0, 0, -6.7, 4.4, 1.6, 2.4, 'platform', '#06b6d4'),
  makeBox('a_step_s1', 0, 0, 8.8, 4.4, 0.8, 2.6, 'platform', '#f43f5e'),
  makeBox('a_step_s2', 0, 0, 6.7, 4.4, 1.6, 2.4, 'platform', '#f43f5e'),
  makeBox('a_tower_w', -24, 0, 0, 6.4, 2.2, 10.0, 'platform', '#06b6d4'),
  makeBox('a_tower_w_step1', -24, 0, -7.2, 3.6, 0.75, 2.4, 'platform'),
  makeBox('a_tower_w_step2', -24, 0, -5.4, 3.6, 1.5, 2.2, 'platform'),
  makeBox('a_tower_w_shield', -20.9, 2.2, 0, 0.45, 1.15, 5.5, 'cover', '#06b6d4'),
  makeBox('a_tower_e', 24, 0, 0, 6.4, 2.2, 10.0, 'platform', '#f59e0b'),
  makeBox('a_tower_e_step1', 24, 0, 7.2, 3.6, 0.75, 2.4, 'platform'),
  makeBox('a_tower_e_step2', 24, 0, 5.4, 3.6, 1.5, 2.2, 'platform'),
  makeBox('a_tower_e_shield', 20.9, 2.2, 0, 0.45, 1.15, 5.5, 'cover', '#f59e0b'),
  makeBox('a_q1_wall1', 12, 0, -14, 6.5, 3.2, 1.4, 'cover', '#06b6d4'),
  makeBox('a_q1_wall2', 14.5, 0, -11.2, 1.4, 3.2, 5.0, 'cover', '#06b6d4'),
  makeBox('a_q1_low', 8.5, 0, -24, 5.0, 1.45, 1.6, 'cover'),
  makeBox('a_q1_pillar', 23, 0, -21, 2.8, 5.2, 2.8, 'beacon', '#f59e0b'),
  makeBox('a_q2_wall1', -12, 0, -14, 6.5, 3.2, 1.4, 'cover', '#06b6d4'),
  makeBox('a_q2_wall2', -14.5, 0, -11.2, 1.4, 3.2, 5.0, 'cover', '#06b6d4'),
  makeBox('a_q2_low', -8.5, 0, -24, 5.0, 1.45, 1.6, 'cover'),
  makeBox('a_q2_pillar', -23, 0, -21, 2.8, 5.2, 2.8, 'beacon', '#06b6d4'),
  makeBox('a_q3_wall1', -12, 0, 14, 6.5, 3.2, 1.4, 'cover', '#f43f5e'),
  makeBox('a_q3_wall2', -14.5, 0, 11.2, 1.4, 3.2, 5.0, 'cover', '#f43f5e'),
  makeBox('a_q3_low', -8.5, 0, 24, 5.0, 1.45, 1.6, 'cover'),
  makeBox('a_q3_pillar', -23, 0, 21, 2.8, 5.2, 2.8, 'beacon', '#f43f5e'),
  makeBox('a_q4_wall1', 12, 0, 14, 6.5, 3.2, 1.4, 'cover', '#f43f5e'),
  makeBox('a_q4_wall2', 14.5, 0, 11.2, 1.4, 3.2, 5.0, 'cover', '#f43f5e'),
  makeBox('a_q4_low', 8.5, 0, 24, 5.0, 1.45, 1.6, 'cover'),
  makeBox('a_q4_pillar', 23, 0, 21, 2.8, 5.2, 2.8, 'beacon', '#f59e0b'),
  makeBox('a_mid_nw', -11, 0, 0, 2.4, 3.6, 2.4, 'cover'),
  makeBox('a_mid_ne', 11, 0, 0, 2.4, 3.6, 2.4, 'cover'),
  makeBox('a_mid_n', 0, 0, -21, 7.0, 2.6, 1.6, 'cover', '#06b6d4'),
  makeBox('a_mid_s', 0, 0, 21, 7.0, 2.6, 1.6, 'cover', '#f43f5e'),
];

// MAP 2: Ciudadela Aérea (elevated skybridges & corner bastions)
const SKY_CITADEL_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#10b981', '#f59e0b'),
  // Central Citadel High Platform & Beacon
  makeBox('c_center_plat', 0, 0, 0, 10.0, 2.2, 10.0, 'platform', '#10b981'),
  makeBox('c_center_core', 0, 2.2, 0, 1.8, 4.4, 1.8, 'beacon', '#f59e0b'),
  // Elevated West & East Skybridges connected to center
  makeBox('c_bridge_w', -15.0, 1.6, 0, 20.0, 0.6, 4.2, 'platform', '#10b981'),
  makeBox('c_bridge_e', 15.0, 1.6, 0, 20.0, 0.6, 4.2, 'platform', '#f59e0b'),
  makeBox('c_step_w1', -26.5, 0, 0, 2.8, 0.8, 4.2, 'platform', '#10b981'),
  makeBox('c_step_w2', -24.5, 0, 0, 2.4, 1.5, 4.2, 'platform', '#10b981'),
  makeBox('c_step_e1', 26.5, 0, 0, 2.8, 0.8, 4.2, 'platform', '#f59e0b'),
  makeBox('c_step_e2', 24.5, 0, 0, 2.4, 1.5, 4.2, 'platform', '#f59e0b'),
  // North & South Ramps up to Center
  makeBox('c_step_n1', 0, 0, -8.6, 4.2, 0.75, 2.5, 'platform', '#10b981'),
  makeBox('c_step_n2', 0, 0, -6.5, 4.2, 1.5, 2.4, 'platform', '#10b981'),
  makeBox('c_step_s1', 0, 0, 8.6, 4.2, 0.75, 2.5, 'platform', '#f59e0b'),
  makeBox('c_step_s2', 0, 0, 6.5, 4.2, 1.5, 2.4, 'platform', '#f59e0b'),
  // 4 Raised Corner Bastions with steps
  makeBox('c_bastion_nw', -20, 0, -20, 8.0, 1.8, 8.0, 'platform', '#10b981'),
  makeBox('c_bastion_nw_s', -20, 0, -14.8, 3.6, 0.9, 2.4, 'platform'),
  makeBox('c_bastion_ne', 20, 0, -20, 8.0, 1.8, 8.0, 'platform', '#f59e0b'),
  makeBox('c_bastion_ne_s', 20, 0, -14.8, 3.6, 0.9, 2.4, 'platform'),
  makeBox('c_bastion_sw', -20, 0, 20, 8.0, 1.8, 8.0, 'platform', '#10b981'),
  makeBox('c_bastion_sw_s', -20, 0, 14.8, 3.6, 0.9, 2.4, 'platform'),
  makeBox('c_bastion_se', 20, 0, 20, 8.0, 1.8, 8.0, 'platform', '#f59e0b'),
  makeBox('c_bastion_se_s', 20, 0, 14.8, 3.6, 0.9, 2.4, 'platform'),
  // Tactical Ground Cover Blocks
  makeBox('c_cov_n', 0, 0, -21, 9.0, 2.4, 1.6, 'cover', '#10b981'),
  makeBox('c_cov_s', 0, 0, 21, 9.0, 2.4, 1.6, 'cover', '#f59e0b'),
  makeBox('c_pillar_nw', -10, 0, -11, 2.2, 4.4, 2.2, 'beacon', '#10b981'),
  makeBox('c_pillar_ne', 10, 0, -11, 2.2, 4.4, 2.2, 'beacon', '#f59e0b'),
  makeBox('c_pillar_sw', -10, 0, 11, 2.2, 4.4, 2.2, 'beacon', '#10b981'),
  makeBox('c_pillar_se', 10, 0, 11, 2.2, 4.4, 2.2, 'beacon', '#f59e0b'),
];

// MAP 3: Laberinto Obsidiana (close-quarters corridors & central bunker)
const OBSIDIAN_MAZE_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#f43f5e', '#38bdf8'),
  // Central Raised Bunker Deck
  makeBox('m_hub_base', 0, 0, 0, 8.4, 1.5, 8.4, 'platform', '#f43f5e'),
  makeBox('m_hub_pillar', 0, 1.5, 0, 2.0, 4.5, 2.0, 'beacon', '#38bdf8'),
  makeBox('m_hub_step_n', 0, 0, -5.4, 3.4, 0.75, 2.4, 'platform'),
  makeBox('m_hub_step_s', 0, 0, 5.4, 3.4, 0.75, 2.4, 'platform'),
  // Inner Ring Labyrinth Walls (with crisp corridor gaps)
  makeBox('m_ring_n1', -8.5, 0, -12, 8.0, 3.5, 1.6, 'cover', '#38bdf8'),
  makeBox('m_ring_n2', 8.5, 0, -12, 8.0, 3.5, 1.6, 'cover', '#f43f5e'),
  makeBox('m_ring_s1', -8.5, 0, 12, 8.0, 3.5, 1.6, 'cover', '#f43f5e'),
  makeBox('m_ring_s2', 8.5, 0, 12, 8.0, 3.5, 1.6, 'cover', '#38bdf8'),
  makeBox('m_ring_w1', -12, 0, -5.5, 1.6, 3.5, 6.0, 'cover', '#38bdf8'),
  makeBox('m_ring_w2', -12, 0, 5.5, 1.6, 3.5, 6.0, 'cover', '#f43f5e'),
  makeBox('m_ring_e1', 12, 0, -5.5, 1.6, 3.5, 6.0, 'cover', '#f43f5e'),
  makeBox('m_ring_e2', 12, 0, 5.5, 1.6, 3.5, 6.0, 'cover', '#38bdf8'),
  // Outer Flanking Corridors & Low Cover
  makeBox('m_out_n', 0, 0, -23, 12.0, 3.2, 1.8, 'cover', '#38bdf8'),
  makeBox('m_out_s', 0, 0, 23, 12.0, 3.2, 1.8, 'cover', '#f43f5e'),
  makeBox('m_out_w', -23, 0, 0, 1.8, 3.2, 12.0, 'cover', '#38bdf8'),
  makeBox('m_out_e', 23, 0, 0, 1.8, 3.2, 12.0, 'cover', '#f43f5e'),
  makeBox('m_cor_nw1', -21, 0, -17, 6.5, 2.8, 1.5, 'cover'),
  makeBox('m_cor_nw2', -17, 0, -21, 1.5, 2.8, 6.5, 'cover'),
  makeBox('m_cor_ne1', 21, 0, -17, 6.5, 2.8, 1.5, 'cover'),
  makeBox('m_cor_ne2', 17, 0, -21, 1.5, 2.8, 6.5, 'cover'),
  makeBox('m_cor_sw1', -21, 0, 17, 6.5, 2.8, 1.5, 'cover'),
  makeBox('m_cor_sw2', -17, 0, 21, 1.5, 2.8, 6.5, 'cover'),
  makeBox('m_cor_se1', 21, 0, 17, 6.5, 2.8, 1.5, 'cover'),
  makeBox('m_cor_se2', 17, 0, 21, 1.5, 2.8, 6.5, 'cover'),
];

// MAP 4: Coliseo Cibernético (concentric colosseum tiers, radial steps & coral/gold cover)
const CYBER_COLOSSEUM_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#fb7185', '#fbbf24'),
  // Central Gladiators Ring
  makeBox('cc_center_ring', 0, 0, 0, 9.2, 1.4, 9.2, 'platform', '#fbbf24'),
  makeBox('cc_center_obelisk', 0, 1.4, 0, 2.0, 4.6, 2.0, 'beacon', '#fb7185'),
  makeBox('cc_step_n', 0, 0, -5.8, 3.6, 0.7, 2.4, 'platform', '#fb7185'),
  makeBox('cc_step_s', 0, 0, 5.8, 3.6, 0.7, 2.4, 'platform', '#fbbf24'),
  makeBox('cc_step_w', -5.8, 0, 0, 2.4, 0.7, 3.6, 'platform', '#fb7185'),
  makeBox('cc_step_e', 5.8, 0, 0, 2.4, 0.7, 3.6, 'platform', '#fbbf24'),
  // Outer Elevated Amphitheater Balconies (N/S/W/E)
  makeBox('cc_balc_n', 0, 0, -24, 18.0, 2.0, 5.5, 'platform', '#fb7185'),
  makeBox('cc_balc_n_l', -10.5, 0, -24, 3.0, 1.0, 4.0, 'platform'),
  makeBox('cc_balc_n_r', 10.5, 0, -24, 3.0, 1.0, 4.0, 'platform'),
  makeBox('cc_balc_s', 0, 0, 24, 18.0, 2.0, 5.5, 'platform', '#fbbf24'),
  makeBox('cc_balc_s_l', -10.5, 0, 24, 3.0, 1.0, 4.0, 'platform'),
  makeBox('cc_balc_s_r', 10.5, 0, 24, 3.0, 1.0, 4.0, 'platform'),
  makeBox('cc_balc_w', -24, 0, 0, 5.5, 2.0, 18.0, 'platform', '#fb7185'),
  makeBox('cc_balc_w_t', -24, 0, -10.5, 4.0, 1.0, 3.0, 'platform'),
  makeBox('cc_balc_w_b', -24, 0, 10.5, 4.0, 1.0, 3.0, 'platform'),
  makeBox('cc_balc_e', 24, 0, 0, 5.5, 2.0, 18.0, 'platform', '#fbbf24'),
  makeBox('cc_balc_e_t', 24, 0, -10.5, 4.0, 1.0, 3.0, 'platform'),
  makeBox('cc_balc_e_b', 24, 0, 10.5, 4.0, 1.0, 3.0, 'platform'),
  // Radial Pillars & Curved Ring Shields
  makeBox('cc_pil_nw', -13.5, 0, -13.5, 2.6, 5.2, 2.6, 'beacon', '#fb7185'),
  makeBox('cc_pil_ne', 13.5, 0, -13.5, 2.6, 5.2, 2.6, 'beacon', '#fbbf24'),
  makeBox('cc_pil_sw', -13.5, 0, 13.5, 2.6, 5.2, 2.6, 'beacon', '#fb7185'),
  makeBox('cc_pil_se', 13.5, 0, 13.5, 2.6, 5.2, 2.6, 'beacon', '#fbbf24'),
  makeBox('cc_cov_nw', -15, 0, -7.5, 4.2, 2.2, 1.5, 'cover', '#fb7185'),
  makeBox('cc_cov_ne', 15, 0, -7.5, 4.2, 2.2, 1.5, 'cover', '#fbbf24'),
  makeBox('cc_cov_sw', -15, 0, 7.5, 4.2, 2.2, 1.5, 'cover', '#fb7185'),
  makeBox('cc_cov_se', 15, 0, 7.5, 4.2, 2.2, 1.5, 'cover', '#fbbf24'),
];

// MAP 5: Bastión Ártico (twin sniper towers, crystalline monoliths & flanking lanes)
const ARCTIC_BASTION_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#38bdf8', '#bae6fd'),
  // Twin Ice Fortress Watchtowers (NW & SE)
  makeBox('ab_tower_nw', -19, 0, -19, 7.6, 2.6, 7.6, 'platform', '#38bdf8'),
  makeBox('ab_tower_nw_s1', -19, 0, -13.2, 3.4, 0.9, 2.6, 'platform'),
  makeBox('ab_tower_nw_s2', -19, 0, -11.0, 3.4, 1.8, 2.4, 'platform'),
  makeBox('ab_tower_nw_sh', -15.4, 2.6, -19, 0.45, 1.15, 5.2, 'cover', '#bae6fd'),
  makeBox('ab_tower_se', 19, 0, 19, 7.6, 2.6, 7.6, 'platform', '#38bdf8'),
  makeBox('ab_tower_se_s1', 19, 0, 13.2, 3.4, 0.9, 2.6, 'platform'),
  makeBox('ab_tower_se_s2', 19, 0, 11.0, 3.4, 1.8, 2.4, 'platform'),
  makeBox('ab_tower_se_sh', 15.4, 2.6, 19, 0.45, 1.15, 5.2, 'cover', '#bae6fd'),
  // Central Cryo Spire & Split Trenches
  makeBox('ab_mid_core', 0, 0, 0, 3.2, 6.2, 3.2, 'beacon', '#38bdf8'),
  makeBox('ab_mid_pad_w', -6.5, 0, 0, 4.8, 1.2, 7.2, 'platform', '#bae6fd'),
  makeBox('ab_mid_pad_e', 6.5, 0, 0, 4.8, 1.2, 7.2, 'platform', '#bae6fd'),
  // Diagonal Glacial Monoliths & Ice Shields
  makeBox('ab_mono_ne1', 18, 0, -18, 3.0, 4.8, 3.0, 'beacon', '#bae6fd'),
  makeBox('ab_mono_sw1', -18, 0, 18, 3.0, 4.8, 3.0, 'beacon', '#bae6fd'),
  makeBox('ab_ice_n', 0, 0, -16, 11.0, 2.4, 1.6, 'cover', '#38bdf8'),
  makeBox('ab_ice_s', 0, 0, 16, 11.0, 2.4, 1.6, 'cover', '#38bdf8'),
  makeBox('ab_ice_w', -26, 0, 4, 1.6, 2.8, 9.5, 'cover', '#bae6fd'),
  makeBox('ab_ice_e', 26, 0, -4, 1.6, 2.8, 9.5, 'cover', '#bae6fd'),
  makeBox('ab_low_ne', 11, 0, -10, 4.5, 1.4, 1.6, 'cover'),
  makeBox('ab_low_sw', -11, 0, 10, 4.5, 1.4, 1.6, 'cover'),
];

// MAP 6: Forja Volcánica (industrial elevated catwalks & central crucible deck)
const VOLCANIC_FORGE_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#f97316', '#facc15'),
  // Central Crucible Foundry Platform
  makeBox('vf_crucible', 0, 0, 0, 12.0, 2.0, 12.0, 'platform', '#f97316'),
  makeBox('vf_reactor_core', 0, 2.0, 0, 2.4, 5.0, 2.4, 'beacon', '#facc15'),
  // Four Diagonal Elevated Catwalks linking to Crucible
  makeBox('vf_catwalk_n', 0, 1.6, -15, 4.2, 0.5, 18.0, 'platform', '#f97316'),
  makeBox('vf_catwalk_s', 0, 1.6, 15, 4.2, 0.5, 18.0, 'platform', '#f97316'),
  makeBox('vf_catwalk_w', -15, 1.6, 0, 18.0, 0.5, 4.2, 'platform', '#facc15'),
  makeBox('vf_catwalk_e', 15, 1.6, 0, 18.0, 0.5, 4.2, 'platform', '#facc15'),
  // Stairs up to Catwalks
  makeBox('vf_step_n', 0, 0, -25.5, 4.2, 0.85, 3.0, 'platform', '#f97316'),
  makeBox('vf_step_s', 0, 0, 25.5, 4.2, 0.85, 3.0, 'platform', '#f97316'),
  makeBox('vf_step_w', -25.5, 0, 0, 3.0, 0.85, 4.2, 'platform', '#facc15'),
  makeBox('vf_step_e', 25.5, 0, 0, 3.0, 0.85, 4.2, 'platform', '#facc15'),
  // Corner Smelter Furnaces & Blast Walls
  makeBox('vf_smelt_nw', -20, 0, -20, 4.6, 4.5, 4.6, 'beacon', '#f97316'),
  makeBox('vf_smelt_ne', 20, 0, -20, 4.6, 4.5, 4.6, 'beacon', '#facc15'),
  makeBox('vf_smelt_sw', -20, 0, 20, 4.6, 4.5, 4.6, 'beacon', '#facc15'),
  makeBox('vf_smelt_se', 20, 0, 20, 4.6, 4.5, 4.6, 'beacon', '#f97316'),
  makeBox('vf_wall_nw', -12, 0, -12, 5.5, 2.4, 1.5, 'cover', '#f97316'),
  makeBox('vf_wall_ne', 12, 0, -12, 5.5, 2.4, 1.5, 'cover', '#facc15'),
  makeBox('vf_wall_sw', -12, 0, 12, 5.5, 2.4, 1.5, 'cover', '#facc15'),
  makeBox('vf_wall_se', 12, 0, 12, 5.5, 2.4, 1.5, 'cover', '#f97316'),
];

// MAP 7: Templo Solar (desert sandstone stepped pyramid, turquoise sanctuaries & palm/obelisk perimeter)
const SOLAR_TEMPLE_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#f59e0b', '#14b8a6'),
  // Central Stepped Sun Pyramid
  makeBox('st_pyr_1', 0, 0, 0, 14.0, 1.1, 14.0, 'platform', '#f59e0b'),
  makeBox('st_pyr_2', 0, 1.1, 0, 9.4, 1.1, 9.4, 'platform', '#14b8a6'),
  makeBox('st_pyr_3', 0, 2.2, 0, 5.2, 1.1, 5.2, 'platform', '#fbbf24'),
  makeBox('st_sun_totem', 0, 3.3, 0, 1.8, 4.2, 1.8, 'beacon', '#fbbf24'),
  // Pyramid cardinal access steps
  makeBox('st_step_n', 0, 0, -8.4, 4.0, 0.55, 2.8, 'platform', '#f59e0b'),
  makeBox('st_step_s', 0, 0, 8.4, 4.0, 0.55, 2.8, 'platform', '#f59e0b'),
  makeBox('st_step_w', -8.4, 0, 0, 2.8, 0.55, 4.0, 'platform', '#14b8a6'),
  makeBox('st_step_e', 8.4, 0, 0, 2.8, 0.55, 4.0, 'platform', '#14b8a6'),
  // Four Ruined Sandstone Sanctuaries
  makeBox('st_sanct_nw', -21, 0, -21, 7.6, 1.8, 7.6, 'platform', '#14b8a6'),
  makeBox('st_sanct_nw_step', -21, 0, -15.8, 3.6, 0.9, 2.8, 'platform'),
  makeBox('st_sanct_ne', 21, 0, -21, 7.6, 1.8, 7.6, 'platform', '#f59e0b'),
  makeBox('st_sanct_ne_step', 21, 0, -15.8, 3.6, 0.9, 2.8, 'platform'),
  makeBox('st_sanct_sw', -21, 0, 21, 7.6, 1.8, 7.6, 'platform', '#f59e0b'),
  makeBox('st_sanct_sw_step', -21, 0, 15.8, 3.6, 0.9, 2.8, 'platform'),
  makeBox('st_sanct_se', 21, 0, 21, 7.6, 1.8, 7.6, 'platform', '#14b8a6'),
  makeBox('st_sanct_se_step', 21, 0, 15.8, 3.6, 0.9, 2.8, 'platform'),
  // Carved Sandstone Pillars & Ruin Cover Walls
  makeBox('st_ob_nw', -12.5, 0, -12.5, 2.2, 5.4, 2.2, 'beacon', '#fbbf24'),
  makeBox('st_ob_ne', 12.5, 0, -12.5, 2.2, 5.4, 2.2, 'beacon', '#14b8a6'),
  makeBox('st_ob_sw', -12.5, 0, 12.5, 2.2, 5.4, 2.2, 'beacon', '#14b8a6'),
  makeBox('st_ob_se', 12.5, 0, 12.5, 2.2, 5.4, 2.2, 'beacon', '#fbbf24'),
  makeBox('st_ruin_n', 0, 0, -23.5, 9.5, 2.5, 1.6, 'cover', '#f59e0b'),
  makeBox('st_ruin_s', 0, 0, 23.5, 9.5, 2.5, 1.6, 'cover', '#14b8a6'),
  makeBox('st_ruin_w', -23.5, 0, 0, 1.6, 2.5, 9.5, 'cover', '#14b8a6'),
  makeBox('st_ruin_e', 23.5, 0, 0, 1.6, 2.5, 9.5, 'cover', '#f59e0b'),
];

// MAP 8: Estación Orbital (space station titanium hangar, gravity rings & cargo bays)
const ORBITAL_STATION_BOXES: ArenaBox[] = [
  ...makePerimeterWalls('#818cf8', '#22d3ee'),
  // Central Zero-G Reactor Ring Deck
  makeBox('os_hub', 0, 0, 0, 10.4, 1.8, 10.4, 'platform', '#818cf8'),
  makeBox('os_core', 0, 1.8, 0, 2.0, 5.2, 2.0, 'beacon', '#22d3ee'),
  makeBox('os_ramp_w', -6.8, 0, 0, 3.2, 0.9, 4.2, 'platform', '#818cf8'),
  makeBox('os_ramp_e', 6.8, 0, 0, 3.2, 0.9, 4.2, 'platform', '#22d3ee'),
  // Elevated North & South Docking Bays
  makeBox('os_bay_n', 0, 0, -22, 16.0, 2.0, 6.4, 'platform', '#22d3ee'),
  makeBox('os_bay_n_s1', -9.8, 0, -22, 3.4, 1.0, 4.0, 'platform'),
  makeBox('os_bay_n_s2', 9.8, 0, -22, 3.4, 1.0, 4.0, 'platform'),
  makeBox('os_bay_s', 0, 0, 22, 16.0, 2.0, 6.4, 'platform', '#818cf8'),
  makeBox('os_bay_s_s1', -9.8, 0, 22, 3.4, 1.0, 4.0, 'platform'),
  makeBox('os_bay_s_s2', 9.8, 0, 22, 3.4, 1.0, 4.0, 'platform'),
  // Space Cargo Pods & Shield Bulkheads
  makeBox('os_pod_nw1', -18, 0, -14, 4.6, 3.0, 2.2, 'cover', '#22d3ee'),
  makeBox('os_pod_ne1', 18, 0, -14, 4.6, 3.0, 2.2, 'cover', '#818cf8'),
  makeBox('os_pod_sw1', -18, 0, 14, 4.6, 3.0, 2.2, 'cover', '#818cf8'),
  makeBox('os_pod_se1', 18, 0, 14, 4.6, 3.0, 2.2, 'cover', '#22d3ee'),
  makeBox('os_wing_w', -26, 0, 0, 2.2, 3.6, 12.0, 'cover', '#818cf8'),
  makeBox('os_wing_e', 26, 0, 0, 2.2, 3.6, 12.0, 'cover', '#22d3ee'),
  makeBox('os_pylon_nw', -12, 0, -11, 2.0, 5.0, 2.0, 'beacon', '#22d3ee'),
  makeBox('os_pylon_ne', 12, 0, -11, 2.0, 5.0, 2.0, 'beacon', '#818cf8'),
  makeBox('os_pylon_sw', -12, 0, 11, 2.0, 5.0, 2.0, 'beacon', '#818cf8'),
  makeBox('os_pylon_se', 12, 0, 11, 2.0, 5.0, 2.0, 'beacon', '#22d3ee'),
];

export const ARENA_MAPS: Record<ArenaMapId, ArenaMapConfig> = {
  neon_reactor: {
    id: 'neon_reactor',
    name: 'Reactor Central',
    subtitle: 'Arena ciber-neón clásica con núcleo eléctrico y torres laterales',
    floorGridHex: '#1e3a5f',
    floorAccentHex: '#06b6d4',
    theme: {
      skyHex: '#070e1a',
      fogHex: '#081224',
      fogDensity: 0.0068,
      hemiSkyHex: '#7dd3fc',
      hemiGroundHex: '#0f172a',
      hemiIntensity: 0.95,
      keyHex: '#e0f2fe',
      keyIntensity: 1.4,
      rimHex: '#06b6d4',
      rimIntensity: 0.75,
      wallHex: '#1c2a42',
      platformHex: '#16253b',
      floorBaseHex: '#0a1220',
      floorTileHex: '#0e192c',
      wallRoughness: 0.45,
      wallMetalness: 0.55,
      floorPattern: 'cyber_grid',
      propStyle: 'reactor',
    },
    boxes: NEON_REACTOR_BOXES,
    spawns: DEFAULT_SPAWNS,
    boostPads: [
      { id: 'boost_center', kind: 'overcharge', x: 0, y: 2.4, z: 3.4, active: true },
      { id: 'boost_west', kind: 'shield', x: -24, y: 2.2, z: 0, active: true },
      { id: 'boost_east', kind: 'shield', x: 24, y: 2.2, z: 0, active: true },
      { id: 'boost_north', kind: 'overcharge', x: 0, y: 0, z: -26, active: true },
      { id: 'boost_south', kind: 'overcharge', x: 0, y: 0, z: 26, active: true },
    ],
  },
  sky_citadel: {
    id: 'sky_citadel',
    name: 'Ciudadela Aérea',
    subtitle: 'Cielo azul soleado con mármol celeste, nubes y puentes elevados',
    floorGridHex: '#94d2bd',
    floorAccentHex: '#10b981',
    theme: {
      skyHex: '#1d5b8c',
      fogHex: '#256fa3',
      fogDensity: 0.0052,
      hemiSkyHex: '#e0f7ff',
      hemiGroundHex: '#1e4d4f',
      hemiIntensity: 1.2,
      keyHex: '#fff9e6',
      keyIntensity: 1.75,
      rimHex: '#34d399',
      rimIntensity: 0.65,
      wallHex: '#cbd5e1',
      platformHex: '#e2e8f0',
      floorBaseHex: '#1f3b4d',
      floorTileHex: '#274c63',
      wallRoughness: 0.38,
      wallMetalness: 0.25,
      floorPattern: 'sky_cloud',
      propStyle: 'sky',
    },
    boxes: SKY_CITADEL_BOXES,
    spawns: DEFAULT_SPAWNS,
    boostPads: [
      { id: 'boost_c_center', kind: 'overcharge', x: 0, y: 2.2, z: 3.2, active: true },
      { id: 'boost_c_west', kind: 'shield', x: -18, y: 2.2, z: 0, active: true },
      { id: 'boost_c_east', kind: 'shield', x: 18, y: 2.2, z: 0, active: true },
      { id: 'boost_c_north', kind: 'overcharge', x: 0, y: 0, z: -28, active: true },
      { id: 'boost_c_south', kind: 'overcharge', x: 0, y: 0, z: 28, active: true },
    ],
  },
  obsidian_maze: {
    id: 'obsidian_maze',
    name: 'Laberinto Obsidiana',
    subtitle: 'Pasillos oscuros de vidrio volcánico carmesí y neón violeta',
    floorGridHex: '#581c4f',
    floorAccentHex: '#f43f5e',
    theme: {
      skyHex: '#100614',
      fogHex: '#17081c',
      fogDensity: 0.0095,
      hemiSkyHex: '#f472b6',
      hemiGroundHex: '#09030c',
      hemiIntensity: 0.8,
      keyHex: '#fecdd3',
      keyIntensity: 1.25,
      rimHex: '#f43f5e',
      rimIntensity: 0.9,
      wallHex: '#181124',
      platformHex: '#231636',
      floorBaseHex: '#0b0612',
      floorTileHex: '#140b21',
      wallRoughness: 0.22,
      wallMetalness: 0.78,
      floorPattern: 'obsidian_hex',
      propStyle: 'obsidian',
    },
    boxes: OBSIDIAN_MAZE_BOXES,
    spawns: [
      { x: -31, y: 0, z: -31, yaw: -Math.PI * 0.75 },
      { x: 31, y: 0, z: -31, yaw: Math.PI * 0.75 },
      { x: -31, y: 0, z: 31, yaw: -Math.PI * 0.25 },
      { x: 31, y: 0, z: 31, yaw: Math.PI * 0.25 },
      { x: 0, y: 0, z: -33, yaw: Math.PI },
      { x: 0, y: 0, z: 33, yaw: 0 },
      { x: -33, y: 0, z: 0, yaw: -Math.PI / 2 },
      { x: 33, y: 0, z: 0, yaw: Math.PI / 2 },
    ],
    boostPads: [
      { id: 'boost_m_center', kind: 'overcharge', x: 0, y: 1.5, z: 2.5, active: true },
      { id: 'boost_m_nw', kind: 'shield', x: -24, y: 0, z: -24, active: true },
      { id: 'boost_m_se', kind: 'shield', x: 24, y: 0, z: 24, active: true },
      { id: 'boost_m_ne', kind: 'overcharge', x: 24, y: 0, z: -24, active: true },
      { id: 'boost_m_sw', kind: 'overcharge', x: -24, y: 0, z: 24, active: true },
    ],
  },
  cyber_colosseum: {
    id: 'cyber_colosseum',
    name: 'Coliseo Cibernético',
    subtitle: 'Anfiteatro imperial dorado y coral bajo un crepúsculo púrpura',
    floorGridHex: '#78354f',
    floorAccentHex: '#fbbf24',
    theme: {
      skyHex: '#25122e',
      fogHex: '#2e1638',
      fogDensity: 0.0064,
      hemiSkyHex: '#fde68a',
      hemiGroundHex: '#261026',
      hemiIntensity: 1.0,
      keyHex: '#fef3c7',
      keyIntensity: 1.55,
      rimHex: '#fb7185',
      rimIntensity: 0.8,
      wallHex: '#4a2b3f',
      platformHex: '#5c3649',
      floorBaseHex: '#231326',
      floorTileHex: '#331c36',
      wallRoughness: 0.58,
      wallMetalness: 0.35,
      floorPattern: 'colosseum_tile',
      propStyle: 'colosseum',
    },
    boxes: CYBER_COLOSSEUM_BOXES,
    spawns: DEFAULT_SPAWNS,
    boostPads: [
      { id: 'boost_cc_center', kind: 'overcharge', x: 0, y: 1.4, z: 2.8, active: true },
      { id: 'boost_cc_n', kind: 'shield', x: 0, y: 2.0, z: -24, active: true },
      { id: 'boost_cc_s', kind: 'shield', x: 0, y: 2.0, z: 24, active: true },
      { id: 'boost_cc_w', kind: 'overcharge', x: -24, y: 2.0, z: 0, active: true },
      { id: 'boost_cc_e', kind: 'overcharge', x: 24, y: 2.0, z: 0, active: true },
    ],
  },
  arctic_bastion: {
    id: 'arctic_bastion',
    name: 'Bastión Ártico',
    subtitle: 'Fortaleza glacial con nieve cayendo, torres heladas y cristales',
    floorGridHex: '#7dd3fc',
    floorAccentHex: '#38bdf8',
    theme: {
      skyHex: '#153a5b',
      fogHex: '#1f4e78',
      fogDensity: 0.0078,
      hemiSkyHex: '#e0f2fe',
      hemiGroundHex: '#1e3a5f',
      hemiIntensity: 1.25,
      keyHex: '#f0f9ff',
      keyIntensity: 1.65,
      rimHex: '#7dd3fc',
      rimIntensity: 0.85,
      wallHex: '#bfdcf0',
      platformHex: '#dbeafe',
      floorBaseHex: '#16354d',
      floorTileHex: '#1f4968',
      wallRoughness: 0.25,
      wallMetalness: 0.18,
      floorPattern: 'arctic_ice',
      propStyle: 'arctic',
    },
    boxes: ARCTIC_BASTION_BOXES,
    spawns: [
      { x: -30, y: 0, z: 30, yaw: -Math.PI * 0.25 },
      { x: 30, y: 0, z: -30, yaw: Math.PI * 0.75 },
      { x: -30, y: 0, z: -4, yaw: -Math.PI * 0.5 },
      { x: 30, y: 0, z: 4, yaw: Math.PI * 0.5 },
      { x: 0, y: 0, z: -31, yaw: Math.PI },
      { x: 0, y: 0, z: 31, yaw: 0 },
      { x: -12, y: 0, z: 28, yaw: 0 },
      { x: 12, y: 0, z: -28, yaw: Math.PI },
    ],
    boostPads: [
      { id: 'boost_ab_w', kind: 'overcharge', x: -6.5, y: 1.2, z: 0, active: true },
      { id: 'boost_ab_e', kind: 'overcharge', x: 6.5, y: 1.2, z: 0, active: true },
      { id: 'boost_ab_nw', kind: 'shield', x: -19, y: 2.6, z: -19, active: true },
      { id: 'boost_ab_se', kind: 'shield', x: 19, y: 2.6, z: 19, active: true },
    ],
  },
  volcanic_forge: {
    id: 'volcanic_forge',
    name: 'Forja Volcánica',
    subtitle: 'Basalto ardiente, grietas de magma brillante y brasas flotantes',
    floorGridHex: '#ea580c',
    floorAccentHex: '#f97316',
    theme: {
      skyHex: '#260b06',
      fogHex: '#331008',
      fogDensity: 0.0082,
      hemiSkyHex: '#fdba74',
      hemiGroundHex: '#1f0805',
      hemiIntensity: 0.9,
      keyHex: '#ffedd5',
      keyIntensity: 1.45,
      rimHex: '#f97316',
      rimIntensity: 1.0,
      wallHex: '#291a16',
      platformHex: '#38221b',
      floorBaseHex: '#1a0b08',
      floorTileHex: '#29120d',
      wallRoughness: 0.72,
      wallMetalness: 0.28,
      floorPattern: 'volcanic_lava',
      propStyle: 'volcanic',
    },
    boxes: VOLCANIC_FORGE_BOXES,
    spawns: DEFAULT_SPAWNS,
    boostPads: [
      { id: 'boost_vf_center', kind: 'overcharge', x: 0, y: 2.0, z: 3.4, active: true },
      { id: 'boost_vf_n', kind: 'shield', x: 0, y: 2.1, z: -15, active: true },
      { id: 'boost_vf_s', kind: 'shield', x: 0, y: 2.1, z: 15, active: true },
      { id: 'boost_vf_w', kind: 'overcharge', x: -15, y: 2.1, z: 0, active: true },
      { id: 'boost_vf_e', kind: 'overcharge', x: 15, y: 2.1, z: 0, active: true },
    ],
  },
  solar_temple: {
    id: 'solar_temple',
    name: 'Templo Solar',
    subtitle: 'Pirámide de arenisca dorada en el desierto con detalles turquesa',
    floorGridHex: '#d97706',
    floorAccentHex: '#f59e0b',
    theme: {
      skyHex: '#7c4318',
      fogHex: '#925220',
      fogDensity: 0.0056,
      hemiSkyHex: '#fef08a',
      hemiGroundHex: '#451a03',
      hemiIntensity: 1.15,
      keyHex: '#fffbeb',
      keyIntensity: 1.85,
      rimHex: '#14b8a6',
      rimIntensity: 0.65,
      wallHex: '#b8884f',
      platformHex: '#cfa165',
      floorBaseHex: '#59371b',
      floorTileHex: '#6e4523',
      wallRoughness: 0.82,
      wallMetalness: 0.08,
      floorPattern: 'sandstone_ruin',
      propStyle: 'temple',
    },
    boxes: SOLAR_TEMPLE_BOXES,
    spawns: DEFAULT_SPAWNS,
    boostPads: [
      { id: 'boost_st_top', kind: 'overcharge', x: 0, y: 3.3, z: 1.9, active: true },
      { id: 'boost_st_nw', kind: 'shield', x: -21, y: 1.8, z: -21, active: true },
      { id: 'boost_st_se', kind: 'shield', x: 21, y: 1.8, z: 21, active: true },
      { id: 'boost_st_ne', kind: 'overcharge', x: 21, y: 1.8, z: -21, active: true },
      { id: 'boost_st_sw', kind: 'overcharge', x: -21, y: 1.8, z: 21, active: true },
    ],
  },
  orbital_station: {
    id: 'orbital_station',
    name: 'Estación Orbital',
    subtitle: 'Cubierta espacial de titanio con anillos orbitales y vista estelar',
    floorGridHex: '#4f46e5',
    floorAccentHex: '#22d3ee',
    theme: {
      skyHex: '#030512',
      fogHex: '#06091f',
      fogDensity: 0.0046,
      hemiSkyHex: '#a5b4fc',
      hemiGroundHex: '#090d24',
      hemiIntensity: 0.9,
      keyHex: '#eef2ff',
      keyIntensity: 1.5,
      rimHex: '#818cf8',
      rimIntensity: 0.95,
      wallHex: '#64748b',
      platformHex: '#475569',
      floorBaseHex: '#0b1024',
      floorTileHex: '#131b38',
      wallRoughness: 0.3,
      wallMetalness: 0.78,
      floorPattern: 'orbital_deck',
      propStyle: 'orbital',
    },
    boxes: ORBITAL_STATION_BOXES,
    spawns: DEFAULT_SPAWNS,
    boostPads: [
      { id: 'boost_os_center', kind: 'overcharge', x: 0, y: 1.8, z: 3.2, active: true },
      { id: 'boost_os_n', kind: 'shield', x: 0, y: 2.0, z: -22, active: true },
      { id: 'boost_os_s', kind: 'shield', x: 0, y: 2.0, z: 22, active: true },
      { id: 'boost_os_w', kind: 'overcharge', x: -22, y: 0, z: 0, active: true },
      { id: 'boost_os_e', kind: 'overcharge', x: 22, y: 0, z: 0, active: true },
    ],
  },
};

export const ARENA_MAP_LIST: ArenaMapConfig[] = Object.values(ARENA_MAPS);

export const ARENA_BOXES: ArenaBox[] = NEON_REACTOR_BOXES;
export const ARENA_SPAWNS: SpawnPoint[] = DEFAULT_SPAWNS;
export const INITIAL_BOOST_PADS: BoostPadSnapshot[] = ARENA_MAPS.neon_reactor.boostPads;

export function getMapConfig(mapId: ArenaMapId = 'neon_reactor'): ArenaMapConfig {
  return ARENA_MAPS[mapId] ?? ARENA_MAPS.neon_reactor;
}

export function getZoneBoxes(zone: ZoneId, mapId: ArenaMapId = 'neon_reactor'): ArenaBox[] {
  return zone === 'lobby' ? LOBBY_BOXES : getMapConfig(mapId).boxes;
}

export function getZoneBounds(zone: ZoneId): ZoneBounds {
  return zone === 'lobby' ? LOBBY_BOUNDS : ARENA_BOUNDS;
}

export function getZoneHalfSize(zone: ZoneId): number {
  return zone === 'lobby' ? LOBBY_HALF_SIZE : ARENA_HALF_SIZE;
}

export function resolvePlayerMovement(
  zone: ZoneId,
  pos: Vec3,
  velY: number,
  moveX: number,
  moveZ: number,
  jumpPressed: boolean,
  grounded: boolean,
  dt: number,
  mapId: ArenaMapId = 'neon_reactor',
  options?: {
    gravityMult?: number;
    jumpMult?: number;
    flyMode?: boolean;
    flyVertical?: number;
    flySpeed?: number;
  },
): { x: number; y: number; z: number; velY: number; grounded: boolean } {
  const boxes = getZoneBoxes(zone, mapId);
  const bounds = getZoneBounds(zone);
  const pad = PLAYER_RADIUS + 0.1;

  let nextX = pos.x + moveX * dt;
  let nextZ = pos.z + moveZ * dt;
  let nextVelY = velY;

  const baseFloor = zone === 'lobby' ? LOBBY_FLOOR_Y : 0;
  let nextY: number;
  let isGrounded = false;

  if (options?.flyMode) {
    nextVelY = (options.flyVertical ?? 0) * (options.flySpeed ?? 11.5);
    nextY = pos.y + nextVelY * dt;
    if (nextY > 34) {
      nextY = 34;
      nextVelY = 0;
    }
    if (nextY <= baseFloor) {
      nextY = baseFloor;
      nextVelY = 0;
      isGrounded = true;
    }
  } else {
    const gMult = options?.gravityMult ?? 1;
    const jMult = options?.jumpMult ?? 1;
    if (jumpPressed && grounded) {
      nextVelY = JUMP_VELOCITY * (gMult < 0.7 ? 1.14 : 1) * jMult;
    }

    nextVelY -= GRAVITY * gMult * dt;
    nextY = pos.y + nextVelY * dt;

    // Base floor plane (0 for Arena, or LOBBY_FLOOR_Y safety floor for Lobby)
    if (nextY <= baseFloor) {
      nextY = baseFloor;
      nextVelY = 0;
      isGrounded = true;
    }
  }

  // Horizontal & vertical AABB collision with reliable platform landing & step-up support
  const stepHeight = 0.55;
  for (const box of boxes) {
    if (box.id === 'l_deck_base') continue;
    const closestX = Math.max(box.minX, Math.min(nextX, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(nextZ, box.maxZ));
    const dx = nextX - closestX;
    const dz = nextZ - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
      const playerTop = nextY + PLAYER_HEIGHT;
      const boxTop = box.maxY;
      const boxBottom = box.minY;

      if (pos.y >= boxTop - stepHeight && nextY <= boxTop + 0.04 && nextVelY <= 1.2) {
        nextY = boxTop;
        nextVelY = 0;
        isGrounded = true;
      } else if (playerTop > boxBottom + 0.05 && nextY < boxTop - 0.05) {
        if (pos.y + PLAYER_HEIGHT <= boxBottom + 0.14 && nextVelY > 0) {
          nextY = boxBottom - PLAYER_HEIGHT;
          nextVelY = 0;
        } else if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = PLAYER_RADIUS - dist;
          nextX += (dx / dist) * push;
          nextZ += (dz / dist) * push;
        } else {
          const penLeft = Math.abs(nextX - box.minX);
          const penRight = Math.abs(box.maxX - nextX);
          const penTop = Math.abs(nextZ - box.minZ);
          const penBot = Math.abs(box.maxZ - nextZ);
          const minPen = Math.min(penLeft, penRight, penTop, penBot);
          if (minPen === penLeft) nextX = box.minX - PLAYER_RADIUS;
          else if (minPen === penRight) nextX = box.maxX + PLAYER_RADIUS;
          else if (minPen === penTop) nextZ = box.minZ - PLAYER_RADIUS;
          else nextZ = box.maxZ + PLAYER_RADIUS;
        }
      }
    }
  }

  nextX = Math.max(bounds.minX + pad, Math.min(bounds.maxX - pad, nextX));
  nextZ = Math.max(bounds.minZ + pad, Math.min(bounds.maxZ - pad, nextZ));

  return {
    x: nextX,
    y: nextY,
    z: nextZ,
    velY: nextVelY,
    grounded: isGrounded,
  };
}

export function rayIntersectsAABB(
  origin: Vec3,
  dir: Vec3,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): number | null {
  let tmin = 0;
  let tmax = 200;

  if (Math.abs(dir.x) < 1e-8) {
    if (origin.x < minX || origin.x > maxX) return null;
  } else {
    const inv = 1 / dir.x;
    let t1 = (minX - origin.x) * inv;
    let t2 = (maxX - origin.x) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (Math.abs(dir.y) < 1e-8) {
    if (origin.y < minY || origin.y > maxY) return null;
  } else {
    const inv = 1 / dir.y;
    let t1 = (minY - origin.y) * inv;
    let t2 = (maxY - origin.y) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  if (Math.abs(dir.z) < 1e-8) {
    if (origin.z < minZ || origin.z > maxZ) return null;
  } else {
    const inv = 1 / dir.z;
    let t1 = (minZ - origin.z) * inv;
    let t2 = (maxZ - origin.z) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }

  return tmin >= 0 ? tmin : null;
}

export function raycastZoneGeometry(
  zone: ZoneId,
  origin: Vec3,
  dir: Vec3,
  maxDist = 140,
  mapId: ArenaMapId = 'neon_reactor',
): number {
  let closest = maxDist;
  const boxes = getZoneBoxes(zone, mapId);
  for (const box of boxes) {
    const t = rayIntersectsAABB(
      origin,
      dir,
      box.minX,
      box.maxX,
      box.minY,
      box.maxY,
      box.minZ,
      box.maxZ,
    );
    if (t !== null && t < closest) {
      closest = t;
    }
  }

  const floorY = zone === 'lobby' ? LOBBY_FLOOR_Y : 0;
  if (dir.y < -1e-6 && origin.y > floorY) {
    const tFloor = (floorY - origin.y) / dir.y;
    if (tFloor > 0 && tFloor < closest) {
      closest = tFloor;
    }
  }

  return closest;
}

export function raycastPlayerHitbox(
  origin: Vec3,
  dir: Vec3,
  targetPos: Vec3,
  isLowStance = false,
  bigHeads = false,
): { dist: number; isCrit: boolean } | null {
  const headMinY = isLowStance ? 1.02 : 1.36;
  const headMaxY = isLowStance ? (bigHeads ? 1.72 : 1.42) : bigHeads ? 2.18 : 1.84;
  const headHalf = bigHeads ? 0.56 : 0.34;
  const bodyMaxY = isLowStance ? 1.04 : 1.38;

  const headHit = rayIntersectsAABB(
    origin,
    dir,
    targetPos.x - headHalf,
    targetPos.x + headHalf,
    targetPos.y + headMinY,
    targetPos.y + headMaxY,
    targetPos.z - headHalf,
    targetPos.z + headHalf,
  );
  if (headHit !== null) {
    return { dist: headHit, isCrit: true };
  }

  const bodyHit = rayIntersectsAABB(
    origin,
    dir,
    targetPos.x - 0.48,
    targetPos.x + 0.48,
    targetPos.y + 0.05,
    targetPos.y + bodyMaxY,
    targetPos.z - 0.48,
    targetPos.z + 0.48,
  );
  if (bodyHit !== null) {
    return { dist: bodyHit, isCrit: false };
  }

  return null;
}
