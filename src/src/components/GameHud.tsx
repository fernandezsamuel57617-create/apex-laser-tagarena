import {
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bot,
  Check,
  Coins,
  Copy,
  Crosshair,
  Crown,
  Eye,
  EyeOff,
  Flag,
  Gauge,
  HelpCircle,
  KeyRound,
  LogOut,
  Map as MapIcon,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Shirt,
  SlidersHorizontal,
  Smile,
  Swords,
  Target,
  Terminal,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RoomInviteRecord } from '../firebase';
import type { WeaponHudState } from '../game/ArenaEngine';
import { ARENA_MAP_LIST, getMapConfig } from '../shared/arenaData';
import { countryCodeToFlag } from '../shared/countries';
import { getEmoteById, type EmoteId } from '../shared/emotes';
import { getKnifeById } from '../shared/knives';
import { getOutfitById, getOutfitLevel, type OutfitId } from '../shared/outfits';
import type { PlayerSettings, TouchLayoutMap } from '../shared/playerSettings';
import { getRankByWins } from '../shared/ranks';
import { getWeaponById, type WeaponId } from '../shared/weapons';
import type {
  ArenaMapId,
  ChatMessageEvent,
  Gender,
  KillFeedEvent,
  MatchMode,
  PlayerSnapshot,
  PublicRoomSummary,
  RoomPreset,
  ServerStatePayload,
  TeamMode,
  WeaponSlot,
} from '../shared/types';
import type { VoiceStatus } from '../voice/voiceManager';
import { GENDER_PORTRAIT, type LeaderboardTab } from './LeaderboardModal';
import { MAP_AERIAL_IMAGES } from './mapAerialImages';
import { MatchChatPanel } from './MatchChatPanel';
import { MiniMap } from './MiniMap';
import { MobileControlsOverlay } from './MobileControlsOverlay';
import { MobileLobbyHub, type MobileHubTab } from './MobileLobbyHub';
import { PWAInstallButton } from './PWAInstallButton';
import { RankBadge } from './RankBadge';
import { ResultsPodium3D } from './ResultsPodium3D';
import {
  RoomVoiceModal,
  type CreateCustomRoomInput,
  type RoomModalTab,
  type UpdateRoomRulesInput,
} from './RoomVoiceModal';
import { SettingsModal } from './SettingsModal';
import { VoiceChatPanel } from './VoiceChatPanel';

interface HitMarkerState {
  active: boolean;
  isCrit: boolean;
  killed: boolean;
}

export interface DamagePopup {
  id: number;
  damage: number;
  isCrit: boolean;
  killed: boolean;
  x: number;
  y: number;
  comboTotal: number;
}

export interface DeathCamHudState {
  killerId: string;
  killerName: string;
  killerGender: Gender;
  killerCountry?: string;
  killerOutfit: OutfitId;
  isCrit: boolean;
  endsAt: number;
  totalMs: number;
}

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>;
}

interface GameHudProps {
  state: ServerStatePayload;
  myId: string | null;
  pingMs: number | null;
  hitMarker: HitMarkerState;
  damagePopups?: DamagePopup[];
  damageFlash: boolean;
  deathCam: DeathCamHudState | null;
  weaponState: WeaponHudState;
  killFeed: KillFeedEvent[];
  muted: boolean;
  voiceStatus: VoiceStatus;
  roomError: string | null;
  incomingInvites: RoomInviteRecord[];
  chatMessages: ChatMessageEvent[];
  chatBlockedReason: string | null;
  chatFocusSignal: number;
  claimableMissionsCount: number;
  onJoinVoiceRoom: (room: string) => void;
  onLeaveVoiceRoom: () => void;
  onToggleMicMute: () => void;
  onToggleDeafen: () => void;
  onToggleMute: () => void;
  onStartMatch: () => void;
  onReturnLobby: () => void;
  onToggleBots: () => void;
  onToggleTeamMode: (mode: TeamMode) => void;
  onToggleMatchMode: (mode: MatchMode) => void;
  onVoteMap: (mapId: ArenaMapId) => void;
  onOpenInventory: () => void;
  onOpenMissions: () => void;
  onOpenTutorial: () => void;
  onOpenFriends: () => void;
  onAcceptInvite: (invite: RoomInviteRecord) => void;
  onDeclineInvite: (invite: RoomInviteRecord) => void;
  onOpenEmotes: () => void;
  onTriggerEmote: (emote: EmoteId) => void;
  onCreatePrivateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onLeavePrivateRoom: () => void;
  onClearRoomError: () => void;
  publicRooms: PublicRoomSummary[];
  onCreateCustomRoom: (input: CreateCustomRoomInput) => void;
  onUpdateRoomRules: (input: UpdateRoomRulesInput) => void;
  onSelectMatchWeapon: (weaponId: WeaponId) => void;
  onRefreshPublicRooms: () => void;
  onSendChat: (text: string) => void;
  onClearChatBlocked: () => void;
  onReload: () => void;
  onSwitchSlot?: (slot: WeaponSlot) => void;
  onOpenLeaderboard: (tab: LeaderboardTab) => void;
  onSignOut?: () => void;
  reportedIds?: Record<string, boolean>;
  reportFeedback?: string | null;
  onReportPlayer?: (targetId: string, targetName: string, reason: string) => void;
  touchInputMode?: boolean;
  settings: PlayerSettings;
  onUpdateSettings: (next: PlayerSettings) => void;
  onTouchMove?: (strafe: number, forward: number) => void;
  onTouchFireChange?: (firing: boolean) => void;
  onTouchAimChange?: (aiming: boolean) => void;
  onTouchSprintChange?: (sprinting: boolean) => void;
  onTouchCrouchChange?: (crouching: boolean) => void;
  onTouchJump?: () => void;
  onTouchSlide?: () => void;
  cdmOpen?: boolean;
  onOpenCdm?: () => void;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function GameHud({
  state,
  myId,
  pingMs,
  hitMarker,
  damagePopups = [],
  damageFlash,
  deathCam,
  weaponState,
  killFeed,
  muted,
  voiceStatus,
  roomError,
  incomingInvites,
  chatMessages,
  chatBlockedReason,
  chatFocusSignal,
  claimableMissionsCount,
  onJoinVoiceRoom,
  onLeaveVoiceRoom,
  onToggleMicMute,
  onToggleDeafen,
  onToggleMute,
  onStartMatch,
  onReturnLobby,
  onToggleBots,
  onToggleTeamMode,
  onToggleMatchMode,
  onVoteMap,
  onOpenInventory,
  onOpenMissions,
  onOpenTutorial,
  onOpenFriends,
  onAcceptInvite,
  onDeclineInvite,
  onOpenEmotes,
  onTriggerEmote,
  onCreatePrivateRoom,
  onJoinRoom,
  onLeavePrivateRoom,
  onClearRoomError,
  publicRooms,
  onCreateCustomRoom,
  onUpdateRoomRules,
  onSelectMatchWeapon,
  onRefreshPublicRooms,
  onSendChat,
  onClearChatBlocked,
  onReload,
  onSwitchSlot,
  onOpenLeaderboard,
  onSignOut,
  reportedIds = {},
  reportFeedback = null,
  onReportPlayer,
  touchInputMode = false,
  settings,
  onUpdateSettings,
  onTouchMove,
  onTouchFireChange,
  onTouchAimChange,
  onTouchSprintChange,
  onTouchCrouchChange,
  onTouchJump,
  onTouchSlide,
  cdmOpen = false,
  onOpenCdm,
}: GameHudProps) {
  const me = state.players.find((p) => p.id === myId) ?? null;
  const humanCount = state.players.filter((p) => !p.isBot).length;
  const now = state.serverTime;

  const [copiedCode, setCopiedCode] = useState(false);
  const [reportingTarget, setReportingTarget] = useState<{ id: string; name: string } | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || window.innerHeight < 520;
  });
  const [forceTouchControls, setForceTouchControls] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomModalTab, setRoomModalTab] = useState<RoomModalTab>('current');
  const [roomModalPreset, setRoomModalPreset] = useState<RoomPreset>('duel_1v1');
  const [hudEditMode, setHudEditMode] = useState(false);
  const [desktopLobbyPanel, setDesktopLobbyPanel] = useState<'modes' | 'maps' | null>(null);
  const [mobileHubDrawer, setMobileHubDrawer] = useState<MobileHubTab | null>(null);
  const [mobileRadarOpen, setMobileRadarOpen] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [batteryState, setBatteryState] = useState<{
    levelPct: number | null;
    charging: boolean;
    supported: boolean;
  }>({ levelPct: null, charging: false, supported: false });

  const openRoomVoiceModal = (
    tab: RoomModalTab = 'current',
    preset: RoomPreset = 'duel_1v1',
  ) => {
    setRoomModalTab(tab);
    setRoomModalPreset(preset);
    setDesktopLobbyPanel(null);
    setMobileHubDrawer(null);
    setRoomModalOpen(true);
  };

  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth < 768 || window.innerHeight < 520);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Real-time FPS counter via requestAnimationFrame
  useEffect(() => {
    let rafId = 0;
    let frames = 0;
    let lastSample = performance.now();

    const sampleLoop = (nowTs: number) => {
      frames += 1;
      const elapsed = nowTs - lastSample;
      if (elapsed >= 450) {
        setFps(Math.max(1, Math.round((frames * 1000) / elapsed)));
        frames = 0;
        lastSample = nowTs;
      }
      rafId = window.requestAnimationFrame(sampleLoop);
    };

    rafId = window.requestAnimationFrame(sampleLoop);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Battery Status API listener for mobile & laptop power awareness
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== 'function') return;

    let active = true;
    let batteryRef: BatteryManagerLike | null = null;

    const syncBattery = () => {
      if (!active || !batteryRef) return;
      const raw = Number.isFinite(batteryRef.level) ? batteryRef.level : 0;
      setBatteryState({
        levelPct: Math.max(0, Math.min(100, Math.round(raw * 100))),
        charging: Boolean(batteryRef.charging),
        supported: true,
      });
    };

    nav
      .getBattery()
      .then((battery) => {
        if (!active || !battery) return;
        batteryRef = battery;
        syncBattery();
        battery.addEventListener('levelchange', syncBattery);
        battery.addEventListener('chargingchange', syncBattery);
      })
      .catch(() => {
        // Battery API unavailable in this environment
      });

    return () => {
      active = false;
      if (batteryRef) {
        batteryRef.removeEventListener('levelchange', syncBattery);
        batteryRef.removeEventListener('chargingchange', syncBattery);
      }
    };
  }, []);

  useEffect(() => {
    if (state.phase !== 'lobby') {
      setMobileHubDrawer(null);
      setDesktopLobbyPanel(null);
    }
    if (state.phase !== 'playing') {
      setMobileRadarOpen(false);
    }
    if (state.phase === 'countdown' || state.phase === 'results') {
      setHudEditMode(false);
      setSettingsOpen(false);
      setRoomModalOpen(false);
    }
  }, [state.phase]);

  const showTouchButtons = Boolean(touchInputMode || isMobileViewport || forceTouchControls);

  const batteryColorClass =
    batteryState.levelPct === null
      ? 'text-slate-400'
      : batteryState.charging
        ? 'text-cyan-300'
        : batteryState.levelPct <= 20
          ? 'text-rose-400'
          : batteryState.levelPct <= 45
            ? 'text-amber-300'
            : 'text-emerald-300';

  const BatteryIconComponent =
    batteryState.levelPct === null
      ? Battery
      : batteryState.charging
        ? BatteryCharging
        : batteryState.levelPct <= 20
          ? BatteryLow
          : batteryState.levelPct <= 60
            ? BatteryMedium
            : BatteryFull;

  const fpsColorClass =
    fps === null
      ? 'text-slate-400'
      : fps >= 50
        ? 'text-emerald-300'
        : fps >= 30
          ? 'text-amber-300'
          : 'text-rose-300';

  // Clock-synced local ticker for smooth countdown, vote timer, Death Cam & auto-return from results
  const clockOffsetRef = useRef<number>(state.serverTime - Date.now());
  clockOffsetRef.current = state.serverTime - Date.now();
  const [localNowMs, setLocalNowMs] = useState<number>(() => Date.now());
  const [perfNowMs, setPerfNowMs] = useState<number>(() => performance.now());
  const autoReturnedEndsAtRef = useRef<number>(0);

  const hasVoteCountdown = state.phase === 'lobby' && state.voteCountdownEndsAt > 0;

  useEffect(() => {
    if (
      state.phase !== 'results' &&
      state.phase !== 'countdown' &&
      state.phase !== 'playing' &&
      !hasVoteCountdown &&
      !deathCam
    ) {
      autoReturnedEndsAtRef.current = 0;
      return;
    }
    setLocalNowMs(Date.now());
    setPerfNowMs(performance.now());
    const id = window.setInterval(() => {
      setLocalNowMs(Date.now());
      setPerfNowMs(performance.now());
    }, 80);
    return () => window.clearInterval(id);
  }, [state.phase, hasVoteCountdown, deathCam]);

  const syncedNowMs = localNowMs + clockOffsetRef.current;
  const timeLeftMs = Math.max(0, state.phaseEndsAt - syncedNowMs);
  const voteTimeLeftMs = hasVoteCountdown ? Math.max(0, state.voteCountdownEndsAt - syncedNowMs) : 0;
  const voteProgressPct = hasVoteCountdown
    ? Math.max(0, Math.min(100, (voteTimeLeftMs / 5000) * 100))
    : 0;
  const resultsTotalMs = 10_000;
  const resultsProgressPct =
    state.phase === 'results'
      ? Math.max(0, Math.min(100, (timeLeftMs / resultsTotalMs) * 100))
      : 0;

  const deathCamLeftMs =
    deathCam && me && !me.alive ? Math.max(0, deathCam.endsAt - perfNowMs) : 0;
  const isDeathCamActive = Boolean(
    state.phase === 'playing' && me && !me.alive && deathCam && deathCamLeftMs > 0,
  );
  const myVote = myId ? state.mapVotes?.voters?.[myId] ?? null : null;
  const activeMap = getMapConfig(state.currentMapId);
  const previewMap = state.votedPreviewMapId ? getMapConfig(state.votedPreviewMapId) : null;

  const handleCopyRoomCode = () => {
    if (!state.roomCode) return;
    navigator.clipboard?.writeText(state.roomCode).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  useEffect(() => {
    if (
      state.phase === 'results' &&
      state.phaseEndsAt > 0 &&
      syncedNowMs - state.phaseEndsAt > 900 &&
      autoReturnedEndsAtRef.current !== state.phaseEndsAt
    ) {
      autoReturnedEndsAtRef.current = state.phaseEndsAt;
      onReturnLobby();
    }
  }, [state.phase, state.phaseEndsAt, syncedNowMs, onReturnLobby]);

  const sortedMatchPlayers = [...state.players].sort(
    (a, b) => b.score - a.score || b.tags - a.tags,
  );
  const topPlayer = sortedMatchPlayers[0] ?? null;
  const topThree = sortedMatchPlayers.slice(0, 3);
  const myTeam = me?.team ?? 'cyan';
  const myTeamPlayers = [...state.players]
    .filter((p) => p.team === myTeam)
    .sort((a, b) => b.tags - a.tags || b.score - a.score);
  const myTeamMvp = myTeamPlayers[0] ?? null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Damage Vignette Flash */}
      {damageFlash && (
        <div
          className="fixed inset-0 border-8 border-rose-500/70 bg-rose-600/15 transition-opacity duration-150"
          aria-hidden="true"
        />
      )}

      {/* Center Reticle, ADS Sight & Reload Indicator (ONLY in Combat Arena when alive — Lobby is unarmed) */}
      {state.phase === 'playing' && me?.alive && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {weaponState.isAiming && (
              <span className="absolute h-10 w-10 rounded-full border border-cyan-300/70" />
            )}

            {/* Dynamic Crosshair lines (tighten when aiming) */}
            <span
              className={`absolute w-0.5 transition-all duration-100 ${
                weaponState.isAiming
                  ? 'h-2.5 -top-3 bg-amber-300'
                  : 'h-3 -top-4 bg-cyan-300/90'
              }`}
            />
            <span
              className={`absolute w-0.5 transition-all duration-100 ${
                weaponState.isAiming
                  ? 'h-2.5 top-0.5 bg-amber-300'
                  : 'h-3 top-1 bg-cyan-300/90'
              }`}
            />
            <span
              className={`absolute h-0.5 transition-all duration-100 ${
                weaponState.isAiming
                  ? 'w-2.5 -left-3 bg-amber-300'
                  : 'w-3 -left-4 bg-cyan-300/90'
              }`}
            />
            <span
              className={`absolute h-0.5 transition-all duration-100 ${
                weaponState.isAiming
                  ? 'w-2.5 left-0.5 bg-amber-300'
                  : 'w-3 left-1 bg-cyan-300/90'
              }`}
            />
            <span
              className={`h-1 w-1 rounded-full ${
                weaponState.isAiming ? 'bg-amber-300' : 'bg-white'
              }`}
            />

            {/* Reload Progress Bar under reticle */}
            {weaponState.isReloading && (
              <div className="absolute top-7 flex flex-col items-center gap-1">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-900/90 border border-slate-700">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${Math.round(weaponState.reloadProgress * 100)}%` }}
                  />
                </div>
                <span className="font-display text-[10px] font-bold tracking-wider text-amber-300">
                  RECARGANDO
                </span>
              </div>
            )}

            {/* Hitmarker X */}
            {hitMarker.active && (
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                className="absolute"
                aria-hidden="true"
              >
                <line
                  x1="6"
                  y1="6"
                  x2="12"
                  y2="12"
                  stroke={hitMarker.killed ? '#F43F5E' : hitMarker.isCrit ? '#F59E0B' : '#FFFFFF'}
                  strokeWidth="2.5"
                />
                <line
                  x1="26"
                  y1="6"
                  x2="20"
                  y2="12"
                  stroke={hitMarker.killed ? '#F43F5E' : hitMarker.isCrit ? '#F59E0B' : '#FFFFFF'}
                  strokeWidth="2.5"
                />
                <line
                  x1="6"
                  y1="26"
                  x2="12"
                  y2="20"
                  stroke={hitMarker.killed ? '#F43F5E' : hitMarker.isCrit ? '#F59E0B' : '#FFFFFF'}
                  strokeWidth="2.5"
                />
                <line
                  x1="26"
                  y1="26"
                  x2="20"
                  y2="20"
                  stroke={hitMarker.killed ? '#F43F5E' : hitMarker.isCrit ? '#F59E0B' : '#FFFFFF'}
                  strokeWidth="2.5"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Floating Hit Damage Numbers (All Modes) */}
      {state.phase === 'playing' && damagePopups.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true">
          {damagePopups.map((popup) => (
            <div
              key={popup.id}
              className="animate-damage-float absolute flex flex-col items-center whitespace-nowrap drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
              style={{ left: `${popup.x}px`, top: `${popup.y}px` }}
            >
              <span
                className={`font-display font-extrabold tracking-tight ${
                  popup.killed
                    ? 'text-xl sm:text-2xl text-rose-400'
                    : popup.isCrit
                      ? 'text-lg sm:text-xl text-amber-300'
                      : 'text-base sm:text-lg text-white'
                }`}
              >
                {popup.killed ? 'KO ' : popup.isCrit ? 'CRÍT ' : ''}-{popup.damage}
              </span>
              {popup.comboTotal > popup.damage && (
                <span className="font-mono-tab -mt-1 text-[10px] font-bold text-cyan-200/95">
                  Total {popup.comboTotal}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MOBILE COMPACT TOP BAR (Phone / Compact Viewports) */}
      {isMobileViewport && state.phase !== 'results' && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-20 flex items-start justify-between gap-2 px-3 pt-safe">
          {/* Top-Left: Rank, Coins, Room Badge + Lobby/Countdown FPS & Battery Telemetry */}
          <div className="pointer-events-auto flex flex-col items-start gap-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {state.phase === 'playing' ? (
                <button
                  type="button"
                  onClick={() => setMobileRadarOpen((v) => !v)}
                  className={`flex min-h-[38px] items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold ${
                    mobileRadarOpen
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-700/80 bg-[#0B101B]/88 text-slate-200'
                  }`}
                >
                  <MapIcon className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>Radar</span>
                </button>
              ) : (
                me && (
                  <button
                    type="button"
                    onClick={() => onOpenLeaderboard('ranked')}
                    className="flex min-h-[38px] items-center gap-1 rounded-xl border border-slate-700/80 bg-[#0B101B]/88 px-2 py-1 text-xs font-semibold text-slate-100 shrink-0"
                  >
                    <RankBadge rankedWins={me.rankedWins ?? 0} size="xs" />
                  </button>
                )
              )}

              {me && (
                <div className="flex min-h-[38px] items-center gap-1 rounded-xl border border-amber-400/40 bg-[#0B101B]/88 px-2.5 py-1 text-xs font-semibold shrink-0">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono-tab text-amber-300">
                    {me.infiniteCoins ? '∞' : me.coins}
                  </span>
                </div>
              )}

              {state.phase === 'lobby' && (
                <span
                  className={`flex min-h-[38px] items-center rounded-xl border px-2 py-1 font-mono-tab text-[11px] font-bold shrink-0 ${
                    state.isPrivateRoom
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                      : 'border-cyan-500/35 bg-cyan-500/15 text-cyan-300'
                  }`}
                >
                  {state.isPrivateRoom ? state.roomCode : 'PÚBLICA'}
                </span>
              )}
            </div>

            {state.phase !== 'playing' && (
              <div
                aria-label="Rendimiento y batería"
                className="pointer-events-none flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#0B101B]/88 px-2 py-0.5 font-mono-tab text-[10px] font-semibold whitespace-nowrap"
              >
                <span className={`inline-flex items-center gap-1 ${fpsColorClass}`}>
                  <Gauge className="h-3 w-3 shrink-0" />
                  <span>{fps !== null ? `${fps} FPS` : '-- FPS'}</span>
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className={`inline-flex items-center gap-1 ${batteryColorClass}`}>
                  <BatteryIconComponent className="h-3 w-3 shrink-0" />
                  <span>
                    {batteryState.supported && batteryState.levelPct !== null
                      ? `${batteryState.levelPct}%`
                      : '--%'}
                  </span>
                </span>
                {pingMs !== null && (
                  <>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="text-slate-300">{pingMs}ms</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Top-Center (Combat): Compact Clock, Team Score, FPS & Battery */}
          {state.phase === 'playing' && (
            <div className="pointer-events-none flex flex-col items-center gap-1 shrink-0">
              <div className="flex flex-col items-center rounded-xl border border-slate-700/80 bg-[#0B101B]/90 px-3 py-1 text-center">
                <div
                  className={`font-mono-tab text-sm font-bold leading-tight ${
                    state.infiniteMatch ? 'text-amber-300' : 'text-white'
                  }`}
                >
                  {state.infiniteMatch ? '∞ INFINITA' : formatClock(timeLeftMs)}
                </div>
                {state.teamMode === 'teams' ? (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold leading-tight">
                    <span className="font-mono-tab text-cyan-300">{state.teamScores.cyan}</span>
                    <span className="text-slate-500">vs</span>
                    <span className="font-mono-tab text-rose-300">{state.teamScores.rose}</span>
                  </div>
                ) : topPlayer ? (
                  <div className="text-[10px] font-semibold text-amber-300 leading-tight max-w-[110px] truncate">
                    {topPlayer.name}{' '}
                    {state.infiniteMatch
                      ? `${topPlayer.tags} ★`
                      : `${topPlayer.tags}/${state.targetScoreTags}`}
                  </div>
                ) : null}
              </div>

              <div
                aria-label="FPS y nivel de batería"
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B101B]/88 px-2 py-0.5 font-mono-tab text-[10px] font-semibold whitespace-nowrap"
              >
                <span className={`inline-flex items-center gap-1 ${fpsColorClass}`}>
                  <Gauge className="h-2.5 w-2.5 shrink-0" />
                  <span>{fps !== null ? `${fps} FPS` : '--'}</span>
                </span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className={`inline-flex items-center gap-1 ${batteryColorClass}`}>
                  <BatteryIconComponent className="h-3 w-3 shrink-0" />
                  <span>
                    {batteryState.supported && batteryState.levelPct !== null
                      ? `${batteryState.levelPct}%`
                      : '--%'}
                  </span>
                </span>
              </div>

              {((state.lowGravityUntil ?? 0) > now ||
                (state.turboArenaUntil ?? 0) > now ||
                (state.meteorShowerUntil ?? 0) > now ||
                (state.overchargeStormUntil ?? 0) > now ||
                (state.blackoutUntil ?? 0) > now ||
                (state.oneShotUntil ?? 0) > now ||
                (state.superJumpUntil ?? 0) > now ||
                (state.bigHeadsUntil ?? 0) > now ||
                (state.vampireUntil ?? 0) > now ||
                (state.iceFloorUntil ?? 0) > now ||
                (state.rainbowChaosUntil ?? 0) > now) && (
                <div className="flex flex-wrap items-center justify-center gap-1 text-[9px] font-bold">
                  {(state.meteorShowerUntil ?? 0) > now && (
                    <span className="rounded border border-orange-400/60 bg-orange-500/25 px-1.5 py-0.5 text-orange-200">
                      METEORITOS
                    </span>
                  )}
                  {(state.oneShotUntil ?? 0) > now && (
                    <span className="rounded border border-rose-400/60 bg-rose-500/25 px-1.5 py-0.5 text-rose-200">
                      1-HIT
                    </span>
                  )}
                  {(state.overchargeStormUntil ?? 0) > now && (
                    <span className="rounded border border-cyan-400/60 bg-cyan-500/25 px-1.5 py-0.5 text-cyan-200">
                      SOBRECARGA
                    </span>
                  )}
                  {(state.blackoutUntil ?? 0) > now && (
                    <span className="rounded border border-indigo-400/60 bg-indigo-500/25 px-1.5 py-0.5 text-indigo-200">
                      APAGÓN
                    </span>
                  )}
                  {(state.superJumpUntil ?? 0) > now && (
                    <span className="rounded border border-emerald-400/60 bg-emerald-500/25 px-1.5 py-0.5 text-emerald-200">
                      SÚPER SALTO
                    </span>
                  )}
                  {(state.lowGravityUntil ?? 0) > now && (
                    <span className="rounded border border-indigo-400/50 bg-indigo-500/25 px-1.5 py-0.5 text-indigo-200">
                      GRAVEDAD LUNAR
                    </span>
                  )}
                  {(state.turboArenaUntil ?? 0) > now && (
                    <span className="rounded border border-rose-400/50 bg-rose-500/25 px-1.5 py-0.5 text-rose-200">
                      TURBO
                    </span>
                  )}
                  {(state.bigHeadsUntil ?? 0) > now && (
                    <span className="rounded border border-amber-400/60 bg-amber-500/25 px-1.5 py-0.5 text-amber-200">
                      CABEZONES
                    </span>
                  )}
                  {(state.vampireUntil ?? 0) > now && (
                    <span className="rounded border border-rose-400/60 bg-rose-600/25 px-1.5 py-0.5 text-rose-200">
                      VAMPIRO
                    </span>
                  )}
                  {(state.iceFloorUntil ?? 0) > now && (
                    <span className="rounded border border-sky-400/60 bg-sky-500/25 px-1.5 py-0.5 text-sky-200">
                      HIELO
                    </span>
                  )}
                  {(state.rainbowChaosUntil ?? 0) > now && (
                    <span className="rounded border border-fuchsia-400/60 bg-fuchsia-500/25 px-1.5 py-0.5 text-fuchsia-200">
                      LÁSER CAOS
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Top-Right: Quick Utility Buttons (>= 38px) */}
          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            {state.phase === 'lobby' && <PWAInstallButton compact />}
            {me?.isAdmin && onOpenCdm && (
              <button
                type="button"
                onClick={onOpenCdm}
                aria-label="Panel Admin CDM"
                className={`flex h-[38px] items-center gap-1 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                  cdmOpen
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                    : 'border-cyan-500/50 bg-[#0B101B]/92 text-cyan-300'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>CDM</span>
              </button>
            )}

            {state.phase === 'playing' && (
              <>
                <button
                  type="button"
                  onClick={onOpenEmotes}
                  aria-label="Emotes"
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-700/80 bg-[#0B101B]/88 text-cyan-300"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLeaderboard('live')}
                  aria-label="Marcador"
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-700/80 bg-[#0B101B]/88 text-amber-300"
                >
                  <Trophy className="h-4 w-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Configuración"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-700/80 bg-[#0B101B]/88 text-slate-200"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onOpenTutorial}
              aria-label="Tutorial de controles"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-700/80 bg-[#0B101B]/88 text-cyan-300"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-700/80 bg-[#0B101B]/88 text-slate-200"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {onSignOut && state.phase === 'lobby' && (
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Cerrar sesión"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-slate-700/80 bg-[#0B101B]/88 text-slate-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* MOBILE EXPANDABLE RADAR & COMPACT KILL FEED */}
      {isMobileViewport && state.phase === 'playing' && (
        <>
          {mobileRadarOpen && (
            <div className="pointer-events-none fixed top-26 left-3 z-20">
              <MiniMap state={state} myId={myId} />
            </div>
          )}
          {killFeed.length > 0 && (
            <div className="pointer-events-none fixed top-14 right-3 z-10 space-y-1 max-w-[52vw]">
              {killFeed.slice(0, 2).map((kf) => (
                <div
                  key={kf.id}
                  className="truncate rounded-lg border border-slate-800/80 bg-[#0B101B]/85 px-2 py-1 text-[10px] text-slate-200"
                >
                  <span className="font-semibold text-cyan-300">{kf.shooterName}</span>{' '}
                  <span className="text-slate-500">→</span>{' '}
                  <span className="font-semibold text-rose-300">{kf.victimName}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* MOBILE DEPLOY COUNTDOWN OVERLAY */}
      {isMobileViewport && state.phase === 'countdown' && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-20 w-72 overflow-hidden rounded-xl border border-amber-400/70 bg-[#0B101B]/95 text-center shadow-2xl">
          <div className="relative h-28 w-full bg-slate-900">
            <img
              src={MAP_AERIAL_IMAGES[activeMap.id]}
              alt={`Vista aérea de ${activeMap.name}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B101B] via-[#0B101B]/35 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xs font-semibold text-amber-300">
                Desplegando en {activeMap.name}
              </div>
              <div className="font-mono-tab text-4xl font-bold text-white mt-0.5">
                {Math.max(1, Math.ceil(timeLeftMs / 1000))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR CLUSTER (Desktop) */}
      {!isMobileViewport && (
      <div className="flex items-start justify-between p-4 md:p-5 gap-4">
        {/* Top-Left: Compact Lobby Pill (Lobby) OR Match Leader + MiniMap (Combat/Countdown) */}
        <div className="flex flex-col items-start gap-2.5">
          {state.phase === 'lobby' ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#0B101B]/90 px-3 py-1.5 shadow-lg">
              <button
                type="button"
                onClick={() => openRoomVoiceModal('current')}
                className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <KeyRound
                  className={`h-3.5 w-3.5 ${
                    state.isPrivateRoom ? 'text-amber-400' : 'text-cyan-400'
                  }`}
                />
                <span className="font-mono-tab font-bold">
                  {state.isPrivateRoom
                    ? `PRIVADA ${state.roomCode}`
                    : state.roomCode !== 'PUBLIC'
                      ? state.roomName || 'PÚBLICA'
                      : 'PÚBLICA'}
                </span>
                {state.roomPreset === 'duel_1v1' && (
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    1v1
                  </span>
                )}
                <span className="text-slate-500">·</span>
                <span className="font-mono-tab text-cyan-300">
                  {humanCount}/{state.maxPlayers}
                </span>
              </button>

              {state.roomCode !== 'PUBLIC' && (
                <button
                  type="button"
                  onClick={handleCopyRoomCode}
                  title="Copiar código de sala"
                  className="flex items-center gap-1 rounded border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-400/20 cursor-pointer"
                >
                  {copiedCode ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}

              <span className="h-3.5 w-px bg-slate-700" aria-hidden="true" />

              <button
                type="button"
                onClick={() =>
                  setDesktopLobbyPanel((p) => (p === 'maps' ? null : 'maps'))
                }
                className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <MapIcon className="h-3.5 w-3.5 text-cyan-400" />
                <span>{activeMap.name}</span>
              </button>

              {state.infiniteEnergy && (
                <span
                  title="Energía infinita activa"
                  className="rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300"
                >
                  ∞
                </span>
              )}
              {state.darkHideAndSeek && (
                <span
                  title="Modo Escondite en Oscuro activo"
                  className="rounded border border-indigo-400/40 bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-200"
                >
                  Oscuro
                </span>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-700/80 bg-[#0B101B]/90 px-4 py-2.5">
                <div className="text-[11px] font-medium text-slate-400">Líder de Partida</div>
                {topPlayer ? (
                  <div className="mt-0.5 flex items-center gap-2">
                    <RankBadge rankedWins={topPlayer.rankedWins ?? 0} size="xs" />
                    <span className="font-display text-sm font-bold text-amber-300">
                      {topPlayer.country ? `${countryCodeToFlag(topPlayer.country)} ` : ''}
                      {topPlayer.name}
                    </span>
                    <span className="font-mono-tab text-xs font-semibold text-slate-200">
                      {state.infiniteMatch
                        ? `${topPlayer.tags} tags`
                        : `${topPlayer.tags}/${state.targetScoreTags} tags`}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">—</div>
                )}
              </div>

              {state.phase !== 'results' && <MiniMap state={state} myId={myId} />}
            </>
          )}
        </div>

        {/* Top-Center: Aerial Map Vote Preview + Auto-Countdown, Match Clock, or Deploy Countdown */}
        {state.phase === 'lobby' && hasVoteCountdown && previewMap && (
          <div className="w-80 overflow-hidden rounded-xl border border-cyan-400/70 bg-[#0B101B]/95 shadow-2xl">
            <div className="relative h-36 w-full bg-slate-900">
              <img
                src={MAP_AERIAL_IMAGES[previewMap.id]}
                alt={`Vista aérea de ${previewMap.name}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B101B] via-transparent to-transparent" />
              <div className="absolute top-2.5 right-2.5 rounded-lg border border-amber-400/60 bg-[#0B101B]/90 px-2.5 py-1 font-mono-tab text-sm font-bold text-amber-300">
                {Math.max(1, Math.ceil(voteTimeLeftMs / 1000))}s
              </div>
              <div className="absolute bottom-2 left-3 right-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  Vista Aérea · Mapa Votado
                </div>
                <div className="font-display text-lg font-bold text-white leading-tight">
                  {previewMap.name}
                </div>
              </div>
            </div>
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Llevando jugadores a la arena...</span>
                <span className="font-mono-tab font-bold text-cyan-300">
                  {state.mapVotes?.counts?.[previewMap.id] ?? 0} votos
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-cyan-400 transition-all duration-75"
                  style={{ width: `${voteProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {state.phase === 'playing' && (
          <div className="rounded-xl border border-slate-700/80 bg-[#0B101B]/92 px-6 py-2 text-center">
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
              <span>{activeMap.name}</span>
              {state.roomPreset === 'duel_1v1' && (
                <span className="rounded border border-amber-400/50 bg-amber-400/15 px-1.5 py-0.2 font-bold text-amber-300">
                  PvP 1v1
                </span>
              )}
              {state.darkHideAndSeek && (
                <span className="rounded border border-indigo-400/50 bg-indigo-500/20 px-1.5 py-0.2 font-bold text-indigo-200">
                  ESCONDITE OSCURO
                </span>
              )}
              {state.infiniteMatch && (
                <span className="rounded border border-amber-400/55 bg-amber-500/20 px-1.5 py-0.2 font-bold text-amber-300">
                  PARTIDA ∞
                </span>
              )}
              {state.infiniteEnergy && (
                <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.2 font-bold text-emerald-300">
                  ENERGÍA ∞
                </span>
              )}
              {state.matchMode === 'ranked' && (
                <span className="rounded border border-amber-400/50 bg-amber-400/15 px-1.5 py-0.2 font-bold text-amber-300">
                  CLASIFICATORIA
                </span>
              )}
              {(state.meteorShowerUntil ?? 0) > now && (
                <span className="rounded border border-orange-400/60 bg-orange-500/25 px-1.5 py-0.2 font-bold text-orange-200">
                  METEORITOS
                </span>
              )}
              {(state.oneShotUntil ?? 0) > now && (
                <span className="rounded border border-rose-400/60 bg-rose-500/25 px-1.5 py-0.2 font-bold text-rose-200">
                  MODO 1-HIT
                </span>
              )}
              {(state.overchargeStormUntil ?? 0) > now && (
                <span className="rounded border border-cyan-400/60 bg-cyan-500/25 px-1.5 py-0.2 font-bold text-cyan-200">
                  SOBRECARGA
                </span>
              )}
              {(state.blackoutUntil ?? 0) > now && (
                <span className="rounded border border-indigo-400/60 bg-indigo-500/25 px-1.5 py-0.2 font-bold text-indigo-200">
                  APAGÓN
                </span>
              )}
              {(state.superJumpUntil ?? 0) > now && (
                <span className="rounded border border-emerald-400/60 bg-emerald-500/25 px-1.5 py-0.2 font-bold text-emerald-200">
                  SÚPER SALTO
                </span>
              )}
              {(state.lowGravityUntil ?? 0) > now && (
                <span className="rounded border border-indigo-400/55 bg-indigo-500/25 px-1.5 py-0.2 font-bold text-indigo-200">
                  GRAVEDAD LUNAR
                </span>
              )}
              {(state.turboArenaUntil ?? 0) > now && (
                <span className="rounded border border-rose-400/55 bg-rose-500/25 px-1.5 py-0.2 font-bold text-rose-200">
                  ARENA TURBO
                </span>
              )}
              {(state.bigHeadsUntil ?? 0) > now && (
                <span className="rounded border border-amber-400/60 bg-amber-500/25 px-1.5 py-0.2 font-bold text-amber-200">
                  CABEZONES
                </span>
              )}
              {(state.vampireUntil ?? 0) > now && (
                <span className="rounded border border-rose-400/60 bg-rose-600/25 px-1.5 py-0.2 font-bold text-rose-200">
                  VAMPIRO
                </span>
              )}
              {(state.iceFloorUntil ?? 0) > now && (
                <span className="rounded border border-sky-400/60 bg-sky-500/25 px-1.5 py-0.2 font-bold text-sky-200">
                  PISTA HIELO
                </span>
              )}
              {(state.rainbowChaosUntil ?? 0) > now && (
                <span className="rounded border border-fuchsia-400/60 bg-fuchsia-500/25 px-1.5 py-0.2 font-bold text-fuchsia-200">
                  LÁSER CAOS
                </span>
              )}
              {(state.drops?.length ?? 0) > 0 && (
                <span className="rounded border border-cyan-400/50 bg-cyan-500/20 px-1.5 py-0.2 font-bold text-cyan-200">
                  {state.drops?.length} DROPS
                </span>
              )}
            </div>
            <div
              className={`font-mono-tab text-2xl font-bold tracking-wider ${
                state.infiniteMatch ? 'text-amber-300' : 'text-white'
              }`}
            >
              {state.infiniteMatch ? '∞ INFINITA' : formatClock(timeLeftMs)}
            </div>
            {state.teamMode === 'teams' && (
              <div className="mt-1 flex items-center justify-center gap-3 border-t border-slate-800 pt-1 text-xs font-bold">
                <span className="font-mono-tab text-cyan-300">
                  AZUL {state.teamScores.cyan}
                  {me?.team === 'cyan' ? ' (Tú)' : ''}
                </span>
                <span className="text-slate-500">vs</span>
                <span className="font-mono-tab text-rose-300">
                  {state.teamScores.rose} ROJO
                  {me?.team === 'rose' ? ' (Tú)' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {state.phase === 'countdown' && (
          <div className="w-80 overflow-hidden rounded-xl border border-amber-400/70 bg-[#0B101B]/95 text-center shadow-2xl">
            <div className="relative h-32 w-full bg-slate-900">
              <img
                src={MAP_AERIAL_IMAGES[activeMap.id]}
                alt={`Vista aérea de ${activeMap.name}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B101B] via-[#0B101B]/35 to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {state.matchMode === 'ranked' && (
                  <span className="mb-1 rounded border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Modo Rangos · Clasificatoria
                  </span>
                )}
                <div className="text-xs font-semibold text-amber-300">
                  Desplegando en {activeMap.name}
                </div>
                <div className="font-mono-tab text-5xl font-bold text-white mt-0.5">
                  {Math.max(1, Math.ceil(timeLeftMs / 1000))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top-Right: Kill Feed + Quick Utility */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-2">
            {me && (
              <button
                type="button"
                onClick={() => onOpenLeaderboard('ranked')}
                title={`Tu rango actual: ${getRankByWins(me.rankedWins ?? 0).name} (${me.rankedWins ?? 0} victorias en Rangos)`}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B101B]/92 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-amber-400/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RankBadge rankedWins={me.rankedWins ?? 0} size="xs" showLabel />
              </button>
            )}

            {me && (
              <div
                title={me.infiniteCoins ? 'Monedas infinitas activas' : 'Monedas ganadas'}
                className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-[#0B101B]/92 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono-tab text-amber-300">
                  {me.infiniteCoins ? '∞' : me.coins}
                </span>
              </div>
            )}

            <div
              title={
                batteryState.supported && batteryState.levelPct !== null
                  ? `Latencia WebSocket · FPS reales · Batería ${batteryState.levelPct}%${
                      batteryState.charging ? ' (Cargando)' : ''
                    }`
                  : 'Latencia WebSocket · FPS reales · Batería no disponible en este navegador'
              }
              className="flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-[#0B101B]/92 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <span className="inline-flex items-center gap-1">
                <Wifi
                  className={`h-3.5 w-3.5 ${
                    pingMs === null
                      ? 'text-slate-500'
                      : pingMs < 70
                        ? 'text-emerald-400'
                        : pingMs < 150
                          ? 'text-amber-300'
                          : 'text-rose-400'
                  }`}
                />
                <span
                  className={`font-mono-tab ${
                    pingMs === null
                      ? 'text-slate-400'
                      : pingMs < 70
                        ? 'text-emerald-300'
                        : pingMs < 150
                          ? 'text-amber-200'
                          : 'text-rose-300'
                  }`}
                >
                  {pingMs !== null ? `${pingMs} ms` : '-- ms'}
                </span>
              </span>

              <span className="h-3.5 w-px bg-slate-800" aria-hidden="true" />

              <span className={`inline-flex items-center gap-1 font-mono-tab ${fpsColorClass}`}>
                <Gauge className="h-3.5 w-3.5 shrink-0" />
                <span>{fps !== null ? `${fps} FPS` : '-- FPS'}</span>
              </span>

              <span className="h-3.5 w-px bg-slate-800" aria-hidden="true" />

              <span className={`inline-flex items-center gap-1 font-mono-tab ${batteryColorClass}`}>
                <BatteryIconComponent className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {batteryState.supported && batteryState.levelPct !== null
                    ? `${batteryState.levelPct}%`
                    : '--%'}
                </span>
              </span>
            </div>

            {state.phase === 'lobby' && <PWAInstallButton compact />}

            {me?.isAdmin && onOpenCdm && (
              <button
                type="button"
                onClick={onOpenCdm}
                title="Abrir o cerrar Consola Admin CDM [F4]"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cdmOpen
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-100'
                    : 'border-cyan-500/55 bg-[#0B101B]/92 text-cyan-300 hover:border-cyan-400 hover:text-white'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Admin CDM</span>
                <span className="font-mono-tab text-[10px] opacity-75">[F4]</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenMissions}
              className="relative flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B101B]/92 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-amber-400/60 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Target className="h-3.5 w-3.5 text-amber-400" />
              <span>Misiones</span>
              {claimableMissionsCount > 0 && (
                <span className="ml-0.5 rounded bg-amber-400 px-1.5 py-0.2 font-mono-tab text-[10px] font-bold text-slate-950">
                  {claimableMissionsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenFriends}
              className="relative flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B101B]/92 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 text-cyan-400" />
              <span>Amigos</span>
              {incomingInvites.length > 0 && (
                <span className="ml-0.5 rounded bg-amber-400 px-1.5 py-0.2 font-mono-tab text-[10px] font-bold text-slate-950">
                  {incomingInvites.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenLeaderboard(state.phase === 'playing' ? 'live' : 'global')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#0B101B]/92 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-amber-400/60 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>Leaderboard</span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Configuración"
              title="Configuración (Sensibilidad y Gráficos)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0B101B]/92 text-slate-200 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenTutorial}
              aria-label="Tutorial de controles"
              title="Tutorial de controles"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0B101B]/92 text-cyan-300 hover:border-cyan-400/60 transition-colors cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-[#0B101B]/92 text-slate-200 hover:border-slate-500 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>

            {onSignOut && state.phase === 'lobby' && (
              <button
                type="button"
                onClick={onSignOut}
                title="Cerrar sesión de Google"
                className="flex h-8 items-center gap-1 rounded-lg border border-slate-700/80 bg-[#0B101B]/92 px-2.5 text-xs font-semibold text-slate-300 hover:border-rose-400/60 hover:text-rose-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Salir</span>
              </button>
            )}
          </div>

          {incomingInvites.length > 0 && (
            <div className="pointer-events-auto w-72 space-y-1.5">
              {incomingInvites.slice(0, 2).map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl border border-amber-400/60 bg-[#0D1422]/96 px-3 py-2.5 shadow-xl"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-white">
                      {inv.fromCountry ? `${countryCodeToFlag(inv.fromCountry)} ` : ''}
                      {inv.fromName} te invita
                    </span>
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono-tab text-[10px] font-bold text-amber-300 border border-amber-400/40 shrink-0">
                      {inv.roomCode}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDeclineInvite(inv)}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
                    >
                      Ignorar
                    </button>
                    <button
                      type="button"
                      onClick={() => onAcceptInvite(inv)}
                      className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                    >
                      Unirse
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {state.phase !== 'lobby' && (
            <VoiceChatPanel
              voiceStatus={voiceStatus}
              players={state.players}
              myId={myId}
              onJoinRoom={onJoinVoiceRoom}
              onLeaveRoom={onLeaveVoiceRoom}
              onToggleMicMute={onToggleMicMute}
              onToggleDeafen={onToggleDeafen}
            />
          )}

          {state.phase === 'playing' && killFeed.length > 0 && (
            <div className="space-y-1.5 mt-1">
              {killFeed.slice(0, 4).map((kf) => (
                <div
                  key={kf.id}
                  className="rounded-lg border border-slate-800 bg-[#0B101B]/90 px-3 py-1.5 text-xs text-slate-200 flex items-center gap-2"
                >
                  <span className="font-semibold text-cyan-300">
                    {kf.shooterCountry ? `${countryCodeToFlag(kf.shooterCountry)} ` : ''}
                    {kf.shooterName}
                  </span>
                  <span className="text-slate-500">marcó a</span>
                  <span className="font-semibold text-rose-300">
                    {kf.victimCountry ? `${countryCodeToFlag(kf.victimCountry)} ` : ''}
                    {kf.victimName}
                  </span>
                  {kf.isCrit && <span className="font-mono-tab text-amber-400 font-bold">CRÍTICO</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 3-SECOND DEATH CAM SPECTATOR VIEW BEFORE RESPAWN SCREEN */}
      {isDeathCamActive && deathCam && (
        <div className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-20 w-max max-w-[92vw]">
          <div className="rounded-xl border border-rose-500/60 bg-[#0B101B]/92 px-3.5 py-2.5 sm:px-5 sm:py-3.5 shadow-2xl">
            <div className="flex items-center justify-between gap-6 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-rose-400">
                <Eye className="h-4 w-4" />
                <span>CÁMARA DE ELIMINACIÓN</span>
                {deathCam.isCrit && (
                  <span className="rounded border border-amber-400/60 bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                    CRÍTICO
                  </span>
                )}
              </div>
              <span className="font-mono-tab text-xs font-bold text-slate-200">
                {(deathCamLeftMs / 1000).toFixed(1)}s
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-3">
              <img
                src={GENDER_PORTRAIT[deathCam.killerGender]}
                alt={deathCam.killerName}
                referrerPolicy="no-referrer"
                className="h-10 w-10 rounded-lg object-cover object-top border border-rose-500/50 bg-slate-900"
              />
              <div>
                <div className="text-[11px] text-slate-400">Eliminado por</div>
                <div className="font-display text-base font-bold text-white">
                  {deathCam.killerCountry ? `${countryCodeToFlag(deathCam.killerCountry)} ` : ''}
                  {deathCam.killerName}
                </div>
              </div>
              <div className="ml-4 text-right text-xs text-slate-400">
                <div>Traje</div>
                <div className="font-medium text-cyan-300">
                  {getOutfitById(deathCam.killerOutfit).name}
                </div>
              </div>
            </div>

            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-rose-500 transition-all duration-75"
                style={{
                  width: `${Math.max(0, Math.min(100, (deathCamLeftMs / deathCam.totalMs) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* RESPAWN SCREEN (Appears after the 3-second Death Cam completes) */}
      {state.phase === 'playing' && me && !me.alive && !isDeathCamActive && (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-rose-500/60 bg-[#0B101B]/95 px-7 py-4 text-center">
            <div className="font-display text-xl font-bold text-rose-400">
              Traje Desactivado
            </div>
            <div className="mt-1 text-sm text-slate-300">
              Reapareciendo en la arena...
            </div>
          </div>
        </div>
      )}

      {/* MINIMAL PC LOBBY BOTTOM ACTION DOCK + CLEAN POPOVERS (Desktop) */}
      {!isMobileViewport && state.phase === 'lobby' && (
        <div className="pointer-events-auto fixed bottom-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2.5 w-max max-w-[94vw]">
          {/* Expandable Popovers (only shown on click, keeping 3D lobby unobstructed) */}
          {desktopLobbyPanel === 'modes' && (
            <div className="w-[420px] max-w-[92vw] rounded-2xl border border-slate-700/85 bg-[#0B101B]/96 p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-2 font-display text-sm font-bold text-white">
                  <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                  <span>Reglas y Modos de Partida</span>
                </span>
                <button
                  type="button"
                  onClick={() => setDesktopLobbyPanel(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Cerrar panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleMatchMode('casual')}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    state.matchMode === 'casual'
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  Casual
                </button>
                <button
                  type="button"
                  onClick={() => onToggleMatchMode('ranked')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    state.matchMode === 'ranked'
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-800 bg-slate-900 text-amber-300 hover:border-amber-400/50'
                  }`}
                >
                  <Swords className="h-3.5 w-3.5" />
                  <span>Modo Rangos</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleBots}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    state.botsEnabled
                      ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Bot className="h-4 w-4" />
                  <span>
                    {state.roomPreset === 'duel_1v1' ? 'Bot 1v1' : 'Drones IA'}:{' '}
                    {state.botsEnabled ? 'Sí' : 'No'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleTeamMode(state.teamMode === 'teams' ? 'ffa' : 'teams')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    state.teamMode === 'teams'
                      ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>{state.teamMode === 'teams' ? 'Equipos' : 'Todos vs Todos'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateRoomRules({ infiniteEnergy: !state.infiniteEnergy })}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    state.infiniteEnergy
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Zap className="h-4 w-4 text-emerald-400" />
                  <span>Energía Infinita: {state.infiniteEnergy ? 'Sí' : 'No'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateRoomRules({ darkHideAndSeek: !state.darkHideAndSeek })}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    state.darkHideAndSeek
                      ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <EyeOff className="h-4 w-4 text-indigo-300" />
                  <span>Oscuro: {state.darkHideAndSeek ? 'Sí' : 'No'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openRoomVoiceModal('current')}
                  className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
                >
                  <Crosshair className="h-4 w-4 text-cyan-300" />
                  <span>Armas y Reglas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDesktopLobbyPanel(null);
                    onOpenLeaderboard('ranked');
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400/60 hover:text-amber-200 cursor-pointer"
                >
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>Tabla de Rangos</span>
                </button>
              </div>
            </div>
          )}

          {desktopLobbyPanel === 'maps' && (
            <div className="w-[420px] max-w-[92vw] rounded-2xl border border-slate-700/85 bg-[#0B101B]/96 p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="flex items-center gap-2 font-display text-sm font-bold text-white">
                  <MapIcon className="h-4 w-4 text-cyan-400" />
                  <span>Votar o Fijar Mapa</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    {Object.values(state.mapVotes?.counts ?? {}).reduce((a, b) => a + b, 0)} votos
                  </span>
                  <button
                    type="button"
                    onClick={() => setDesktopLobbyPanel(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    aria-label="Cerrar votación"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {ARENA_MAP_LIST.map((m) => {
                  const votes = state.mapVotes?.counts?.[m.id] ?? 0;
                  const voted = myVote === m.id;
                  const isCurrent = state.currentMapId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onVoteMap(m.id)}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                        voted || isCurrent
                          ? 'border-cyan-400/70 bg-cyan-500/15 text-white'
                          : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="truncate font-medium">{m.name}</span>
                      <span className="font-mono-tab text-[11px] font-bold text-cyan-300 shrink-0">
                        {votes}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => openRoomVoiceModal('current')}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-400 cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Fijar mapa y reglas de sala</span>
              </button>
            </div>
          )}

          {/* Sleek Single-Row Dock */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#0B101B]/94 px-3.5 py-2.5 shadow-2xl">
            <button
              type="button"
              onClick={onStartMatch}
              className="flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-2 font-display text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Play className="h-4 w-4 fill-slate-950" />
              <span>Empezar</span>
            </button>

            <button
              type="button"
              onClick={() => setDesktopLobbyPanel((p) => (p === 'modes' ? null : 'modes'))}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                desktopLobbyPanel === 'modes'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
              <span>
                {state.matchMode === 'ranked' ? 'Rangos' : 'Casual'}
                {state.teamMode === 'teams' ? ' · Equipos' : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDesktopLobbyPanel((p) => (p === 'maps' ? null : 'maps'))}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                desktopLobbyPanel === 'maps'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5 text-cyan-400" />
              <span>Mapas</span>
            </button>

            <button
              type="button"
              onClick={() => openRoomVoiceModal('create', 'duel_1v1')}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Swords className="h-3.5 w-3.5 text-amber-300" />
              <span>PvP 1v1</span>
            </button>

            <button
              type="button"
              onClick={() => openRoomVoiceModal('current')}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                roomModalOpen
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-400/60'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
              <span>Sala y Voz</span>
            </button>

            <button
              type="button"
              onClick={onOpenInventory}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shirt className="h-3.5 w-3.5 text-amber-300" />
              <span>Arsenal</span>
            </button>

            <button
              type="button"
              onClick={onOpenEmotes}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-400/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Smile className="h-3.5 w-3.5 text-cyan-400" />
              <span>Emotes</span>
            </button>
          </div>
        </div>
      )}

      {/* REMAINING LASERS, SLOT BAR, AIM & RELOAD PANEL (Desktop — Hidden on Phone to clear Thumb Zone) */}
      {!isMobileViewport && state.phase === 'playing' && me && (() => {
        const primaryDef = getWeaponById(weaponState.primaryWeaponId);
        const sidearmDef = getWeaponById(weaponState.sidearmWeaponId);
        const knifeDef = getKnifeById(weaponState.knifeId);
        const isKnife = weaponState.activeSlot === 'knife';
        return (
        <div className="fixed bottom-5 right-5 flex flex-col items-end gap-2">
          <div className="flex items-center gap-4 rounded-xl border border-slate-700/80 bg-[#0B101B]/92 px-4 py-2.5">
            <div className="text-center">
              <div className="text-[11px] text-slate-400">Tags</div>
              <div className="font-mono-tab text-lg font-bold text-cyan-300">{me.tags}</div>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div className="text-center">
              <div className="text-[11px] text-slate-400">Racha</div>
              <div className="font-mono-tab text-lg font-bold text-amber-300">{me.streak}</div>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div className="text-center">
              <div className="text-[11px] text-slate-400">Puntos</div>
              <div className="font-mono-tab text-lg font-bold text-white">{me.score}</div>
            </div>
          </div>

          {/* Desktop 3-Slot Weapon & Knife Switcher */}
          <div className="pointer-events-auto grid w-64 grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onSwitchSlot?.('primary')}
              className={`rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                weaponState.activeSlot === 'primary'
                  ? 'border-cyan-400 bg-cyan-500/20 text-white'
                  : 'border-slate-700/80 bg-[#0B101B]/88 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-cyan-300">[1]</span>
                <span className="font-mono-tab">{weaponState.primaryAmmo}</span>
              </div>
              <div className="truncate text-[10px] font-semibold">{primaryDef.name}</div>
            </button>

            <button
              type="button"
              onClick={() => onSwitchSlot?.('sidearm')}
              className={`rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                weaponState.activeSlot === 'sidearm'
                  ? 'border-cyan-400 bg-cyan-500/20 text-white'
                  : 'border-slate-700/80 bg-[#0B101B]/88 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-cyan-300">[2]</span>
                <span className="font-mono-tab">{weaponState.sidearmAmmo}</span>
              </div>
              <div className="truncate text-[10px] font-semibold">{sidearmDef.name}</div>
            </button>

            <button
              type="button"
              onClick={() => onSwitchSlot?.('knife')}
              className={`rounded-lg border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                weaponState.activeSlot === 'knife'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                  : 'border-slate-700/80 bg-[#0B101B]/88 text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-amber-300">[G]</span>
                <Swords className="h-3 w-3 text-amber-300" />
              </div>
              <div className="truncate text-[10px] font-semibold">{knifeDef.name}</div>
            </button>
          </div>

          <div className="pointer-events-auto w-64 rounded-xl border border-slate-700/80 bg-[#0B101B]/92 p-3.5">
            {isKnife ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200 min-w-0">
                    <Swords className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span className="truncate">{knifeDef.name}</span>
                  </div>
                  <span className="font-mono-tab text-xs font-bold text-amber-300 shrink-0">
                    Cuerpo a Cuerpo
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-center text-[10px]">
                  <div>
                    <div className="text-slate-400">Daño</div>
                    <div className="font-mono-tab font-bold text-rose-300">{knifeDef.damage}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Alcance</div>
                    <div className="font-mono-tab font-bold text-cyan-300">{knifeDef.range.toFixed(1)}m</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Vel.</div>
                    <div className="font-mono-tab font-bold text-emerald-300">
                      +{Math.round((knifeDef.speedBonus - 1) * 100)}%
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span>Clic Izq Cortar</span>
                  <span className="text-amber-300 font-semibold">[G] Guardar · [1/2] Arma</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 min-w-0">
                    <Crosshair
                      className={`h-3.5 w-3.5 shrink-0 ${
                        weaponState.isAiming ? 'text-amber-400' : 'text-cyan-400'
                      }`}
                    />
                    <span className="truncate">
                      {weaponState.isAiming
                        ? 'Apuntando'
                        : getWeaponById(weaponState.weaponId).name}
                    </span>
                  </div>
                  <div className="font-mono-tab text-base font-bold shrink-0">
                    {me?.infiniteAmmo ? (
                      <span className="text-cyan-300">∞</span>
                    ) : (
                      <>
                        <span
                          className={
                            weaponState.ammo === 0
                              ? 'text-rose-400'
                              : weaponState.ammo <= Math.max(1, Math.ceil(weaponState.maxAmmo * 0.25))
                                ? 'text-amber-300'
                                : 'text-cyan-300'
                          }
                        >
                          {weaponState.ammo}
                        </span>
                        <span className="text-slate-500 text-xs"> / {weaponState.maxAmmo}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Segmented Laser Charge Cells */}
                <div
                  className="mt-2 grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${
                      weaponState.maxAmmo <= 6 ? weaponState.maxAmmo : 12
                    }, minmax(0, 1fr))`,
                  }}
                  aria-label={`Láseres restantes: ${weaponState.ammo} de ${weaponState.maxAmmo}`}
                >
                  {Array.from({ length: weaponState.maxAmmo }).map((_, i) => {
                    const filled = Boolean(me?.infiniteAmmo) || i < weaponState.ammo;
                    const lowThreshold = Math.max(1, Math.ceil(weaponState.maxAmmo * 0.25));
                    const cellColor = !filled
                      ? 'bg-slate-800'
                      : !me?.infiniteAmmo && weaponState.ammo <= lowThreshold
                        ? 'bg-amber-400'
                        : 'bg-cyan-400';
                    return <span key={i} className={`h-2.5 rounded-xs ${cellColor}`} />;
                  })}
                </div>

                {/* Reload Progress or Action Hint */}
                {weaponState.isReloading ? (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-300">
                      <span>Recargando celda...</span>
                      <span className="font-mono-tab">
                        {Math.round(weaponState.reloadProgress * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-amber-400 transition-all duration-75"
                        style={{ width: `${Math.round(weaponState.reloadProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span>[G] Cuchillo · [Ctrl] Agachar</span>
                    <button
                      type="button"
                      onClick={onReload}
                      disabled={Boolean(me?.infiniteAmmo) || weaponState.ammo >= weaponState.maxAmmo}
                      className={`font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        !me?.infiniteAmmo && weaponState.ammo < weaponState.maxAmmo
                          ? 'text-amber-300 hover:text-amber-200 cursor-pointer'
                          : 'text-slate-500 cursor-default'
                      }`}
                    >
                      {me?.infiniteAmmo ? '∞ Munición' : '[R] Recargar'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        );
      })()}

      {/* DESKTOP LOBBY ACTIVE KNIFE & EMOTE INDICATOR */}
      {!isMobileViewport && state.phase === 'lobby' && (
        <div className="pointer-events-none fixed bottom-5 right-5 flex flex-col items-end gap-1.5">
          {weaponState.activeSlot === 'knife' && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-[#0B101B]/92 px-3 py-1.5 text-xs font-semibold text-amber-200">
              <Swords className="h-3.5 w-3.5 text-amber-400" />
              <span>{getKnifeById(weaponState.knifeId).name} · Clic Izq Cortar · [G] Guardar</span>
            </div>
          )}
          {me?.activeEmote && me.activeEmoteUntil > syncedNowMs && (
            <div className="rounded-lg border border-cyan-400/50 bg-[#0B101B]/92 px-3 py-1.5 text-xs font-semibold text-cyan-200">
              {getEmoteById(me.activeEmote).emoji} {getEmoteById(me.activeEmote).label}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE MATCH BOTTOM-LEFT SUIT & SPRINT ENERGY BAR (Desktop) */}
      {!isMobileViewport && state.phase === 'playing' && me && (() => {
        const suitMaxHp = Math.max(100, me.maxHp || 100);
        const suitHpPct = Math.max(0, Math.min(100, (me.hp / suitMaxHp) * 100));
        const suitLevel = getOutfitLevel(me.outfitLevels, me.equippedOutfit);
        return (
        <div className="fixed bottom-5 left-5 w-64 rounded-xl border border-slate-700/80 bg-[#0B101B]/92 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <RankBadge rankedWins={me.rankedWins ?? 0} size="xs" />
              <span className="truncate font-display text-xs font-bold text-white">
                {me.country ? `${countryCodeToFlag(me.country)} ` : ''}
                {me.name}
              </span>
            </div>
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono-tab text-[10px] font-bold text-emerald-300 shrink-0">
              Nv.{suitLevel}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">Energía del Traje</span>
              <span className="font-mono-tab text-sm font-bold text-white">
                {me.hp}
                <span className="text-xs text-slate-400">/{suitMaxHp}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-150 ${
                  suitHpPct > 50 ? 'bg-cyan-400' : suitHpPct > 25 ? 'bg-amber-400' : 'bg-rose-500'
                }`}
                style={{ width: `${suitHpPct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">
                Energía al Correr <span className="text-[10px] text-slate-400">[Shift]</span>
              </span>
              <span
                className={`font-mono-tab text-xs font-bold ${
                  state.infiniteEnergy
                    ? 'text-emerald-300'
                    : weaponState.sprintEnergy < 20
                      ? 'text-rose-400'
                      : weaponState.isSprinting
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                }`}
              >
                {state.infiniteEnergy ? '∞ Infinita' : `${weaponState.sprintEnergy}%`}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  state.infiniteEnergy
                    ? 'bg-emerald-400'
                    : weaponState.sprintEnergy < 20
                      ? 'bg-rose-500'
                      : weaponState.isSprinting
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                }`}
                style={{
                  width: `${
                    state.infiniteEnergy
                      ? 100
                      : Math.max(0, Math.min(100, weaponState.sprintEnergy))
                  }%`,
                }}
              />
            </div>
          </div>

          {state.phase === 'playing' && (
            <div className="pointer-events-auto flex items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                {weaponState.canFly && (
                  <span className="text-cyan-300 font-bold">Volar [Espacio/Ctrl]</span>
                )}
                {weaponState.isCrouching && !weaponState.canFly && (
                  <span className="text-emerald-300 font-bold">Agachado [Ctrl]</span>
                )}
                {weaponState.isSliding && (
                  <span className="text-cyan-300 font-bold">Deslizando [C]</span>
                )}
                {me.godMode && (
                  <span className="text-amber-300 font-bold">Inmortal</span>
                )}
                {me.boostUntil > now && (
                  <span className="flex items-center gap-1 text-amber-300">
                    <Zap className="h-3.5 w-3.5" />
                    Sobrecarga
                  </span>
                )}
                {me.shieldUntil > now && (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <Shield className="h-3.5 w-3.5" />
                    Escudo
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenEmotes}
                className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 hover:border-cyan-400 cursor-pointer"
              >
                <Smile className="h-3 w-3" />
                <span>[B] Emotes</span>
              </button>
            </div>
          )}
        </div>
        );
      })()}

      {/* MOBILE IN-MATCH & LOBBY INVENTORY HOTBAR (3-Slot Switcher: Long Gun / Pistol / Knife) */}
      {isMobileViewport &&
        me &&
        me.alive &&
        !hudEditMode &&
        (state.phase === 'playing' || (state.phase === 'lobby' && !mobileHubDrawer)) && (() => {
          const primaryDef = getWeaponById(weaponState.primaryWeaponId);
          const sidearmDef = getWeaponById(weaponState.sidearmWeaponId);
          const knifeDef = getKnifeById(weaponState.knifeId);
          const barBottomClass = state.phase === 'playing' ? 'bottom-[104px]' : 'bottom-3';
          return (
            <div
              className={`pointer-events-auto fixed ${barBottomClass} left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-xl border border-slate-700/85 bg-[#0B101B]/90 p-1 shadow-xl`}
            >
              <button
                type="button"
                onClick={() => onSwitchSlot?.('primary')}
                className={`flex min-h-[44px] min-w-[66px] max-w-[82px] flex-col justify-center rounded-lg border px-2 py-1 text-left transition-colors active:scale-95 ${
                  weaponState.activeSlot === 'primary'
                    ? 'border-cyan-400 bg-cyan-500/25 text-white'
                    : 'border-slate-700/80 bg-slate-900/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                  <span className="text-cyan-300">1·LARGA</span>
                  <span className="font-mono-tab text-white">{weaponState.primaryAmmo}</span>
                </div>
                <div className="truncate text-[10px] font-semibold leading-tight">
                  {primaryDef.name}
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSwitchSlot?.('sidearm')}
                className={`flex min-h-[44px] min-w-[66px] max-w-[82px] flex-col justify-center rounded-lg border px-2 py-1 text-left transition-colors active:scale-95 ${
                  weaponState.activeSlot === 'sidearm'
                    ? 'border-cyan-400 bg-cyan-500/25 text-white'
                    : 'border-slate-700/80 bg-slate-900/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                  <span className="text-cyan-300">2·PISTOLA</span>
                  <span className="font-mono-tab text-white">{weaponState.sidearmAmmo}</span>
                </div>
                <div className="truncate text-[10px] font-semibold leading-tight">
                  {sidearmDef.name}
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSwitchSlot?.(weaponState.activeSlot === 'knife' ? 'primary' : 'knife')}
                className={`flex min-h-[44px] min-w-[66px] max-w-[82px] flex-col justify-center rounded-lg border px-2 py-1 text-left transition-colors active:scale-95 ${
                  weaponState.activeSlot === 'knife'
                    ? 'border-amber-400 bg-amber-500/25 text-amber-100'
                    : 'border-slate-700/80 bg-slate-900/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[9px] font-bold">
                  <span className="text-amber-300">G·CUCHILLO</span>
                  <Swords className="h-3 w-3 text-amber-300 shrink-0" />
                </div>
                <div className="truncate text-[10px] font-semibold leading-tight">
                  {knifeDef.name}
                </div>
              </button>
            </div>
          );
        })()}

      {/* COMPACT MOBILE COMBAT READOUT BAR (Centered cleanly between Joystick & Action Buttons) */}
      {isMobileViewport && state.phase === 'playing' && me && me.alive && (() => {
        const suitMaxHp = Math.max(100, me.maxHp || 100);
        const suitHpPct = Math.max(0, Math.min(100, (me.hp / suitMaxHp) * 100));
        return (
          <div className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 z-10 w-[132px] rounded-xl border border-slate-700/80 bg-[#0B101B]/88 px-2.5 py-2 shadow-lg space-y-1.5">
            <div className="flex items-center justify-between font-mono-tab text-[11px] font-bold">
              <span className="text-cyan-300">{me.tags}T</span>
              <span className="text-amber-300">R{me.streak}</span>
              <span className="text-white">{me.score}p</span>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span className="text-slate-300">HP</span>
                <span className="font-mono-tab text-white">
                  {me.hp}/{suitMaxHp}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-150 ${
                    suitHpPct > 50 ? 'bg-cyan-400' : suitHpPct > 25 ? 'bg-amber-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${suitHpPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span className="text-slate-300">Sprint</span>
                <span className="font-mono-tab text-emerald-300">
                  {state.infiniteEnergy ? '∞' : `${weaponState.sprintEnergy}%`}
                </span>
              </div>
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{
                    width: `${
                      state.infiniteEnergy
                        ? 100
                        : Math.max(0, Math.min(100, weaponState.sprintEnergy))
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* IN-LOBBY & IN-MATCH PROFANITY-FILTERED CHAT */}
      {(!isMobileViewport || state.phase === 'playing') && (
        <MatchChatPanel
          messages={chatMessages}
          blockedReason={chatBlockedReason}
          phase={state.phase}
          focusSignal={chatFocusSignal}
          onSendMessage={onSendChat}
          onClearBlocked={onClearChatBlocked}
          mobileCompact={isMobileViewport}
        />
      )}

      {/* DEDICATED PHONE LOBBY HUB (Mobile Viewport Only, hidden while customizing touch buttons) */}
      {isMobileViewport && state.phase === 'lobby' && !hudEditMode && (
        <MobileLobbyHub
          state={state}
          me={me}
          myId={myId}
          voiceStatus={voiceStatus}
          roomError={roomError}
          incomingInvites={incomingInvites}
          chatMessages={chatMessages}
          chatBlockedReason={chatBlockedReason}
          chatFocusSignal={chatFocusSignal}
          claimableMissionsCount={claimableMissionsCount}
          forceTouchControls={forceTouchControls}
          onToggleForceTouch={() => setForceTouchControls((v) => !v)}
          onStartMatch={onStartMatch}
          onToggleBots={onToggleBots}
          onToggleTeamMode={onToggleTeamMode}
          onToggleMatchMode={onToggleMatchMode}
          onVoteMap={onVoteMap}
          onOpenInventory={onOpenInventory}
          onOpenMissions={onOpenMissions}
          onOpenFriends={onOpenFriends}
          onAcceptInvite={onAcceptInvite}
          onDeclineInvite={onDeclineInvite}
          onOpenEmotes={onOpenEmotes}
          onTriggerEmote={onTriggerEmote}
          onCreatePrivateRoom={onCreatePrivateRoom}
          onJoinRoom={onJoinRoom}
          onLeavePrivateRoom={onLeavePrivateRoom}
          onClearRoomError={onClearRoomError}
          onSendChat={onSendChat}
          onClearChatBlocked={onClearChatBlocked}
          onJoinVoiceRoom={onJoinVoiceRoom}
          onLeaveVoiceRoom={onLeaveVoiceRoom}
          onToggleMicMute={onToggleMicMute}
          onToggleDeafen={onToggleDeafen}
          onOpenLeaderboard={onOpenLeaderboard}
          publicRooms={publicRooms}
          onOpenRoomVoiceModal={openRoomVoiceModal}
          onUpdateRoomRules={onUpdateRoomRules}
          onSelectMatchWeapon={onSelectMatchWeapon}
          activeDrawer={mobileHubDrawer}
          onChangeDrawer={setMobileHubDrawer}
        />
      )}

      {/* MATCH RESULTS MODAL: ANIMATED 3D PODIUM + SIDE TEAM MVP CARD */}
      {state.phase === 'results' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#060911]/90 p-2.5 sm:p-4 overflow-y-auto">
          <div className="flex flex-col lg:flex-row items-stretch justify-center gap-4 w-full max-w-6xl my-auto">
            {/* Main Results & Animated 3D Front-Facing Podium Card */}
            <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-[#0D1320] p-3.5 sm:p-5 shadow-2xl mx-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-semibold text-amber-400">
                    Partida #{state.matchNumber} Finalizada
                    {state.matchMode === 'ranked' ? ' · Clasificatoria (Rangos)' : ' · Casual'}
                    {state.teamMode === 'teams' ? ' · Modo Equipos' : ''}
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-0.5">
                    Podio de la Arena
                  </h2>
                </div>
                <div className="text-right min-w-[110px] sm:min-w-[140px]">
                  <div className="text-[11px] sm:text-xs text-slate-400">Volviendo al Lobby en</div>
                  <div className="font-mono-tab text-xl sm:text-2xl font-bold text-cyan-300">
                    {Math.max(0, Math.ceil(timeLeftMs / 1000))}s
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-100"
                      style={{ width: `${resultsProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {me && me.lastCoinsEarned > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-200">
                    <Coins className="h-4 w-4 text-amber-400" />
                    <span>
                      {topPlayer?.id === me.id
                        ? 'Recompensa por ganar la partida'
                        : 'Recompensa de partida'}
                    </span>
                  </div>
                  <div className="font-mono-tab text-sm sm:text-base font-bold text-amber-300">
                    +{me.lastCoinsEarned} monedas (Total: {me.infiniteCoins ? '∞' : me.coins})
                  </div>
                </div>
              )}

              {/* Animated 3D Podium: 3rd Bronze, 2nd Silver, 1st Gold + Rotating Crown */}
              <ResultsPodium3D topThree={topThree} myId={myId} />

              {reportFeedback && (
                <div className="mt-3 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-200">
                  {reportFeedback}
                </div>
              )}

              {reportingTarget && (
                <div className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/35 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-rose-200">
                      Reportar a <strong className="text-white">{reportingTarget.name}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReportingTarget(null)}
                      className="text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      'Velocidad anormal / Teleport',
                      'Reaparición instantánea',
                      'Disparo rápido / Aimbot',
                      'Comportamiento sospechoso',
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          onReportPlayer?.(reportingTarget.id, reportingTarget.name, reason);
                          setReportingTarget(null);
                        }}
                        className="rounded-md border border-rose-400/40 bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-rose-100 hover:border-rose-400 hover:bg-rose-500/20 cursor-pointer"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 max-h-40 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[420px] text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">Agente</th>
                      <th className="pb-2 px-2 text-right">Tags</th>
                      <th className="pb-2 px-2 text-right">Bajas</th>
                      <th className="pb-2 px-2 text-right">Puntos</th>
                      {onReportPlayer && <th className="pb-2 pl-2 text-right">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {sortedMatchPlayers.map((p: PlayerSnapshot, idx: number) => {
                      const canReport = Boolean(onReportPlayer && !p.isBot && p.id !== myId);
                      const alreadyReported = Boolean(reportedIds[p.id]);
                      return (
                        <tr key={p.id} className={p.id === myId ? 'bg-cyan-500/10' : ''}>
                          <td className="py-2 pr-2 font-mono-tab text-slate-400">{idx + 1}</td>
                          <td className="py-2 pr-2 font-medium text-slate-100">
                            <span className="inline-flex items-center gap-1.5">
                              <RankBadge rankedWins={p.rankedWins ?? 0} size="xs" />
                              <span>
                                {p.country ? `${countryCodeToFlag(p.country)} ` : ''}
                                {p.name}
                                {p.id === myId ? ' (Tú)' : ''}
                              </span>
                              {state.teamMode === 'teams' && p.team && (
                                <span
                                  className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    p.team === 'cyan'
                                      ? 'bg-cyan-500/20 text-cyan-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {p.team === 'cyan' ? 'AZUL' : 'ROJO'}
                                </span>
                              )}
                              {(p.flagCount ?? 0) > 0 && (
                                <span className="rounded border border-rose-500/50 bg-rose-500/15 px-1.5 py-0.5 font-mono-tab text-[10px] font-bold text-rose-300">
                                  {p.flagCount} alerta{(p.flagCount ?? 0) > 1 ? 's' : ''}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono-tab text-cyan-300">{p.tags}</td>
                          <td className="py-2 px-2 text-right font-mono-tab text-slate-400">{p.deaths}</td>
                          <td className="py-2 px-2 text-right font-mono-tab font-bold text-white">
                            {p.score}
                          </td>
                          {onReportPlayer && (
                            <td className="py-2 pl-2 text-right">
                              {canReport && (
                                <button
                                  type="button"
                                  disabled={alreadyReported}
                                  onClick={() => setReportingTarget({ id: p.id, name: p.name })}
                                  className={`inline-flex min-h-[34px] items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                    alreadyReported
                                      ? 'border-slate-700 bg-slate-900 text-slate-500 cursor-default'
                                      : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer'
                                  }`}
                                >
                                  <Flag className="h-3 w-3" />
                                  <span>{alreadyReported ? 'Reportado' : 'Reportar'}</span>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5 sm:gap-3 border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => onOpenLeaderboard('global')}
                  className="flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-200 hover:border-slate-500 cursor-pointer"
                >
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span>Ranking Global</span>
                </button>

                <button
                  type="button"
                  onClick={onReturnLobby}
                  className="flex min-h-[44px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-slate-700 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Volver al Lobby</span>
                </button>

                <button
                  type="button"
                  onClick={onStartMatch}
                  className="flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-2 font-display text-sm font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  <span>Jugar Otra Vez</span>
                </button>
              </div>
            </div>

            {/* Side Box: Team MVP Card when in Team Mode */}
            {state.teamMode === 'teams' && (
              <div
                className={`w-full lg:w-80 shrink-0 rounded-xl border p-4 sm:p-5 shadow-2xl flex flex-col justify-between ${
                  myTeam === 'cyan'
                    ? 'border-cyan-500/50 bg-[#0B1424]'
                    : 'border-rose-500/50 bg-[#1B0D18]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="flex items-center gap-2 font-display text-sm font-bold text-white">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <span>MVP de tu Equipo</span>
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                        myTeam === 'cyan'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {myTeam === 'cyan' ? 'EQUIPO AZUL' : 'EQUIPO ROJO'}
                    </span>
                  </div>

                  {/* Team Score Comparison */}
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-cyan-300">EQUIPO AZUL</div>
                      <div className="font-mono-tab text-xl font-bold text-white">
                        {state.teamScores.cyan}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-rose-300">EQUIPO ROJO</div>
                      <div className="font-mono-tab text-xl font-bold text-white">
                        {state.teamScores.rose}
                      </div>
                    </div>
                  </div>

                  {/* Highlighted Team MVP */}
                  {myTeamMvp ? (
                    <div className="mt-4 rounded-xl border border-amber-400/50 bg-amber-500/10 p-4 text-center">
                      <img
                        src={GENDER_PORTRAIT[myTeamMvp.gender]}
                        alt={myTeamMvp.name}
                        referrerPolicy="no-referrer"
                        className="mx-auto h-16 w-16 rounded-xl object-cover object-top border-2 border-amber-400 bg-slate-900"
                      />
                      <div className="mt-2 inline-block rounded bg-amber-400 px-2 py-0.5 font-mono-tab text-[10px] font-bold text-slate-950">
                        MVP DEL EQUIPO
                      </div>
                      <div className="mt-1.5 flex items-center justify-center gap-1.5 font-display text-lg font-bold text-white">
                        <RankBadge rankedWins={myTeamMvp.rankedWins ?? 0} size="sm" />
                        <span className="truncate">
                          {myTeamMvp.country ? `${countryCodeToFlag(myTeamMvp.country)} ` : ''}
                          {myTeamMvp.name}
                          {myTeamMvp.id === myId ? ' (Tú)' : ''}
                        </span>
                      </div>
                      <div className="mt-1 font-mono-tab text-sm font-bold text-amber-300">
                        {myTeamMvp.tags} tags · {myTeamMvp.score} pts
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono-tab">
                        Racha máx: {myTeamMvp.bestStreak}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-400">Sin datos de equipo.</p>
                  )}

                  {/* Team Roster Breakdown */}
                  <div className="mt-4 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-400">
                      Integrantes de tu equipo
                    </div>
                    {myTeamPlayers.map((tp) => (
                      <div
                        key={tp.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs"
                      >
                        <span className="flex items-center gap-1.5 truncate font-medium text-slate-100">
                          <RankBadge rankedWins={tp.rankedWins ?? 0} size="xs" />
                          <span className="truncate">
                            {tp.country ? `${countryCodeToFlag(tp.country)} ` : ''}
                            {tp.name}
                            {tp.id === myId ? ' (Tú)' : ''}
                          </span>
                        </span>
                        <span className="font-mono-tab font-bold text-cyan-300 shrink-0">
                          {tp.tags} tags
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-center text-xs font-semibold text-slate-300">
                  {state.teamScores.cyan === state.teamScores.rose
                    ? 'Empate técnico entre equipos'
                    : (myTeam === 'cyan' && state.teamScores.cyan > state.teamScores.rose) ||
                        (myTeam === 'rose' && state.teamScores.rose > state.teamScores.cyan)
                      ? '¡Tu equipo ganó la ronda!'
                      : 'El equipo rival se llevó esta ronda'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE TOUCH CONTROLS (Virtual Joystick + Customizable/Draggable Phone Buttons) */}
      {((showTouchButtons &&
        me?.alive &&
        (state.phase === 'playing' || (state.phase === 'lobby' && !mobileHubDrawer))) ||
        hudEditMode) && (
        <MobileControlsOverlay
          phase={state.phase}
          alive={Boolean(me?.alive)}
          weaponState={weaponState}
          touchLayout={settings.touchLayout}
          touchButtonScale={settings.touchButtonScale}
          editMode={hudEditMode}
          onChangeLayout={(nextLayout: TouchLayoutMap) =>
            onUpdateSettings({ ...settings, touchLayout: nextLayout })
          }
          onExitEditMode={() => setHudEditMode(false)}
          onMove={(strafe, forward) => onTouchMove?.(strafe, forward)}
          onFireChange={(firing) => onTouchFireChange?.(firing)}
          onAimChange={(aiming) => onTouchAimChange?.(aiming)}
          onSprintChange={(sprinting) => onTouchSprintChange?.(sprinting)}
          onCrouchChange={(crouching) => onTouchCrouchChange?.(crouching)}
          onJump={() => onTouchJump?.()}
          onSlide={() => onTouchSlide?.()}
          onReload={onReload}
        />
      )}

      {/* SETTINGS MODAL (Sensitivity, Graphics Quality & Touch Button Layout Editor) */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChangeSettings={onUpdateSettings}
        showTouchControls={showTouchButtons}
        onToggleForceTouch={() => setForceTouchControls((v) => !v)}
        onEnterHudEditMode={() => {
          setForceTouchControls(true);
          setMobileHubDrawer(null);
          setDesktopLobbyPanel(null);
          setHudEditMode(true);
        }}
      />

      {/* ROOMS, PVP 1v1, CUSTOM RULES & VOICE MENU MODAL */}
      <RoomVoiceModal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        initialTab={roomModalTab}
        initialPreset={roomModalPreset}
        state={state}
        me={me}
        myId={myId}
        publicRooms={publicRooms}
        roomError={roomError}
        voiceStatus={voiceStatus}
        onCreateCustomRoom={onCreateCustomRoom}
        onUpdateRoomRules={onUpdateRoomRules}
        onSelectMatchWeapon={onSelectMatchWeapon}
        onJoinRoom={onJoinRoom}
        onLeavePrivateRoom={onLeavePrivateRoom}
        onRefreshPublicRooms={onRefreshPublicRooms}
        onClearRoomError={onClearRoomError}
        onJoinVoiceRoom={onJoinVoiceRoom}
        onLeaveVoiceRoom={onLeaveVoiceRoom}
        onToggleMicMute={onToggleMicMute}
        onToggleDeafen={onToggleDeafen}
        onOpenFriends={onOpenFriends}
      />
    </div>
  );
}
