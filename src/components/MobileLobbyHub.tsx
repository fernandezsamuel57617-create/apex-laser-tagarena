import {
  Bot,
  Check,
  Coins,
  Copy,
  EyeOff,
  Gamepad2,
  Globe,
  KeyRound,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  Play,
  Plus,
  Shield,
  Shirt,
  SlidersHorizontal,
  Smile,
  Swords,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { RoomInviteRecord } from '../firebase';
import { ARENA_MAP_LIST, getMapConfig } from '../shared/arenaData';
import { countryCodeToFlag } from '../shared/countries';
import { EMOTES, type EmoteId } from '../shared/emotes';
import { getOutfitById, getOutfitLevel } from '../shared/outfits';
import type {
  ArenaMapId,
  ChatMessageEvent,
  MatchMode,
  PlayerSnapshot,
  PublicRoomSummary,
  RoomPreset,
  ServerStatePayload,
  TeamMode,
} from '../shared/types';
import { getWeaponById, type WeaponId } from '../shared/weapons';
import { getWeaponSkinById } from '../shared/weaponSkins';
import type { VoiceStatus } from '../voice/voiceManager';
import { GENDER_PORTRAIT, type LeaderboardTab } from './LeaderboardModal';
import { MAP_AERIAL_IMAGES } from './mapAerialImages';
import { MatchChatPanel } from './MatchChatPanel';
import { RankBadge } from './RankBadge';
import type { RoomModalTab, UpdateRoomRulesInput } from './RoomVoiceModal';
import { VoiceChatPanel } from './VoiceChatPanel';

export type MobileHubTab = 'modes' | 'maps' | 'room' | 'social' | 'arsenal';

interface MobileLobbyHubProps {
  state: ServerStatePayload;
  me: PlayerSnapshot | null;
  myId: string | null;
  voiceStatus: VoiceStatus;
  roomError: string | null;
  incomingInvites: RoomInviteRecord[];
  chatMessages: ChatMessageEvent[];
  chatBlockedReason: string | null;
  chatFocusSignal: number;
  claimableMissionsCount: number;
  forceTouchControls: boolean;
  onToggleForceTouch: () => void;
  onStartMatch: () => void;
  onToggleBots: () => void;
  onToggleTeamMode: (mode: TeamMode) => void;
  onToggleMatchMode: (mode: MatchMode) => void;
  onVoteMap: (mapId: ArenaMapId) => void;
  onOpenInventory: () => void;
  onOpenMissions: () => void;
  onOpenFriends: () => void;
  onAcceptInvite: (invite: RoomInviteRecord) => void;
  onDeclineInvite: (invite: RoomInviteRecord) => void;
  onOpenEmotes: () => void;
  onTriggerEmote: (emote: EmoteId) => void;
  onCreatePrivateRoom: () => void;
  onJoinRoom: (roomCode: string) => void;
  onLeavePrivateRoom: () => void;
  onClearRoomError: () => void;
  onSendChat: (text: string) => void;
  onClearChatBlocked: () => void;
  onJoinVoiceRoom: (room: string) => void;
  onLeaveVoiceRoom: () => void;
  onToggleMicMute: () => void;
  onToggleDeafen: () => void;
  onOpenLeaderboard: (tab: LeaderboardTab) => void;
  publicRooms: PublicRoomSummary[];
  onOpenRoomVoiceModal: (tab?: RoomModalTab, preset?: RoomPreset) => void;
  onUpdateRoomRules: (input: UpdateRoomRulesInput) => void;
  onSelectMatchWeapon: (weaponId: WeaponId) => void;
  activeDrawer: MobileHubTab | null;
  onChangeDrawer: (tab: MobileHubTab | null) => void;
}

export function MobileLobbyHub({
  state,
  me,
  myId,
  voiceStatus,
  roomError,
  incomingInvites,
  chatMessages,
  chatBlockedReason,
  chatFocusSignal,
  claimableMissionsCount,
  forceTouchControls,
  onToggleForceTouch,
  onStartMatch,
  onToggleBots,
  onToggleTeamMode,
  onToggleMatchMode,
  onVoteMap,
  onOpenInventory,
  onOpenMissions,
  onOpenFriends,
  onAcceptInvite,
  onDeclineInvite,
  onOpenEmotes,
  onTriggerEmote,
  onCreatePrivateRoom,
  onJoinRoom,
  onLeavePrivateRoom,
  onClearRoomError,
  onSendChat,
  onClearChatBlocked,
  onJoinVoiceRoom,
  onLeaveVoiceRoom,
  onToggleMicMute,
  onToggleDeafen,
  onOpenLeaderboard,
  publicRooms,
  onOpenRoomVoiceModal,
  onUpdateRoomRules,
  onSelectMatchWeapon,
  activeDrawer,
  onChangeDrawer,
}: MobileLobbyHubProps) {
  const [roomInput, setRoomInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const humanPlayers = state.players.filter((p) => !p.isBot);
  const myVote = myId ? state.mapVotes?.voters?.[myId] ?? null : null;
  const hasVoteCountdown = state.voteCountdownEndsAt > 0;
  const previewMap = state.votedPreviewMapId ? getMapConfig(state.votedPreviewMapId) : null;
  const totalNotifications = claimableMissionsCount + incomingInvites.length;

  const toggleTab = (tab: MobileHubTab) => {
    onChangeDrawer(activeDrawer === tab ? null : tab);
  };

  const handleCopyRoomCode = () => {
    if (!state.roomCode) return;
    navigator.clipboard?.writeText(state.roomCode).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleJoinRoomSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = roomInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned) return;
    onJoinRoom(cleaned);
    setRoomInput('');
  };

  return (
    <>
      {/* Backdrop when a mobile hub sheet is open */}
      {activeDrawer && (
        <div
          onClick={() => onChangeDrawer(null)}
          className="pointer-events-auto fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px]"
          aria-hidden="true"
        />
      )}

      {/* Compact Vote Countdown Banner on Phone */}
      {hasVoteCountdown && previewMap && !activeDrawer && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-20 w-[min(90vw,320px)] overflow-hidden rounded-xl border border-cyan-400/70 bg-[#0B101B]/95 shadow-2xl">
          <div className="flex items-center gap-3 p-2.5">
            <img
              src={MAP_AERIAL_IMAGES[previewMap.id]}
              alt={previewMap.name}
              referrerPolicy="no-referrer"
              className="h-12 w-16 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                Desplegando mapa votado
              </div>
              <div className="truncate font-display text-sm font-bold text-white">
                {previewMap.name}
              </div>
            </div>
            <span className="font-mono-tab text-base font-bold text-amber-300 shrink-0">
              {Math.max(1, Math.ceil((state.voteCountdownEndsAt - state.serverTime) / 1000))}s
            </span>
          </div>
        </div>
      )}

      {/* Slide-Up Mobile Hub Sheet Drawer */}
      {activeDrawer && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-lg px-2">
          <div className="rounded-t-2xl border border-b-0 border-slate-700/90 bg-[#0B101B]/96 shadow-2xl overflow-hidden">
            {/* Grab Handle + Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold text-white">
                  {activeDrawer === 'modes' && 'Modos de Juego y Controles'}
                  {activeDrawer === 'maps' && 'Votar Mapa de Arena'}
                  {activeDrawer === 'room' &&
                    (state.isPrivateRoom ? `Sala Privada · ${state.roomCode}` : 'Sala y Voz')}
                  {activeDrawer === 'social' && 'Chat, Emotes y Amigos'}
                  {activeDrawer === 'arsenal' && 'Hub de Arsenal y Progreso'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChangeDrawer(null)}
                aria-label="Cerrar panel"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 active:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Sheet Content */}
            <div className="max-h-[54dvh] overflow-y-auto p-3.5 space-y-3">
              {activeDrawer === 'modes' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleMatchMode('casual')}
                      className={`min-h-[46px] rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        state.matchMode === 'casual'
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-slate-800 bg-slate-900 text-slate-300'
                      }`}
                    >
                      Modo Casual
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleMatchMode('ranked')}
                      className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                        state.matchMode === 'ranked'
                          ? 'border-amber-400 bg-amber-400 text-slate-950'
                          : 'border-slate-800 bg-slate-900 text-amber-300'
                      }`}
                    >
                      <Swords className="h-4 w-4" />
                      <span>Modo Rangos</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleTeamMode(state.teamMode === 'teams' ? 'ffa' : 'teams')}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        state.teamMode === 'teams'
                          ? 'border-rose-500/60 bg-rose-500/15 text-rose-200'
                          : 'border-slate-700 bg-slate-900 text-slate-200'
                      }`}
                    >
                      <Users className="h-4 w-4" />
                      <span>{state.teamMode === 'teams' ? 'Equipos' : 'Todos vs Todos'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={onToggleBots}
                      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                        state.botsEnabled
                          ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      <Bot className="h-4 w-4" />
                      <span>
                        {state.roomPreset === 'duel_1v1' ? 'Bot 1v1' : 'Drones IA'}:{' '}
                        {state.botsEnabled ? 'Sí' : 'No'}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateRoomRules({ infiniteEnergy: !state.infiniteEnergy })}
                      className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${
                        state.infiniteEnergy
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-800 bg-slate-900 text-slate-300'
                      }`}
                    >
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <span>Energía ∞: {state.infiniteEnergy ? 'Sí' : 'No'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onUpdateRoomRules({ darkHideAndSeek: !state.darkHideAndSeek })}
                      className={`flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${
                        state.darkHideAndSeek
                          ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                          : 'border-slate-800 bg-slate-900 text-slate-300'
                      }`}
                    >
                      <EyeOff className="h-4 w-4 text-indigo-300" />
                      <span>Oscuro: {state.darkHideAndSeek ? 'Sí' : 'No'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenRoomVoiceModal('create', 'duel_1v1');
                      }}
                      className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-amber-400/60 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <Swords className="h-4 w-4 text-amber-300" />
                      <span>Crear PvP 1v1</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenRoomVoiceModal('current');
                      }}
                      className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-cyan-300" />
                      <span>Armas y Reglas</span>
                    </button>
                  </div>

                  {state.allowedWeapons.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-300">
                        Arma para esta partida
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {state.allowedWeapons.map((wId) => {
                          const selected = (me?.activeWeapon ?? me?.equippedWeapon) === wId;
                          return (
                            <button
                              key={wId}
                              type="button"
                              onClick={() => onSelectMatchWeapon(wId)}
                              className={`truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                                selected
                                  ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                                  : 'border-slate-800 bg-slate-950 text-slate-300'
                              }`}
                            >
                              {getWeaponById(wId).name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onToggleForceTouch}
                    className={`flex w-full min-h-[46px] items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                      forceTouchControls
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-800 bg-slate-900/90 text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-cyan-400" />
                      <span>Botones Táctiles en Pantalla (Teléfono)</span>
                    </span>
                    <span className="font-mono-tab font-bold">
                      {forceTouchControls ? 'ACTIVOS' : 'AUTO'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onChangeDrawer(null);
                      onStartMatch();
                    }}
                    className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 font-display text-sm font-bold text-slate-950 active:bg-amber-300"
                  >
                    <Play className="h-4 w-4 fill-slate-950" />
                    <span>Empezar Partida Ahora</span>
                  </button>
                </>
              )}

              {activeDrawer === 'maps' && (
                <div className="grid grid-cols-2 gap-2">
                  {ARENA_MAP_LIST.map((m) => {
                    const votes = state.mapVotes?.counts?.[m.id] ?? 0;
                    const voted = myVote === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onVoteMap(m.id)}
                        className={`overflow-hidden rounded-xl border text-left transition-colors ${
                          voted
                            ? 'border-cyan-400 bg-cyan-500/15'
                            : 'border-slate-800 bg-slate-900/80'
                        }`}
                      >
                        <div className="relative h-16 w-full bg-slate-950">
                          <img
                            src={MAP_AERIAL_IMAGES[m.id]}
                            alt={m.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover opacity-85"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0B101B] via-transparent to-transparent" />
                          <span className="absolute top-1.5 right-1.5 rounded bg-[#0B101B]/90 px-1.5 py-0.5 font-mono-tab text-[11px] font-bold text-cyan-300">
                            {votes} {votes === 1 ? 'voto' : 'votos'}
                          </span>
                        </div>
                        <div className="px-2.5 py-2">
                          <div className="truncate font-display text-xs font-bold text-white">
                            {m.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeDrawer === 'room' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenRoomVoiceModal('create', 'duel_1v1');
                      }}
                      className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 font-display text-xs font-bold text-slate-950"
                    >
                      <Swords className="h-4 w-4" />
                      <span>PvP 1v1 / Crear</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenRoomVoiceModal('public_list');
                      }}
                      className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border border-cyan-400/60 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200"
                    >
                      <Globe className="h-4 w-4" />
                      <span>Públicas ({publicRooms.length})</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onChangeDrawer(null);
                      onOpenRoomVoiceModal('current');
                    }}
                    className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-100"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
                    <span>Reglas, Armas, Energía ∞ y Oscuro</span>
                  </button>

                  {state.roomCode !== 'PUBLIC' ? (
                    <div className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-amber-200/80">
                            {state.isPrivateRoom ? 'Código de Sala Privada' : 'Sala Pública Actual'}
                          </div>
                          <div className="font-mono-tab text-lg font-bold tracking-widest text-amber-300">
                            {state.roomCode}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyRoomCode}
                          className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-amber-400/50 bg-slate-900 px-3 py-2 text-xs font-bold text-amber-200"
                        >
                          {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                          <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={onLeavePrivateRoom}
                        className="flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Volver a Sala Global</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={onCreatePrivateRoom}
                      className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-2 font-display text-xs font-bold text-amber-200"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Sala Privada Rápida</span>
                    </button>
                  )}

                  <form onSubmit={handleJoinRoomSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={8}
                      value={roomInput}
                      onChange={(e) => {
                        setRoomInput(e.target.value.toUpperCase());
                        if (roomError) onClearRoomError();
                      }}
                      placeholder="Código de sala..."
                      className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono-tab text-xs font-semibold uppercase text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-200 shrink-0"
                    >
                      Unirse
                    </button>
                  </form>

                  {roomError && (
                    <div className="rounded-lg border border-rose-500/50 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
                      {roomError}
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Jugadores en Lobby</span>
                      <span className="font-mono-tab text-cyan-300">{humanPlayers.length}</span>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1.5">
                      {humanPlayers.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={GENDER_PORTRAIT[p.gender]}
                              alt={p.name}
                              referrerPolicy="no-referrer"
                              className="h-6 w-6 rounded object-cover object-top bg-slate-800 shrink-0"
                            />
                            <RankBadge rankedWins={p.rankedWins ?? 0} size="xs" />
                            <span className="truncate font-medium text-slate-100">
                              {p.country ? `${countryCodeToFlag(p.country)} ` : ''}
                              {p.name}
                              {p.id === myId ? ' (Tú)' : ''}
                            </span>
                          </div>
                          {state.teamMode === 'teams' && p.team && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${
                                p.team === 'cyan'
                                  ? 'bg-cyan-500/20 text-cyan-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {p.team === 'cyan' ? 'AZUL' : 'ROJO'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-start">
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
                </div>
              )}

              {activeDrawer === 'social' && (
                <div className="space-y-3">
                  {incomingInvites.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-amber-400/50 bg-amber-500/10 p-3">
                      <div className="text-xs font-bold text-amber-300">
                        Invitaciones pendientes ({incomingInvites.length})
                      </div>
                      {incomingInvites.slice(0, 2).map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[#0A0F1A] px-3 py-2 text-xs"
                        >
                          <span className="truncate text-white font-semibold">
                            {inv.fromName} · {inv.roomCode}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onDeclineInvite(inv)}
                              className="min-h-[36px] rounded-md border border-slate-700 px-2.5 text-[11px] text-slate-300"
                            >
                              Ignorar
                            </button>
                            <button
                              type="button"
                              onClick={() => onAcceptInvite(inv)}
                              className="min-h-[36px] rounded-md bg-amber-400 px-2.5 text-[11px] font-bold text-slate-950"
                            >
                              Unirse
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Emotes Grid */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                        <Smile className="h-4 w-4 text-cyan-400" />
                        <span>Emotes 3D Rápidos</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onChangeDrawer(null);
                          onOpenEmotes();
                        }}
                        className="rounded-md border border-cyan-500/50 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-200"
                      >
                        Abrir Rueda
                      </button>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {EMOTES.map((em) => (
                        <button
                          key={em.id}
                          type="button"
                          onClick={() => onTriggerEmote(em.id)}
                          className="flex min-h-[44px] flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-lg active:border-cyan-400"
                        >
                          <span className="leading-none">{em.emoji}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Embedded Room Chat */}
                  <MatchChatPanel
                    embedded
                    messages={chatMessages}
                    blockedReason={chatBlockedReason}
                    phase={state.phase}
                    focusSignal={chatFocusSignal}
                    onSendMessage={onSendChat}
                    onClearBlocked={onClearChatBlocked}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      onChangeDrawer(null);
                      onOpenFriends();
                    }}
                    className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-200"
                  >
                    <Users className="h-4 w-4" />
                    <span>Gestionar Amigos e Invitar</span>
                  </button>
                </div>
              )}

              {activeDrawer === 'arsenal' && (
                <div className="space-y-3">
                  {me && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Arma equipada</span>
                        <span className="font-bold text-amber-300">
                          {getWeaponById(me.equippedWeapon).name} ·{' '}
                          <span className="text-cyan-300">
                            {getWeaponSkinById(me.equippedWeaponSkin).name}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Traje equipado</span>
                        <span className="font-bold text-white">
                          {getOutfitById(me.equippedOutfit).name}{' '}
                          <span className="font-mono-tab text-emerald-300">
                            Nv.{getOutfitLevel(me.outfitLevels, me.equippedOutfit)} ({me.maxHp} HP)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Monedas</span>
                        <span className="flex items-center gap-1 font-mono-tab font-bold text-amber-300">
                          <Coins className="h-3.5 w-3.5" />
                          {me.infiniteCoins ? '∞' : me.coins}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenInventory();
                      }}
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <Shirt className="h-4 w-4 text-amber-300" />
                      <span>Armas y Trajes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenMissions();
                      }}
                      className="relative flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-100"
                    >
                      <Target className="h-4 w-4 text-amber-400" />
                      <span>Misiones</span>
                      {claimableMissionsCount > 0 && (
                        <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono-tab text-[10px] font-bold text-slate-950">
                          {claimableMissionsCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenLeaderboard('global');
                      }}
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-100"
                    >
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span>Leaderboard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onChangeDrawer(null);
                        onOpenLeaderboard('ranked');
                      }}
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-amber-200"
                    >
                      <Shield className="h-4 w-4 text-amber-400" />
                      <span>Rangos</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM PHONE HUB BAR (Thumb Zone Anchor) */}
      <nav
        aria-label="Hub de teléfono"
        className="pointer-events-auto fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/90 bg-[#080C14]/94 backdrop-blur-md pb-safe"
      >
        <div className="mx-auto flex max-w-lg items-center gap-1 px-1.5 pt-1.5">
          <button
            type="button"
            onClick={() => toggleTab('modes')}
            className={`flex min-h-[46px] flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors ${
              activeDrawer === 'modes'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-300 active:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            <span className="mt-1 text-[10px] font-semibold leading-none whitespace-nowrap">
              Modos
            </span>
          </button>

          <button
            type="button"
            onClick={() => toggleTab('maps')}
            className={`flex min-h-[46px] flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors ${
              activeDrawer === 'maps'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-300 active:bg-slate-800'
            }`}
          >
            <MapIcon className="h-4 w-4 shrink-0" />
            <span className="mt-1 text-[10px] font-semibold leading-none whitespace-nowrap">
              Mapas
            </span>
          </button>

          {/* Prominent Center Start Match CTA */}
          <button
            type="button"
            onClick={() => {
              onChangeDrawer(null);
              onStartMatch();
            }}
            className="flex min-h-[46px] min-w-[84px] items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 font-display text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 active:bg-amber-300 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5 fill-slate-950 shrink-0" />
            <span>EMPEZAR</span>
          </button>

          <button
            type="button"
            onClick={() => toggleTab('room')}
            className={`relative flex min-h-[46px] flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors ${
              activeDrawer === 'room'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-300 active:bg-slate-800'
            }`}
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <span className="mt-1 text-[10px] font-semibold leading-none whitespace-nowrap">
              Sala
            </span>
          </button>

          <button
            type="button"
            onClick={() => toggleTab('social')}
            className={`relative flex min-h-[46px] flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors ${
              activeDrawer === 'social'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-300 active:bg-slate-800'
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="mt-1 text-[10px] font-semibold leading-none whitespace-nowrap">
              Social
            </span>
            {incomingInvites.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 font-mono-tab text-[9px] font-bold text-slate-950">
                {incomingInvites.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => toggleTab('arsenal')}
            className={`relative flex min-h-[46px] flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors ${
              activeDrawer === 'arsenal'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-300 active:bg-slate-800'
            }`}
          >
            <Shirt className="h-4 w-4 shrink-0" />
            <span className="mt-1 text-[10px] font-semibold leading-none whitespace-nowrap">
              Arsenal
            </span>
            {totalNotifications > 0 && claimableMissionsCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 font-mono-tab text-[9px] font-bold text-slate-950">
                {claimableMissionsCount}
              </span>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
