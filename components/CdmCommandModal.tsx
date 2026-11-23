import {
  ArrowUpCircle,
  Ban,
  Bot,
  CloudLightning,
  CloudRain,
  Coins,
  Crosshair,
  EyeOff,
  Feather,
  Flame,
  Heart,
  HeartPulse,
  Infinity as InfinityIcon,
  LogOut,
  Megaphone,
  Moon,
  Navigation,
  Palette,
  Play,
  Rocket,
  Search,
  Send,
  Shield,
  Skull,
  Smile,
  Snowflake,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  UserX,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import type {
  BannedPlayerRecord,
  CdmCommandId,
  OwnerAnnouncement,
  PlayerSnapshot,
  ServerStatePayload,
} from '../shared/types';
import { GAME_LOGO_URL } from './SplashIntroOverlay';

export interface CdmPowersState {
  canFly: boolean;
  speedBoosted: boolean;
  godMode: boolean;
  infiniteAmmo: boolean;
  infiniteCoins: boolean;
}

interface CdmCommandModalProps {
  open: boolean;
  onClose: () => void;
  state: ServerStatePayload;
  me: PlayerSnapshot | null;
  powers: CdmPowersState;
  feedback: { ok: boolean; text: string } | null;
  bannedPlayers: BannedPlayerRecord[];
  activeAnnouncement: OwnerAnnouncement | null;
  announcementLog: OwnerAnnouncement[];
  onExecuteCommand: (command: CdmCommandId, targetId?: string) => void;
  onSubmitCommandLine: (commandLine: string) => void;
}

type CdmMenuTab = 'anuncio' | 'poderes' | 'partida' | 'eventos' | 'jugadores';

interface CommandItem {
  id: CdmCommandId;
  slash: string;
  label: string;
  description: string;
  icon: ReactNode;
  active?: boolean;
  tone?: 'cyan' | 'amber' | 'emerald' | 'rose' | 'indigo';
}

export function CdmCommandModal({
  open,
  onClose,
  state,
  me,
  powers,
  feedback,
  bannedPlayers,
  activeAnnouncement,
  announcementLog,
  onExecuteCommand,
  onSubmitCommandLine,
}: CdmCommandModalProps) {
  const [activeTab, setActiveTab] = useState<CdmMenuTab>('anuncio');
  const [commandInput, setCommandInput] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [tpTargetQuery, setTpTargetQuery] = useState('');
  const [banTargetId, setBanTargetId] = useState('');
  const [banSearchQuery, setBanSearchQuery] = useState('');

  if (!open) return null;

  const now = state.serverTime;
  const lowGravityOn = (state.lowGravityUntil ?? 0) > now;
  const turboArenaOn = (state.turboArenaUntil ?? 0) > now;
  const meteorShowerOn = (state.meteorShowerUntil ?? 0) > now;
  const overchargeStormOn = (state.overchargeStormUntil ?? 0) > now;
  const blackoutOn = (state.blackoutUntil ?? 0) > now;
  const oneShotOn = (state.oneShotUntil ?? 0) > now;
  const superJumpOn = (state.superJumpUntil ?? 0) > now;
  const bigHeadsOn = (state.bigHeadsUntil ?? 0) > now;
  const vampireOn = (state.vampireUntil ?? 0) > now;
  const iceFloorOn = (state.iceFloorUntil ?? 0) > now;
  const rainbowChaosOn = (state.rainbowChaosUntil ?? 0) > now;
  const activeDropsCount = state.drops?.length ?? 0;

  const canFly = powers.canFly || Boolean(me?.canFly);
  const speedBoosted = powers.speedBoosted || Boolean(me?.speedBoosted);
  const godMode = powers.godMode || Boolean(me?.godMode);
  const infiniteAmmo = powers.infiniteAmmo || Boolean(me?.infiniteAmmo);
  const infiniteCoins = powers.infiniteCoins || Boolean(me?.infiniteCoins);

  const kickablePlayers = state.players.filter((p) => p.id !== me?.id);
  const normalizedBanSearch = banSearchQuery.trim().toLowerCase();
  const filteredBannedPlayers = normalizedBanSearch
    ? bannedPlayers.filter(
        (b) =>
          b.name.toLowerCase().includes(normalizedBanSearch) ||
          b.id.toLowerCase().includes(normalizedBanSearch),
      )
    : bannedPlayers;

  const agentPowers: CommandItem[] = [
    {
      id: 'toggle_fly',
      slash: '/fly',
      label: canFly ? 'Volar: ACTIVO' : 'Modo Volar',
      description: 'Espacio sube · Control baja en el aire',
      icon: <Feather className="h-4 w-4" />,
      active: canFly,
      tone: 'cyan',
    },
    {
      id: 'toggle_speed',
      slash: '/speed',
      label: speedBoosted ? 'Velocidad x1.7: ON' : 'Súper Velocidad',
      description: 'Corre más rápido con energía ilimitada',
      icon: <Wind className="h-4 w-4" />,
      active: speedBoosted,
      tone: 'emerald',
    },
    {
      id: 'toggle_god',
      slash: '/god',
      label: godMode ? 'Modo Dios: ON' : 'Modo Inmortal',
      description: 'Inmunidad total al daño enemigo',
      icon: <Shield className="h-4 w-4" />,
      active: godMode,
      tone: 'amber',
    },
    {
      id: 'toggle_ammo',
      slash: '/ammo',
      label: infiniteAmmo ? 'Munición ∞: ON' : 'Munición Infinita',
      description: 'Dispara sin gastar cargas ni recargar',
      icon: <Crosshair className="h-4 w-4" />,
      active: infiniteAmmo,
      tone: 'cyan',
    },
    {
      id: 'heal_full',
      slash: '/heal',
      label: 'Curar + Escudo',
      description: 'Restaura salud al 100% y da escudo',
      icon: <Heart className="h-4 w-4" />,
      tone: 'emerald',
    },
    {
      id: 'toggle_infinite_coins',
      slash: '/infcoins',
      label: infiniteCoins ? 'Monedas ∞: ON' : 'Monedas Infinitas',
      description: 'Todo el arsenal y mejoras gratis en sesión',
      icon: <InfinityIcon className="h-4 w-4" />,
      active: infiniteCoins,
      tone: 'amber',
    },
    {
      id: 'give_coins',
      slash: '/coins',
      label: '+500 Monedas',
      description: 'Suma 500 monedas instantáneas',
      icon: <Coins className="h-4 w-4" />,
      tone: 'amber',
    },
    {
      id: 'unlock_all',
      slash: '/unlock',
      label: 'Desbloquear Arsenal',
      description: 'Desbloquea armas, cuchillos y skins en sala',
      icon: <Unlock className="h-4 w-4" />,
      tone: 'indigo',
    },
  ];

  const matchCommands: CommandItem[] = [
    {
      id: 'start_match',
      slash: '/start',
      label: 'Iniciar Partida',
      description: 'Lleva toda la sala directo a la arena',
      icon: <Play className="h-4 w-4" />,
      tone: 'emerald',
    },
    {
      id: 'end_match',
      slash: '/end',
      label: 'Terminar Partida',
      description: 'Cierra la ronda actual y muestra podio',
      icon: <Square className="h-4 w-4" />,
      tone: 'rose',
    },
    {
      id: 'return_lobby',
      slash: '/lobby',
      label: 'Volver al Lobby',
      description: 'Regresa a todos al Lobby inmediatamente',
      icon: <LogOut className="h-4 w-4" />,
      tone: 'cyan',
    },
    {
      id: 'toggle_infinite_energy',
      slash: '/energy',
      label: state.infiniteEnergy ? 'Energía ∞: ON' : 'Energía Infinita',
      description: 'Sprint ilimitado para toda la sala',
      icon: <InfinityIcon className="h-4 w-4" />,
      active: state.infiniteEnergy,
      tone: 'emerald',
    },
    {
      id: 'toggle_dark',
      slash: '/dark',
      label: state.darkHideAndSeek ? 'Escondite Oscuro: ON' : 'Escondite Oscuro',
      description: 'Activa o apaga linternas en arena oscura',
      icon: <EyeOff className="h-4 w-4" />,
      active: state.darkHideAndSeek,
      tone: 'indigo',
    },
    {
      id: 'toggle_bots',
      slash: '/bots',
      label: state.botsEnabled ? 'Bots: ACTIVOS' : 'Bots: APAGADOS',
      description: 'Activa o quita bots de entrenamiento',
      icon: <Bot className="h-4 w-4" />,
      active: state.botsEnabled,
      tone: 'cyan',
    },
    {
      id: 'respawn_bots',
      slash: '/respawnbots',
      label: 'Reiniciar Bots',
      description: 'Revive y reposiciona todos los bots',
      icon: <Sparkles className="h-4 w-4" />,
      tone: 'amber',
    },
  ];

  const eventCommands: CommandItem[] = [
    {
      id: 'event_weapon_rain',
      slash: '/rain',
      label: 'Lluvia de Armas',
      description: 'Caen 14 cajas de armas láser por el mapa',
      icon: <CloudRain className="h-4 w-4" />,
      tone: 'cyan',
    },
    {
      id: 'event_shield_rain',
      slash: '/shields',
      label: 'Lluvia de Escudos',
      description: 'Caen 12 núcleos de salud y escudo',
      icon: <Shield className="h-4 w-4" />,
      tone: 'emerald',
    },
    {
      id: 'event_coin_rain',
      slash: '/coinrain',
      label: 'Lluvia de Monedas',
      description: 'Caen 16 fichas de monedas (+35 c/u)',
      icon: <Coins className="h-4 w-4" />,
      tone: 'amber',
    },
    {
      id: 'event_mega_rain',
      slash: '/megarain',
      label: 'Mega Lluvia Total',
      description: '12 armas + 10 escudos + 18 monedas',
      icon: <Sparkles className="h-4 w-4" />,
      tone: 'amber',
    },
    {
      id: 'event_meteor_shower',
      slash: '/meteors',
      label: meteorShowerOn ? 'Meteoritos: ON' : 'Lluvia de Meteoritos (25s)',
      description: 'Meteoros explosivos con zonas rojas',
      icon: <Flame className="h-4 w-4" />,
      active: meteorShowerOn,
      tone: 'rose',
    },
    {
      id: 'event_overcharge_storm',
      slash: '/overcharge',
      label: overchargeStormOn ? 'Sobrecarga: ON' : 'Tormenta Sobrecarga (30s)',
      description: 'Boost global de daño + armas y escudos',
      icon: <CloudLightning className="h-4 w-4" />,
      active: overchargeStormOn,
      tone: 'cyan',
    },
    {
      id: 'event_blackout',
      slash: '/blackout',
      label: blackoutOn ? 'Apagón: ON' : 'Apagón Nocturno (35s)',
      description: 'Oscuridad temporal con linternas',
      icon: <Moon className="h-4 w-4" />,
      active: blackoutOn,
      tone: 'indigo',
    },
    {
      id: 'event_one_shot',
      slash: '/oneshot',
      label: oneShotOn ? 'Insta-Tag 1-Hit: ON' : 'Modo 1-Hit (35s)',
      description: 'Cada disparo o corte elimina de 1 golpe',
      icon: <Skull className="h-4 w-4" />,
      active: oneShotOn,
      tone: 'rose',
    },
    {
      id: 'event_super_jump',
      slash: '/superjump',
      label: superJumpOn ? 'Súper Salto: ON' : 'Súper Salto x1.65 (40s)',
      description: 'Impulsa los saltos de todos por 40s',
      icon: <ArrowUpCircle className="h-4 w-4" />,
      active: superJumpOn,
      tone: 'emerald',
    },
    {
      id: 'event_low_gravity',
      slash: '/lowgrav',
      label: lowGravityOn ? 'Gravedad Lunar: ON' : 'Gravedad Lunar (45s)',
      description: 'Saltos altísimos en cámara lenta 45s',
      icon: <Rocket className="h-4 w-4" />,
      active: lowGravityOn,
      tone: 'indigo',
    },
    {
      id: 'event_turbo_arena',
      slash: '/turbo',
      label: turboArenaOn ? 'Arena Turbo: ON' : 'Arena Turbo (45s)',
      description: 'Velocidad x1.4 y cadencia rápida 45s',
      icon: <Zap className="h-4 w-4" />,
      active: turboArenaOn,
      tone: 'rose',
    },
    {
      id: 'event_big_heads',
      slash: '/cabezones',
      label: bigHeadsOn ? 'Modo Cabezones: ON' : 'Modo Cabezones (40s)',
      description: 'Cabezas gigantes x2.35 y hitbox ampliada',
      icon: <Smile className="h-4 w-4" />,
      active: bigHeadsOn,
      tone: 'amber',
    },
    {
      id: 'event_vampire',
      slash: '/vampiro',
      label: vampireOn ? 'Modo Vampiro: ON' : 'Modo Vampiro (40s)',
      description: 'Robas 45% del daño hecho como vida y escudo',
      icon: <HeartPulse className="h-4 w-4" />,
      active: vampireOn,
      tone: 'rose',
    },
    {
      id: 'event_ice_floor',
      slash: '/hielo',
      label: iceFloorOn ? 'Pista de Hielo: ON' : 'Pista de Hielo (40s)',
      description: 'Suelo congelado resbaladizo con inercia',
      icon: <Snowflake className="h-4 w-4" />,
      active: iceFloorOn,
      tone: 'cyan',
    },
    {
      id: 'event_rainbow_chaos',
      slash: '/caos',
      label: rainbowChaosOn ? 'Caos Láser: ON' : 'Caos Láser Neón (35s)',
      description: 'Láseres arcoíris y cadencia súper rápida',
      icon: <Palette className="h-4 w-4" />,
      active: rainbowChaosOn,
      tone: 'indigo',
    },
    {
      id: 'event_heal_wave',
      slash: '/curatotal',
      label: 'Onda Curativa Global',
      description: 'Cura 100% + escudo a todos y suelta núcleos',
      icon: <Heart className="h-4 w-4" />,
      tone: 'emerald',
    },
    {
      id: 'clear_drops',
      slash: '/clear',
      label: `Limpiar Objetos (${activeDropsCount})`,
      description: 'Elimina cajas y drops caídos',
      icon: <Trash2 className="h-4 w-4" />,
      tone: 'rose',
    },
    {
      id: 'clear_events',
      slash: '/stopevents',
      label: 'Detener Todos los Eventos',
      description: 'Apaga modificadores y limpia drops',
      icon: <Square className="h-4 w-4" />,
      tone: 'rose',
    },
  ];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = commandInput.trim();
    if (!trimmed) return;
    onSubmitCommandLine(trimmed);
    setCommandInput('');
  };

  const handleTpSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = tpTargetQuery.trim();
    if (!trimmed) return;
    onExecuteCommand('tp_to_player', trimmed);
    setTpTargetQuery('');
  };

  const handleBanSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = banTargetId.trim();
    if (!trimmed) return;
    onExecuteCommand('admin_ban', trimmed);
    setBanTargetId('');
  };

  const handleAnnounceSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = announceText.trim();
    if (!trimmed) return;
    onExecuteCommand('owner_announce', trimmed);
    setAnnounceText('');
  };

  const menuTabs: { id: CdmMenuTab; label: string; icon: ReactNode }[] = [
    { id: 'anuncio', label: 'Anuncio', icon: <Megaphone className="h-3.5 w-3.5" /> },
    { id: 'poderes', label: 'Poderes', icon: <Feather className="h-3.5 w-3.5" /> },
    { id: 'partida', label: 'Partida', icon: <Play className="h-3.5 w-3.5" /> },
    { id: 'eventos', label: 'Eventos', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: 'jugadores', label: 'Jugadores', icon: <Users className="h-3.5 w-3.5" /> },
  ];

  const renderSection = (title: string, badge: string, list: CommandItem[]) => (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {title}
        </h3>
        <span className="text-[10px] text-slate-400 truncate">{badge}</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {list.map((cmd) => {
          const activeClass = cmd.active
            ? cmd.tone === 'amber'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : cmd.tone === 'emerald'
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                : cmd.tone === 'indigo'
                  ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                  : cmd.tone === 'rose'
                    ? 'border-rose-400 bg-rose-500/20 text-rose-100'
                    : 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
            : 'border-slate-800 bg-slate-900/85 text-slate-200 hover:border-slate-600 hover:bg-slate-900';

          return (
            <button
              key={cmd.id}
              type="button"
              onClick={() => onExecuteCommand(cmd.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors cursor-pointer min-h-[46px] ${activeClass}`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  cmd.active
                    ? 'border-white/25 bg-white/10 text-white'
                    : 'border-slate-700 bg-slate-950 text-cyan-300'
                }`}
              >
                {cmd.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-display text-xs font-bold truncate">{cmd.label}</span>
                  <span className="font-mono-tab rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 shrink-0">
                    {cmd.slash}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400 leading-tight truncate">
                  {cmd.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-50 flex w-full justify-end p-2 sm:p-3">
      <aside
        aria-label="Consola Privada CDM"
        onKeyDown={(e) => e.stopPropagation()}
        className="pointer-events-auto flex h-full w-full max-w-[min(88vw,380px)] flex-col overflow-hidden rounded-2xl border border-cyan-500/45 bg-[#0B111E]/95 shadow-2xl backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3.5 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/45 bg-cyan-500/15 text-cyan-300">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-display text-sm font-bold text-white truncate">
                  Consola CDM
                </h2>
                <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 shrink-0">
                  Privado
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {state.isPrivateRoom ? state.roomCode : 'Pública'} · {state.phase}
                {canFly ? ' · Volar ON' : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar consola CDM"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Slash Command Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-1.5 border-b border-slate-800 bg-[#080D17] px-3 py-2"
        >
          <Zap className="h-4 w-4 shrink-0 text-amber-400" />
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="/tp Ana, /cabezones, /hielo, /fly..."
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono-tab text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-[36px] shrink-0 rounded-lg bg-cyan-400 px-3 py-1.5 font-display text-xs font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
          >
            Ejecutar
          </button>
        </form>

        {/* Feedback Strip */}
        {feedback && (
          <div
            className={`border-b px-3.5 py-2 text-[11px] font-semibold leading-snug ${
              feedback.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/35 bg-rose-500/15 text-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Menu Tabs */}
        <nav
          aria-label="Menús del panel admin"
          className="grid grid-cols-5 gap-1 border-b border-slate-800 bg-[#080D17] px-2 py-1.5"
        >
          {menuTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-white'
                    : 'border-transparent bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span className="truncate max-w-full">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Menu Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-3.5">
          {activeTab === 'anuncio' && (
            <div className="flex h-full flex-col gap-3">
              <div className="rounded-xl border border-amber-400/35 bg-amber-950/15 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-amber-200 truncate">
                      Chat Global del Dueño
                    </h3>
                  </div>
                  <span className="text-[10px] font-medium text-amber-300/90 whitespace-nowrap shrink-0">
                    Todos los servidores
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-300 leading-snug">
                  Lo que escribas aquí aparecerá arriba en pequeño en todas las salas con el logo del juego y{' '}
                  <span className="font-bold text-amber-300">Dueño:</span>
                </p>

                {/* Compact Top Banner Preview */}
                <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-400/45 bg-[#080D18] px-2.5 py-1.5">
                  <img
                    src={GAME_LOGO_URL}
                    alt="Apex Laser Tag"
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 shrink-0 rounded border border-amber-400/40 bg-[#060B16] object-contain p-0.5"
                  />
                  <span className="shrink-0 whitespace-nowrap font-display text-[11px] font-bold text-amber-300">
                    Dueño:
                  </span>
                  <span className="min-w-0 truncate text-xs text-slate-200">
                    {activeAnnouncement?.text || announceText.trim() || 'Tu mensaje aparecerá aquí arriba...'}
                  </span>
                </div>

                {activeAnnouncement && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-emerald-300">
                    <span className="truncate">Anuncio activo en todos los servidores</span>
                    <button
                      type="button"
                      onClick={() => onExecuteCommand('clear_owner_announce')}
                      className="shrink-0 rounded-md border border-rose-500/45 bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-200 hover:bg-rose-500 hover:text-white cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              {/* Owner Announcement Chat Input */}
              <form onSubmit={handleAnnounceSubmit} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={announceText}
                  onChange={(e) => setAnnounceText(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  maxLength={160}
                  placeholder="Escribe el texto para todos..."
                  aria-label="Texto del anuncio del dueño"
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 font-display text-xs font-bold text-slate-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </button>
              </form>

              {/* Recent Owner Broadcast Log */}
              <div className="flex-1 min-h-[120px] rounded-xl border border-slate-800 bg-slate-950/75 p-2.5 overflow-y-auto space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Historial enviado
                </div>
                {announcementLog.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Aún no has enviado anuncios globales en esta sesión.
                  </p>
                ) : (
                  [...announcementLog].reverse().map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/70 px-2.5 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-white break-words">
                          <span className="font-bold text-amber-300">Dueño: </span>
                          {item.text}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onExecuteCommand('owner_announce', item.text)}
                        className="shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 hover:border-cyan-400 cursor-pointer whitespace-nowrap"
                      >
                        Reenviar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'poderes' && renderSection('Poderes del Agente', 'Personal', agentPowers)}

          {activeTab === 'partida' && renderSection('Control de Partida', 'Sala actual', matchCommands)}

          {activeTab === 'eventos' &&
            renderSection('Eventos en Arena', 'Todos los servidores', eventCommands)}

          {activeTab === 'jugadores' && (
            <div className="space-y-4">
              {/* Teleport to Player Section */}
              <div className="rounded-xl border border-cyan-500/35 bg-cyan-950/20 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Navigation className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-cyan-200 truncate">
                      Teletransportarse a Jugador
                    </h3>
                  </div>
                  <span className="font-mono-tab rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 shrink-0">
                    /tp &lt;nombre&gt;
                  </span>
                </div>

                <form onSubmit={handleTpSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tpTargetQuery}
                    onChange={(e) => setTpTargetQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Nombre o ID (cualquier servidor)..."
                    aria-label="Nombre o ID para teletransporte"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono-tab text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg bg-cyan-400 px-3 py-1.5 font-display text-xs font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Ir
                  </button>
                </form>
              </div>

              {/* Admin Kick / Ban Section */}
              <div className="rounded-xl border border-rose-500/35 bg-rose-950/20 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <UserX className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-rose-200 truncate">
                      Expulsar / Banear (admin_ban)
                    </h3>
                  </div>
                  <span className="font-mono-tab rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 shrink-0">
                    /ban &lt;id&gt;
                  </span>
                </div>

                <form onSubmit={handleBanSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={banTargetId}
                    onChange={(e) => setBanTargetId(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="ID del jugador (ej. usr_4)"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono-tab text-xs text-white placeholder-slate-500 focus:border-rose-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg bg-rose-500 px-2.5 py-1.5 font-display text-xs font-bold text-white hover:bg-rose-400 cursor-pointer"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Banear
                  </button>
                </form>

                {kickablePlayers.length > 0 ? (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-0.5">
                    {kickablePlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-white">
                              {p.name}
                            </span>
                            <span
                              className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase shrink-0 ${
                                p.isBot
                                  ? 'bg-slate-800 text-slate-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {p.isBot ? 'BOT' : 'JUGADOR'}
                            </span>
                          </div>
                          <span className="font-mono-tab block text-[10px] text-slate-400 truncate">
                            ID: {p.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onExecuteCommand('tp_to_player', p.id)}
                          title={`Teletransportarse a ${p.name}`}
                          className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-cyan-500/50 bg-cyan-500/20 px-2 py-1 text-[11px] font-bold text-cyan-200 hover:bg-cyan-400 hover:text-slate-950 cursor-pointer"
                        >
                          <Navigation className="h-3 w-3" />
                          TP
                        </button>
                        <button
                          type="button"
                          onClick={() => onExecuteCommand('admin_ban', p.id)}
                          className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/20 px-2 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500 hover:text-white cursor-pointer"
                        >
                          <Ban className="h-3 w-3" />
                          Ban
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">
                    No hay otros jugadores en esta sala ahora mismo.
                  </p>
                )}
              </div>

              {/* Banned Players List & Unban Search */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <h3 className="font-display text-[11px] font-bold uppercase tracking-wider text-emerald-200 truncate">
                      Personas Baneadas ({bannedPlayers.length})
                    </h3>
                  </div>
                  <span className="font-mono-tab rounded bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 shrink-0">
                    /unban
                  </span>
                </div>

                <div className="relative flex items-center">
                  <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={banSearchQuery}
                    onChange={(e) => setBanSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Buscar baneado por nombre o ID..."
                    aria-label="Buscador de personas baneadas"
                    className="min-w-0 w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-8 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                  {banSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBanSearchQuery('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {filteredBannedPlayers.length > 0 ? (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-0.5">
                    {filteredBannedPlayers.map((banned) => (
                      <div
                        key={banned.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-white">
                            {banned.name}
                          </div>
                          <span className="font-mono-tab block text-[10px] text-slate-400 truncate">
                            ID: {banned.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onExecuteCommand('admin_unban', banned.id)}
                          className="flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500 hover:text-slate-950 cursor-pointer"
                        >
                          <UserCheck className="h-3 w-3" />
                          Desbanear
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">
                    {bannedPlayers.length === 0
                      ? 'No hay personas baneadas actualmente.'
                      : `Ningún jugador baneado coincide con "${banSearchQuery.trim()}".`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
