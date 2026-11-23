import {
  Bot,
  Check,
  Copy,
  Crosshair,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Map as MapIcon,
  Mic,
  Plus,
  RefreshCw,
  Shuffle,
  SlidersHorizontal,
  Swords,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { ARENA_MAP_LIST, getMapConfig } from '../shared/arenaData';
import { countryCodeToFlag } from '../shared/countries';
import type {
  ArenaMapId,
  MatchMode,
  PlayerSnapshot,
  PublicRoomSummary,
  RoomPreset,
  ServerStatePayload,
  TeamMode,
} from '../shared/types';
import { WEAPONS, getWeaponById, type WeaponId } from '../shared/weapons';
import type { VoiceStatus } from '../voice/voiceManager';
import { GENDER_PORTRAIT } from './LeaderboardModal';
import { MAP_AERIAL_IMAGES } from './mapAerialImages';
import { RankBadge } from './RankBadge';
import { VoiceChatPanel } from './VoiceChatPanel';

export type RoomModalTab = 'create' | 'public_list' | 'current' | 'voice';

export interface CreateCustomRoomInput {
  isPrivate: boolean;
  customCode?: string;
  roomName?: string;
  preset: RoomPreset;
  mapId: ArenaMapId;
  allowedWeapons: WeaponId[];
  infiniteEnergy: boolean;
  darkHideAndSeek: boolean;
  matchMode: MatchMode;
  teamMode: TeamMode;
  botsEnabled: boolean;
}

export interface UpdateRoomRulesInput {
  roomPreset?: RoomPreset;
  roomName?: string;
  mapId?: ArenaMapId;
  allowedWeapons?: WeaponId[];
  infiniteEnergy?: boolean;
  darkHideAndSeek?: boolean;
  botsEnabled?: boolean;
}

interface RoomVoiceModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: RoomModalTab;
  initialPreset?: RoomPreset;
  state: ServerStatePayload;
  me: PlayerSnapshot | null;
  myId: string | null;
  publicRooms: PublicRoomSummary[];
  roomError: string | null;
  voiceStatus: VoiceStatus;
  onCreateCustomRoom: (input: CreateCustomRoomInput) => void;
  onUpdateRoomRules: (input: UpdateRoomRulesInput) => void;
  onSelectMatchWeapon: (weaponId: WeaponId) => void;
  onJoinRoom: (roomCode: string) => void;
  onLeavePrivateRoom: () => void;
  onRefreshPublicRooms: () => void;
  onClearRoomError: () => void;
  onJoinVoiceRoom: (room: string) => void;
  onLeaveVoiceRoom: () => void;
  onToggleMicMute: () => void;
  onToggleDeafen: () => void;
  onOpenFriends: () => void;
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function RoomVoiceModal({
  open,
  onClose,
  initialTab = 'current',
  initialPreset = 'duel_1v1',
  state,
  me,
  myId,
  publicRooms,
  roomError,
  voiceStatus,
  onCreateCustomRoom,
  onUpdateRoomRules,
  onSelectMatchWeapon,
  onJoinRoom,
  onLeavePrivateRoom,
  onRefreshPublicRooms,
  onClearRoomError,
  onJoinVoiceRoom,
  onLeaveVoiceRoom,
  onToggleMicMute,
  onToggleDeafen,
  onOpenFriends,
}: RoomVoiceModalProps) {
  const [tab, setTab] = useState<RoomModalTab>(initialTab);
  const [preset, setPreset] = useState<RoomPreset>(initialPreset);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [customCode, setCustomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [createMapId, setCreateMapId] = useState<ArenaMapId>(state.currentMapId);
  const [createWeapons, setCreateWeapons] = useState<WeaponId[]>(WEAPONS.map((w) => w.id));
  const [createInfiniteEnergy, setCreateInfiniteEnergy] = useState(false);
  const [createDarkMode, setCreateDarkMode] = useState(false);
  const [createMatchMode, setCreateMatchMode] = useState<MatchMode>('casual');
  const [createTeamMode, setCreateTeamMode] = useState<TeamMode>('ffa');
  const [createBots, setCreateBots] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const wasOpenRef = useState(() => ({ open: false }))[0];

  useEffect(() => {
    if (open && !wasOpenRef.open) {
      setTab(initialTab);
      setPreset(initialPreset);
      setCreateMapId(state.currentMapId);
      setLocalError(null);
      onRefreshPublicRooms();
    }
    wasOpenRef.open = open;
  }, [open, initialTab, initialPreset, state.currentMapId, onRefreshPublicRooms, wasOpenRef]);

  if (!open) return null;

  const humanPlayers = state.players.filter((p) => !p.isBot);
  const isLobby = state.phase === 'lobby';
  const activeWeaponId = me?.activeWeapon ?? me?.equippedWeapon ?? state.allowedWeapons[0] ?? 'pulse_carbine';

  const toggleCreateWeapon = (id: WeaponId) => {
    setCreateWeapons((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((w) => w !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const toggleCurrentRoomWeapon = (id: WeaponId) => {
    const current = state.allowedWeapons?.length ? state.allowedWeapons : WEAPONS.map((w) => w.id);
    const next = current.includes(id)
      ? current.length > 1
        ? current.filter((w) => w !== id)
        : current
      : [...current, id];
    onUpdateRoomRules({ allowedWeapons: next });
  };

  const handleCreateSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearRoomError();

    const cleanedCode = customCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);

    if (visibility === 'private' && cleanedCode.length > 0 && cleanedCode.length < 4) {
      setLocalError('El código privado debe tener al menos 4 letras o números (o déjalo vacío para generar uno).');
      return;
    }

    onCreateCustomRoom({
      isPrivate: visibility === 'private',
      customCode: visibility === 'private' && cleanedCode ? cleanedCode : undefined,
      roomName: roomName.trim() || undefined,
      preset,
      mapId: createMapId,
      allowedWeapons: createWeapons,
      infiniteEnergy: createInfiniteEnergy,
      darkHideAndSeek: createDarkMode,
      matchMode: createMatchMode,
      teamMode: preset === 'duel_1v1' ? 'ffa' : createTeamMode,
      botsEnabled: createBots,
    });
    onClose();
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned) return;
    onJoinRoom(cleaned);
    setJoinCodeInput('');
  };

  const handleCopyCode = () => {
    if (!state.roomCode) return;
    navigator.clipboard?.writeText(state.roomCode).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sala, PvP 1v1 y Voz"
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-2.5 sm:p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0B101B] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-300 shrink-0">
              <Swords className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-base sm:text-lg font-bold text-white">
                Sala, PvP 1v1 y Voz
              </h2>
              <p className="truncate text-[11px] text-slate-400">
                {state.isPrivateRoom ? `Privada · ${state.roomCode}` : state.roomName || 'Sala Pública'} ·{' '}
                {state.roomPreset === 'duel_1v1' ? 'PvP 1v1' : 'Arena'} · {humanPlayers.length}/{state.maxPlayers}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú de sala y voz"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 border-b border-slate-800 bg-[#080C14] p-1.5">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
              tab === 'create'
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Crear / 1v1</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('public_list');
              onRefreshPublicRooms();
            }}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
              tab === 'public_list'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Públicas ({publicRooms.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('current')}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
              tab === 'current'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Sala Actual</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('voice')}
            className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
              tab === 'voice'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/60'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Mic className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Voz ({humanPlayers.length})</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(roomError || localError) && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/60 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
              {localError || roomError}
            </div>
          )}

          {/* TAB 1: CREATE ROOM / PVP 1v1 */}
          {tab === 'create' && (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Format: PvP 1v1 vs Standard */}
              <div>
                <div className="mb-1.5 text-xs font-bold text-slate-300">1. Formato de Sala</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreset('duel_1v1');
                      setCreateTeamMode('ffa');
                    }}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      preset === 'duel_1v1'
                        ? 'border-amber-400 bg-amber-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-display text-sm font-bold text-amber-300">
                      <Swords className="h-4 w-4" />
                      PvP 1v1
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      Duelo 1 contra 1 · 10 tags · Con o sin Bot
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreset('standard')}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      preset === 'standard'
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-display text-sm font-bold text-cyan-300">
                      <Users className="h-4 w-4" />
                      Sala Arena
                    </span>
                    <span className="mt-0.5 text-[11px] text-slate-400">
                      Hasta 16 jugadores · FFA o Equipos
                    </span>
                  </button>
                </div>
              </div>

              {/* Visibility: Public vs Private */}
              <div>
                <div className="mb-1.5 text-xs font-bold text-slate-300">2. Visibilidad</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      visibility === 'public'
                        ? 'border-cyan-400 bg-cyan-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <Globe className="h-4.5 w-4.5 text-cyan-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Pública</div>
                      <div className="text-[10px] text-slate-400">Aparece en la lista abierta</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      visibility === 'private'
                        ? 'border-amber-400 bg-amber-500/15 text-white'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <Lock className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Privada (Con Código)</div>
                      <div className="text-[10px] text-slate-400">Nadie entra sin tu código</div>
                    </div>
                  </button>
                </div>

                {visibility === 'public' ? (
                  <div className="mt-2.5">
                    <label className="mb-1 block text-[11px] font-semibold text-slate-400">
                      Nombre de la sala pública (opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder={preset === 'duel_1v1' ? 'Ej: 1v1 Solo Sniper' : 'Ej: Arena Oscura'}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="mt-2.5 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-200">
                        Código secreto de sala privada
                      </label>
                      <button
                        type="button"
                        onClick={() => setCustomCode(generateRandomCode())}
                        className="flex items-center gap-1 rounded-md border border-amber-400/50 bg-slate-900 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-slate-800 cursor-pointer"
                      >
                        <Shuffle className="h-3 w-3" />
                        <span>Generar</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={10}
                      value={customCode}
                      onChange={(e) =>
                        setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                      }
                      placeholder="Escribe tu código (4-10 letras/números)..."
                      className="w-full rounded-lg border border-amber-400/40 bg-slate-950 px-3 py-2 font-mono-tab text-sm font-bold uppercase tracking-widest text-amber-300 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                    <p className="text-[11px] text-amber-200/80">
                      Solo quien tenga este código podrá unirse. Si lo dejas vacío se generará uno automático.
                    </p>
                  </div>
                )}
              </div>

              {/* Allowed Weapons Pool */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Crosshair className="h-3.5 w-3.5 text-cyan-400" />
                    <span>3. Armas Permitidas en la Partida</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreateWeapons(WEAPONS.map((w) => w.id))}
                    className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  >
                    Todas
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {WEAPONS.map((w) => {
                    const selected = createWeapons.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleCreateWeapon(w.id)}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400/80 bg-cyan-500/15 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{w.name}</div>
                          <div className="truncate text-[10px] text-slate-400">
                            {w.slot === 'sidearm' ? `Pistola · ${w.category}` : `Larga · ${w.category}`}
                          </div>
                        </div>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border shrink-0 ${
                            selected
                              ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                              : 'border-slate-700 bg-slate-950'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modifiers: Infinite Energy, Dark Hide and Seek & Bots */}
              <div>
                <div className="mb-1.5 text-xs font-bold text-slate-300">4. Reglas Especiales</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateInfiniteEnergy((v) => !v)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      createInfiniteEnergy
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Energía Infinita</div>
                        <div className="text-[10px] text-slate-400">Correr sin límite</div>
                      </div>
                    </div>
                    <span className="font-mono-tab text-[11px] font-bold">
                      {createInfiniteEnergy ? 'SÍ' : 'NO'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateDarkMode((v) => !v)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      createDarkMode
                        ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <EyeOff className="h-4 w-4 text-indigo-300 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Escondite Oscuro</div>
                        <div className="text-[10px] text-slate-400">Mini área de luz</div>
                      </div>
                    </div>
                    <span className="font-mono-tab text-[11px] font-bold">
                      {createDarkMode ? 'SÍ' : 'NO'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateBots((b) => !b)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      createBots
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-cyan-300 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">
                          {preset === 'duel_1v1' ? 'Bot rival (1v1)' : 'Bots IA'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {preset === 'duel_1v1' ? '1 bot enemigo' : 'Drones en arena'}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-tab text-[11px] font-bold">
                      {createBots ? 'SÍ' : 'NO'}
                    </span>
                  </button>
                </div>

                {/* Match mode & Teams */}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCreateMatchMode((m) => (m === 'casual' ? 'ranked' : 'casual'))
                    }
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold cursor-pointer ${
                      createMatchMode === 'ranked'
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-slate-700 bg-slate-900 text-slate-300'
                    }`}
                  >
                    {createMatchMode === 'ranked' ? 'Modo Rangos' : 'Modo Casual'}
                  </button>

                  {preset === 'standard' && (
                    <button
                      type="button"
                      onClick={() =>
                        setCreateTeamMode((t) => (t === 'ffa' ? 'teams' : 'ffa'))
                      }
                      className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold cursor-pointer ${
                        createTeamMode === 'teams'
                          ? 'border-rose-400 bg-rose-500/15 text-rose-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      {createTeamMode === 'teams' ? 'Equipos' : 'Todos vs Todos'}
                    </button>
                  )}
                </div>
              </div>

              {/* Map Picker */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300">
                  <MapIcon className="h-3.5 w-3.5 text-cyan-400" />
                  <span>5. Elegir Mapa de Arena</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ARENA_MAP_LIST.map((m) => {
                    const selected = createMapId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCreateMapId(m.id)}
                        className={`overflow-hidden rounded-xl border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-cyan-400 bg-cyan-500/15'
                            : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                        }`}
                      >
                        <div className="relative h-12 w-full bg-slate-950">
                          <img
                            src={MAP_AERIAL_IMAGES[m.id]}
                            alt={m.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover opacity-85"
                          />
                          {selected && (
                            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-slate-950">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <div className="truncate font-display text-[11px] font-bold text-white">
                            {m.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {visibility === 'private' ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                <span>
                  {visibility === 'private'
                    ? preset === 'duel_1v1'
                      ? 'Crear PvP 1v1 Privado'
                      : 'Crear Sala Privada'
                    : preset === 'duel_1v1'
                      ? 'Crear PvP 1v1 Público'
                      : 'Crear Sala Pública'}
                </span>
              </button>
            </form>
          )}

          {/* TAB 2: PUBLIC ROOMS LIST */}
          {tab === 'public_list' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-300">
                  Salas públicas abiertas de otros jugadores y sala global.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRefreshPublicRooms}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-400 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Actualizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVisibility('public');
                      setTab('create');
                    }}
                    className="flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Crear Pública</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {publicRooms.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-400">
                    No hay salas públicas disponibles. ¡Crea una ahora!
                  </div>
                ) : (
                  publicRooms.map((rm) => {
                    const isHere = rm.roomCode === state.roomCode;
                    const isFull = rm.playerCount >= rm.maxPlayers;
                    const mapCfg = getMapConfig(rm.currentMapId);
                    const allAllowed = rm.allowedWeapons.length >= WEAPONS.length;
                    return (
                      <div
                        key={rm.roomCode}
                        className={`rounded-xl border p-3 transition-colors ${
                          isHere
                            ? 'border-cyan-400/70 bg-cyan-500/10'
                            : 'border-slate-800 bg-slate-900/75'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-display text-sm font-bold text-white truncate">
                                {rm.roomName}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  rm.preset === 'duel_1v1'
                                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                    : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                }`}
                              >
                                {rm.preset === 'duel_1v1' ? 'PvP 1v1' : 'Arena'}
                              </span>
                              {rm.infiniteEnergy && (
                                <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                  Energía ∞
                                </span>
                              )}
                              {rm.darkHideAndSeek && (
                                <span className="rounded border border-indigo-400/40 bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-200">
                                  Escondite Oscuro
                                </span>
                              )}
                              {rm.botsEnabled && (
                                <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">
                                  {rm.preset === 'duel_1v1' ? '1 Bot' : 'Bots IA'}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span>Anfitrión: {rm.hostName}</span>
                              <span>·</span>
                              <span className="text-cyan-300">{mapCfg.name}</span>
                              <span>·</span>
                              <span className="font-mono-tab">
                                {rm.playerCount}/{rm.maxPlayers} jugadores
                              </span>
                              <span>·</span>
                              <span>
                                Armas:{' '}
                                {allAllowed
                                  ? 'Todas'
                                  : rm.allowedWeapons.map((id) => getWeaponById(id).name).join(', ')}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isHere || isFull}
                            onClick={() => {
                              onJoinRoom(rm.roomCode);
                              onClose();
                            }}
                            className={`min-h-[38px] rounded-xl px-4 py-1.5 text-xs font-bold shrink-0 ${
                              isHere
                                ? 'border border-cyan-400/40 bg-cyan-500/15 text-cyan-200 cursor-default'
                                : isFull
                                  ? 'border border-slate-700 bg-slate-800 text-slate-500 cursor-not-allowed'
                                  : 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                            }`}
                          >
                            {isHere ? 'Estás aquí' : isFull ? 'Llena' : 'Unirse'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CURRENT ROOM & LIVE RULES */}
          {tab === 'current' && (
            <div className="space-y-4">
              {/* Current Room Card */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-900/75 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-white">
                        {state.roomName || (state.isPrivateRoom ? 'Sala Privada' : 'Sala Pública')}
                      </span>
                      <span className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono-tab text-[11px] font-bold text-amber-300">
                        {state.roomCode}
                      </span>
                      {state.botsEnabled && (
                        <span className="rounded border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">
                          + {state.roomPreset === 'duel_1v1' ? '1 Bot' : `${state.players.filter((p) => p.isBot).length || 5} Bots IA`}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {state.isPrivateRoom ? 'Privada con código' : 'Abierta al público'} ·{' '}
                      {state.roomPreset === 'duel_1v1' ? 'PvP 1v1 (Meta 10 tags)' : 'Arena Estándar'} ·{' '}
                      {humanPlayers.length}/{state.maxPlayers} humanos
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {state.roomCode !== 'PUBLIC' && (
                      <>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="flex items-center gap-1 rounded-lg border border-amber-400/50 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-slate-800 cursor-pointer"
                        >
                          {copiedCode ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={onLeavePrivateRoom}
                          className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Sala Global</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Join by Private Code */}
                <form onSubmit={handleJoinSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      maxLength={10}
                      value={joinCodeInput}
                      onChange={(e) => {
                        setJoinCodeInput(e.target.value.toUpperCase());
                        if (roomError) onClearRoomError();
                      }}
                      placeholder="Entrar con código de sala privada..."
                      className="min-h-[40px] w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-1.5 font-mono-tab text-xs font-semibold uppercase text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="min-h-[40px] rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-4 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/30 cursor-pointer shrink-0"
                  >
                    Unirse
                  </button>
                </form>
              </div>

              {/* Weapon for this match selector */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/65 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Crosshair className="h-3.5 w-3.5 text-amber-400" />
                    <span>Tu arma para esta partida</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Permitidas en esta sala
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {state.allowedWeapons.map((wId) => {
                    const def = getWeaponById(wId);
                    const selected = activeWeaponId === wId;
                    return (
                      <button
                        key={wId}
                        type="button"
                        onClick={() => onSelectMatchWeapon(wId)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                          selected
                            ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                            : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <span className="truncate">{def.name}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-amber-300 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Room Rules Configurator (works in Public AND Private lobbies) */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/65 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Reglas de esta Sala {state.isPrivateRoom ? '(Privada)' : '(Pública)'}
                  </span>
                  {!isLobby && (
                    <span className="text-[11px] text-amber-300">
                      Disponible al volver al lobby
                    </span>
                  )}
                </div>

                {/* Format + Modifiers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    disabled={!isLobby}
                    onClick={() =>
                      onUpdateRoomRules({
                        roomPreset: state.roomPreset === 'duel_1v1' ? 'standard' : 'duel_1v1',
                      })
                    }
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      !isLobby ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      state.roomPreset === 'duel_1v1'
                        ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5" />
                      <span>PvP 1v1</span>
                    </span>
                    <span>{state.roomPreset === 'duel_1v1' ? 'SÍ' : 'NO'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isLobby}
                    onClick={() =>
                      onUpdateRoomRules({ botsEnabled: !state.botsEnabled })
                    }
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      !isLobby ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      state.botsEnabled
                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5" />
                      <span>{state.roomPreset === 'duel_1v1' ? 'Bot 1v1' : 'Bots IA'}</span>
                    </span>
                    <span>{state.botsEnabled ? 'SÍ' : 'NO'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isLobby}
                    onClick={() =>
                      onUpdateRoomRules({ infiniteEnergy: !state.infiniteEnergy })
                    }
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      !isLobby ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      state.infiniteEnergy
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      <span>Energía ∞</span>
                    </span>
                    <span>{state.infiniteEnergy ? 'SÍ' : 'NO'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isLobby}
                    onClick={() =>
                      onUpdateRoomRules({ darkHideAndSeek: !state.darkHideAndSeek })
                    }
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      !isLobby ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      state.darkHideAndSeek
                        ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Oscuro</span>
                    </span>
                    <span>{state.darkHideAndSeek ? 'SÍ' : 'NO'}</span>
                  </button>
                </div>

                {/* Allowed weapons toggle */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                    <span>Armas permitidas en esta sala</span>
                    {isLobby && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRoomRules({ allowedWeapons: WEAPONS.map((w) => w.id) })
                        }
                        className="text-cyan-300 hover:text-cyan-200 cursor-pointer"
                      >
                        Activar todas
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WEAPONS.map((w) => {
                      const active = state.allowedWeapons.includes(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          disabled={!isLobby}
                          onClick={() => toggleCurrentRoomWeapon(w.id)}
                          className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                            !isLobby ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            active
                              ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-100'
                              : 'border-slate-800 bg-slate-950 text-slate-500'
                          }`}
                        >
                        <div className="min-w-0">
                          <div className="truncate">{w.name}</div>
                          <div className="truncate text-[9px] text-slate-400">
                            {w.slot === 'sidearm' ? 'Pistola' : w.category}
                          </div>
                        </div>
                        {active && <Check className="h-3 w-3 text-cyan-300 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Map Picker */}
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold text-slate-400">
                    Mapa fijado de la sala ({getMapConfig(state.currentMapId).name})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {ARENA_MAP_LIST.map((m) => {
                      const selected = state.currentMapId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={!isLobby}
                          onClick={() => onUpdateRoomRules({ mapId: m.id })}
                          className={`truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                            !isLobby ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                          } ${
                            selected
                              ? 'border-cyan-400 bg-cyan-500/20 text-white'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VOICE CHAT & ROOM PLAYERS */}
          {tab === 'voice' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-white">Chat de Voz en Tiempo Real</div>
                <VoiceChatPanel
                  voiceStatus={voiceStatus}
                  players={state.players}
                  myId={myId}
                  onJoinRoom={onJoinVoiceRoom}
                  onLeaveRoom={onLeaveVoiceRoom}
                  onToggleMicMute={onToggleMicMute}
                  onToggleDeafen={onToggleDeafen}
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <span>
                      Jugadores en la Sala ({humanPlayers.length}/{state.maxPlayers})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFriends();
                    }}
                    className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-500/25 cursor-pointer"
                  >
                    Invitar Amigos
                  </button>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5">
                  {humanPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={GENDER_PORTRAIT[p.gender]}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="h-6 w-6 rounded object-cover object-top bg-slate-800 shrink-0"
                        />
                        <RankBadge rankedWins={p.rankedWins ?? 0} size="xs" />
                        <span className="truncate font-semibold text-slate-100">
                          {p.country ? `${countryCodeToFlag(p.country)} ` : ''}
                          {p.name}
                          {p.id === myId ? ' (Tú)' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.voiceRoom && (
                          <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            {p.voiceRoom}
                          </span>
                        )}
                        {state.teamMode === 'teams' && p.team && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              p.team === 'cyan'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {p.team === 'cyan' ? 'AZUL' : 'ROJO'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
