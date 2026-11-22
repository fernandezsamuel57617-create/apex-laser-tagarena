import type { DailyMissionId } from './dailyMissions.ts';
import type { EmoteId } from './emotes.ts';
import type { KnifeId } from './knives.ts';
import type { OutfitId } from './outfits.ts';
import type { WeaponId } from './weapons.ts';
import type { WeaponSkinId } from './weaponSkins.ts';

export type Gender = 'male' | 'female';

export type WeaponSlot = 'primary' | 'sidearm' | 'knife';

export type TeamMode = 'ffa' | 'teams';

export type MatchMode = 'casual' | 'ranked';

export type RoomPreset = 'standard' | 'duel_1v1';

export type TeamId = 'cyan' | 'rose';

export type GamePhase = 'lobby' | 'countdown' | 'playing' | 'results';

export type ZoneId = 'lobby' | 'arena';

export type ArenaMapId =
  | 'neon_reactor'
  | 'sky_citadel'
  | 'obsidian_maze'
  | 'cyber_colosseum'
  | 'arctic_bastion'
  | 'volcanic_forge'
  | 'solar_temple'
  | 'orbital_station';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type AuditEventSeverity = 'info' | 'warning' | 'critical';

export type AuditEventType =
  | 'speed_hack'
  | 'teleport_hack'
  | 'instant_respawn'
  | 'fire_rate_abuse'
  | 'zone_violation'
  | 'player_report'
  | 'admin_ban'
  | 'admin_unban'
  | 'match_start'
  | 'match_end';

export interface BannedPlayerRecord {
  id: string;
  name: string;
  bannedAt: number;
  bannedBy: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  roomCode: string;
  matchNumber: number;
  type: AuditEventType;
  severity: AuditEventSeverity;
  playerId: string;
  playerName: string;
  details: string;
  reportedById?: string;
  reportedByName?: string;
  reason?: string;
  metricValue?: number;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  gender: Gender;
  country?: string;
  isBot: boolean;
  isAdmin?: boolean;
  team: TeamId | null;
  accentColor: string;
  equippedOutfit: OutfitId;
  ownedOutfits: OutfitId[];
  outfitLevels: Partial<Record<OutfitId, number>>;
  equippedWeapon: WeaponId;
  equippedSidearm: WeaponId;
  activeWeapon?: WeaponId;
  equippedKnife: KnifeId;
  ownedKnives: KnifeId[];
  activeSlot: WeaponSlot;
  ownedWeapons: WeaponId[];
  equippedWeaponSkin: WeaponSkinId;
  ownedWeaponSkins: WeaponSkinId[];
  coins: number;
  lastCoinsEarned: number;
  rankedWins: number;
  flagCount?: number;
  zone: ZoneId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  sliding: boolean;
  crouching?: boolean;
  canFly?: boolean;
  godMode?: boolean;
  speedBoosted?: boolean;
  infiniteAmmo?: boolean;
  infiniteCoins?: boolean;
  hp: number;
  maxHp: number;
  score: number;
  tags: number;
  deaths: number;
  streak: number;
  bestStreak: number;
  alive: boolean;
  deathCamUntil: number;
  deathCamKillerId: string | null;
  deathCamKillerName: string | null;
  shieldUntil: number;
  boostUntil: number;
  ammo: number;
  maxAmmo: number;
  primaryAmmo: number;
  primaryMaxAmmo: number;
  sidearmAmmo: number;
  sidearmMaxAmmo: number;
  reloadingUntil: number;
  voiceRoom: string | null;
  voiceSpeaking: boolean;
  activeEmote: EmoteId | null;
  activeEmoteUntil: number;
}

export type ArenaDropKind = 'weapon' | 'shield' | 'coin';

export interface ArenaDropSnapshot {
  id: string;
  kind: ArenaDropKind;
  weaponId?: WeaponId;
  x: number;
  y: number;
  z: number;
  expiresAt: number;
}

export interface ArenaMeteorSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  landY: number;
}

export type CdmCommandId =
  | 'toggle_fly'
  | 'toggle_speed'
  | 'toggle_god'
  | 'toggle_ammo'
  | 'toggle_infinite_coins'
  | 'heal_full'
  | 'give_coins'
  | 'unlock_all'
  | 'start_match'
  | 'end_match'
  | 'return_lobby'
  | 'toggle_infinite_energy'
  | 'toggle_dark'
  | 'toggle_bots'
  | 'respawn_bots'
  | 'event_weapon_rain'
  | 'event_shield_rain'
  | 'event_coin_rain'
  | 'event_meteor_shower'
  | 'event_overcharge_storm'
  | 'event_blackout'
  | 'event_one_shot'
  | 'event_super_jump'
  | 'event_mega_rain'
  | 'event_low_gravity'
  | 'event_turbo_arena'
  | 'clear_drops'
  | 'clear_events'
  | 'admin_ban'
  | 'admin_unban'
  | 'tp_to_player'
  | 'event_big_heads'
  | 'event_vampire'
  | 'event_ice_floor'
  | 'event_rainbow_chaos'
  | 'event_heal_wave'
  | 'owner_announce'
  | 'clear_owner_announce';

export interface OwnerAnnouncement {
  id: string;
  text: string;
  senderName: string;
  createdAt: number;
  expiresAt: number;
}

export interface ChatMessageEvent {
  id: string;
  senderId: string;
  senderName: string;
  senderCountry?: string;
  team: TeamId | null;
  text: string;
  timestamp: number;
}

export interface LaserBeamEvent {
  id: string;
  shooterId: string;
  zone: ZoneId;
  from: Vec3;
  to: Vec3;
  color: string;
  isCrit: boolean;
  beamRadius?: number;
  hitPlayerId: string | null;
  hitTargetId?: string | null;
  timestamp: number;
}

export interface KillFeedEvent {
  id: string;
  shooterId: string;
  shooterName: string;
  shooterGender: Gender;
  shooterCountry?: string;
  victimId: string;
  victimName: string;
  victimGender: Gender;
  victimCountry?: string;
  isCrit: boolean;
  points: number;
  timestamp: number;
}

export interface BoostPadSnapshot {
  id: string;
  kind: 'overcharge' | 'shield';
  x: number;
  y: number;
  z: number;
  active: boolean;
}

export interface LobbyTargetSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  hitUntil: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  gender: Gender;
  totalScore: number;
  totalTags: number;
  totalDeaths: number;
  wins: number;
  rankedWins: number;
  matchesPlayed: number;
  bestStreak: number;
  bestMatchTags?: number;
  bestMatchScore?: number;
  updatedAt: number;
}

export interface MapVoteSummary {
  counts: Record<ArenaMapId, number>;
  voters: Record<string, ArenaMapId>;
}

export interface PublicRoomSummary {
  roomCode: string;
  roomName: string;
  hostName: string;
  preset: RoomPreset;
  playerCount: number;
  maxPlayers: number;
  currentMapId: ArenaMapId;
  phase: GamePhase;
  matchMode: MatchMode;
  teamMode: TeamMode;
  allowedWeapons: WeaponId[];
  infiniteEnergy: boolean;
  darkHideAndSeek: boolean;
  botsEnabled: boolean;
}

export interface ServerStatePayload {
  phase: GamePhase;
  phaseEndsAt: number;
  voteCountdownEndsAt: number;
  votedPreviewMapId: ArenaMapId | null;
  serverTime: number;
  matchNumber: number;
  roomCode: string;
  roomName: string;
  roomPreset: RoomPreset;
  maxPlayers: number;
  isPrivateRoom: boolean;
  hostPlayerId: string | null;
  teamMode: TeamMode;
  matchMode: MatchMode;
  teamScores: { cyan: number; rose: number };
  currentMapId: ArenaMapId;
  mapVotes: MapVoteSummary;
  botsEnabled: boolean;
  allowedWeapons: WeaponId[];
  infiniteEnergy: boolean;
  darkHideAndSeek: boolean;
  lowGravityUntil?: number;
  turboArenaUntil?: number;
  meteorShowerUntil?: number;
  overchargeStormUntil?: number;
  blackoutUntil?: number;
  oneShotUntil?: number;
  superJumpUntil?: number;
  bigHeadsUntil?: number;
  vampireUntil?: number;
  iceFloorUntil?: number;
  rainbowChaosUntil?: number;
  drops?: ArenaDropSnapshot[];
  meteors?: ArenaMeteorSnapshot[];
  targetScoreTags: number;
  players: PlayerSnapshot[];
  boostPads: BoostPadSnapshot[];
  lobbyTargets: LobbyTargetSnapshot[];
}

export interface VoiceSignalData {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export type ClientToServerMessage =
  | {
      type: 'join';
      name: string;
      gender: Gender;
      country?: string;
      coins?: number;
      rankedWins?: number;
      ownedOutfits?: OutfitId[];
      equippedOutfit?: OutfitId;
      outfitLevels?: Partial<Record<OutfitId, number>>;
      ownedWeapons?: WeaponId[];
      equippedWeapon?: WeaponId;
      equippedSidearm?: WeaponId;
      ownedKnives?: KnifeId[];
      equippedKnife?: KnifeId;
      ownedWeaponSkins?: WeaponSkinId[];
      equippedWeaponSkin?: WeaponSkinId;
      roomCode?: string;
      authIdToken?: string;
    }
  | {
      type: 'move';
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      sliding?: boolean;
      crouching?: boolean;
      zone?: ZoneId;
    }
  | {
      type: 'shoot';
      origin: Vec3;
      dir: Vec3;
    }
  | {
      type: 'melee_slash';
      origin: Vec3;
      dir: Vec3;
    }
  | {
      type: 'switch_slot';
      slot: WeaponSlot;
    }
  | {
      type: 'reload';
    }
  | {
      type: 'start_match';
    }
  | {
      type: 'return_lobby';
    }
  | {
      type: 'toggle_bots';
      enabled: boolean;
    }
  | {
      type: 'toggle_team_mode';
      teamMode: TeamMode;
    }
  | {
      type: 'toggle_match_mode';
      matchMode: MatchMode;
    }
  | {
      type: 'vote_map';
      mapId: ArenaMapId;
    }
  | {
      type: 'buy_outfit';
      outfitId: OutfitId;
    }
  | {
      type: 'equip_outfit';
      outfitId: OutfitId;
    }
  | {
      type: 'upgrade_outfit';
      outfitId: OutfitId;
    }
  | {
      type: 'buy_weapon';
      weaponId: WeaponId;
    }
  | {
      type: 'equip_weapon';
      weaponId: WeaponId;
    }
  | {
      type: 'buy_knife';
      knifeId: KnifeId;
    }
  | {
      type: 'equip_knife';
      knifeId: KnifeId;
    }
  | {
      type: 'buy_weapon_skin';
      skinId: WeaponSkinId;
    }
  | {
      type: 'equip_weapon_skin';
      skinId: WeaponSkinId;
    }
  | {
      type: 'claim_mission_reward';
      missionId: DailyMissionId;
    }
  | {
      type: 'chat';
      text: string;
    }
  | {
      type: 'report_player';
      targetId: string;
      targetName?: string;
      reason?: string;
    }
  | {
      type: 'emote';
      emote: EmoteId;
    }
  | {
      type: 'create_private_room';
    }
  | {
      type: 'create_custom_room';
      isPrivate: boolean;
      customCode?: string;
      roomName?: string;
      preset: RoomPreset;
      mapId: ArenaMapId;
      allowedWeapons: WeaponId[];
      infiniteEnergy: boolean;
      darkHideAndSeek: boolean;
      matchMode?: MatchMode;
      teamMode?: TeamMode;
      botsEnabled?: boolean;
    }
  | {
      type: 'update_room_rules';
      roomPreset?: RoomPreset;
      roomName?: string;
      mapId?: ArenaMapId;
      allowedWeapons?: WeaponId[];
      infiniteEnergy?: boolean;
      darkHideAndSeek?: boolean;
      botsEnabled?: boolean;
    }
  | {
      type: 'select_match_weapon';
      weaponId: WeaponId;
    }
  | {
      type: 'request_public_rooms';
    }
  | {
      type: 'join_room';
      roomCode: string;
    }
  | {
      type: 'leave_private_room';
    }
  | {
      type: 'voice:join';
      room: string;
    }
  | {
      type: 'voice:leave';
    }
  | {
      type: 'voice:speaking';
      speaking: boolean;
    }
  | {
      type: 'voice:signal';
      targetId: string;
      signal: VoiceSignalData;
    }
  | {
      type: 'cdm_request';
      commandLine: string;
      authIdToken?: string;
    }
  | {
      type: 'cdm_execute';
      command: CdmCommandId;
      targetId?: string;
      authIdToken?: string;
    }
  | {
      type: 'auth_refresh';
      authIdToken: string;
    }
  | {
      type: 'ping';
      t: number;
    };

export type ServerToClientMessage =
  | {
      type: 'welcome';
      playerId: string;
      state: ServerStatePayload;
      leaderboard: LeaderboardEntry[];
      ownerAnnouncement?: OwnerAnnouncement | null;
    }
  | {
      type: 'state';
      state: ServerStatePayload;
    }
  | {
      type: 'beam';
      beam: LaserBeamEvent;
    }
  | {
      type: 'killfeed';
      event: KillFeedEvent;
    }
  | {
      type: 'hit_confirm';
      victimId: string;
      damage: number;
      isCrit: boolean;
      killed: boolean;
      hitPos?: Vec3;
      remainingHp?: number;
      maxHp?: number;
    }
  | {
      type: 'damaged';
      shooterId: string;
      damage: number;
      hp: number;
      from: Vec3;
    }
  | {
      type: 'eliminated';
      killerId: string;
      killerName: string;
      killerGender: Gender;
      killerCountry?: string;
      killerOutfit: OutfitId;
      isCrit: boolean;
      deathCamDurationMs: number;
      respawnDelayMs: number;
    }
  | {
      type: 'match_reward';
      coinsEarned: number;
      totalCoins: number;
      won: boolean;
      isMvp: boolean;
      tags: number;
      bestStreak: number;
      matchMode: MatchMode;
      rankedWins: number;
    }
  | {
      type: 'leaderboard';
      leaderboard: LeaderboardEntry[];
    }
  | {
      type: 'voice:signal';
      fromId: string;
      signal: VoiceSignalData;
    }
  | {
      type: 'voice:peer_left';
      peerId: string;
    }
  | {
      type: 'player_emote';
      playerId: string;
      emote: EmoteId;
      expiresAt: number;
    }
  | {
      type: 'chat';
      message: ChatMessageEvent;
    }
  | {
      type: 'chat_blocked';
      reason: string;
    }
  | {
      type: 'report_ack';
      targetId: string;
      targetName: string;
      accepted: boolean;
      message: string;
    }
  | {
      type: 'room_error';
      message: string;
    }
  | {
      type: 'public_rooms';
      rooms: PublicRoomSummary[];
    }
  | {
      type: 'cdm_response';
      authorized: boolean;
      openPanel?: boolean;
      ok?: boolean;
      message?: string;
      bannedPlayers?: BannedPlayerRecord[];
      activePowers?: {
        canFly: boolean;
        speedBoosted: boolean;
        godMode: boolean;
        infiniteAmmo: boolean;
        infiniteCoins?: boolean;
      };
    }
  | {
      type: 'teleport_to';
      zone: ZoneId;
      x: number;
      y: number;
      z: number;
      yaw: number;
      targetName?: string;
    }
  | {
      type: 'owner_announcement';
      announcement: OwnerAnnouncement | null;
    }
  | {
      type: 'pong';
      t: number;
    };
