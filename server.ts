import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ARENA_MAPS,
  ARENA_MAP_LIST,
  INITIAL_LOBBY_TARGETS,
  LOBBY_FLOOR_Y,
  LOBBY_SPAWNS,
  LOBBY_START_PAD,
  OBBY_FINISH_PAD,
  PLAYER_EYE_HEIGHT,
  getMapConfig,
  getZoneBounds,
  getZoneBoxes,
  raycastPlayerHitbox,
  raycastZoneGeometry,
  resolvePlayerMovement,
} from './src/shared/arenaData.ts';
import { isValidCountryCode } from './src/shared/countries.ts';
import {
  getDailyMissionById,
  getTodayDateKey,
  isValidDailyMissionId,
} from './src/shared/dailyMissions.ts';
import {
  VALID_KNIFE_IDS,
  getKnifeById,
  isValidKnifeId,
  type KnifeId,
} from './src/shared/knives.ts';
import { isValidEmoteId } from './src/shared/emotes.ts';
import {
  getOutfitById,
  getOutfitLevel,
  getOutfitMaxHp,
  getOutfitUpgradeCost,
  isValidOutfitId,
  sanitizeOutfitLevels,
  type OutfitId,
} from './src/shared/outfits.ts';
import { validateChatMessage } from './src/shared/profanityFilter.ts';
import {
  VALID_WEAPON_IDS,
  getSidearmById,
  getWeaponById,
  isPrimaryWeapon,
  isSidearmWeapon,
  isValidWeaponId,
  type WeaponId,
} from './src/shared/weapons.ts';
import {
  getWeaponSkinById,
  isValidWeaponSkinId,
  type WeaponSkinId,
} from './src/shared/weaponSkins.ts';
import type {
  ArenaDropKind,
  ArenaDropSnapshot,
  ArenaMapId,
  ArenaMeteorSnapshot,
  AuditEventSeverity,
  AuditEventType,
  AuditLogEntry,
  BannedPlayerRecord,
  BoostPadSnapshot,
  CdmCommandId,
  ChatMessageEvent,
  ClientToServerMessage,
  GamePhase,
  Gender,
  KillFeedEvent,
  LaserBeamEvent,
  LeaderboardEntry,
  LobbyTargetSnapshot,
  MapVoteSummary,
  MatchMode,
  OwnerAnnouncement,
  PlayerSnapshot,
  PublicRoomSummary,
  RoomPreset,
  ServerStatePayload,
  ServerToClientMessage,
  TeamId,
  TeamMode,
  Vec3,
  WeaponSlot,
  ZoneId,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DATA_DIR = path.resolve(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');
const USED_CODES_FILE = path.join(DATA_DIR, 'used_room_codes.json');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit_log.json');
const BANNED_PLAYERS_FILE = path.join(DATA_DIR, 'banned_players.json');
const MAX_AUDIT_LOG_ENTRIES = 500;

const PUBLIC_ROOM_CODE = 'PUBLIC';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VOTE_COUNTDOWN_MS = 5_000;
const EMOTE_DURATION_MS = 3_200;

const MATCH_DURATION_MS = 120_000;
const COUNTDOWN_DURATION_MS = 3_000;
const RESULTS_DURATION_MS = 10_000;
const DEATH_CAM_DURATION_MS = 3_000;
const RESPAWN_DELAY_MS = 4_800;
const SPAWN_SHIELD_MS = 1_800;
const BOOST_DURATION_MS = 10_000;
const BOOST_RESPAWN_MS = 12_000;
const TARGET_SCORE_TAGS = 20;
const DUEL_1V1_TARGET_TAGS = 10;
const STANDARD_MAX_PLAYERS = 16;
const DUEL_MAX_PLAYERS = 2;
const MAX_LASER_AMMO = 12;
const RELOAD_DURATION_MS = 1_450;

const ACCENT_PALETTE = [
  '#06B6D4', // cyan
  '#F59E0B', // amber
  '#F43F5E', // coral
  '#10B981', // emerald
  '#38BDF8', // sky
  '#FB923C', // orange
];

const BOT_PROFILES: Array<{
  name: string;
  gender: Gender;
  accent: string;
  outfit: OutfitId;
  weapon: WeaponId;
  sidearm: WeaponId;
  knife: KnifeId;
  weaponSkin: WeaponSkinId;
  rankedWins: number;
}> = [
  { name: 'Dron Alfa', gender: 'male', accent: '#F43F5E', outfit: 'cyber_crimson', weapon: 'pulse_carbine', sidearm: 'tactical_pistol', knife: 'tactical_blade', weaponSkin: 'crimson_striker', rankedWins: 3 },
  { name: 'Dron Vega', gender: 'female', accent: '#F59E0B', outfit: 'solar_gold', weapon: 'twin_smg', sidearm: 'burst_pistol', knife: 'karambit_neon', weaponSkin: 'solar_ember', rankedWins: 7 },
  { name: 'Dron Kiro', gender: 'male', accent: '#38BDF8', outfit: 'neon_phantom', weapon: 'burst_rifle', sidearm: 'tactical_pistol', knife: 'tactical_blade', weaponSkin: 'plasma_cobalt', rankedWins: 1 },
  { name: 'Dron Nova', gender: 'female', accent: '#10B981', outfit: 'emerald_viper', weapon: 'heavy_lmg', sidearm: 'stinger_pistol', knife: 'katana_edge', weaponSkin: 'emerald_helix', rankedWins: 13 },
  { name: 'Dron Orión', gender: 'male', accent: '#FB923C', outfit: 'arctic_stealth', weapon: 'pulse_carbine', sidearm: 'tactical_pistol', knife: 'tactical_blade', weaponSkin: 'default', rankedWins: 0 },
];

interface ServerPlayer extends PlayerSnapshot {
  baseAccentColor: string;
  isAdmin: boolean;
  infiniteCoins: boolean;
  savedCoinsBeforeInfinite: number;
  matchWeaponOverride: WeaponId | null;
  claimedMissionKeys: Set<string>;
  lastShotAt: number;
  lastMeleeAt: number;
  respawnAt: number;
  lastMoveAt: number;
  lastMoveX: number;
  lastMoveY: number;
  lastMoveZ: number;
  deadActionStrikes: number;
  fastShotStrikes: number;
  flagCount: number;
  reportedBy: Set<string>;
  lastFlagAtByType: Map<string, number>;
  botTargetAngle: number;
  botNextDecisionAt: number;
  botNextShotAt: number;
  botVelY: number;
  botGrounded: boolean;
  botStrafeSign: number;
}

interface ServerBoostPad extends BoostPadSnapshot {
  respawnAt: number;
}

interface ServerDrop extends ArenaDropSnapshot {
  zone: ZoneId;
  landY: number;
  vy: number;
}

interface ServerMeteor extends ArenaMeteorSnapshot {
  zone: ZoneId;
  vy: number;
}

interface GameRoom {
  roomCode: string;
  roomName: string;
  roomPreset: RoomPreset;
  maxPlayers: number;
  isPrivateRoom: boolean;
  hostPlayerId: string | null;
  teamMode: TeamMode;
  matchMode: MatchMode;
  phase: GamePhase;
  phaseEndsAt: number;
  voteCountdownEndsAt: number;
  votedPreviewMapId: ArenaMapId | null;
  lobbyEnteredAt: number;
  matchNumber: number;
  botsEnabled: boolean;
  currentMapId: ArenaMapId;
  hasExplicitMap: boolean;
  allowedWeapons: WeaponId[];
  infiniteEnergy: boolean;
  darkHideAndSeek: boolean;
  lowGravityUntil: number;
  turboArenaUntil: number;
  meteorShowerUntil: number;
  overchargeStormUntil: number;
  blackoutUntil: number;
  oneShotUntil: number;
  superJumpUntil: number;
  bigHeadsUntil: number;
  vampireUntil: number;
  iceFloorUntil: number;
  rainbowChaosUntil: number;
  drops: ServerDrop[];
  meteors: ServerMeteor[];
  nextMeteorAt: number;
  players: Map<string, ServerPlayer>;
  mapVotes: Map<string, ArenaMapId>;
  boostPads: ServerBoostPad[];
  lobbyTargets: LobbyTargetSnapshot[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLeaderboard(): LeaderboardEntry[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      fs.writeFileSync(LEADERBOARD_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => ({
      ...entry,
      rankedWins: typeof entry?.rankedWins === 'number' ? entry.rankedWins : 0,
      bestMatchTags: typeof entry?.bestMatchTags === 'number' ? entry.bestMatchTags : 0,
      bestMatchScore: typeof entry?.bestMatchScore === 'number' ? entry.bestMatchScore : 0,
    }));
  } catch {
    return [];
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save leaderboard:', err);
  }
}

function loadUsedRoomCodes(): Set<string> {
  try {
    ensureDataDir();
    if (!fs.existsSync(USED_CODES_FILE)) {
      fs.writeFileSync(USED_CODES_FILE, '[]', 'utf-8');
      return new Set<string>([PUBLIC_ROOM_CODE]);
    }
    const raw = fs.readFileSync(USED_CODES_FILE, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Recover leading JSON array if file suffered trailing corruption
      const match = raw.match(/\[[\s\S]*?\]/);
      parsed = match ? JSON.parse(match[0]) : [];
      fs.writeFileSync(
        USED_CODES_FILE,
        JSON.stringify(Array.isArray(parsed) ? parsed : [PUBLIC_ROOM_CODE], null, 2),
        'utf-8',
      );
    }
    const set = new Set<string>(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
    set.add(PUBLIC_ROOM_CODE);
    return set;
  } catch {
    return new Set<string>([PUBLIC_ROOM_CODE]);
  }
}

function saveUsedRoomCodes(codes: Set<string>) {
  try {
    ensureDataDir();
    fs.writeFileSync(USED_CODES_FILE, JSON.stringify(Array.from(codes)), 'utf-8');
  } catch (err) {
    console.error('Failed to save used room codes:', err);
  }
}

function loadAuditLog(): AuditLogEntry[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      fs.writeFileSync(AUDIT_LOG_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_AUDIT_LOG_ENTRIES);
  } catch {
    return [];
  }
}

function saveAuditLog(entries: AuditLogEntry[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save audit log:', err);
  }
}

function loadBannedPlayers(): BannedPlayerRecord[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(BANNED_PLAYERS_FILE)) {
      fs.writeFileSync(BANNED_PLAYERS_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(BANNED_PLAYERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is BannedPlayerRecord =>
        Boolean(entry && typeof entry.id === 'string' && typeof entry.name === 'string'),
    );
  } catch {
    return [];
  }
}

function saveBannedPlayers(records: BannedPlayerRecord[]) {
  try {
    ensureDataDir();
    fs.writeFileSync(BANNED_PLAYERS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save banned players:', err);
  }
}

let leaderboard: LeaderboardEntry[] = loadLeaderboard();
const usedRoomCodes = loadUsedRoomCodes();
let auditLog: AuditLogEntry[] = loadAuditLog();
let bannedPlayerRecords: BannedPlayerRecord[] = loadBannedPlayers();
let bannedPlayerIds = new Set<string>(bannedPlayerRecords.map((r) => r.id));
let activeOwnerAnnouncement: OwnerAnnouncement | null = null;

function getActiveOwnerAnnouncement(): OwnerAnnouncement | null {
  if (!activeOwnerAnnouncement) return null;
  if (Date.now() >= activeOwnerAnnouncement.expiresAt) {
    activeOwnerAnnouncement = null;
    return null;
  }
  return activeOwnerAnnouncement;
}

function getBannedPlayersSnapshot(): BannedPlayerRecord[] {
  return [...bannedPlayerRecords].sort((a, b) => b.bannedAt - a.bannedAt);
}

function recordAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
  const fullEntry: AuditLogEntry = {
    ...entry,
    id: nextId('aud'),
    timestamp: Date.now(),
  };
  auditLog.push(fullEntry);
  if (auditLog.length > MAX_AUDIT_LOG_ENTRIES) {
    auditLog = auditLog.slice(-MAX_AUDIT_LOG_ENTRIES);
  }
  saveAuditLog(auditLog);
  if (fullEntry.severity !== 'info') {
    console.warn(
      `[AUDIT:${fullEntry.severity.toUpperCase()}] ${fullEntry.type} | ${fullEntry.playerName} (${fullEntry.playerId}) | ${fullEntry.details}`,
    );
  }
  return fullEntry;
}

function resetPlayerMoveBaseline(p: ServerPlayer, now = Date.now()) {
  p.lastMoveAt = now;
  p.lastMoveX = p.x;
  p.lastMoveY = p.y;
  p.lastMoveZ = p.z;
}

function flagSuspiciousBehavior(
  room: GameRoom,
  player: ServerPlayer,
  type: AuditEventType,
  severity: AuditEventSeverity,
  details: string,
  metricValue?: number,
) {
  if (player.isBot) return;
  const now = Date.now();
  const prevAt = player.lastFlagAtByType.get(type) ?? 0;
  if (now - prevAt < 2500) return;
  player.lastFlagAtByType.set(type, now);
  player.flagCount += 1;
  recordAuditEvent({
    roomCode: room.roomCode,
    matchNumber: room.matchNumber,
    type,
    severity,
    playerId: player.id,
    playerName: player.name,
    details,
    metricValue,
  });
}

function generateUniqueRoomCode(): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!usedRoomCodes.has(code) && !rooms.has(code)) {
      usedRoomCodes.add(code);
      saveUsedRoomCodes(usedRoomCodes);
      return code;
    }
  }
  // Guaranteed unique fallback based on monotonic timestamp + counter
  const fallback = `R${Date.now().toString(36).toUpperCase().slice(-5)}`;
  usedRoomCodes.add(fallback);
  saveUsedRoomCodes(usedRoomCodes);
  return fallback;
}

function getSortedLeaderboard(): LeaderboardEntry[] {
  return [...leaderboard]
    .sort((a, b) => b.totalScore - a.totalScore || b.totalTags - a.totalTags)
    .slice(0, 30);
}

function recordMatchToLeaderboard(
  playersList: ServerPlayer[],
  matchMode: MatchMode,
  teamMode: TeamMode,
  winningTeam: TeamId | null,
) {
  const humanPlayers = playersList.filter((p) => !p.isBot && (p.score > 0 || p.tags > 0 || p.deaths > 0));
  if (humanPlayers.length === 0) return;

  const sortedMatch = [...playersList].sort((a, b) => b.score - a.score || b.tags - a.tags);
  const topScore = sortedMatch[0]?.score ?? 0;
  const now = Date.now();

  for (const p of humanPlayers) {
    const key = `${p.name.toLowerCase()}__${p.gender}`;
    const existing = leaderboard.find((e) => e.id === key);
    const won =
      teamMode === 'teams'
        ? Boolean(winningTeam && p.team === winningTeam)
        : p.score > 0 && p.score === topScore;
    const gainedRankedWin = matchMode === 'ranked' && won ? 1 : 0;
    if (existing) {
      existing.name = p.name;
      existing.totalScore += p.score;
      existing.totalTags += p.tags;
      existing.totalDeaths += p.deaths;
      existing.matchesPlayed += 1;
      if (won) existing.wins += 1;
      existing.rankedWins = Math.max(p.rankedWins, (existing.rankedWins ?? 0) + gainedRankedWin);
      existing.bestStreak = Math.max(existing.bestStreak, p.bestStreak);
      existing.bestMatchTags = Math.max(existing.bestMatchTags ?? 0, p.tags);
      existing.bestMatchScore = Math.max(existing.bestMatchScore ?? 0, p.score);
      existing.updatedAt = now;
    } else {
      leaderboard.push({
        id: key,
        name: p.name,
        gender: p.gender,
        totalScore: p.score,
        totalTags: p.tags,
        totalDeaths: p.deaths,
        wins: won ? 1 : 0,
        rankedWins: Math.max(p.rankedWins, gainedRankedWin),
        matchesPlayed: 1,
        bestStreak: p.bestStreak,
        bestMatchTags: p.tags,
        bestMatchScore: p.score,
        updatedAt: now,
      });
    }
  }

  leaderboard = leaderboard
    .sort((a, b) => b.totalScore - a.totalScore || b.totalTags - a.totalTags)
    .slice(0, 100);
  saveLeaderboard(leaderboard);
}

// Authoritative Rooms Registry
const rooms = new Map<string, GameRoom>();
const sockets = new Map<string, WebSocket>();
const clientRooms = new Map<string, string>();

let idCounter = 1;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

function sendTo(ws: WebSocket, msg: ServerToClientMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function sendToRoom(room: GameRoom, msg: ServerToClientMessage) {
  const payload = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.isBot) continue;
    const ws = sockets.get(p.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function broadcastGlobal(msg: ServerToClientMessage) {
  const payload = JSON.stringify(msg);
  for (const ws of sockets.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function pickSpawn(room: GameRoom, zone: 'lobby' | 'arena', indexHint: number) {
  const list = zone === 'lobby' ? LOBBY_SPAWNS : getMapConfig(room.currentMapId).spawns;
  return list[Math.abs(indexHint) % list.length];
}

function getMapVoteSummary(room: GameRoom): MapVoteSummary {
  const counts: Record<ArenaMapId, number> = {
    neon_reactor: 0,
    sky_citadel: 0,
    obsidian_maze: 0,
    cyber_colosseum: 0,
    arctic_bastion: 0,
    volcanic_forge: 0,
    solar_temple: 0,
    orbital_station: 0,
  };
  const voters: Record<string, ArenaMapId> = {};
  for (const [uid, mapId] of room.mapVotes.entries()) {
    if (room.players.has(uid) && counts[mapId] !== undefined) {
      counts[mapId] += 1;
      voters[uid] = mapId;
    }
  }
  return { counts, voters };
}

function sanitizeAllowedWeapons(raw: unknown): WeaponId[] {
  if (!Array.isArray(raw)) return [...VALID_WEAPON_IDS];
  const valid = Array.from(new Set(raw.filter(isValidWeaponId)));
  return valid.length > 0 ? valid : [...VALID_WEAPON_IDS];
}

function resolveActiveWeapon(
  room: GameRoom,
  p: Pick<ServerPlayer, 'equippedWeapon' | 'equippedSidearm' | 'matchWeaponOverride' | 'activeSlot'>,
  slotOverride?: WeaponSlot,
): WeaponId {
  const allowed = room.allowedWeapons.length > 0 ? room.allowedWeapons : VALID_WEAPON_IDS;
  const targetSlot = slotOverride ?? p.activeSlot ?? 'primary';

  if (targetSlot === 'sidearm') {
    const allowedSidearms = allowed.filter((w) => isSidearmWeapon(w));
    const preferred = p.equippedSidearm && isSidearmWeapon(p.equippedSidearm)
      ? p.equippedSidearm
      : 'tactical_pistol';
    if (allowedSidearms.length > 0) {
      return allowedSidearms.includes(preferred) ? preferred : allowedSidearms[0];
    }
    return preferred;
  }

  const allowedPrimaries = allowed.filter((w) => isPrimaryWeapon(w));
  const primaryPool = allowedPrimaries.length > 0 ? allowedPrimaries : allowed;
  if (p.matchWeaponOverride && primaryPool.includes(p.matchWeaponOverride)) {
    return p.matchWeaponOverride;
  }
  if (primaryPool.includes(p.equippedWeapon)) {
    return p.equippedWeapon;
  }
  return primaryPool[0] ?? 'pulse_carbine';
}

function syncPlayerAmmoToRoomWeapon(room: GameRoom, p: ServerPlayer) {
  const primaryDef = getWeaponById(resolveActiveWeapon(room, p, 'primary'));
  const sidearmDef = getSidearmById(resolveActiveWeapon(room, p, 'sidearm'));

  if (p.primaryMaxAmmo !== primaryDef.maxAmmo) {
    p.primaryMaxAmmo = primaryDef.maxAmmo;
    p.primaryAmmo = primaryDef.maxAmmo;
    if (p.activeSlot !== 'sidearm') p.reloadingUntil = 0;
  } else {
    p.primaryAmmo = Math.min(p.primaryAmmo, primaryDef.maxAmmo);
  }

  if (p.sidearmMaxAmmo !== sidearmDef.maxAmmo) {
    p.sidearmMaxAmmo = sidearmDef.maxAmmo;
    p.sidearmAmmo = sidearmDef.maxAmmo;
    if (p.activeSlot === 'sidearm') p.reloadingUntil = 0;
  } else {
    p.sidearmAmmo = Math.min(p.sidearmAmmo, sidearmDef.maxAmmo);
  }

  if (p.activeSlot === 'sidearm') {
    p.ammo = p.sidearmAmmo;
    p.maxAmmo = p.sidearmMaxAmmo;
  } else {
    p.ammo = p.primaryAmmo;
    p.maxAmmo = p.primaryMaxAmmo;
  }
}

function getRoomTargetTags(room: GameRoom): number {
  return room.roomPreset === 'duel_1v1' ? DUEL_1V1_TARGET_TAGS : TARGET_SCORE_TAGS;
}

function getRoomHumanCount(room: GameRoom): number {
  let count = 0;
  for (const p of room.players.values()) {
    if (!p.isBot) count += 1;
  }
  return count;
}

function getPublicRoomsSummary(): PublicRoomSummary[] {
  const list: PublicRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (room.isPrivateRoom) continue;
    const host = room.hostPlayerId ? room.players.get(room.hostPlayerId) : null;
    list.push({
      roomCode: room.roomCode,
      roomName: room.roomName,
      hostName: host?.name ?? (room.roomCode === PUBLIC_ROOM_CODE ? 'Sistema' : 'Jugador'),
      preset: room.roomPreset,
      playerCount: getRoomHumanCount(room),
      maxPlayers: room.maxPlayers,
      currentMapId: room.currentMapId,
      phase: room.phase,
      matchMode: room.matchMode,
      teamMode: room.teamMode,
      allowedWeapons: [...room.allowedWeapons],
      infiniteEnergy: room.infiniteEnergy,
      darkHideAndSeek: room.darkHideAndSeek,
      botsEnabled: room.botsEnabled,
    });
  }
  return list.sort((a, b) => {
    if (a.roomCode === PUBLIC_ROOM_CODE) return -1;
    if (b.roomCode === PUBLIC_ROOM_CODE) return 1;
    return b.playerCount - a.playerCount;
  });
}

function broadcastPublicRooms() {
  broadcastGlobal({ type: 'public_rooms', rooms: getPublicRoomsSummary() });
}

function resolveWinningMapId(room: GameRoom): ArenaMapId {
  const summary = getMapVoteSummary(room);
  const entries = Object.entries(summary.counts) as Array<[ArenaMapId, number]>;
  const maxVotes = Math.max(...entries.map(([, c]) => c));
  if (maxVotes <= 0) {
    if (room.hasExplicitMap) {
      return room.currentMapId;
    }
    // Rotate to a different arena map so the same map doesn't repeat consecutively
    const candidates = ARENA_MAP_LIST.filter((m) => m.id !== room.currentMapId);
    const picked = candidates[Math.floor(Math.random() * candidates.length)] ?? ARENA_MAP_LIST[0];
    return picked.id;
  }
  const tied = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);
  return tied[Math.floor(Math.random() * tied.length)];
}

function getTeamAccent(team: TeamId): string {
  return team === 'cyan' ? '#06B6D4' : '#F43F5E';
}

function getTeamScores(room: GameRoom): { cyan: number; rose: number } {
  let cyan = 0;
  let rose = 0;
  for (const p of room.players.values()) {
    if (p.team === 'cyan') cyan += p.tags;
    else if (p.team === 'rose') rose += p.tags;
  }
  return { cyan, rose };
}

function pickBalancedTeam(room: GameRoom): TeamId {
  let cyan = 0;
  let rose = 0;
  for (const p of room.players.values()) {
    if (p.team === 'cyan') cyan += 1;
    else if (p.team === 'rose') rose += 1;
  }
  return cyan <= rose ? 'cyan' : 'rose';
}

function rebalanceRoomTeams(room: GameRoom) {
  if (room.teamMode === 'ffa') {
    for (const p of room.players.values()) {
      p.team = null;
      p.accentColor = p.baseAccentColor;
    }
    return;
  }
  let idx = 0;
  for (const p of room.players.values()) {
    const team: TeamId = idx % 2 === 0 ? 'cyan' : 'rose';
    idx += 1;
    p.team = team;
    p.accentColor = getTeamAccent(team);
  }
}

function getStatePayload(room: GameRoom): ServerStatePayload {
  const now = Date.now();
  return {
    phase: room.phase,
    phaseEndsAt: room.phaseEndsAt,
    voteCountdownEndsAt: room.voteCountdownEndsAt,
    votedPreviewMapId: room.votedPreviewMapId,
    serverTime: now,
    matchNumber: room.matchNumber,
    roomCode: room.roomCode,
    roomName: room.roomName,
    roomPreset: room.roomPreset,
    maxPlayers: room.maxPlayers,
    isPrivateRoom: room.isPrivateRoom,
    hostPlayerId: room.hostPlayerId,
    teamMode: room.teamMode,
    matchMode: room.matchMode,
    teamScores: getTeamScores(room),
    currentMapId: room.currentMapId,
    mapVotes: getMapVoteSummary(room),
    botsEnabled: room.botsEnabled,
    allowedWeapons: [...room.allowedWeapons],
    infiniteEnergy: room.infiniteEnergy,
    darkHideAndSeek: room.darkHideAndSeek || room.blackoutUntil > now,
    lowGravityUntil: room.lowGravityUntil,
    turboArenaUntil: room.turboArenaUntil,
    meteorShowerUntil: room.meteorShowerUntil,
    overchargeStormUntil: room.overchargeStormUntil,
    blackoutUntil: room.blackoutUntil,
    oneShotUntil: room.oneShotUntil,
    superJumpUntil: room.superJumpUntil,
    bigHeadsUntil: room.bigHeadsUntil,
    vampireUntil: room.vampireUntil,
    iceFloorUntil: room.iceFloorUntil,
    rainbowChaosUntil: room.rainbowChaosUntil,
    drops: room.drops.map((d) => ({
      id: d.id,
      kind: d.kind,
      weaponId: d.weaponId,
      x: d.x,
      y: d.y,
      z: d.z,
      expiresAt: d.expiresAt,
    })),
    meteors: room.meteors.map((m) => ({
      id: m.id,
      x: m.x,
      y: m.y,
      z: m.z,
      landY: m.landY,
    })),
    targetScoreTags: getRoomTargetTags(room),
    players: Array.from(room.players.values()).map((p) => {
      const primaryWeapon = resolveActiveWeapon(room, p, 'primary');
      const sidearmWeapon = resolveActiveWeapon(room, p, 'sidearm');
      const activeWeapon = p.activeSlot === 'sidearm' ? sidearmWeapon : primaryWeapon;
      return {
        id: p.id,
        name: p.name,
        gender: p.gender,
        country: p.country,
        isBot: p.isBot,
        isAdmin: canPlayerUseCdm(p) ? true : undefined,
        team: p.team,
        accentColor: p.accentColor,
        equippedOutfit: p.equippedOutfit,
        ownedOutfits: p.ownedOutfits,
        outfitLevels: p.outfitLevels,
        equippedWeapon: primaryWeapon,
        equippedSidearm: sidearmWeapon,
        equippedKnife: p.equippedKnife,
        ownedKnives: p.ownedKnives,
        activeSlot: p.activeSlot,
        activeWeapon,
        ownedWeapons: p.ownedWeapons,
        equippedWeaponSkin: p.equippedWeaponSkin,
        ownedWeaponSkins: p.ownedWeaponSkins,
        coins: p.coins,
        lastCoinsEarned: p.lastCoinsEarned,
        rankedWins: p.rankedWins,
        flagCount: p.flagCount,
        zone: p.zone,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        sliding: p.sliding,
        crouching: p.crouching,
        canFly: p.canFly,
        godMode: p.godMode,
        speedBoosted: p.speedBoosted,
        infiniteAmmo: p.infiniteAmmo,
        infiniteCoins: p.infiniteCoins,
        hp: p.hp,
        maxHp: p.maxHp,
        score: p.score,
        tags: p.tags,
        deaths: p.deaths,
        streak: p.streak,
        bestStreak: p.bestStreak,
        alive: p.alive,
        deathCamUntil: p.deathCamUntil,
        deathCamKillerId: p.deathCamKillerId,
        deathCamKillerName: p.deathCamKillerName,
        shieldUntil: p.shieldUntil,
        boostUntil: p.boostUntil,
        ammo: p.ammo,
        maxAmmo: p.maxAmmo,
        primaryAmmo: p.primaryAmmo,
        primaryMaxAmmo: p.primaryMaxAmmo,
        sidearmAmmo: p.sidearmAmmo,
        sidearmMaxAmmo: p.sidearmMaxAmmo,
        reloadingUntil: p.reloadingUntil,
        voiceRoom: p.voiceRoom,
        voiceSpeaking: p.voiceSpeaking,
        activeEmote: p.activeEmoteUntil > now ? p.activeEmote : null,
        activeEmoteUntil: p.activeEmoteUntil > now ? p.activeEmoteUntil : 0,
      };
    }),
    boostPads: room.boostPads.map((b) => ({
      id: b.id,
      kind: b.kind,
      x: b.x,
      y: b.y,
      z: b.z,
      active: b.active,
    })),
    lobbyTargets: room.lobbyTargets.map((t) => ({ ...t })),
  };
}

function spawnBotsIfNeeded(room: GameRoom) {
  for (const [id, p] of room.players.entries()) {
    if (p.isBot) room.players.delete(id);
  }
  if (!room.botsEnabled) return;

  const now = Date.now();
  const profiles = room.roomPreset === 'duel_1v1' ? BOT_PROFILES.slice(0, 1) : BOT_PROFILES;
  profiles.forEach((profile, idx) => {
    const id = `bot_${room.roomCode}_${idx + 1}`;
    const inArena = room.phase === 'playing' || room.phase === 'countdown';
    const sp = pickSpawn(room, inArena ? 'arena' : 'lobby', idx + 2);
    const botTeam: TeamId | null =
      room.teamMode === 'teams' ? pickBalancedTeam(room) : null;
    const weaponId = resolveActiveWeapon(room, {
      equippedWeapon: profile.weapon,
      equippedSidearm: profile.sidearm,
      matchWeaponOverride: null,
      activeSlot: 'primary',
    }, 'primary');
    const sidearmId = resolveActiveWeapon(room, {
      equippedWeapon: profile.weapon,
      equippedSidearm: profile.sidearm,
      matchWeaponOverride: null,
      activeSlot: 'sidearm',
    }, 'sidearm');
    const weaponDef = getWeaponById(weaponId);
    const sidearmDef = getSidearmById(sidearmId);
    const botPlayer: ServerPlayer = {
      id,
      name: profile.name,
      gender: profile.gender,
      isBot: true,
      isAdmin: false,
      infiniteCoins: false,
      savedCoinsBeforeInfinite: 0,
      team: botTeam,
      baseAccentColor: profile.accent,
      accentColor: botTeam ? getTeamAccent(botTeam) : profile.accent,
      equippedOutfit: profile.outfit,
      ownedOutfits: [profile.outfit],
      outfitLevels: { [profile.outfit]: 1 },
      equippedWeapon: profile.weapon,
      equippedSidearm: profile.sidearm,
      equippedKnife: profile.knife,
      ownedKnives: [profile.knife],
      activeSlot: 'primary',
      ownedWeapons: [profile.weapon, profile.sidearm],
      equippedWeaponSkin: profile.weaponSkin,
      ownedWeaponSkins: [profile.weaponSkin],
      matchWeaponOverride: null,
      coins: 0,
      lastCoinsEarned: 0,
      rankedWins: profile.rankedWins,
      zone: inArena ? 'arena' : 'lobby',
      x: sp.x,
      y: sp.y,
      z: sp.z,
      yaw: sp.yaw,
      pitch: 0,
      sliding: false,
      crouching: false,
      canFly: false,
      godMode: false,
      speedBoosted: false,
      infiniteAmmo: false,
      hp: 100,
      maxHp: 100,
      score: 0,
      tags: 0,
      deaths: 0,
      streak: 0,
      bestStreak: 0,
      alive: true,
      deathCamUntil: 0,
      deathCamKillerId: null,
      deathCamKillerName: null,
      shieldUntil: now + SPAWN_SHIELD_MS,
      boostUntil: 0,
      ammo: weaponDef.maxAmmo,
      maxAmmo: weaponDef.maxAmmo,
      primaryAmmo: weaponDef.maxAmmo,
      primaryMaxAmmo: weaponDef.maxAmmo,
      sidearmAmmo: sidearmDef.maxAmmo,
      sidearmMaxAmmo: sidearmDef.maxAmmo,
      reloadingUntil: 0,
      voiceRoom: null,
      voiceSpeaking: false,
      activeEmote: null,
      activeEmoteUntil: 0,
      claimedMissionKeys: new Set(),
      lastShotAt: 0,
      lastMeleeAt: 0,
      respawnAt: 0,
      lastMoveAt: now,
      lastMoveX: sp.x,
      lastMoveY: sp.y,
      lastMoveZ: sp.z,
      deadActionStrikes: 0,
      fastShotStrikes: 0,
      flagCount: 0,
      reportedBy: new Set(),
      lastFlagAtByType: new Map(),
      botTargetAngle: sp.yaw,
      botNextDecisionAt: now + 750 + idx * 280,
      botNextShotAt: now + 1800 + idx * 350,
      botVelY: 0,
      botGrounded: true,
      botStrafeSign: idx % 2 === 0 ? 1 : -1,
    };
    syncPlayerAmmoToRoomWeapon(room, botPlayer);
    room.players.set(id, botPlayer);
  });
  if (room.teamMode === 'teams') {
    rebalanceRoomTeams(room);
  }
}

interface CreateRoomOptions {
  roomName?: string;
  preset?: RoomPreset;
  mapId?: ArenaMapId;
  hasExplicitMap?: boolean;
  allowedWeapons?: WeaponId[];
  infiniteEnergy?: boolean;
  darkHideAndSeek?: boolean;
  matchMode?: MatchMode;
  teamMode?: TeamMode;
}

function createGameRoom(
  roomCode: string,
  isPrivateRoom: boolean,
  hostPlayerId: string | null,
  botsEnabled = true,
  options: CreateRoomOptions = {},
): GameRoom {
  const preset: RoomPreset = options.preset === 'duel_1v1' ? 'duel_1v1' : 'standard';
  const mapId: ArenaMapId =
    options.mapId && options.mapId in ARENA_MAPS
      ? options.mapId
      : ARENA_MAP_LIST[Math.floor(Math.random() * ARENA_MAP_LIST.length)]?.id ?? 'neon_reactor';
  const effectiveBots = Boolean(botsEnabled);
  const effectiveTeamMode: TeamMode =
    preset === 'duel_1v1' ? 'ffa' : options.teamMode === 'teams' ? 'teams' : 'ffa';
  const defaultName =
    roomCode === PUBLIC_ROOM_CODE
      ? 'Sala Pública Principal'
      : preset === 'duel_1v1'
        ? 'Duelo PvP 1v1'
        : isPrivateRoom
          ? `Sala Privada ${roomCode}`
          : `Sala Pública ${roomCode}`;
  const cleanName =
    typeof options.roomName === 'string' && options.roomName.trim()
      ? options.roomName.trim().slice(0, 32)
      : defaultName;

  const room: GameRoom = {
    roomCode,
    roomName: cleanName,
    roomPreset: preset,
    maxPlayers: preset === 'duel_1v1' ? DUEL_MAX_PLAYERS : STANDARD_MAX_PLAYERS,
    isPrivateRoom,
    hostPlayerId,
    teamMode: effectiveTeamMode,
    matchMode: options.matchMode === 'ranked' ? 'ranked' : 'casual',
    phase: 'lobby',
    phaseEndsAt: 0,
    voteCountdownEndsAt: 0,
    votedPreviewMapId: null,
    lobbyEnteredAt: Date.now(),
    matchNumber: 1,
    botsEnabled: effectiveBots,
    currentMapId: mapId,
    hasExplicitMap: Boolean(options.hasExplicitMap),
    allowedWeapons: sanitizeAllowedWeapons(options.allowedWeapons),
    infiniteEnergy: Boolean(options.infiniteEnergy),
    darkHideAndSeek: Boolean(options.darkHideAndSeek),
    lowGravityUntil: 0,
    turboArenaUntil: 0,
    meteorShowerUntil: 0,
    overchargeStormUntil: 0,
    blackoutUntil: 0,
    oneShotUntil: 0,
    superJumpUntil: 0,
    bigHeadsUntil: 0,
    vampireUntil: 0,
    iceFloorUntil: 0,
    rainbowChaosUntil: 0,
    drops: [],
    meteors: [],
    nextMeteorAt: 0,
    players: new Map(),
    mapVotes: new Map(),
    boostPads: getMapConfig(mapId).boostPads.map((p) => ({ ...p, respawnAt: 0 })),
    lobbyTargets: INITIAL_LOBBY_TARGETS.map((t) => ({ ...t })),
  };
  spawnBotsIfNeeded(room);
  rooms.set(roomCode, room);
  return room;
}

// Create permanent public lobby room
createGameRoom(PUBLIC_ROOM_CODE, false, null, true, { roomName: 'Sala Pública Principal' });

function getPlayerComputedMaxHp(p: ServerPlayer): number {
  if (p.isBot) return 100;
  return getOutfitMaxHp(getOutfitLevel(p.outfitLevels, p.equippedOutfit));
}

function resetPlayersForArena(room: GameRoom, shieldDurationMs: number) {
  let idx = 0;
  const now = Date.now();
  for (const p of room.players.values()) {
    const sp = pickSpawn(room, 'arena', idx++);
    const maxHp = getPlayerComputedMaxHp(p);
    const primaryDef = getWeaponById(resolveActiveWeapon(room, p, 'primary'));
    const sidearmDef = getSidearmById(resolveActiveWeapon(room, p, 'sidearm'));
    p.zone = 'arena';
    p.x = sp.x;
    p.y = sp.y;
    p.z = sp.z;
    p.yaw = sp.yaw;
    p.pitch = 0;
    p.sliding = false;
    p.crouching = false;
    p.maxHp = maxHp;
    p.hp = maxHp;
    p.score = 0;
    p.tags = 0;
    p.deaths = 0;
    p.streak = 0;
    p.bestStreak = 0;
    p.lastCoinsEarned = 0;
    p.alive = true;
    p.deathCamUntil = 0;
    p.deathCamKillerId = null;
    p.deathCamKillerName = null;
    p.shieldUntil = now + shieldDurationMs;
    p.boostUntil = 0;
    p.activeSlot = 'primary';
    p.primaryAmmo = primaryDef.maxAmmo;
    p.primaryMaxAmmo = primaryDef.maxAmmo;
    p.sidearmAmmo = sidearmDef.maxAmmo;
    p.sidearmMaxAmmo = sidearmDef.maxAmmo;
    p.ammo = primaryDef.maxAmmo;
    p.maxAmmo = primaryDef.maxAmmo;
    p.reloadingUntil = 0;
    p.lastMeleeAt = 0;
    p.activeEmote = null;
    p.activeEmoteUntil = 0;
    p.deadActionStrikes = 0;
    resetPlayerMoveBaseline(p, now);
  }
}

function transitionToCountdown(room: GameRoom) {
  if (room.phase === 'countdown' || room.phase === 'playing') return;
  room.currentMapId = resolveWinningMapId(room);
  room.mapVotes.clear();
  room.voteCountdownEndsAt = 0;
  room.votedPreviewMapId = null;
  room.drops = [];
  room.meteors = [];
  room.nextMeteorAt = 0;
  room.lowGravityUntil = 0;
  room.turboArenaUntil = 0;
  room.meteorShowerUntil = 0;
  room.overchargeStormUntil = 0;
  room.blackoutUntil = 0;
  room.oneShotUntil = 0;
  room.superJumpUntil = 0;
  room.bigHeadsUntil = 0;
  room.vampireUntil = 0;
  room.iceFloorUntil = 0;
  room.rainbowChaosUntil = 0;
  room.boostPads = getMapConfig(room.currentMapId).boostPads.map((p) => ({ ...p, respawnAt: 0 }));

  room.phase = 'countdown';
  room.phaseEndsAt = Date.now() + COUNTDOWN_DURATION_MS;
  room.matchNumber += 1;

  resetPlayersForArena(room, COUNTDOWN_DURATION_MS + SPAWN_SHIELD_MS);
  recordAuditEvent({
    roomCode: room.roomCode,
    matchNumber: room.matchNumber,
    type: 'match_start',
    severity: 'info',
    playerId: 'system',
    playerName: 'Sistema',
    details: `Partida #${room.matchNumber} iniciada en mapa ${room.currentMapId} (${room.matchMode}/${room.teamMode})`,
  });
  sendToRoom(room, { type: 'state', state: getStatePayload(room) });
}

function startVotedMatchDirectly(room: GameRoom) {
  if (room.phase !== 'lobby') return;
  room.currentMapId = resolveWinningMapId(room);
  room.mapVotes.clear();
  room.voteCountdownEndsAt = 0;
  room.votedPreviewMapId = null;
  room.drops = [];
  room.meteors = [];
  room.nextMeteorAt = 0;
  room.lowGravityUntil = 0;
  room.turboArenaUntil = 0;
  room.meteorShowerUntil = 0;
  room.overchargeStormUntil = 0;
  room.blackoutUntil = 0;
  room.oneShotUntil = 0;
  room.superJumpUntil = 0;
  room.bigHeadsUntil = 0;
  room.vampireUntil = 0;
  room.iceFloorUntil = 0;
  room.rainbowChaosUntil = 0;
  room.boostPads = getMapConfig(room.currentMapId).boostPads.map((p) => ({ ...p, respawnAt: 0 }));

  room.matchNumber += 1;
  room.phase = 'playing';
  room.phaseEndsAt = Date.now() + MATCH_DURATION_MS;

  resetPlayersForArena(room, SPAWN_SHIELD_MS);
  recordAuditEvent({
    roomCode: room.roomCode,
    matchNumber: room.matchNumber,
    type: 'match_start',
    severity: 'info',
    playerId: 'system',
    playerName: 'Sistema',
    details: `Partida votada #${room.matchNumber} iniciada en mapa ${room.currentMapId} (${room.matchMode}/${room.teamMode})`,
  });
  sendToRoom(room, { type: 'state', state: getStatePayload(room) });
}

function transitionToPlaying(room: GameRoom) {
  room.phase = 'playing';
  room.phaseEndsAt = Date.now() + MATCH_DURATION_MS;
  sendToRoom(room, { type: 'state', state: getStatePayload(room) });
}

function transitionToResults(room: GameRoom) {
  if (room.phase === 'results') return;
  room.phase = 'results';
  room.phaseEndsAt = Date.now() + RESULTS_DURATION_MS;

  const allPlayers = Array.from(room.players.values());
  const sortedMatch = [...allPlayers].sort((a, b) => b.score - a.score || b.tags - a.tags);
  const topScore = sortedMatch[0]?.score ?? 0;
  const maxKills = Math.max(0, ...allPlayers.map((p) => p.tags));
  const teamScores = getTeamScores(room);
  const winningTeam: TeamId | null =
    room.teamMode === 'teams'
      ? teamScores.cyan > teamScores.rose
        ? 'cyan'
        : teamScores.rose > teamScores.cyan
          ? 'rose'
          : null
      : null;

  for (const p of allPlayers) {
    if (p.isBot) continue;
    const rank = sortedMatch.findIndex((entry) => entry.id === p.id);
    const won =
      room.teamMode === 'teams'
        ? Boolean(winningTeam && p.team === winningTeam)
        : p.score > 0 && p.score === topScore;
    const isMvp = maxKills > 0 && p.tags === maxKills;

    let earned = 0;
    if (won) {
      earned = room.matchMode === 'ranked' ? 180 : 150;
    } else if (rank >= 0 && rank <= 2 && p.tags > 0) {
      earned = 50;
    } else if (p.tags > 0 || p.score > 0 || p.deaths > 0) {
      earned = 25;
    }
    if (isMvp) {
      earned += 25;
    }

    if (room.matchMode === 'ranked' && won) {
      p.rankedWins = Math.min(10_000, p.rankedWins + 1);
    }

    p.lastCoinsEarned = earned;
    if (p.infiniteCoins) {
      p.savedCoinsBeforeInfinite = Math.min(1_000_000, p.savedCoinsBeforeInfinite + earned);
      p.coins = 999_999;
    } else if (earned > 0) {
      p.coins = Math.min(1_000_000, p.coins + earned);
    }
    const ws = sockets.get(p.id);
    if (ws) {
      sendTo(ws, {
        type: 'match_reward',
        coinsEarned: earned,
        totalCoins: p.infiniteCoins ? p.savedCoinsBeforeInfinite : p.coins,
        won,
        isMvp,
        tags: p.tags,
        bestStreak: p.bestStreak,
        matchMode: room.matchMode,
        rankedWins: p.rankedWins,
      });
    }
  }

  recordMatchToLeaderboard(allPlayers, room.matchMode, room.teamMode, winningTeam);
  recordAuditEvent({
    roomCode: room.roomCode,
    matchNumber: room.matchNumber,
    type: 'match_end',
    severity: 'info',
    playerId: 'system',
    playerName: 'Sistema',
    details: `Partida #${room.matchNumber} finalizada (${allPlayers.filter((p) => !p.isBot).length} jugadores humanos)`,
  });
  broadcastGlobal({ type: 'leaderboard', leaderboard: getSortedLeaderboard() });
  sendToRoom(room, { type: 'state', state: getStatePayload(room) });
}

function transitionToLobby(room: GameRoom) {
  room.phase = 'lobby';
  room.phaseEndsAt = 0;
  room.voteCountdownEndsAt = 0;
  room.votedPreviewMapId = null;
  room.drops = [];
  room.meteors = [];
  room.nextMeteorAt = 0;
  room.lowGravityUntil = 0;
  room.turboArenaUntil = 0;
  room.meteorShowerUntil = 0;
  room.overchargeStormUntil = 0;
  room.blackoutUntil = 0;
  room.oneShotUntil = 0;
  room.superJumpUntil = 0;
  room.bigHeadsUntil = 0;
  room.vampireUntil = 0;
  room.iceFloorUntil = 0;
  room.rainbowChaosUntil = 0;
  room.lobbyEnteredAt = Date.now();
  let idx = 0;
  const now = Date.now();
  for (const p of room.players.values()) {
    const sp = pickSpawn(room, 'lobby', idx++);
    const maxHp = getPlayerComputedMaxHp(p);
    const primaryDef = getWeaponById(resolveActiveWeapon(room, p, 'primary'));
    const sidearmDef = getSidearmById(resolveActiveWeapon(room, p, 'sidearm'));
    p.zone = 'lobby';
    p.x = sp.x;
    p.y = sp.y;
    p.z = sp.z;
    p.yaw = sp.yaw;
    p.pitch = 0;
    p.sliding = false;
    p.crouching = false;
    p.maxHp = maxHp;
    p.hp = maxHp;
    p.alive = true;
    p.deathCamUntil = 0;
    p.deathCamKillerId = null;
    p.deathCamKillerName = null;
    p.shieldUntil = now + 500;
    p.boostUntil = 0;
    p.score = 0;
    p.tags = 0;
    p.deaths = 0;
    p.streak = 0;
    p.bestStreak = 0;
    p.lastCoinsEarned = 0;
    p.activeSlot = 'primary';
    p.primaryAmmo = primaryDef.maxAmmo;
    p.primaryMaxAmmo = primaryDef.maxAmmo;
    p.sidearmAmmo = sidearmDef.maxAmmo;
    p.sidearmMaxAmmo = sidearmDef.maxAmmo;
    p.ammo = primaryDef.maxAmmo;
    p.maxAmmo = primaryDef.maxAmmo;
    p.reloadingUntil = 0;
    p.lastMeleeAt = 0;
    p.deadActionStrikes = 0;
    resetPlayerMoveBaseline(p, now);
  }
  sendToRoom(room, { type: 'state', state: getStatePayload(room) });
  if (!room.isPrivateRoom) {
    broadcastPublicRooms();
  }
}

function handleLaserShot(room: GameRoom, shooter: ServerPlayer, rawOrigin: Vec3, rawDir: Vec3) {
  const now = Date.now();
  if (!shooter.alive) {
    if (!shooter.isBot && room.phase === 'playing' && shooter.respawnAt > now) {
      flagSuspiciousBehavior(
        room,
        shooter,
        'instant_respawn',
        'critical',
        `Intento de disparo mientras el jugador está eliminado (faltaban ${shooter.respawnAt - now} ms)`,
        shooter.respawnAt - now,
      );
    }
    return;
  }
  if (shooter.zone === 'lobby') return;
  if (room.phase !== 'playing') return;
  if (shooter.reloadingUntil > now) return;
  if (
    !rawOrigin ||
    !rawDir ||
    !Number.isFinite(rawOrigin.x) ||
    !Number.isFinite(rawOrigin.y) ||
    !Number.isFinite(rawOrigin.z) ||
    !Number.isFinite(rawDir.x) ||
    !Number.isFinite(rawDir.y) ||
    !Number.isFinite(rawDir.z)
  ) {
    return;
  }

  if (shooter.activeSlot === 'knife') return;
  const gunSlot: 'primary' | 'sidearm' = shooter.activeSlot === 'sidearm' ? 'sidearm' : 'primary';
  const weaponDef = getWeaponById(resolveActiveWeapon(room, shooter, gunSlot));
  const currentGunAmmo = gunSlot === 'sidearm' ? shooter.sidearmAmmo : shooter.primaryAmmo;
  if (currentGunAmmo <= 0) {
    shooter.reloadingUntil = now + weaponDef.reloadDurationMs;
    return;
  }

  const isBoosted = shooter.boostUntil > now || room.turboArenaUntil > now;
  const rainbowActive = room.rainbowChaosUntil > now;
  const baseCooldown = isBoosted ? weaponDef.boostedCooldownMs : weaponDef.fireCooldownMs;
  const effectiveBase = rainbowActive ? Math.max(50, Math.round(baseCooldown * 0.52)) : baseCooldown;
  const cooldown = shooter.infiniteAmmo ? Math.min(effectiveBase, 95) : effectiveBase;
  if (now - shooter.lastShotAt < cooldown) {
    if (!shooter.isBot && !shooter.infiniteAmmo && now - shooter.lastShotAt < cooldown * 0.55) {
      shooter.fastShotStrikes += 1;
      if (shooter.fastShotStrikes >= 3) {
        shooter.fastShotStrikes = 0;
        flagSuspiciousBehavior(
          room,
          shooter,
          'fire_rate_abuse',
          'warning',
          `Cadencia de disparo anormal detectada (${now - shooter.lastShotAt} ms vs ${cooldown} ms)`,
          now - shooter.lastShotAt,
        );
      }
    }
    return;
  }
  shooter.fastShotStrikes = 0;
  shooter.lastShotAt = now;
  if (!shooter.infiniteAmmo) {
    const nextGunAmmo = Math.max(0, currentGunAmmo - 1);
    if (gunSlot === 'sidearm') {
      shooter.sidearmAmmo = nextGunAmmo;
      shooter.sidearmMaxAmmo = weaponDef.maxAmmo;
    } else {
      shooter.primaryAmmo = nextGunAmmo;
      shooter.primaryMaxAmmo = weaponDef.maxAmmo;
    }
    shooter.ammo = nextGunAmmo;
    shooter.maxAmmo = weaponDef.maxAmmo;
    if (nextGunAmmo === 0) {
      shooter.reloadingUntil = now + weaponDef.reloadDurationMs;
    }
  }

  const len = Math.hypot(rawDir.x, rawDir.y, rawDir.z);
  if (len < 1e-4) return;
  const baseDir: Vec3 = { x: rawDir.x / len, y: rawDir.y / len, z: rawDir.z / len };

  const eyeX = shooter.x;
  const eyeY = shooter.y + PLAYER_EYE_HEIGHT;
  const eyeZ = shooter.z;
  const originDist = Math.hypot(rawOrigin.x - eyeX, rawOrigin.y - eyeY, rawOrigin.z - eyeZ);
  const origin: Vec3 = originDist < 1.8 ? rawOrigin : { x: eyeX, y: eyeY, z: eyeZ };
  const zone = shooter.zone;

  const hitTotals = new Map<string, { victim: ServerPlayer; totalDamage: number; anyCrit: boolean }>();

  for (let pelletIdx = 0; pelletIdx < weaponDef.pellets; pelletIdx++) {
    let px = baseDir.x;
    let py = baseDir.y;
    let pz = baseDir.z;
    if (weaponDef.spreadRad > 0) {
      px += (Math.random() - 0.5) * weaponDef.spreadRad * 2;
      py += (Math.random() - 0.5) * weaponDef.spreadRad * 1.5;
      pz += (Math.random() - 0.5) * weaponDef.spreadRad * 2;
      const plen = Math.hypot(px, py, pz) || 1;
      px /= plen;
      py /= plen;
      pz /= plen;
    }
    const dir: Vec3 = { x: px, y: py, z: pz };
    const wallDist = raycastZoneGeometry(zone, origin, dir, weaponDef.range, room.currentMapId);

    let closestDist = wallDist;
    let hitPlayer: ServerPlayer | null = null;
    let hitIsCrit = false;

    for (const candidate of room.players.values()) {
      if (candidate.id === shooter.id) continue;
      if (room.teamMode === 'teams' && shooter.team && candidate.team === shooter.team) continue;
      if (!candidate.alive || candidate.zone !== 'arena') continue;
      if (candidate.shieldUntil > now || candidate.godMode) continue;

      const hit = raycastPlayerHitbox(
        origin,
        dir,
        {
          x: candidate.x,
          y: candidate.y,
          z: candidate.z,
        },
        Boolean(candidate.sliding || candidate.crouching),
        room.bigHeadsUntil > now,
      );
      if (hit && hit.dist < closestDist) {
        closestDist = hit.dist;
        hitPlayer = candidate;
        hitIsCrit = hit.isCrit;
      }
    }

    const endPoint: Vec3 = {
      x: origin.x + dir.x * closestDist,
      y: origin.y + dir.y * closestDist,
      z: origin.z + dir.z * closestDist,
    };

    const beamStart: Vec3 = {
      x: origin.x + dir.x * 0.45,
      y: origin.y - 0.14 + dir.y * 0.45,
      z: origin.z + dir.z * 0.45,
    };

    const rainbowPalette = ['#FF2E93', '#00F5D4', '#FEE440', '#9B5DE5', '#00BBF9', '#FB5607'];
    const beamColor = rainbowActive
      ? rainbowPalette[Math.floor(Math.random() * rainbowPalette.length)] ?? shooter.accentColor
      : shooter.accentColor;

    const beam: LaserBeamEvent = {
      id: nextId('beam'),
      shooterId: shooter.id,
      zone,
      from: beamStart,
      to: endPoint,
      color: beamColor,
      isCrit: hitIsCrit,
      beamRadius: rainbowActive ? Math.max(weaponDef.beamRadius, 0.11) : weaponDef.beamRadius,
      hitPlayerId: hitPlayer ? hitPlayer.id : null,
      hitTargetId: null,
      timestamp: now,
    };
    sendToRoom(room, { type: 'beam', beam });

    if (hitPlayer) {
      const oneShotActive = room.oneShotUntil > now;
      const baseDmg = oneShotActive ? 220 : hitIsCrit ? weaponDef.critDamage : weaponDef.damage;
      const dmg = Math.max(1, Math.round(baseDmg * (shooter.isBot && !oneShotActive ? 0.5 : 1)));
      const existing = hitTotals.get(hitPlayer.id);
      if (existing) {
        existing.totalDamage += dmg;
        existing.anyCrit = existing.anyCrit || hitIsCrit;
      } else {
        hitTotals.set(hitPlayer.id, { victim: hitPlayer, totalDamage: dmg, anyCrit: hitIsCrit });
      }
    }
  }

  for (const { victim, totalDamage, anyCrit } of hitTotals.values()) {
    if (!victim.alive) continue;
    victim.hp = Math.max(0, victim.hp - totalDamage);
    if (room.vampireUntil > now && shooter.alive) {
      shooter.hp = Math.min(shooter.maxHp, shooter.hp + Math.max(8, Math.round(totalDamage * 0.45)));
    }
    const killed = victim.hp <= 0;

    const shooterWs = sockets.get(shooter.id);
    if (shooterWs) {
      sendTo(shooterWs, {
        type: 'hit_confirm',
        victimId: victim.id,
        damage: totalDamage,
        isCrit: anyCrit,
        killed,
        hitPos: {
          x: victim.x,
          y: victim.y + (anyCrit ? 1.82 : 1.32),
          z: victim.z,
        },
        remainingHp: victim.hp,
        maxHp: victim.maxHp,
      });
    }

    const victimWs = sockets.get(victim.id);
    if (victimWs) {
      sendTo(victimWs, {
        type: 'damaged',
        shooterId: shooter.id,
        damage: totalDamage,
        hp: victim.hp,
        from: origin,
      });
    }

    if (killed) {
      victim.alive = false;
      victim.deathCamUntil = now + DEATH_CAM_DURATION_MS;
      victim.deathCamKillerId = shooter.id;
      victim.deathCamKillerName = shooter.name;
      victim.respawnAt = now + RESPAWN_DELAY_MS;
      victim.deaths += 1;
      victim.streak = 0;

      if (victimWs) {
        sendTo(victimWs, {
          type: 'eliminated',
          killerId: shooter.id,
          killerName: shooter.name,
          killerGender: shooter.gender,
          killerCountry: shooter.country,
          killerOutfit: shooter.equippedOutfit,
          isCrit: anyCrit,
          deathCamDurationMs: DEATH_CAM_DURATION_MS,
          respawnDelayMs: RESPAWN_DELAY_MS,
        });
      }

      shooter.tags += 1;
      shooter.streak += 1;
      shooter.bestStreak = Math.max(shooter.bestStreak, shooter.streak);
      const pts = 100 + (anyCrit ? 25 : 0) + Math.min(shooter.streak - 1, 5) * 20;
      shooter.score += pts;

      const kf: KillFeedEvent = {
        id: nextId('kf'),
        shooterId: shooter.id,
        shooterName: shooter.name,
        shooterGender: shooter.gender,
        shooterCountry: shooter.country,
        victimId: victim.id,
        victimName: victim.name,
        victimGender: victim.gender,
        victimCountry: victim.country,
        isCrit: anyCrit,
        points: pts,
        timestamp: now,
      };
      sendToRoom(room, { type: 'killfeed', event: kf });

      if (shooter.tags >= getRoomTargetTags(room)) {
        transitionToResults(room);
        break;
      }
    }
  }
}

function handleMeleeSlash(room: GameRoom, attacker: ServerPlayer, rawOrigin: Vec3, rawDir: Vec3) {
  const now = Date.now();
  if (!attacker.alive || attacker.zone !== 'arena' || room.phase !== 'playing') return;
  if (
    !rawOrigin ||
    !rawDir ||
    !Number.isFinite(rawOrigin.x) ||
    !Number.isFinite(rawOrigin.y) ||
    !Number.isFinite(rawOrigin.z) ||
    !Number.isFinite(rawDir.x) ||
    !Number.isFinite(rawDir.y) ||
    !Number.isFinite(rawDir.z)
  ) {
    return;
  }

  const knifeDef = getKnifeById(attacker.equippedKnife);
  if (now - attacker.lastMeleeAt < Math.max(200, knifeDef.cooldownMs - 60)) return;
  attacker.lastMeleeAt = now;

  const len = Math.hypot(rawDir.x, rawDir.y, rawDir.z);
  if (len < 1e-4) return;
  const dir: Vec3 = { x: rawDir.x / len, y: rawDir.y / len, z: rawDir.z / len };
  const eyePos: Vec3 = { x: attacker.x, y: attacker.y + PLAYER_EYE_HEIGHT, z: attacker.z };
  const originDist = Math.hypot(
    rawOrigin.x - eyePos.x,
    rawOrigin.y - eyePos.y,
    rawOrigin.z - eyePos.z,
  );
  const origin: Vec3 = originDist < 1.8 ? rawOrigin : eyePos;

  const maxReach = knifeDef.range + 0.55;
  const wallDist = raycastZoneGeometry('arena', origin, dir, maxReach, room.currentMapId);

  let bestVictim: ServerPlayer | null = null;
  let bestDist = Math.min(wallDist, maxReach);
  let bestIsCrit = false;

  for (const candidate of room.players.values()) {
    if (candidate.id === attacker.id) continue;
    if (room.teamMode === 'teams' && attacker.team && candidate.team === attacker.team) continue;
    if (!candidate.alive || candidate.zone !== 'arena') continue;
    if (candidate.shieldUntil > now || candidate.godMode) continue;

    const hit = raycastPlayerHitbox(
      origin,
      dir,
      {
        x: candidate.x,
        y: candidate.y,
        z: candidate.z,
      },
      Boolean(candidate.sliding || candidate.crouching),
      room.bigHeadsUntil > now,
    );
    if (hit && hit.dist <= bestDist) {
      bestDist = hit.dist;
      bestVictim = candidate;
      bestIsCrit = hit.isCrit;
      continue;
    }

    // Close-quarters slash cone check so melee feels crisp and reliable in combat
    const toTargetX = candidate.x - origin.x;
    const toTargetY = candidate.y + 1.15 - origin.y;
    const toTargetZ = candidate.z - origin.z;
    const d = Math.hypot(toTargetX, toTargetY, toTargetZ);
    if (d <= bestDist && d > 0.05) {
      const dot = (toTargetX * dir.x + toTargetY * dir.y + toTargetZ * dir.z) / d;
      if (dot >= 0.72) {
        const wallBlock = raycastZoneGeometry(
          'arena',
          origin,
          { x: toTargetX / d, y: toTargetY / d, z: toTargetZ / d },
          d,
          room.currentMapId,
        );
        if (wallBlock >= d - 0.2) {
          bestDist = d;
          bestVictim = candidate;
          bestIsCrit = dot >= 0.94 && toTargetY > 0.15;
        }
      }
    }
  }

  if (!bestVictim) return;

  const damage = room.oneShotUntil > now ? 220 : bestIsCrit ? knifeDef.critDamage : knifeDef.damage;
  bestVictim.hp = Math.max(0, bestVictim.hp - damage);
  if (room.vampireUntil > now && attacker.alive) {
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.max(10, Math.round(damage * 0.45)));
  }
  const killed = bestVictim.hp <= 0;

  const attackerWs = sockets.get(attacker.id);
  if (attackerWs) {
    sendTo(attackerWs, {
      type: 'hit_confirm',
      victimId: bestVictim.id,
      damage,
      isCrit: bestIsCrit,
      killed,
      hitPos: {
        x: bestVictim.x,
        y: bestVictim.y + (bestIsCrit ? 1.82 : 1.32),
        z: bestVictim.z,
      },
      remainingHp: bestVictim.hp,
      maxHp: bestVictim.maxHp,
    });
  }

  const victimWs = sockets.get(bestVictim.id);
  if (victimWs) {
    sendTo(victimWs, {
      type: 'damaged',
      shooterId: attacker.id,
      damage,
      hp: bestVictim.hp,
      from: origin,
    });
  }

  if (killed) {
    bestVictim.alive = false;
    bestVictim.deathCamUntil = now + DEATH_CAM_DURATION_MS;
    bestVictim.deathCamKillerId = attacker.id;
    bestVictim.deathCamKillerName = attacker.name;
    bestVictim.respawnAt = now + RESPAWN_DELAY_MS;
    bestVictim.deaths += 1;
    bestVictim.streak = 0;

    if (victimWs) {
      sendTo(victimWs, {
        type: 'eliminated',
        killerId: attacker.id,
        killerName: attacker.name,
        killerGender: attacker.gender,
        killerCountry: attacker.country,
        killerOutfit: attacker.equippedOutfit,
        isCrit: bestIsCrit,
        deathCamDurationMs: DEATH_CAM_DURATION_MS,
        respawnDelayMs: RESPAWN_DELAY_MS,
      });
    }

    attacker.tags += 1;
    attacker.streak += 1;
    attacker.bestStreak = Math.max(attacker.bestStreak, attacker.streak);
    const pts = 115 + (bestIsCrit ? 25 : 0) + Math.min(attacker.streak - 1, 5) * 20;
    attacker.score += pts;

    const kf: KillFeedEvent = {
      id: nextId('kf'),
      shooterId: attacker.id,
      shooterName: attacker.name,
      shooterGender: attacker.gender,
      shooterCountry: attacker.country,
      victimId: bestVictim.id,
      victimName: bestVictim.name,
      victimGender: bestVictim.gender,
      victimCountry: bestVictim.country,
      isCrit: bestIsCrit,
      points: pts,
      timestamp: now,
    };
    sendToRoom(room, { type: 'killfeed', event: kf });

    if (attacker.tags >= getRoomTargetTags(room)) {
      transitionToResults(room);
    }
  }
}

function updateBots(room: GameRoom, now: number, dt: number) {
  for (const bot of room.players.values()) {
    if (!bot.isBot) continue;

    if (!bot.alive) {
      if (now >= bot.respawnAt) {
        const sp = pickSpawn(room, bot.zone, Math.floor(Math.random() * 8));
        bot.x = sp.x;
        bot.y = sp.y;
        bot.z = sp.z;
        bot.yaw = sp.yaw;
        bot.sliding = false;
        bot.hp = 100;
        bot.alive = true;
        bot.shieldUntil = now + SPAWN_SHIELD_MS;
        bot.ammo = bot.maxAmmo;
        bot.reloadingUntil = 0;
      }
      continue;
    }

    if (bot.zone === 'lobby') {
      // Gentle patrol around lobby with wall avoidance
      if (now >= bot.botNextDecisionAt) {
        bot.botTargetAngle += (Math.random() - 0.5) * 2.2;
        bot.botNextDecisionAt = now + 1500 + Math.random() * 1500;
      }
      bot.yaw = bot.botTargetAngle;
      const spd = 2.6;
      const prevX = bot.x;
      const prevZ = bot.z;
      const res = resolvePlayerMovement(
        'lobby',
        { x: bot.x, y: bot.y, z: bot.z },
        bot.botVelY,
        -Math.sin(bot.yaw) * spd,
        -Math.cos(bot.yaw) * spd,
        false,
        bot.botGrounded,
        dt,
      );
      bot.x = res.x;
      bot.y = res.y;
      bot.z = res.z;
      bot.botVelY = res.velY;
      bot.botGrounded = res.grounded;
      if (Math.hypot(bot.x - prevX, bot.z - prevZ) < spd * dt * 0.35) {
        bot.botStrafeSign = -bot.botStrafeSign;
        bot.botTargetAngle += Math.PI * 0.65 * bot.botStrafeSign;
      }
      continue;
    }

    if (room.phase !== 'playing') continue;

    // Arena bot AI: in normal modes scan the whole arena (130m) so 1v1/private bots never stall in corners;
    // in Dark Hide & Seek only spot close targets (17m) or enemies who just fired nearby (28m).
    let nearestOpp: ServerPlayer | null = null;
    let nearestDist = room.darkHideAndSeek ? 28 : 130;
    for (const other of room.players.values()) {
      if (other.id === bot.id || !other.alive || other.zone !== 'arena') continue;
      if (room.teamMode === 'teams' && bot.team && other.team === bot.team) continue;
      const d = Math.hypot(other.x - bot.x, other.z - bot.z);
      if (room.darkHideAndSeek) {
        const recentlyFired = now - other.lastShotAt < 2200;
        const maxSense = recentlyFired ? 28 : 16.5;
        if (d > maxSense) continue;
      }
      if (d < nearestDist) {
        nearestDist = d;
        nearestOpp = other;
      }
    }

    if (nearestOpp) {
      const dx = nearestOpp.x - bot.x;
      const dy = nearestOpp.y - bot.y;
      const dz = nearestOpp.z - bot.z;
      const targetYaw = Math.atan2(-dx, -dz);
      bot.yaw = targetYaw;
      bot.pitch = Math.atan2(dy, Math.hypot(dx, dz));

      // Check line of sight
      const dist3d = Math.hypot(dx, dy, dz);
      const dir =
        dist3d >= 0.05
          ? { x: dx / dist3d, y: dy / dist3d, z: dz / dist3d }
          : { x: -Math.sin(bot.yaw), y: 0, z: -Math.cos(bot.yaw) };
      const wallDist =
        dist3d >= 0.05
          ? raycastZoneGeometry(
              'arena',
              { x: bot.x, y: bot.y + PLAYER_EYE_HEIGHT, z: bot.z },
              dir,
              dist3d,
              room.currentMapId,
            )
          : dist3d + 1;

      const hasClearLos = wallDist >= dist3d - 0.8;
      if (hasClearLos && now >= bot.botNextShotAt) {
        // Nerfed bots across all modes: slower cadence and much higher miss spread
        bot.botNextShotAt = now + 2050 + Math.random() * 1150;
        const wildMiss = Math.random() < 0.78;
        const spreadMag = wildMiss ? 0.48 : 0.26;
        const missBiasX = wildMiss ? (Math.random() < 0.5 ? -0.18 : 0.18) : 0;
        const missBiasZ = wildMiss ? (Math.random() < 0.5 ? -0.18 : 0.18) : 0;
        const spreadDir = {
          x: dir.x + missBiasX + (Math.random() - 0.5) * spreadMag,
          y: dir.y + (Math.random() - 0.5) * (spreadMag * 0.72),
          z: dir.z + missBiasZ + (Math.random() - 0.5) * spreadMag,
        };
        handleLaserShot(
          room,
          bot,
          { x: bot.x, y: bot.y + PLAYER_EYE_HEIGHT, z: bot.z },
          spreadDir,
        );
      }

      // Steer cleanly around walls if line-of-sight is blocked, close distance, or strafe in combat
      let moveAngle = bot.yaw;
      if (!hasClearLos && nearestDist > 6) {
        moveAngle = bot.yaw + bot.botStrafeSign * (Math.PI * 0.38);
      } else if (nearestDist <= 13) {
        moveAngle = bot.yaw + bot.botStrafeSign * (Math.PI * 0.5);
      }
      const spd = 3.6;
      const prevX = bot.x;
      const prevZ = bot.z;
      const res = resolvePlayerMovement(
        'arena',
        { x: bot.x, y: bot.y, z: bot.z },
        bot.botVelY,
        -Math.sin(moveAngle) * spd,
        -Math.cos(moveAngle) * spd,
        Math.random() < 0.018,
        bot.botGrounded,
        dt,
        room.currentMapId,
      );
      bot.x = res.x;
      bot.y = res.y;
      bot.z = res.z;
      bot.botVelY = res.velY;
      bot.botGrounded = res.grounded;

      // Flip strafe direction & hop if blocked by cover
      if (Math.hypot(bot.x - prevX, bot.z - prevZ) < spd * dt * 0.3) {
        bot.botStrafeSign = -bot.botStrafeSign;
        if (bot.botGrounded) {
          bot.botVelY = 7.5;
          bot.botGrounded = false;
        }
      }
    } else {
      if (now >= bot.botNextDecisionAt) {
        // Patrol with gentle bias toward center of arena so bots actively roam in Dark Hide & Seek
        const toCenterYaw = Math.atan2(bot.x, bot.z);
        const distFromCenter = Math.hypot(bot.x, bot.z);
        if (distFromCenter > 24) {
          bot.botTargetAngle = toCenterYaw + (Math.random() - 0.5) * 0.9;
        } else {
          bot.botTargetAngle += (Math.random() - 0.5) * 2.2;
        }
        bot.botNextDecisionAt = now + 1100 + Math.random() * 1300;
      }
      bot.yaw = bot.botTargetAngle;
      const spd = 3.4;
      const prevX = bot.x;
      const prevZ = bot.z;
      const res = resolvePlayerMovement(
        'arena',
        { x: bot.x, y: bot.y, z: bot.z },
        bot.botVelY,
        -Math.sin(bot.yaw) * spd,
        -Math.cos(bot.yaw) * spd,
        false,
        bot.botGrounded,
        dt,
        room.currentMapId,
      );
      bot.x = res.x;
      bot.y = res.y;
      bot.z = res.z;
      bot.botVelY = res.velY;
      bot.botGrounded = res.grounded;
      if (Math.hypot(bot.x - prevX, bot.z - prevZ) < spd * dt * 0.35) {
        bot.botStrafeSign = -bot.botStrafeSign;
        bot.botTargetAngle += Math.PI * 0.6 * bot.botStrafeSign;
      }
    }
  }
}

function getPlayerAndRoom(playerId: string): { room: GameRoom; player: ServerPlayer } | null {
  const roomCode = clientRooms.get(playerId);
  if (!roomCode) return null;
  const room = rooms.get(roomCode);
  if (!room) return null;
  const player = room.players.get(playerId);
  if (!player) return null;
  return { room, player };
}

function detachPlayerFromRoom(playerId: string, oldRoom: GameRoom) {
  const leaving = oldRoom.players.get(playerId);
  if (leaving?.voiceRoom) {
    for (const other of oldRoom.players.values()) {
      if (other.id !== playerId && other.voiceRoom === leaving.voiceRoom) {
        const targetWs = sockets.get(other.id);
        if (targetWs) sendTo(targetWs, { type: 'voice:peer_left', peerId: playerId });
      }
    }
    leaving.voiceRoom = null;
    leaving.voiceSpeaking = false;
  }

  oldRoom.players.delete(playerId);
  oldRoom.mapVotes.delete(playerId);

  if (oldRoom.mapVotes.size === 0 && oldRoom.voteCountdownEndsAt > 0) {
    oldRoom.voteCountdownEndsAt = 0;
    oldRoom.votedPreviewMapId = null;
  } else if (oldRoom.voteCountdownEndsAt > 0) {
    oldRoom.votedPreviewMapId = resolveWinningMapId(oldRoom);
  }

  if (oldRoom.roomCode !== PUBLIC_ROOM_CODE) {
    const remainingHumans = Array.from(oldRoom.players.values()).filter((p) => !p.isBot);
    if (remainingHumans.length === 0) {
      rooms.delete(oldRoom.roomCode);
      if (!oldRoom.isPrivateRoom) {
        broadcastPublicRooms();
      }
      return;
    }
    if (oldRoom.hostPlayerId === playerId) {
      oldRoom.hostPlayerId = remainingHumans[0].id;
    }
  }

  sendToRoom(oldRoom, { type: 'state', state: getStatePayload(oldRoom) });
  if (!oldRoom.isPrivateRoom) {
    broadcastPublicRooms();
  }
}

function attachPlayerToRoom(player: ServerPlayer, targetRoom: GameRoom) {
  const now = Date.now();
  const zone = targetRoom.phase === 'playing' || targetRoom.phase === 'countdown' ? 'arena' : 'lobby';
  const sp = pickSpawn(targetRoom, zone, targetRoom.players.size);

  player.matchWeaponOverride = null;
  player.zone = zone;
  player.x = sp.x;
  player.y = sp.y;
  player.z = sp.z;
  player.yaw = sp.yaw;
  player.pitch = 0;
  player.sliding = false;
  player.crouching = false;
  if (targetRoom.teamMode === 'teams') {
    const team = pickBalancedTeam(targetRoom);
    player.team = team;
    player.accentColor = getTeamAccent(team);
  } else {
    player.team = null;
    player.accentColor = player.baseAccentColor;
  }
  const primaryDef = getWeaponById(resolveActiveWeapon(targetRoom, player, 'primary'));
  const sidearmDef = getSidearmById(resolveActiveWeapon(targetRoom, player, 'sidearm'));
  const maxHp = getPlayerComputedMaxHp(player);
  player.maxHp = maxHp;
  player.hp = maxHp;
  player.score = 0;
  player.tags = 0;
  player.deaths = 0;
  player.streak = 0;
  player.bestStreak = 0;
  player.lastCoinsEarned = 0;
  player.alive = true;
  player.deathCamUntil = 0;
  player.deathCamKillerId = null;
  player.deathCamKillerName = null;
  player.shieldUntil = now + SPAWN_SHIELD_MS;
  player.boostUntil = 0;
  player.activeSlot = 'primary';
  player.primaryAmmo = primaryDef.maxAmmo;
  player.primaryMaxAmmo = primaryDef.maxAmmo;
  player.sidearmAmmo = sidearmDef.maxAmmo;
  player.sidearmMaxAmmo = sidearmDef.maxAmmo;
  player.ammo = primaryDef.maxAmmo;
  player.maxAmmo = primaryDef.maxAmmo;
  player.reloadingUntil = 0;
  player.lastMeleeAt = 0;
  player.voiceRoom = null;
  player.voiceSpeaking = false;
  player.activeEmote = null;
  player.activeEmoteUntil = 0;
  player.deadActionStrikes = 0;
  resetPlayerMoveBaseline(player, now);

  targetRoom.players.set(player.id, player);
  clientRooms.set(player.id, targetRoom.roomCode);
  sendToRoom(targetRoom, { type: 'state', state: getStatePayload(targetRoom) });
  if (!targetRoom.isPrivateRoom) {
    broadcastPublicRooms();
  }
}

function computeDropLandingY(
  zone: ZoneId,
  x: number,
  z: number,
  mapId: ArenaMapId,
): number {
  let landY = zone === 'lobby' ? LOBBY_FLOOR_Y : 0;
  const boxes = getZoneBoxes(zone, mapId);
  for (const box of boxes) {
    if (box.id === 'l_deck_base') continue;
    if (x >= box.minX - 0.3 && x <= box.maxX + 0.3 && z >= box.minZ - 0.3 && z <= box.maxZ + 0.3) {
      if (box.maxY > landY && box.maxY < 10) {
        landY = box.maxY;
      }
    }
  }
  return landY;
}

function spawnEventDrops(room: GameRoom, kind: ArenaDropKind, count: number, nearZone?: ZoneId) {
  const now = Date.now();
  const zone: ZoneId = nearZone ?? (room.phase === 'playing' || room.phase === 'countdown' ? 'arena' : 'lobby');
  const bounds = getZoneBounds(zone);
  const minX = bounds.minX + 4;
  const maxX = bounds.maxX - 4;
  const minZ = bounds.minZ + 4;
  const maxZ = bounds.maxZ - 4;
  const rainPool = VALID_WEAPON_IDS.filter((id) => id !== 'pulse_carbine' && id !== 'tactical_pistol');

  for (let i = 0; i < count; i++) {
    const x = minX + Math.random() * Math.max(4, maxX - minX);
    const z = minZ + Math.random() * Math.max(4, maxZ - minZ);
    const landY = computeDropLandingY(zone, x, z, room.currentMapId);
    const weaponId =
      kind === 'weapon'
        ? rainPool[Math.floor(Math.random() * rainPool.length)] ?? 'plasma_cannon'
        : undefined;
    room.drops.push({
      id: nextId('drop'),
      kind,
      weaponId,
      zone,
      x,
      y: landY + 14 + Math.random() * 10,
      z,
      landY,
      vy: -(6.5 + Math.random() * 3.5),
      expiresAt: now + 38_000,
    });
  }
  if (room.drops.length > 48) {
    room.drops.splice(0, room.drops.length - 48);
  }
}

function canPlayerUseCdm(player: ServerPlayer): boolean {
  return !player.isBot;
}

interface ParsedCdmCommand {
  command: CdmCommandId;
  targetId?: string;
}

function parseChatCdmCommand(raw: string): ParsedCdmCommand | null {
  const parts = raw.trim().split(/\s+/);
  const cmd = (parts[0] ?? '').toLowerCase();
  const arg1 = parts[1]?.trim();
  switch (cmd) {
    case '/fly':
    case '/volar':
      return { command: 'toggle_fly' };
    case '/speed':
    case '/velocidad':
      return { command: 'toggle_speed' };
    case '/god':
    case '/dios':
      return { command: 'toggle_god' };
    case '/ammo':
    case '/municion':
      return { command: 'toggle_ammo' };
    case '/infcoins':
    case '/monedasinfinitas':
    case '/infmoney':
      return { command: 'toggle_infinite_coins' };
    case '/heal':
    case '/curar':
      return { command: 'heal_full' };
    case '/coins':
    case '/monedas':
      return { command: 'give_coins' };
    case '/unlock':
    case '/unlockall':
      return { command: 'unlock_all' };
    case '/start':
    case '/iniciar':
      return { command: 'start_match' };
    case '/end':
    case '/terminar':
      return { command: 'end_match' };
    case '/lobby':
      return { command: 'return_lobby' };
    case '/energy':
    case '/energia':
      return { command: 'toggle_infinite_energy' };
    case '/dark':
    case '/oscuro':
      return { command: 'toggle_dark' };
    case '/bots':
      return { command: 'toggle_bots' };
    case '/respawnbots':
      return { command: 'respawn_bots' };
    case '/rain':
    case '/lluvia':
    case '/weaponrain':
      return { command: 'event_weapon_rain' };
    case '/shields':
    case '/escudos':
      return { command: 'event_shield_rain' };
    case '/coinrain':
    case '/lluviamonedas':
      return { command: 'event_coin_rain' };
    case '/meteors':
    case '/meteoritos':
      return { command: 'event_meteor_shower' };
    case '/overcharge':
    case '/sobrecarga':
      return { command: 'event_overcharge_storm' };
    case '/blackout':
    case '/apagon':
      return { command: 'event_blackout' };
    case '/oneshot':
    case '/instatag':
      return { command: 'event_one_shot' };
    case '/superjump':
    case '/supersalto':
      return { command: 'event_super_jump' };
    case '/megarain':
    case '/megalluvia':
      return { command: 'event_mega_rain' };
    case '/lowgrav':
    case '/gravedad':
      return { command: 'event_low_gravity' };
    case '/turbo':
      return { command: 'event_turbo_arena' };
    case '/clear':
    case '/limpiar':
      return { command: 'clear_drops' };
    case '/stopevents':
    case '/pareventos':
      return { command: 'clear_events' };
    case '/ban':
    case '/kick':
    case '/admin_ban':
      return { command: 'admin_ban', targetId: arg1 || undefined };
    case '/unban':
    case '/desbanear':
    case '/admin_unban': {
      const rest = parts.slice(1).join(' ').trim();
      return { command: 'admin_unban', targetId: rest || undefined };
    }
    case '/tp':
    case '/teleport':
    case '/teletransportar': {
      const rest = parts.slice(1).join(' ').trim();
      return { command: 'tp_to_player', targetId: rest || undefined };
    }
    case '/cabezones':
    case '/bigheads':
      return { command: 'event_big_heads' };
    case '/vampiro':
    case '/vampire':
      return { command: 'event_vampire' };
    case '/hielo':
    case '/ice':
      return { command: 'event_ice_floor' };
    case '/caos':
    case '/rainbow':
      return { command: 'event_rainbow_chaos' };
    case '/curatotal':
    case '/healwave':
      return { command: 'event_heal_wave' };
    case '/announce':
    case '/anuncio':
    case '/aviso':
    case '/say': {
      const rest = parts.slice(1).join(' ').trim();
      return { command: 'owner_announce', targetId: rest || undefined };
    }
    case '/clearannounce':
    case '/quitaranuncio':
      return { command: 'clear_owner_announce' };
    default:
      return null;
  }
}

function sendCdmStatus(ws: WebSocket, player: ServerPlayer, message: string, ok = true, openPanel?: boolean) {
  sendTo(ws, {
    type: 'cdm_response',
    authorized: true,
    openPanel,
    ok,
    message,
    bannedPlayers: getBannedPlayersSnapshot(),
    activePowers: {
      canFly: Boolean(player.canFly),
      speedBoosted: Boolean(player.speedBoosted),
      godMode: Boolean(player.godMode),
      infiniteAmmo: Boolean(player.infiniteAmmo),
      infiniteCoins: Boolean(player.infiniteCoins),
    },
  });
}

function findActivePlayerById(
  preferredRoom: GameRoom,
  targetId: string,
): { targetRoom: GameRoom; targetPlayer: ServerPlayer } | null {
  const inPreferred = preferredRoom.players.get(targetId);
  if (inPreferred) {
    return { targetRoom: preferredRoom, targetPlayer: inPreferred };
  }
  for (const r of rooms.values()) {
    const found = r.players.get(targetId);
    if (found) {
      return { targetRoom: r, targetPlayer: found };
    }
  }
  return null;
}

function findPlayerAcrossRoomsByQuery(
  preferredRoom: GameRoom,
  query: string,
  excludePlayerId: string,
): { targetRoom: GameRoom; targetPlayer: ServerPlayer } | null {
  const clean = query.trim().toLowerCase();
  if (!clean) return null;

  const orderedRooms = [preferredRoom, ...Array.from(rooms.values()).filter((r) => r !== preferredRoom)];
  for (const r of orderedRooms) {
    const byId = r.players.get(query.trim());
    if (byId && byId.id !== excludePlayerId) return { targetRoom: r, targetPlayer: byId };
  }
  for (const r of orderedRooms) {
    for (const p of r.players.values()) {
      if (p.id !== excludePlayerId && p.name.trim().toLowerCase() === clean) {
        return { targetRoom: r, targetPlayer: p };
      }
    }
  }
  for (const r of orderedRooms) {
    for (const p of r.players.values()) {
      if (
        p.id !== excludePlayerId &&
        (p.name.trim().toLowerCase().includes(clean) || p.id.toLowerCase().includes(clean))
      ) {
        return { targetRoom: r, targetPlayer: p };
      }
    }
  }
  return null;
}

function applyEventToAllActiveRooms(adminRoom: GameRoom, fn: (r: GameRoom) => void) {
  for (const r of rooms.values()) {
    if (r === adminRoom || r.players.size > 0) {
      fn(r);
      if (r !== adminRoom) {
        sendToRoom(r, { type: 'state', state: getStatePayload(r) });
      }
    }
  }
}

function kickAndBanPlayer(
  targetRoom: GameRoom,
  targetPlayer: ServerPlayer,
  bannedById: string,
  bannedByName: string,
) {
  if (targetPlayer.isBot) {
    targetRoom.players.delete(targetPlayer.id);
    sendToRoom(targetRoom, { type: 'state', state: getStatePayload(targetRoom) });
  } else {
    bannedPlayerIds.add(targetPlayer.id);
    if (!bannedPlayerRecords.some((r) => r.id === targetPlayer.id)) {
      bannedPlayerRecords.push({
        id: targetPlayer.id,
        name: targetPlayer.name,
        bannedAt: Date.now(),
        bannedBy: bannedById,
      });
    }
    saveBannedPlayers(bannedPlayerRecords);

    const targetWs = sockets.get(targetPlayer.id);
    sockets.delete(targetPlayer.id);
    clientRooms.delete(targetPlayer.id);
    detachPlayerFromRoom(targetPlayer.id, targetRoom);

    if (targetWs) {
      sendTo(targetWs, {
        type: 'room_error',
        message: 'Has sido expulsado y baneado por el administrador del servidor.',
      });
      try {
        targetWs.close(4003, 'banned');
      } catch {
        // Ignore close errors
      }
    }
  }

  recordAuditEvent({
    roomCode: targetRoom.roomCode,
    matchNumber: targetRoom.matchNumber,
    type: 'admin_ban',
    severity: 'critical',
    playerId: targetPlayer.id,
    playerName: targetPlayer.name,
    reportedById: bannedById,
    reportedByName: bannedByName,
    reason: 'Expulsado / baneado vía comando CDM admin_ban',
    details: `${bannedByName} (${bannedById}) expulsó/baneó a ${targetPlayer.name} (${targetPlayer.id})`,
  });
}

function unbanPlayerRecord(
  roomCode: string,
  matchNumber: number,
  targetQuery: string,
  unbannedById: string,
  unbannedByName: string,
): BannedPlayerRecord | null {
  const clean = targetQuery.trim().toLowerCase();
  if (!clean) return null;
  const matched =
    bannedPlayerRecords.find((r) => r.id.toLowerCase() === clean) ??
    bannedPlayerRecords.find((r) => r.name.trim().toLowerCase() === clean);
  if (!matched) return null;

  const matchedNameLower = matched.name.trim().toLowerCase();
  bannedPlayerRecords = bannedPlayerRecords.filter(
    (r) =>
      r.id.toLowerCase() !== matched.id.toLowerCase() &&
      r.name.trim().toLowerCase() !== matchedNameLower,
  );
  bannedPlayerIds = new Set<string>(bannedPlayerRecords.map((r) => r.id));
  saveBannedPlayers(bannedPlayerRecords);

  recordAuditEvent({
    roomCode,
    matchNumber,
    type: 'admin_unban',
    severity: 'info',
    playerId: matched.id,
    playerName: matched.name,
    reportedById: unbannedById,
    reportedByName: unbannedByName,
    reason: 'Desbaneado vía comando CDM admin_unban',
    details: `${unbannedByName} (${unbannedById}) desbaneó a ${matched.name} (${matched.id})`,
  });

  return matched;
}

function executeCdmCommand(
  room: GameRoom,
  player: ServerPlayer,
  ws: WebSocket,
  command: CdmCommandId,
  targetId?: string,
) {
  const now = Date.now();
  let message = 'Comando ejecutado.';
  switch (command) {
    case 'toggle_fly':
      player.canFly = !player.canFly;
      message = player.canFly
        ? 'Modo Volar ACTIVADO (Espacio subir · Control bajar).'
        : 'Modo Volar DESACTIVADO.';
      break;
    case 'toggle_speed':
      player.speedBoosted = !player.speedBoosted;
      message = player.speedBoosted ? 'Súper Velocidad ACTIVADA.' : 'Súper Velocidad DESACTIVADA.';
      break;
    case 'toggle_god':
      player.godMode = !player.godMode;
      if (player.godMode) {
        player.hp = player.maxHp;
      }
      message = player.godMode ? 'Modo Dios / Invencible ACTIVADO.' : 'Modo Dios DESACTIVADO.';
      break;
    case 'toggle_ammo':
      player.infiniteAmmo = !player.infiniteAmmo;
      if (player.infiniteAmmo) {
        player.reloadingUntil = 0;
        player.primaryAmmo = player.primaryMaxAmmo;
        player.sidearmAmmo = player.sidearmMaxAmmo;
        player.ammo = player.maxAmmo;
      }
      message = player.infiniteAmmo
        ? 'Munición Infinita y Disparo Rápido ACTIVADOS.'
        : 'Munición Infinita DESACTIVADA.';
      break;
    case 'toggle_infinite_coins':
      player.infiniteCoins = !player.infiniteCoins;
      if (player.infiniteCoins) {
        player.savedCoinsBeforeInfinite = player.coins;
        player.coins = 999_999;
        message = 'Monedas Infinitas ACTIVADAS: todo el arsenal gratis en esta sesión.';
      } else {
        player.coins = Math.min(1_000_000, Math.max(0, player.savedCoinsBeforeInfinite));
        message = 'Monedas Infinitas DESACTIVADAS (saldo original restaurado).';
      }
      break;
    case 'heal_full':
      player.hp = player.maxHp;
      player.shieldUntil = now + 4000;
      message = 'Vida restaurada al 100% + Escudo 4s.';
      break;
    case 'give_coins':
      if (player.infiniteCoins) {
        player.savedCoinsBeforeInfinite = Math.min(1_000_000, player.savedCoinsBeforeInfinite + 500);
        player.coins = 999_999;
      } else {
        player.coins = Math.min(1_000_000, player.coins + 500);
      }
      message = '+500 monedas añadidas a tu sesión.';
      break;
    case 'unlock_all':
      player.ownedWeapons = [...VALID_WEAPON_IDS];
      player.ownedKnives = [...VALID_KNIFE_IDS];
      message = 'Todas las armas largas, pistolas y cuchillos desbloqueados en la sala.';
      break;
    case 'start_match':
      if (room.phase === 'lobby') {
        transitionToCountdown(room);
        message = 'Iniciando partida ahora mismo...';
      } else {
        message = 'La partida ya está en curso.';
      }
      break;
    case 'end_match':
      if (room.phase === 'playing' || room.phase === 'countdown') {
        transitionToResults(room);
        message = 'Partida finalizada: mostrando podio.';
      } else if (room.phase === 'results') {
        transitionToLobby(room);
        message = 'Volviendo al Lobby desde resultados.';
      } else {
        message = 'No hay ninguna partida activa para terminar.';
      }
      break;
    case 'return_lobby':
      transitionToLobby(room);
      message = 'Todos los jugadores devueltos al Lobby.';
      break;
    case 'toggle_infinite_energy':
      room.infiniteEnergy = !room.infiniteEnergy;
      message = room.infiniteEnergy ? 'Energía Infinita ACTIVADA en la sala.' : 'Energía Infinita DESACTIVADA.';
      break;
    case 'toggle_dark':
      room.darkHideAndSeek = !room.darkHideAndSeek;
      message = room.darkHideAndSeek ? 'Modo Oscuro / Escondite ACTIVADO.' : 'Modo Oscuro DESACTIVADO.';
      break;
    case 'toggle_bots':
      room.botsEnabled = !room.botsEnabled;
      spawnBotsIfNeeded(room);
      message = room.botsEnabled ? 'Bots ACTIVADOS en la sala.' : 'Bots DESACTIVADOS.';
      break;
    case 'respawn_bots':
      room.botsEnabled = true;
      spawnBotsIfNeeded(room);
      message = 'Bots regenerados en el mapa.';
      break;
    case 'event_weapon_rain':
      applyEventToAllActiveRooms(room, (r) => spawnEventDrops(r, 'weapon', 14));
      message = 'Evento global: ¡Lluvia de Armas en todos los servidores!';
      break;
    case 'event_shield_rain':
      applyEventToAllActiveRooms(room, (r) => spawnEventDrops(r, 'shield', 12));
      message = 'Evento global: ¡Lluvia de Escudos y Curación en todos los servidores!';
      break;
    case 'event_coin_rain':
      applyEventToAllActiveRooms(room, (r) => spawnEventDrops(r, 'coin', 16));
      message = 'Evento global: ¡Lluvia de Monedas (+35 c/u) en todos los servidores!';
      break;
    case 'event_meteor_shower': {
      const enabling = room.meteorShowerUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        if (enabling) {
          r.meteorShowerUntil = now + 25_000;
          r.nextMeteorAt = now;
        } else {
          r.meteorShowerUntil = 0;
          r.meteors = [];
        }
      });
      message = enabling
        ? 'Evento global: ¡Lluvia de Meteoritos (25s) en todos los servidores!'
        : 'Lluvia de Meteoritos detenida en todos los servidores.';
      break;
    }
    case 'event_overcharge_storm': {
      const enabling = room.overchargeStormUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        if (enabling) {
          r.overchargeStormUntil = now + 30_000;
          for (const p of r.players.values()) {
            if (p.alive) {
              p.boostUntil = Math.max(p.boostUntil, now + 30_000);
            }
          }
          spawnEventDrops(r, 'weapon', 6);
          spawnEventDrops(r, 'shield', 6);
        } else {
          r.overchargeStormUntil = 0;
        }
      });
      message = enabling
        ? 'Evento global: ¡Tormenta de Sobrecarga (30s) en todos los servidores!'
        : 'Tormenta de Sobrecarga finalizada.';
      break;
    }
    case 'event_blackout': {
      const enabling = room.blackoutUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.blackoutUntil = enabling ? now + 35_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Apagón Nocturno (35s) en todos los servidores!'
        : 'Apagón Nocturno desactivado.';
      break;
    }
    case 'event_one_shot': {
      const enabling = room.oneShotUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.oneShotUntil = enabling ? now + 35_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Modo 1-Hit / Insta-Tag (35s) en todos los servidores!'
        : 'Modo 1-Hit desactivado.';
      break;
    }
    case 'event_super_jump': {
      const enabling = room.superJumpUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.superJumpUntil = enabling ? now + 40_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Súper Salto x1.65 (40s) en todos los servidores!'
        : 'Súper Salto desactivado.';
      break;
    }
    case 'event_mega_rain':
      applyEventToAllActiveRooms(room, (r) => {
        spawnEventDrops(r, 'weapon', 12);
        spawnEventDrops(r, 'shield', 10);
        spawnEventDrops(r, 'coin', 18);
      });
      message = 'Evento global: ¡MEGA LLUVIA TOTAL en todos los servidores!';
      break;
    case 'event_low_gravity': {
      const enabling = room.lowGravityUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.lowGravityUntil = enabling ? now + 45_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Gravedad Lunar (45s) en todos los servidores!'
        : 'Gravedad Lunar desactivada.';
      break;
    }
    case 'event_turbo_arena': {
      const enabling = room.turboArenaUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.turboArenaUntil = enabling ? now + 45_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Arena Turbo x1.4 (45s) en todos los servidores!'
        : 'Arena Turbo desactivada.';
      break;
    }
    case 'event_big_heads': {
      const enabling = room.bigHeadsUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.bigHeadsUntil = enabling ? now + 40_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Modo Cabezones (40s) en todos los servidores!'
        : 'Modo Cabezones desactivado.';
      break;
    }
    case 'event_vampire': {
      const enabling = room.vampireUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.vampireUntil = enabling ? now + 40_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Modo Vampiro (40s) en todos los servidores! Robo de vida 45%.'
        : 'Modo Vampiro desactivado.';
      break;
    }
    case 'event_ice_floor': {
      const enabling = room.iceFloorUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.iceFloorUntil = enabling ? now + 40_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Pista de Hielo (40s) en todos los servidores!'
        : 'Pista de Hielo desactivada.';
      break;
    }
    case 'event_rainbow_chaos': {
      const enabling = room.rainbowChaosUntil <= now;
      applyEventToAllActiveRooms(room, (r) => {
        r.rainbowChaosUntil = enabling ? now + 35_000 : 0;
      });
      message = enabling
        ? 'Evento global: ¡Caos Láser Arcoíris x2 (35s) en todos los servidores!'
        : 'Caos Láser desactivado.';
      break;
    }
    case 'event_heal_wave':
      applyEventToAllActiveRooms(room, (r) => {
        for (const p of r.players.values()) {
          if (p.alive) {
            p.hp = p.maxHp;
            p.shieldUntil = Math.max(p.shieldUntil, now + 5000);
          }
        }
        spawnEventDrops(r, 'shield', 6);
      });
      message = 'Evento global: ¡Onda Curativa (100% HP + Escudo 5s) en todos los servidores!';
      break;
    case 'clear_drops':
      applyEventToAllActiveRooms(room, (r) => {
        r.drops = [];
      });
      message = 'Todos los drops fueron limpiados en todos los servidores.';
      break;
    case 'clear_events':
      applyEventToAllActiveRooms(room, (r) => {
        r.lowGravityUntil = 0;
        r.turboArenaUntil = 0;
        r.meteorShowerUntil = 0;
        r.overchargeStormUntil = 0;
        r.blackoutUntil = 0;
        r.oneShotUntil = 0;
        r.superJumpUntil = 0;
        r.bigHeadsUntil = 0;
        r.vampireUntil = 0;
        r.iceFloorUntil = 0;
        r.rainbowChaosUntil = 0;
        r.meteors = [];
        r.drops = [];
      });
      message = 'Todos los eventos activos y drops han sido detenidos en todos los servidores.';
      break;
    case 'tp_to_player': {
      const cleanQuery = typeof targetId === 'string' ? targetId.trim().slice(0, 64) : '';
      if (!cleanQuery) {
        sendCdmStatus(ws, player, 'Indica el nombre o ID del jugador (ej. /tp usr_2 o /tp Ana).', false);
        return;
      }
      const match = findPlayerAcrossRoomsByQuery(room, cleanQuery, player.id);
      if (!match) {
        sendCdmStatus(ws, player, `No se encontró ningún jugador activo con "${cleanQuery}".`, false);
        return;
      }
      const { targetRoom, targetPlayer } = match;
      if (targetRoom !== room) {
        detachPlayerFromRoom(player.id, room);
        targetRoom.players.set(player.id, player);
        clientRooms.set(player.id, targetRoom.roomCode);
        if (targetRoom.teamMode === 'teams') {
          player.team = pickBalancedTeam(targetRoom);
          player.accentColor = getTeamAccent(player.team);
        } else {
          player.team = null;
          player.accentColor = player.baseAccentColor;
        }
      }
      const bounds = getZoneBounds(targetPlayer.zone);
      const offsetX = targetPlayer.x + Math.sin(targetPlayer.yaw) * 1.8;
      const offsetZ = targetPlayer.z + Math.cos(targetPlayer.yaw) * 1.8;
      player.zone = targetPlayer.zone;
      player.alive = true;
      player.x = Math.max(bounds.minX + 1, Math.min(bounds.maxX - 1, offsetX));
      player.y = targetPlayer.y;
      player.z = Math.max(bounds.minZ + 1, Math.min(bounds.maxZ - 1, offsetZ));
      player.yaw = targetPlayer.yaw;
      player.pitch = 0;
      resetPlayerMoveBaseline(player, now);

      sendTo(ws, {
        type: 'teleport_to',
        zone: player.zone,
        x: player.x,
        y: player.y,
        z: player.z,
        yaw: player.yaw,
        targetName: targetPlayer.name,
      });
      sendCdmStatus(
        ws,
        player,
        `Teletransportado junto a ${targetPlayer.name} (${targetPlayer.id})${
          targetRoom !== room ? ` en sala ${targetRoom.roomCode}` : ''
        }.`,
        true,
      );
      sendToRoom(targetRoom, { type: 'state', state: getStatePayload(targetRoom) });
      return;
    }
    case 'admin_ban': {
      const cleanTargetId = typeof targetId === 'string' ? targetId.trim().slice(0, 64) : '';
      if (!cleanTargetId) {
        sendCdmStatus(ws, player, 'Indica el ID del jugador a expulsar/banear (ej. /ban usr_12).', false);
        return;
      }
      if (cleanTargetId === player.id) {
        sendCdmStatus(ws, player, 'No puedes expulsarte o banearte a ti mismo.', false);
        return;
      }
      const match = findActivePlayerById(room, cleanTargetId);
      if (!match) {
        sendCdmStatus(ws, player, `No se encontró ningún jugador activo con ID "${cleanTargetId}".`, false);
        return;
      }
      kickAndBanPlayer(
        match.targetRoom,
        match.targetPlayer,
        player.id,
        player.name,
      );
      message = match.targetPlayer.isBot
        ? `Bot ${match.targetPlayer.name} (${match.targetPlayer.id}) expulsado de la sala.`
        : `Jugador ${match.targetPlayer.name} (${match.targetPlayer.id}) expulsado y baneado.`;
      break;
    }
    case 'admin_unban': {
      const cleanTarget = typeof targetId === 'string' ? targetId.trim().slice(0, 64) : '';
      if (!cleanTarget) {
        sendCdmStatus(ws, player, 'Indica el ID o nombre del jugador a desbanear.', false);
        return;
      }
      const unbanned = unbanPlayerRecord(
        room.roomCode,
        room.matchNumber,
        cleanTarget,
        player.id,
        player.name,
      );
      if (!unbanned) {
        sendCdmStatus(ws, player, `No se encontró "${cleanTarget}" en la lista de baneados.`, false);
        return;
      }
      message = `Jugador ${unbanned.name} (${unbanned.id}) desbaneado correctamente.`;
      break;
    }
    case 'owner_announce': {
      const cleanText =
        typeof targetId === 'string'
          ? targetId
              .replace(/[\r\n\t]+/g, ' ')
              .replace(/\s{2,}/g, ' ')
              .trim()
              .slice(0, 160)
          : '';
      if (!cleanText) {
        sendCdmStatus(ws, player, 'Escribe un texto para anunciar a todos los servidores.', false);
        return;
      }
      activeOwnerAnnouncement = {
        id: nextId('ann'),
        text: cleanText,
        senderName: player.name,
        createdAt: now,
        expiresAt: now + 35_000,
      };
      broadcastGlobal({
        type: 'owner_announcement',
        announcement: activeOwnerAnnouncement,
      });
      message = `Anuncio enviado a todos los servidores: "${cleanText}"`;
      break;
    }
    case 'clear_owner_announce':
      activeOwnerAnnouncement = null;
      broadcastGlobal({
        type: 'owner_announcement',
        announcement: null,
      });
      message = 'Anuncio global del dueño retirado de todos los servidores.';
      break;
  }
  sendCdmStatus(ws, player, message, true);
  sendToRoom(room, { type: 'state', state: getStatePayload(room) });
}

// Authoritative 20Hz simulation tick across all active rooms
let lastTickAt = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - lastTickAt) / 1000, 0.1);
  lastTickAt = now;

  if (activeOwnerAnnouncement && now >= activeOwnerAnnouncement.expiresAt) {
    activeOwnerAnnouncement = null;
    broadcastGlobal({ type: 'owner_announcement', announcement: null });
  }

  for (const room of rooms.values()) {
    if (room.phase === 'lobby' && room.voteCountdownEndsAt > 0 && now >= room.voteCountdownEndsAt) {
      startVotedMatchDirectly(room);
    } else if (room.phase === 'countdown' && now >= room.phaseEndsAt) {
      transitionToPlaying(room);
    } else if (room.phase === 'playing' && now >= room.phaseEndsAt) {
      transitionToResults(room);
    } else if (room.phase === 'results' && now >= room.phaseEndsAt) {
      transitionToLobby(room);
    }

    // Complete reloads, clear expired emotes, & respawn dead human players
    for (const p of room.players.values()) {
      if (p.activeEmote && p.activeEmoteUntil > 0 && now >= p.activeEmoteUntil) {
        p.activeEmote = null;
        p.activeEmoteUntil = 0;
      }
      if (p.reloadingUntil > 0 && now >= p.reloadingUntil) {
        if (p.activeSlot === 'sidearm') {
          p.sidearmAmmo = p.sidearmMaxAmmo;
          p.ammo = p.sidearmAmmo;
          p.maxAmmo = p.sidearmMaxAmmo;
        } else {
          p.primaryAmmo = p.primaryMaxAmmo;
          p.ammo = p.primaryAmmo;
          p.maxAmmo = p.primaryMaxAmmo;
        }
        p.reloadingUntil = 0;
      }
      if (!p.isBot && !p.alive && now >= p.respawnAt) {
        const sp = pickSpawn(room, p.zone, Math.floor(Math.random() * 8));
        const maxHp = getPlayerComputedMaxHp(p);
        p.x = sp.x;
        p.y = sp.y;
        p.z = sp.z;
        p.yaw = sp.yaw;
        p.maxHp = maxHp;
        p.hp = maxHp;
        p.alive = true;
        p.deathCamUntil = 0;
        p.deathCamKillerId = null;
        p.deathCamKillerName = null;
        p.shieldUntil = now + SPAWN_SHIELD_MS;
        p.primaryAmmo = p.primaryMaxAmmo;
        p.sidearmAmmo = p.sidearmMaxAmmo;
        p.ammo = p.activeSlot === 'sidearm' ? p.sidearmAmmo : p.primaryAmmo;
        p.maxAmmo = p.activeSlot === 'sidearm' ? p.sidearmMaxAmmo : p.primaryMaxAmmo;
        p.reloadingUntil = 0;
        p.deadActionStrikes = 0;
        resetPlayerMoveBaseline(p, now);
      }
    }

    // Update boost pads
    if (room.phase === 'playing') {
      for (const pad of room.boostPads) {
        if (!pad.active && now >= pad.respawnAt) {
          pad.active = true;
        }
        if (pad.active) {
          for (const p of room.players.values()) {
            if (!p.alive || p.zone !== 'arena') continue;
            const dist = Math.hypot(p.x - pad.x, p.z - pad.z);
            if (dist < 1.75 && Math.abs(p.y - pad.y) < 1.2) {
              pad.active = false;
              pad.respawnAt = now + BOOST_RESPAWN_MS;
              if (pad.kind === 'overcharge') {
                p.boostUntil = now + BOOST_DURATION_MS;
              } else {
                p.hp = Math.min(p.maxHp, p.hp + 50);
                p.shieldUntil = now + 3500;
              }
              break;
            }
          }
        }
      }
    }

    // Keep overcharge storm active across respawns
    if (room.overchargeStormUntil > now) {
      for (const p of room.players.values()) {
        if (p.alive) {
          p.boostUntil = Math.max(p.boostUntil, now + 1200);
        }
      }
    }

    // Meteor Shower event: spawn & drop meteors with AoE blast on impact
    if (room.meteorShowerUntil > now && now >= room.nextMeteorAt && room.meteors.length < 8) {
      const mZone: ZoneId = room.phase === 'playing' || room.phase === 'countdown' ? 'arena' : 'lobby';
      const bounds = getZoneBounds(mZone);
      const x = bounds.minX + 5 + Math.random() * Math.max(4, bounds.maxX - bounds.minX - 10);
      const z = bounds.minZ + 5 + Math.random() * Math.max(4, bounds.maxZ - bounds.minZ - 10);
      const landY = computeDropLandingY(mZone, x, z, room.currentMapId);
      room.meteors.push({
        id: nextId('meteor'),
        zone: mZone,
        x,
        y: landY + 26 + Math.random() * 8,
        z,
        landY,
        vy: -(21 + Math.random() * 7),
      });
      room.nextMeteorAt = now + 700;
    }

    if (room.meteors.length > 0) {
      for (let i = room.meteors.length - 1; i >= 0; i--) {
        const m = room.meteors[i];
        m.y += m.vy * dt;
        if (m.y <= m.landY) {
          room.meteors.splice(i, 1);
          const impactBeam: LaserBeamEvent = {
            id: nextId('meteor_fx'),
            shooterId: 'system_meteor',
            zone: m.zone,
            from: { x: m.x, y: m.landY + 12, z: m.z },
            to: { x: m.x, y: m.landY + 0.1, z: m.z },
            color: '#F97316',
            isCrit: true,
            beamRadius: 0.24,
            hitPlayerId: null,
            hitTargetId: null,
            timestamp: now,
          };
          sendToRoom(room, { type: 'beam', beam: impactBeam });

          for (const p of room.players.values()) {
            if (!p.alive || p.zone !== m.zone || p.shieldUntil > now || p.godMode) continue;
            const dist = Math.hypot(p.x - m.x, p.z - m.z);
            if (dist <= 3.8 && Math.abs(p.y - m.landY) <= 3.5) {
              const dmg = 35;
              p.hp = Math.max(0, p.hp - dmg);
              const pWs = sockets.get(p.id);
              if (pWs) {
                sendTo(pWs, {
                  type: 'damaged',
                  shooterId: 'system_meteor',
                  damage: dmg,
                  hp: p.hp,
                  from: { x: m.x, y: m.landY + 6, z: m.z },
                });
              }
              if (p.hp <= 0) {
                p.alive = false;
                p.deathCamUntil = now + DEATH_CAM_DURATION_MS;
                p.deathCamKillerId = null;
                p.deathCamKillerName = 'Meteoro Orbital';
                p.respawnAt = now + RESPAWN_DELAY_MS;
                p.deaths += 1;
                p.streak = 0;
                if (pWs) {
                  sendTo(pWs, {
                    type: 'eliminated',
                    killerId: 'system_meteor',
                    killerName: 'Meteoro Orbital',
                    killerGender: 'male',
                    killerOutfit: 'volcanic_titan',
                    isCrit: true,
                    deathCamDurationMs: DEATH_CAM_DURATION_MS,
                    respawnDelayMs: RESPAWN_DELAY_MS,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Update falling CDM event drops & pickup collection
    if (room.drops.length > 0) {
      for (let i = room.drops.length - 1; i >= 0; i--) {
        const drop = room.drops[i];
        if (now >= drop.expiresAt) {
          room.drops.splice(i, 1);
          continue;
        }
        if (drop.y > drop.landY) {
          drop.y = Math.max(drop.landY, drop.y + drop.vy * dt);
        }
        let pickedUp = false;
        for (const p of room.players.values()) {
          if (!p.alive || p.zone !== drop.zone) continue;
          const dist = Math.hypot(p.x - drop.x, p.z - drop.z);
          if (dist < 1.85 && Math.abs(p.y - drop.y) < 1.85) {
            if (drop.kind === 'weapon' && drop.weaponId) {
              if (!p.ownedWeapons.includes(drop.weaponId)) {
                p.ownedWeapons = [...p.ownedWeapons, drop.weaponId];
              }
              if (isSidearmWeapon(drop.weaponId)) {
                p.equippedSidearm = drop.weaponId;
                p.activeSlot = 'sidearm';
              } else {
                p.equippedWeapon = drop.weaponId;
                p.matchWeaponOverride = drop.weaponId;
                p.activeSlot = 'primary';
              }
              p.boostUntil = Math.max(p.boostUntil, now + BOOST_DURATION_MS);
              syncPlayerAmmoToRoomWeapon(room, p);
              const def = getWeaponById(drop.weaponId);
              if (isSidearmWeapon(drop.weaponId)) {
                p.sidearmAmmo = def.maxAmmo;
              } else {
                p.primaryAmmo = def.maxAmmo;
              }
              p.ammo = def.maxAmmo;
            } else if (drop.kind === 'shield') {
              p.hp = Math.min(p.maxHp, p.hp + 60);
              p.shieldUntil = Math.max(p.shieldUntil, now + 6000);
            } else if (drop.kind === 'coin') {
              if (p.infiniteCoins) {
                p.savedCoinsBeforeInfinite = Math.min(1_000_000, p.savedCoinsBeforeInfinite + 35);
                p.coins = 999_999;
              } else {
                p.coins = Math.min(1_000_000, p.coins + 35);
              }
            }
            pickedUp = true;
            break;
          }
        }
        if (pickedUp) {
          room.drops.splice(i, 1);
        }
      }
    }

    // Trigger match start when a human player steps onto the Lobby Start Portal or Obby Finish Balcony
    if (room.phase === 'lobby' && now - room.lobbyEnteredAt > 1500) {
      for (const p of room.players.values()) {
        if (p.isBot || !p.alive || p.zone !== 'lobby') continue;
        const onStartPad =
          Math.hypot(p.x - LOBBY_START_PAD.x, p.z - LOBBY_START_PAD.z) <= LOBBY_START_PAD.radius &&
          Math.abs(p.y - LOBBY_START_PAD.y) <= 1.25;
        const onObbyFinish =
          Math.hypot(p.x - OBBY_FINISH_PAD.x, p.z - OBBY_FINISH_PAD.z) <= OBBY_FINISH_PAD.radius &&
          Math.abs(p.y - OBBY_FINISH_PAD.y) <= 1.25;
        if (onStartPad || onObbyFinish) {
          transitionToCountdown(room);
          break;
        }
      }
    }

    updateBots(room, now, dt);
    sendToRoom(room, { type: 'state', state: getStatePayload(room) });
  }
}, 50);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/leaderboard', (_req, res) => {
    res.json({ leaderboard: getSortedLeaderboard() });
  });

  app.get('/api/audit-log', (req, res) => {
    const limitParam = Number(req.query.limit);
    const limitCount =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(200, Math.floor(limitParam)) : 100;
    const recent = [...auditLog].reverse().slice(0, limitCount);
    const flaggedSummary: Record<string, { playerName: string; count: number; lastType: AuditEventType }> = {};
    for (const entry of auditLog) {
      if (entry.severity === 'info') continue;
      const prev = flaggedSummary[entry.playerId];
      flaggedSummary[entry.playerId] = {
        playerName: entry.playerName,
        count: (prev?.count ?? 0) + 1,
        lastType: entry.type,
      };
    }
    res.json({
      ok: true,
      count: auditLog.length,
      entries: recent,
      flaggedSummary,
    });
  });

  app.post('/api/report', (req, res) => {
    const body = (req.body || {}) as {
      targetId?: unknown;
      targetName?: unknown;
      reason?: unknown;
      reporterName?: unknown;
    };
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim().slice(0, 64) : '';
    const targetName =
      typeof body.targetName === 'string' ? body.targetName.trim().slice(0, 24) : '';
    const reason =
      typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().slice(0, 100)
        : 'Comportamiento sospechoso';
    const reporterName =
      typeof body.reporterName === 'string' && body.reporterName.trim()
        ? body.reporterName.trim().slice(0, 24)
        : 'Jugador';

    if (!targetId || !targetName) {
      res.status(400).json({ ok: false, message: 'Datos de reporte incompletos.' });
      return;
    }

    const entry = recordAuditEvent({
      roomCode: PUBLIC_ROOM_CODE,
      matchNumber: rooms.get(PUBLIC_ROOM_CODE)?.matchNumber ?? 1,
      type: 'player_report',
      severity: 'warning',
      playerId: targetId,
      playerName: targetName,
      reportedByName: reporterName,
      reason,
      details: `Reporte enviado por ${reporterName}: ${reason}`,
    });

    res.json({
      ok: true,
      entry,
      message: `Reporte registrado contra ${targetName}.`,
    });
  });

  app.get('/api/rooms/public', (_req, res) => {
    res.json({ ok: true, rooms: getPublicRoomsSummary() });
  });

  app.get('/api/health', (_req, res) => {
    const publicRoom = rooms.get(PUBLIC_ROOM_CODE);
    res.json({
      ok: true,
      rooms: rooms.size,
      players: sockets.size,
      phase: publicRoom?.phase ?? 'lobby',
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const playerId = nextId('usr');
    let joined = false;

    ws.on('message', async (raw) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendTo(ws, { type: 'pong', t: msg.t });
        return;
      }

      if (msg.type === 'join') {
        const cleanName = String(msg.name || 'Agente')
          .trim()
          .slice(0, 18) || 'Agente';
        if (
          bannedPlayerIds.has(playerId) ||
          bannedPlayerRecords.some(
            (r) => r.name.trim().toLowerCase() === cleanName.toLowerCase(),
          )
        ) {
          sendTo(ws, {
            type: 'room_error',
            message: 'Tu cuenta ha sido baneada por el administrador del servidor.',
          });
          try {
            ws.close(4003, 'banned');
          } catch {
            // Ignore close errors
          }
          return;
        }
        const gender: Gender = msg.gender === 'female' ? 'female' : 'male';
        const rawCountry = typeof msg.country === 'string' ? msg.country.trim().toUpperCase() : undefined;
        const country = isValidCountryCode(rawCountry) ? rawCountry : undefined;
        const coins =
          typeof msg.coins === 'number' && Number.isFinite(msg.coins)
            ? Math.max(0, Math.min(1_000_000, Math.floor(msg.coins)))
            : 0;
        const rankedWins =
          typeof msg.rankedWins === 'number' && Number.isFinite(msg.rankedWins)
            ? Math.max(0, Math.min(10_000, Math.floor(msg.rankedWins)))
            : 0;
        const ownedList: OutfitId[] = Array.isArray(msg.ownedOutfits)
          ? Array.from(new Set(msg.ownedOutfits.filter(isValidOutfitId)))
          : ['default'];
        if (!ownedList.includes('default')) ownedList.unshift('default');
        const equippedOutfit: OutfitId =
          isValidOutfitId(msg.equippedOutfit) && ownedList.includes(msg.equippedOutfit)
            ? msg.equippedOutfit
            : 'default';
        const outfitLevels = sanitizeOutfitLevels(msg.outfitLevels, ownedList);
        const ownedWeapons: WeaponId[] = Array.isArray(msg.ownedWeapons)
          ? Array.from(new Set(msg.ownedWeapons.filter(isValidWeaponId)))
          : ['pulse_carbine', 'tactical_pistol'];
        if (!ownedWeapons.includes('pulse_carbine')) ownedWeapons.unshift('pulse_carbine');
        if (!ownedWeapons.includes('tactical_pistol')) ownedWeapons.push('tactical_pistol');
        const equippedWeapon: WeaponId =
          isValidWeaponId(msg.equippedWeapon) &&
          isPrimaryWeapon(msg.equippedWeapon) &&
          ownedWeapons.includes(msg.equippedWeapon)
            ? msg.equippedWeapon
            : 'pulse_carbine';
        const equippedSidearm: WeaponId =
          isValidWeaponId(msg.equippedSidearm) &&
          isSidearmWeapon(msg.equippedSidearm) &&
          ownedWeapons.includes(msg.equippedSidearm)
            ? msg.equippedSidearm
            : 'tactical_pistol';
        const ownedKnives: KnifeId[] = Array.isArray(msg.ownedKnives)
          ? Array.from(new Set(msg.ownedKnives.filter(isValidKnifeId)))
          : ['tactical_blade'];
        if (!ownedKnives.includes('tactical_blade')) ownedKnives.unshift('tactical_blade');
        const equippedKnife: KnifeId =
          isValidKnifeId(msg.equippedKnife) && ownedKnives.includes(msg.equippedKnife)
            ? msg.equippedKnife
            : 'tactical_blade';
        const ownedWeaponSkins: WeaponSkinId[] = Array.isArray(msg.ownedWeaponSkins)
          ? Array.from(new Set(msg.ownedWeaponSkins.filter(isValidWeaponSkinId)))
          : ['default'];
        if (!ownedWeaponSkins.includes('default')) ownedWeaponSkins.unshift('default');
        const equippedWeaponSkin: WeaponSkinId =
          isValidWeaponSkinId(msg.equippedWeaponSkin) &&
          ownedWeaponSkins.includes(msg.equippedWeaponSkin)
            ? msg.equippedWeaponSkin
            : 'default';

        const requestedCode =
          typeof msg.roomCode === 'string'
            ? msg.roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
            : '';
        const candidateRoom = requestedCode ? rooms.get(requestedCode) : undefined;
        const targetRoom =
          candidateRoom && getRoomHumanCount(candidateRoom) < candidateRoom.maxPlayers
            ? candidateRoom
            : rooms.get(PUBLIC_ROOM_CODE)!;

        const zone = targetRoom.phase === 'playing' || targetRoom.phase === 'countdown' ? 'arena' : 'lobby';
        const sp = pickSpawn(targetRoom, zone, targetRoom.players.size);
        const baseAccentColor = ACCENT_PALETTE[targetRoom.players.size % ACCENT_PALETTE.length];
        const initialTeam: TeamId | null =
          targetRoom.teamMode === 'teams' ? pickBalancedTeam(targetRoom) : null;
        const accentColor = initialTeam ? getTeamAccent(initialTeam) : baseAccentColor;
        const now = Date.now();
        const initialMaxHp = getOutfitMaxHp(getOutfitLevel(outfitLevels, equippedOutfit));
        const primaryDef = getWeaponById(equippedWeapon);
        const sidearmDef = getSidearmById(equippedSidearm);

        const player: ServerPlayer = {
          id: playerId,
          name: cleanName,
          gender,
          country,
          isBot: false,
          isAdmin: false,
          infiniteCoins: false,
          savedCoinsBeforeInfinite: coins,
          team: initialTeam,
          baseAccentColor,
          accentColor,
          equippedOutfit,
          ownedOutfits: ownedList,
          outfitLevels,
          equippedWeapon,
          equippedSidearm,
          equippedKnife,
          ownedKnives,
          activeSlot: 'primary',
          ownedWeapons,
          equippedWeaponSkin,
          ownedWeaponSkins,
          matchWeaponOverride: null,
          coins,
          lastCoinsEarned: 0,
          rankedWins,
          zone,
          x: sp.x,
          y: sp.y,
          z: sp.z,
          yaw: sp.yaw,
          pitch: 0,
          sliding: false,
          crouching: false,
          canFly: false,
          godMode: false,
          speedBoosted: false,
          infiniteAmmo: false,
          hp: initialMaxHp,
          maxHp: initialMaxHp,
          score: 0,
          tags: 0,
          deaths: 0,
          streak: 0,
          bestStreak: 0,
          alive: true,
          deathCamUntil: 0,
          deathCamKillerId: null,
          deathCamKillerName: null,
          shieldUntil: now + SPAWN_SHIELD_MS,
          boostUntil: 0,
          ammo: primaryDef.maxAmmo,
          maxAmmo: primaryDef.maxAmmo,
          primaryAmmo: primaryDef.maxAmmo,
          primaryMaxAmmo: primaryDef.maxAmmo,
          sidearmAmmo: sidearmDef.maxAmmo,
          sidearmMaxAmmo: sidearmDef.maxAmmo,
          reloadingUntil: 0,
          voiceRoom: null,
          voiceSpeaking: false,
          activeEmote: null,
          activeEmoteUntil: 0,
          claimedMissionKeys: new Set(),
          lastShotAt: 0,
          lastMeleeAt: 0,
          respawnAt: 0,
          lastMoveAt: now,
          lastMoveX: sp.x,
          lastMoveY: sp.y,
          lastMoveZ: sp.z,
          deadActionStrikes: 0,
          fastShotStrikes: 0,
          flagCount: 0,
          reportedBy: new Set(),
          lastFlagAtByType: new Map(),
          botTargetAngle: 0,
          botNextDecisionAt: 0,
          botNextShotAt: 0,
          botVelY: 0,
          botGrounded: true,
          botStrafeSign: 1,
        };

        player.isAdmin = true;

        syncPlayerAmmoToRoomWeapon(targetRoom, player);
        targetRoom.players.set(playerId, player);
        sockets.set(playerId, ws);
        clientRooms.set(playerId, targetRoom.roomCode);
        joined = true;

        sendTo(ws, {
          type: 'welcome',
          playerId,
          state: getStatePayload(targetRoom),
          leaderboard: getSortedLeaderboard(),
          ownerAnnouncement: getActiveOwnerAnnouncement(),
        });
        sendTo(ws, { type: 'public_rooms', rooms: getPublicRoomsSummary() });
        sendToRoom(targetRoom, { type: 'state', state: getStatePayload(targetRoom) });
        if (!targetRoom.isPrivateRoom) {
          broadcastPublicRooms();
        }
        return;
      }

      if (!joined) return;
      const found = getPlayerAndRoom(playerId);
      if (!found) return;
      const { room, player } = found;

      if (msg.type === 'move') {
        const now = Date.now();
        if (!player.alive) {
          if (room.phase === 'playing' && player.respawnAt > now + 350) {
            player.deadActionStrikes += 1;
            if (player.deadActionStrikes >= 2) {
              flagSuspiciousBehavior(
                room,
                player,
                'instant_respawn',
                'critical',
                `Paquetes de movimiento detectados antes de completar respawn (${player.respawnAt - now} ms restantes)`,
                player.respawnAt - now,
              );
            }
          }
          return;
        }
        if (room.phase === 'results' || room.phase === 'countdown') return;
        if (msg.zone && msg.zone !== player.zone) {
          flagSuspiciousBehavior(
            room,
            player,
            'zone_violation',
            'warning',
            `Intento de movimiento en zona no autorizada (${msg.zone} != ${player.zone})`,
          );
          return;
        }
        const bounds = getZoneBounds(player.zone);
        if (
          Number.isFinite(msg.x) &&
          Number.isFinite(msg.y) &&
          Number.isFinite(msg.z) &&
          Number.isFinite(msg.yaw) &&
          Number.isFinite(msg.pitch)
        ) {
          if (player.zone === 'arena' && msg.z < -45) {
            flagSuspiciousBehavior(
              room,
              player,
              'zone_violation',
              'warning',
              `Coordenada fuera de límites de arena (z=${msg.z.toFixed(2)})`,
              msg.z,
            );
            return;
          }
          let targetX = Math.max(bounds.minX, Math.min(bounds.maxX, msg.x));
          const maxAllowedY = player.canFly
            ? 38
            : room.lowGravityUntil > now || room.superJumpUntil > now
              ? 28
              : 18;
          const targetY = Math.max(0, Math.min(maxAllowedY, msg.y));
          let targetZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, msg.z));

          const elapsedSec = Math.max(0.03, (now - player.lastMoveAt) / 1000);
          const dx = targetX - player.lastMoveX;
          const dz = targetZ - player.lastMoveZ;
          const horizDist = Math.hypot(dx, dz);
          const speedMps = horizDist / elapsedSec;
          const hasSpeedExempt =
            Boolean(player.canFly || player.speedBoosted || room.turboArenaUntil > now);
          const maxDistCheck = hasSpeedExempt ? 36 : 16;
          const maxSpeedCheck = hasSpeedExempt ? 64 : 28;

          if (horizDist > maxDistCheck && elapsedSec < 0.65) {
            flagSuspiciousBehavior(
              room,
              player,
              'teleport_hack',
              'critical',
              `Teletransporte anómalo bloqueado: ${horizDist.toFixed(1)} m en ${elapsedSec.toFixed(2)} s`,
              Number(horizDist.toFixed(2)),
            );
            return;
          }

          if (horizDist > 2.2 && speedMps > maxSpeedCheck) {
            flagSuspiciousBehavior(
              room,
              player,
              'speed_hack',
              'warning',
              `Velocidad anormal detectada: ${speedMps.toFixed(1)} m/s (límite ${maxSpeedCheck} m/s)`,
              Number(speedMps.toFixed(2)),
            );
            const maxStep = (maxSpeedCheck - 4) * elapsedSec;
            const scale = maxStep / horizDist;
            targetX = player.lastMoveX + dx * scale;
            targetZ = player.lastMoveZ + dz * scale;
          }

          player.x = targetX;
          player.y = targetY;
          player.z = targetZ;
          player.yaw = msg.yaw;
          player.pitch = Math.max(-1.48, Math.min(1.48, msg.pitch));
          player.sliding = Boolean(msg.sliding);
          player.crouching = Boolean(msg.crouching) && !player.sliding;
          resetPlayerMoveBaseline(player, now);
        }
        return;
      }

      if (msg.type === 'shoot') {
        handleLaserShot(room, player, msg.origin, msg.dir);
        return;
      }

      if (msg.type === 'melee_slash') {
        handleMeleeSlash(room, player, msg.origin, msg.dir);
        return;
      }

      if (msg.type === 'switch_slot') {
        if (msg.slot === 'primary' || msg.slot === 'sidearm' || msg.slot === 'knife') {
          player.activeSlot = msg.slot;
          player.reloadingUntil = 0;
          syncPlayerAmmoToRoomWeapon(room, player);
        }
        return;
      }

      if (msg.type === 'reload') {
        if (player.zone === 'lobby' || player.activeSlot === 'knife') return;
        const now = Date.now();
        const gunSlot: 'primary' | 'sidearm' = player.activeSlot === 'sidearm' ? 'sidearm' : 'primary';
        const reloadMs = getWeaponById(resolveActiveWeapon(room, player, gunSlot)).reloadDurationMs;
        if (player.alive && player.reloadingUntil === 0 && player.ammo < player.maxAmmo) {
          player.reloadingUntil = now + reloadMs;
        }
        return;
      }

      if (msg.type === 'start_match') {
        transitionToCountdown(room);
        return;
      }

      if (msg.type === 'return_lobby') {
        if (room.phase === 'results') {
          transitionToLobby(room);
        }
        return;
      }

      if (msg.type === 'toggle_bots') {
        room.botsEnabled = Boolean(msg.enabled);
        spawnBotsIfNeeded(room);
        sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        if (!room.isPrivateRoom) broadcastPublicRooms();
        return;
      }

      if (msg.type === 'toggle_team_mode') {
        if (room.phase === 'lobby') {
          room.teamMode =
            room.roomPreset === 'duel_1v1'
              ? 'ffa'
              : msg.teamMode === 'teams'
                ? 'teams'
                : 'ffa';
          rebalanceRoomTeams(room);
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          if (!room.isPrivateRoom) broadcastPublicRooms();
        }
        return;
      }

      if (msg.type === 'toggle_match_mode') {
        if (room.phase === 'lobby') {
          room.matchMode = msg.matchMode === 'ranked' ? 'ranked' : 'casual';
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          if (!room.isPrivateRoom) broadcastPublicRooms();
        }
        return;
      }

      if (msg.type === 'claim_mission_reward') {
        if (isValidDailyMissionId(msg.missionId)) {
          const todayKey = getTodayDateKey();
          const claimKey = `${todayKey}:${msg.missionId}`;
          if (!player.claimedMissionKeys.has(claimKey)) {
            player.claimedMissionKeys.add(claimKey);
            const missionDef = getDailyMissionById(msg.missionId);
            if (player.infiniteCoins) {
              player.savedCoinsBeforeInfinite = Math.min(
                1_000_000,
                player.savedCoinsBeforeInfinite + missionDef.rewardCoins,
              );
              player.coins = 999_999;
            } else {
              player.coins = Math.min(1_000_000, player.coins + missionDef.rewardCoins);
            }
            sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          }
        }
        return;
      }

      if (msg.type === 'auth_refresh') {
        return;
      }

      if (msg.type === 'cdm_request') {
        const line = String(msg.commandLine || '').trim();
        if (!canPlayerUseCdm(player)) {
          sendTo(ws, {
            type: 'cdm_response',
            authorized: false,
            ok: false,
            message: 'No tienes permiso para abrir o usar CDM.',
          });
          return;
        }
        const lower = line.toLowerCase();
        if (lower === 'cdm' || lower === '/cdm' || lower === '/help') {
          sendCdmStatus(ws, player, 'Consola privada CDM abierta.', true, true);
          return;
        }
        const parsedCmd = parseChatCdmCommand(line);
        if (parsedCmd) {
          executeCdmCommand(room, player, ws, parsedCmd.command, parsedCmd.targetId);
        } else {
          sendCdmStatus(
            ws,
            player,
            `Comando no reconocido: "${line}". Escribe "cdm" para abrir la lista.`,
            false,
            true,
          );
        }
        return;
      }

      if (msg.type === 'cdm_execute') {
        if (!canPlayerUseCdm(player)) {
          sendTo(ws, {
            type: 'cdm_response',
            authorized: false,
            ok: false,
            message: 'No tienes permiso para ejecutar comandos CDM.',
          });
          return;
        }
        executeCdmCommand(room, player, ws, msg.command, msg.targetId);
        return;
      }

      if (msg.type === 'chat') {
        const rawText = String(msg.text || '').trim();
        if (rawText.toLowerCase() === 'cdm' || rawText.startsWith('/')) {
          return;
        }
        const result = validateChatMessage(rawText);
        if (!result.allowed) {
          sendTo(ws, {
            type: 'chat_blocked',
            reason: result.reason ?? 'Mensaje bloqueado por lenguaje ofensivo.',
          });
          return;
        }
        const chatMessage: ChatMessageEvent = {
          id: nextId('chat'),
          senderId: playerId,
          senderName: player.name,
          senderCountry: player.country,
          team: player.team,
          text: result.cleanText,
          timestamp: Date.now(),
        };
        sendToRoom(room, { type: 'chat', message: chatMessage });
        return;
      }

      if (msg.type === 'report_player') {
        const targetId = typeof msg.targetId === 'string' ? msg.targetId.trim().slice(0, 64) : '';
        const cleanReason =
          typeof msg.reason === 'string' && msg.reason.trim()
            ? msg.reason.trim().slice(0, 100)
            : 'Comportamiento sospechoso';
        if (!targetId || targetId === playerId) {
          sendTo(ws, {
            type: 'report_ack',
            targetId,
            targetName: msg.targetName || 'Jugador',
            accepted: false,
            message: 'No puedes reportarte a ti mismo.',
          });
          return;
        }
        const target = room.players.get(targetId);
        const resolvedName = target?.name ?? (msg.targetName || 'Jugador');
        if (target?.isBot) {
          sendTo(ws, {
            type: 'report_ack',
            targetId,
            targetName: resolvedName,
            accepted: false,
            message: 'Los drones de IA no se pueden reportar.',
          });
          return;
        }
        if (target && target.reportedBy.has(playerId)) {
          sendTo(ws, {
            type: 'report_ack',
            targetId,
            targetName: resolvedName,
            accepted: false,
            message: `Ya enviaste un reporte contra ${resolvedName}.`,
          });
          return;
        }
        if (target) {
          target.reportedBy.add(playerId);
          target.flagCount += 1;
        }
        recordAuditEvent({
          roomCode: room.roomCode,
          matchNumber: room.matchNumber,
          type: 'player_report',
          severity: 'warning',
          playerId: targetId,
          playerName: resolvedName,
          reportedById: playerId,
          reportedByName: player.name,
          reason: cleanReason,
          details: `Reporte de ${player.name} contra ${resolvedName}: ${cleanReason}`,
        });
        sendTo(ws, {
          type: 'report_ack',
          targetId,
          targetName: resolvedName,
          accepted: true,
          message: `Reporte enviado contra ${resolvedName}.`,
        });
        sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        return;
      }

      if (msg.type === 'vote_map') {
        if (room.phase === 'lobby' && msg.mapId in ARENA_MAPS) {
          room.mapVotes.set(playerId, msg.mapId);
          room.votedPreviewMapId = resolveWinningMapId(room);
          if (room.voteCountdownEndsAt === 0) {
            room.voteCountdownEndsAt = Date.now() + VOTE_COUNTDOWN_MS;
          }
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        }
        return;
      }

      if (msg.type === 'emote') {
        if (isValidEmoteId(msg.emote)) {
          const now = Date.now();
          player.activeEmote = msg.emote;
          player.activeEmoteUntil = now + EMOTE_DURATION_MS;
          sendToRoom(room, {
            type: 'player_emote',
            playerId,
            emote: msg.emote,
            expiresAt: player.activeEmoteUntil,
          });
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        }
        return;
      }

      if (msg.type === 'create_private_room') {
        const newCode = generateUniqueRoomCode();
        const privateRoom = createGameRoom(newCode, true, playerId, true);
        detachPlayerFromRoom(playerId, room);
        attachPlayerToRoom(player, privateRoom);
        return;
      }

      if (msg.type === 'create_custom_room') {
        const isPrivate = Boolean(msg.isPrivate);
        let newCode = '';
        if (isPrivate) {
          const rawCustom = String(msg.customCode || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 10);
          if (rawCustom) {
            if (rawCustom.length < 4) {
              sendTo(ws, {
                type: 'room_error',
                message: 'El código privado debe tener al menos 4 letras o números.',
              });
              return;
            }
            if (rawCustom === PUBLIC_ROOM_CODE || rooms.has(rawCustom)) {
              sendTo(ws, {
                type: 'room_error',
                message: `El código "${rawCustom}" ya está en uso. Prueba con otro.`,
              });
              return;
            }
            usedRoomCodes.add(rawCustom);
            saveUsedRoomCodes(usedRoomCodes);
            newCode = rawCustom;
          } else {
            newCode = generateUniqueRoomCode();
          }
        } else {
          newCode = generateUniqueRoomCode();
        }

        const preset: RoomPreset = msg.preset === 'duel_1v1' ? 'duel_1v1' : 'standard';
        const chosenMap: ArenaMapId =
          msg.mapId && msg.mapId in ARENA_MAPS ? msg.mapId : 'neon_reactor';
        const fallbackTitle =
          preset === 'duel_1v1'
            ? `1v1 de ${player.name}`
            : isPrivate
              ? `Sala Privada ${newCode}`
              : `Sala de ${player.name}`;
        const customRoom = createGameRoom(
          newCode,
          isPrivate,
          playerId,
          Boolean(msg.botsEnabled),
          {
            roomName: typeof msg.roomName === 'string' && msg.roomName.trim() ? msg.roomName : fallbackTitle,
            preset,
            mapId: chosenMap,
            hasExplicitMap: true,
            allowedWeapons: msg.allowedWeapons,
            infiniteEnergy: Boolean(msg.infiniteEnergy),
            darkHideAndSeek: Boolean(msg.darkHideAndSeek),
            matchMode: msg.matchMode === 'ranked' ? 'ranked' : 'casual',
            teamMode: msg.teamMode === 'teams' ? 'teams' : 'ffa',
          },
        );
        detachPlayerFromRoom(playerId, room);
        attachPlayerToRoom(player, customRoom);
        return;
      }

      if (msg.type === 'update_room_rules') {
        if (room.phase !== 'lobby') {
          sendTo(ws, {
            type: 'room_error',
            message: 'Solo puedes cambiar las reglas de la sala mientras estás en el lobby.',
          });
          return;
        }
        if (msg.roomPreset === 'duel_1v1' || msg.roomPreset === 'standard') {
          if (msg.roomPreset === 'duel_1v1' && getRoomHumanCount(room) > DUEL_MAX_PLAYERS) {
            sendTo(ws, {
              type: 'room_error',
              message: 'Hay más de 2 jugadores en esta sala. Crea una sala 1v1 nueva.',
            });
            return;
          }
          room.roomPreset = msg.roomPreset;
          room.maxPlayers = msg.roomPreset === 'duel_1v1' ? DUEL_MAX_PLAYERS : STANDARD_MAX_PLAYERS;
          if (msg.roomPreset === 'duel_1v1') {
            room.teamMode = 'ffa';
            rebalanceRoomTeams(room);
          }
          spawnBotsIfNeeded(room);
        }
        if (typeof msg.botsEnabled === 'boolean') {
          room.botsEnabled = msg.botsEnabled;
          spawnBotsIfNeeded(room);
        }
        if (typeof msg.roomName === 'string' && msg.roomName.trim()) {
          room.roomName = msg.roomName.trim().slice(0, 32);
        }
        if (msg.mapId && msg.mapId in ARENA_MAPS) {
          room.currentMapId = msg.mapId;
          room.hasExplicitMap = true;
          room.boostPads = getMapConfig(msg.mapId).boostPads.map((b) => ({ ...b, respawnAt: 0 }));
        }
        if (Array.isArray(msg.allowedWeapons)) {
          room.allowedWeapons = sanitizeAllowedWeapons(msg.allowedWeapons);
          for (const p of room.players.values()) {
            syncPlayerAmmoToRoomWeapon(room, p);
          }
        }
        if (typeof msg.infiniteEnergy === 'boolean') {
          room.infiniteEnergy = msg.infiniteEnergy;
        }
        if (typeof msg.darkHideAndSeek === 'boolean') {
          room.darkHideAndSeek = msg.darkHideAndSeek;
        }
        sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        if (!room.isPrivateRoom) {
          broadcastPublicRooms();
        }
        return;
      }

      if (msg.type === 'select_match_weapon') {
        if (isValidWeaponId(msg.weaponId) && room.allowedWeapons.includes(msg.weaponId)) {
          player.matchWeaponOverride = msg.weaponId;
          syncPlayerAmmoToRoomWeapon(room, player);
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        }
        return;
      }

      if (msg.type === 'request_public_rooms') {
        sendTo(ws, { type: 'public_rooms', rooms: getPublicRoomsSummary() });
        return;
      }

      if (msg.type === 'join_room') {
        const code = String(msg.roomCode || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '');
        if (!code) {
          sendTo(ws, { type: 'room_error', message: 'Escribe un código de sala válido.' });
          return;
        }
        const targetRoom = rooms.get(code);
        if (!targetRoom) {
          sendTo(ws, {
            type: 'room_error',
            message: `La sala "${code}" no existe o ya se cerró.`,
          });
          return;
        }
        if (targetRoom.roomCode === room.roomCode) {
          return;
        }
        if (getRoomHumanCount(targetRoom) >= targetRoom.maxPlayers) {
          sendTo(ws, {
            type: 'room_error',
            message: `La sala "${targetRoom.roomName}" ya está llena (${targetRoom.maxPlayers}/${targetRoom.maxPlayers}).`,
          });
          return;
        }
        detachPlayerFromRoom(playerId, room);
        attachPlayerToRoom(player, targetRoom);
        return;
      }

      if (msg.type === 'leave_private_room') {
        const publicRoom = rooms.get(PUBLIC_ROOM_CODE);
        if (!publicRoom || publicRoom.roomCode === room.roomCode) return;
        detachPlayerFromRoom(playerId, room);
        attachPlayerToRoom(player, publicRoom);
        return;
      }

      if (msg.type === 'buy_outfit') {
        if (isValidOutfitId(msg.outfitId)) {
          const outfit = getOutfitById(msg.outfitId);
          if (!player.ownedOutfits.includes(outfit.id) && (player.infiniteCoins || player.coins >= outfit.price)) {
            if (!player.infiniteCoins) {
              player.coins -= outfit.price;
            }
            player.ownedOutfits = [...player.ownedOutfits, outfit.id];
            player.outfitLevels[outfit.id] = player.outfitLevels[outfit.id] ?? 1;
            player.equippedOutfit = outfit.id;
            const nextMaxHp = getPlayerComputedMaxHp(player);
            player.maxHp = nextMaxHp;
            player.hp = nextMaxHp;
            sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          }
        }
        return;
      }

      if (msg.type === 'equip_outfit') {
        if (isValidOutfitId(msg.outfitId) && player.ownedOutfits.includes(msg.outfitId)) {
          player.equippedOutfit = msg.outfitId;
          player.outfitLevels[msg.outfitId] = player.outfitLevels[msg.outfitId] ?? 1;
          const nextMaxHp = getPlayerComputedMaxHp(player);
          player.maxHp = nextMaxHp;
          player.hp = nextMaxHp;
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        }
        return;
      }

      if (msg.type === 'upgrade_outfit') {
        if (isValidOutfitId(msg.outfitId) && player.ownedOutfits.includes(msg.outfitId)) {
          const currentLvl = getOutfitLevel(player.outfitLevels, msg.outfitId);
          const cost = getOutfitUpgradeCost(currentLvl);
          if (cost !== null && (player.infiniteCoins || player.coins >= cost)) {
            if (!player.infiniteCoins) {
              player.coins -= cost;
            }
            player.outfitLevels = {
              ...player.outfitLevels,
              [msg.outfitId]: currentLvl + 1,
            };
            const nextMaxHp = getPlayerComputedMaxHp(player);
            player.maxHp = nextMaxHp;
            player.hp = nextMaxHp;
            sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          }
        }
        return;
      }

      if (msg.type === 'buy_weapon') {
        if (isValidWeaponId(msg.weaponId)) {
          const weapon = getWeaponById(msg.weaponId);
          if (!player.ownedWeapons.includes(weapon.id) && (player.infiniteCoins || player.coins >= weapon.price)) {
            if (!player.infiniteCoins) {
              player.coins -= weapon.price;
            }
            player.ownedWeapons = [...player.ownedWeapons, weapon.id];
            if (isSidearmWeapon(weapon.id)) {
              player.equippedSidearm = weapon.id;
            } else {
              player.equippedWeapon = weapon.id;
              if (room.allowedWeapons.includes(weapon.id)) {
                player.matchWeaponOverride = weapon.id;
              }
            }
            syncPlayerAmmoToRoomWeapon(room, player);
            sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          }
        }
        return;
      }

      if (msg.type === 'equip_weapon') {
        if (isValidWeaponId(msg.weaponId) && player.ownedWeapons.includes(msg.weaponId)) {
          if (isSidearmWeapon(msg.weaponId)) {
            player.equippedSidearm = msg.weaponId;
          } else {
            player.equippedWeapon = msg.weaponId;
            if (room.allowedWeapons.includes(msg.weaponId)) {
              player.matchWeaponOverride = msg.weaponId;
            }
          }
          syncPlayerAmmoToRoomWeapon(room, player);
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        }
        return;
      }

      if (msg.type === 'buy_knife') {
        if (isValidKnifeId(msg.knifeId)) {
          const knife = getKnifeById(msg.knifeId);
          if (!player.ownedKnives.includes(knife.id) && (player.infiniteCoins || player.coins >= knife.price)) {
            if (!player.infiniteCoins) {
              player.coins -= knife.price;
            }
            player.ownedKnives = [...player.ownedKnives, knife.id];
            player.equippedKnife = knife.id;
            sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          }
        }
        return;
      }

      if (msg.type === 'equip_knife') {
        if (isValidKnifeId(msg.knifeId) && player.ownedKnives.includes(msg.knifeId)) {
          player.equippedKnife = msg.knifeId;
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        }
        return;
      }

      if (msg.type === 'buy_weapon_skin') {
        if (isValidWeaponSkinId(msg.skinId)) {
          const skin = getWeaponSkinById(msg.skinId);
          if (!player.ownedWeaponSkins.includes(skin.id) && (player.infiniteCoins || player.coins >= skin.price)) {
            if (!player.infiniteCoins) {
              player.coins -= skin.price;
            }
            player.ownedWeaponSkins = [...player.ownedWeaponSkins, skin.id];
            player.equippedWeaponSkin = skin.id;
            sendToRoom(room, { type: 'state', state: getStatePayload(room) });
          }
        }
        return;
      }

      if (msg.type === 'equip_weapon_skin') {
        if (
          isValidWeaponSkinId(msg.skinId) &&
          player.ownedWeaponSkins.includes(msg.skinId)
        ) {
          player.equippedWeaponSkin = msg.skinId;
          sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        }
        return;
      }

      if (msg.type === 'voice:join') {
        const cleanRoom = String(msg.room || 'general')
          .trim()
          .toLowerCase()
          .slice(0, 24) || 'general';
        const prevRoom = player.voiceRoom;
        if (prevRoom && prevRoom !== cleanRoom) {
          for (const other of room.players.values()) {
            if (other.id !== playerId && other.voiceRoom === prevRoom) {
              const targetWs = sockets.get(other.id);
              if (targetWs) sendTo(targetWs, { type: 'voice:peer_left', peerId: playerId });
            }
          }
        }
        player.voiceRoom = cleanRoom;
        player.voiceSpeaking = false;
        sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        return;
      }

      if (msg.type === 'voice:leave') {
        const prevRoom = player.voiceRoom;
        player.voiceRoom = null;
        player.voiceSpeaking = false;
        if (prevRoom) {
          for (const other of room.players.values()) {
            if (other.id !== playerId && other.voiceRoom === prevRoom) {
              const targetWs = sockets.get(other.id);
              if (targetWs) sendTo(targetWs, { type: 'voice:peer_left', peerId: playerId });
            }
          }
        }
        sendToRoom(room, { type: 'state', state: getStatePayload(room) });
        return;
      }

      if (msg.type === 'voice:speaking') {
        player.voiceSpeaking = Boolean(msg.speaking) && Boolean(player.voiceRoom);
        return;
      }

      if (msg.type === 'voice:signal') {
        const target = room.players.get(msg.targetId);
        const targetWs = sockets.get(msg.targetId);
        if (target && targetWs && target.voiceRoom && target.voiceRoom === player.voiceRoom) {
          sendTo(targetWs, {
            type: 'voice:signal',
            fromId: playerId,
            signal: msg.signal,
          });
        }
        return;
      }
    });

    ws.on('close', () => {
      const found = getPlayerAndRoom(playerId);
      sockets.delete(playerId);
      clientRooms.delete(playerId);
      if (found) {
        detachPlayerFromRoom(playerId, found.room);
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Apex Laser Tag Arena server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
